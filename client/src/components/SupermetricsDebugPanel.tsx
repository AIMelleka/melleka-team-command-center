import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AccountStatus {
  accountId: string;
  accountName: string;
  platform: string;
  platformLabel: string;
  clientName: string;
  status: 'untested' | 'testing' | 'working' | 'blocked' | 'error';
  errorMessage?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  bing_ads: 'Bing Ads',
  tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads',
};

const DS_IDS: Record<string, string> = {
  google_ads: 'AW',
  meta_ads: 'FA',
  bing_ads: 'AC',
  tiktok_ads: 'TIK',
  linkedin_ads: 'LIA',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SupermetricsDebugPanel({ open, onOpenChange }: Props) {
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState({ current: 0, total: 0 });

  // Load all mapped accounts from DB
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get mappings
      const { data: mappings, error } = await supabase
        .from('client_account_mappings')
        .select('*')
        .order('platform')
        .order('client_name');
      if (error) throw error;

      // Get account names from Supermetrics
      const { data: smData } = await supabase.functions.invoke('fetch-supermetrics', {
        body: { action: 'list-accounts' },
      });

      const nameMap: Record<string, Record<string, string>> = {};
      if (smData?.accounts) {
        for (const [platform, accs] of Object.entries(smData.accounts)) {
          nameMap[platform] = {};
          for (const acc of accs as { id: string; name: string }[]) {
            nameMap[platform][acc.id] = acc.name;
          }
        }
      }

      const accountList: AccountStatus[] = (mappings || []).map((m) => ({
        accountId: m.account_id,
        accountName: m.account_name || nameMap[m.platform]?.[m.account_id] || m.account_id,
        platform: m.platform,
        platformLabel: PLATFORM_LABELS[m.platform] || m.platform,
        clientName: m.client_name,
        status: 'untested' as const,
      }));

      setAccounts(accountList);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadAccounts();
  }, [open, loadAccounts]);

  // Test all accounts one by one
  const testAllAccounts = useCallback(async () => {
    setIsTesting(true);
    const total = accounts.length;
    setTestProgress({ current: 0, total });

    // Deduplicate: test each unique platform+accountId only once
    const uniqueKeys = new Map<string, number[]>(); // key -> indices in accounts array
    accounts.forEach((acc, idx) => {
      const key = `${acc.platform}|${acc.accountId}`;
      if (!uniqueKeys.has(key)) uniqueKeys.set(key, []);
      uniqueKeys.get(key)!.push(idx);
    });

    // Set all to testing
    setAccounts(prev => prev.map(a => ({ ...a, status: 'testing' as const })));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    let tested = 0;

    // Test in batches of 3
    const entries = Array.from(uniqueKeys.entries());
    for (let i = 0; i < entries.length; i += 3) {
      const batch = entries.slice(i, i + 3);
      await Promise.allSettled(
        batch.map(async ([key, indices]) => {
          const [platform, accountId] = key.split('|');
          const dsId = DS_IDS[platform];
          if (!dsId) {
            setAccounts(prev => {
              const next = [...prev];
              for (const idx of indices) next[idx] = { ...next[idx], status: 'error', errorMessage: 'Unknown platform' };
              return next;
            });
            return;
          }

          try {
            const { data, error } = await supabase.functions.invoke('fetch-supermetrics', {
              body: {
                action: 'fetch-data',
                dataSources: [platform],
                accounts: { [platform]: [accountId] },
                dateStart: dateStr,
                dateEnd: dateStr,
              },
            });

            if (error) throw error;

            const platformResult = data?.platforms?.[platform];
            const hasError = platformResult?.errors?.some((e: string) =>
              e.toLowerCase().includes('prioriti') || e.toLowerCase().includes('not available') || e.toLowerCase().includes('insufficient')
            );
            const hasData = platformResult?.summary && (platformResult.summary._impressions > 0 || platformResult.summary._clicks > 0 || platformResult.summary._cost > 0);

            const status: AccountStatus['status'] = hasError ? 'blocked' : hasData ? 'working' : 'working'; // no data for 1 day is still ok
            const errorMsg = hasError ? platformResult.errors[0] : undefined;

            setAccounts(prev => {
              const next = [...prev];
              for (const idx of indices) next[idx] = { ...next[idx], status, errorMessage: errorMsg };
              return next;
            });
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            const isBlocked = errMsg.toLowerCase().includes('prioriti');
            setAccounts(prev => {
              const next = [...prev];
              for (const idx of indices) next[idx] = { ...next[idx], status: isBlocked ? 'blocked' : 'error', errorMessage: errMsg };
              return next;
            });
          }

          tested += indices.length;
          setTestProgress({ current: tested, total });
        })
      );
    }

    setIsTesting(false);
  }, [accounts]);

  const working = accounts.filter(a => a.status === 'working').length;
  const blocked = accounts.filter(a => a.status === 'blocked').length;
  const errors = accounts.filter(a => a.status === 'error').length;
  const untested = accounts.filter(a => a.status === 'untested' || a.status === 'testing').length;

  // Group by platform
  const grouped = accounts.reduce<Record<string, AccountStatus[]>>((acc, item) => {
    if (!acc[item.platform]) acc[item.platform] = [];
    acc[item.platform].push(item);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Supermetrics Account Status
            <Badge variant="outline" className="text-xs">{accounts.length} accounts</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex items-center gap-3 py-2 border-b border-border">
          {working > 0 && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <CheckCircle className="h-3.5 w-3.5" /> {working} working
            </span>
          )}
          {blocked > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <XCircle className="h-3.5 w-3.5" /> {blocked} blocked
            </span>
          )}
          {errors > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5" /> {errors} errors
            </span>
          )}
          {untested > 0 && (
            <span className="text-xs text-muted-foreground">{untested} untested</span>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant={isTesting ? 'outline' : 'default'}
            onClick={testAllAccounts}
            disabled={isTesting || isLoading || accounts.length === 0}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Testing {testProgress.current}/{testProgress.total}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" /> Test All Accounts
              </>
            )}
          </Button>
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '55vh' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No account mappings found. Map accounts in the Client Health table first.</p>
          ) : (
            <div className="space-y-4 pr-3">
              {Object.entries(grouped).map(([platform, accs]) => (
                <div key={platform}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    {PLATFORM_LABELS[platform] || platform}
                    <Badge variant="outline" className="text-[10px]">{accs.length}</Badge>
                  </h3>
                  <div className="space-y-1">
                    {accs.map((acc, idx) => (
                      <div
                        key={`${acc.accountId}-${idx}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md border text-sm ${
                          acc.status === 'working' ? 'border-emerald-500/30 bg-emerald-500/5' :
                          acc.status === 'blocked' ? 'border-red-500/30 bg-red-500/5' :
                          acc.status === 'error' ? 'border-amber-500/30 bg-amber-500/5' :
                          acc.status === 'testing' ? 'border-blue-500/30 bg-blue-500/5 animate-pulse' :
                          'border-border'
                        }`}
                      >
                        {/* Status icon */}
                        {acc.status === 'working' && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                        {acc.status === 'blocked' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        {acc.status === 'error' && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                        {acc.status === 'testing' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />}
                        {acc.status === 'untested' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}

                        {/* Account info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{acc.accountName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{acc.accountId}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Client: {acc.clientName}
                          </div>
                          {acc.errorMessage && (
                            <div className="text-[11px] text-red-400 mt-0.5 truncate">{acc.errorMessage}</div>
                          )}
                        </div>

                        {/* Status badge */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${
                            acc.status === 'working' ? 'text-emerald-500 border-emerald-500/40' :
                            acc.status === 'blocked' ? 'text-red-500 border-red-500/40' :
                            acc.status === 'error' ? 'text-amber-500 border-amber-500/40' :
                            ''
                          }`}
                        >
                          {acc.status === 'untested' ? '—' : acc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {blocked > 0 && (
          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <strong className="text-red-400">{blocked} blocked accounts</strong> need to be prioritized in your{' '}
            <a href="https://hub.supermetrics.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              Supermetrics Hub
            </a>{' '}
            → Subscriptions → Manage → Data sources & Accounts.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

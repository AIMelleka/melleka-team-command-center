import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Loader2, Check, Link, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SupermetricsAccount { id: string; name: string; }

interface AccountMapping {
  id: string;
  client_name: string;
  platform: string;
  account_id: string;
  account_name: string | null;
}

interface Props {
  clientName: string;
  smAccounts: Record<string, SupermetricsAccount[]>;
  onClose: () => void;
  onSaved: () => void;
}

const PLATFORMS = [
  { key: 'google_ads', smKey: 'AW', label: 'Google Ads', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { key: 'meta_ads', smKey: 'FA', label: 'Meta Ads', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  { key: 'tiktok_ads', smKey: 'TT', label: 'TikTok Ads', color: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  { key: 'bing_ads', smKey: 'BI', label: 'Microsoft Ads', color: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
  { key: 'linkedin_ads', smKey: 'LI', label: 'LinkedIn Ads', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
];

export default function AccountMappingModal({ clientName, smAccounts, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Track which platforms allow multiple accounts (e.g. V1 / V2)
  const [multiAccountPlatforms, setMultiAccountPlatforms] = useState<Set<string>>(new Set());

  // Pending selection per platform (for dropdown)
  const [pendingSelections, setPendingSelections] = useState<Record<string, string>>({});

  // Load existing mappings
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('client_account_mappings')
        .select('*')
        .eq('client_name', clientName);
      if (!error && data) {
        setMappings(data as AccountMapping[]);
        // Auto-enable multi-account for platforms that already have 2+ accounts
        const counts: Record<string, number> = {};
        for (const m of data) {
          counts[m.platform] = (counts[m.platform] || 0) + 1;
        }
        const multiPlatforms = new Set<string>();
        for (const [platform, count] of Object.entries(counts)) {
          if (count > 1) multiPlatforms.add(platform);
        }
        setMultiAccountPlatforms(multiPlatforms);
      }
      setIsLoading(false);
    })();
  }, [clientName]);

  // Get available accounts for a platform from Supermetrics
  const getAccountsForPlatform = (platformKey: string): SupermetricsAccount[] => {
    const platform = PLATFORMS.find(p => p.key === platformKey);
    if (!platform) return [];
    // Try the Supermetrics key first (AW, FA, etc.), then fall back to platform key
    return smAccounts[platform.smKey] || smAccounts[platformKey] || [];
  };

  // Get mapped accounts for a platform
  const getMappingsForPlatform = (platformKey: string): AccountMapping[] => {
    return mappings.filter(m => m.platform === platformKey);
  };

  // Which accounts are already mapped for this platform
  const getMappedIds = (platformKey: string): Set<string> => {
    return new Set(getMappingsForPlatform(platformKey).map(m => m.account_id));
  };

  const addMapping = async (platformKey: string, accountId: string) => {
    const accounts = getAccountsForPlatform(platformKey);
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from('client_account_mappings')
      .insert({ client_name: clientName, platform: platformKey, account_id: account.id, account_name: account.name })
      .select()
      .single();
    if (error) {
      toast({ title: 'Failed to add account', description: error.message, variant: 'destructive' });
    } else if (data) {
      setMappings(prev => [...prev, data as AccountMapping]);
      toast({ title: `Linked ${account.name}` });
    }
    setPendingSelections(prev => ({ ...prev, [platformKey]: '' }));
    setIsSaving(false);
  };

  const removeMapping = async (mapping: AccountMapping) => {
    const { error } = await supabase
      .from('client_account_mappings')
      .delete()
      .eq('id', mapping.id);
    if (error) {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    } else {
      setMappings(prev => prev.filter(m => m.id !== mapping.id));
      toast({ title: `Removed ${mapping.account_name || mapping.account_id}` });
    }
  };

  // Replace the single mapping for a platform (when NOT in multi-account mode)
  const replaceMapping = async (platformKey: string, accountId: string) => {
    const accounts = getAccountsForPlatform(platformKey);
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    setIsSaving(true);

    // Remove existing mappings for this platform
    const existing = getMappingsForPlatform(platformKey);
    for (const m of existing) {
      await supabase.from('client_account_mappings').delete().eq('id', m.id);
    }

    // Insert new
    const { data, error } = await supabase
      .from('client_account_mappings')
      .insert({ client_name: clientName, platform: platformKey, account_id: account.id, account_name: account.name })
      .select()
      .single();

    if (error) {
      toast({ title: 'Failed to link account', description: error.message, variant: 'destructive' });
    } else if (data) {
      setMappings(prev => [...prev.filter(m => m.platform !== platformKey), data as AccountMapping]);
      toast({ title: `Linked ${account.name}` });
    }
    setIsSaving(false);
  };

  const handleClose = () => {
    onSaved();
    onClose();
  };

  // Check if there are any Supermetrics accounts at all
  const hasAnyAccounts = PLATFORMS.some(p => getAccountsForPlatform(p.key).length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Link Ad Accounts
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{clientName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAnyAccounts ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">No ad accounts found from Supermetrics.</p>
              <p className="text-xs text-muted-foreground">Make sure your Supermetrics API key is configured and has connected ad platforms.</p>
            </div>
          ) : (
            PLATFORMS.map(platform => {
              const accounts = getAccountsForPlatform(platform.key);
              const currentMappings = getMappingsForPlatform(platform.key);
              const mappedIds = getMappedIds(platform.key);
              const isMulti = multiAccountPlatforms.has(platform.key);
              const unmapped = accounts.filter(a => !mappedIds.has(a.id));

              // Skip platforms with no available accounts and no existing mappings
              if (accounts.length === 0 && currentMappings.length === 0) return null;

              return (
                <div key={platform.key} className="rounded-lg border border-border overflow-hidden">
                  {/* Platform header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${platform.color}`}>
                        {platform.label}
                      </Badge>
                      {currentMappings.length > 0 ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {currentMappings.length} linked
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not linked</span>
                      )}
                    </div>
                    {accounts.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Multiple accounts</span>
                        <Switch
                          checked={isMulti}
                          onCheckedChange={(checked) => {
                            setMultiAccountPlatforms(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(platform.key);
                              else next.delete(platform.key);
                              return next;
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 space-y-2">
                    {/* Single account mode — one dropdown that replaces */}
                    {!isMulti ? (
                      <div>
                        <select
                          value={currentMappings[0]?.account_id || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) replaceMapping(platform.key, val);
                          }}
                          disabled={isSaving || accounts.length === 0}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                        >
                          <option value="">Select {platform.label} account...</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                        {currentMappings[0] && (
                          <p className="text-[11px] text-muted-foreground mt-1 px-1">
                            ID: {currentMappings[0].account_id}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Multi-account mode — show all linked + dropdown to add more */
                      <div className="space-y-2">
                        {/* List linked accounts */}
                        {currentMappings.map(m => (
                          <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 group">
                            <div>
                              <p className="text-sm font-medium">{m.account_name || m.account_id}</p>
                              <p className="text-[10px] text-muted-foreground">ID: {m.account_id}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500"
                              onClick={() => removeMapping(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}

                        {/* Dropdown to add another */}
                        {unmapped.length > 0 && (
                          <div className="space-y-2">
                            <select
                              value={pendingSelections[platform.key] || ''}
                              onChange={(e) => setPendingSelections(prev => ({ ...prev, [platform.key]: e.target.value }))}
                              disabled={isSaving}
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                            >
                              <option value="">Add another account...</option>
                              {unmapped.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!pendingSelections[platform.key] || isSaving}
                              onClick={() => {
                                if (pendingSelections[platform.key]) {
                                  addMapping(platform.key, pendingSelections[platform.key]);
                                }
                              }}
                              className="w-full h-9 gap-1"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add
                            </Button>
                          </div>
                        )}

                        {unmapped.length === 0 && currentMappings.length > 0 && (
                          <p className="text-[11px] text-muted-foreground italic">All available accounts are linked.</p>
                        )}
                      </div>
                    )}

                    {accounts.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">No accounts available from Supermetrics for this platform.</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {mappings.length} account{mappings.length !== 1 ? 's' : ''} linked
          </p>
          <Button onClick={handleClose} className="gap-2">
            <Check className="h-4 w-4" /> Done
          </Button>
        </div>
      </div>
    </div>
  );
}

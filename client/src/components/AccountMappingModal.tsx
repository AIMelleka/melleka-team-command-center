import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Loader2, Check, Link, ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { syncAfterMappingChange } from '@/lib/accountMappingSync';
interface SupermetricsAccount { id: string; name: string; }
interface MetaPage { id: string; name: string; instagram: { id: string; username: string } | null; }

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api';

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
  { key: 'google_ads', smKey: 'AW', label: 'Google Ads', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', manual: false },
  { key: 'meta_ads', smKey: 'FA', label: 'Meta Ads', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', manual: false },
  { key: 'reddit_ads', smKey: '', label: 'Reddit Ads', color: 'bg-orange-600/15 text-orange-500 border-orange-600/20', manual: false },
  { key: 'tiktok_ads', smKey: 'TT', label: 'TikTok Ads', color: 'bg-pink-500/15 text-pink-400 border-pink-500/20', manual: false },
  { key: 'bing_ads', smKey: 'BI', label: 'Microsoft Ads', color: 'bg-teal-500/15 text-teal-400 border-teal-500/20', manual: false },
  { key: 'linkedin_ads', smKey: 'LI', label: 'LinkedIn Ads', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20', manual: false },
  { key: 'facebook_page', smKey: '', label: 'Facebook Page', color: 'bg-blue-600/15 text-blue-500 border-blue-600/20', manual: false, source: 'meta' as const },
  { key: 'instagram_account', smKey: '', label: 'Instagram Account', color: 'bg-pink-600/15 text-pink-500 border-pink-600/20', manual: false, source: 'meta' as const },
  { key: 'ghl', smKey: '', label: 'GoHighLevel', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20', manual: false, source: 'ghl' as const },
  { key: 'ga4', smKey: '', label: 'Google Analytics 4', color: 'bg-green-500/15 text-green-400 border-green-500/20', manual: false },
  { key: 'klaviyo', smKey: '', label: 'Klaviyo', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', manual: false },
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

  // Track whether any mapping was added/removed/replaced
  const hasChanged = useRef(false);

  // Manual input state for social/manual platforms
  const [manualInputs, setManualInputs] = useState<Record<string, { id: string; name: string }>>({});

  // Meta pages (Facebook Pages + Instagram accounts from Meta API)
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [metaPagesLoading, setMetaPagesLoading] = useState(false);

  // Google Ads accounts (from direct API, bypasses Supermetrics)
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<SupermetricsAccount[]>([]);
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false);

  // Meta Ads accounts (from direct API, Supermetrics as fallback)
  const [metaAdsAccounts, setMetaAdsAccounts] = useState<SupermetricsAccount[]>([]);
  const [metaAdsLoading, setMetaAdsLoading] = useState(false);

  // Reddit Ads accounts (from direct API)
  const [redditAdsAccounts, setRedditAdsAccounts] = useState<SupermetricsAccount[]>([]);
  const [redditAdsLoading, setRedditAdsLoading] = useState(false);

  // GHL locations (from agency-level API)
  const [ghlLocations, setGhlLocations] = useState<{ id: string; name: string }[]>([]);
  const [ghlLoading, setGhlLoading] = useState(false);

  // GA4 properties (Supermetrics GAWA)
  const [ga4Properties, setGa4Properties] = useState<SupermetricsAccount[]>([]);
  const [ga4Loading, setGa4Loading] = useState(false);

  // Klaviyo accounts (Supermetrics KLAV)
  const [klaviyoAccounts, setKlaviyoAccounts] = useState<SupermetricsAccount[]>([]);
  const [klaviyoLoading, setKlaviyoLoading] = useState(false);

  // HubSpot CRM credential (stored server-side, never returned to client)
  const [hubspotToken, setHubspotToken] = useState('');
  const [hubspotSaving, setHubspotSaving] = useState(false);
  const [hubspotTesting, setHubspotTesting] = useState(false);

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

  // Fetch Facebook Pages + Instagram accounts from Meta API
  useEffect(() => {
    (async () => {
      setMetaPagesLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${API_URL}/social/meta-pages`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.pages) setMetaPages(json.pages);
          }
        }
      } catch { /* Meta pages unavailable */ }
      setMetaPagesLoading(false);
    })();
  }, []);

  // Fetch Google Ads accounts directly (bypasses Supermetrics)
  useEffect(() => {
    (async () => {
      setGoogleAdsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${API_URL}/google-ads/accounts`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.accounts) setGoogleAdsAccounts(json.accounts);
          }
        }
      } catch { /* Google Ads API unavailable */ }
      setGoogleAdsLoading(false);
    })();
  }, []);

  // Fetch Meta Ads accounts directly (Supermetrics as fallback)
  useEffect(() => {
    (async () => {
      setMetaAdsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${API_URL}/meta-ads/accounts`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.accounts?.length) setMetaAdsAccounts(json.accounts);
          }
        }
      } catch { /* Meta Ads API unavailable, will fall back to Supermetrics */ }
      setMetaAdsLoading(false);
    })();
  }, []);

  // Fetch Reddit Ads accounts (via /me/businesses → ad_accounts)
  useEffect(() => {
    (async () => {
      setRedditAdsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${API_URL}/reddit-ads/accounts`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.accounts?.length) setRedditAdsAccounts(json.accounts);
          }
        }
      } catch { /* Reddit Ads API unavailable */ }
      setRedditAdsLoading(false);
    })();
  }, []);

  // Fetch GHL locations from edge function
  useEffect(() => {
    (async () => {
      setGhlLoading(true);
      try {
        // Use fetch directly for reliability (supabase.functions.invoke can silently fail)
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nhebotmrnxixvcvtspet.supabase.co';
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const resp = await fetch(`${supabaseUrl}/functions/v1/ghl-list-locations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success && json?.locations) {
            setGhlLocations(json.locations.map((l: any) => ({ id: l.id, name: l.name })));
          } else {
            console.warn('[GHL] Edge function returned:', json);
          }
        } else {
          console.warn('[GHL] Edge function error:', resp.status, await resp.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('[GHL] Failed to fetch locations:', err);
      }
      setGhlLoading(false);
    })();
  }, []);

  // Fetch GA4 properties via analytics endpoint (Supermetrics GAWA)
  useEffect(() => {
    (async () => {
      setGa4Loading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${API_URL}/analytics/ga4-properties`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.accounts?.length) setGa4Properties(json.accounts);
          }
        }
      } catch { /* GA4 properties unavailable */ }
      setGa4Loading(false);
    })();
  }, []);

  // Fetch Klaviyo accounts via analytics endpoint (Supermetrics KLAV)
  useEffect(() => {
    (async () => {
      setKlaviyoLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const resp = await fetch(`${API_URL}/analytics/klaviyo-accounts`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.accounts?.length) setKlaviyoAccounts(json.accounts);
          }
        }
      } catch { /* Klaviyo accounts unavailable */ }
      setKlaviyoLoading(false);
    })();
  }, []);

  // Get available accounts for Meta or GHL platforms
  const getSourceAccountsForPlatform = (platformKey: string): SupermetricsAccount[] => {
    if (platformKey === 'facebook_page') {
      return metaPages.map(p => ({ id: p.id, name: p.name }));
    }
    if (platformKey === 'instagram_account') {
      return metaPages
        .filter(p => p.instagram)
        .map(p => ({ id: p.instagram!.id, name: `${p.instagram!.username} (${p.name})` }));
    }
    if (platformKey === 'ghl') {
      return ghlLocations.map(l => ({ id: l.id, name: l.name }));
    }
    return [];
  };

  // Get available accounts for a platform (direct API first, Supermetrics as fallback)
  const getAccountsForPlatform = (platformKey: string): SupermetricsAccount[] => {
    // Google Ads: always use direct API
    if (platformKey === 'google_ads') return googleAdsAccounts;
    // Reddit Ads: always use direct API
    if (platformKey === 'reddit_ads') return redditAdsAccounts;
    // GA4: Supermetrics GAWA via analytics endpoint
    if (platformKey === 'ga4') return ga4Properties;
    // Klaviyo: Supermetrics KLAV via analytics endpoint
    if (platformKey === 'klaviyo') return klaviyoAccounts;
    // Meta Ads: direct API first, Supermetrics as fallback
    if (platformKey === 'meta_ads') {
      if (metaAdsAccounts.length > 0) return metaAdsAccounts;
      return smAccounts['FA'] || smAccounts['meta_ads'] || [];
    }
    const platform = PLATFORMS.find(p => p.key === platformKey);
    if (!platform) return [];
    // Other platforms: Supermetrics
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

  // Resolve account from Supermetrics, Meta, or GHL sources
  const resolveAccount = (platformKey: string, accountId: string): SupermetricsAccount | undefined => {
    const platform = PLATFORMS.find(p => p.key === platformKey);
    const source = platform && (platform as any).source;
    const accounts = source ? getSourceAccountsForPlatform(platformKey) : getAccountsForPlatform(platformKey);
    return accounts.find(a => a.id === accountId);
  };

  const addMapping = async (platformKey: string, accountId: string) => {
    const account = resolveAccount(platformKey, accountId);
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
      hasChanged.current = true;
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
      hasChanged.current = true;
    }
  };

  // Replace the single mapping for a platform (when NOT in multi-account mode)
  const replaceMapping = async (platformKey: string, accountId: string) => {
    const account = resolveAccount(platformKey, accountId);
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
      hasChanged.current = true;
    }
    setIsSaving(false);
  };

  // Add a manual mapping (for social/manual platforms where user types the ID)
  const addManualMapping = async (platformKey: string) => {
    const input = manualInputs[platformKey];
    if (!input?.id?.trim()) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from('client_account_mappings')
      .insert({ client_name: clientName, platform: platformKey, account_id: input.id.trim(), account_name: input.name.trim() || null })
      .select()
      .single();
    if (error) {
      toast({ title: 'Failed to add account', description: error.message, variant: 'destructive' });
    } else if (data) {
      setMappings(prev => [...prev, data as AccountMapping]);
      toast({ title: `Linked ${input.name.trim() || input.id.trim()}` });
      hasChanged.current = true;
    }
    setManualInputs(prev => ({ ...prev, [platformKey]: { id: '', name: '' } }));
    setIsSaving(false);
  };

  // Save HubSpot Private App token to server (stored server-side only, read-only)
  const saveHubSpotToken = async () => {
    if (!hubspotToken.trim()) return;
    setHubspotSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) { toast({ title: 'Not authenticated', variant: 'destructive' }); return; }

      const resp = await fetch(`${API_URL}/crm/save-credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ client_name: clientName, platform: 'hubspot', token: hubspotToken.trim() }),
      });
      const json = await resp.json();

      if (!resp.ok) {
        toast({ title: 'Failed to connect HubSpot', description: json.error || 'Unknown error', variant: 'destructive' });
      } else {
        toast({ title: 'HubSpot CRM connected', description: json.message });
        setHubspotToken('');
        hasChanged.current = true;
        // Optimistically add the mapping to local state so UI shows "Connected"
        setMappings(prev => [
          ...prev.filter(m => m.platform !== 'hubspot'),
          { id: `hubspot-${Date.now()}`, client_name: clientName, platform: 'hubspot', account_id: 'hubspot_crm', account_name: 'HubSpot CRM' },
        ]);
      }
    } catch (err: any) {
      toast({ title: 'Failed to connect HubSpot', description: err.message, variant: 'destructive' });
    } finally {
      setHubspotSaving(false);
    }
  };

  // Test the stored HubSpot connection — shows the raw API response for debugging
  const testHubSpotConnection = async () => {
    setHubspotTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) return;
      const resp = await fetch(`${API_URL}/crm/test-connection?client_name=${encodeURIComponent(clientName)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await resp.json();
      if (json.ok) {
        toast({ title: 'HubSpot connection OK', description: `HTTP ${json.status} — credential type: ${json.credentialType}` });
      } else {
        toast({
          title: 'HubSpot connection failed',
          description: `${json.error || ''} ${json.hubspotResponse?.message || JSON.stringify(json.hubspotResponse || '')}`.trim(),
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    } finally {
      setHubspotTesting(false);
    }
  };

  const handleClose = async () => {
    if (hasChanged.current) {
      const result = await syncAfterMappingChange(clientName);
      onSaved();
      toast({
        title: 'Account mappings updated',
        description: `Cleared ${result.purged.reports} old report${result.purged.reports !== 1 ? 's' : ''} and ${result.purged.snapshots} snapshot${result.purged.snapshots !== 1 ? 's' : ''}. Regenerating fresh data now...`,
      });
    } else {
      onSaved();
    }
    onClose();
  };

  // Platforms with direct API sources (always show, never hide)
  const DIRECT_API_PLATFORMS = new Set(['google_ads', 'meta_ads', 'reddit_ads', 'ga4', 'klaviyo']);

  // Check if there are any accounts available (direct API, Supermetrics, Meta, GHL, or manual platforms)
  const hasAnyAccounts = PLATFORMS.some(p => p.manual || DIRECT_API_PLATFORMS.has(p.key) || (p as any).source === 'meta' || (p as any).source === 'ghl' || getAccountsForPlatform(p.key).length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Link Accounts
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{clientName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Connect GHL OAuth button */}
          <div className="flex items-center justify-between rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
            <span className="text-sm text-orange-400">GoHighLevel OAuth</span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              onClick={() => window.open('https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/ghl-oauth-start', '_blank')}
            >
              <ExternalLink className="h-3 w-3" /> Connect GHL
            </Button>
          </div>

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
              const source = (platform as any).source;
              const hasSource = source === 'meta' || source === 'ghl';
              const accounts = hasSource ? getSourceAccountsForPlatform(platform.key) : getAccountsForPlatform(platform.key);
              const currentMappings = getMappingsForPlatform(platform.key);
              const mappedIds = getMappedIds(platform.key);
              const isMulti = multiAccountPlatforms.has(platform.key);
              const unmapped = accounts.filter(a => !mappedIds.has(a.id));
              const isGhl = source === 'ghl';
              const isMeta = source === 'meta';

              // Skip platforms with no available accounts and no existing mappings
              // (but always show platforms with direct API sources like Google Ads and Meta Ads)
              if (!platform.manual && !hasSource && !DIRECT_API_PLATFORMS.has(platform.key) && accounts.length === 0 && currentMappings.length === 0) return null;

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
                    {!platform.manual && accounts.length > 1 && (
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
                    {/* Manual input mode — user types account ID directly */}
                    {platform.manual ? (
                      <div className="space-y-2">
                        {/* List existing manual mappings */}
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
                        {/* Input to add new */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={platform.key === 'facebook_page' ? 'Facebook Page ID' : platform.key === 'instagram_account' ? 'Instagram Account ID' : platform.key === 'reddit_ads' ? 'Reddit Ad Account ID (e.g. t2_xxxxx)' : 'Ayrshare Profile Key'}
                            value={manualInputs[platform.key]?.id || ''}
                            onChange={(e) => setManualInputs(prev => ({ ...prev, [platform.key]: { ...prev[platform.key], id: e.target.value, name: prev[platform.key]?.name || '' } }))}
                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <input
                            type="text"
                            placeholder="Display name"
                            value={manualInputs[platform.key]?.name || ''}
                            onChange={(e) => setManualInputs(prev => ({ ...prev, [platform.key]: { ...prev[platform.key], name: e.target.value, id: prev[platform.key]?.id || '' } }))}
                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!manualInputs[platform.key]?.id?.trim() || isSaving}
                            onClick={() => addManualMapping(platform.key)}
                            className="h-9 px-3"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {platform.key === 'facebook_page' && 'Find your Page ID in Meta Business Suite under Page Settings.'}
                          {platform.key === 'instagram_account' && 'Find your IG Business Account ID in Meta Business Suite.'}

                        </p>
                      </div>
                    ) : !isMulti ? (
                      /* Single account mode — one dropdown that replaces */
                      <div>
                        {/* Show loading spinner for platforms with direct API */}
                        {accounts.length === 0 && ((platform.key === 'google_ads' && googleAdsLoading) || (platform.key === 'meta_ads' && metaAdsLoading) || (platform.key === 'reddit_ads' && redditAdsLoading) || (platform.key === 'ga4' && ga4Loading) || (platform.key === 'klaviyo' && klaviyoLoading)) ? (
                          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading {platform.label} accounts...
                          </div>
                        ) : accounts.length === 0 && DIRECT_API_PLATFORMS.has(platform.key) ? (
                          <p className="text-xs text-muted-foreground italic py-2">
                            {platform.key === 'google_ads' ? 'No Google Ads accounts found. Check your Google Ads API credentials.' :
                             platform.key === 'reddit_ads' ? 'No Reddit Ads accounts found. Check your Reddit API credentials.' :
                             platform.key === 'ga4' ? 'No GA4 properties found. Make sure Supermetrics has Google Analytics 4 connected.' :
                             platform.key === 'klaviyo' ? 'No Klaviyo accounts found. Make sure Supermetrics has Klaviyo connected.' :
                             'No Meta ad accounts found. Check your Meta access token.'}
                          </p>
                        ) : (
                          <>
                            <select
                              value={currentMappings[0]?.account_id || ''}
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (val) {
                                  replaceMapping(platform.key, val);
                                } else if (currentMappings[0]) {
                                  // Unlink: user selected "None" / placeholder
                                  await removeMapping(currentMappings[0]);
                                }
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
                          </>
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

                    {!platform.manual && accounts.length === 0 && currentMappings.length === 0 && (
                      <div className="py-1">
                        {isGhl && ghlLoading ? (
                          <p className="text-xs text-muted-foreground italic">Loading GHL locations...</p>
                        ) : isGhl ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">No GHL locations found. Connect your GoHighLevel account to see available locations.</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={() => window.open('https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/ghl-oauth-start', '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" /> Connect GoHighLevel
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            {isMeta && metaPagesLoading ? 'Loading pages from Meta...' :
                             isMeta ? 'No pages found from Meta API. Check your Meta access token.' :
                             platform.key === 'google_ads' && googleAdsLoading ? 'Loading Google Ads accounts...' :
                             platform.key === 'google_ads' ? 'No Google Ads accounts found. Check your Google Ads API credentials.' :
                             platform.key === 'meta_ads' && metaAdsLoading ? 'Loading Meta ad accounts...' :
                             platform.key === 'meta_ads' ? 'No Meta ad accounts found. Check your Meta access token.' :
                             platform.key === 'reddit_ads' && redditAdsLoading ? 'Loading Reddit Ads accounts...' :
                             platform.key === 'reddit_ads' ? 'No Reddit Ads accounts found. Check your Reddit API credentials.' :
                             platform.key === 'ga4' && ga4Loading ? 'Loading GA4 properties...' :
                             platform.key === 'ga4' ? 'No GA4 properties found. Make sure Supermetrics has Google Analytics 4 connected.' :
                             platform.key === 'klaviyo' && klaviyoLoading ? 'Loading Klaviyo accounts...' :
                             platform.key === 'klaviyo' ? 'No Klaviyo accounts found. Make sure Supermetrics has Klaviyo connected.' :
                             'No accounts available from Supermetrics for this platform.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* CRM Credentials — stored server-side only, read-only access */}
          <div className="mt-2 pt-4 border-t border-border space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CRM Credentials</p>

            {/* HubSpot */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-orange-400/15 text-orange-400 border-orange-400/20">
                    HubSpot CRM
                  </Badge>
                  {mappings.some(m => m.platform === 'hubspot') ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="HubSpot API key or Private App token"
                    value={hubspotToken}
                    onChange={(e) => setHubspotToken(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!hubspotToken.trim() || hubspotSaving}
                    onClick={saveHubSpotToken}
                    className="h-9 px-3 gap-1.5"
                  >
                    {hubspotSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                    {hubspotSaving ? 'Saving...' : 'Connect'}
                  </Button>
                  {mappings.some(m => m.platform === 'hubspot') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={hubspotTesting}
                      onClick={testHubSpotConnection}
                      className="h-9 px-3 text-xs text-muted-foreground"
                    >
                      {hubspotTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Paste your HubSpot API key (UUID) or Private App token (pat-...). Stored server-side only, used for read-only CRM data in client reports.
                </p>
              </div>
            </div>
          </div>
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

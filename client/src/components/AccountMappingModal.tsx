import { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Trash2, Loader2, Check, Link, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

const ALL_PLATFORMS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  tiktok_ads: 'TikTok Ads',
  bing_ads: 'Microsoft Ads',
  linkedin_ads: 'LinkedIn Ads',
};

const PLATFORM_LABELS: Record<string, string> = { ...ALL_PLATFORMS };

const PLATFORM_COLORS: Record<string, string> = {
  google_ads: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  meta_ads: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  tiktok_ads: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  bing_ads: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  linkedin_ads: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
};

export default function AccountMappingModal({ clientName, smAccounts, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [showChannelManager, setShowChannelManager] = useState(false);
  const [newChannelKey, setNewChannelKey] = useState('');
  const [newChannelLabel, setNewChannelLabel] = useState('');

  // Load existing mappings
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('client_account_mappings')
        .select('*')
        .eq('client_name', clientName);
      if (!error && data) setMappings(data as AccountMapping[]);
      setIsLoading(false);
    })();
  }, [clientName]);

  // Derive active channels from mappings + smAccounts
  const activeChannels = useMemo(() => {
    const channels = new Map<string, string>(); // key -> label
    // From smAccounts (discovered)
    for (const key of Object.keys(smAccounts)) {
      channels.set(key, PLATFORM_LABELS[key] || key);
    }
    // From existing mappings (could include custom channels)
    for (const m of mappings) {
      if (!channels.has(m.platform)) {
        channels.set(m.platform, PLATFORM_LABELS[m.platform] || m.platform);
      }
    }
    return channels;
  }, [smAccounts, mappings]);

  const addChannel = () => {
    const key = newChannelKey.trim().toLowerCase().replace(/\s+/g, '_');
    const label = newChannelLabel.trim() || key;
    if (!key) return;
    if (activeChannels.has(key)) {
      toast({ title: 'Channel already exists', variant: 'destructive' });
      return;
    }
    // Register label globally so it persists in session
    PLATFORM_LABELS[key] = label;
    // Create a dummy mapping to persist this channel for the client
    // The user can then add actual accounts under it
    toast({ title: `Added "${label}" channel` });
    setNewChannelKey('');
    setNewChannelLabel('');
  };

  const removeChannel = async (platformKey: string) => {
    // Remove all mappings for this channel
    const toRemove = mappings.filter(m => m.platform === platformKey);
    for (const m of toRemove) {
      await supabase.from('client_account_mappings').delete().eq('id', m.id);
    }
    setMappings(prev => prev.filter(m => m.platform !== platformKey));
    toast({ title: `Removed ${PLATFORM_LABELS[platformKey] || platformKey} channel and its ${toRemove.length} account(s)` });
  };

  const mappedAccountIds = useMemo(() => new Set(mappings.map(m => `${m.platform}:${m.account_id}`)), [mappings]);

  const availableAccounts = useMemo(() => {
    const results: { platform: string; account: SupermetricsAccount }[] = [];
    for (const [platform, accounts] of Object.entries(smAccounts)) {
      for (const acc of accounts) {
        if (mappedAccountIds.has(`${platform}:${acc.id}`)) continue;
        if (selectedPlatform !== 'all' && platform !== selectedPlatform) continue;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!acc.name.toLowerCase().includes(q) && !acc.id.toLowerCase().includes(q)) continue;
        }
        results.push({ platform, account: acc });
      }
    }
    return results.sort((a, b) => a.account.name.localeCompare(b.account.name));
  }, [smAccounts, mappedAccountIds, searchQuery, selectedPlatform]);

  const addMapping = async (platform: string, account: SupermetricsAccount) => {
    setIsSaving(true);
    const { data, error } = await supabase
      .from('client_account_mappings')
      .insert({ client_name: clientName, platform, account_id: account.id, account_name: account.name })
      .select()
      .single();
    if (error) {
      toast({ title: 'Failed to add mapping', description: error.message, variant: 'destructive' });
    } else if (data) {
      setMappings(prev => [...prev, data as AccountMapping]);
    }
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
    }
  };

  const handleClose = () => {
    onSaved();
    onClose();
  };

  const platforms = [...activeChannels.keys()];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              {showChannelManager ? 'Manage Channels' : 'Map Ad Accounts'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{clientName}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowChannelManager(!showChannelManager)} className="text-xs gap-1">
              <Settings className="h-4 w-4" />
              {showChannelManager ? 'Back to Accounts' : 'Channels'}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {showChannelManager ? (
            /* ===== CHANNEL MANAGER VIEW ===== */
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Active Channels ({activeChannels.size})</h3>
                <div className="space-y-2">
                  {[...activeChannels.entries()].map(([key, label]) => {
                    const count = mappings.filter(m => m.platform === key).length;
                    const isDefault = key in ALL_PLATFORMS;
                    return (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border group">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[key] || 'bg-muted text-muted-foreground border-border'}`}>
                            {label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{count} account{count !== 1 ? 's' : ''} mapped</span>
                          {isDefault && <span className="text-[10px] text-muted-foreground/60">built-in</span>}
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Remove "${label}" and its ${count} mapped account(s)?`)) removeChannel(key); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Add Custom Channel</h3>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Channel Key</label>
                    <Input
                      value={newChannelKey}
                      onChange={e => setNewChannelKey(e.target.value)}
                      placeholder="e.g. snapchat_ads"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
                    <Input
                      value={newChannelLabel}
                      onChange={e => setNewChannelLabel(e.target.value)}
                      placeholder="e.g. Snapchat Ads"
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button size="sm" onClick={addChannel} disabled={!newChannelKey.trim()} className="h-9">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Custom channels let you manually add account IDs for platforms not auto-discovered.</p>
              </div>
            </div>
          ) : (
            /* ===== ACCOUNT MAPPING VIEW (existing) ===== */
            <>
          {/* Current Mappings */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Mapped Accounts ({mappings.length})</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : mappings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/20 rounded-lg">
                No accounts mapped yet. Add accounts from the list below.
              </p>
            ) : (
              <div className="space-y-2">
                {mappings.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border group">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[m.platform] || ''}`}>
                        {PLATFORM_LABELS[m.platform] || m.platform}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{m.account_name || m.account_id}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{m.account_id}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500" onClick={() => removeMapping(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available accounts */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Available Accounts</h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search accounts..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <select
                value={selectedPlatform}
                onChange={e => setSelectedPlatform(e.target.value)}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none"
              >
                <option value="all">All Platforms</option>
                {platforms.map(p => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p] || p}</option>
                ))}
              </select>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {availableAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {searchQuery ? 'No accounts match your search' : 'All accounts already mapped'}
                </p>
              ) : availableAccounts.map(({ platform, account }) => (
                <div key={`${platform}:${account.id}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[platform] || ''}`}>
                      {PLATFORM_LABELS[platform] || platform}
                    </Badge>
                    <div>
                      <p className="text-sm">{account.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{account.id}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    disabled={isSaving}
                    onClick={() => addMapping(platform, account)}
                    className="h-7 text-xs text-primary hover:text-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-end">
          <Button onClick={handleClose} className="gap-2">
            <Check className="h-4 w-4" /> Done
          </Button>
        </div>
      </div>
    </div>
  );
}

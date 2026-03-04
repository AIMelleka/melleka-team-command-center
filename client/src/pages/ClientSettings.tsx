import { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Plus, Pencil, Search, Link, Loader2, Trash2, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Save, X } from 'lucide-react';
import AdminHeader from '@/components/AdminHeader';
import AccountMappingModal from '@/components/AccountMappingModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK } from '@/data/industryBenchmarks';

type ManagedClient = {
  id: string;
  client_name: string;
  domain: string | null;
  ga4_property_id: string | null;
  site_audit_url: string | null;
  looker_url: string | null;
  industry: string | null;
  tier: string;
  primary_conversion_goal: string;
  tracked_conversion_types: string[];
  multi_account_enabled: boolean;
  is_active: boolean;
  created_at: string;
};

interface SupermetricsAccount { id: string; name: string; }

const INDUSTRIES = [DEFAULT_BENCHMARK, ...INDUSTRY_BENCHMARKS].map(b => b.industry);

const CONVERSION_TYPES = [
  { key: 'leads', label: 'Leads' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'calls', label: 'Calls' },
  { key: 'forms', label: 'Forms' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'signups', label: 'Sign-ups' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'downloads', label: 'Downloads' },
];

const GOALS = [
  { value: 'all', label: 'All Conversions' },
  { value: 'leads', label: 'Leads' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'calls', label: 'Calls' },
  { value: 'forms', label: 'Forms' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'signups', label: 'Sign-ups' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'downloads', label: 'Downloads' },
];

const TIER_COLORS: Record<string, string> = {
  premium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  advanced: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  basic: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const emptyForm = (): Partial<ManagedClient> => ({
  client_name: '',
  domain: null,
  ga4_property_id: null,
  site_audit_url: null,
  looker_url: null,
  industry: null,
  tier: 'basic',
  primary_conversion_goal: 'all',
  tracked_conversion_types: ['leads', 'purchases', 'calls'],
  multi_account_enabled: false,
  is_active: true,
});

export default function ClientSettings() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ManagedClient>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState<Partial<ManagedClient>>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [mappingClient, setMappingClient] = useState<string | null>(null);
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({});
  const [smAccounts, setSmAccounts] = useState<Record<string, SupermetricsAccount[]>>({});
  const [smLoaded, setSmLoaded] = useState(false);

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('managed_clients').select('*').order('client_name');
      if (error) throw error;
      setClients((data || []) as ManagedClient[]);
    } catch (err: any) {
      toast({ title: 'Failed to load clients', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadAccountCounts = useCallback(async () => {
    try {
      const { data } = await supabase.from('client_account_mappings').select('client_name');
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.client_name] = (counts[row.client_name] || 0) + 1;
      }
      setAccountCounts(counts);
    } catch {}
  }, []);

  const loadSmAccounts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', { body: { action: 'list-accounts' } });
      if (!error && data?.success && data?.accounts) {
        setSmAccounts(data.accounts);
        setSmLoaded(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadClients();
    loadAccountCounts();
    loadSmAccounts();
  }, [loadClients, loadAccountCounts, loadSmAccounts]);

  const filtered = useMemo(() => {
    let list = clients;
    if (!showInactive) list = list.filter(c => c.is_active);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.client_name.toLowerCase().includes(q) ||
        (c.domain && c.domain.toLowerCase().includes(q)) ||
        (c.industry && c.industry.toLowerCase().includes(q))
      );
    }
    return list;
  }, [clients, showInactive, searchQuery]);

  const handleAdd = async () => {
    if (!addForm.client_name?.trim()) {
      toast({ title: 'Client name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('managed_clients').insert({
        client_name: addForm.client_name.trim(),
        domain: addForm.domain?.trim() || null,
        ga4_property_id: addForm.ga4_property_id?.trim() || null,
        site_audit_url: addForm.site_audit_url?.trim() || null,
        looker_url: addForm.looker_url?.trim() || null,
        industry: addForm.industry || null,
        tier: addForm.tier || 'basic',
        primary_conversion_goal: addForm.primary_conversion_goal || 'all',
        tracked_conversion_types: addForm.tracked_conversion_types || ['leads', 'purchases', 'calls'],
        multi_account_enabled: addForm.multi_account_enabled || false,
        is_active: true,
      });
      if (error) throw error;
      toast({ title: `Added "${addForm.client_name.trim()}"` });
      setShowAddDialog(false);
      setAddForm(emptyForm());
      loadClients();
    } catch (err: any) {
      toast({ title: err?.message?.includes('unique') ? 'Client already exists' : 'Failed to add client', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('managed_clients').update({
        client_name: editForm.client_name?.trim(),
        domain: editForm.domain?.trim() || null,
        ga4_property_id: editForm.ga4_property_id?.trim() || null,
        site_audit_url: editForm.site_audit_url?.trim() || null,
        looker_url: editForm.looker_url?.trim() || null,
        industry: editForm.industry || null,
        tier: editForm.tier || 'basic',
        primary_conversion_goal: editForm.primary_conversion_goal || 'all',
        tracked_conversion_types: editForm.tracked_conversion_types || ['leads', 'purchases', 'calls'],
        multi_account_enabled: editForm.multi_account_enabled || false,
      }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Client updated' });
      setEditingId(null);
      loadClients();
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (client: ManagedClient) => {
    const newActive = !client.is_active;
    try {
      await supabase.from('managed_clients').update({ is_active: newActive }).eq('id', client.id);
      toast({ title: newActive ? `Reactivated "${client.client_name}"` : `Deactivated "${client.client_name}"` });
      loadClients();
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleDelete = async (client: ManagedClient) => {
    if (!confirm(`Permanently delete "${client.client_name}"? This cannot be undone.`)) return;
    try {
      await supabase.from('client_account_mappings').delete().eq('client_name', client.client_name);
      await supabase.from('managed_clients').delete().eq('id', client.id);
      toast({ title: `Deleted "${client.client_name}"` });
      loadClients();
      loadAccountCounts();
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const startEdit = (client: ManagedClient) => {
    setEditingId(client.id);
    setEditForm({ ...client });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const toggleTrackedType = (form: Partial<ManagedClient>, setForm: (f: Partial<ManagedClient>) => void, key: string) => {
    const current = form.tracked_conversion_types || [];
    const next = current.includes(key) ? current.filter(t => t !== key) : [...current, key];
    setForm({ ...form, tracked_conversion_types: next });
  };

  const ClientForm = ({ form, setForm, isAdd }: { form: Partial<ManagedClient>; setForm: (f: Partial<ManagedClient>) => void; isAdd?: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Client Name *</Label>
        <Input value={form.client_name || ''} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Client Name" disabled={!isAdd} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Domain</Label>
        <Input value={form.domain || ''} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="example.com" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Industry</Label>
        <Select value={form.industry || ''} onValueChange={v => setForm({ ...form, industry: v || null })}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select industry..." /></SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tier</Label>
        <div className="flex gap-1">
          {(['basic', 'advanced', 'premium'] as const).map(t => (
            <Button key={t} size="sm" variant={form.tier === t ? 'default' : 'outline'} className="flex-1 capitalize text-xs h-9" onClick={() => setForm({ ...form, tier: t })}>
              {t}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">GA4 Property ID</Label>
        <Input value={form.ga4_property_id || ''} onChange={e => setForm({ ...form, ga4_property_id: e.target.value })} placeholder="123456789" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Site Audit URL</Label>
        <Input value={form.site_audit_url || ''} onChange={e => setForm({ ...form, site_audit_url: e.target.value })} placeholder="https://myinsights.io/..." />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label className="text-xs text-muted-foreground">Looker Studio URL</Label>
        <Input value={form.looker_url || ''} onChange={e => setForm({ ...form, looker_url: e.target.value })} placeholder="https://lookerstudio.google.com/..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Primary Conversion Goal</Label>
        <Select value={form.primary_conversion_goal || 'all'} onValueChange={v => setForm({ ...form, primary_conversion_goal: v })}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GOALS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 flex items-end pb-1">
        <div className="flex items-center gap-2">
          <Switch checked={form.multi_account_enabled || false} onCheckedChange={v => setForm({ ...form, multi_account_enabled: v })} />
          <Label className="text-xs">Multi-account display</Label>
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label className="text-xs text-muted-foreground">Tracked Conversion Types</Label>
        <div className="flex flex-wrap gap-3">
          {CONVERSION_TYPES.map(ct => (
            <label key={ct.key} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <Checkbox checked={(form.tracked_conversion_types || []).includes(ct.key)} onCheckedChange={() => toggleTrackedType(form, setForm, ct.key)} />
              {ct.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <AdminHeader />
      <main className="min-h-screen bg-background p-4 sm:p-6 pt-20">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Client Directory</h1>
                <p className="text-sm text-muted-foreground">{clients.filter(c => c.is_active).length} active clients</p>
              </div>
            </div>
            <Button onClick={() => { setAddForm(emptyForm()); setShowAddDialog(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search clients..." className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Show inactive</Label>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {searchQuery ? 'No clients match your search.' : 'No clients yet. Add one to get started.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Client</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead className="text-center">Accounts</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(client => (
                      <>
                        <TableRow key={client.id} className={!client.is_active ? 'opacity-50' : editingId === client.id ? 'bg-muted/30' : ''}>
                          <TableCell className="font-medium">{client.client_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {client.domain ? (
                              <a href={`https://${client.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
                                {client.domain} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs capitalize ${TIER_COLORS[client.tier] || TIER_COLORS.basic}`}>
                              {client.tier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{client.industry || '—'}</TableCell>
                          <TableCell className="text-center">
                            {accountCounts[client.client_name] ? (
                              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                {accountCounts[client.client_name]} linked
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={client.is_active} onCheckedChange={() => toggleActive(client)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => editingId === client.id ? cancelEdit() : startEdit(client)}>
                                {editingId === client.id ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Manage Ad Accounts" onClick={() => setMappingClient(client.client_name)}>
                                <Link className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-500" title="Delete" onClick={() => handleDelete(client)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded edit row */}
                        {editingId === client.id && (
                          <TableRow key={`${client.id}-edit`}>
                            <TableCell colSpan={7} className="bg-muted/20 border-t-0">
                              <div className="p-4 space-y-4">
                                <ClientForm form={editForm} setForm={setEditForm} />
                                <div className="flex items-center gap-2 pt-2">
                                  <Button size="sm" className="gap-1.5" disabled={isSaving} onClick={() => handleSave(client.id)}>
                                    <Save className="h-3.5 w-3.5" /> {isSaving ? 'Saving...' : 'Save Changes'}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                                  <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => setMappingClient(client.client_name)}>
                                    <Link className="h-3.5 w-3.5" /> Manage Ad Accounts
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Add New Client
            </DialogTitle>
          </DialogHeader>
          <ClientForm form={addForm} setForm={setAddForm} isAdd />
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button disabled={isSaving || !addForm.client_name?.trim()} onClick={handleAdd}>
              {isSaving ? 'Adding...' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Mapping Modal */}
      {mappingClient && smLoaded && (
        <AccountMappingModal
          clientName={mappingClient}
          smAccounts={smAccounts}
          onClose={() => setMappingClient(null)}
          onSaved={() => loadAccountCounts()}
        />
      )}
    </>
  );
}

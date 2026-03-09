import { useState, useEffect } from 'react';
import { X, Database, Eye, EyeOff, Save, Trash2, Loader2, Check, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CrmCredential {
  id: string;
  client_name: string;
  crm_provider: string;
  client_id: string;
  client_secret: string;
  base_url: string;
  is_active: boolean;
}

interface Props {
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
}

const CRM_PROVIDERS = [
  { key: 'none', label: 'No CRM', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  { key: 'servis', label: 'Servis CRM', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
];

export default function CrmCredentialsModal({ clientName, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [existing, setExisting] = useState<CrmCredential | null>(null);

  const [form, setForm] = useState({
    crm_provider: 'none',
    client_id: '',
    client_secret: '',
    base_url: '',
    is_active: true,
  });

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('client_crm_credentials')
        .select('*')
        .eq('client_name', clientName);
      if (!error && data && data.length > 0) {
        const cred = data[0] as unknown as CrmCredential;
        setExisting(cred);
        setForm({
          crm_provider: cred.crm_provider,
          client_id: cred.client_id,
          client_secret: cred.client_secret,
          base_url: cred.base_url,
          is_active: cred.is_active,
        });
      }
      setIsLoading(false);
    })();
  }, [clientName]);

  const handleSave = async () => {
    // If "No CRM" selected, delete any existing record
    if (form.crm_provider === 'none') {
      if (existing) {
        setIsSaving(true);
        try {
          const { error } = await supabase
            .from('client_crm_credentials')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
          toast({ title: `CRM removed for "${clientName}"` });
          onSaved();
          onClose();
        } catch (err: any) {
          toast({ title: 'Failed to remove CRM', description: err.message, variant: 'destructive' });
        } finally {
          setIsSaving(false);
        }
      } else {
        onClose();
      }
      return;
    }

    if (!form.client_id.trim() || !form.client_secret.trim()) {
      toast({ title: 'Client ID and Client Secret are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        client_name: clientName,
        crm_provider: form.crm_provider,
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim(),
        base_url: form.base_url.trim() || 'https://freeagent.network',
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('client_crm_credentials')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
        toast({ title: 'CRM credentials updated' });
      } else {
        const { error } = await supabase
          .from('client_crm_credentials')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'CRM credentials saved' });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: err?.message?.includes('unique') ? 'CRM already configured for this provider' : 'Failed to save',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm(`Remove CRM credentials for "${clientName}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('client_crm_credentials')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      toast({ title: 'CRM credentials removed' });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    }
  };

  const handleTestConnection = async () => {
    if (!form.client_id.trim() || !form.client_secret.trim()) {
      toast({ title: 'Enter Client ID and Client Secret first', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const baseUrl = form.base_url.trim() || 'https://freeagent.network';
      const resp = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: form.client_id.trim(),
          client_secret: form.client_secret.trim(),
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.access_token) {
          setTestResult('success');
          toast({ title: 'Connection successful! CRM is reachable.' });
        } else {
          setTestResult('error');
          toast({ title: 'No access token received', variant: 'destructive' });
        }
      } else {
        setTestResult('error');
        const errText = await resp.text().catch(() => '');
        toast({
          title: `Authentication failed (${resp.status})`,
          description: errText.slice(0, 200),
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setTestResult('error');
      toast({ title: 'Connection failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const providerInfo = CRM_PROVIDERS.find(p => p.key === form.crm_provider);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              CRM Integration
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
          ) : (
            <>
              {/* Provider */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">CRM Provider</Label>
                <Select value={form.crm_provider} onValueChange={v => setForm({ ...form, crm_provider: v, ...(v === 'none' ? { client_id: '', client_secret: '', base_url: '' } : {}) })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_PROVIDERS.map(p => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.crm_provider === 'none' ? (
                <div className="text-center py-6 space-y-1">
                  <p className="text-sm text-muted-foreground">No CRM selected for this client.</p>
                  <p className="text-xs text-muted-foreground">Choose a provider above to configure credentials.</p>
                </div>
              ) : (
                <>
                  {/* Isolation notice */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      CRM credentials are isolated to <span className="font-semibold text-foreground">{clientName}</span> only.
                      They are never shared with or accessible by any other client.
                    </p>
                  </div>

                  {/* Client ID */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Client ID</Label>
                    <Input
                      value={form.client_id}
                      onChange={e => setForm({ ...form, client_id: e.target.value })}
                      placeholder="e.g. f47ec1a7-c5f9-454b-96fa-bb626377ba66"
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Client Secret */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Client Secret</Label>
                    <div className="relative">
                      <Input
                        type={showSecret ? 'text' : 'password'}
                        value={form.client_secret}
                        onChange={e => setForm({ ...form, client_secret: e.target.value })}
                        placeholder="fa-secret-..."
                        className="font-mono text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Base URL</Label>
                    <Input
                      value={form.base_url}
                      onChange={e => setForm({ ...form, base_url: e.target.value })}
                      placeholder="https://freeagent.network"
                      className="text-sm"
                    />
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                      <Label className="text-sm">Active</Label>
                    </div>
                    {providerInfo && providerInfo.key !== 'none' && (
                      <Badge variant="outline" className={`text-xs ${providerInfo.color}`}>
                        {providerInfo.label}
                      </Badge>
                    )}
                  </div>

                  {/* Test Connection */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isTesting || !form.client_id.trim() || !form.client_secret.trim()}
                      className="gap-1.5 w-full"
                    >
                      {isTesting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : testResult === 'success' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : testResult === 'error' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      ) : (
                        <Database className="h-3.5 w-3.5" />
                      )}
                      {isTesting ? 'Testing...' : testResult === 'success' ? 'Connection Successful' : testResult === 'error' ? 'Connection Failed - Retry' : 'Test Connection'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <div>
              {existing && form.crm_provider !== 'none' && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-500 gap-1.5" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              {form.crm_provider === 'none' ? (
                existing ? (
                  <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5" variant="destructive">
                    <Trash2 className="h-3.5 w-3.5" /> {isSaving ? 'Removing...' : 'Remove CRM'}
                  </Button>
                ) : null
              ) : (
                <Button size="sm" onClick={handleSave} disabled={isSaving || !form.client_id.trim() || !form.client_secret.trim()} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> {isSaving ? 'Saving...' : existing ? 'Update' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

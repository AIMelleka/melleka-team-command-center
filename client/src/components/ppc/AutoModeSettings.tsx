import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Zap, Shield, Link2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutoModeSettings {
  auto_mode_enabled: boolean;
  auto_mode_platform: string;
  auto_mode_schedule: string;
  confidence_threshold: string;
  max_changes_per_run: number;
  google_account_id?: string;
  meta_account_id?: string;
}

interface AutoModeSettingsProps {
  clientName: string;
  settings: AutoModeSettings;
  onSettingsChange: (settings: AutoModeSettings) => void;
  onSave?: () => void;
}

export function AutoModeSettingsPanel({ clientName, settings, onSettingsChange, onSave }: AutoModeSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [savingAccounts, setSavingAccounts] = React.useState(false);

  const update = (patch: Partial<AutoModeSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  const saveAccounts = async () => {
    setSavingAccounts(true);
    try {
      const { error } = await supabase
        .from('ppc_client_settings')
        .upsert({
          client_name: clientName,
          google_account_id: settings.google_account_id || null,
          meta_account_id: settings.meta_account_id || null,
          auto_mode_enabled: settings.auto_mode_enabled,
          auto_mode_platform: settings.auto_mode_platform,
          auto_mode_schedule: settings.auto_mode_schedule,
          confidence_threshold: settings.confidence_threshold,
          max_changes_per_run: settings.max_changes_per_run,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_name' });

      if (error) throw error;
      toast({ title: 'Account IDs saved', description: 'They will auto-populate when this client is selected.' });
    } catch (e: any) {
      toast({ title: 'Failed to save account IDs', description: e.message, variant: 'destructive' });
    } finally {
      setSavingAccounts(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ppc_client_settings')
        .upsert({
          client_name: clientName,
          google_account_id: settings.google_account_id || null,
          meta_account_id: settings.meta_account_id || null,
          auto_mode_enabled: settings.auto_mode_enabled,
          auto_mode_platform: settings.auto_mode_platform,
          auto_mode_schedule: settings.auto_mode_schedule,
          confidence_threshold: settings.confidence_threshold,
          max_changes_per_run: settings.max_changes_per_run,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_name' });

      if (error) throw error;
      toast({ title: 'Auto Mode settings saved' });
      onSave?.();
    } catch (e: any) {
      toast({ title: 'Failed to save settings', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasGoogleId = !!(settings.google_account_id?.trim());
  const hasMetaId = !!(settings.meta_account_id?.trim());

  return (
    <div className="space-y-3">
      {/* Account IDs card — always visible */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-400" />
            <p className="text-sm font-semibold">Ad Account IDs</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Save once — auto-fills when this client is selected
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              🔵 Google Ads Account ID
              {hasGoogleId && <CheckCircle className="h-3 w-3 text-green-400" />}
            </Label>
            <Input
              value={settings.google_account_id || ''}
              onChange={e => update({ google_account_id: e.target.value })}
              placeholder="e.g. 123-456-7890"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              🔷 Meta Ads Account ID
              {hasMetaId && <CheckCircle className="h-3 w-3 text-green-400" />}
            </Label>
            <Input
              value={settings.meta_account_id || ''}
              onChange={e => update({ meta_account_id: e.target.value })}
              placeholder="e.g. act_123456789"
              className="h-8 text-xs"
            />
          </div>
          <Button
            onClick={saveAccounts}
            disabled={savingAccounts}
            size="sm"
            variant="outline"
            className="w-full gap-2"
          >
            <Link2 className="h-3.5 w-3.5" />
            {savingAccounts ? 'Saving...' : 'Save Account IDs'}
          </Button>
        </CardContent>
      </Card>

      {/* Auto Mode card */}
      <Card className={settings.auto_mode_enabled ? 'border-purple-500/40 bg-purple-500/5' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              <p className="text-sm font-semibold">Auto Mode</p>
            </div>
            <Switch
              checked={settings.auto_mode_enabled}
              onCheckedChange={(v) => update({ auto_mode_enabled: v })}
            />
          </div>
        </CardHeader>

        {settings.auto_mode_enabled && (
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">
                Auto Mode will automatically execute <strong>high-confidence</strong> changes on a schedule. Budget will never be increased — only reallocated.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-green-400">
              <Shield className="h-3.5 w-3.5" />
              Budget increase is permanently disabled in Auto Mode
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Platform</Label>
                <Select value={settings.auto_mode_platform} onValueChange={(v) => update({ auto_mode_platform: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Ads only</SelectItem>
                    <SelectItem value="meta">Meta Ads only</SelectItem>
                    <SelectItem value="both">Both platforms</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Schedule</Label>
                <Select value={settings.auto_mode_schedule} onValueChange={(v) => update({ auto_mode_schedule: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Min. Confidence to Auto-Execute</Label>
                <Select value={settings.confidence_threshold} onValueChange={(v) => update({ confidence_threshold: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High only (safest)</SelectItem>
                    <SelectItem value="medium">Medium or higher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Max Changes Per Run: {settings.max_changes_per_run}</Label>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={settings.max_changes_per_run}
                  onChange={(e) => update({ max_changes_per_run: parseInt(e.target.value) })}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>1 (safest)</span>
                  <span>15 (aggressive)</span>
                </div>
              </div>
            </div>

            <Button onClick={save} disabled={saving} size="sm" className="w-full">
              {saving ? 'Saving...' : 'Save Auto Mode Settings'}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

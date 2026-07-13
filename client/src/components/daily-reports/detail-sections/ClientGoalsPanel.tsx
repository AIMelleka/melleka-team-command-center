import { useState, useEffect } from 'react';
import { Settings2, Save, Pencil, Target, User, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClientGoals } from '../scoring';
import type { AggregatedKpis } from '../scoring';

const CONVERSION_GOALS = [
  'Leads',
  'Purchases / Sales',
  'Phone Calls',
  'Form Submissions',
  'Appointments',
  'Sign-ups',
  'App Installs',
  'Other',
];

interface Props {
  goals: ClientGoals | null;
  kpis: AggregatedKpis;
  onSave: (goals: ClientGoals) => Promise<void>;
}

// ── Numeric badge comparing actual vs target ────────────────────────────────
function GoalBadge({ label, actual, target, invert, suffix }: {
  label: string; actual: number; target: number | null | undefined; invert?: boolean; suffix?: string;
}) {
  const hasTarget = target != null && target > 0;
  const prefix = suffix ? '' : '$';
  const sfx = suffix || '';

  if (!hasTarget) return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-muted/50 min-w-[80px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-xs text-muted-foreground/50">Not set</span>
    </div>
  );

  if (actual <= 0) return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-muted/50 min-w-[80px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-xs font-medium text-foreground">{prefix}{target.toFixed(suffix ? 1 : 0)}{sfx} target</span>
    </div>
  );

  const isGood = invert ? actual >= target : actual <= target;
  return (
    <div className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg border min-w-[80px] ${isGood ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className={`flex items-center gap-1 text-xs font-medium ${isGood ? 'text-emerald-500' : 'text-red-400'}`}>
        <span>{prefix}{actual.toFixed(suffix ? 1 : 0)}{sfx}</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="text-muted-foreground">{prefix}{target.toFixed(suffix ? 1 : 0)}{sfx}</span>
      </div>
    </div>
  );
}

// ── Number input field ──────────────────────────────────────────────────────
function GoalField({ label, value, onChange, prefix, suffix }: {
  label: string; value: number | null | undefined; onChange: (v: string) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number" min={0} step="any"
          className={`h-8 text-sm ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-6' : ''}`}
          placeholder="—"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function ClientGoalsPanel({ goals, kpis, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientGoals>({});

  useEffect(() => {
    setDraft(goals ? { ...goals } : {});
  }, [goals]);

  const hasScoring = !!(goals?.target_cpa || goals?.target_cpl || goals?.target_roas
    || goals?.monthly_budget || goals?.monthly_lead_target || goals?.monthly_conversion_target);

  const setNum = (field: keyof ClientGoals, value: string) => {
    const num = value === '' ? null : Number(value);
    setDraft(prev => ({ ...prev, [field]: num }));
  };
  const setStr = (field: keyof ClientGoals, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value || null }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save — check that the database columns exist.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-accent/30 border-b">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Settings</span>
          <span className="text-[10px] text-muted-foreground/60">— controls scoring and report content</span>
        </div>
        {!isEditing && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        )}
      </div>

      {/* ── VIEW MODE ── */}
      {!isEditing && (
        <div className="px-4 py-3 space-y-3">
          {/* Scoring goals row */}
          {hasScoring ? (
            <div className="flex flex-wrap gap-2">
              <GoalBadge label="CPA" actual={kpis.cpa} target={goals?.target_cpa} />
              <GoalBadge label="CPL" actual={kpis.cpl} target={goals?.target_cpl} />
              <GoalBadge label="ROAS" actual={kpis.roas} target={goals?.target_roas} invert suffix="x" />
              {goals?.monthly_budget ? (
                <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-muted/50 min-w-[80px]">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</span>
                  <span className="text-xs font-medium">${goals.monthly_budget.toLocaleString()}/mo</span>
                </div>
              ) : null}
              {goals?.monthly_conversion_target ? (
                <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-muted/50 min-w-[80px]">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Conv. Target</span>
                  <span className="text-xs font-medium">{goals.monthly_conversion_target}/mo</span>
                </div>
              ) : null}
              {goals?.monthly_lead_target ? (
                <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-muted/50 min-w-[80px]">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Lead Target</span>
                  <span className="text-xs font-medium">{goals.monthly_lead_target}/mo</span>
                </div>
              ) : null}
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors">
              No scoring goals set — click <span className="text-primary font-medium">Edit</span> to add CPA, CPL, ROAS, and budget targets. These directly affect this client's performance score.
            </button>
          )}

          {/* Profile + context pills */}
          {(goals?.industry || goals?.primary_conversion_goal || goals?.report_focus || goals?.targeting_context || goals?.client_notes) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
              {goals?.industry && (
                <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Industry:</span> {goals.industry}</span>
              )}
              {goals?.primary_conversion_goal && (
                <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Goal:</span> {goals.primary_conversion_goal}</span>
              )}
              {goals?.report_focus && (
                <span className="text-xs text-muted-foreground italic w-full">{goals.report_focus}</span>
              )}
              {goals?.targeting_context && (
                <span className="text-xs text-muted-foreground italic w-full">{goals.targeting_context}</span>
              )}
              {goals?.client_notes && (
                <span className="text-xs text-muted-foreground italic w-full">{goals.client_notes}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT MODE ── */}
      {isEditing && (
        <div className="px-4 pb-4 pt-3 space-y-5">

          {/* Section 1: Scoring Goals */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Scoring Goals</span>
              <span className="text-[10px] text-muted-foreground/70">— numeric targets used to calculate the performance score</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <GoalField label="Target CPA"            value={draft.target_cpa}                 onChange={v => setNum('target_cpa', v)}                 prefix="$" />
              <GoalField label="Target CPL"            value={draft.target_cpl}                 onChange={v => setNum('target_cpl', v)}                 prefix="$" />
              <GoalField label="Target ROAS"           value={draft.target_roas}                onChange={v => setNum('target_roas', v)}                suffix="x" />
              <GoalField label="Monthly Budget"        value={draft.monthly_budget}             onChange={v => setNum('monthly_budget', v)}             prefix="$" />
              <GoalField label="Monthly Lead Target"   value={draft.monthly_lead_target}        onChange={v => setNum('monthly_lead_target', v)} />
              <GoalField label="Monthly Conv. Target"  value={draft.monthly_conversion_target}  onChange={v => setNum('monthly_conversion_target', v)} />
            </div>
          </div>

          {/* Section 2: Client Profile */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Client Profile</span>
              <span className="text-[10px] text-muted-foreground/70">— used for benchmark matching and AI analysis context</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Industry</label>
                <Input
                  className="h-8 text-sm"
                  placeholder="e.g. Home Services, E-commerce, Healthcare..."
                  value={draft.industry || ''}
                  onChange={e => setStr('industry', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Primary Conversion Goal</label>
                <select
                  className="w-full h-8 rounded-md border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={draft.primary_conversion_goal || ''}
                  onChange={e => setStr('primary_conversion_goal', e.target.value)}
                >
                  <option value="">— Select —</option>
                  {CONVERSION_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Report Context */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Report Context</span>
              <span className="text-[10px] text-muted-foreground/70">— sent to the AI every time a report is generated</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">What to focus on in the report</label>
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[56px]"
                  placeholder="e.g. This client cares most about cost per lead. Flag anything over $50 CPL immediately. Prioritize lead volume over ROAS."
                  value={draft.report_focus || ''}
                  onChange={e => setStr('report_focus', e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Targeting and campaign context</label>
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[56px]"
                  placeholder="e.g. Targeting Los Angeles, Orange County. Running brand + non-brand campaigns. Exclude competitor keywords."
                  value={draft.targeting_context || ''}
                  onChange={e => setStr('targeting_context', e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Additional client notes</label>
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[56px]"
                  placeholder="e.g. Seasonal business — summer is peak. What counts as a conversion: form fills only, not calls."
                  value={draft.client_notes || ''}
                  onChange={e => setStr('client_notes', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-[10px] text-muted-foreground">Scoring Goals affect the score. All fields are sent to the AI when generating reports.</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={() => { setIsEditing(false); setSaveError(null); }}>Cancel</Button>
              <Button size="sm" className="h-7 px-3 text-xs gap-1.5" onClick={handleSave} disabled={isSaving}>
                <Save className="h-3 w-3" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

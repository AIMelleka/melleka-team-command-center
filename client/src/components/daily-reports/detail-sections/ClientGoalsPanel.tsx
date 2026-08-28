import { useState, useEffect } from 'react';
import { Settings2, Save, Pencil, ChevronDown, ChevronRight, Target, Layers, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClientGoals, PlatformSetting } from '../scoring';
import type { AggregatedKpis } from '../scoring';

/* ── Constants ── */

const CONVERSION_TYPES = [
  { value: 'Leads', label: 'Leads', metricType: 'cpl' },
  { value: 'Purchases / Sales', label: 'Purchases & Sales', metricType: 'cpa' },
  { value: 'Phone Calls', label: 'Phone Calls', metricType: 'cpl' },
  { value: 'Form Submissions', label: 'Form Submissions', metricType: 'cpl' },
  { value: 'Appointments', label: 'Appointments', metricType: 'cpl' },
  { value: 'Sign-ups', label: 'Sign-ups', metricType: 'cpa' },
  { value: 'App Installs', label: 'App Installs', metricType: 'cpa' },
  { value: 'Other', label: 'Other', metricType: 'cpa' },
] as const;

const PLATFORM_DISPLAY: Record<string, { label: string; color: string }> = {
  google_ads: { label: 'Google Ads', color: '#4285F4' },
  google: { label: 'Google Ads', color: '#4285F4' },
  meta_ads: { label: 'Meta Ads', color: '#1877F2' },
  meta: { label: 'Meta Ads', color: '#1877F2' },
  bing_ads: { label: 'Bing Ads', color: '#00809D' },
  tiktok_ads: { label: 'TikTok Ads', color: '#010101' },
  linkedin_ads: { label: 'LinkedIn Ads', color: '#0A66C2' },
  reddit_ads: { label: 'Reddit Ads', color: '#FF4500' },
  vibe_tv_ads: { label: 'VIBE TV', color: '#7C3AED' },
};

const PLATFORM_METRICS: Record<string, Array<{ value: string; label: string }>> = {
  google_ads: [
    { value: 'cpl', label: 'CPL (Cost Per Lead)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
    { value: 'roas', label: 'ROAS' },
  ],
  google: [
    { value: 'cpl', label: 'CPL (Cost Per Lead)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
    { value: 'roas', label: 'ROAS' },
  ],
  bing_ads: [
    { value: 'cpl', label: 'CPL (Cost Per Lead)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
    { value: 'roas', label: 'ROAS' },
  ],
  meta_ads: [
    { value: 'cpl', label: 'CPL (Cost Per Lead)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
    { value: 'roas', label: 'ROAS' },
    { value: 'cpm', label: 'CPM (Cost Per 1k Impressions)' },
  ],
  meta: [
    { value: 'cpl', label: 'CPL (Cost Per Lead)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
    { value: 'roas', label: 'ROAS' },
    { value: 'cpm', label: 'CPM (Cost Per 1k Impressions)' },
  ],
  tiktok_ads: [
    { value: 'cpm', label: 'CPM (Cost Per 1k Impressions)' },
    { value: 'ctr', label: 'CTR (Click-Through Rate)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
  ],
  linkedin_ads: [
    { value: 'cpl', label: 'CPL (Cost Per Lead)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
  ],
  reddit_ads: [
    { value: 'cpm', label: 'CPM (Cost Per 1k Impressions)' },
    { value: 'ctr', label: 'CTR (Click-Through Rate)' },
    { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
  ],
  vibe_tv_ads: [
    { value: 'cpm', label: 'CPM (Cost Per 1k Impressions)' },
    { value: 'ctr', label: 'CTR (Click-Through Rate)' },
  ],
};

const DEFAULT_PLATFORM_METRICS = [
  { value: 'cpl', label: 'CPL (Cost Per Lead)' },
  { value: 'cpa', label: 'CPA (Cost Per Acquisition)' },
  { value: 'roas', label: 'ROAS' },
];

/* ── Helpers ── */

function getMetricType(goalType: string | null | undefined): 'cpl' | 'cpa' {
  const found = CONVERSION_TYPES.find(t => t.value === goalType);
  return (found?.metricType as 'cpl' | 'cpa') ?? 'cpa';
}

function getPlatformLabel(key: string): string {
  return PLATFORM_DISPLAY[key]?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getPlatformColor(key: string): string {
  return PLATFORM_DISPLAY[key]?.color ?? '#6b7280';
}

function getPlatformMetrics(key: string) {
  return PLATFORM_METRICS[key] ?? DEFAULT_PLATFORM_METRICS;
}

function metricPrefix(metric: string): string {
  return ['cpl', 'cpa', 'cpm'].includes(metric) ? '$' : '';
}

function metricSuffix(metric: string): string {
  if (metric === 'roas') return 'x';
  if (metric === 'ctr') return '%';
  return '';
}

function getMetricLabel(metric: string, isTarget = false): string {
  const map: Record<string, string> = {
    cpl: isTarget ? 'Target CPL' : 'CPL',
    cpa: isTarget ? 'Target CPA' : 'CPA',
    roas: isTarget ? 'Target ROAS' : 'ROAS',
    cpm: isTarget ? 'Target CPM' : 'CPM',
    ctr: isTarget ? 'Target CTR %' : 'CTR',
  };
  return map[metric] ?? metric.toUpperCase();
}

/* ── Props ── */

interface Props {
  goals: ClientGoals | null;
  kpis: AggregatedKpis;
  onSave: (goals: ClientGoals) => Promise<void>;
  industryBenchmarks?: { googleCpa?: number; metaCpa?: number } | null;
}

/* ── View Mode: Goal chip ── */

function GoalChip({ rank, goal, target, monthly }: {
  rank: number;
  goal: string | null | undefined;
  target: number | null | undefined;
  monthly?: number | null;
}) {
  if (!goal && !target) return null;
  const metricType = getMetricType(goal);
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 border text-xs">
      <span className="text-muted-foreground font-medium">{rank}.</span>
      <span className="font-medium text-foreground">{goal ?? 'Conversions'}</span>
      {target != null && target > 0 && (
        <span className="text-muted-foreground">${target} {metricType.toUpperCase()}</span>
      )}
      {monthly != null && monthly > 0 && (
        <span className="text-muted-foreground/60">/ {monthly}/mo</span>
      )}
    </div>
  );
}

/* ── View Mode: Platform chip ── */

function PlatformChip({ platformKey, setting }: {
  platformKey: string;
  setting: PlatformSetting;
}) {
  if (setting.priority === 'off') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 text-xs text-muted-foreground/50 line-through">
        {getPlatformLabel(platformKey)}
      </div>
    );
  }
  const color = getPlatformColor(platformKey);
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}>
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="font-medium" style={{ color }}>{getPlatformLabel(platformKey)}</span>
      <span className="text-muted-foreground capitalize">{setting.priority}</span>
      {setting.target_value != null && (
        <span className="text-muted-foreground/70">
          {metricPrefix(setting.focus_metric)}{setting.target_value}{metricSuffix(setting.focus_metric)} {setting.focus_metric.toUpperCase()}
        </span>
      )}
    </div>
  );
}

/* ── Edit Mode: Conversion Goal Card ── */

interface GoalCardProps {
  rank: 1 | 2 | 3;
  goalType: string | null | undefined;
  targetCpa: number | null | undefined;
  targetCpl: number | null | undefined;
  monthlyTarget: number | null | undefined;
  onChange: (fields: { goalType?: string | null; targetCpa?: number | null; targetCpl?: number | null; monthlyTarget?: number | null }) => void;
  industryBenchmarks?: { googleCpa?: number; metaCpa?: number } | null;
  defaultOpen?: boolean;
}

function ConversionGoalCard({ rank, goalType, targetCpa, targetCpl, monthlyTarget, onChange, industryBenchmarks, defaultOpen }: GoalCardProps) {
  const [open, setOpen] = useState(defaultOpen ?? rank === 1);
  const rankLabels = ['Primary', 'Secondary', 'Tertiary'];
  const metricType = getMetricType(goalType);
  const target = metricType === 'cpl' ? targetCpl : targetCpa;
  const hasContent = !!(goalType || target || monthlyTarget);

  const handleGoalTypeChange = (val: string) => {
    const newMetric = CONVERSION_TYPES.find(t => t.value === val)?.metricType ?? 'cpa';
    const existingTarget = target;
    onChange({
      goalType: val || null,
      targetCpa: newMetric === 'cpa' ? existingTarget : null,
      targetCpl: newMetric === 'cpl' ? existingTarget : null,
    });
  };

  const handleTargetChange = (val: string) => {
    const num = val === '' ? null : Number(val);
    if (metricType === 'cpl') onChange({ targetCpl: num, targetCpa: null });
    else onChange({ targetCpa: num, targetCpl: null });
  };

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {rankLabels[rank - 1]} Goal
          </span>
          {hasContent && !open && (
            <span className="text-xs text-foreground font-medium ml-1">
              {goalType ?? 'Conversions'}
              {target != null && ` · $${target}`}
            </span>
          )}
          {rank !== 1 && !hasContent && (
            <span className="text-[10px] text-muted-foreground/50 ml-1">Optional</span>
          )}
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Conversion Type</label>
            <select
              className="w-full h-8 rounded-md border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={goalType ?? ''}
              onChange={e => handleGoalTypeChange(e.target.value)}
            >
              <option value="" disabled>Select type...</option>
              {CONVERSION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Target {metricType.toUpperCase()}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  className="h-8 text-sm pl-6"
                  placeholder="—"
                  value={target ?? ''}
                  onChange={e => handleTargetChange(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Target</label>
              <Input
                type="number"
                className="h-8 text-sm"
                placeholder="e.g. 50"
                value={monthlyTarget ?? ''}
                onChange={e => onChange({ monthlyTarget: e.target.value === '' ? null : Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>

          {industryBenchmarks && (
            <div className="flex items-center gap-3 px-2.5 py-1.5 rounded bg-accent/40 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Industry benchmarks:</span>
              {industryBenchmarks.googleCpa != null && (
                <span>Google avg <span className="font-medium text-foreground">${industryBenchmarks.googleCpa} CPA</span></span>
              )}
              {industryBenchmarks.metaCpa != null && (
                <span>Meta avg <span className="font-medium text-foreground">${industryBenchmarks.metaCpa} CPA</span></span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Edit Mode: Platform Row ── */

function PlatformRow({ platformKey, setting, onChange }: {
  platformKey: string;
  setting: PlatformSetting;
  onChange: (s: PlatformSetting) => void;
}) {
  const color = getPlatformColor(platformKey);
  const metrics = getPlatformMetrics(platformKey);

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-foreground">{getPlatformLabel(platformKey)}</span>
        </div>

        <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
          {(['primary', 'secondary', 'off'] as const).map(p => (
            <button
              key={p}
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${
                setting.priority === p
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onChange({ ...setting, priority: p })}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {setting.priority !== 'off' && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Focus Metric</label>
            <select
              className="w-full h-7 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={setting.focus_metric}
              onChange={e => onChange({ ...setting, focus_metric: e.target.value as PlatformSetting['focus_metric'] })}
            >
              {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
              {getMetricLabel(setting.focus_metric, true)}
            </label>
            <div className="relative">
              {metricPrefix(setting.focus_metric) && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {metricPrefix(setting.focus_metric)}
                </span>
              )}
              <Input
                type="number"
                className={`h-7 text-xs ${metricPrefix(setting.focus_metric) ? 'pl-4' : ''} ${metricSuffix(setting.focus_metric) ? 'pr-5' : ''}`}
                placeholder="—"
                value={setting.target_value ?? ''}
                onChange={e => onChange({ ...setting, target_value: e.target.value === '' ? null : Number(e.target.value) })}
                min={0}
                step="any"
              />
              {metricSuffix(setting.focus_metric) && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {metricSuffix(setting.focus_metric)}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Monthly Target</label>
            <Input
              type="number"
              className="h-7 text-xs"
              placeholder="—"
              value={setting.monthly_target ?? ''}
              onChange={e => onChange({ ...setting, monthly_target: e.target.value === '' ? null : Number(e.target.value) })}
              min={0}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export function ClientGoalsPanel({ goals, kpis, onSave, industryBenchmarks }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientGoals>({});

  useEffect(() => {
    setDraft(goals ? { ...goals } : {});
  }, [goals]);

  const activePlatforms = goals?.active_platforms ?? [];
  const platformSettings = draft.platform_settings ?? {};

  const hasGoals = !!(
    goals?.primary_conversion_goal || goals?.target_cpa || goals?.target_cpl ||
    goals?.secondary_conversion_goal || goals?.tertiary_conversion_goal ||
    (goals?.platform_settings && Object.keys(goals.platform_settings).length > 0)
  );

  const hasContext = !!(goals?.report_focus || goals?.targeting_context || goals?.client_notes);

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

  const handleCancel = () => {
    setDraft(goals ? { ...goals } : {});
    setIsEditing(false);
    setSaveError(null);
  };

  const updatePlatformSetting = (key: string, setting: PlatformSetting) => {
    setDraft(prev => ({
      ...prev,
      platform_settings: { ...prev.platform_settings, [key]: setting },
    }));
  };

  const getOrDefaultSetting = (key: string): PlatformSetting => {
    if (platformSettings[key]) return platformSettings[key];
    const firstMetric = getPlatformMetrics(key)[0]?.value as PlatformSetting['focus_metric'];
    return { priority: 'primary', focus_metric: firstMetric ?? 'cpa', target_value: null, monthly_target: null };
  };

  const primaryMetricType = getMetricType(draft.primary_conversion_goal);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-accent/30 border-b">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Settings</span>
          <span className="text-[10px] text-muted-foreground/60">controls scoring and report content</span>
        </div>
        {!isEditing && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        )}
      </div>

      {/* VIEW MODE */}
      {!isEditing && (
        <div className="px-4 py-3 space-y-2.5">
          {hasGoals ? (
            <>
              {/* Conversion Goals chips */}
              {(goals?.primary_conversion_goal || goals?.target_cpa || goals?.target_cpl) && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Conversion Goals</p>
                  <div className="flex flex-wrap gap-1.5">
                    <GoalChip
                      rank={1}
                      goal={goals?.primary_conversion_goal}
                      target={getMetricType(goals?.primary_conversion_goal) === 'cpl' ? goals?.target_cpl : goals?.target_cpa}
                      monthly={goals?.monthly_lead_target ?? goals?.monthly_conversion_target}
                    />
                    {goals?.secondary_conversion_goal && (
                      <GoalChip
                        rank={2}
                        goal={goals.secondary_conversion_goal}
                        target={getMetricType(goals.secondary_conversion_goal) === 'cpl' ? goals.secondary_target_cpl : goals.secondary_target_cpa}
                        monthly={goals.secondary_monthly_target}
                      />
                    )}
                    {goals?.tertiary_conversion_goal && (
                      <GoalChip
                        rank={3}
                        goal={goals.tertiary_conversion_goal}
                        target={getMetricType(goals.tertiary_conversion_goal) === 'cpl' ? goals.tertiary_target_cpl : goals.tertiary_target_cpa}
                        monthly={goals.tertiary_monthly_target}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Platform chips */}
              {goals?.platform_settings && Object.keys(goals.platform_settings).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Platforms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(goals.platform_settings).map(([key, setting]) => (
                      <PlatformChip key={key} platformKey={key} setting={setting} />
                    ))}
                  </div>
                </div>
              )}

              {/* Context preview */}
              {hasContext && (
                <p className="text-xs text-muted-foreground italic truncate border-t pt-2">
                  {goals?.report_focus || goals?.targeting_context || goals?.client_notes}
                </p>
              )}
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors">
              No settings configured — click <span className="text-primary font-medium">Edit</span> to add conversion goals, platform settings, and AI context.
            </button>
          )}
        </div>
      )}

      {/* EDIT MODE */}
      {isEditing && (
        <div className="px-4 pb-4 pt-3 space-y-5">

          {/* Section 1: Conversion Goals */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Conversion Goals</span>
            </div>
            <div className="space-y-2">
              {/* Primary */}
              <ConversionGoalCard
                rank={1}
                goalType={draft.primary_conversion_goal}
                targetCpa={draft.target_cpa}
                targetCpl={draft.target_cpl}
                monthlyTarget={primaryMetricType === 'cpl' ? draft.monthly_lead_target : draft.monthly_conversion_target}
                industryBenchmarks={industryBenchmarks}
                defaultOpen
                onChange={({ goalType, targetCpa, targetCpl, monthlyTarget }) => {
                  const newMetric = getMetricType(goalType ?? draft.primary_conversion_goal);
                  setDraft(prev => ({
                    ...prev,
                    ...(goalType !== undefined ? { primary_conversion_goal: goalType } : {}),
                    ...(targetCpa !== undefined ? { target_cpa: targetCpa } : {}),
                    ...(targetCpl !== undefined ? { target_cpl: targetCpl } : {}),
                    ...(monthlyTarget !== undefined ? {
                      monthly_lead_target: newMetric === 'cpl' ? monthlyTarget : prev.monthly_lead_target,
                      monthly_conversion_target: newMetric === 'cpa' ? monthlyTarget : prev.monthly_conversion_target,
                    } : {}),
                  }));
                }}
              />

              {/* Secondary */}
              <ConversionGoalCard
                rank={2}
                goalType={draft.secondary_conversion_goal}
                targetCpa={draft.secondary_target_cpa}
                targetCpl={draft.secondary_target_cpl}
                monthlyTarget={draft.secondary_monthly_target}
                industryBenchmarks={industryBenchmarks}
                defaultOpen={!!(draft.secondary_conversion_goal)}
                onChange={({ goalType, targetCpa, targetCpl, monthlyTarget }) => {
                  setDraft(prev => ({
                    ...prev,
                    ...(goalType !== undefined ? { secondary_conversion_goal: goalType } : {}),
                    ...(targetCpa !== undefined ? { secondary_target_cpa: targetCpa } : {}),
                    ...(targetCpl !== undefined ? { secondary_target_cpl: targetCpl } : {}),
                    ...(monthlyTarget !== undefined ? { secondary_monthly_target: monthlyTarget } : {}),
                  }));
                }}
              />

              {/* Tertiary */}
              <ConversionGoalCard
                rank={3}
                goalType={draft.tertiary_conversion_goal}
                targetCpa={draft.tertiary_target_cpa}
                targetCpl={draft.tertiary_target_cpl}
                monthlyTarget={draft.tertiary_monthly_target}
                industryBenchmarks={industryBenchmarks}
                defaultOpen={!!(draft.tertiary_conversion_goal)}
                onChange={({ goalType, targetCpa, targetCpl, monthlyTarget }) => {
                  setDraft(prev => ({
                    ...prev,
                    ...(goalType !== undefined ? { tertiary_conversion_goal: goalType } : {}),
                    ...(targetCpa !== undefined ? { tertiary_target_cpa: targetCpa } : {}),
                    ...(targetCpl !== undefined ? { tertiary_target_cpl: targetCpl } : {}),
                    ...(monthlyTarget !== undefined ? { tertiary_monthly_target: monthlyTarget } : {}),
                  }));
                }}
              />
            </div>

            {/* Industry field — compact, stays with goals for benchmark context */}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-muted-foreground shrink-0">Industry:</label>
              <Input
                className="h-7 text-xs flex-1"
                placeholder="e.g. Home Services, Healthcare..."
                value={draft.industry || ''}
                onChange={e => setDraft(prev => ({ ...prev, industry: e.target.value || null }))}
              />
            </div>
          </div>

          {/* Section 2: Platform Settings */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Platform Settings</span>
            </div>
            {activePlatforms.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
                No ad accounts linked. Link accounts in Client Settings to configure platform priorities.
              </div>
            ) : (
              <div className="space-y-2">
                {activePlatforms.map(key => (
                  <PlatformRow
                    key={key}
                    platformKey={key}
                    setting={getOrDefaultSetting(key)}
                    onChange={s => updatePlatformSetting(key, s)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Report Context */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Report Context</span>
              <span className="text-[10px] text-muted-foreground/70">sent to the AI every time a report is generated</span>
            </div>
            <div className="space-y-3">
              <ContextField
                label="What to focus on in the report"
                placeholder="e.g. This client cares most about cost per lead. Flag anything over $50 CPL immediately."
                value={draft.report_focus ?? ''}
                onChange={v => setDraft(prev => ({ ...prev, report_focus: v || null }))}
              />
              <ContextField
                label="Targeting and campaign context"
                placeholder="e.g. Targeting Los Angeles, Orange County. Running brand + non-brand campaigns."
                value={draft.targeting_context ?? ''}
                onChange={v => setDraft(prev => ({ ...prev, targeting_context: v || null }))}
              />
              <ContextField
                label="Additional client notes"
                placeholder="e.g. Seasonal business — summer is peak. Form fills only, not calls."
                value={draft.client_notes ?? ''}
                onChange={v => setDraft(prev => ({ ...prev, client_notes: v || null }))}
              />
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-[10px] text-muted-foreground">Goals affect scoring. All fields are sent to the AI when generating reports.</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={handleCancel}>Cancel</Button>
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

function ContextField({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[56px]"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
      />
    </div>
  );
}

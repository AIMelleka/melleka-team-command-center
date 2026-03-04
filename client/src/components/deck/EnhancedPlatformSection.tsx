import { useState, useCallback, useContext, useRef, useEffect } from 'react';
import { DeckEditContext } from './DeckEditContext';
import { cn } from '@/lib/utils';
import { DeckMetricCard } from './DeckMetricCard';
import { DeckPerformanceGrade } from './DeckPerformanceGrade';
import { DeckTrendChart } from './DeckTrendChart';
import { InlineEdit } from './InlineEdit';
import { EditableImage, AddImageButton } from './EditableImage';
import {
  Lightbulb, ChevronRight, Image as ImageIcon, TrendingUp, TrendingDown,
  BarChart3, Target, Zap, ArrowRight, DollarSign, MousePointer, Users, Eye,
  Plus, X, Check, Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  FunnelChart, Funnel, LabelList,
} from 'recharts';

// ─── Add Metric Dialog ────────────────────────────────────────────────────────
interface CustomMetricEntry {
  id: string;
  label: string;
  value: string;
  prefix: string;
  suffix: string;
}

function AddMetricButton({ ekp, color }: { ekp: string; color: string }) {
  const ctx = useContext(DeckEditContext);
  const isEditMode = ctx?.isEditMode ?? false;
  const overrides = ctx?.overrides ?? {};
  const updateOverride = ctx?.updateOverride ?? (async () => {});
  const removeOverride = ctx?.removeOverride ?? (async () => {});

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => labelRef.current?.focus(), 50);
  }, [open]);

  if (!isEditMode) return null;

  // Parse stored custom metrics for this platform
  const storageKey = `${ekp}.customMetrics`;
  const storedRaw = overrides[storageKey];
  const customMetrics: CustomMetricEntry[] = (() => {
    try { return storedRaw ? JSON.parse(storedRaw) : []; } catch { return []; }
  })();

  const save = async () => {
    const trimLabel = label.trim();
    const trimValue = value.trim();
    if (!trimLabel || !trimValue) return;
    const newEntry: CustomMetricEntry = {
      id: Math.random().toString(36).slice(2, 10),
      label: trimLabel,
      value: trimValue,
      prefix: prefix.trim(),
      suffix: suffix.trim(),
    };
    const next = [...customMetrics, newEntry];
    await updateOverride(storageKey, JSON.stringify(next));
    setLabel(''); setValue(''); setPrefix(''); setSuffix('');
    setOpen(false);
  };

  const remove = async (id: string) => {
    const next = customMetrics.filter(m => m.id !== id);
    if (next.length === 0) await removeOverride(storageKey);
    else await updateOverride(storageKey, JSON.stringify(next));
  };

  return (
    <>
      {/* Existing custom metric cards with delete buttons */}
      {customMetrics.map(m => (
        <div key={m.id} className="relative group/custom">
          <DeckMetricCard
            label={m.label}
            value={parseFloat(m.value) || 0}
            prefix={m.prefix}
            suffix={m.suffix}
            color={color}
            size="md"
          />
          {/* Delete button */}
          <button
            onClick={() => remove(m.id)}
            className="absolute top-2 right-2 opacity-0 group-hover/custom:opacity-100 transition-opacity p-1 rounded-lg bg-red-500/80 hover:bg-red-600 text-white"
            title="Remove metric"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {/* Custom badge */}
          <div className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 font-semibold uppercase tracking-wide">
            Custom
          </div>
        </div>
      ))}

      {/* Add Metric button */}
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all duration-200 p-6 text-white/40 hover:text-yellow-300 min-h-[120px]"
        title="Add custom metric"
      >
        <Plus className="w-6 h-6" />
        <span className="text-xs font-medium">Add Metric</span>
      </button>

      {/* Dialog overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl bg-[#0d0d1a] border border-yellow-400/30 p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-lg">Add Custom Metric</h3>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Label */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wide mb-1.5 block">Metric Label *</label>
                <input
                  ref={labelRef}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="e.g. ROAS, Revenue, Reach"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-yellow-400/60 text-sm"
                />
              </div>

              {/* Value */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wide mb-1.5 block">Value *</label>
                <input
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="e.g. 4.2 or 12500"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-yellow-400/60 text-sm"
                  inputMode="decimal"
                />
              </div>

              {/* Prefix / Suffix row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wide mb-1.5 block">Prefix</label>
                  <input
                    value={prefix}
                    onChange={e => setPrefix(e.target.value)}
                    placeholder="e.g. $"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-yellow-400/60 text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wide mb-1.5 block">Suffix</label>
                  <input
                    value={suffix}
                    onChange={e => setSuffix(e.target.value)}
                    placeholder="e.g. %  or x"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 outline-none focus:border-yellow-400/60 text-sm"
                  />
                </div>
              </div>

              {/* Preview */}
              {(label || value) && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">Preview</p>
                  <p className="text-white text-2xl font-bold tabular-nums">
                    {prefix}{value || '0'}{suffix}
                  </p>
                  <p className="text-white/50 text-xs mt-0.5">{label || 'Metric Label'}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!label.trim() || !value.trim()}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: 'white' }}
              >
                <Check className="w-4 h-4" />
                Add Metric
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// DO NOT modify Facebook CDN URLs - they are cryptographically signed.
// Stripping params like 'stp' invalidates the signature and causes 403/blank images.
// Images are now cached to permanent storage during data fetch, so URLs here
// are either already permanent (Supabase Storage) or valid short-term (fresh fetch).
function getFullResImageUrl(url: string): string {
  return url || '';
}
// Creative image component with expired-URL detection
// Facebook CDN returns tiny placeholder images when URLs expire instead of 404s,
// so onError never fires. This checks naturalWidth after load to catch those.
function CreativeImage({ imageUrl, originalUrl, adName, color, onClickFullRes }: {
  imageUrl: string;
  originalUrl: string;
  adName: string;
  color: string;
  onClickFullRes?: (url: string) => void;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'fallback' | 'failed'>('loading');
  const [src, setSrc] = useState(imageUrl);

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Expired Facebook CDN links often return a 1x1 or very small image
    if (img.naturalWidth < 10 || img.naturalHeight < 10) {
      if (status === 'loading' && originalUrl && originalUrl !== imageUrl) {
        setSrc(originalUrl);
        setStatus('fallback');
      } else {
        setStatus('failed');
      }
    } else {
      setStatus('loaded');
    }
  }, [status, originalUrl, imageUrl]);

  const handleError = useCallback(() => {
    if (status === 'loading' && originalUrl && originalUrl !== src) {
      setSrc(originalUrl);
      setStatus('fallback');
    } else {
      setStatus('failed');
    }
  }, [status, originalUrl, src]);

  if (!imageUrl || status === 'failed') {
    return (
      <div className="w-full h-32 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}20, ${color}05)` }}>
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8 text-white/20" />
          <span className="text-white/30 text-xs">{adName || 'Ad Creative'}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={adName}
      className="w-full h-56 object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-500"
      onClick={() => onClickFullRes?.(src)}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
    />
  );
}

// ---------- Types ----------

export interface CampaignRow {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface CreativeRow {
  adName: string;
  campaignName: string;
  imageUrl: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface DailyDataPoint {
  date: string;
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface PlatformGameplan {
  summary: string;
  budgetRecommendation: string;
  abTests: string[];
  nextSteps: string[];
  keyInsight: string;
}

export interface KeywordRow {
  keyword: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface EnhancedPlatformData {
  key: string;
  label: string;
  accountName?: string;
  platformKey: string;
  icon: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads?: number;
  purchases?: number;
  calls?: number;
  ctr: number;
  cpc: number;
  cpa: number;
  cpl?: number;
  costPerPurchase?: number;
  cpm: number;
  conversionRate?: number;
  topContent?: CreativeRow[];
  campaigns?: CampaignRow[];
  dailyData?: DailyDataPoint[];
  keywords?: KeywordRow[];
  gameplan?: PlatformGameplan;
  changes?: Record<string, number | null>;
  grade?: string;
}

interface EnhancedPlatformSectionProps {
  platform: EnhancedPlatformData;
  brandColor?: string;
  onScreenshotClick?: (url: string) => void;
  dateRange?: string;
  editKeyPrefix?: string; // e.g. "platform-google_ads_v1"
}

// Platform color configs
const platformColors: Record<string, string> = {
  google_ads: '#4285F4',
  meta_ads: '#1877F2',
  tiktok_ads: '#000000',
  bing_ads: '#00809D',
  linkedin_ads: '#0A66C2',
};

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  search: BarChart3,
  megaphone: Target,
  video: Eye,
  briefcase: Users,
  'bar-chart': BarChart3,
};

export const EnhancedPlatformSection = ({
  platform,
  brandColor,
  onScreenshotClick,
  dateRange,
  editKeyPrefix,
}: EnhancedPlatformSectionProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'creatives' | 'keywords' | 'gameplan'>('overview');
  const color = brandColor || platformColors[platform.platformKey] || '#6366f1';
  const IconComponent = PLATFORM_ICONS[platform.icon] || BarChart3;
  const ekp = editKeyPrefix || `platform-${platform.key}`;
  const editCtx = useContext(DeckEditContext);
  const isEditMode = editCtx?.isEditMode ?? false;

  // Funnel data — use breakdown if available
  const hasBreakdown = (platform.leads || 0) > 0 || (platform.purchases || 0) > 0 || (platform.calls || 0) > 0;
  const funnelData = [
    { name: 'Impressions', value: platform.impressions, fill: `${color}` },
    { name: 'Clicks', value: platform.clicks, fill: `${color}cc` },
    ...(hasBreakdown ? [
      ...(platform.leads ? [{ name: 'Leads', value: platform.leads, fill: `${color}aa` }] : []),
      ...(platform.purchases ? [{ name: 'Purchases', value: platform.purchases, fill: `${color}88` }] : []),
      ...(platform.calls ? [{ name: 'Calls', value: platform.calls, fill: `${color}77` }] : []),
    ] : [
      { name: 'Conversions', value: platform.conversions, fill: `${color}99` },
    ]),
  ].filter(d => d.value > 0);

  // Primary metrics — split conversions into breakdown when available
  const conversionMetrics = hasBreakdown ? [
    { label: 'Total Conv.', value: platform.conversions, icon: Users, change: platform.changes?.conversions, editKey: `${ekp}.metric.conversions` },
    ...(platform.leads ? [{ label: 'Leads', value: platform.leads, icon: Users, change: platform.changes?.leads, editKey: `${ekp}.metric.leads` }] : []),
    ...(platform.purchases ? [{ label: 'Purchases', value: platform.purchases, icon: Target, change: platform.changes?.purchases, editKey: `${ekp}.metric.purchases` }] : []),
    ...(platform.calls ? [{ label: 'Calls', value: platform.calls, icon: Users, editKey: `${ekp}.metric.calls` }] : []),
    ...(platform.cpl ? [{ label: 'CPL', value: platform.cpl, prefix: '$', decimals: 2, icon: DollarSign, editKey: `${ekp}.metric.cpl` }] : []),
    ...(platform.costPerPurchase ? [{ label: 'Cost/Purchase', value: platform.costPerPurchase, prefix: '$', decimals: 2, icon: DollarSign, editKey: `${ekp}.metric.costPerPurchase` }] : []),
  ] : [
    { label: 'Conversions', value: platform.conversions, icon: Users, change: platform.changes?.conversions, editKey: `${ekp}.metric.conversions` },
  ];

  const allMetrics = [
    { label: 'Spend', value: platform.spend, prefix: '$', icon: DollarSign, change: platform.changes?.spend, editKey: `${ekp}.metric.spend` },
    { label: 'Clicks', value: platform.clicks, icon: MousePointer, change: platform.changes?.clicks, editKey: `${ekp}.metric.clicks` },
    ...conversionMetrics,
    { label: 'CTR', value: platform.ctr, suffix: '%', decimals: 2, icon: TrendingUp, change: platform.changes?.ctr, editKey: `${ekp}.metric.ctr` },
    { label: 'CPC', value: platform.cpc, prefix: '$', decimals: 2, icon: DollarSign, change: platform.changes?.cpc, editKey: `${ekp}.metric.cpc` },
    { label: 'CPA', value: platform.cpa, prefix: '$', decimals: 2, icon: Target, change: platform.changes?.cpa, editKey: `${ekp}.metric.cpa` },
    { label: 'CPM', value: platform.cpm || 0, prefix: '$', decimals: 2, icon: Eye, change: (platform.changes as any)?.cpm, editKey: `${ekp}.metric.cpm` },
    { label: 'Impressions', value: platform.impressions, icon: Eye, change: platform.changes?.impressions, editKey: `${ekp}.metric.impressions` },
  ];
  const metrics = isEditMode ? allMetrics : allMetrics.filter(m => m.value > 0);

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    ...(platform.campaigns && platform.campaigns.length > 0 ? [{ key: 'campaigns' as const, label: `Campaigns (${platform.campaigns.length})` }] : []),
    ...(platform.topContent && platform.topContent.length > 0 ? [{ key: 'creatives' as const, label: `Creatives (${platform.topContent.length})` }] : []),
    ...(platform.keywords && platform.keywords.length > 0 ? [{ key: 'keywords' as const, label: `Keywords (${platform.keywords.length})` }] : []),
    ...(platform.gameplan ? [{ key: 'gameplan' as const, label: '🎯 Gameplan' }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className="relative p-4 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${color}30, ${color}10)`,
              boxShadow: `0 0 40px ${color}20`,
            }}
          >
            <IconComponent className="h-8 w-8" style={{ color }} />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              <InlineEdit
                value={platform.label}
                editKey={`${ekp}.label`}
                as="span"
                className="text-3xl md:text-4xl font-bold text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              />
            </h2>
            {platform.accountName && (
              <p className="text-white/40 text-sm mt-1">{platform.accountName}{dateRange ? ` · ${dateRange}` : ''}</p>
            )}
            {!platform.accountName && dateRange && (
              <p className="text-white/40 text-sm mt-1">{dateRange}</p>
            )}
            <div className="h-1 w-24 mt-2 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />
          </div>
        </div>
        {/* Grade removed */}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "text-white shadow-lg"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            )}
            style={activeTab === tab.key ? { background: `linear-gradient(135deg, ${color}, ${color}cc)` } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Metrics Grid with PoP changes */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {metrics.map((m, idx) => (
              <div key={idx} className="relative">
                <DeckMetricCard
                  label={m.label}
                  value={m.value}
                  prefix={'prefix' in m ? m.prefix : undefined}
                  suffix={'suffix' in m ? m.suffix : undefined}
                  decimals={m.decimals}
                  icon={m.icon}
                  color={color}
                  size="md"
                  editKey={m.editKey}
                />
                {/* Change badge */}
                {m.change !== undefined && m.change !== null && (
                  <div className={cn(
                    "absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full",
                    m.change >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {m.change >= 0 ? '+' : ''}{m.change.toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
            {/* Custom metrics + Add button (Edit Mode only) */}
            <AddMetricButton ekp={ekp} color={color} />
          </div>

          {/* Section image — editable in Edit Mode, hidden in view mode unless override exists */}
          {(isEditMode || editCtx?.overrides?.[`${ekp}.sectionImage`]) && (
            <EditableImage
              editKey={`${ekp}.sectionImage`}
              src={editCtx?.overrides?.[`${ekp}.sectionImage`]}
              alt={`${platform.label} section image`}
              placeholderLabel={`Add ${platform.label} Image`}
              wrapperClassName="w-full rounded-2xl overflow-hidden"
              className="w-full max-h-[420px] object-contain rounded-2xl"
            />
          )}

          {/* Funnel + Trend Charts side by side */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            {funnelData.length >= 2 && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
                <div className="space-y-3">
                  {funnelData.map((stage, idx) => {
                    const maxVal = funnelData[0].value;
                    const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
                    const dropOff = idx > 0 && funnelData[idx - 1].value > 0
                      ? ((1 - stage.value / funnelData[idx - 1].value) * 100).toFixed(1)
                      : null;
                    return (
                      <div key={stage.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white/80">{stage.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{stage.value.toLocaleString()}</span>
                            {dropOff && (
                              <span className="text-red-400/80 text-xs">-{dropOff}%</span>
                            )}
                          </div>
                        </div>
                        <div className="h-8 bg-white/5 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all duration-1000"
                            style={{ width: `${pct}%`, background: stage.fill, opacity: 1 - idx * 0.15 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {/* Conversion rate callout */}
                  {platform.clicks > 0 && platform.conversions > 0 && (
                    <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5 text-center">
                      <span className="text-white/50 text-xs">Click-to-Conversion Rate</span>
                      <p className="text-2xl font-bold text-white">
                        {((platform.conversions / platform.clicks) * 100).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Daily Spend Trend */}
            {platform.dailyData && platform.dailyData.length > 1 && (
              <DeckTrendChart
                title="Daily Spend Trend"
                data={platform.dailyData.map(d => ({ date: d.date, label: d.label, value: d.spend }))}
                color={color}
                valuePrefix="$"
                height={240}
              />
            )}
          </div>

          {/* Impressions + Clicks + Conversions Trend Charts */}
          {platform.dailyData && platform.dailyData.length > 1 && (
            <div className="grid lg:grid-cols-3 gap-6">
              <DeckTrendChart
                title="Impressions Over Time"
                data={platform.dailyData.map(d => ({ date: d.date, label: d.label, value: d.impressions }))}
                color="#8B5CF6"
                height={200}
              />
              <DeckTrendChart
                title="Clicks Over Time"
                data={platform.dailyData.map(d => ({ date: d.date, label: d.label, value: d.clicks }))}
                color="#F59E0B"
                height={200}
              />
              {hasBreakdown ? (
                <>
                  {(platform.leads || 0) > 0 && (
                    <DeckTrendChart
                      title="Leads Over Time"
                      data={platform.dailyData!.map(d => ({ date: d.date, label: d.label, value: (d as any).leads || 0 }))}
                      color="#10B981"
                      height={200}
                    />
                  )}
                  {(platform.purchases || 0) > 0 && (
                    <DeckTrendChart
                      title="Purchases Over Time"
                      data={platform.dailyData!.map(d => ({ date: d.date, label: d.label, value: (d as any).purchases || 0 }))}
                      color="#F59E0B"
                      height={200}
                    />
                  )}
                </>
              ) : (
                <DeckTrendChart
                  title="Conversions Over Time"
                  data={platform.dailyData!.map(d => ({ date: d.date, label: d.label, value: d.conversions }))}
                  color="#10B981"
                  height={200}
                />
              )}
            </div>
          )}

          {/* Period Comparison Bar Chart */}
          {platform.changes && Object.values(platform.changes).some(v => v !== null) && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Period-over-Period Changes</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(platform.changes)
                  .filter(([_, v]) => v !== null)
                  .map(([key, value]) => {
                    const isPositive = (value as number) >= 0;
                    // For CPC/CPA, lower is better
                    const isCostMetric = key === 'cpc' || key === 'cpa';
                    const isGood = isCostMetric ? !isPositive : isPositive;
                    return (
                      <div key={key} className="text-center p-3 rounded-xl bg-white/5">
                        <div className="text-white/50 text-xs uppercase tracking-wider mb-1">{key}</div>
                        <div className={cn(
                          "text-xl font-bold flex items-center justify-center gap-1",
                          isGood ? "text-emerald-400" : "text-red-400"
                        )}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {isPositive ? '+' : ''}{(value as number).toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CAMPAIGNS TAB ===== */}
      {activeTab === 'campaigns' && platform.campaigns && (
        <div className="space-y-4">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/60 font-medium p-4">Campaign</th>
                    <th className="text-right text-white/60 font-medium p-4">Spend</th>
                    <th className="text-right text-white/60 font-medium p-4">Clicks</th>
                    {hasBreakdown ? (
                      <>
                        <th className="text-right text-white/60 font-medium p-4">Leads</th>
                        <th className="text-right text-white/60 font-medium p-4">Purchases</th>
                      </>
                    ) : (
                      <th className="text-right text-white/60 font-medium p-4">Conv.</th>
                    )}
                    <th className="text-right text-white/60 font-medium p-4">CTR</th>
                    <th className="text-right text-white/60 font-medium p-4">CPC</th>
                    <th className="text-right text-white/60 font-medium p-4">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {platform.campaigns.sort((a, b) => b.spend - a.spend).map((campaign, idx) => {
                    const c = campaign as any;
                    return (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="text-white font-medium max-w-[220px] truncate">{campaign.name}</div>
                      </td>
                      <td className="text-right text-white/80 p-4">${campaign.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="text-right text-white/80 p-4">{campaign.clicks.toLocaleString()}</td>
                      {hasBreakdown ? (
                        <>
                          <td className="text-right p-4">
                            <span className={cn("font-semibold", (c.leads || 0) > 0 ? "text-emerald-400" : "text-white/40")}>
                              {c.leads || 0}
                            </span>
                          </td>
                          <td className="text-right p-4">
                            <span className={cn("font-semibold", (c.purchases || 0) > 0 ? "text-amber-400" : "text-white/40")}>
                              {c.purchases || 0}
                            </span>
                          </td>
                        </>
                      ) : (
                        <td className="text-right p-4">
                          <span className={cn("font-semibold", campaign.conversions > 0 ? "text-emerald-400" : "text-white/40")}>
                            {campaign.conversions}
                          </span>
                        </td>
                      )}
                      <td className="text-right text-white/80 p-4">{campaign.ctr.toFixed(2)}%</td>
                      <td className="text-right text-white/80 p-4">${campaign.cpc.toFixed(2)}</td>
                      <td className="text-right p-4">
                        <span className={cn(
                          "font-semibold",
                          campaign.cpa > 0 && campaign.cpa < 50 ? "text-emerald-400" : campaign.cpa > 100 ? "text-red-400" : "text-white/80"
                        )}>
                          {campaign.cpa > 0 ? `$${campaign.cpa.toFixed(2)}` : '—'}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Campaign spend distribution chart */}
          {platform.campaigns.length > 1 && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Spend by Campaign</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platform.campaigns.sort((a, b) => b.spend - a.spend).slice(0, 8)} layout="vertical">
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Spend']}
                      contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      labelStyle={{ color: 'white' }}
                    />
                    <Bar dataKey="spend" radius={[0, 6, 6, 0]} fill={color}>
                      {platform.campaigns.sort((a, b) => b.spend - a.spend).slice(0, 8).map((_, index) => (
                        <Cell key={index} fill={color} opacity={1 - index * 0.08} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Clicks + Conversions by Campaign */}
          {platform.campaigns.length > 1 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Clicks by Campaign</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platform.campaigns.sort((a, b) => b.clicks - a.clicks).slice(0, 8)} layout="vertical">
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), 'Clicks']}
                        contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: 'white' }}
                      />
                      <Bar dataKey="clicks" radius={[0, 6, 6, 0]} fill="#F59E0B">
                        {platform.campaigns.sort((a, b) => b.clicks - a.clicks).slice(0, 8).map((_, index) => (
                          <Cell key={index} fill="#F59E0B" opacity={1 - index * 0.08} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Conversions by Campaign</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platform.campaigns.sort((a, b) => b.conversions - a.conversions).slice(0, 8)} layout="vertical">
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), 'Conversions']}
                        contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: 'white' }}
                      />
                      <Bar dataKey="conversions" radius={[0, 6, 6, 0]} fill="#10B981">
                        {platform.campaigns.sort((a, b) => b.conversions - a.conversions).slice(0, 8).map((_, index) => (
                          <Cell key={index} fill="#10B981" opacity={1 - index * 0.08} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== KEYWORDS TAB ===== */}
      {activeTab === 'keywords' && platform.keywords && (
        <div className="space-y-6">
          {/* Keyword Performance Table */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/60 font-medium p-4">#</th>
                    <th className="text-left text-white/60 font-medium p-4">Search Keyword</th>
                    <th className="text-right text-white/60 font-medium p-4">Impressions</th>
                    <th className="text-right text-white/60 font-medium p-4">Clicks</th>
                    <th className="text-right text-white/60 font-medium p-4">CTR</th>
                    <th className="text-right text-white/60 font-medium p-4">Conv.</th>
                    <th className="text-right text-white/60 font-medium p-4">Avg. CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {platform.keywords.map((kw, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-white/40">{idx + 1}.</td>
                      <td className="p-4 text-white font-medium">{kw.keyword}</td>
                      <td className="text-right text-white/80 p-4">{kw.impressions.toLocaleString()}</td>
                      <td className="text-right text-white/80 p-4">{kw.clicks.toLocaleString()}</td>
                      <td className="text-right text-white/80 p-4">{kw.ctr.toFixed(2)}%</td>
                      <td className="text-right p-4">
                        <span className={cn("font-semibold", kw.conversions > 0 ? "text-emerald-400" : "text-white/40")}>
                          {kw.conversions}
                        </span>
                      </td>
                      <td className="text-right text-white/80 p-4">${kw.cpc.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Keyword Impressions Chart */}
          {platform.keywords.length > 1 && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Keyword Impressions</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platform.keywords.slice(0, 10)} layout="vertical">
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="keyword" axisLine={false} tickLine={false} width={180} tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Impressions']}
                      contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      labelStyle={{ color: 'white' }}
                    />
                    <Bar dataKey="impressions" radius={[0, 6, 6, 0]} fill={color}>
                      {platform.keywords.slice(0, 10).map((_, index) => (
                        <Cell key={index} fill={color} opacity={1 - index * 0.06} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Keyword Clicks + CTR side by side */}
          {platform.keywords.length > 1 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Clicks by Keyword</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platform.keywords.sort((a, b) => b.clicks - a.clicks).slice(0, 8)} layout="vertical">
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="keyword" axisLine={false} tickLine={false} width={160} tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), 'Clicks']}
                        contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: 'white' }}
                      />
                      <Bar dataKey="clicks" radius={[0, 6, 6, 0]} fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">CTR by Keyword</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platform.keywords.sort((a, b) => b.ctr - a.ctr).slice(0, 8)} layout="vertical">
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                      <YAxis type="category" dataKey="keyword" axisLine={false} tickLine={false} width={160} tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'CTR']}
                        contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: 'white' }}
                      />
                      <Bar dataKey="ctr" radius={[0, 6, 6, 0]} fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CREATIVES TAB ===== */}
      {activeTab === 'creatives' && platform.topContent && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {platform.topContent.map((creative, ci) => {
            const fullResUrl = creative.imageUrl ? getFullResImageUrl(creative.imageUrl) : '';
            return (
              <div key={ci} className="deck-glass-card overflow-hidden group hover:border-white/20 transition-all">
                <div className="relative">
                  <CreativeImage
                    imageUrl={fullResUrl}
                    originalUrl={creative.imageUrl || ''}
                    adName={creative.adName}
                    color={color}
                    onClickFullRes={onScreenshotClick}
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-bold" style={{ backgroundColor: `${color}cc`, color: 'white' }}>
                    #{ci + 1}
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-white font-semibold text-sm truncate mb-1">{creative.adName}</p>
                  <p className="text-white/40 text-xs truncate mb-4">{creative.campaignName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <span className="text-white/50 text-xs block">Impr.</span>
                      <span className="text-white font-bold text-sm">{creative.impressions.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <span className="text-white/50 text-xs block">Clicks</span>
                      <span className="text-white font-bold text-sm">{creative.clicks.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <span className="text-white/50 text-xs block">CTR</span>
                      <span className="text-white font-bold text-sm">{creative.ctr.toFixed(2)}%</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <span className="text-white/50 text-xs block">CPC</span>
                      <span className="text-white font-bold text-sm">${creative.cpc.toFixed(2)}</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <span className="text-white/50 text-xs block">Spend</span>
                      <span className="text-white font-bold text-sm">${creative.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <span className="text-white/50 text-xs block">Conv.</span>
                      <span className={cn("font-bold text-sm", creative.conversions > 0 ? "text-emerald-400" : "text-white/40")}>
                        {creative.conversions}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== GAMEPLAN TAB ===== */}
      {activeTab === 'gameplan' && platform.gameplan && (
        <div className="space-y-6">
          {/* Key Insight Hero */}
          <div
            className="rounded-2xl p-8 border"
            style={{ borderColor: `${color}40`, background: `linear-gradient(135deg, ${color}15, transparent)` }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${color}20` }}>
                <Lightbulb className="h-6 w-6" style={{ color }} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-xl mb-2">Key Insight</h3>
                <InlineEdit
                  value={platform.gameplan.keyInsight}
                  editKey={`${ekp}.gameplan.keyInsight`}
                  as="p"
                  multiline
                  className="text-white/80 text-lg leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Strategy Summary */}
          <div className="deck-glass-card p-6">
            <h3 className="text-white font-semibold text-lg mb-3">Strategy Summary</h3>
            <InlineEdit
              value={platform.gameplan.summary}
              editKey={`${ekp}.gameplan.summary`}
              as="p"
              multiline
              className="text-white/70 leading-relaxed"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Budget Recommendation */}
            <div className="deck-glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5" style={{ color }} />
                <h3 className="text-white font-semibold">Budget Recommendation</h3>
              </div>
              <InlineEdit
                value={platform.gameplan.budgetRecommendation}
                editKey={`${ekp}.gameplan.budgetRecommendation`}
                as="p"
                multiline
                className="text-white/70"
              />
            </div>

            {/* A/B Testing Roadmap */}
            <div className="deck-glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5" style={{ color }} />
                <h3 className="text-white font-semibold">A/B Testing Roadmap</h3>
              </div>
              <ul className="space-y-2">
                {platform.gameplan.abTests.map((test, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-white/70">
                    <span className="text-xs font-bold mt-1 px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${color}30`, color }}>
                      T{idx + 1}
                    </span>
                    <InlineEdit
                      value={test}
                      editKey={`${ekp}.gameplan.abTests.${idx}`}
                      as="span"
                      className="text-white/70"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Next Steps */}
          <div className="deck-glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="h-5 w-5" style={{ color }} />
              <h3 className="text-white font-semibold">Next Steps</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {platform.gameplan.nextSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: `${color}20`, color }}>
                    {idx + 1}
                  </div>
                  <InlineEdit
                    value={step}
                    editKey={`${ekp}.gameplan.nextSteps.${idx}`}
                    as="span"
                    className="text-white/80"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

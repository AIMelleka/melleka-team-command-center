import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, Pencil, Check, X } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LucideIcon } from 'lucide-react';
import { DeckEditContext } from './DeckEditContext';

type PerformanceLevel = 'excellent' | 'good' | 'average' | 'needs_attention';

export interface DeckMetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: LucideIcon;
  color?: string;
  trend?: number;
  benchmark?: {
    value: number;
    label: string;
  };
  sparklineData?: number[];
  tooltip?: string;
  size?: 'sm' | 'md' | 'lg';
  performanceLevel?: PerformanceLevel;
  animate?: boolean;
  /** If provided, enables inline editing in Edit Mode */
  editKey?: string;
}

const performanceColors: Record<PerformanceLevel, { bg: string; text: string; border: string }> = {
  excellent: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  good: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  average: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  needs_attention: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

// ─── Inline editable metric value ────────────────────────────────────────────
function EditableMetricValue({
  editKey,
  value,
  prefix,
  suffix,
  decimals,
  valueSizeClass,
}: {
  editKey: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  valueSizeClass: string;
}) {
  const ctx = useContext(DeckEditContext);
  const isEditMode = ctx?.isEditMode ?? false;
  const overrides = ctx?.overrides ?? {};
  const updateOverride = ctx?.updateOverride ?? (async () => {});
  const isSaving = ctx?.isSaving ?? false;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const storedRaw = overrides[editKey];
  const displayValue = storedRaw !== undefined
    ? storedRaw
    : (decimals !== undefined ? value.toFixed(decimals) : String(Math.round(value)));

  useEffect(() => {
    if (editing) {
      setDraft(displayValue);
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
    }
  }, [editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed !== '') await updateOverride(editKey, trimmed);
    setEditing(false);
  }, [draft, editKey, updateOverride]);

  const cancel = () => setEditing(false);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  };

  const isEdited = editKey in overrides;

  if (!isEditMode) {
    return (
      <div className={cn('font-bold text-white tabular-nums mb-3', valueSizeClass)}>
        {prefix}<AnimatedCounter value={displayValue} />{suffix}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-white/50 text-sm">{prefix}</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            className={cn(
              'bg-black/60 border border-yellow-400/80 rounded px-2 py-0.5 outline-none',
              'focus:border-yellow-400 text-white tabular-nums font-bold w-full',
              valueSizeClass
            )}
            style={{ maxWidth: '160px' }}
            inputMode="decimal"
          />
          <span className="text-white/50 text-sm">{suffix}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={save}
            disabled={isSaving}
            className="p-1 rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
            title="Save (Enter)"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={cancel}
            className="p-1 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group/val relative font-bold text-white tabular-nums mb-3 cursor-text inline-flex items-baseline gap-1',
        valueSizeClass,
        isEdited && 'outline outline-2 outline-yellow-400/50 rounded px-1'
      )}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {prefix}{displayValue}{suffix}
      <Pencil className="inline-block ml-1 w-3 h-3 text-yellow-400 opacity-0 group-hover/val:opacity-100 transition-opacity align-middle self-center" />
    </div>
  );
}

export const DeckMetricCard = ({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals,
  icon: IconComponent,
  color,
  trend,
  benchmark,
  sparklineData,
  tooltip,
  size = 'md',
  performanceLevel,
  animate = true,
  editKey,
}: DeckMetricCardProps) => {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const valueSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-5xl',
  };

  const perf = performanceLevel ? performanceColors[performanceLevel] : null;

  const benchmarkStatus = benchmark
    ? value >= benchmark.value ? 'above' : 'below'
    : null;

  const displayValue = decimals !== undefined ? value.toFixed(decimals) : String(Math.round(value));

  return (
    <TooltipProvider>
      <div
        className={cn(
          'group relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10',
          'hover:border-white/20 transition-all duration-300 hover:transform hover:scale-[1.02]',
          sizeClasses[size],
          perf && perf.border
        )}
      >
        {/* Performance indicator bar */}
        {perf && (
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-1 rounded-t-2xl',
              performanceLevel === 'excellent' && 'bg-gradient-to-r from-emerald-500 to-emerald-400',
              performanceLevel === 'good' && 'bg-gradient-to-r from-blue-500 to-blue-400',
              performanceLevel === 'average' && 'bg-gradient-to-r from-amber-500 to-amber-400',
              performanceLevel === 'needs_attention' && 'bg-gradient-to-r from-red-500 to-red-400'
            )}
          />
        )}

        {/* Top row: Icon and tooltip */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: color ? `${color}20` : 'rgba(255,255,255,0.1)' }}
              >
                <IconComponent className="h-5 w-5" style={{ color: color || 'white' }} />
              </div>
            )}
            <span className="text-white/60 uppercase text-xs tracking-widest font-medium">
              {label}
            </span>
          </div>

          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-white/30 hover:text-white/60 transition-colors">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-[#1a1a2e] border-white/10 text-white max-w-xs"
              >
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Main value — editable when editKey is provided */}
        {editKey ? (
          <EditableMetricValue
            editKey={editKey}
            value={value}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            valueSizeClass={valueSizeClasses[size]}
          />
        ) : (
          <div className={cn('font-bold text-white tabular-nums mb-3', valueSizeClasses[size])}>
            {prefix}
            {animate ? (
              <AnimatedCounter value={displayValue} />
            ) : (
              displayValue
            )}
            {suffix}
          </div>
        )}

        {/* Bottom row: Trend and benchmark */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {trend !== undefined && (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                trend > 0 && 'bg-emerald-500/20 text-emerald-400',
                trend < 0 && 'bg-red-500/20 text-red-400',
                trend === 0 && 'bg-white/10 text-white/60'
              )}
            >
              {trend > 0 && <TrendingUp className="h-3 w-3" />}
              {trend < 0 && <TrendingDown className="h-3 w-3" />}
              {trend === 0 && <Minus className="h-3 w-3" />}
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </div>
          )}

          {benchmark && (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                benchmarkStatus === 'above' && 'bg-emerald-500/10 text-emerald-400/80',
                benchmarkStatus === 'below' && 'bg-amber-500/10 text-amber-400/80'
              )}
            >
              {benchmarkStatus === 'above' ? '↑' : '↓'} {benchmark.label}
            </div>
          )}
        </div>

        {/* Mini sparkline */}
        {sparklineData && sparklineData.length > 2 && (
          <div className="mt-4 h-8">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`sparkline-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color || '#6366f1'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color || '#6366f1'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={generateSparklinePath(sparklineData, true)}
                fill={`url(#sparkline-${label})`}
              />
              <path
                d={generateSparklinePath(sparklineData, false)}
                fill="none"
                stroke={color || '#6366f1'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Hover glow effect */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl"
          style={{
            background: color ? `${color}20` : 'rgba(99, 102, 241, 0.1)',
          }}
        />
      </div>
    </TooltipProvider>
  );
};

function generateSparklinePath(data: number[], closed: boolean): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * 100,
    y: 100 - ((value - min) / range) * 100,
  }));
  const pathData = points.reduce((path, point, index) =>
    index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`, '');
  return closed ? `${pathData} L 100 100 L 0 100 Z` : pathData;
}

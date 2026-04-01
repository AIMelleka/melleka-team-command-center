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
  excellent: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  good: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  average: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  needs_attention: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
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
      <div className={cn('font-bold text-[#1a1a1a] font-mono tabular-nums mb-1', valueSizeClass)}>
        {prefix}<AnimatedCounter value={displayValue} />{suffix}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mb-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[#6b7280] text-sm">{prefix}</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            className={cn(
              'bg-white border-2 border-yellow-400 rounded px-2 py-0.5 outline-none',
              'focus:border-yellow-500 text-[#1a1a1a] tabular-nums font-bold font-mono w-full',
              valueSizeClass
            )}
            style={{ maxWidth: '160px' }}
            inputMode="decimal"
          />
          <span className="text-[#6b7280] text-sm">{suffix}</span>
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
        'group/val relative font-bold text-[#1a1a1a] font-mono tabular-nums mb-1 cursor-text inline-flex items-baseline gap-1',
        valueSizeClass,
        isEdited && 'outline outline-2 outline-yellow-400/50 rounded px-1'
      )}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {prefix}{displayValue}{suffix}
      <Pencil className="inline-block ml-1 w-3 h-3 text-yellow-500 opacity-0 group-hover/val:opacity-100 transition-opacity align-middle self-center" />
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
    md: 'p-5',
    lg: 'p-6',
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl md:text-3xl',
    lg: 'text-3xl md:text-4xl',
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
          'deck-ref-stat-card group relative',
          sizeClasses[size],
          perf && perf.border
        )}
      >
        {/* Performance indicator bar */}
        {perf && (
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-1 rounded-t-xl',
              performanceLevel === 'excellent' && 'bg-gradient-to-r from-emerald-500 to-emerald-400',
              performanceLevel === 'good' && 'bg-gradient-to-r from-blue-500 to-blue-400',
              performanceLevel === 'average' && 'bg-gradient-to-r from-amber-500 to-amber-400',
              performanceLevel === 'needs_attention' && 'bg-gradient-to-r from-red-500 to-red-400'
            )}
          />
        )}

        {/* Top row: Icon and tooltip */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            {IconComponent && (
              <div
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: color ? `${color}15` : '#f3f4f6' }}
              >
                <IconComponent className="h-4 w-4" style={{ color: color || '#6b7280' }} />
              </div>
            )}
            <span className="stat-label">
              {label}
            </span>
          </div>

          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-white border border-[#e5e5e0] text-[#1a1a1a] max-w-xs shadow-lg"
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
          <div className={cn('stat-value mb-1', valueSizeClasses[size])}>
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
        <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
          {trend !== undefined && (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                trend > 0 && 'deck-ref-trend-up',
                trend < 0 && 'deck-ref-trend-down',
                trend === 0 && 'bg-gray-100 text-gray-500'
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
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                benchmarkStatus === 'above' && 'bg-emerald-50 text-emerald-600',
                benchmarkStatus === 'below' && 'bg-amber-50 text-amber-600'
              )}
            >
              {benchmarkStatus === 'above' ? '↑' : '↓'} {benchmark.label}
            </div>
          )}
        </div>

        {/* Mini sparkline */}
        {sparklineData && sparklineData.length > 2 && (
          <div className="mt-3 h-8">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`sparkline-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color || '#6C3FA0'} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={color || '#6C3FA0'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={generateSparklinePath(sparklineData, true)}
                fill={`url(#sparkline-${label})`}
              />
              <path
                d={generateSparklinePath(sparklineData, false)}
                fill="none"
                stroke={color || '#6C3FA0'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
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

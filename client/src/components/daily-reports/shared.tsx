import { TrendingUp, TrendingDown } from 'lucide-react';
import type { CplCpaAnalysis } from '@/types/dailyReports';

// Health dot
export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-400',
    healthy: 'bg-emerald-500',
    good: 'bg-emerald-500',
    excellent: 'bg-emerald-500',
    unknown: 'bg-zinc-500',
  };
  return <span className={`inline-block h-3 w-3 rounded-full ${colors[status] || colors.unknown}`} />;
}

// Metric pill badge
export function MetricPill({ label, value, variant }: { label: string; value: string; variant?: 'danger' | 'warn' | 'good' | 'neutral' }) {
  const styles: Record<string, string> = {
    danger: 'bg-red-500/15 text-red-400 border-red-500/20',
    warn: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    good: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[variant || 'neutral']}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

// Trend arrow with percentage
export function TrendArrow({ value, previous, invert, formatFn }: { value: number; previous?: number; invert?: boolean; formatFn?: (n: number) => string }) {
  const safeVal = value ?? 0;
  const display = formatFn ? formatFn(safeVal) : safeVal.toLocaleString();
  if (!previous || previous === 0) return <span className="text-sm font-semibold">{safeVal > 0 ? display : '—'}</span>;
  const pct = ((safeVal - previous) / previous) * 100;
  const isPositive = invert ? pct < 0 : pct > 0;
  const ArrowIcon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-sm font-semibold">{display}</span>
      {ArrowIcon && (
        <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          <ArrowIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{Math.abs(pct).toFixed(0)}%</span>
        </span>
      )}
    </span>
  );
}

// Section header
export function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4 pt-2">
      {icon && <span className="text-primary">{icon}</span>}
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
  );
}

// Convert health string to letter grade
export function computeGrade(health: string | undefined | null): { letter: string; color: string; bgColor: string } {
  switch (health) {
    case 'excellent':
      return { letter: 'A', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'good':
      return { letter: 'B', color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/30' };
    case 'warning':
      return { letter: 'C', color: 'text-amber-500', bgColor: 'bg-amber-500/10 border-amber-500/30' };
    case 'critical':
      return { letter: 'D', color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/30' };
    default:
      return { letter: '?', color: 'text-muted-foreground', bgColor: 'bg-muted border-border' };
  }
}

// Compute overall health from a report's data
export function getReportHealth(cplCpa: CplCpaAnalysis | null, platforms: any[]): string {
  if (cplCpa?.overallHealth) return cplCpa.overallHealth;
  // Fallback: derive from platform health statuses
  if (platforms.length === 0) return 'unknown';
  const statuses = platforms.map(p => p.health).filter(Boolean);
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  if (statuses.length > 0) return 'good';
  return 'unknown';
}

// Parse currency string to number
export function parseCurrency(val: string | number | undefined | null): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.replace(/[^0-9.-]/g, '') || '0');
}

// Format currency
export function fmtCurrency(n: number | null | undefined): string {
  const v = n ?? 0;
  if (!Number.isFinite(v) || v === 0) return '$0';
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

// Format number
export function fmtNumber(n: number | null | undefined): string {
  const v = n ?? 0;
  if (!Number.isFinite(v)) return '0';
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

// Slugify client name for anchor IDs
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

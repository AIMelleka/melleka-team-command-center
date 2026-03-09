import { TrendingUp, TrendingDown, Minus, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { Platform } from '@/types/dailyReports';

interface Props {
  platforms: Platform[];
}

function healthBadge(health: string) {
  const map: Record<string, { label: string; className: string }> = {
    good: { label: 'Healthy', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
    warning: { label: 'Warning', className: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
    critical: { label: 'Critical', className: 'bg-red-500/10 text-red-500 border-red-500/30' },
  };
  const cfg = map[health] || { label: health, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>;
}

function trendIcon(trend: string) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function benchmarkBadge(vs: string | undefined) {
  if (!vs) return null;
  const map: Record<string, { label: string; className: string }> = {
    above: { label: 'Above Benchmark', className: 'text-emerald-500' },
    at: { label: 'At Benchmark', className: 'text-amber-500' },
    below: { label: 'Below Benchmark', className: 'text-red-500' },
  };
  const cfg = map[vs] || { label: vs, className: 'text-muted-foreground' };
  return <span className={`text-[10px] font-medium ${cfg.className}`}>{cfg.label}</span>;
}

function MetricCell({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function PlatformBreakdownSection({ platforms }: Props) {
  if (!platforms || platforms.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Platform Performance" icon={<Monitor className="h-4 w-4" />} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {platforms.map((p, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{p.name}</span>
                {trendIcon(p.trend)}
              </div>
              <div className="flex items-center gap-2">
                {healthBadge(p.health)}
                {benchmarkBadge(p.vsBenchmark)}
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <MetricCell label="Spend" value={p.spend} />
              <MetricCell label="Impressions" value={p.impressions} />
              <MetricCell label="Clicks" value={p.clicks} />
              <MetricCell label="CTR" value={p.ctr} />
              <MetricCell label="CPC" value={p.cpc} />
              <MetricCell label="Conversions" value={p.conversions} />
              <MetricCell label="Leads" value={p.leads} />
              <MetricCell label="CPL" value={p.costPerLead} />
              <MetricCell label="CPA" value={p.costPerConversion} />
              <MetricCell label="ROAS" value={p.roas} />
              <MetricCell label="Conv Rate" value={p.conversionRate} />
              <MetricCell label="Quality" value={p.qualityScore} />
            </div>

            {/* Benchmark indicators */}
            {(p.cplVsBenchmark || p.cpaVsBenchmark) && (
              <div className="flex items-center gap-4 pt-1 border-t border-border/30">
                {p.cplVsBenchmark && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">CPL:</span>
                    {benchmarkBadge(p.cplVsBenchmark)}
                  </div>
                )}
                {p.cpaVsBenchmark && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">CPA:</span>
                    {benchmarkBadge(p.cpaVsBenchmark)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

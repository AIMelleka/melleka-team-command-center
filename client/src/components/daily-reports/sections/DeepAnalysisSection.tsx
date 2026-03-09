import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { DeepAnalysis } from '@/types/dailyReports';

interface Props {
  analysis: DeepAnalysis | null;
  isLoading: boolean;
}

const trendIcons: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  increasing: { icon: TrendingUp, color: 'text-emerald-500', label: 'Increasing' },
  improving: { icon: TrendingUp, color: 'text-emerald-500', label: 'Improving' },
  decreasing: { icon: TrendingDown, color: 'text-red-500', label: 'Decreasing' },
  declining: { icon: TrendingDown, color: 'text-red-500', label: 'Declining' },
  stable: { icon: Minus, color: 'text-muted-foreground', label: 'Stable' },
};

const confidenceColors: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  low: 'bg-zinc-500/10 text-muted-foreground border-border',
};

const severityColors: Record<string, string> = {
  high: 'border-red-500/30 bg-red-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-border bg-muted/30',
};

function TrendBadge({ trend }: { trend: string }) {
  const cfg = trendIcons[trend] || trendIcons.stable;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{cfg.label}</span>
    </span>
  );
}

export function DeepAnalysisSection({ analysis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <SectionHeader title="AI Deep Analysis" icon={<Brain className="h-4 w-4" />} />
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Running deep analysis across date range...</span>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      <SectionHeader title="AI Deep Analysis" icon={<Brain className="h-4 w-4" />} />

      {/* Trend Summary */}
      {analysis.trendSummary && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm leading-relaxed text-foreground">{analysis.trendSummary}</p>
        </div>
      )}

      {/* Period Comparison Grid */}
      {analysis.periodComparison && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Spend</p>
            <TrendBadge trend={analysis.periodComparison.spendTrend} />
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Conversions</p>
            <TrendBadge trend={analysis.periodComparison.conversionTrend} />
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">CPL</p>
            <TrendBadge trend={analysis.periodComparison.cplTrend} />
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">CPA</p>
            <TrendBadge trend={analysis.periodComparison.cpaTrend} />
          </div>
          {analysis.periodComparison.bestDay && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-500 mb-1">Best Day</p>
              <p className="text-xs text-foreground font-medium truncate">{analysis.periodComparison.bestDay}</p>
            </div>
          )}
          {analysis.periodComparison.worstDay && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-red-500 mb-1">Worst Day</p>
              <p className="text-xs text-foreground font-medium truncate">{analysis.periodComparison.worstDay}</p>
            </div>
          )}
        </div>
      )}

      {/* Patterns */}
      {analysis.patterns && analysis.patterns.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Detected Patterns</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analysis.patterns.map((p, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{p.pattern}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${confidenceColors[p.confidence] || ''}`}>
                    {p.confidence}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                {p.affectedMetrics && p.affectedMetrics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.affectedMetrics.map((m, j) => (
                      <Badge key={j} variant="outline" className="text-[9px]">{m}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomalies */}
      {analysis.anomalies && analysis.anomalies.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Anomalies Detected</p>
          <div className="space-y-2">
            {analysis.anomalies.map((a, i) => (
              <div key={i} className={`rounded-lg border p-3 ${severityColors[a.severity] || ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`h-3.5 w-3.5 ${a.severity === 'high' ? 'text-red-500' : a.severity === 'medium' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium text-foreground">{a.metric} on {a.date}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{a.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expected: {a.expected} | Actual: {a.actual}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.possibleCause}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Outlook */}
      {analysis.strategicOutlook && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Strategic Outlook</p>
          <p className="text-sm leading-relaxed text-foreground">{analysis.strategicOutlook}</p>
        </div>
      )}
    </div>
  );
}

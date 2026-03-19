import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ClientDailyReport } from '@/types/dailyReports';
import { fmtCurrency, fmtNumber } from './shared';
import { ScoreRing } from './ScoreRing';
import { computeReportScore, aggregateKpis, type ReportScore, type AggregatedKpis } from './scoring';

interface Props {
  report: ClientDailyReport;
  onClick: () => void;
}

const trendIcons = {
  up: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  down: <TrendingDown className="h-3 w-3 text-red-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
};

const tierBadgeStyles: Record<string, string> = {
  excellent: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  good: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  critical: 'bg-red-500/10 text-red-500 border-red-500/30',
};

export function ClientOverviewCard({ report, onClick }: Props) {
  const { score, tier }: ReportScore = computeReportScore(report);
  const kpis: AggregatedKpis = aggregateKpis(report);

  const highRecs = report.recommendations.filter(r => r.priority === 'high').length;
  const medRecs = report.recommendations.filter(r => r.priority === 'medium').length;

  // Dominant trend
  const dominantTrend = (() => {
    let up = 0, down = 0;
    for (const p of report.platforms) {
      if (p.trend === 'up') up++;
      else if (p.trend === 'down') down++;
    }
    return up > down ? 'up' : down > up ? 'down' : 'stable';
  })();

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card hover:bg-accent/50 transition-colors p-4 group"
    >
      {/* Top row: Score + Name + Arrow */}
      <div className="flex items-center gap-3 mb-3">
        <ScoreRing score={score} size={48} strokeWidth={4} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{report.clientName}</h3>
            {trendIcons[dominantTrend]}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {report.industry && (
              <span className="text-xs text-muted-foreground truncate">{report.industry}</span>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${tierBadgeStyles[tier] || ''}`}>
              {tier}
            </Badge>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-2 text-center border-t border-border/50 pt-3 mb-3">
        <KpiCell label="Spend" value={fmtCurrency(kpis.spend)} />
        <KpiCell label="CPA" value={fmtCurrency(kpis.cpa)} />
        <KpiCell label="CPL" value={fmtCurrency(kpis.cpl)} />
        <KpiCell label="Conv" value={fmtNumber(kpis.conversions)} />
        <KpiCell label="ROAS" value={kpis.roas > 0 ? `${kpis.roas.toFixed(1)}x` : '—'} />
      </div>

      {/* Recommendation counts */}
      {(highRecs > 0 || medRecs > 0) && (
        <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
          {highRecs > 0 && <span className="text-red-400 font-medium">{highRecs} High</span>}
          {highRecs > 0 && medRecs > 0 && <span className="mx-1">/</span>}
          {medRecs > 0 && <span className="text-amber-400 font-medium">{medRecs} Med</span>}
          <span className="ml-1">recommendations</span>
        </div>
      )}
    </button>
  );
}

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

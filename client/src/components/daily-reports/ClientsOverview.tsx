import { Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ClientDailyReport } from '@/types/dailyReports';
import { fmtCurrency } from './shared';
import { ClientOverviewCard } from './ClientOverviewCard';
import { computeReportScore, aggregateKpis, tierFromScore } from './scoring';

interface Props {
  reports: ClientDailyReport[];
  onSelectClient: (clientName: string) => void;
}

export function ClientsOverview({ reports, onSelectClient }: Props) {
  // Fleet-level stats
  const fleetStats = (() => {
    let totalSpend = 0;
    let totalConversions = 0;
    let excellent = 0;
    let critical = 0;
    let totalScore = 0;

    for (const r of reports) {
      const kpis = aggregateKpis(r);
      totalSpend += kpis.spend;
      totalConversions += kpis.conversions;

      const { score } = computeReportScore(r);
      totalScore += score;
      const tier = tierFromScore(score);
      if (tier === 'excellent') excellent++;
      if (tier === 'critical') critical++;
    }

    return {
      totalSpend,
      totalConversions,
      avgScore: reports.length > 0 ? Math.round(totalScore / reports.length) : 0,
      excellent,
      critical,
    };
  })();

  // Sort by score ascending (lowest first — needs attention)
  const sortedReports = [...reports].sort((a, b) => {
    const sa = computeReportScore(a).score;
    const sb = computeReportScore(b).score;
    return sa - sb;
  });

  return (
    <div className="space-y-6">
      {/* Fleet summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Clients"
          value={String(reports.length)}
          sub={`Avg score: ${fleetStats.avgScore}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total Spend"
          value={fmtCurrency(fleetStats.totalSpend)}
          sub={`${fleetStats.totalConversions.toLocaleString()} conversions`}
        />
        <StatCard
          icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
          label="Excellent"
          value={String(fleetStats.excellent)}
          sub="score >= 80"
          accent="text-emerald-500"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          label="Critical"
          value={String(fleetStats.critical)}
          sub="score < 40"
          accent="text-red-500"
        />
      </div>

      {/* Client grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedReports.map(report => (
          <ClientOverviewCard
            key={report.id}
            report={report}
            onClick={() => onSelectClient(report.clientName)}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-xl font-bold ${accent || 'text-foreground'}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

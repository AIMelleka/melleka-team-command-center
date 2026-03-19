import { DollarSign, Target, UserCheck, ShoppingCart, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { SectionHeader } from '../shared';
import { fmtCurrency, fmtNumber } from '../shared';
import type { AggregatedKpis } from '../scoring';
import type { WeekOverWeekItem } from '@/types/dailyReports';

interface Props {
  kpis: AggregatedKpis;
  weekOverWeek: WeekOverWeekItem[];
}

interface KpiCardDef {
  key: keyof AggregatedKpis;
  label: string;
  icon: React.ReactNode;
  format: (v: number) => string;
  wowMetric: string; // matches WeekOverWeekItem.metric
  invertGood?: boolean; // for CPA/CPL, down is good
}

const kpiCards: KpiCardDef[] = [
  {
    key: 'spend',
    label: 'Total Spend',
    icon: <DollarSign className="h-4 w-4" />,
    format: fmtCurrency,
    wowMetric: 'spend',
  },
  {
    key: 'cpa',
    label: 'CPA',
    icon: <Target className="h-4 w-4" />,
    format: fmtCurrency,
    wowMetric: 'cpa',
    invertGood: true,
  },
  {
    key: 'cpl',
    label: 'CPL',
    icon: <UserCheck className="h-4 w-4" />,
    format: fmtCurrency,
    wowMetric: 'cpl',
    invertGood: true,
  },
  {
    key: 'conversions',
    label: 'Conversions',
    icon: <ShoppingCart className="h-4 w-4" />,
    format: fmtNumber,
    wowMetric: 'conversions',
  },
  {
    key: 'roas',
    label: 'ROAS',
    icon: <BarChart3 className="h-4 w-4" />,
    format: (v) => v > 0 ? `${v.toFixed(1)}x` : '—',
    wowMetric: 'roas',
  },
];

export function KpiSummarySection({ kpis, weekOverWeek }: Props) {
  // Build WoW lookup
  const wowMap = new Map<string, WeekOverWeekItem>();
  for (const item of weekOverWeek) {
    wowMap.set(item.metric.toLowerCase(), item);
  }

  return (
    <div>
      <SectionHeader title="Key Performance Indicators" icon={<BarChart3 className="h-4 w-4" />} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map(card => {
          const value = kpis[card.key];
          const wow = wowMap.get(card.wowMetric);

          return (
            <div key={card.key} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {card.icon}
                <span className="text-xs font-medium uppercase tracking-wide">{card.label}</span>
              </div>

              <div className="text-lg font-bold text-foreground">
                {card.format(value)}
              </div>

              {/* WoW delta */}
              {wow && (
                <WowIndicator
                  change={wow.change}
                  direction={wow.direction}
                  isGood={wow.isGood ?? (card.invertGood ? wow.direction === 'down' : wow.direction === 'up')}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WowIndicator({
  change,
  direction,
  isGood,
}: {
  change: number;
  direction: 'up' | 'down';
  isGood: boolean;
}) {
  const colorClass = isGood ? 'text-emerald-500' : 'text-red-500';
  const Icon = direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center gap-1 mt-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">
        {Math.abs(change).toFixed(1)}% WoW
      </span>
    </div>
  );
}

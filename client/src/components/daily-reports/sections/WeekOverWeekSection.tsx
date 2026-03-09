import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { SectionHeader } from '../shared';
import type { WeekOverWeekItem } from '@/types/dailyReports';

interface Props {
  weekOverWeek: WeekOverWeekItem[];
}

export function WeekOverWeekSection({ weekOverWeek }: Props) {
  if (!weekOverWeek || weekOverWeek.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Week-over-Week Changes" icon={<Activity className="h-4 w-4" />} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {weekOverWeek.map((item, i) => {
          const isGood = item.isGood !== undefined ? item.isGood : item.direction === 'up';
          const isUp = item.direction === 'up';
          const ArrowIcon = isUp ? TrendingUp : TrendingDown;
          const color = isGood ? 'text-emerald-500' : 'text-red-500';
          const borderColor = isGood ? 'border-emerald-500/20' : 'border-red-500/20';
          const bgColor = isGood ? 'bg-emerald-500/5' : 'bg-red-500/5';

          return (
            <div key={i} className={`rounded-lg border p-3 ${borderColor} ${bgColor}`}>
              <p className="text-xs text-muted-foreground mb-1 truncate">{item.metric}</p>
              <div className="flex items-center gap-2">
                <ArrowIcon className={`h-4 w-4 ${color}`} />
                <span className={`text-lg font-bold ${color}`}>
                  {typeof item.change === 'number'
                    ? `${item.change > 0 ? '+' : ''}${item.change.toFixed(1)}%`
                    : item.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

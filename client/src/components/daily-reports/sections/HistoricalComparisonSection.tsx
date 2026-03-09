import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SectionHeader } from '../shared';
import type { HistoricalComparison } from '@/types/dailyReports';

interface Props {
  historicalComparison: HistoricalComparison | null;
}

export function HistoricalComparisonSection({ historicalComparison }: Props) {
  if (!historicalComparison) return null;
  const { improved, declined, unchanged } = historicalComparison;
  const hasData = (improved?.length || 0) + (declined?.length || 0) + (unchanged?.length || 0) > 0;
  if (!hasData) return null;

  return (
    <div>
      <SectionHeader title="vs Previous Review" icon={<History className="h-4 w-4" />} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Improved */}
        {improved && improved.length > 0 && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Improved</span>
            </div>
            <ul className="space-y-1.5">
              {improved.map((item, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Declined */}
        {declined && declined.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">Declined</span>
            </div>
            <ul className="space-y-1.5">
              {declined.map((item, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 shrink-0">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Unchanged */}
        {unchanged && unchanged.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unchanged</span>
            </div>
            <ul className="space-y-1.5">
              {unchanged.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">=</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

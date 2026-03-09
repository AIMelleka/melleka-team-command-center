import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { ClientAutoOptimizeData, AutoOptimizeChange } from '@/hooks/useAutoOptimizeData';
import { format, parseISO } from 'date-fns';

interface Props {
  data: ClientAutoOptimizeData | null;
}

function StatusBadge({ change, data }: { change: AutoOptimizeChange; data: ClientAutoOptimizeData }) {
  if (change.executionError) {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
        <XCircle className="h-2.5 w-2.5" /> Failed
      </Badge>
    );
  }
  if (change.executedAt) {
    const result = data.results.get(change.id);
    if (result) {
      const outcome = result.outcome.toLowerCase();
      if (outcome === 'improved' || outcome === 'positive') {
        return (
          <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            <TrendingUp className="h-2.5 w-2.5" /> Improved
          </Badge>
        );
      }
      if (outcome === 'declined' || outcome === 'negative' || outcome === 'worsened') {
        return (
          <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
            <TrendingDown className="h-2.5 w-2.5" /> Declined
          </Badge>
        );
      }
      return (
        <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-muted text-muted-foreground hover:bg-muted/80">
          <Minus className="h-2.5 w-2.5" /> No Change
        </Badge>
      );
    }
    return (
      <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
        <CheckCircle className="h-2.5 w-2.5" /> Executed
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
      <Clock className="h-2.5 w-2.5" /> Pending
    </Badge>
  );
}

function ChangeTypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes('budget')) return <span title="Budget change">💰</span>;
  if (t.includes('bid')) return <span title="Bid adjustment">🎯</span>;
  if (t.includes('pause') || t.includes('enable')) return <span title="Status change">⏸️</span>;
  if (t.includes('keyword')) return <span title="Keyword change">🔑</span>;
  if (t.includes('target')) return <span title="Targeting change">📍</span>;
  return <span title={type}>⚡</span>;
}

export function AutoOptimizeSection({ data }: Props) {
  if (!data || !data.enabled) return null;

  const platformLabel = data.platform === 'google' ? 'Google Ads' : data.platform === 'meta' ? 'Meta Ads' : 'Google + Meta';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Auto-Optimization Updates
        </h3>
      </div>

      {/* Summary banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-primary/5 border-primary/20 p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Auto-Optimize is ON</p>
            <p className="text-xs text-muted-foreground">{platformLabel}</p>
          </div>
        </div>

        {data.changes.length > 0 ? (
          <div className="flex items-center gap-4 text-center">
            <div>
              <p className="text-lg font-bold">{data.changes.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Changes</p>
            </div>
            <div>
              <p className="text-lg font-bold">{data.totalExecuted}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Executed</p>
            </div>
            {data.totalExecuted > 0 && (
              <div>
                <p className={`text-lg font-bold ${data.successRate >= 60 ? 'text-emerald-400' : data.successRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {Math.round(data.successRate)}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Success</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No auto-changes in this period</p>
        )}
      </div>

      {/* Change list */}
      {data.changes.length > 0 && (
        <div className="space-y-2">
          {data.totalExecuted > 0 && (
            <p className="text-xs text-muted-foreground">
              {data.totalImproved}/{data.totalExecuted} changes improved performance ({Math.round(data.successRate)}% success rate)
            </p>
          )}

          <div className="space-y-1.5">
            {data.changes.map((change) => (
              <div
                key={change.id}
                className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2 text-sm"
              >
                {/* Change type icon */}
                <div className="shrink-0 text-sm">
                  <ChangeTypeIcon type={change.changeType} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {change.entityName || change.changeType}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                      {change.platform}
                    </Badge>
                  </div>
                  {change.aiRationale && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={change.aiRationale}>
                      {change.aiRationale}
                    </p>
                  )}
                  {change.executionError && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{change.executionError}</span>
                    </p>
                  )}
                </div>

                {/* Date */}
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                  {(() => {
                    try { return format(parseISO(change.createdAt), 'MMM d'); } catch { return ''; }
                  })()}
                </span>

                {/* Status */}
                <div className="shrink-0">
                  <StatusBadge change={change} data={data} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Minus,
  AlertTriangle, ChevronDown, ChevronUp, Brain, Activity,
} from 'lucide-react';
import type { ClientAutoOptimizeData, AutoOptimizeChange } from '@/hooks/useAutoOptimizeData';
import type { MemoryEntry } from '@/hooks/useAutoOptimizeMemory';
import { format, parseISO } from 'date-fns';

interface Props {
  autoOptimizeData: Map<string, ClientAutoOptimizeData>;
  memories: Map<string, MemoryEntry[]>;
  isLoading: boolean;
}

export function AutoUpdatesDashboard({ autoOptimizeData, memories, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Zap className="h-10 w-10 text-primary animate-pulse mb-4" />
        <p className="text-muted-foreground">Loading auto-optimization data...</p>
      </div>
    );
  }

  if (autoOptimizeData.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Zap className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">No auto-optimization clients</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Enable auto-optimization for clients in Client Settings to see updates here.
        </p>
      </div>
    );
  }

  // Fleet summary stats
  const allClients = Array.from(autoOptimizeData.entries());
  const totalChanges = allClients.reduce((s, [, d]) => s + d.changes.length, 0);
  const totalExecuted = allClients.reduce((s, [, d]) => s + d.totalExecuted, 0);
  const totalImproved = allClients.reduce((s, [, d]) => s + d.totalImproved, 0);
  const overallSuccessRate = totalExecuted > 0 ? (totalImproved / totalExecuted) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Fleet summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Clients ON"
          value={allClients.length}
          icon={<Zap className="h-4 w-4 text-primary" />}
        />
        <SummaryCard
          label="Total Changes"
          value={totalChanges}
          icon={<Activity className="h-4 w-4 text-blue-400" />}
        />
        <SummaryCard
          label="Executed"
          value={totalExecuted}
          icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
        />
        <SummaryCard
          label="Success Rate"
          value={`${Math.round(overallSuccessRate)}%`}
          icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
          valueColor={overallSuccessRate >= 60 ? 'text-emerald-400' : overallSuccessRate >= 40 ? 'text-amber-400' : 'text-red-400'}
        />
      </div>

      {/* Per-client cards */}
      {allClients.map(([clientName, data]) => (
        <ClientAutoCard
          key={clientName}
          clientName={clientName}
          data={data}
          memories={memories.get(clientName) || []}
        />
      ))}
    </div>
  );
}

function SummaryCard({ label, value, icon, valueColor }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className={`text-xl font-bold ${valueColor || ''}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientAutoCard({ clientName, data, memories }: {
  clientName: string;
  data: ClientAutoOptimizeData;
  memories: MemoryEntry[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const platformLabel = data.platform === 'google' ? 'Google Ads' : data.platform === 'meta' ? 'Meta Ads' : 'Google + Meta';

  const declined = data.changes.filter(c => {
    const r = data.results.get(c.id);
    return r && (r.outcome === 'declined' || r.outcome === 'negative' || r.outcome === 'worsened');
  }).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border bg-primary/5 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{clientName}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{platformLabel}</Badge>
                <span className="text-[10px] text-emerald-400 font-medium">ON</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stat pills */}
            <div className="hidden sm:flex items-center gap-3 text-center">
              <StatPill label="Proposed" value={data.changes.length} />
              <StatPill label="Executed" value={data.totalExecuted} />
              <StatPill label="Improved" value={data.totalImproved} color="text-emerald-400" />
              {declined > 0 && <StatPill label="Declined" value={declined} color="text-red-400" />}
            </div>

            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-4 space-y-4">
          {/* Success rate bar */}
          {data.totalExecuted > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/30">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.successRate >= 60 ? 'bg-emerald-500' : data.successRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, data.successRate)}%` }}
                />
              </div>
              <span className={`text-sm font-medium ${
                data.successRate >= 60 ? 'text-emerald-400' : data.successRate >= 40 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {Math.round(data.successRate)}% success
              </span>
            </div>
          )}

          {/* Changes list */}
          {data.changes.length > 0 ? (
            <div className="space-y-1.5">
              {data.changes.map((change) => (
                <ChangeRow key={change.id} change={change} data={data} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No changes in this period</p>
          )}

          {/* AI Learnings section */}
          {memories.length > 0 && (
            <div className="border-t pt-3">
              <button
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={(e) => { e.stopPropagation(); setShowMemories(!showMemories); }}
              >
                <Brain className="h-3.5 w-3.5" />
                AI Learnings ({memories.length})
                {showMemories ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>

              {showMemories && (
                <div className="mt-2 space-y-2">
                  {memories.slice(0, 10).map((mem) => (
                    <div key={mem.id} className="text-xs px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <MemoryTypeBadge type={mem.memoryType} />
                        <span className="text-muted-foreground">
                          {(() => { try { return format(parseISO(mem.createdAt), 'MMM d'); } catch { return ''; } })()}
                        </span>
                      </div>
                      <p className="text-foreground/80 leading-relaxed">{mem.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color || ''}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function MemoryTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'change_outcome':
      return <Badge className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30">Outcome</Badge>;
    case 'strategist_learning':
      return <Badge className="text-[9px] px-1.5 py-0 bg-purple-500/15 text-purple-400 border-purple-500/30">Learning</Badge>;
    case 'win':
      return <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Win</Badge>;
    case 'concern':
      return <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30">Concern</Badge>;
    default:
      return <Badge variant="outline" className="text-[9px] px-1.5 py-0">{type}</Badge>;
  }
}

function ChangeRow({ change, data }: { change: AutoOptimizeChange; data: ClientAutoOptimizeData }) {
  const changeIcon = (() => {
    const t = change.changeType.toLowerCase();
    if (t.includes('budget')) return '💰';
    if (t.includes('bid')) return '🎯';
    if (t.includes('pause') || t.includes('enable')) return '⏸️';
    if (t.includes('keyword')) return '🔑';
    if (t.includes('target')) return '📍';
    return '⚡';
  })();

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2 text-sm">
      <span className="shrink-0 text-sm">{changeIcon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{change.entityName || change.changeType}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{change.platform}</Badge>
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

      {/* Before/After values */}
      {change.beforeValue && change.afterValue && Object.keys(change.beforeValue).length > 0 && (
        <div className="hidden md:block text-[10px] text-muted-foreground shrink-0">
          {Object.entries(change.beforeValue).slice(0, 1).map(([key, val]) => (
            <span key={key}>
              {String(val)} → {String((change.afterValue as Record<string, unknown>)[key] ?? '?')}
            </span>
          ))}
        </div>
      )}

      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
        {(() => { try { return format(parseISO(change.createdAt), 'MMM d'); } catch { return ''; } })()}
      </span>

      <div className="shrink-0">
        <StatusBadge change={change} data={data} />
      </div>
    </div>
  );
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
          <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <TrendingUp className="h-2.5 w-2.5" /> Improved
          </Badge>
        );
      }
      if (outcome === 'declined' || outcome === 'negative' || outcome === 'worsened') {
        return (
          <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/30">
            <TrendingDown className="h-2.5 w-2.5" /> Declined
          </Badge>
        );
      }
      return (
        <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-muted text-muted-foreground">
          <Minus className="h-2.5 w-2.5" /> No Change
        </Badge>
      );
    }
    return (
      <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
        <CheckCircle className="h-2.5 w-2.5" /> Executed
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] gap-1 px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30">
      <Clock className="h-2.5 w-2.5" /> Pending
    </Badge>
  );
}

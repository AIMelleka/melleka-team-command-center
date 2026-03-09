import { Lightbulb, CheckCircle, XCircle, Loader2, Play, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '../shared';
import type { ActionableRecommendation } from '@/types/dailyReports';

type RecStatus = ActionableRecommendation['approvalStatus'];

interface Props {
  recommendations: ActionableRecommendation[];
  clientName: string;
  getStatus: (key: string) => RecStatus;
  getError: (key: string) => string | undefined;
  onApprove: (rec: ActionableRecommendation, clientName: string, key: string) => Promise<string | null>;
  onReject: (key: string) => Promise<void>;
  onExecute: (key: string) => Promise<{ ok: boolean; error?: string }>;
}

const priorityConfig: Record<string, { label: string; borderColor: string; bgColor: string; textColor: string }> = {
  high: { label: 'HIGH PRIORITY', borderColor: 'border-red-500/20', bgColor: 'bg-red-500/5', textColor: 'text-red-500' },
  medium: { label: 'MEDIUM PRIORITY', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/5', textColor: 'text-amber-500' },
  low: { label: 'LOW PRIORITY', borderColor: 'border-blue-500/20', bgColor: 'bg-blue-500/5', textColor: 'text-blue-500' },
};

const effortBadge: Record<string, string> = {
  'quick-win': 'bg-emerald-500/10 text-emerald-500',
  medium: 'bg-amber-500/10 text-amber-500',
  strategic: 'bg-purple-500/10 text-purple-500',
};

const confidenceBadge: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  low: 'bg-zinc-500/10 text-muted-foreground border-border',
};

function StatusBadge({ status, error }: { status: RecStatus; error?: string }) {
  switch (status) {
    case 'approved':
      return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Approved</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">Rejected</Badge>;
    case 'executing':
      return (
        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/30">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Executing...
        </Badge>
      );
    case 'executed':
      return (
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Executed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30" title={error}>
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

export function ActionableRecommendationsSection({
  recommendations,
  clientName,
  getStatus,
  getError,
  onApprove,
  onReject,
  onExecute,
}: Props) {
  if (!recommendations || recommendations.length === 0) return null;

  // Group by priority
  const groups = new Map<string, { recs: ActionableRecommendation[]; indices: number[] }>();
  recommendations.forEach((rec, idx) => {
    const p = rec.priority || 'medium';
    const existing = groups.get(p) || { recs: [], indices: [] };
    existing.recs.push(rec);
    existing.indices.push(idx);
    groups.set(p, existing);
  });

  const orderedPriorities = ['high', 'medium', 'low'].filter(p => groups.has(p));

  return (
    <div className="space-y-4">
      <SectionHeader title="Things I Recommend" icon={<Lightbulb className="h-4 w-4" />} />

      {orderedPriorities.map(priority => {
        const { recs, indices } = groups.get(priority)!;
        const cfg = priorityConfig[priority] || priorityConfig.medium;

        return (
          <div key={priority}>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.textColor} mb-2 px-1`}>
              {cfg.label}
            </p>
            <div className="space-y-2">
              {recs.map((rec, i) => {
                const localKey = `${clientName}-${indices[i]}`;
                const status = getStatus(localKey);
                const error = getError(localKey);
                const isAdvisory = rec.changeType === 'advisory';
                const isTerminal = status === 'rejected' || status === 'executed';
                const canApprove = status === 'pending';
                const canExecute = status === 'approved' && !isAdvisory;
                const canReject = status === 'pending' || status === 'approved';

                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-4 transition-opacity ${cfg.borderColor} ${cfg.bgColor} ${isTerminal ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{rec.action}</p>
                        {rec.expectedImpact && (
                          <p className="text-xs text-muted-foreground mt-1">{rec.expectedImpact}</p>
                        )}
                      </div>
                      <StatusBadge status={status} error={error} />
                    </div>

                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {rec.platform && (
                        <Badge variant="outline" className="text-[10px]">{rec.platform}</Badge>
                      )}
                      {rec.effort && (
                        <Badge variant="outline" className={`text-[10px] ${effortBadge[rec.effort] || ''}`}>
                          {rec.effort}
                        </Badge>
                      )}
                      {rec.timeline && (
                        <Badge variant="outline" className="text-[10px]">{rec.timeline}</Badge>
                      )}
                      {rec.confidence && (
                        <Badge variant="outline" className={`text-[10px] ${confidenceBadge[rec.confidence] || ''}`}>
                          {rec.confidence} confidence
                        </Badge>
                      )}
                      {isAdvisory && (
                        <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-muted-foreground">
                          Manual only
                        </Badge>
                      )}
                      {rec.entityName && (
                        <Badge variant="outline" className="text-[10px] truncate max-w-[200px]">
                          {rec.entityName}
                        </Badge>
                      )}
                    </div>

                    {/* Error message */}
                    {error && status === 'failed' && (
                      <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <p className="text-xs text-red-400 truncate">{error}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isTerminal && (
                      <div className="flex items-center gap-2">
                        {canApprove && (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => onApprove(rec, clientName, localKey)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                        )}
                        {canExecute && (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => onExecute(localKey)}
                            disabled={status === 'executing'}
                          >
                            {status === 'executing' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Play className="h-3.5 w-3.5 mr-1" />
                            )}
                            Execute Now
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => onReject(localKey)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { ArrowLeft, Lightbulb, Loader2, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ClientDailyReport, ActionableRecommendation, DeepAnalysis, Recommendation, Platform } from '@/types/dailyReports';
import { computeReportScore, aggregateKpis } from './scoring';
import { SectionHeader } from './shared';
import { ScoreCardSection } from './detail-sections/ScoreCardSection';
import { KpiSummarySection } from './detail-sections/KpiSummarySection';
import { PlatformBreakdownSection } from './sections/PlatformBreakdownSection';
import { ActionableRecommendationsSection } from './sections/ActionableRecommendationsSection';

type RecStatus = ActionableRecommendation['approvalStatus'];

interface Props {
  report: ClientDailyReport;
  onBack: () => void;
  // Range mode / deep analysis
  isRangeMode?: boolean;
  deepAnalysis?: DeepAnalysis | null;
  // Recommendation action callbacks
  getStatus: (key: string) => RecStatus;
  getError: (key: string) => string | undefined;
  onApprove: (rec: ActionableRecommendation, clientName: string, key: string) => Promise<string | null>;
  onReject: (key: string) => Promise<void>;
  onExecute: (key: string) => Promise<{ ok: boolean; error?: string }>;
  // One-click make change
  onMakeChange?: (rec: Recommendation, clientName: string, platforms: Platform[], key: string) => Promise<{ ok: boolean; status: string; error?: string }>;
}

const priorityOrder = ['high', 'medium', 'low'] as const;

const priorityStyles: Record<string, { label: string; textColor: string; borderColor: string; bgColor: string }> = {
  high: { label: 'HIGH IMPACT', textColor: 'text-red-500', borderColor: 'border-red-500/20', bgColor: 'bg-red-500/5' },
  medium: { label: 'MEDIUM IMPACT', textColor: 'text-amber-500', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/5' },
  low: { label: 'LOW IMPACT', textColor: 'text-blue-500', borderColor: 'border-blue-500/20', bgColor: 'bg-blue-500/5' },
};

export function ClientDetailView({
  report,
  onBack,
  isRangeMode,
  deepAnalysis,
  getStatus,
  getError,
  onApprove,
  onReject,
  onExecute,
  onMakeChange,
}: Props) {
  const scoreData = computeReportScore(report);
  const kpis = aggregateKpis(report);

  // In range mode with deep analysis, delegate to ActionableRecommendationsSection
  const hasActionableRecs = isRangeMode && deepAnalysis?.actionableRecommendations?.length;

  return (
    <div className="space-y-6">
      {/* Back button + client header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground">{report.clientName}</h2>
          {report.industry && (
            <p className="text-xs text-muted-foreground">{report.industry}</p>
          )}
        </div>
      </div>

      {/* Section 1: Score Card */}
      <ScoreCardSection scoreData={scoreData} summary={report.summary} />

      {/* Section 2: KPI Summary */}
      <KpiSummarySection kpis={kpis} weekOverWeek={report.weekOverWeek || []} />

      {/* Section 3: Platform Breakdown (reused as-is) */}
      <PlatformBreakdownSection platforms={report.platforms} />

      {/* Section 4: Impact-tiered Recommendations */}
      {hasActionableRecs ? (
        <ActionableRecommendationsSection
          recommendations={deepAnalysis!.actionableRecommendations}
          clientName={report.clientName}
          getStatus={getStatus}
          getError={getError}
          onApprove={onApprove}
          onReject={onReject}
          onExecute={onExecute}
        />
      ) : (
        <ImpactRecommendationsSection
          recommendations={report.recommendations}
          clientName={report.clientName}
          platforms={report.platforms}
          getStatus={getStatus}
          getError={getError}
          onMakeChange={onMakeChange}
        />
      )}
    </div>
  );
}

/** Impact-tiered recs for single-day mode with optional one-click "Make the change" */
function ImpactRecommendationsSection({
  recommendations,
  clientName,
  platforms,
  getStatus,
  getError,
  onMakeChange,
}: {
  recommendations: Recommendation[];
  clientName: string;
  platforms: Platform[];
  getStatus: (key: string) => RecStatus;
  getError: (key: string) => string | undefined;
  onMakeChange?: (rec: Recommendation, clientName: string, platforms: Platform[], key: string) => Promise<{ ok: boolean; status: string; error?: string }>;
}) {
  if (!recommendations || recommendations.length === 0) return null;

  // Group by priority, tracking original indices for stable keys
  const groups = new Map<string, { recs: Recommendation[]; indices: number[] }>();
  recommendations.forEach((rec, idx) => {
    const p = rec.priority || 'medium';
    const existing = groups.get(p) || { recs: [], indices: [] };
    existing.recs.push(rec);
    existing.indices.push(idx);
    groups.set(p, existing);
  });

  const orderedPriorities = priorityOrder.filter(p => groups.has(p));

  return (
    <div>
      <SectionHeader title="Recommendations" icon={<Lightbulb className="h-4 w-4" />} />

      <div className="space-y-4">
        {orderedPriorities.map(priority => {
          const { recs, indices } = groups.get(priority)!;
          const style = priorityStyles[priority];

          return (
            <div key={priority}>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${style.textColor} mb-2 px-1`}>
                {style.label}
              </p>
              <div className="space-y-2">
                {recs.map((rec, i) => {
                  const localKey = `mc-${clientName}-${indices[i]}`;
                  const status = getStatus(localKey);
                  const error = getError(localKey);
                  const isTerminal = status === 'executed' || status === 'failed';
                  const isExecuting = status === 'executing';
                  const isAdvisory = status === 'approved'; // advisory results show as approved

                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-4 transition-opacity ${style.borderColor} ${style.bgColor} ${isTerminal ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{rec.action}</p>
                          {rec.expectedImpact && (
                            <p className="text-xs text-muted-foreground mt-1">{rec.expectedImpact}</p>
                          )}
                        </div>
                        {/* Status badges */}
                        {status === 'executed' && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shrink-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Executed
                          </Badge>
                        )}
                        {isAdvisory && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 shrink-0">
                            Approved (Manual)
                          </Badge>
                        )}
                        {status === 'failed' && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30 shrink-0">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        {isExecuting && (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/30 shrink-0">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Executing...
                          </Badge>
                        )}
                      </div>

                      {/* Error message */}
                      {error && status === 'failed' && (
                        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <p className="text-xs text-red-400 truncate">{error}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {rec.platform && (
                          <Badge variant="outline" className="text-[10px]">{rec.platform}</Badge>
                        )}
                        {rec.effort && (
                          <Badge variant="outline" className="text-[10px]">{rec.effort}</Badge>
                        )}
                        {rec.timeline && (
                          <Badge variant="outline" className="text-[10px]">{rec.timeline}</Badge>
                        )}
                      </div>

                      {/* Make the change button */}
                      {onMakeChange && !isTerminal && !isAdvisory && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={isExecuting}
                            onClick={() => onMakeChange(rec, clientName, platforms, localKey)}
                          >
                            {isExecuting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Zap className="h-3.5 w-3.5 mr-1" />
                            )}
                            {isExecuting ? 'Making change...' : 'Make the change'}
                          </Button>
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
    </div>
  );
}

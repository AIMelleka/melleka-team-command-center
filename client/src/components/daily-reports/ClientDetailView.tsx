import { ArrowLeft, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ClientDailyReport, ActionableRecommendation, DeepAnalysis, Recommendation } from '@/types/dailyReports';
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
        <ImpactRecommendationsSection recommendations={report.recommendations} />
      )}
    </div>
  );
}

/** Simple impact-tiered recs for single-day mode (no approve/execute) */
function ImpactRecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations || recommendations.length === 0) return null;

  // Group by priority
  const groups = new Map<string, Recommendation[]>();
  for (const rec of recommendations) {
    const p = rec.priority || 'medium';
    const list = groups.get(p) || [];
    list.push(rec);
    groups.set(p, list);
  }

  const orderedPriorities = priorityOrder.filter(p => groups.has(p));

  return (
    <div>
      <SectionHeader title="Recommendations" icon={<Lightbulb className="h-4 w-4" />} />

      <div className="space-y-4">
        {orderedPriorities.map(priority => {
          const recs = groups.get(priority)!;
          const style = priorityStyles[priority];

          return (
            <div key={priority}>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${style.textColor} mb-2 px-1`}>
                {style.label}
              </p>
              <div className="space-y-2">
                {recs.map((rec, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-4 ${style.borderColor} ${style.bgColor}`}
                  >
                    <p className="text-sm font-medium text-foreground">{rec.action}</p>
                    {rec.expectedImpact && (
                      <p className="text-xs text-muted-foreground mt-1">{rec.expectedImpact}</p>
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
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

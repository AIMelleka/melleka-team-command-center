import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClientDailyReport, DeepAnalysis, ActionableRecommendation } from '@/types/dailyReports';
import { computeGrade, getReportHealth, slugify } from './shared';
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { PlatformBreakdownSection } from './sections/PlatformBreakdownSection';
import { CampaignPerformanceTable } from './sections/CampaignPerformanceTable';
import { KeywordAnalysisSection } from './sections/KeywordAnalysisSection';
import { CreativeAnalysisSection } from './sections/CreativeAnalysisSection';
import { WeekOverWeekSection } from './sections/WeekOverWeekSection';
import { BenchmarkComparisonSection } from './sections/BenchmarkComparisonSection';
import { InsightsSection } from './sections/InsightsSection';
import { RecommendationsSection } from './sections/RecommendationsSection';
import { CrossPlatformSection } from './sections/CrossPlatformSection';
import { CompetitorSection } from './sections/CompetitorSection';
import { HistoricalComparisonSection } from './sections/HistoricalComparisonSection';
import { QaValidationSection } from './sections/QaValidationSection';
import { DeepAnalysisSection } from './sections/DeepAnalysisSection';
import { ActionableRecommendationsSection } from './sections/ActionableRecommendationsSection';
import { AutoOptimizeSection } from './sections/AutoOptimizeSection';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import type { ClientAutoOptimizeData } from '@/hooks/useAutoOptimizeData';

interface Props {
  report: ClientDailyReport;
  isRangeMode?: boolean;
  deepAnalysis?: DeepAnalysis | null;
  isAnalysisLoading?: boolean;
  autoOptimizeData?: ClientAutoOptimizeData | null;
  // Recommendation action callbacks (only used in range mode)
  recGetStatus?: (key: string) => ActionableRecommendation['approvalStatus'];
  recGetError?: (key: string) => string | undefined;
  recOnApprove?: (rec: ActionableRecommendation, clientName: string, key: string) => Promise<string | null>;
  recOnReject?: (key: string) => Promise<void>;
  recOnExecute?: (key: string) => Promise<{ ok: boolean; error?: string }>;
}

export function ClientReportCard({
  report,
  isRangeMode,
  deepAnalysis,
  isAnalysisLoading,
  autoOptimizeData,
  recGetStatus,
  recGetError,
  recOnApprove,
  recOnReject,
  recOnExecute,
}: Props) {
  const health = getReportHealth(report.cplCpaAnalysis, report.platforms);
  const grade = computeGrade(health);

  const dateRange = (() => {
    try {
      const start = format(parseISO(report.dateRangeStart), 'MMM d');
      const end = format(parseISO(report.dateRangeEnd), 'MMM d, yyyy');
      return `${start} - ${end}`;
    } catch {
      return `${report.dateRangeStart} - ${report.dateRangeEnd}`;
    }
  })();

  const updatedAgo = (() => {
    try {
      return formatDistanceToNow(new Date(report.updatedAt), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  const hasActionableRecs = isRangeMode && deepAnalysis?.actionableRecommendations && deepAnalysis.actionableRecommendations.length > 0;

  return (
    <div id={`report-${slugify(report.clientName)}`} className="scroll-mt-24">
      <Card className="overflow-hidden">
        {/* Sticky client header */}
        <CardHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl border flex items-center justify-center ${grade.bgColor}`}>
                <span className={`text-2xl font-black ${grade.color}`}>{grade.letter}</span>
              </div>
              <div>
                <CardTitle className="text-xl">{report.clientName}</CardTitle>
                <p className="text-sm text-muted-foreground">{dateRange}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isRangeMode && (
                <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                  Range View
                </Badge>
              )}
              {report.industry && (
                <Badge variant="secondary" className="text-xs">{report.industry}</Badge>
              )}
              {updatedAgo && (
                <span className="text-xs text-muted-foreground">Updated {updatedAgo}</span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-10 p-6 pt-8">
          {/* Deep Analysis (range mode only, renders at top) */}
          {isRangeMode && (deepAnalysis || isAnalysisLoading) && (
            <DeepAnalysisSection analysis={deepAnalysis || null} isLoading={!!isAnalysisLoading} />
          )}

          {/* 1. Executive Summary */}
          <ExecutiveSummarySection report={report} />

          {/* 2. Platform Breakdown */}
          <PlatformBreakdownSection platforms={report.platforms} />

          {/* 3. Campaign Performance */}
          <CampaignPerformanceTable platforms={report.platforms} />

          {/* 4. Keyword Analysis */}
          <KeywordAnalysisSection keyMetrics={report.keyMetrics} />

          {/* 5. Creative / Headline Effectiveness */}
          <CreativeAnalysisSection keyMetrics={report.keyMetrics} />

          {/* 6. Week-over-Week */}
          <WeekOverWeekSection weekOverWeek={report.weekOverWeek} />

          {/* 7. Benchmark Comparison */}
          <BenchmarkComparisonSection benchmarkAnalysis={report.benchmarkAnalysis} />

          {/* 8. AI Insights */}
          <InsightsSection insights={report.insights} />

          {/* 8.5. Auto-Optimization Updates (if auto-optimize enabled for this client) */}
          {autoOptimizeData && <AutoOptimizeSection data={autoOptimizeData} />}

          {/* 9. Recommendations (read-only for single date, actionable for range with deep analysis) */}
          {hasActionableRecs && recGetStatus && recGetError && recOnApprove && recOnReject && recOnExecute ? (
            <ActionableRecommendationsSection
              recommendations={deepAnalysis!.actionableRecommendations}
              clientName={report.clientName}
              getStatus={recGetStatus}
              getError={recGetError}
              onApprove={recOnApprove}
              onReject={recOnReject}
              onExecute={recOnExecute}
            />
          ) : (
            <RecommendationsSection
              recommendations={report.recommendations}
              actionItems={report.actionItems}
            />
          )}

          {/* 10. Cross-Platform Synergies */}
          <CrossPlatformSection synergies={report.crossPlatformSynergies} />

          {/* 11. Competitor Intelligence */}
          <CompetitorSection competitorInsights={report.competitorInsights} />

          {/* 12. Historical Comparison */}
          <HistoricalComparisonSection historicalComparison={report.historicalComparison} />

          {/* 13. QA Validation */}
          <QaValidationSection qaValidation={report.qaValidation} />
        </CardContent>
      </Card>
    </div>
  );
}

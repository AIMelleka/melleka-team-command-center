import { useState, useRef } from 'react';
import { Loader2, BarChart3, ArrowLeft, RefreshCw, Brain, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminHeader from '@/components/AdminHeader';
import { useDailyReports } from '@/hooks/useDailyReports';
import { useDeepAnalysis } from '@/hooks/useDeepAnalysis';
import { useRecommendationActions } from '@/hooks/useRecommendationActions';
import { useAutoOptimizeData } from '@/hooks/useAutoOptimizeData';
import { ClientReportCard } from '@/components/daily-reports/ClientReportCard';
import { ReportTableOfContents } from '@/components/daily-reports/ReportTableOfContents';
import { ReportDatePicker } from '@/components/daily-reports/ReportDatePicker';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function DailyReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ done: 0, total: 0, current: '' });
  const cancelRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    cancelRef.current = false;

    try {
      // Step 1: Get list of clients with linked accounts
      const { data: listData, error: listError } = await supabase.functions.invoke('bulk-ad-review', {
        body: { action: 'list-clients' },
      });
      if (listError) throw listError;

      const clients: string[] = listData?.clients || [];
      if (clients.length === 0) {
        toast({ title: 'No clients with linked accounts', description: 'Link ad accounts in Client Settings first.', variant: 'destructive' });
        setIsRegenerating(false);
        return;
      }

      toast({ title: `Generating reports for ${clients.length} clients...`, description: 'Each client takes 30-120 seconds. Reports appear as they finish.' });

      // Step 2: Fire off each client as fire-and-forget, poll DB for results
      const startTime = Date.now();
      let launched = 0;

      // Track which reports existed before we started
      const today = new Date().toISOString().split('T')[0];
      const { data: existingReports } = await supabase
        .from('ad_review_history')
        .select('client_name')
        .eq('review_date', today)
        .gte('created_at', new Date(startTime - 60000).toISOString());
      const alreadyDone = new Set((existingReports || []).map((r: any) => r.client_name));

      // Launch clients with staggered starts (3 seconds apart to avoid overwhelming)
      const launchNext = async () => {
        for (const clientName of clients) {
          if (cancelRef.current) break;
          if (alreadyDone.has(clientName)) continue;

          launched++;
          setRegenProgress({ done: alreadyDone.size, total: clients.length, current: `Launched ${launched}/${clients.length}` });

          // Fire and forget -- don't await
          supabase.functions.invoke('bulk-ad-review', {
            body: { clientName },
          }).catch(() => {});

          // Stagger by 3 seconds so we don't hit rate limits
          await new Promise(r => setTimeout(r, 3000));
        }
      };

      // Start launching in background
      launchNext();

      // Poll DB every 10 seconds to track completion
      pollRef.current = setInterval(async () => {
        const { data: newReports } = await supabase
          .from('ad_review_history')
          .select('client_name')
          .eq('review_date', today)
          .gte('created_at', new Date(startTime).toISOString());

        const completed = new Set((newReports || []).map((r: any) => r.client_name));
        const doneCount = completed.size;

        setRegenProgress({ done: doneCount, total: clients.length, current: doneCount === clients.length ? 'All done!' : `${doneCount} completed` });

        if (doneCount > 0) reload();

        // Stop after all done or 10 minutes
        if (doneCount >= clients.length || cancelRef.current || Date.now() - startTime > 600000) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsRegenerating(false);
          reload();
          const failedCount = clients.length - doneCount;
          toast({
            title: cancelRef.current ? 'Generation stopped' : 'Report generation complete',
            description: `${doneCount} completed${failedCount > 0 ? `, ${failedCount} still processing or failed` : ''}`,
          });
        }
      }, 10000);

    } catch (err: any) {
      toast({ title: 'Failed to generate reports', description: err.message, variant: 'destructive' });
      setIsRegenerating(false);
    }
  };

  const stopPolling = () => {
    cancelRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsRegenerating(false);
    reload();
  };

  const {
    reports,
    isLoading,
    dateSelection,
    setSelectedDate,
    setRange,
    setMode,
    availableDates,
    clientCount,
    reload,
    isRangeMode,
    dailyBreakdowns,
    rangeDayCount,
  } = useDailyReports();

  const {
    analyses,
    loadingClients,
    isAnalyzing,
    analyzeAllClients,
    clearAnalyses,
  } = useDeepAnalysis();

  const {
    getStatus,
    getError,
    approve,
    reject,
    execute,
  } = useRecommendationActions();

  const { autoOptimizeData } = useAutoOptimizeData(
    dateSelection.startDate || dateSelection.singleDate,
    dateSelection.endDate || dateSelection.singleDate
  );

  const handleRunDeepAnalysis = () => {
    if (!dateSelection.startDate || !dateSelection.endDate) return;
    analyzeAllClients(dailyBreakdowns, dateSelection.startDate, dateSelection.endDate);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />

      <main className="flex-1 w-full">
        {/* Page header */}
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/client-health')} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold">Daily Ad Reports</h1>
                    <p className="text-xs text-muted-foreground">
                      {isLoading
                        ? 'Loading...'
                        : isRangeMode
                          ? `${clientCount} client${clientCount !== 1 ? 's' : ''} over ${rangeDayCount} day${rangeDayCount !== 1 ? 's' : ''}`
                          : `${clientCount} client${clientCount !== 1 ? 's' : ''} reviewed`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Deep analysis button (range mode only) */}
                {isRangeMode && !isLoading && reports.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={handleRunDeepAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Brain className="h-3.5 w-3.5" />
                    )}
                    {isAnalyzing
                      ? `Analyzing (${loadingClients.size} left)...`
                      : analyses.size > 0
                        ? 'Re-run Analysis'
                        : 'Run Deep Analysis'}
                  </Button>
                )}

                {/* Range mode indicator badge */}
                {isRangeMode && (
                  <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary hidden sm:flex">
                    Range Mode
                  </Badge>
                )}

                {isRegenerating ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-amber-500/30 text-amber-400"
                    onClick={stopPolling}
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {regenProgress.total > 0
                      ? `${regenProgress.done}/${regenProgress.total} — ${regenProgress.current}`
                      : 'Starting...'}
                    {' '}(stop)
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={handleRegenerate}
                    disabled={isLoading}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Regenerate Reports
                  </Button>
                )}

                <Button variant="ghost" size="icon" onClick={reload} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>

                <ReportDatePicker
                  dateSelection={dateSelection}
                  availableDates={availableDates}
                  onDateChange={setSelectedDate}
                  onRangeChange={setRange}
                  onModeChange={(mode) => {
                    clearAnalyses();
                    setMode(mode);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">No ad reviews found</p>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                {dateSelection.singleDate
                  ? `No reviews were generated for ${dateSelection.singleDate}. Try selecting a different date or run ad reviews from Client Health.`
                  : isRangeMode && dateSelection.startDate
                    ? `No reviews found between ${dateSelection.startDate} and ${dateSelection.endDate}. Try a different range.`
                    : 'No ad reviews have been generated yet. Run ad reviews from the Client Health page.'}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => navigate('/client-health')}>
                  Go to Client Health
                </Button>
                {isRegenerating ? (
                  <Button variant="outline" className="gap-2 border-amber-500/30 text-amber-400" onClick={stopPolling}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {regenProgress.total > 0 ? `${regenProgress.done}/${regenProgress.total} — ${regenProgress.current}` : 'Starting...'} (stop)
                  </Button>
                ) : (
                  <Button onClick={handleRegenerate} className="gap-2">
                    <Zap className="h-4 w-4" />
                    Regenerate Reports
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Sticky TOC sidebar */}
              <div className="hidden lg:block w-56 shrink-0">
                <div className="sticky top-[85px]">
                  <ReportTableOfContents reports={reports} />
                </div>
              </div>

              {/* Report cards */}
              <div className="flex-1 min-w-0 space-y-10">
                {reports.map((report) => (
                  <ClientReportCard
                    key={report.id}
                    report={report}
                    isRangeMode={isRangeMode}
                    deepAnalysis={analyses.get(report.clientName) || null}
                    isAnalysisLoading={loadingClients.has(report.clientName)}
                    autoOptimizeData={autoOptimizeData.get(report.clientName) || null}
                    recGetStatus={getStatus}
                    recGetError={getError}
                    recOnApprove={approve}
                    recOnReject={reject}
                    recOnExecute={execute}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

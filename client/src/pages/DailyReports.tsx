import { useState, useRef, useEffect } from 'react';
import { Loader2, BarChart3, ArrowLeft, RefreshCw, Brain, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminHeader from '@/components/AdminHeader';
import { useDailyReports } from '@/hooks/useDailyReports';
import { useDeepAnalysis } from '@/hooks/useDeepAnalysis';
import { useRecommendationActions } from '@/hooks/useRecommendationActions';
import { useAutoOptimizeData } from '@/hooks/useAutoOptimizeData';
import { useAutoOptimizeMemory } from '@/hooks/useAutoOptimizeMemory';
import { ReportDatePicker } from '@/components/daily-reports/ReportDatePicker';
import { AutoUpdatesDashboard } from '@/components/daily-reports/AutoUpdatesDashboard';
import { ClientsOverview } from '@/components/daily-reports/ClientsOverview';
import { ClientDetailView } from '@/components/daily-reports/ClientDetailView';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function DailyReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ done: 0, total: 0, current: '' });
  const cancelRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drill-down state: null = overview, string = client detail
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    cancelRef.current = false;

    try {
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

      const startTime = Date.now();
      let launched = 0;

      const today = new Date().toISOString().split('T')[0];
      const { data: existingReports } = await supabase
        .from('ad_review_history')
        .select('client_name')
        .eq('review_date', today)
        .gte('created_at', new Date(startTime - 60000).toISOString());
      const alreadyDone = new Set((existingReports || []).map((r: any) => r.client_name));

      const launchNext = async () => {
        for (const clientName of clients) {
          if (cancelRef.current) break;
          if (alreadyDone.has(clientName)) continue;

          launched++;
          setRegenProgress({ done: alreadyDone.size, total: clients.length, current: `Launched ${launched}/${clients.length}` });

          supabase.functions.invoke('bulk-ad-review', {
            body: { clientName },
          }).catch(() => {});

          await new Promise(r => setTimeout(r, 3000));
        }
      };

      launchNext();

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

  const [activeView, setActiveView] = useState<'reports' | 'auto-updates'>('reports');

  const { autoOptimizeData, isLoadingAutoOptimize } = useAutoOptimizeData(
    dateSelection.startDate || dateSelection.singleDate,
    dateSelection.endDate || dateSelection.singleDate
  );

  const { memories } = useAutoOptimizeMemory();

  // Reset drill-down when date changes
  useEffect(() => {
    setSelectedClient(null);
  }, [dateSelection.singleDate, dateSelection.startDate, dateSelection.endDate]);

  const handleRunDeepAnalysis = () => {
    if (!dateSelection.startDate || !dateSelection.endDate) return;
    analyzeAllClients(dailyBreakdowns, dateSelection.startDate, dateSelection.endDate);
  };

  // Find the selected client's report
  const selectedReport = selectedClient
    ? reports.find(r => r.clientName === selectedClient) ?? null
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />

      <main className="flex-1 w-full">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'reports' | 'auto-updates')}>
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
                {/* View toggle */}
                <TabsList className="h-8">
                  <TabsTrigger value="reports" className="text-xs gap-1.5 px-3 h-7">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Daily Reports
                  </TabsTrigger>
                  <TabsTrigger value="auto-updates" className="text-xs gap-1.5 px-3 h-7">
                    <Zap className="h-3.5 w-3.5" />
                    Auto Updates
                    {autoOptimizeData.size > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1 h-4 min-w-4 flex items-center justify-center">
                        {autoOptimizeData.size}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Deep analysis button (range mode only) */}
                {activeView === 'reports' && isRangeMode && !isLoading && reports.length > 0 && (
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
                {activeView === 'reports' && isRangeMode && (
                  <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary hidden sm:flex">
                    Range Mode
                  </Badge>
                )}

                {activeView === 'reports' && (isRegenerating ? (
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
                ))}

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
          <TabsContent value="reports" className="mt-0">
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
            ) : selectedReport ? (
              /* Level 2: Client Detail View */
              <ClientDetailView
                report={selectedReport}
                onBack={() => setSelectedClient(null)}
                isRangeMode={isRangeMode}
                deepAnalysis={analyses.get(selectedReport.clientName) || null}
                getStatus={getStatus}
                getError={getError}
                onApprove={approve}
                onReject={reject}
                onExecute={execute}
              />
            ) : (
              /* Level 1: Overview Grid */
              <ClientsOverview
                reports={reports}
                onSelectClient={setSelectedClient}
              />
            )}
          </TabsContent>

          <TabsContent value="auto-updates" className="mt-0">
            <AutoUpdatesDashboard
              autoOptimizeData={autoOptimizeData}
              memories={memories}
              isLoading={isLoadingAutoOptimize}
            />
          </TabsContent>
        </div>
        </Tabs>
      </main>
    </div>
  );
}

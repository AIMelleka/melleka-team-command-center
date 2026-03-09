import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClientDailyReport, DateRangeSelection, DateMode, DatePreset } from '@/types/dailyReports';
import { subDays, format } from 'date-fns';
import { parseCurrency } from '@/components/daily-reports/shared';

function normalizeReport(row: any): ClientDailyReport {
  const fullAnalysis = row.seo_data?.fullAnalysis || {};

  return {
    id: row.id,
    clientName: row.client_name,
    reviewDate: row.review_date,
    dateRangeStart: row.date_range_start,
    dateRangeEnd: row.date_range_end,
    updatedAt: row.updated_at || row.created_at,
    industry: row.industry || null,
    summary: row.summary || fullAnalysis.summary || null,
    platforms: Array.isArray(row.platforms) && row.platforms.length > 0
      ? row.platforms
      : fullAnalysis.platforms || [],
    cplCpaAnalysis: fullAnalysis.cplCpaAnalysis || null,
    insights: Array.isArray(row.insights) && row.insights.length > 0
      ? row.insights
      : fullAnalysis.insights || [],
    recommendations: Array.isArray(row.recommendations) && row.recommendations.length > 0
      ? row.recommendations
      : fullAnalysis.recommendations || [],
    weekOverWeek: Array.isArray(row.week_over_week) && row.week_over_week.length > 0
      ? row.week_over_week
      : fullAnalysis.weekOverWeek || [],
    competitorInsights: fullAnalysis.competitorInsights || [],
    crossPlatformSynergies: fullAnalysis.crossPlatformSynergies || [],
    benchmarkAnalysis: fullAnalysis.benchmarkAnalysis
      || (row.benchmark_comparison && Object.keys(row.benchmark_comparison).length > 0
        ? row.benchmark_comparison
        : null),
    historicalComparison: fullAnalysis.historicalComparison || null,
    keyMetrics: fullAnalysis.keyMetrics || null,
    qaValidation: fullAnalysis.qaValidation || null,
    actionItems: Array.isArray(row.action_items) ? row.action_items : [],
    notes: row.notes || null,
  };
}

// Aggregate multiple daily reports for the same client into one summary report
function aggregateClientReports(clientReports: ClientDailyReport[]): ClientDailyReport {
  if (clientReports.length === 1) return clientReports[0];

  // Use the latest report as the base
  const sorted = [...clientReports].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
  const latest = sorted[0];
  const earliest = sorted[sorted.length - 1];

  // Merge all insights (dedupe by title)
  const allInsights = sorted.flatMap(r => r.insights);
  const seenTitles = new Set<string>();
  const mergedInsights = allInsights.filter(i => {
    if (seenTitles.has(i.title)) return false;
    seenTitles.add(i.title);
    return true;
  });

  // Merge all recommendations (dedupe by action text)
  const allRecs = sorted.flatMap(r => r.recommendations);
  const seenActions = new Set<string>();
  const mergedRecs = allRecs.filter(r => {
    if (seenActions.has(r.action)) return false;
    seenActions.add(r.action);
    return true;
  });

  return {
    ...latest,
    dateRangeStart: earliest.reviewDate,
    dateRangeEnd: latest.reviewDate,
    summary: latest.summary,
    insights: mergedInsights,
    recommendations: mergedRecs,
    // Use latest for everything else (platforms, cplCpa, etc.)
  };
}

function computeRangeFromPreset(preset: DatePreset, latestDate: string): { start: string; end: string } {
  const end = new Date(latestDate + 'T12:00:00');
  const daysMap: Record<DatePreset, number> = { last_7: 7, last_14: 14, last_30: 30, custom: 0 };
  const days = daysMap[preset] || 7;
  const start = subDays(end, days - 1);
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
}

export function useDailyReports() {
  const [reports, setReports] = useState<ClientDailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dailyBreakdowns, setDailyBreakdowns] = useState<Map<string, ClientDailyReport[]>>(new Map());

  const [dateSelection, setDateSelection] = useState<DateRangeSelection>({
    mode: 'single',
    singleDate: null,
    startDate: null,
    endDate: null,
    preset: null,
  });

  // Backward-compat getters
  const selectedDate = dateSelection.singleDate;
  const isRangeMode = dateSelection.mode === 'range';

  // Load available review dates
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ad_review_history')
        .select('review_date')
        .order('review_date', { ascending: false })
        .limit(500);

      if (data) {
        const unique = [...new Set(data.map((r: any) => r.review_date))];
        setAvailableDates(unique);
        if (!dateSelection.singleDate && unique.length > 0) {
          setDateSelection(prev => ({ ...prev, singleDate: unique[0] }));
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load reports for a single date
  const loadReportsSingle = useCallback(async (date: string) => {
    setIsLoading(true);
    setDailyBreakdowns(new Map());
    try {
      const { data, error } = await supabase
        .from('ad_review_history')
        .select('*')
        .eq('review_date', date)
        .order('client_name', { ascending: true });

      if (error) {
        console.error('Failed to load daily reports:', error);
        setReports([]);
        return;
      }

      const byClient = new Map<string, any>();
      for (const row of data || []) {
        const existing = byClient.get(row.client_name);
        if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
          byClient.set(row.client_name, row);
        }
      }

      const normalized = Array.from(byClient.values()).map(normalizeReport);
      normalized.sort((a, b) => a.clientName.localeCompare(b.clientName));
      setReports(normalized);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load reports for a date range
  const loadReportsRange = useCallback(async (startDate: string, endDate: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_review_history')
        .select('*')
        .gte('review_date', startDate)
        .lte('review_date', endDate)
        .order('client_name', { ascending: true })
        .order('review_date', { ascending: false });

      if (error) {
        console.error('Failed to load range reports:', error);
        setReports([]);
        setDailyBreakdowns(new Map());
        return;
      }

      // Group by client, keeping all daily reports
      const byClient = new Map<string, ClientDailyReport[]>();
      for (const row of data || []) {
        const normalized = normalizeReport(row);
        const existing = byClient.get(normalized.clientName) || [];
        existing.push(normalized);
        byClient.set(normalized.clientName, existing);
      }

      setDailyBreakdowns(byClient);

      // Aggregate per client
      const aggregated: ClientDailyReport[] = [];
      for (const [, clientReports] of byClient) {
        aggregated.push(aggregateClientReports(clientReports));
      }
      aggregated.sort((a, b) => a.clientName.localeCompare(b.clientName));
      setReports(aggregated);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // React to dateSelection changes
  useEffect(() => {
    if (dateSelection.mode === 'single' && dateSelection.singleDate) {
      loadReportsSingle(dateSelection.singleDate);
    } else if (dateSelection.mode === 'range' && dateSelection.startDate && dateSelection.endDate) {
      loadReportsRange(dateSelection.startDate, dateSelection.endDate);
    }
  }, [dateSelection.mode, dateSelection.singleDate, dateSelection.startDate, dateSelection.endDate, loadReportsSingle, loadReportsRange]);

  // Convenience setter for single date
  const handleSetSelectedDate = useCallback((date: string) => {
    setDateSelection(prev => ({ ...prev, mode: 'single', singleDate: date, preset: null }));
  }, []);

  // Convenience setter for range
  const handleSetRange = useCallback((start: string, end: string, preset: DatePreset) => {
    setDateSelection(prev => ({ ...prev, mode: 'range', startDate: start, endDate: end, preset }));
  }, []);

  // Convenience setter for mode
  const handleSetMode = useCallback((mode: DateMode) => {
    if (mode === 'range' && availableDates.length > 0) {
      const { start, end } = computeRangeFromPreset('last_7', availableDates[0]);
      setDateSelection(prev => ({ ...prev, mode, startDate: start, endDate: end, preset: 'last_7' }));
    } else {
      setDateSelection(prev => ({ ...prev, mode }));
    }
  }, [availableDates]);

  const clientCount = reports.length;
  const rangeDayCount = isRangeMode && dateSelection.startDate && dateSelection.endDate
    ? dailyBreakdowns.size > 0
      ? new Set(Array.from(dailyBreakdowns.values()).flatMap(r => r.map(d => d.reviewDate))).size
      : 0
    : 0;

  const reload = useCallback(() => {
    if (dateSelection.mode === 'single' && dateSelection.singleDate) {
      loadReportsSingle(dateSelection.singleDate);
    } else if (dateSelection.mode === 'range' && dateSelection.startDate && dateSelection.endDate) {
      loadReportsRange(dateSelection.startDate, dateSelection.endDate);
    }
  }, [dateSelection, loadReportsSingle, loadReportsRange]);

  return {
    reports,
    isLoading,
    selectedDate,
    setSelectedDate: handleSetSelectedDate,
    availableDates,
    clientCount,
    reload,
    // New range support
    dateSelection,
    setDateSelection,
    isRangeMode,
    dailyBreakdowns,
    setRange: handleSetRange,
    setMode: handleSetMode,
    rangeDayCount,
  };
}

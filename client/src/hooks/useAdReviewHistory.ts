import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdReviewRecord {
  id: string;
  client_name: string;
  review_date: string;
  date_range_start: string;
  date_range_end: string;
  platforms: any[];
  summary: string | null;
  insights: any[];
  recommendations: any[];
  week_over_week: any[];
  industry: string | null;
  benchmark_comparison: Record<string, any>;
  seo_data: Record<string, any>;
  screenshots: string[];
  action_items: any[];
  notes: string | null;
  changes_made: any[];
  previous_review_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveReviewParams {
  clientName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  platforms: any[];
  summary: string;
  insights: any[];
  recommendations: any[];
  weekOverWeek: any[];
  industry?: string;
  benchmarkComparison?: Record<string, any>;
  seoData?: Record<string, any>;
  actionItems?: any[];
  notes?: string;
  changesMade?: any[];
  previousReviewId?: string;
}

export function useAdReviewHistory(clientName?: string) {
  const { toast } = useToast();
  const [history, setHistory] = useState<AdReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previousReview, setPreviousReview] = useState<AdReviewRecord | null>(null);

  // Load history for a client (last 365 days)
  const loadHistory = useCallback(async (client: string) => {
    if (!client.trim()) return;
    
    setIsLoading(true);
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const { data, error } = await supabase
        .from('ad_review_history')
        .select('*')
        .ilike('client_name', `%${client}%`)
        .gte('review_date', oneYearAgo.toISOString().split('T')[0])
        .order('review_date', { ascending: false })
        .limit(52); // ~1 per week for a year

      if (error) throw error;
      
      // Type assertion for the data since types.ts doesn't know about new table yet
      setHistory((data || []) as unknown as AdReviewRecord[]);
      if (data && data.length > 0) {
        setPreviousReview((data[0] as unknown) as AdReviewRecord);
      }
    } catch (error) {
      console.error('Error loading ad review history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a new review to history
  const saveReview = useCallback(async (params: SaveReviewParams): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const record = {
        client_name: params.clientName,
        date_range_start: params.dateRangeStart,
        date_range_end: params.dateRangeEnd,
        platforms: params.platforms,
        summary: params.summary,
        insights: params.insights,
        recommendations: params.recommendations,
        week_over_week: params.weekOverWeek,
        industry: params.industry || null,
        benchmark_comparison: params.benchmarkComparison || {},
        seo_data: params.seoData || {},
        action_items: params.actionItems || [],
        notes: params.notes || null,
        changes_made: params.changesMade || [],
        previous_review_id: params.previousReviewId || null,
        created_by: userData?.user?.id || null,
      };

      const { data, error } = await supabase
        .from('ad_review_history')
        .insert(record)
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Review Saved",
        description: "This review has been added to the 365-day history."
      });

      // Reload history
      await loadHistory(params.clientName);
      
      return data?.id || null;
    } catch (error) {
      console.error('Error saving ad review:', error);
      toast({
        title: "Save Failed",
        description: "Could not save review to history. You may not have admin access.",
        variant: "destructive"
      });
      return null;
    }
  }, [toast, loadHistory]);

  // Update notes on an existing review
  const updateNotes = useCallback(async (reviewId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('ad_review_history')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: "Notes Updated",
        description: "Your notes have been saved."
      });
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  }, [toast]);

  // Add action items / changes made
  const recordChange = useCallback(async (reviewId: string, change: { action: string; date: string; result?: string }) => {
    try {
      // Get current changes
      const { data: current, error: fetchError } = await supabase
        .from('ad_review_history')
        .select('changes_made')
        .eq('id', reviewId)
        .single();

      if (fetchError) throw fetchError;

      const existingChanges = (current?.changes_made as any[]) || [];
      const updatedChanges = [...existingChanges, change];

      const { error } = await supabase
        .from('ad_review_history')
        .update({ 
          changes_made: updatedChanges,
          updated_at: new Date().toISOString() 
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: "Change Recorded",
        description: "This action has been logged to the review history."
      });
    } catch (error) {
      console.error('Error recording change:', error);
    }
  }, [toast]);

  // Compare current metrics to previous review
  const compareWithPrevious = useCallback((currentPlatforms: any[]): any[] => {
    if (!previousReview?.platforms?.length || !currentPlatforms?.length) return [];

    const comparisons: any[] = [];
    
    for (const current of currentPlatforms) {
      const prev = previousReview.platforms.find((p: any) => 
        p.name?.toLowerCase() === current.name?.toLowerCase()
      );
      
      if (prev) {
        const parseMetric = (val: string) => parseFloat(val?.replace(/[^0-9.-]/g, '') || '0');
        
        const metrics = ['spend', 'ctr', 'cpc', 'roas', 'conversions'];
        const changes: any = { platform: current.name };
        
        for (const metric of metrics) {
          const currentVal = parseMetric(current[metric]);
          const prevVal = parseMetric(prev[metric]);
          
          if (prevVal > 0) {
            const pctChange = ((currentVal - prevVal) / prevVal) * 100;
            changes[metric] = {
              current: current[metric],
              previous: prev[metric],
              change: pctChange.toFixed(1) + '%',
              direction: pctChange > 0 ? 'up' : pctChange < 0 ? 'down' : 'stable'
            };
          }
        }
        
        comparisons.push(changes);
      }
    }
    
    return comparisons;
  }, [previousReview]);

  // Load history when clientName changes
  useEffect(() => {
    if (clientName) {
      loadHistory(clientName);
    }
  }, [clientName, loadHistory]);

  return {
    history,
    previousReview,
    isLoading,
    loadHistory,
    saveReview,
    updateNotes,
    recordChange,
    compareWithPrevious,
  };
}

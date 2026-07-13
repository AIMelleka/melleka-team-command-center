import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClientGoals } from '@/components/daily-reports/scoring';

// All columns we want — includes scoring goals, client profile, and report context.
// Gracefully handles columns that may not exist yet (Supabase returns null for unknown columns
// rather than erroring when using the JS client, so missing cols just come back as undefined).
const GOAL_COLUMNS = [
  'client_name',
  'industry',
  'primary_conversion_goal',
  'target_cpl',
  'target_cpa',
  'target_roas',
  'monthly_budget',
  'monthly_lead_target',
  'monthly_conversion_target',
  'client_notes',
  'report_focus',
  'targeting_context',
].join(', ');

export function useClientGoals() {
  const [goalsMap, setGoalsMap] = useState<Map<string, ClientGoals>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('managed_clients')
        .select(GOAL_COLUMNS)
        .eq('is_active', true);

      if (cancelled) return;

      if (error) {
        console.error('Failed to load client goals:', error);
        // Fall back to name-only if goal columns don't exist yet
        const { data: fallback } = await supabase
          .from('managed_clients')
          .select('client_name, industry, primary_conversion_goal')
          .eq('is_active', true);
        const map = new Map<string, ClientGoals>();
        for (const row of fallback || []) {
          const r = row as Record<string, unknown>;
          map.set(row.client_name as string, {
            industry: r.industry as string | null ?? null,
            primary_conversion_goal: r.primary_conversion_goal as string | null ?? null,
          });
        }
        setGoalsMap(map);
        setIsLoading(false);
        return;
      }

      const map = new Map<string, ClientGoals>();
      for (const row of data || []) {
        const r = row as Record<string, unknown>;
        const goals: ClientGoals = {
          target_cpl:                 r.target_cpl as number | null ?? null,
          target_cpa:                 r.target_cpa as number | null ?? null,
          target_roas:                r.target_roas as number | null ?? null,
          monthly_budget:             r.monthly_budget as number | null ?? null,
          monthly_lead_target:        r.monthly_lead_target as number | null ?? null,
          monthly_conversion_target:  r.monthly_conversion_target as number | null ?? null,
          industry:                   r.industry as string | null ?? null,
          primary_conversion_goal:    r.primary_conversion_goal as string | null ?? null,
          client_notes:               r.client_notes as string | null ?? null,
          report_focus:               r.report_focus as string | null ?? null,
          targeting_context:          r.targeting_context as string | null ?? null,
        };
        map.set(row.client_name as string, goals);
      }

      setGoalsMap(map);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const updateGoals = useCallback(async (clientName: string, goals: ClientGoals) => {
    // Optimistic update
    setGoalsMap(prev => {
      const next = new Map(prev);
      next.set(clientName, goals);
      return next;
    });

    const { error } = await supabase
      .from('managed_clients')
      .update({
        target_cpl:                 goals.target_cpl,
        target_cpa:                 goals.target_cpa,
        target_roas:                goals.target_roas,
        monthly_budget:             goals.monthly_budget,
        monthly_lead_target:        goals.monthly_lead_target,
        monthly_conversion_target:  goals.monthly_conversion_target,
        industry:                   goals.industry,
        primary_conversion_goal:    goals.primary_conversion_goal,
        client_notes:               goals.client_notes,
        report_focus:               goals.report_focus,
        targeting_context:          goals.targeting_context,
      } as Record<string, unknown>)
      .eq('client_name', clientName);

    if (error) {
      console.error('Failed to save client goals:', error);
      throw error;
    }
  }, []);

  return { goalsMap, isLoading, updateGoals };
}

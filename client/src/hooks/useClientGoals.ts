import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClientGoals } from '@/components/daily-reports/scoring';

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
  'secondary_conversion_goal',
  'secondary_target_cpa',
  'secondary_target_cpl',
  'secondary_monthly_target',
  'tertiary_conversion_goal',
  'tertiary_target_cpa',
  'tertiary_target_cpl',
  'tertiary_monthly_target',
  'platform_settings',
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
      // Load goals and account mappings in parallel
      const [goalsResult, mappingsResult] = await Promise.all([
        supabase.from('managed_clients').select(GOAL_COLUMNS).eq('is_active', true),
        supabase.from('client_account_mappings').select('client_name, platform'),
      ]);

      if (cancelled) return;

      // Only PPC platforms are scored — exclude CRM/analytics/social organic accounts
      const PPC_PLATFORMS = new Set(['google_ads', 'meta_ads', 'bing_ads', 'reddit_ads', 'linkedin_ads', 'tiktok_ads']);

      // Build a map of client_name -> PPC platform keys only (e.g. ['google_ads', 'meta_ads'])
      const platformsByClient = new Map<string, string[]>();
      for (const row of mappingsResult.data || []) {
        const name = row.client_name as string;
        if (!platformsByClient.has(name)) platformsByClient.set(name, []);
        const platform = row.platform as string;
        if (platform && PPC_PLATFORMS.has(platform)) platformsByClient.get(name)!.push(platform);
      }

      const { data, error } = goalsResult;

      if (error) {
        console.error('Failed to load client goals:', error);
        // Fall back to minimal columns if new ones don't exist yet
        const { data: fallback } = await supabase
          .from('managed_clients')
          .select('client_name, industry, primary_conversion_goal')
          .eq('is_active', true);
        const map = new Map<string, ClientGoals>();
        for (const row of fallback || []) {
          const r = row as Record<string, unknown>;
          const clientName = row.client_name as string;
          map.set(clientName, {
            industry: r.industry as string | null ?? null,
            primary_conversion_goal: r.primary_conversion_goal as string | null ?? null,
            active_platforms: platformsByClient.get(clientName) ?? null,
          });
        }
        setGoalsMap(map);
        setIsLoading(false);
        return;
      }

      const map = new Map<string, ClientGoals>();
      for (const row of data || []) {
        const r = row as Record<string, unknown>;
        const clientName = row.client_name as string;
        const goals: ClientGoals = {
          industry:                   r.industry as string | null ?? null,
          primary_conversion_goal:    r.primary_conversion_goal as string | null ?? null,
          target_cpl:                 r.target_cpl as number | null ?? null,
          target_cpa:                 r.target_cpa as number | null ?? null,
          target_roas:                r.target_roas as number | null ?? null,
          monthly_budget:             r.monthly_budget as number | null ?? null,
          monthly_lead_target:        r.monthly_lead_target as number | null ?? null,
          monthly_conversion_target:  r.monthly_conversion_target as number | null ?? null,
          secondary_conversion_goal:  r.secondary_conversion_goal as string | null ?? null,
          secondary_target_cpa:       r.secondary_target_cpa as number | null ?? null,
          secondary_target_cpl:       r.secondary_target_cpl as number | null ?? null,
          secondary_monthly_target:   r.secondary_monthly_target as number | null ?? null,
          tertiary_conversion_goal:   r.tertiary_conversion_goal as string | null ?? null,
          tertiary_target_cpa:        r.tertiary_target_cpa as number | null ?? null,
          tertiary_target_cpl:        r.tertiary_target_cpl as number | null ?? null,
          tertiary_monthly_target:    r.tertiary_monthly_target as number | null ?? null,
          platform_settings:          (r.platform_settings as Record<string, any>) ?? null,
          client_notes:               r.client_notes as string | null ?? null,
          report_focus:               r.report_focus as string | null ?? null,
          targeting_context:          r.targeting_context as string | null ?? null,
          active_platforms:           platformsByClient.get(clientName) ?? null,
        };
        map.set(clientName, goals);
      }

      setGoalsMap(map);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const updateGoals = useCallback(async (clientName: string, goals: ClientGoals) => {
    // Optimistic update — preserve active_platforms (derived, not stored in DB)
    setGoalsMap(prev => {
      const next = new Map(prev);
      const existing = prev.get(clientName);
      next.set(clientName, {
        ...goals,
        active_platforms: existing?.active_platforms ?? goals.active_platforms,
      });
      return next;
    });

    const { error } = await supabase
      .from('managed_clients')
      .update({
        industry:                   goals.industry,
        primary_conversion_goal:    goals.primary_conversion_goal,
        target_cpl:                 goals.target_cpl,
        target_cpa:                 goals.target_cpa,
        target_roas:                goals.target_roas,
        monthly_budget:             goals.monthly_budget,
        monthly_lead_target:        goals.monthly_lead_target,
        monthly_conversion_target:  goals.monthly_conversion_target,
        secondary_conversion_goal:  goals.secondary_conversion_goal,
        secondary_target_cpa:       goals.secondary_target_cpa,
        secondary_target_cpl:       goals.secondary_target_cpl,
        secondary_monthly_target:   goals.secondary_monthly_target,
        tertiary_conversion_goal:   goals.tertiary_conversion_goal,
        tertiary_target_cpa:        goals.tertiary_target_cpa,
        tertiary_target_cpl:        goals.tertiary_target_cpl,
        tertiary_monthly_target:    goals.tertiary_monthly_target,
        platform_settings:          goals.platform_settings,
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

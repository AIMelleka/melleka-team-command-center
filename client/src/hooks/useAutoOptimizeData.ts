import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AutoOptimizeChange {
  id: string;
  clientName: string;
  platform: string;
  changeType: string;
  entityType: string | null;
  entityName: string | null;
  beforeValue: Record<string, unknown>;
  afterValue: Record<string, unknown>;
  aiRationale: string | null;
  confidence: string;
  approvalStatus: string;
  executedAt: string | null;
  executionError: string | null;
  createdAt: string;
}

export interface AutoOptimizeResult {
  changeId: string;
  outcome: 'improved' | 'declined' | 'no_change' | string;
  aiAssessment: string | null;
}

export interface ClientAutoOptimizeData {
  enabled: boolean;
  platform: string;
  changes: AutoOptimizeChange[];
  results: Map<string, AutoOptimizeResult>;
  successRate: number;
  totalExecuted: number;
  totalImproved: number;
}

export function useAutoOptimizeData(startDate: string | null, endDate: string | null) {
  const [data, setData] = useState<Map<string, ClientAutoOptimizeData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);

    try {
      // 1. Fetch all clients with auto_mode_enabled
      const { data: settings } = await supabase
        .from('ppc_client_settings')
        .select('client_name, auto_mode_enabled, auto_mode_platform')
        .eq('auto_mode_enabled', true);

      if (!settings || settings.length === 0) {
        setData(new Map());
        setIsLoading(false);
        return;
      }

      const enabledClients = new Map(
        settings.map(s => [s.client_name, s.auto_mode_platform || 'both'])
      );

      // 2. Fetch auto-approved changes in the date range
      const { data: changes } = await supabase
        .from('ppc_proposed_changes')
        .select('id, client_name, platform, change_type, entity_type, entity_name, before_value, after_value, ai_rationale, confidence, approval_status, executed_at, execution_error, created_at')
        .in('client_name', Array.from(enabledClients.keys()))
        .in('approval_status', ['auto_approved', 'approved'])
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // 3. Fetch results for those changes
      const changeIds = (changes || []).map(c => c.id);
      let results: any[] = [];
      if (changeIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('ppc_change_results')
          .select('change_id, outcome, ai_assessment')
          .in('change_id', changeIds);
        results = resultsData || [];
      }

      // Build results map
      const resultsMap = new Map<string, AutoOptimizeResult>();
      for (const r of results) {
        resultsMap.set(r.change_id, {
          changeId: r.change_id,
          outcome: r.outcome,
          aiAssessment: r.ai_assessment,
        });
      }

      // Build per-client data
      const clientData = new Map<string, ClientAutoOptimizeData>();

      for (const [clientName, platform] of enabledClients) {
        const clientChanges: AutoOptimizeChange[] = (changes || [])
          .filter(c => c.client_name === clientName)
          .map(c => ({
            id: c.id,
            clientName: c.client_name,
            platform: c.platform || 'both',
            changeType: c.change_type || 'advisory',
            entityType: c.entity_type,
            entityName: c.entity_name,
            beforeValue: c.before_value || {},
            afterValue: c.after_value || {},
            aiRationale: c.ai_rationale,
            confidence: c.confidence || 'medium',
            approvalStatus: c.approval_status,
            executedAt: c.executed_at,
            executionError: c.execution_error,
            createdAt: c.created_at,
          }));

        const clientResults = new Map<string, AutoOptimizeResult>();
        for (const ch of clientChanges) {
          const result = resultsMap.get(ch.id);
          if (result) clientResults.set(ch.id, result);
        }

        const executed = clientChanges.filter(c => c.executedAt);
        const improved = executed.filter(c => {
          const r = clientResults.get(c.id);
          return r && (r.outcome === 'improved' || r.outcome === 'positive');
        });

        clientData.set(clientName, {
          enabled: true,
          platform,
          changes: clientChanges,
          results: clientResults,
          successRate: executed.length > 0 ? (improved.length / executed.length) * 100 : 0,
          totalExecuted: executed.length,
          totalImproved: improved.length,
        });
      }

      setData(clientData);
    } catch (err) {
      console.error('[useAutoOptimizeData] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  return { autoOptimizeData: data, isLoadingAutoOptimize: isLoading };
}

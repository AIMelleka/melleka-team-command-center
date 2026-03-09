import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DeepAnalysis, ClientDailyReport } from '@/types/dailyReports';

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

export function useDeepAnalysis() {
  const [analyses, setAnalyses] = useState<Map<string, DeepAnalysis>>(new Map());
  const [loadingClients, setLoadingClients] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const analyzeClient = useCallback(async (
    clientName: string,
    startDate: string,
    endDate: string,
    reports: ClientDailyReport[],
  ): Promise<DeepAnalysis | null> => {
    setLoadingClients(prev => new Set(prev).add(clientName));
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/deep-analysis`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ clientName, startDate, endDate, reports }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const { analysis } = await res.json();
      setAnalyses(prev => new Map(prev).set(clientName, analysis));
      return analysis;
    } catch (err: any) {
      console.error(`[deep-analysis] Failed for ${clientName}:`, err);
      setError(err.message);
      return null;
    } finally {
      setLoadingClients(prev => {
        const next = new Set(prev);
        next.delete(clientName);
        return next;
      });
    }
  }, []);

  const analyzeAllClients = useCallback(async (
    dailyBreakdowns: Map<string, ClientDailyReport[]>,
    startDate: string,
    endDate: string,
  ) => {
    const entries = Array.from(dailyBreakdowns.entries());
    if (entries.length === 0) return;

    setError(null);

    // Process 3 at a time to avoid rate limits
    const concurrency = 3;
    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(([clientName, reports]) =>
          analyzeClient(clientName, startDate, endDate, reports)
        )
      );
    }
  }, [analyzeClient]);

  const clearAnalyses = useCallback(() => {
    setAnalyses(new Map());
    setError(null);
  }, []);

  return {
    analyses,
    loadingClients,
    error,
    analyzeClient,
    analyzeAllClients,
    clearAnalyses,
    isAnalyzing: loadingClients.size > 0,
  };
}

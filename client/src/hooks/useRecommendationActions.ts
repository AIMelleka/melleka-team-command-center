import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ActionableRecommendation } from '@/types/dailyReports';

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

type RecStatus = ActionableRecommendation['approvalStatus'];

export function useRecommendationActions() {
  // Track status by a local key (index-based since recs don't have IDs until approved)
  const [statuses, setStatuses] = useState<Map<string, RecStatus>>(new Map());
  const [changeIds, setChangeIds] = useState<Map<string, string>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());

  const approve = useCallback(async (rec: ActionableRecommendation, clientName: string, localKey: string): Promise<string | null> => {
    setStatuses(prev => new Map(prev).set(localKey, 'approved'));
    try {
      const res = await fetch(`${API_BASE}/recommendations/approve`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ recommendation: rec, clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approve failed');

      setChangeIds(prev => new Map(prev).set(localKey, data.change.id));
      return data.change.id;
    } catch (err: any) {
      setStatuses(prev => new Map(prev).set(localKey, 'pending'));
      setErrors(prev => new Map(prev).set(localKey, err.message));
      return null;
    }
  }, []);

  const reject = useCallback(async (localKey: string) => {
    const cid = changeIds.get(localKey);
    setStatuses(prev => new Map(prev).set(localKey, 'rejected'));

    if (cid) {
      try {
        await fetch(`${API_BASE}/recommendations/reject`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ changeId: cid }),
        });
      } catch (err: any) {
        console.error('[recommendations] Reject failed:', err);
      }
    }
  }, [changeIds]);

  const execute = useCallback(async (localKey: string): Promise<{ ok: boolean; error?: string }> => {
    const cid = changeIds.get(localKey);
    if (!cid) return { ok: false, error: 'No approved change ID found' };

    setExecutingIds(prev => new Set(prev).add(localKey));
    setStatuses(prev => new Map(prev).set(localKey, 'executing'));

    try {
      const res = await fetch(`${API_BASE}/recommendations/execute`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ changeId: cid }),
      });
      const data = await res.json();

      if (data.ok) {
        setStatuses(prev => new Map(prev).set(localKey, 'executed'));
        return { ok: true };
      } else {
        setStatuses(prev => new Map(prev).set(localKey, 'failed'));
        setErrors(prev => new Map(prev).set(localKey, data.error));
        return { ok: false, error: data.error };
      }
    } catch (err: any) {
      setStatuses(prev => new Map(prev).set(localKey, 'failed'));
      setErrors(prev => new Map(prev).set(localKey, err.message));
      return { ok: false, error: err.message };
    } finally {
      setExecutingIds(prev => {
        const next = new Set(prev);
        next.delete(localKey);
        return next;
      });
    }
  }, [changeIds]);

  const getStatus = useCallback((localKey: string): RecStatus => {
    return statuses.get(localKey) || 'pending';
  }, [statuses]);

  const getError = useCallback((localKey: string): string | undefined => {
    return errors.get(localKey);
  }, [errors]);

  return {
    statuses,
    errors,
    executingIds,
    approve,
    reject,
    execute,
    getStatus,
    getError,
  };
}

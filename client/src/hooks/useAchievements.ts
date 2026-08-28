import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.PROD
  ? 'https://api.teams.melleka.com/api'
  : '/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

export interface ReviewEntry {
  id: string;
  employeeName: string;
  platform: 'Yelp' | 'Google' | 'Other';
  note: string;
  addedBy: string;
  addedAt: string;
}

export interface PraiseEntry {
  id: string;
  channel: string;
  text: string;
  praiseKeywords: string[];
  ts: string;
  scannedAt: string;
}

export interface AchievementsData {
  reviews: ReviewEntry[];
  slackPraise: {
    [month: string]: {
      [employeeName: string]: PraiseEntry[];
    };
  };
}

// Personal achievements for current employee (pass notionManagerName)
export function useMyAchievements(employeeName: string | undefined) {
  return useQuery({
    queryKey: ['my-achievements', employeeName],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `${API_BASE}/achievements/my?employeeName=${encodeURIComponent(employeeName!)}`,
        { headers },
      );
      if (!resp.ok) throw new Error('Failed to fetch achievements');
      return resp.json() as Promise<{ reviews: ReviewEntry[]; praiseCounts: Record<string, number> }>;
    },
    enabled: !!employeeName,
    staleTime: 2 * 60 * 1000,
  });
}

// Full achievements data (super admin only)
export function useAllAchievements() {
  return useQuery({
    queryKey: ['all-achievements'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${API_BASE}/achievements`, { headers });
      if (!resp.ok) throw new Error('Failed to fetch achievements');
      return resp.json() as Promise<AchievementsData>;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Add review (super admin)
export function useAddReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employeeName: string; platform: string; note: string }) => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${API_BASE}/achievements/reviews`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('Failed to add review');
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-achievements'] });
      qc.invalidateQueries({ queryKey: ['my-achievements'] });
    },
  });
}

// Remove review (super admin)
export function useRemoveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${API_BASE}/achievements/reviews/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!resp.ok) throw new Error('Failed to remove review');
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-achievements'] });
      qc.invalidateQueries({ queryKey: ['my-achievements'] });
    },
  });
}

// Trigger Slack scan (super admin, fire-and-forget)
export function useSlackScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${API_BASE}/achievements/slack/scan`, {
        method: 'POST',
        headers,
      });
      if (!resp.ok) throw new Error('Failed to trigger scan');
      return resp.json();
    },
    onSuccess: () => {
      // Delay refetch to give the background scan time to write data
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['all-achievements'] });
        qc.invalidateQueries({ queryKey: ['my-achievements'] });
      }, 8000);
    },
  });
}

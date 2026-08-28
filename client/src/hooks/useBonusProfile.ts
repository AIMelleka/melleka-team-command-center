import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

export interface BonusProfile {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  notionManagerName: string;
  bonusEnabled: boolean;
  createdAt: string;
}

export function useBonusProfile() {
  return useQuery<BonusProfile | null>({
    queryKey: ['bonus-profile'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${API_BASE}/task-bonus/my-profile`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error('Failed to fetch bonus profile');
      return resp.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStatus, getCompletedOn, STATUS_GROUPS, type NotionTask } from '@/hooks/useNotionTasks';

const API_BASE = import.meta.env.PROD
  ? 'https://api.teams.melleka.com/api'
  : '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

const DEFAULT_DONE_STATUSES: string[] = STATUS_GROUPS['Complete'] ?? [];

export interface TaskSettingsData {
  doneStatuses: string[];
  allStatusGroups: Record<string, string[]>;
  updatedAt: string;
}

export function useTaskSettings() {
  const { data, isLoading } = useQuery<TaskSettingsData>({
    queryKey: ['task-settings'],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/task-settings`, { headers: await authHeaders() });
      if (!resp.ok) throw new Error('Failed to fetch task settings');
      return resp.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const doneStatuses: string[] = data?.doneStatuses ?? DEFAULT_DONE_STATUSES;

  const isTaskDone = useCallback(
    (task: NotionTask): boolean => {
      const status = getStatus(task.properties);
      return status ? doneStatuses.includes(status.name) : false;
    },
    [doneStatuses],
  );

  return {
    doneStatuses,
    allStatusGroups: data?.allStatusGroups,
    isTaskDone,
    isLoading,
  };
}

export function useIsTaskDoneInRange(dateFrom?: string, dateTo?: string) {
  const { isTaskDone } = useTaskSettings();
  return useCallback(
    (task: NotionTask): boolean => {
      if (!isTaskDone(task)) return false;
      const completedOn = getCompletedOn(task.properties);
      if (completedOn) {
        if (dateFrom && completedOn < dateFrom) return false;
        if (dateTo && completedOn > dateTo) return false;
      }
      return true;
    },
    [isTaskDone, dateFrom, dateTo],
  );
}

export function useSaveTaskSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doneStatuses: string[]) => {
      const resp = await fetch(`${API_BASE}/task-settings`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ doneStatuses }),
      });
      if (!resp.ok) throw new Error('Failed to save task settings');
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-settings'] });
    },
  });
}

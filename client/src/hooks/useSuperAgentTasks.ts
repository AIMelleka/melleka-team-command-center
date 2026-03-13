import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  };
}

export interface SuperAgentTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  requested_by: string | null;
  assigned_to: string;
  category: string | null;
  client_name: string | null;
  conversation_id: string | null;
  links: { label: string; url: string }[] | null;
  error_details: string | null;
  notes: { timestamp: string; text: string }[] | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  total: number;
  inProgress: number;
  completedToday: number;
  errors: number;
}

export interface TaskFilters {
  status?: string;
  category?: string;
  client?: string;
  search?: string;
}

async function fetchTasks(filters: TaskFilters): Promise<SuperAgentTask[]> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.client) params.set("client", filters.client);
  if (filters.search) params.set("search", filters.search);
  const resp = await fetch(`${API_BASE}/super-agent-tasks?${params}`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch tasks");
  return resp.json();
}

async function fetchStats(): Promise<TaskStats> {
  const resp = await fetch(`${API_BASE}/super-agent-tasks/stats`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch stats");
  return resp.json();
}

async function fetchTask(id: string): Promise<SuperAgentTask> {
  const resp = await fetch(`${API_BASE}/super-agent-tasks/${id}`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch task");
  return resp.json();
}

export function useSuperAgentTasks(filters: TaskFilters = {}) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("super_agent_tasks_changes")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "super_agent_tasks" },
        () => {
          qc.invalidateQueries({ queryKey: ["super-agent-tasks"] });
          qc.invalidateQueries({ queryKey: ["super-agent-stats"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["super-agent-tasks", filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 15_000,
  });
}

export function useSuperAgentStats() {
  return useQuery({
    queryKey: ["super-agent-stats"],
    queryFn: fetchStats,
    staleTime: 15_000,
  });
}

export function useSuperAgentTask(id: string | null) {
  return useQuery({
    queryKey: ["super-agent-task", id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  });
}

export interface ToolExecution {
  id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string | null;
  execution_ms: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

async function fetchToolExecutions(taskId: string): Promise<ToolExecution[]> {
  const resp = await fetch(`${API_BASE}/super-agent-tasks/${taskId}/tool-executions`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch tool executions");
  return resp.json();
}

export function useToolExecutions(taskId: string | null) {
  return useQuery({
    queryKey: ["tool-executions", taskId],
    queryFn: () => fetchToolExecutions(taskId!),
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

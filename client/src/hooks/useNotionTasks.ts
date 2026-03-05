import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface NotionTask {
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  properties: Record<string, any>;
  url: string;
}

export interface NotionListResponse {
  results: NotionTask[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface TaskFilters {
  status?: string;
  client?: string;
  priority?: string;
  teammate?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "ascending" | "descending";
}

// ── Helper to extract plain values from Notion properties ─────────────────

export function getTitle(props: Record<string, any>): string {
  const titleProp = props["Task name"];
  if (!titleProp?.title?.length) return "";
  return titleProp.title.map((t: any) => t.plain_text).join("");
}

export function getStatus(props: Record<string, any>): { name: string; color: string } | null {
  const s = props["STATUS"]?.status;
  return s ? { name: s.name, color: s.color } : null;
}

export function getClient(props: Record<string, any>): string {
  const rt = props["CLIENTS"]?.rich_text;
  if (!rt?.length) return "";
  return rt.map((t: any) => t.plain_text).join("");
}

export function getPriority(props: Record<string, any>): { name: string; color: string } | null {
  const s = props["Priority"]?.select;
  return s ? { name: s.name, color: s.color } : null;
}

export function getTeammate(props: Record<string, any>): { name: string; color: string } | null {
  const s = props["Teammate"]?.select;
  return s ? { name: s.name, color: s.color } : null;
}

export function getDue(props: Record<string, any>): string | null {
  return props["Due"]?.date?.start || null;
}

export function getDescription(props: Record<string, any>): string {
  const rt = props["Description"]?.rich_text;
  if (!rt?.length) return "";
  return rt.map((t: any) => t.plain_text).join("");
}

export function getManagers(props: Record<string, any>): { name: string; avatar_url?: string }[] {
  const people = props["Managers"]?.people;
  if (!people?.length) return [];
  return people.map((p: any) => ({ name: p.name || "Unknown", avatar_url: p.avatar_url }));
}

export function getAssign(props: Record<string, any>): { name: string; avatar_url?: string }[] {
  const people = props["Assign"]?.people;
  if (!people?.length) return [];
  return people.map((p: any) => ({ name: p.name || "Unknown", avatar_url: p.avatar_url }));
}

export function getCheckbox(props: Record<string, any>): boolean {
  return props["Done ?"]?.checkbox ?? false;
}

export function getUrl(props: Record<string, any>): string | null {
  return props["URL"]?.url || null;
}

export function getNotes(props: Record<string, any>): string {
  const rt = props["Notes (1)"]?.rich_text;
  if (!rt?.length) return "";
  return rt.map((t: any) => t.plain_text).join("");
}

export function getRejectedReason(props: Record<string, any>): string {
  const rt = props["Rejected Reason"]?.rich_text;
  if (!rt?.length) return "";
  return rt.map((t: any) => t.plain_text).join("");
}

export function getFiles(props: Record<string, any>): { name: string; url: string }[] {
  const files = props["Files & media"]?.files;
  if (!files?.length) return [];
  return files.map((f: any) => ({
    name: f.name || "File",
    url: f.type === "external" ? f.external?.url : f.file?.url,
  }));
}

export function getCreatedTime(props: Record<string, any>): string {
  return props["Date"]?.created_time || "";
}

export function getSecondaryStatus(props: Record<string, any>): { name: string; color: string } | null {
  // The unnamed status field
  const s = props[""]?.status;
  return s ? { name: s.name, color: s.color } : null;
}

// ── Status color mapping ──────────────────────────────────────────────────

const NOTION_COLORS: Record<string, string> = {
  default: "bg-zinc-700 text-zinc-200",
  gray: "bg-zinc-600 text-zinc-200",
  brown: "bg-amber-800 text-amber-100",
  orange: "bg-orange-700 text-orange-100",
  yellow: "bg-yellow-700 text-yellow-100",
  green: "bg-emerald-700 text-emerald-100",
  blue: "bg-blue-700 text-blue-100",
  purple: "bg-purple-700 text-purple-100",
  pink: "bg-pink-700 text-pink-100",
  red: "bg-red-700 text-red-100",
};

export function colorClass(color: string): string {
  return NOTION_COLORS[color] || NOTION_COLORS.default;
}

// Status group mapping
export const STATUS_GROUPS = {
  "To-do": ["👋 NEW 👋"],
  "In progress": [
    "👥TEAM IS WORKING ON IT 👥",
    "READY 🚀",
    "🛑 ATTENTION 🛑",
    "IN PROGRESS",
    "⏱️ ON-GOING ⏱️",
    "⚠️ HELD UP ⚠️",
    "🛠️ Working on it 🛠️",
  ],
  Complete: [
    "1QA - Needed",
    "2QA - Needed",
    "REJECTED - QA",
    "NON-ESSENTIAL (DONE)",
    "2QA - DONE (Tony)",
    "2QA - DONE (Lexie)",
    "2QA - DONE (Bryan)",
    "2QA DONE (send to client)",
    "✅ Done (NO QA) ✅",
  ],
};

// ── API Functions ─────────────────────────────────────────────────────────

async function fetchTasks(filters: TaskFilters): Promise<NotionListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.client) params.set("client", filters.client);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.teammate) params.set("teammate", filters.teammate);
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  params.set("pageSize", "100");

  const resp = await fetch(`${API_BASE}/tasks?${params}`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch tasks");
  return resp.json();
}

async function fetchDatabase(): Promise<any> {
  const resp = await fetch(`${API_BASE}/tasks/database`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch database schema");
  return resp.json();
}

async function fetchTask(id: string): Promise<NotionTask> {
  const resp = await fetch(`${API_BASE}/tasks/${id}`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch task");
  return resp.json();
}

async function fetchBlocks(id: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/tasks/${id}/blocks`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to fetch blocks");
  return resp.json();
}

async function createTask(properties: Record<string, any>): Promise<NotionTask> {
  const resp = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ properties }),
  });
  if (!resp.ok) throw new Error("Failed to create task");
  return resp.json();
}

async function updateTask(id: string, properties: Record<string, any>): Promise<NotionTask> {
  const resp = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ properties }),
  });
  if (!resp.ok) throw new Error("Failed to update task");
  return resp.json();
}

async function deleteTask(id: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to delete task");
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["notion-tasks", filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 30_000,
  });
}

export function useDatabase() {
  return useQuery({
    queryKey: ["notion-database"],
    queryFn: fetchDatabase,
    staleTime: 5 * 60_000,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["notion-task", id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  });
}

export function useTaskBlocks(id: string | null) {
  return useQuery({
    queryKey: ["notion-task-blocks", id],
    queryFn: () => fetchBlocks(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (properties: Record<string, any>) => createTask(properties),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notion-tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, properties }: { id: string; properties: Record<string, any> }) =>
      updateTask(id, properties),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notion-tasks"] });
      qc.invalidateQueries({ queryKey: ["notion-task"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notion-tasks"] }),
  });
}

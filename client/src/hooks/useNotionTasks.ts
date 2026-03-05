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

// ── Property extractors ───────────────────────────────────────────────────

export function getTitle(props: Record<string, any>): string {
  const p = props["Task name"];
  if (!p?.title?.length) return "";
  return p.title.map((t: any) => t.plain_text).join("");
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

export function getRejectedReasonTeam(props: Record<string, any>): string {
  const rt = props["Rejected Reason (Team)"]?.rich_text;
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

export function getCompletedOn(props: Record<string, any>): string | null {
  return props["Completed on"]?.date?.start || null;
}

export function getCreatedTime(props: Record<string, any>): string {
  return props["Date"]?.created_time || "";
}

export function getLastEdited(props: Record<string, any>): string {
  return props["Last edited time"]?.last_edited_time || "";
}

export function getSecondaryStatus(props: Record<string, any>): { name: string; color: string } | null {
  const s = props[""]?.status;
  return s ? { name: s.name, color: s.color } : null;
}

// ── Notion color palette (dark mode) ──────────────────────────────────────
// Matches Notion's exact dark mode tag/badge colors

export const NOTION_TAG_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  default: { bg: "rgba(151,154,202,0.13)", text: "#9B9A97", dot: "#9B9A97" },
  gray:    { bg: "rgba(151,154,202,0.13)", text: "#9B9A97", dot: "#9B9A97" },
  brown:   { bg: "rgba(186,133,111,0.13)", text: "#BA856F", dot: "#BA856F" },
  orange:  { bg: "rgba(217,115,13,0.13)",  text: "#D9730D", dot: "#D9730D" },
  yellow:  { bg: "rgba(223,171,1,0.13)",   text: "#DFAB01", dot: "#DFAB01" },
  green:   { bg: "rgba(15,123,108,0.13)",  text: "#0F7B6C", dot: "#0F7B6C" },
  blue:    { bg: "rgba(11,110,153,0.13)",  text: "#0B6E99", dot: "#0B6E99" },
  purple:  { bg: "rgba(105,64,165,0.13)",  text: "#6940A5", dot: "#6940A5" },
  pink:    { bg: "rgba(173,26,114,0.13)",  text: "#AD1A72", dot: "#AD1A72" },
  red:     { bg: "rgba(224,62,62,0.13)",   text: "#E03E3E", dot: "#E03E3E" },
};

export function notionTagStyle(color: string): React.CSSProperties {
  const c = NOTION_TAG_STYLES[color] || NOTION_TAG_STYLES.default;
  return { backgroundColor: c.bg, color: c.text };
}

export function notionDotColor(color: string): string {
  return NOTION_TAG_STYLES[color]?.dot || "#9B9A97";
}

const NOTION_COLOR_CLASSES: Record<string, string> = {
  default: "bg-gray-500/10 text-gray-400",
  gray:    "bg-gray-500/10 text-gray-400",
  brown:   "bg-amber-800/10 text-amber-700",
  orange:  "bg-orange-500/10 text-orange-500",
  yellow:  "bg-yellow-500/10 text-yellow-500",
  green:   "bg-emerald-500/10 text-emerald-500",
  blue:    "bg-blue-500/10 text-blue-500",
  purple:  "bg-purple-500/10 text-purple-500",
  pink:    "bg-pink-500/10 text-pink-500",
  red:     "bg-red-500/10 text-red-500",
};

export function colorClass(color: string): string {
  return NOTION_COLOR_CLASSES[color] || NOTION_COLOR_CLASSES.default;
}

// ── Status groups ─────────────────────────────────────────────────────────

export const STATUS_GROUPS: Record<string, string[]> = {
  "To-do": ["\u{1F44B} NEW \u{1F44B}"],
  "In progress": [
    "\u{1F465}TEAM IS WORKING ON IT \u{1F465}",
    "READY \u{1F680}",
    "\u{1F6D1} ATTENTION \u{1F6D1}",
    "IN PROGRESS",
    "\u23F1\uFE0F ON-GOING \u23F1\uFE0F",
    "\u26A0\uFE0F HELD UP \u26A0\uFE0F",
    "\u{1F6E0}\uFE0F Working on it \u{1F6E0}\uFE0F",
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
    "\u2705 Done (NO QA) \u2705",
  ],
};

export function getStatusGroup(statusName: string): string {
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.includes(statusName)) return group;
  }
  return "Other";
}

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
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to fetch tasks: ${resp.status} ${body}`);
  }
  return resp.json();
}

async function fetchDatabase(): Promise<any> {
  const resp = await fetch(`${API_BASE}/tasks/database`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error(`Failed to fetch database: ${resp.status}`);
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

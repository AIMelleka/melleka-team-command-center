import { supabase } from "@/integrations/supabase/client";

// All API calls go to the same base — env var in prod, Vite proxy in dev.
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || "https://api.teams.melleka.com/api")
  : "/api";

async function getFreshToken(): Promise<string> {
  let { data: { session } } = await supabase.auth.getSession();
  // If no session or token expires within 60s, force a refresh
  if (!session?.access_token || (session.expires_at && session.expires_at * 1000 - Date.now() < 60_000)) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session;
  }
  return session?.access_token || "";
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getFreshToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function authHeadersNoContentType(): Promise<Record<string, string>> {
  const token = await getFreshToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_cron?: boolean;
  has_unread?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function fetchNotifications(): Promise<{ count: number; conversations: Conversation[] }> {
  const res = await fetch(`${API_BASE}/notifications`, { headers: await authHeaders() });
  if (!res.ok) return { count: 0, conversations: [] };
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export async function fetchMessages(convId: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/conversations/${convId}/messages`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function renameConversation(convId: string, title: string): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${convId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename conversation");
}

export async function deleteConversation(convId: string): Promise<void> {
  await fetch(`${API_BASE}/conversations/${convId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

export async function fetchMemory(): Promise<string> {
  const res = await fetch(`${API_BASE}/memory`, { headers: await authHeaders() });
  if (!res.ok) return "";
  const data = await res.json();
  return (data as { content: string }).content;
}

export interface MemoryEntry {
  id: string;
  member_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function fetchMemoryEntries(): Promise<MemoryEntry[]> {
  const res = await fetch(`${API_BASE}/memory/entries`, { headers: await authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function createMemoryEntryApi(title: string, content: string): Promise<MemoryEntry> {
  const res = await fetch(`${API_BASE}/memory/entries`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error("Failed to create memory");
  return res.json();
}

export async function updateMemoryEntryApi(
  id: string,
  updates: { title?: string; content?: string }
): Promise<MemoryEntry> {
  const res = await fetch(`${API_BASE}/memory/entries/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update memory");
  return res.json();
}

export async function deleteMemoryEntryApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/memory/entries/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete memory");
}

export interface CronJob {
  id: string;
  member_name: string;
  name: string;
  cron_expr: string;
  task: string;
  enabled: boolean;
  conversation_id: string | null;
  last_run: string | null;
}

export async function fetchCronJobs(): Promise<CronJob[]> {
  const h = await authHeaders();
  const res = await fetch(`${API_BASE}/cron-jobs`, { headers: h });
  if (!res.ok) return [];
  return res.json();
}

export async function deleteCronJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cron-jobs/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete" }));
    throw new Error(err.error || "Failed to delete cron job");
  }
}

export async function createCronJob(body: { name: string; cron_expr: string; task: string }): Promise<CronJob> {
  const res = await fetch(`${API_BASE}/cron-jobs`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create" }));
    throw new Error(err.error || "Failed to create cron job");
  }
  return res.json();
}

export async function updateCronJob(id: string, body: Partial<Pick<CronJob, "name" | "cron_expr" | "task" | "enabled">>): Promise<CronJob> {
  const res = await fetch(`${API_BASE}/cron-jobs/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update" }));
    throw new Error(err.error || "Failed to update cron job");
  }
  return res.json();
}

export async function ensureTeamMember(): Promise<{ name: string; userId: string }> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export interface SSEEvent {
  type: "text" | "tool_start" | "tool_result" | "done" | "error" | "html_content";
  delta?: string;
  name?: string;
  output?: string;
  conversationId?: string;
  message?: string;
  content?: string; // for html_content events (full HTML from write_file)
}

// Stale timeout: if no data (including keepalive pings) for this many ms, consider dead.
// Server sends keepalive every 3s, so 100s means we missed ~33 pings.
// Long timeout prevents false positives during slow API calls (Google Ads, etc.)
const STALE_TIMEOUT_MS = 100_000;

export function streamMessage(
  message: string,
  conversationId: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  files?: File[],
  mentionedClients?: string[],
  onDisconnect?: () => void,
  lowTokenMode?: boolean,
  model?: string,
): () => void {
  const controller = new AbortController();
  let aborted = false;

  const attemptStream = async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 4000, 8000];

    let body: BodyInit;
    let fetchHeaders: Record<string, string>;

    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append("message", message);
      if (conversationId) formData.append("conversationId", conversationId);
      if (mentionedClients && mentionedClients.length > 0) {
        formData.append("mentionedClients", JSON.stringify(mentionedClients));
      }
      if (lowTokenMode) formData.append("lowTokenMode", "true");
      if (model) formData.append("model", model);
      for (const file of files) {
        formData.append("files", file);
      }
      body = formData;
      fetchHeaders = await authHeadersNoContentType();
    } else {
      body = JSON.stringify({ message, conversationId, mentionedClients, lowTokenMode, model });
      fetchHeaders = await authHeaders();
    }

    let receivedDone = false;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: fetchHeaders,
        body,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        // Retry on 502/503/504 (proxy errors)
        const status = res.status;
        if ([401, 502, 503, 504].includes(status) && retryCount < MAX_RETRIES && !aborted) {
          const delay = RETRY_DELAYS[retryCount] || 8000;
          await new Promise((r) => setTimeout(r, delay));
          return attemptStream(retryCount + 1);
        }
        onEvent({ type: "error", message: `Request failed (${status}): ${text || res.statusText}` });
        onDone();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Stale connection detection: reset timer on every chunk received
      let staleTimer: ReturnType<typeof setTimeout> | null = null;
      const resetStaleTimer = () => {
        if (staleTimer) clearTimeout(staleTimer);
        staleTimer = setTimeout(() => {
          // No data for STALE_TIMEOUT_MS - connection is dead
          if (!receivedDone && !aborted) {
            // Try to reconnect instead of immediately failing
            if (staleTimer) clearTimeout(staleTimer);
            try { reader.cancel(); } catch { /* ok */ }
            if (onDisconnect) onDisconnect();
          }
        }, STALE_TIMEOUT_MS);
      };
      resetStaleTimer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Got data - connection is alive, reset stale timer
        resetStaleTimer();

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              if (event.type === "done") receivedDone = true;
              onEvent(event);
            } catch { /* skip malformed */ }
          }
          // keepalive comments (": keepalive") are parsed but ignored - they still reset the stale timer above
        }
      }

      // Clean up stale timer
      if (staleTimer) clearTimeout(staleTimer);

      // Stream ended - if no "done" event, the connection dropped unexpectedly
      if (!receivedDone && onDisconnect) {
        onDisconnect();
      }
      onDone();
    } catch (err) {
      if ((err as Error).name === "AbortError" || aborted) return;

      // Auto-retry on connection failures (TypeError = network error)
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 8000;
        console.warn(`[chatApi] Connection failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        if (!aborted) return attemptStream(retryCount + 1);
      }

      // All retries exhausted
      const msg = err instanceof TypeError
        ? `Connection lost after ${MAX_RETRIES} retries. The agent may still be working — refresh to check.`
        : String(err);
      onEvent({ type: "error", message: msg });
      if (onDisconnect) onDisconnect();
      onDone();
    }
  };

  attemptStream();

  return () => {
    aborted = true;
    controller.abort();
  };
}

// ── Client Update publishing ──

export async function publishClientUpdate(
  html: string,
  clientSlug: string
): Promise<{ url: string; vercelUrl: string | null; domainOk: boolean }> {
  const res = await fetch(`${API_BASE}/client-updates/publish`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ html, clientSlug }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Publish failed" }));
    throw new Error(err.error || "Publish failed");
  }
  return res.json();
}

// ── Persistent background chat: reconnect APIs ──

export async function checkJobStatus(conversationId: string): Promise<{
  active: boolean;
  status?: string;
  startedAt?: number;
  eventCount?: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/chat/status/${conversationId}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return { active: false };
    return res.json();
  } catch {
    return { active: false };
  }
}

export async function fetchActiveJobs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/chat/active-jobs`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.activeConversationIds ?? [];
  } catch {
    return [];
  }
}

export function reconnectToJob(
  conversationId: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    let receivedDone = false;

    try {
      const res = await fetch(`${API_BASE}/chat/reconnect/${conversationId}`, {
        headers: await authHeaders(),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onDone();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let staleTimer: ReturnType<typeof setTimeout> | null = null;
      const resetStaleTimer = () => {
        if (staleTimer) clearTimeout(staleTimer);
        staleTimer = setTimeout(() => {
          if (!receivedDone) {
            controller.abort();
            onDone();
          }
        }, STALE_TIMEOUT_MS);
      };
      resetStaleTimer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetStaleTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              if (event.type === "done") receivedDone = true;
              onEvent(event);
            } catch { /* skip */ }
          }
        }
      }

      if (staleTimer) clearTimeout(staleTimer);
      onDone();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onDone();
      }
    }
  })();

  return () => controller.abort();
}

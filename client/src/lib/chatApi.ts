import { supabase } from "@/integrations/supabase/client";

// All API calls go to the same base — custom domain in prod, Vite proxy in dev.
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

async function authHeadersNoContentType(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
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
  const res = await fetch(`${API_BASE}/notifications/cron-jobs`, { headers: h });
  if (!res.ok) return [];
  return res.json();
}

export async function ensureTeamMember(): Promise<{ name: string; userId: string }> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export interface SSEEvent {
  type: "text" | "tool_start" | "tool_result" | "done" | "error";
  delta?: string;
  name?: string;
  output?: string;
  conversationId?: string;
  message?: string;
}

// Stale timeout: if no data (including keepalive pings) for this many ms, consider dead.
// Server sends keepalive every 5s, so 20s means we missed 4 pings.
const STALE_TIMEOUT_MS = 20_000;

export function streamMessage(
  message: string,
  conversationId: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  files?: File[],
  mentionedClients?: string[],
  onDisconnect?: () => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    let body: BodyInit;
    let fetchHeaders: Record<string, string>;

    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append("message", message);
      if (conversationId) formData.append("conversationId", conversationId);
      if (mentionedClients && mentionedClients.length > 0) {
        formData.append("mentionedClients", JSON.stringify(mentionedClients));
      }
      for (const file of files) {
        formData.append("files", file);
      }
      body = formData;
      fetchHeaders = await authHeadersNoContentType();
    } else {
      body = JSON.stringify({ message, conversationId, mentionedClients });
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
        onEvent({ type: "error", message: `Request failed (${res.status}): ${text || res.statusText}` });
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
          if (!receivedDone) {
            controller.abort();
            if (onDisconnect) onDisconnect();
            onDone();
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
      if ((err as Error).name !== "AbortError") {
        const msg = err instanceof TypeError
          ? `Connection failed — check network or try again`
          : String(err);
        onEvent({ type: "error", message: msg });
        if (onDisconnect) onDisconnect();
        onDone();
      }
    }
  })();

  return () => controller.abort();
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

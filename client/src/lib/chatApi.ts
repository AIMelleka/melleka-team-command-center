import { supabase } from "@/integrations/supabase/client";

const BASE = "/api";

// SSE streaming goes directly to Railway to avoid Vercel's rewrite timeout (30s).
// Short REST calls (conversations, memory, auth) go through the Vercel /api proxy.
const STREAM_BASE = import.meta.env.PROD
  ? "https://server-production-0486.up.railway.app/api"
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
  const res = await fetch(`${BASE}/notifications`, { headers: await authHeaders() });
  if (!res.ok) return { count: 0, conversations: [] };
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export async function fetchMessages(convId: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/conversations/${convId}/messages`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function deleteConversation(convId: string): Promise<void> {
  await fetch(`${BASE}/conversations/${convId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

export async function fetchMemory(): Promise<string> {
  const res = await fetch(`${BASE}/memory`, { headers: await authHeaders() });
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
  const res = await fetch(`${BASE}/notifications/cron-jobs`, { headers: h });
  if (!res.ok) return [];
  return res.json();
}

export async function ensureTeamMember(): Promise<{ name: string; userId: string }> {
  const res = await fetch(`${BASE}/auth/me`, { headers: await authHeaders() });
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

export function streamMessage(
  message: string,
  conversationId: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  files?: File[],
  mentionedClients?: string[]
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

    try {
      const res = await fetch(`${STREAM_BASE}/chat`, {
        method: "POST",
        headers: fetchHeaders,
        body,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onEvent({ type: "error", message: "Request failed" });
        onDone();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              onEvent(event);
            } catch { /* skip malformed */ }
          }
        }
      }
      onDone();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onEvent({ type: "error", message: String(err) });
        onDone();
      }
    }
  })();

  return () => controller.abort();
}

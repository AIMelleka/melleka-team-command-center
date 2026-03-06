import { getToken } from "./auth.ts";

const BASE = "/api";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function login(name: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Login failed");
  }
  return res.json() as Promise<{ token: string; name: string }>;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_cron?: boolean;
  has_unread?: boolean;
}

export async function fetchNotifications(): Promise<{ count: number; conversations: Conversation[] }> {
  const res = await fetch(`${BASE}/notifications`, { headers: headers() });
  if (!res.ok) return { count: 0, conversations: [] };
  return res.json();
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export async function fetchMessages(convId: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/conversations/${convId}/messages`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function deleteConversation(convId: string): Promise<void> {
  await fetch(`${BASE}/conversations/${convId}`, {
    method: "DELETE",
    headers: headers(),
  });
}

export async function fetchMemory(): Promise<string> {
  const res = await fetch(`${BASE}/memory`, { headers: headers() });
  if (!res.ok) return "";
  const data = await res.json();
  return (data as { content: string }).content;
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
  onDisconnect?: () => void,
): () => void {
  const controller = new AbortController();

  // Build request — use FormData when files are attached, JSON otherwise
  let body: BodyInit;
  let fetchHeaders: Record<string, string>;

  if (files && files.length > 0) {
    const formData = new FormData();
    formData.append("message", message);
    if (conversationId) formData.append("conversationId", conversationId);
    for (const file of files) {
      formData.append("files", file);
    }
    body = formData;
    // Let browser set Content-Type with multipart boundary
    fetchHeaders = { Authorization: `Bearer ${getToken()}` };
  } else {
    body = JSON.stringify({ message, conversationId });
    fetchHeaders = headers();
  }

  let receivedDone = false;

  (async () => {
    try {
      const res = await fetch(`${BASE}/chat`, {
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

      // Stale connection detection
      let staleTimer: ReturnType<typeof setTimeout> | null = null;
      const resetStaleTimer = () => {
        if (staleTimer) clearTimeout(staleTimer);
        staleTimer = setTimeout(() => {
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
        }
      }

      if (staleTimer) clearTimeout(staleTimer);
      if (!receivedDone && onDisconnect) onDisconnect();
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
    const res = await fetch(`${BASE}/chat/status/${conversationId}`, {
      headers: headers(),
    });
    if (!res.ok) return { active: false };
    return res.json();
  } catch {
    return { active: false };
  }
}

export async function fetchActiveJobs(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/chat/active-jobs`, {
      headers: headers(),
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
      const res = await fetch(`${BASE}/chat/reconnect/${conversationId}`, {
        headers: headers(),
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

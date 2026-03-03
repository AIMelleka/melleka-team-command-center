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

export function streamMessage(
  message: string,
  conversationId: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  files?: File[]
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

  fetch(`${BASE}/chat`, {
    method: "POST",
    headers: fetchHeaders,
    body,
    signal: controller.signal,
  })
    .then(async (res) => {
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
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onEvent({ type: "error", message: String(err) });
        onDone();
      }
    });

  return () => controller.abort();
}

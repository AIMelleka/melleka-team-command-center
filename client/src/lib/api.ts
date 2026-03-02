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
  onDone: () => void
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, conversationId }),
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

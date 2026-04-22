import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import type { SSEEvent } from "@/lib/chatApi";

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || "https://api.teams.melleka.com/api")
  : "/api";

interface MessagePart {
  type: "text" | "tool_start" | "tool_result";
  content: string;
  toolName?: string;
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  streaming?: boolean;
}

interface CommercialChatProps {
  commercialProjectId: string | null;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onProjectUpdated: () => void;
  pendingMessage?: string | null;
  onPendingMessageConsumed?: () => void;
}

export default function CommercialChat({
  commercialProjectId,
  conversationId,
  onConversationCreated,
  onProjectUpdated,
  pendingMessage,
  onPendingMessageConsumed,
}: CommercialChatProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const abortRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversation history when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs.map((m: any) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, content: m.content }],
        })));
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send pending message (from template selection)
  useEffect(() => {
    if (pendingMessage && !isStreaming) {
      sendMessage(pendingMessage);
      onPendingMessageConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg && files.length === 0) return;
    if (isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const uid = () => crypto.randomUUID();
    const userMsg: UIMessage = { id: uid(), role: "user", parts: [{ type: "text", content: msg }] };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = uid();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", parts: [], streaming: true }]);

    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    try {
      const { data: { session } } = await supabase.auth.getSession();

      let body: BodyInit;
      let headers: Record<string, string>;

      if (files.length > 0) {
        const formData = new FormData();
        formData.append("message", msg);
        if (conversationId) formData.append("conversationId", conversationId);
        if (commercialProjectId) formData.append("commercialProjectId", commercialProjectId);
        for (const file of files) formData.append("files", file);
        body = formData;
        headers = { Authorization: `Bearer ${session?.access_token}` };
      } else {
        body = JSON.stringify({
          message: msg,
          conversationId,
          commercialProjectId,
        });
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        };
      }

      setFiles([]);

      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, parts: [{ type: "text", content: "Connection error. Please try again." }], streaming: false }
            : m
        ));
        setIsStreaming(false);
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
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;

            if (event.type === "text" && event.delta) {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                const parts = [...m.parts];
                const lastPart = parts[parts.length - 1];
                if (lastPart?.type === "text") {
                  parts[parts.length - 1] = { ...lastPart, content: lastPart.content + event.delta };
                } else {
                  parts.push({ type: "text", content: event.delta! });
                }
                return { ...m, parts };
              }));
            }

            if (event.type === "tool_start" && event.name) {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                return { ...m, parts: [...m.parts, { type: "tool_start", content: "", toolName: event.name }] };
              }));
            }

            if (event.type === "tool_result") {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                const parts = [...m.parts];
                for (let i = parts.length - 1; i >= 0; i--) {
                  if (parts[i].type === "tool_start") {
                    parts[i] = { ...parts[i], type: "tool_result", content: event.output || "" };
                    break;
                  }
                }
                return { ...m, parts };
              }));

              // Trigger refresh if a commercial scene was added/updated
              if (event.name?.startsWith("commercial_")) {
                onProjectUpdated();
              }
            }

            if (event.type === "done") {
              if (event.conversationId && !conversationId) {
                onConversationCreated(event.conversationId);
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, streaming: false } : m
              ));
            }

            if (event.type === "error") {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, parts: [...m.parts, { type: "text", content: `\n\nError: ${event.message}` }], streaming: false }
                  : m
              ));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, parts: [{ type: "text", content: "Connection lost. Please try again." }], streaming: false }
          : m
      ));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, files, conversationId, commercialProjectId, isStreaming, onConversationCreated, onProjectUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center px-4">
            <p className="text-sm font-medium mb-2">Commercial Maker</p>
            <p className="text-xs">Describe the commercial you want to create. I'll build it scene by scene with live preview.</p>
            <div className="mt-4 space-y-1 text-xs text-left">
              <p className="text-muted-foreground/70">Try:</p>
              <p className="italic">"Create a 30-second commercial for my SaaS product"</p>
              <p className="italic">"Make a client pitch video showcasing our agency services"</p>
              <p className="italic">"Build a quick promo for our new feature launch"</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}>
              {msg.parts.map((part, i) => {
                if (part.type === "tool_start") {
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground py-1 border-l-2 border-primary/30 pl-2 my-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {part.toolName}
                    </div>
                  );
                }
                if (part.type === "tool_result") {
                  return (
                    <div key={i} className="text-xs text-muted-foreground py-1 border-l-2 border-green-500/30 pl-2 my-1">
                      <span className="font-medium">{part.toolName}</span>
                      {part.content && (
                        <pre className="mt-1 text-[10px] whitespace-pre-wrap max-h-20 overflow-y-auto">{part.content.slice(0, 300)}</pre>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{part.content}</ReactMarkdown>
                  </div>
                );
              })}
              {msg.streaming && msg.parts.length === 0 && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* File preview strip */}
      {files.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-t border-border overflow-x-auto">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
              <span className="max-w-[100px] truncate">{file.name}</span>
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.svg"
            className="hidden"
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              setFiles(prev => [...prev, ...selected]);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your commercial..."
            rows={1}
            className="min-h-[36px] max-h-[120px] resize-none text-sm"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => sendMessage()}
            disabled={isStreaming || (!input.trim() && files.length === 0)}
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "../components/Sidebar.tsx";
import { MessageList, type UIMessage, type MessagePart } from "../components/MessageList.tsx";
import { InputBar } from "../components/InputBar.tsx";
import {
  fetchConversations,
  fetchMessages,
  deleteConversation,
  fetchMemory,
  streamMessage,
  type Conversation,
  type SSEEvent,
} from "../lib/api.ts";
import { clearAuth } from "../lib/auth.ts";
import { X } from "lucide-react";

interface ChatProps {
  memberName: string;
  onLogout: () => void;
}

export function Chat({ memberName, onLogout }: ChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stopFn, setStopFn] = useState<(() => void) | null>(null);
  const [memory, setMemory] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);

  const loadConversations = useCallback(async () => {
    const data = await fetchConversations().catch(() => []);
    setConversations(data);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  async function selectConversation(id: string) {
    setActiveId(id);
    const msgs = await fetchMessages(id).catch(() => []);
    const uiMsgs: UIMessage[] = msgs.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text" as const, content: m.content }],
    }));
    setMessages(uiMsgs);
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  async function handleDelete(id: string) {
    await deleteConversation(id).catch(() => {});
    if (activeId === id) newConversation();
    await loadConversations();
  }

  function handleLogout() {
    clearAuth();
    onLogout();
  }

  async function handleViewMemory() {
    const m = await fetchMemory().catch(() => "");
    setMemory(m);
    setShowMemory(true);
  }

  function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    // Add user message to UI
    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", parts: [{ type: "text", content: text }] },
      { id: assistantMsgId, role: "assistant", parts: [], streaming: true },
    ]);

    let currentConvId = activeId;

    const stop = streamMessage(
      text,
      activeId,
      (event: SSEEvent) => {
        if (event.type === "text" && event.delta) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              const parts = [...m.parts];
              const lastPart = parts[parts.length - 1];
              if (lastPart?.type === "text") {
                parts[parts.length - 1] = { ...lastPart, content: (lastPart.content ?? "") + event.delta! };
              } else {
                parts.push({ type: "text", content: event.delta! });
              }
              return { ...m, parts };
            })
          );
        } else if (event.type === "tool_start" && event.name) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              return { ...m, parts: [...m.parts, { type: "tool_start" as const, toolName: event.name! }] };
            })
          );
        } else if (event.type === "tool_result" && event.name) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              return { ...m, parts: [...m.parts, { type: "tool_result" as const, toolName: event.name!, toolOutput: event.output }] };
            })
          );
        } else if (event.type === "done") {
          if (event.conversationId && !currentConvId) {
            currentConvId = event.conversationId;
            setActiveId(event.conversationId);
          }
        } else if (event.type === "error" && event.message) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              return {
                ...m,
                parts: [...m.parts, { type: "text" as const, content: `\n\n⚠️ Error: ${event.message}` }],
              };
            })
          );
        }
      },
      () => {
        setLoading(false);
        setStopFn(null);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false } : m))
        );
        loadConversations();
      }
    );

    setStopFn(() => stop);
  }

  function stopStreaming() {
    stopFn?.();
    setLoading(false);
    setStopFn(null);
    setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar
        memberName={memberName}
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={handleDelete}
        onLogout={handleLogout}
        onViewMemory={handleViewMemory}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-border flex items-center px-4 gap-3 flex-shrink-0 bg-surface">
          <span className="text-sm text-muted">
            {activeId ? conversations.find((c) => c.id === activeId)?.title ?? "Conversation" : "New Conversation"}
          </span>
        </header>

        <MessageList messages={messages} memberName={memberName} />

        <InputBar
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          onStop={stopStreaming}
          loading={loading}
        />
      </div>

      {/* Memory modal */}
      {showMemory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-text text-sm">My Memory</h2>
              <button onClick={() => setShowMemory(false)} className="text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {memory ? (
                <pre className="text-xs text-text font-mono whitespace-pre-wrap leading-relaxed">{memory}</pre>
              ) : (
                <p className="text-sm text-muted text-center py-8">No memory yet — it builds up as you chat.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

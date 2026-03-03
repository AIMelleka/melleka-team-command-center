import React, { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "../components/Sidebar.tsx";
import { MessageList, type UIMessage, type MessagePart } from "../components/MessageList.tsx";
import { InputBar } from "../components/InputBar.tsx";
import {
  fetchConversations,
  fetchMessages,
  deleteConversation,
  fetchMemory,
  fetchNotifications,
  streamMessage,
  type Conversation,
  type SSEEvent,
} from "../lib/api.ts";
import { clearAuth } from "../lib/auth.ts";
import { X, Bell } from "lucide-react";

interface ChatProps {
  memberName: string;
  onLogout: () => void;
}

export function Chat({ memberName, onLogout }: ChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [stopFn, setStopFn] = useState<(() => void) | null>(null);
  const [memory, setMemory] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [unreadConvs, setUnreadConvs] = useState<Conversation[]>([]);
  const [showBell, setShowBell] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const data = await fetchConversations().catch(() => []);
    setConversations(data);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Poll for unread cron notifications every 30s
  const pollNotifications = useCallback(async () => {
    const data = await fetchNotifications().catch(() => ({ count: 0, conversations: [] }));
    setUnreadConvs(data.conversations);
    // Also refresh conversation list so sidebar badges update
    if (data.count > 0) loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    pollNotifications();
    const interval = setInterval(pollNotifications, 30000);
    return () => clearInterval(interval);
  }, [pollNotifications]);

  // Close bell dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  async function openUnreadConv(conv: Conversation) {
    setShowBell(false);
    await selectConversation(conv.id);
    // Optimistically clear the badge for this conversation
    setUnreadConvs((prev) => prev.filter((c) => c.id !== conv.id));
    await loadConversations();
  }

  async function handleViewMemory() {
    const m = await fetchMemory().catch(() => "");
    setMemory(m);
    setShowMemory(true);
  }

  function sendMessage() {
    const text = input.trim();
    const currentFiles = [...files];
    if ((!text && currentFiles.length === 0) || loading) return;

    setInput("");
    setFiles([]);
    setLoading(true);

    // Build display text for the user message bubble
    let displayText = text;
    if (currentFiles.length > 0) {
      const fileNames = currentFiles.map((f) => f.name).join(", ");
      displayText = text
        ? `${text}\n\n[Attached: ${fileNames}]`
        : `[Attached: ${fileNames}]`;
    }

    // Add user message to UI
    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", parts: [{ type: "text", content: displayText }] },
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
      },
      currentFiles.length > 0 ? currentFiles : undefined
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
          <span className="text-sm text-muted flex-1">
            {activeId ? conversations.find((c) => c.id === activeId)?.title ?? "Conversation" : "New Conversation"}
          </span>

          {/* Notification bell */}
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setShowBell((v) => !v)}
              className="relative p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-muted hover:text-text"
              title="Scheduled task updates"
            >
              <Bell size={16} />
              {unreadConvs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                  {unreadConvs.length}
                </span>
              )}
            </button>

            {showBell && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-xs font-semibold text-text">Scheduled Task Updates</p>
                </div>
                {unreadConvs.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">All caught up!</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {unreadConvs.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => openUnreadConv(conv)}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors border-b border-border last:border-0"
                      >
                        <p className="text-xs font-medium text-text truncate">{conv.title}</p>
                        <p className="text-[10px] text-muted mt-0.5">New results available</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <MessageList messages={messages} memberName={memberName} />

        <InputBar
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          onStop={stopStreaming}
          loading={loading}
          files={files}
          onFilesChange={setFiles}
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

import React from "react";
import { Plus, MessageSquare, Trash2, LogOut, Brain, Loader2 } from "lucide-react";
import type { Conversation } from "../lib/api.ts";

interface SidebarProps {
  memberName: string;
  conversations: Conversation[];
  activeId: string | null;
  activeJobConvIds?: Set<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onViewMemory: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Sidebar({
  memberName,
  conversations,
  activeId,
  activeJobConvIds,
  onSelect,
  onNew,
  onDelete,
  onLogout,
  onViewMemory,
}: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-surface border-r border-border h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <p className="text-xs text-muted leading-none">Melleka</p>
            <p className="text-sm font-semibold text-text leading-tight">Command Center</p>
          </div>
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} />
          New Conversation
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <p className="text-[10px] text-muted uppercase tracking-wider px-2 pt-1 pb-2">Recent</p>
        {conversations.length === 0 && (
          <p className="text-xs text-muted px-2 py-4 text-center">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
              activeId === conv.id
                ? "bg-primary-muted border border-primary/30"
                : "hover:bg-surface-2"
            }`}
          >
            {activeJobConvIds?.has(conv.id) ? (
              <Loader2 size={13} className="text-accent flex-shrink-0 mt-0.5 animate-spin" />
            ) : (
              <MessageSquare size={13} className="text-muted flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs truncate leading-tight ${conv.has_unread ? "text-white font-semibold" : "text-text"}`}>
                {conv.title || "Untitled"}
              </p>
              <p className="text-[10px] text-muted mt-0.5">{timeAgo(conv.updated_at)}</p>
            </div>
            {conv.has_unread && (
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1 animate-pulse" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={onViewMemory}
          className="w-full flex items-center gap-2 text-xs text-muted hover:text-accent px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors"
        >
          <Brain size={13} />
          My Memory
        </button>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-6 h-6 rounded-full bg-primary-muted border border-primary/40 flex items-center justify-center text-[11px] font-bold text-accent flex-shrink-0">
            {memberName[0]?.toUpperCase()}
          </div>
          <span className="text-xs text-text flex-1 truncate">{memberName}</span>
          <button
            onClick={onLogout}
            className="text-muted hover:text-error transition-colors"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

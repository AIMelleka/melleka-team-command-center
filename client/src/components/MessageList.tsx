import React, { useEffect, useRef } from "react";
import { ToolCallBlock } from "./ToolCallBlock.tsx";

export interface MessagePart {
  type: "text" | "tool_start" | "tool_result";
  content?: string;
  toolName?: string;
  toolOutput?: string;
}

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  streaming?: boolean;
}

function renderText(text: string) {
  // Very simple markdown-ish rendering
  return text
    .split(/```([\s\S]*?)```/g)
    .map((segment, i) =>
      i % 2 === 1 ? (
        <pre key={i} className="my-2 bg-[#0d0d14] border border-border rounded-md p-3 overflow-x-auto font-mono text-[13px] text-text">
          <code>{segment}</code>
        </pre>
      ) : (
        <span key={i}>
          {segment.split(/`([^`]+)`/g).map((s, j) =>
            j % 2 === 1 ? (
              <code key={j} className="bg-surface-2 text-accent px-1 rounded font-mono text-[0.85em]">{s}</code>
            ) : (
              <span key={j} className="whitespace-pre-wrap">{s}</span>
            )
          )}
        </span>
      )
    );
}

function AssistantMessage({ parts, streaming }: { parts: MessagePart[]; streaming?: boolean }) {
  // Track tool calls with their pending state
  const toolMap = new Map<string, { output?: string; pending: boolean }>();

  for (const part of parts) {
    if (part.type === "tool_start" && part.toolName) {
      if (!toolMap.has(part.toolName)) toolMap.set(part.toolName, { pending: true });
    }
    if (part.type === "tool_result" && part.toolName) {
      toolMap.set(part.toolName, { output: part.toolOutput, pending: false });
    }
  }

  const rendered: React.ReactNode[] = [];
  let textBuffer = "";
  const seenTools = new Set<string>();

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === "text" && part.content) {
      textBuffer += part.content;
    } else if (part.type === "tool_start" && part.toolName && !seenTools.has(part.toolName + i)) {
      seenTools.add(part.toolName + i);
      if (textBuffer) {
        rendered.push(<p key={`text-${i}`} className="mb-2">{renderText(textBuffer)}</p>);
        textBuffer = "";
      }
      const info = toolMap.get(part.toolName);
      rendered.push(
        <ToolCallBlock
          key={`tool-${i}`}
          name={part.toolName}
          output={info?.output}
          pending={info?.pending}
        />
      );
    }
  }

  if (textBuffer) {
    rendered.push(<p key="text-final" className="mb-2">{renderText(textBuffer)}</p>);
  }

  return (
    <div className="prose text-sm text-text leading-relaxed">
      {rendered}
      {streaming && (
        <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse-slow" />
      )}
    </div>
  );
}

interface MessageListProps {
  messages: UIMessage[];
  memberName: string;
}

export function MessageList({ messages, memberName }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted gap-3 p-8">
        <div className="w-14 h-14 rounded-full bg-primary-muted flex items-center justify-center text-2xl">
          ⚡
        </div>
        <p className="text-lg font-semibold text-text">Ready, {memberName}</p>
        <p className="text-sm text-center max-w-sm">
          Ask me anything — I can read and edit code, run commands, search the codebase, and remember what you tell me.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {msg.role === "assistant" && (
            <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-0.5">
              M
            </div>
          )}
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-primary text-white rounded-br-sm"
                : "bg-surface border border-border rounded-bl-sm"
            }`}
          >
            {msg.role === "user" ? (
              <p className="text-sm whitespace-pre-wrap">{msg.parts[0]?.content ?? ""}</p>
            ) : (
              <AssistantMessage parts={msg.parts} streaming={msg.streaming} />
            )}
          </div>
          {msg.role === "user" && (
            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex-shrink-0 flex items-center justify-center text-xs font-bold text-accent mt-0.5">
              {memberName[0]?.toUpperCase()}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

import React, { useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function InputBar({ value, onChange, onSend, onStop, loading, disabled }: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="flex items-end gap-3 bg-surface-2 border border-border rounded-2xl px-4 py-3 focus-within:border-primary transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me to do something..."
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-text text-sm resize-none outline-none placeholder-muted min-h-[22px] max-h-[200px] leading-snug"
        />
        <button
          onClick={loading ? onStop : onSend}
          disabled={!loading && (!value.trim() || disabled)}
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            loading
              ? "bg-error hover:bg-red-700 text-white"
              : value.trim() && !disabled
              ? "bg-primary hover:bg-primary-hover text-white"
              : "bg-muted-dark text-muted cursor-not-allowed"
          }`}
        >
          {loading ? <Square size={14} /> : <Send size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-muted text-center mt-2">
        Enter to send · Shift+Enter for new line · Claude can read files, run code, and more
      </p>
    </div>
  );
}

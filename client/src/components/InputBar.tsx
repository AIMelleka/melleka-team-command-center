import React, { useRef, useEffect } from "react";
import { Send, Square, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  disabled?: boolean;
  files: File[];
  onFilesChange: (f: File[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

export function InputBar({ value, onChange, onSend, onStop, loading, disabled, files, onFilesChange }: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const canSend = !loading && (value.trim() || files.length > 0) && !disabled;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) {
      onFilesChange([...files, ...selected]);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="bg-surface-2 border border-border rounded-2xl focus-within:border-primary transition-colors">
        {/* File preview strip */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5 max-w-[200px] group"
              >
                {isImage(file) ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-6 h-6 rounded object-cover flex-shrink-0"
                    onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  />
                ) : (
                  <FileText size={14} className="text-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-text truncate leading-tight">{file.name}</p>
                  <p className="text-[9px] text-muted leading-tight">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted hover:text-error transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-3 px-4 py-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || loading}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-accent hover:bg-bg transition-all disabled:opacity-40"
            title="Attach files"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
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
            disabled={!loading && !canSend}
            className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              loading
                ? "bg-error hover:bg-red-700 text-white"
                : canSend
                ? "bg-primary hover:bg-primary-hover text-white"
                : "bg-muted-dark text-muted cursor-not-allowed"
            }`}
          >
            {loading ? <Square size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted text-center mt-2">
        Enter to send · Shift+Enter for new line · Attach files with 📎
      </p>
    </div>
  );
}

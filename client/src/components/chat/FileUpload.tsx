import { useRef } from "react";
import { Paperclip, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

export function FileUploadButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
      title="Attach files"
    >
      <Paperclip className="w-4 h-4" />
    </Button>
  );
}

export function FileUploadInput({ fileInputRef, onFilesChange, files }: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesChange: (files: File[]) => void;
  files: File[];
}) {
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) {
      onFilesChange([...files, ...selected]);
    }
    e.target.value = "";
  }

  return (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      className="hidden"
      onChange={handleFileSelect}
    />
  );
}

export function FilePreviewStrip({ files, onFilesChange }: FileUploadProps) {
  if (files.length === 0) return null;

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
      {files.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 max-w-[200px] group"
        >
          {isImage(file) ? (
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-6 h-6 rounded object-cover shrink-0"
              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
            />
          ) : (
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-foreground truncate leading-tight">{file.name}</p>
            <p className="text-[9px] text-muted-foreground leading-tight">{formatSize(file.size)}</p>
          </div>
          <button
            onClick={() => removeFile(i)}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-60 group-hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

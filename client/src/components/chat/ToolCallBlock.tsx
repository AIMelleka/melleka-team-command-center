import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileText,
  Search,
  Brain,
  FolderOpen,
  Code,
  Globe,
  Mail,
  Clock,
  List,
  Trash2,
  Zap,
  BarChart2,
  Database,
  MessageSquare,
} from "lucide-react";

interface ToolCallBlockProps {
  name: string;
  output?: string;
  pending?: boolean;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileText size={13} />,
  write_file: <FileText size={13} />,
  run_command: <Terminal size={13} />,
  list_files: <FolderOpen size={13} />,
  search_code: <Search size={13} />,
  deploy_site: <Globe size={13} />,
  google_ads_query: <BarChart2 size={13} />,
  list_google_ads_accounts: <BarChart2 size={13} />,
  http_request: <Zap size={13} />,
  send_email: <Mail size={13} />,
  create_cron_job: <Clock size={13} />,
  list_cron_jobs: <List size={13} />,
  delete_cron_job: <Trash2 size={13} />,
  save_memory: <Brain size={13} />,
  append_memory: <Brain size={13} />,
  create_agent: <Code size={13} />,
  supabase_query: <Database size={13} />,
  supabase_insert: <Database size={13} />,
  supabase_update: <Database size={13} />,
  slack_post: <MessageSquare size={13} />,
};

export function ToolCallBlock({ name, output, pending }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const icon = TOOL_ICONS[name] ?? <Terminal size={13} />;

  return (
    <div className="my-2 rounded-lg border border-border bg-card overflow-hidden text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-primary">{icon}</span>
        <span className="text-foreground font-mono font-medium">{name}</span>
        {pending && (
          <span className="ml-1 flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
        {!pending && output && (
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>
      {open && output && (
        <div className="border-t border-border px-3 py-2 bg-background">
          <pre className="text-muted-foreground text-[11px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

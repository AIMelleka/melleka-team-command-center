import { useState, useCallback, useEffect } from "react";
import {
  NotionTask,
  getTitle,
  getStatus,
  getClient,
  getPriority,
  getTeammate,
  getDue,
  getDescription,
  getManagers,
  getAssign,
  getCheckbox,
  getUrl,
  getNotes,
  getRejectedReason,
  getFiles,
  colorClass,
  useUpdateTask,
  useTaskBlocks,
} from "@/hooks/useNotionTasks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Calendar,
  User,
  Users,
  Tag,
  FileText,
  Link,
  AlertTriangle,
  MessageSquare,
  ChevronDown,
  Clock,
} from "lucide-react";

interface TaskDetailSheetProps {
  task: NotionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusOptions: { name: string; color: string }[];
  priorityOptions: { name: string; color: string }[];
  teammateOptions: { name: string; color: string }[];
}

// ── Property row component ────────────────────────────────────────────────

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2 group">
      <div className="flex items-center gap-2 w-[140px] shrink-0 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  statusOptions,
  priorityOptions,
  teammateOptions,
}: TaskDetailSheetProps) {
  const updateTask = useUpdateTask();
  const { data: blocksData } = useTaskBlocks(task?.id || null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Reset editing state when task changes
  useEffect(() => {
    if (task) {
      setEditingTitle(false);
      setEditingDesc(false);
      setEditingNotes(false);
    }
  }, [task?.id]);

  if (!task) return null;

  const title = getTitle(task.properties);
  const status = getStatus(task.properties);
  const client = getClient(task.properties);
  const priority = getPriority(task.properties);
  const teammate = getTeammate(task.properties);
  const due = getDue(task.properties);
  const description = getDescription(task.properties);
  const managers = getManagers(task.properties);
  const assign = getAssign(task.properties);
  const done = getCheckbox(task.properties);
  const url = getUrl(task.properties);
  const notes = getNotes(task.properties);
  const rejectedReason = getRejectedReason(task.properties);
  const files = getFiles(task.properties);

  const handleSaveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== title) {
      updateTask.mutate({
        id: task.id,
        properties: {
          "Task name": { title: [{ text: { content: titleDraft.trim() } }] },
        },
      });
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = () => {
    if (descDraft !== description) {
      updateTask.mutate({
        id: task.id,
        properties: {
          Description: {
            rich_text: [{ text: { content: descDraft } }],
          },
        },
      });
    }
    setEditingDesc(false);
  };

  const handleSaveNotes = () => {
    if (notesDraft !== notes) {
      updateTask.mutate({
        id: task.id,
        properties: {
          "Notes (1)": {
            rich_text: [{ text: { content: notesDraft } }],
          },
        },
      });
    }
    setEditingNotes(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] overflow-y-auto p-0"
      >
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Checkbox + Title */}
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={done}
                  onCheckedChange={(checked) =>
                    updateTask.mutate({
                      id: task.id,
                      properties: { "Done ?": { checkbox: checked as boolean } },
                    })
                  }
                  className="mt-1 h-5 w-5"
                />
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    className="text-lg font-semibold border-none shadow-none ring-1 ring-blue-500 px-1"
                  />
                ) : (
                  <SheetTitle
                    className={cn(
                      "text-lg font-semibold cursor-text flex-1",
                      done && "line-through text-muted-foreground"
                    )}
                    onClick={() => {
                      setTitleDraft(title);
                      setEditingTitle(true);
                    }}
                  >
                    {title || "Untitled"}
                  </SheetTitle>
                )}
              </div>

              {/* Open in Notion */}
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Notion
              </a>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 py-4">
          <Separator className="mb-4" />

          {/* Properties */}
          <div className="space-y-0.5">
            {/* Status */}
            <PropertyRow icon={Tag} label="Status">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1">
                    {status ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2.5 py-1 text-xs font-medium",
                          colorClass(status.color)
                        )}
                      >
                        {status.name}
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Empty <ChevronDown className="h-3 w-3 inline" />
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[300px] overflow-y-auto">
                  {statusOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.name}
                      onClick={() =>
                        updateTask.mutate({
                          id: task.id,
                          properties: { STATUS: { status: { name: opt.name } } },
                        })
                      }
                    >
                      <span className={cn("rounded px-2 py-0.5 text-xs font-medium", colorClass(opt.color))}>
                        {opt.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropertyRow>

            {/* Priority */}
            <PropertyRow icon={AlertTriangle} label="Priority">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1">
                    {priority ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2.5 py-1 text-xs font-medium",
                          colorClass(priority.color)
                        )}
                      >
                        {priority.name}
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Empty <ChevronDown className="h-3 w-3 inline" />
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {priorityOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.name}
                      onClick={() =>
                        updateTask.mutate({
                          id: task.id,
                          properties: { Priority: { select: { name: opt.name } } },
                        })
                      }
                    >
                      <span className={cn("rounded px-2 py-0.5 text-xs font-medium", colorClass(opt.color))}>
                        {opt.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropertyRow>

            {/* Client */}
            <PropertyRow icon={Users} label="Client">
              <span className="text-sm">{client || <em className="text-muted-foreground">Empty</em>}</span>
            </PropertyRow>

            {/* Teammate */}
            <PropertyRow icon={User} label="Teammate">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1">
                    {teammate ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2.5 py-1 text-xs font-medium",
                          colorClass(teammate.color)
                        )}
                      >
                        {teammate.name}
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Empty <ChevronDown className="h-3 w-3 inline" />
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {teammateOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.name}
                      onClick={() =>
                        updateTask.mutate({
                          id: task.id,
                          properties: { Teammate: { select: { name: opt.name } } },
                        })
                      }
                    >
                      <span className={cn("rounded px-2 py-0.5 text-xs font-medium", colorClass(opt.color))}>
                        {opt.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropertyRow>

            {/* Due Date */}
            <PropertyRow icon={Calendar} label="Due">
              <input
                type="date"
                defaultValue={due || ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  updateTask.mutate({
                    id: task.id,
                    properties: {
                      Due: val ? { date: { start: val } } : { date: null },
                    },
                  });
                }}
                className="bg-transparent border border-border rounded px-2 py-1 text-xs w-[150px]"
              />
            </PropertyRow>

            {/* Managers */}
            <PropertyRow icon={Users} label="Managers">
              <div className="flex items-center gap-2 flex-wrap">
                {managers.length > 0 ? (
                  managers.map((m) => (
                    <div key={m.name} className="flex items-center gap-1.5">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.name} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-200">
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs">{m.name}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">Empty</span>
                )}
              </div>
            </PropertyRow>

            {/* Assigned */}
            {assign.length > 0 && (
              <PropertyRow icon={User} label="Assigned">
                <div className="flex items-center gap-2 flex-wrap">
                  {assign.map((a) => (
                    <div key={a.name} className="flex items-center gap-1.5">
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt={a.name} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-200">
                          {a.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs">{a.name}</span>
                    </div>
                  ))}
                </div>
              </PropertyRow>
            )}

            {/* URL */}
            {url && (
              <PropertyRow icon={Link} label="URL">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline truncate block"
                >
                  {url}
                </a>
              </PropertyRow>
            )}

            {/* Files */}
            {files.length > 0 && (
              <PropertyRow icon={FileText} label="Files">
                <div className="flex flex-col gap-1">
                  {files.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline truncate block"
                    >
                      {f.name}
                    </a>
                  ))}
                </div>
              </PropertyRow>
            )}

            {/* Timestamps */}
            <PropertyRow icon={Clock} label="Created">
              <span className="text-xs text-muted-foreground">
                {new Date(task.created_time).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </PropertyRow>

            <PropertyRow icon={Clock} label="Last edited">
              <span className="text-xs text-muted-foreground">
                {new Date(task.last_edited_time).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </PropertyRow>
          </div>

          <Separator className="my-4" />

          {/* Description */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Description
            </label>
            {editingDesc ? (
              <div>
                <Textarea
                  autoFocus
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  className="min-h-[100px] text-sm"
                  placeholder="Add a description..."
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleSaveDesc}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setDescDraft(description);
                  setEditingDesc(true);
                }}
                className="text-sm min-h-[40px] p-2 rounded border border-transparent hover:border-border cursor-text whitespace-pre-wrap"
              >
                {description || (
                  <span className="text-muted-foreground italic">
                    Click to add a description...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Notes
            </label>
            {editingNotes ? (
              <div>
                <Textarea
                  autoFocus
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="min-h-[80px] text-sm"
                  placeholder="Add notes..."
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleSaveNotes}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setNotesDraft(notes);
                  setEditingNotes(true);
                }}
                className="text-sm min-h-[40px] p-2 rounded border border-transparent hover:border-border cursor-text whitespace-pre-wrap"
              >
                {notes || (
                  <span className="text-muted-foreground italic">
                    Click to add notes...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Rejected Reason */}
          {rejectedReason && (
            <div className="mb-4">
              <label className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Rejected Reason
              </label>
              <p className="text-sm text-red-300 bg-red-950/30 rounded p-2">
                {rejectedReason}
              </p>
            </div>
          )}

          {/* Page Content Blocks (from Notion page body) */}
          {blocksData?.results?.length > 0 && (
            <>
              <Separator className="my-4" />
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Page Content
              </label>
              <div className="space-y-2">
                {blocksData.results.map((block: any) => (
                  <NotionBlock key={block.id} block={block} />
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Render Notion blocks ──────────────────────────────────────────────────

function NotionBlock({ block }: { block: any }) {
  const type = block.type;

  const richTextToString = (rt: any[]) =>
    rt?.map((t: any) => t.plain_text).join("") || "";

  switch (type) {
    case "paragraph":
      return (
        <p className="text-sm whitespace-pre-wrap">
          {richTextToString(block.paragraph.rich_text) || "\u00A0"}
        </p>
      );
    case "heading_1":
      return (
        <h1 className="text-xl font-bold mt-4 mb-1">
          {richTextToString(block.heading_1.rich_text)}
        </h1>
      );
    case "heading_2":
      return (
        <h2 className="text-lg font-semibold mt-3 mb-1">
          {richTextToString(block.heading_2.rich_text)}
        </h2>
      );
    case "heading_3":
      return (
        <h3 className="text-base font-medium mt-2 mb-1">
          {richTextToString(block.heading_3.rich_text)}
        </h3>
      );
    case "bulleted_list_item":
      return (
        <li className="text-sm ml-4 list-disc">
          {richTextToString(block.bulleted_list_item.rich_text)}
        </li>
      );
    case "numbered_list_item":
      return (
        <li className="text-sm ml-4 list-decimal">
          {richTextToString(block.numbered_list_item.rich_text)}
        </li>
      );
    case "to_do":
      return (
        <div className="flex items-center gap-2 text-sm">
          <Checkbox checked={block.to_do.checked} disabled className="h-3.5 w-3.5" />
          <span className={block.to_do.checked ? "line-through text-muted-foreground" : ""}>
            {richTextToString(block.to_do.rich_text)}
          </span>
        </div>
      );
    case "toggle":
      return (
        <details className="text-sm">
          <summary className="cursor-pointer">
            {richTextToString(block.toggle.rich_text)}
          </summary>
        </details>
      );
    case "divider":
      return <Separator />;
    case "callout":
      return (
        <div className="flex gap-2 bg-muted/50 rounded p-3 text-sm">
          <span>{block.callout.icon?.emoji || "💡"}</span>
          <span>{richTextToString(block.callout.rich_text)}</span>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm italic">
          {richTextToString(block.quote.rich_text)}
        </blockquote>
      );
    case "code":
      return (
        <pre className="bg-zinc-900 rounded p-3 text-xs overflow-x-auto">
          <code>{richTextToString(block.code.rich_text)}</code>
        </pre>
      );
    case "image":
      const imgUrl =
        block.image.type === "external"
          ? block.image.external.url
          : block.image.file?.url;
      return imgUrl ? (
        <img src={imgUrl} alt="" className="rounded max-w-full" />
      ) : null;
    case "bookmark":
      return (
        <a
          href={block.bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline block"
        >
          {block.bookmark.url}
        </a>
      );
    default:
      return null;
  }
}

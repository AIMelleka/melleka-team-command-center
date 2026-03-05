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
  notionTagStyle,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  Calendar,
  User,
  Users,
  Tag,
  FileText,
  Link,
  AlertTriangle,
  ChevronDown,
  Clock,
  CheckSquare,
} from "lucide-react";

interface TaskDetailSheetProps {
  task: NotionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusOptions: { name: string; color: string }[];
  priorityOptions: { name: string; color: string }[];
  teammateOptions: { name: string; color: string }[];
}

function PropRow({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[8px] min-h-[34px] py-[4px]">
      <div className="flex items-center gap-[6px] w-[140px] shrink-0 text-[rgba(255,255,255,0.443)] h-[26px]">
        <Icon className="h-[14px] w-[14px]" />
        <span className="text-[13px]">{label}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center min-h-[26px]">{children}</div>
    </div>
  );
}

function NotionPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center h-[22px] rounded-[3px] px-[8px] text-[13px] whitespace-nowrap" style={notionTagStyle(color)}>
      {name}
    </span>
  );
}

export default function TaskDetailSheet({
  task, open, onOpenChange, statusOptions, priorityOptions, teammateOptions,
}: TaskDetailSheetProps) {
  const updateTask = useUpdateTask();
  const { data: blocksData } = useTaskBlocks(task?.id || null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (task) { setEditingTitle(false); setEditingDesc(false); setEditingNotes(false); }
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

  const save = (props: Record<string, any>) => updateTask.mutate({ id: task.id, properties: props });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[620px] overflow-y-auto p-0 bg-[#202020] border-l border-[rgba(255,255,255,0.055)]">
        <SheetHeader className="p-[24px] pb-0">
          <div className="flex items-start gap-[12px]">
            {/* Checkbox */}
            <div
              onClick={() => save({ "Done ?": { checkbox: !done } })}
              className={`mt-[4px] w-[18px] h-[18px] rounded-[3px] border cursor-pointer flex items-center justify-center shrink-0 ${
                done ? "bg-[#2383e2] border-[#2383e2]" : "border-[rgba(255,255,255,0.282)]"
              }`}
            >
              {done && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => { if (titleDraft.trim() && titleDraft.trim() !== title) save({ "Task name": { title: [{ text: { content: titleDraft.trim() } }] } }); setEditingTitle(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="text-[20px] font-semibold border-none bg-transparent text-[rgba(255,255,255,0.91)] p-0 h-auto shadow-none focus-visible:ring-1 focus-visible:ring-[#2383e2]"
                />
              ) : (
                <SheetTitle
                  className={`text-[20px] font-semibold cursor-text ${done ? "line-through text-[rgba(255,255,255,0.38)]" : "text-[rgba(255,255,255,0.91)]"}`}
                  onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
                >
                  {title || "Untitled"}
                </SheetTitle>
              )}
              <a href={task.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-[4px] mt-[6px] text-[12px] text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.65)] transition-colors">
                <ExternalLink className="h-[12px] w-[12px]" /> Open in Notion
              </a>
            </div>
          </div>
        </SheetHeader>

        <div className="px-[24px] py-[16px]">
          <Separator className="mb-[16px] bg-[rgba(255,255,255,0.055)]" />

          {/* Properties */}
          <div>
            <PropRow icon={Tag} label="Status">
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  {status ? <NotionPill name={status.name} color={status.color} /> : <span className="text-[13px] text-[rgba(255,255,255,0.282)]">Empty</span>}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[300px] overflow-y-auto">
                  {statusOptions.map((o) => (
                    <DropdownMenuItem key={o.name} onClick={() => save({ STATUS: { status: { name: o.name } } })}>
                      <NotionPill name={o.name} color={o.color} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropRow>

            <PropRow icon={AlertTriangle} label="Priority">
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  {priority ? <NotionPill name={priority.name} color={priority.color} /> : <span className="text-[13px] text-[rgba(255,255,255,0.282)]">Empty</span>}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {priorityOptions.map((o) => (
                    <DropdownMenuItem key={o.name} onClick={() => save({ Priority: { select: { name: o.name } } })}>
                      <NotionPill name={o.name} color={o.color} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropRow>

            <PropRow icon={Users} label="Client">
              <span className="text-[14px] text-[rgba(255,255,255,0.81)]">{client || <span className="text-[rgba(255,255,255,0.282)]">Empty</span>}</span>
            </PropRow>

            <PropRow icon={User} label="Teammate">
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  {teammate ? <NotionPill name={teammate.name} color={teammate.color} /> : <span className="text-[13px] text-[rgba(255,255,255,0.282)]">Empty</span>}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {teammateOptions.map((o) => (
                    <DropdownMenuItem key={o.name} onClick={() => save({ Teammate: { select: { name: o.name } } })}>
                      <NotionPill name={o.name} color={o.color} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropRow>

            <PropRow icon={Calendar} label="Due">
              <input type="date" defaultValue={due || ""}
                onChange={(e) => save({ Due: e.target.value ? { date: { start: e.target.value } } : { date: null } })}
                className="bg-transparent border border-[rgba(255,255,255,0.094)] rounded-[3px] px-[8px] py-[4px] text-[13px] text-[rgba(255,255,255,0.72)] w-[160px]"
              />
            </PropRow>

            <PropRow icon={Users} label="Managers">
              <div className="flex items-center gap-[8px] flex-wrap">
                {managers.length > 0 ? managers.map((m) => (
                  <div key={m.name} className="flex items-center gap-[6px]">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} className="w-[22px] h-[22px] rounded-full" />
                      : <div className="w-[22px] h-[22px] rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[11px] text-[rgba(255,255,255,0.55)]">{m.name.charAt(0)}</div>
                    }
                    <span className="text-[13px] text-[rgba(255,255,255,0.72)]">{m.name}</span>
                  </div>
                )) : <span className="text-[13px] text-[rgba(255,255,255,0.282)]">Empty</span>}
              </div>
            </PropRow>

            {assign.length > 0 && (
              <PropRow icon={User} label="Assigned">
                <div className="flex items-center gap-[8px] flex-wrap">
                  {assign.map((a) => (
                    <div key={a.name} className="flex items-center gap-[6px]">
                      {a.avatar_url
                        ? <img src={a.avatar_url} alt={a.name} className="w-[22px] h-[22px] rounded-full" />
                        : <div className="w-[22px] h-[22px] rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[11px] text-[rgba(255,255,255,0.55)]">{a.name.charAt(0)}</div>
                      }
                      <span className="text-[13px] text-[rgba(255,255,255,0.72)]">{a.name}</span>
                    </div>
                  ))}
                </div>
              </PropRow>
            )}

            {url && (
              <PropRow icon={Link} label="URL">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#2383e2] hover:underline truncate block">{url}</a>
              </PropRow>
            )}

            {files.length > 0 && (
              <PropRow icon={FileText} label="Files">
                <div className="flex flex-col gap-[4px]">
                  {files.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#2383e2] hover:underline truncate block">{f.name}</a>
                  ))}
                </div>
              </PropRow>
            )}

            <PropRow icon={Clock} label="Created">
              <span className="text-[13px] text-[rgba(255,255,255,0.443)]">
                {new Date(task.created_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </PropRow>

            <PropRow icon={Clock} label="Last edited">
              <span className="text-[13px] text-[rgba(255,255,255,0.443)]">
                {new Date(task.last_edited_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </PropRow>
          </div>

          <Separator className="my-[16px] bg-[rgba(255,255,255,0.055)]" />

          {/* Description */}
          <div className="mb-[16px]">
            <div className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[8px]">Description</div>
            {editingDesc ? (
              <div>
                <Textarea autoFocus value={descDraft} onChange={(e) => setDescDraft(e.target.value)}
                  className="min-h-[100px] text-[14px] bg-[rgba(255,255,255,0.024)] border-[rgba(255,255,255,0.094)]" />
                <div className="flex gap-[8px] mt-[8px]">
                  <button onClick={() => { if (descDraft !== description) save({ Description: { rich_text: [{ text: { content: descDraft } }] } }); setEditingDesc(false); }}
                    className="h-[28px] px-[10px] text-[13px] bg-[#2383e2] text-white rounded-[3px] hover:bg-[#1b6ec2]">Save</button>
                  <button onClick={() => setEditingDesc(false)} className="h-[28px] px-[10px] text-[13px] text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px]">Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setDescDraft(description); setEditingDesc(true); }}
                className="text-[14px] text-[rgba(255,255,255,0.72)] min-h-[40px] p-[8px] rounded-[3px] border border-transparent hover:border-[rgba(255,255,255,0.094)] cursor-text whitespace-pre-wrap">
                {description || <span className="text-[rgba(255,255,255,0.282)] italic">Click to add description...</span>}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-[16px]">
            <div className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[8px]">Notes</div>
            {editingNotes ? (
              <div>
                <Textarea autoFocus value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)}
                  className="min-h-[80px] text-[14px] bg-[rgba(255,255,255,0.024)] border-[rgba(255,255,255,0.094)]" />
                <div className="flex gap-[8px] mt-[8px]">
                  <button onClick={() => { if (notesDraft !== notes) save({ "Notes (1)": { rich_text: [{ text: { content: notesDraft } }] } }); setEditingNotes(false); }}
                    className="h-[28px] px-[10px] text-[13px] bg-[#2383e2] text-white rounded-[3px] hover:bg-[#1b6ec2]">Save</button>
                  <button onClick={() => setEditingNotes(false)} className="h-[28px] px-[10px] text-[13px] text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px]">Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setNotesDraft(notes); setEditingNotes(true); }}
                className="text-[14px] text-[rgba(255,255,255,0.72)] min-h-[40px] p-[8px] rounded-[3px] border border-transparent hover:border-[rgba(255,255,255,0.094)] cursor-text whitespace-pre-wrap">
                {notes || <span className="text-[rgba(255,255,255,0.282)] italic">Click to add notes...</span>}
              </div>
            )}
          </div>

          {/* Rejected Reason */}
          {rejectedReason && (
            <div className="mb-[16px]">
              <div className="text-[12px] text-red-400 mb-[8px] flex items-center gap-[6px]">
                <AlertTriangle className="h-[12px] w-[12px]" /> Rejected Reason
              </div>
              <p className="text-[14px] text-red-300 bg-[rgba(224,62,62,0.08)] rounded-[3px] p-[8px]">{rejectedReason}</p>
            </div>
          )}

          {/* Page content blocks */}
          {blocksData?.results?.length > 0 && (
            <>
              <Separator className="my-[16px] bg-[rgba(255,255,255,0.055)]" />
              <div className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[8px]">Page content</div>
              <div className="space-y-[6px]">
                {blocksData.results.map((block: any) => <Block key={block.id} block={block} />)}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Block({ block }: { block: any }) {
  const rt = (arr: any[]) => arr?.map((t: any) => t.plain_text).join("") || "";
  switch (block.type) {
    case "paragraph": return <p className="text-[14px] text-[rgba(255,255,255,0.72)] whitespace-pre-wrap">{rt(block.paragraph.rich_text) || "\u00A0"}</p>;
    case "heading_1": return <h1 className="text-[20px] font-bold text-[rgba(255,255,255,0.91)] mt-[16px] mb-[4px]">{rt(block.heading_1.rich_text)}</h1>;
    case "heading_2": return <h2 className="text-[17px] font-semibold text-[rgba(255,255,255,0.91)] mt-[12px] mb-[4px]">{rt(block.heading_2.rich_text)}</h2>;
    case "heading_3": return <h3 className="text-[15px] font-medium text-[rgba(255,255,255,0.91)] mt-[8px] mb-[4px]">{rt(block.heading_3.rich_text)}</h3>;
    case "bulleted_list_item": return <li className="text-[14px] text-[rgba(255,255,255,0.72)] ml-[16px] list-disc">{rt(block.bulleted_list_item.rich_text)}</li>;
    case "numbered_list_item": return <li className="text-[14px] text-[rgba(255,255,255,0.72)] ml-[16px] list-decimal">{rt(block.numbered_list_item.rich_text)}</li>;
    case "to_do": return (
      <div className="flex items-center gap-[8px] text-[14px]">
        <div className={`w-[16px] h-[16px] rounded-[3px] border flex items-center justify-center ${block.to_do.checked ? "bg-[#2383e2] border-[#2383e2]" : "border-[rgba(255,255,255,0.282)]"}`}>
          {block.to_do.checked && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span className={block.to_do.checked ? "line-through text-[rgba(255,255,255,0.38)]" : "text-[rgba(255,255,255,0.72)]"}>{rt(block.to_do.rich_text)}</span>
      </div>
    );
    case "divider": return <Separator className="bg-[rgba(255,255,255,0.055)]" />;
    case "callout": return (
      <div className="flex gap-[8px] bg-[rgba(255,255,255,0.024)] rounded-[3px] p-[12px] text-[14px] text-[rgba(255,255,255,0.72)]">
        <span>{block.callout.icon?.emoji || "💡"}</span>
        <span>{rt(block.callout.rich_text)}</span>
      </div>
    );
    case "quote": return <blockquote className="border-l-[3px] border-[rgba(255,255,255,0.2)] pl-[12px] text-[14px] text-[rgba(255,255,255,0.72)] italic">{rt(block.quote.rich_text)}</blockquote>;
    case "code": return <pre className="bg-[rgba(255,255,255,0.024)] rounded-[3px] p-[12px] text-[13px] text-[rgba(255,255,255,0.72)] overflow-x-auto"><code>{rt(block.code.rich_text)}</code></pre>;
    case "image": {
      const src = block.image.type === "external" ? block.image.external.url : block.image.file?.url;
      return src ? <img src={src} alt="" className="rounded-[3px] max-w-full" /> : null;
    }
    case "bookmark": return <a href={block.bookmark.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#2383e2] hover:underline block">{block.bookmark.url}</a>;
    default: return null;
  }
}

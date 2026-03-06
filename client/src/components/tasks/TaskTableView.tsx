import { memo, useState, useRef, useEffect, useCallback } from "react";
import {
  NotionTask,
  getTitle,
  getStatus,
  getClient,
  getPriority,
  getTeammate,
  getDue,
  getManagers,
  getCheckbox,
  getDescription,
  getSecondaryStatus,
  colorClass,
  notionDotColor,
  useUpdateTask,
} from "@/hooks/useNotionTasks";
import { MoreHorizontal, ExternalLink, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

interface Props {
  tasks: NotionTask[];
  onTaskClick: (task: NotionTask) => void;
  onDelete: (id: string) => void;
  onNewTask: () => void;
  statusOptions: { name: string; color: string }[];
  priorityOptions: { name: string; color: string }[];
  teammateOptions: { name: string; color: string }[];
  visibleColumns: string[];
  groupBy: string | null;
}

// ── Tag/pill for select values ───────────────────────────────────────────
function Pill({ name, color }: { name: string; color: string }) {
  return (
    <span className={`inline-flex items-center h-5 rounded px-1.5 text-xs leading-5 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis ${colorClass(color)}`}>
      {name}
    </span>
  );
}

// ── Editable text cell ───────────────────────────────────────────────────
function EditableText({ value, onSave, strike }: { value: string; onSave: (v: string) => void; strike?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  if (editing) return (
    <input ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }}
      onKeyDown={e => {
        if (e.key === "Enter") { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="w-full bg-transparent border-none outline-none text-sm leading-[34px] text-foreground p-0"
    />
  );

  return (
    <div onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      className={`text-sm leading-[34px] cursor-text overflow-hidden text-ellipsis whitespace-nowrap ${strike ? "line-through text-muted-foreground" : "text-foreground"}`}>
      {value || "\u00A0"}
    </div>
  );
}

// ── Select dropdown cell ─────────────────────────────────────────────────
function SelectCell({ current, options, onSelect }: {
  current: { name: string; color: string } | null;
  options: { name: string; color: string }[];
  onSelect: (n: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center h-[34px] bg-transparent border-none cursor-pointer outline-none w-full p-0">
          {current ? <Pill name={current.name} color={current.color} /> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 overflow-y-auto min-w-[200px]" align="start">
        {options.map(o => (
          <DropdownMenuItem key={o.name} onClick={() => onSelect(o.name)} className="py-1.5">
            <Pill name={o.name} color={o.color} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Avatar stack ─────────────────────────────────────────────────────────
function Avatars({ people }: { people: { name: string; avatar_url?: string }[] }) {
  if (!people.length) return null;
  return (
    <div className="flex items-center">
      {people.slice(0, 5).map((p, i) =>
        p.avatar_url ? (
          <img key={p.name} src={p.avatar_url} alt={p.name} title={p.name}
            className={`w-6 h-6 rounded-full object-cover border-2 border-background ${i > 0 ? "-ml-1.5" : ""}`} />
        ) : (
          <div key={p.name} title={p.name}
            className={`w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground ${i > 0 ? "-ml-1.5" : ""}`}>
            {p.name.charAt(0).toUpperCase()}
          </div>
        )
      )}
    </div>
  );
}

// ── Date cell ────────────────────────────────────────────────────────────
function DateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.showPicker?.(); }, [editing]);

  if (editing) return (
    <input ref={ref} type="date" defaultValue={value || ""}
      onBlur={e => { setEditing(false); const v = e.target.value || null; if (v !== value) onSave(v); }}
      onKeyDown={e => { if (e.key === "Escape") setEditing(false); }}
      className="bg-transparent border-none outline-none text-sm text-muted-foreground leading-[34px]"
    />
  );

  return (
    <div onClick={() => setEditing(true)}
      className="text-sm leading-[34px] text-muted-foreground cursor-pointer">
      {value ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u00A0"}
    </div>
  );
}

// ── Table component ──────────────────────────────────────────────────────
const TaskTableView = memo(({
  tasks, onTaskClick, onDelete, onNewTask,
  statusOptions, priorityOptions, teammateOptions,
  visibleColumns, groupBy,
}: Props) => {
  const update = useUpdateTask();
  const [hovered, setHovered] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const mut = useCallback((id: string, props: Record<string, any>) => update.mutate({ id, properties: props }), [update]);

  const renderCell = (task: NotionTask, col: string) => {
    const p = task.properties;
    switch (col) {
      case "Task name":
        return <EditableText value={getTitle(p)} onSave={v => mut(task.id, { "Task name": { title: [{ text: { content: v } }] } })} strike={getCheckbox(p)} />;
      case "STATUS":
        return <SelectCell current={getStatus(p)} options={statusOptions} onSelect={n => mut(task.id, { STATUS: { status: { name: n } } })} />;
      case "CLIENTS":
        return <EditableText value={getClient(p)} onSave={v => mut(task.id, { CLIENTS: { rich_text: [{ text: { content: v } }] } })} />;
      case "Priority":
        return <SelectCell current={getPriority(p)} options={priorityOptions} onSelect={n => mut(task.id, { Priority: { select: { name: n } } })} />;
      case "Teammate":
        return <SelectCell current={getTeammate(p)} options={teammateOptions} onSelect={n => mut(task.id, { Teammate: { select: { name: n } } })} />;
      case "Managers":
        return <Avatars people={getManagers(p)} />;
      case "Due":
        return <DateCell value={getDue(p)} onSave={v => mut(task.id, { Due: v ? { date: { start: v } } : { date: null } })} />;
      case "Done ?":
        return (
          <div className="flex justify-center h-[34px] items-center"
            onClick={e => { e.stopPropagation(); mut(task.id, { "Done ?": { checkbox: !getCheckbox(p) } }); }}>
            <div className={`w-4 h-4 rounded cursor-pointer flex items-center justify-center ${getCheckbox(p) ? "bg-primary" : "border-2 border-muted-foreground/40"}`}>
              {getCheckbox(p) && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
        );
      case "Secondary Status": {
        const ss = getSecondaryStatus(p);
        return ss ? <Pill name={ss.name} color={ss.color} /> : null;
      }
      case "Description":
        return <div className="text-sm leading-[34px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{getDescription(p)}</div>;
      default: return null;
    }
  };

  // Group tasks
  const groups = buildGroups(tasks, groupBy);

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {visibleColumns.map(col => (
            <TableHead key={col} className="h-8 px-2 text-xs font-normal text-muted-foreground whitespace-nowrap border-r border-border/50 last:border-r-0">
              {col === "Done ?" ? "Done" : col}
            </TableHead>
          ))}
          <TableHead className="w-11 h-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g, gi) => {
          const isCollapsed = collapsed.has(g.label);
          return (
            <GroupRows key={g.label || gi}
              group={g} groupBy={groupBy} isCollapsed={isCollapsed}
              onToggle={() => setCollapsed(prev => { const n = new Set(prev); n.has(g.label) ? n.delete(g.label) : n.add(g.label); return n; })}
              visibleColumns={visibleColumns} hovered={hovered}
              setHovered={setHovered} renderCell={renderCell}
              onTaskClick={onTaskClick} onDelete={onDelete}
            />
          );
        })}
        <TableRow className="hover:bg-transparent border-0">
          <TableCell colSpan={visibleColumns.length + 1} className="px-2 h-[34px] cursor-pointer" onClick={onNewTask}>
            <div className="flex items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-sm">New</span>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
});

// Separate component for group rows
function GroupRows({ group, groupBy, isCollapsed, onToggle, visibleColumns, hovered, setHovered, renderCell, onTaskClick, onDelete }: {
  group: { label: string; color?: string; tasks: NotionTask[] };
  groupBy: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  visibleColumns: string[];
  hovered: string | null;
  setHovered: (id: string | null) => void;
  renderCell: (task: NotionTask, col: string) => React.ReactNode;
  onTaskClick: (t: NotionTask) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {groupBy && (
        <TableRow className="hover:bg-transparent cursor-pointer" onClick={onToggle}>
          <TableCell colSpan={visibleColumns.length + 1} className="px-2 h-[34px]">
            <div className="flex items-center gap-1.5">
              {isCollapsed
                ? <ChevronRight className="w-3 h-3 text-muted-foreground" />
                : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
              {group.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: notionDotColor(group.color) }} />}
              <span className="text-sm font-medium text-foreground">{group.label}</span>
              <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
            </div>
          </TableCell>
        </TableRow>
      )}
      {!isCollapsed && group.tasks.map(task => (
        <TableRow key={task.id}
          className={hovered === task.id ? "bg-muted/30" : ""}
          onMouseEnter={() => setHovered(task.id)}
          onMouseLeave={() => setHovered(null)}>
          {visibleColumns.map(col => (
            <TableCell key={col}
              className={`px-2 h-[34px] py-0 border-r border-border/30 last:border-r-0 overflow-hidden ${col === "Task name" ? "cursor-pointer" : ""}`}
              onClick={col === "Task name" ? () => onTaskClick(task) : undefined}>
              {renderCell(task, col)}
            </TableCell>
          ))}
          <TableCell className="w-11 text-center py-0">
            {hovered === task.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 bg-transparent border-none cursor-pointer outline-none rounded hover:bg-muted">
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem onClick={() => onTaskClick(task)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(task.url, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open in Notion
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400 focus:text-red-400">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── Grouping helper ──────────────────────────────────────────────────────
function buildGroups(tasks: NotionTask[], groupBy: string | null) {
  const groups: { label: string; color?: string; tasks: NotionTask[] }[] = [];
  if (!groupBy) { groups.push({ label: "", tasks }); return groups; }

  const map = new Map<string, NotionTask[]>();
  const order: string[] = [];
  const getKey = (t: NotionTask) => {
    if (groupBy === "STATUS") return getStatus(t.properties)?.name || "No status";
    if (groupBy === "Priority") return getPriority(t.properties)?.name || "No priority";
    if (groupBy === "Teammate") return getTeammate(t.properties)?.name || "No teammate";
    return "";
  };
  const getColor = (t: NotionTask) => {
    if (groupBy === "STATUS") return getStatus(t.properties)?.color;
    if (groupBy === "Priority") return getPriority(t.properties)?.color;
    if (groupBy === "Teammate") return getTeammate(t.properties)?.color;
    return undefined;
  };

  for (const t of tasks) {
    const key = getKey(t);
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(t);
  }
  for (const key of order) {
    const sample = map.get(key)![0];
    groups.push({ label: key, color: getColor(sample), tasks: map.get(key)! });
  }
  return groups;
}

TaskTableView.displayName = "TaskTableView";
export default TaskTableView;

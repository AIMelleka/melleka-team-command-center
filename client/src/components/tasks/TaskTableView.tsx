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
  notionTagStyle,
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

// ── Column widths ────────────────────────────────────────────────────────
const W: Record<string, number> = {
  "Task name": 340, STATUS: 200, CLIENTS: 160, Priority: 120,
  Teammate: 130, Managers: 130, Due: 140, "Done ?": 60,
  "Secondary Status": 160, Description: 200,
};

// ── Tag/pill for select values ───────────────────────────────────────────
function Pill({ name, color }: { name: string; color: string }) {
  return (
    <span style={{
      ...notionTagStyle(color),
      display: "inline-flex", alignItems: "center", height: 20,
      borderRadius: 3, padding: "0 6px", fontSize: 12, lineHeight: "20px",
      whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
    }}>
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
      style={{ width: "100%", background: "none", border: "none", outline: "none",
        fontSize: 14, lineHeight: "34px", color: "rgba(255,255,255,0.91)", padding: 0 }}
    />
  );

  return (
    <div onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      style={{ fontSize: 14, lineHeight: "34px", cursor: "text", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap",
        textDecoration: strike ? "line-through" : "none",
        color: strike ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.91)" }}>
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
        <button style={{ display: "flex", alignItems: "center", height: 34,
          background: "none", border: "none", cursor: "pointer", outline: "none", width: "100%", padding: 0 }}>
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
    <div style={{ display: "flex", alignItems: "center" }}>
      {people.slice(0, 5).map((p, i) =>
        p.avatar_url ? (
          <img key={p.name} src={p.avatar_url} alt={p.name} title={p.name}
            style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover",
              border: "2px solid var(--background-raw, #111)", marginLeft: i > 0 ? -6 : 0 }} />
        ) : (
          <div key={p.name} title={p.name}
            style={{ width: 24, height: 24, borderRadius: "50%", marginLeft: i > 0 ? -6 : 0,
              background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)",
              border: "2px solid var(--background-raw, #111)" }}>
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
      style={{ background: "none", border: "none", outline: "none", fontSize: 13,
        color: "rgba(255,255,255,0.72)", lineHeight: "34px" }}
    />
  );

  return (
    <div onClick={() => setEditing(true)}
      style={{ fontSize: 14, lineHeight: "34px", color: "rgba(255,255,255,0.72)", cursor: "pointer" }}>
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
          <div style={{ display: "flex", justifyContent: "center", height: 34, alignItems: "center" }}
            onClick={e => { e.stopPropagation(); mut(task.id, { "Done ?": { checkbox: !getCheckbox(p) } }); }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              background: getCheckbox(p) ? "#2383e2" : "transparent",
              border: getCheckbox(p) ? "none" : "1.5px solid rgba(255,255,255,0.28)" }}>
              {getCheckbox(p) && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
        );
      case "Secondary Status": {
        const ss = getSecondaryStatus(p);
        return ss ? <Pill name={ss.name} color={ss.color} /> : null;
      }
      case "Description":
        return <div style={{ fontSize: 14, lineHeight: "34px", color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getDescription(p)}</div>;
      default: return null;
    }
  };

  // Group tasks
  const groups = buildGroups(tasks, groupBy);
  const totalW = visibleColumns.reduce((s, c) => s + (W[c] || 140), 0) + 44;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: totalW }}>
        <colgroup>
          {visibleColumns.map(col => <col key={col} style={{ width: W[col] || 140 }} />)}
          <col style={{ width: 44 }} />
        </colgroup>
        <thead>
          <tr>
            {visibleColumns.map(col => (
              <th key={col} style={{
                textAlign: "left", padding: "0 8px", height: 33,
                fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.44)",
                borderBottom: "1px solid rgba(255,255,255,0.09)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                whiteSpace: "nowrap", overflow: "hidden",
              }}>
                {col === "Done ?" ? "Done" : col}
              </th>
            ))}
            <th style={{ borderBottom: "1px solid rgba(255,255,255,0.09)", width: 44 }} />
          </tr>
        </thead>
        <tbody>
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
          <tr>
            <td colSpan={visibleColumns.length + 1}
              style={{ padding: "0 8px", height: 34, cursor: "pointer" }}
              onClick={onNewTask}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.28)" }}>
                <Plus style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: 14 }}>New</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

// Separate component for group rows to avoid React key issues with fragments
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
        <tr>
          <td colSpan={visibleColumns.length + 1}
            style={{ padding: "0 8px", height: 34, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            onClick={onToggle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isCollapsed
                ? <ChevronRight style={{ width: 12, height: 12, color: "rgba(255,255,255,0.44)" }} />
                : <ChevronDown style={{ width: 12, height: 12, color: "rgba(255,255,255,0.44)" }} />}
              {group.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: notionDotColor(group.color), flexShrink: 0 }} />}
              <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.81)" }}>{group.label}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{group.tasks.length}</span>
            </div>
          </td>
        </tr>
      )}
      {!isCollapsed && group.tasks.map(task => (
        <tr key={task.id}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: hovered === task.id ? "rgba(255,255,255,0.024)" : "transparent",
            transition: "background 0.1s" }}
          onMouseEnter={() => setHovered(task.id)}
          onMouseLeave={() => setHovered(null)}>
          {visibleColumns.map(col => (
            <td key={col}
              style={{ padding: "0 8px", height: 34, verticalAlign: "middle",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                cursor: col === "Task name" ? "pointer" : "default",
                overflow: "hidden" }}
              onClick={col === "Task name" ? () => onTaskClick(task) : undefined}>
              {renderCell(task, col)}
            </td>
          ))}
          <td style={{ width: 44, textAlign: "center", verticalAlign: "middle" }}>
            {hovered === task.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button style={{ padding: 4, background: "none", border: "none", cursor: "pointer", outline: "none", borderRadius: 3 }}>
                    <MoreHorizontal style={{ width: 14, height: 14, color: "rgba(255,255,255,0.38)" }} />
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
          </td>
        </tr>
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

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
import {
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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

// ── Inline styles (avoid Tailwind arbitrary value issues) ────────────────

const S = {
  pill: (color: string): React.CSSProperties => ({
    ...notionTagStyle(color),
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    borderRadius: 3,
    padding: "0 6px",
    fontSize: 12,
    lineHeight: "20px",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 200,
  }),
  cell: {
    padding: "0 8px",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "middle" as const,
    height: 34,
  },
  headerCell: {
    padding: "0 8px",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.09)",
    height: 33,
    fontSize: 12,
    fontWeight: 400 as const,
    color: "rgba(255,255,255,0.44)",
    textAlign: "left" as const,
    verticalAlign: "middle" as const,
    whiteSpace: "nowrap" as const,
  },
  row: {
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    transition: "background 0.1s",
  },
  text14: {
    fontSize: 14,
    lineHeight: "32px",
    color: "rgba(255,255,255,0.91)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  textDim: {
    fontSize: 14,
    lineHeight: "32px",
    color: "rgba(255,255,255,0.55)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  avatar: (size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: "50%",
    border: "2px solid #191919",
    objectFit: "cover" as const,
  }),
  avatarPlaceholder: (size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: "50%",
    border: "2px solid #191919",
    background: "rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(255,255,255,0.55)",
  }),
};

const COL_WIDTHS: Record<string, number> = {
  "Task name": 340,
  STATUS: 200,
  CLIENTS: 160,
  Priority: 120,
  Teammate: 130,
  Managers: 130,
  Due: 140,
  "Done ?": 60,
  "Secondary Status": 160,
  Description: 200,
};

// ── Sub-components ───────────────────────────────────────────────────────

function InlineText({ value, onSave, strikethrough }: { value: string; onSave: (v: string) => void; strikethrough?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        style={{ width: "100%", background: "transparent", outline: "none", border: "none", fontSize: 14, lineHeight: "32px", color: "rgba(255,255,255,0.91)", padding: 0, margin: 0 }}
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      style={{
        ...S.text14,
        cursor: "text",
        minHeight: 32,
        textDecoration: strikethrough ? "line-through" : "none",
        color: strikethrough ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.91)",
      }}
    >
      {value || "\u00A0"}
    </div>
  );
}

function SelectCell({ current, options, onSelect }: {
  current: { name: string; color: string } | null;
  options: { name: string; color: string }[];
  onSelect: (name: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger style={{ display: "flex", alignItems: "center", minHeight: 32, outline: "none", width: "100%", textAlign: "left" }}>
        {current ? <span style={S.pill(current.color)}>{current.name}</span> : <span style={{ height: 32, display: "block" }}>&nbsp;</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 overflow-y-auto min-w-[200px]" align="start">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.name} onClick={() => onSelect(opt.name)} className="gap-2 py-1.5">
            <span style={S.pill(opt.color)}>{opt.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatars({ people }: { people: { name: string; avatar_url?: string }[] }) {
  if (!people.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {people.slice(0, 5).map((p, i) =>
        p.avatar_url ? (
          <img key={p.name} src={p.avatar_url} alt={p.name} title={p.name} style={{ ...S.avatar(24), marginLeft: i > 0 ? -6 : 0 }} />
        ) : (
          <div key={p.name} title={p.name} style={{ ...S.avatarPlaceholder(24), marginLeft: i > 0 ? -6 : 0 }}>
            {p.name.charAt(0).toUpperCase()}
          </div>
        )
      )}
    </div>
  );
}

function DateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.showPicker?.(); }, [editing]);

  if (editing) {
    return (
      <input ref={ref} type="date" defaultValue={value || ""}
        onBlur={(e) => { setEditing(false); const v = e.target.value || null; if (v !== value) onSave(v); }}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
        style={{ background: "transparent", outline: "none", border: "none", fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: "32px" }}
      />
    );
  }

  const formatted = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div onClick={() => setEditing(true)} style={{ ...S.textDim, cursor: "pointer", minHeight: 32 }}>
      {formatted || "\u00A0"}
    </div>
  );
}

function CheckboxCell({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32 }} onClick={(e) => e.stopPropagation()}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 16, height: 16, borderRadius: 3,
          border: checked ? "none" : "1.5px solid rgba(255,255,255,0.28)",
          background: checked ? "#2383e2" : "transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Main table component ─────────────────────────────────────────────────

const TaskTableView = memo(({
  tasks, onTaskClick, onDelete, onNewTask,
  statusOptions, priorityOptions, teammateOptions,
  visibleColumns, groupBy,
}: Props) => {
  const update = useUpdateTask();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const setStatus = useCallback((id: string, name: string) => update.mutate({ id, properties: { STATUS: { status: { name } } } }), [update]);
  const setPriority = useCallback((id: string, name: string) => update.mutate({ id, properties: { Priority: { select: { name } } } }), [update]);
  const setTeammate = useCallback((id: string, name: string) => update.mutate({ id, properties: { Teammate: { select: { name } } } }), [update]);
  const setTitle = useCallback((id: string, title: string) => update.mutate({ id, properties: { "Task name": { title: [{ text: { content: title } }] } } }), [update]);
  const setClient = useCallback((id: string, client: string) => update.mutate({ id, properties: { CLIENTS: { rich_text: [{ text: { content: client } }] } } }), [update]);
  const setDueDate = useCallback((id: string, date: string | null) => update.mutate({ id, properties: { Due: date ? { date: { start: date } } : { date: null } } }), [update]);
  const setCheckbox = useCallback((id: string, checked: boolean) => update.mutate({ id, properties: { "Done ?": { checkbox: checked } } }), [update]);

  const renderCell = (task: NotionTask, col: string) => {
    const p = task.properties;
    switch (col) {
      case "Task name":
        return <InlineText value={getTitle(p)} onSave={(v) => setTitle(task.id, v)} strikethrough={getCheckbox(p)} />;
      case "STATUS":
        return <SelectCell current={getStatus(p)} options={statusOptions} onSelect={(n) => setStatus(task.id, n)} />;
      case "CLIENTS":
        return <InlineText value={getClient(p)} onSave={(v) => setClient(task.id, v)} />;
      case "Priority":
        return <SelectCell current={getPriority(p)} options={priorityOptions} onSelect={(n) => setPriority(task.id, n)} />;
      case "Teammate":
        return <SelectCell current={getTeammate(p)} options={teammateOptions} onSelect={(n) => setTeammate(task.id, n)} />;
      case "Managers":
        return <Avatars people={getManagers(p)} />;
      case "Due":
        return <DateCell value={getDue(p)} onSave={(v) => setDueDate(task.id, v)} />;
      case "Done ?":
        return <CheckboxCell checked={getCheckbox(p)} onChange={(v) => setCheckbox(task.id, v)} />;
      case "Secondary Status": {
        const ss = getSecondaryStatus(p);
        return ss ? <span style={S.pill(ss.color)}>{ss.name}</span> : null;
      }
      case "Description":
        return <div style={S.textDim}>{getDescription(p) || "\u00A0"}</div>;
      default:
        return null;
    }
  };

  // ── Grouping ─────────────────────────────────────────────────────────
  const groups: { label: string; color?: string; tasks: NotionTask[] }[] = [];
  if (groupBy === "STATUS") {
    const map = new Map<string, NotionTask[]>();
    const order: string[] = [];
    for (const t of tasks) {
      const s = getStatus(t.properties); const key = s?.name || "No status";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(t);
    }
    for (const key of order) {
      const s = tasks.find(t => getStatus(t.properties)?.name === key);
      groups.push({ label: key, color: getStatus(s!.properties)?.color, tasks: map.get(key)! });
    }
  } else if (groupBy === "Priority") {
    const map = new Map<string, NotionTask[]>();
    const order: string[] = [];
    for (const t of tasks) {
      const p = getPriority(t.properties); const key = p?.name || "No priority";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(t);
    }
    for (const key of order) {
      const p = tasks.find(t => getPriority(t.properties)?.name === key);
      groups.push({ label: key, color: getPriority(p!.properties)?.color, tasks: map.get(key)! });
    }
  } else if (groupBy === "Teammate") {
    const map = new Map<string, NotionTask[]>();
    const order: string[] = [];
    for (const t of tasks) {
      const tm = getTeammate(t.properties); const key = tm?.name || "No teammate";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(t);
    }
    for (const key of order) groups.push({ label: key, tasks: map.get(key)! });
  } else {
    groups.push({ label: "", tasks });
  }

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  };

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: visibleColumns.reduce((a, c) => a + (COL_WIDTHS[c] || 140), 0) + 44 }}>
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th key={col} style={{ ...S.headerCell, width: COL_WIDTHS[col] || 140, minWidth: COL_WIDTHS[col] || 140 }}>
                {col === "Done ?" ? "Done" : col}
              </th>
            ))}
            <th style={{ ...S.headerCell, width: 44, minWidth: 44, borderRight: "none" }} />
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => (
            <>
              {/* Group header row */}
              {groupBy && (
                <tr key={`g-${gi}`}>
                  <td
                    colSpan={visibleColumns.length + 1}
                    style={{ padding: "0 8px", height: 34, borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", background: "transparent" }}
                    onClick={() => toggleGroup(group.label)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {collapsed.has(group.label)
                        ? <ChevronRight style={{ width: 12, height: 12, color: "rgba(255,255,255,0.44)" }} />
                        : <ChevronDown style={{ width: 12, height: 12, color: "rgba(255,255,255,0.44)" }} />
                      }
                      {group.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: notionDotColor(group.color), flexShrink: 0 }} />}
                      <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.81)" }}>{group.label}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{group.tasks.length}</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Task rows */}
              {!collapsed.has(group.label) && group.tasks.map((task) => (
                <tr
                  key={task.id}
                  style={{ ...S.row, background: hoveredRow === task.id ? "rgba(255,255,255,0.024)" : "transparent" }}
                  onMouseEnter={() => setHoveredRow(task.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col}
                      style={{ ...S.cell, width: COL_WIDTHS[col] || 140, cursor: col === "Task name" ? "pointer" : "default" }}
                      onClick={col === "Task name" ? () => onTaskClick(task) : undefined}
                    >
                      {renderCell(task, col)}
                    </td>
                  ))}
                  <td style={{ ...S.cell, width: 44, borderRight: "none", textAlign: "center" }}>
                    {hoveredRow === task.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger style={{ padding: 4, borderRadius: 3, outline: "none", display: "inline-flex" }}>
                          <MoreHorizontal style={{ width: 14, height: 14, color: "rgba(255,255,255,0.38)" }} />
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
          ))}

          {/* New row */}
          <tr>
            <td
              colSpan={visibleColumns.length + 1}
              style={{ padding: "0 8px", height: 34, cursor: "pointer" }}
              onClick={onNewTask}
            >
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

TaskTableView.displayName = "TaskTableView";
export default TaskTableView;

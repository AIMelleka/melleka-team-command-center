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
  NOTION_TAG_STYLES,
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

/* ── Notion pill/tag ──────────────────────────────────────────────────── */

function Tag({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center h-[20px] rounded-[3px] px-[6px] text-[12px] leading-[20px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
      style={notionTagStyle(color)}
    >
      {name}
    </span>
  );
}

/* ── Inline text editor ───────────────────────────────────────────────── */

function InlineText({
  value,
  onSave,
  strikethrough,
}: {
  value: string;
  onSave: (v: string) => void;
  strikethrough?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) { ref.current?.focus(); ref.current?.select(); }
  }, [editing]);

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
        className="w-full bg-transparent outline-none border-none text-[14px] leading-[32px] text-[rgba(255,255,255,0.91)] px-0 m-0"
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      className={`text-[14px] leading-[32px] truncate cursor-text min-h-[32px] ${
        strikethrough ? "line-through text-[rgba(255,255,255,0.38)]" : "text-[rgba(255,255,255,0.91)]"
      }`}
    >
      {value || "\u00A0"}
    </div>
  );
}

/* ── Select cell (status/priority/teammate) ───────────────────────────── */

function SelectCell({
  current,
  options,
  onSelect,
}: {
  current: { name: string; color: string } | null;
  options: { name: string; color: string }[];
  onSelect: (name: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full h-full text-left outline-none min-h-[32px] flex items-center">
        {current ? <Tag name={current.name} color={current.color} /> : <span className="h-[32px]">&nbsp;</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[320px] overflow-y-auto min-w-[200px]" align="start">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.name} onClick={() => onSelect(opt.name)} className="gap-2 py-[6px]">
            <Tag name={opt.name} color={opt.color} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── People avatars ───────────────────────────────────────────────────── */

function Avatars({ people }: { people: { name: string; avatar_url?: string }[] }) {
  if (!people.length) return null;
  return (
    <div className="flex items-center -space-x-[6px]">
      {people.slice(0, 5).map((p) =>
        p.avatar_url ? (
          <img key={p.name} src={p.avatar_url} alt={p.name} title={p.name}
            className="w-[24px] h-[24px] rounded-full border-[2px] border-[#191919] object-cover" />
        ) : (
          <div key={p.name} title={p.name}
            className="w-[24px] h-[24px] rounded-full border-[2px] border-[#191919] bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[11px] font-medium text-[rgba(255,255,255,0.55)]">
            {p.name.charAt(0).toUpperCase()}
          </div>
        )
      )}
    </div>
  );
}

/* ── Date cell ────────────────────────────────────────────────────────── */

function DateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.showPicker?.(); }, [editing]);

  if (editing) {
    return (
      <input ref={ref} type="date" defaultValue={value || ""}
        onBlur={(e) => { setEditing(false); const v = e.target.value || null; if (v !== value) onSave(v); }}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
        className="bg-transparent outline-none border-none text-[13px] text-[rgba(255,255,255,0.72)] leading-[32px]"
      />
    );
  }

  const formatted = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div onClick={() => setEditing(true)} className="text-[14px] leading-[32px] text-[rgba(255,255,255,0.72)] cursor-pointer min-h-[32px]">
      {formatted || "\u00A0"}
    </div>
  );
}

/* ── Checkbox cell ────────────────────────────────────────────────────── */

function CheckboxCell({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-center h-[32px]" onClick={(e) => e.stopPropagation()}>
      <div
        onClick={() => onChange(!checked)}
        className={`w-[16px] h-[16px] rounded-[3px] border cursor-pointer flex items-center justify-center transition-colors ${
          checked
            ? "bg-[#2383e2] border-[#2383e2]"
            : "border-[rgba(255,255,255,0.282)] hover:border-[rgba(255,255,255,0.45)]"
        }`}
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

/* ── Column config ────────────────────────────────────────────────────── */

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

/* ── Main table ───────────────────────────────────────────────────────── */

const TaskTableView = memo(({
  tasks,
  onTaskClick,
  onDelete,
  onNewTask,
  statusOptions,
  priorityOptions,
  teammateOptions,
  visibleColumns,
  groupBy,
}: Props) => {
  const update = useUpdateTask();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const setStatus = useCallback((id: string, name: string) => {
    update.mutate({ id, properties: { STATUS: { status: { name } } } });
  }, [update]);
  const setPriority = useCallback((id: string, name: string) => {
    update.mutate({ id, properties: { Priority: { select: { name } } } });
  }, [update]);
  const setTeammate = useCallback((id: string, name: string) => {
    update.mutate({ id, properties: { Teammate: { select: { name } } } });
  }, [update]);
  const setTitle = useCallback((id: string, title: string) => {
    update.mutate({ id, properties: { "Task name": { title: [{ text: { content: title } }] } } });
  }, [update]);
  const setClient = useCallback((id: string, client: string) => {
    update.mutate({ id, properties: { CLIENTS: { rich_text: [{ text: { content: client } }] } } });
  }, [update]);
  const setDueDate = useCallback((id: string, date: string | null) => {
    update.mutate({ id, properties: { Due: date ? { date: { start: date } } : { date: null } } });
  }, [update]);
  const setCheckbox = useCallback((id: string, checked: boolean) => {
    update.mutate({ id, properties: { "Done ?": { checkbox: checked } } });
  }, [update]);

  const renderCell = (task: NotionTask, col: string) => {
    const p = task.properties;
    switch (col) {
      case "Task name":
        return (
          <InlineText
            value={getTitle(p)}
            onSave={(v) => setTitle(task.id, v)}
            strikethrough={getCheckbox(p)}
          />
        );
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
        return ss ? <Tag name={ss.name} color={ss.color} /> : null;
      }
      case "Description":
        return (
          <div className="text-[14px] leading-[32px] text-[rgba(255,255,255,0.55)] truncate">
            {getDescription(p) || "\u00A0"}
          </div>
        );
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
      const s = getStatus(t.properties);
      const key = s?.name || "No status";
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
      const p = getPriority(t.properties);
      const key = p?.name || "No priority";
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
      const tm = getTeammate(t.properties);
      const key = tm?.name || "No teammate";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(t);
    }
    for (const key of order) groups.push({ label: key, tasks: map.get(key)! });
  } else {
    groups.push({ label: "", tasks });
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  return (
    <div className="w-full overflow-x-auto">
      {/* Column headers */}
      <div className="flex border-b border-[rgba(255,255,255,0.094)]" style={{ minWidth: visibleColumns.reduce((a, c) => a + (COL_WIDTHS[c] || 140), 0) + 44 }}>
        {visibleColumns.map((col) => (
          <div
            key={col}
            className="flex items-center gap-[6px] px-[8px] h-[33px] text-[12px] text-[rgba(255,255,255,0.443)] border-r border-[rgba(255,255,255,0.055)] select-none shrink-0"
            style={{ width: COL_WIDTHS[col] || 140 }}
          >
            <span className="truncate">{col === "Done ?" ? "Done" : col}</span>
          </div>
        ))}
        <div className="w-[44px] shrink-0" />
      </div>

      {/* Groups + rows */}
      {groups.map((group) => (
        <div key={group.label || "__all"}>
          {/* Group header */}
          {groupBy && (
            <div
              className="flex items-center gap-[6px] h-[34px] px-[8px] cursor-pointer hover:bg-[rgba(255,255,255,0.024)] select-none sticky top-0 bg-background z-[1]"
              onClick={() => setCollapsed((prev) => {
                const n = new Set(prev);
                n.has(group.label) ? n.delete(group.label) : n.add(group.label);
                return n;
              })}
            >
              {collapsed.has(group.label)
                ? <ChevronRight className="h-[12px] w-[12px] text-[rgba(255,255,255,0.443)]" />
                : <ChevronDown className="h-[12px] w-[12px] text-[rgba(255,255,255,0.443)]" />
              }
              {group.color && (
                <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: notionDotColor(group.color) }} />
              )}
              <span className="text-[14px] font-medium text-[rgba(255,255,255,0.81)]">{group.label}</span>
              <span className="text-[12px] text-[rgba(255,255,255,0.282)]">{group.tasks.length}</span>
            </div>
          )}

          {/* Rows */}
          {!collapsed.has(group.label) && group.tasks.map((task) => (
            <div
              key={task.id}
              className="flex border-b border-[rgba(255,255,255,0.055)] hover:bg-[rgba(255,255,255,0.024)] transition-colors group/row"
              style={{ minWidth: visibleColumns.reduce((a, c) => a + (COL_WIDTHS[c] || 140), 0) + 44 }}
              onMouseEnter={() => setHoveredRow(task.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {visibleColumns.map((col) => (
                <div
                  key={col}
                  className={`px-[8px] border-r border-[rgba(255,255,255,0.055)] shrink-0 flex items-center min-h-[34px] ${
                    col === "Task name" ? "cursor-pointer" : ""
                  }`}
                  style={{ width: COL_WIDTHS[col] || 140 }}
                  onClick={col === "Task name" ? () => onTaskClick(task) : undefined}
                >
                  {renderCell(task, col)}
                </div>
              ))}
              {/* Row actions */}
              <div className="w-[44px] shrink-0 flex items-center justify-center">
                {hoveredRow === task.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-[4px] rounded-[3px] hover:bg-[rgba(255,255,255,0.055)] outline-none">
                      <MoreHorizontal className="h-[14px] w-[14px] text-[rgba(255,255,255,0.38)]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      <DropdownMenuItem onClick={() => onTaskClick(task)}>
                        <ExternalLink className="h-[14px] w-[14px] mr-[8px]" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(task.url, "_blank")}>
                        <ExternalLink className="h-[14px] w-[14px] mr-[8px]" /> Open in Notion
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400 focus:text-red-400">
                        <Trash2 className="h-[14px] w-[14px] mr-[8px]" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* New row */}
      <div
        className="flex items-center h-[34px] px-[8px] cursor-pointer hover:bg-[rgba(255,255,255,0.024)] transition-colors"
        onClick={onNewTask}
      >
        <Plus className="h-[14px] w-[14px] text-[rgba(255,255,255,0.282)] mr-[6px]" />
        <span className="text-[14px] text-[rgba(255,255,255,0.282)]">New</span>
      </div>
    </div>
  );
});

TaskTableView.displayName = "TaskTableView";
export default TaskTableView;

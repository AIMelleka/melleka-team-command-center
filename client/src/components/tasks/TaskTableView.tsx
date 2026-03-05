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
  colorClass,
  useUpdateTask,
} from "@/hooks/useNotionTasks";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreHorizontal,
  ExternalLink,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TaskTableViewProps {
  tasks: NotionTask[];
  onTaskClick: (task: NotionTask) => void;
  onDelete: (id: string) => void;
  statusOptions: { name: string; color: string }[];
  priorityOptions: { name: string; color: string }[];
  teammateOptions: { name: string; color: string }[];
}

// ── Inline editable cell ──────────────────────────────────────────────────

function InlineEditCell({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          "w-full bg-transparent border-none outline-none ring-1 ring-blue-500 rounded px-1 py-0.5 text-sm",
          className
        )}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn("cursor-default truncate text-sm", className)}
    >
      {value || <span className="text-muted-foreground italic">Empty</span>}
    </span>
  );
}

// ── Select dropdown cell ──────────────────────────────────────────────────

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
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1 max-w-full">
          {current ? (
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium truncate max-w-[180px]",
                colorClass(current.color)
              )}
            >
              {current.name}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic px-2 py-0.5">
              Empty
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[300px] overflow-y-auto min-w-[200px]"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.name}
            onClick={() => onSelect(opt.name)}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                colorClass(opt.color)
              )}
            >
              {opt.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Date cell ─────────────────────────────────────────────────────────────

function DateCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (val: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value || ""}
        onBlur={(e) => {
          setEditing(false);
          const val = e.target.value || null;
          if (val !== value) onSave(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        className="bg-transparent border-none outline-none ring-1 ring-blue-500 rounded px-1 py-0.5 text-xs w-[130px]"
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className="text-xs cursor-default text-muted-foreground"
    >
      {value ? new Date(value + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) : (
        <span className="italic">No date</span>
      )}
    </span>
  );
}

// ── People cell ───────────────────────────────────────────────────────────

function PeopleCell({ people }: { people: { name: string; avatar_url?: string }[] }) {
  if (!people.length) return <span className="text-xs text-muted-foreground italic">-</span>;
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {people.map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-1 shrink-0"
          title={p.name}
        >
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt={p.name}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] font-medium text-zinc-200">
              {p.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main table view ───────────────────────────────────────────────────────

const TaskTableView = memo(
  ({
    tasks,
    onTaskClick,
    onDelete,
    statusOptions,
    priorityOptions,
    teammateOptions,
  }: TaskTableViewProps) => {
    const updateTask = useUpdateTask();
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);

    const handleUpdateStatus = useCallback(
      (taskId: string, statusName: string) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            STATUS: { status: { name: statusName } },
          },
        });
      },
      [updateTask]
    );

    const handleUpdatePriority = useCallback(
      (taskId: string, priorityName: string) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            Priority: { select: { name: priorityName } },
          },
        });
      },
      [updateTask]
    );

    const handleUpdateTeammate = useCallback(
      (taskId: string, teammateName: string) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            Teammate: { select: { name: teammateName } },
          },
        });
      },
      [updateTask]
    );

    const handleUpdateTitle = useCallback(
      (taskId: string, title: string) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            "Task name": {
              title: [{ text: { content: title } }],
            },
          },
        });
      },
      [updateTask]
    );

    const handleUpdateClient = useCallback(
      (taskId: string, client: string) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            CLIENTS: {
              rich_text: [{ text: { content: client } }],
            },
          },
        });
      },
      [updateTask]
    );

    const handleUpdateDue = useCallback(
      (taskId: string, date: string | null) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            Due: date ? { date: { start: date } } : { date: null },
          },
        });
      },
      [updateTask]
    );

    const handleUpdateCheckbox = useCallback(
      (taskId: string, checked: boolean) => {
        updateTask.mutate({
          id: taskId,
          properties: {
            "Done ?": { checkbox: checked },
          },
        });
      },
      [updateTask]
    );

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-medium min-w-[280px]">Task name</th>
              <th className="px-3 py-2 font-medium min-w-[180px]">Status</th>
              <th className="px-3 py-2 font-medium min-w-[120px]">Client</th>
              <th className="px-3 py-2 font-medium min-w-[120px]">Priority</th>
              <th className="px-3 py-2 font-medium min-w-[100px]">Teammate</th>
              <th className="px-3 py-2 font-medium min-w-[80px]">Managers</th>
              <th className="px-3 py-2 font-medium min-w-[120px]">Due</th>
              <th className="px-3 py-2 font-medium w-8" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const title = getTitle(task.properties);
              const status = getStatus(task.properties);
              const client = getClient(task.properties);
              const priority = getPriority(task.properties);
              const teammate = getTeammate(task.properties);
              const due = getDue(task.properties);
              const managers = getManagers(task.properties);
              const done = getCheckbox(task.properties);
              const isHovered = hoveredRow === task.id;

              return (
                <tr
                  key={task.id}
                  className={cn(
                    "border-b border-border/50 transition-colors group",
                    isHovered && "bg-muted/50"
                  )}
                  onMouseEnter={() => setHoveredRow(task.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      {isHovered && (
                        <GripVertical className="h-3 w-3 text-muted-foreground/40 cursor-grab" />
                      )}
                      <Checkbox
                        checked={done}
                        onCheckedChange={(checked) =>
                          handleUpdateCheckbox(task.id, checked as boolean)
                        }
                        className="h-4 w-4"
                      />
                    </div>
                  </td>

                  {/* Task name */}
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onTaskClick(task)}
                        className="flex-1 text-left"
                      >
                        <InlineEditCell
                          value={title}
                          onSave={(val) => handleUpdateTitle(task.id, val)}
                          className={cn(done && "line-through text-muted-foreground")}
                        />
                      </button>
                      {isHovered && (
                        <button
                          onClick={() => onTaskClick(task)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-1.5">
                    <SelectCell
                      current={status}
                      options={statusOptions}
                      onSelect={(name) => handleUpdateStatus(task.id, name)}
                    />
                  </td>

                  {/* Client */}
                  <td className="px-3 py-1.5">
                    <InlineEditCell
                      value={client}
                      onSave={(val) => handleUpdateClient(task.id, val)}
                    />
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-1.5">
                    <SelectCell
                      current={priority}
                      options={priorityOptions}
                      onSelect={(name) => handleUpdatePriority(task.id, name)}
                    />
                  </td>

                  {/* Teammate */}
                  <td className="px-3 py-1.5">
                    <SelectCell
                      current={teammate}
                      options={teammateOptions}
                      onSelect={(name) => handleUpdateTeammate(task.id, name)}
                    />
                  </td>

                  {/* Managers */}
                  <td className="px-3 py-1.5">
                    <PeopleCell people={managers} />
                  </td>

                  {/* Due */}
                  <td className="px-3 py-1.5">
                    <DateCell
                      value={due}
                      onSave={(val) => handleUpdateDue(task.id, val)}
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-1.5">
                    {isHovered && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onTaskClick(task)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(task.url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in Notion
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(task.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

TaskTableView.displayName = "TaskTableView";
export default TaskTableView;

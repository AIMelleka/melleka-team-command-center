import { memo, useState, useCallback, useMemo } from "react";
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
  notionTagStyle,
  notionDotColor,
  useUpdateTask,
  STATUS_GROUPS,
} from "@/hooks/useNotionTasks";
import { Plus, MoreHorizontal, ExternalLink, Trash2, Calendar, User } from "lucide-react";
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
  onCreateInStatus: (statusName: string) => void;
  statusOptions: { name: string; color: string }[];
}

// ── Kanban card ───────────────────────────────────────────────────────────

function Card({
  task,
  onClick,
  onDelete,
  onDragStart,
}: {
  task: NotionTask;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const title = getTitle(task.properties);
  const client = getClient(task.properties);
  const priority = getPriority(task.properties);
  const teammate = getTeammate(task.properties);
  const due = getDue(task.properties);
  const managers = getManagers(task.properties);
  const done = getCheckbox(task.properties);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group relative bg-[rgba(255,255,255,0.024)] hover:bg-[rgba(255,255,255,0.055)] border border-[rgba(255,255,255,0.094)] rounded-[4px] px-[10px] py-[8px] cursor-pointer transition-all shadow-sm hover:shadow-md"
    >
      {/* Title */}
      <p className={`text-[14px] leading-[1.5] font-normal mb-[6px] ${done ? "line-through text-[rgba(255,255,255,0.4)]" : "text-foreground"}`}>
        {title || "Untitled"}
      </p>

      {/* Properties */}
      <div className="flex flex-wrap items-center gap-[4px]">
        {client && (
          <span className="text-[12px] leading-[20px] px-[6px] rounded-[3px] bg-[rgba(255,255,255,0.055)] text-[rgba(255,255,255,0.65)] truncate max-w-[140px]">
            {client}
          </span>
        )}
        {priority && (
          <span
            className="text-[12px] leading-[20px] px-[6px] rounded-[3px] font-normal"
            style={notionTagStyle(priority.color)}
          >
            {priority.name}
          </span>
        )}
        {teammate && (
          <span className="flex items-center gap-[3px] text-[12px] text-[rgba(255,255,255,0.443)]">
            <User className="h-[12px] w-[12px]" />
            {teammate.name}
          </span>
        )}
        {due && (
          <span className="flex items-center gap-[3px] text-[12px] text-[rgba(255,255,255,0.443)]">
            <Calendar className="h-[12px] w-[12px]" />
            {new Date(due + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      {/* Managers */}
      {managers.length > 0 && (
        <div className="flex items-center -space-x-1 mt-[6px]">
          {managers.map((m) =>
            m.avatar_url ? (
              <img key={m.name} src={m.avatar_url} alt={m.name} title={m.name} className="w-[20px] h-[20px] rounded-full border-2 border-background object-cover" />
            ) : (
              <div key={m.name} title={m.name} className="w-[20px] h-[20px] rounded-full border-2 border-background bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[9px] font-medium text-[rgba(255,255,255,0.6)]">
                {m.name.charAt(0).toUpperCase()}
              </div>
            )
          )}
        </div>
      )}

      {/* Hover menu */}
      <div className="absolute top-[4px] right-[4px] hidden group-hover:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-[3px] rounded bg-background/90 hover:bg-[rgba(255,255,255,0.1)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-[14px] w-[14px] text-[rgba(255,255,255,0.4)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={onClick}><ExternalLink className="h-4 w-4 mr-2" />Open</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 focus:text-red-400">
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────

function Column({
  groupName,
  groupColor,
  statuses,
  tasks,
  onTaskClick,
  onDelete,
  onCreateInStatus,
  onDrop,
}: {
  groupName: string;
  groupColor: string;
  statuses: string[];
  tasks: NotionTask[];
  onTaskClick: (t: NotionTask) => void;
  onDelete: (id: string) => void;
  onCreateInStatus: (s: string) => void;
  onDrop: (taskId: string, status: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const defaultStatus = statuses[0] || groupName;

  const groupDotColors: Record<string, string> = {
    gray: "#9B9A97",
    blue: "#0B6E99",
    green: "#0F7B6C",
  };

  return (
    <div
      className={`flex flex-col min-w-[280px] max-w-[320px] shrink-0 ${dragOver ? "ring-2 ring-blue-500/30 rounded" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("taskId");
        if (id) onDrop(id, defaultStatus);
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-[6px] px-[6px] py-[8px] mb-[2px]">
        <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: groupDotColors[groupColor] || "#9B9A97" }} />
        <span className="text-[14px] font-medium text-foreground">{groupName}</span>
        <span className="text-[12px] text-[rgba(255,255,255,0.282)]">{tasks.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onCreateInStatus(defaultStatus)} className="p-[3px] rounded hover:bg-[rgba(255,255,255,0.055)] text-[rgba(255,255,255,0.282)] hover:text-[rgba(255,255,255,0.5)]">
            <Plus className="h-[14px] w-[14px]" />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-[6px] px-[2px] flex-1 min-h-[60px]">
        {tasks.map((task) => (
          <Card
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onDelete={() => onDelete(task.id)}
            onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
          />
        ))}
      </div>

      {/* Add new */}
      <button
        onClick={() => onCreateInStatus(defaultStatus)}
        className="flex items-center gap-1.5 px-[6px] py-[8px] mt-[4px] text-[14px] text-[rgba(255,255,255,0.282)] hover:text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.024)] rounded transition-colors"
      >
        <Plus className="h-[14px] w-[14px]" />
        New
      </button>
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────

const TaskBoardView = memo(({ tasks, onTaskClick, onDelete, onCreateInStatus, statusOptions }: Props) => {
  const update = useUpdateTask();

  const columns = useMemo(() => {
    const groups = [
      { name: "To-do", color: "gray", statuses: STATUS_GROUPS["To-do"] },
      { name: "In progress", color: "blue", statuses: STATUS_GROUPS["In progress"] },
      { name: "Complete", color: "green", statuses: STATUS_GROUPS["Complete"] },
    ];
    return groups.map((g) => ({
      ...g,
      tasks: tasks.filter((t) => {
        const s = getStatus(t.properties);
        return s && g.statuses.includes(s.name);
      }),
    }));
  }, [tasks]);

  const handleDrop = useCallback((taskId: string, statusName: string) => {
    update.mutate({ id: taskId, properties: { STATUS: { status: { name: statusName } } } });
  }, [update]);

  return (
    <div className="flex gap-[8px] overflow-x-auto pb-4 min-h-[400px]">
      {columns.map((col) => (
        <Column
          key={col.name}
          groupName={col.name}
          groupColor={col.color}
          statuses={col.statuses}
          tasks={col.tasks}
          onTaskClick={onTaskClick}
          onDelete={onDelete}
          onCreateInStatus={onCreateInStatus}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
});

TaskBoardView.displayName = "TaskBoardView";
export default TaskBoardView;

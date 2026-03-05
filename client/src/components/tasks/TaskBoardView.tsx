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
  colorClass,
  useUpdateTask,
  STATUS_GROUPS,
} from "@/hooks/useNotionTasks";
import { cn } from "@/lib/utils";
import { CalendarDays, User, MoreHorizontal, Plus, ExternalLink, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskBoardViewProps {
  tasks: NotionTask[];
  onTaskClick: (task: NotionTask) => void;
  onDelete: (id: string) => void;
  onCreateInStatus: (statusName: string) => void;
  statusOptions: { name: string; color: string }[];
}

// ── Kanban Card ───────────────────────────────────────────────────────────

function KanbanCard({
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
      className={cn(
        "group bg-card border border-border rounded-lg p-3 cursor-pointer",
        "hover:border-blue-500/50 hover:shadow-md transition-all",
        "active:shadow-lg active:scale-[0.98]"
      )}
    >
      {/* Title */}
      <p
        className={cn(
          "text-sm font-medium mb-2 line-clamp-2",
          done && "line-through text-muted-foreground"
        )}
      >
        {title || "Untitled"}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {client && (
          <span className="text-[11px] bg-zinc-800 text-zinc-300 rounded px-1.5 py-0.5 truncate max-w-[120px]">
            {client}
          </span>
        )}
        {priority && (
          <span
            className={cn(
              "text-[11px] rounded px-1.5 py-0.5 font-medium",
              colorClass(priority.color)
            )}
          >
            {priority.name}
          </span>
        )}
        {teammate && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <User className="h-3 w-3" />
            {teammate.name}
          </span>
        )}
        {due && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {new Date(due + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Managers avatars */}
      {managers.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          {managers.map((m) =>
            m.avatar_url ? (
              <img
                key={m.name}
                src={m.avatar_url}
                alt={m.name}
                className="w-5 h-5 rounded-full object-cover"
                title={m.name}
              />
            ) : (
              <div
                key={m.name}
                className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] font-medium text-zinc-200"
                title={m.name}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            )
          )}
        </div>
      )}

      {/* Hover actions */}
      <div className="hidden group-hover:flex absolute top-2 right-2 gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded bg-background/80 hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onClick}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────

function KanbanColumn({
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
  onTaskClick: (task: NotionTask) => void;
  onDelete: (id: string) => void;
  onCreateInStatus: (statusName: string) => void;
  onDrop: (taskId: string, statusName: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const defaultStatus = statuses[0] || groupName;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const taskId = e.dataTransfer.getData("taskId");
      if (taskId) onDrop(taskId, defaultStatus);
    },
    [onDrop, defaultStatus]
  );

  const groupColorMap: Record<string, string> = {
    gray: "bg-zinc-500",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
  };

  return (
    <div
      className={cn(
        "flex flex-col min-w-[280px] max-w-[320px] shrink-0",
        dragOver && "ring-2 ring-blue-500/50 rounded-lg"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-2">
        <div className={cn("w-2.5 h-2.5 rounded-full", groupColorMap[groupColor] || "bg-zinc-500")} />
        <span className="text-sm font-semibold text-foreground">{groupName}</span>
        <span className="text-xs text-muted-foreground ml-1">{tasks.length}</span>
        <button
          onClick={() => onCreateInStatus(defaultStatus)}
          className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 px-1 flex-1 min-h-[100px]">
        {tasks.map((task) => (
          <div key={task.id} className="relative">
            <KanbanCard
              task={task}
              onClick={() => onTaskClick(task)}
              onDelete={() => onDelete(task.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData("taskId", task.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Board View ───────────────────────────────────────────────────────

const TaskBoardView = memo(
  ({
    tasks,
    onTaskClick,
    onDelete,
    onCreateInStatus,
    statusOptions,
  }: TaskBoardViewProps) => {
    const updateTask = useUpdateTask();

    // Group tasks by STATUS group
    const columns = useMemo(() => {
      const groups = [
        { name: "To-do", color: "gray", statuses: STATUS_GROUPS["To-do"] },
        { name: "In progress", color: "blue", statuses: STATUS_GROUPS["In progress"] },
        { name: "Complete", color: "green", statuses: STATUS_GROUPS["Complete"] },
      ];

      return groups.map((group) => ({
        ...group,
        tasks: tasks.filter((task) => {
          const status = getStatus(task.properties);
          return status && group.statuses.includes(status.name);
        }),
      }));
    }, [tasks]);

    const handleDrop = useCallback(
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

    return (
      <div className="flex gap-4 overflow-x-auto pb-4 px-1 min-h-[400px]">
        {columns.map((col) => (
          <KanbanColumn
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
  }
);

TaskBoardView.displayName = "TaskBoardView";
export default TaskBoardView;

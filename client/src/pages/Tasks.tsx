import { useState, useMemo, useCallback } from "react";
import AdminHeader from "@/components/AdminHeader";
import TaskTableView from "@/components/tasks/TaskTableView";
import TaskBoardView from "@/components/tasks/TaskBoardView";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import {
  useTasks,
  useDatabase,
  useCreateTask,
  useDeleteTask,
  NotionTask,
  TaskFilters,
} from "@/hooks/useNotionTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search, Table, Columns3, Filter, SortAsc, SortDesc, X, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ViewMode = "table" | "board";

export default function Tasks() {
  // ── State ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [filters, setFilters] = useState<TaskFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [selectedTask, setSelectedTask] = useState<NotionTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskClient, setNewTaskClient] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("");
  const [newTaskTeammate, setNewTaskTeammate] = useState("");
  const [activeFilters, setActiveFilters] = useState<
    { property: string; value: string }[]
  >([]);

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: tasksData, isLoading, refetch, isFetching } = useTasks(filters);
  const { data: dbSchema } = useDatabase();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  // ── Extract options from database schema ──────────────────────────────
  const statusOptions = useMemo(() => {
    if (!dbSchema?.properties?.STATUS?.status?.options) return [];
    return dbSchema.properties.STATUS.status.options.map((o: any) => ({
      name: o.name,
      color: o.color,
    }));
  }, [dbSchema]);

  const priorityOptions = useMemo(() => {
    if (!dbSchema?.properties?.Priority?.select?.options) return [];
    return dbSchema.properties.Priority.select.options.map((o: any) => ({
      name: o.name,
      color: o.color,
    }));
  }, [dbSchema]);

  const teammateOptions = useMemo(() => {
    if (!dbSchema?.properties?.Teammate?.select?.options) return [];
    return dbSchema.properties.Teammate.select.options.map((o: any) => ({
      name: o.name,
      color: o.color,
    }));
  }, [dbSchema]);

  const tasks = tasksData?.results || [];

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    setFilters((f) => ({ ...f, search: searchInput || undefined }));
  }, [searchInput]);

  const handleAddFilter = useCallback(
    (property: string, value: string) => {
      setActiveFilters((prev) => [...prev, { property, value }]);
      setFilters((prev) => ({ ...prev, [property]: value }));
    },
    []
  );

  const handleRemoveFilter = useCallback(
    (index: number) => {
      setActiveFilters((prev) => {
        const next = [...prev];
        const removed = next.splice(index, 1)[0];
        setFilters((f) => {
          const updated = { ...f };
          delete (updated as any)[removed.property];
          return updated;
        });
        return next;
      });
    },
    []
  );

  const handleTaskClick = useCallback((task: NotionTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteTask.mutate(id, {
        onSuccess: () => toast.success("Task deleted"),
      });
    },
    [deleteTask]
  );

  const handleCreateTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;

    const properties: Record<string, any> = {
      "Task name": {
        title: [{ text: { content: newTaskTitle.trim() } }],
      },
    };

    if (newTaskClient) {
      properties.CLIENTS = {
        rich_text: [{ text: { content: newTaskClient } }],
      };
    }
    if (newTaskDescription) {
      properties.Description = {
        rich_text: [{ text: { content: newTaskDescription } }],
      };
    }
    if (newTaskStatus) {
      properties.STATUS = { status: { name: newTaskStatus } };
    }
    if (newTaskPriority) {
      properties.Priority = { select: { name: newTaskPriority } };
    }
    if (newTaskTeammate) {
      properties.Teammate = { select: { name: newTaskTeammate } };
    }

    createTask.mutate(properties, {
      onSuccess: () => {
        toast.success("Task created");
        setNewTaskOpen(false);
        setNewTaskTitle("");
        setNewTaskClient("");
        setNewTaskDescription("");
        setNewTaskStatus("");
        setNewTaskPriority("");
        setNewTaskTeammate("");
      },
    });
  }, [
    createTask,
    newTaskTitle,
    newTaskClient,
    newTaskDescription,
    newTaskStatus,
    newTaskPriority,
    newTaskTeammate,
  ]);

  const handleCreateInStatus = useCallback(
    (statusName: string) => {
      setNewTaskStatus(statusName);
      setNewTaskOpen(true);
    },
    []
  );

  const handleSort = useCallback(
    (sortBy: string, sortDir: "ascending" | "descending") => {
      setFilters((f) => ({ ...f, sortBy, sortDir }));
    },
    []
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              🔥 IN HOUSE TO-DO
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tasks.length} tasks
              {tasksData?.has_more && "+"} loaded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8"
            >
              <RefreshCw
                className={cn("h-4 w-4", isFetching && "animate-spin")}
              />
            </Button>
            <Button
              size="sm"
              onClick={() => setNewTaskOpen(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* View switcher */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "table"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Table className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "board"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Board
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search tasks..."
                className="h-8 pl-7 w-[200px] text-xs"
              />
            </div>
            {searchInput && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setSearchInput("");
                  setFilters((f) => ({ ...f, search: undefined }));
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[280px] max-h-[400px] overflow-y-auto"
            >
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {statusOptions.map((opt: { name: string; color: string }) => (
                <DropdownMenuItem
                  key={opt.name}
                  onClick={() => handleAddFilter("status", opt.name)}
                >
                  <span className="text-xs truncate">{opt.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              {priorityOptions.map((opt: { name: string; color: string }) => (
                <DropdownMenuItem
                  key={opt.name}
                  onClick={() => handleAddFilter("priority", opt.name)}
                >
                  <span className="text-xs">{opt.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Teammate</DropdownMenuLabel>
              {teammateOptions.map((opt: { name: string; color: string }) => (
                <DropdownMenuItem
                  key={opt.name}
                  onClick={() => handleAddFilter("teammate", opt.name)}
                >
                  <span className="text-xs">{opt.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                {filters.sortDir === "ascending" ? (
                  <SortAsc className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <SortDesc className="h-3.5 w-3.5 mr-1" />
                )}
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => handleSort("last_edited_time", "descending")}
              >
                Last edited (newest)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSort("last_edited_time", "ascending")}
              >
                Last edited (oldest)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSort("created_time", "descending")}
              >
                Created (newest)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSort("created_time", "ascending")}
              >
                Created (oldest)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active filter chips */}
          {activeFilters.map((f, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1 bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-xs"
            >
              <span className="text-muted-foreground">{f.property}:</span>
              <span className="font-medium truncate max-w-[120px]">
                {f.value}
              </span>
              <button
                onClick={() => handleRemoveFilter(i)}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                setActiveFilters([]);
                setFilters({});
              }}
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-4">No tasks found</p>
            <Button
              size="sm"
              onClick={() => setNewTaskOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create a task
            </Button>
          </div>
        ) : viewMode === "table" ? (
          <TaskTableView
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onDelete={handleDelete}
            statusOptions={statusOptions}
            priorityOptions={priorityOptions}
            teammateOptions={teammateOptions}
          />
        ) : (
          <TaskBoardView
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onDelete={handleDelete}
            onCreateInStatus={handleCreateInStatus}
            statusOptions={statusOptions}
          />
        )}

        {/* Load more */}
        {tasksData?.has_more && (
          <div className="flex justify-center py-4">
            <Button variant="outline" size="sm" className="text-xs">
              Load more tasks
            </Button>
          </div>
        )}
      </div>

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        teammateOptions={teammateOptions}
      />

      {/* New task dialog */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Task name
              </label>
              <Input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Client
                </label>
                <Input
                  value={newTaskClient}
                  onChange={(e) => setNewTaskClient(e.target.value)}
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Status
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between text-xs h-9"
                    >
                      {newTaskStatus || "Select status"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-[250px] overflow-y-auto">
                    {statusOptions.map((opt: { name: string; color: string }) => (
                      <DropdownMenuItem
                        key={opt.name}
                        onClick={() => setNewTaskStatus(opt.name)}
                      >
                        <span className="text-xs truncate">{opt.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Priority
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between text-xs h-9"
                    >
                      {newTaskPriority || "Select priority"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {priorityOptions.map((opt: { name: string; color: string }) => (
                      <DropdownMenuItem
                        key={opt.name}
                        onClick={() => setNewTaskPriority(opt.name)}
                      >
                        <span className="text-xs">{opt.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Teammate
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between text-xs h-9"
                    >
                      {newTaskTeammate || "Select teammate"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {teammateOptions.map((opt: { name: string; color: string }) => (
                      <DropdownMenuItem
                        key={opt.name}
                        onClick={() => setNewTaskTeammate(opt.name)}
                      >
                        <span className="text-xs">{opt.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Add a description..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTaskOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || createTask.isPending}
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

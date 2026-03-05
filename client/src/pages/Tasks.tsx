import { useState, useMemo, useCallback } from "react";
import AdminHeader from "@/components/AdminHeader";
import TaskTableView from "@/components/tasks/TaskTableView";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import {
  useTasks,
  useDatabase,
  useCreateTask,
  useDeleteTask,
  NotionTask,
  TaskFilters,
  notionTagStyle,
} from "@/hooks/useNotionTasks";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  X,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";

const ALL_COLUMNS = [
  "Task name",
  "STATUS",
  "CLIENTS",
  "Priority",
  "Teammate",
  "Managers",
  "Due",
  "Done ?",
  "Secondary Status",
  "Description",
];

const DEFAULT_COLUMNS = [
  "Task name",
  "STATUS",
  "CLIENTS",
  "Priority",
  "Teammate",
  "Managers",
  "Due",
];

export default function Tasks() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<NotionTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskClient, setNewTaskClient] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("");
  const [newTaskTeammate, setNewTaskTeammate] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{ property: string; value: string }[]>([]);

  const { data: tasksData, isLoading, refetch, isFetching, isError, error } = useTasks(filters);
  const { data: dbSchema } = useDatabase();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const statusOptions = useMemo(() => {
    if (!dbSchema?.properties?.STATUS?.status?.options) return [];
    return dbSchema.properties.STATUS.status.options.map((o: any) => ({ name: o.name, color: o.color }));
  }, [dbSchema]);

  const priorityOptions = useMemo(() => {
    if (!dbSchema?.properties?.Priority?.select?.options) return [];
    return dbSchema.properties.Priority.select.options.map((o: any) => ({ name: o.name, color: o.color }));
  }, [dbSchema]);

  const teammateOptions = useMemo(() => {
    if (!dbSchema?.properties?.Teammate?.select?.options) return [];
    return dbSchema.properties.Teammate.select.options.map((o: any) => ({ name: o.name, color: o.color }));
  }, [dbSchema]);

  const tasks = tasksData?.results || [];

  const handleSearch = useCallback(() => {
    setFilters((f) => ({ ...f, search: searchInput || undefined }));
  }, [searchInput]);

  const handleAddFilter = useCallback((property: string, value: string) => {
    setActiveFilters((prev) => [...prev, { property, value }]);
    setFilters((prev) => ({ ...prev, [property]: value }));
  }, []);

  const handleRemoveFilter = useCallback((index: number) => {
    setActiveFilters((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      setFilters((f) => { const u = { ...f }; delete (u as any)[removed.property]; return u; });
      return next;
    });
  }, []);

  const handleTaskClick = useCallback((task: NotionTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteTask.mutate(id, { onSuccess: () => toast.success("Task archived") });
  }, [deleteTask]);

  const handleCreateTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    const properties: Record<string, any> = {
      "Task name": { title: [{ text: { content: newTaskTitle.trim() } }] },
    };
    if (newTaskClient) properties.CLIENTS = { rich_text: [{ text: { content: newTaskClient } }] };
    if (newTaskDescription) properties.Description = { rich_text: [{ text: { content: newTaskDescription } }] };
    if (newTaskStatus) properties.STATUS = { status: { name: newTaskStatus } };
    if (newTaskPriority) properties.Priority = { select: { name: newTaskPriority } };
    if (newTaskTeammate) properties.Teammate = { select: { name: newTaskTeammate } };
    createTask.mutate(properties, {
      onSuccess: () => {
        toast.success("Task created");
        setNewTaskOpen(false);
        setNewTaskTitle(""); setNewTaskClient(""); setNewTaskDescription("");
        setNewTaskStatus(""); setNewTaskPriority(""); setNewTaskTeammate("");
      },
    });
  }, [createTask, newTaskTitle, newTaskClient, newTaskDescription, newTaskStatus, newTaskPriority, newTaskTeammate]);

  const handleSort = useCallback((sortBy: string, sortDir: "ascending" | "descending") => {
    setFilters((f) => ({ ...f, sortBy, sortDir }));
  }, []);

  const toggleColumn = useCallback((col: string) => {
    setVisibleColumns((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div style={{ maxWidth: 1800, margin: "0 auto", padding: "12px 48px" }}>
        {/* Database title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, marginTop: 8 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "rgba(255,255,255,0.91)", lineHeight: 1.2 }}>
            IN HOUSE TO-DO
          </h1>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "rgba(255,255,255,0.28)" }} />}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-[2px] h-[34px] mb-[1px]">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-[4px] h-[28px] px-[7px] text-[14px] text-[rgba(255,255,255,0.443)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px] transition-colors">
                <Filter className="h-[14px] w-[14px]" />
                <span>Filter</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px] max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel className="text-[11px] text-[rgba(255,255,255,0.38)] uppercase tracking-wider">Status</DropdownMenuLabel>
              {statusOptions.map((o: any) => (
                <DropdownMenuItem key={o.name} onClick={() => handleAddFilter("status", o.name)} className="text-[13px] py-[5px]">
                  <span className="inline-flex items-center h-[20px] rounded-[3px] px-[6px] text-[12px]" style={notionTagStyle(o.color)}>{o.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-[rgba(255,255,255,0.38)] uppercase tracking-wider">Priority</DropdownMenuLabel>
              {priorityOptions.map((o: any) => (
                <DropdownMenuItem key={o.name} onClick={() => handleAddFilter("priority", o.name)} className="text-[13px] py-[5px]">
                  <span className="inline-flex items-center h-[20px] rounded-[3px] px-[6px] text-[12px]" style={notionTagStyle(o.color)}>{o.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-[rgba(255,255,255,0.38)] uppercase tracking-wider">Teammate</DropdownMenuLabel>
              {teammateOptions.map((o: any) => (
                <DropdownMenuItem key={o.name} onClick={() => handleAddFilter("teammate", o.name)} className="text-[13px] py-[5px]">
                  <span className="inline-flex items-center h-[20px] rounded-[3px] px-[6px] text-[12px]" style={notionTagStyle(o.color)}>{o.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-[4px] h-[28px] px-[7px] text-[14px] text-[rgba(255,255,255,0.443)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px] transition-colors">
                <ArrowUpDown className="h-[14px] w-[14px]" />
                <span>Sort</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleSort("last_edited_time", "descending")} className="text-[13px]">Last edited (newest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("last_edited_time", "ascending")} className="text-[13px]">Last edited (oldest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("created_time", "descending")} className="text-[13px]">Created (newest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("created_time", "ascending")} className="text-[13px]">Created (oldest)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-[4px] h-[28px] px-[7px] text-[14px] text-[rgba(255,255,255,0.443)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px] transition-colors">
                <ListFilter className="h-[14px] w-[14px]" />
                <span>{groupBy ? `Group: ${groupBy}` : "Group"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setGroupBy(null)} className="text-[13px]">None</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setGroupBy("STATUS")} className="text-[13px]">Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("Priority")} className="text-[13px]">Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("Teammate")} className="text-[13px]">Teammate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Properties (column visibility) */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-[4px] h-[28px] px-[7px] text-[14px] text-[rgba(255,255,255,0.443)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px] transition-colors">
                <SlidersHorizontal className="h-[14px] w-[14px]" />
                <span>Properties</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[240px] p-[4px]">
              <div className="px-[8px] py-[6px] text-[11px] text-[rgba(255,255,255,0.38)] uppercase tracking-wider">Visible columns</div>
              {ALL_COLUMNS.map((col) => (
                <label key={col} className="flex items-center gap-[8px] px-[8px] py-[6px] text-[14px] cursor-pointer hover:bg-[rgba(255,255,255,0.024)] rounded-[3px] text-[rgba(255,255,255,0.81)]">
                  <Checkbox
                    checked={visibleColumns.includes(col)}
                    onCheckedChange={() => toggleColumn(col)}
                    className="h-[16px] w-[16px]"
                  />
                  {col === "Done ?" ? "Done" : col}
                </label>
              ))}
            </PopoverContent>
          </Popover>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          {searchOpen ? (
            <div className="flex items-center gap-[4px]">
              <div className="relative">
                <Search className="absolute left-[8px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[rgba(255,255,255,0.282)]" />
                <Input
                  autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Type to search..."
                  className="h-[28px] pl-[28px] w-[200px] text-[13px] bg-transparent border-[rgba(255,255,255,0.094)] rounded-[3px]"
                />
              </div>
              <button
                onClick={() => { setSearchOpen(false); setSearchInput(""); setFilters((f) => ({ ...f, search: undefined })); }}
                className="p-[4px] text-[rgba(255,255,255,0.282)] hover:text-[rgba(255,255,255,0.5)]"
              >
                <X className="h-[14px] w-[14px]" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-[4px] h-[28px] px-[7px] text-[14px] text-[rgba(255,255,255,0.443)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px] transition-colors"
            >
              <Search className="h-[14px] w-[14px]" />
            </button>
          )}

          {/* New button */}
          <button
            onClick={() => setNewTaskOpen(true)}
            className="flex items-center gap-[4px] h-[28px] px-[8px] text-[14px] text-[#2383e2] hover:bg-[rgba(35,131,226,0.08)] rounded-[3px] transition-colors font-medium"
          >
            <Plus className="h-[14px] w-[14px]" />
            New
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center h-[28px] px-[6px] text-[rgba(255,255,255,0.38)] hover:bg-[rgba(255,255,255,0.055)] rounded-[3px] transition-colors"
          >
            <RefreshCw className={`h-[14px] w-[14px] ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-[6px] h-[32px] flex-wrap mb-[1px]">
            {activeFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-[4px] bg-[rgba(255,255,255,0.055)] rounded-[3px] px-[8px] h-[24px] text-[12px] text-[rgba(255,255,255,0.65)]">
                <span className="text-[rgba(255,255,255,0.38)]">{f.property}:</span>
                {f.value}
                <button onClick={() => handleRemoveFilter(i)} className="ml-[2px] hover:text-white">
                  <X className="h-[10px] w-[10px]" />
                </button>
              </span>
            ))}
            <button
              onClick={() => { setActiveFilters([]); setFilters({}); }}
              className="text-[12px] text-[rgba(255,255,255,0.282)] hover:text-[rgba(255,255,255,0.5)] px-[4px]"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Count */}
        <div className="text-[12px] text-[rgba(255,255,255,0.282)] mb-[4px]">
          {tasks.length}{tasksData?.has_more ? "+" : ""} tasks
        </div>

        {/* Table content */}
        {isError ? (
          <div className="flex flex-col items-center justify-center py-[80px] text-center">
            <p className="text-red-400 mb-[8px] text-[14px]">Failed to load tasks</p>
            <p className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[16px] max-w-[400px]">
              {(error as Error)?.message || "Could not connect to the server."}
            </p>
            <button onClick={() => refetch()} className="flex items-center gap-[6px] h-[32px] px-[12px] text-[13px] rounded-[3px] bg-[rgba(255,255,255,0.055)] text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.094)] transition-colors">
              <RefreshCw className="h-[14px] w-[14px]" /> Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-[80px]">
            <Loader2 className="h-[24px] w-[24px] animate-spin text-[rgba(255,255,255,0.282)]" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[80px] text-center">
            <p className="text-[rgba(255,255,255,0.443)] mb-[16px] text-[14px]">No tasks found</p>
            <button onClick={() => setNewTaskOpen(true)} className="flex items-center gap-[6px] h-[32px] px-[12px] text-[13px] rounded-[3px] bg-[#2383e2] text-white hover:bg-[#1b6ec2] transition-colors">
              <Plus className="h-[14px] w-[14px]" /> New task
            </button>
          </div>
        ) : (
          <TaskTableView
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onDelete={handleDelete}
            onNewTask={() => setNewTaskOpen(true)}
            statusOptions={statusOptions}
            priorityOptions={priorityOptions}
            teammateOptions={teammateOptions}
            visibleColumns={visibleColumns}
            groupBy={groupBy}
          />
        )}
      </div>

      {/* Detail sheet */}
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
        <DialogContent className="sm:max-w-[520px] bg-[#252525] border-[rgba(255,255,255,0.094)]">
          <DialogHeader>
            <DialogTitle className="text-[16px] text-[rgba(255,255,255,0.91)]">New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-[12px] py-[8px]">
            <div>
              <label className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[4px] block">Task name</label>
              <Input autoFocus value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                className="text-[14px] bg-[rgba(255,255,255,0.055)] border-[rgba(255,255,255,0.094)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-[12px]">
              <div>
                <label className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[4px] block">Client</label>
                <Input value={newTaskClient} onChange={(e) => setNewTaskClient(e.target.value)} placeholder="Client name"
                  className="text-[14px] bg-[rgba(255,255,255,0.055)] border-[rgba(255,255,255,0.094)]" />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[4px] block">Status</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-[13px] h-[36px] bg-[rgba(255,255,255,0.055)] border-[rgba(255,255,255,0.094)]">
                      {newTaskStatus || "Select..."} <ChevronDown className="h-[14px] w-[14px]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-[250px] overflow-y-auto">
                    {statusOptions.map((o: any) => (
                      <DropdownMenuItem key={o.name} onClick={() => setNewTaskStatus(o.name)} className="text-[13px]">{o.name}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[4px] block">Priority</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-[13px] h-[36px] bg-[rgba(255,255,255,0.055)] border-[rgba(255,255,255,0.094)]">
                      {newTaskPriority || "Select..."} <ChevronDown className="h-[14px] w-[14px]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {priorityOptions.map((o: any) => (
                      <DropdownMenuItem key={o.name} onClick={() => setNewTaskPriority(o.name)} className="text-[13px]">{o.name}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[4px] block">Teammate</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-[13px] h-[36px] bg-[rgba(255,255,255,0.055)] border-[rgba(255,255,255,0.094)]">
                      {newTaskTeammate || "Select..."} <ChevronDown className="h-[14px] w-[14px]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {teammateOptions.map((o: any) => (
                      <DropdownMenuItem key={o.name} onClick={() => setNewTaskTeammate(o.name)} className="text-[13px]">{o.name}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-[rgba(255,255,255,0.443)] mb-[4px] block">Description</label>
              <Textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Add a description..."
                className="min-h-[80px] text-[14px] bg-[rgba(255,255,255,0.055)] border-[rgba(255,255,255,0.094)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTaskOpen(false)} className="text-[13px] text-[rgba(255,255,255,0.55)]">Cancel</Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || createTask.isPending}
              className="text-[13px] bg-[#2383e2] hover:bg-[#1b6ec2] text-white">
              {createTask.isPending && <Loader2 className="h-[14px] w-[14px] animate-spin mr-[4px]" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

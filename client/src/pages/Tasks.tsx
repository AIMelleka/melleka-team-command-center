import { useState, useMemo, useCallback } from "react";
import AdminHeader from "@/components/AdminHeader";
import TaskTableView from "@/components/tasks/TaskTableView";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import {
  useTasks, useDatabase, useCreateTask, useDeleteTask,
  NotionTask, TaskFilters, notionTagStyle,
} from "@/hooks/useNotionTasks";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Loader2, Plus, Search, Filter, ArrowUpDown, X, RefreshCw,
  ChevronDown, SlidersHorizontal, ListFilter,
} from "lucide-react";
import { toast } from "sonner";

const ALL_COLUMNS = [
  "Task name", "STATUS", "CLIENTS", "Priority", "Teammate",
  "Managers", "Due", "Done ?", "Secondary Status", "Description",
];
const DEFAULT_COLUMNS = [
  "Task name", "STATUS", "CLIENTS", "Priority", "Teammate", "Managers", "Due",
];

export default function Tasks() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<NotionTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [nTitle, setNTitle] = useState("");
  const [nClient, setNClient] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nStatus, setNStatus] = useState("");
  const [nPriority, setNPriority] = useState("");
  const [nTeammate, setNTeammate] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{ property: string; value: string }[]>([]);

  const { data: tasksData, isLoading, refetch, isFetching, isError, error } = useTasks(filters);
  const { data: dbSchema } = useDatabase();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const statusOptions = useMemo(() =>
    dbSchema?.properties?.STATUS?.status?.options?.map((o: any) => ({ name: o.name, color: o.color })) || [], [dbSchema]);
  const priorityOptions = useMemo(() =>
    dbSchema?.properties?.Priority?.select?.options?.map((o: any) => ({ name: o.name, color: o.color })) || [], [dbSchema]);
  const teammateOptions = useMemo(() =>
    dbSchema?.properties?.Teammate?.select?.options?.map((o: any) => ({ name: o.name, color: o.color })) || [], [dbSchema]);

  const tasks = tasksData?.results || [];

  const handleSearch = useCallback(() => setFilters(f => ({ ...f, search: searchInput || undefined })), [searchInput]);
  const addFilter = useCallback((property: string, value: string) => {
    setActiveFilters(p => [...p, { property, value }]);
    setFilters(p => ({ ...p, [property]: value }));
  }, []);
  const removeFilter = useCallback((i: number) => {
    setActiveFilters(prev => {
      const next = [...prev]; const r = next.splice(i, 1)[0];
      setFilters(f => { const u = { ...f }; delete (u as any)[r.property]; return u; });
      return next;
    });
  }, []);
  const handleCreate = useCallback(() => {
    if (!nTitle.trim()) return;
    const props: Record<string, any> = { "Task name": { title: [{ text: { content: nTitle.trim() } }] } };
    if (nClient) props.CLIENTS = { rich_text: [{ text: { content: nClient } }] };
    if (nDesc) props.Description = { rich_text: [{ text: { content: nDesc } }] };
    if (nStatus) props.STATUS = { status: { name: nStatus } };
    if (nPriority) props.Priority = { select: { name: nPriority } };
    if (nTeammate) props.Teammate = { select: { name: nTeammate } };
    createTask.mutate(props, {
      onSuccess: () => { toast.success("Task created"); setNewOpen(false); setNTitle(""); setNClient(""); setNDesc(""); setNStatus(""); setNPriority(""); setNTeammate(""); },
    });
  }, [createTask, nTitle, nClient, nDesc, nStatus, nPriority, nTeammate]);

  const toolbarBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4, height: 28, padding: "0 7px",
    fontSize: 14, color: "rgba(255,255,255,0.44)", background: "none", border: "none",
    borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div style={{ maxWidth: 1800, margin: "0 auto", padding: "12px 48px" }}>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.91)" }}>IN HOUSE TO-DO</h1>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, height: 34, marginBottom: 2 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button style={toolbarBtn}><Filter style={{ width: 14, height: 14 }} /> Filter</button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Status</DropdownMenuLabel>
              {statusOptions.map((o: any) => (
                <DropdownMenuItem key={o.name} onClick={() => addFilter("status", o.name)} className="py-1">
                  <span style={{ ...notionTagStyle(o.color), display: "inline-flex", alignItems: "center", height: 20, borderRadius: 3, padding: "0 6px", fontSize: 12 }}>{o.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Priority</DropdownMenuLabel>
              {priorityOptions.map((o: any) => (
                <DropdownMenuItem key={o.name} onClick={() => addFilter("priority", o.name)} className="py-1">
                  <span style={{ ...notionTagStyle(o.color), display: "inline-flex", alignItems: "center", height: 20, borderRadius: 3, padding: "0 6px", fontSize: 12 }}>{o.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Teammate</DropdownMenuLabel>
              {teammateOptions.map((o: any) => (
                <DropdownMenuItem key={o.name} onClick={() => addFilter("teammate", o.name)} className="py-1">
                  <span style={{ ...notionTagStyle(o.color), display: "inline-flex", alignItems: "center", height: 20, borderRadius: 3, padding: "0 6px", fontSize: 12 }}>{o.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><button style={toolbarBtn}><ArrowUpDown style={{ width: 14, height: 14 }} /> Sort</button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: "last_edited_time", sortDir: "descending" }))}>Last edited (newest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: "last_edited_time", sortDir: "ascending" }))}>Last edited (oldest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: "created_time", sortDir: "descending" }))}>Created (newest)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: "created_time", sortDir: "ascending" }))}>Created (oldest)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><button style={toolbarBtn}><ListFilter style={{ width: 14, height: 14 }} /> {groupBy ? `Group: ${groupBy}` : "Group"}</button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setGroupBy(null)}>None</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setGroupBy("STATUS")}>Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("Priority")}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("Teammate")}>Teammate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild><button style={toolbarBtn}><SlidersHorizontal style={{ width: 14, height: 14 }} /> Properties</button></PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Visible columns</div>
              {ALL_COLUMNS.map(col => (
                <label key={col} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded">
                  <Checkbox checked={visibleColumns.includes(col)} onCheckedChange={() => setVisibleColumns(p => p.includes(col) ? p.filter(c => c !== col) : [...p, col])} className="h-4 w-4" />
                  {col === "Done ?" ? "Done" : col}
                </label>
              ))}
            </PopoverContent>
          </Popover>

          <div style={{ flex: 1 }} />

          {searchOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input autoFocus value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Search..." className="h-7 pl-7 w-48 text-sm" />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearchInput(""); setFilters(f => ({ ...f, search: undefined })); }}
                style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.28)" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} style={toolbarBtn}><Search style={{ width: 14, height: 14 }} /></button>
          )}

          <button onClick={() => setNewOpen(true)}
            style={{ ...toolbarBtn, color: "#2383e2", fontWeight: 500 }}>
            <Plus style={{ width: 14, height: 14 }} /> New
          </button>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ ...toolbarBtn, color: "rgba(255,255,255,0.38)" }}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, flexWrap: "wrap", marginBottom: 2 }}>
            {activeFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs text-muted-foreground">
                {f.property}: <span className="text-foreground">{f.value}</span>
                <button onClick={() => removeFilter(i)} className="ml-0.5 hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
            <button onClick={() => { setActiveFilters([]); setFilters({}); }} className="text-xs text-muted-foreground hover:text-foreground px-1">Clear all</button>
          </div>
        )}

        {/* Task count */}
        <div className="text-xs text-muted-foreground mb-1">
          {tasks.length}{tasksData?.has_more ? "+" : ""} tasks
        </div>

        {/* Content */}
        {isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-red-400 mb-2 text-sm">Failed to load tasks</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-md">{(error as Error)?.message || "Could not connect."}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-4 text-sm">No tasks found</p>
            <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> New task</Button>
          </div>
        ) : (
          <TaskTableView
            tasks={tasks} onTaskClick={t => { setSelectedTask(t); setDetailOpen(true); }}
            onDelete={id => deleteTask.mutate(id, { onSuccess: () => toast.success("Task archived") })}
            onNewTask={() => setNewOpen(true)}
            statusOptions={statusOptions} priorityOptions={priorityOptions} teammateOptions={teammateOptions}
            visibleColumns={visibleColumns} groupBy={groupBy}
          />
        )}
      </div>

      <TaskDetailSheet task={selectedTask} open={detailOpen} onOpenChange={setDetailOpen}
        statusOptions={statusOptions} priorityOptions={priorityOptions} teammateOptions={teammateOptions} />

      {/* New task dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Task name</label>
              <Input autoFocus value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="What needs to be done?" onKeyDown={e => e.key === "Enter" && handleCreate()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Client</label>
                <Input value={nClient} onChange={e => setNClient(e.target.value)} placeholder="Client name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between text-sm h-9">{nStatus || "Select..."} <ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-60 overflow-y-auto">{statusOptions.map((o: any) => <DropdownMenuItem key={o.name} onClick={() => setNStatus(o.name)}>{o.name}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between text-sm h-9">{nPriority || "Select..."} <ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>{priorityOptions.map((o: any) => <DropdownMenuItem key={o.name} onClick={() => setNPriority(o.name)}>{o.name}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Teammate</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between text-sm h-9">{nTeammate || "Select..."} <ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>{teammateOptions.map((o: any) => <DropdownMenuItem key={o.name} onClick={() => setNTeammate(o.name)}>{o.name}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Textarea value={nDesc} onChange={e => setNDesc(e.target.value)} placeholder="Add a description..." className="min-h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createTask.isPending}>
              {createTask.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Search,
  Bot,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Activity,
  XCircle,
  ArrowUpRight,
  ListTodo,
  Eye,
  Ban,
  CircleDot,
  Timer,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { fetchCronJobs, deleteCronJob, type CronJob } from "@/lib/chatApi";
import { useToast } from "@/hooks/use-toast";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSuperAgentTasks,
  useSuperAgentStats,
  type SuperAgentTask,
  type TaskFilters,
} from "@/hooks/useSuperAgentTasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  not_started: {
    label: "Not Started",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: CircleDot,
  },
  working_on_it: {
    label: "Working On It",
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    icon: Loader2,
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  in_review: {
    label: "In Review",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: Eye,
  },
  error: {
    label: "Error",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  blocked: {
    label: "Blocked",
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    icon: Ban,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20",
    icon: XCircle,
  },
};

const PRIORITY_CONFIG: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  low: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20",
};

const CATEGORIES = [
  "Ad Campaign",
  "SEO",
  "Content",
  "Client Work",
  "Analytics",
  "Website",
  "Email",
  "Report",
  "PPC",
  "Social Media",
  "Development",
  "Other",
];

/** Convert a cron expression like "0 9 * * 1-5" to plain English */
function cronToEnglish(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, _mon, dow] = parts;

  // Build time string
  let timeStr = "";
  if (hour !== "*" && min !== "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    timeStr = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  // Build day string
  const dowNames: Record<string, string> = {
    "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
    "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
  };

  if (dow === "*" && dom === "*") {
    return timeStr ? `Every day at ${timeStr}` : "Every minute";
  }
  if (dow === "1-5") return timeStr ? `Weekdays at ${timeStr}` : "Every weekday";
  if (dow === "0,6") return timeStr ? `Weekends at ${timeStr}` : "Every weekend";
  if (dow !== "*") {
    const days = dow.split(",").map(d => dowNames[d] || d).join(", ");
    return timeStr ? `Every ${days} at ${timeStr}` : `Every ${days}`;
  }
  if (dom !== "*") {
    const suffix = dom === "1" ? "st" : dom === "2" ? "nd" : dom === "3" ? "rd" : "th";
    return timeStr ? `${dom}${suffix} of every month at ${timeStr}` : `${dom}${suffix} of every month`;
  }
  return expr;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === "working_on_it" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const className = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <Badge variant="outline" className={className}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskDetailDialog({
  task,
  open,
  onClose,
}: {
  task: SuperAgentTask | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  if (!task) return null;

  const sortedNotes = [...(task.notes || [])].reverse();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-3 pr-6">
            <Bot className="h-5 w-5 text-primary shrink-0" />
            <span className="break-words">{task.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2 overflow-y-auto min-h-0 flex-1 pr-1">
          {/* Status & Priority */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.category && (
              <Badge variant="outline">{task.category}</Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Description
              </p>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Error Details */}
          {task.error_details && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Error Details
              </p>
              <p className="text-sm whitespace-pre-wrap">{task.error_details}</p>
            </div>
          )}

          {/* Links */}
          {task.links && task.links.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Links
              </p>
              <div className="flex flex-wrap gap-2">
                {task.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline bg-primary/5 rounded-md px-2 py-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notes Timeline */}
          {sortedNotes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Activity Log ({sortedNotes.length} notes)
              </p>
              <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border/50 p-3">
                <div className="space-y-3">
                  {sortedNotes.map((note, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-primary/30 pl-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(note.timestamp), "MMM d, yyyy h:mm a")}
                      </p>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm border-t pt-4">
            {task.requested_by && (
              <div>
                <span className="text-muted-foreground">Requested by: </span>
                <span className="font-medium">{task.requested_by}</span>
              </div>
            )}
            {task.client_name && (
              <div>
                <span className="text-muted-foreground">Client: </span>
                <span className="font-medium">{task.client_name}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span>
                {format(new Date(task.created_at), "MMM d, yyyy h:mm a")}
              </span>
            </div>
            {task.started_at && (
              <div>
                <span className="text-muted-foreground">Started: </span>
                <span>
                  {format(new Date(task.started_at), "MMM d, yyyy h:mm a")}
                </span>
              </div>
            )}
            {task.completed_at && (
              <div>
                <span className="text-muted-foreground">Completed: </span>
                <span>
                  {format(new Date(task.completed_at), "MMM d, yyyy h:mm a")}
                </span>
              </div>
            )}
          </div>

          {/* Conversation link */}
          {task.conversation_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/?conversation=${task.conversation_id}`);
              }}
              className="gap-1"
            >
              <ArrowUpRight className="h-4 w-4" />
              View Conversation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAgentDashboard() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [statusTab, setStatusTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [selectedTask, setSelectedTask] = useState<SuperAgentTask | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeFilters = useMemo(
    () => ({
      ...filters,
      status: statusTab !== "all" && statusTab !== "scheduled" ? statusTab : undefined,
      search: searchInput || undefined,
    }),
    [filters, statusTab, searchInput]
  );

  const { data: tasks, isLoading } = useSuperAgentTasks(activeFilters);
  const { data: stats } = useSuperAgentStats();
  const { data: cronJobs } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: fetchCronJobs,
    refetchInterval: 60_000,
  });

  const handleDeleteCron = async (job: CronJob) => {
    if (!confirm(`Delete cron job "${job.name}"? This will stop it from running.`)) return;
    try {
      await deleteCronJob(job.id);
      queryClient.setQueryData<CronJob[]>(["cron-jobs"], (old) => old?.filter((j) => j.id !== job.id) ?? []);
      toast({ title: `Deleted "${job.name}"` });
    } catch (err: any) {
      toast({ title: "Failed to delete cron job", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="container mx-auto px-4 py-6 pb-20 sm:pb-6 max-w-7xl">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Super Agent Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Track all tasks the Super Agent is working on across the team
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Tasks"
            value={stats?.total ?? 0}
            icon={ListTodo}
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="In Progress"
            value={stats?.inProgress ?? 0}
            icon={Activity}
            color="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          />
          <StatCard
            title="Completed Today"
            value={stats?.completedToday ?? 0}
            icon={CheckCircle}
            color="bg-green-500/10 text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Errors"
            value={stats?.errors ?? 0}
            icon={AlertTriangle}
            color="bg-red-500/10 text-red-600 dark:text-red-400"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.category || "all_categories"}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                category: v === "all_categories" ? undefined : v,
              }))
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_categories">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusTab} onValueChange={setStatusTab} className="mb-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="not_started">Not Started</TabsTrigger>
            <TabsTrigger value="working_on_it">Working On It</TabsTrigger>
            <TabsTrigger value="in_review">In Review</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-1">
              <Timer className="h-3.5 w-3.5" />
              Scheduled{cronJobs && cronJobs.length > 0 ? ` (${cronJobs.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content: Tasks or Cron Jobs depending on active tab */}
        {statusTab === "scheduled" ? (
          /* Cron Jobs Table */
          !cronJobs || cronJobs.length === 0 ? (
            <div className="text-center py-20">
              <Timer className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No scheduled jobs yet. The Super Agent can create cron jobs from chat.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Job Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[250px]">Task</TableHead>
                    <TableHead className="hidden lg:table-cell">Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronJobs.map((job) => (
                    <TableRow key={job.id} className={job.enabled ? "" : "opacity-60"}>
                      <TableCell>
                        <p className="font-medium text-sm">{job.name}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-primary font-medium">
                          {cronToEnglish(job.cron_expr)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {job.task}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{job.member_name}</span>
                      </TableCell>
                      <TableCell>
                        {job.enabled ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1">
                            <Play className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 gap-1">
                            <Pause className="h-3 w-3" />
                            Paused
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {job.last_run
                            ? formatDistanceToNow(new Date(job.last_run), { addSuffix: true })
                            : "Never"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-500" title="Delete cron job" onClick={() => handleDeleteCron(job)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          /* Task List */
          isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center py-20">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No tasks found. The Super Agent will create tasks here as it works.
              </p>
            </div>
          ) : isMobile ? (
            /* Mobile Card View */
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer active:bg-muted/50"
                  onClick={() => setSelectedTask(task)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm line-clamp-2 flex-1">{task.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      {task.category && (
                        <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
                      )}
                    </div>
                    {(task.client_name || task.requested_by) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {task.client_name && <span>Client: {task.client_name}</span>}
                        {task.requested_by && <span>By: {task.requested_by}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop Table View */
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Priority
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Client</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Requested By
                    </TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTask(task)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[300px]">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {task.category && (
                          <span className="text-sm">{task.category}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {task.client_name && (
                          <span className="text-sm">{task.client_name}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{task.requested_by}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(task.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </main>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeFormatDistance } from "@/lib/dateUtils";
import {
  Timer, Trash2, Clock, Play, Pause, Loader2, Zap, Plus, Pencil, X, Save,
} from "lucide-react";
import {
  fetchCronJobs, deleteCronJob, createCronJob, updateCronJob,
  type CronJob,
} from "@/lib/chatApi";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface FleetCronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  lastRun: string | null;
  lastStatus: string | null;
}

const FLEET_JOB_LABELS: Record<string, { label: string; description: string }> = {
  'fleet-auto-optimize': { label: 'Auto-Optimize', description: 'AI proposes and executes ad changes (with QA validation)' },
  'fleet-daily-reports': { label: 'Morning Reports', description: 'Generate daily ad review reports for all clients' },
  'fleet-auto-assess': { label: 'Auto-Assessment', description: 'Evaluate yesterday\'s changes and save learnings to memory' },
  'fleet-evening-run': { label: 'Evening Reports', description: 'End-of-day ad review reports (no changes)' },
};

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Custom", value: "" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Daily at 6 PM", value: "0 18 * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekly Monday 9 AM", value: "0 9 * * 1" },
  { label: "Monthly 1st at 9 AM", value: "0 9 1 * *" },
];

function cronToEnglish(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, _mon, dow] = parts;
  let timeStr = "";
  if (hour !== "*" && min !== "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    const pstH = (h - 8 + 24) % 24;
    const ampm = pstH >= 12 ? "PM" : "AM";
    const h12 = pstH === 0 ? 12 : pstH > 12 ? pstH - 12 : pstH;
    timeStr = `${h12}:${m.toString().padStart(2, "0")} ${ampm} PST`;
  }
  const dowNames: Record<string, string> = {
    "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
    "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
  };
  if (dow === "*" && dom === "*") return timeStr ? `Every day at ${timeStr}` : "Every minute";
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

function agentCronToEnglish(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, _mon, dow] = parts;
  let timeStr = "";
  if (hour !== "*" && min !== "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    timeStr = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }
  const dowNames: Record<string, string> = {
    "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
    "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
  };
  if (dow === "*" && dom === "*") return timeStr ? `Every day at ${timeStr}` : "Every minute";
  if (dow === "1-5") return timeStr ? `Weekdays at ${timeStr}` : "Every weekday";
  if (dow === "0,6") return timeStr ? `Weekends at ${timeStr}` : "Every weekend";
  if (dow !== "*") {
    const days = dow.split(",").map(d => dowNames[d] || d).join(", ");
    return timeStr ? `Every ${days} at ${timeStr}` : `Every ${days}`;
  }
  return expr;
}

interface FormState {
  name: string;
  cron_expr: string;
  task: string;
}

const EMPTY_FORM: FormState = { name: "", cron_expr: "", task: "" };

export default function CronJobs() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Agent cron jobs
  const { data: cronJobs, isLoading } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: fetchCronJobs,
    refetchInterval: 60_000,
  });

  // Fleet automation cron jobs (pg_cron)
  const { data: fleetJobs, isLoading: fleetLoading } = useQuery({
    queryKey: ["fleet-cron-jobs"],
    queryFn: async (): Promise<FleetCronJob[]> => {
      const [jobsRes, historyRes] = await Promise.all([
        supabase.rpc('get_fleet_cron_jobs'),
        supabase.rpc('get_fleet_cron_history'),
      ]);
      const jobs = (jobsRes.data || []) as any[];
      const history = (historyRes.data || []) as any[];
      const historyMap = new Map(history.map((h: any) => [h.jobname, h]));
      return jobs.map((j: any) => {
        const h = historyMap.get(j.jobname);
        return {
          jobid: j.jobid,
          jobname: j.jobname,
          schedule: j.schedule,
          command: j.command,
          active: j.active,
          lastRun: h?.start_time || null,
          lastStatus: h?.status || null,
        };
      });
    },
    refetchInterval: 60_000,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (job: CronJob) => {
    setEditingId(job.id);
    setForm({ name: job.name, cron_expr: job.cron_expr, task: job.task });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.cron_expr.trim() || !form.task.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCronJob(editingId, {
          name: form.name.trim(),
          cron_expr: form.cron_expr.trim(),
          task: form.task.trim(),
        });
        toast({ title: `Updated "${form.name}"` });
      } else {
        await createCronJob({
          name: form.name.trim(),
          cron_expr: form.cron_expr.trim(),
          task: form.task.trim(),
        });
        toast({ title: `Created "${form.name}"` });
      }
      queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
      cancelForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleToggle = async (job: CronJob) => {
    setToggling(job.id);
    try {
      const newEnabled = !job.enabled;
      await updateCronJob(job.id, { enabled: newEnabled });
      queryClient.setQueryData<CronJob[]>(["cron-jobs"], (old) =>
        old?.map((j) => j.id === job.id ? { ...j, enabled: newEnabled } : j) ?? []
      );
      toast({ title: `${newEnabled ? "Enabled" : "Paused"} "${job.name}"` });
    } catch (err: any) {
      toast({ title: "Failed to toggle", description: err.message, variant: "destructive" });
    }
    setToggling(null);
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`Delete cron job "${job.name}"? This will stop it from running.`)) return;
    setDeleting(job.id);
    try {
      await deleteCronJob(job.id);
      queryClient.setQueryData<CronJob[]>(["cron-jobs"], (old) => old?.filter((j) => j.id !== job.id) ?? []);
      toast({ title: `Deleted "${job.name}"` });
    } catch (err: any) {
      toast({ title: "Failed to delete cron job", description: err.message, variant: "destructive" });
    }
    setDeleting(null);
  };

  const handlePresetChange = (value: string) => {
    if (value) setForm((f) => ({ ...f, cron_expr: value }));
  };

  const jobs = cronJobs ?? [];
  const fleet = fleetJobs ?? [];
  const totalJobs = jobs.length + fleet.length;

  return (
    <>
      <AdminHeader />
      <main className="min-h-screen bg-background p-4 sm:p-6 pt-20 pb-20 sm:pb-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Scheduled Tasks</h1>
                <p className="text-sm text-muted-foreground">
                  {totalJobs} scheduled task{totalJobs !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {!showForm && (
              <Button onClick={openCreate} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            )}
          </div>

          {/* Create / Edit Form */}
          {showForm && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {editingId ? "Edit Scheduled Task" : "New Scheduled Task"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="job-name">Name</Label>
                  <Input
                    id="job-name"
                    placeholder="e.g. Morning status report"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Schedule</Label>
                  <div className="flex gap-2">
                    <Select onValueChange={handlePresetChange}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Presets..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CRON_PRESETS.filter((p) => p.value).map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="0 9 * * 1-5"
                      value={form.cron_expr}
                      onChange={(e) => setForm((f) => ({ ...f, cron_expr: e.target.value }))}
                      className="flex-1 font-mono"
                    />
                  </div>
                  {form.cron_expr && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {agentCronToEnglish(form.cron_expr)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-task">Task (instruction for Claude)</Label>
                  <Textarea
                    id="job-task"
                    placeholder="e.g. Check all ad accounts and send a summary of yesterday's performance to #reports channel"
                    value={form.task}
                    onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={cancelForm} size="sm">
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    {editingId ? "Save Changes" : "Create Task"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fleet Automation Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Fleet Automation</CardTitle>
                <Badge variant="outline" className="text-[10px] ml-2">pg_cron</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Automated ad optimization, reports, and self-healing assessment
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {fleetLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : fleet.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No fleet cron jobs found
                </div>
              ) : isMobile ? (
                <div className="space-y-3 p-4">
                  {fleet.map((job) => {
                    const meta = FLEET_JOB_LABELS[job.jobname] || { label: job.jobname, description: '' };
                    return (
                      <div key={job.jobid} className="rounded-lg border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{meta.label}</p>
                          <Badge variant="outline" className={`text-[10px] ${job.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                            {job.active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                        <p className="text-xs text-primary font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {cronToEnglish(job.schedule)}
                        </p>
                        {job.lastRun && (
                          <p className="text-[11px] text-muted-foreground">
                            Last run {safeFormatDistance(job.lastRun, { addSuffix: true })}
                            {job.lastStatus && (
                              <span className={job.lastStatus === 'succeeded' ? ' text-emerald-400' : ' text-red-400'}>
                                {' '}({job.lastStatus})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Job</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="min-w-[280px]">Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleet.map((job) => {
                      const meta = FLEET_JOB_LABELS[job.jobname] || { label: job.jobname, description: '' };
                      return (
                        <TableRow key={job.jobid}>
                          <TableCell>
                            <p className="font-medium text-sm">{meta.label}</p>
                            <p className="text-[11px] text-muted-foreground">{job.jobname}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-primary font-medium">
                              {cronToEnglish(job.schedule)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground">{meta.description}</p>
                          </TableCell>
                          <TableCell>
                            {job.active ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1">
                                <Play className="h-3 w-3" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 gap-1">
                                <Pause className="h-3 w-3" /> Paused
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {job.lastRun
                                ? safeFormatDistance(job.lastRun, { addSuffix: true })
                                : "Never"}
                            </span>
                            {job.lastStatus && (
                              <span className={`text-[11px] block ${job.lastStatus === 'succeeded' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {job.lastStatus}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Agent Cron Jobs Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Agent Scheduled Tasks</CardTitle>
                <Badge variant="outline" className="text-[10px] ml-2">chat agent</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Custom scheduled tasks — create from here or via the AI agent in chat
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No scheduled tasks yet
                  </p>
                  {!showForm && (
                    <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Create your first task
                    </Button>
                  )}
                </div>
              ) : isMobile ? (
                /* ── Mobile: card layout ─────────────────── */
                <div className="space-y-3 p-4">
                  {jobs.map((job) => (
                    <div key={job.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{job.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" /> {agentCronToEnglish(job.cron_expr)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {toggling === job.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={job.enabled}
                              onCheckedChange={() => handleToggle(job)}
                              className="scale-75"
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{job.task}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className="capitalize">{job.member_name}</p>
                          <p>
                            {job.last_run
                              ? `Last run ${safeFormatDistance(job.last_run, { addSuffix: true })}`
                              : "Never run"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(job)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-500"
                            disabled={deleting === job.id}
                            onClick={() => handleDelete(job)}
                          >
                            {deleting === job.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Desktop: table layout ────────────────── */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Name</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="min-w-[250px]">Task</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className={job.enabled ? "" : "opacity-60"}>
                        <TableCell>
                          <p className="font-medium text-sm">{job.name}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-primary font-medium">
                            {agentCronToEnglish(job.cron_expr)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {job.task}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">{job.member_name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {toggling === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Switch
                                checked={job.enabled}
                                onCheckedChange={() => handleToggle(job)}
                              />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {job.enabled ? "Active" : "Paused"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {job.last_run
                              ? safeFormatDistance(job.last_run, { addSuffix: true })
                              : "Never"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit"
                              onClick={() => openEdit(job)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-500"
                              title="Delete"
                              disabled={deleting === job.id}
                              onClick={() => handleDelete(job)}
                            >
                              {deleting === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

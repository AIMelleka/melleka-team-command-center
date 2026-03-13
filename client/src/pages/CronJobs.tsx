import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeFormatDistance } from "@/lib/dateUtils";
import { Timer, Trash2, Clock, Play, Pause, Loader2, Zap } from "lucide-react";
import { fetchCronJobs, deleteCronJob, type CronJob } from "@/lib/chatApi";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

function cronToEnglish(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, _mon, dow] = parts;
  let timeStr = "";
  if (hour !== "*" && min !== "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    // Convert UTC to PST (UTC-8)
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

export default function CronJobs() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  // Agent cron jobs (Express backend)
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

  const jobs = cronJobs ?? [];
  const fleet = fleetJobs ?? [];
  const totalJobs = jobs.length + fleet.length;

  return (
    <>
      <AdminHeader />
      <main className="min-h-screen bg-background p-4 sm:p-6 pt-20 pb-20 sm:pb-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Timer className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Cron Jobs</h1>
              <p className="text-sm text-muted-foreground">
                {totalJobs} scheduled job{totalJobs !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

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
                <CardTitle className="text-base">Agent Cron Jobs</CardTitle>
                <Badge variant="outline" className="text-[10px] ml-2">chat agent</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Jobs created by the AI agent from chat
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No agent cron jobs. Ask the AI agent to create one from chat.
                </div>
              ) : isMobile ? (
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
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${
                            job.enabled
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          }`}
                        >
                          {job.enabled ? "Active" : "Paused"}
                        </Badge>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-red-400 hover:text-red-500"
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
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Job Name</TableHead>
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
                              ? safeFormatDistance(job.last_run, { addSuffix: true })
                              : "Never"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-500"
                            title="Delete cron job"
                            disabled={deleting === job.id}
                            onClick={() => handleDelete(job)}
                          >
                            {deleting === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
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

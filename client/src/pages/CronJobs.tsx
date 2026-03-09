import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Timer, Trash2, Clock, Play, Pause, Loader2 } from "lucide-react";
import { fetchCronJobs, deleteCronJob, type CronJob } from "@/lib/chatApi";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent } from "@/components/ui/card";
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

function cronToEnglish(expr: string): string {
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
  if (dom !== "*") {
    const suffix = dom === "1" ? "st" : dom === "2" ? "nd" : dom === "3" ? "rd" : "th";
    return timeStr ? `${dom}${suffix} of every month at ${timeStr}` : `${dom}${suffix} of every month`;
  }
  return expr;
}

export default function CronJobs() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: cronJobs, isLoading } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: fetchCronJobs,
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
                {jobs.length} scheduled job{jobs.length !== 1 ? "s" : ""} — created by the AI agent from chat
              </p>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20">
              <Timer className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No cron jobs scheduled. Ask the AI agent to create one from chat.
              </p>
            </div>
          ) : isMobile ? (
            /* Mobile card view */
            <div className="space-y-3">
              {jobs.map((job) => (
                <Card key={job.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{job.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> {cronToEnglish(job.cron_expr)}
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
                            ? `Last run ${formatDistanceToNow(new Date(job.last_run), { addSuffix: true })}`
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
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop table view */
            <Card>
              <CardContent className="p-0">
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
                            {cronToEnglish(job.cron_expr)}
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
                              ? formatDistanceToNow(new Date(job.last_run), { addSuffix: true })
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
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}

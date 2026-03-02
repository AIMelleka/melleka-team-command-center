/**
 * Cron job scheduler
 *
 * Loads team_cron_jobs from Supabase and schedules them with node-cron.
 * When a job fires, it runs Claude in the background and saves the result
 * as a new conversation in team_conversations + team_messages.
 */

import cron from "node-cron";
import { supabase } from "./supabase.js";
import { runChatBackground } from "./claude.js";
import { cronReloadCallbacks } from "./tools.js";

interface CronJob {
  id: string;
  member_name: string;
  name: string;
  cron_expr: string;
  task: string;
  enabled: boolean;
}

/** Active node-cron task handles, keyed by job ID */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeTasks = new Map<string, any>();

async function loadAndSchedule(): Promise<void> {
  // Stop all existing scheduled tasks
  for (const task of activeTasks.values()) task.stop();
  activeTasks.clear();

  const { data: jobs, error } = await supabase
    .from("team_cron_jobs")
    .select("id, member_name, name, cron_expr, task, enabled")
    .eq("enabled", true);

  if (error) {
    console.error("[scheduler] Failed to load cron jobs:", error.message);
    return;
  }

  const jobList = (jobs ?? []) as CronJob[];
  console.log(`[scheduler] Loaded ${jobList.length} active cron job(s)`);

  for (const job of jobList) {
    if (!cron.validate(job.cron_expr)) {
      console.warn(`[scheduler] Invalid cron expression for job "${job.name}": ${job.cron_expr}`);
      continue;
    }

    const task = cron.schedule(job.cron_expr, () => runJob(job), {
      timezone: "America/New_York",
    });

    activeTasks.set(job.id, task);
    console.log(`[scheduler] Scheduled "${job.name}" (${job.cron_expr}) for ${job.member_name}`);
  }
}

async function runJob(job: CronJob): Promise<void> {
  console.log(`[scheduler] Running job "${job.name}" for ${job.member_name}`);

  try {
    // Create a conversation for this job run
    const title = `[Auto] ${job.name} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data: conv } = await supabase
      .from("team_conversations")
      .insert({ member_name: job.member_name, title })
      .select("id")
      .single();

    if (!conv?.id) {
      console.error(`[scheduler] Failed to create conversation for job "${job.name}"`);
      return;
    }

    // Save the triggering "user" message
    await supabase.from("team_messages").insert({
      conversation_id: conv.id,
      role: "user",
      content: `[Scheduled task: ${job.name}]\n\n${job.task}`,
    });

    // Run Claude in the background
    const response = await runChatBackground(job.member_name, [
      { role: "user", content: `[Scheduled task: ${job.name}]\n\n${job.task}` },
    ]);

    // Save Claude's response
    await supabase.from("team_messages").insert({
      conversation_id: conv.id,
      role: "assistant",
      content: response,
    });

    // Update last_run
    await supabase
      .from("team_cron_jobs")
      .update({ last_run: new Date().toISOString() })
      .eq("id", job.id);

    console.log(`[scheduler] Job "${job.name}" completed for ${job.member_name}`);
  } catch (err) {
    console.error(`[scheduler] Job "${job.name}" failed:`, err);
  }
}

/** Start the scheduler — call once at server boot */
export async function startScheduler(): Promise<void> {
  await loadAndSchedule();

  // Reload jobs whenever a tool creates/deletes a cron job
  cronReloadCallbacks.push(() => {
    console.log("[scheduler] Reloading jobs...");
    loadAndSchedule().catch(console.error);
  });

  // Also reload every 5 minutes as a safety net
  cron.schedule("*/5 * * * *", () => loadAndSchedule().catch(console.error));
}

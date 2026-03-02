/**
 * Cron job scheduler
 *
 * Each cron job gets ONE persistent conversation. Every run appends to it
 * and marks the conversation has_unread=true so the bell lights up.
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
  conversation_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeTasks = new Map<string, any>();

async function loadAndSchedule(): Promise<void> {
  for (const task of activeTasks.values()) task.stop();
  activeTasks.clear();

  const { data: jobs, error } = await supabase
    .from("team_cron_jobs")
    .select("id, member_name, name, cron_expr, task, enabled, conversation_id")
    .eq("enabled", true);

  if (error) {
    console.error("[scheduler] Failed to load cron jobs:", error.message);
    return;
  }

  const jobList = (jobs ?? []) as CronJob[];
  console.log(`[scheduler] Loaded ${jobList.length} active cron job(s)`);

  for (const job of jobList) {
    if (!cron.validate(job.cron_expr)) {
      console.warn(`[scheduler] Invalid cron expr for "${job.name}": ${job.cron_expr}`);
      continue;
    }
    const task = cron.schedule(job.cron_expr, () => runJob(job), {
      timezone: "America/New_York",
    });
    activeTasks.set(job.id, task);
    console.log(`[scheduler] Scheduled "${job.name}" (${job.cron_expr}) for ${job.member_name}`);
  }
}

async function getOrCreateConversation(job: CronJob): Promise<string> {
  // Reuse existing conversation if we have one
  if (job.conversation_id) return job.conversation_id;

  // Create a persistent conversation for this cron job
  const { data: conv } = await supabase
    .from("team_conversations")
    .insert({
      member_name: job.member_name,
      title: `⚡ ${job.name}`,
      is_cron: true,
    })
    .select("id")
    .single();

  if (!conv?.id) throw new Error("Failed to create cron conversation");

  // Save it back to the job so future runs reuse it
  await supabase
    .from("team_cron_jobs")
    .update({ conversation_id: conv.id })
    .eq("id", job.id);

  job.conversation_id = conv.id;
  return conv.id;
}

async function runJob(job: CronJob): Promise<void> {
  console.log(`[scheduler] Running "${job.name}" for ${job.member_name}`);
  try {
    const convId = await getOrCreateConversation(job);

    const runTime = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const userMessage = `[Scheduled run — ${runTime}]\n\n${job.task}`;

    // Save the triggering message
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "user",
      content: userMessage,
    });

    // Run Claude (no streaming needed)
    const response = await runChatBackground(job.member_name, [
      { role: "user", content: userMessage },
    ]);

    // Append Claude's response and mark unread
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: response,
    });

    await supabase
      .from("team_conversations")
      .update({ has_unread: true, updated_at: new Date().toISOString() })
      .eq("id", convId);

    await supabase
      .from("team_cron_jobs")
      .update({ last_run: new Date().toISOString() })
      .eq("id", job.id);

    console.log(`[scheduler] "${job.name}" completed`);
  } catch (err) {
    console.error(`[scheduler] "${job.name}" failed:`, err);
  }
}

export async function startScheduler(): Promise<void> {
  await loadAndSchedule();

  cronReloadCallbacks.push(() => {
    loadAndSchedule().catch(console.error);
  });

  // Reload every 5 min as safety net
  cron.schedule("*/5 * * * *", () => loadAndSchedule().catch(console.error));
}

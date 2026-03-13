/**
 * Cron job scheduler
 *
 * Each cron job gets ONE persistent conversation. Every run appends to it
 * and marks the conversation has_unread=true so the bell lights up.
 *
 * Reliability features:
 * - History limited to last 6 messages (prevents context corruption)
 * - Auto-retry once on failure after 30s delay
 * - Slack alert on failure so the team knows immediately
 * - Response size cap to prevent DB bloat
 * - Conversation auto-reset if history gets corrupted
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

// Track running jobs to prevent overlapping runs
const runningJobs = new Set<string>();

// Max messages to load from history (keeps context clean and small)
const MAX_HISTORY_MESSAGES = 6;

// Max response length to save (prevents DB bloat and context overflow on next run)
const MAX_RESPONSE_LENGTH = 50000;

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
    const task = cron.schedule(job.cron_expr, () => runJobSafe(job), {
      timezone: "America/Los_Angeles",
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

/** Send a Slack alert when a cron job fails */
async function alertSlack(jobName: string, errorMsg: string): Promise<void> {
  try {
    const { data: secret } = await supabase
      .from("team_secrets")
      .select("value")
      .eq("key", "SLACK_BOT_TOKEN")
      .maybeSingle();

    if (!secret?.value) return;

    // Post to #cron-alerts or first available non-general channel
    const channelsResp = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=50", {
      headers: { Authorization: `Bearer ${secret.value}` },
    });
    const channelsData = await channelsResp.json() as { ok: boolean; channels?: { id: string; name: string; is_member: boolean }[] };
    if (!channelsData.ok || !channelsData.channels) return;

    // Prefer #cron-alerts, fall back to first non-general channel the bot is in (NEVER post to #general)
    const target =
      channelsData.channels.find((c) => c.name === "cron-alerts" && c.is_member) ??
      channelsData.channels.find((c) => c.is_member && c.name !== "general");

    if (!target) return;

    const shortError = errorMsg.length > 300 ? errorMsg.slice(0, 300) + "..." : errorMsg;
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret.value}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: target.id,
        text: `CRON JOB FAILED: "${jobName}"\n\nError: ${shortError}\n\nThe job will auto-retry once. Check Railway logs for details.`,
      }),
    });
  } catch {
    // Slack alert is best-effort, don't let it break anything
  }
}

/** Reset a conversation when history gets corrupted */
async function resetConversation(job: CronJob): Promise<void> {
  console.log(`[scheduler] Resetting corrupted conversation for "${job.name}"`);
  if (job.conversation_id) {
    await supabase.from("team_messages").delete().eq("conversation_id", job.conversation_id);
    await supabase.from("team_conversations").delete().eq("id", job.conversation_id);
  }
  await supabase.from("team_cron_jobs").update({ conversation_id: null }).eq("id", job.id);
  job.conversation_id = null;
}

/** Wrapper that prevents overlapping runs and handles retry */
async function runJobSafe(job: CronJob): Promise<void> {
  // Prevent overlapping runs of the same job
  if (runningJobs.has(job.id)) {
    console.log(`[scheduler] Skipping "${job.name}" — previous run still active`);
    return;
  }

  runningJobs.add(job.id);
  try {
    await runJob(job, false);
  } finally {
    runningJobs.delete(job.id);
  }
}

async function runJob(job: CronJob, isRetry: boolean): Promise<void> {
  console.log(`[scheduler] ${isRetry ? "RETRYING" : "Running"} "${job.name}" for ${job.member_name}`);
  try {
    const convId = await getOrCreateConversation(job);

    const runTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const userMessage = `[AUTOMATED CRON JOB — Scheduled run at ${runTime}]\nThis is an automated run. Do NOT ask for approval, confirmations, or user input. Execute all steps directly and completely.\n\n${job.task}`;

    // Save the triggering message
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "user",
      content: userMessage,
    });

    // Load RECENT conversation history only (prevents context corruption)
    const { data: history } = await supabase
      .from("team_messages")
      .select("role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    // Reverse to chronological order, sanitize content
    const messages = (history ?? []).reverse().map((m) => {
      const ts = new Date(m.created_at).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        dateStyle: "short",
        timeStyle: "short",
      });

      // Sanitize: strip any accidental JSON artifacts that could confuse Claude
      let content = m.content || "";
      if (content.length > 5000) {
        content = content.slice(0, 5000) + "\n[...truncated for context management]";
      }

      return {
        role: m.role as "user" | "assistant",
        content: `[${ts}] ${content}`,
      };
    });

    // Run Claude with history
    const response = await runChatBackground(job.member_name, messages, convId);

    // Cap response size before saving
    const savedResponse = response.length > MAX_RESPONSE_LENGTH
      ? response.slice(0, MAX_RESPONSE_LENGTH) + "\n\n[Response truncated for storage — full output was delivered during execution]"
      : response;

    // Append Claude's response and mark unread
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: savedResponse,
    });

    await supabase
      .from("team_conversations")
      .update({ has_unread: true, updated_at: new Date().toISOString() })
      .eq("id", convId);

    await supabase
      .from("team_cron_jobs")
      .update({ last_run: new Date().toISOString() })
      .eq("id", job.id);

    // Prune old messages to prevent unbounded growth
    // Keep only the last MAX_HISTORY_MESSAGES * 3 messages per conversation
    const pruneLimit = MAX_HISTORY_MESSAGES * 3;
    const { data: allMsgs } = await supabase
      .from("team_messages")
      .select("id")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (allMsgs && allMsgs.length > pruneLimit) {
      const toDelete = allMsgs.slice(0, allMsgs.length - pruneLimit).map((m) => m.id);
      await supabase.from("team_messages").delete().in("id", toDelete);
      console.log(`[scheduler] Pruned ${toDelete.length} old messages from "${job.name}" conversation`);
    }

    console.log(`[scheduler] "${job.name}" completed successfully`);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[scheduler] "${job.name}" failed:`, errorMsg);

    // Only reset conversation for genuine message-format corruption
    // (not generic API errors, timeouts, or billing issues)
    const isMessageCorruption = /tool_use.*tool_result/i.test(errorMsg) && /invalid_request_error/i.test(errorMsg);
    if (isMessageCorruption) {
      await resetConversation(job);
    } else {
      console.log(`[scheduler] "${job.name}" error was not corruption — preserving conversation for debugging`);
    }

    if (!isRetry) {
      // Alert Slack on first failure
      await alertSlack(job.name, errorMsg);

      // Auto-retry once after 30 seconds
      console.log(`[scheduler] Will retry "${job.name}" in 30 seconds...`);
      setTimeout(() => {
        runJob(job, true).catch((retryErr) => {
          console.error(`[scheduler] "${job.name}" retry also failed:`, retryErr);
        });
      }, 30_000);
    }
  }
}

export function getActiveCronCount(): number {
  return activeTasks.size;
}

/** Trigger a cron job by ID (for manual runs). Returns true if found and started. */
export async function triggerJobById(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: job, error } = await supabase
    .from("team_cron_jobs")
    .select("id, member_name, name, cron_expr, task, enabled, conversation_id")
    .eq("id", jobId)
    .single();

  if (error || !job) return { ok: false, error: "Job not found" };
  if (runningJobs.has(job.id)) return { ok: false, error: "Job already running" };

  // Fire and forget — run in background
  runJobSafe(job as CronJob).catch((err) => {
    console.error(`[scheduler] Manual trigger of "${job.name}" failed:`, err);
  });

  return { ok: true };
}

export async function startScheduler(): Promise<void> {
  await loadAndSchedule();

  cronReloadCallbacks.push(() => {
    loadAndSchedule().catch(console.error);
  });

  // Reload every 5 min as safety net
  cron.schedule("*/5 * * * *", () => loadAndSchedule().catch(console.error));
}

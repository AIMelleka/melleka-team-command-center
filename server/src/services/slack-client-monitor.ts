/**
 * Slack Client Response Monitor
 *
 * Watches monitored client channels for unanswered messages.
 * If no team member replies within escalating thresholds, fires alerts
 * to #office_soldiers tagging the full team.
 *
 * Rules (per spec):
 * - Timer anchors to the FIRST unanswered client message per channel
 * - Both top-level messages AND thread replies from team members resolve the alert
 * - Alerts only fire during business hours (8 AM – 8 PM PST)
 * - After 24hr alert, the cycle closes; a new one starts on the next client message
 * - Bot messages and message subtypes (edits, deletes) are ignored
 */

import { supabase } from "./supabase.js";
import { computeReportScore, tierFromScore, tierEmoji, type Platform, type ClientGoals } from "./client-scoring.js";

// ─── Team member Slack user IDs ──────────────────────────────────────────────
// Messages from these users cancel the active alert for that channel.
const TEAM_MEMBER_IDS = new Set([
  "U080Z6QH89H", // Lexie Alter
  "U09CVCS0KTN", // David Akopyan
  "U08KCMZS21G", // Emely Felix Gonzalez
  "U0B8GEJ8QNM", // Gavin
  "U05VDLG6B5F", // Bryan Valdez
  "U023PM9ALL9", // Anthony Melleka
  "U0BDDQU206Q", // John
]);

// Mention string used in alert messages
const TEAM_MENTIONS =
  "<@U080Z6QH89H> <@U09CVCS0KTN> <@U08KCMZS21G> <@U0B8GEJ8QNM> <@U05VDLG6B5F> <@U023PM9ALL9> <@U0BDDQU206Q>";

// ─── Escalation thresholds ───────────────────────────────────────────────────
const THRESHOLDS = [
  { key: "30min", minutes: 30,   emoji: ":large_yellow_circle:", label: "30 minutes" },
  { key: "1hr",   minutes: 60,   emoji: ":large_orange_circle:", label: "1 hour" },
  { key: "2hr",   minutes: 120,  emoji: ":red_circle:",          label: "2 hours" },
  { key: "24hr",  minutes: 1440, emoji: ":red_circle:",          label: "24 hours" },
] as const;

type ThresholdKey = typeof THRESHOLDS[number]["key"];

// ─── Business hours ───────────────────────────────────────────────────────────
const BUSINESS_START_HOUR = 8;  // 8 AM PST/PDT
const BUSINESS_END_HOUR   = 20; // 8 PM PST/PDT

function isBusinessHours(): boolean {
  const ptHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10
  );
  return ptHour >= BUSINESS_START_HOUR && ptHour < BUSINESS_END_HOUR;
}

// ─── Slack token / channel ID cache ──────────────────────────────────────────
let _botToken: string | null = null;
let _officeSoldiersId: string | null = null;
let _adUpdatesId: string | null = null;

async function getBotToken(): Promise<string> {
  if (_botToken) return _botToken;
  const { data } = await supabase
    .from("team_secrets")
    .select("value")
    .eq("key", "SLACK_BOT_TOKEN")
    .maybeSingle();
  if (!data?.value) throw new Error("[slack-monitor] SLACK_BOT_TOKEN not found in team_secrets");
  _botToken = data.value;
  return _botToken!;
}

async function getOfficeSoldiersId(): Promise<string> {
  if (_officeSoldiersId) return _officeSoldiersId;

  // Check for explicit override in team_secrets first
  const { data: secret } = await supabase
    .from("team_secrets")
    .select("value")
    .eq("key", "SLACK_OFFICE_SOLDIERS_ID")
    .maybeSingle();

  if (secret?.value) {
    _officeSoldiersId = secret.value;
  } else {
    // Fall back to looking up by channel name via Slack API
    const token = await getBotToken();
    const resp = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel&limit=200",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await resp.json() as { ok: boolean; channels?: { id: string; name: string }[] };
    const ch = json.channels?.find((c) => c.name === "respond_watcher");
    if (!ch) throw new Error("[slack-monitor] #respond_watcher channel not found — add SLACK_OFFICE_SOLDIERS_ID to team_secrets");
    _officeSoldiersId = ch.id;
  }

  // Join the channel so the bot receives events from it (required to detect team replies).
  // This is a no-op if the bot is already a member. Errors are non-fatal.
  try {
    const token = await getBotToken();
    await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: _officeSoldiersId }),
    });
  } catch {
    // Non-fatal — bot may already be a member or lack channels:join scope
  }

  return _officeSoldiersId!;
}

async function getAdUpdatesId(): Promise<string> {
  if (_adUpdatesId) return _adUpdatesId;

  // Check for explicit override in team_secrets first
  const { data: secret } = await supabase
    .from("team_secrets")
    .select("value")
    .eq("key", "SLACK_AD_UPDATES_ID")
    .maybeSingle();

  if (secret?.value) {
    _adUpdatesId = secret.value;
    return _adUpdatesId!;
  }

  // Fall back to looking up by channel name (searches both public and private)
  const token = await getBotToken();
  const resp = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await resp.json() as { ok: boolean; channels?: { id: string; name: string }[] };
  const names = ["ad-updates", "ad_updates", "adupdates", "ad-update", "ad_update"];
  const ch = json.channels?.find((c) => names.includes(c.name));
  if (!ch) {
    // Log all available channels to help diagnose
    const available = (json.channels || []).map((c) => c.name).join(", ");
    console.error(`[slack-monitor] #ad-updates not found. Available channels: ${available}`);
    throw new Error("[slack-monitor] #ad-updates channel not found — add SLACK_AD_UPDATES_ID to team_secrets");
  }
  _adUpdatesId = ch.id;
  return _adUpdatesId!;
}

// ─── Monitored channels cache (refreshed every 5 min) ────────────────────────
let _monitoredChannels: Set<string> | null = null;
let _monitoredChannelsRefreshed = 0;

async function getMonitoredChannels(): Promise<Set<string>> {
  const now = Date.now();
  if (_monitoredChannels && now - _monitoredChannelsRefreshed < 5 * 60 * 1000) {
    return _monitoredChannels;
  }
  const { data } = await supabase
    .from("slack_monitored_channels")
    .select("channel_id")
    .eq("enabled", true);
  _monitoredChannels = new Set((data || []).map((r: { channel_id: string }) => r.channel_id));
  _monitoredChannelsRefreshed = now;
  return _monitoredChannels;
}

// ─── Post alert to #office_soldiers ──────────────────────────────────────────
// Returns the Slack message ts so callers can store it for thread-based resolution.
async function postAlert(
  channelId: string,
  channelName: string,
  threshold: typeof THRESHOLDS[number]
): Promise<string | null> {
  const token = await getBotToken();
  const soldiersId = await getOfficeSoldiersId();

  const text = `${threshold.emoji} No response in ${threshold.label} - <#${channelId}>`;

  const resp = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: soldiersId, text }),
  });

  const result = await resp.json() as { ok: boolean; error?: string; ts?: string };
  if (!result.ok) {
    console.error(`[slack-monitor] Failed to post alert: ${result.error}`);
    return null;
  }
  return result.ts ?? null;
}

// ─── Verify if a team member has actually replied in a channel ────────────────
// Checks both top-level messages and the thread of the original client message.
// Used to self-heal missed Events API events and catch thread replies.
async function hasTeamMemberReplied(token: string, channelId: string, sinceTs: string): Promise<boolean> {
  try {
    // Check top-level messages since the first client message
    const histResp = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${sinceTs}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const hist = await histResp.json() as {
      ok: boolean;
      messages?: Array<{ user?: string; bot_id?: string; subtype?: string }>;
    };
    if (hist.ok && hist.messages) {
      const repliedTopLevel = hist.messages.some(
        (m) => m.user && TEAM_MEMBER_IDS.has(m.user) && !m.bot_id && !m.subtype
      );
      if (repliedTopLevel) return true;
    }

    // Also check the thread rooted at sinceTs (catches thread replies)
    const threadResp = await fetch(
      `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${sinceTs}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const thread = await threadResp.json() as {
      ok: boolean;
      messages?: Array<{ user?: string; bot_id?: string; subtype?: string }>;
    };
    if (thread.ok && thread.messages) {
      // Skip index 0 (the root message itself)
      return thread.messages.slice(1).some(
        (m) => m.user && TEAM_MEMBER_IDS.has(m.user) && !m.bot_id && !m.subtype
      );
    }
  } catch {
    // On error, don't block alerts — assume not replied
  }
  return false;
}

// ─── Poll for overdue alerts ──────────────────────────────────────────────────
async function checkAndFireAlerts(): Promise<void> {
  if (!isBusinessHours()) return;

  const now = new Date();
  const token = await getBotToken();

  const { data: openAlerts, error } = await supabase
    .from("client_response_alerts")
    .select("*")
    .eq("resolved", false);

  if (error) {
    console.error("[slack-monitor] DB error fetching alerts:", error.message);
    return;
  }

  for (const alert of openAlerts || []) {
    // Before doing anything, verify a team member hasn't already replied
    // (catches missed Events API events and thread replies)
    const alreadyReplied = await hasTeamMemberReplied(token, alert.channel_id, alert.first_message_ts);
    if (alreadyReplied) {
      await supabase
        .from("client_response_alerts")
        .update({ resolved: true, resolved_at: now.toISOString() })
        .eq("id", alert.id);
      console.log(`[slack-monitor] Auto-resolved #${alert.channel_name} — team reply confirmed in channel`);
      continue;
    }

    const elapsedMinutes =
      (now.getTime() - new Date(alert.first_message_time).getTime()) / 60_000;
    const fired: ThresholdKey[] = alert.alerts_fired || [];

    // Find the highest threshold that's due but not yet fired
    for (const threshold of THRESHOLDS) {
      if (elapsedMinutes >= threshold.minutes && !fired.includes(threshold.key as ThresholdKey)) {
        try {
          const watcherMsgTs = await postAlert(alert.channel_id, alert.channel_name, threshold);

          const newFired = [...fired, threshold.key];
          // Append the posted message ts so we can resolve by thread_ts later (no Slack API needed)
          const existingTs: string[] = alert.watcher_message_timestamps || [];
          const tsUpdate = watcherMsgTs
            ? { watcher_message_timestamps: [...existingTs, watcherMsgTs] }
            : {};

          if (threshold.key === "24hr") {
            // Close the alert cycle after the final ping
            await supabase
              .from("client_response_alerts")
              .update({ alerts_fired: newFired, resolved: true, resolved_at: now.toISOString(), ...tsUpdate })
              .eq("id", alert.id);
          } else {
            await supabase
              .from("client_response_alerts")
              .update({ alerts_fired: newFired, ...tsUpdate })
              .eq("id", alert.id);
          }
        } catch (err) {
          console.error(`[slack-monitor] Alert failed for ${alert.channel_id}:`, err);
        }
        break; // Only fire one threshold per check cycle per alert
      }
    }
  }
}

// ─── Resolve alert when a team member replies to a bot alert in #respond_watcher
// Emely (or anyone) can reply in the thread of an alert message to close it.
async function resolveAlertFromWatcherThread(token: string, watcherChannelId: string, threadTs: string): Promise<void> {
  try {
    const resolvedAt = new Date().toISOString();

    // Primary: look up the alert by stored watcher message timestamp — no Slack API needed.
    // watcher_message_timestamps stores the ts of every alert message this bot posted.
    const { data: alertRow } = await supabase
      .from("client_response_alerts")
      .select("id, channel_id, channel_name")
      .contains("watcher_message_timestamps", [threadTs])
      .eq("resolved", false)
      .maybeSingle();

    if (alertRow) {
      await supabase
        .from("client_response_alerts")
        .update({ resolved: true, resolved_at: resolvedAt })
        .eq("id", alertRow.id);
      console.log(`[slack-monitor] Alert resolved for #${alertRow.channel_name} via watcher thread reply (DB lookup)`);
      return;
    }

    // Fallback: read root message from Slack API to extract the client channel ID.
    // Handles alerts created before watcher_message_timestamps was added.
    const resp = await fetch(
      `https://slack.com/api/conversations.replies?channel=${watcherChannelId}&ts=${threadTs}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json() as { ok: boolean; messages?: Array<{ text?: string }> };
    if (!data.ok || !data.messages?.[0]) return;

    const rootText = data.messages[0].text || "";
    const match = rootText.match(/<#(C[A-Z0-9]+)/);
    if (!match) return;

    const clientChannelId = match[1];
    const { error } = await supabase
      .from("client_response_alerts")
      .update({ resolved: true, resolved_at: resolvedAt })
      .eq("channel_id", clientChannelId)
      .eq("resolved", false);

    if (!error) {
      console.log(`[slack-monitor] Alert resolved for #${clientChannelId} via watcher thread reply (Slack API fallback)`);
    }
  } catch (err) {
    console.error("[slack-monitor] resolveAlertFromWatcherThread error:", err);
  }
}

// ─── Handle incoming Slack message event ─────────────────────────────────────
export async function handleSlackMessage(event: {
  channel?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  subtype?: string;
}): Promise<void> {
  // Ignore bot messages and message subtypes (edits, deletes, joins, etc.)
  if (event.bot_id || event.subtype) return;
  if (!event.user || !event.channel) return;

  const isTeamMember = TEAM_MEMBER_IDS.has(event.user);

  // If a team member sends any message in #respond_watcher, resolve the corresponding alert.
  // Handles both thread replies (e.g. Emely replies "done" to a bot alert) and
  // top-level messages that mention a channel (e.g. "<#C123> is handled").
  if (isTeamMember) {
    try {
      const token = await getBotToken();
      const watcherId = await getOfficeSoldiersId();
      if (event.channel === watcherId) {
        if (event.thread_ts) {
          // Thread reply — look up root message to find the client channel
          await resolveAlertFromWatcherThread(token, watcherId, event.thread_ts);
        } else {
          // Top-level message — check if the text contains a channel mention
          const match = (event.text || "").match(/<#(C[A-Z0-9]+)/i);
          if (match) {
            const { error } = await supabase
              .from("client_response_alerts")
              .update({ resolved: true, resolved_at: new Date().toISOString() })
              .eq("channel_id", match[1])
              .eq("resolved", false);
            if (!error) {
              console.log(`[slack-monitor] Alert resolved for #${match[1]} via watcher top-level message`);
            }
          }
        }
        return;
      }
    } catch {
      // Can't determine watcher channel ID — fall through to normal processing
    }
  }

  const monitoredChannels = await getMonitoredChannels();
  if (!monitoredChannels.has(event.channel)) return;

  if (isTeamMember) {
    // Team member responded — resolve all open alerts for this channel
    // (both top-level messages and thread replies count per spec)
    const { error } = await supabase
      .from("client_response_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("channel_id", event.channel)
      .eq("resolved", false);

    if (error) {
      console.error(`[slack-monitor] Failed to resolve alerts for ${event.channel}:`, error.message);
    } else {
      console.log(`[slack-monitor] Alert resolved for #${event.channel} by team member ${event.user}`);
    }
    return;
  }

  // Client message — check if there's already an open alert for this channel
  const { data: existing } = await supabase
    .from("client_response_alerts")
    .select("id")
    .eq("channel_id", event.channel)
    .eq("resolved", false)
    .maybeSingle();

  if (existing) {
    // Already tracking this channel — timer anchors to first message, do nothing
    return;
  }

  // Before creating an alert, verify no team member has already replied since this message.
  // Slack sometimes delivers Events API events out of order — the team reply can arrive
  // before the client message, so the resolve logic finds no open alert to close.
  // Checking channel history here prevents false alerts from that race condition.
  try {
    const token = await getBotToken();
    const alreadyReplied = await hasTeamMemberReplied(token, event.channel, event.ts);
    if (alreadyReplied) {
      console.log(`[slack-monitor] Skipping alert for #${event.channel} — team already replied`);
      return;
    }
  } catch {
    // On error, proceed and create the alert to avoid missing real unanswered messages
  }

  // Look up channel name from our monitored channels table
  const { data: channelRow } = await supabase
    .from("slack_monitored_channels")
    .select("channel_name")
    .eq("channel_id", event.channel)
    .maybeSingle();

  // Create new alert record anchored to this first unanswered message
  const { error: insertError } = await supabase.from("client_response_alerts").insert({
    channel_id: event.channel,
    channel_name: channelRow?.channel_name || event.channel,
    first_message_ts: event.ts,
    first_message_text: (event.text || "").slice(0, 500),
    first_message_user: event.user,
    first_message_time: new Date().toISOString(),
    alerts_fired: [],
    resolved: false,
  });

  if (insertError) {
    // Unique constraint violation means another insert beat us — that's fine
    if (!insertError.message.includes("unique")) {
      console.error(`[slack-monitor] Failed to create alert for ${event.channel}:`, insertError.message);
    }
  } else {
    console.log(`[slack-monitor] New alert started for #${channelRow?.channel_name || event.channel}`);
  }
}

// ─── Daily client score post → #ad-updates ───────────────────────────────────
// Uses the EXACT same scoring formula as the Daily Reports UI:
//   Cost Efficiency 50% + Volume & Pacing 30% + Trend Direction 20%
// Goals from managed_clients (target_cpa, target_cpl, etc.) take priority,
// aligned with each client's Scoring Goals section.
export async function postDailyClientScores(): Promise<void> {
  try {
    const token = await getBotToken();
    const channelId = await getAdUpdatesId();

    // 1. Load all active clients + their scoring goals
    // Try to load goal columns; fall back to name-only if the migration hasn't run yet
    let { data: clients, error: clientErr } = await supabase
      .from("managed_clients")
      .select("client_name, target_cpa, target_cpl, target_roas, monthly_budget, monthly_lead_target, monthly_conversion_target")
      .eq("is_active", true)
      .order("client_name");

    if (clientErr && clientErr.message.includes("does not exist")) {
      // Goal columns not yet migrated — query without them
      const fallback = await supabase
        .from("managed_clients")
        .select("client_name")
        .eq("is_active", true)
        .order("client_name");
      clients = (fallback.data || []).map((r: { client_name: string }) => ({ client_name: r.client_name, target_cpa: null, target_cpl: null, target_roas: null, monthly_budget: null, monthly_lead_target: null, monthly_conversion_target: null }));
      clientErr = fallback.error;
    }

    if (clientErr) {
      console.error("[slack-monitor] managed_clients fetch error:", clientErr.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log("[slack-monitor] No active clients — skipping daily score post");
      return;
    }

    // 2. Load the most recent ad_review_history report per client (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: reports, error: reportErr } = await supabase
      .from("ad_review_history")
      .select("client_name, review_date, platforms")
      .gte("review_date", sevenDaysAgo)
      .order("review_date", { ascending: false });

    if (reportErr) {
      console.error("[slack-monitor] ad_review_history fetch error:", reportErr.message);
      return;
    }

    // Keep only the most recent report per client
    const latestReport = new Map<string, { platforms: Platform[] }>();
    for (const row of reports || []) {
      const key = row.client_name.toLowerCase().trim();
      if (!latestReport.has(key)) {
        latestReport.set(key, { platforms: row.platforms || [] });
      }
    }

    // 3. Score each client
    const scored: Array<{ name: string; score: number; tier: ReturnType<typeof tierFromScore>; usedGoals: boolean; noReport: boolean }> = [];

    for (const client of clients) {
      const key = client.client_name.toLowerCase().trim();
      const report = latestReport.get(key);

      if (!report) {
        // No recent report — mark as unknown with neutral score
        scored.push({ name: client.client_name, score: -1, tier: "critical", usedGoals: false, noReport: true });
        continue;
      }

      const goals: ClientGoals = {
        target_cpa: client.target_cpa,
        target_cpl: client.target_cpl,
        target_roas: client.target_roas,
        monthly_budget: client.monthly_budget,
        monthly_lead_target: client.monthly_lead_target,
        monthly_conversion_target: client.monthly_conversion_target,
      };

      const result = computeReportScore(report.platforms, goals);
      scored.push({ name: client.client_name, score: result.score, tier: result.tier, usedGoals: result.usedGoals, noReport: false });
    }

    // Sort: lowest score first, no-report clients at the bottom
    scored.sort((a, b) => {
      if (a.noReport && !b.noReport) return 1;
      if (!a.noReport && b.noReport) return -1;
      return a.score - b.score;
    });

    const date = new Date().toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const lines = scored.map((c) => {
      if (c.noReport) return `${c.name} - No report :white_circle:`;
      return `${c.name} - ${c.score} ${tierEmoji(c.tier)}`;
    });

    const text = [
      `:bar_chart: *Client Scores — ${date}*`,
      "",
      ...lines,
      "",
      `<https://genie.melleka.com/daily-reports|View full daily reports on genie.melleka.com>`,
    ].join("\n");

    const resp = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: channelId, text }),
    });
    const result = await resp.json() as { ok: boolean; error?: string };
    if (!result.ok) {
      console.error("[slack-monitor] Failed to post daily client scores:", result.error);
    } else {
      const withGoals = scored.filter((c) => c.usedGoals).length;
      console.log(`[slack-monitor] Daily client scores posted — ${scored.length} clients (${withGoals} scored against their goals)`);
    }
  } catch (err: any) {
    console.error("[slack-monitor] postDailyClientScores error:", err?.message || err);
  }
}

// ─── Morning briefing ─────────────────────────────────────────────────────────
// At 8 AM PST on weekdays, post a summary of any open alerts to #office_soldiers
// so the team starts each day knowing which client channels need a reply.
async function postMorningBriefing(): Promise<void> {
  try {
    const token = await getBotToken();
    const soldiersId = await getOfficeSoldiersId();

    const { data: openAlerts } = await supabase
      .from("client_response_alerts")
      .select("channel_id, channel_name, first_message_time, first_message_text, first_message_ts, alerts_fired")
      .eq("resolved", false)
      .order("first_message_time", { ascending: true });

    const now = Date.now();

    if (!openAlerts || openAlerts.length === 0) {
      const text = `:sunny: *Good morning!* All client channels are caught up — no unanswered messages. Great work team! ${TEAM_MENTIONS}`;
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: soldiersId, text }),
      });
      return;
    }

    const lines = openAlerts.map((a) => {
      const elapsed = Math.round((now - new Date(a.first_message_time).getTime()) / 60_000);
      const hrs = Math.floor(elapsed / 60);
      const mins = elapsed % 60;
      const age = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      const snippet = (a.first_message_text || "").slice(0, 120);
      const linkTs = (a.first_message_ts || "").replace(".", "");
      const link = linkTs ? ` — <https://slack.com/archives/${a.channel_id}/p${linkTs}|view>` : "";
      return `:speech_balloon: <#${a.channel_id}> — waiting *${age}*${link}\n> ${snippet || "(no text)"}`;
    });

    const text = [
      `:sunrise: *Morning briefing — ${openAlerts.length} client channel${openAlerts.length > 1 ? "s" : ""} need${openAlerts.length === 1 ? "s" : ""} a reply:*`,
      "",
      ...lines,
      "",
      `${TEAM_MENTIONS} — please respond!`,
    ].join("\n");

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: soldiersId, text }),
    });

    console.log(`[slack-monitor] Morning briefing posted — ${openAlerts.length} open alert(s)`);
  } catch (err: any) {
    console.error("[slack-monitor] Morning briefing error:", err?.message || err);
  }
}

// Returns the current PST/PDT hour (0-23) and whether it's a weekday
function getPtTime(): { hour: number; isWeekday: boolean } {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10
  );
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  }).format(new Date());
  return { hour, isWeekday: !["Sat", "Sun"].includes(day) };
}

// ─── Regenerate all client reports via the bulk-ad-review edge function ───────
async function regenerateAllReports(): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("[slack-monitor] Missing env vars for report regeneration");
      return;
    }
    // Empty body = bulk mode (processes all active clients with account mappings)
    const resp = await fetch(`${supabaseUrl}/functions/v1/bulk-ad-review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    });
    const data = await resp.json() as { ok: boolean; message?: string };
    console.log(`[slack-monitor] Report regeneration triggered — ${data.message || "started in background"}`);
  } catch (err: any) {
    console.error("[slack-monitor] Report regeneration error:", err?.message || err);
  }
}

// ─── Start the polling loop ───────────────────────────────────────────────────
export function startClientMonitor(): void {
  console.log("[slack-monitor] Starting — polling every 60s, business hours 8AM–8PM PST");

  // Run immediately on start to catch any alerts that built up during a restart
  checkAndFireAlerts().catch((err) =>
    console.error("[slack-monitor] Initial check error:", err)
  );

  let regenFiredToday   = false;
  let briefingFiredToday = false;
  let lastDay = "";

  setInterval(() => {
    checkAndFireAlerts().catch((err) =>
      console.error("[slack-monitor] Poll error:", err)
    );

    const todayPt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "short",
    }).format(new Date());

    // Reset once-per-day flags at midnight PT
    if (todayPt !== lastDay) {
      regenFiredToday    = false;
      briefingFiredToday = false;
      lastDay = todayPt;
    }

    const { hour, isWeekday } = getPtTime();

    // 7 AM — regenerate all client reports (gives ~1 hour before the Slack post)
    if (hour === 7 && isWeekday && !regenFiredToday) {
      regenFiredToday = true;
      regenerateAllReports().catch((err) =>
        console.error("[slack-monitor] Report regeneration error:", err)
      );
    }

    // 8 AM — morning briefing + post fresh client scores to #ad-updates
    if (hour === 8 && isWeekday && !briefingFiredToday) {
      briefingFiredToday = true;
      postMorningBriefing().catch((err) =>
        console.error("[slack-monitor] Morning briefing error:", err)
      );
      postDailyClientScores().catch((err) =>
        console.error("[slack-monitor] Daily client scores error:", err)
      );
    }
  }, 60_000);
}

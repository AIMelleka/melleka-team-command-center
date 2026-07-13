/**
 * Slack Office Soldiers Agent
 *
 * Listens ONLY to #office_soldiers. When a team member sends a message there,
 * it runs it through the full super-agent (runChatBackground) and replies in-thread.
 *
 * Rules:
 * - ONLY fires for channel C09176FSH1U (#office_soldiers)
 * - Bot messages and subtypes are ignored
 * - Adds 👀 reaction while processing, ✅ when done
 * - Always replies in a thread (keeps the channel clean)
 * - Thread history is passed as context so conversations stay coherent
 */

import { supabase } from "./supabase.js";
import { runChatBackground } from "./claude.js";
import type Anthropic from "@anthropic-ai/sdk";

const OFFICE_SOLDIERS_ID = "C09176FSH1U";

// Slack user ID → team member name (must match team_members.name)
const USER_TO_MEMBER: Record<string, string> = {
  "U080Z6QH89H": "lexie",
  "U09CVCS0KTN": "david",
  "U08KCMZS21G": "emely",
  "U0B8GEJ8QNM": "gavin",
  "U05VDLG6B5F": "bryan",
  "U023PM9ALL9": "anthony",
  "U0BDDQU206Q": "john",
};

// ─── Token + bot identity cache ───────────────────────────────────────────────
let _token: string | null = null;
let _botUserId: string | null = null; // the <@U...> user ID used in @mentions

async function getToken(): Promise<string> {
  if (_token) return _token;
  const { data } = await supabase
    .from("team_secrets")
    .select("value")
    .eq("key", "SLACK_BOT_TOKEN")
    .maybeSingle();
  if (!data?.value) throw new Error("[slack-office-agent] SLACK_BOT_TOKEN missing");
  _token = data.value;
  return _token!;
}

async function getBotUserId(token: string): Promise<string> {
  if (_botUserId) return _botUserId;
  const resp = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json() as { user_id?: string };
  _botUserId = data.user_id ?? "";
  return _botUserId;
}

// ─── Slack helpers ────────────────────────────────────────────────────────────
async function addReaction(token: string, channel: string, ts: string, name: string) {
  await fetch("https://slack.com/api/reactions.add", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, timestamp: ts, name }),
  });
}

async function removeReaction(token: string, channel: string, ts: string, name: string) {
  await fetch("https://slack.com/api/reactions.remove", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, timestamp: ts, name }),
  });
}

async function postMessage(token: string, channel: string, text: string, threadTs: string) {
  // Slack max per message is ~3900 chars — chunk if needed
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 3900) {
    chunks.push(text.slice(i, i + 3900));
  }
  for (const chunk of chunks) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel, text: chunk, thread_ts: threadTs }),
    });
  }
}

async function fetchThreadHistory(token: string, channel: string, threadTs: string, botUserId: string) {
  const resp = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json() as { ok: boolean; messages?: { user?: string; bot_id?: string; text?: string; ts: string }[] };
  if (!data.ok || !data.messages) return [];
  return data.messages;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleOfficeSoldiersMessage(event: {
  channel?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  subtype?: string;
}): Promise<void> {
  // Only #office_soldiers, only real human messages
  if (event.channel !== OFFICE_SOLDIERS_ID) return;
  if (event.bot_id || event.subtype) return;
  if (!event.user || !event.text?.trim()) return;

  const token = await getToken();
  const botUserId = await getBotUserId(token);
  const memberName = USER_TO_MEMBER[event.user] || "anthony";
  const threadTs = event.thread_ts || event.ts; // anchor for thread replies

  // Only respond when:
  //  a) the bot is @mentioned in the message, OR
  //  b) this is a reply inside a thread where the bot has already spoken
  const isMentioned = botUserId && event.text!.includes(`<@${botUserId}>`);
  if (!isMentioned) {
    if (!event.thread_ts) return; // top-level, not a mention — ignore

    // Thread reply: check if the bot has already participated
    const history = await fetchThreadHistory(token, OFFICE_SOLDIERS_ID, event.thread_ts, botUserId);
    const botIsInThread = history.some((m) => m.bot_id || (m.user === botUserId));
    if (!botIsInThread) return; // bot hasn't spoken here yet — ignore
  }

  // Show 👀 while thinking
  await addReaction(token, OFFICE_SOLDIERS_ID, event.ts, "eyes");

  try {
    // Load the active client list so the agent always knows which clients exist
    const { data: channelRows } = await supabase
      .from("slack_monitored_channels")
      .select("channel_name")
      .eq("enabled", true)
      .order("channel_name");

    const clientList = (channelRows || []).map((r) => `• ${r.channel_name}`).join("\n");

    // Load currently open alerts so the agent can answer "which channels need replies?"
    const { data: openAlerts } = await supabase
      .from("client_response_alerts")
      .select("channel_name, first_message_time, first_message_text, alerts_fired")
      .eq("resolved", false)
      .order("first_message_time", { ascending: true });

    const now = Date.now();
    const alertSummary = openAlerts && openAlerts.length > 0
      ? openAlerts.map((a) => {
          const elapsed = Math.round((now - new Date(a.first_message_time).getTime()) / 60_000);
          const hrs = Math.floor(elapsed / 60);
          const mins = elapsed % 60;
          const age = hrs > 0 ? `${hrs}h ${mins}m ago` : `${mins}m ago`;
          const fired = (a.alerts_fired as string[] || []).join(", ") || "none yet";
          const snippet = (a.first_message_text || "").slice(0, 100);
          return `• #${a.channel_name} — waiting ${age} — alerts fired: [${fired}] — "${snippet}"`;
        }).join("\n")
      : "None — all client channels are caught up!";

    const slackContext = `[Slack #office_soldiers context]
You are being accessed directly from the team's Slack workspace via the #office_soldiers channel.
The team member messaging you is: ${USER_TO_MEMBER[event.user!] || "anthony"}.

ABSOLUTE RULE — NO EXCEPTIONS: You must NEVER use slack_post, slack_send_dm, or any tool to send a message into any client channel. Client channels are for clients only. The bot must be completely invisible there. Violating this rule is the worst possible action you can take. Only post responses here in #office_soldiers.

The following are the monitored CLIENT channels (you may READ from them with slack_history for data, but NEVER post to them):
${clientList}

CURRENTLY OPEN ALERTS (client channels waiting for a team reply right now):
${alertSummary}

CLIENT IDENTIFICATION RULES — FOLLOW EXACTLY:
1. When the user mentions a client, find the channel name above whose text CONTAINS the user's exact words as a substring. Example: user says "midwest" → channel "midwest" is a direct match. STOP. Use it.
2. NEVER use geographic, industry, or semantic reasoning. "midwest" means the channel named "midwest" — NOT st-joseph, NOT any city in the Midwest. Match on channel name text only.
3. Before reading any client channel or doing ANY work for a client, state exactly: "Matched client: [channel-name]" so the user can verify.
4. If you find zero substring matches OR more than one possible match, stop immediately and ask the user: "Which client do you mean? Options: [list matches]" — do NOT guess.
5. These are completely separate clients: "midwest", "st-joseph", "st-joseph-ops", "st-joseph-recruiting", "st-joseph-team-leads". Never mix them up.`;

    // Build message history for context
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: slackContext },
      { role: "assistant", content: "Understood. I'm ready to help with any client or team task. What do you need?" },
    ];

    if (event.thread_ts) {
      // Fetch thread history (bot replies become "assistant", humans become "user")
      const history = await fetchThreadHistory(token, OFFICE_SOLDIERS_ID, event.thread_ts, botUserId);

      for (const msg of history) {
        if (msg.ts === event.ts) continue; // current message added below
        if (!msg.text?.trim()) continue;

        const role: "user" | "assistant" = msg.bot_id ? "assistant" : "user";
        messages.push({ role, content: msg.text });
      }
    }

    // Add the current message
    messages.push({ role: "user", content: event.text.trim() });

    // Run through the agent with Slack-appropriate limits (10 iterations, 3-min timeout)
    const response = await runChatBackground(memberName, messages, null, {
      maxIterations: 10,
      timeoutMs: 3 * 60 * 1000,
    });

    // Reply in thread
    await postMessage(token, OFFICE_SOLDIERS_ID, response, threadTs);

    // Swap 👀 for ✅
    await removeReaction(token, OFFICE_SOLDIERS_ID, event.ts, "eyes");
    await addReaction(token, OFFICE_SOLDIERS_ID, event.ts, "white_check_mark");
  } catch (err) {
    console.error("[slack-office-agent] Error:", err);
    await postMessage(token, OFFICE_SOLDIERS_ID, "Something went wrong — check Railway logs.", threadTs);
    await removeReaction(token, OFFICE_SOLDIERS_ID, event.ts, "eyes");
    await addReaction(token, OFFICE_SOLDIERS_ID, event.ts, "x");
  }
}

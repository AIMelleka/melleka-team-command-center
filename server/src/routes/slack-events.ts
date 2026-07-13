/**
 * Slack Events API endpoint
 *
 * Handles:
 * - URL verification challenge (Slack sends this when you first configure the endpoint)
 * - message.channels / message.groups events → dispatched to slack-client-monitor
 *
 * IMPORTANT: This route uses express.raw() — it must be mounted BEFORE express.json()
 * so that the raw body is available for signature verification.
 */

import { Router } from "express";
import crypto from "crypto";
import { supabase } from "../services/supabase.js";
import { handleSlackMessage } from "../services/slack-client-monitor.js";
import { handleOfficeSoldiersMessage } from "../services/slack-office-agent.js";

const router = Router();

// ─── Fetch signing secret from DB (cached) ───────────────────────────────────
let _signingSecret: string | null = null;

async function getSigningSecret(): Promise<string | null> {
  if (_signingSecret) return _signingSecret;
  const { data } = await supabase
    .from("team_secrets")
    .select("value")
    .eq("key", "SLACK_SIGNING_SECRET")
    .maybeSingle();
  if (data?.value) _signingSecret = data.value;
  return _signingSecret;
}

// ─── Verify Slack request signature ──────────────────────────────────────────
async function verifySlackSignature(
  rawBody: Buffer,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const secret = await getSigningSecret();
  if (!secret) {
    console.warn("[slack-events] SLACK_SIGNING_SECRET not set — skipping signature verification");
    return true; // Allow through but log the warning
  }

  // Reject requests older than 5 minutes (replay attack protection)
  const tsSeconds = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - tsSeconds) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${rawBody.toString()}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", secret)
      .update(sigBasestring)
      .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

// ─── POST /api/slack/events ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const rawBody = req.body as Buffer;
  const timestamp = req.headers["x-slack-request-timestamp"] as string;
  const signature = req.headers["x-slack-signature"] as string;

  // Parse body
  let body: any;
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    res.status(400).send("Bad Request");
    return;
  }

  // Handle URL verification challenge first — before signature check.
  // Slack sends this during initial Events API setup to confirm the endpoint is live.
  if (body.type === "url_verification") {
    res.json({ challenge: body.challenge });
    return;
  }

  // Verify signature for all other requests (skip if headers missing — local dev)
  if (timestamp && signature) {
    const valid = await verifySlackSignature(rawBody, timestamp, signature);
    if (!valid) {
      res.status(401).send("Unauthorized");
      return;
    }
  }

  // Acknowledge Slack immediately (must respond within 3 seconds)
  res.sendStatus(200);

  // Process the event asynchronously after responding
  const event = body.event;
  if (!event) return;

  if (event.type === "message") {
    const msgEvent = {
      channel: event.channel,
      user: event.user,
      bot_id: event.bot_id,
      text: event.text,
      ts: event.ts,
      thread_ts: event.thread_ts,
      subtype: event.subtype,
    };

    if (event.channel === "C09176FSH1U") {
      // #office_soldiers — route to the super agent (ONLY this channel gets AI responses)
      handleOfficeSoldiersMessage(msgEvent).catch((err) => {
        console.error("[slack-events] handleOfficeSoldiersMessage error:", err);
      });
    } else {
      // All other channels — client response monitor only, bot stays silent
      handleSlackMessage(msgEvent).catch((err) => {
        console.error("[slack-events] handleSlackMessage error:", err);
      });
    }
  }
});

export default router;

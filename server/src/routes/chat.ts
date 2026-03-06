import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { streamChat } from "../services/claude.js";
import { supabase } from "../services/supabase.js";
import {
  registerJob, pushEvent, completeJob, failJob,
  getJob, getActiveJobs, addListener, isConversationRunning,
} from "../services/activeJobs.js";
import fs from "fs/promises";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

let activeSseConnections = 0;
export function getActiveSseConnections(): number { return activeSseConnections; }

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

router.post("/", requireAuth, upload.array("files"), async (req: AuthRequest, res) => {
  const memberName = req.memberName!;
  const { message, conversationId } = req.body as {
    message: string;
    conversationId?: string;
  };

  const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
  const hasText = message?.trim();
  const hasFiles = uploadedFiles.length > 0;

  if (!hasText && !hasFiles) {
    res.status(400).json({ error: "Message or files required." });
    return;
  }

  activeSseConnections++;

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering (nginx/Railway)
  res.flushHeaders();

  // Send keepalive pings every 5s to prevent Railway/proxy timeout
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { /* connection gone */ }
  }, 5000);

  // Track if client disconnected so we still save the response
  let clientDisconnected = false;
  res.on("close", () => { clientDisconnected = true; });

  let convId = conversationId;

  try {
    // Process uploaded files — split into images (vision) vs non-images (file paths)
    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    const fileAnnotations: string[] = [];

    for (const file of uploadedFiles) {
      if (IMAGE_TYPES.has(file.mimetype)) {
        const data = await fs.readFile(file.path);
        imageBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: data.toString("base64"),
          },
        });
        fileAnnotations.push(`[Attached image: ${file.originalname} → ${file.path}]`);
      } else {
        const sizeKB = (file.size / 1024).toFixed(1);
        fileAnnotations.push(
          `[Attached file: ${file.originalname} (${file.mimetype}, ${sizeKB}KB) → saved at: ${file.path}]`
        );
      }
    }

    // Build the message text that gets saved to DB (includes file annotations)
    const savedMessage = [message || "", ...fileAnnotations].filter(Boolean).join("\n");
    const title = (message || uploadedFiles[0]?.originalname || "Attachment").slice(0, 60);

    // Create or load conversation
    if (!convId) {
      const { data } = await supabase
        .from("team_conversations")
        .insert({
          member_name: memberName.toLowerCase(),
          title,
        })
        .select("id")
        .single();
      if (!data?.id) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Database tables not set up yet. Please run supabase-schema.sql in your Supabase dashboard first." })}\n\n`);
        res.end();
        return;
      }
      convId = data.id;
    } else {
      await supabase
        .from("team_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId)
        .eq("member_name", memberName.toLowerCase());
    }

    // Save user message (with file annotations embedded)
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "user",
      content: savedMessage,
    });

    // Load conversation history (last 40 messages) with timestamps
    const { data: history } = await supabase
      .from("team_messages")
      .select("role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => {
      const ts = new Date(m.created_at).toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "short",
        timeStyle: "short",
      });
      return {
        role: m.role as "user" | "assistant",
        content: `[${ts}] ${m.content}`,
      };
    });

    // For the current message: if there are images, replace the last user message
    // content with multi-block content (image blocks + text) for Claude vision
    if (imageBlocks.length > 0 && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        const contentBlocks: Anthropic.ContentBlockParam[] = [
          ...imageBlocks,
          { type: "text", text: lastMsg.content as string },
        ];
        lastMsg.content = contentBlocks;
      }
    }

    // Register active job so clients can reconnect
    registerJob(convId!, memberName);

    // Stream response from Claude (events also buffered for reconnect)
    const fullResponse = await streamChat(memberName, messages, res, (event) => {
      pushEvent(convId!, event as any);
    });

    // Always save assistant response (even if client disconnected mid-stream)
    if (fullResponse.trim()) {
      await supabase.from("team_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: fullResponse,
      });
    }

    completeJob(convId!, fullResponse);

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ type: "done", conversationId: convId })}\n\n`);
    }
  } catch (err) {
    console.error(`Chat error for ${memberName}:`, err);
    if (convId) failJob(convId, String(err));
    // Save partial response so conversation context isn't lost on reload
    if (convId) {
      try {
        await supabase.from("team_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: `[Response interrupted by error: ${String(err)}]\n\nPlease try again — I was working on your request when an error occurred.`,
        });
      } catch { /* best effort */ }
    }
    if (!clientDisconnected) {
      try {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: "An internal error occurred. Please try again." })}\n\n`
        );
      } catch { /* response already gone */ }
    }
  } finally {
    activeSseConnections--;
    clearInterval(keepalive);
    if (!clientDisconnected) res.end();
  }
});

// ── Reconnect endpoints for persistent background chats ──

// Check if a conversation has an active agent job
router.get("/status/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  const job = getJob(req.params.conversationId as string);
  if (!job || job.memberName !== req.memberName!) {
    res.json({ active: false });
    return;
  }
  res.json({
    active: job.status === "running",
    status: job.status,
    startedAt: job.startedAt,
    eventCount: job.events.length,
  });
});

// SSE endpoint: replay buffered events then stream live
router.get("/reconnect/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  const convId = req.params.conversationId as string;
  const job = getJob(convId);

  if (!job || job.memberName !== req.memberName!) {
    res.status(404).json({ error: "No active job for this conversation" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Replay buffered events
  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // If already done, close immediately
  if (job.status !== "running") {
    res.write(`data: ${JSON.stringify({ type: "done", conversationId: convId })}\n\n`);
    res.end();
    return;
  }

  // Subscribe to live events
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { /* gone */ }
  }, 5000);

  const removeListener = addListener(convId, (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      removeListener();
      clearInterval(keepalive);
    }
  });

  res.on("close", () => {
    removeListener();
    clearInterval(keepalive);
  });
});

// List conversation IDs with active agent loops for this member
router.get("/active-jobs", requireAuth, async (req: AuthRequest, res) => {
  const memberName = req.memberName!;
  const active: string[] = [];
  for (const [convId, job] of getActiveJobs()) {
    if (job.memberName === memberName && job.status === "running") {
      active.push(convId);
    }
  }
  res.json({ activeConversationIds: active });
});

export default router;

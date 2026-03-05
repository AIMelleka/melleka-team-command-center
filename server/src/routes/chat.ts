import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { streamChat } from "../services/claude.js";
import { supabase } from "../services/supabase.js";
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
  // mentionedClients may come as JSON string (FormData) or array (JSON body)
  let mentionedClients: string[] | undefined;
  const rawMentions = req.body.mentionedClients;
  if (typeof rawMentions === "string") {
    try { mentionedClients = JSON.parse(rawMentions); } catch { /* ignore */ }
  } else if (Array.isArray(rawMentions)) {
    mentionedClients = rawMentions;
  }
  console.log(`[chat] ${memberName} | mentions raw=${JSON.stringify(rawMentions)} parsed=${JSON.stringify(mentionedClients)}`);

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

  // Send keepalive pings every 15s to prevent Railway/proxy timeout
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { /* connection gone */ }
  }, 15000);

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
        .eq("id", convId);
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

    // If clients were @mentioned, pre-fetch their data and inject into the message context
    if (mentionedClients && mentionedClients.length > 0) {
      const { data: mcData } = await supabase
        .from("managed_clients")
        .select("client_name, domain, ga4_property_id, industry, tier, primary_conversion_goal")
        .in("client_name", mentionedClients);

      const { data: mappings } = await supabase
        .from("client_account_mappings")
        .select("client_name, platform, account_id, account_name")
        .in("client_name", mentionedClients);

      console.log(`[chat] @mention lookup: clients found=${mcData?.length ?? 0}, mappings found=${mappings?.length ?? 0}`);
      if (mcData && mcData.length > 0) {
        const contextLines: string[] = ["[Client Context — auto-resolved from @mentions]"];
        for (const mc of mcData) {
          const accts = (mappings || []).filter(m => m.client_name === mc.client_name);
          const byPlatform: Record<string, string[]> = {};
          for (const a of accts) {
            if (!byPlatform[a.platform]) byPlatform[a.platform] = [];
            byPlatform[a.platform].push(`${a.account_id}${a.account_name ? ` (${a.account_name})` : ""}`);
          }
          const parts = [`@${mc.client_name}: domain=${mc.domain || "N/A"}`];
          if (mc.ga4_property_id) parts.push(`ga4=${mc.ga4_property_id}`);
          if (mc.industry) parts.push(`industry=${mc.industry}`);
          if (mc.tier) parts.push(`tier=${mc.tier}`);
          if (mc.primary_conversion_goal) parts.push(`goal=${mc.primary_conversion_goal}`);
          for (const [platform, ids] of Object.entries(byPlatform)) {
            parts.push(`${platform}_accounts=[${ids.join(", ")}]`);
          }
          contextLines.push(parts.join(", "));
        }
        contextLines.push("");

        // Prepend client context to the last user message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          const prefix = contextLines.join("\n");
          if (typeof lastMsg.content === "string") {
            lastMsg.content = prefix + lastMsg.content;
          }
          console.log(`[chat] Injected @mention context:\n${prefix}`);
        }
      }
    }

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

    // Stream response from Claude
    console.log(`[chat] ${memberName} | starting streamChat with ${messages.length} messages`);
    const fullResponse = await streamChat(memberName, messages, res);
    console.log(`[chat] ${memberName} | streamChat done, response length=${fullResponse.length}, disconnected=${clientDisconnected}`);

    // Always save assistant response (even if client disconnected mid-stream)
    if (fullResponse.trim()) {
      await supabase.from("team_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: fullResponse,
      });
    }

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ type: "done", conversationId: convId })}\n\n`);
    }
  } catch (err) {
    console.error(`Chat error for ${memberName}:`, err);
    // Save partial response so conversation context isn't lost on reload
    if (convId) {
      try {
        // fullResponse may not be available here since it's scoped to streamChat,
        // but the error message itself provides context for the next conversation load
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
          `data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`
        );
      } catch { /* response already gone */ }
    }
  } finally {
    activeSseConnections--;
    clearInterval(keepalive);
    if (!clientDisconnected) res.end();
  }
});

export default router;

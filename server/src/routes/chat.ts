import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { streamChat } from "../services/claude.js";
import { supabase } from "../services/supabase.js";
import fs from "fs/promises";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

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

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

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
    const fullResponse = await streamChat(memberName, messages, res);

    // Save assistant response
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ type: "done", conversationId: convId })}\n\n`);
  } catch (err) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`
    );
  } finally {
    res.end();
  }
});

export default router;

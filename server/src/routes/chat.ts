import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { streamChat } from "../services/claude.js";
import { supabase } from "../services/supabase.js";
import type Anthropic from "@anthropic-ai/sdk";

const router = Router();

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const memberName = req.memberName!;
  const { message, conversationId } = req.body as {
    message: string;
    conversationId?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let convId = conversationId;

  try {
    // Create or load conversation
    if (!convId) {
      const { data } = await supabase
        .from("team_conversations")
        .insert({
          member_name: memberName.toLowerCase(),
          title: message.slice(0, 60),
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
      // Update timestamp
      await supabase
        .from("team_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    // Save user message
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Load conversation history (last 40 messages)
    const { data: history } = await supabase
      .from("team_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

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

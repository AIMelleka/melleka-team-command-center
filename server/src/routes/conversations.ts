import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// List conversations for the logged-in member
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase
    .from("team_conversations")
    .select("id, title, created_at, updated_at, is_cron, has_unread")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("updated_at", { ascending: false })
    .limit(50);
  res.json(data ?? []);
});

// Get messages for a conversation
router.get("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  // Verify ownership
  const { data: conv } = await supabase
    .from("team_conversations")
    .select("id, member_name, is_cron")
    .eq("id", req.params.id)
    .single();

  if (!conv || conv.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  const { data: messages } = await supabase
    .from("team_messages")
    .select("id, role, content, tool_name, created_at")
    .eq("conversation_id", req.params.id)
    .order("created_at", { ascending: true });

  // Clear unread when the conversation is opened
  if (conv.is_cron) {
    await supabase
      .from("team_conversations")
      .update({ has_unread: false })
      .eq("id", req.params.id);
  }

  res.json(messages ?? []);
});

// Delete a conversation
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { data: conv } = await supabase
    .from("team_conversations")
    .select("member_name")
    .eq("id", req.params.id)
    .single();

  if (!conv || conv.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  await supabase.from("team_conversations").delete().eq("id", req.params.id);
  res.json({ ok: true });
});

export default router;

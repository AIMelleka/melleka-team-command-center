import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// List conversations for the logged-in member
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase
    .from("team_conversations")
    .select("id, title, created_at, updated_at, is_cron, has_unread, project_id, folder_id")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("updated_at", { ascending: false })
    .limit(200);
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

  // Cron job conversations are viewable by any team member
  if (!conv || (!conv.is_cron && conv.member_name !== req.memberName!.toLowerCase())) {
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

// Update a conversation (rename, move to folder)
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { title, folder_id } = req.body;

  if (!title && folder_id === undefined) {
    res.status(400).json({ error: "Title or folder_id is required." });
    return;
  }

  const { data: conv } = await supabase
    .from("team_conversations")
    .select("member_name")
    .eq("id", req.params.id)
    .single();

  if (!conv || conv.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof title === "string") updates.title = title.trim();
  if (folder_id !== undefined) updates.folder_id = folder_id; // null to unfile

  await supabase
    .from("team_conversations")
    .update(updates)
    .eq("id", req.params.id);

  res.json({ ok: true });
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

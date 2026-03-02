import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// Return unread cron conversations for the logged-in member
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase
    .from("team_conversations")
    .select("id, title, updated_at")
    .eq("member_name", req.memberName!.toLowerCase())
    .eq("is_cron", true)
    .eq("has_unread", true)
    .order("updated_at", { ascending: false });

  res.json({ count: data?.length ?? 0, conversations: data ?? [] });
});

export default router;

import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { cronReloadCallbacks } from "../services/tools.js";

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

  res.setHeader("Cache-Control", "private, max-age=30");
  res.json({ count: data?.length ?? 0, conversations: data ?? [] });
});

// List ALL cron jobs across the whole team (global view)
router.get("/cron-jobs", requireAuth, async (_req: AuthRequest, res) => {
  const { data } = await supabase
    .from("team_cron_jobs")
    .select("id, member_name, name, cron_expr, task, enabled, conversation_id, last_run")
    .order("name", { ascending: true });

  res.setHeader("Cache-Control", "private, max-age=60");
  res.json(data ?? []);
});

// DELETE a cron job by ID
router.delete("/cron-jobs/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    // Fetch the job first to get conversation_id
    const { data: job } = await supabase
      .from("team_cron_jobs")
      .select("id, conversation_id")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      res.status(404).json({ error: "Cron job not found" });
      return;
    }

    // Delete the cron job
    const { error } = await supabase
      .from("team_cron_jobs")
      .delete()
      .eq("id", id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Clean up associated conversation if it exists
    if (job.conversation_id) {
      await supabase
        .from("team_conversations")
        .delete()
        .eq("id", job.conversation_id);
    }

    // Reload the scheduler so it stops running the deleted job
    for (const cb of cronReloadCallbacks) cb();

    console.log(`[cron-jobs] Deleted job ${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[cron-jobs] Delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

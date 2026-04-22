import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { cronReloadCallbacks } from "../services/tools.js";

const router = Router();

// ── GET /api/cron-jobs — list all cron jobs ─────────────────────────────────
router.get("/", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from("team_cron_jobs")
      .select("id, member_name, name, cron_expr, task, enabled, conversation_id, last_run")
      .order("name", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  } catch (err: any) {
    console.error("[cron-jobs] list error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/cron-jobs — create a new cron job ────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, cron_expr, task } = req.body;
    if (!name || !cron_expr || !task) {
      res.status(400).json({ error: "name, cron_expr, and task are required" });
      return;
    }

    const memberName = req.memberName!.toLowerCase();

    const { data, error } = await supabase
      .from("team_cron_jobs")
      .upsert(
        { member_name: memberName, name, cron_expr, task, enabled: true },
        { onConflict: "member_name,name" }
      )
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    cronReloadCallbacks.forEach((cb) => cb());
    console.log(`[cron-jobs] Created job "${name}" for ${memberName}`);
    res.status(201).json(data);
  } catch (err: any) {
    console.error("[cron-jobs] create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/cron-jobs/:id — update a cron job ───────────────────────────
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from("team_cron_jobs")
      .select("id, member_name")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: "Cron job not found" });
      return;
    }

    // Build update payload — only include provided fields
    const updates: Record<string, any> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.cron_expr !== undefined) updates.cron_expr = req.body.cron_expr;
    if (req.body.task !== undefined) updates.task = req.body.task;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await supabase
      .from("team_cron_jobs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    cronReloadCallbacks.forEach((cb) => cb());
    console.log(`[cron-jobs] Updated job ${id}`);
    res.json(data);
  } catch (err: any) {
    console.error("[cron-jobs] update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/cron-jobs/:id — delete a cron job ──────────────────────────
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Fetch job and get conversation_id for cleanup
    const { data: job } = await supabase
      .from("team_cron_jobs")
      .select("id, member_name, conversation_id")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      res.status(404).json({ error: "Cron job not found" });
      return;
    }

    const { error } = await supabase
      .from("team_cron_jobs")
      .delete()
      .eq("id", id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Clean up associated conversation
    if (job.conversation_id) {
      await supabase
        .from("team_messages")
        .delete()
        .eq("conversation_id", job.conversation_id);
      await supabase
        .from("team_conversations")
        .delete()
        .eq("id", job.conversation_id);
    }

    cronReloadCallbacks.forEach((cb) => cb());
    console.log(`[cron-jobs] Deleted job ${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[cron-jobs] delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

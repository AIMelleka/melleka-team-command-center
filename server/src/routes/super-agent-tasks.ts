import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// GET /api/super-agent-tasks/stats — dashboard summary counts
router.get("/stats", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("super_agent_tasks")
    .select("id, status, completed_at");
  if (error) { res.status(500).json({ error: error.message }); return; }

  const tasks = data ?? [];
  const today = new Date().toISOString().split("T")[0];
  res.json({
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "working_on_it").length,
    completedToday: tasks.filter((t) => t.status === "completed" && t.completed_at?.startsWith(today)).length,
    errors: tasks.filter((t) => t.status === "error").length,
  });
});

// GET /api/super-agent-tasks — list all tasks (shared, no member filtering)
router.get("/", requireAuth, async (req, res) => {
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const client = req.query.client as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 200);

  let query = supabase
    .from("super_agent_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (client) query = query.ilike("client_name", `%${client}%`);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// GET /api/super-agent-tasks/:id — single task detail
router.get("/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("super_agent_tasks")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (error) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(data);
});

export default router;

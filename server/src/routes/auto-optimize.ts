import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// GET /api/auto-optimize — list all client auto-optimize settings
router.get("/", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("ppc_client_settings")
    .select("client_name, auto_mode_enabled, auto_mode_platform");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// POST /api/auto-optimize/toggle — toggle a platform for a client
router.post("/toggle", requireAuth, async (req, res) => {
  const { client_name, auto_mode_enabled, auto_mode_platform } = req.body;

  if (!client_name) {
    res.status(400).json({ error: "client_name is required" });
    return;
  }

  try {
    // Check if row exists
    const { data: existing } = await supabase
      .from("ppc_client_settings")
      .select("id")
      .eq("client_name", client_name)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("ppc_client_settings")
        .update({ auto_mode_enabled, auto_mode_platform })
        .eq("client_name", client_name)
        .select()
        .single();
    } else {
      result = await supabase
        .from("ppc_client_settings")
        .insert({ client_name, auto_mode_enabled, auto_mode_platform })
        .select()
        .single();
    }

    if (result.error) {
      console.error("[auto-optimize] DB error:", result.error);
      res.status(500).json({ error: result.error.message });
      return;
    }

    console.log(`[auto-optimize] ${client_name}: enabled=${auto_mode_enabled}, platform=${auto_mode_platform}`);
    res.json(result.data);
  } catch (err: any) {
    console.error("[auto-optimize] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

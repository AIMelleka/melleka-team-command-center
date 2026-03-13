import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data } = await supabase
      .from("user_preferences")
      .select("voice_id")
      .eq("member_name", req.memberName!)
      .single();

    res.json({ voice_id: data?.voice_id || DEFAULT_VOICE_ID });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load preferences";
    res.status(500).json({ error: message });
  }
});

router.patch("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { voice_id } = req.body as { voice_id?: string };

    if (!voice_id || typeof voice_id !== "string") {
      res.status(400).json({ error: "voice_id is required" });
      return;
    }

    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { member_name: req.memberName!, voice_id },
        { onConflict: "member_name" }
      );

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true, voice_id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save preferences";
    res.status(500).json({ error: message });
  }
});

export default router;

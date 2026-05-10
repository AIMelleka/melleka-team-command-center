import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const DEFAULT_MODEL_ID = "claude-opus-4-6";
const ALLOWED_MODELS = new Set([
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data } = await supabase
      .from("user_preferences")
      .select("voice_id, model_id")
      .eq("member_name", req.memberName!)
      .single();

    res.json({
      voice_id: data?.voice_id || DEFAULT_VOICE_ID,
      model_id: data?.model_id || DEFAULT_MODEL_ID,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load preferences";
    res.status(500).json({ error: message });
  }
});

router.patch("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { voice_id, model_id } = req.body as { voice_id?: string; model_id?: string };

    if (!voice_id && !model_id) {
      res.status(400).json({ error: "voice_id or model_id is required" });
      return;
    }

    if (model_id && !ALLOWED_MODELS.has(model_id)) {
      res.status(400).json({ error: `Invalid model_id. Allowed: ${[...ALLOWED_MODELS].join(", ")}` });
      return;
    }

    const updates: Record<string, string> = {};
    if (voice_id && typeof voice_id === "string") updates.voice_id = voice_id;
    if (model_id) updates.model_id = model_id;

    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { member_name: req.memberName!, ...updates },
        { onConflict: "member_name" }
      );

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true, ...updates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save preferences";
    res.status(500).json({ error: message });
  }
});

export default router;

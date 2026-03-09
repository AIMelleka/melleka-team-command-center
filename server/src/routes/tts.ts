import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getSecret } from "../services/secrets.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { text, voice_id, model } = req.body as {
      text: string;
      voice_id?: string;
      model?: string;
    };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const apiKey = await getSecret("ELEVENLABS_API_KEY");
    if (!apiKey) {
      res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
      return;
    }

    const voiceId = voice_id || "EXAVITQu4vr4xnSDxMaL"; // Sarah
    const ttsModel = model || "eleven_flash_v2_5"; // fastest for conversation

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: ttsModel,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
          signal: controller.signal,
        }
      );

      if (!upstream.ok) {
        const errText = await upstream.text();
        res.status(upstream.status).json({ error: errText.slice(0, 500) });
        return;
      }

      const audioBuffer = await upstream.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Length", audioBuffer.byteLength.toString());
      res.end(Buffer.from(audioBuffer));
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "TTS failed";
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

export default router;

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getSecret } from "../services/secrets.js";
import multer from "multer";

const router = Router();
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post("/", requireAuth, memUpload.single("audio"), async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer.length) {
      res.status(400).json({ error: "audio file is required" });
      return;
    }

    const apiKey = await getSecret("OPENAI_API_KEY");
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY not configured" });
      return;
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([file.buffer as unknown as ArrayBuffer], { type: file.mimetype }),
      file.originalname || "audio.webm"
    );
    form.append("model", "whisper-1");
    form.append("language", "en");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const upstream = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: controller.signal,
        }
      );

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error("[STT] Whisper API error:", upstream.status, errText);
        res.status(upstream.status).json({ error: errText.slice(0, 500) });
        return;
      }

      const result = (await upstream.json()) as { text?: string };
      res.json({ text: (result.text || "").trim() });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "STT failed";
    console.error("[STT] Error:", message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

export default router;

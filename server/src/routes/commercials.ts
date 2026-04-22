import { Router } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { upload } from "../middleware/upload.js";

const router = Router();

const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

// ── List all commercial projects for the member ──
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("commercial_projects")
    .select("id, name, status, config, voiceover_url, thumbnail_url, render_url, conversation_id, created_at, updated_at")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("updated_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── Get a single project with all scenes ──
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { data: project, error } = await supabase
    .from("commercial_projects")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { data: scenes } = await supabase
    .from("commercial_scenes")
    .select("*")
    .eq("project_id", req.params.id)
    .order("scene_order", { ascending: true });

  res.json({ ...project, scenes: scenes ?? [] });
});

// ── Create a new project ──
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { name, config } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const defaultConfig = {
    fps: 30,
    width: 1080,
    height: 1920,
    theme: { primary: "#6366f1", accent: "#d97706", background: "#ffffff" },
    ...(config || {}),
  };

  const { data, error } = await supabase
    .from("commercial_projects")
    .insert({
      member_name: req.memberName!.toLowerCase(),
      name: name.trim(),
      config: defaultConfig,
    })
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

// ── Update a project ──
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const updates: any = { updated_at: new Date().toISOString() };
  if (req.body.name) updates.name = req.body.name;
  if (req.body.config) updates.config = req.body.config;
  if (req.body.status) updates.status = req.body.status;

  const { data, error } = await supabase
    .from("commercial_projects")
    .update(updates)
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// ── Delete a project ──
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { error } = await supabase
    .from("commercial_projects")
    .delete()
    .eq("id", req.params.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── Add a scene ──
router.post("/:id/scenes", requireAuth, async (req: AuthRequest, res) => {
  const projectId = req.params.id;
  const { scene_type, props, duration_frames = 150, scene_order } = req.body;

  if (!scene_type || !props) {
    res.status(400).json({ error: "scene_type and props are required" });
    return;
  }

  let order = scene_order;
  if (order === undefined) {
    const { data: existing } = await supabase
      .from("commercial_scenes")
      .select("scene_order")
      .eq("project_id", projectId)
      .order("scene_order", { ascending: false })
      .limit(1);
    order = existing && existing.length > 0 ? existing[0].scene_order + 1 : 0;
  }

  const { data, error } = await supabase
    .from("commercial_scenes")
    .insert({
      project_id: projectId,
      scene_type,
      props,
      duration_frames,
      scene_order: order,
    })
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("commercial_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  res.status(201).json(data);
});

// ── Update a scene ──
router.patch("/:id/scenes/:sceneId", requireAuth, async (req: AuthRequest, res) => {
  const { id: projectId, sceneId } = req.params;
  const updates: any = { updated_at: new Date().toISOString() };

  if (req.body.scene_type) updates.scene_type = req.body.scene_type;
  if (req.body.props) updates.props = req.body.props;
  if (req.body.duration_frames) updates.duration_frames = req.body.duration_frames;
  if (req.body.fade_in !== undefined) updates.fade_in = req.body.fade_in;
  if (req.body.fade_out !== undefined) updates.fade_out = req.body.fade_out;
  if (req.body.scene_order !== undefined) updates.scene_order = req.body.scene_order;

  const { data, error } = await supabase
    .from("commercial_scenes")
    .update(updates)
    .eq("id", sceneId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("commercial_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  res.json(data);
});

// ── Delete a scene ──
router.delete("/:id/scenes/:sceneId", requireAuth, async (req: AuthRequest, res) => {
  const { id: projectId, sceneId } = req.params;

  const { error } = await supabase
    .from("commercial_scenes")
    .delete()
    .eq("id", sceneId)
    .eq("project_id", projectId);

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("commercial_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  res.json({ ok: true });
});

// ── Trigger render (queues a render job) ──
router.post("/:id/render", requireAuth, async (req: AuthRequest, res) => {
  const projectId = req.params.id;

  // Check project exists and has scenes
  const { data: scenes } = await supabase
    .from("commercial_scenes")
    .select("id")
    .eq("project_id", projectId);

  if (!scenes || scenes.length === 0) {
    res.status(400).json({ error: "Project has no scenes to render" });
    return;
  }

  // Create render job
  const { data: render, error } = await supabase
    .from("commercial_renders")
    .insert({
      project_id: projectId,
      status: "queued",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Update project status
  await supabase.from("commercial_projects")
    .update({ status: "rendering", updated_at: new Date().toISOString() })
    .eq("id", projectId);

  // TODO: Spawn background render process using @remotion/renderer
  // For now, the render job is queued and will be picked up by a worker
  // The actual rendering happens in a separate process to not block the API

  res.status(201).json(render);
});

// ── Get render status ──
router.get("/renders/:renderId", requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("commercial_renders")
    .select("*")
    .eq("id", req.params.renderId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Render not found" });
    return;
  }

  res.json(data);
});

// ── Upload a video clip ──
router.post("/:id/video-upload", requireAuth, upload.single("video"), async (req: AuthRequest, res) => {
  const projectId = req.params.id;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  if (!ALLOWED_VIDEO_MIMES.has(file.mimetype)) {
    await fs.unlink(file.path).catch(() => {});
    res.status(400).json({ error: "Invalid file type. Allowed: mp4, webm, mov" });
    return;
  }

  try {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const storagePath = `commercials/${projectId}/clips/${randomUUID()}${ext}`;
    const fileBuffer = await fs.readFile(file.path);

    const { error: uploadErr } = await supabase.storage
      .from("commercial-assets")
      .upload(storagePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    // Clean up temp file
    await fs.unlink(file.path).catch(() => {});

    if (uploadErr) {
      res.status(500).json({ error: `Upload failed: ${uploadErr.message}` });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("commercial-assets")
      .getPublicUrl(storagePath);

    res.json({ video_url: urlData.publicUrl, storage_path: storagePath });
  } catch (err: any) {
    await fs.unlink(file.path).catch(() => {});
    console.error("[commercials] Video upload failed:", err.message);
    res.status(500).json({ error: "Video upload failed" });
  }
});

// ── Generate voiceover ──
router.post("/:id/voiceover", requireAuth, async (req: AuthRequest, res) => {
  const projectId = req.params.id;

  // Fetch scenes to build voiceover script
  const { data: scenes } = await supabase
    .from("commercial_scenes")
    .select("scene_type, props, scene_order")
    .eq("project_id", projectId)
    .order("scene_order", { ascending: true });

  if (!scenes || scenes.length === 0) {
    res.status(400).json({ error: "No scenes to generate voiceover from" });
    return;
  }

  // Build script from scene props (extract key text fields)
  const scriptParts: string[] = [];
  for (const scene of scenes) {
    const p = scene.props as any;
    if (p.tagline) scriptParts.push(p.tagline + (p.taglineHighlight ? " " + p.taglineHighlight : ""));
    if (p.title) scriptParts.push(p.title);
    if (p.subtitle) scriptParts.push(p.subtitle);
    if (p.promptText) scriptParts.push(p.promptText);
    if (p.headline) scriptParts.push(p.headline);
    if (p.bottomTagline) scriptParts.push(p.bottomTagline);
    if (p.bottomBadge) scriptParts.push(p.bottomBadge);
    if (p.buttonText) scriptParts.push(p.buttonText);
    if (p.confidenceText) scriptParts.push(p.confidenceText);
  }

  const script = scriptParts.filter(Boolean).join(". ");
  if (!script) {
    res.status(400).json({ error: "Could not extract voiceover text from scenes" });
    return;
  }

  try {
    // Call ElevenLabs TTS
    const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_KEY) {
      res.status(500).json({ error: "ElevenLabs API key not configured" });
      return;
    }

    const voiceId = "TX3LPaxmHKxFdv7VOQHJ"; // Liam
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      res.status(500).json({ error: `TTS failed: ${err}` });
      return;
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    const storagePath = `commercials/${projectId}/voiceover.mp3`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("commercial-assets")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadErr) {
      res.status(500).json({ error: `Upload failed: ${uploadErr.message}` });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("commercial-assets")
      .getPublicUrl(storagePath);

    const voiceoverUrl = urlData.publicUrl;

    // Update project
    await supabase.from("commercial_projects")
      .update({ voiceover_url: voiceoverUrl, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    res.json({ voiceover_url: voiceoverUrl });
  } catch (err: any) {
    console.error("[commercials] Voiceover generation failed:", err.message);
    res.status(500).json({ error: "Voiceover generation failed" });
  }
});

export default router;

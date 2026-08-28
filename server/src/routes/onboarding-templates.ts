import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

const STORAGE_BUCKET = "onboarding-templates";
const TEMPLATES_FILE = "templates.json";

interface SavedTemplate {
  id: string;
  name: string;
  prompt: string;
  savedAt: string;
}

let templates: SavedTemplate[] = [];
let loaded = false;

async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[onboarding-templates] Bucket create warning:", error.message);
  }
}

async function loadTemplates(): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(TEMPLATES_FILE);
    if (error || !data) return;
    const parsed: SavedTemplate[] = JSON.parse(await data.text());
    if (Array.isArray(parsed)) {
      templates.splice(0, templates.length, ...parsed);
      console.log(`[onboarding-templates] Loaded ${templates.length} templates`);
    }
  } catch (err) {
    console.warn("[onboarding-templates] Could not load templates:", err);
  }
}

function persist(): void {
  const buf = Buffer.from(JSON.stringify(templates));
  supabase.storage
    .from(STORAGE_BUCKET)
    .upload(TEMPLATES_FILE, buf, { upsert: true, contentType: "application/json" })
    .then(() => {})
    .catch((err) => console.warn("[onboarding-templates] Persist warning:", err));
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  await ensureBucket();
  await loadTemplates();
}

// GET /api/onboarding-templates
router.get("/", requireAuth, async (_req, res) => {
  await ensureLoaded();
  res.json(templates);
});

// POST /api/onboarding-templates
router.post("/", requireAuth, async (req, res) => {
  await ensureLoaded();
  const { name, prompt } = req.body as { name?: string; prompt?: string };
  if (!name?.trim() || !prompt?.trim()) {
    res.status(400).json({ error: "name and prompt are required" });
    return;
  }
  const tpl: SavedTemplate = {
    id: crypto.randomUUID(),
    name: name.trim(),
    prompt: prompt.trim(),
    savedAt: new Date().toISOString(),
  };
  templates.push(tpl);
  persist();
  res.status(201).json(tpl);
});

// PUT /api/onboarding-templates/:id
router.put("/:id", requireAuth, async (req, res) => {
  await ensureLoaded();
  const idx = templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  const { name, prompt } = req.body as { name?: string; prompt?: string };
  templates[idx] = {
    ...templates[idx],
    ...(name !== undefined && { name: name.trim() }),
    ...(prompt !== undefined && { prompt: prompt.trim() }),
    savedAt: new Date().toISOString(),
  };
  persist();
  res.json(templates[idx]);
});

// DELETE /api/onboarding-templates/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await ensureLoaded();
  const idx = templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  templates.splice(idx, 1);
  persist();
  res.json({ ok: true });
});

export default router;

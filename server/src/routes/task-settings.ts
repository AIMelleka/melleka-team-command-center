import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { getNotionStatusGroups, FALLBACK_STATUS_GROUPS } from "../services/notion-status-groups.js";

const router = Router();

const BUCKET = "task-settings";
const FILE = "settings.json";

interface TaskSettings {
  doneStatuses: string[];
  updatedAt: string;
}

let cached: TaskSettings | null = null;
let loaded = false;

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[task-settings] Bucket warning:", error.message);
  }
}

async function load(): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(FILE);
    if (error || !data) return;
    const parsed = JSON.parse(await data.text()) as TaskSettings;
    if (parsed && Array.isArray(parsed.doneStatuses)) cached = parsed;
  } catch (err) {
    console.warn("[task-settings] Load warning:", err);
  }
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  await ensureBucket();
  await load();
}

function persist(settings: TaskSettings) {
  const buf = Buffer.from(JSON.stringify(settings));
  supabase.storage
    .from(BUCKET)
    .upload(FILE, buf, { upsert: true, contentType: "application/json" })
    .then(() => {})
    .catch((err) => console.warn("[task-settings] Persist warning:", err));
}

// GET /api/task-settings
router.get("/", requireAuth, async (_req, res) => {
  await ensureLoaded();
  // Always pull groups live from Notion (shared service caches for 10 min)
  const allStatusGroups = await getNotionStatusGroups();
  const doneStatuses = cached?.doneStatuses ?? (allStatusGroups["Complete"] ?? FALLBACK_STATUS_GROUPS.Complete);
  res.json({
    doneStatuses,
    updatedAt: cached?.updatedAt ?? new Date().toISOString(),
    allStatusGroups,
  });
});

// PUT /api/task-settings
router.put("/", requireAuth, async (req, res) => {
  await ensureLoaded();
  const { doneStatuses } = req.body as { doneStatuses?: string[] };
  if (!Array.isArray(doneStatuses)) {
    res.status(400).json({ error: "doneStatuses must be an array" });
    return;
  }
  const settings: TaskSettings = { doneStatuses, updatedAt: new Date().toISOString() };
  cached = settings;
  persist(settings);
  res.json(settings);
});

export default router;

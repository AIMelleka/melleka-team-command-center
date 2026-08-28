import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
const router = Router();

// Supabase auth client (may differ from data client)
const supabaseAuth = createClient(
  process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_AUTH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Storage ────────────────────────────────────────────────────────────────
const STORAGE_BUCKET = "task-bonus";
const PROFILES_FILE = "profiles.json";

export interface BonusProfile {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  notionManagerName: string;
  bonusEnabled: boolean;
  createdAt: string;
}

let profiles: BonusProfile[] = [];
let profilesLoaded = false;

async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[task-bonus] Bucket create warning:", error.message);
  }
}

async function loadProfiles(): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(PROFILES_FILE);
    if (error || !data) return;
    const text = await data.text();
    const parsed: BonusProfile[] = JSON.parse(text);
    if (Array.isArray(parsed)) {
      profiles.splice(0, profiles.length, ...parsed);
      console.log(`[task-bonus] Loaded ${profiles.length} profiles from storage`);
    }
  } catch (err) {
    console.warn("[task-bonus] Could not load profiles:", err);
  }
}

function persistProfiles(): void {
  const buf = Buffer.from(JSON.stringify(profiles));
  supabase.storage
    .from(STORAGE_BUCKET)
    .upload(PROFILES_FILE, buf, { upsert: true, contentType: "application/json" })
    .then(() => {})
    .catch((err) => console.warn("[task-bonus] Persist profiles warning:", err));
}

async function ensureProfilesLoaded(): Promise<void> {
  if (profilesLoaded) return;
  profilesLoaded = true;
  await ensureBucket();
  await loadProfiles();
}

// ── GET /api/task-bonus/my-profile ─────────────────────────────────────────
router.get("/my-profile", requireAuth, async (req: AuthRequest, res) => {
  await ensureProfilesLoaded();
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "User ID not available" });
    return;
  }
  const profile = profiles.find((p) => p.userId === userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

// ── GET /api/task-bonus/profiles ───────────────────────────────────────────
router.get("/profiles", requireAuth, async (_req, res) => {
  await ensureProfilesLoaded();
  res.json(profiles);
});

// ── POST /api/task-bonus/profiles ──────────────────────────────────────────
router.post("/profiles", requireAuth, async (req, res) => {
  await ensureProfilesLoaded();
  const { userId, email, displayName, notionManagerName, bonusEnabled } = req.body as Partial<BonusProfile>;
  if (!userId || !email || !displayName || !notionManagerName) {
    res.status(400).json({ error: "userId, email, displayName, notionManagerName are required" });
    return;
  }
  const newProfile: BonusProfile = {
    id: crypto.randomUUID(),
    userId,
    email,
    displayName,
    notionManagerName,
    bonusEnabled: bonusEnabled ?? true,
    createdAt: new Date().toISOString(),
  };
  profiles.push(newProfile);
  persistProfiles();
  res.status(201).json(newProfile);
});

// ── PUT /api/task-bonus/profiles/:id ───────────────────────────────────────
router.put("/profiles/:id", requireAuth, async (req, res) => {
  await ensureProfilesLoaded();
  const { id } = req.params;
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const { email, displayName, notionManagerName, bonusEnabled } = req.body as Partial<BonusProfile>;
  profiles[idx] = {
    ...profiles[idx],
    ...(email !== undefined && { email }),
    ...(displayName !== undefined && { displayName }),
    ...(notionManagerName !== undefined && { notionManagerName }),
    ...(bonusEnabled !== undefined && { bonusEnabled }),
  };
  persistProfiles();
  res.json(profiles[idx]);
});

// ── DELETE /api/task-bonus/profiles/:id ────────────────────────────────────
router.delete("/profiles/:id", requireAuth, async (req, res) => {
  await ensureProfilesLoaded();
  const { id } = req.params;
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  profiles.splice(idx, 1);
  persistProfiles();
  res.json({ ok: true });
});

// ── GET /api/task-bonus/users ───────────────────────────────────────────────
router.get("/users", requireAuth, async (_req, res) => {
  try {
    const { data, error } = await supabaseAuth.auth.admin.listUsers({ perPage: 200 });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const users = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
    }));
    res.json(users);
  } catch (err: any) {
    console.error("[task-bonus] List users error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

export default router;

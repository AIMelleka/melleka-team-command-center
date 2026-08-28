import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../services/supabase.js";

const router = Router();

// ── Score cache (in-memory) ───────────────────────────────────────────────
interface CacheEntry {
  points: number;
  reasoning: string;
  scoredAt: Date;
}
const scoreCache = new Map<string, CacheEntry>();

// ── Learning system ────────────────────────────────────────────────────────
// Manual score corrections are stored here and injected as few-shot examples
// into every future Claude scoring call so accuracy improves over time.
// Learnings are persisted to Supabase Storage so they survive server redeploys.
interface Learning {
  title: string;
  aiPoints: number;    // what AI originally scored (0 = no prior AI score)
  humanPoints: number; // what the team corrected it to
  learnedAt: string;   // ISO string (serialization-safe)
}
const learnings: Learning[] = [];
const MAX_LEARNINGS = 100;
let learningsLoaded = false;

const STORAGE_BUCKET = "task-weights";
const LEARNINGS_FILE  = "learnings.json";

// Create the storage bucket if it doesn't exist yet (idempotent)
async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
  // "already exists" error is expected and fine — ignore it
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[task-weights] Bucket create warning:", error.message);
  }
}

// Load persisted learnings from Supabase Storage
async function loadLearnings(): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(LEARNINGS_FILE);
    if (error || !data) return;
    const text = await data.text();
    const parsed: Learning[] = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      learnings.push(...parsed.slice(0, MAX_LEARNINGS));
      console.log(`[task-weights] Loaded ${learnings.length} learnings from storage`);
    }
  } catch (err) {
    console.warn("[task-weights] Could not load learnings:", err);
  }
}

// Persist current learnings array to Supabase Storage (fire & forget)
function persistLearnings(): void {
  const buf = Buffer.from(JSON.stringify(learnings.slice(0, MAX_LEARNINGS)));
  supabase.storage
    .from(STORAGE_BUCKET)
    .upload(LEARNINGS_FILE, buf, { upsert: true, contentType: "application/json" })
    .then(() => {})
    .catch((err) => console.warn("[task-weights] Persist learnings warning:", err));
}

// Initialize storage + load learnings on first use
async function ensureLearningsLoaded(): Promise<void> {
  if (learningsLoaded) return;
  learningsLoaded = true;
  await ensureBucket();
  await loadLearnings();
}

// ── Tier definitions ──────────────────────────────────────────────────────
const TIERS = [
  { points: 1, label: "Quick",       timeRange: "5–30 min",   description: "Simple, fast tasks with minimal effort",              examples: "Social posts, email replies, minor ad tweaks, status updates, quick edits" },
  { points: 2, label: "Short",       timeRange: "30–60 min",  description: "Moderate effort with a clear deliverable",            examples: "Simple reports, basic graphics, small copy edits, ad optimization tweaks" },
  { points: 3, label: "Medium",      timeRange: "1–1.5 hrs",  description: "Focused work requiring skill and attention",          examples: "Blog posts, email campaigns, full ad copy sets, SEO updates, analytics reports" },
  { points: 4, label: "Substantial", timeRange: "1.5–2 hrs",  description: "Complex work requiring significant time investment",  examples: "Landing pages, full campaign setup, video editing, comprehensive audits" },
  { points: 5, label: "Major",       timeRange: "2+ hrs",     description: "Large deliverables requiring deep, sustained work",   examples: "Website builds, full redesigns, complex multi-platform campaigns, major deliverables" },
];

const BASE_SCORE_PROMPT = `You score marketing agency tasks by estimated completion time. Use this rubric:
1 point  = 5–30 min:  Social posts, email replies, minor ad tweaks, status updates, quick edits
2 points = 30–60 min: Simple reports, basic graphics, small copy edits, ad optimization tweaks
3 points = 1–1.5 hrs: Blog posts, email campaigns, full ad copy sets, SEO updates, analytics reports
4 points = 1.5–2 hrs: Landing pages, full campaign setup, video editing, comprehensive audits
5 points = 2+ hrs:    Website builds, full redesigns, complex multi-platform campaigns, major deliverables`;

// Build the scoring prompt, injecting team corrections as few-shot examples
function buildScoringPrompt(): string {
  const corrections = learnings
    .filter((l) => l.aiPoints > 0 && l.aiPoints !== l.humanPoints)
    .slice(0, 25);

  const learningBlock = corrections.length > 0
    ? `\n\nLearn from these team corrections — the AI scored incorrectly, the team fixed it:\n` +
      corrections.map((l) => `- "${l.title}" → ${l.humanPoints} pts (AI gave ${l.aiPoints})`).join("\n") +
      `\n\nApply these patterns when scoring similar tasks.`
    : "";

  return (
    BASE_SCORE_PROMPT +
    learningBlock +
    `\n\nRespond ONLY with a valid JSON array, no markdown, no explanation:\n[{"id":"<task_id>","points":<1-5>,"reasoning":"<10 words max>"}]`
  );
}

// POST /api/task-weights/score
router.post("/score", requireAuth, async (req, res) => {
  await ensureLearningsLoaded();
  try {
    const { tasks } = req.body as { tasks: { id: string; title: string }[] };
    if (!Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({ error: "tasks array required" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    const scoreMap: Record<string, number> = {};
    for (const t of tasks) {
      const cached = scoreCache.get(t.id);
      if (cached) scoreMap[t.id] = cached.points;
    }

    const uncached = tasks.filter((t) => !scoreCache.has(t.id));
    if (uncached.length === 0) {
      res.json({ scores: scoreMap });
      return;
    }

    const claude = new Anthropic({ apiKey });
    const BATCH_SIZE = 50;
    const scoringPrompt = buildScoringPrompt();

    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      try {
        const response = await claude.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: scoringPrompt,
          messages: [{
            role: "user",
            content: `Score these tasks:\n${JSON.stringify(batch.map((t) => ({ id: t.id, title: t.title })))}`,
          }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error("[task-weights] No JSON array in response. Raw:", text.slice(0, 400));
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]) as { id: string; points: number; reasoning: string }[];
        for (const r of parsed) {
          if (r.points >= 1 && r.points <= 5) {
            scoreCache.set(r.id, { points: r.points, reasoning: r.reasoning || "", scoredAt: new Date() });
            scoreMap[r.id] = r.points;
          }
        }
      } catch (batchErr) {
        console.error("[task-weights] Batch error:", batchErr);
      }
    }

    res.json({ scores: scoreMap });
  } catch (err) {
    console.error("[task-weights] Score endpoint error:", err);
    res.status(500).json({ error: "Scoring failed" });
  }
});

// PATCH /api/task-weights/score/:taskId — manual override + learning
router.patch("/score/:taskId", requireAuth, async (req, res) => {
  await ensureLearningsLoaded();
  const { taskId } = req.params;
  const { points, title } = req.body as { points: number; title?: string };
  if (!points || points < 1 || points > 5) {
    res.status(400).json({ error: "points must be 1–5" });
    return;
  }

  const original = scoreCache.get(taskId);
  const aiPoints = original?.points ?? 0;

  let learned = false;
  if (title && aiPoints !== points) {
    const learning: Learning = {
      title,
      aiPoints,
      humanPoints: points,
      learnedAt: new Date().toISOString(),
    };
    learnings.unshift(learning);
    if (learnings.length > MAX_LEARNINGS) learnings.splice(MAX_LEARNINGS);
    persistLearnings(); // persist whole array to storage
    learned = true;
    console.log(`[task-weights] Learned: "${title}" ${aiPoints > 0 ? `(AI: ${aiPoints} → human: ${points})` : `(human set: ${points})`}`);
  }

  scoreCache.set(taskId, { points, reasoning: "manual override", scoredAt: new Date() });
  res.json({ ok: true, learned });
});

// GET /api/task-weights/cache-stats
router.get("/cache-stats", requireAuth, (_req, res) => {
  const entries = Array.from(scoreCache.values());
  const dates = entries.map((e) => e.scoredAt);
  res.json({
    total: scoreCache.size,
    oldest: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : null,
    newest: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null,
  });
});

// GET /api/task-weights/learnings-stats
router.get("/learnings-stats", requireAuth, async (_req, res) => {
  await ensureLearningsLoaded();
  const corrections = learnings.filter((l) => l.aiPoints > 0 && l.aiPoints !== l.humanPoints);
  res.json({
    total: learnings.length,
    corrections: corrections.length,
    newest: learnings[0]?.learnedAt ?? null,
  });
});

// DELETE /api/task-weights/cache
router.delete("/cache", requireAuth, (_req, res) => {
  const cleared = scoreCache.size;
  scoreCache.clear();
  res.json({ ok: true, cleared });
});

// DELETE /api/task-weights/learnings — reset all learnings
router.delete("/learnings", requireAuth, async (_req, res) => {
  const cleared = learnings.length;
  learnings.splice(0);
  // Delete the file from storage
  supabase.storage.from(STORAGE_BUCKET).remove([LEARNINGS_FILE]).catch(() => {});
  res.json({ ok: true, cleared });
});

// GET /api/task-weights/tiers
router.get("/tiers", requireAuth, (_req, res) => {
  res.json({ tiers: TIERS });
});

export default router;

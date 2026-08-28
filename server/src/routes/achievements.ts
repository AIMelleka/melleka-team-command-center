import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { getSecret } from "../services/secrets.js";

const router = Router();

const supabaseAuth = createClient(
  process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_AUTH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = "task-bonus";
const ACHIEVEMENTS_FILE = "achievements.json";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReviewEntry {
  id: string;
  employeeName: string;
  platform: "Yelp" | "Google" | "Other";
  note: string;
  addedBy: string;
  addedAt: string;
}

export interface PraiseEntry {
  id: string;
  channel: string;
  text: string;
  praiseKeywords: string[];
  ts: string;
  scannedAt: string;
}

export interface AchievementsData {
  reviews: ReviewEntry[];
  slackPraise: {
    [month: string]: {           // "2026-08"
      [employeeName: string]: PraiseEntry[];
    };
  };
}

// ── In-memory store ────────────────────────────────────────────────────────

let data: AchievementsData = { reviews: [], slackPraise: {} };
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const { data: file, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(ACHIEVEMENTS_FILE);
    if (error || !file) return;
    data = JSON.parse(await file.text());
  } catch {
    // start fresh
  }
}

function persist(): void {
  const buf = Buffer.from(JSON.stringify(data));
  supabase.storage
    .from(STORAGE_BUCKET)
    .upload(ACHIEVEMENTS_FILE, buf, { upsert: true, contentType: "application/json" })
    .catch((e) => console.warn("[achievements] persist warn:", e));
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function checkSuperAdmin(userId: string): Promise<boolean> {
  const { data: result } = await supabaseAuth.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  return result === true;
}

const PRAISE_KEYWORDS = [
  "great work", "amazing work", "excellent work", "fantastic work",
  "great job", "amazing job", "excellent job", "fantastic job",
  "well done", "nicely done", "beautifully done", "nice work",
  "outstanding", "brilliant", "superb", "incredible", "impressive",
  "nailed it", "crushed it", "killed it", "knocked it out",
  "so impressed", "very impressed", "love this", "love it",
  "rockstar", "superstar", "you're amazing", "you're the best",
  "perfect job", "exactly what we needed", "wow", "exceptional",
];

function findPraise(text: string): string[] {
  const lower = text.toLowerCase();
  return PRAISE_KEYWORDS.filter((kw) => lower.includes(kw));
}

function extractUserIds(text: string): string[] {
  return (text.match(/<@([A-Z0-9]+)>/g) || []).map((m) => m.replace(/<@|>/g, ""));
}

async function currentMonth(): Promise<string> {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Slack scan ─────────────────────────────────────────────────────────────

async function scanSlack(month: string): Promise<void> {
  const token = await getSecret("SLACK_BOT_TOKEN");
  if (!token) throw new Error("SLACK_BOT_TOKEN not configured in secrets");

  const slackFetch = async (method: string, params: Record<string, string>): Promise<any> => {
    const url = new URL(`https://slack.com/api/${method}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    const json = await resp.json() as any;
    if (!json.ok) throw new Error(`Slack ${method} error: ${json.error}`);
    return json;
  };

  // Load employee names from profiles
  const profilesFile = await supabase.storage.from(STORAGE_BUCKET).download("profiles.json");
  let employeeNames: string[] = [];
  if (profilesFile.data) {
    const profiles = JSON.parse(await profilesFile.data.text());
    employeeNames = profiles.filter((p: any) => p.bonusEnabled).map((p: any) => p.notionManagerName as string);
  }
  if (!employeeNames.length) return;

  // Slack user ID → real name map
  const usersResp = await slackFetch("users.list", { limit: "500" });
  const userMap = new Map<string, string>();
  for (const u of usersResp.members ?? []) {
    if (!u.deleted && !u.is_bot) {
      userMap.set(u.id, u.real_name || u.profile?.display_name || u.name || "");
    }
  }

  // Date range for month
  const [yr, mo] = month.split("-").map(Number);
  const oldest = String(new Date(yr, mo - 1, 1).getTime() / 1000);
  const latest = String(new Date(yr, mo, 0, 23, 59, 59).getTime() / 1000);

  // List all public channels
  const channelsResp = await slackFetch("conversations.list", {
    types: "public_channel",
    limit: "200",
    exclude_archived: "true",
  });

  const monthPraise: AchievementsData["slackPraise"][string] = {};

  for (const channel of channelsResp.channels ?? []) {
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, string> = {
        channel: channel.id,
        oldest,
        latest,
        limit: "200",
      };
      if (cursor) params.cursor = cursor;

      let histResp: any;
      try {
        histResp = await slackFetch("conversations.history", params);
      } catch {
        break;
      }

      for (const msg of histResp.messages ?? []) {
        const text: string = msg.text || "";
        const keywords = findPraise(text);
        if (!keywords.length) continue;

        const mentionedIds = extractUserIds(text);
        for (const uid of mentionedIds) {
          const slackName = userMap.get(uid);
          if (!slackName) continue;

          // Case-insensitive first-name match against employee names
          const matched = employeeNames.find((en) => {
            const slackFirst = slackName.split(" ")[0].toLowerCase();
            const empFirst = en.split(" ")[0].toLowerCase();
            return (
              slackName.toLowerCase().includes(empFirst) ||
              en.toLowerCase().includes(slackFirst)
            );
          });
          if (!matched) continue;

          if (!monthPraise[matched]) monthPraise[matched] = [];
          // Deduplicate by ts + channel
          if (monthPraise[matched].some((e) => e.ts === msg.ts && e.channel === channel.name)) continue;
          monthPraise[matched].push({
            id: crypto.randomUUID(),
            channel: channel.name || channel.id,
            text: text.slice(0, 400),
            praiseKeywords: keywords,
            ts: msg.ts,
            scannedAt: new Date().toISOString(),
          });
        }
      }

      hasMore = histResp.has_more ?? false;
      cursor = histResp.response_metadata?.next_cursor;
      if (!cursor) hasMore = false;
    }
  }

  data.slackPraise[month] = monthPraise;
  persist();
  console.log(`[achievements] Slack scan done for ${month}. Employees with praise:`, Object.keys(monthPraise));
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/achievements — full data (super admin)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  await ensureLoaded();
  if (!req.userId || !(await checkSuperAdmin(req.userId))) {
    res.status(403).json({ error: "Super admin required" });
    return;
  }
  res.json(data);
});

// GET /api/achievements/my?employeeName=... — personal achievement data
router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  await ensureLoaded();
  const employeeName = (req.query.employeeName as string)?.trim();
  if (!employeeName) {
    res.status(400).json({ error: "employeeName required" });
    return;
  }

  const reviews = data.reviews.filter(
    (r) => r.employeeName.toLowerCase() === employeeName.toLowerCase()
  );

  // Praise counts per month for this employee
  const praiseCounts: { [month: string]: number } = {};
  for (const [month, byEmp] of Object.entries(data.slackPraise)) {
    const empData = Object.entries(byEmp).find(
      ([name]) => name.toLowerCase() === employeeName.toLowerCase()
    );
    if (empData) praiseCounts[month] = empData[1].length;
  }

  res.json({ reviews, praiseCounts });
});

// POST /api/achievements/reviews — add a review (super admin)
router.post("/reviews", requireAuth, async (req: AuthRequest, res) => {
  await ensureLoaded();
  if (!req.userId || !(await checkSuperAdmin(req.userId))) {
    res.status(403).json({ error: "Super admin required" });
    return;
  }

  const { employeeName, platform, note } = req.body;
  if (!employeeName || !platform) {
    res.status(400).json({ error: "employeeName and platform are required" });
    return;
  }

  const entry: ReviewEntry = {
    id: crypto.randomUUID(),
    employeeName: String(employeeName),
    platform: String(platform) as ReviewEntry["platform"],
    note: String(note || ""),
    addedBy: req.userId,
    addedAt: new Date().toISOString(),
  };
  data.reviews.push(entry);
  persist();
  res.status(201).json(entry);
});

// DELETE /api/achievements/reviews/:id — remove a review (super admin)
router.delete("/reviews/:id", requireAuth, async (req: AuthRequest, res) => {
  await ensureLoaded();
  if (!req.userId || !(await checkSuperAdmin(req.userId))) {
    res.status(403).json({ error: "Super admin required" });
    return;
  }

  const idx = data.reviews.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  data.reviews.splice(idx, 1);
  persist();
  res.json({ ok: true });
});

// POST /api/achievements/slack/scan — trigger Slack scan (super admin)
router.post("/slack/scan", requireAuth, async (req: AuthRequest, res) => {
  if (!req.userId || !(await checkSuperAdmin(req.userId))) {
    res.status(403).json({ error: "Super admin required" });
    return;
  }

  const month = await currentMonth();
  res.json({ ok: true, month, message: `Slack scan started for ${month}` });

  // Fire-and-forget after response
  setImmediate(async () => {
    try {
      await ensureLoaded();
      await scanSlack(month);
    } catch (err: any) {
      console.error("[achievements] Slack scan failed:", err.message);
    }
  });
});

export default router;

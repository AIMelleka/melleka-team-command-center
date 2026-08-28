import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import Anthropic from "@anthropic-ai/sdk";
import cron from "node-cron";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NewsItem {
  headline: string;
  source: string;
  summary: string;
  category: string;
  url?: string;
}

interface NewsCache {
  items: NewsItem[];
  fetchedAt: number;
}

let cache: NewsCache | null = null;

async function fetchNews(): Promise<NewsItem[]> {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Today is ${today}. Search for the latest digital marketing news from this week. Find 8 recent updates relevant to a digital marketing agency — platform algorithm changes, Google/Meta/TikTok ad updates, AI tools for marketers, SEO changes, social media updates, or marketing industry trends.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact shape:
[
  {
    "headline": "Short punchy headline under 12 words",
    "source": "Publication or platform name",
    "summary": "One sentence summary under 20 words",
    "category": "one of: Platform Update | SEO | AI | Social Media | Ads | Industry",
    "url": "direct URL to article if available, otherwise omit"
  }
]`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array in response");

  const items = JSON.parse(jsonMatch[0]) as NewsItem[];
  if (!Array.isArray(items) || items.length === 0) throw new Error("Empty news array");
  return items.slice(0, 8);
}

async function refreshCache(): Promise<void> {
  try {
    console.log("[marketing-news] Fetching fresh news...");
    const items = await fetchNews();
    cache = { items, fetchedAt: Date.now() };
    console.log(`[marketing-news] Cached ${items.length} items.`);
  } catch (err: any) {
    console.warn("[marketing-news] Fetch failed:", err.message);
  }
}

// Pre-fetch on server startup so first user sees instant results
refreshCache();

// Refresh daily at 8:00 AM PST (16:00 UTC)
cron.schedule("0 16 * * *", refreshCache, { timezone: "UTC" });

// GET /api/marketing-news
router.get("/", requireAuth, async (req, res) => {
  const bypass = req.query.refresh === "1";

  if (bypass) {
    await refreshCache();
  }

  if (!cache) {
    // Still loading for the very first time — tell client to retry shortly
    res.status(503).json({ error: "News not ready yet, retry in a moment", retry: true });
    return;
  }

  res.json({
    items: cache.items,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    cached: true,
  });
});

export default router;

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { refreshRedditToken } from "../services/redditAdsClient.js";

const router = Router();

const USER_AGENT = "MellekaTeams/1.0 (by /u/MellekaMarketing)";
const BASE = "https://ads-api.reddit.com/api/v3";

/** GET /api/reddit-ads/accounts — list all accessible Reddit ad accounts */
router.get("/accounts", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const token = await refreshRedditToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    };

    // List businesses the user belongs to
    const bizResp = await fetch(`${BASE}/me/businesses`, { headers, signal: AbortSignal.timeout(45_000) });
    if (!bizResp.ok) {
      const err = await bizResp.json().catch(() => ({}));
      res.status(502).json({ error: "Failed to fetch Reddit businesses", detail: err });
      return;
    }

    const bizData = (await bizResp.json()) as {
      data?: { id: string; name: string }[];
    };

    if (!bizData.data?.length) {
      res.json({ accounts: [] });
      return;
    }

    // Use the query endpoint on each business — it returns ALL ad accounts
    // the user can access (including cross-business shared accounts).
    const seen = new Set<string>();
    const accounts: { id: string; name: string }[] = [];

    await Promise.all(
      bizData.data.map(async (biz) => {
        try {
          const accResp = await fetch(
            `${BASE}/businesses/${biz.id}/ad_accounts/query`,
            { method: "POST", headers, body: JSON.stringify({ data: {} }), signal: AbortSignal.timeout(45_000) },
          );
          if (!accResp.ok) return;
          const accData = (await accResp.json()) as {
            data?: { id: string; name: string; business_id: string }[];
          };
          for (const acc of accData.data || []) {
            if (seen.has(acc.id)) continue;
            seen.add(acc.id);
            accounts.push({ id: acc.id, name: acc.name });
          }
        } catch { /* skip failed business */ }
      }),
    );

    res.json({ accounts });
  } catch (err: any) {
    console.error("[reddit-ads] Error listing accounts:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to fetch Reddit Ads accounts" });
  }
});

export default router;

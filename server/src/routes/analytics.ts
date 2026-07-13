import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getSecret } from "../services/secrets.js";

const router = Router();

const SM_BASE = "https://api.supermetrics.com/enterprise/v2";

/** Fetch accounts/properties for a given Supermetrics data source */
async function getSmAccounts(dsId: string): Promise<{ id: string; name: string }[]> {
  const apiKey = await getSecret("SUPERMETRICS_API_KEY");
  if (!apiKey) return [];

  const resp = await fetch(`${SM_BASE}/query/ds_accounts?ds_id=${dsId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    console.error(`[analytics] Supermetrics ds_accounts failed for ${dsId}:`, resp.status, await resp.text().catch(() => ""));
    return [];
  }
  const json = (await resp.json()) as { data?: { id: string; name: string }[] };
  return json.data || [];
}

/** GET /api/analytics/ga4-properties — list GA4 properties from Supermetrics (GAWA) */
router.get("/ga4-properties", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await getSmAccounts("GAWA");
    res.json({ accounts });
  } catch (err: any) {
    console.error("[analytics] Error fetching GA4 properties:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to fetch GA4 properties" });
  }
});

/** GET /api/analytics/klaviyo-accounts — list Klaviyo accounts from Supermetrics (KLAV) */
router.get("/klaviyo-accounts", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await getSmAccounts("KLAV");
    res.json({ accounts });
  } catch (err: any) {
    console.error("[analytics] Error fetching Klaviyo accounts:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to fetch Klaviyo accounts" });
  }
});

export default router;

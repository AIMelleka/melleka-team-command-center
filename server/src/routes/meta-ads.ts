import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

const META_API_VERSION = process.env.META_API_VERSION || "v21.0";

/** Resolve Meta access token: env var → oauth_connections DB */
async function resolveMetaToken(): Promise<string | null> {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN;

  const { data: oauthRow } = await supabase
    .from("oauth_connections")
    .select("access_token, token_expires_at")
    .eq("provider", "meta_ads")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (oauthRow?.token_expires_at && new Date(oauthRow.token_expires_at) < new Date()) {
    return null; // expired
  }
  return oauthRow?.access_token ?? null;
}

/** GET /api/meta-ads/accounts — list all accessible Meta ad accounts */
router.get("/accounts", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const token = await resolveMetaToken();
    if (!token) {
      res.status(401).json({ error: "No valid Meta access token available." });
      return;
    }

    const resp = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=account_id,name&limit=500&access_token=${token}`,
    );
    const data = (await resp.json()) as {
      data?: Array<{ account_id: string; name: string; id: string }>;
      error?: { message: string; code: number };
    };

    if (!resp.ok || data.error) {
      const code = data.error?.code;
      if (code === 190) {
        res.status(401).json({ error: "Meta access token expired. Reconnect via OAuth or update META_ACCESS_TOKEN." });
        return;
      }
      res.status(502).json({ error: "Failed to list Meta ad accounts", detail: data.error });
      return;
    }

    const accounts = (data.data ?? []).map((a) => ({
      id: a.account_id,
      name: a.name || a.account_id,
    }));

    res.json({ accounts });
  } catch (err: any) {
    console.error("[meta-ads] Error listing accounts:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to fetch Meta ad accounts" });
  }
});

export default router;

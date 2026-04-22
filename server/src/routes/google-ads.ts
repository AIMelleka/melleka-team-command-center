import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireSecret, getSecret } from "../services/secrets.js";

const router = Router();

const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v23";

/** Refresh a Google OAuth2 access token */
async function refreshGoogleToken(): Promise<string> {
  const clientId = await requireSecret("GOOGLE_CLIENT_ID", "Google Client ID");
  const clientSecret = await requireSecret("GOOGLE_CLIENT_SECRET", "Google Client Secret");
  const refreshToken = await requireSecret("GOOGLE_ADS_REFRESH_TOKEN", "Google Ads Refresh Token");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await resp.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

/** GET /api/google-ads/accounts — list all accessible Google Ads client accounts */
router.get("/accounts", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const developerToken = await requireSecret("GOOGLE_ADS_DEVELOPER_TOKEN", "Google Ads Developer Token");
    const accessToken = await refreshGoogleToken();
    const loginCustomerId = await getSecret("GOOGLE_ADS_LOGIN_CUSTOMER_ID");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

    // Step 1: list accessible customer IDs
    const listResp = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
      { headers },
    );
    const listData = (await listResp.json()) as { resourceNames?: string[]; error?: unknown };
    if (!listResp.ok) {
      res.status(502).json({ error: "Failed to list Google Ads accounts", detail: listData });
      return;
    }

    const ids = (listData.resourceNames ?? []).map((r) => r.replace("customers/", ""));
    if (ids.length === 0) {
      res.json({ accounts: [] });
      return;
    }

    // Step 2: fetch account names via customer_client query
    const seedId = (loginCustomerId ?? ids[0]).replace(/-/g, "");
    const nameResp = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${seedId}/googleAds:search`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `SELECT customer_client.id, customer_client.descriptive_name, customer_client.level FROM customer_client WHERE customer_client.level <= 1`,
        }),
      },
    );
    const nameData = (await nameResp.json()) as {
      results?: Array<{ customerClient: { id: string; descriptiveName: string; level: string | number; manager?: boolean } }>;
    };

    if (nameResp.ok && nameData.results?.length) {
      const accounts = nameData.results
        .filter((r) => String(r.customerClient?.level) === "1" && !r.customerClient?.manager)
        .map((r) => ({ id: r.customerClient.id, name: r.customerClient.descriptiveName }));
      res.json({ accounts });
      return;
    }

    // Fallback: return IDs without names
    res.json({ accounts: ids.map((id) => ({ id, name: id })) });
  } catch (err: any) {
    console.error("[google-ads] Error listing accounts:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to fetch Google Ads accounts" });
  }
});

export default router;

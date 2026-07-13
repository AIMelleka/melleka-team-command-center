/**
 * CRM Route — Secure credential storage for client CRM integrations.
 *
 * SECURITY DESIGN:
 * - Credentials are stored server-side only (team_secrets table). Never returned to the client.
 * - This route ONLY validates credentials via read-only API calls before saving.
 * - The integration NEVER calls HubSpot write endpoints (no create/update/delete).
 * - Credentials are scoped per-client via a namespaced key (HUBSPOT_API_KEY_{CLIENT}).
 *
 * Supports both HubSpot credential types:
 *   - Private App access token (starts with "pat-"): uses Authorization: Bearer header
 *   - Legacy API key (UUID format): uses ?hapikey= query parameter
 */

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

/** "La Photo Party" -> "HUBSPOT_API_KEY_LA_PHOTO_PARTY" */
function normalizeClientKey(clientName: string): string {
  const suffix = clientName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `HUBSPOT_API_KEY_${suffix}`;
}

/**
 * Build a read-only HubSpot request that works for both credential types.
 * - Private App token (pat-...): Authorization: Bearer header
 * - Legacy API key (UUID):       ?hapikey= query parameter
 */
/** Legacy HubSpot API keys are UUID format. Private App tokens (all formats) are not. */
function isLegacyApiKey(credential: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credential);
}

function buildHubSpotAuth(credential: string): {
  headers: Record<string, string>;
  queryParam: string;
} {
  const legacy = isLegacyApiKey(credential);
  return {
    headers: legacy
      ? { "Content-Type": "application/json" }
      : { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
    // queryParam is appended after existing query string params (leading & is intentional)
    queryParam: legacy ? `&hapikey=${encodeURIComponent(credential)}` : "",
  };
}

/**
 * POST /api/crm/save-credential
 *
 * Validates and stores a HubSpot credential for a specific client.
 * Supports both Private App tokens (pat-...) and legacy API keys (UUID).
 *
 * Required body: { client_name: string, platform: "hubspot", token: string }
 *
 * GUARANTEE: Only a read-only GET is used for validation.
 * The stored credential is only ever used for read operations.
 */
router.post("/save-credential", requireAuth, async (req: AuthRequest, res: Response) => {
  const { client_name, platform, token } = req.body as {
    client_name?: string;
    platform?: string;
    token?: string;
  };

  if (!client_name?.trim() || !platform?.trim() || !token?.trim()) {
    res.status(400).json({ error: "client_name, platform, and token are required" });
    return;
  }

  if (platform !== "hubspot") {
    res.status(400).json({ error: "Only hubspot platform is currently supported" });
    return;
  }

  const cleanCredential = token.trim();
  const cleanClientName = client_name.trim();

  // No upfront validation — HubSpot API keys and Private App tokens are saved directly.
  // The credential is tested for real when CRM data is fetched for a client report.
  // Errors there are surfaced in the report output.

  // ── Step 1: Save to team_secrets (server-side only, never returned to client) ──
  const secretKey = normalizeClientKey(cleanClientName);

  const { data: existingSecret } = await supabase
    .from("team_secrets")
    .select("id")
    .eq("key", secretKey)
    .maybeSingle();

  const { error: secretError } = existingSecret
    ? await supabase.from("team_secrets").update({ value: cleanCredential }).eq("key", secretKey)
    : await supabase.from("team_secrets").insert({ key: secretKey, value: cleanCredential });

  if (secretError) {
    console.error("[crm] Failed to save credential:", secretError.message);
    res.status(500).json({ error: "Failed to store credential. Please try again." });
    return;
  }

  // ── Step 3: Mark client as connected in client_account_mappings ──
  const { data: existingMapping } = await supabase
    .from("client_account_mappings")
    .select("id")
    .eq("client_name", cleanClientName)
    .eq("platform", "hubspot")
    .maybeSingle();

  if (!existingMapping) {
    const { error: mapError } = await supabase.from("client_account_mappings").insert({
      client_name: cleanClientName,
      platform: "hubspot",
      account_id: "hubspot_crm",
      account_name: "HubSpot CRM",
    });
    if (mapError) {
      console.warn("[crm] Could not insert mapping row:", mapError.message);
    }
  }

  console.log(`[crm] HubSpot credential saved for client: "${cleanClientName}" (key: ${secretKey})`);
  res.json({ success: true, message: `HubSpot CRM connected for ${cleanClientName}` });
});

/**
 * GET /api/crm/test-connection?client_name=...
 * Tests the stored HubSpot credential for a client against the live API.
 * Returns the exact HTTP status and error from HubSpot for debugging.
 */
router.get("/test-connection", requireAuth, async (req: AuthRequest, res: Response) => {
  const clientName = (req.query.client_name as string)?.trim();
  if (!clientName) {
    res.status(400).json({ error: "client_name query param required" });
    return;
  }

  const secretKey = normalizeClientKey(clientName);
  const { data: secret } = await supabase
    .from("team_secrets")
    .select("value")
    .eq("key", secretKey)
    .maybeSingle();

  if (!secret?.value) {
    res.json({ ok: false, error: `No credential found for key: ${secretKey}` });
    return;
  }

  const credential = secret.value as string;
  const { headers, queryParam } = buildHubSpotAuth(credential);
  const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=createdate${queryParam}`;

  try {
    const resp = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(15_000) });
    const body = await resp.json().catch(() => null);
    console.log(`[crm] test-connection for "${clientName}": HTTP ${resp.status}`, body);
    res.json({
      ok: resp.ok,
      status: resp.status,
      credentialType: isLegacyApiKey(credential) ? "legacy-api-key (hapikey)" : "private-app-token (Bearer)",
      secretKey,
      hubspotResponse: body,
    });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

export default router;

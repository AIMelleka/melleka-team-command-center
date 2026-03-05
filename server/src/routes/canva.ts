import { Router } from "express";
import crypto from "crypto";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { getSecret } from "../services/secrets.js";

const router = Router();

// In-memory PKCE store (keyed by state param)
const pkceStore = new Map<string, { codeVerifier: string; memberName: string; createdAt: number }>();

// Clean up stale PKCE entries older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pkceStore) {
    if (val.createdAt < cutoff) pkceStore.delete(key);
  }
}, 60_000);

/**
 * GET /api/canva/oauth
 * Generates the Canva OAuth authorization URL with PKCE.
 * Returns { url } for the frontend to redirect to.
 */
router.get("/oauth", requireAuth, async (req: AuthRequest, res) => {
  try {
    const clientId = await getSecret("CANVA_CLIENT_ID");
    if (!clientId) {
      res.status(500).json({ error: "CANVA_CLIENT_ID not configured. Set it in team_secrets or environment." });
      return;
    }

    const redirectUri = await getSecret("CANVA_REDIRECT_URI") ||
      `${process.env.SERVER_URL || "https://server-production-0486.up.railway.app"}/api/canva/callback`;

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(64).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("base64url");

    // Store PKCE verifier for the callback
    pkceStore.set(state, {
      codeVerifier,
      memberName: req.memberName!,
      createdAt: Date.now(),
    });

    const scopes = [
      "design:content:read",
      "design:content:write",
      "design:meta:read",
      "asset:read",
      "asset:write",
      "brandtemplate:meta:read",
      "brandtemplate:content:read",
      "folder:read",
      "profile:read",
    ].join(" ");

    const authUrl = new URL("https://www.canva.com/api/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    res.json({ url: authUrl.toString() });
  } catch (err: any) {
    console.error("[canva-oauth] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/canva/callback
 * Handles the OAuth callback from Canva.
 * Exchanges the authorization code for access + refresh tokens.
 */
router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      res.status(400).send("Missing code or state parameter.");
      return;
    }

    const pkce = pkceStore.get(state);
    if (!pkce) {
      res.status(400).send("Invalid or expired state. Please try connecting again.");
      return;
    }
    pkceStore.delete(state);

    const clientId = await getSecret("CANVA_CLIENT_ID");
    const clientSecret = await getSecret("CANVA_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      res.status(500).send("Canva credentials not configured.");
      return;
    }

    const redirectUri = await getSecret("CANVA_REDIRECT_URI") ||
      `${process.env.SERVER_URL || "https://server-production-0486.up.railway.app"}/api/canva/callback`;

    // Exchange code for tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResp = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: pkce.codeVerifier,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResp.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      console.error("[canva-callback] Token exchange failed:", tokenData);
      res.status(400).send(`Canva token exchange failed: ${tokenData.error_description || tokenData.error || "Unknown error"}`);
      return;
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 14400) * 1000).toISOString();

    // Upsert into oauth_connections
    const { error: dbErr } = await supabase
      .from("oauth_connections")
      .upsert(
        {
          user_id: pkce.memberName,
          provider: "canva",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          account_name: "Canva",
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (dbErr) {
      console.error("[canva-callback] DB error:", dbErr);
      // Try insert if upsert fails (no unique constraint)
      await supabase.from("oauth_connections").insert({
        user_id: pkce.memberName,
        provider: "canva",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        account_name: "Canva",
      });
    }

    console.log(`[canva-callback] Token saved for ${pkce.memberName}`);

    // Redirect to frontend with success
    const frontendUrl = process.env.CLIENT_URL || "https://teams.melleka.com";
    res.redirect(`${frontendUrl}?canva=connected`);
  } catch (err: any) {
    console.error("[canva-callback] Error:", err.message);
    res.status(500).send(`Error connecting Canva: ${err.message}`);
  }
});

/**
 * GET /api/canva/status
 * Check if Canva is connected for the current user.
 */
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data } = await supabase
      .from("oauth_connections")
      .select("access_token, token_expires_at, account_name")
      .eq("provider", "canva")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      res.json({ connected: false });
      return;
    }

    const expired = data.token_expires_at && new Date(data.token_expires_at) < new Date();
    res.json({
      connected: true,
      expired: !!expired,
      account_name: data.account_name,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireSecret, getSecret } from "../services/secrets.js";
import { supabase } from "../services/supabase.js";

const router = Router();

const AYRSHARE_BASE = "https://api.ayrshare.com/api";

/** Shared helper — call any Ayrshare endpoint with auth */
async function ayrFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const apiKey = await requireSecret("AYRSHARE_API_KEY", "Ayrshare API Key");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const opts: RequestInit = { method, headers };
  if (body && method !== "GET") {
    opts.body = JSON.stringify(body);
  }

  const resp = await fetch(`${AYRSHARE_BASE}${path}`, opts);
  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    data = await resp.text();
  }
  return { ok: resp.ok, status: resp.status, data };
}

// ─── GET /api/social/user — connected platforms ────────────────────────────────
router.get("/user", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("GET", "/user");
    if (!result.ok) {
      res.status(result.status).json(result.data);
      return;
    }
    res.json(result.data);
  } catch (err: any) {
    console.error("[social] /user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/social/history — post history ────────────────────────────────────
router.get("/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const platform = req.query.platform as string | undefined;
    const path = platform ? `/history/platform/${platform}` : "/history";
    const result = await ayrFetch("GET", path);
    if (!result.ok) {
      res.status(result.status).json(result.data);
      return;
    }
    res.json(result.data);
  } catch (err: any) {
    console.error("[social] /history error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/post — create / schedule a post ──────────────────────────
router.post("/post", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { post, platforms, mediaUrls, scheduleDate, ...extra } = req.body;
    const body: Record<string, unknown> = { ...extra };
    if (post) body.post = post;
    if (platforms) body.platforms = platforms;
    if (mediaUrls) body.mediaUrls = mediaUrls;
    if (scheduleDate) body.scheduleDate = scheduleDate;

    const result = await ayrFetch("POST", "/post", body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] POST /post error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/social/post — delete a post ───────────────────────────────────
router.delete("/post", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    const result = await ayrFetch("DELETE", "/post", { id });
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] DELETE /post error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/analytics/post — post analytics ──────────────────────────
router.post("/analytics/post", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("POST", "/analytics/post", req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] analytics/post error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/analytics/social — profile analytics ─────────────────────
router.post("/analytics/social", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("POST", "/analytics/social", req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] analytics/social error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/social/auto-schedule — get auto-schedule settings ────────────────
router.get("/auto-schedule", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("GET", "/auto-schedule");
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] GET auto-schedule error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/auto-schedule — set auto-schedule ────────────────────────
router.post("/auto-schedule", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("POST", "/auto-schedule", req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] POST auto-schedule error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/generate — AI generate post text ─────────────────────────
router.post("/generate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("POST", "/generate/text", req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/hashtags — recommend hashtags ────────────────────────────
router.post("/hashtags", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("POST", "/hashtags/auto", req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] hashtags error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/media/upload — upload media ──────────────────────────────
router.post("/media/upload", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("POST", "/media/upload", req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] media upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/social/media — list uploaded media ───────────────────────────────
router.get("/media", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const result = await ayrFetch("GET", "/media");
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[social] GET media error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/social/connect — generate JWT URL for in-app account linking ──
router.post("/connect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const privateKey = await getSecret("AYRSHARE_PRIVATE_KEY");
    const domain = await getSecret("AYRSHARE_DOMAIN");

    if (!privateKey || !domain) {
      res.status(400).json({
        error: "not_configured",
        message: "Ayrshare JWT linking requires AYRSHARE_PRIVATE_KEY and AYRSHARE_DOMAIN. Get your private key from the Ayrshare dashboard (API Page > Integration Package) and set both in team_secrets or .env.",
      });
      return;
    }

    const memberName = req.memberName || "melleka";

    // Check if we already have a profile key stored
    const { data: existing } = await supabase
      .from("oauth_connections")
      .select("access_token")
      .eq("provider", "ayrshare")
      .eq("user_id", memberName.toLowerCase())
      .maybeSingle();

    let profileKey = existing?.access_token;

    // If no profile key exists, create a new Ayrshare profile
    if (!profileKey) {
      const createResult = await ayrFetch("POST", "/profiles", {
        title: `melleka-${memberName}-${Date.now()}`,
      });

      const createData = createResult.data as any;
      if (!createResult.ok || !createData.profileKey) {
        console.error("[social] Profile creation failed:", createData);
        res.status(400).json({
          error: "profile_creation_failed",
          message: createData?.message || "Failed to create Ayrshare profile",
        });
        return;
      }

      profileKey = createData.profileKey;

      // Store the profile key
      await supabase.from("oauth_connections").upsert(
        {
          user_id: memberName.toLowerCase(),
          provider: "ayrshare",
          access_token: profileKey,
          account_name: "Ayrshare Social",
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );
    }

    // Parse the private key (handle escaped newlines)
    const parsedKey = privateKey.replace(/\\n/g, "\n");

    // Generate JWT URL
    const redirect = req.body.redirect || process.env.CLIENT_URL || "https://teams.melleka.com";
    const jwtResult = await ayrFetch("POST", "/profiles/generateJWT", {
      domain,
      privateKey: parsedKey,
      profileKey,
      redirect: `${redirect}/social-media?connected=true`,
      expiresIn: 30,
    });

    const jwtData = jwtResult.data as any;
    if (!jwtResult.ok || !jwtData.url) {
      console.error("[social] JWT generation failed:", jwtData);
      res.status(400).json({
        error: "jwt_failed",
        message: jwtData?.message || jwtData?.error || "Failed to generate connect URL",
      });
      return;
    }

    console.log(`[social] Connect URL generated for ${memberName}`);
    res.json({ url: jwtData.url, profileKey });
  } catch (err: any) {
    console.error("[social] /connect error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/social/connect/status — check if JWT linking is configured ──────
router.get("/connect/status", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const privateKey = await getSecret("AYRSHARE_PRIVATE_KEY");
    const domain = await getSecret("AYRSHARE_DOMAIN");
    res.json({
      configured: !!(privateKey && domain),
      hasPrivateKey: !!privateKey,
      hasDomain: !!domain,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../services/supabase.js";
import { getMemberDir } from "../services/memory.js";

// Auth validation uses the SAME Supabase project the frontend authenticates against.
// This may differ from SUPABASE_URL (used for data storage in services/supabase.ts).
const supabaseAuth = createClient(
  process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_AUTH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthRequest extends Request {
  memberName?: string;
  anthropicApiKey?: string;
}

// Cache MFA enrollment status per user to avoid 2 extra Supabase calls per request
const mfaCache = new Map<string, { hasTotp: boolean; expiresAt: number }>();
const MFA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache per-user API keys (refresh every 5 min so key changes propagate)
const apiKeyCache = new Map<string, { key: string | null; expiresAt: number }>();
const API_KEY_CACHE_TTL = 5 * 60 * 1000;

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  const token = header.slice(7);

  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // MFA enforcement removed — client-side handles MFA flow via useAuth.tsx.
    // Server-side enforcement was blocking users who enrolled MFA on shared
    // Supabase projects (e.g. STJ) from accessing team.melleka.com.

    // Derive member name from email prefix (stable, never changes)
    const email = user.email ?? "";
    const memberName = (email.split("@")[0] || "unknown").toLowerCase();
    req.memberName = memberName;

    // Ensure team member record exists (fire-and-forget)
    Promise.resolve(supabase.from("team_members").upsert({ name: memberName }, { onConflict: "name" })).catch(() => {});
    getMemberDir(memberName).catch(() => {});

    // Fetch per-user Anthropic API key (cached)
    const cached = apiKeyCache.get(memberName);
    if (cached && Date.now() < cached.expiresAt) {
      if (cached.key) req.anthropicApiKey = cached.key;
    } else {
      try {
        const { data } = await supabase
          .from("team_members")
          .select("anthropic_api_key")
          .eq("name", memberName)
          .limit(1)
          .single();
        const key = data?.anthropic_api_key || null;
        apiKeyCache.set(memberName, { key, expiresAt: Date.now() + API_KEY_CACHE_TTL });
        if (key) req.anthropicApiKey = key;
      } catch {
        // DB lookup failed — proceed without per-user key
      }
    }

    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

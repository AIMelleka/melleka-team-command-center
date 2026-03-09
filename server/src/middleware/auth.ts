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
}

// Cache MFA enrollment status per user to avoid 2 extra Supabase calls per request
const mfaCache = new Map<string, { hasTotp: boolean; expiresAt: number }>();
const MFA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    // Ensure team member record + local folder exist (fire-and-forget)
    Promise.resolve(
      supabase.from("team_members").upsert({ name: memberName }, { onConflict: "name" })
    ).catch(() => {});
    getMemberDir(memberName).catch(() => {});

    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

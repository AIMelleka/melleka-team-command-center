import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Auth validation uses the SAME Supabase project the frontend authenticates against.
// This may differ from SUPABASE_URL (used for data storage in services/supabase.ts).
const supabaseAuth = createClient(
  process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_AUTH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthRequest extends Request {
  memberName?: string;
}

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

    // Derive member name from Supabase user profile
    const email = user.email ?? "";
    const name = user.user_metadata?.full_name
      || user.user_metadata?.name
      || email.split("@")[0]
      || "unknown";

    req.memberName = name.toLowerCase();
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Supabase helper utilities
 * Handles session refresh before edge function calls to prevent expired token errors
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Ensure the Supabase session has a fresh access token.
 * Call this before `supabase.functions.invoke()` to avoid "Invalid or expired token" errors.
 *
 * The Supabase client's `autoRefreshToken` may not fire in time if the browser tab
 * was backgrounded or the user was idle, so we proactively refresh when the token
 * is expired or expiring within 60 seconds.
 */
export async function ensureFreshSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (
    !session?.access_token ||
    (session.expires_at && session.expires_at * 1000 < Date.now() + 60_000)
  ) {
    await supabase.auth.refreshSession();
  }
}

/**
 * Extract a human-readable error message from a Supabase edge function error.
 *
 * In @supabase/functions-js v2, `error.context` is the raw Response object.
 * The body may be JSON (our edge functions) or plain text (Deno crash / relay error).
 * We read as text first to avoid consuming the body with a failing `.json()`.
 */
export async function extractEdgeFunctionError(
  error: any,
  fallback = 'Something went wrong',
): Promise<string> {
  try {
    const ctx = error?.context;
    // ctx is a Response object with an unconsumed body
    if (ctx && typeof ctx.text === 'function') {
      const text = await ctx.text();
      try {
        const body = JSON.parse(text);
        return body?.help || body?.error || body?.message || error.message || fallback;
      } catch {
        // Body wasn't JSON (Deno crash, HTML error page, etc.)
        if (text && text.length < 500) return text;
      }
    }
    return error?.message || fallback;
  } catch {
    return error?.message || fallback;
  }
}

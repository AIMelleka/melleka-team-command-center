/**
 * Centralized secrets manager — reads API keys from the team_secrets table
 * in Supabase with an in-memory cache (5 min TTL).
 *
 * Falls back to process.env if a key isn't in the DB yet (migration path).
 */

import { supabase } from "./supabase.js";

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Get a secret by key name.
 * Checks: in-memory cache → Supabase team_secrets table → process.env fallback.
 * Returns null if not found anywhere.
 */
export async function getSecret(key: string): Promise<string | null> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // Try Supabase
  try {
    const { data } = await supabase
      .from("team_secrets")
      .select("value")
      .eq("key", key)
      .single();

    if (data?.value) {
      cache.set(key, { value: data.value, expiresAt: Date.now() + CACHE_TTL_MS });
      return data.value;
    }
  } catch {
    // Table might not exist yet — fall through to env var
  }

  // Fallback to env var
  const envVal = process.env[key];
  if (envVal) {
    cache.set(key, { value: envVal, expiresAt: Date.now() + CACHE_TTL_MS });
    return envVal;
  }

  return null;
}

/**
 * Require a secret — throws a clear error if missing.
 */
export async function requireSecret(key: string, label?: string): Promise<string> {
  const val = await getSecret(key);
  if (!val) {
    throw new Error(
      `${label || key} not configured. Add it to the team_secrets table in Supabase or as an env var.`
    );
  }
  return val;
}

/**
 * Invalidate cached value for a key (e.g., after updating a secret).
 */
export function clearSecretCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

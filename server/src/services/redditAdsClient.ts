/**
 * Reddit Ads API Client — OAuth2 token refresh + typed HTTP helper.
 *
 * Uses refresh_token grant to obtain short-lived access tokens (1-hour TTL).
 * Credentials: REDDIT_APP_ID + REDDIT_APP_SECRET from env vars / team_secrets.
 * Refresh token: REDDIT_REFRESH_TOKEN from team_secrets.
 */

import { requireSecret } from "./secrets.js";

// ── In-memory token cache ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const USER_AGENT = "MellekaTeams/1.0 (by /u/MellekaMarketing)";

/** Refresh the Reddit OAuth2 access token using the stored refresh token. */
export async function refreshRedditToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const appId = await requireSecret("REDDIT_APP_ID", "Reddit App ID");
  const appSecret = await requireSecret("REDDIT_APP_SECRET", "Reddit App Secret");
  const refreshToken = await requireSecret("REDDIT_REFRESH_TOKEN", "Reddit Refresh Token");

  const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const data = await resp.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    message?: string;
  };

  if (!data.access_token) {
    throw new Error(`Reddit token refresh failed: ${data.error || data.message || JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

/**
 * Make an authenticated request to the Reddit Ads API v3.
 * Auto-refreshes token on 401.
 */
export async function redditAdsRequest(
  method: string,
  endpoint: string,
  params?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const doRequest = async (token: string) => {
    const baseUrl = "https://ads-api.reddit.com/api/v3";
    const upperMethod = method.toUpperCase();

    let url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    };

    let fetchOpts: RequestInit = { method: upperMethod, headers };

    if (upperMethod === "GET" && params) {
      const qs = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null) continue;
        qs.set(key, typeof val === "object" ? JSON.stringify(val) : String(val));
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
    } else if (params && (upperMethod === "POST" || upperMethod === "PUT" || upperMethod === "DELETE")) {
      headers["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(params);
    }

    fetchOpts.headers = headers;
    fetchOpts.signal = AbortSignal.timeout(45_000);
    const resp = await fetch(url, fetchOpts);
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  };

  // First attempt
  let token = await refreshRedditToken();
  let result = await doRequest(token);

  // Retry once on 401 (token may have just expired)
  if (result.status === 401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    token = await refreshRedditToken();
    result = await doRequest(token);
  }

  return result;
}

// Single source of truth for Google Ads API version across all edge functions.
// Update this ONE value when Google releases a new version.
export const GOOGLE_ADS_API_VERSION = Deno.env.get("GOOGLE_ADS_API_VERSION") || "v23";
export const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

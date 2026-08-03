/**
 * Ad Metrics Service — Direct Meta, Google, and Reddit Ads API integration.
 *
 * Calls Meta, Google, and Reddit Ads APIs directly for accurate, real-time data.
 * Falls back to Supermetrics only for TikTok, Bing, and LinkedIn.
 *
 * Main export: fetchClientAdPerformance(clientName, startDate, endDate)
 */

import { createSign } from "crypto";
import { requireSecret, getSecret } from "./secrets.js";
import { supabase } from "./supabase.js";
import { loadMatchingRegistry, getClientMatchingRules, isAmbiguousWord } from "./client-matching.js";
import { refreshRedditToken } from "./redditAdsClient.js";

const META_API_VERSION = process.env.META_API_VERSION || "v21.0";
const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v23";
const SUPERMETRICS_API_URL = "https://api.supermetrics.com/enterprise/v2";

// ── Data source IDs ──
const DATA_SOURCES: Record<string, { id: string; label: string }> = {
  google_ads: { id: "AW", label: "Google Ads" },
  meta_ads: { id: "FA", label: "Facebook/Meta Ads" },
  reddit_ads: { id: "RDA", label: "Reddit Ads" },
  tiktok_ads: { id: "TIK", label: "TikTok Ads" },
  bing_ads: { id: "AC", label: "Microsoft Advertising (Bing)" },
  linkedin_ads: { id: "LIA", label: "LinkedIn Ads" },
  vibe_tv_ads: { id: "VIBE", label: "Vibe TV Ads" },
  instagram_insights: { id: "IGI", label: "Instagram Insights" },
  ga4: { id: "GAWA", label: "Google Analytics 4" },
  klaviyo: { id: "KLAV", label: "Klaviyo" },
  hubspot: { id: "HUBSPOT", label: "HubSpot CRM" },
};

// Platforms that use Supermetrics as primary source
const SUPERMETRICS_PLATFORMS = new Set(["tiktok_ads", "bing_ads", "linkedin_ads", "vibe_tv_ads"]);

// ── Supermetrics field definitions (only for TIK/AC/LIA) ──
interface PlatformFieldDef {
  dailyFields: string;
  fieldOrder: string[];
  creativeFields: string;
  creativeFieldOrder: string[];
  keywordFields?: string;
  keywordFieldOrder?: string[];
}

const PLATFORM_DEFS: Record<string, PlatformFieldDef> = {
  TIK: {
    dailyFields: "Date,campaign_name,impressions,clicks,spend,conversions,conversion_rate,cpc,cpm,ctr,reach",
    fieldOrder: ["date", "campaign", "impressions", "clicks", "cost", "conversions", "convrate", "cpc", "cpm", "ctr", "reach"],
    creativeFields: "adgroup_name,campaign_name,impressions,clicks,spend,conversions,ctr,cpc",
    creativeFieldOrder: ["adname", "campaign", "impressions", "clicks", "cost", "conversions", "ctr", "cpc"],
  },
  AC: {
    dailyFields: "Date,CampaignName,Impressions,Clicks,Spend,Conversions,Revenue,CostPerConversion,Ctr,CPC",
    fieldOrder: ["date", "campaign", "impressions", "clicks", "cost", "conversions", "revenue", "cpa", "ctr", "cpc"],
    creativeFields: "AdTitle,CampaignName,Impressions,Clicks,Spend,Conversions,Ctr,CPC,CostPerConversion",
    creativeFieldOrder: ["adname", "campaign", "impressions", "clicks", "cost", "conversions", "ctr", "cpc", "cpa"],
    keywordFields: "Keyword,CampaignName,Impressions,Clicks,Spend,Conversions,Ctr,CPC,CostPerConversion",
    keywordFieldOrder: ["keyword", "campaign", "impressions", "clicks", "cost", "conversions", "ctr", "cpc", "cpa"],
  },
  LIA: {
    dailyFields: "Date,campaignName,impressions,clicks,spend,conversions,cpc,ctr,cpm",
    fieldOrder: ["date", "campaign", "impressions", "clicks", "cost", "conversions", "cpc", "ctr", "cpm"],
    creativeFields: "campaignName,impressions,clicks,spend,conversions,ctr,cpc",
    creativeFieldOrder: ["campaign", "impressions", "clicks", "cost", "conversions", "ctr", "cpc"],
  },
  // Vibe TV — CTV advertising. video_completions maps to "conversions" in the output.
  VIBE: {
    dailyFields: "Date,campaign_name,impressions,spend,video_completions,video_completion_rate,cpm,clicks,ctr",
    fieldOrder: ["date", "campaign", "impressions", "cost", "conversions", "convrate", "cpm", "clicks", "ctr"],
    creativeFields: "campaign_name,impressions,spend,video_completions,video_completion_rate,cpm",
    creativeFieldOrder: ["campaign", "impressions", "cost", "conversions", "convrate", "cpm"],
  },
};

// ── Conversion classification ──
function classifyConversionAction(name: string): "leads" | "purchases" | "calls" | "other" {
  const lower = name.toLowerCase();

  if (
    lower.includes("call") || lower.includes("phone") ||
    lower.includes("click-to-call") || lower.includes("click to call") ||
    lower.includes("calls from ads") || lower.includes("phone_call") ||
    lower.includes("tel:") || lower.includes("call extension") ||
    lower.includes("call asset") || lower.includes("call tracking") ||
    lower.includes("imported call") || lower.includes("call from") ||
    lower.includes("mobile click") || lower.includes("gclid call")
  ) return "calls";

  if (
    lower.includes("purchase") || lower.includes("transaction") ||
    lower.includes("order") || lower.includes("sale") ||
    lower.includes("buy") || lower.includes("ecommerce") ||
    lower.includes("e-commerce") || lower.includes("add to cart") ||
    lower.includes("add_to_cart") || lower.includes("checkout") ||
    lower.includes("revenue") || lower.includes("begin_checkout") ||
    lower.includes("begin checkout") || lower.includes("payment") ||
    lower.includes("shop") || lower.includes("cart") ||
    lower.includes("booking") || lower.includes("reservation")
  ) return "purchases";

  // Skip GA4 auto-events and engagement micro-conversions — these appear in
  // metrics.all_conversions but are not real business conversions.
  // Treating them as "leads" causes phantom lead counts.
  const isMicroConversion =
    lower === "session_start" || lower === "session start" ||
    lower === "first_visit" || lower === "first visit" ||
    lower === "page_view" || lower === "pageview" || lower === "page view" ||
    lower === "scroll" ||
    lower === "user_engagement" || lower === "user engagement" ||
    lower === "engaged_session" || lower === "engaged session" ||
    lower === "web_engagement" || lower === "web engagement" ||
    lower.includes("smart goal") ||
    lower.includes("time on site") || lower.includes("time on page") ||
    (lower.includes("video") && (lower.includes("start") || lower.includes("progress")));
  if (isMicroConversion) return "other";

  return "leads";
}

// ── Utility ──
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ══════════════════════════════════════════════════════════════════════════════
// META MARKETING API — Direct Integration
// ══════════════════════════════════════════════════════════════════════════════

/** Resolve Meta access token: env var → oauth_connections DB */
async function resolveMetaToken(): Promise<string | null> {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN;

  const { data: oauthRow } = await supabase
    .from("oauth_connections")
    .select("access_token, token_expires_at")
    .eq("provider", "meta_ads")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (oauthRow?.token_expires_at && new Date(oauthRow.token_expires_at) < new Date()) {
    return null; // expired
  }
  return oauthRow?.access_token ?? null;
}

interface MetaCampaignRow {
  campaign: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  calls: number;
  reach: number;
  frequency: number;
}

/** Fetch campaign-level insights from Meta Marketing API with pagination */
async function fetchMetaInsights(
  token: string, accountId: string, startDate: string, endDate: string,
): Promise<{ rows: MetaCampaignRow[]; error?: string }> {
  const rows: MetaCampaignRow[] = [];
  const fields = "campaign_name,impressions,clicks,spend,actions,reach,frequency";
  const timeRange = JSON.stringify({ since: startDate, until: endDate });

  // Ensure account ID has act_ prefix
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  // Do NOT specify action_attribution_windows — let Meta use the account's default
  // attribution setting, which matches what Ads Manager displays. Specifying multiple
  // windows (e.g. 7d_click + 1d_view) causes conversions to be summed across windows,
  // inflating the count (e.g. 402 real leads → 840 reported).
  let url: string | null =
    `https://graph.facebook.com/${META_API_VERSION}/${actId}/insights` +
    `?fields=${fields}&level=campaign&time_range=${encodeURIComponent(timeRange)}&limit=5000&access_token=${token}`;

  while (url) {
    const resp = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    const data = await resp.json() as {
      data?: Array<{
        campaign_name: string;
        impressions: string;
        clicks: string;
        spend: string;
        reach?: string;
        frequency?: string;
        actions?: Array<{ action_type: string; value: string }>;
      }>;
      paging?: { next?: string };
      error?: { message: string; code: number };
    };

    if (!resp.ok || data.error) {
      const code = data.error?.code;
      if (code === 190) {
        return { rows: [], error: "Meta access token expired. Reconnect via OAuth or update META_ACCESS_TOKEN." };
      }
      return { rows: [], error: `Meta API error (${actId}): ${data.error?.message || resp.statusText}` };
    }

    if (data.data) {
      for (const row of data.data) {
        let leads = 0, purchases = 0, calls = 0;

        if (row.actions) {
          // Meta returns overlapping action types — "lead" is the AGGREGATE of
          // "onsite_conversion.lead_grouped" + "offsite_conversion.fb_pixel_lead".
          // Same for "purchase" vs its subtypes. We must NOT double-count.
          // Strategy: prefer aggregate type; only use specifics if aggregate is absent.

          // First pass: collect all action values by type
          const actionMap: Record<string, number> = {};
          for (const action of row.actions) {
            actionMap[action.action_type] = (actionMap[action.action_type] || 0) + (parseFloat(action.value) || 0);
          }

          // Leads: prefer "lead" aggregate; fall back to specifics
          if (actionMap["lead"]) {
            leads = actionMap["lead"];
          } else {
            leads =
              (actionMap["offsite_conversion.fb_pixel_lead"] || 0) +
              (actionMap["onsite_conversion.lead_grouped"] || 0) +
              (actionMap["onsite_conversion.leadgen_grouped"] || 0) +
              (actionMap["offsite_conversion.fb_pixel_complete_registration"] || 0) +
              (actionMap["complete_registration"] || 0) +
              (actionMap["contact"] || 0) +
              (actionMap["submit_application"] || 0) +
              (actionMap["offsite_conversion.fb_pixel_submit_application"] || 0) +
              (actionMap["onsite_conversion.messaging_conversation_started_7d"] || 0);
          }

          // Purchases: prefer "purchase" or "omni_purchase" aggregate; fall back to specifics
          if (actionMap["purchase"]) {
            purchases = actionMap["purchase"];
          } else if (actionMap["omni_purchase"]) {
            purchases = actionMap["omni_purchase"];
          } else {
            purchases =
              (actionMap["offsite_conversion.fb_pixel_purchase"] || 0) +
              (actionMap["onsite_web_purchase"] || 0) +
              (actionMap["onsite_conversion.purchase"] || 0);
          }

          // Calls: no aggregate exists, sum all call types
          calls =
            (actionMap["onsite_conversion.call_confirm"] || 0) +
            (actionMap["phone_call"] || 0);
        }

        rows.push({
          campaign: row.campaign_name,
          impressions: parseInt(row.impressions) || 0,
          clicks: parseInt(row.clicks) || 0,
          spend: parseFloat(row.spend) || 0,
          leads,
          purchases,
          calls,
          reach: parseInt(row.reach || "0") || 0,
          frequency: parseFloat(row.frequency || "0") || 0,
        });
      }
    }

    url = data.paging?.next || null;
  }

  return { rows };
}

// ══════════════════════════════════════════════════════════════════════════════
// GOOGLE ADS API — Direct Integration
// ══════════════════════════════════════════════════════════════════════════════

/** Refresh a Google OAuth2 access token */
async function refreshGoogleToken(): Promise<string> {
  const clientId = await requireSecret("GOOGLE_CLIENT_ID", "Google Client ID");
  const clientSecret = await requireSecret("GOOGLE_CLIENT_SECRET", "Google Client Secret");
  const refreshToken = await requireSecret("GOOGLE_ADS_REFRESH_TOKEN", "Google Ads Refresh Token");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await resp.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Google token refresh failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

/** Build Google Ads API headers */
async function buildGoogleAdsHeaders(accessToken: string): Promise<Record<string, string>> {
  const developerToken = await requireSecret("GOOGLE_ADS_DEVELOPER_TOKEN", "Google Ads Developer Token");
  const loginCustomerId = await getSecret("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  return headers;
}

interface GoogleCampaignRow {
  campaign: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  phone_calls: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

/** Fetch campaign-level performance via GAQL */
async function fetchGoogleAdsCampaigns(
  accessToken: string, customerId: string, startDate: string, endDate: string,
): Promise<{ rows: GoogleCampaignRow[]; error?: string }> {
  const headers = await buildGoogleAdsHeaders(accessToken);
  const cleanCustomerId = customerId.replace(/-/g, "");

  const query = `SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.all_conversions, metrics.phone_calls, metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'`;

  const resp = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }), signal: AbortSignal.timeout(45_000) },
  );

  if (!resp.ok) {
    const text = await resp.text();
    let errMsg = text;
    try { const e = JSON.parse(text); errMsg = e?.error?.message || e?.[0]?.error?.message || text; } catch {}
    return { rows: [], error: `Google Ads API error (${customerId}): ${errMsg}` };
  }

  const data = await resp.json() as Array<{ results?: Array<{ campaign?: { name?: string }; metrics?: { impressions?: string; clicks?: string; costMicros?: string; allConversions?: number; phoneCalls?: number; ctr?: number; averageCpc?: number; costPerConversion?: number } }> }>;

  const rows: GoogleCampaignRow[] = [];
  for (const batch of data) {
    if (!batch.results) continue;
    for (const result of batch.results) {
      const m = result.metrics;
      if (!m) continue;
      const costMicros = parseInt(m.costMicros || "0") || 0;
      const spend = costMicros / 1_000_000;
      const impressions = parseInt(m.impressions || "0") || 0;
      const clicks = parseInt(m.clicks || "0") || 0;
      const conversions = m.allConversions || 0;
      const phone_calls = m.phoneCalls || 0;

      rows.push({
        campaign: result.campaign?.name || "Unknown",
        impressions,
        clicks,
        spend,
        conversions,
        phone_calls,
        ctr: (m.ctr || 0) * 100,
        cpc: (Number(m.averageCpc) || 0) / 1_000_000,
        cpa: (m.costPerConversion || 0) / 1_000_000,
      });
    }
  }

  return { rows };
}

interface GoogleConvActionRow {
  campaign: string;
  actionName: string;
  conversions: number;
  type: "leads" | "purchases" | "calls" | "other";
}

/**
 * Fetch conversions segmented by campaign + conversion action via GAQL.
 * This is the single source of truth for conversion counts — matches exactly
 * what Google Ads UI shows. Works for both account-level and MCC-level
 * conversion tracking. Replaces the old separate conversion_action resource
 * query which failed for most accounts.
 */
async function fetchGoogleAdsConversionsByAction(
  accessToken: string, customerId: string, startDate: string, endDate: string,
): Promise<{ rows: GoogleConvActionRow[]; error?: string }> {
  const headers = await buildGoogleAdsHeaders(accessToken);
  const cleanCustomerId = customerId.replace(/-/g, "");

  // Segment by campaign + segments.conversion_action_name — this is how the Google Ads UI
  // counts conversions. Works for MCC-level and account-level tracking alike.
  // NOTE: conversion_action is an incompatible resource with FROM campaign — must use
  // segments.conversion_action_name instead.
  // Fetch BOTH metrics:
  //   metrics.conversions     = standard "Include in Conversions" column (matches UI, integer)
  //   metrics.all_conversions = includes conversions excluded from standard column (needed for calls)
  // For leads/purchases: use metrics.conversions to match Google Ads UI and avoid fractional values.
  // For calls: use metrics.all_conversions to capture call conversions excluded from standard tracking.
  const query = `SELECT campaign.name, segments.conversion_action_name, metrics.conversions, metrics.all_conversions FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED' AND (metrics.conversions > 0 OR metrics.all_conversions > 0)`;

  const resp = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }), signal: AbortSignal.timeout(45_000) },
  );

  if (!resp.ok) {
    const text = await resp.text();
    let errMsg = text;
    try { const e = JSON.parse(text); errMsg = e?.error?.message || e?.[0]?.error?.message || text; } catch {}
    return { rows: [], error: `Google Ads conversion query error (${customerId}): ${errMsg}` };
  }

  const data = await resp.json() as Array<{ results?: Array<{ campaign?: { name?: string }; segments?: { conversionActionName?: string }; metrics?: { allConversions?: number; conversions?: number } }> }>;

  const rows: GoogleConvActionRow[] = [];
  for (const batch of data) {
    if (!batch.results) continue;
    for (const result of batch.results) {
      const campaignName = result.campaign?.name || "Unknown";
      const actionName = result.segments?.conversionActionName || "";
      const type = classifyConversionAction(actionName);

      // For calls: use all_conversions to capture call conversions excluded from the standard
      // "Include in Conversions" column (metrics.conversions misses them for many accounts).
      // For leads/purchases: use metrics.conversions — this matches exactly what the Google Ads
      // UI shows and returns integer values, avoiding fractional attribution artifacts.
      const stdConversions = result.metrics?.conversions ?? 0;
      const allConversions = result.metrics?.allConversions ?? 0;
      const conversions = type === "calls" ? allConversions : stdConversions;

      if (conversions === 0) continue;
      rows.push({
        campaign: campaignName,
        actionName,
        conversions,
        type,
      });
    }
  }

  const total = rows.reduce((s, r) => s + r.conversions, 0);
  const otherRows = rows.filter(r => r.type === "other");
  if (otherRows.length > 0) {
    console.log(`[ad-metrics][google_ads] Skipping ${otherRows.length} micro-conversion row(s) for ${customerId}: ${[...new Set(otherRows.map(r => r.actionName))].join(", ")}`);
  }
  console.log(`[ad-metrics][google_ads] Conversion rows for ${customerId}: ${rows.length} rows, ${total} total conversions (${rows.filter(r => r.type !== "other").length} real)`);
  return { rows };
}

// ══════════════════════════════════════════════════════════════════════════════
// REDDIT ADS API — Direct Integration
// ══════════════════════════════════════════════════════════════════════════════

interface RedditCampaignRow {
  campaign: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

/** Fetch campaign-level performance from Reddit Ads API */
async function fetchRedditInsights(
  token: string, accountId: string, startDate: string, endDate: string,
): Promise<{ rows: RedditCampaignRow[]; error?: string }> {
  const USER_AGENT = "MellekaTeams/1.0 (by /u/MellekaMarketing)";
  const baseUrl = "https://ads-api.reddit.com/api/v3";

  // Reddit Ads API v3 requires ISO 8601 timestamps at hourly granularity (YYYY-MM-DDTHH:00:00Z).
  // ends_at is EXCLUSIVE — to include the full endDate day, advance by 1 day.
  const startsAt = `${startDate}T00:00:00Z`;
  const endDatePlusOne = new Date(`${endDate}T00:00:00Z`);
  endDatePlusOne.setUTCDate(endDatePlusOne.getUTCDate() + 1);
  const endsAt = endDatePlusOne.toISOString().slice(0, 10) + "T00:00:00Z";

  // First get all campaigns for name lookup
  const campaignsResp = await fetch(
    `${baseUrl}/ad_accounts/${encodeURIComponent(accountId)}/campaigns`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(45_000) },
  );

  if (!campaignsResp.ok) {
    const errData = await campaignsResp.json().catch(() => ({}));
    return { rows: [], error: `Reddit Ads campaigns error (${accountId}): ${errData?.message || campaignsResp.statusText}` };
  }

  const campaignsData = await campaignsResp.json() as { data?: Array<{ id: string; name: string }> };
  const campaignNames: Record<string, string> = {};
  for (const c of campaignsData.data ?? []) {
    campaignNames[c.id] = c.name;
  }

  // Reports endpoint requires POST with JSON body — GET returns 404.
  // Spend is in microcurrency (divide by 1,000,000 to get dollars).
  const reportsResp = await fetch(
    `${baseUrl}/ad_accounts/${encodeURIComponent(accountId)}/reports`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          starts_at: startsAt,
          ends_at: endsAt,
          fields: ["CAMPAIGN_ID", "SPEND", "IMPRESSIONS", "CLICKS", "CTR", "CPC"],
        },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!reportsResp.ok) {
    const errData = await reportsResp.json().catch(() => ({}));
    return { rows: [], error: `Reddit Ads reports error (${accountId}): ${JSON.stringify(errData)}` };
  }

  const reportsData = await reportsResp.json() as {
    data?: {
      metrics?: Array<{
        campaign_id?: string;
        spend?: number;        // microcurrency — divide by 1,000,000
        impressions?: number;
        clicks?: number;
        ctr?: number;
        cpc?: number;
      }>;
    };
  };

  const rows: RedditCampaignRow[] = [];
  for (const metric of reportsData.data?.metrics ?? []) {
    const spend = (metric.spend || 0) / 1_000_000; // microcurrency → dollars
    rows.push({
      campaign: campaignNames[metric.campaign_id || ""] || metric.campaign_id || "Unknown",
      impressions: metric.impressions || 0,
      clicks: metric.clicks || 0,
      spend,
      conversions: 0, // Reddit doesn't return conversions in standard reports
    });
  }

  console.log(`[ad-metrics][reddit_ads] Got ${rows.length} rows for ${accountId}, total spend: $${rows.reduce((s, r) => s + r.spend, 0).toFixed(2)}`);
  return { rows };
}

/** Build summary from Reddit campaign rows */
function buildRedditSummary(rows: RedditCampaignRow[]): SummaryMetrics {
  let impressions = 0, clicks = 0, spend = 0, conversions = 0;

  for (const row of rows) {
    impressions += row.impressions;
    clicks += row.clicks;
    spend += row.spend;
    conversions += row.conversions;
  }

  return {
    spend: round2(spend),
    clicks,
    impressions,
    conversions,
    leads: conversions, // Reddit doesn't break down conversion types
    purchases: 0,
    calls: 0,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpa: conversions > 0 ? round2(spend / conversions) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    cpl: conversions > 0 ? round2(spend / conversions) : 0,
  };
}

/** Build campaigns from Reddit campaign rows */
function buildRedditCampaigns(rows: RedditCampaignRow[]): CampaignMetrics[] {
  const campMap: Record<string, { impressions: number; clicks: number; spend: number; conversions: number }> = {};

  for (const row of rows) {
    if (!row.campaign) continue;
    if (!campMap[row.campaign]) campMap[row.campaign] = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    campMap[row.campaign].impressions += row.impressions;
    campMap[row.campaign].clicks += row.clicks;
    campMap[row.campaign].spend += row.spend;
    campMap[row.campaign].conversions += row.conversions;
  }

  return Object.entries(campMap)
    .filter(([_, v]) => v.spend > 0 || v.clicks > 0)
    .map(([name, v]) => ({
      name,
      spend: round2(v.spend),
      impressions: v.impressions,
      clicks: v.clicks,
      conversions: v.conversions,
      leads: v.conversions,
      purchases: 0,
      calls: 0,
      ctr: v.impressions > 0 ? round2((v.clicks / v.impressions) * 100) : 0,
      cpc: v.clicks > 0 ? round2(v.spend / v.clicks) : 0,
      cpa: v.conversions > 0 ? round2(v.spend / v.conversions) : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILDERS — Build summary/campaign metrics from parsed API data
// ══════════════════════════════════════════════════════════════════════════════

interface SummaryMetrics {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  leads: number;
  purchases: number;
  calls: number;
  ctr: number;
  cpc: number;
  cpa: number;
  cpm: number;
  cpl: number;
  reach?: number;
}

interface CampaignMetrics {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  purchases: number;
  calls: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

/** Build summary from Meta campaign rows */
function buildMetaSummary(rows: MetaCampaignRow[]): SummaryMetrics {
  let impressions = 0, clicks = 0, spend = 0, reach = 0;
  let leads = 0, purchases = 0, calls = 0;

  for (const row of rows) {
    impressions += row.impressions;
    clicks += row.clicks;
    spend += row.spend;
    reach += row.reach;
    leads += row.leads;
    purchases += row.purchases;
    calls += row.calls;
  }

  const conversions = leads + purchases + calls;
  const summary: SummaryMetrics = {
    spend: round2(spend),
    clicks,
    impressions,
    conversions,
    leads,
    purchases,
    calls,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpa: conversions > 0 ? round2(spend / conversions) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    cpl: leads > 0 ? round2(spend / leads) : 0,
  };
  if (reach > 0) summary.reach = reach;
  return summary;
}

/** Build campaigns from Meta campaign rows */
function buildMetaCampaigns(rows: MetaCampaignRow[]): CampaignMetrics[] {
  const campMap: Record<string, { impressions: number; clicks: number; spend: number; leads: number; purchases: number; calls: number }> = {};

  for (const row of rows) {
    if (!row.campaign) continue;
    if (!campMap[row.campaign]) campMap[row.campaign] = { impressions: 0, clicks: 0, spend: 0, leads: 0, purchases: 0, calls: 0 };
    campMap[row.campaign].impressions += row.impressions;
    campMap[row.campaign].clicks += row.clicks;
    campMap[row.campaign].spend += row.spend;
    campMap[row.campaign].leads += row.leads;
    campMap[row.campaign].purchases += row.purchases;
    campMap[row.campaign].calls += row.calls;
  }

  return Object.entries(campMap)
    .filter(([_, v]) => v.spend > 0 || v.clicks > 0)
    .map(([name, v]) => {
      const conversions = v.leads + v.purchases + v.calls;
      return {
        name,
        spend: round2(v.spend),
        impressions: v.impressions,
        clicks: v.clicks,
        conversions,
        leads: v.leads,
        purchases: v.purchases,
        calls: v.calls,
        ctr: v.impressions > 0 ? round2((v.clicks / v.impressions) * 100) : 0,
        cpc: v.clicks > 0 ? round2(v.spend / v.clicks) : 0,
        cpa: conversions > 0 ? round2(v.spend / conversions) : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

/** Build summary from Google Ads campaign rows + conversion action rows */
function buildGoogleSummary(
  rows: GoogleCampaignRow[],
  convRows: GoogleConvActionRow[],
): SummaryMetrics {
  let impressions = 0, clicks = 0, spend = 0;
  for (const row of rows) {
    impressions += row.impressions;
    clicks += row.clicks;
    spend += row.spend;
  }

  // Sum conversions directly from the segmented conversion action query.
  // Skip "other" rows (GA4 micro-conversions like session_start, page_view, scroll)
  // which appear in metrics.all_conversions but are not real business conversions.
  let leads = 0, purchases = 0, calls = 0;
  for (const r of convRows) {
    if (r.type === "other") continue;
    if (r.type === "calls") calls += r.conversions;
    else if (r.type === "purchases") purchases += r.conversions;
    else leads += r.conversions;
  }

  // Only fall back to campaign-level metrics.conversions if the conversion action
  // query returned NO rows at all (API error / empty account). If it returned rows
  // but they were all micro-conversions, trust that and show 0 real conversions —
  // do NOT fall back, because campaign-level all_conversions also includes those micro-conversions.
  if (leads + purchases + calls === 0 && convRows.length === 0) {
    const fallback = rows.reduce((s, r) => s + (r.conversions || 0), 0);
    if (fallback > 0) {
      leads = fallback;
      console.warn(`[ad-metrics][google_ads] Conversion action query returned 0 rows; falling back to campaign-level metrics.conversions (${fallback})`);
    }
  }

  // If no calls found via conversion actions, fall back to metrics.phone_calls from
  // campaign rows. These are calls from call extensions that aren't tracked as conversion
  // actions — they show up in the Google Ads UI "Calls" column but not in conversion tracking.
  if (calls === 0) {
    const phoneCalls = rows.reduce((s, r) => s + (r.phone_calls || 0), 0);
    if (phoneCalls > 0) {
      calls = phoneCalls;
      console.log(`[ad-metrics][google_ads] Using phone_calls metric (${phoneCalls}) since no call conversion actions found`);
    }
  }

  const conversions = leads + purchases + calls;
  return {
    spend: round2(spend),
    clicks,
    impressions,
    conversions: round2(conversions),
    leads: round2(leads),
    purchases: round2(purchases),
    calls: round2(calls),
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpa: conversions > 0 ? round2(spend / conversions) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    cpl: leads > 0 ? round2(spend / leads) : 0,
  };
}

/** Build campaigns from Google Ads campaign rows + conversion action rows */
function buildGoogleCampaigns(
  rows: GoogleCampaignRow[],
  convRows: GoogleConvActionRow[],
): CampaignMetrics[] {
  // Base metrics (spend, clicks, impressions) from campaign query
  const campMap: Record<string, { impressions: number; clicks: number; spend: number }> = {};
  for (const row of rows) {
    if (!row.campaign) continue;
    if (!campMap[row.campaign]) campMap[row.campaign] = { impressions: 0, clicks: 0, spend: 0 };
    campMap[row.campaign].impressions += row.impressions;
    campMap[row.campaign].clicks += row.clicks;
    campMap[row.campaign].spend += row.spend;
  }

  // Exact conversion counts per campaign from the segmented conversion action query.
  // Skip "other" (GA4 micro-conversions) — not real business conversions.
  const campConvMap: Record<string, { leads: number; purchases: number; calls: number }> = {};
  for (const r of convRows) {
    if (r.type === "other") continue;
    if (!campConvMap[r.campaign]) campConvMap[r.campaign] = { leads: 0, purchases: 0, calls: 0 };
    if (r.type === "calls") campConvMap[r.campaign].calls += r.conversions;
    else if (r.type === "purchases") campConvMap[r.campaign].purchases += r.conversions;
    else campConvMap[r.campaign].leads += r.conversions;
  }

  // Fall back to campaign-level metrics ONLY when the conversion action query returned
  // no rows at all (API error / empty account). When convRows exist but are all micro-
  // conversions (type="other"), show 0 — do NOT fall back to all_conversions which
  // includes those same micro-conversions and creates phantom lead counts.
  const hasConvData = convRows.length > 0;
  const campConvFallback: Record<string, number> = {};
  if (!hasConvData) {
    for (const row of rows) {
      if (!campConvFallback[row.campaign]) campConvFallback[row.campaign] = 0;
      campConvFallback[row.campaign] += row.conversions || 0;
    }
  }

  // Build per-campaign phone_calls map as fallback when no call conversion actions found
  const campPhoneCalls: Record<string, number> = {};
  for (const row of rows) {
    if (!campPhoneCalls[row.campaign]) campPhoneCalls[row.campaign] = 0;
    campPhoneCalls[row.campaign] += row.phone_calls || 0;
  }

  return Object.entries(campMap)
    .filter(([_, v]) => v.spend > 0 || v.clicks > 0)
    .map(([name, v]) => {
      const conv = campConvMap[name] || { leads: 0, purchases: 0, calls: 0 };
      const leads = hasConvData ? conv.leads : (campConvFallback[name] || 0);
      const purchases = hasConvData ? conv.purchases : 0;
      // Use call conversion actions if present; fall back to phone_calls (call extensions)
      // when no call conversion actions exist for this campaign.
      const calls = hasConvData ? (conv.calls || campPhoneCalls[name] || 0) : 0;
      const conversions = leads + purchases + calls;
      return {
        name,
        spend: round2(v.spend),
        impressions: v.impressions,
        clicks: v.clicks,
        conversions,
        leads,
        purchases,
        calls,
        ctr: v.impressions > 0 ? round2((v.clicks / v.impressions) * 100) : 0,
        cpc: v.clicks > 0 ? round2(v.spend / v.clicks) : 0,
        cpa: conversions > 0 ? round2(v.spend / conversions) : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPERMETRICS CROSS-CHECK — Verifies Google Ads + Meta Ads direct API data.
// Runs in parallel with direct API calls. Used as:
//   1. Fallback when direct API returns 0 spend or errors
//   2. Discrepancy alert when numbers differ by >15%
// ══════════════════════════════════════════════════════════════════════════════

interface SupermetricsCheckResult {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  source: "supermetrics";
}

/** Pull total spend/clicks/impressions/conversions from Supermetrics for one account */
async function fetchSupermetricsCheck(
  apiKey: string,
  dsId: string, // "AW" for Google Ads, "FA" for Meta
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<SupermetricsCheckResult | null> {
  const fields = dsId === "AW"
    ? "campaign,impressions,clicks,cost,conversions"
    : "campaign_name,impressions,clicks,spend,conversions";

  try {
    const queryBody = {
      ds_id: dsId,
      ds_accounts: accountId,
      start_date: startDate,
      end_date: endDate,
      fields,
      max_rows: 5000,
      settings: { no_headers: false },
    };

    const response = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(queryBody),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) return null;

    const data = await response.json() as { data?: (string | number)[][] };
    if (!data.data || data.data.length < 2) return null;

    const headers = (data.data[0] as string[]).map(h => h.toLowerCase().replace(/\s+/g, "_"));
    const spendIdx = headers.findIndex(h => h === "cost" || h === "spend");
    const clicksIdx = headers.findIndex(h => h.includes("click"));
    const imprIdx = headers.findIndex(h => h.includes("impression"));
    const convIdx = headers.findIndex(h => h.includes("conversion"));

    let spend = 0, clicks = 0, impressions = 0, conversions = 0;
    for (const row of data.data.slice(1) as (string | number)[][]) {
      spend += parseFloat(String(row[spendIdx] || 0)) || 0;
      clicks += parseFloat(String(row[clicksIdx] || 0)) || 0;
      impressions += parseFloat(String(row[imprIdx] || 0)) || 0;
      conversions += parseFloat(String(row[convIdx] || 0)) || 0;
    }

    return { spend: round2(spend), clicks: Math.round(clicks), impressions: Math.round(impressions), conversions: Math.round(conversions), source: "supermetrics" };
  } catch {
    return null;
  }
}

/**
 * Compare direct API result against Supermetrics.
 * If direct API has 0 spend but Supermetrics has data, returns Supermetrics data as fallback.
 * Logs a warning if spend differs by >15%.
 */
function reconcileWithSupermetrics(
  label: string,
  directSpend: number,
  smResult: SupermetricsCheckResult | null,
): { useFallback: boolean; fallback: SupermetricsCheckResult | null } {
  if (!smResult) return { useFallback: false, fallback: null };

  if (directSpend === 0 && smResult.spend > 0) {
    console.warn(`[ad-metrics][${label}] Direct API returned $0 spend but Supermetrics shows $${smResult.spend}. Using Supermetrics as fallback.`);
    return { useFallback: true, fallback: smResult };
  }

  if (directSpend > 0 && smResult.spend > 0) {
    const diff = Math.abs(directSpend - smResult.spend) / smResult.spend;
    if (diff > 0.15) {
      console.warn(`[ad-metrics][${label}] Spend discrepancy >15%: direct=$${directSpend} vs supermetrics=$${smResult.spend} (${(diff * 100).toFixed(1)}% diff). Using direct API but flagging.`);
    } else {
      console.log(`[ad-metrics][${label}] Supermetrics cross-check passed: direct=$${directSpend} vs sm=$${smResult.spend}`);
    }
  }

  return { useFallback: false, fallback: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPERMETRICS FALLBACK — For TikTok, Bing, LinkedIn only
// ══════════════════════════════════════════════════════════════════════════════

function getNum(row: (string | number)[], col: Record<string, number>, key: string): number {
  const idx = col[key];
  if (idx === undefined || idx >= row.length) return 0;
  const val = parseFloat(String(row[idx] || "0"));
  return isNaN(val) ? 0 : val;
}

function getStr(row: (string | number)[], col: Record<string, number>, key: string): string {
  const idx = col[key];
  if (idx === undefined || idx >= row.length) return "";
  return String(row[idx] || "");
}

function buildColumnMap(expectedOrder: string[], _actualHeaders: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < expectedOrder.length && i < _actualHeaders.length; i++) {
    map[expectedOrder[i]] = i;
  }
  return map;
}

async function queryViaGet(
  apiKey: string, dsId: string, accountId: string,
  dateStart: string, dateEnd: string, fields: string,
): Promise<{ headers: string[]; rows: (string | number)[][]; error?: string }> {
  try {
    const queryParams = {
      api_key: apiKey, ds_id: dsId, ds_accounts: [accountId],
      start_date: dateStart, end_date: dateEnd,
      fields: fields.split(",").map(f => f.trim()),
      max_rows: 5000, settings: { no_headers: false },
    };
    const url = `${SUPERMETRICS_API_URL}/query/data/json?json=${encodeURIComponent(JSON.stringify(queryParams))}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(45_000) });
    if (!response.ok) {
      const text = await response.text();
      let errMsg = text;
      try { const e = JSON.parse(text); errMsg = e?.error?.description || e?.error?.message || text; } catch {}
      return { headers: [], rows: [], error: errMsg };
    }
    const data = await response.json() as { data?: (string | number)[][] };
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return { headers: [], rows: [] };
    }
    const headers = data.data[0] as string[];
    const rows = data.data.slice(1) as (string | number)[][];
    console.log(`[ad-metrics][${dsId}] GET fallback got ${rows.length} rows`);
    return { headers, rows };
  } catch (err) {
    return { headers: [], rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function queryWithRetry(
  apiKey: string, dsId: string, accountId: string,
  dateStart: string, dateEnd: string, fields: string, maxRetries = 2,
): Promise<{ headers: string[]; rows: (string | number)[][]; error?: string }> {
  let lastError = "";
  let hitPrioritisedError = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const queryBody = {
        ds_id: dsId, ds_accounts: accountId,
        start_date: dateStart, end_date: dateEnd,
        fields, max_rows: 5000, settings: { no_headers: false },
      };

      const response = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(queryBody),
        signal: AbortSignal.timeout(45_000),
      });

      if (!response.ok) {
        const text = await response.text();
        let errMsg = text;
        try {
          const errObj = JSON.parse(text);
          errMsg = errObj?.error?.description || errObj?.error?.message || text;
          if (errMsg.includes("prioritised account")) {
            console.warn(`[ad-metrics][${dsId}] Prioritised account error for ${accountId}, trying GET fallback...`);
            hitPrioritisedError = true;
            break;
          }
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            return { headers: [], rows: [], error: errMsg };
          }
        } catch { /* use raw text */ }
        lastError = errMsg;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        return { headers: [], rows: [], error: errMsg };
      }

      const data = await response.json() as { data?: (string | number)[][] };
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        return { headers: [], rows: [] };
      }

      const headers = data.data[0] as string[];
      const rows = data.data.slice(1) as (string | number)[][];
      console.log(`[ad-metrics][${dsId}] Got ${rows.length} rows for ${accountId}`);
      return { headers, rows };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
  }

  if (hitPrioritisedError) {
    const getResult = await queryViaGet(apiKey, dsId, accountId, dateStart, dateEnd, fields);
    if (getResult.rows.length > 0 || !getResult.error) return getResult;
    lastError = getResult.error || lastError;
  }

  return { headers: [], rows: [], error: lastError || "Unknown error after retries" };
}

function buildSupermetricsSummary(
  rows: (string | number)[][], col: Record<string, number>, dsId: string,
): SummaryMetrics {
  let impressions = 0, clicks = 0, cost = 0, conversions = 0, reach = 0;

  for (const row of rows) {
    impressions += getNum(row, col, "impressions");
    clicks += getNum(row, col, "clicks");
    cost += getNum(row, col, "cost");
    conversions += getNum(row, col, "conversions");
    reach += getNum(row, col, "reach");
  }

  const summary: SummaryMetrics = {
    spend: round2(cost),
    clicks,
    impressions,
    conversions,
    leads: conversions, // default all to leads for these platforms
    purchases: 0,
    calls: 0,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(cost / clicks) : 0,
    cpa: conversions > 0 ? round2(cost / conversions) : 0,
    cpm: impressions > 0 ? round2((cost / impressions) * 1000) : 0,
    cpl: conversions > 0 ? round2(cost / conversions) : 0,
  };
  if (reach > 0) summary.reach = reach;
  return summary;
}

function buildSupermetricsCampaigns(
  rows: (string | number)[][], col: Record<string, number>, _dsId: string,
): CampaignMetrics[] {
  const campMap: Record<string, { impressions: number; clicks: number; cost: number; conversions: number }> = {};

  for (const row of rows) {
    const name = getStr(row, col, "campaign");
    if (!name) continue;
    if (!campMap[name]) campMap[name] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    campMap[name].impressions += getNum(row, col, "impressions");
    campMap[name].clicks += getNum(row, col, "clicks");
    campMap[name].cost += getNum(row, col, "cost");
    campMap[name].conversions += getNum(row, col, "conversions");
  }

  return Object.entries(campMap)
    .filter(([_, v]) => v.cost > 0 || v.clicks > 0)
    .map(([name, v]) => ({
      name,
      spend: round2(v.cost),
      impressions: v.impressions,
      clicks: v.clicks,
      conversions: v.conversions,
      leads: v.conversions,
      purchases: 0,
      calls: 0,
      ctr: v.impressions > 0 ? round2((v.clicks / v.impressions) * 100) : 0,
      cpc: v.clicks > 0 ? round2(v.cost / v.clicks) : 0,
      cpa: v.conversions > 0 ? round2(v.cost / v.conversions) : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// ══════════════════════════════════════════════════════════════════════════════
// GA4 — Direct Supermetrics query, website analytics
// ══════════════════════════════════════════════════════════════════════════════

interface GA4Data {
  label: string;
  sessions: number;
  users: number;
  new_users: number;
  pageviews: number;
  conversions: number;
  engagement_rate: number; // avg across days (0–100)
  bounce_rate: number;     // avg across days (0–100)
  avg_session_duration: number; // seconds
}

async function fetchGA4Data(
  apiKey: string, accountId: string, startDate: string, endDate: string,
): Promise<GA4Data | null> {
  const fields = "Date,Sessions,Users,NewUsers,ScreenPageViews,Conversions,EngagementRate,BounceRate,AverageSessionDuration";
  const result = await queryWithRetry(apiKey, "GAWA", accountId, startDate, endDate, fields, 2);
  if (result.error || result.rows.length === 0) {
    if (result.error) console.warn(`[ad-metrics][ga4] Supermetrics error for ${accountId}: ${result.error}`);
    return null;
  }

  // Map by actual header names (case-insensitive) for robustness
  const hdrs = result.headers.map(h => String(h).toLowerCase().replace(/\s+/g, ""));
  const idx = (keys: string[]) => {
    for (const k of keys) { const i = hdrs.findIndex(h => h.includes(k)); if (i >= 0) return i; }
    return -1;
  };
  const iSess = idx(["session"]);
  const iUsers = idx(["activeuser", "totaluser", "user"]);
  const iNew = idx(["newuser", "new_user"]);
  const iPages = idx(["screenpageview", "pageview"]);
  const iConv = idx(["conversion"]);
  const iEng = idx(["engagementrate", "engagement"]);
  const iBounce = idx(["bouncerate", "bounce"]);
  const iDur = idx(["averagesessionduration", "sessionduration", "duration"]);

  const get = (row: (string | number)[], i: number) =>
    i >= 0 ? parseFloat(String(row[i] || 0)) || 0 : 0;

  let sessions = 0, users = 0, newUsers = 0, pageviews = 0, conversions = 0;
  let totalEng = 0, totalBounce = 0, totalDur = 0;

  for (const row of result.rows) {
    sessions += get(row, iSess);
    users += get(row, iUsers);
    newUsers += get(row, iNew);
    pageviews += get(row, iPages);
    conversions += get(row, iConv);
    totalEng += get(row, iEng);
    totalBounce += get(row, iBounce);
    totalDur += get(row, iDur);
  }

  const n = result.rows.length;
  return {
    label: "Google Analytics 4",
    sessions: Math.round(sessions),
    users: Math.round(users),
    new_users: Math.round(newUsers),
    pageviews: Math.round(pageviews),
    conversions: Math.round(conversions),
    engagement_rate: n > 0 ? round2(totalEng / n) : 0,
    bounce_rate: n > 0 ? round2(totalBounce / n) : 0,
    avg_session_duration: n > 0 ? round2(totalDur / n) : 0,
  };
}

/** Get a short-lived access token for the Google Service Account (analytics.readonly scope) */
async function getGA4ServiceAccountToken(): Promise<string> {
  const saJson = await requireSecret("GOOGLE_SERVICE_ACCOUNT_JSON", "Google Service Account JSON");
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string };
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${jwtPayload}`);
  const signature = signer.sign(sa.private_key, "base64url");
  const jwt = `${header}.${jwtPayload}.${signature}`;

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await resp.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) throw new Error(`GA4 SA auth failed: ${data.error} — ${data.error_description || ""}`);
  return data.access_token;
}

/**
 * Fetch GA4 aggregate metrics directly from the GA4 Data API (service account auth).
 * Returns totals for the date range — no dimensions, just aggregate numbers.
 */
async function fetchGA4DirectData(
  accessToken: string, propertyId: string, startDate: string, endDate: string,
): Promise<GA4Data | null> {
  const body = {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "screenPageViews" },
      { name: "conversions" },
      { name: "engagementRate" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
    ],
  };

  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    const msg = (errData as { error?: { message?: string } }).error?.message || resp.statusText;
    console.warn(`[ad-metrics][ga4-direct] API error for property ${propertyId}: ${msg}`);
    return null;
  }

  const data = await resp.json() as {
    rows?: Array<{ metricValues?: Array<{ value: string }> }>;
    totals?: Array<{ metricValues?: Array<{ value: string }> }>;
  };

  // Without dimensions the API returns a single aggregate row
  const row = data.rows?.[0] ?? data.totals?.[0];
  if (!row?.metricValues || row.metricValues.length === 0) return null;

  const v = row.metricValues.map(m => parseFloat(m.value) || 0);
  // Order matches the metrics array above:
  // [0] sessions, [1] totalUsers, [2] newUsers, [3] screenPageViews,
  // [4] conversions, [5] engagementRate (decimal 0–1), [6] bounceRate (decimal 0–1), [7] avgSessionDuration (seconds)
  return {
    label: "Google Analytics 4",
    sessions: Math.round(v[0] ?? 0),
    users: Math.round(v[1] ?? 0),
    new_users: Math.round(v[2] ?? 0),
    pageviews: Math.round(v[3] ?? 0),
    conversions: Math.round(v[4] ?? 0),
    engagement_rate: round2((v[5] ?? 0) * 100), // API returns 0–1 decimal
    bounce_rate: round2((v[6] ?? 0) * 100),
    avg_session_duration: round2(v[7] ?? 0),
  };
}

/** Merge GA4 data from multiple properties by summing counts, averaging rates */
function mergeGA4Data(a: GA4Data, b: GA4Data): GA4Data {
  const totalSessions = a.sessions + b.sessions;
  // Weight rates by sessions so larger properties have more influence
  const engRate = totalSessions > 0
    ? round2((a.engagement_rate * a.sessions + b.engagement_rate * b.sessions) / totalSessions)
    : round2((a.engagement_rate + b.engagement_rate) / 2);
  const bounceRate = totalSessions > 0
    ? round2((a.bounce_rate * a.sessions + b.bounce_rate * b.sessions) / totalSessions)
    : round2((a.bounce_rate + b.bounce_rate) / 2);
  const avgDur = totalSessions > 0
    ? round2((a.avg_session_duration * a.sessions + b.avg_session_duration * b.sessions) / totalSessions)
    : round2((a.avg_session_duration + b.avg_session_duration) / 2);

  return {
    label: a.label,
    sessions: totalSessions,
    users: a.users + b.users,
    new_users: a.new_users + b.new_users,
    pageviews: a.pageviews + b.pageviews,
    conversions: a.conversions + b.conversions,
    engagement_rate: engRate,
    bounce_rate: bounceRate,
    avg_session_duration: avgDur,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM INSIGHTS — Organic social performance via Supermetrics
// ══════════════════════════════════════════════════════════════════════════════

interface InstagramInsightsData {
  label: string;
  impressions: number;
  reach: number;
  profile_visits: number;
  website_clicks: number;
  follower_count: number;
  follows: number;       // net new followers in period
  video_views: number;
  engagement_rate: number;
}

async function fetchInstagramInsightsData(
  apiKey: string, accountId: string, startDate: string, endDate: string,
): Promise<InstagramInsightsData | null> {
  const fields = "Date,Impressions,Reach,ProfileVisits,WebsiteClicks,FollowerCount,Follows,VideoViews,EngagementRate";
  const result = await queryWithRetry(apiKey, "IGI", accountId, startDate, endDate, fields, 2);
  if (result.error || result.rows.length === 0) {
    if (result.error) console.warn(`[ad-metrics][instagram_insights] Supermetrics error for ${accountId}: ${result.error}`);
    return null;
  }

  // Position-based mapping matching the field order above
  const col = buildColumnMap(
    ["date", "impressions", "reach", "profile_visits", "website_clicks", "follower_count", "follows", "video_views", "engagement_rate"],
    result.headers,
  );

  let impressions = 0, reach = 0, profileVisits = 0, websiteClicks = 0;
  let followerCount = 0, follows = 0, videoViews = 0, totalEngRate = 0;

  for (const row of result.rows) {
    impressions += getNum(row, col, "impressions");
    reach += getNum(row, col, "reach");
    profileVisits += getNum(row, col, "profile_visits");
    websiteClicks += getNum(row, col, "website_clicks");
    followerCount = Math.max(followerCount, getNum(row, col, "follower_count")); // latest value
    follows += getNum(row, col, "follows");
    videoViews += getNum(row, col, "video_views");
    totalEngRate += getNum(row, col, "engagement_rate");
  }

  const n = result.rows.length;
  return {
    label: "Instagram Insights",
    impressions: Math.round(impressions),
    reach: Math.round(reach),
    profile_visits: Math.round(profileVisits),
    website_clicks: Math.round(websiteClicks),
    follower_count: Math.round(followerCount),
    follows: Math.round(follows),
    video_views: Math.round(videoViews),
    engagement_rate: n > 0 ? round2(totalEngRate / n) : 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// KLAVIYO — Email marketing performance via Supermetrics
// ══════════════════════════════════════════════════════════════════════════════

interface KlaviyoCampaign {
  name: string;
  sent: number;
  opens: number;
  clicks: number;
  open_rate: number;
  click_rate: number;
  revenue: number;
  unsubscribes: number;
}

interface KlaviyoData {
  label: string;
  campaigns: KlaviyoCampaign[];
  total: {
    sent: number;
    opens: number;
    clicks: number;
    open_rate: number;
    click_rate: number;
    revenue: number;
    unsubscribes: number;
  };
}

async function fetchKlaviyoData(
  apiKey: string, accountId: string, startDate: string, endDate: string,
): Promise<KlaviyoData | null> {
  const fields = "Date,CampaignName,Recipients,Opens,Clicks,OpenRate,ClickRate,Revenue,Unsubscribes";
  const result = await queryWithRetry(apiKey, "KLAV", accountId, startDate, endDate, fields, 2);
  if (result.error || result.rows.length === 0) {
    if (result.error) console.warn(`[ad-metrics][klaviyo] Supermetrics error for ${accountId}: ${result.error}`);
    return null;
  }

  const col = buildColumnMap(
    ["date", "campaign", "sent", "opens", "clicks", "open_rate", "click_rate", "revenue", "unsubscribes"],
    result.headers,
  );

  const campMap: Record<string, { sent: number; opens: number; clicks: number; revenue: number; unsubscribes: number; openRates: number[]; clickRates: number[] }> = {};

  for (const row of result.rows) {
    const name = getStr(row, col, "campaign") || "Unknown Campaign";
    if (!campMap[name]) campMap[name] = { sent: 0, opens: 0, clicks: 0, revenue: 0, unsubscribes: 0, openRates: [], clickRates: [] };
    campMap[name].sent += getNum(row, col, "sent");
    campMap[name].opens += getNum(row, col, "opens");
    campMap[name].clicks += getNum(row, col, "clicks");
    campMap[name].revenue += getNum(row, col, "revenue");
    campMap[name].unsubscribes += getNum(row, col, "unsubscribes");
    const or = getNum(row, col, "open_rate");
    const cr = getNum(row, col, "click_rate");
    if (or > 0) campMap[name].openRates.push(or);
    if (cr > 0) campMap[name].clickRates.push(cr);
  }

  const campaigns: KlaviyoCampaign[] = Object.entries(campMap).map(([name, v]) => {
    const open_rate = v.openRates.length > 0
      ? round2(v.openRates.reduce((a, b) => a + b, 0) / v.openRates.length)
      : v.sent > 0 ? round2((v.opens / v.sent) * 100) : 0;
    const click_rate = v.clickRates.length > 0
      ? round2(v.clickRates.reduce((a, b) => a + b, 0) / v.clickRates.length)
      : v.sent > 0 ? round2((v.clicks / v.sent) * 100) : 0;
    return { name, sent: Math.round(v.sent), opens: Math.round(v.opens), clicks: Math.round(v.clicks), open_rate, click_rate, revenue: round2(v.revenue), unsubscribes: Math.round(v.unsubscribes) };
  });

  const total = campaigns.reduce(
    (acc, c) => ({ sent: acc.sent + c.sent, opens: acc.opens + c.opens, clicks: acc.clicks + c.clicks, revenue: acc.revenue + c.revenue, unsubscribes: acc.unsubscribes + c.unsubscribes, open_rate: 0, click_rate: 0 }),
    { sent: 0, opens: 0, clicks: 0, revenue: 0, unsubscribes: 0, open_rate: 0, click_rate: 0 },
  );
  total.open_rate = total.sent > 0 ? round2((total.opens / total.sent) * 100) : 0;
  total.click_rate = total.sent > 0 ? round2((total.clicks / total.sent) * 100) : 0;
  total.revenue = round2(total.revenue);

  console.log(`[ad-metrics][klaviyo] Got ${campaigns.length} campaigns for ${accountId}, $${total.revenue} total revenue`);
  return { label: "Klaviyo", campaigns, total };
}

// ── HUBSPOT CRM ──────────────────────────────────────────────────────────────

interface HubSpotCRMData {
  label: string;
  new_contacts: number;
  new_deals: number;
  new_deals_value: number;
  closed_won: number;
  closed_won_value: number;
  open_pipeline: number;
  open_pipeline_value: number;
}

/** Normalize client name to a secrets key. "La Photo Party" -> "HUBSPOT_API_KEY_LA_PHOTO_PARTY" */
function normalizeHubSpotKey(clientName: string): string {
  const suffix = clientName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `HUBSPOT_API_KEY_${suffix}`;
}

/**
 * Build auth headers + query param for a HubSpot credential.
 * Supports both Private App tokens (pat-...) and legacy API keys (UUID).
 * - Private App token: Authorization: Bearer header
 * - API key: ?hapikey= query param
 */
/** Legacy HubSpot API keys are UUID format. Private App tokens (all formats) are not. */
function isLegacyHubSpotApiKey(credential: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credential);
}

function buildHubSpotAuth(credential: string): { headers: Record<string, string>; qp: string } {
  const legacy = isLegacyHubSpotApiKey(credential);
  return {
    headers: legacy
      ? { "Content-Type": "application/json" }
      : { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
    // qp is the raw query string (no leading ? or &) — append as ?qp or &qp as needed
    qp: legacy ? `hapikey=${encodeURIComponent(credential)}` : "",
  };
}

/**
 * Fetch read-only CRM summary from HubSpot for the given date range.
 *
 * SECURITY: This function ONLY performs read operations.
 * - GET is used for simple lookups.
 * - POST is used ONLY for HubSpot's search/filter endpoints — these are
 *   data-retrieval operations (HubSpot's API design choice, not mutations).
 * - No PUT, PATCH, or DELETE calls are ever made to HubSpot.
 * Supports both Private App tokens and legacy API keys.
 */
async function fetchHubSpotData(
  credential: string, startDate: string, endDate: string,
): Promise<HubSpotCRMData | null> {
  const BASE = "https://api.hubapi.com";
  const { headers, qp } = buildHubSpotAuth(credential);

  // HubSpot filter timestamps are epoch milliseconds
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime().toString();
  const endMs = new Date(`${endDate}T23:59:59Z`).getTime().toString();

  /**
   * HubSpot search uses POST for complex filters — this is a READ-ONLY operation.
   * The search endpoint never creates, modifies, or deletes any CRM records.
   */
  const qs = qp ? `?${qp}` : "";

  const searchContacts = (body: object) =>
    fetch(`${BASE}/crm/v3/objects/contacts/search${qs}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

  const searchDeals = (body: object) =>
    fetch(`${BASE}/crm/v3/objects/deals/search${qs}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

  const parseCount = async (resp: Response): Promise<number> => {
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as any;
      console.warn(`[ad-metrics][hubspot] Search ${resp.status}:`, err?.message || "");
      return 0;
    }
    const json = (await resp.json()) as { total?: number };
    return json.total || 0;
  };

  const parseDeals = async (resp: Response): Promise<{ count: number; value: number }> => {
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as any;
      console.warn(`[ad-metrics][hubspot] Deal search ${resp.status}:`, err?.message || "");
      return { count: 0, value: 0 };
    }
    const json = (await resp.json()) as {
      total?: number;
      results?: { properties?: { amount?: string } }[];
    };
    const count = json.total || 0;
    const value = (json.results || []).reduce((sum, d) => {
      const amt = parseFloat(d.properties?.amount || "0");
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
    return { count, value: Math.round(value * 100) / 100 };
  };

  try {
    const [contactsResp, newDealsResp, closedWonResp, openDealsResp] = await Promise.all([
      // New contacts created in period
      searchContacts({
        filterGroups: [{
          filters: [{ propertyName: "createdate", operator: "BETWEEN", value: startMs, highValue: endMs }],
        }],
        properties: ["createdate"],
        limit: 1,
      }),
      // New deals created in period
      searchDeals({
        filterGroups: [{
          filters: [{ propertyName: "createdate", operator: "BETWEEN", value: startMs, highValue: endMs }],
        }],
        properties: ["dealname", "amount", "createdate"],
        limit: 100,
      }),
      // Deals closed-won in period (read-only filter; "closedwon" is HubSpot's default stage ID)
      searchDeals({
        filterGroups: [{
          filters: [
            { propertyName: "closedate", operator: "BETWEEN", value: startMs, highValue: endMs },
            { propertyName: "dealstage", operator: "EQ", value: "closedwon" },
          ],
        }],
        properties: ["dealname", "amount", "closedate"],
        limit: 100,
      }),
      // Open deals (not yet closed — read-only snapshot of current pipeline)
      searchDeals({
        filterGroups: [{
          filters: [
            { propertyName: "dealstage", operator: "NOT_IN", values: ["closedwon", "closedlost"] },
          ],
        }],
        properties: ["dealname", "amount", "dealstage"],
        limit: 100,
      }),
    ]);

    const [newContacts, newDeals, closedWon, openDeals] = await Promise.all([
      parseCount(contactsResp),
      parseDeals(newDealsResp),
      parseDeals(closedWonResp),
      parseDeals(openDealsResp),
    ]);

    return {
      label: "HubSpot CRM",
      new_contacts: newContacts,
      new_deals: newDeals.count,
      new_deals_value: newDeals.value,
      closed_won: closedWon.count,
      closed_won_value: closedWon.value,
      open_pipeline: openDeals.count,
      open_pipeline_value: openDeals.value,
    };
  } catch (err: any) {
    console.error("[ad-metrics][hubspot] Error fetching CRM data:", err?.message || err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════════

interface PlatformResult {
  platform_label: string;
  summary: SummaryMetrics;
  campaigns: CampaignMetrics[];
  is_supermetrics_fallback?: boolean;
}

interface AdPerformanceResult {
  client_name: string;
  date_range: { start: string; end: string };
  google_ads?: PlatformResult;
  meta_ads?: PlatformResult;
  reddit_ads?: PlatformResult;
  tiktok_ads?: PlatformResult;
  bing_ads?: PlatformResult;
  linkedin_ads?: PlatformResult;
  vibe_tv_ads?: PlatformResult;
  ga4?: GA4Data;
  instagram_insights?: InstagramInsightsData;
  klaviyo?: KlaviyoData;
  hubspot?: HubSpotCRMData;
  errors: string[];
}

export async function fetchClientAdPerformance(
  clientName: string, startDate: string, endDate: string,
): Promise<AdPerformanceResult> {
  const errors: string[] = [];

  // 1. Resolve client name via managed_clients + registry (same logic as get_client_accounts)
  const registry = await loadMatchingRegistry();
  const search = clientName.toLowerCase().trim();

  const { data: allClients, error: clientErr } = await supabase
    .from("managed_clients")
    .select("client_name")
    .eq("is_active", true);

  if (clientErr) {
    errors.push(`Error querying managed_clients: ${clientErr.message}`);
  }

  let resolvedNames: string[] = [];
  if (allClients && allClients.length > 0) {
    // Strategy 0: Registry aliases
    const registryRules = getClientMatchingRules(clientName, registry);
    if (registryRules) {
      resolvedNames = allClients
        .filter(c => {
          const nameLower = c.client_name.toLowerCase();
          if (registryRules.excludePatterns.some(ep => nameLower.includes(ep.toLowerCase()))) return false;
          return registryRules.aliases.some(alias => nameLower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(nameLower));
        })
        .map(c => c.client_name);
    }
    // Strategy 1: Exact match
    if (resolvedNames.length === 0) {
      resolvedNames = allClients.filter(c => c.client_name.toLowerCase() === search).map(c => c.client_name);
    }
    // Strategy 2: DB name contains search term
    if (resolvedNames.length === 0) {
      resolvedNames = allClients.filter(c => c.client_name.toLowerCase().includes(search)).map(c => c.client_name);
    }
    // Strategy 3: Search term contains DB name
    if (resolvedNames.length === 0) {
      resolvedNames = allClients.filter(c => search.includes(c.client_name.toLowerCase())).map(c => c.client_name);
    }
    // Strategy 4: Word overlap — requires 2+ non-ambiguous search words AND 2+ word matches
    if (resolvedNames.length === 0) {
      const searchWords = search.split(/[\s\-_]+/).filter(Boolean).filter(w => !isAmbiguousWord(w));
      if (searchWords.length >= 2) {
        resolvedNames = allClients.filter(c => {
          const nameWords = c.client_name.toLowerCase().split(/[\s\-_]+/).filter(Boolean);
          const matchCount = searchWords.filter((sw: string) => nameWords.some((nw: string) => nw.includes(sw) || sw.includes(nw))).length;
          return matchCount >= 2;
        }).map(c => c.client_name);
      }
    }
  }

  if (resolvedNames.length > 0) {
    console.log(`[ad-metrics] Resolved "${clientName}" -> ${resolvedNames.join(", ")}`);
  }

  // 2. Look up linked accounts using resolved names (or fall back to raw clientName)
  let effectiveMappings: Array<{ platform: string; account_id: string; account_name: string | null }> = [];

  if (resolvedNames.length > 0) {
    const { data: mappings, error: mapErr } = await supabase
      .from("client_account_mappings")
      .select("platform, account_id, account_name")
      .in("client_name", resolvedNames);
    if (mapErr) errors.push(`Error querying client_account_mappings: ${mapErr.message}`);
    effectiveMappings = (mappings || []) as typeof effectiveMappings;
  }

  // Fall back to direct ilike + fuzzy if registry resolution found nothing
  if (effectiveMappings.length === 0) {
    const { data: ilikeMappings } = await supabase
      .from("client_account_mappings")
      .select("platform, account_id, account_name")
      .ilike("client_name", `%${clientName}%`);
    effectiveMappings = (ilikeMappings || []) as typeof effectiveMappings;

    if (effectiveMappings.length === 0) {
      const { data: allMappings } = await supabase
        .from("client_account_mappings")
        .select("client_name, platform, account_id, account_name");
      if (allMappings) {
        effectiveMappings = allMappings.filter(m =>
          m.client_name.toLowerCase().includes(search) ||
          search.includes(m.client_name.toLowerCase())
        ) as typeof effectiveMappings;
      }
    }
  }

  if (effectiveMappings.length === 0) {
    errors.push(`No ad accounts found for client "${clientName}". Link accounts in client_account_mappings first.`);
    return { client_name: clientName, date_range: { start: startDate, end: endDate }, errors };
  }

  // Group by platform
  const accountsByPlatform: Record<string, string[]> = {};
  for (const m of effectiveMappings) {
    const platform = m.platform as string;
    if (!DATA_SOURCES[platform]) continue;
    if (!accountsByPlatform[platform]) accountsByPlatform[platform] = [];
    accountsByPlatform[platform].push(m.account_id as string);
  }

  const result: AdPerformanceResult = {
    client_name: clientName,
    date_range: { start: startDate, end: endDate },
    errors,
  };

  // 2. Process each platform
  const platformQueries = Object.entries(accountsByPlatform).map(async ([platformKey, accountIds]) => {
    const ds = DATA_SOURCES[platformKey];

    // ── META ADS — Direct API + Supermetrics cross-check ──
    if (platformKey === "meta_ads") {
      try {
        const token = await resolveMetaToken();
        if (!token) {
          errors.push("Meta access token not available. Reconnect via OAuth or set META_ACCESS_TOKEN env var.");
          return;
        }

        let smApiKey: string | null = null;
        try { smApiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key"); } catch {}

        // Track per-account data for multi-account breakdown
        const perAccount: Array<{ account_id: string; account_name: string; rows: MetaCampaignRow[] }> = [];

        for (const accountId of accountIds) {
          const accountMapping = effectiveMappings.find(m => m.platform === "meta_ads" && m.account_id === accountId);
          const accountName = accountMapping?.account_name || accountId;

          const [{ rows, error }, smResult] = await Promise.all([
            fetchMetaInsights(token, accountId, startDate, endDate),
            smApiKey ? fetchSupermetricsCheck(smApiKey, "FA", accountId, startDate, endDate) : Promise.resolve(null),
          ]);

          if (error) {
            errors.push(error);
            if (smResult && smResult.spend > 0) {
              console.warn(`[ad-metrics][meta_ads] Direct API failed for ${accountId}, using Supermetrics fallback ($${smResult.spend} spend)`);
              perAccount.push({ account_id: accountId, account_name: accountName, rows: [{ campaign: "All Campaigns (Supermetrics)", impressions: smResult.impressions, clicks: smResult.clicks, spend: smResult.spend, leads: smResult.conversions, purchases: 0, calls: 0, reach: 0, frequency: 0 }] });
            }
            continue;
          }

          const directSpend = rows.reduce((s, r) => s + r.spend, 0);
          const { useFallback, fallback } = reconcileWithSupermetrics(`meta_ads/${accountId}`, directSpend, smResult);

          const effectiveRows = (useFallback && fallback)
            ? [{ campaign: "All Campaigns (Supermetrics)", impressions: fallback.impressions, clicks: fallback.clicks, spend: fallback.spend, leads: fallback.conversions, purchases: 0, calls: 0, reach: 0, frequency: 0 }]
            : rows;

          console.log(`[ad-metrics][meta_ads] Got ${effectiveRows.length} campaign rows for ${accountId}`);
          perAccount.push({ account_id: accountId, account_name: accountName, rows: effectiveRows });
        }

        const allRows = perAccount.flatMap(a => a.rows);
        if (allRows.length === 0) return;

        const metaIsFallback = allRows.some(r => r.campaign === "All Campaigns (Supermetrics)");
        (result as any)[platformKey] = {
          platform_label: ds.label,
          summary: buildMetaSummary(allRows),
          campaigns: buildMetaCampaigns(allRows),
          ...(metaIsFallback ? { is_supermetrics_fallback: true } : {}),
          // Include per-account breakdown only when multiple accounts exist
          ...(perAccount.length > 1 ? {
            accounts: perAccount.map(a => ({
              account_id: a.account_id,
              account_name: a.account_name,
              summary: buildMetaSummary(a.rows),
              campaigns: buildMetaCampaigns(a.rows),
            })),
          } : {}),
        } as PlatformResult;
      } catch (err: any) {
        errors.push(`Meta Ads error: ${err.message}`);
      }
      return;
    }

    // ── GOOGLE ADS — Direct API + Supermetrics cross-check ──
    if (platformKey === "google_ads") {
      try {
        const accessToken = await refreshGoogleToken();

        let smApiKey: string | null = null;
        try { smApiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key"); } catch {}

        // Track per-account data for multi-account breakdown
        const perAccount: Array<{ account_id: string; account_name: string; rows: GoogleCampaignRow[]; convRows: GoogleConvActionRow[] }> = [];

        for (const accountId of accountIds) {
          const accountMapping = effectiveMappings.find(m => m.platform === "google_ads" && m.account_id === accountId);
          const accountName = accountMapping?.account_name || accountId;

          const [{ rows, error }, { rows: convRows, error: convError }, smResult] = await Promise.all([
            fetchGoogleAdsCampaigns(accessToken, accountId, startDate, endDate),
            fetchGoogleAdsConversionsByAction(accessToken, accountId, startDate, endDate),
            smApiKey ? fetchSupermetricsCheck(smApiKey, "AW", accountId, startDate, endDate) : Promise.resolve(null),
          ]);

          if (error) {
            errors.push(error);
            if (smResult && smResult.spend > 0) {
              console.warn(`[ad-metrics][google_ads] Direct API failed for ${accountId}, using Supermetrics fallback ($${smResult.spend} spend)`);
              perAccount.push({ account_id: accountId, account_name: accountName, rows: [{ campaign: "All Campaigns (Supermetrics)", impressions: smResult.impressions, clicks: smResult.clicks, spend: smResult.spend, conversions: smResult.conversions, phone_calls: 0, ctr: 0, cpc: 0, cpa: 0 }], convRows: [] });
            }
            continue;
          }

          const directSpend = rows.reduce((s, r) => s + r.spend, 0);
          const { useFallback, fallback } = reconcileWithSupermetrics(`google_ads/${accountId}`, directSpend, smResult);

          const effectiveRows = (useFallback && fallback)
            ? [{ campaign: "All Campaigns (Supermetrics)", impressions: fallback.impressions, clicks: fallback.clicks, spend: fallback.spend, conversions: fallback.conversions, phone_calls: 0, ctr: 0, cpc: 0, cpa: 0 }]
            : rows;

          if (convError) {
            console.warn(`[ad-metrics][google_ads] Conversion action query failed for ${accountId}: ${convError}`);
          }
          console.log(`[ad-metrics][google_ads] Got ${effectiveRows.length} campaign rows for ${accountId}`);
          // Clear convRows when Supermetrics fallback fired — campaign names won't match
          // direct-API conversion action rows, causing broken per-campaign conv breakdown.
          perAccount.push({ account_id: accountId, account_name: accountName, rows: effectiveRows, convRows: (convError || useFallback) ? [] : convRows });
        }

        const allRows = perAccount.flatMap(a => a.rows);
        const allConvRows = perAccount.flatMap(a => a.convRows);

        if (allRows.length === 0) return;

        const googleIsFallback = allRows.some(r => r.campaign === "All Campaigns (Supermetrics)");
        (result as any)[platformKey] = {
          platform_label: ds.label,
          summary: buildGoogleSummary(allRows, allConvRows),
          campaigns: buildGoogleCampaigns(allRows, allConvRows),
          ...(googleIsFallback ? { is_supermetrics_fallback: true } : {}),
          // Include per-account breakdown only when multiple accounts exist
          ...(perAccount.length > 1 ? {
            accounts: perAccount.map(a => ({
              account_id: a.account_id,
              account_name: a.account_name,
              summary: buildGoogleSummary(a.rows, a.convRows),
              campaigns: buildGoogleCampaigns(a.rows, a.convRows),
            })),
          } : {}),
        } as PlatformResult;
      } catch (err: any) {
        errors.push(`Google Ads error: ${err.message}`);
      }
      return;
    }

    // ── REDDIT ADS — Direct API + Supermetrics cross-check ──
    if (platformKey === "reddit_ads") {
      try {
        const token = await refreshRedditToken();

        let smApiKey: string | null = null;
        try { smApiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key"); } catch {}

        let allRows: RedditCampaignRow[] = [];
        for (const accountId of accountIds) {
          const [{ rows, error }, smResult] = await Promise.all([
            fetchRedditInsights(token, accountId, startDate, endDate),
            smApiKey ? fetchSupermetricsCheck(smApiKey, "RDA", accountId, startDate, endDate) : Promise.resolve(null),
          ]);

          if (error) {
            errors.push(error);
            if (smResult && smResult.spend > 0) {
              console.warn(`[ad-metrics][reddit_ads] Direct API failed for ${accountId}, using Supermetrics fallback ($${smResult.spend} spend)`);
              allRows.push({ campaign: "All Campaigns (Supermetrics)", impressions: smResult.impressions, clicks: smResult.clicks, spend: smResult.spend, conversions: smResult.conversions });
            }
            continue;
          }

          const directSpend = rows.reduce((s, r) => s + r.spend, 0);
          const { useFallback, fallback } = reconcileWithSupermetrics(`reddit_ads/${accountId}`, directSpend, smResult);

          if (useFallback && fallback) {
            allRows.push({ campaign: "All Campaigns (Supermetrics)", impressions: fallback.impressions, clicks: fallback.clicks, spend: fallback.spend, conversions: fallback.conversions });
          } else {
            allRows = allRows.concat(rows);
          }
          console.log(`[ad-metrics][reddit_ads] Got ${rows.length} campaign rows for ${accountId}`);
        }

        if (allRows.length === 0) return;

        (result as any)[platformKey] = {
          platform_label: ds.label,
          summary: buildRedditSummary(allRows),
          campaigns: buildRedditCampaigns(allRows),
        } as PlatformResult;
      } catch (err: any) {
        errors.push(`Reddit Ads error: ${err.message}`);
      }
      return;
    }

    // ── GA4 — Direct API (service account) + Supermetrics cross-check ──
    if (platformKey === "ga4") {
      let smApiKey: string | null = null;
      try { smApiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key"); } catch {}

      let ga4Token: string | null = null;
      try { ga4Token = await getGA4ServiceAccountToken(); } catch (e: any) {
        console.warn(`[ad-metrics][ga4] Service account auth failed: ${e.message}`);
      }

      let accumulated: GA4Data | null = null;

      for (const accountId of accountIds) {
        // Run direct API and Supermetrics in parallel
        const [directData, smData] = await Promise.all([
          ga4Token ? fetchGA4DirectData(ga4Token, accountId, startDate, endDate) : Promise.resolve(null),
          smApiKey ? fetchGA4Data(smApiKey, accountId, startDate, endDate) : Promise.resolve(null),
        ]);

        let chosen: GA4Data | null = null;

        if (directData && smData) {
          // Cross-check: compare sessions (key metric like spend for ads)
          const smSessions = smData.sessions;
          const directSessions = directData.sessions;
          const diff = smSessions > 0 ? Math.abs(directSessions - smSessions) / smSessions : 1;

          if (diff > 0.15) {
            console.warn(`[ad-metrics][ga4] Session discrepancy >15% for property ${accountId}: direct=${directSessions} vs supermetrics=${smSessions} (${(diff * 100).toFixed(1)}% diff). Trusting direct API.`);
          } else {
            console.log(`[ad-metrics][ga4] Cross-check passed for ${accountId}: direct=${directSessions} sessions vs sm=${smSessions} sessions`);
          }
          chosen = directData; // direct API is always preferred when both succeed
        } else if (directData) {
          console.log(`[ad-metrics][ga4] Using direct API for ${accountId} (Supermetrics unavailable): ${directData.sessions} sessions`);
          chosen = directData;
        } else if (smData) {
          console.warn(`[ad-metrics][ga4] Direct API failed for ${accountId}, falling back to Supermetrics: ${smData.sessions} sessions`);
          chosen = smData;
        } else {
          errors.push(`GA4 (${accountId}): No data from either source. Verify property ID and service account access.`);
        }

        if (chosen) {
          accumulated = accumulated ? mergeGA4Data(accumulated, chosen) : chosen;
        }
      }

      if (accumulated) result.ga4 = accumulated;
      return;
    }

    // ── INSTAGRAM INSIGHTS — Organic social via Supermetrics ──
    if (platformKey === "instagram_insights") {
      let smApiKey: string | null = null;
      try { smApiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key"); } catch {}
      if (!smApiKey) { errors.push("Instagram Insights: Supermetrics API key not available."); return; }

      for (const accountId of accountIds) {
        const igData = await fetchInstagramInsightsData(smApiKey, accountId, startDate, endDate);
        if (igData) {
          result.instagram_insights = igData;
          console.log(`[ad-metrics][instagram_insights] Got data for ${accountId}: ${igData.impressions} impressions, ${igData.follows} new followers`);
        } else {
          errors.push(`Instagram Insights (${accountId}): No data returned from Supermetrics. Verify the account ID is linked correctly.`);
        }
      }
      return;
    }

    // ── KLAVIYO — Email marketing via Supermetrics ──
    if (platformKey === "klaviyo") {
      let smApiKey: string | null = null;
      try { smApiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key"); } catch {}
      if (!smApiKey) { errors.push("Klaviyo: Supermetrics API key not available."); return; }

      for (const accountId of accountIds) {
        const klaviyoData = await fetchKlaviyoData(smApiKey, accountId, startDate, endDate);
        if (klaviyoData) {
          result.klaviyo = klaviyoData;
          console.log(`[ad-metrics][klaviyo] Got data for ${accountId}: ${klaviyoData.campaigns.length} campaigns, $${klaviyoData.total.revenue} revenue`);
        } else {
          errors.push(`Klaviyo (${accountId}): No data returned from Supermetrics. Verify the account ID is linked correctly.`);
        }
      }
      return;
    }

    // ── HUBSPOT CRM — Read-only access, scoped to this client ──
    // Silently skipped if no credential found or fetch fails — never blocks the report.
    if (platformKey === "hubspot") {
      try {
        // Try all resolved names AND the original input — the credential may be stored under
        // the full display name (e.g. "Los Angeles Photo Party - LAPP") or a short version.
        const namesToTry = [...new Set([...resolvedNames, clientName])];
        let accessToken: string | null = null;
        for (const name of namesToTry) {
          accessToken = await getSecret(normalizeHubSpotKey(name));
          if (accessToken) { console.log(`[ad-metrics][hubspot] Found credential for "${name}"`); break; }
        }

        if (!accessToken) {
          console.warn(`[ad-metrics][hubspot] No credential found for "${clientName}" — skipping HubSpot section`);
          return;
        }

        const hubData = await fetchHubSpotData(accessToken, startDate, endDate);
        if (hubData) {
          result.hubspot = hubData;
          console.log(
            `[ad-metrics][hubspot] Got CRM data for "${clientName}": ` +
            `${hubData.new_contacts} new contacts, ${hubData.new_deals} new deals ($${hubData.new_deals_value}), ` +
            `${hubData.closed_won} closed-won ($${hubData.closed_won_value}), ` +
            `${hubData.open_pipeline} open ($${hubData.open_pipeline_value})`,
          );
        } else {
          console.warn(`[ad-metrics][hubspot] Fetch returned null for "${clientName}" — check token scopes`);
        }
      } catch (err: any) {
        console.error(`[ad-metrics][hubspot] Unexpected error for "${clientName}":`, err?.message || err);
      }
      return;
    }

    // ── SUPERMETRICS FALLBACK — TikTok, Bing, LinkedIn ──
    const def = PLATFORM_DEFS[ds.id];
    if (!def) {
      errors.push(`No field definitions for platform ${platformKey}`);
      return;
    }

    let apiKey: string;
    try {
      apiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key");
    } catch (err: any) {
      errors.push(err.message);
      return;
    }

    let allRows: (string | number)[][] = [];
    let lastHeaders: string[] = [];

    for (const accountId of accountIds) {
      const queryResult = await queryWithRetry(apiKey, ds.id, accountId, startDate, endDate, def.dailyFields, 2);
      if (queryResult.error) {
        errors.push(`${ds.label} (${accountId}): ${queryResult.error}`);
        continue;
      }
      if (queryResult.rows.length > 0) {
        lastHeaders = queryResult.headers;
        allRows = allRows.concat(queryResult.rows);
      }
    }

    if (allRows.length === 0) return;

    const col = buildColumnMap(def.fieldOrder, lastHeaders);
    (result as any)[platformKey] = {
      platform_label: ds.label,
      summary: buildSupermetricsSummary(allRows, col, ds.id),
      campaigns: buildSupermetricsCampaigns(allRows, col, ds.id),
    } as PlatformResult;
  });

  // 90-second ceiling on all platform queries combined — prevents indefinite hangs
  // when a client has many accounts or a platform API stalls across multiple pages
  try {
    await Promise.race([
      Promise.all(platformQueries),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Ad performance fetch timed out after 90s")), 90_000)
      ),
    ]);
  } catch (err: any) {
    errors.push(`Platform data fetch timed out or failed: ${err.message}`);
  }

  return result;
}

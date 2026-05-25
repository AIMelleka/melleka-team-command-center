/**
 * Ad Metrics Service — Direct Meta Marketing API + Google Ads API integration.
 *
 * Calls Meta and Google Ads APIs directly for accurate, real-time data.
 * Falls back to Supermetrics only for TikTok, Bing, and LinkedIn.
 *
 * Main export: fetchClientAdPerformance(clientName, startDate, endDate)
 */

import { requireSecret, getSecret } from "./secrets.js";
import { supabase } from "./supabase.js";
import { loadMatchingRegistry, getClientMatchingRules, isAmbiguousWord } from "./client-matching.js";

const META_API_VERSION = process.env.META_API_VERSION || "v21.0";
const SUPERMETRICS_API_URL = "https://api.supermetrics.com/enterprise/v2";

// ── Data source IDs (Supermetrics — only for TikTok/Bing/LinkedIn now) ──
const DATA_SOURCES: Record<string, { id: string; label: string }> = {
  google_ads: { id: "AW", label: "Google Ads" },
  meta_ads: { id: "FA", label: "Facebook/Meta Ads" },
  tiktok_ads: { id: "TIK", label: "TikTok Ads" },
  bing_ads: { id: "AC", label: "Microsoft Advertising (Bing)" },
  linkedin_ads: { id: "LIA", label: "LinkedIn Ads" },
};

// Platforms that still use Supermetrics
const SUPERMETRICS_PLATFORMS = new Set(["tiktok_ads", "bing_ads", "linkedin_ads"]);

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
};

// ── Conversion classification ──
function classifyConversionAction(name: string): "leads" | "purchases" | "calls" {
  const lower = name.toLowerCase();

  if (
    lower.includes("call") || lower.includes("phone") ||
    lower.includes("click-to-call") || lower.includes("click to call") ||
    lower.includes("calls from ads") || lower.includes("phone_call") ||
    lower.includes("tel:") || lower.includes("call extension") ||
    lower.includes("call asset")
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
  // Use 7-day click + 1-day view attribution to match Ads Manager defaults
  const attributionSetting = encodeURIComponent(JSON.stringify(["7d_click", "1d_view"]));

  // Ensure account ID has act_ prefix
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  let url: string | null =
    `https://graph.facebook.com/${META_API_VERSION}/${actId}/insights` +
    `?fields=${fields}&level=campaign&time_range=${encodeURIComponent(timeRange)}&action_attribution_windows=${attributionSetting}&limit=5000&access_token=${token}`;

  while (url) {
    const resp = await fetch(url);
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
          for (const action of row.actions) {
            const t = action.action_type;
            const val = parseFloat(action.value) || 0;

            // Leads (all lead-type actions)
            if (
              t === "lead" ||
              t === "offsite_conversion.fb_pixel_lead" ||
              t === "onsite_conversion.lead_grouped" ||
              t === "onsite_conversion.leadgen_grouped" ||
              t === "offsite_conversion.fb_pixel_complete_registration" ||
              t === "complete_registration" ||
              t === "contact" ||
              t === "submit_application" ||
              t === "offsite_conversion.fb_pixel_submit_application" ||
              t === "onsite_conversion.messaging_conversation_started_7d"
            ) {
              leads += val;
            }
            // Purchases (actual purchase/transaction events only)
            else if (
              t === "purchase" ||
              t === "omni_purchase" ||
              t === "offsite_conversion.fb_pixel_purchase" ||
              t === "onsite_web_purchase" ||
              t === "onsite_conversion.purchase"
            ) {
              purchases += val;
            }
            // Calls
            else if (
              t === "onsite_conversion.call_confirm" ||
              t === "phone_call"
            ) {
              calls += val;
            }
          }
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

  const query = `SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'`;

  const resp = await fetch(
    `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );

  if (!resp.ok) {
    const text = await resp.text();
    let errMsg = text;
    try { const e = JSON.parse(text); errMsg = e?.error?.message || e?.[0]?.error?.message || text; } catch {}
    return { rows: [], error: `Google Ads API error (${customerId}): ${errMsg}` };
  }

  const data = await resp.json() as Array<{ results?: Array<{ campaign?: { name?: string }; metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number; ctr?: number; averageCpc?: string; costPerConversion?: number } }> }>;

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
      const conversions = m.conversions || 0;

      rows.push({
        campaign: result.campaign?.name || "Unknown",
        impressions,
        clicks,
        spend,
        conversions,
        ctr: (m.ctr || 0) * 100,
        cpc: parseInt(m.averageCpc || "0") / 1_000_000,
        cpa: m.costPerConversion || 0,
      });
    }
  }

  return { rows };
}

/** Fetch conversion action breakdown via GAQL */
async function fetchGoogleAdsConversionBreakdown(
  accessToken: string, customerId: string, startDate: string, endDate: string,
): Promise<{ leads: number; purchases: number; calls: number } | null> {
  const headers = await buildGoogleAdsHeaders(accessToken);
  const cleanCustomerId = customerId.replace(/-/g, "");

  const query = `SELECT conversion_action.name, metrics.conversions FROM conversion_action WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;

  const resp = await fetch(
    `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );

  if (!resp.ok) return null;

  const data = await resp.json() as Array<{ results?: Array<{ conversionAction?: { name?: string }; metrics?: { conversions?: number } }> }>;

  let leads = 0, purchases = 0, calls = 0;
  for (const batch of data) {
    if (!batch.results) continue;
    for (const result of batch.results) {
      const actionName = result.conversionAction?.name || "";
      const count = result.metrics?.conversions || 0;
      if (!actionName || count === 0) continue;
      const type = classifyConversionAction(actionName);
      if (type === "calls") calls += count;
      else if (type === "purchases") purchases += count;
      else leads += count;
    }
  }

  console.log(`[ad-metrics][google_ads] Conversion breakdown for ${customerId}: leads=${leads}, purchases=${purchases}, calls=${calls}`);
  return { leads, purchases, calls };
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

/** Build summary from Google Ads campaign rows */
function buildGoogleSummary(
  rows: GoogleCampaignRow[],
  convBreakdown?: { leads: number; purchases: number; calls: number } | null,
): SummaryMetrics {
  let impressions = 0, clicks = 0, spend = 0, conversions = 0;

  for (const row of rows) {
    impressions += row.impressions;
    clicks += row.clicks;
    spend += row.spend;
    conversions += row.conversions;
  }

  let leads = 0, purchases = 0, calls = 0;
  if (convBreakdown) {
    leads = convBreakdown.leads;
    purchases = convBreakdown.purchases;
    calls = convBreakdown.calls;
  } else {
    leads = conversions; // default all to leads if no breakdown
  }

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

/** Build campaigns from Google Ads campaign rows */
function buildGoogleCampaigns(
  rows: GoogleCampaignRow[],
  convBreakdown?: { leads: number; purchases: number; calls: number } | null,
): CampaignMetrics[] {
  const campMap: Record<string, { impressions: number; clicks: number; spend: number; conversions: number }> = {};

  for (const row of rows) {
    if (!row.campaign) continue;
    if (!campMap[row.campaign]) campMap[row.campaign] = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    campMap[row.campaign].impressions += row.impressions;
    campMap[row.campaign].clicks += row.clicks;
    campMap[row.campaign].spend += row.spend;
    campMap[row.campaign].conversions += row.conversions;
  }

  // Distribute conversion breakdown proportionally across campaigns
  const totalConv = Object.values(campMap).reduce((s, v) => s + v.conversions, 0);

  return Object.entries(campMap)
    .filter(([_, v]) => v.spend > 0 || v.clicks > 0)
    .map(([name, v]) => {
      const convShare = totalConv > 0 ? v.conversions / totalConv : 0;
      let leads = 0, purchases = 0, calls = 0;
      if (convBreakdown) {
        leads = round2(convBreakdown.leads * convShare);
        purchases = round2(convBreakdown.purchases * convShare);
        calls = round2(convBreakdown.calls * convShare);
      } else {
        leads = v.conversions;
      }
      return {
        name,
        spend: round2(v.spend),
        impressions: v.impressions,
        clicks: v.clicks,
        conversions: round2(v.conversions),
        leads,
        purchases,
        calls,
        ctr: v.impressions > 0 ? round2((v.clicks / v.impressions) * 100) : 0,
        cpc: v.clicks > 0 ? round2(v.spend / v.clicks) : 0,
        cpa: v.conversions > 0 ? round2(v.spend / v.conversions) : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);
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
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
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
// ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════════

interface PlatformResult {
  platform_label: string;
  summary: SummaryMetrics;
  campaigns: CampaignMetrics[];
}

interface AdPerformanceResult {
  client_name: string;
  date_range: { start: string; end: string };
  google_ads?: PlatformResult;
  meta_ads?: PlatformResult;
  tiktok_ads?: PlatformResult;
  bing_ads?: PlatformResult;
  linkedin_ads?: PlatformResult;
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
    // Strategy 4: Word overlap (filter ambiguous words)
    if (resolvedNames.length === 0) {
      const searchWords = search.split(/[\s\-_]+/).filter(Boolean).filter(w => !isAmbiguousWord(w));
      if (searchWords.length > 0) {
        resolvedNames = allClients.filter(c => {
          const nameWords = c.client_name.toLowerCase().split(/[\s\-_]+/).filter(Boolean);
          return searchWords.some((sw: string) => nameWords.some((nw: string) => nw.includes(sw) || sw.includes(nw)));
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
      .ilike("client_name", clientName);
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

    // ── META ADS — Direct API ──
    if (platformKey === "meta_ads") {
      try {
        const token = await resolveMetaToken();
        if (!token) {
          errors.push("Meta access token not available. Reconnect via OAuth or set META_ACCESS_TOKEN env var.");
          return;
        }

        let allRows: MetaCampaignRow[] = [];
        for (const accountId of accountIds) {
          const { rows, error } = await fetchMetaInsights(token, accountId, startDate, endDate);
          if (error) {
            errors.push(error);
            continue;
          }
          allRows = allRows.concat(rows);
          console.log(`[ad-metrics][meta_ads] Got ${rows.length} campaign rows for ${accountId}`);
        }

        if (allRows.length === 0) return;

        (result as any)[platformKey] = {
          platform_label: ds.label,
          summary: buildMetaSummary(allRows),
          campaigns: buildMetaCampaigns(allRows),
        } as PlatformResult;
      } catch (err: any) {
        errors.push(`Meta Ads error: ${err.message}`);
      }
      return;
    }

    // ── GOOGLE ADS — Direct API ──
    if (platformKey === "google_ads") {
      try {
        const accessToken = await refreshGoogleToken();

        let allRows: GoogleCampaignRow[] = [];
        let convBreakdown: { leads: number; purchases: number; calls: number } | null = null;

        for (const accountId of accountIds) {
          const { rows, error } = await fetchGoogleAdsCampaigns(accessToken, accountId, startDate, endDate);
          if (error) {
            errors.push(error);
            continue;
          }
          allRows = allRows.concat(rows);
          console.log(`[ad-metrics][google_ads] Got ${rows.length} campaign rows for ${accountId}`);

          // Get conversion breakdown
          const bd = await fetchGoogleAdsConversionBreakdown(accessToken, accountId, startDate, endDate);
          if (bd) {
            if (!convBreakdown) convBreakdown = { leads: 0, purchases: 0, calls: 0 };
            convBreakdown.leads += bd.leads;
            convBreakdown.purchases += bd.purchases;
            convBreakdown.calls += bd.calls;
          }
        }

        if (allRows.length === 0) return;

        (result as any)[platformKey] = {
          platform_label: ds.label,
          summary: buildGoogleSummary(allRows, convBreakdown),
          campaigns: buildGoogleCampaigns(allRows, convBreakdown),
        } as PlatformResult;
      } catch (err: any) {
        errors.push(`Google Ads error: ${err.message}`);
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

  await Promise.all(platformQueries);

  return result;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPERMETRICS_API_URL = 'https://api.supermetrics.com/enterprise/v2';

// Data source IDs
const DATA_SOURCES: Record<string, { id: string; label: string }> = {
  google_ads: { id: 'AW', label: 'Google Ads' },
  meta_ads: { id: 'FA', label: 'Facebook/Meta Ads' },
  tiktok_ads: { id: 'TIK', label: 'TikTok Ads' },
  bing_ads: { id: 'AC', label: 'Microsoft Advertising (Bing)' },
  linkedin_ads: { id: 'LIA', label: 'LinkedIn Ads' },
};

// ==========================================
// FIELD DEFINITIONS PER PLATFORM
// ==========================================
// Each platform has explicit ordered fields. We track their positions
// so we never rely on fragile string matching against API-returned headers.

interface PlatformFieldDef {
  dailyFields: string;
  creativeFields: string;
  keywordFields?: string;
  // Maps our standard metric names to the 0-based column index in dailyFields
  // These are filled at parse time based on header order
  fieldOrder: string[]; // ordered list of our canonical names matching dailyFields order
  creativeFieldOrder: string[];
  keywordFieldOrder?: string[];
}

const PLATFORM_DEFS: Record<string, PlatformFieldDef> = {
  AW: {
    dailyFields: 'Date,CampaignName,Impressions,Clicks,Cost,Conversions,CostPerConversion,Ctr,CPC,ConversionRate,AllConversions',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'cpa', 'ctr', 'cpc', 'convrate', 'allconversions'],
    creativeFields: 'AdGroupName,CampaignName,Impressions,Clicks,Cost,Conversions,Ctr,CPC,CostPerConversion',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpa'],
    keywordFields: 'Keyword,CampaignName,Impressions,Clicks,Cost,Conversions,Ctr,CPC,CostPerConversion',
    keywordFieldOrder: ['keyword', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpa'],
  },
  FA: {
    // Fetch website conversions, website leads, website purchases, AND on-Facebook leads (lead forms)
    dailyFields: 'Date,adcampaign_name,impressions,Clicks,cost,offsite_conversion,offsite_conversions_fb_pixel_lead,offsite_conversions_fb_pixel_purchase,onsite_conversion.lead_grouped,CPC,CTR,CPM,reach,Frequency',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'websiteConversions', 'websiteLeads', 'websitePurchases', 'onsiteLeads', 'cpc', 'ctr', 'cpm', 'reach', 'frequency'],
    creativeFields: 'ad_name,adcampaign_name,ad_id,adcreative_id,creative_thumbnail_url,creative_image_url,impressions,Clicks,cost,offsite_conversion,offsite_conversions_fb_pixel_lead,offsite_conversions_fb_pixel_purchase,onsite_conversion.lead_grouped,CTR,CPC',
    creativeFieldOrder: ['adname', 'campaign', 'adid', 'creativeid', 'thumbnail', 'imageurl', 'impressions', 'clicks', 'cost', 'websiteConversions', 'websiteLeads', 'websitePurchases', 'onsiteLeads', 'ctr', 'cpc'],
  },
  TIK: {
    dailyFields: 'Date,campaign_name,impressions,clicks,spend,conversions,conversion_rate,cpc,cpm,ctr,reach',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'convrate', 'cpc', 'cpm', 'ctr', 'reach'],
    creativeFields: 'adgroup_name,campaign_name,impressions,clicks,spend,conversions,ctr,cpc',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc'],
  },
  AC: {
    dailyFields: 'Date,CampaignName,Impressions,Clicks,Spend,Conversions,Revenue,CostPerConversion,Ctr,CPC',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'revenue', 'cpa', 'ctr', 'cpc'],
    creativeFields: 'AdTitle,CampaignName,Impressions,Clicks,Spend,Conversions,Ctr,CPC,CostPerConversion',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpa'],
    keywordFields: 'Keyword,CampaignName,Impressions,Clicks,Spend,Conversions,Ctr,CPC,CostPerConversion',
    keywordFieldOrder: ['keyword', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpa'],
  },
  LIA: {
    dailyFields: 'Date,campaignName,impressions,clicks,spend,conversions,cpc,ctr,cpm',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'cpc', 'ctr', 'cpm'],
    creativeFields: 'campaignName,impressions,clicks,spend,conversions,ctr,cpc',
    creativeFieldOrder: ['campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc'],
  },
};

// ==========================================
// CLASSIFY CONVERSION ACTION NAMES
// ==========================================
function classifyConversionAction(name: string): 'leads' | 'purchases' | 'calls' {
  const lower = name.toLowerCase();

  // --- CALLS ---
  // Google Ads click-to-call, call extensions, phone call conversions
  if (
    lower.includes('call') ||
    lower.includes('phone') ||
    lower.includes('click-to-call') ||
    lower.includes('click to call') ||
    lower.includes('calls from ads') ||
    lower.includes('phone_call') ||
    lower.includes('tel:') ||
    lower.includes('call extension') ||
    lower.includes('call asset')
  ) return 'calls';

  // --- PURCHASES ---
  // E-commerce, transaction, revenue-related conversion actions only
  if (
    lower.includes('purchase') ||
    lower.includes('transaction') ||
    lower.includes('order') ||
    lower.includes('sale') ||
    lower.includes('buy') ||
    lower.includes('ecommerce') ||
    lower.includes('e-commerce') ||
    lower.includes('add to cart') ||
    lower.includes('add_to_cart') ||
    lower.includes('checkout') ||
    lower.includes('revenue') ||
    lower.includes('begin_checkout') ||
    lower.includes('begin checkout') ||
    lower.includes('payment') ||
    lower.includes('shop') ||
    lower.includes('cart') ||
    lower.includes('booking') ||
    lower.includes('reservation')
  ) return 'purchases';

  // --- LEADS (default) ---
  // Everything else: form submissions, sign-ups, contact, quote requests, etc.
  // Explicitly matched for logging clarity but falls through to default
  return 'leads';
}

// Query conversion action breakdown for Google/Bing to split leads/purchases/calls
async function queryConversionBreakdown(
  apiKey: string,
  dsId: string,
  accountId: string,
  dateStart: string,
  dateEnd: string,
): Promise<{ leads: number; purchases: number; calls: number } | null> {
  if (dsId !== 'AW' && dsId !== 'AC') return null;

  // Google Ads: ConversionType; Bing: Goal (Supermetrics dimension names)
  const fields = dsId === 'AW' ? 'ConversionType,Conversions' : 'Goal,Conversions';
  const result = await queryWithRetry(apiKey, dsId, accountId, dateStart, dateEnd, fields, 1);

  if (result.error || result.rows.length === 0) return null;

  let leads = 0, purchases = 0, calls = 0;
  const classifications: string[] = [];
  for (const row of result.rows) {
    const actionName = String(row[0] || '');
    const count = parseFloat(String(row[1] || '0')) || 0;
    if (!actionName || count === 0) continue;

    const type = classifyConversionAction(actionName);
    classifications.push(`"${actionName}" → ${type} (${count})`);
    if (type === 'calls') calls += count;
    else if (type === 'purchases') purchases += count;
    else leads += count;
  }

  console.log(`[${dsId}] Conversion breakdown for ${accountId}: leads=${leads}, purchases=${purchases}, calls=${calls}`);
  if (classifications.length > 0) {
    console.log(`[${dsId}] Action classifications: ${classifications.join(', ')}`);
  }
  return { leads, purchases, calls };
}

// ==========================================
// HELPER: Build a column index map from header order
// ==========================================
// Since we REQUEST fields in a specific order, the response SHOULD come back
// in the same order. But as a safety net, we also try to match by normalized header name.
function buildColumnMap(expectedOrder: string[], actualHeaders: string[]): Record<string, number> {
  const map: Record<string, number> = {};

  // Primary: use positional mapping (fields come back in order we requested)
  for (let i = 0; i < expectedOrder.length && i < actualHeaders.length; i++) {
    map[expectedOrder[i]] = i;
  }

  return map;
}

// Get a numeric value from a row using the column map
function getNum(row: (string | number)[], col: Record<string, number>, key: string): number {
  const idx = col[key];
  if (idx === undefined || idx >= row.length) return 0;
  const val = parseFloat(String(row[idx] || '0'));
  return isNaN(val) ? 0 : val;
}

function getStr(row: (string | number)[], col: Record<string, number>, key: string): string {
  const idx = col[key];
  if (idx === undefined || idx >= row.length) return '';
  return String(row[idx] || '');
}

// Calculate conversions based on platform
// IMPORTANT: Use primary Conversions only (NOT AllConversions) to exclude
// landing page views, page views, and other non-actionable conversion types.
function getConversions(row: (string | number)[], col: Record<string, number>, dsId: string): number {
  if (dsId === 'FA') {
    // Meta: sum actual conversion sources (leads + purchases), NOT landing page views
    const onsiteLeads = getNum(row, col, 'onsiteLeads');
    const websiteLeads = getNum(row, col, 'websiteLeads');
    const websitePurchases = getNum(row, col, 'websitePurchases');
    // Don't use websiteConversions — it includes landing page views
    return onsiteLeads + websiteLeads + websitePurchases;
  }
  if (dsId === 'AW') {
    // Google: Use primary Conversions ONLY (excludes landing page views, store visits, etc.)
    // AllConversions includes everything including non-primary actions like LPVs
    return getNum(row, col, 'conversions');
  }
  return getNum(row, col, 'conversions');
}

interface SupermetricsRequest {
  dataSources: string[];
  accounts: Record<string, string | string[]>;
  dateStart: string;
  dateEnd: string;
  compareStart?: string;
  compareEnd?: string;
}

// ==========================================
// QUERY WITH RETRY
// ==========================================
// GET-based query (fallback for prioritised account errors)
async function queryViaGet(
  apiKey: string,
  dsId: string,
  accountId: string,
  dateStart: string,
  dateEnd: string,
  fields: string,
): Promise<{ headers: string[]; rows: (string | number)[][]; error?: string }> {
  try {
    const queryParams = {
      api_key: apiKey,
      ds_id: dsId,
      ds_accounts: [accountId],
      start_date: dateStart,
      end_date: dateEnd,
      fields: fields.split(',').map(f => f.trim()),
      max_rows: 5000,
      settings: { no_headers: false },
    };
    const url = `${SUPERMETRICS_API_URL}/query/data/json?json=${encodeURIComponent(JSON.stringify(queryParams))}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const text = await response.text();
      let errMsg = text;
      try { const e = JSON.parse(text); errMsg = e?.error?.description || e?.error?.message || text; } catch {}
      return { headers: [], rows: [], error: errMsg };
    }
    const data = await response.json();
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return { headers: [], rows: [] };
    }
    const headers = data.data[0] as string[];
    const rows = data.data.slice(1) as (string | number)[][];
    console.log(`[${dsId}] ✅ GET fallback got ${rows.length} rows`);
    return { headers, rows };
  } catch (err) {
    return { headers: [], rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function queryWithRetry(
  apiKey: string,
  dsId: string,
  accountId: string,
  dateStart: string,
  dateEnd: string,
  fields: string,
  maxRetries = 2,
): Promise<{ headers: string[]; rows: (string | number)[][]; error?: string }> {
  let lastError = '';
  let hitPrioritisedError = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const queryBody = {
        ds_id: dsId,
        ds_accounts: accountId,
        start_date: dateStart,
        end_date: dateEnd,
        fields,
        max_rows: 5000,
        settings: { no_headers: false },
      };

      const response = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      });

      if (!response.ok) {
        const text = await response.text();
        let errMsg = text;
        try {
          const errObj = JSON.parse(text);
          errMsg = errObj?.error?.description || errObj?.error?.message || text;
          // Detect prioritised account error — skip retries, try GET fallback
          if (errMsg.includes('prioritised account')) {
            console.warn(`[${dsId}] Prioritised account error for ${accountId}, trying GET fallback...`);
            hitPrioritisedError = true;
            break;
          }
          // Don't retry client errors (4xx) except rate limits
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            console.error(`[${dsId}] Query failed (${response.status}, no retry): ${errMsg}`);
            return { headers: [], rows: [], error: errMsg };
          }
        } catch { /* use raw text */ }

        lastError = errMsg;
        console.warn(`[${dsId}] Query attempt ${attempt + 1} failed (${response.status}): ${errMsg}`);

        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 2000; // 2s, 4s
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { headers: [], rows: [], error: errMsg };
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.warn(`[${dsId}] Query returned empty data for account ${accountId}`);
        return { headers: [], rows: [] };
      }

      const headers = data.data[0] as string[];
      const rows = data.data.slice(1) as (string | number)[][];

      console.log(`[${dsId}] ✅ Got ${rows.length} rows, headers: ${JSON.stringify(headers)}`);

      // Validate: warn if we got rows but all numeric values are 0
      if (rows.length > 0) {
        const hasNonZero = rows.some(row =>
          row.some((v, i) => i > 0 && parseFloat(String(v || '0')) > 0)
        );
        if (!hasNonZero) {
          console.warn(`[${dsId}] ⚠️ All rows have zero values for account ${accountId}`);
        }
      }

      return { headers, rows };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[${dsId}] Query attempt ${attempt + 1} threw: ${lastError}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
  }

  // Fallback: try GET endpoint if we hit the prioritised account error
  if (hitPrioritisedError) {
    const getResult = await queryViaGet(apiKey, dsId, accountId, dateStart, dateEnd, fields);
    if (getResult.rows.length > 0 || !getResult.error) {
      return getResult;
    }
    // If GET also failed with prioritised error, return that
    lastError = getResult.error || lastError;
  }

  return { headers: [], rows: [], error: lastError || 'Unknown error after retries' };
}

// ==========================================
// DIRECT API FALLBACK — Google Ads & Meta Ads
// ==========================================
// When Supermetrics fails (prioritised account errors, 4xx, empty data),
// retry via the direct platform API for Google Ads and Meta Ads accounts.

const GOOGLE_TOKEN_URL_DIRECT = 'https://oauth2.googleapis.com/token';
import { GOOGLE_ADS_API_BASE as GOOGLE_ADS_API_BASE_DIRECT } from '../_shared/googleAds.ts';
const META_API_BASE_DIRECT = 'https://graph.facebook.com/v19.0';

async function getGoogleAccessTokenDirect(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Ads OAuth credentials not configured');
  }
  const res = await fetch(GOOGLE_TOKEN_URL_DIRECT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth refresh failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

function googleHeadersDirect(accessToken: string): Record<string, string> {
  const loginCustomerId = Deno.env.get('GOOGLE_ADS_LOGIN_CUSTOMER_ID');
  const h: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) {
    h['login-customer-id'] = loginCustomerId.replace(/\D/g, '');
  }
  return h;
}

async function fetchGoogleAdsMetricsDirect(
  accountId: string,
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<{ spend: number; conv: number; clicks: number; impressions: number; leads: number; purchases: number; calls: number; error?: string }> {
  const customerId = accountId.replace(/\D/g, '');
  const headers = googleHeadersDirect(accessToken);
  const endpoint = `${GOOGLE_ADS_API_BASE_DIRECT}/customers/${customerId}/googleAds:search`;

  // Query 1: Aggregate metrics
  const metricsRes = await fetch(endpoint, {
    method: 'POST', headers,
    body: JSON.stringify({
      query: `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'`,
    }),
  });

  if (!metricsRes.ok) {
    const errText = await metricsRes.text();
    return { spend: 0, conv: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, calls: 0, error: `Google Ads API ${metricsRes.status}: ${errText}` };
  }

  const metricsJson = await metricsRes.json();
  let spend = 0, clicks = 0, impressions = 0, conv = 0;
  for (const result of metricsJson.results || []) {
    const m = result.metrics || {};
    spend += Number(m.costMicros || 0) / 1_000_000;
    clicks += Number(m.clicks || 0);
    impressions += Number(m.impressions || 0);
    conv += Number(m.conversions || 0);
  }

  // Query 2: Conversion action breakdown for leads/purchases/calls split
  let leads = 0, purchases = 0, calls = 0;
  try {
    const convRes = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: `SELECT conversion_action.name, metrics.conversions FROM conversion_action WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}' AND metrics.conversions > 0`,
      }),
    });
    if (convRes.ok) {
      const convJson = await convRes.json();
      for (const result of convJson.results || []) {
        const actionName = result.conversionAction?.name || '';
        const count = Number(result.metrics?.conversions || 0);
        if (!actionName || count === 0) continue;
        const type = classifyConversionAction(actionName);
        if (type === 'calls') calls += count;
        else if (type === 'purchases') purchases += count;
        else leads += count;
      }
    }
  } catch (e) {
    console.warn(`[BULK FALLBACK] Conversion breakdown query failed for ${accountId}:`, e);
    // Fall back: classify all conversions as leads
    leads = conv;
  }

  return { spend, conv, clicks, impressions, leads, purchases, calls };
}

async function fetchMetaAdsMetricsDirect(
  accountId: string,
  dateStart: string,
  dateEnd: string,
): Promise<{ spend: number; conv: number; clicks: number; impressions: number; leads: number; purchases: number; calls: number; error?: string }> {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) {
    return { spend: 0, conv: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, calls: 0, error: 'META_ACCESS_TOKEN not configured' };
  }

  // Ensure account ID is in act_XXXX format
  const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const timeRange = JSON.stringify({ since: dateStart, until: dateEnd });
  const url = `${META_API_BASE_DIRECT}/${actId}/insights?fields=spend,impressions,clicks,actions&time_range=${encodeURIComponent(timeRange)}&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    return { spend: 0, conv: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, calls: 0, error: `Meta API ${res.status}: ${errText}` };
  }

  const json = await res.json();
  const data = json.data?.[0];
  if (!data) {
    return { spend: 0, conv: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, calls: 0 };
  }

  const metaSpend = parseFloat(data.spend || '0');
  const metaImpressions = parseInt(data.impressions || '0', 10);
  const metaClicks = parseInt(data.clicks || '0', 10);
  let leads = 0, metaPurchases = 0;
  const actions = data.actions || [];
  for (const action of actions) {
    const actionType = action.action_type || '';
    const value = parseFloat(action.value || '0');
    if (actionType === 'offsite_conversion.fb_pixel_lead' || actionType === 'onsite_conversion.lead_grouped') {
      leads += value;
    } else if (actionType === 'offsite_conversion.fb_pixel_purchase') {
      metaPurchases += value;
    }
  }

  const metaConv = leads + metaPurchases;
  return { spend: metaSpend, conv: metaConv, clicks: metaClicks, impressions: metaImpressions, leads, purchases: metaPurchases, calls: 0 };
}

// ==========================================
// LIST ACCOUNTS
// ==========================================
async function listAccounts(apiKey: string, dsId: string): Promise<{ id: string; name: string }[]> {
  try {
    const queryParams = JSON.stringify({ ds_id: dsId });
    const url = `${SUPERMETRICS_API_URL}/query/accounts?json=${encodeURIComponent(queryParams)}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.error(`Failed to list accounts for ${dsId}: ${response.status}`);
      return [];
    }

    const result = await response.json();
    const seen = new Set<string>();
    const allAccounts: { id: string; name: string }[] = [];

    if (result.data && Array.isArray(result.data)) {
      for (const login of result.data) {
        if (login.accounts && Array.isArray(login.accounts)) {
          for (const acc of login.accounts) {
            const accId = acc.account_id || acc.id || '';
            const accName = acc.account_name || acc.name || acc.account_id || '';
            const dedupeKey = `${accId}|${accName.toLowerCase()}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            allAccounts.push({ id: accId, name: accName });
          }
        }
      }
    }

    return allAccounts;
  } catch (err) {
    console.error(`Error listing accounts for ${dsId}:`, err);
    return [];
  }
}

// ==========================================
// AGGREGATE: Build summary metrics from rows
// ==========================================
function getConversionBreakdown(
  row: (string | number)[],
  col: Record<string, number>,
  dsId: string,
): { leads: number; purchases: number; calls: number } {
  if (dsId === 'FA') {
    const websiteLeads = getNum(row, col, 'websiteLeads');
    const onsiteLeads = getNum(row, col, 'onsiteLeads');
    const websitePurchases = getNum(row, col, 'websitePurchases');
    return {
      leads: websiteLeads + onsiteLeads,
      purchases: websitePurchases,
      calls: 0,
    };
  }
  // For Google/TikTok/Bing/LinkedIn — Supermetrics doesn't split by conversion type.
  // Classify all primary conversions as leads (the most common type for lead-gen clients).
  // The frontend can redistribute based on per-client tracked_conversion_types settings.
  const totalConv = getConversions(row, col, dsId);
  return { leads: totalConv, purchases: 0, calls: 0 };
}

function buildSummary(
  rows: (string | number)[][],
  col: Record<string, number>,
  dsId: string,
): Record<string, number> {
  let impressions = 0, clicks = 0, cost = 0, conversions = 0, reach = 0;
  let leads = 0, purchases = 0, phoneCalls = 0;

  for (const row of rows) {
    impressions += getNum(row, col, 'impressions');
    clicks += getNum(row, col, 'clicks');
    cost += getNum(row, col, 'cost');
    conversions += getConversions(row, col, dsId);
    reach += getNum(row, col, 'reach');

    const breakdown = getConversionBreakdown(row, col, dsId);
    leads += breakdown.leads;
    purchases += breakdown.purchases;
    phoneCalls += breakdown.calls;
  }

  const metrics: Record<string, number> = {
    _impressions: impressions,
    _clicks: clicks,
    _cost: cost,
    _conversions: conversions,
    _leads: leads,
    _purchases: purchases,
    _phoneCalls: phoneCalls,
  };

  if (reach > 0) metrics._reach = reach;
  if (impressions > 0) {
    metrics._ctr = (clicks / impressions) * 100;
    metrics._cpm = (cost / impressions) * 1000;
  }
  if (clicks > 0) {
    metrics._cpc = cost / clicks;
    metrics._conversion_rate = (conversions / clicks) * 100;
  }
  if (conversions > 0) metrics._cpa = cost / conversions;
  if (leads > 0) metrics._cpl = cost / leads;
  if (purchases > 0) metrics._costPerPurchase = cost / purchases;

  return metrics;
}

// ==========================================
// BUILD CAMPAIGN BREAKDOWN
// ==========================================
function buildCampaigns(
  rows: (string | number)[][],
  col: Record<string, number>,
  dsId: string,
) {
  const campMap: Record<string, { impressions: number; clicks: number; cost: number; conversions: number; leads: number; purchases: number; calls: number }> = {};

  for (const row of rows) {
    const name = getStr(row, col, 'campaign');
    if (!name) continue;
    if (!campMap[name]) campMap[name] = { impressions: 0, clicks: 0, cost: 0, conversions: 0, leads: 0, purchases: 0, calls: 0 };
    campMap[name].impressions += getNum(row, col, 'impressions');
    campMap[name].clicks += getNum(row, col, 'clicks');
    campMap[name].cost += getNum(row, col, 'cost');
    campMap[name].conversions += getConversions(row, col, dsId);

    const breakdown = getConversionBreakdown(row, col, dsId);
    campMap[name].leads += breakdown.leads;
    campMap[name].purchases += breakdown.purchases;
    campMap[name].calls += breakdown.calls;
  }

  return Object.entries(campMap)
    .filter(([_, v]) => v.cost > 0 || v.clicks > 0)
    .map(([name, v]) => ({
      name,
      spend: v.cost,
      impressions: v.impressions,
      clicks: v.clicks,
      conversions: v.conversions,
      leads: v.leads,
      purchases: v.purchases,
      calls: v.calls,
      ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
      cpc: v.clicks > 0 ? v.cost / v.clicks : 0,
      cpa: v.conversions > 0 ? v.cost / v.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// ==========================================
// BUILD DAILY DATA FOR CHARTS
// ==========================================
function buildDailyData(
  rows: (string | number)[][],
  col: Record<string, number>,
  dsId: string,
) {
  const dayMap: Record<string, { spend: number; clicks: number; impressions: number; conversions: number; leads: number; purchases: number; calls: number }> = {};

  for (const row of rows) {
    const d = getStr(row, col, 'date');
    if (!d) continue;
    if (!dayMap[d]) dayMap[d] = { spend: 0, clicks: 0, impressions: 0, conversions: 0, leads: 0, purchases: 0, calls: 0 };
    dayMap[d].spend += getNum(row, col, 'cost');
    dayMap[d].clicks += getNum(row, col, 'clicks');
    dayMap[d].impressions += getNum(row, col, 'impressions');
    dayMap[d].conversions += getConversions(row, col, dsId);

    const breakdown = getConversionBreakdown(row, col, dsId);
    dayMap[d].leads += breakdown.leads;
    dayMap[d].purchases += breakdown.purchases;
    dayMap[d].calls += breakdown.calls;
  }

  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: date.length > 5 ? date.slice(5) : date,
      ...v,
    }));
}

// DO NOT modify Facebook CDN URLs - they are cryptographically signed.
// Changing ANY parameter (stp, oh, etc.) invalidates the signature → 403.
// The ONLY reliable way to get high-res Meta images is the Graph API.

// ==========================================
// BUILD TOP CREATIVES
// ==========================================
function buildTopCreatives(
  rows: (string | number)[][],
  col: Record<string, number>,
  dsId: string,
) {
  const adMap: Record<string, {
    adName: string; campaignName: string; imageUrl: string; thumbnailUrl: string;
    adId?: string; creativeId?: string;
    impressions: number; clicks: number; cost: number; conversions: number;
  }> = {};

  for (const row of rows) {
    const adName = getStr(row, col, 'adname') || getStr(row, col, 'campaign');
    if (!adName) continue;

    if (!adMap[adName]) {
      const imgUrl = getStr(row, col, 'imageurl');
      const thumbUrl = getStr(row, col, 'thumbnail');
      adMap[adName] = {
        adName,
        campaignName: getStr(row, col, 'campaign'),
        imageUrl: imgUrl.startsWith('http') ? imgUrl : (thumbUrl.startsWith('http') ? thumbUrl : ''),
        thumbnailUrl: thumbUrl.startsWith('http') ? thumbUrl : '',
        adId: getStr(row, col, 'adid') || undefined,
        creativeId: getStr(row, col, 'creativeid') || undefined,
        impressions: 0, clicks: 0, cost: 0, conversions: 0,
      };
    }

    // Update image if better one found
    const imgUrl = getStr(row, col, 'imageurl');
    const thumbUrl = getStr(row, col, 'thumbnail');
    if (imgUrl.startsWith('http')) adMap[adName].imageUrl = imgUrl;
    if (thumbUrl.startsWith('http')) adMap[adName].thumbnailUrl = thumbUrl;

    adMap[adName].impressions += getNum(row, col, 'impressions');
    adMap[adName].clicks += getNum(row, col, 'clicks');
    adMap[adName].cost += getNum(row, col, 'cost');
    adMap[adName].conversions += getConversions(row, col, dsId);
  }

  return Object.values(adMap)
    .filter(a => a.impressions > 0)
    .map(a => ({
      ...a,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.cost / a.clicks : 0,
      cpa: a.conversions > 0 ? a.cost / a.conversions : 0,
    }))
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 6);
}

// ==========================================
// BUILD KEYWORDS
// ==========================================
function buildKeywords(
  rows: (string | number)[][],
  col: Record<string, number>,
) {
  const kwMap: Record<string, {
    keyword: string; campaignName: string;
    impressions: number; clicks: number; cost: number; conversions: number;
  }> = {};

  for (const row of rows) {
    const keyword = getStr(row, col, 'keyword');
    if (!keyword) continue;

    if (!kwMap[keyword]) {
      kwMap[keyword] = {
        keyword,
        campaignName: getStr(row, col, 'campaign'),
        impressions: 0, clicks: 0, cost: 0, conversions: 0,
      };
    }

    kwMap[keyword].impressions += getNum(row, col, 'impressions');
    kwMap[keyword].clicks += getNum(row, col, 'clicks');
    kwMap[keyword].cost += getNum(row, col, 'cost');
    kwMap[keyword].conversions += getNum(row, col, 'conversions');
  }

  return Object.values(kwMap)
    .filter(k => k.impressions > 0)
    .map(k => ({
      ...k,
      ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
      cpc: k.clicks > 0 ? k.cost / k.clicks : 0,
      cpa: k.conversions > 0 ? k.cost / k.conversions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

// ==========================================
// CACHE CREATIVE IMAGES TO PERMANENT STORAGE
// Facebook CDN URLs expire after hours/days, causing blank images in decks.
// This downloads them and re-hosts in Supabase Storage.
// Enhanced: tries upgraded high-res URLs + Meta Graph API for full-res.
// ==========================================
async function cacheCreativeImages(
  creatives: { adName: string; imageUrl: string; thumbnailUrl?: string; [k: string]: unknown }[],
  accountId: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, supabaseKey);
  const metaToken = Deno.env.get('META_ACCESS_TOKEN');

  const GOOD_IMAGE_BYTES = 30000; // 30KB

  await Promise.allSettled(creatives.map(async (creative) => {
    const safeName = (creative.adName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 60);
    const safeAccount = accountId.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = `${safeAccount}/${safeName}.jpg`;

    // Check if already cached AND large enough
    try {
      const { data: existing } = await sb.storage.from('creative-images').list(safeAccount, {
        search: `${safeName}.jpg`,
        limit: 1,
      });
      if (existing && existing.length > 0) {
        const cachedSize = (existing[0] as any).metadata?.size || 0;
        if (cachedSize >= GOOD_IMAGE_BYTES) {
          const { data: { publicUrl } } = sb.storage.from('creative-images').getPublicUrl(filePath);
          creative.imageUrl = publicUrl;
          console.log(`[cache] Already cached & good: ${creative.adName} (${cachedSize}b)`);
          return;
        }
        console.log(`[cache] Re-caching ${creative.adName} — too small (${cachedSize}b)`);
      }
    } catch (_) {}

    const originalImageUrl = creative.imageUrl || '';
    const originalThumbUrl = creative.thumbnailUrl || '';
    const isFbUrl = [originalImageUrl, originalThumbUrl].some(u =>
      u.includes('fbcdn.net') || u.includes('facebook.com') || u.includes('fb.com')
    );
    if (!isFbUrl && !originalImageUrl.startsWith('http')) return;

    let downloadedBlob: Blob | null = null;
    let contentType = 'image/jpeg';

    // ===== STRATEGY 1: Meta Graph API (MOST RELIABLE for high-res) =====
    const trimmedToken = metaToken?.trim();
    if (trimmedToken) {
      console.log(`[META_TOKEN_DEBUG] len=${trimmedToken.length}, first4=${trimmedToken.substring(0,4)}, last4=${trimmedToken.substring(trimmedToken.length-4)}, hasQuotes=${trimmedToken.startsWith('"') || trimmedToken.startsWith("'")}`);
      const tokenToUse = trimmedToken.replace(/^["']|["']$/g, '');
      const adIdVal = (creative as any).adId;
      const creativeIdVal = (creative as any).creativeId;

      // 1a. Use ad_id → fetch the ad's creative with full image fields
      if (adIdVal) {
        try {
          console.log(`[cache] ${creative.adName}: Graph API via ad_id ${adIdVal}...`);
          const adResp = await fetch(
            `https://graph.facebook.com/v21.0/${adIdVal}?fields=creative{image_url,thumbnail_url,object_story_spec}&access_token=${tokenToUse}`
          );
          if (adResp.ok) {
            const adData = await adResp.json();
            const cr = adData.creative;
            console.log(`[cache] ${creative.adName}: ad→creative response: image_url=${cr?.image_url ? 'YES' : 'NO'}, thumbnail=${cr?.thumbnail_url ? 'YES' : 'NO'}`);
            
            // Try image_url (full resolution)
            if (cr?.image_url) {
              const imgResp = await fetch(cr.image_url);
              if (imgResp.ok) {
                const blob = await imgResp.blob();
                console.log(`[cache] ${creative.adName}: ad→creative image_url = ${blob.size}b`);
                if (blob.size > (downloadedBlob?.size || 0)) {
                  downloadedBlob = blob;
                  contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                }
              }
            }
            
            // Also try thumbnail at 1080px if image_url wasn't big enough
            if ((!downloadedBlob || downloadedBlob.size < GOOD_IMAGE_BYTES) && cr?.id) {
              const thumbResp = await fetch(
                `https://graph.facebook.com/v21.0/${cr.id}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${tokenToUse}`
              );
              if (thumbResp.ok) {
                const thumbData = await thumbResp.json();
                if (thumbData.thumbnail_url) {
                  const imgResp = await fetch(thumbData.thumbnail_url);
                  if (imgResp.ok) {
                    const blob = await imgResp.blob();
                    console.log(`[cache] ${creative.adName}: creative thumbnail 1080px = ${blob.size}b`);
                    if (blob.size > (downloadedBlob?.size || 0)) {
                      downloadedBlob = blob;
                      contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                    }
                  }
                }
              }
            }

            // Try object_story_spec for the actual post image
            if ((!downloadedBlob || downloadedBlob.size < GOOD_IMAGE_BYTES) && cr?.object_story_spec) {
              const spec = cr.object_story_spec;
              const postPicture = spec?.link_data?.picture || spec?.link_data?.image_url || spec?.video_data?.image_url;
              if (postPicture) {
                try {
                  const imgResp = await fetch(postPicture);
                  if (imgResp.ok) {
                    const blob = await imgResp.blob();
                    console.log(`[cache] ${creative.adName}: object_story_spec picture = ${blob.size}b`);
                    if (blob.size > (downloadedBlob?.size || 0)) {
                      downloadedBlob = blob;
                      contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                    }
                  }
                } catch (_) {}
              }
            }
          } else {
            const errText = await adResp.text();
            console.warn(`[cache] ${creative.adName}: Graph API ad_id ${adIdVal} failed (${adResp.status}): ${errText.substring(0, 200)}`);
          }
        } catch (e) {
          console.warn(`[cache] ${creative.adName}: Graph API ad_id error:`, e);
        }
      }

      // 1b. Use creative_id directly
      if ((!downloadedBlob || downloadedBlob.size < GOOD_IMAGE_BYTES) && creativeIdVal) {
        try {
          console.log(`[cache] ${creative.adName}: Graph API via creative_id ${creativeIdVal}...`);
          const crResp = await fetch(
            `https://graph.facebook.com/v21.0/${creativeIdVal}?fields=image_url,thumbnail_url,effective_object_story_id&thumbnail_width=1080&thumbnail_height=1080&access_token=${tokenToUse}`
          );
          if (crResp.ok) {
            const crData = await crResp.json();
            console.log(`[cache] ${creative.adName}: creative_id response: image_url=${crData.image_url ? 'YES' : 'NO'}, thumbnail=${crData.thumbnail_url ? 'YES' : 'NO'}, story=${crData.effective_object_story_id || 'NO'}`);
            
            for (const urlField of [crData.image_url, crData.thumbnail_url]) {
              if (!urlField) continue;
              try {
                const imgResp = await fetch(urlField);
                if (imgResp.ok) {
                  const blob = await imgResp.blob();
                  console.log(`[cache] ${creative.adName}: creative_id field = ${blob.size}b`);
                  if (blob.size > (downloadedBlob?.size || 0)) {
                    downloadedBlob = blob;
                    contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                    if (blob.size >= GOOD_IMAGE_BYTES) break;
                  }
                }
              } catch (_) {}
            }

            // Try effective_object_story_id to get the actual post's full image
            if ((!downloadedBlob || downloadedBlob.size < GOOD_IMAGE_BYTES) && crData.effective_object_story_id) {
              try {
                const storyResp = await fetch(
                  `https://graph.facebook.com/v21.0/${crData.effective_object_story_id}?fields=full_picture&access_token=${tokenToUse}`
                );
                if (storyResp.ok) {
                  const storyData = await storyResp.json();
                  if (storyData.full_picture) {
                    const imgResp = await fetch(storyData.full_picture);
                    if (imgResp.ok) {
                      const blob = await imgResp.blob();
                      console.log(`[cache] ${creative.adName}: full_picture from story = ${blob.size}b`);
                      if (blob.size > (downloadedBlob?.size || 0)) {
                        downloadedBlob = blob;
                        contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                      }
                    }
                  }
                }
              } catch (_) {}
            }
          } else {
            const errText = await crResp.text();
            console.warn(`[cache] ${creative.adName}: creative_id ${creativeIdVal} failed (${crResp.status}): ${errText.substring(0, 200)}`);
          }
        } catch (e) {
          console.warn(`[cache] ${creative.adName}: Graph API creative_id error:`, e);
        }
      }

      // 1c. Try using account's adimages endpoint with image_hash from creative
      if ((!downloadedBlob || downloadedBlob.size < GOOD_IMAGE_BYTES) && (creative as any).adId) {
        try {
          // Get image_hash from the creative
          const hashResp = await fetch(
            `https://graph.facebook.com/v21.0/${(creative as any).adId}?fields=creative{image_hash}&access_token=${tokenToUse}`
          );
          if (hashResp.ok) {
            const hashData = await hashResp.json();
            const imageHash = hashData?.creative?.image_hash;
            if (imageHash) {
              console.log(`[cache] ${creative.adName}: got image_hash=${imageHash}, fetching full image...`);
              const imgResp = await fetch(
                `https://graph.facebook.com/v21.0/${accountId}/adimages?hashes[]=${imageHash}&fields=url,url_128&access_token=${tokenToUse}`
              );
              if (imgResp.ok) {
                const imgData = await imgResp.json();
                const images = imgData?.data || [];
                for (const img of images) {
                  const fullUrl = img.url || img.url_128;
                  if (fullUrl) {
                    const dlResp = await fetch(fullUrl);
                    if (dlResp.ok) {
                      const blob = await dlResp.blob();
                      console.log(`[cache] ${creative.adName}: adimages hash url = ${blob.size}b`);
                      if (blob.size > (downloadedBlob?.size || 0)) {
                        downloadedBlob = blob;
                        contentType = dlResp.headers.get('content-type') || 'image/jpeg';
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[cache] ${creative.adName}: adimages hash lookup error:`, e);
        }
      }
    }

    // ===== STRATEGY 2: Original CDN URLs as-is (DON'T modify signed URLs) =====
    if (!downloadedBlob || downloadedBlob.size < GOOD_IMAGE_BYTES) {
      const urlsToTry = [originalImageUrl, originalThumbUrl].filter(u => u.startsWith('http'));
      for (const url of urlsToTry) {
        try {
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          if (!resp.ok) continue;
          const blob = await resp.blob();
          if (blob.size > (downloadedBlob?.size || 0)) {
            downloadedBlob = blob;
            contentType = resp.headers.get('content-type') || 'image/jpeg';
            console.log(`[cache] ${creative.adName}: CDN original = ${blob.size}b`);
            if (blob.size >= GOOD_IMAGE_BYTES) break;
          }
        } catch (_) {}
      }
    }

    if (!downloadedBlob || downloadedBlob.size < 100) {
      console.warn(`[cache] ❌ All strategies failed for ${creative.adName}`);
      return;
    }

    try {
      const arrayBuffer = await downloadedBlob.arrayBuffer();
      const { error } = await sb.storage.from('creative-images').upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });
      if (error) {
        console.warn(`[cache] Upload failed for ${creative.adName}:`, error.message);
        return;
      }

      const { data: { publicUrl } } = sb.storage.from('creative-images').getPublicUrl(filePath);
      creative.imageUrl = publicUrl;
      console.log(`[cache] ✅ Cached ${creative.adName} → ${publicUrl} (${downloadedBlob.size}b)`);
    } catch (e) {
      console.warn(`[cache] Upload error for ${creative.adName}:`, e);
    }
  }));
}

// ==========================================
// MAIN HANDLER
// ==========================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
    const apiKey = Deno.env.get('SUPERMETRICS_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Supermetrics API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== LIST ACCOUNTS ==========
    if (action === 'list-accounts') {
      const { dataSources } = body;
      const results: Record<string, { id: string; name: string }[]> = {};

      const dsKeys = dataSources || Object.keys(DATA_SOURCES);
      await Promise.all(dsKeys.map(async (dsKey: string) => {
        const ds = DATA_SOURCES[dsKey];
        if (!ds) return;
        const accounts = await listAccounts(apiKey, ds.id);
        if (accounts.length > 0) {
          results[dsKey] = accounts;
        }
      }));

      return new Response(JSON.stringify({ success: true, accounts: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== FETCH DATA BULK ==========
    if (action === 'fetch-data-bulk') {
      const { bulkClients, dateStart, dateEnd } = body;
      if (!bulkClients || !dateStart || !dateEnd) {
        return new Response(JSON.stringify({ error: 'Missing bulkClients, dateStart, or dateEnd' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Deduplicate: collect unique (dsId, accountId) pairs across all clients
      const uniqueQuerySet = new Set<string>();
      const uniqueQueries: { dsKey: string; dsId: string; accountId: string }[] = [];
      for (const [, accountMap] of Object.entries(bulkClients as Record<string, Record<string, string[]>>)) {
        for (const [dsKey, accountIds] of Object.entries(accountMap)) {
          const ds = DATA_SOURCES[dsKey];
          if (!ds) continue;
          for (const accountId of accountIds) {
            const key = `${ds.id}:${accountId}`;
            if (!uniqueQuerySet.has(key)) {
              uniqueQuerySet.add(key);
              uniqueQueries.push({ dsKey, dsId: ds.id, accountId });
            }
          }
        }
      }

      const platformAccountData: Record<string, Record<string, { headers: string[]; rows: (string | number)[][]; error?: string; _directApiResult?: { spend: number; conv: number; clicks: number; impressions: number; leads: number; purchases: number; calls: number } }>> = {};

      console.log(`[BULK] ${uniqueQueries.length} unique platform+account queries to execute`);

      // Execute all unique queries in parallel batches of 5
      const batchSize = 5;
      for (let i = 0; i < uniqueQueries.length; i += batchSize) {
        const batch = uniqueQueries.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(async ({ dsKey, dsId, accountId }) => {
          const def = PLATFORM_DEFS[dsId];
          if (!def) return;

          const result = await queryWithRetry(apiKey, dsId, accountId, dateStart, dateEnd, def.dailyFields, 2);
          if (!platformAccountData[dsId]) platformAccountData[dsId] = {};
          platformAccountData[dsId][accountId] = result;
        }));
      }

      // Declare breakdownResults early so the fallback pass can populate it
      const breakdownResults: Record<string, Record<string, { leads: number; purchases: number; calls: number }>> = {};

      // ── DIRECT API FALLBACK ──────────────────────────────────────────────────
      // Identify failed AW (Google Ads) and FA (Meta Ads) accounts, retry via direct API
      const failedAW: string[] = [];
      const failedFA: string[] = [];
      for (const { dsId, accountId } of uniqueQueries) {
        const qr = platformAccountData[dsId]?.[accountId];
        if (!qr) continue;
        const isFailed = !!qr.error || qr.rows.length === 0;
        if (!isFailed) continue;
        if (dsId === 'AW') failedAW.push(accountId);
        else if (dsId === 'FA') failedFA.push(accountId);
      }

      if (failedAW.length > 0 || failedFA.length > 0) {
        console.log(`[BULK FALLBACK] ${failedAW.length} failed AW accounts, ${failedFA.length} failed FA accounts — retrying via direct API`);
      }

      // Google Ads direct API fallback
      if (failedAW.length > 0) {
        try {
          const googleToken = await getGoogleAccessTokenDirect();
          for (let i = 0; i < failedAW.length; i += batchSize) {
            const batch = failedAW.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(async (accountId) => {
              try {
                const dr = await fetchGoogleAdsMetricsDirect(accountId, dateStart, dateEnd, googleToken);
                if (dr.error) {
                  console.warn(`[BULK FALLBACK] Google Ads direct API failed for ${accountId}: ${dr.error}`);
                  return;
                }
                console.log(`[BULK FALLBACK] ✅ Google Ads direct API success for ${accountId}: spend=$${dr.spend.toFixed(2)}, conv=${dr.conv}`);
                // Overwrite the failed Supermetrics entry with direct API result
                if (!platformAccountData['AW']) platformAccountData['AW'] = {};
                platformAccountData['AW'][accountId] = {
                  headers: [], rows: [],
                  _directApiResult: dr,
                };
                // Also populate breakdownResults so conversion breakdown query is skipped
                if (!breakdownResults['AW']) breakdownResults['AW'] = {};
                breakdownResults['AW'][accountId] = { leads: dr.leads, purchases: dr.purchases, calls: dr.calls };
              } catch (e) {
                console.warn(`[BULK FALLBACK] Google Ads direct API error for ${accountId}:`, e);
              }
            }));
          }
        } catch (e) {
          console.error(`[BULK FALLBACK] Google OAuth token refresh failed:`, e);
        }
      }

      // Meta Ads direct API fallback
      if (failedFA.length > 0) {
        for (let i = 0; i < failedFA.length; i += batchSize) {
          const batch = failedFA.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(async (accountId) => {
            try {
              const dr = await fetchMetaAdsMetricsDirect(accountId, dateStart, dateEnd);
              if (dr.error) {
                console.warn(`[BULK FALLBACK] Meta Ads direct API failed for ${accountId}: ${dr.error}`);
                return;
              }
              console.log(`[BULK FALLBACK] ✅ Meta Ads direct API success for ${accountId}: spend=$${dr.spend.toFixed(2)}, conv=${dr.conv}`);
              if (!platformAccountData['FA']) platformAccountData['FA'] = {};
              platformAccountData['FA'][accountId] = {
                headers: [], rows: [],
                _directApiResult: dr,
              };
            } catch (e) {
              console.warn(`[BULK FALLBACK] Meta Ads direct API error for ${accountId}:`, e);
            }
          }));
        }
      }

      // Query conversion action breakdown for AW/AC accounts (skip accounts already recovered by direct API)
      const breakdownQueries = uniqueQueries.filter(q =>
        (q.dsId === 'AW' || q.dsId === 'AC') && !breakdownResults[q.dsId]?.[q.accountId]
      );
      if (breakdownQueries.length > 0) {
        console.log(`[BULK] Querying conversion breakdown for ${breakdownQueries.length} AW/AC accounts`);
        for (let i = 0; i < breakdownQueries.length; i += batchSize) {
          const batch = breakdownQueries.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(async ({ dsId, accountId }) => {
            const bd = await queryConversionBreakdown(apiKey, dsId, accountId, dateStart, dateEnd);
            if (bd) {
              if (!breakdownResults[dsId]) breakdownResults[dsId] = {};
              breakdownResults[dsId][accountId] = bd;
            }
          }));
        }
      }

      // Now assemble per-client results from the shared query results
      const clientResults: Record<string, Record<string, { spend: number; conv: number; calls: number; costPerConv: number; leads: number; purchases: number; error?: string }>> = {};

      for (const [clientName, accountMap] of Object.entries(bulkClients)) {
        const clientResult: Record<string, { spend: number; conv: number; calls: number; costPerConv: number; leads: number; purchases: number; error?: string }> = {};

        for (const [dsKey, accountIds] of Object.entries(accountMap)) {
          const ds = DATA_SOURCES[dsKey];
          if (!ds) continue;
          const def = PLATFORM_DEFS[ds.id];
          if (!def) continue;

          let totalSpend = 0, totalConv = 0, totalCalls = 0, totalLeads = 0, totalPurchases = 0;
          const errors: string[] = [];

          for (const accountId of accountIds) {
            const queryResult = platformAccountData[ds.id]?.[accountId];
            if (!queryResult) { errors.push('No data fetched'); continue; }

            // Direct API fallback results have pre-computed metrics — skip Supermetrics parsing
            if (queryResult._directApiResult) {
              const dr = queryResult._directApiResult;
              totalSpend += dr.spend;
              totalConv += dr.conv;
              totalLeads += dr.leads;
              totalPurchases += dr.purchases;
              totalCalls += dr.calls;
              continue;
            }

            if (queryResult.error) { errors.push(queryResult.error); continue; }
            if (queryResult.rows.length === 0) continue;

            const col = buildColumnMap(def.fieldOrder, queryResult.headers);
            const summary = buildSummary(queryResult.rows, col, ds.id);
            totalSpend += summary._cost || 0;
            totalConv += summary._conversions || 0;

            // Use conversion action breakdown if available (for AW/AC), otherwise use default
            const accountBreakdown = breakdownResults[ds.id]?.[accountId];
            if (accountBreakdown) {
              totalLeads += accountBreakdown.leads;
              totalPurchases += accountBreakdown.purchases;
              totalCalls += accountBreakdown.calls;
            } else {
              totalCalls += summary._phoneCalls || 0;
              totalLeads += summary._leads || 0;
              totalPurchases += summary._purchases || 0;
            }
          }

          // Only include if we have real data or errors
          if (totalSpend > 0 || totalConv > 0 || errors.length === 0) {
            clientResult[dsKey] = {
              spend: totalSpend,
              conv: totalConv,
              calls: totalCalls,
              leads: totalLeads,
              purchases: totalPurchases,
              costPerConv: totalConv > 0 ? totalSpend / totalConv : 0,
              ...(errors.length > 0 ? { error: errors[0] } : {}),
            };
          } else if (errors.length > 0) {
            clientResult[dsKey] = { spend: 0, conv: 0, calls: 0, leads: 0, purchases: 0, costPerConv: 0, error: errors[0] };
          }
        }

        if (Object.keys(clientResult).length > 0) {
          clientResults[clientName] = clientResult;
        }
      }

      console.log(`[BULK] ✅ Completed. ${Object.keys(clientResults).length}/${Object.keys(bulkClients).length} clients have data`);

      return new Response(JSON.stringify({
        success: true,
        dateRange: { start: dateStart, end: dateEnd },
        clients: clientResults,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== FETCH DATA ==========
    if (action === 'fetch-data') {
      const { dataSources, accounts, dateStart, dateEnd, compareStart, compareEnd } = body as SupermetricsRequest;

      if (!dataSources || !accounts || !dateStart || !dateEnd) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results: Record<string, unknown> = {};

      const fetchPromises = dataSources.map(async (dsKey: string) => {
        const ds = DATA_SOURCES[dsKey];
        if (!ds) return;

        const def = PLATFORM_DEFS[ds.id];
        if (!def) {
          console.error(`No platform definition for ${ds.id}`);
          return;
        }

        const rawAccountIds = accounts[dsKey];
        if (!rawAccountIds) return;
        const accountIds = Array.isArray(rawAccountIds) ? rawAccountIds : [rawAccountIds];
        if (accountIds.length === 0) return;

        // Get account names
        const allAccounts = await listAccounts(apiKey, ds.id);
        const nameMap: Record<string, string> = {};
        for (const acc of allAccounts) nameMap[acc.id] = acc.name;

        for (let accIdx = 0; accIdx < accountIds.length; accIdx++) {
          const accountId = accountIds[accIdx];
          const accountName = nameMap[accountId] || accountId;
          const versionLabel = accountIds.length > 1 ? ` V${accIdx + 1}` : '';
          const resultKey = accountIds.length > 1 ? `${dsKey}_v${accIdx + 1}` : dsKey;

          const errors: string[] = [];

          // ===== DAILY/CAMPAIGN DATA =====
          console.log(`[${ds.id}] Fetching daily data for ${accountName} (${accountId})...`);
          const data = await queryWithRetry(apiKey, ds.id, accountId, dateStart, dateEnd, def.dailyFields);
          if (data.error) errors.push(`Data: ${data.error}`);

          const hasData = !data.error && data.rows.length > 0;
          const col = hasData ? buildColumnMap(def.fieldOrder, data.headers) : {};

          const summary = hasData ? buildSummary(data.rows, col, ds.id) : {};
          const campaigns = hasData ? buildCampaigns(data.rows, col, ds.id) : [];
          const dailyData = hasData ? buildDailyData(data.rows, col, ds.id) : [];

          // Query conversion action breakdown for AW/AC to get real leads/purchases/calls split
          if (hasData && (ds.id === 'AW' || ds.id === 'AC')) {
            const breakdown = await queryConversionBreakdown(apiKey, ds.id, accountId, dateStart, dateEnd);
            if (breakdown) {
              (summary as Record<string, number>)._leads = breakdown.leads;
              (summary as Record<string, number>)._purchases = breakdown.purchases;
              (summary as Record<string, number>)._phoneCalls = breakdown.calls;
              if (breakdown.leads > 0) (summary as Record<string, number>)._cpl = (summary as Record<string, number>)._cost / breakdown.leads;
              if (breakdown.purchases > 0) (summary as Record<string, number>)._costPerPurchase = (summary as Record<string, number>)._cost / breakdown.purchases;
            }
          }

          // Validate summary
          if (hasData && (summary as Record<string, number>)._cost === 0 && (summary as Record<string, number>)._clicks === 0) {
            console.warn(`[${ds.id}] ⚠️ Summary shows 0 cost and 0 clicks for ${accountName} — possible field mapping issue`);
            console.warn(`[${ds.id}] Column map: ${JSON.stringify(col)}`);
          }

          // ===== PREVIOUS PERIOD =====
          let previousPeriod: Record<string, number> | undefined;
          if (compareStart && compareEnd) {
            const prevData = await queryWithRetry(apiKey, ds.id, accountId, compareStart, compareEnd, def.dailyFields);
            if (prevData.error) errors.push(`Previous period: ${prevData.error}`);
            if (!prevData.error && prevData.rows.length > 0) {
              const prevCol = buildColumnMap(def.fieldOrder, prevData.headers);
              previousPeriod = buildSummary(prevData.rows, prevCol, ds.id);
            }
          }

          // ===== TOP CREATIVES =====
          let topContent: ReturnType<typeof buildTopCreatives> | undefined;
          console.log(`[${ds.id}] Fetching creatives for ${accountName}...`);
          const creativeData = await queryWithRetry(apiKey, ds.id, accountId, dateStart, dateEnd, def.creativeFields);
          if (creativeData.error) {
            errors.push(`Creatives: ${creativeData.error}`);
          } else if (creativeData.rows.length > 0) {
            const creativeCol = buildColumnMap(def.creativeFieldOrder, creativeData.headers);
            topContent = buildTopCreatives(creativeData.rows, creativeCol, ds.id);
          }

          // Cache Meta creative images to permanent storage (FB CDN URLs expire)
          if (topContent && topContent.length > 0 && (ds.id === 'FA')) {
            console.log(`[${ds.id}] Caching ${topContent.length} Meta creative images...`);
            await cacheCreativeImages(topContent, accountId);
          }

          let keywords: ReturnType<typeof buildKeywords> | undefined;
          if (def.keywordFields && def.keywordFieldOrder) {
            console.log(`[${ds.id}] Fetching keywords for ${accountName}...`);
            const kwData = await queryWithRetry(apiKey, ds.id, accountId, dateStart, dateEnd, def.keywordFields);
            if (kwData.error) {
              errors.push(`Keywords: ${kwData.error}`);
            } else if (kwData.rows.length > 0) {
              const kwCol = buildColumnMap(def.keywordFieldOrder, kwData.headers);
              keywords = buildKeywords(kwData.rows, kwCol);
            }
          }

          results[resultKey] = {
            label: `${ds.label}${versionLabel}`,
            accountName,
            platformKey: dsKey,
            summary,
            rawData: hasData ? data : null,
            previousPeriod,
            campaigns,
            dailyData,
            ...(topContent && topContent.length > 0 ? { topContent } : {}),
            ...(keywords && keywords.length > 0 ? { keywords } : {}),
            ...(errors.length > 0 ? { errors } : {}),
          };

          console.log(`[${ds.id}] ✅ ${accountName}: ${dailyData.length} days, ${campaigns.length} campaigns, ${topContent?.length || 0} creatives, ${keywords?.length || 0} keywords, ${errors.length} errors`);
        }
      });

      await Promise.all(fetchPromises);

      return new Response(JSON.stringify({
        success: true,
        dateRange: { start: dateStart, end: dateEnd },
        compareDateRange: compareStart && compareEnd ? { start: compareStart, end: compareEnd } : null,
        platforms: results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Supermetrics edge function error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

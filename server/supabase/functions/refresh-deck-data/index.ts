import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const SM_API_BASE = "https://api.supermetrics.com/enterprise/v2/query/data/json";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchGHLForLocation(
  locationId: string,
  dateStart: string,
  dateEnd: string,
  apiKey: string
) {
  const get = async (endpoint: string, params: Record<string, string | undefined> = {}) => {
    const url = new URL(`${GHL_API_BASE}${endpoint}`);
    url.searchParams.set("locationId", locationId);
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`GHL ${endpoint}: ${r.status}`);
    return r.json();
  };

  const [contacts, opportunities, appointments, conversations] = await Promise.allSettled([
    get("/contacts/", {
      startAfter: new Date(dateStart).toISOString(),
      startBefore: new Date(dateEnd).toISOString(),
      limit: "100",
    }),
    get("/opportunities/search", { startDate: dateStart, endDate: dateEnd }),
    get("/calendars/events", {
      startTime: new Date(dateStart).getTime().toString(),
      endTime: new Date(dateEnd).getTime().toString(),
    }),
    get("/conversations/search", { limit: "50" }),
  ]);

  const c = contacts.status === "fulfilled" ? contacts.value.contacts || [] : [];
  const o = opportunities.status === "fulfilled" ? opportunities.value.opportunities || [] : [];
  const a = appointments.status === "fulfilled" ? appointments.value.events || [] : [];
  const cv = conversations.status === "fulfilled" ? conversations.value.conversations || [] : [];

  return {
    contacts: { total: c.length, new: c.length },
    opportunities: {
      total: o.length,
      open: o.filter((x: any) => x.status === "open").length,
      won: o.filter((x: any) => x.status === "won").length,
      pipelineValue: o.reduce((s: number, x: any) => s + (x.monetaryValue || 0), 0),
    },
    appointments: {
      total: a.length,
      completed: a.filter((x: any) => x.status === "completed").length,
    },
    conversations: {
      total: cv.length,
      unread: cv.filter((x: any) => x.unreadCount > 0).length,
    },
    workflows: { active: 0 },
    forms: { submissions: 0 },
    payments: { total: 0, revenue: 0 },
    reviews: { total: 0, average: 0 },
  };
}

// Platform field definitions (must match fetch-supermetrics)
const PLATFORM_DEFS: Record<string, { dailyFields: string; fieldOrder: string[]; creativeFields: string; creativeFieldOrder: string[]; keywordFields?: string; keywordFieldOrder?: string[] }> = {
  AW: {
    dailyFields: 'Date,CampaignName,Impressions,Clicks,Cost,Conversions,CostPerConversion,Ctr,CPC,ConversionRate,AllConversions',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'cpa', 'ctr', 'cpc', 'convrate', 'allconversions'],
    creativeFields: 'AdGroupName,CampaignName,Impressions,Clicks,Cost,Conversions,Ctr,CPC,CostPerConversion',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpa'],
    keywordFields: 'Keyword,CampaignName,Impressions,Clicks,Cost,Conversions,Ctr,CPC,CostPerConversion',
    keywordFieldOrder: ['keyword', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpa'],
  },
  FA: {
    dailyFields: 'Date,adcampaign_name,impressions,Clicks,cost,offsite_conversion,offsite_conversions_fb_pixel_lead,offsite_conversions_fb_pixel_purchase,onsite_conversion.lead_grouped,CPC,CTR,CPM,reach,Frequency',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'websiteConversions', 'websiteLeads', 'websitePurchases', 'onsiteLeads', 'cpc', 'ctr', 'cpm', 'reach', 'frequency'],
    creativeFields: 'ad_name,adcampaign_name,ad_id,adcreative_id,creative_thumbnail_url,creative_image_url,impressions,Clicks,cost,offsite_conversion,offsite_conversions_fb_pixel_lead,offsite_conversions_fb_pixel_purchase,onsite_conversion.lead_grouped,CTR,CPC',
    creativeFieldOrder: ['adname', 'campaign', 'adid', 'creativeid', 'thumbnail', 'imageurl', 'impressions', 'clicks', 'cost', 'websiteConversions', 'websiteLeads', 'websitePurchases', 'onsiteLeads', 'ctr', 'cpc'],
  },
  AC: {
    dailyFields: 'Date,CampaignName,Impressions,Clicks,Spend,Conversions,Revenue,CostPerConversion,Ctr,CPC',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'revenue', 'cpa', 'ctr', 'cpc'],
    creativeFields: 'AdGroupName,CampaignName,Impressions,Clicks,Spend,Conversions,Ctr,CPC',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc'],
  },
  TIK: {
    dailyFields: 'Date,campaign_name,impressions,clicks,spend,conversions,conversion_rate,cpc,cpm,ctr,reach',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'convrate', 'cpc', 'cpm', 'ctr', 'reach'],
    creativeFields: 'adgroup_name,campaign_name,impressions,clicks,spend,conversions,ctr,cpc',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc'],
  },
  LIA: {
    dailyFields: 'Date,campaign_name,impressions,clicks,cost,conversions,ctr,cpc,cpm',
    fieldOrder: ['date', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc', 'cpm'],
    creativeFields: 'creative_name,campaign_name,impressions,clicks,cost,conversions,ctr,cpc',
    creativeFieldOrder: ['adname', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'ctr', 'cpc'],
  },
};

const PLATFORM_CODE_MAP: Record<string, string> = {
  google_ads: 'AW', meta_ads: 'FA', bing_ads: 'AC', tiktok_ads: 'TIK', linkedin_ads: 'LIA',
};

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Facebook/Meta Ads', bing_ads: 'Microsoft Ads', tiktok_ads: 'TikTok Ads', linkedin_ads: 'LinkedIn Ads',
};

const PLATFORM_ICONS: Record<string, string> = {
  google_ads: 'search', meta_ads: 'megaphone', tiktok_ads: 'video', bing_ads: 'search', linkedin_ads: 'briefcase',
};

async function fetchSupermetricsForAccount(
  accountId: string,
  platformCode: string,
  dateStart: string,
  dateEnd: string,
  smApiKey: string
): Promise<Record<string, unknown> | null> {
  const def = PLATFORM_DEFS[platformCode];
  if (!def) return null;
  try {
    const queryParams = {
      ds_id: platformCode,
      ds_accounts: [accountId],
      date_range_type: "custom",
      start_date: dateStart,
      end_date: dateEnd,
      fields: def.dailyFields.split(','),
      max_rows: 500,
      api_key: smApiKey,
    };
    const url = `${SM_API_BASE}?json=${encodeURIComponent(JSON.stringify(queryParams))}`;
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${smApiKey}` },
    });

    if (!r.ok) return null;
    const data = await r.json();
    return data?.data || null;
  } catch {
    return null;
  }
}

function buildColumnMap(fieldOrder: string[], headers: string[]): Record<string, number> {
  const normalize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const col: Record<string, number> = {};
  for (let i = 0; i < fieldOrder.length && i < headers.length; i++) {
    col[fieldOrder[i]] = i;
  }
  return col;
}

function num(row: any[], col: Record<string, number>, key: string): number {
  const idx = col[key];
  if (idx === undefined) return 0;
  const v = row[idx];
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

function str(row: any[], col: Record<string, number>, key: string): string {
  const idx = col[key];
  if (idx === undefined) return '';
  return String(row[idx] || '');
}

function buildSummary(rows: any[][], col: Record<string, number>, dsId: string): Record<string, number> {
  let impressions = 0, clicks = 0, cost = 0, conversions = 0;
  let leads = 0, purchases = 0, phoneCalls = 0;
  for (const r of rows) {
    impressions += num(r, col, 'impressions');
    clicks += num(r, col, 'clicks');
    cost += num(r, col, 'cost');
    if (dsId === 'FA') {
      const wc = num(r, col, 'websiteConversions');
      const wl = num(r, col, 'websiteLeads');
      const wp = num(r, col, 'websitePurchases');
      const ol = num(r, col, 'onsiteLeads');
      conversions += wc;
      leads += wl + ol;
      purchases += wp;
    } else {
      conversions += num(r, col, 'conversions');
      leads += num(r, col, 'conversions');
    }
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? cost / clicks : 0;
  const cpa = conversions > 0 ? cost / conversions : 0;
  const cpm = impressions > 0 ? (cost / impressions) * 1000 : 0;
  const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  return { _impressions: impressions, _clicks: clicks, _cost: cost, _conversions: conversions, _ctr: ctr, _cpc: cpc, _cpa: cpa, _cpm: cpm, _conversion_rate: convRate, _leads: leads, _purchases: purchases, _phoneCalls: phoneCalls };
}

function buildCampaigns(rows: any[][], col: Record<string, number>, dsId: string): any[] {
  const map: Record<string, any> = {};
  for (const r of rows) {
    const name = str(r, col, 'campaign');
    if (!name) continue;
    if (!map[name]) map[name] = { name, impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, purchases: 0, phoneCalls: 0 };
    map[name].impressions += num(r, col, 'impressions');
    map[name].clicks += num(r, col, 'clicks');
    map[name].spend += num(r, col, 'cost');
    if (dsId === 'FA') {
      map[name].conversions += num(r, col, 'websiteConversions');
      map[name].leads += num(r, col, 'websiteLeads') + num(r, col, 'onsiteLeads');
      map[name].purchases += num(r, col, 'websitePurchases');
    } else {
      map[name].conversions += num(r, col, 'conversions');
      map[name].leads += num(r, col, 'conversions');
    }
  }
  return Object.values(map).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
  })).sort((a, b) => b.spend - a.spend);
}

function buildDailyData(rows: any[][], col: Record<string, number>, dsId: string): any[] {
  const map: Record<string, any> = {};
  for (const r of rows) {
    const date = str(r, col, 'date');
    if (!date) continue;
    if (!map[date]) map[date] = { date, impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, purchases: 0, phoneCalls: 0 };
    map[date].impressions += num(r, col, 'impressions');
    map[date].clicks += num(r, col, 'clicks');
    map[date].spend += num(r, col, 'cost');
    if (dsId === 'FA') {
      map[date].conversions += num(r, col, 'websiteConversions');
      map[date].leads += num(r, col, 'websiteLeads') + num(r, col, 'onsiteLeads');
      map[date].purchases += num(r, col, 'websitePurchases');
    } else {
      map[date].conversions += num(r, col, 'conversions');
      map[date].leads += num(r, col, 'conversions');
    }
  }
  return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((d: any) => ({
    ...d,
    label: d.date.substring(5).replace('-', '-'),
  }));
}

function buildTopCreatives(rows: any[][], col: Record<string, number>, dsId: string): any[] {
  return rows.map(r => {
    const obj: any = {
      adName: str(r, col, 'adname'),
      campaignName: str(r, col, 'campaign'),
      impressions: num(r, col, 'impressions'),
      clicks: num(r, col, 'clicks'),
      cost: num(r, col, 'cost'),
      conversions: num(r, col, 'conversions') || num(r, col, 'websiteConversions'),
      ctr: num(r, col, 'ctr'),
      cpc: num(r, col, 'cpc'),
      cpa: num(r, col, 'cpa'),
    };
    if (col['adid'] !== undefined) obj.adId = str(r, col, 'adid');
    if (col['creativeid'] !== undefined) obj.creativeId = str(r, col, 'creativeid');
    if (col['thumbnail'] !== undefined) obj.thumbnailUrl = str(r, col, 'thumbnail');
    if (col['imageurl'] !== undefined) obj.imageUrl = str(r, col, 'imageurl');
    return obj;
  }).sort((a, b) => b.cost - a.cost).slice(0, 10);
}

function buildKeywords(rows: any[][], col: Record<string, number>): any[] {
  return rows.map(r => ({
    keyword: str(r, col, 'keyword'),
    campaignName: str(r, col, 'campaign'),
    impressions: num(r, col, 'impressions'),
    clicks: num(r, col, 'clicks'),
    cost: num(r, col, 'cost'),
    conversions: num(r, col, 'conversions'),
    ctr: num(r, col, 'ctr'),
    cpc: num(r, col, 'cpc'),
    cpa: num(r, col, 'cpa'),
  })).sort((a, b) => b.cost - a.cost).slice(0, 20);
}

function calculateGrade(spend: number, conversions: number, ctr: number): string {
  if (spend === 0) return 'N/A';
  const cpa = conversions > 0 ? spend / conversions : Infinity;
  if (ctr > 3 && cpa < 20) return 'A';
  if (ctr > 2 && cpa < 40) return 'B';
  if (ctr > 1 && cpa < 80) return 'C';
  return 'D';
}

async function fetchFullAccountData(
  accountId: string,
  platformCode: string,
  dateStart: string,
  dateEnd: string,
  smApiKey: string,
  accountName: string,
  platformKey: string,
  versionLabel: string,
  resultKey: string,
): Promise<any | null> {
  const def = PLATFORM_DEFS[platformCode];
  if (!def) return null;

  const queryData = async (fields: string): Promise<{ rows: any[][]; headers: string[]; error?: string }> => {
    try {
      const queryParams = {
        ds_id: platformCode,
        ds_accounts: [accountId],
        date_range_type: "custom",
        start_date: dateStart,
        end_date: dateEnd,
        fields: fields.split(','),
        max_rows: 500,
        api_key: smApiKey,
      };
      const url = `${SM_API_BASE}?json=${encodeURIComponent(JSON.stringify(queryParams))}`;
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${smApiKey}` },
      });
      if (!r.ok) {
        const errBody = await r.text();
        console.warn(`[queryData] HTTP ${r.status} for ${accountId}: ${errBody.substring(0, 200)}`);
        return { rows: [], headers: [], error: `HTTP ${r.status}` };
      }
      const data = await r.json();
      // GET format: data.data is an array where [0] = headers, rest = rows
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const headers = data.data[0] as string[];
        const rows = data.data.slice(1) as any[][];
        console.log(`[queryData] ${accountId}: ${rows.length} rows returned`);
        return { rows, headers };
      }
      console.warn(`[queryData] ${accountId}: no data in response. Keys: ${JSON.stringify(Object.keys(data || {}))}`);
      if (data?.meta?.api_error) console.warn(`[queryData] API error: ${data.meta.api_error}`);
      return { rows: [], headers: [] };
    } catch (e) {
      return { rows: [], headers: [], error: String(e) };
    }
  };

  // Fetch daily data
  const dailyResult = await queryData(def.dailyFields);
  const hasData = dailyResult.rows.length > 0;
  const col = hasData ? buildColumnMap(def.fieldOrder, dailyResult.headers) : {};

  const summary = hasData ? buildSummary(dailyResult.rows, col, platformCode) : {};
  const campaigns = hasData ? buildCampaigns(dailyResult.rows, col, platformCode) : [];
  const dailyData = hasData ? buildDailyData(dailyResult.rows, col, platformCode) : [];

  // Fetch creatives
  let topContent: any[] = [];
  const creativeResult = await queryData(def.creativeFields);
  if (creativeResult.rows.length > 0) {
    const creativeCol = buildColumnMap(def.creativeFieldOrder, creativeResult.headers);
    topContent = buildTopCreatives(creativeResult.rows, creativeCol, platformCode);
  }

  // Fetch keywords
  let keywords: any[] = [];
  if (def.keywordFields && def.keywordFieldOrder) {
    const kwResult = await queryData(def.keywordFields);
    if (kwResult.rows.length > 0) {
      const kwCol = buildColumnMap(def.keywordFieldOrder, kwResult.headers);
      keywords = buildKeywords(kwResult.rows, kwCol);
    }
  }

  const spend = (summary as any)._cost || 0;
  const conversions = (summary as any)._conversions || 0;
  const ctr = (summary as any)._ctr || 0;
  const leads = (summary as any)._leads || 0;
  const purchases = (summary as any)._purchases || 0;

  return {
    key: resultKey,
    label: `${PLATFORM_LABELS[platformKey] || platformKey}${versionLabel}`,
    accountName,
    platformKey,
    icon: PLATFORM_ICONS[platformKey] || 'bar-chart',
    spend,
    impressions: (summary as any)._impressions || 0,
    clicks: (summary as any)._clicks || 0,
    conversions,
    leads,
    purchases,
    ctr,
    cpc: (summary as any)._cpc || 0,
    cpa: (summary as any)._cpa || 0,
    cpl: leads > 0 ? spend / leads : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
    cpm: (summary as any)._cpm || 0,
    conversionRate: (summary as any)._conversion_rate || 0,
    grade: calculateGrade(spend, conversions, ctr),
    topContent,
    campaigns,
    dailyData,
    keywords,
  };
}

// ─── deep merge: new data into existing content, preserving safe keys ─────────

function mergeContentSafely(
  existing: Record<string, unknown>,
  freshGHL: Record<string, unknown> | null,
  freshSM: Record<string, unknown> | null
): Record<string, unknown> {
  // Keys we NEVER touch — these hold manual edits
  const PRESERVED_KEYS = new Set([
    "overrides",
    "customSections",
    "hiddenSections",
    "inputParams",
    "progress",
    "progressMessage",
    "error",
    "qaReport",
    "sectionNotes",
    "assetCaptions",
  ]);

  const merged: Record<string, unknown> = { ...existing };

  // Update GHL CRM metrics
  if (freshGHL) {
    const crm = (existing.crm as Record<string, unknown>) || {};
    merged.crm = {
      ...crm,
      contacts: freshGHL.contacts ?? crm.contacts,
      opportunities: freshGHL.opportunities ?? crm.opportunities,
      appointments: freshGHL.appointments ?? crm.appointments,
      conversations: freshGHL.conversations ?? crm.conversations,
      workflows: freshGHL.workflows ?? crm.workflows,
      forms: freshGHL.forms ?? crm.forms,
      payments: freshGHL.payments ?? crm.payments,
      reviews: freshGHL.reviews ?? crm.reviews,
    };
  }

  // Update adPlatforms with fresh Supermetrics data
  if (freshSM && Array.isArray(freshSM)) {
    const oldPlatforms = (existing.adPlatforms as any[]) || [];
    const oldByKey: Record<string, any> = {};
    for (const p of oldPlatforms) {
      oldByKey[p.key] = p;
    }
    const finalPlatforms: any[] = [];
    for (const p of freshSM as any[]) {
      const old = oldByKey[p.key];
      const freshHasData = (p.spend > 0 || p.clicks > 0 || p.impressions > 0);
      if (!freshHasData && old && (old.spend > 0 || old.clicks > 0 || old.impressions > 0)) {
        // Keep old data when fresh returned empty, preserve gameplan
        if (p.gameplan) old.gameplan = p.gameplan;
        finalPlatforms.push(old);
      } else {
        if (!p.gameplan && old?.gameplan) p.gameplan = old.gameplan;
        finalPlatforms.push(p);
      }
      delete oldByKey[p.key];
    }
    // Do NOT keep old platforms that are no longer in the mapped accounts —
    // this prevents stale/unmapped ad sections from persisting
    merged.adPlatforms = finalPlatforms;

    // ── Recalculate hero aggregates & MoM trends ──
    const oldHero = (existing.hero || {}) as Record<string, any>;
    const oldChanges = oldHero.changes || {};
    const prevSpend = oldHero.totalSpend || 0;
    const prevLeads = oldHero.totalLeads || 0;
    const prevImpressions = oldHero.totalImpressions || 0;

    const newSpend = finalPlatforms.reduce((s: number, p: any) => s + (p.spend || 0), 0);
    const newLeads = finalPlatforms.reduce((s: number, p: any) => s + (p.leads || p.conversions || 0), 0);
    const newImpressions = finalPlatforms.reduce((s: number, p: any) => s + (p.impressions || 0), 0);

    const pctChange = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;

    merged.hero = {
      ...oldHero,
      totalSpend: newSpend,
      totalLeads: newLeads,
      totalImpressions: newImpressions,
      changes: {
        spend: pctChange(newSpend, prevSpend),
        conversions: pctChange(newLeads, prevLeads),
        impressions: pctChange(newImpressions, prevImpressions),
      },
    };
  }

  // Ensure preserved keys aren't accidentally removed
  for (const key of PRESERVED_KEYS) {
    if (existing[key] !== undefined) {
      merged[key] = existing[key];
    }
  }

  merged.lastDataRefresh = new Date().toISOString();
  return merged;
}

// ─── main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await requireAdminAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(authResult.error || "Unauthorized", authResult.status || 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const ghlApiKey = Deno.env.get("GHL_AGENCY_API_KEY") || "";
  const smApiKey = Deno.env.get("SUPERMETRICS_API_KEY") || "";

  try {
    const { deckId } = await req.json();
    if (!deckId) {
      return new Response(JSON.stringify({ success: false, error: "Missing deckId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load deck
    const { data: deck, error: fetchErr } = await supabase
      .from("decks")
      .select("id, content, client_name, date_range_start, date_range_end")
      .eq("id", deckId)
      .single();

    if (fetchErr || !deck) {
      return new Response(JSON.stringify({ success: false, error: "Deck not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = (deck.content || {}) as Record<string, unknown>;
    const inputParams = (content.inputParams || {}) as Record<string, unknown>;

    const clientName: string = (inputParams.clientName as string) || deck.client_name;
    // Always use the deck-level date columns as source of truth (updated by edit-mode date picker)
    const dateStart: string = deck.date_range_start;
    const dateEnd: string = deck.date_range_end;

    console.log(`[refresh-deck-data] Refreshing deck ${deckId} for "${clientName}" (${dateStart} → ${dateEnd})`);

    // Mark deck as refreshing (non-blocking visual status)
    await supabase
      .from("decks")
      .update({ content: { ...content, isRefreshing: true }, updated_at: new Date().toISOString() })
      .eq("id", deckId);

    // ── 1. GHL data ──────────────────────────────────────────────────────────

    let freshGHL: Record<string, unknown> | null = null;

    if (ghlApiKey) {
      // Find GHL location for this client via oauth tokens table
      const { data: tokens } = await supabase
        .from("ghl_oauth_tokens")
        .select("location_id, location_name")
        .ilike("location_name", `%${clientName}%`)
        .limit(1);

      // Fallback: check inputParams for locationId
      const locationId =
        (tokens?.[0]?.location_id as string) ||
        (inputParams.ghlLocationId as string) ||
        null;

      if (locationId) {
        try {
          freshGHL = await fetchGHLForLocation(locationId, dateStart, dateEnd, ghlApiKey);
          console.log(`[refresh-deck-data] GHL refresh OK — ${(freshGHL.contacts as any)?.total} contacts`);
        } catch (e) {
          console.warn("[refresh-deck-data] GHL refresh failed:", e);
        }
      } else {
        console.log("[refresh-deck-data] No GHL location found for this client — skipping GHL refresh");
      }
    }

    // ── 2. Supermetrics data — fetch ALL mapped accounts ────────────────────

    let freshSM: any[] | null = null;

    if (smApiKey) {
      // Look up ALL accounts from client_account_mappings
      const { data: mappings } = await supabase
        .from("client_account_mappings")
        .select("account_id, account_name, platform")
        .eq("client_name", clientName);

      if (mappings && mappings.length > 0) {
        console.log(`[refresh-deck-data] Found ${mappings.length} account mappings for "${clientName}"`);

        // Group by platform
        const byPlatform: Record<string, { id: string; name: string }[]> = {};
        for (const m of mappings) {
          if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
          byPlatform[m.platform].push({ id: m.account_id, name: m.account_name || m.account_id });
        }

        const adPlatforms: any[] = [];

        for (const [platformKey, accounts] of Object.entries(byPlatform)) {
          const platformCode = PLATFORM_CODE_MAP[platformKey];
          if (!platformCode) continue;

          for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            const versionLabel = accounts.length > 1 ? ` (${acc.name})` : '';
            const resultKey = accounts.length > 1 ? `${platformKey}_v${i + 1}` : platformKey;

            console.log(`[refresh-deck-data] Fetching ${platformKey} data for ${acc.name} (${acc.id})...`);
            try {
              const platformEntry = await fetchFullAccountData(
                acc.id, platformCode, dateStart, dateEnd, smApiKey,
                acc.name, platformKey, versionLabel, resultKey,
              );
              if (platformEntry) {
                adPlatforms.push(platformEntry);
                console.log(`[refresh-deck-data] ✅ ${acc.name}: spend=$${platformEntry.spend}, conversions=${platformEntry.conversions}`);
              }
            } catch (e) {
              console.warn(`[refresh-deck-data] Failed to fetch ${acc.name}:`, e);
            }
          }
        }

        if (adPlatforms.length > 0) {
          freshSM = adPlatforms;
          console.log(`[refresh-deck-data] SM refresh OK — ${adPlatforms.length} account(s) refreshed`);
        }
      } else {
        console.log("[refresh-deck-data] No account mappings found — skipping SM refresh");
      }
    }

    // ── 3. Merge and save ────────────────────────────────────────────────────

    const mergedContent = mergeContentSafely(content, freshGHL, freshSM);
    // Clear refreshing flag
    delete (mergedContent as any).isRefreshing;

    await supabase
      .from("decks")
      .update({ content: mergedContent as any, updated_at: new Date().toISOString() })
      .eq("id", deckId);

    console.log("[refresh-deck-data] Deck content updated successfully");

    const refreshed: string[] = [];
    if (freshGHL) refreshed.push("GHL / CRM");
    if (freshSM) refreshed.push(`Supermetrics (${Object.keys(freshSM).join(", ")})`);

    return new Response(
      JSON.stringify({
        success: true,
        deckId,
        refreshed,
        lastRefresh: mergedContent.lastDataRefresh,
        note: refreshed.length === 0
          ? "No data sources found for this client. Overrides and custom sections were preserved."
          : `Refreshed: ${refreshed.join(", ")}. All manual overrides, custom sections, and cover date edits preserved.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[refresh-deck-data] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

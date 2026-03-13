import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPERMETRICS_API_URL = 'https://api.supermetrics.com/enterprise/v2';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
import { GOOGLE_ADS_API_BASE } from '../_shared/googleAds.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 3: SERVER-SIDE VALIDATION — BLOCKED CHANGE TYPES
// These types are NEVER stored in the database, regardless of what the AI outputs.
// ═══════════════════════════════════════════════════════════════════════════════
const BLOCKED_CHANGE_TYPES = new Set([
  'reallocate_budget',
  'budget_adjustment',
  'pause_campaign',
  'pause_ad',
  'pause_ad_set',
  'pause_keyword',
  'status_change',
  'enable_campaign',
]);

const BUDGET_KEYS = new Set([
  'daily_budget', 'budget', 'lifetime_budget', 'campaign_budget',
  'approx_daily_budget', 'total_budget', 'monthly_budget',
]);

function isBlockedChange(change: any): { blocked: boolean; reason: string } {
  const ct = (change.change_type || '').toLowerCase();
  
  // Check against blocked types
  if (BLOCKED_CHANGE_TYPES.has(ct)) {
    return { blocked: true, reason: `Blocked change_type: "${ct}"` };
  }
  
  // Check if after_value contains budget-related keys
  const afterValue = change.after_value || {};
  for (const key of Object.keys(afterValue)) {
    if (BUDGET_KEYS.has(key.toLowerCase())) {
      return { blocked: true, reason: `after_value contains budget key: "${key}"` };
    }
  }
  
  // Check if before_value metric is budget-related
  const beforeMetric = (change.before_value?.metric || '').toLowerCase();
  if (beforeMetric.includes('budget')) {
    return { blocked: true, reason: `before_value.metric references budget: "${beforeMetric}"` };
  }
  
  const afterMetric = (change.after_value?.metric || '').toLowerCase();
  if (afterMetric.includes('budget')) {
    return { blocked: true, reason: `after_value.metric references budget: "${afterMetric}"` };
  }
  
  return { blocked: false, reason: '' };
}

// ─── Google Ads entity resolution ─────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_ADS_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

interface EntityMap {
  campaigns: Record<string, string>;
  campaignBudgets: Record<string, string>;
  keywords: Record<string, string>;
  adGroups: Record<string, string>;
}

async function fetchGoogleAdsEntities(customerId: string, accessToken: string): Promise<EntityMap> {
  const loginCustomerId = Deno.env.get('GOOGLE_ADS_LOGIN_CUSTOMER_ID');
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId.replace(/\D/g, '');
  }

  const entityMap: EntityMap = { campaigns: {}, campaignBudgets: {}, keywords: {}, adGroups: {} };

  // Fetch campaigns
  try {
    const campRes = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: `SELECT campaign.id, campaign.name, campaign.resource_name, campaign.status, campaign_budget.resource_name FROM campaign WHERE campaign.status != 'REMOVED'`,
      }),
    });
    if (campRes.ok) {
      const campJson = await campRes.json();
      for (const row of (campJson.results || [])) {
        const name = row.campaign?.name;
        const resourceName = row.campaign?.resourceName;
        if (name && resourceName) {
          entityMap.campaigns[name] = resourceName;
          if (row.campaignBudget?.resourceName) {
            entityMap.campaignBudgets[resourceName] = row.campaignBudget.resourceName;
          }
        }
      }
      console.log(`[ENTITY RESOLUTION] Found ${Object.keys(entityMap.campaigns).length} campaigns`);
    } else {
      console.warn(`[ENTITY RESOLUTION] Campaign query failed: ${campRes.status} ${await campRes.text()}`);
    }
  } catch (e) {
    console.warn('[ENTITY RESOLUTION] Campaign fetch error:', e);
  }

  // Fetch keywords
  try {
    const kwRes = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.resource_name, ad_group_criterion.status, ad_group.name, campaign.name FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED' LIMIT 5000`,
      }),
    });
    if (kwRes.ok) {
      const kwJson = await kwRes.json();
      for (const row of (kwJson.results || [])) {
        const kwText = row.adGroupCriterion?.keyword?.text;
        const resourceName = row.adGroupCriterion?.resourceName;
        const campName = row.campaign?.name || '';
        if (kwText && resourceName) {
          entityMap.keywords[`${kwText}::${campName}`] = resourceName;
          if (!entityMap.keywords[kwText]) {
            entityMap.keywords[kwText] = resourceName;
          }
        }
      }
      console.log(`[ENTITY RESOLUTION] Found ${Object.keys(entityMap.keywords).length} keyword entries`);
    } else {
      console.warn(`[ENTITY RESOLUTION] Keyword query failed: ${kwRes.status} ${await kwRes.text()}`);
    }
  } catch (e) {
    console.warn('[ENTITY RESOLUTION] Keyword fetch error:', e);
  }

  // Fetch ad groups
  try {
    const agRes = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: `SELECT ad_group.id, ad_group.name, ad_group.resource_name, ad_group.status FROM ad_group WHERE ad_group.status != 'REMOVED' LIMIT 5000`,
      }),
    });
    if (agRes.ok) {
      const agJson = await agRes.json();
      for (const row of (agJson.results || [])) {
        const name = row.adGroup?.name;
        const resourceName = row.adGroup?.resourceName;
        if (name && resourceName) entityMap.adGroups[name] = resourceName;
      }
      console.log(`[ENTITY RESOLUTION] Found ${Object.keys(entityMap.adGroups).length} ad groups`);
    } else {
      console.warn(`[ENTITY RESOLUTION] Ad group query failed: ${agRes.status}`);
      await agRes.text();
    }
  } catch (e) {
    console.warn('[ENTITY RESOLUTION] Ad group fetch error:', e);
  }

  return entityMap;
}

function resolveEntityId(change: any, entityMap: EntityMap, customerId: string): string | null {
  const entityName = change.entity_name || '';
  const entityType = change.entity_type || '';
  const changeType = change.change_type || '';
  const entityNameLower = entityName.toLowerCase();

  // If AI already provided a valid resource name, use it
  if (change.entity_id && change.entity_id.startsWith('customers/')) {
    return change.entity_id;
  }

  // --- Type-specific lookups first ---

  if (entityType === 'campaign' || changeType.includes('campaign')) {
    const match = entityMap.campaigns[entityName];
    if (match) return match;
    for (const [name, rn] of Object.entries(entityMap.campaigns)) {
      if (name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) {
        return rn;
      }
    }
  }

  if (entityType === 'keyword' || changeType.includes('keyword') || changeType === 'adjust_bid') {
    const campaignHint = change.before_value?.campaign || '';
    if (campaignHint) {
      const exactKey = `${entityName}::${campaignHint}`;
      if (entityMap.keywords[exactKey]) return entityMap.keywords[exactKey];
    }
    if (entityMap.keywords[entityName]) return entityMap.keywords[entityName];
    for (const [key, rn] of Object.entries(entityMap.keywords)) {
      const kwPart = key.split('::')[0];
      if (kwPart.toLowerCase() === entityNameLower) return rn;
    }
  }

  if (entityType === 'ad_group') {
    const match = entityMap.adGroups[entityName];
    if (match) return match;
    for (const [name, rn] of Object.entries(entityMap.adGroups)) {
      if (name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) {
        return rn;
      }
    }
  }

  // --- Fallback: try ALL entity maps regardless of entity_type ---
  // This catches cases where AI sets wrong entity_type (e.g. entity_type:"keyword" but entity_name is a campaign)

  // Try campaigns
  if (entityMap.campaigns[entityName]) return entityMap.campaigns[entityName];
  for (const [name, rn] of Object.entries(entityMap.campaigns)) {
    if (name.toLowerCase() === entityNameLower || name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) {
      console.log(`[ENTITY FALLBACK] Matched "${entityName}" to campaign "${name}" (entity_type was "${entityType}")`);
      return rn;
    }
  }

  // Try keywords
  if (entityMap.keywords[entityName]) return entityMap.keywords[entityName];
  for (const [key, rn] of Object.entries(entityMap.keywords)) {
    const kwPart = key.split('::')[0];
    if (kwPart.toLowerCase() === entityNameLower) {
      console.log(`[ENTITY FALLBACK] Matched "${entityName}" to keyword "${kwPart}" (entity_type was "${entityType}")`);
      return rn;
    }
  }

  // Try ad groups
  if (entityMap.adGroups[entityName]) return entityMap.adGroups[entityName];
  for (const [name, rn] of Object.entries(entityMap.adGroups)) {
    if (name.toLowerCase() === entityNameLower || name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) {
      console.log(`[ENTITY FALLBACK] Matched "${entityName}" to ad group "${name}" (entity_type was "${entityType}")`);
      return rn;
    }
  }

  return null;
}

// ─── Meta entity resolution ──────────────────────────────────────────────────

interface MetaEntityMap {
  campaigns: Record<string, string>;
  adSets: Record<string, string>;
}

async function fetchMetaEntities(accountId: string): Promise<MetaEntityMap> {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) return { campaigns: {}, adSets: {} };

  const map: MetaEntityMap = { campaigns: {}, adSets: {} };
  const cleanAccountId = accountId.replace('act_', '');

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/act_${cleanAccountId}/campaigns?fields=id,name,status&limit=500&access_token=${token}`);
    if (res.ok) {
      const json = await res.json();
      for (const c of (json.data || [])) {
        if (c.name && c.id) map.campaigns[c.name] = c.id;
      }
      console.log(`[META ENTITY RESOLUTION] Found ${Object.keys(map.campaigns).length} campaigns`);
    } else {
      console.warn(`[META ENTITY RESOLUTION] Campaign fetch failed: ${res.status}`);
      await res.text();
    }
  } catch (e) {
    console.warn('[META ENTITY RESOLUTION] Campaign error:', e);
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/act_${cleanAccountId}/adsets?fields=id,name,status&limit=500&access_token=${token}`);
    if (res.ok) {
      const json = await res.json();
      for (const a of (json.data || [])) {
        if (a.name && a.id) map.adSets[a.name] = a.id;
      }
      console.log(`[META ENTITY RESOLUTION] Found ${Object.keys(map.adSets).length} ad sets`);
    } else {
      console.warn(`[META ENTITY RESOLUTION] Ad set fetch failed: ${res.status}`);
      await res.text();
    }
  } catch (e) {
    console.warn('[META ENTITY RESOLUTION] Ad set error:', e);
  }

  return map;
}

function resolveMetaEntityId(change: any, metaMap: MetaEntityMap): string | null {
  if (change.entity_id) return change.entity_id;
  const entityName = change.entity_name || '';
  const entityType = change.entity_type || '';
  const entityNameLower = entityName.toLowerCase();

  // Type-specific lookups first
  if (entityType === 'campaign' || change.change_type?.includes('campaign')) {
    if (metaMap.campaigns[entityName]) return metaMap.campaigns[entityName];
    for (const [name, id] of Object.entries(metaMap.campaigns)) {
      if (name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) return id;
    }
  }

  if (entityType === 'ad_set' || change.change_type?.includes('ad_set')) {
    if (metaMap.adSets[entityName]) return metaMap.adSets[entityName];
    for (const [name, id] of Object.entries(metaMap.adSets)) {
      if (name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) return id;
    }
  }

  // Fallback: try all maps regardless of entity_type
  for (const [name, id] of Object.entries(metaMap.campaigns)) {
    if (name.toLowerCase() === entityNameLower || name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) {
      console.log(`[META ENTITY FALLBACK] Matched "${entityName}" to campaign "${name}" (entity_type was "${entityType}")`);
      return id;
    }
  }
  for (const [name, id] of Object.entries(metaMap.adSets)) {
    if (name.toLowerCase() === entityNameLower || name.toLowerCase().includes(entityNameLower) || entityNameLower.includes(name.toLowerCase())) {
      console.log(`[META ENTITY FALLBACK] Matched "${entityName}" to ad set "${name}" (entity_type was "${entityType}")`);
      return id;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECT API DATA FETCHING — Google Ads API & Meta API as primary data sources
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchGoogleAdsPerformance(
  customerId: string, accessToken: string, dateStart: string, dateEnd: string
): Promise<{ campaigns: any[]; keywords: any[] }> {
  const loginCustomerId = Deno.env.get('GOOGLE_ADS_LOGIN_CUSTOMER_ID');
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId.replace(/\D/g, '');

  const campaigns: any[] = [];
  const keywords: any[] = [];

  // Fetch campaign performance
  try {
    const res = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: `SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.all_conversions, metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion, metrics.conversions_from_interactions_rate FROM campaign WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}' AND campaign.status != 'REMOVED'`,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      for (const row of (json.results || [])) {
        const m = row.metrics || {};
        const cost = parseInt(m.costMicros || '0') / 1_000_000;
        const clicks = parseInt(m.clicks || '0');
        const impressions = parseInt(m.impressions || '0');
        const conversions = parseFloat(m.conversions || '0');
        campaigns.push({
          name: row.campaign?.name || '',
          impressions, clicks, cost, conversions,
          days: 1,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? cost / clicks : 0,
          cpa: conversions > 0 ? cost / conversions : Infinity,
          roas: cost > 0 ? conversions / cost : 0,
        });
      }
      campaigns.sort((a, b) => b.cost - a.cost);
      console.log(`[GOOGLE ADS API] Fetched ${campaigns.length} campaigns for ${customerId}`);
    } else {
      console.warn(`[GOOGLE ADS API] Campaign query failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.warn('[GOOGLE ADS API] Campaign fetch error:', e);
  }

  // Fetch keyword performance
  try {
    const res = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: `SELECT ad_group_criterion.keyword.text, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion FROM keyword_view WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}' AND campaign.status != 'REMOVED' LIMIT 2000`,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const kwMap: Record<string, any> = {};
      for (const row of (json.results || [])) {
        const kw = row.adGroupCriterion?.keyword?.text || '';
        if (!kw) continue;
        const m = row.metrics || {};
        const cost = parseInt(m.costMicros || '0') / 1_000_000;
        if (!kwMap[kw]) kwMap[kw] = { keyword: kw, campaign: row.campaign?.name || '', impressions: 0, clicks: 0, cost: 0, conversions: 0 };
        kwMap[kw].impressions += parseInt(m.impressions || '0');
        kwMap[kw].clicks += parseInt(m.clicks || '0');
        kwMap[kw].cost += cost;
        kwMap[kw].conversions += parseFloat(m.conversions || '0');
      }
      for (const k of Object.values(kwMap)) {
        keywords.push({
          ...k,
          cpc: k.clicks > 0 ? k.cost / k.clicks : 0,
          cpa: k.conversions > 0 ? k.cost / k.conversions : null,
          ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
        });
      }
      keywords.sort((a, b) => b.cost - a.cost);
      console.log(`[GOOGLE ADS API] Fetched ${keywords.length} keywords for ${customerId}`);
    } else {
      console.warn(`[GOOGLE ADS API] Keyword query failed: ${res.status}`);
      await res.text();
    }
  } catch (e) {
    console.warn('[GOOGLE ADS API] Keyword fetch error:', e);
  }

  return { campaigns, keywords };
}

async function fetchMetaAdsPerformance(
  accountId: string, dateStart: string, dateEnd: string
): Promise<{ campaigns: any[] }> {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) return { campaigns: [] };

  const cleanAccountId = accountId.replace('act_', '');
  const campaigns: any[] = [];

  try {
    const timeRange = JSON.stringify({ since: dateStart, until: dateEnd });
    const fields = 'campaign_name,impressions,clicks,spend,actions,cost_per_action_type,cpc,ctr,cpm,reach,frequency';
    const res = await fetch(
      `https://graph.facebook.com/v19.0/act_${cleanAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=500&access_token=${token}`
    );
    if (res.ok) {
      const json = await res.json();
      for (const row of (json.data || [])) {
        const impressions = parseInt(row.impressions || '0');
        const clicks = parseInt(row.clicks || '0');
        const cost = parseFloat(row.spend || '0');
        // Extract conversions from actions array
        let conversions = 0, leads = 0, purchases = 0;
        for (const action of (row.actions || [])) {
          const t = action.action_type || '';
          const v = parseFloat(action.value || '0');
          if (t === 'offsite_conversion.fb_pixel_lead' || t === 'onsite_conversion.lead_grouped') { leads += v; conversions += v; }
          else if (t === 'offsite_conversion.fb_pixel_purchase') { purchases += v; conversions += v; }
          else if (t === 'offsite_conversion') { conversions += v; }
        }
        campaigns.push({
          name: row.campaign_name || '',
          impressions, clicks, cost, conversions, leads, purchases,
          days: 1,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? cost / clicks : 0,
          cpa: conversions > 0 ? cost / conversions : Infinity,
          roas: cost > 0 ? conversions / cost : 0,
        });
      }
      campaigns.sort((a, b) => b.cost - a.cost);
      console.log(`[META ADS API] Fetched ${campaigns.length} campaigns for act_${cleanAccountId}`);
    } else {
      console.warn(`[META ADS API] Insights query failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.warn('[META ADS API] Fetch error:', e);
  }

  return { campaigns };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 4: NORMALIZER — No budget types, only safe types
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeChangeType(change: any): { change_type: string; after_value: any } {
  const ct = change.change_type || '';
  const av = change.after_value || {};

  // Normalize bid_adjustment → adjust_bid (canonical name)
  if (ct === 'bid_adjustment') {
    return { change_type: 'adjust_bid', after_value: av };
  }
  // All other types pass through as-is
  return { change_type: ct, after_value: av };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPERMETRICS_API_KEY = Deno.env.get('SUPERMETRICS_API_KEY') || '';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { clientName, platform, accountId: providedAccountId, dateStart, dateEnd, createdBy, autoMode, researchContext } = await req.json();

    if (!clientName || !platform || !dateStart || !dateEnd) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Resolve account ID ---
    let accountId = providedAccountId || null;
    const platformFilter = platform === 'google' ? 'google_ads' : 'meta_ads';

    // SERVER-SIDE SAFETY: Verify provided accountId actually belongs to this client
    if (accountId) {
      const { data: verifyMapping } = await supabase
        .from('client_account_mappings')
        .select('account_id')
        .eq('client_name', clientName)
        .eq('account_id', accountId)
        .limit(1);
      if (!verifyMapping || verifyMapping.length === 0) {
        console.warn(`[ACCOUNT MISMATCH] Account ${accountId} does not belong to ${clientName}. Resolving from DB.`);
        accountId = null; // Fall through to DB resolution below
      }
    }

    if (!accountId) {
      const { data: mappings } = await supabase
        .from('client_account_mappings')
        .select('account_id')
        .eq('client_name', clientName)
        .eq('platform', platformFilter)
        .limit(1);
      if (mappings && mappings.length > 0) {
        accountId = mappings[0].account_id;
        console.log(`[ACCOUNT RESOLUTION] Resolved ${clientName} → ${accountId}`);
      }
    }

    // --- Pull performance data + entity maps in PARALLEL ---
    const dsId = platform === 'google' ? 'AW' : 'FA';
    let campaignData: any[] = [];
    let keywordData: any[] = [];
    let rawRows: any[] = [];
    let dataSource = 'none';
    let googleEntityMap: EntityMap | null = null;
    let metaEntityMap: MetaEntityMap | null = null;
    let googleCustomerId: string | null = null;

    if (accountId) {
      if (platform === 'google') {
        googleCustomerId = accountId.replace(/-/g, '');
        try {
          const accessToken = await getGoogleAccessToken();
          // Run performance data + entity resolution in PARALLEL (both use same token)
          const [directData, entityMap] = await Promise.all([
            fetchGoogleAdsPerformance(googleCustomerId, accessToken, dateStart, dateEnd),
            fetchGoogleAdsEntities(googleCustomerId, accessToken),
          ]);
          googleEntityMap = entityMap;
          if (directData.campaigns.length > 0) {
            campaignData = directData.campaigns;
            keywordData = directData.keywords;
            dataSource = 'google_ads_api';
            console.log(`[DATA SOURCE] Using Google Ads API: ${campaignData.length} campaigns, ${keywordData.length} keywords`);
          }
        } catch (e) {
          console.warn('[DATA SOURCE] Google Ads API failed, will try Supermetrics fallback:', e);
        }
      } else if (platform === 'meta') {
        // Run performance data + entity resolution in PARALLEL
        const [directResult, entityResult] = await Promise.allSettled([
          fetchMetaAdsPerformance(accountId, dateStart, dateEnd),
          fetchMetaEntities(accountId),
        ]);
        if (entityResult.status === 'fulfilled') metaEntityMap = entityResult.value;
        if (directResult.status === 'fulfilled' && directResult.value.campaigns.length > 0) {
          campaignData = directResult.value.campaigns;
          dataSource = 'meta_ads_api';
          console.log(`[DATA SOURCE] Using Meta Ads API: ${campaignData.length} campaigns`);
        }
      }

      // ══════════ FALLBACK: Supermetrics (only if direct API returned no data) ══════════
      if (campaignData.length === 0 && SUPERMETRICS_API_KEY) {
        console.log(`[DATA SOURCE] Direct API returned no data, falling back to Supermetrics for ${clientName}/${platform}`);
        const campaignFields = dsId === 'AW'
          ? 'Date,CampaignName,Impressions,Clicks,Cost,Conversions,CostPerConversion,Ctr,CPC,ConversionRate,AllConversions'
          : 'Date,adcampaign_name,impressions,Clicks,cost,offsite_conversion,offsite_conversions_fb_pixel_lead,offsite_conversions_fb_pixel_purchase,onsite_conversion.lead_grouped,CPC,CTR,CPM,reach,Frequency';

        const campRes = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPERMETRICS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ds_id: dsId,
            ds_accounts: accountId,
            start_date: dateStart,
            end_date: dateEnd,
            fields: campaignFields,
            max_rows: 5000,
            settings: { no_headers: false },
          }),
        });

        if (campRes.ok) {
          const campJson = await campRes.json();
          if (campJson.data && campJson.data.length > 1) {
            const rows = campJson.data.slice(1) as (string | number)[][];
            rawRows = rows;

            const campMap: Record<string, any> = {};
            for (const row of rows) {
              const campName = String(row[1] || '');
              if (!campName) continue;
              if (!campMap[campName]) {
                campMap[campName] = { name: campName, impressions: 0, clicks: 0, cost: 0, conversions: 0, days: 0 };
              }
              campMap[campName].impressions += parseFloat(String(row[2] || '0')) || 0;
              campMap[campName].clicks += parseFloat(String(row[3] || '0')) || 0;
              campMap[campName].cost += parseFloat(String(row[4] || '0')) || 0;

              if (dsId === 'FA') {
                const offsite = parseFloat(String(row[5] || '0')) || 0;
                const leads = parseFloat(String(row[6] || '0')) || 0;
                const purchases = parseFloat(String(row[7] || '0')) || 0;
                const onsiteLeads = parseFloat(String(row[8] || '0')) || 0;
                campMap[campName].conversions += offsite + leads + purchases + onsiteLeads;
                campMap[campName].leads = (campMap[campName].leads || 0) + leads + onsiteLeads;
                campMap[campName].purchases = (campMap[campName].purchases || 0) + purchases;
              } else {
                campMap[campName].conversions += parseFloat(String(row[5] || '0')) || 0;
              }
              campMap[campName].days++;
            }

            campaignData = Object.values(campMap).map((c: any) => ({
              ...c,
              ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
              cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
              cpa: c.conversions > 0 ? c.cost / c.conversions : Infinity,
              roas: c.cost > 0 ? c.conversions / c.cost : 0,
            })).sort((a: any, b: any) => b.cost - a.cost);

            dataSource = 'supermetrics';
            console.log(`[DATA SOURCE] Supermetrics fallback: ${campaignData.length} campaigns`);
          }
        }

        // Fetch keyword data for Google via Supermetrics fallback
        if (dsId === 'AW' && keywordData.length === 0) {
          const kwRes = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPERMETRICS_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ds_id: dsId,
              ds_accounts: accountId,
              start_date: dateStart,
              end_date: dateEnd,
              fields: 'Keyword,CampaignName,Impressions,Clicks,Cost,Conversions,Ctr,CPC,CostPerConversion',
              max_rows: 2000,
              settings: { no_headers: false },
            }),
          });

          if (kwRes.ok) {
            const kwJson = await kwRes.json();
            if (kwJson.data && kwJson.data.length > 1) {
              const rows = kwJson.data.slice(1) as (string | number)[][];
              const kwMap: Record<string, any> = {};
              for (const row of rows) {
                const kw = String(row[0] || '');
                if (!kw) continue;
                if (!kwMap[kw]) kwMap[kw] = { keyword: kw, campaign: String(row[1] || ''), impressions: 0, clicks: 0, cost: 0, conversions: 0 };
                kwMap[kw].impressions += parseFloat(String(row[2] || '0')) || 0;
                kwMap[kw].clicks += parseFloat(String(row[3] || '0')) || 0;
                kwMap[kw].cost += parseFloat(String(row[4] || '0')) || 0;
                kwMap[kw].conversions += parseFloat(String(row[5] || '0')) || 0;
              }
              keywordData = Object.values(kwMap).map((k: any) => ({
                ...k,
                cpc: k.clicks > 0 ? k.cost / k.clicks : 0,
                cpa: k.conversions > 0 ? k.cost / k.conversions : null,
                ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
              })).sort((a: any, b: any) => b.cost - a.cost);
            }
          }
        }
      }
    }

    // --- Build entity reference for AI prompt ---
    let entityReferenceBlock = '';
    if (platform === 'google' && googleEntityMap && Object.keys(googleEntityMap.campaigns).length > 0) {
      entityReferenceBlock = `\n\nGOOGLE ADS RESOURCE NAMES (you MUST use these exact resource_name values for entity_id):
${Object.entries(googleEntityMap.campaigns).map(([name, rn]) => `- "${name}" → "${rn}"`).join('\n')}`;

      if (Object.keys(googleEntityMap.keywords).length > 0) {
        const uniqueKws = new Map<string, string>();
        for (const [key, rn] of Object.entries(googleEntityMap.keywords)) {
          if (!key.includes('::')) uniqueKws.set(key, rn);
        }
        if (uniqueKws.size > 0) {
          entityReferenceBlock += `\n\nKEYWORD RESOURCE NAMES (use for entity_id when targeting keywords):
${[...uniqueKws.entries()].slice(0, 50).map(([kw, rn]) => `- "${kw}" → "${rn}"`).join('\n')}`;
        }
      }
    }

    if (platform === 'meta' && metaEntityMap && Object.keys(metaEntityMap.campaigns).length > 0) {
      entityReferenceBlock = `\n\nMETA ADS ENTITY IDS (you MUST use these exact ID values for entity_id):
CAMPAIGNS:
${Object.entries(metaEntityMap.campaigns).map(([name, id]) => `- "${name}" → "${id}"`).join('\n')}`;

      if (Object.keys(metaEntityMap.adSets).length > 0) {
        entityReferenceBlock += `\n\nAD SETS:
${Object.entries(metaEntityMap.adSets).map(([name, id]) => `- "${name}" → "${id}"`).join('\n')}`;
      }
    }

    // --- Fetch historical context ---
    let historyBlock = '';
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: pastSessions } = await supabase
        .from('ppc_optimization_sessions')
        .select('id, created_at, ai_summary, status, supermetrics_data')
        .eq('client_name', clientName)
        .eq('platform', platform)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (pastSessions && pastSessions.length > 0) {
        const sessionIds = pastSessions.map((s: any) => s.id);

        const { data: pastChanges } = await supabase
          .from('ppc_proposed_changes')
          .select('id, change_type, entity_name, confidence, approval_status, ai_rationale, expected_impact, executed_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
          .limit(50);

        const changeIds = (pastChanges || []).filter((c: any) => c.executed_at).map((c: any) => c.id);

        let pastResults: any[] = [];
        if (changeIds.length > 0) {
          const { data: results } = await supabase
            .from('ppc_change_results')
            .select('change_id, outcome, ai_assessment, delta')
            .in('change_id', changeIds);
          pastResults = results || [];
        }

        const resultsByChangeId: Record<string, any> = {};
        for (const r of pastResults) {
          resultsByChangeId[r.change_id] = r;
        }

        const historyEntries: string[] = [];

        const trendData = pastSessions
          .filter((s: any) => s.supermetrics_data?.totalSpend != null)
          .map((s: any) => ({
            date: s.created_at.split('T')[0],
            spend: s.supermetrics_data.totalSpend,
            conversions: s.supermetrics_data.totalConversions || 0,
            cpa: s.supermetrics_data.totalConversions > 0
              ? (s.supermetrics_data.totalSpend / s.supermetrics_data.totalConversions).toFixed(2)
              : 'N/A',
          }));

        if (trendData.length > 0) {
          historyEntries.push(`PERFORMANCE TREND (last ${trendData.length} sessions):`);
          for (const t of trendData) {
            historyEntries.push(`  ${t.date}: $${t.spend.toFixed(0)} spend, ${t.conversions} conv, CPA: ${t.cpa === 'N/A' ? t.cpa : `$${t.cpa}`}`);
          }
        }

        const successfulChanges = (pastChanges || []).filter((c: any) => {
          const result = resultsByChangeId[c.id];
          return result && (result.outcome === 'improved' || result.outcome === 'positive');
        });

        const failedChanges = (pastChanges || []).filter((c: any) => {
          const result = resultsByChangeId[c.id];
          return result && (result.outcome === 'declined' || result.outcome === 'negative' || result.outcome === 'no_change');
        });

        if (successfulChanges.length > 0) {
          historyEntries.push(`\nCHANGES THAT IMPROVED PERFORMANCE (repeat/expand these):`);
          for (const c of successfulChanges.slice(0, 8)) {
            const r = resultsByChangeId[c.id];
            const deltaInfo = r.delta ? ` | CPA change: ${r.delta.cpaChangePercent != null ? `${r.delta.cpaChangePercent > 0 ? '+' : ''}${r.delta.cpaChangePercent.toFixed(1)}%` : 'N/A'}, conv change: ${r.delta.conversionChange || 0}` : '';
            historyEntries.push(`  ✅ ${c.change_type} on "${c.entity_name}": ${r.ai_assessment || c.expected_impact}${deltaInfo}`);
          }
        }

        if (failedChanges.length > 0) {
          historyEntries.push(`\nCHANGES THAT WORSENED OR HAD NO EFFECT (avoid repeating):`);
          for (const c of failedChanges.slice(0, 8)) {
            const r = resultsByChangeId[c.id];
            const deltaInfo = r.delta ? ` | CPA change: ${r.delta.cpaChangePercent != null ? `${r.delta.cpaChangePercent > 0 ? '+' : ''}${r.delta.cpaChangePercent.toFixed(1)}%` : 'N/A'}, conv change: ${r.delta.conversionChange || 0}` : '';
            historyEntries.push(`  ❌ ${c.change_type} on "${c.entity_name}": ${r.ai_assessment || 'no improvement'}${deltaInfo}`);
          }
        }

        const pendingChanges = (pastChanges || []).filter((c: any) => c.approval_status === 'pending');
        if (pendingChanges.length > 0) {
          historyEntries.push(`\nPENDING RECOMMENDATIONS (not yet acted on — ${pendingChanges.length} total):`);
          for (const c of pendingChanges.slice(0, 5)) {
            historyEntries.push(`  ⏳ ${c.change_type} on "${c.entity_name}" (${c.confidence} confidence)`);
          }
        }

        if (historyEntries.length > 0) {
          historyBlock = `\n\n=== 30-DAY HISTORICAL CONTEXT ===
${historyEntries.join('\n')}
=== END HISTORICAL CONTEXT ===

IMPORTANT: Use this history to inform your strategy. Double down on approaches that worked. Do NOT repeat strategies that failed on the same entities. Consider acting on pending recommendations if the data still supports them.`;
        }
      }

      console.log(`[HISTORY] Built history block: ${historyBlock ? historyBlock.length + ' chars' : 'none available'}`);
    } catch (e) {
      console.warn('[HISTORY] Failed to fetch historical context (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH CUSTOM INSTRUCTIONS FROM STRATEGIST CONFIG
    // ═══════════════════════════════════════════════════════════════════════════
    let customInstructionsBlock = '';
    try {
      const { data: configRow } = await supabase
        .from('strategist_config')
        .select('config_value')
        .eq('config_key', 'custom_instructions')
        .single();
      if (configRow?.config_value?.trim()) {
        customInstructionsBlock = `\n\n═══════════════════════════════════════════════════════════════
AGENCY-SPECIFIC INSTRUCTIONS (from your team's training notes)
═══════════════════════════════════════════════════════════════
${configRow.config_value.trim()}
═══════════════════════════════════════════════════════════════`;
        console.log(`[CONFIG] Injected ${configRow.config_value.length} chars of custom instructions`);
      }
    } catch (e) {
      console.warn('[CONFIG] Failed to fetch custom instructions (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH KNOWLEDGE BASE DOCUMENTS (parsed insights from uploaded PDFs/docs)
    // ═══════════════════════════════════════════════════════════════════════════
    let knowledgeBaseBlock = '';
    try {
      const { data: knowledgeDocs } = await supabase
        .from('strategist_knowledge_docs')
        .select('file_name, summary, parsed_content, category')
        .neq('parsed_content', '')
        .order('created_at', { ascending: false })
        .limit(10);

      if (knowledgeDocs && knowledgeDocs.length > 0) {
        const docSummaries = knowledgeDocs.map((doc: any) => {
          // Extract just the AI-extracted insights section (not raw content) to save tokens
          const content = doc.parsed_content || '';
          const insightsMatch = content.match(/=== AI-EXTRACTED INSIGHTS ===([\s\S]*?)=== RAW CONTENT ===/);
          const insights = insightsMatch ? insightsMatch[1].trim() : content.slice(0, 2000);
          return `📄 ${doc.file_name} [${doc.category}]:\n${doc.summary}\n${insights}`;
        });

        knowledgeBaseBlock = `\n\n═══════════════════════════════════════════════════════════════
KNOWLEDGE BASE (uploaded reference documents — use these insights)
═══════════════════════════════════════════════════════════════
${docSummaries.join('\n\n---\n\n')}
═══════════════════════════════════════════════════════════════`;
        console.log(`[KNOWLEDGE] Injected ${knowledgeDocs.length} docs, ${knowledgeBaseBlock.length} chars`);
      }
    } catch (e) {
      console.warn('[KNOWLEDGE] Failed to fetch knowledge docs (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH CLIENT'S TRACKED CONVERSION TYPES
    // ═══════════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════
    // 1A: INJECT AI MEMORY BANK — Everything the AI has learned about this client
    // ═══════════════════════════════════════════════════════════════════════════
    let memoryBankBlock = '';
    try {
      const { data: memories } = await supabase
        .from('client_ai_memory')
        .select('memory_type, content, source, created_at, context')
        .eq('client_name', clientName)
        .order('created_at', { ascending: false })
        .limit(30);

      if (memories && memories.length > 0) {
        const memoryLines = memories.map((m: any) => {
          const date = m.created_at?.split('T')[0] || 'unknown';
          const category = m.memory_type || 'general';
          return `[${date}] [${category}] ${m.content}`;
        });
        memoryBankBlock = `\n\nMEMORY BANK — Your accumulated knowledge about ${clientName}\n${'='.repeat(60)}\n${memoryLines.join('\n')}\n${'='.repeat(60)}`;
        console.log(`[MEMORY] Injected ${memories.length} memories for ${clientName}`);
      }
    } catch (e) {
      console.warn('[MEMORY] Failed to fetch AI memories (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1B: INJECT DAILY SNAPSHOT TRENDS — 30-day performance with deltas
    // ═══════════════════════════════════════════════════════════════════════════
    let snapshotTrendsBlock = '';
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const { data: snapshots } = await supabase
        .from('ppc_daily_snapshots')
        .select('snapshot_date, spend, impressions, clicks, conversions, cost_per_conversion, leads, purchases, calls')
        .eq('client_name', clientName)
        .eq('platform', platform)
        .gte('snapshot_date', thirtyDaysAgo)
        .order('snapshot_date', { ascending: true });

      if (snapshots && snapshots.length >= 2) {
        const recent7 = snapshots.slice(-7);
        const prior7 = snapshots.length >= 8 ? snapshots.slice(-14, -7) : [];

        const avg = (arr: any[], key: string) => {
          const vals = arr.map(s => s[key] || 0);
          return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
        };

        const metricKeys = ['spend', 'impressions', 'clicks', 'conversions', 'cost_per_conversion'];
        const trendLines: string[] = [];

        for (const m of metricKeys) {
          const recentAvg = avg(recent7, m);
          const label = m.replace(/_/g, ' ').toUpperCase();
          if (prior7.length === 0) {
            // Not enough data for WoW comparison
            trendLines.push(`  ${label}: ${recentAvg.toFixed(2)} avg/day (no prior period for comparison)`);
          } else {
            const priorAvg = avg(prior7, m);
            const delta = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg * 100) : (recentAvg > 0 ? 100 : 0);
            const direction = delta > 2 ? (m === 'cost_per_conversion' ? '(worse)' : '(better)') : delta < -2 ? (m === 'cost_per_conversion' ? '(better)' : '(worse)') : '(stable)';
            trendLines.push(`  ${label}: ${recentAvg.toFixed(2)} avg/day (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% WoW) ${direction}`);
          }
        }

        const dailyLines = recent7.map((s: any) =>
          `  ${s.snapshot_date}: $${(s.spend || 0).toFixed(0)} spend, ${s.clicks || 0} clicks, ${s.conversions || 0} conv, CPA: ${s.conversions > 0 ? `$${(s.spend / s.conversions).toFixed(2)}` : 'N/A'}`
        );

        snapshotTrendsBlock = `\n\nPERFORMANCE TRENDS (${snapshots.length} days of snapshots)\n${'='.repeat(60)}\n7-DAY ROLLING AVERAGES vs PRIOR 7 DAYS:\n${trendLines.join('\n')}\n\nDAILY DETAIL (last 7 days):\n${dailyLines.join('\n')}\n${'='.repeat(60)}`;
        console.log(`[SNAPSHOTS] Injected ${snapshots.length} daily snapshots for ${clientName}/${platform}`);
      }
    } catch (e) {
      console.warn('[SNAPSHOTS] Failed to fetch daily snapshots (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2A: CROSS-CLIENT LEARNING — Anonymized insights from other accounts
    // ═══════════════════════════════════════════════════════════════════════════
    let crossClientBlock = '';
    try {
      const { data: crossLearnings } = await supabase
        .from('client_ai_memory')
        .select('content, memory_type, created_at')
        .eq('memory_type', 'strategist_learning')
        .neq('client_name', clientName)
        .order('created_at', { ascending: false })
        .limit(10);

      if (crossLearnings && crossLearnings.length > 0) {
        const anonymizedLines = crossLearnings.map((m: any, i: number) => {
          const date = m.created_at?.split('T')[0] || '';
          return `  ${i + 1}. [${date}] ${m.content}`;
        });
        crossClientBlock = `\n\nINDUSTRY INSIGHTS (anonymized learnings from other accounts)\n${'='.repeat(60)}\n${anonymizedLines.join('\n')}\n${'='.repeat(60)}`;
        console.log(`[CROSS-CLIENT] Injected ${crossLearnings.length} cross-client learnings`);
      }
    } catch (e) {
      console.warn('[CROSS-CLIENT] Failed to fetch cross-client learnings (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3B: COMPETITIVE INTELLIGENCE (from research phase in run-full-fleet)
    // ═══════════════════════════════════════════════════════════════════════════
    let competitiveIntelBlock = '';
    if (researchContext) {
      try {
        const parts: string[] = [];
        if (researchContext.seoData) {
          for (const comp of researchContext.seoData) {
            if (comp.domain && comp.data) {
              parts.push(`Competitor SEO - ${comp.domain}:\n  Organic Keywords: ${comp.data.organicKeywords || 'N/A'}\n  Organic Traffic: ${comp.data.organicTraffic || 'N/A'}\n  Top Keywords: ${(comp.data.topKeywords || []).slice(0, 5).join(', ') || 'N/A'}`);
            }
          }
        }
        if (researchContext.adTransparency) {
          for (const comp of researchContext.adTransparency) {
            if (comp.name && comp.data) {
              parts.push(`Competitor Ads - ${comp.name}:\n  Active Ad Count: ${comp.data.adCount || 'N/A'}\n  Ad Themes: ${(comp.data.themes || []).slice(0, 5).join(', ') || 'N/A'}\n  Key Messaging: ${(comp.data.headlines || []).slice(0, 3).join(' | ') || 'N/A'}`);
            }
          }
        }
        if (parts.length > 0) {
          competitiveIntelBlock = `\n\nCOMPETITIVE INTELLIGENCE (gathered this week)\n${'='.repeat(60)}\n${parts.join('\n\n')}\n${'='.repeat(60)}`;
          console.log(`[RESEARCH] Injected competitive intel: ${parts.length} competitor entries`);
        }
      } catch (e) {
        console.warn('[RESEARCH] Failed to format research context (non-fatal):', e);
      }
    }

    let trackedConversionTypes: string[] = ['leads', 'purchases', 'calls'];
    let primaryConversionGoal = 'all';
    try {
      const { data: clientConfig } = await supabase
        .from('managed_clients')
        .select('tracked_conversion_types, primary_conversion_goal')
        .eq('client_name', clientName)
        .single();
      if (clientConfig) {
        trackedConversionTypes = clientConfig.tracked_conversion_types || trackedConversionTypes;
        primaryConversionGoal = clientConfig.primary_conversion_goal || primaryConversionGoal;
      }
      console.log(`[CLIENT CONFIG] ${clientName} tracks: ${trackedConversionTypes.join(', ')}, goal: ${primaryConversionGoal}`);
    } catch (e) {
      console.warn('[CLIENT CONFIG] Failed to fetch tracked conversion types (non-fatal):', e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WORLD-CLASS AI PROMPT — The Strategist v2
    // ═══════════════════════════════════════════════════════════════════════════

    const totalSpend = campaignData.reduce((s: number, c: any) => s + c.cost, 0);
    const totalConversions = campaignData.reduce((s: number, c: any) => s + c.conversions, 0);
    const totalLeads = campaignData.reduce((s: number, c: any) => s + (c.leads || 0), 0);
    const totalPurchases = campaignData.reduce((s: number, c: any) => s + (c.purchases || 0), 0);
    const overallCPA = totalConversions > 0 ? totalSpend / totalConversions : null;

    const wastedSpendKeywords = keywordData.filter((k: any) => k.cost > 50 && k.conversions === 0);
    const underperformingCampaigns = campaignData.filter((c: any) => c.cost > 100 && c.conversions === 0);
    const topCampaigns = campaignData.filter((c: any) => c.conversions > 0).sort((a: any, b: any) => a.cpa - b.cpa).slice(0, 3);

    const systemPrompt = `You are "The Strategist" — a world-class PPC optimization expert with 15+ years managing $50M+ in ad spend across Google Ads and Meta Ads. You analyze accounts with the precision of a forensic accountant and the strategic vision of a CMO.
${customInstructionsBlock}
${knowledgeBaseBlock}

═══════════════════════════════════════════════════════════════
ABSOLUTE RULES — VIOLATION OF THESE IS UNACCEPTABLE
═══════════════════════════════════════════════════════════════

🚫 FORBIDDEN ACTIONS (you must NEVER propose any of these):
- NEVER change, adjust, increase, decrease, reallocate, or touch budgets in any way
- NEVER INCREASE total ad spend or individual campaign budgets under ANY circumstances. You can only optimize WITHIN the existing budget (bid adjustments, negative keywords, match types, creative)
- NEVER propose "reallocate_budget" or "budget_adjustment" — these types DO NOT EXIST
- NEVER pause campaigns, ad sets, or ads — pausing removes volume and is never the answer
- NEVER propose "pause_campaign", "pause_ad", "pause_ad_set", "pause_keyword", or "status_change"
- NEVER include "daily_budget", "budget", "lifetime_budget" in any after_value object
- If a campaign is underperforming, the answer is ALWAYS bid adjustments, negative keywords, match type changes, or creative improvements — NOT pausing, budget changes, or spending more money

✅ ALLOWED CHANGE TYPES (use ONLY these):
1. "adjust_bid" — Modify CPC bid on a specific keyword or ad group to optimize CPA/ROAS
2. "add_negative_keyword" — Block irrelevant search terms that waste spend without conversions
3. "change_match_type" — Tighten match type (broad → phrase → exact) for better targeting precision
4. "flag_creative_issue" — Flag a specific headline/description/creative that needs improvement (include suggested copy in after_value)
5. "flag_keyword_opportunity" — Identify keyword expansion, new keyword ideas, or pruning opportunities

═══════════════════════════════════════════════════════════════
REASONING QUALITY REQUIREMENTS
═══════════════════════════════════════════════════════════════

Your "reasoning" field MUST follow this exact structure with ALL 5 sections:

**SECTION 1 — ACCOUNT HEALTH SNAPSHOT**
- Total spend efficiency: spend vs. conversions trend
- CPA trajectory: improving, stable, or worsening
- Click-through rate benchmarks: are CTRs healthy for this industry?
- Budget utilization: is spend concentrated or distributed?

**SECTION 2 — CAMPAIGN-LEVEL WINNERS & LOSERS**
- Rank campaigns by cost-efficiency (CPA, ROAS)
- Name the top 3 campaigns and WHY they're winning (specific CTR, conversion rate, CPC data)
- Name the bottom 3 and what's wrong (high CPC, low CTR, zero conversions)
- Identify impression share gaps and competitive pressure signals

**SECTION 3 — KEYWORD DEEP DIVE**
- Wasted spend analysis: keywords with $50+ spend and 0 conversions
- Match type opportunities: broad match keywords that should be tightened
- Negative keyword mining: identify search term patterns to block
- High-performer amplification: which keywords deserve more aggressive bids?

**SECTION 4 — CREATIVE & LANDING PAGE SIGNALS**
- CTR by campaign as a proxy for ad copy effectiveness
- Identify campaigns with high impressions but low CTR (creative fatigue signals)
- Suggest specific headline/description improvements based on the data
- Note any conversion rate anomalies that suggest landing page issues

**SECTION 5 — STRATEGIC ACTION PLAN**
- Prioritized list of recommended changes
- Expected impact in dollar terms for each change
- Confidence level justification for each recommendation

MINIMUM QUALITY BAR:
- Your reasoning MUST be at least 4 paragraphs covering all 5 sections
- Every recommendation must cite SPECIFIC numbers (CTR: X%, CPA: $Y, CPC: $Z)
- Each ai_rationale must be UNIQUE and data-specific — no generic phrases like "improve performance"
- Expected impact must include projected dollar savings or improvement amounts

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Respond with a JSON object (no markdown, no code blocks, no explanation outside JSON):
{
  "reasoning": "string — your detailed 5-section analysis as described above",
  "summary": "string — 2-3 sentence executive summary with the most impactful finding and top recommendation",
  "changes": [
    {
      "change_type": "adjust_bid|add_negative_keyword|change_match_type|flag_creative_issue|flag_keyword_opportunity",
      "entity_type": "keyword|campaign|ad_group",
      "entity_id": "REQUIRED — exact resource_name or ID from the entity reference list. null if unresolvable.",
      "entity_name": "string — exact name from the data",
      "before_value": { "metric_name": "current_value" },
      "after_value": { ... },  // SEE REQUIRED FORMAT BELOW
      "ai_rationale": "string — unique, data-specific reason citing exact CTR/CPA/CPC numbers. NEVER generic.",
      "confidence": "high|medium|low",
      "expected_impact": "string — projected dollar impact (e.g. 'Save ~$150/mo by blocking non-converting searches')",
      "priority": "high|medium|low"
    }
  ]
}

REQUIRED after_value FORMAT PER CHANGE TYPE:
- adjust_bid: { "cpc_bid": 2.50 } — value in DOLLARS (not micros). Example: to set $3.25, use {"cpc_bid": 3.25}
- add_negative_keyword: { "negative_keyword": "single keyword phrase", "match_type": "EXACT" }
  RULES: ONE keyword per change object. The value must be a real search term to block, NOT a campaign name.
  NEVER comma-separate multiple keywords. If you want to add 3 negatives, create 3 separate change objects.
- change_match_type: { "match_type": "EXACT", "current_match_type": "BROAD" }
- flag_creative_issue: { "suggestion": "proposed improvement text" }
- flag_keyword_opportunity: { "keywords": ["keyword1", "keyword2"], "rationale": "why" }

Aim for 5-12 specific, actionable changes. Rank by priority (high first).
NEVER output change types not in the allowed list. You will be penalized for any budget or pause recommendations.

═══════════════════════════════════════════════════════════════
LEARNING PROTOCOL
═══════════════════════════════════════════════════════════════

1. Review your Memory Bank before making recommendations. Do NOT repeat strategies that previously failed on the same entities.
2. If you see [change_outcome] entries marked "worsened", AVOID repeating those strategies. If marked "improved", consider doubling down on similar approaches.
3. If you see [strategist_learning] entries, treat them as direct lessons from past AI assessments. Apply them.
4. Reference specific trend data from the Performance Trends section when justifying changes.
5. For each recommendation, cite which historical outcome or trend informed your decision.
6. If competitive intelligence is available, reference it when suggesting keyword additions, negative keywords, or ad copy angles.
7. End your analysis with a "learnings" array in the JSON output (see format below).

ADDITIONAL OUTPUT FIELDS (add these to your JSON response):
- "learnings": ["string1", "string2", ...] — 1-3 NEW insights you discovered THIS session that should be remembered for future runs. Be specific and actionable.
- "confidence_summary": { "high_count": N, "medium_count": N, "low_count": N, "overall_risk": "low|medium|high", "risk_notes": "string" }`;


    const convBreakdownLine = platform === 'meta' && (totalLeads > 0 || totalPurchases > 0)
      ? `\n- Conversion Breakdown: ${totalLeads} leads, ${totalPurchases} purchases`
      : '';

    const clientConvContext = `\n\nCLIENT CONVERSION CONTEXT:
- Tracked conversion types: ${trackedConversionTypes.join(', ')}
- Primary conversion goal: ${primaryConversionGoal}
- When evaluating CPA, focus on the tracked conversion types above. ${primaryConversionGoal === 'leads' ? 'This is a lead-gen client — leads are the primary KPI, not purchases.' : primaryConversionGoal === 'purchases' ? 'This is an e-commerce client — purchases/ROAS are the primary KPIs.' : 'Evaluate all conversion types equally.'}`;

    const userPrompt = `Analyze this ${platform === 'google' ? 'Google Ads' : 'Meta Ads'} account for client: ${clientName}
Date range: ${dateStart} to ${dateEnd}

ACCOUNT OVERVIEW:
- Total Spend: $${totalSpend.toFixed(2)}
- Total Conversions: ${totalConversions}${convBreakdownLine}
- Overall CPA: ${overallCPA ? `$${overallCPA.toFixed(2)}` : 'N/A (no conversions)'}
${clientConvContext}

TOP CAMPAIGNS BY SPEND:
${campaignData.slice(0, 15).map((c: any) => {
  const convDetail = (c.leads || c.purchases) ? ` [${c.leads || 0} leads, ${c.purchases || 0} purchases]` : '';
  return `- ${c.name}: $${c.cost.toFixed(2)} spend, ${c.clicks} clicks, ${c.conversions} conv${convDetail}, CPA: ${c.cpa === Infinity ? '∞ (no conv)' : `$${c.cpa.toFixed(2)}`}, CTR: ${c.ctr.toFixed(2)}%, CPC: $${c.cpc.toFixed(2)}`;
}).join('\n')}

${keywordData.length > 0 ? `TOP KEYWORDS BY SPEND:
${keywordData.slice(0, 25).map((k: any) => 
  `- "${k.keyword}" [${k.campaign}]: $${k.cost.toFixed(2)}, ${k.clicks} clicks, ${k.conversions} conv, CPC: $${k.cpc.toFixed(2)}, CTR: ${k.ctr.toFixed(2)}%`
).join('\n')}` : ''}

${wastedSpendKeywords.length > 0 ? `ZERO-CONVERSION KEYWORDS (wasted spend >$50):
${wastedSpendKeywords.slice(0, 15).map((k: any) => `- "${k.keyword}" [${k.campaign}]: $${k.cost.toFixed(2)} wasted, ${k.clicks} clicks, CPC: $${k.cpc.toFixed(2)}`).join('\n')}` : ''}

${underperformingCampaigns.length > 0 ? `ZERO-CONVERSION CAMPAIGNS (spend >$100):
${underperformingCampaigns.map((c: any) => `- ${c.name}: $${c.cost.toFixed(2)} with 0 conversions, CTR: ${c.ctr.toFixed(2)}%`).join('\n')}` : ''}

${topCampaigns.length > 0 ? `BEST PERFORMING CAMPAIGNS:
${topCampaigns.map((c: any) => `- ${c.name}: CPA $${c.cpa.toFixed(2)}, ${c.conversions} conv, CTR: ${c.ctr.toFixed(2)}%`).join('\n')}` : ''}
${historyBlock}
${entityReferenceBlock}
${memoryBankBlock}
${snapshotTrendsBlock}
${crossClientBlock}
${competitiveIntelBlock}

REMINDER: You MUST NOT propose any budget changes, pauses, or status changes. Only: adjust_bid, add_negative_keyword, change_match_type, flag_creative_issue, flag_keyword_opportunity.
Include "learnings" and "confidence_summary" in your JSON response as specified in the Learning Protocol.`;

    // AI ENGINE: Claude Sonnet 4.6 via Anthropic API
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const modelUsed = 'claude-sonnet-4-6';
    let rawContent = '{}';

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelUsed,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.3,
          }),
        });

        if (anthropicRes.ok) {
          const anthropicJson = await anthropicRes.json();
          rawContent = anthropicJson.content?.[0]?.text || '{}';
          console.log(`[AI] Claude Sonnet 4.6 response OK (attempt ${attempt + 1})`);
          break;
        }

        if (anthropicRes.status === 429) {
          if (attempt === 0) {
            console.warn('[AI] Rate limited, retrying in 3s...');
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const errBody = await anthropicRes.text().catch(() => '');
        console.warn(`[AI] Claude attempt ${attempt + 1} failed: ${anthropicRes.status} ${errBody.slice(0, 200)}`);
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw new Error(`Claude API error: ${anthropicRes.status}`);
        }
      } catch (e: any) {
        if (attempt === 1) throw e;
        console.warn(`[AI] Claude attempt ${attempt + 1} error:`, e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`[AI] Using model: ${modelUsed}`);

    let analysisResult: any = { reasoning: '', summary: '', changes: [] };
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI JSON:', e, rawContent.slice(0, 500));
      analysisResult.reasoning = rawContent;
      analysisResult.summary = 'Analysis complete — review reasoning above.';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 3: SERVER-SIDE VALIDATION FILTER
    // Remove forbidden changes BEFORE storing in database
    // ═══════════════════════════════════════════════════════════════════════════

    const rawChanges = (analysisResult.changes || []).slice(0, 15);
    let blockedCount = 0;

    const enrichedChanges = rawChanges
      .map((change: any) => {
        // Normalize first
        const normalized = normalizeChangeType(change);

        // Check if blocked
        const blockCheck = isBlockedChange({ ...change, change_type: normalized.change_type, after_value: normalized.after_value });
        if (blockCheck.blocked) {
          blockedCount++;
          console.warn(`[SAFETY FILTER] BLOCKED change: ${blockCheck.reason} | entity: "${change.entity_name}" | original type: "${change.change_type}"`);
          return null; // Will be filtered out
        }

        // Resolve entity ID
        let resolvedEntityId = change.entity_id || null;

        if (platform === 'google' && googleEntityMap && googleCustomerId) {
          resolvedEntityId = resolveEntityId(change, googleEntityMap, googleCustomerId);
          if (resolvedEntityId && !change.entity_id) {
            console.log(`[ENTITY ENRICHMENT] Resolved "${change.entity_name}" → ${resolvedEntityId}`);
          }
        } else if (platform === 'meta' && metaEntityMap) {
          resolvedEntityId = resolveMetaEntityId(change, metaEntityMap);
          if (resolvedEntityId && !change.entity_id) {
            console.log(`[ENTITY ENRICHMENT] Resolved "${change.entity_name}" → ${resolvedEntityId}`);
          }
        }

        if (!resolvedEntityId) {
          console.warn(`[ENTITY ENRICHMENT] Could NOT resolve entity_id for "${change.entity_name}" (${change.entity_type})`);
        }

        return {
          ...change,
          change_type: normalized.change_type,
          after_value: normalized.after_value,
          entity_id: resolvedEntityId,
        };
      })
      .filter(Boolean); // Remove blocked (null) entries

    if (blockedCount > 0) {
      console.warn(`[SAFETY FILTER] Blocked ${blockedCount} forbidden changes out of ${rawChanges.length} total`);
    }

    analysisResult.changes = enrichedChanges;

    // 1D + 2C: EXTRACT AND SAVE LEARNINGS from AI response
    try {
      // Robust learnings extraction: handle array of strings, array of objects, single string
      let rawLearnings = analysisResult.learnings;
      let learnings: string[] = [];
      if (Array.isArray(rawLearnings)) {
        learnings = rawLearnings
          .map((l: any) => typeof l === 'string' ? l : (l?.content || l?.text || l?.description || (typeof l === 'object' ? JSON.stringify(l) : String(l))))
          .filter((l: string) => l && l.length > 5 && l !== '{}');
      } else if (typeof rawLearnings === 'string' && rawLearnings.length > 5) {
        learnings = [rawLearnings];
      }

      if (learnings.length > 0) {
        const learningInserts = learnings.slice(0, 3).map((learning: string) => ({
          client_name: clientName,
          memory_type: 'strategist_learning',
          content: String(learning).substring(0, 500),
          source: 'ppc_analyze',
          context: {
            date: new Date().toISOString().split('T')[0],
            platform,
            model: modelUsed,
          },
          relevance_score: 1.0,
        }));

        await supabase.from('client_ai_memory').insert(learningInserts);
        console.log(`[LEARNING] Saved ${learningInserts.length} new learnings for ${clientName}`);

        // Trim old memories if over cap (keep most recent 50 per client)
        const { data: allMemories } = await supabase
          .from('client_ai_memory')
          .select('id')
          .eq('client_name', clientName)
          .order('created_at', { ascending: true });

        if (allMemories && allMemories.length > 50) {
          const toDelete = allMemories.slice(0, allMemories.length - 50).map((m: any) => m.id);
          await supabase.from('client_ai_memory').delete().in('id', toDelete);
          console.log(`[LEARNING] Trimmed ${toDelete.length} old memories for ${clientName}`);
        }
      }
    } catch (e) {
      console.warn('[LEARNING] Failed to save learnings (non-fatal):', e);
    }

    // --- Store session in DB ---
    const { data: session, error: sessionErr } = await supabase
      .from('ppc_optimization_sessions')
      .insert({
        client_name: clientName,
        platform,
        account_id: accountId || null,
        date_range_start: dateStart,
        date_range_end: dateEnd,
        supermetrics_data: { campaigns: campaignData, keywords: keywordData, totalSpend, totalConversions, modelUsed, dataSource, confidenceSummary: analysisResult.confidence_summary || null },
        ai_reasoning: analysisResult.reasoning || '',
        ai_summary: analysisResult.summary || '',
        status: autoMode ? 'auto_executing' : 'pending_review',
        auto_mode: autoMode || false,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (sessionErr) throw sessionErr;

    // --- Store proposed changes ---
    const allChanges = enrichedChanges;

    // Auto-mode: only auto-approve non-flag, high-confidence changes with resolved entity_id
    const autoEligible = autoMode
      ? allChanges.filter((c: any) => (c.confidence === 'high' || c.confidence === 'medium') && c.entity_id && !c.change_type.startsWith('flag_'))
      : [];

    const now = new Date().toISOString();

    if (allChanges.length > 0) {
      const changesInsert = allChanges.map((c: any) => {
        const isAutoApproved = autoMode && autoEligible.some((a: any) => a === c);
        return {
          session_id: session.id,
          client_name: clientName,
          platform,
          change_type: c.change_type || 'unknown',
          entity_type: c.entity_type || null,
          entity_id: c.entity_id || null,
          entity_name: c.entity_name || 'Unknown',
          before_value: c.before_value || {},
          after_value: c.after_value || {},
          ai_rationale: c.ai_rationale || '',
          confidence: c.confidence || 'medium',
          expected_impact: c.expected_impact || '',
          priority: c.priority || 'medium',
          approval_status: isAutoApproved ? 'auto_approved' : 'pending',
          approved_at: isAutoApproved ? now : null,
          approved_by: null,
        };
      });

      const { data: insertedChanges, error: changesErr } = await supabase
        .from('ppc_proposed_changes')
        .insert(changesInsert)
        .select();

      if (changesErr) console.error('Error inserting changes:', changesErr);

      const resolved = allChanges.filter((c: any) => c.entity_id).length;
      const unresolved = allChanges.filter((c: any) => !c.entity_id).length;
      console.log(`[ENTITY STATS] ${resolved} resolved, ${unresolved} unresolved out of ${allChanges.length} total changes`);
      console.log(`[SAFETY STATS] ${blockedCount} blocked, ${allChanges.length} stored out of ${rawChanges.length} AI-proposed`);

      // --- Auto Mode: QA validation then execute ---
      if (autoMode && insertedChanges && insertedChanges.length > 0) {
        const autoApprovedChanges = insertedChanges
          .filter((c: any) => c.approval_status === 'auto_approved');

        if (autoApprovedChanges.length > 0) {
          console.log(`[AUTO MODE] ${autoApprovedChanges.length} changes pre-approved for ${clientName}. Running QA...`);

          // ══════════════════════════════════════════════════
          // QA STEP 1: DATA VALIDATION
          // Verify each entity is still active in the ad platform
          // ══════════════════════════════════════════════════
          let qaPassedChanges = autoApprovedChanges;
          if (platform === 'google' && cachedGoogleAccessToken) {
            const qaStep1Start = Date.now();
            const activeEntityIds = new Set<string>();
            try {
              // Fetch all active keyword + ad group resource names in one query
              const qaRes = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${googleCustomerId}/googleAds:search`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cachedGoogleAccessToken}`,
                  'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
                  'login-customer-id': Deno.env.get('GOOGLE_ADS_MCC_ID')?.replace(/-/g, '') || '',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  query: `SELECT ad_group_criterion.resource_name FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED' LIMIT 10000`,
                }),
              });
              if (qaRes.ok) {
                const qaJson = await qaRes.json();
                for (const row of (qaJson.results || [])) {
                  if (row.adGroupCriterion?.resourceName) activeEntityIds.add(row.adGroupCriterion.resourceName);
                }
              }
              // Also fetch active ad groups
              const qaRes2 = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${googleCustomerId}/googleAds:search`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cachedGoogleAccessToken}`,
                  'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
                  'login-customer-id': Deno.env.get('GOOGLE_ADS_MCC_ID')?.replace(/-/g, '') || '',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  query: `SELECT ad_group.resource_name FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED' LIMIT 5000`,
                }),
              });
              if (qaRes2.ok) {
                const qaJson2 = await qaRes2.json();
                for (const row of (qaJson2.results || [])) {
                  if (row.adGroup?.resourceName) activeEntityIds.add(row.adGroup.resourceName);
                }
              }
            } catch (e: any) {
              console.warn(`[QA STEP 1] Entity validation query failed: ${e.message}. Proceeding with all changes.`);
            }

            if (activeEntityIds.size > 0) {
              const beforeCount = qaPassedChanges.length;
              qaPassedChanges = qaPassedChanges.filter((c: any) => {
                if (!c.entity_id) return false;
                if (activeEntityIds.has(c.entity_id)) return true;
                // For negative keywords targeting campaigns, check campaign resource
                if (c.change_type === 'add_negative_keyword') return true; // campaigns checked separately
                console.log(`[QA STEP 1] REJECTED: "${c.entity_name}" (${c.change_type}) — entity ${c.entity_id} not found in active entities`);
                return false;
              });
              const rejected1 = beforeCount - qaPassedChanges.length;
              console.log(`[QA STEP 1] ${qaPassedChanges.length} passed, ${rejected1} rejected (entity not active) in ${Date.now() - qaStep1Start}ms`);

              // Mark rejected changes
              if (rejected1 > 0) {
                const rejectedIds = autoApprovedChanges
                  .filter((c: any) => !qaPassedChanges.includes(c))
                  .map((c: any) => c.id);
                if (rejectedIds.length > 0) {
                  await supabase.from('ppc_proposed_changes')
                    .update({ approval_status: 'qa_rejected', execution_error: 'QA Step 1: Entity not active in ad platform' })
                    .in('id', rejectedIds);
                }
              }
            }
          }

          // ══════════════════════════════════════════════════
          // QA STEP 2: AI SECOND OPINION + WEBSITE VERIFICATION
          // Fetch client website, then send changes + website context
          // to Claude for independent review. Only execute what passes.
          // ══════════════════════════════════════════════════
          if (qaPassedChanges.length > 0) {
            const qaStep2Start = Date.now();
            try {
              const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
              if (ANTHROPIC_API_KEY) {
                // Fetch client website for context verification
                let websiteContext = '';
                try {
                  const { data: clientInfo } = await supabase
                    .from('managed_clients')
                    .select('domain, industry, primary_conversion_goal')
                    .eq('client_name', clientName)
                    .single();

                  if (clientInfo?.domain) {
                    const siteUrl = clientInfo.domain.startsWith('http') ? clientInfo.domain : `https://${clientInfo.domain}`;
                    const siteRes = await fetch(siteUrl, {
                      headers: { 'User-Agent': 'MellekaBot/1.0 (PPC QA Verification)' },
                      signal: AbortSignal.timeout(8000),
                    });
                    if (siteRes.ok) {
                      const html = await siteRes.text();
                      // Extract text content: title, meta description, headings, and body text
                      const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || '';
                      const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
                      const headings = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gis)].map(m => m[1].replace(/<[^>]*>/g, '').trim()).filter(Boolean).slice(0, 20);
                      // Strip HTML tags for body text sample
                      const bodyText = html
                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]*>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 2000);

                      websiteContext = `\n\nWEBSITE VERIFICATION (${siteUrl}):
- Title: ${title}
- Meta Description: ${metaDesc}
- Key Headings: ${headings.join(' | ')}
- Industry: ${clientInfo.industry || 'unknown'}
- Conversion Goal: ${clientInfo.primary_conversion_goal || 'unknown'}
- Page Content Sample: ${bodyText.substring(0, 1000)}`;
                      console.log(`[QA STEP 2] Fetched website context from ${siteUrl} (${bodyText.length} chars)`);
                    }
                  }
                } catch (siteErr: any) {
                  console.warn(`[QA STEP 2] Website fetch failed: ${siteErr.message}. Proceeding without website context.`);
                }

                const changesSummary = qaPassedChanges.map((c: any) =>
                  `- ${c.change_type} on ${c.entity_type} "${c.entity_name}": ${JSON.stringify(c.before_value)} → ${JSON.stringify(c.after_value)} | Rationale: ${c.ai_rationale || 'none'} | Confidence: ${c.confidence}`
                ).join('\n');

                const qaPrompt = `You are a PPC Quality Assurance reviewer. You must independently verify that the following proposed changes to a ${platform} ads account for "${clientName}" are safe and sensible.

CRITICAL RULES:
- NEVER approve any change that increases total ad budget or campaign budget
- NEVER approve pausing campaigns/ads/keywords
- Changes should only optimize WITHIN existing budget (bids, negatives, match types, creative flags)
- Bid adjustments should be reasonable (not more than 2-3x current bid)
- Negative keywords must be CLEARLY irrelevant to the business. Cross-reference with the website content below. If a negative keyword matches a service/product the business actually offers, REJECT it immediately.
- Reject anything that seems risky, unclear, or could harm performance
- Verify that keyword changes align with what the business actually does (check website content)

PROPOSED CHANGES (${qaPassedChanges.length} total):
${changesSummary}

ACCOUNT CONTEXT:
- Total Spend: $${totalSpend?.toFixed(2) || '?'}
- Total Conversions: ${totalConversions || '?'}
- Platform: ${platform}${websiteContext}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "approved_indices": [0, 1, 2],
  "rejected_indices": [3],
  "rejection_reasons": { "3": "Reason why change 3 was rejected" },
  "overall_confidence": "high|medium|low",
  "qa_notes": "Brief overall assessment"
}

Approve indices of changes you are confident are safe. Reject any you are unsure about. When in doubt, REJECT.`;

                const qaRes = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 2048,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: qaPrompt }],
                  }),
                });

                if (qaRes.ok) {
                  const qaJson = await qaRes.json();
                  const qaText = qaJson.content?.[0]?.text || '';
                  try {
                    const qaResult = JSON.parse(qaText.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
                    const approvedIndices = new Set(qaResult.approved_indices || []);

                    const beforeCount2 = qaPassedChanges.length;
                    const qaRejected: any[] = [];
                    const qaApproved: any[] = [];

                    qaPassedChanges.forEach((c: any, i: number) => {
                      if (approvedIndices.has(i)) {
                        qaApproved.push(c);
                      } else {
                        const reason = qaResult.rejection_reasons?.[String(i)] || 'QA reviewer not confident';
                        qaRejected.push({ ...c, qaReason: reason });
                      }
                    });

                    // Mark QA-rejected changes
                    if (qaRejected.length > 0) {
                      for (const rej of qaRejected) {
                        await supabase.from('ppc_proposed_changes')
                          .update({ approval_status: 'qa_rejected', execution_error: `QA Step 2: ${rej.qaReason}` })
                          .eq('id', rej.id);
                      }
                    }

                    qaPassedChanges = qaApproved;
                    console.log(`[QA STEP 2] AI review: ${qaApproved.length} approved, ${qaRejected.length} rejected. Confidence: ${qaResult.overall_confidence || '?'}. Notes: ${qaResult.qa_notes || 'none'} (${Date.now() - qaStep2Start}ms)`);
                  } catch (parseErr) {
                    console.warn(`[QA STEP 2] Failed to parse QA response, proceeding with all changes: ${qaText.substring(0, 200)}`);
                  }
                } else {
                  console.warn(`[QA STEP 2] QA API call failed (${qaRes.status}), proceeding with all changes`);
                }
              }
            } catch (e: any) {
              console.warn(`[QA STEP 2] Error: ${e.message}. Proceeding with all changes.`);
            }
          }

          // ══════════════════════════════════════════════════
          // EXECUTE: Only QA-passed changes
          // ══════════════════════════════════════════════════
          const qaPassedIds = qaPassedChanges.map((c: any) => c.id);

          if (qaPassedIds.length > 0) {
            console.log(`[AUTO MODE] Executing ${qaPassedIds.length}/${autoApprovedChanges.length} changes after QA for ${clientName}`);

            const executeRes = await fetch(`${SUPABASE_URL}/functions/v1/ppc-execute`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                changeIds: qaPassedIds,
                sessionId: session.id,
                autoMode: true,
              }),
            });

            const executeResult = await executeRes.json();
            console.log('[AUTO MODE] Execution result:', JSON.stringify(executeResult));

            await supabase
              .from('ppc_optimization_sessions')
              .update({ status: 'auto_executed' })
              .eq('id', session.id);

            return new Response(JSON.stringify({
              success: true,
              session,
              changesCount: allChanges.length,
              blockedCount,
              autoExecuted: qaPassedIds.length,
              qaRejected: autoApprovedChanges.length - qaPassedIds.length,
              executionResult: executeResult,
              autoMode: true,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            console.log(`[AUTO MODE] All ${autoApprovedChanges.length} changes rejected by QA for ${clientName}`);
            await supabase.from('ppc_optimization_sessions')
              .update({ status: 'qa_rejected' })
              .eq('id', session.id);
          }
        }

        await supabase
          .from('ppc_optimization_sessions')
          .update({ status: 'pending_review' })
          .eq('id', session.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session,
      changesCount: allChanges.length,
      blockedCount,
      autoMode: autoMode || false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('ppc-analyze error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── HARD BLOCKLIST: These change types can NEVER be executed ─────────────────
const BLOCKED_CHANGE_TYPES = new Set([
  'budget_adjustment',
  'reallocate_budget',
  'pause_campaign',
  'pause_ad',
  'pause_ad_set',
  'pause_keyword',
  'status_change',
  'enable_campaign',
]);

// ─── ADVISORY CHANGE TYPES: Logged but no API call, marked as executed ───────
const ADVISORY_CHANGE_TYPES = new Set([
  'change_match_type',
]);

// ─── Google Ads ───────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
import { GOOGLE_ADS_API_BASE } from '../_shared/googleAds.ts';

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

function googleHeaders(accessToken: string): Record<string, string> {
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

// Extract customer ID from a resource_name like "customers/1234567890/campaigns/..."
function extractCustomerId(resourceName: string): string | null {
  const match = resourceName.match(/^customers\/(\d+)\//);
  return match ? match[1] : null;
}

// ─── GOOGLE: Only bid adjustments and add_negative_keyword are executable ─────

async function applyGoogleAdsChange(
  change: Record<string, unknown>,
  accessToken: string,
  customerId: string
): Promise<{ executed: boolean; advisory?: string }> {
  const headers = googleHeaders(accessToken);
  const changeType = change.change_type as string;
  const entityType = change.entity_type as string;
  const afterValue = change.after_value as Record<string, unknown>;
  const entityId = change.entity_id as string | null;

  // ═══ GUARD: entity_id is REQUIRED — ppc-analyze must resolve it before storage ═══
  if (!entityId) {
    throw new Error(`No entity_id for ${changeType} on ${entityType} "${change.entity_name}". Entity must be resolved during analysis phase.`);
  }

  console.log(`[GOOGLE EXEC] ${changeType} on ${entityType} "${change.entity_name}" → ${entityId} (account: ${customerId})`);

  // ═══ BID ADJUSTMENT — only allowed on keyword and ad_group entity types ═══
  if (changeType === 'adjust_bid') {
    // GUARD: Campaign-level bid adjustments are not supported (PMAX, smart bidding, etc.)
    if (entityType === 'campaign') {
      throw new Error(`Bid adjustments on campaign-level entities are not supported. Campaigns use automated bidding strategies. Entity: "${change.entity_name}"`);
    }
    if (entityType !== 'keyword' && entityType !== 'ad_group') {
      throw new Error(`Bid adjustments only supported on "keyword" or "ad_group" entity types. Got: "${entityType}" for "${change.entity_name}"`);
    }

    // Bid extraction: accept cpc_bid, bid, or cpc_bid_micros (convert from micros)
    let rawBid = afterValue.cpc_bid ?? afterValue.bid;
    let fromMicros = false;
    if (rawBid === undefined || rawBid === null) {
      // Fallback: AI sometimes outputs Google Ads internal format
      rawBid = afterValue.cpc_bid_micros;
      fromMicros = true;
    }
    if (rawBid === undefined || rawBid === null) {
      throw new Error(`No bid value found in after_value. Expected "cpc_bid", "bid", or "cpc_bid_micros" key. Got keys: ${JSON.stringify(Object.keys(afterValue))}`);
    }
    let numericBid = typeof rawBid === 'string' ? parseFloat(String(rawBid).replace(/[$,]/g, '')) : Number(rawBid);
    // Convert from micros (e.g. 2500000 → $2.50) if the value came from cpc_bid_micros
    if (fromMicros && numericBid > 1000) {
      numericBid = numericBid / 1_000_000;
      console.log(`[GOOGLE] Converted cpc_bid_micros ${rawBid} → $${numericBid.toFixed(2)}`);
    }
    if (isNaN(numericBid) || numericBid <= 0) throw new Error(`Invalid bid value: ${JSON.stringify(rawBid)}`);
    
    const newCpcMicros = Math.round(numericBid * 1_000_000);
    const endpoint = entityType === 'keyword' ? 'adGroupCriteria' : 'adGroups';
    const mutateRes = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/${endpoint}:mutate`, {
      method: 'POST', headers,
      body: JSON.stringify({ operations: [{ update: { resourceName: entityId, cpcBidMicros: String(newCpcMicros) }, updateMask: 'cpc_bid_micros' }] }),
    });
    if (!mutateRes.ok) throw new Error(`Bid mutate failed: ${await mutateRes.text()}`);
    console.log(`[GOOGLE ✓] Bid adjusted to $${numericBid.toFixed(2)} for ${change.entity_name}`);
    return { executed: true };
  }

  // ═══ ADD NEGATIVE KEYWORD — safe, non-destructive ═══
  if (changeType === 'add_negative_keyword') {
    let keyword = afterValue.negative_keyword || afterValue.keyword || afterValue.text || change.entity_name;
    keyword = String(keyword);
    
    // If the AI crammed multiple comma-separated keywords, split and take only the first one
    if (keyword.includes(',')) {
      const parts = keyword.split(',').map((p: string) => p.trim()).filter((p: string) => p.length >= 2);
      if (parts.length > 1) {
        console.warn(`[GOOGLE FIX] Splitting comma-separated keywords: "${keyword}" → using first: "${parts[0]}"`);
        keyword = parts[0];
      }
    }
    
    // Sanitize: strip invalid chars (Google Ads only allows alphanumeric, spaces, hyphens, periods, apostrophes)
    keyword = keyword.replace(/[|!@#$%^&*()+=\[\]{}<>:;",?\/\\~`]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!keyword || keyword.length < 2) {
      console.warn(`[GOOGLE SKIP] Negative keyword "${afterValue.negative_keyword || change.entity_name}" is invalid after sanitization`);
      throw new Error(`Invalid negative keyword text after sanitization: "${keyword}". Original: "${afterValue.negative_keyword || change.entity_name}"`);
    }
    
    // Reject keywords that are too long (likely malformed AI output)
    const wordCount = keyword.split(/\s+/).length;
    if (wordCount > 10) {
      throw new Error(`Negative keyword "${keyword}" is too long (${wordCount} words). Likely a malformed AI output.`);
    }
    
    const matchType = ((afterValue.match_type as string) || 'EXACT').toUpperCase();
    
    // Campaign-level negatives via campaign criteria
    if (entityType === 'campaign') {
      const mutateRes = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignCriteria:mutate`, {
        method: 'POST', headers,
        body: JSON.stringify({
          operations: [{
            create: {
              campaign: entityId,
              negative: true,
              keyword: { text: String(keyword), matchType: matchType },
            }
          }]
        }),
      });
      if (!mutateRes.ok) throw new Error(`Add negative keyword failed: ${await mutateRes.text()}`);
      console.log(`[GOOGLE ✓] Negative keyword "${keyword}" added to campaign ${change.entity_name}`);
      return { executed: true };
    }
    
    console.warn(`[GOOGLE SKIP] add_negative_keyword on ${entityType} not supported — only campaign-level negatives`);
    throw new Error(`add_negative_keyword only supports campaign-level entities. Got: "${entityType}" for "${change.entity_name}"`);
  }

  // ═══ CHANGE MATCH TYPE — advisory only, no API call ═══
  if (changeType === 'change_match_type') {
    const newMatchType = ((afterValue.match_type as string) || '').toUpperCase();
    console.log(`[GOOGLE ADVISORY] Match type change to ${newMatchType} for "${change.entity_name}" — requires manual action in Google Ads UI.`);
    return { executed: false, advisory: `Match type change to ${newMatchType} flagged for manual review` };
  }

  // Everything else: flag types are advisory (no API call)
  if (changeType.startsWith('flag_')) {
    console.log(`[GOOGLE ADVISORY] ${changeType} for "${change.entity_name}" — advisory only, no API call`);
    return { executed: false, advisory: `${changeType} is advisory only` };
  }

  // Unknown change type — do NOT mark as executed
  throw new Error(`Unsupported change type: "${changeType}" on entity type "${entityType}". No API call was made.`);
}

// ─── Meta Marketing API ───────────────────────────────────────────────────────

const META_API_BASE = 'https://graph.facebook.com/v19.0';

function metaAccessToken(): string {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) throw new Error('META_ACCESS_TOKEN secret is not configured');
  return token;
}

async function applyMetaChange(change: Record<string, unknown>, metaAccountId: string | null): Promise<{ executed: boolean; advisory?: string }> {
  const accessToken = metaAccessToken();
  const changeType = change.change_type as string;
  const entityId = change.entity_id as string;

  if (!entityId) throw new Error(`No entity ID on Meta change for "${change.entity_name}"`);

  console.log(`[META EXEC] ${changeType} on "${change.entity_name}" → ${entityId}`);

  // ═══ BID ADJUSTMENT — the only mutation we allow for Meta ═══
  if (changeType === 'adjust_bid') {
    const afterValue = change.after_value as Record<string, unknown>;
    // STRICT bid extraction: only bid or cpc_bid — NO .value fallback
    const rawBid = afterValue.bid ?? afterValue.cpc_bid;
    if (rawBid === undefined || rawBid === null) {
      throw new Error(`No bid value found in after_value for Meta. Expected "bid" or "cpc_bid" key. Got keys: ${JSON.stringify(Object.keys(afterValue))}`);
    }
    const numericBid = typeof rawBid === 'string' ? parseFloat(String(rawBid).replace(/[$,]/g, '')) : Number(rawBid);
    if (isNaN(numericBid) || numericBid <= 0) throw new Error(`Invalid bid value: ${JSON.stringify(rawBid)}`);
    
    const bidAmountCents = Math.round(numericBid * 100).toString();
    const params = new URLSearchParams({ bid_amount: bidAmountCents, access_token: accessToken });
    const res = await fetch(`${META_API_BASE}/${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!res.ok) throw new Error(`Meta bid update failed [${res.status}]: ${await res.text()}`);
    console.log(`[META ✓] Bid adjusted for ${change.entity_name}`);
    return { executed: true };
  }

  // ═══ ADD NEGATIVE KEYWORD — Meta does NOT support this ═══
  if (changeType === 'add_negative_keyword') {
    throw new Error(`Meta Ads does not support negative keywords via API. Change type "add_negative_keyword" is only valid for Google Ads.`);
  }

  // ═══ CHANGE MATCH TYPE — advisory only ═══
  if (changeType === 'change_match_type') {
    console.log(`[META ADVISORY] Match type change for "${change.entity_name}" — advisory only`);
    return { executed: false, advisory: 'Match type change is advisory only' };
  }

  // Flag types are advisory
  if (changeType.startsWith('flag_')) {
    console.log(`[META ADVISORY] ${changeType} for "${change.entity_name}" — advisory only, no API call`);
    return { executed: false, advisory: `${changeType} is advisory only` };
  }

  // Unknown — do NOT mark as executed
  throw new Error(`Unsupported Meta change type: "${changeType}". No API call was made.`);
}

// ─── Account ID Resolution (from session or mappings only) ────────────────────

async function resolveAccountId(
  supabase: any,
  change: Record<string, unknown>,
  sessionId: string | null
): Promise<string | null> {
  // Try extracting from entity_id resource name
  const entityId = change.entity_id as string | null;
  if (entityId) {
    const extracted = extractCustomerId(entityId);
    if (extracted) return extracted;
    if (/^\d+$/.test(entityId)) return entityId;
  }

  // Try session
  if (sessionId) {
    const { data: session } = await supabase
      .from('ppc_optimization_sessions')
      .select('account_id')
      .eq('id', sessionId)
      .single();
    if (session?.account_id) return session.account_id;
  }

  // Try client_account_mappings
  const clientName = change.client_name as string;
  const platform = (change.platform as string)?.toLowerCase();
  if (clientName) {
    const platformFilter = platform === 'google' ? 'google_ads' : 'meta_ads';
    const { data: mappings } = await supabase
      .from('client_account_mappings')
      .select('account_id')
      .eq('client_name', clientName)
      .eq('platform', platformFilter)
      .limit(1);
    if (mappings && mappings.length > 0) return mappings[0].account_id;
  }

  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { changeIds, sessionId, autoMode } = await req.json();

    if (!changeIds || !Array.isArray(changeIds) || changeIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No change IDs provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: changes, error: fetchErr } = await supabase
      .from('ppc_proposed_changes')
      .select('*')
      .in('id', changeIds)
      .in('approval_status', ['approved', 'auto_approved']);

    if (fetchErr) throw fetchErr;
    if (!changes || changes.length === 0) {
      return new Response(JSON.stringify({ error: 'No approved changes found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PPC-EXECUTE] Processing ${changes.length} approved changes for session ${sessionId}`);

    // Pre-fetch Google access token once if any Google changes exist
    const googleChanges = changes.filter(c => c.platform?.toLowerCase() === 'google');
    let googleAccessToken: string | null = null;
    if (googleChanges.length > 0) {
      googleAccessToken = await getGoogleAccessToken();
      console.log('[PPC-EXECUTE] Google access token obtained');
    }

    const results: { id: string; success: boolean; platform: string; entity_name: string; change_type: string; error?: string; advisory?: string }[] = [];

    for (const change of changes) {
      const platform = (change.platform as string)?.toLowerCase();
      const entityName = change.entity_name || 'Unknown';
      const changeType = change.change_type || 'unknown';

      // ═══ LAYER 1: HARD BLOCKLIST — physically impossible to execute forbidden types ═══
      if (BLOCKED_CHANGE_TYPES.has(changeType)) {
        const blockMsg = `[BLOCKED] Change type "${changeType}" is permanently forbidden. This change will NOT be executed.`;
        console.warn(`[PPC-EXECUTE] ${blockMsg} (entity: "${entityName}")`);
        
        await supabase
          .from('ppc_proposed_changes')
          .update({ execution_error: blockMsg })
          .eq('id', change.id);
        
        results.push({ id: change.id, success: false, platform, entity_name: entityName, change_type: changeType, error: blockMsg });
        continue;
      }

      // ═══ LAYER 2: Block any after_value containing budget keys ═══
      const afterValue = change.after_value as Record<string, unknown> || {};
      const budgetKeys = ['daily_budget', 'budget', 'lifetime_budget', 'campaign_budget'];
      const hasBudgetKey = Object.keys(afterValue).some(k => budgetKeys.includes(k.toLowerCase()));
      if (hasBudgetKey) {
        const blockMsg = `[BLOCKED] after_value contains budget-related keys. Budget mutations are permanently forbidden.`;
        console.warn(`[PPC-EXECUTE] ${blockMsg} (entity: "${entityName}", keys: ${Object.keys(afterValue).join(', ')})`);
        
        await supabase
          .from('ppc_proposed_changes')
          .update({ execution_error: blockMsg })
          .eq('id', change.id);
        
        results.push({ id: change.id, success: false, platform, entity_name: entityName, change_type: changeType, error: blockMsg });
        continue;
      }

      // ═══ LAYER 3: Advisory types — mark as executed (informational) without API call ═══
      if (ADVISORY_CHANGE_TYPES.has(changeType) || changeType.startsWith('flag_')) {
        const advisoryMsg = `Advisory: "${changeType}" for "${entityName}" — no API call needed, flagged for manual review.`;
        console.log(`[PPC-EXECUTE] ${advisoryMsg}`);
        
        await supabase
          .from('ppc_proposed_changes')
          .update({ executed_at: new Date().toISOString(), execution_error: null })
          .eq('id', change.id);
        
        results.push({ id: change.id, success: true, platform, entity_name: entityName, change_type: changeType, advisory: advisoryMsg });
        continue;
      }

      try {
        const accountId = await resolveAccountId(supabase, change, sessionId);
        if (!accountId) {
          throw new Error(`Could not resolve account ID for client "${change.client_name}" on platform "${platform}".`);
        }

        console.log(`[PPC-EXECUTE] Change ${change.id}: ${changeType} on "${entityName}" (account: ${accountId})`);

        let result: { executed: boolean; advisory?: string };

        if (platform === 'google' && googleAccessToken) {
          const customerId = accountId.replace(/-/g, '');
          result = await applyGoogleAdsChange(change, googleAccessToken, customerId);
        } else if (platform === 'meta') {
          result = await applyMetaChange(change, accountId);
        } else {
          console.log(`[SIMULATION] Platform not live: ${change.platform} — ${changeType}`);
          result = { executed: false, advisory: 'Platform not configured for live execution' };
        }

        if (result.executed) {
          await supabase
            .from('ppc_proposed_changes')
            .update({ executed_at: new Date().toISOString(), execution_error: null })
            .eq('id', change.id);
          results.push({ id: change.id, success: true, platform, entity_name: entityName, change_type: changeType });
        } else {
          // Advisory result from platform handler — mark as executed (informational)
          await supabase
            .from('ppc_proposed_changes')
            .update({ executed_at: new Date().toISOString(), execution_error: null })
            .eq('id', change.id);
          results.push({ id: change.id, success: true, platform, entity_name: entityName, change_type: changeType, advisory: result.advisory });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[PPC-EXECUTE FAIL] Change ${change.id} ("${entityName}" ${changeType}):`, errMsg);

        await supabase
          .from('ppc_proposed_changes')
          .update({ execution_error: errMsg })
          .eq('id', change.id);

        results.push({ id: change.id, success: false, platform, entity_name: entityName, change_type: changeType, error: errMsg });
      }
    }

    // Only update session status if NOT called from auto mode
    if (sessionId && !autoMode) {
      const anySucceeded = results.some(r => r.success);
      await supabase
        .from('ppc_optimization_sessions')
        .update({ status: anySucceeded ? 'executed' : 'partially_approved' })
        .eq('id', sessionId);
    }

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const blocked = results.filter(r => r.error?.startsWith('[BLOCKED]'));
    const advisory = results.filter(r => r.advisory);

    console.log(`[PPC-EXECUTE SUMMARY] ${succeeded.length} succeeded (${advisory.length} advisory), ${failed.length} failed (${blocked.length} blocked by safety layer)`);

    return new Response(JSON.stringify({
      success: true,
      results,
      executed: succeeded.length,
      failed: failed.length,
      blocked: blocked.length,
      advisory: advisory.length,
      note: `${succeeded.length} applied (${advisory.length} advisory), ${blocked.length} blocked by safety rules, ${failed.length - blocked.length} errors`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ppc-execute error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

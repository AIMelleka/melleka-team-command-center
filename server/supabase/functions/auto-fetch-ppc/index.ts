import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_ADS_API_VERSION = 'v23';

/** Get a secret from team_secrets table */
async function getSecret(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_secrets')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

/** Refresh Google OAuth2 access token */
async function refreshGoogleToken(supabase: any): Promise<string | null> {
  const clientId = await getSecret(supabase, 'GOOGLE_CLIENT_ID');
  const clientSecret = await getSecret(supabase, 'GOOGLE_CLIENT_SECRET');
  const refreshToken = await getSecret(supabase, 'GOOGLE_ADS_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[AUTO-FETCH-PPC] Missing Google OAuth credentials');
    return null;
  }
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    const data = await resp.json();
    if (!data.access_token) {
      console.error('[AUTO-FETCH-PPC] Google token refresh failed:', data.error);
      return null;
    }
    return data.access_token;
  } catch (err) {
    console.error('[AUTO-FETCH-PPC] Google token refresh error:', err);
    return null;
  }
}

/** Pull Google Ads data directly via API */
async function fetchGoogleAdsDirect(
  supabase: any,
  accountIds: string[],
  dateStart: string,
  dateEnd: string,
): Promise<{ spend: number; clicks: number; impressions: number; conversions: number }> {
  const accessToken = await refreshGoogleToken(supabase);
  if (!accessToken) return { spend: 0, clicks: 0, impressions: 0, conversions: 0 };

  const developerToken = await getSecret(supabase, 'GOOGLE_ADS_DEVELOPER_TOKEN');
  const loginCustomerId = await getSecret(supabase, 'GOOGLE_ADS_LOGIN_CUSTOMER_ID');
  if (!developerToken) {
    console.error('[AUTO-FETCH-PPC] Missing GOOGLE_ADS_DEVELOPER_TOKEN');
    return { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
  }

  let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalConversions = 0;

  for (const accountId of accountIds) {
    const customerId = accountId.replace(/-/g, '');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');

    const query = `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'`;

    try {
      const resp = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
        { method: 'POST', headers, body: JSON.stringify({ query }) },
      );
      const data = await resp.json();
      if (!resp.ok) {
        console.error(`[AUTO-FETCH-PPC] Google Ads API error for ${customerId}:`, JSON.stringify(data).slice(0, 500));
        continue;
      }
      for (const row of (data.results || [])) {
        const m = row.metrics || {};
        totalSpend += (parseInt(m.costMicros || '0', 10) / 1_000_000);
        totalClicks += parseInt(m.clicks || '0', 10);
        totalImpressions += parseInt(m.impressions || '0', 10);
        totalConversions += parseFloat(m.conversions || '0');
      }
      console.log(`[AUTO-FETCH-PPC] Google Ads direct success for ${customerId}: spend=$${totalSpend.toFixed(2)}`);
    } catch (err) {
      console.error(`[AUTO-FETCH-PPC] Google Ads fetch error for ${customerId}:`, err);
    }
  }

  return { spend: totalSpend, clicks: totalClicks, impressions: totalImpressions, conversions: totalConversions };
}

/** Pull Meta Ads data directly via Graph API */
async function fetchMetaAdsDirect(
  supabase: any,
  accountIds: string[],
  dateStart: string,
  dateEnd: string,
): Promise<{ spend: number; clicks: number; impressions: number; conversions: number }> {
  // Token resolution: env var → team_secrets → oauth_connections
  let token = Deno.env.get('META_ACCESS_TOKEN') ?? null;
  if (!token) {
    const secretToken = await getSecret(supabase, 'META_ACCESS_TOKEN');
    if (secretToken) token = secretToken;
  }
  if (!token) {
    const { data: oauthRow } = await supabase
      .from('oauth_connections')
      .select('access_token, token_expires_at')
      .eq('provider', 'meta_ads')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (oauthRow?.token_expires_at && new Date(oauthRow.token_expires_at) < new Date()) {
      console.error('[AUTO-FETCH-PPC] Meta token expired');
      return { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    }
    token = oauthRow?.access_token ?? null;
  }
  if (!token) {
    console.error('[AUTO-FETCH-PPC] No Meta access token available');
    return { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
  }

  let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalConversions = 0;
  const META_API_VERSION = 'v21.0';

  for (const accountId of accountIds) {
    const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    try {
      const params = new URLSearchParams({
        access_token: token,
        fields: 'spend,clicks,impressions,actions',
        time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
        level: 'account',
      });
      const resp = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${actId}/insights?${params}`);
      const data = await resp.json();
      if (!resp.ok) {
        console.error(`[AUTO-FETCH-PPC] Meta API error for ${actId}:`, JSON.stringify(data).slice(0, 500));
        continue;
      }
      for (const row of (data.data || [])) {
        totalSpend += parseFloat(row.spend || '0');
        totalClicks += parseInt(row.clicks || '0', 10);
        totalImpressions += parseInt(row.impressions || '0', 10);
        // Count conversions from actions
        if (row.actions) {
          for (const action of row.actions) {
            if (['lead', 'offsite_conversion.fb_pixel_lead', 'offsite_conversion.fb_pixel_purchase',
                 'onsite_conversion.lead_grouped', 'complete_registration'].includes(action.action_type)) {
              totalConversions += parseInt(action.value || '0', 10);
            }
          }
        }
      }
      console.log(`[AUTO-FETCH-PPC] Meta Ads direct success for ${actId}: spend=$${totalSpend.toFixed(2)}`);
    } catch (err) {
      console.error(`[AUTO-FETCH-PPC] Meta Ads fetch error for ${actId}:`, err);
    }
  }

  return { spend: totalSpend, clicks: totalClicks, impressions: totalImpressions, conversions: totalConversions };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('[AUTO-FETCH-PPC] Starting daily PPC snapshot collection...');

    // 1. Get all active clients with account mappings
    const { data: clients } = await supabase
      .from('managed_clients')
      .select('client_name')
      .eq('is_active', true);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active clients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: mappings } = await supabase
      .from('client_account_mappings')
      .select('client_name, platform, account_id');

    if (!mappings || mappings.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No account mappings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build mappingsByClient: { clientName: { platform: [accountIds] } }
    const mappingsByClient: Record<string, Record<string, string[]>> = {};
    for (const m of mappings) {
      if (!mappingsByClient[m.client_name]) mappingsByClient[m.client_name] = {};
      if (!mappingsByClient[m.client_name][m.platform]) mappingsByClient[m.client_name][m.platform] = [];
      mappingsByClient[m.client_name][m.platform].push(m.account_id);
    }

    // Filter to only active clients with mappings
    const activeClientNames = new Set(clients.map((c: any) => c.client_name));
    const bulkClients: Record<string, Record<string, string[]>> = {};
    for (const [name, platforms] of Object.entries(mappingsByClient)) {
      if (activeClientNames.has(name)) {
        bulkClients[name] = platforms;
      }
    }

    if (Object.keys(bulkClients).length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No clients with mappings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Use today's date range (last 1 day for daily snapshot)
    const today = new Date();
    const dateEnd = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStart = yesterday.toISOString().split('T')[0];

    console.log(`[AUTO-FETCH-PPC] Fetching for ${Object.keys(bulkClients).length} clients, ${dateStart} to ${dateEnd}`);

    // 3. Try Supermetrics first, fall back to direct APIs if it fails
    let smData: any = null;
    let usedDirectAPIs = false;

    const { data: smResult, error: smError } = await supabase.functions.invoke('fetch-supermetrics', {
      body: { action: 'fetch-data-bulk', bulkClients, dateStart, dateEnd },
    });

    if (smError || !smResult?.success) {
      console.warn('[AUTO-FETCH-PPC] Supermetrics bulk fetch failed (likely quota exceeded), falling back to direct APIs...');
      usedDirectAPIs = true;
    } else {
      smData = smResult;
    }

    // 4. Build snapshot rows
    const snapshotDate = dateEnd;
    const rows: any[] = [];

    if (usedDirectAPIs) {
      // Direct API fallback: query Google Ads and Meta Ads directly per client
      for (const [clientName, platforms] of Object.entries(bulkClients)) {
        // Google Ads
        const googleIds = platforms.google_ads || [];
        if (googleIds.length > 0) {
          const gData = await fetchGoogleAdsDirect(supabase, googleIds, dateStart, dateEnd);
          if (gData.spend > 0 || gData.clicks > 0 || gData.impressions > 0) {
            rows.push({
              client_name: clientName,
              platform: 'google',
              snapshot_date: snapshotDate,
              spend: gData.spend,
              conversions: gData.conversions,
              clicks: gData.clicks,
              impressions: gData.impressions,
              calls: 0,
              leads: 0,
              purchases: 0,
              cost_per_conversion: gData.conversions > 0 ? gData.spend / gData.conversions : 0,
            });
          }
        }

        // Meta Ads
        const metaIds = platforms.meta_ads || [];
        if (metaIds.length > 0) {
          const mData = await fetchMetaAdsDirect(supabase, metaIds, dateStart, dateEnd);
          if (mData.spend > 0 || mData.clicks > 0 || mData.impressions > 0) {
            rows.push({
              client_name: clientName,
              platform: 'meta',
              snapshot_date: snapshotDate,
              spend: mData.spend,
              conversions: mData.conversions,
              clicks: mData.clicks,
              impressions: mData.impressions,
              calls: 0,
              leads: 0,
              purchases: 0,
              cost_per_conversion: mData.conversions > 0 ? mData.spend / mData.conversions : 0,
            });
          }
        }

        // Add small delay between clients to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      // Supermetrics succeeded — use its data
      for (const [clientName, platforms] of Object.entries(smData.clients || {})) {
        for (const [dsKey, metrics] of Object.entries(platforms as Record<string, any>)) {
          if (metrics.spend === 0 && metrics.conv === 0 && metrics.error) continue;

          // Normalize platform key
          const k = dsKey.toLowerCase();
          let canonical = 'other';
          if (k.includes('google') || k.includes('aw') || k.includes('adwords')) canonical = 'google';
          else if (k.includes('meta') || k.includes('fa') || k.includes('facebook') || k.includes('ig')) canonical = 'meta';
          else if (k.includes('tiktok') || k.includes('tik')) canonical = 'tiktok';
          else if (k.includes('bing') || k.includes('ac') || k.includes('microsoft')) canonical = 'bing';
          else if (k.includes('linkedin') || k.includes('lia')) canonical = 'linkedin';

          const metricLeads = metrics.leads || 0;
          const metricPurchases = metrics.purchases || 0;
          const metricCalls = metrics.calls || 0;

          // Check if we already have a row for this client+platform (merge)
          const existing = rows.find((r: any) => r.client_name === clientName && r.platform === canonical);
          if (existing) {
            existing.spend += metrics.spend || 0;
            existing.conversions += metrics.conv || 0;
            existing.calls += metricCalls;
            existing.leads += metricLeads;
            existing.purchases += metricPurchases;
            existing.cost_per_conversion = existing.conversions > 0 ? existing.spend / existing.conversions : 0;
          } else {
            rows.push({
              client_name: clientName,
              platform: canonical,
              snapshot_date: snapshotDate,
              spend: metrics.spend || 0,
              conversions: metrics.conv || 0,
              calls: metricCalls,
              leads: metricLeads,
              purchases: metricPurchases,
              cost_per_conversion: metrics.conv > 0 ? (metrics.spend || 0) / metrics.conv : 0,
              clicks: 0,
              impressions: 0,
            });
          }
        }
      }
    }

    console.log(`[AUTO-FETCH-PPC] Prepared ${rows.length} snapshot rows for ${snapshotDate} (source: ${usedDirectAPIs ? 'direct APIs' : 'Supermetrics'})`);

    // 5. Upsert into ppc_daily_snapshots (ON CONFLICT update)
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('ppc_daily_snapshots')
        .upsert(rows, { onConflict: 'client_name,platform,snapshot_date' });

      if (upsertError) {
        console.error('[AUTO-FETCH-PPC] Upsert error:', upsertError);
        return new Response(JSON.stringify({ success: false, error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[AUTO-FETCH-PPC] Done. Stored ${rows.length} snapshots for ${snapshotDate}`);

    return new Response(JSON.stringify({
      success: true,
      date: snapshotDate,
      clientCount: Object.keys(bulkClients).length,
      snapshotCount: rows.length,
      source: usedDirectAPIs ? 'direct_apis' : 'supermetrics',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[AUTO-FETCH-PPC] Error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

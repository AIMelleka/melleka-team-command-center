import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Build bulkClients map: { clientName: { dsKey: [accountIds] } }
    const mappingsByClient: Record<string, Record<string, string[]>> = {};
    for (const m of mappings) {
      if (!mappingsByClient[m.client_name]) mappingsByClient[m.client_name] = {};
      if (!mappingsByClient[m.client_name][m.platform]) mappingsByClient[m.client_name][m.platform] = [];
      mappingsByClient[m.client_name][m.platform].push(m.account_id);
    }

    // Filter to only active clients with mappings
    const activeClientNames = new Set(clients.map(c => c.client_name));
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
    // Fetch last 1 day of data
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStart = yesterday.toISOString().split('T')[0];

    console.log(`[AUTO-FETCH-PPC] Fetching for ${Object.keys(bulkClients).length} clients, ${dateStart} to ${dateEnd}`);

    // 3. Call fetch-supermetrics bulk endpoint
    const { data: smData, error: smError } = await supabase.functions.invoke('fetch-supermetrics', {
      body: { action: 'fetch-data-bulk', bulkClients, dateStart, dateEnd },
    });

    if (smError || !smData?.success) {
      console.error('[AUTO-FETCH-PPC] Bulk fetch failed:', smError || smData);
      return new Response(JSON.stringify({ success: false, error: 'Bulk fetch failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Normalize platform keys and build snapshot rows
    const snapshotDate = dateEnd;
    const rows: any[] = [];

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

        // Use leads/purchases/calls from bulk response (already broken down by fetch-supermetrics)
        const metricLeads = metrics.leads || 0;
        const metricPurchases = metrics.purchases || 0;
        const metricCalls = metrics.calls || 0;

        // Check if we already have a row for this client+platform (merge)
        const existing = rows.find(r => r.client_name === clientName && r.platform === canonical);
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

    console.log(`[AUTO-FETCH-PPC] Prepared ${rows.length} snapshot rows for ${snapshotDate}`);

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

    console.log(`[AUTO-FETCH-PPC] ✅ Stored ${rows.length} snapshots for ${snapshotDate}`);

    return new Response(JSON.stringify({
      success: true,
      date: snapshotDate,
      clientCount: Object.keys(smData.clients || {}).length,
      snapshotCount: rows.length,
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

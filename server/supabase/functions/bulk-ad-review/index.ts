import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret if provided (reject wrong secrets, allow missing for manual triggers)
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && expectedSecret && cronSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'Invalid cron secret' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log: string[] = [];
  const push = (msg: string) => { console.log(msg); log.push(msg); };

  // Parse body for optional single-client mode
  let body: any = {};
  try { body = await req.json(); } catch {}
  const singleClient = body?.clientName as string | undefined;

  // --- MODE 1: Single client (synchronous, for frontend per-client calls) ---
  if (singleClient) {
    push(`[BULK-AD-REVIEW] Single-client mode: ${singleClient}`);
    try {
      const result = await processOneClient(supabase, supabaseUrl, serviceKey, singleClient, push);
      return new Response(
        JSON.stringify({ ok: result.ok, clientName: singleClient, message: result.message, log }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (e: any) {
      return new Response(
        JSON.stringify({ ok: false, clientName: singleClient, message: e.message, log }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // --- MODE 2: List clients only (for frontend to know who to process) ---
  if (body?.action === 'list-clients') {
    try {
      const { data: activeClients } = await supabase
        .from('managed_clients')
        .select('client_name')
        .eq('is_active', true);
      const activeNames = (activeClients || []).map((c: any) => c.client_name);
      const { data: mappings } = await supabase
        .from('client_account_mappings')
        .select('client_name')
        .in('client_name', activeNames);
      const clientsWithAccounts = [...new Set((mappings || []).map((m: any) => m.client_name))];
      return new Response(
        JSON.stringify({ ok: true, clients: clientsWithAccounts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (e: any) {
      return new Response(
        JSON.stringify({ ok: false, error: e.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // --- MODE 3: Bulk (original cron mode, background) ---
  push(`[BULK-AD-REVIEW] Bulk mode starting...`);

  const promise = (async () => {
    try {
      const { data: activeClients } = await supabase
        .from('managed_clients')
        .select('client_name')
        .eq('is_active', true);

      if (!activeClients?.length) {
        push('[BULK-AD-REVIEW] No active clients found.');
        return;
      }

      const activeNames = activeClients.map((c: any) => c.client_name);
      const { data: allMappings } = await supabase
        .from('client_account_mappings')
        .select('client_name')
        .in('client_name', activeNames);

      const clientNames = [...new Set((allMappings || []).map((m: any) => m.client_name))];
      push(`[BULK-AD-REVIEW] Processing ${clientNames.length} clients...`);

      let completed = 0, failed = 0;
      for (const name of clientNames) {
        try {
          const result = await processOneClient(supabase, supabaseUrl, serviceKey, name, push);
          if (result.ok) completed++; else failed++;
        } catch { failed++; }
        await new Promise(r => setTimeout(r, 2000));
      }
      push(`[BULK-AD-REVIEW] Done. ${completed} ok, ${failed} failed.`);
    } catch (e: any) {
      push(`[BULK-AD-REVIEW] Fatal: ${e.message}`);
    }
  })();

  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
    (globalThis as any).EdgeRuntime.waitUntil(promise);
  } else {
    await promise;
  }

  return new Response(
    JSON.stringify({ ok: true, message: 'Bulk ad review started in background', log: log.slice(0, 5) }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

// Process a single client: fetch data, run AI analysis, store report
async function processOneClient(
  supabase: any, supabaseUrl: string, serviceKey: string, clientName: string,
  push: (msg: string) => void,
): Promise<{ ok: boolean; message: string }> {

  // Get account mappings
  const { data: mappings } = await supabase
    .from('client_account_mappings')
    .select('platform, account_id, account_name')
    .eq('client_name', clientName);

  if (!mappings?.length) return { ok: false, message: 'No account mappings' };

  const accounts: Record<string, string[]> = {};
  for (const m of mappings) {
    if (!accounts[m.platform]) accounts[m.platform] = [];
    accounts[m.platform].push(m.account_id);
  }
  const activeSources = Object.keys(accounts);

  // Get client info
  const { data: mcData } = await supabase
    .from('managed_clients')
    .select('industry, domain')
    .eq('client_name', clientName)
    .single();
  const industry = mcData?.industry || null;

  // Date range: last 14 days
  const today = new Date();
  const dateEnd = today.toISOString().split('T')[0];
  const dateStart = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0];

  // Fetch Supermetrics data
  push(`[BULK-AD-REVIEW] Fetching data for ${clientName}...`);
  const smRes = await fetch(`${supabaseUrl}/functions/v1/fetch-supermetrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: 'fetch-data', dataSources: activeSources, accounts, dateStart, dateEnd }),
  });
  const smData = await smRes.json();

  // Build context string
  let supermetricsContext = '';
  if (smData?.success && smData?.platforms) {
    supermetricsContext = `=== SUPERMETRICS LIVE AD DATA ===\nDate Range: ${dateStart} to ${dateEnd}\n\n`;
    for (const [platform, platformData] of Object.entries(smData.platforms as Record<string, any>)) {
      const pd = platformData as any;
      const s = pd.summary || {};
      supermetricsContext += `## ${pd.label || platform}\nAccount: ${pd.accountName || 'N/A'}\n`;
      if (s.spend > 0) supermetricsContext += `Spend: $${s.spend?.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
      if (s.impressions > 0) supermetricsContext += `Impressions: ${s.impressions?.toLocaleString()}\n`;
      if (s.clicks > 0) supermetricsContext += `Clicks: ${s.clicks?.toLocaleString()}\n`;
      if (s.conversions > 0) supermetricsContext += `Conversions: ${s.conversions?.toLocaleString()}\n`;
      if (s.calls > 0) supermetricsContext += `Calls: ${s.calls?.toLocaleString()}\n`;
      if (s.ctr > 0) supermetricsContext += `CTR: ${(s.ctr * 100).toFixed(2)}%\n`;
      if (s.cpc > 0) supermetricsContext += `CPC: $${s.cpc?.toFixed(2)}\n`;
      if (s.cpa > 0) supermetricsContext += `CPA: $${s.cpa?.toFixed(2)}\n`;
      if (pd.campaigns?.length > 0) {
        supermetricsContext += `\nTop Campaigns:\n`;
        for (const c of pd.campaigns.slice(0, 10)) {
          supermetricsContext += `  - ${c.name}: $${c.spend?.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend, ${c.conversions} conv, CPA $${c.cpa?.toFixed(2)}\n`;
        }
      }
      if (pd.creatives?.length > 0) {
        supermetricsContext += `\nTop Creatives:\n`;
        for (const cr of pd.creatives.slice(0, 10)) {
          supermetricsContext += `  - ${cr.name || cr.adName}: ${cr.impressions || 0} imp, ${cr.clicks || 0} clicks, $${cr.spend?.toFixed(2) || '0'} spend\n`;
        }
      }
      if (pd.keywords?.length > 0) {
        supermetricsContext += `\nTop Keywords:\n`;
        for (const kw of pd.keywords.slice(0, 15)) {
          supermetricsContext += `  - ${kw.keyword || kw.name}: ${kw.impressions || 0} imp, ${kw.clicks || 0} clicks, ${kw.conversions || 0} conv\n`;
        }
      }
      if (pd.daily?.length > 0) {
        supermetricsContext += `\nDaily Trend (last 7 days):\n`;
        for (const d of pd.daily.slice(-7)) {
          supermetricsContext += `  ${d.date}: $${d.spend?.toFixed(0) || '0'} spend, ${d.clicks || 0} clicks, ${d.conversions || 0} conv\n`;
        }
      }
      supermetricsContext += '\n';
    }
  }

  // Load previous reviews
  const { data: prevReviews } = await supabase
    .from('ad_review_history')
    .select('*')
    .eq('client_name', clientName)
    .order('review_date', { ascending: false })
    .limit(3);

  const previousReview = prevReviews?.[0] || null;
  const historicalContext = (prevReviews || []).slice(0, 3).map((r: any) => ({
    date: r.review_date, summary: r.summary, recommendations: r.recommendations, insights: r.insights,
  }));

  // Run AI analysis
  push(`[BULK-AD-REVIEW] Running AI analysis for ${clientName}...`);
  const reviewRes = await fetch(`${supabaseUrl}/functions/v1/ad-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({
      type: 'sheets', clientName,
      dateRange: { start: dateStart, end: dateEnd },
      sheetsData: supermetricsContext,
      previousReview: previousReview || undefined,
      benchmarkData: industry ? { industry } : undefined,
    }),
  });

  const reviewText = await reviewRes.text();
  let reviewData: any;
  try { reviewData = JSON.parse(reviewText); } catch {
    return { ok: false, message: 'Failed to parse AI response' };
  }

  if (!reviewRes.ok || !reviewData?.analysis) {
    return { ok: false, message: `AI review failed (${reviewRes.status})` };
  }

  // Store report
  const analysis = reviewData.analysis;
  const { error: insertError } = await supabase.from('ad_review_history').insert({
    client_name: clientName,
    review_date: dateEnd,
    date_range_start: dateStart,
    date_range_end: dateEnd,
    summary: analysis.summary || '',
    platforms: analysis.platforms || [],
    insights: analysis.insights || [],
    recommendations: analysis.recommendations || [],
    week_over_week: analysis.weekOverWeek || [],
    benchmark_comparison: analysis.benchmarkAnalysis || {},
    action_items: analysis.actionItems || analysis.action_items || [],
    seo_data: {
      supermetricsRaw: supermetricsContext.substring(0, 10000),
      historicalReviews: historicalContext,
      fullAnalysis: analysis,
    },
    industry,
    previous_review_id: previousReview?.id || null,
  });

  if (insertError) return { ok: false, message: `DB insert failed: ${insertError.message}` };

  push(`[BULK-AD-REVIEW] ✅ ${clientName} complete`);
  return { ok: true, message: 'Report generated' };
}

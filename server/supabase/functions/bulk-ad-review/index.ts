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

// ── Verified Platform Builder ─────────────────────────────────────────────────
// PPC platforms that Supermetrics can fetch. Non-PPC mappings (GHL, facebook_page,
// instagram_account, ga4, klaviyo) are excluded from scoring entirely.
const PPC_PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  bing_ads: 'Microsoft Ads',
  linkedin_ads: 'LinkedIn Ads',
  tiktok_ads: 'TikTok Ads',
};

// Compute trend by comparing first vs second half of the daily data period.
function computeTrendFromDaily(dailyData: any[]): 'up' | 'down' | 'stable' {
  if (!dailyData || dailyData.length < 4) return 'stable';
  const mid = Math.floor(dailyData.length / 2);
  const first = dailyData.slice(0, mid);
  const second = dailyData.slice(mid);
  const metric = (d: any): number => (d.leads || 0) + (d.purchases || 0) || (d.conversions || 0);
  const avgFirst = first.reduce((s: number, d: any) => s + metric(d), 0) / first.length;
  const avgSecond = second.reduce((s: number, d: any) => s + metric(d), 0) / second.length;
  const spendFirst = first.reduce((s: number, d: any) => s + (d.spend || 0), 0) / first.length;
  const spendSecond = second.reduce((s: number, d: any) => s + (d.spend || 0), 0) / second.length;
  const baseline = avgFirst > 0 ? avgFirst : spendFirst;
  const current = avgFirst > 0 ? avgSecond : spendSecond;
  if (baseline <= 0) return 'stable';
  const ratio = current / baseline;
  if (ratio >= 1.10) return 'up';
  if (ratio <= 0.90) return 'down';
  return 'stable';
}

// Build a platforms array with exact numbers from Supermetrics structured data.
// These bypass AI interpretation — numbers are API-accurate.
function buildVerifiedPlatforms(smPlatforms: Record<string, any>): any[] {
  const result: any[] = [];
  for (const [key, pd] of Object.entries(smPlatforms)) {
    const label = PPC_PLATFORM_LABELS[key];
    if (!label) continue;
    const s: Record<string, number> = (pd as any).summary || {};
    if (!s._cost || s._cost <= 0) continue;

    const spend = s._cost;
    const impressions = s._impressions || 0;
    const clicks = s._clicks || 0;
    const leads = s._leads || 0;
    const purchases = s._purchases || 0;
    const conversions = s._conversions || 0;
    const cpl = s._cpl > 0 ? s._cpl : (leads > 0 ? spend / leads : 0);
    const cpa = s._cpa > 0 ? s._cpa : (conversions > 0 ? spend / conversions : 0);
    const costPerPurchase = s._costPerPurchase > 0 ? s._costPerPurchase : (purchases > 0 ? spend / purchases : 0);
    const trend = computeTrendFromDaily((pd as any).dailyData || []);

    const entry: Record<string, any> = {
      name: label,
      spend: `$${spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      impressions: impressions.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      clicks: clicks.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      conversions: conversions.toFixed(0),
      trend,
    };
    if (leads > 0) entry.leads = leads.toFixed(0);
    if (purchases > 0) entry.purchases = purchases.toFixed(0);
    if (s._cpc > 0) entry.cpc = `$${s._cpc.toFixed(2)}`;
    else if (clicks > 0) entry.cpc = `$${(spend / clicks).toFixed(2)}`;
    if (s._ctr > 0) entry.ctr = `${s._ctr.toFixed(2)}%`;
    else if (impressions > 0) entry.ctr = `${((clicks / impressions) * 100).toFixed(2)}%`;
    if (s._cpm > 0) entry.cpm = `$${s._cpm.toFixed(2)}`;
    if (cpl > 0) entry.costPerLead = `$${cpl.toFixed(2)}`;
    if (cpa > 0) entry.costPerConversion = `$${cpa.toFixed(2)}`;
    if (costPerPurchase > 0) entry.costPerPurchase = `$${costPerPurchase.toFixed(2)}`;
    if (s._conversion_rate > 0) entry.conversionRate = `${s._conversion_rate.toFixed(2)}%`;
    result.push(entry);
  }
  return result;
}

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

  // Get client info + goals
  const { data: mcData } = await supabase
    .from('managed_clients')
    .select('industry, domain, target_cpa, target_cpl, target_roas, monthly_budget, monthly_lead_target, monthly_conversion_target, client_notes, report_focus, targeting_context, primary_conversion_goal, secondary_conversion_goal, secondary_target_cpa, secondary_target_cpl, secondary_monthly_target, tertiary_conversion_goal, tertiary_target_cpa, tertiary_target_cpl, tertiary_monthly_target, platform_settings')
    .eq('client_name', clientName)
    .single();
  const industry = mcData?.industry || null;

  // Build clientGoals object — only populate if at least one field is set
  const clientGoals = (mcData && (
    mcData.target_cpa || mcData.target_cpl || mcData.target_roas ||
    mcData.monthly_budget || mcData.monthly_lead_target || mcData.monthly_conversion_target ||
    mcData.client_notes || mcData.report_focus || mcData.targeting_context || mcData.primary_conversion_goal ||
    mcData.secondary_conversion_goal || mcData.tertiary_conversion_goal || mcData.platform_settings
  )) ? {
    target_cpa: mcData.target_cpa ?? null,
    target_cpl: mcData.target_cpl ?? null,
    target_roas: mcData.target_roas ?? null,
    monthly_budget: mcData.monthly_budget ?? null,
    monthly_lead_target: mcData.monthly_lead_target ?? null,
    monthly_conversion_target: mcData.monthly_conversion_target ?? null,
    client_notes: mcData.client_notes ?? null,
    report_focus: mcData.report_focus ?? null,
    targeting_context: mcData.targeting_context ?? null,
    primary_conversion_goal: mcData.primary_conversion_goal ?? null,
    secondary_conversion_goal: mcData.secondary_conversion_goal ?? null,
    secondary_target_cpa: mcData.secondary_target_cpa ?? null,
    secondary_target_cpl: mcData.secondary_target_cpl ?? null,
    secondary_monthly_target: mcData.secondary_monthly_target ?? null,
    tertiary_conversion_goal: mcData.tertiary_conversion_goal ?? null,
    tertiary_target_cpa: mcData.tertiary_target_cpa ?? null,
    tertiary_target_cpl: mcData.tertiary_target_cpl ?? null,
    tertiary_monthly_target: mcData.tertiary_monthly_target ?? null,
    platform_settings: mcData.platform_settings ?? null,
  } : undefined;

  // Verified platform metrics built directly from Supermetrics structured data
  let verifiedPlatforms: any[] = [];

  // Date range: last 14 days
  const today = new Date();
  const dateEnd = today.toISOString().split('T')[0];
  const dateStart = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0];

  // Fetch Supermetrics data (with graceful fallback)
  push(`[BULK-AD-REVIEW] Fetching data for ${clientName}...`);
  let supermetricsContext = '';
  try {
    const smRes = await fetch(`${supabaseUrl}/functions/v1/fetch-supermetrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ action: 'fetch-data', dataSources: activeSources, accounts, dateStart, dateEnd }),
    });
    const smData = await smRes.json();

    if (smData?.success && smData?.platforms) {
      supermetricsContext = `=== SUPERMETRICS LIVE AD DATA ===\nDate Range: ${dateStart} to ${dateEnd}\n\n`;
      for (const [platform, platformData] of Object.entries(smData.platforms as Record<string, any>)) {
        const pd = platformData as any;
        const s = pd.summary || {};
        supermetricsContext += `## ${pd.label || platform}\nAccount: ${pd.accountName || 'N/A'}\n`;
        // Summary keys use underscore prefix (_cost, _impressions, etc.) from fetch-supermetrics buildSummary
        if (s._cost > 0) supermetricsContext += `Spend: $${s._cost?.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
        if (s._impressions > 0) supermetricsContext += `Impressions: ${s._impressions?.toLocaleString()}\n`;
        if (s._clicks > 0) supermetricsContext += `Clicks: ${s._clicks?.toLocaleString()}\n`;
        if (s._conversions > 0) supermetricsContext += `Conversions: ${s._conversions?.toLocaleString()}\n`;
        if (s._leads > 0) supermetricsContext += `Leads: ${s._leads?.toLocaleString()}\n`;
        if (s._purchases > 0) supermetricsContext += `Purchases: ${s._purchases?.toLocaleString()}\n`;
        if (s._phoneCalls > 0) supermetricsContext += `Calls: ${s._phoneCalls?.toLocaleString()}\n`;
        if (s._ctr > 0) supermetricsContext += `CTR: ${s._ctr?.toFixed(2)}%\n`;
        if (s._cpc > 0) supermetricsContext += `CPC: $${s._cpc?.toFixed(2)}\n`;
        if (s._cpa > 0) supermetricsContext += `CPA: $${s._cpa?.toFixed(2)}\n`;
        if (s._cpl > 0) supermetricsContext += `CPL: $${s._cpl?.toFixed(2)}\n`;
        if (s._costPerPurchase > 0) supermetricsContext += `Cost Per Purchase: $${s._costPerPurchase?.toFixed(2)}\n`;
        if (pd.campaigns?.length > 0) {
          supermetricsContext += `\nTop Campaigns:\n`;
          for (const c of pd.campaigns.slice(0, 10)) {
            const leadsPart = c.leads > 0 ? `, ${c.leads} leads` : '';
            const purchasesPart = c.purchases > 0 ? `, ${c.purchases} purchases` : '';
            supermetricsContext += `  - ${c.name}: $${c.spend?.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend, ${c.conversions} conv${leadsPart}${purchasesPart}, CPA $${c.cpa?.toFixed(2)}\n`;
          }
        }
        if (pd.topContent?.length > 0) {
          supermetricsContext += `\nTop Creatives:\n`;
          for (const cr of pd.topContent.slice(0, 10)) {
            supermetricsContext += `  - ${cr.adName || cr.name}: ${cr.impressions || 0} imp, ${cr.clicks || 0} clicks, $${cr.cost?.toFixed(2) || '0'} spend\n`;
          }
        }
        if (pd.keywords?.length > 0) {
          supermetricsContext += `\nTop Keywords:\n`;
          for (const kw of pd.keywords.slice(0, 15)) {
            const kwCpa = kw.cpa > 0 ? `, CPA $${kw.cpa?.toFixed(2)}` : '';
            supermetricsContext += `  - ${kw.keyword || kw.name}: ${kw.impressions || 0} imp, ${kw.clicks || 0} clicks, ${kw.conversions || 0} conv${kwCpa}\n`;
          }
        }
        if (pd.dailyData?.length > 0) {
          supermetricsContext += `\nDaily Trend (last 7 days):\n`;
          for (const d of pd.dailyData.slice(-7)) {
            const dailyLeads = d.leads > 0 ? `, ${d.leads} leads` : '';
            supermetricsContext += `  ${d.date}: $${d.spend?.toFixed(0) || '0'} spend, ${d.clicks || 0} clicks, ${d.conversions || 0} conv${dailyLeads}\n`;
          }
        }
        supermetricsContext += '\n';
      }
      // Build verified platform metrics directly from Supermetrics structured data (API-accurate)
      verifiedPlatforms = buildVerifiedPlatforms(smData.platforms as Record<string, any>);
      if (verifiedPlatforms.length > 0) {
        push(`[BULK-AD-REVIEW] Verified metrics: ${verifiedPlatforms.map((p: any) => p.name).join(', ')}`);
      }
    }
  } catch (e) {
    console.warn(`[BULK-AD-REVIEW] Supermetrics failed for ${clientName} (likely quota exceeded), using DB snapshots as fallback`);
  }

  // Fallback: build context from ppc_daily_snapshots if Supermetrics returned nothing useful
  // Supermetrics may return success with platform headers but zero actual metrics (quota exceeded)
  const hasActualMetrics = supermetricsContext.includes('Spend:') || supermetricsContext.includes('Impressions:') || supermetricsContext.includes('Clicks:');
  if (!supermetricsContext || !hasActualMetrics) {
    const { data: snapshots } = await supabase
      .from('ppc_daily_snapshots')
      .select('*')
      .eq('client_name', clientName)
      .gte('snapshot_date', dateStart)
      .order('snapshot_date', { ascending: false })
      .limit(14);

    if (snapshots && snapshots.length > 0) {
      supermetricsContext = `=== AD DATA FROM DAILY SNAPSHOTS (Supermetrics unavailable) ===\nDate Range: ${dateStart} to ${dateEnd}\n\n`;
      for (const s of snapshots) {
        supermetricsContext += `${s.snapshot_date} | ${s.platform}: $${s.spend?.toFixed(2)} spend, ${s.clicks || 0} clicks, ${s.conversions || 0} conv, ${s.impressions || 0} imp\n`;
      }
    } else {
      push(`[BULK-AD-REVIEW] No data available for ${clientName} — skipping`);
      return { ok: false, message: 'No ad data available (Supermetrics quota exceeded, no snapshots)' };
    }
  }

  // Load previous reviews — skip if using snapshot fallback to avoid carrying forward
  // stale "data blackout" narratives from when Supermetrics was down
  const usingSnapshotFallback = supermetricsContext.includes('DAILY SNAPSHOTS');
  let previousReview: any = null;
  let historicalContext: any[] = [];

  if (!usingSnapshotFallback) {
    const { data: prevReviews } = await supabase
      .from('ad_review_history')
      .select('*')
      .eq('client_name', clientName)
      .order('review_date', { ascending: false })
      .limit(3);

    previousReview = prevReviews?.[0] || null;
    historicalContext = (prevReviews || []).slice(0, 3).map((r: any) => ({
      date: r.review_date, summary: r.summary, recommendations: r.recommendations, insights: r.insights,
    }));
  }

  // Run AI analysis
  push(`[BULK-AD-REVIEW] Running AI analysis for ${clientName}...`);
  const reviewRes = await fetch(`${supabaseUrl}/functions/v1/ad-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({
      type: 'sheets', clientName,
      dateRange: { start: dateStart, end: dateEnd },
      sheetsData: supermetricsContext,
      verifiedPlatformMetrics: verifiedPlatforms.length > 0 ? verifiedPlatforms : undefined,
      previousReview: previousReview || undefined,
      benchmarkData: industry ? { industry } : undefined,
      clientGoals: clientGoals || undefined,
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

  // Override AI-extracted platform metrics with verified Supermetrics data.
  // Fix: run regardless of whether analysis.platforms is null (was skipped before).
  const analysis = reviewData.analysis;
  if (verifiedPlatforms.length > 0) {
    const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '');
    const aiMap = new Map<string, any>(
      ((analysis.platforms || []) as any[]).map((p: any) => [normalize(p.name || ''), p])
    );
    // Preserve AI qualitative assessments; override all numeric metrics with Supermetrics data
    const AI_QUALITATIVE = ['health', 'vsBenchmark', 'cplVsBenchmark', 'cpaVsBenchmark', 'qualityScore'];
    analysis.platforms = verifiedPlatforms.map((vp: any) => {
      const aiP = aiMap.get(normalize(vp.name)) || {};
      const qualitative: Record<string, any> = {};
      for (const field of AI_QUALITATIVE) {
        if (aiP[field] !== undefined) qualitative[field] = aiP[field];
      }
      return { ...qualitative, ...vp };
    });
    push(`[BULK-AD-REVIEW] Applied verified Supermetrics metrics to ${verifiedPlatforms.length} platform(s)`);
  }
  const { error: insertError } = await supabase.from('ad_review_history').insert({
    client_name: clientName,
    review_date: dateEnd,
    date_range_start: dateStart,
    date_range_end: dateEnd,
    summary: analysis.summary || '',
    platforms: analysis.platforms || [],
    // Store verified Supermetrics data separately — scoring uses this exclusively
    verified_platforms: verifiedPlatforms,
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

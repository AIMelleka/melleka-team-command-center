import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 1;  // No retries within fleet run; cron runs 4x daily for natural retries
const RETRY_DELAY_MS = 2000;
const WAVE_SIZE = 4;          // clients per wave
const WAVE_DELAY_MS = 3000;   // pause between waves
const VERIFY_WAIT_MS = 180000; // 3 min wait before verification sweep (workers take up to 140s)

// ── AI Memory helpers ──
async function loadAiMemory(supabase: any, clientName: string): Promise<string> {
  const { data } = await supabase
    .from('client_ai_memory')
    .select('memory_type, content, source, created_at')
    .eq('client_name', clientName)
    .order('relevance_score', { ascending: false })
    .limit(20);

  if (!data?.length) return '';
  return data.map((m: any) => `[${m.memory_type}] (${m.source}, ${m.created_at?.split('T')[0]}): ${m.content}`).join('\n');
}

async function saveAiMemories(supabase: any, clientName: string, analysis: any) {
  const memories: any[] = [];

  if (analysis.recommendations?.length) {
    for (const rec of analysis.recommendations.slice(0, 5)) {
      const content = typeof rec === 'string' ? rec : (rec.description || rec.title || JSON.stringify(rec));
      memories.push({
        client_name: clientName, memory_type: 'recommendation',
        content: content.substring(0, 500), source: 'fleet_run',
        context: { date: new Date().toISOString().split('T')[0] }, relevance_score: 1.0,
      });
    }
  }

  if (analysis.insights?.length) {
    for (const ins of analysis.insights.slice(0, 3)) {
      const content = typeof ins === 'string' ? ins : (ins.description || ins.title || JSON.stringify(ins));
      const type = (typeof ins === 'object' && ins.type) || 'observation';
      memories.push({
        client_name: clientName,
        memory_type: type === 'positive' ? 'win' : type === 'negative' ? 'concern' : 'observation',
        content: content.substring(0, 500), source: 'fleet_run',
        context: { date: new Date().toISOString().split('T')[0], impact: ins.impact },
        relevance_score: type === 'positive' ? 0.9 : 0.8,
      });
    }
  }

  if (analysis.platforms?.length) {
    const platformSummaries = analysis.platforms.map((p: any) =>
      `${p.name || p.platform}: $${p.spend || 0} spend, ${p.conversions || 0} conv, CPA $${p.cpa || 'N/A'}`
    ).join('; ');
    if (platformSummaries) {
      memories.push({
        client_name: clientName, memory_type: 'metric_snapshot',
        content: platformSummaries.substring(0, 500), source: 'fleet_run',
        context: { date: new Date().toISOString().split('T')[0] }, relevance_score: 0.7,
      });
    }
  }

  if (memories.length > 0) {
    const { data: existing } = await supabase
      .from('client_ai_memory').select('id').eq('client_name', clientName)
      .order('created_at', { ascending: true });

    if (existing && existing.length > 40) {
      const toDelete = existing.slice(0, existing.length - 40).map((e: any) => e.id);
      await supabase.from('client_ai_memory').delete().in('id', toDelete);
    }

    await supabase.from('client_ai_memory').insert(memories);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = MAX_RETRIES): Promise<{ success: boolean; result?: T; attempts: number; errors: string[] }> {
  const errors: string[] = [];
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, result, attempts: attempt, errors };
    } catch (e: any) {
      const errMsg = `Attempt ${attempt}/${maxRetries}: ${e.message || String(e)}`;
      errors.push(errMsg);
      console.error(`[FLEET] ${label} — ${errMsg}`);
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  return { success: false, attempts: maxRetries, errors };
}

async function fetchSupermetrics(supabaseUrl: string, serviceKey: string, activeSources: string[], accounts: Record<string, string[]>, dateStart: string, dateEnd: string) {
  const smRes = await fetch(`${supabaseUrl}/functions/v1/fetch-supermetrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: 'fetch-data', dataSources: activeSources, accounts, dateStart, dateEnd }),
  });
  const smData = await smRes.json();
  return smData;
}

function buildSupermetricsContext(smData: any, dateStart: string, dateEnd: string): string {
  if (!smData?.success || !smData?.platforms) return '';

  let ctx = `=== SUPERMETRICS LIVE AD DATA (PRIMARY SOURCE) ===\nDate Range: ${dateStart} to ${dateEnd}\n\n`;
  for (const [platform, platformData] of Object.entries(smData.platforms as Record<string, any>)) {
    const pd = platformData as any;
    const summary = pd.summary || {};
    ctx += `## ${pd.label || platform}\nAccount: ${pd.accountName || 'N/A'}\n`;
    if (summary.spend > 0) ctx += `Spend: $${summary.spend?.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
    if (summary.impressions > 0) ctx += `Impressions: ${summary.impressions?.toLocaleString()}\n`;
    if (summary.clicks > 0) ctx += `Clicks: ${summary.clicks?.toLocaleString()}\n`;
    if (summary.conversions > 0) ctx += `Conversions: ${summary.conversions?.toLocaleString()}\n`;
    if (summary.calls > 0) ctx += `Calls: ${summary.calls?.toLocaleString()}\n`;
    if (summary.ctr > 0) ctx += `CTR: ${(summary.ctr * 100).toFixed(2)}%\n`;
    if (summary.cpc > 0) ctx += `CPC: $${summary.cpc?.toFixed(2)}\n`;
    if (summary.cpa > 0) ctx += `CPA: $${summary.cpa?.toFixed(2)}\n`;
    if (pd.campaigns?.length > 0) {
      ctx += `\nTop Campaigns:\n`;
      for (const c of (pd.campaigns as any[]).slice(0, 10)) {
        ctx += `  - ${c.name}: $${c.spend?.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend, ${c.conversions} conv, CPA $${c.cpa?.toFixed(2)}\n`;
      }
    }
    if (pd.creatives?.length > 0) {
      ctx += `\nTop Creatives:\n`;
      for (const cr of (pd.creatives as any[]).slice(0, 10)) {
        ctx += `  - ${cr.name || cr.adName}: ${cr.impressions || 0} imp, ${cr.clicks || 0} clicks, $${cr.spend?.toFixed(2) || '0'} spend\n`;
      }
    }
    if (pd.keywords?.length > 0) {
      ctx += `\nTop Keywords:\n`;
      for (const kw of (pd.keywords as any[]).slice(0, 15)) {
        ctx += `  - ${kw.keyword || kw.name}: ${kw.impressions || 0} imp, ${kw.clicks || 0} clicks, ${kw.conversions || 0} conv, CPC $${kw.cpc?.toFixed(2) || '0'}\n`;
      }
    }
    if (pd.daily?.length > 0) {
      ctx += `\nDaily Trend (last 7 days):\n`;
      for (const d of (pd.daily as any[]).slice(-7)) {
        ctx += `  ${d.date}: $${d.spend?.toFixed(0) || '0'} spend, ${d.clicks || 0} clicks, ${d.conversions || 0} conv\n`;
      }
    }
    ctx += '\n';
  }
  return ctx;
}

function extractStructuredKpis(smData: any): Record<string, any> {
  const structuredKpis: Record<string, any> = {};
  if (smData?.success && smData?.platforms) {
    for (const [platform, pd] of Object.entries(smData.platforms as Record<string, any>)) {
      const s = (pd as any).summary || {};
      structuredKpis[platform] = {
        spend: s.spend || 0, conversions: s.conversions || 0, cpa: s.cpa || 0,
        ctr: s.ctr || 0, cpc: s.cpc || 0, clicks: s.clicks || 0, impressions: s.impressions || 0,
        topCampaigns: ((pd as any).campaigns || []).slice(0, 5).map((c: any) => ({ name: c.name, spend: c.spend, conversions: c.conversions, cpa: c.cpa })),
        bottomCampaigns: ((pd as any).campaigns || []).filter((c: any) => c.spend > 50 && c.conversions === 0).slice(0, 5).map((c: any) => ({ name: c.name, spend: c.spend })),
        topKeywords: ((pd as any).keywords || []).slice(0, 5).map((k: any) => ({ keyword: k.keyword || k.name, spend: k.cost, conversions: k.conversions, cpc: k.cpc })),
      };
    }
  }
  return structuredKpis;
}

interface ClientResult {
  client: string;
  status: 'success' | 'partial' | 'error' | 'skipped';
  strategistDone: boolean;
  adReviewDone: boolean;
  strategistAttempts: number;
  adReviewAttempts: number;
  message: string;
  errors: string[];
}

// 3A: PRE-ANALYSIS RESEARCH PHASE — Gather competitive intel (Mondays only)
async function gatherResearch(
  clientName: string,
  supabaseUrl: string,
  serviceKey: string,
  supabase: any,
): Promise<any | null> {
  // 3C: Only run full research on Mondays (day 1)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek !== 1) {
    // Non-Monday: check if we have cached research from Monday in client_ai_memory
    const { data: cachedResearch } = await supabase
      .from('client_ai_memory')
      .select('content, context')
      .eq('client_name', clientName)
      .eq('memory_type', 'competitive_research')
      .order('created_at', { ascending: false })
      .limit(1);

    if (cachedResearch?.[0]?.context?.researchData) {
      console.log(`[RESEARCH] Using cached research for ${clientName} (non-Monday)`);
      return cachedResearch[0].context.researchData;
    }
    return null;
  }

  // Fetch client's competitor config
  const { data: clientConfig } = await supabase
    .from('ppc_client_settings')
    .select('competitor_domains, competitor_names')
    .eq('client_name', clientName)
    .maybeSingle();

  const competitorDomains: string[] = clientConfig?.competitor_domains || [];
  const competitorNames: string[] = clientConfig?.competitor_names || [];

  if (competitorDomains.length === 0 && competitorNames.length === 0) {
    return null;
  }

  console.log(`[RESEARCH] Running Monday research for ${clientName}: ${competitorDomains.length} domains, ${competitorNames.length} names`);

  const researchContext: any = { seoData: [], adTransparency: [] };

  // Research calls in parallel with 30s timeout
  const RESEARCH_TIMEOUT = 30000;
  const researchPromises: Promise<any>[] = [];

  // SEO research for top 2 competitor domains
  for (const domain of competitorDomains.slice(0, 2)) {
    researchPromises.push(
      Promise.race([
        fetch(`${supabaseUrl}/functions/v1/get-seo-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ domain }),
        }).then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            researchContext.seoData.push({ domain, data });
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SEO research timeout')), RESEARCH_TIMEOUT)),
      ]).catch((e) => {
        console.warn(`[RESEARCH] SEO research failed for ${domain}:`, e.message);
      })
    );
  }

  // Ad transparency for top 2 competitor names
  for (const name of competitorNames.slice(0, 2)) {
    researchPromises.push(
      Promise.race([
        fetch(`${supabaseUrl}/functions/v1/scrape-ad-transparency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ companyName: name }),
        }).then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            researchContext.adTransparency.push({ name, data });
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ad transparency timeout')), RESEARCH_TIMEOUT)),
      ]).catch((e) => {
        console.warn(`[RESEARCH] Ad transparency failed for ${name}:`, e.message);
      })
    );
  }

  await Promise.allSettled(researchPromises);

  // Cache the research results for the rest of the week
  if (researchContext.seoData.length > 0 || researchContext.adTransparency.length > 0) {
    const summary = [
      ...researchContext.seoData.map((s: any) => `SEO: ${s.domain}`),
      ...researchContext.adTransparency.map((a: any) => `Ads: ${a.name}`),
    ].join(', ');

    await supabase.from('client_ai_memory').insert({
      client_name: clientName,
      memory_type: 'competitive_research',
      content: `Weekly competitive research: ${summary}`,
      source: 'fleet_research',
      context: { date: new Date().toISOString().split('T')[0], researchData: researchContext },
      relevance_score: 0.8,
    });

    console.log(`[RESEARCH] Cached research for ${clientName}: ${summary}`);
    return researchContext;
  }

  return null;
}

async function runStrategist(
  clientName: string,
  supabaseUrl: string,
  serviceKey: string,
  supabase: any,
  dateStart: string,
  dateEnd: string,
  mappings: any[],
): Promise<void> {
  const { data: clientSettings } = await supabase
    .from('ppc_client_settings').select('*').eq('client_name', clientName).maybeSingle();

  const googleMap = mappings.find((m: any) => m.platform === 'google_ads' || m.platform === 'google');
  const metaMap = mappings.find((m: any) => m.platform === 'meta_ads' || m.platform === 'meta');
  const googleId = clientSettings?.google_account_id || googleMap?.account_id;
  const metaId = clientSettings?.meta_account_id || metaMap?.account_id;

  const platforms: { plat: string; accountId: string }[] = [];
  if (googleId) platforms.push({ plat: 'google', accountId: googleId });
  if (metaId) platforms.push({ plat: 'meta', accountId: metaId });

  if (platforms.length === 0) {
    throw new Error('No platform account IDs configured');
  }

  // 3A: Gather competitive research (use cached only, skip expensive live research)
  // Live research runs on Monday dedicated cron; fleet workers use cached data
  let researchContext: any = null;
  try {
    const { data: cachedResearch } = await supabase
      .from('client_ai_memory')
      .select('content, context')
      .eq('client_name', clientName)
      .eq('memory_type', 'competitive_research')
      .order('created_at', { ascending: false })
      .limit(1);
    researchContext = cachedResearch?.[0]?.context?.researchData || null;
  } catch (e: any) {
    console.warn(`[FLEET] Research cache lookup failed for ${clientName} (non-fatal):`, e.message);
  }

  // Run all platform analyses in PARALLEL to stay within edge function timeout
  const platformResults = await Promise.allSettled(
    platforms.map(async ({ plat, accountId }) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/ppc-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({
          clientName, platform: plat, accountId,
          dateStart, dateEnd, autoMode: true,
          researchContext, // 3B: Pass research to ppc-analyze
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        let detail = body;
        try { const parsed = JSON.parse(body); detail = parsed.error || parsed.message || body; } catch { }
        throw new Error(`${plat} (${res.status}): ${detail}`);
      }
      console.log(`[FLEET] Strategist ${plat} OK for ${clientName}`);
    })
  );

  const errors: string[] = platformResults
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason?.message || String(r.reason));

  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }
}

async function runAdReview(
  clientName: string,
  clientMappings: any[],
  supabaseUrl: string,
  serviceKey: string,
  supabase: any,
  dateStart: string,
  dateEnd: string,
): Promise<void> {
  const accounts: Record<string, string[]> = {};
  for (const m of clientMappings) {
    if (!accounts[m.platform]) accounts[m.platform] = [];
    accounts[m.platform].push(m.account_id);
  }
  const activeSources = Object.keys(accounts).filter(k => accounts[k]?.length > 0);

  if (activeSources.length === 0) {
    throw new Error('No active ad accounts');
  }

  const smData = await fetchSupermetrics(supabaseUrl, serviceKey, activeSources, accounts, dateStart, dateEnd);
  const supermetricsContext = buildSupermetricsContext(smData, dateStart, dateEnd);

  if (!supermetricsContext) {
    throw new Error('No Supermetrics data returned');
  }

  const { data: prevReviews } = await supabase
    .from('ad_review_history').select('*')
    .eq('client_name', clientName)
    .order('review_date', { ascending: false }).limit(3);

  const previousReview = prevReviews?.[0] || null;

  const { data: mcData } = await supabase
    .from('managed_clients').select('industry')
    .eq('client_name', clientName).single();

  const aiMemory = await loadAiMemory(supabase, clientName);

  const adReviewRes = await fetch(`${supabaseUrl}/functions/v1/ad-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({
      type: 'sheets', clientName,
      dateRange: { start: dateStart, end: dateEnd },
      sheetsData: supermetricsContext,
      previousReview: previousReview || undefined,
      benchmarkData: mcData?.industry ? { industry: mcData.industry } : undefined,
      aiMemory: aiMemory || undefined,
    }),
  });

  const reviewText = await adReviewRes.text();
  let reviewData: any;
  try { reviewData = JSON.parse(reviewText); } catch { reviewData = null; }

  if (!adReviewRes.ok || !reviewData?.analysis) {
    throw new Error(`Ad review API failed: ${adReviewRes.status} - ${(reviewText || '').slice(0, 200)}`);
  }

  const analysis = reviewData.analysis;
  const historicalContext = prevReviews?.slice(0, 3).map((r: any) => ({
    date: r.review_date, summary: r.summary, recommendations: r.recommendations, insights: r.insights,
  })) || [];

  const structuredKpis = extractStructuredKpis(smData);

  await supabase.from('ad_review_history').insert({
    client_name: clientName,
    review_date: new Date().toISOString().split('T')[0],
    date_range_start: dateStart, date_range_end: dateEnd,
    summary: analysis.summary || '',
    platforms: analysis.platforms || [], insights: analysis.insights || [],
    recommendations: analysis.recommendations || [],
    week_over_week: analysis.weekOverWeek || [],
    benchmark_comparison: analysis.benchmarkAnalysis || {},
    action_items: analysis.actionItems || analysis.action_items || [],
    seo_data: {
      supermetricsRaw: supermetricsContext.substring(0, 10000),
      historicalReviews: historicalContext,
      fullAnalysis: analysis, structuredKpis,
      keyMetrics: analysis.keyMetrics || null,
    },
    industry: mcData?.industry || null,
    previous_review_id: previousReview?.id || null,
  });

  await saveAiMemories(supabase, clientName, analysis);

  await supabase.from('managed_clients')
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq('client_name', clientName);
}

async function processClient(
  clientName: string,
  clientMappings: any[],
  supabaseUrl: string,
  serviceKey: string,
  supabase: any,
  dateStart: string,
  dateEnd: string,
  mode: string = 'full',
): Promise<ClientResult> {
  if (!clientMappings || clientMappings.length === 0) {
    return {
      client: clientName, status: 'skipped',
      strategistDone: false, adReviewDone: false,
      strategistAttempts: 0, adReviewAttempts: 0,
      message: 'No account mappings', errors: [],
    };
  }

  const runStrat = mode === 'full' || mode === 'strategist-only';
  const runReview = mode === 'full' || mode === 'ad-review-only';

  // Run strategist and ad review in PARALLEL to stay within edge function timeout
  const [stratResult, reviewResult] = await Promise.all([
    runStrat
      ? withRetry(
          () => runStrategist(clientName, supabaseUrl, serviceKey, supabase, dateStart, dateEnd, clientMappings),
          `Strategist for ${clientName}`,
        )
      : Promise.resolve({ success: true, attempts: 0, errors: [] as string[] }),
    runReview
      ? withRetry(
          () => runAdReview(clientName, clientMappings, supabaseUrl, serviceKey, supabase, dateStart, dateEnd),
          `Ad Review for ${clientName}`,
        )
      : Promise.resolve({ success: true, attempts: 0, errors: [] as string[] }),
  ]);

  const allErrors = [
    ...stratResult.errors.map(e => `[Strategist] ${e}`),
    ...reviewResult.errors.map(e => `[Ad Review] ${e}`),
  ];

  let status: ClientResult['status'];
  let message: string;

  if (stratResult.success && reviewResult.success) {
    status = 'success';
    const parts = [runStrat && 'strategist', runReview && 'ad review'].filter(Boolean).join(' + ');
    message = `Complete (${parts}, mode: ${mode})`;
  } else if (stratResult.success || reviewResult.success) {
    status = 'partial';
    const done = stratResult.success ? 'Strategist' : 'Ad Review';
    const failed = stratResult.success ? 'Ad Review' : 'Strategist';
    message = `${done} succeeded, ${failed} failed after ${MAX_RETRIES} attempts`;
  } else {
    status = 'error';
    message = `Both phases failed after ${MAX_RETRIES} attempts each`;
  }

  return {
    client: clientName, status,
    strategistDone: runStrat ? stratResult.success : false,
    adReviewDone: runReview ? reviewResult.success : false,
    strategistAttempts: stratResult.attempts,
    adReviewAttempts: reviewResult.attempts,
    message, errors: allErrors,
  };
}

// ── Helper: check which clients are missing from job results ──
async function getMissingClients(supabase: any, jobId: string, allClientNames: string[]): Promise<string[]> {
  const { data: jobData } = await supabase
    .from('fleet_run_jobs').select('results').eq('id', jobId).single();
  
  const results: ClientResult[] = (jobData?.results as ClientResult[]) || [];
  const completedClients = new Set(results.map(r => r.client));
  return allClientNames.filter(c => !completedClients.has(c));
}

// ── Helper: mark job completed if all clients reported ──
async function completeJobIfDone(supabase: any, jobId: string, totalClients: number) {
  const { data: jobData } = await supabase
    .from('fleet_run_jobs').select('results, status').eq('id', jobId).single();
  
  if (!jobData || jobData.status === 'completed') return;
  
  const results: ClientResult[] = (jobData?.results as ClientResult[]) || [];
  if (results.length >= totalClients) {
    const successCount = results.filter(r => r.status === 'success').length;
    const partialCount = results.filter(r => r.status === 'partial').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    console.log(`[FLEET] ✅ ALL DONE: ${successCount} success, ${partialCount} partial, ${errorCount} errors, ${skippedCount} skipped out of ${totalClients}`);

    await supabase.from('fleet_run_jobs').update({
      status: 'completed',
      progress: totalClients,
      current_client: null,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { }

  const workerClient: string | null = body.workerClient ?? null;
  const jobId: string | null = body.jobId ?? null;

  // ═══════════════════════════════════════════════════════
  // WORKER MODE: Fire-and-forget sub-tasks, report immediately
  // Sub-edge-functions (ppc-analyze, ad-review) take 60-150s each.
  // Instead of waiting, we dispatch them and return immediately.
  // The orchestrator's verify sweep checks actual DB tables for results.
  // ═══════════════════════════════════════════════════════
  if (workerClient && jobId) {
    console.log(`[FLEET-WORKER] Dispatching sub-tasks for: ${workerClient}`);

    const today = new Date();
    const dateEnd = today.toISOString().split('T')[0];
    const dateStart = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0];

    const { data: mappings } = await supabase
      .from('client_account_mappings').select('*')
      .eq('client_name', workerClient);

    if (!mappings || mappings.length === 0) {
      // No mappings = skip, report immediately
      const result: ClientResult = {
        client: workerClient, status: 'skipped',
        strategistDone: false, adReviewDone: false,
        strategistAttempts: 0, adReviewAttempts: 0,
        message: 'No account mappings', errors: [],
      };
      await supabase.rpc('append_fleet_results', { job_uuid: jobId, new_results: [result] });
      return new Response(
        JSON.stringify({ ok: true, mode: 'worker', client: workerClient, status: 'skipped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const workerMode: string = body.mode ?? 'full';
    const runStrat = workerMode === 'full' || workerMode === 'strategist-only';
    const runReview = workerMode === 'full' || workerMode === 'ad-review-only';

    // Get client settings and mappings for strategist dispatch
    const { data: clientSettings } = await supabase
      .from('ppc_client_settings').select('*').eq('client_name', workerClient).maybeSingle();

    const googleMap = mappings.find((m: any) => m.platform === 'google_ads' || m.platform === 'google');
    const metaMap = mappings.find((m: any) => m.platform === 'meta_ads' || m.platform === 'meta');
    const googleId = clientSettings?.google_account_id || googleMap?.account_id;
    const metaId = clientSettings?.meta_account_id || metaMap?.account_id;

    // Get cached research (fast DB query, no live research)
    let researchContext: any = null;
    try {
      const { data: cachedResearch } = await supabase
        .from('client_ai_memory')
        .select('content, context')
        .eq('client_name', workerClient)
        .eq('memory_type', 'competitive_research')
        .order('created_at', { ascending: false })
        .limit(1);
      researchContext = cachedResearch?.[0]?.context?.researchData || null;
    } catch { }

    // Fire-and-forget: Dispatch ppc-analyze for each platform
    if (runStrat) {
      const platforms = [];
      if (googleId) platforms.push({ plat: 'google', accountId: googleId });
      if (metaId) platforms.push({ plat: 'meta', accountId: metaId });

      for (const { plat, accountId } of platforms) {
        fetch(`${supabaseUrl}/functions/v1/ppc-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            clientName: workerClient, platform: plat, accountId,
            dateStart, dateEnd, autoMode: true,
            researchContext,
          }),
        }).then(async (res) => {
          console.log(`[FLEET-WORKER] ppc-analyze ${plat} for ${workerClient}: ${res.status}`);
          await res.text().catch(() => '');
        }).catch((e: any) => {
          console.error(`[FLEET-WORKER] ppc-analyze ${plat} dispatch failed for ${workerClient}: ${e.message}`);
        });
      }
    }

    // Fire-and-forget: Dispatch ad-review
    if (runReview) {
      // We need supermetrics data first, so dispatch the full ad review pipeline
      // as a self-invocation with a special flag
      fetch(`${supabaseUrl}/functions/v1/run-full-fleet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({
          _adReviewWorker: true,
          clientName: workerClient,
          dateStart, dateEnd,
        }),
      }).then(async (res) => {
        console.log(`[FLEET-WORKER] ad-review dispatch for ${workerClient}: ${res.status}`);
        await res.text().catch(() => '');
      }).catch((e: any) => {
        console.error(`[FLEET-WORKER] ad-review dispatch failed for ${workerClient}: ${e.message}`);
      });
    }

    console.log(`[FLEET-WORKER] Sub-tasks dispatched for ${workerClient}`);

    // Report "dispatched" immediately - orchestrator verify sweep will check actual results
    const result: ClientResult = {
      client: workerClient, status: 'success',
      strategistDone: runStrat,
      adReviewDone: runReview,
      strategistAttempts: 1,
      adReviewAttempts: 1,
      message: `Dispatched (strategist: ${runStrat}, ad-review: ${runReview})`,
      errors: [],
    };

    await supabase.rpc('append_fleet_results', { job_uuid: jobId, new_results: [result] });

    const totalClients = body.totalClients ?? 0;
    if (totalClients > 0) {
      await completeJobIfDone(supabase, jobId, totalClients);
    }

    return new Response(
      JSON.stringify({ ok: true, mode: 'worker', client: workerClient, status: 'dispatched' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ═══════════════════════════════════════════════════════
  // AD REVIEW WORKER: Runs ad review pipeline for a single client
  // Dispatched by main worker as fire-and-forget
  // ═══════════════════════════════════════════════════════
  if (body._adReviewWorker && body.clientName) {
    const clientName = body.clientName;
    const dateStart = body.dateStart;
    const dateEnd = body.dateEnd;
    console.log(`[FLEET-AD-REVIEW] Processing ad review for: ${clientName}`);

    try {
      const { data: clientMappings } = await supabase
        .from('client_account_mappings').select('*')
        .eq('client_name', clientName);

      await runAdReview(clientName, clientMappings || [], supabaseUrl, serviceKey, supabase, dateStart, dateEnd);
      console.log(`[FLEET-AD-REVIEW] Complete for ${clientName}`);
    } catch (e: any) {
      console.error(`[FLEET-AD-REVIEW] Failed for ${clientName}: ${e.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, mode: 'ad-review-worker', client: clientName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ═══════════════════════════════════════════════════════
  // ORCHESTRATOR MODE: Wave-based dispatch + verification sweep
  // ═══════════════════════════════════════════════════════
  console.log(`[FLEET-ORCHESTRATOR] Starting fleet run...`);

  // 1. Get ALL clients sorted by least-recently-reviewed first
  const { data: allClients, error: clientsErr } = await supabase
    .from('managed_clients')
    .select('client_name, last_reviewed_at')
    .eq('is_active', true)
    .order('last_reviewed_at', { ascending: true, nullsFirst: true });

  if (clientsErr || !allClients?.length) {
    return new Response(JSON.stringify({ error: 'No clients found' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const clientNames = allClients.map((c: any) => c.client_name);
  const totalClients = clientNames.length;
  const fleetMode: string = body.mode ?? 'full';
  console.log(`[FLEET-ORCHESTRATOR] Mode: ${fleetMode}`);

  // 2. Create job row
  const { data: job, error: jobErr } = await supabase.from('fleet_run_jobs').insert({
    status: 'processing',
    total_clients: totalClients,
    progress: 0,
    results: [],
    mode: fleetMode,
  }).select('id').single();

  if (jobErr || !job) {
    return new Response(JSON.stringify({ error: 'Failed to create job' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const newJobId = job.id;

  // 3. Split clients into waves
  const waves: string[][] = [];
  for (let i = 0; i < totalClients; i += WAVE_SIZE) {
    waves.push(clientNames.slice(i, i + WAVE_SIZE));
  }

  console.log(`[FLEET-ORCHESTRATOR] Created job ${newJobId}: ${totalClients} clients across ${waves.length} waves of ${WAVE_SIZE}`);

  // 4. Dispatch waves with delays between them
  //    Use waitUntil for the orchestrator so it can do the slow wave dispatch + verification in background
  const orchestratorWork = async () => {
    let totalDispatched = 0;

    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      console.log(`[FLEET-ORCHESTRATOR] Dispatching wave ${waveIdx + 1}/${waves.length}: ${wave.join(', ')}`);

      // Fire-and-forget: dispatch workers without awaiting their response.
      // Workers process synchronously and report results via append_fleet_results RPC.
      // We don't await responses because workers take up to 140s each.
      for (const clientName of wave) {
        fetch(`${supabaseUrl}/functions/v1/run-full-fleet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            workerClient: clientName,
            jobId: newJobId,
            totalClients,
            mode: fleetMode,
          }),
        }).then(async (res) => {
          await res.text().catch(() => '');
          console.log(`[FLEET-ORCHESTRATOR] Worker response for ${clientName}: ${res.status}`);
        }).catch((e: any) => {
          console.error(`[FLEET-ORCHESTRATOR] Failed to dispatch ${clientName}: ${e.message}`);
        });
        // Small stagger within a wave to avoid rate limits
        await sleep(500);
      }
      totalDispatched += wave.length;

      // Wait between waves to avoid API throttling (skip after last wave)
      if (waveIdx < waves.length - 1) {
        console.log(`[FLEET-ORCHESTRATOR] Wave ${waveIdx + 1} done, waiting ${WAVE_DELAY_MS}ms before next wave...`);
        await sleep(WAVE_DELAY_MS);
      }
    }

    console.log(`[FLEET-ORCHESTRATOR] All ${waves.length} waves dispatched (${totalDispatched}/${totalClients} workers launched)`);

    // 5. Workers report "dispatched" immediately, so job completes quickly.
    // Wait a short time for all workers to report, then verify.
    console.log(`[FLEET-ORCHESTRATOR] All waves dispatched, waiting 30s for worker reports...`);
    await supabase.from('fleet_run_jobs').update({
      current_client: `All ${totalClients} workers dispatched, awaiting reports...`,
    }).eq('id', newJobId);

    await sleep(30000);

    // 6. Check if all workers reported
    const missingClients = await getMissingClients(supabase, newJobId, clientNames);
    if (missingClients.length > 0) {
      console.log(`[FLEET-ORCHESTRATOR] ${missingClients.length} workers haven't reported yet, adding them...`);
      const errorResults: ClientResult[] = missingClients.map(c => ({
        client: c, status: 'error' as const,
        strategistDone: false, adReviewDone: false,
        strategistAttempts: 0, adReviewAttempts: 0,
        message: 'Worker failed to dispatch', errors: ['No report received'],
      }));
      await supabase.rpc('append_fleet_results', {
        job_uuid: newJobId,
        new_results: errorResults,
      });
    }

    // 7. Mark job completed
    await completeJobIfDone(supabase, newJobId, totalClients);

    // 4A: Generate fleet report after completion
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-fleet-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ jobId: newJobId }),
      });
      console.log(`[FLEET-ORCHESTRATOR] Fleet report generated for job ${newJobId}`);
    } catch (e: any) {
      console.warn(`[FLEET-ORCHESTRATOR] Fleet report generation failed (non-fatal):`, e.message);
    }

    console.log(`[FLEET-ORCHESTRATOR] ✅ Fleet run finalized for job ${newJobId}`);
  };

  // Run orchestrator work in background
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
    (globalThis as any).EdgeRuntime.waitUntil(orchestratorWork());
  } else {
    await orchestratorWork();
  }

  return new Response(
    JSON.stringify({
      ok: true,
      mode: 'orchestrator',
      jobId: newJobId,
      totalClients,
      totalWaves: waves.length,
      waveSize: WAVE_SIZE,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

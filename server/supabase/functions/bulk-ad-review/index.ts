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

  push(`[BULK-AD-REVIEW] Starting at ${new Date().toISOString()}`);

  // Use waitUntil for long-running background processing
  const controller = new AbortController();

  // Respond immediately so the caller doesn't timeout
  const promise = (async () => {
    try {
      // 1. Get all clients with account mappings
      const { data: allMappings } = await supabase
        .from('client_account_mappings')
        .select('client_name, platform, account_id, account_name');

      if (!allMappings?.length) {
        push('[BULK-AD-REVIEW] No account mappings found, nothing to do.');
        return;
      }

      // Group by client
      const mappingsByClient: Record<string, Record<string, string[]>> = {};
      for (const m of allMappings) {
        if (!mappingsByClient[m.client_name]) mappingsByClient[m.client_name] = {};
        if (!mappingsByClient[m.client_name][m.platform]) mappingsByClient[m.client_name][m.platform] = [];
        mappingsByClient[m.client_name][m.platform].push(m.account_id);
      }

      const clientNames = Object.keys(mappingsByClient);
      push(`[BULK-AD-REVIEW] Found ${clientNames.length} clients with ad accounts`);

      // 2. Get managed client info for industries
      const { data: managedClients } = await supabase
        .from('managed_clients')
        .select('client_name, industry, domain')
        .in('client_name', clientNames);

      const clientInfo: Record<string, { industry?: string; domain?: string }> = {};
      for (const mc of (managedClients || [])) {
        clientInfo[mc.client_name] = { industry: mc.industry || undefined, domain: mc.domain || undefined };
      }

      // Date range: last 14 days
      const today = new Date();
      const dateEnd = today.toISOString().split('T')[0];
      const dateStart = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0];

      let completed = 0;
      let failed = 0;

      for (const clientName of clientNames) {
        push(`\n[BULK-AD-REVIEW] ─── Processing: ${clientName} ───`);

        try {
          const accounts = mappingsByClient[clientName];
          const activeSources = Object.keys(accounts).filter(k => accounts[k]?.length > 0);

          if (activeSources.length === 0) {
            push(`[BULK-AD-REVIEW] No active accounts for ${clientName}, skipping`);
            failed++;
            continue;
          }

          // Fetch Supermetrics data
          push(`[BULK-AD-REVIEW] Fetching Supermetrics data for ${clientName}...`);
          const smRes = await fetch(`${supabaseUrl}/functions/v1/fetch-supermetrics`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              action: 'fetch-data',
              dataSources: activeSources,
              accounts,
              dateStart,
              dateEnd,
            }),
          });

          const smData = await smRes.json();

          // Build context string
          let supermetricsContext = '';
          if (smData?.success && smData?.platforms) {
            supermetricsContext = `=== SUPERMETRICS LIVE AD DATA (PRIMARY SOURCE) ===\nDate Range: ${dateStart} to ${dateEnd}\n\n`;
            for (const [platform, platformData] of Object.entries(smData.platforms as Record<string, any>)) {
              const summary = (platformData as any).summary || {};
              supermetricsContext += `## ${(platformData as any).label || platform}\n`;
              supermetricsContext += `Account: ${(platformData as any).accountName || 'N/A'}\n`;
              if (summary.spend > 0) supermetricsContext += `Spend: $${summary.spend?.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
              if (summary.impressions > 0) supermetricsContext += `Impressions: ${summary.impressions?.toLocaleString()}\n`;
              if (summary.clicks > 0) supermetricsContext += `Clicks: ${summary.clicks?.toLocaleString()}\n`;
              if (summary.conversions > 0) supermetricsContext += `Conversions: ${summary.conversions?.toLocaleString()}\n`;
              if (summary.calls > 0) supermetricsContext += `Calls: ${summary.calls?.toLocaleString()}\n`;
              if (summary.ctr > 0) supermetricsContext += `CTR: ${(summary.ctr * 100).toFixed(2)}%\n`;
              if (summary.cpc > 0) supermetricsContext += `CPC: $${summary.cpc?.toFixed(2)}\n`;
              if (summary.cpa > 0) supermetricsContext += `CPA: $${summary.cpa?.toFixed(2)}\n`;
              if ((platformData as any).campaigns?.length > 0) {
                supermetricsContext += `\nTop Campaigns:\n`;
                for (const c of ((platformData as any).campaigns as any[]).slice(0, 10)) {
                  supermetricsContext += `  - ${c.name}: $${c.spend?.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend, ${c.conversions} conv, CPA $${c.cpa?.toFixed(2)}\n`;
                }
              }
              // Include creative data if available
              if ((platformData as any).creatives?.length > 0) {
                supermetricsContext += `\nTop Creatives:\n`;
                for (const cr of ((platformData as any).creatives as any[]).slice(0, 10)) {
                  supermetricsContext += `  - ${cr.name || cr.adName}: ${cr.impressions || 0} imp, ${cr.clicks || 0} clicks, $${cr.spend?.toFixed(2) || '0'} spend\n`;
                }
              }
              // Include keyword data if available
              if ((platformData as any).keywords?.length > 0) {
                supermetricsContext += `\nTop Keywords:\n`;
                for (const kw of ((platformData as any).keywords as any[]).slice(0, 15)) {
                  supermetricsContext += `  - ${kw.keyword || kw.name}: ${kw.impressions || 0} imp, ${kw.clicks || 0} clicks, ${kw.conversions || 0} conv, CPC $${kw.cpc?.toFixed(2) || '0'}\n`;
                }
              }
              // Include daily trend data
              if ((platformData as any).daily?.length > 0) {
                supermetricsContext += `\nDaily Trend (last 7 days):\n`;
                for (const d of ((platformData as any).daily as any[]).slice(-7)) {
                  supermetricsContext += `  ${d.date}: $${d.spend?.toFixed(0) || '0'} spend, ${d.clicks || 0} clicks, ${d.conversions || 0} conv\n`;
                }
              }
              supermetricsContext += '\n';
            }
          }

          // Load previous review for learning context
          const { data: prevReviews } = await supabase
            .from('ad_review_history')
            .select('*')
            .eq('client_name', clientName)
            .order('review_date', { ascending: false })
            .limit(3);

          const previousReview = prevReviews?.[0] || null;
          const historicalContext = prevReviews?.slice(0, 3).map(r => ({
            date: r.review_date,
            summary: r.summary,
            recommendations: r.recommendations,
            insights: r.insights,
          })) || [];

          // Call ad-review edge function
          push(`[BULK-AD-REVIEW] Running AI analysis for ${clientName}...`);
          const reviewRes = await fetch(`${supabaseUrl}/functions/v1/ad-review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              type: 'sheets',
              clientName,
              dateRange: { start: dateStart, end: dateEnd },
              sheetsData: supermetricsContext,
              previousReview: previousReview || undefined,
              benchmarkData: clientInfo[clientName]?.industry ? { industry: clientInfo[clientName].industry } : undefined,
            }),
          });

          const reviewText = await reviewRes.text();
          let reviewData: any;
          try {
            reviewData = JSON.parse(reviewText);
          } catch {
            push(`[BULK-AD-REVIEW] ❌ Failed to parse response for ${clientName}`);
            failed++;
            continue;
          }

          if (!reviewRes.ok || !reviewData?.analysis) {
            push(`[BULK-AD-REVIEW] ❌ Review failed for ${clientName}: ${reviewRes.status}`);
            failed++;
            continue;
          }

          // Store ALL data — full analysis, raw supermetrics context, historical learning
          const analysis = reviewData.analysis;
          await supabase.from('ad_review_history').insert({
            client_name: clientName,
            review_date: new Date().toISOString().split('T')[0],
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
            industry: clientInfo[clientName]?.industry || null,
            previous_review_id: previousReview?.id || null,
          });

          push(`[BULK-AD-REVIEW] ✅ Complete for ${clientName}`);
          completed++;
        } catch (e: any) {
          push(`[BULK-AD-REVIEW] ❌ Error for ${clientName}: ${e.message}`);
          failed++;
        }

        // Delay between clients
        await new Promise(r => setTimeout(r, 2000));
      }

      push(`\n[BULK-AD-REVIEW] ✅ Done. ${completed} completed, ${failed} failed out of ${clientNames.length} clients.`);
    } catch (e: any) {
      push(`[BULK-AD-REVIEW] ❌ Fatal error: ${e.message}`);
    }
  })();

  // Use EdgeRuntime.waitUntil for background processing
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

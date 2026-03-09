import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Client Directory (managed_clients) is the sole source of truth

interface ClientEntry {
  name: string;
  domain?: string;
  lookerUrl?: string;
  siteAuditUrl?: string;
  ga4PropertyId?: string;
}

// Scrape site audit for a single client
async function scrapeSiteAudit(
  url: string,
  firecrawlKey: string
): Promise<{ errors: number; warnings: number; notices: number } | null> {
  try {
    console.log(`Scraping site audit: ${url}`);
    
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 5000,
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl error for ${url}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    
    const errorMatch = markdown.match(/(\d+)\s*(?:Errors?|errors?)/i) || 
                       markdown.match(/(?:Errors?|errors?)\s*[:\-]?\s*(\d+)/i);
    const warningMatch = markdown.match(/(\d+)\s*(?:Warnings?|warnings?)/i) ||
                         markdown.match(/(?:Warnings?|warnings?)\s*[:\-]?\s*(\d+)/i);
    const noticeMatch = markdown.match(/(\d+)\s*(?:Notices?|notices?)/i) ||
                        markdown.match(/(?:Notices?|notices?)\s*[:\-]?\s*(\d+)/i);

    const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
    const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;
    const notices = noticeMatch ? parseInt(noticeMatch[1]) : 0;

    console.log(`Parsed from ${url}: ${errors} errors, ${warnings} warnings, ${notices} notices`);
    
    return { errors, warnings, notices };
  } catch (e) {
    console.error(`Exception scraping ${url}:`, e);
    return null;
  }
}

// Calculate config completeness
function calculateConfigCompleteness(client: ClientEntry): { score: number; missing: string[] } {
  const missing: string[] = [];
  
  if (!client.domain) missing.push('domain');
  if (!client.lookerUrl) missing.push('looker_url');
  if (!client.siteAuditUrl) missing.push('site_audit_url');
  if (!client.ga4PropertyId) missing.push('ga4_property_id');
  
  const totalConfigs = 4;
  const presentConfigs = totalConfigs - missing.length;
  const score = Math.round((presentConfigs / totalConfigs) * 100);
  
  return { score, missing };
}

// Calculate health score — focused on review recency and SEO errors (cron has limited data)
function calculateHealthScore(
  seoErrors: number | null,
  daysSinceAdReview: number | null,
  hasSiteAudit: boolean
): { score: number; seoHealth: string; adHealth: string } {
  // Two signals available in the cron context:
  // 1. SEO errors (site audit) — 50% weight
  // 2. Review recency — 50% weight
  // (The full 5-signal model runs client-side with richer data)

  let seoScore = 50; // neutral default
  let seoHealth = 'unknown';

  if (seoErrors !== null) {
    if (seoErrors > 200) { seoHealth = 'critical'; seoScore = 10; }
    else if (seoErrors > 50) { seoHealth = 'warning'; seoScore = 40; }
    else { seoHealth = 'healthy'; seoScore = 90; }
  } else if (!hasSiteAudit) {
    seoScore = 50; // unknown, neutral
  }

  let recencyScore = 50; // neutral default
  let adHealth = 'unknown';

  if (daysSinceAdReview !== null) {
    if (daysSinceAdReview <= 3) { adHealth = 'healthy'; recencyScore = 100; }
    else if (daysSinceAdReview <= 7) { adHealth = 'healthy'; recencyScore = 80; }
    else if (daysSinceAdReview <= 14) { adHealth = 'warning'; recencyScore = 50; }
    else if (daysSinceAdReview <= 30) { adHealth = 'warning'; recencyScore = 20; }
    else { adHealth = 'critical'; recencyScore = 0; }
  }

  const score = Math.round((seoScore + recencyScore) / 2);

  return { score: Math.max(0, Math.min(100, score)), seoHealth, adHealth };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const googleServiceAccount = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { clientName, forceRefresh = false } = body;

    console.log(`Starting client health refresh. Client: ${clientName || 'ALL'}, Force: ${forceRefresh}`);

    // Step 1: Fetch client directory from managed_clients (the sole source of truth)
    let clients: ClientEntry[] = [];

    let mcQuery = supabase
      .from('managed_clients')
      .select('client_name, domain, looker_url, site_audit_url, ga4_property_id')
      .eq('is_active', true);

    if (clientName) {
      mcQuery = mcQuery.ilike('client_name', `%${clientName}%`);
    }

    const { data: managedClients, error: mcError } = await mcQuery;

    if (mcError) {
      console.error('Error fetching managed_clients:', mcError.message);
    }

    for (const mc of managedClients || []) {
      clients.push({
        name: mc.client_name,
        domain: mc.domain || undefined,
        lookerUrl: mc.looker_url || undefined,
        siteAuditUrl: mc.site_audit_url || undefined,
        ga4PropertyId: mc.ga4_property_id || undefined,
      });
    }

    if (clients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active clients found in Client Directory' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${clients.length} clients`);

    // Step 2: Get existing cache and ad review history
    const { data: existingCache } = await supabase
      .from('site_audit_cache')
      .select('client_name, site_errors, site_warnings, site_notices, last_scraped_at');
    
    const cacheMap = new Map<string, { errors: number; lastScraped: Date }>();
    for (const row of existingCache || []) {
      cacheMap.set(row.client_name.toLowerCase(), {
        errors: row.site_errors || 0,
        lastScraped: new Date(row.last_scraped_at),
      });
    }

    const { data: adHistory } = await supabase
      .from('ad_review_history')
      .select('client_name, review_date')
      .order('review_date', { ascending: false });

    const adReviewMap = new Map<string, Date>();
    for (const review of adHistory || []) {
      const key = review.client_name.toLowerCase();
      if (!adReviewMap.has(key)) {
        adReviewMap.set(key, new Date(review.review_date));
      }
    }

    // Step 3: Process each client
    const results: { client: string; success: boolean; message?: string }[] = [];
    const healthRecords: any[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const client of clients) {
      const clientKey = client.name.toLowerCase();
      let seoErrors: number | null = null;
      let needsRefresh = forceRefresh;

      // Check if we need to refresh site audit
      const cached = cacheMap.get(clientKey);
      if (cached) {
        const hoursSinceUpdate = (now.getTime() - cached.lastScraped.getTime()) / (1000 * 60 * 60);
        needsRefresh = needsRefresh || hoursSinceUpdate > 24;
        seoErrors = cached.errors;
      } else if (client.siteAuditUrl) {
        needsRefresh = true;
      }

      // Scrape site audit if needed
      if (needsRefresh && client.siteAuditUrl && firecrawlKey) {
        const auditData = await scrapeSiteAudit(client.siteAuditUrl, firecrawlKey);
        
        if (auditData) {
          seoErrors = auditData.errors;

          const { error: upsertError } = await supabase
            .from('site_audit_cache')
            .upsert({
              client_name: client.name,
              site_audit_url: client.siteAuditUrl,
              site_errors: auditData.errors,
              site_warnings: auditData.warnings,
              site_notices: auditData.notices,
              last_scraped_at: now.toISOString(),
              updated_at: now.toISOString(),
            }, { onConflict: 'client_name' });

          if (upsertError) {
            console.error(`Cache upsert error for ${client.name}:`, upsertError);
          }

          results.push({ client: client.name, success: true, message: `Refreshed: ${auditData.errors} errors` });
        } else {
          results.push({ client: client.name, success: false, message: 'Failed to scrape site audit' });
        }

        await new Promise(r => setTimeout(r, 500));
      } else {
        results.push({ client: client.name, success: true, message: 'Using cached data' });
      }

      // Calculate health metrics
      const adReviewDate = adReviewMap.get(clientKey);
      const daysSinceAdReview = adReviewDate 
        ? Math.floor((now.getTime() - adReviewDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const { score: healthScore, seoHealth, adHealth } = calculateHealthScore(
        seoErrors,
        daysSinceAdReview,
        !!client.siteAuditUrl
      );

      const { score: configScore, missing: missingConfigs } = calculateConfigCompleteness(client);

      healthRecords.push({
        client_name: client.name,
        recorded_date: today,
        health_score: healthScore,
        seo_errors: seoErrors,
        seo_health: seoHealth,
        ad_health: adHealth,
        days_since_ad_review: daysSinceAdReview,
        config_completeness: configScore,
        missing_configs: missingConfigs,
      });
    }

    // Step 4: Upsert health history records
    if (healthRecords.length > 0) {
      const { error: historyError } = await supabase
        .from('client_health_history')
        .upsert(healthRecords, { onConflict: 'client_name,recorded_date' });

      if (historyError) {
        console.error('Health history upsert error:', historyError);
      } else {
        console.log(`Saved ${healthRecords.length} health history records`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Refresh complete: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Refresh error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
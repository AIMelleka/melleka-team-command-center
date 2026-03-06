import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  validateDomain,
  createValidationErrorResponse,
} from "../_shared/validation.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeoData {
  domain: string;
  organicKeywords?: number;
  organicTraffic?: number;
  organicTrafficCost?: number;
  domainAuthority?: number;
  backlinks?: number;
  referringDomains?: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    cpc: number;
    url: string;
    trafficPercent: number;
    difficulty?: number;
  }>;
  competitors?: Array<{
    domain: string;
    commonKeywords: number;
    organicKeywords?: number;
    organicTraffic?: number;
  }>;
  paidKeywords?: number;
  paidTraffic?: number;
  paidTrafficCost?: number;
}

interface SeoOverviewMetrics {
  organicKeywords: number;
  organicTraffic: number;
  organicTrafficCost: number;
  paidKeywords: number;
  paidTraffic: number;
  paidTrafficCost: number;
}

async function fetchOverviewMetrics(cleanDomain: string, apiKey: string, displayDate?: string): Promise<SeoOverviewMetrics> {
  let url = `https://api.semrush.com/?type=domain_ranks&key=${apiKey}&export_columns=Or,Ot,Oc,Ad,At,Ac&domain=${cleanDomain}&database=us`;
  if (displayDate) {
    url += `&display_date=${displayDate}`;
  }

  const response = await fetch(url);
  const text = await response.text();
  console.log(`Semrush overview${displayDate ? ` (${displayDate})` : ''}:`, text.substring(0, 300));

  const result: SeoOverviewMetrics = {
    organicKeywords: 0, organicTraffic: 0, organicTrafficCost: 0,
    paidKeywords: 0, paidTraffic: 0, paidTrafficCost: 0,
  };

  if (text && !text.includes("ERROR")) {
    const lines = text.trim().split('\n');
    if (lines.length > 1) {
      const values = lines[1].split(';');
      result.organicKeywords = parseInt(values[0]) || 0;
      result.organicTraffic = parseInt(values[1]) || 0;
      result.organicTrafficCost = parseFloat(values[2]) || 0;
      result.paidKeywords = parseInt(values[3]) || 0;
      result.paidTraffic = parseInt(values[4]) || 0;
      result.paidTrafficCost = parseFloat(values[5]) || 0;
    }
  }

  return result;
}

async function fetchBacklinkMetrics(cleanDomain: string, apiKey: string): Promise<{ backlinks: number; referringDomains: number; domainAuthority: number }> {
  const result = { backlinks: 0, referringDomains: 0, domainAuthority: 0 };
  try {
    const url = `https://api.semrush.com/analytics/v1/?key=${apiKey}&type=backlinks_overview&target=${cleanDomain}&target_type=root_domain`;
    const response = await fetch(url);
    const text = await response.text();
    console.log("Semrush backlinks response:", text.substring(0, 500));

    if (text && !text.includes("ERROR")) {
      const lines = text.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(';').map(h => h.toLowerCase().trim());
        const values = lines[1].split(';');
        const blIndex = headers.findIndex(h => h.includes('total') || h === 'backlinks' || h === 'bl');
        if (blIndex >= 0) result.backlinks = parseInt(values[blIndex]) || 0;
        const rdIndex = headers.findIndex(h => h.includes('domains') || h === 'domains' || h === 'rd');
        if (rdIndex >= 0) result.referringDomains = parseInt(values[rdIndex]) || 0;
        const asIndex = headers.findIndex(h => h.includes('score') || h.includes('authority') || h === 'as');
        if (asIndex >= 0) result.domainAuthority = parseInt(values[asIndex]) || 0;
      }
    }
  } catch (err) {
    console.log("Backlinks fetch failed:", err);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'seo-bot');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { domain, includePrevious } = await req.json();

    const domainValidation = validateDomain(domain);
    if (!domainValidation.valid) {
      return createValidationErrorResponse(domainValidation.error!, corsHeaders);
    }

    const SEMRUSH_API_KEY = Deno.env.get("SEMRUSH_API_KEY");
    if (!SEMRUSH_API_KEY) {
      console.log("SEMRUSH_API_KEY not configured, returning mock data");
      return new Response(
        JSON.stringify({
          success: true,
          data: generateMockSeoData(domain),
          isMock: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    console.log("Fetching organic SEO data for:", cleanDomain, "includePrevious:", !!includePrevious);

    // Calculate previous month display_date (Semrush format: YYYYMM15)
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const prevDisplayDate = `${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, '0')}15`;

    // Fetch current + previous overview in parallel when requested
    const overviewPromises: Promise<SeoOverviewMetrics>[] = [
      fetchOverviewMetrics(cleanDomain, SEMRUSH_API_KEY),
    ];
    if (includePrevious) {
      overviewPromises.push(fetchOverviewMetrics(cleanDomain, SEMRUSH_API_KEY, prevDisplayDate));
    }

    const [currentOverview, previousOverview] = await Promise.all(overviewPromises);
    const backlinkMetrics = await fetchBacklinkMetrics(cleanDomain, SEMRUSH_API_KEY);

    // Fetch top ORGANIC keywords
    const organicKeywordsUrl = `https://api.semrush.com/?type=domain_organic&key=${SEMRUSH_API_KEY}&export_columns=Ph,Po,Nq,Cp,Ur,Tr&domain=${cleanDomain}&database=us&display_limit=20&display_sort=tr_desc`;
    const organicKeywordsResponse = await fetch(organicKeywordsUrl);
    const organicKeywordsText = await organicKeywordsResponse.text();
    console.log("Semrush organic keywords response:", organicKeywordsText.substring(0, 500));

    const topKeywords: Array<{ keyword: string; position: number; volume: number; cpc: number; url: string; trafficPercent: number }> = [];
    if (organicKeywordsText && !organicKeywordsText.includes("ERROR")) {
      const lines = organicKeywordsText.trim().split('\n');
      for (let i = 1; i < lines.length && i <= 20; i++) {
        const values = lines[i].split(';');
        if (values.length >= 6) {
          topKeywords.push({
            keyword: values[0],
            position: parseInt(values[1]) || 0,
            volume: parseInt(values[2]) || 0,
            cpc: parseFloat(values[3]) || 0,
            url: values[4] || '',
            trafficPercent: parseFloat(values[5]) || 0
          });
        }
      }
    }

    // Fetch ORGANIC competitors
    const organicCompetitorsUrl = `https://api.semrush.com/?type=domain_organic_organic&key=${SEMRUSH_API_KEY}&export_columns=Dn,Np,Or,Ot&domain=${cleanDomain}&database=us&display_limit=10&display_sort=np_desc`;
    const organicCompetitorsResponse = await fetch(organicCompetitorsUrl);
    const organicCompetitorsText = await organicCompetitorsResponse.text();
    console.log("Semrush organic competitors response:", organicCompetitorsText.substring(0, 500));

    const genericDomains = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'wikipedia.org', 'amazon.com', 'google.com', 'yelp.com'];
    const competitors: Array<{ domain: string; commonKeywords: number; organicKeywords?: number; organicTraffic?: number }> = [];

    if (organicCompetitorsText && !organicCompetitorsText.includes("ERROR")) {
      const lines = organicCompetitorsText.trim().split('\n');
      for (let i = 1; i < lines.length && competitors.length < 10; i++) {
        const values = lines[i].split(';');
        if (values.length >= 4) {
          const compDomain = values[0];
          if (genericDomains.some(gd => compDomain.includes(gd))) continue;
          competitors.push({
            domain: compDomain,
            commonKeywords: parseInt(values[1]) || 0,
            organicKeywords: parseInt(values[2]) || 0,
            organicTraffic: parseInt(values[3]) || 0
          });
        }
      }
    }

    const seoData: SeoData = {
      domain: cleanDomain,
      organicKeywords: currentOverview.organicKeywords,
      organicTraffic: currentOverview.organicTraffic,
      organicTrafficCost: currentOverview.organicTrafficCost,
      domainAuthority: backlinkMetrics.domainAuthority,
      backlinks: backlinkMetrics.backlinks,
      referringDomains: backlinkMetrics.referringDomains,
      topKeywords,
      competitors,
      paidKeywords: currentOverview.paidKeywords,
      paidTraffic: currentOverview.paidTraffic,
      paidTrafficCost: currentOverview.paidTrafficCost,
    };

    // Build previous period data if requested
    let previousData: Record<string, number> | undefined;
    if (previousOverview) {
      previousData = {
        organicKeywords: previousOverview.organicKeywords,
        organicTraffic: previousOverview.organicTraffic,
        organicTrafficCost: previousOverview.organicTrafficCost,
        paidKeywords: previousOverview.paidKeywords,
        paidTraffic: previousOverview.paidTraffic,
        paidTrafficCost: previousOverview.paidTrafficCost,
      };
      console.log("Previous period data:", JSON.stringify(previousData));
    }

    console.log("Organic SEO data compiled successfully:", JSON.stringify(seoData).substring(0, 300));

    return new Response(
      JSON.stringify({ success: true, data: seoData, previousData, isMock: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SEO data fetch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateMockSeoData(domain: string): SeoData {
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  const brandName = cleanDomain.split('.')[0];
  const hashCode = cleanDomain.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
  const seed = Math.abs(hashCode);

  const topKeywords = [
    { keyword: `${brandName} services`, position: (seed % 10) + 1, volume: (seed % 5000) + 1000, cpc: 2.50 + (seed % 10), url: `https://${cleanDomain}/services`, trafficPercent: 15 + (seed % 20) },
    { keyword: `${brandName} near me`, position: (seed % 15) + 1, volume: (seed % 3000) + 500, cpc: 3.20 + (seed % 8), url: `https://${cleanDomain}/`, trafficPercent: 10 + (seed % 15) },
    { keyword: `best ${brandName}`, position: (seed % 20) + 2, volume: (seed % 2000) + 300, cpc: 4.10 + (seed % 6), url: `https://${cleanDomain}/`, trafficPercent: 8 + (seed % 12) },
    { keyword: `${brandName} reviews`, position: (seed % 25) + 3, volume: (seed % 1500) + 200, cpc: 1.80 + (seed % 5), url: `https://${cleanDomain}/reviews`, trafficPercent: 5 + (seed % 10) },
    { keyword: `${brandName} pricing`, position: (seed % 30) + 5, volume: (seed % 1000) + 100, cpc: 5.00 + (seed % 8), url: `https://${cleanDomain}/pricing`, trafficPercent: 4 + (seed % 8) },
  ];

  return {
    domain: cleanDomain,
    organicKeywords: (seed % 500) + 50,
    organicTraffic: (seed % 10000) + 1000,
    organicTrafficCost: (seed % 20000) + 2000,
    domainAuthority: (seed % 40) + 20,
    backlinks: (seed % 5000) + 500,
    referringDomains: (seed % 300) + 50,
    topKeywords,
    competitors: [
      { domain: `competitor1-${brandName}.com`, commonKeywords: (seed % 100) + 20, organicKeywords: (seed % 1000) + 100, organicTraffic: (seed % 15000) + 2000 },
      { domain: `competitor2-${brandName}.com`, commonKeywords: (seed % 80) + 15, organicKeywords: (seed % 800) + 80, organicTraffic: (seed % 12000) + 1500 },
      { domain: `competitor3-${brandName}.com`, commonKeywords: (seed % 60) + 10, organicKeywords: (seed % 600) + 60, organicTraffic: (seed % 10000) + 1000 },
    ],
    paidKeywords: (seed % 50) + 5,
    paidTraffic: (seed % 2000) + 200,
    paidTrafficCost: (seed % 5000) + 500,
  };
}

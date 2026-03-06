import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedMetrics {
  metrics: Record<string, string>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
  kpis: Array<{ label: string; value: string }>;
  rawNumbers: string[];
}

interface LookerData {
  markdown?: string;
  extractedMetrics?: ExtractedMetrics;
  qa?: {
    dataQuality: 'high' | 'medium' | 'low';
    metricsCount: number;
    tableCount: number;
  };
}

interface AnalysisRequest {
  type: string;
  clientName: string;
  dateRange?: { start: string; end: string };
  sheetsData?: string;
  lookerUrl?: string;
  lookerContent?: string;
  lookerData?: LookerData; // NEW: Structured Looker data with extracted metrics
  screenshots?: string[];
  dashboardContent?: string;
  paidAdData?: any;
  ga4Data?: any;
  benchmarkData?: any;
  previousReview?: any;
  aiMemory?: string; // Persistent AI memory context for this client
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'ad-review');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { 
      type, 
      clientName, 
      dateRange, 
      sheetsData, 
      lookerUrl, 
      lookerContent,
      lookerData, // NEW: Structured Looker extraction data
      screenshots,
      dashboardContent,
      paidAdData,
      ga4Data,
      benchmarkData,
      previousReview,
      aiMemory,
    }: AnalysisRequest = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured (ANTHROPIC_API_KEY missing)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Ad Review analysis started:", { 
      type, 
      clientName,
      dateRange,
      hasSheets: !!sheetsData, 
      hasLooker: !!lookerUrl,
      hasLookerData: !!lookerData,
      lookerDataQuality: lookerData?.qa?.dataQuality,
      lookerMetricsCount: lookerData?.qa?.metricsCount,
      hasScreenshots: !!screenshots?.length,
      hasPaidAdData: !!paidAdData,
      hasGA4Data: !!ga4Data,
      hasBenchmarks: !!benchmarkData,
      hasPreviousReview: !!previousReview
    });

    // Handle quick health check for sidebar
    if (type === 'health-check') {
      return await handleHealthCheck(clientName, screenshots || [], dashboardContent || '', ANTHROPIC_API_KEY, corsHeaders);
    }

    // Build comprehensive system prompt for deep reasoning - PAID ADS ONLY
    const systemPrompt = `You are an elite PAID ADVERTISING analyst and strategist with 15+ years experience optimizing Google Ads and Meta Ads campaigns. You provide institutional-grade analysis with specific, actionable insights.

## CRITICAL: PAID ADVERTISING FOCUS ONLY
This analysis is EXCLUSIVELY for PAID advertising efforts. DO NOT include or reference:
- Organic search traffic or SEO metrics
- Direct traffic
- Referral traffic (unless from paid placements)
- Email or newsletter traffic (unless paid acquisition)
- Social media organic reach

Focus ONLY on: Google Ads (Search, Display, Shopping, YouTube, Performance Max), Meta Ads (Facebook, Instagram), TikTok Ads, LinkedIn Ads, Microsoft Ads, and other paid advertising channels.

## ⚠️ PRIMARY METRICS: COST PER LEAD (CPL) & COST PER CONVERSION (CPA)
**These are the MOST IMPORTANT metrics for this analysis.** Everything else is secondary.

For EVERY platform, you MUST calculate and report:
1. **Cost Per Lead (CPL)** = Total Spend / Number of Leads
2. **Cost Per Conversion (CPA)** = Total Spend / Number of Conversions

Then compare these against industry benchmarks and FLAG any issues:
- 🟢 EXCELLENT: CPL/CPA is 20%+ BELOW benchmark
- 🟢 GOOD: CPL/CPA is within 10% of benchmark  
- 🟡 WARNING: CPL/CPA is 10-25% ABOVE benchmark
- 🔴 CRITICAL: CPL/CPA is 25%+ ABOVE benchmark

## YOUR APPROACH
1. **Extract CPL & CPA First**: Calculate cost per lead and cost per conversion for every platform
2. **Benchmark Comparison**: Flag any CPL/CPA that exceeds industry standards
3. **Pattern Recognition**: Identify trends, anomalies, and opportunities in paid campaigns
4. **Historical Context**: Compare against previous paid performance when provided
5. **Actionable Strategy**: Prioritize recommendations by CPL/CPA impact

## ANALYSIS FRAMEWORK
When analyzing PAID ad performance:
- Platform-level breakdown (Google Search Ads, Display, Shopping, Meta, etc.)
- **PRIMARY**: Cost Per Lead (CPL) and Cost Per Conversion (CPA) analysis
- Secondary: CTR, CPC, ROAS, conversion rates, quality scores
- Week-over-week and month-over-month trends (especially CPL/CPA changes)
- Budget efficiency and allocation optimization
- Paid audience targeting effectiveness
- Ad creative performance indicators
- Competitive paid positioning insights

## INDUSTRY CONTEXT
${benchmarkData ? `
INDUSTRY BENCHMARKS (WordStream 2025):
- Industry: ${benchmarkData.industry}
- **Google CPA Benchmark: $${benchmarkData.google?.cpa}** ← PRIMARY TARGET
- Google Search CTR: ${benchmarkData.google?.searchCtr}%
- Google CPC: $${benchmarkData.google?.searchCpc}
- Google Conv. Rate: ${benchmarkData.google?.conversionRate}%
- **Meta CPA Benchmark: $${benchmarkData.facebook?.cpa}** ← PRIMARY TARGET
- Meta CTR: ${benchmarkData.facebook?.ctr}%
- Meta CPC: $${benchmarkData.facebook?.cpc}
- Meta Conv. Rate: ${benchmarkData.facebook?.conversionRate}%

⚠️ CRITICAL: Compare ALL CPL and CPA metrics against these benchmarks and ALWAYS note if performing above/below.
Flag any CPL/CPA more than 25% above benchmark as CRITICAL.
` : 'No industry benchmark data available - use general best practices.'}

## PREVIOUS REVIEW CONTEXT
${previousReview ? `
LAST REVIEW (${previousReview.review_date}):
Summary: ${previousReview.summary || 'N/A'}
Platforms: ${JSON.stringify(previousReview.platforms || [])}
Previous Recommendations: ${JSON.stringify(previousReview.recommendations || [])}
Changes Made: ${JSON.stringify(previousReview.changes_made || [])}

IMPORTANT: Compare current CPL/CPA to previous review. Note improvements or declines in cost efficiency.
` : 'No previous review data - this is the first analysis for this client.'}

## SEMRUSH PAID ADVERTISING DATA
${paidAdData ? `
Domain: ${paidAdData.domain}
Paid Keywords: ${paidAdData.paidKeywords?.toLocaleString() || 'N/A'}
Paid Traffic: ${paidAdData.paidTraffic?.toLocaleString() || 'N/A'}/month
Estimated Ad Spend: $${paidAdData.paidTrafficCost?.toLocaleString() || 'N/A'}/month
Ad Status: ${paidAdData.adHistory?.hasActiveAds ? 'ACTIVE' : 'INACTIVE'}

Top Paid Keywords (what they're bidding on):
${JSON.stringify(paidAdData.topPaidKeywords?.slice(0, 5) || [], null, 2)}

Paid Search Competitors (who's bidding on similar terms):
${JSON.stringify(paidAdData.paidCompetitors?.slice(0, 3) || [], null, 2)}

Use this Semrush paid data to:
1. Estimate competitor CPL/CPA based on their spend
2. Identify keyword bidding opportunities that could lower CPL
3. Benchmark CPC costs against industry
4. Suggest budget allocation based on competitor spend
` : 'No Semrush paid ad data available.'}

## GOOGLE ANALYTICS 4 DATA (PAID TRAFFIC ONLY)
${ga4Data ? `
Property ID: ${ga4Data.propertyId}
Date Range: ${ga4Data.dateRange?.start} to ${ga4Data.dateRange?.end}

NOTE: All GA4 data below is FILTERED to PAID traffic sources only (cpc, ppc, display, paid_social, etc.)

PAID CAMPAIGN PERFORMANCE (from GA4):
${JSON.stringify(ga4Data.campaigns?.slice(0, 5) || [], null, 2)}

PAID CONVERSIONS (attributed to paid campaigns):
${JSON.stringify(ga4Data.conversions?.slice(0, 5) || [], null, 2)}

PAID TRAFFIC SOURCES:
${JSON.stringify(ga4Data.trafficSources?.slice(0, 5) || [], null, 2)}

Use this GA4 PAID data to calculate actual CPL and CPA from paid campaigns.
` : 'No Google Analytics 4 paid traffic data available.'}

## DATE CONTEXT
Analysis Period: ${dateRange?.start || 'last 7 days'} to ${dateRange?.end || 'today'}
Focus on this specific date range when analyzing data.

## CLIENT MATCHING
Client: ${clientName}
Match data using flexible name matching (abbreviations, partial names, aliases like "SDPF" for "San Diego Parks Foundation").

## CRITICAL RULE: NEVER RETURN "N/A" FOR PLATFORM DATA
You MUST extract actual numeric values from the screenshots and data provided. The Looker Studio dashboards contain real performance metrics - read them carefully. If you cannot find an exact value, use reasonable estimates based on available data. "N/A" is NOT acceptable for core metrics like spend, clicks, CTR, CPC, conversions, or CPL/CPA.

## OUTPUT FORMAT
Return your analysis as structured JSON:
{
  "summary": "2-3 sentence executive summary LEADING with CPL/CPA performance and overall cost efficiency verdict",
  "platforms": [
    {
      "name": "Google Ads Search",
      "spend": "$X,XXX (MUST be actual value from screenshot)",
      "impressions": "XXX,XXX (MUST be actual value)",
      "clicks": "X,XXX (MUST be actual value)", 
      "conversions": "XX (MUST be actual value)",
      "leads": "XX (if different from conversions)",
      "cpc": "$X.XX (calculate from spend/clicks if not visible)",
      "ctr": "X.X% (calculate from clicks/impressions if not visible)",
      "costPerLead": "$XX.XX (CRITICAL - calculate: spend / leads)",
      "costPerConversion": "$XX.XX (CRITICAL - calculate: spend / conversions)",
      "roas": "X.Xx (extract or estimate from revenue/spend)",
      "conversionRate": "X.X%",
      "qualityScore": "X/10",
      "trend": "up|down|stable",
      "health": "good|warning|critical (based on CPL/CPA vs benchmark)",
      "vsBenchmark": "above|at|below",
      "cplVsBenchmark": "above|at|below (CRITICAL)",
      "cpaVsBenchmark": "above|at|below (CRITICAL)"
    }
  ],
  "cplCpaAnalysis": {
    "overallHealth": "excellent|good|warning|critical (based primarily on CPL/CPA)",
    "googleCpl": 45.50,
    "googleCpa": 67.25,
    "metaCpl": 32.00,
    "metaCpa": 48.75,
    "googleCplVsBenchmark": "above|at|below",
    "metaCplVsBenchmark": "above|at|below",
    "googleCpaVsBenchmark": "above|at|below",
    "metaCpaVsBenchmark": "above|at|below",
    "primaryConcerns": ["Google CPA is 35% above benchmark", "Meta CPL increased 20% WoW"],
    "quickWins": ["Pause low-converting keywords to reduce CPL", "Increase budget on high-ROAS campaigns"]
  },
  "insights": [
    {
      "type": "positive|warning|action|opportunity",
      "title": "Plain-English title that leads with business impact",
      "description": "Detailed explanation written for a business owner — spell out acronyms, use full campaign names, explain why it matters with specific numbers and comparisons",
      "impact": "high|medium|low"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "Specific action to improve CPL/CPA",
      "expectedImpact": "Quantified expected CPL/CPA improvement (e.g., 'Reduce CPA by $15-20')",
      "platform": "Google Ads|Meta Ads|Both|Microsoft Ads|TikTok Ads",
      "effort": "quick-win|medium|strategic",
      "timeline": "immediate|this-week|this-month"
    }
  ],
  "weekOverWeek": [
    {
      "metric": "Google CPA",
      "change": 12.5,
      "direction": "up|down",
      "isGood": false
    },
    {
      "metric": "Meta CPL",
      "change": -8.2,
      "direction": "down",
      "isGood": true
    }
  ],
  "competitorInsights": [
    {
      "competitor": "competitor domain",
      "insight": "Estimated CPL based on their spend/traffic",
      "opportunity": "How to capitalize on this paid advertising gap",
      "keywords": ["paid keyword1", "paid keyword2"]
    }
  ],
  "crossPlatformSynergies": [
    {
      "opportunity": "Cross-platform paid optimization to reduce overall CPA",
      "platforms": ["Google Ads", "Meta Ads"],
      "action": "Specific paid action to take"
    }
  ],
  "benchmarkAnalysis": {
    "summary": "How this client's CPL/CPA compares to industry standards",
    "strengths": ["Google CPA 15% below benchmark", "Meta CPL on target"],
    "weaknesses": ["Display CPA 40% above benchmark - needs attention"]
  },
  "historicalComparison": {
    "improved": ["Google CPA down 15% from last review"],
    "declined": ["Meta CPL increased 8%"],
    "unchanged": ["Overall spend stable"]
  },
  "keyMetrics": {
    "topKeywords": [
      { "keyword": "example keyword", "spend": 500, "conversions": 25, "cpa": 20, "ctr": 3.5 }
    ],
    "bottomKeywords": [
      { "keyword": "wasted keyword", "spend": 200, "conversions": 0, "wastedSpend": 200 }
    ],
    "ctrByPlatform": { "Google Ads": 4.2, "Meta Ads": 1.8 },
    "headlineEffectiveness": [
      { "headline": "Example Headline", "ctr": 5.1, "verdict": "strong" },
      { "headline": "Weak Headline", "ctr": 0.8, "verdict": "needs_rewrite" }
    ]
  }
}

IMPORTANT: The "keyMetrics" section is REQUIRED. It must contain:
- topKeywords: Top 5 performing keywords with spend, conversions, CPA, and CTR
- bottomKeywords: Bottom 5 keywords with wasted spend (high spend, zero conversions)
- ctrByPlatform: CTR percentage for each platform
- headlineEffectiveness: Notes on which headlines/descriptions are performing well vs poorly

This structured data is used for machine learning and health scoring. Be thorough and specific.

Be specific with numbers. Every insight MUST reference CPL or CPA metrics when relevant. The client cares most about cost efficiency.

WRITING STYLE FOR INSIGHTS:
- Write for a business owner, not a marketer. Assume no marketing background.
- Spell out acronyms on first use: "Cost Per Acquisition (CPA)" not just "CPA", "Cost Per Lead (CPL)" not just "CPL", "Return On Ad Spend (ROAS)" not just "ROAS".
- Use full campaign type names: "Performance Max" not "PMAX", "Search" not "SEM".
- Remove pipe characters from campaign names: "Search - General" not "Search | General".
- No emoji symbols in titles or descriptions.
- Lead with business impact: "You're paying $37 per customer" not "CPA at $37".
- Use comparisons that make sense: "24% cheaper than the industry average" not "24% below benchmark".
- Write descriptions that explain WHY something matters, not just what it is.

## DATA SOURCE HIERARCHY
When multiple data sources are provided, use this priority order:
1. **SUPERMETRICS LIVE DATA** — This is the MOST AUTHORITATIVE source. Real API data directly from Google Ads and Meta Ads. Always use these numbers for spend, clicks, impressions, conversions, CPA, CPC, CTR.
2. **LOOKER STUDIO** — Visual dashboard, useful for cross-referencing but may lag behind. Use to supplement Supermetrics.
3. **GOOGLE SHEETS** — Manual ad update log. Use for context on campaign changes made.
4. **GA4** — Conversion attribution data. Use to verify conversion counts.
5. **SEMRUSH** — Competitive intelligence and keyword intelligence. Use for context only.

If Supermetrics data is present in the GOOGLE SHEETS section (marked "SUPERMETRICS LIVE AD DATA"), ALWAYS treat those numbers as ground truth.`;

    let userContent: any[] = [];
    let dataContext = `Client: ${clientName}\nDate Range: ${dateRange?.start} to ${dateRange?.end}\n\n`;

    // Inject persistent AI memory if available
    if (aiMemory) {
      dataContext += `=== AI MEMORY (Past Learnings for ${clientName}) ===\n${aiMemory}\n\n`;
    }

    // PRIMARY DATA SOURCE: Looker Studio extracted data (text, tables, metrics)
    if (lookerData?.markdown || lookerData?.extractedMetrics) {
      dataContext += `=== LOOKER STUDIO DASHBOARD DATA (PRIMARY SOURCE) ===\n`;
      if (lookerUrl) dataContext += `Dashboard URL: ${lookerUrl}\n\n`;
      
      // Add extracted metrics
      if (lookerData.extractedMetrics) {
        const em = lookerData.extractedMetrics;
        
        if (Object.keys(em.metrics).length > 0) {
          dataContext += `## EXTRACTED METRICS:\n`;
          for (const [key, value] of Object.entries(em.metrics)) {
            dataContext += `- ${key}: ${value}\n`;
          }
          dataContext += '\n';
        }
        
        if (em.tables.length > 0) {
          dataContext += `## EXTRACTED TABLES:\n`;
          for (let i = 0; i < em.tables.length; i++) {
            const table = em.tables[i];
            dataContext += `\nTable ${i + 1}:\n`;
            dataContext += `| ${table.headers.join(' | ')} |\n`;
            dataContext += `| ${table.headers.map(() => '---').join(' | ')} |\n`;
            for (const row of table.rows) {
              dataContext += `| ${row.join(' | ')} |\n`;
            }
          }
          dataContext += '\n';
        }
        
        if (em.kpis.length > 0) {
          dataContext += `## KPI VALUES:\n`;
          for (const kpi of em.kpis) {
            dataContext += `- ${kpi.label}: ${kpi.value}\n`;
          }
          dataContext += '\n';
        }
        
        if (em.rawNumbers.length > 0) {
          dataContext += `## RAW NUMBERS FOUND: ${em.rawNumbers.slice(0, 20).join(', ')}\n\n`;
        }
      }
      
      // Add full markdown content (contains all text from dashboard)
      if (lookerData.markdown) {
        dataContext += `## FULL DASHBOARD CONTENT:\n${lookerData.markdown.substring(0, 15000)}\n\n`;
      }
      
      dataContext += `Data Quality: ${lookerData.qa?.dataQuality || 'unknown'} (${lookerData.qa?.metricsCount || 0} metrics, ${lookerData.qa?.tableCount || 0} tables found)\n\n`;
    } else if (lookerUrl || lookerContent) {
      // Fallback to old lookerContent format
      dataContext += `=== LOOKER STUDIO DASHBOARD ===\n`;
      if (lookerUrl) dataContext += `Dashboard URL: ${lookerUrl}\n`;
      if (lookerContent) dataContext += `${lookerContent}\n`;
      dataContext += '\n';
    }

    // SECONDARY: Google Sheets data
    if (sheetsData) {
      dataContext += `=== GOOGLE SHEETS AD DATA ===\n${sheetsData}\n\n`;
    }

    // Build user content with priority on extracted data, screenshots for QA
    const hasExtractedData = !!(lookerData?.markdown || lookerData?.extractedMetrics);
    const hasScreenshots = screenshots && screenshots.length > 0;

    if (hasExtractedData && hasScreenshots) {
      // BEST CASE: We have both extracted data AND screenshots for verification
      userContent.push({
        type: "text",
        text: `Analyze the ad performance for ${clientName} using BOTH sources below.

## ANALYSIS APPROACH:
1. **PRIMARY**: Use the EXTRACTED DATA (tables, metrics, text) as your main data source
2. **QA VERIFICATION**: Cross-reference against the screenshots to confirm accuracy
3. If there's a discrepancy, the SCREENSHOT visual data takes precedence

${dataContext}

## SCREENSHOT QA VERIFICATION:
The following ${screenshots.length} screenshot(s) are provided for quality assurance. Use them to:
- VERIFY the extracted metrics match what's visually displayed
- IDENTIFY any metrics that weren't captured in text extraction
- CONFIRM platform breakdown and spend amounts

After analysis, note any discrepancies between extracted data and screenshots.

Provide comprehensive analysis following the JSON format in your instructions.`
      });

      // Add screenshots for visual QA
      for (const screenshot of screenshots) {
        userContent.push({
          type: "image_url",
          image_url: { url: screenshot }
        });
      }
    } else if (hasScreenshots) {
      // FALLBACK: Screenshots only (no extracted data)
      userContent.push({
        type: "text",
        text: `Analyze these ${screenshots.length} Looker Studio dashboard screenshots for ${clientName}.

${dataContext}

## CRITICAL: EXTRACT ACTUAL VALUES FROM THE SCREENSHOTS
You MUST read and extract the ACTUAL numeric values visible in these dashboard screenshots. DO NOT return "N/A" - look carefully at every number, chart, and metric shown.

### STEP-BY-STEP EXTRACTION PROCESS:
1. **Scan each screenshot carefully** - Look for KPI cards, metrics boxes, data tables, and chart values
2. **Identify platforms by visual cues**:
   - Google Ads: Look for "Google Ads", "Search", "Display", "Shopping", "PMAX", "Performance Max" labels
   - Meta/Facebook: Look for "Meta", "Facebook", "Instagram", "FB/IG" labels
   - Other platforms: LinkedIn, TikTok, Microsoft Ads, etc.
3. **Extract EXACT values for each platform you find**:
   - Total Spend (look for "Cost", "Spend", "$" amounts)
   - Impressions (look for "Impr", "Impressions", large numbers)
   - Clicks (look for "Clicks", click counts)
   - CTR (look for "CTR", percentage with % sign)
   - CPC (look for "CPC", "Avg. CPC", dollar amounts)
   - Conversions (look for "Conv", "Conversions", "Leads", "Sales")
   - ROAS (look for "ROAS", "Return", ratio like "3.2x" or "320%")
   - Conversion Rate (look for "Conv. Rate", "CVR", percentages)
4. **Read chart data** - If there are line charts or bar graphs, describe the trends you see
5. **Note any comparison data** - Week-over-week, month-over-month changes shown

### IMPORTANT:
- If a value IS visible in the screenshot, you MUST extract it - DO NOT say "N/A"
- If a value truly cannot be found anywhere, estimate it from related metrics OR explain what data IS available
- The "platforms" array should contain EVERY paid platform visible in the dashboards
- Each platform entry must have actual numbers, not placeholders

Provide comprehensive analysis with REAL extracted values following the JSON format.`
      });

      for (const screenshot of screenshots) {
        userContent.push({
          type: "image_url",
          image_url: { url: screenshot }
        });
      }
    } else if (hasExtractedData || sheetsData || lookerUrl) {
      // TEXT DATA ONLY (no screenshots)
      userContent.push({
        type: "text",
        text: `Analyze this ad performance data for ${clientName}:

${dataContext}

Note: No screenshots available for visual verification. Analysis is based on extracted text data only.

Provide comprehensive analysis following the JSON format in your instructions. Extract all metrics and provide specific, actionable insights.`
      });
    } else {
      return new Response(
        JSON.stringify({ error: "No valid data provided. Please ensure Looker Studio data or screenshots are available." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending to Claude for deep analysis...");

    // Convert OpenAI-style content blocks to Anthropic format
    const anthropicContent = userContent.map((item: any) => {
      if (item.type === "text") return { type: "text", text: item.text };
      if (item.type === "image_url") {
        const url = item.image_url?.url || item.image_url;
        if (typeof url === "string" && url.startsWith("data:image/")) {
          const match = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
          if (match) {
            return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
          }
        }
        return { type: "image", source: { type: "url", url } };
      }
      return item;
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: anthropicContent }],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      throw new Error("Failed to analyze ad data");
    }

    const data = await response.json();
    const aiContent = data.content?.[0]?.text || '';
    
    if (!aiContent || aiContent.trim().length === 0) {
      console.error("Claude returned empty content. stop_reason:", data.stop_reason);
      throw new Error("AI returned no analysis content");
    }

    console.log("Claude response received, content length:", aiContent.length, "stop_reason:", data.stop_reason);

    // Parse the JSON response with robust extraction
    let analysis;
    try {
      let jsonString = aiContent;
      // Strip markdown code blocks
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1];
      }
      
      // Find JSON boundaries
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
      
      // Remove trailing commas and control characters
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      jsonString = jsonString.replace(/[\x00-\x1F\x7F]/g, ' ');
      
      // Detect truncation
      const openBraces = (jsonString.match(/{/g) || []).length;
      const closeBraces = (jsonString.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        console.warn(`JSON appears truncated: ${openBraces} open braces, ${closeBraces} close braces. Attempting repair...`);
        // Close unclosed braces/brackets
        let repaired = jsonString;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        // Remove trailing partial values (unfinished strings, etc.)
        repaired = repaired.replace(/,\s*"[^"]*$/, '');
        repaired = repaired.replace(/,\s*$/, '');
        for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
        jsonString = repaired;
      }
      
      analysis = JSON.parse(jsonString.trim());
      
      // QA VALIDATION: Check for $0 spend or N/A values that indicate extraction failure
      const qaIssues: string[] = [];
      
      if (analysis.platforms && Array.isArray(analysis.platforms)) {
        for (const platform of analysis.platforms) {
          const spendValue = platform.spend?.toString().replace(/[^0-9.]/g, '') || '0';
          const spendNum = parseFloat(spendValue);
          
          // Flag if spend is $0 or very low (likely extraction error)
          if (spendNum === 0 || spendNum < 1) {
            qaIssues.push(`${platform.name}: Spend is $0 or N/A - likely extraction error`);
          }
          
          // Check for N/A in critical metrics
          const criticalMetrics = ['spend', 'clicks', 'impressions', 'cpc', 'ctr'];
          for (const metric of criticalMetrics) {
            const value = platform[metric]?.toString().toLowerCase();
            if (value === 'n/a' || value === 'na' || value === 'null' || value === 'undefined' || value === '') {
              qaIssues.push(`${platform.name}: ${metric} is N/A`);
            }
          }
        }
      }
      
      // If QA issues found, add a warning to the analysis
      if (qaIssues.length > 0) {
        console.warn("QA VALIDATION ISSUES DETECTED:", qaIssues);
        
        // Add QA warning to insights
        if (!analysis.insights) analysis.insights = [];
        analysis.insights.unshift({
          type: "warning",
          title: "Data Extraction Quality Issue",
          description: `Some metrics may not have extracted correctly from the screenshots: ${qaIssues.slice(0, 3).join('; ')}. For best results, upload clear screenshots showing spend, clicks, and conversion data.`,
          impact: "high"
        });
        
        // Add QA metadata
        analysis.qaValidation = {
          passed: false,
          issues: qaIssues,
          recommendation: "Re-run analysis with clearer screenshots showing spend and conversion metrics"
        };
      } else {
        analysis.qaValidation = {
          passed: true,
          issues: [],
          recommendation: null
        };
      }
      
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      console.log("Raw content:", aiContent.substring(0, 500));
      
      analysis = {
        summary: `Analysis for ${clientName} completed with partial results. The AI provided insights but the format was unexpected. Please try again or upload additional dashboard screenshots for better analysis.`,
        platforms: [],
        insights: [
          {
            type: "action",
            title: "Review Data Format",
            description: "Consider uploading additional dashboard screenshots for more accurate analysis.",
            impact: "medium"
          }
        ],
        recommendations: [
          {
            priority: "medium",
            action: "Upload multiple Looker Studio screenshots covering different report views",
            expectedImpact: "More accurate and detailed analysis with specific metrics",
            platform: "Both",
            effort: "quick-win",
            timeline: "immediate"
          }
        ],
        weekOverWeek: [],
        rawAnalysis: aiContent.substring(0, 1000),
        qaValidation: {
          passed: false,
          issues: ["JSON parsing failed"],
          recommendation: "Upload clearer screenshots and try again"
        }
      };
    }

    console.log("Ad review analysis complete for:", clientName);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        metadata: {
          analyzedAt: new Date().toISOString(),
          screenshotCount: screenshots?.length || 0,
          hasSheets: !!sheetsData,
          hasLooker: !!lookerUrl,
          hasPaidAdData: !!paidAdData,
          hasGA4Data: !!ga4Data,
          hasBenchmarks: !!benchmarkData,
          hasPreviousReview: !!previousReview
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ad review error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze ad data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Quick health check function for sidebar
async function handleHealthCheck(
  clientName: string, 
  screenshots: string[], 
  content: string,
  apiKey: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const systemPrompt = `You are a quick ad health analyzer. Determine if a client's ad campaigns are:
- "healthy" - performing well, no major issues
- "warning" - some concerns that need attention
- "critical" - serious issues requiring immediate action

Analyze the dashboard screenshot(s) and/or content provided. Look for:
- Campaign status (active, paused, stopped)
- Key metrics (CTR, conversions, spend)
- Any warnings or alerts visible
- Performance trends (up, down, flat)

Respond with ONLY this JSON:
{
  "status": "healthy|warning|critical",
  "reason": "Brief 10-word max explanation"
}`;

    let userContent: any[] = [];
    
    if (screenshots.length > 0) {
      userContent.push({
        type: "text",
        text: `Quick health check for ${clientName}. Analyze these dashboard screenshots and determine campaign health status.`
      });
      
      for (const screenshot of screenshots) {
        userContent.push({
          type: "image_url",
          image_url: { url: screenshot }
        });
      }
    } else if (content) {
      userContent.push({
        type: "text",
        text: `Quick health check for ${clientName}. Analyze this dashboard content:\n\n${content.substring(0, 2000)}`
      });
    } else {
      return new Response(
        JSON.stringify({ 
          healthCheck: { 
            status: 'unknown', 
            reason: 'No data available for health check' 
          } 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert content blocks to Anthropic format
    const anthropicContent = userContent.map((item: any) => {
      if (item.type === "text") return { type: "text", text: item.text };
      if (item.type === "image_url") {
        const url = item.image_url?.url || item.image_url;
        if (typeof url === "string" && url.startsWith("data:image/")) {
          const match = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
          if (match) {
            return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
          }
        }
        return { type: "image", source: { type: "url", url } };
      }
      return item;
    });

    // Use Claude Haiku for quick health checks (fast + cheap)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: anthropicContent }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error("Health check Claude error:", response.status);
      return new Response(
        JSON.stringify({
          healthCheck: {
            status: 'unknown',
            reason: 'AI analysis failed'
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const responseContent = data.content?.[0]?.text || '';
    
    // Parse the health check response
    try {
      let jsonString = responseContent;
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1];
      }
      
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
      
      const healthCheck = JSON.parse(jsonString.trim());
      
      return new Response(
        JSON.stringify({ healthCheck }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Health check parse error:", parseError);
      
      // Fallback: analyze response text for keywords
      const lower = responseContent.toLowerCase();
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let reason = 'Dashboard active';
      
      if (lower.includes('critical') || lower.includes('stopped') || lower.includes('paused') || lower.includes('no data')) {
        status = 'critical';
        reason = 'Campaign issues detected';
      } else if (lower.includes('warning') || lower.includes('decrease') || lower.includes('below')) {
        status = 'warning';
        reason = 'Performance needs attention';
      } else if (lower.includes('healthy') || lower.includes('performing') || lower.includes('good')) {
        status = 'healthy';
        reason = 'Performance looks good';
      }
      
      return new Response(
        JSON.stringify({ healthCheck: { status, reason } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({ 
        healthCheck: { 
          status: 'unknown', 
          reason: 'Health check failed' 
        } 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

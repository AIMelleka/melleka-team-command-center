import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_DATABASE_ID = "9e7cd72f-e62c-4514-9456-5f51cbcfe981"; // IN HOUSE TO DO parent database
const LOOKER_DIRECTORY_SPREADSHEET_ID = "1t43DRbgSo7pOqKh2DIt7xSsKrN6JgLgLSWAJe92SDQI";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

interface AnalysisRequest {
  clientName: string;
  domain: string;
  semrushData?: any;
  websiteData?: any;
  saveToHistory?: boolean;
}

interface SiteAuditData {
  siteAuditUrl: string | null;
  errors: number | null;
  warnings: number | null;
  notices: number | null;
  healthScore: number | null;
  rawContent?: string;
}

// Generate client name aliases for fuzzy matching
function generateClientAliases(clientName: string): string[] {
  const name = clientName.toLowerCase();
  const aliases = [name];
  
  const words = name.split(/\s+/);
  if (words.length > 1) {
    aliases.push(words.map(w => w[0]).join(''));
    aliases.push(words[0]);
    const withoutSuffixes = name.replace(/\s+(inc|llc|ltd|corp|company|co|foundation|group|services)\.?$/i, '');
    if (withoutSuffixes !== name) aliases.push(withoutSuffixes);
  }
  
  aliases.push(name.replace(/\s+/g, '-'));
  aliases.push(name.replace(/\s+/g, '_'));
  aliases.push(name.replace(/\s+/g, ''));
  
  return [...new Set(aliases)];
}

// Fetch Google access token for Sheets API
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  
  const base64url = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const headerB64 = base64url(header);
  const claimsB64 = base64url(claims);
  const signatureInput = `${headerB64}.${claimsB64}`;
  
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${await tokenResponse.text()}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Fetch site audit URL from Looker Directory sheet for a client
async function fetchSiteAuditUrl(clientName: string): Promise<string | null> {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) {
    console.log("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    return null;
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountJson);
    const rangeParam = encodeURIComponent("Sheet1!A:E");
    const dataUrl = `${SHEETS_API_BASE}/${LOOKER_DIRECTORY_SPREADSHEET_ID}/values/${rangeParam}`;
    
    const response = await fetch(dataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      console.error("Failed to fetch sheet data:", await response.text());
      return null;
    }
    
    const sheetData = await response.json();
    const rows = sheetData.values || [];
    
    if (rows.length < 2) return null;
    
    const headers = rows[0];
    const siteAuditIndex = headers.findIndex((h: string) => 
      h.toLowerCase().includes('site audit') || h.toLowerCase().includes('audit')
    );
    const clientNameIndex = headers.findIndex((h: string) => 
      h.toLowerCase().includes('client')
    );
    
    if (siteAuditIndex === -1 || clientNameIndex === -1) {
      console.log("Required columns not found in sheet");
      return null;
    }
    
    // Generate aliases for fuzzy matching
    const clientAliases = generateClientAliases(clientName);
    
    // Find the matching row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowClientName = (row[clientNameIndex] || "").toLowerCase();
      
      // Check if any alias matches
      const matches = clientAliases.some(alias => 
        rowClientName.includes(alias) || alias.includes(rowClientName.split(' - ')[0].trim())
      );
      
      if (matches && row[siteAuditIndex]) {
        console.log(`Found site audit URL for ${clientName}: ${row[siteAuditIndex]}`);
        return row[siteAuditIndex];
      }
    }
    
    console.log(`No site audit URL found for client: ${clientName}`);
    return null;
  } catch (error) {
    console.error("Error fetching site audit URL:", error);
    return null;
  }
}

// Scrape myinsights.io dashboard to extract error counts
async function scrapeSiteAuditData(auditUrl: string): Promise<SiteAuditData> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  const result: SiteAuditData = {
    siteAuditUrl: auditUrl,
    errors: null,
    warnings: null,
    notices: null,
    healthScore: null,
  };
  
  if (!FIRECRAWL_API_KEY) {
    console.log("FIRECRAWL_API_KEY not configured, skipping site audit scrape");
    return result;
  }
  
  try {
    console.log(`Scraping site audit dashboard: ${auditUrl}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: auditUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dashboard to load
      }),
    });
    
    if (!response.ok) {
      console.error("Firecrawl scrape failed:", response.status);
      return result;
    }
    
    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    result.rawContent = markdown;
    
    console.log(`Scraped ${markdown.length} characters from site audit`);
    
    // Parse error counts from the markdown content
    // Look for patterns like "42 errors", "Errors: 42", "42 Errors Found", etc.
    const errorPatterns = [
      /(\d+)\s*(?:site\s*)?errors?/gi,
      /errors?[:\s]*(\d+)/gi,
      /critical[:\s]*(\d+)/gi,
    ];
    
    const warningPatterns = [
      /(\d+)\s*warnings?/gi,
      /warnings?[:\s]*(\d+)/gi,
    ];
    
    const noticePatterns = [
      /(\d+)\s*notices?/gi,
      /notices?[:\s]*(\d+)/gi,
      /(\d+)\s*passed/gi,
    ];
    
    const healthPatterns = [
      /(?:health|score|grade)[:\s]*(\d+)(?:\s*%)?/gi,
      /(\d+)(?:\s*%)?(?:\s*(?:health|score))/gi,
    ];
    
    // Extract numbers using patterns
    for (const pattern of errorPatterns) {
      const match = pattern.exec(markdown);
      if (match) {
        result.errors = parseInt(match[1], 10);
        break;
      }
    }
    
    for (const pattern of warningPatterns) {
      const match = pattern.exec(markdown);
      if (match) {
        result.warnings = parseInt(match[1], 10);
        break;
      }
    }
    
    for (const pattern of noticePatterns) {
      const match = pattern.exec(markdown);
      if (match) {
        result.notices = parseInt(match[1], 10);
        break;
      }
    }
    
    for (const pattern of healthPatterns) {
      const match = pattern.exec(markdown);
      if (match) {
        const score = parseInt(match[1], 10);
        if (score <= 100) {
          result.healthScore = score;
          break;
        }
      }
    }
    
    console.log(`Site audit parsed: errors=${result.errors}, warnings=${result.warnings}, health=${result.healthScore}`);
    
    return result;
  } catch (error) {
    console.error("Error scraping site audit:", error);
    return result;
  }
}

// Fetch site audit data for a client
async function fetchSiteAuditForClient(clientName: string): Promise<SiteAuditData> {
  const auditUrl = await fetchSiteAuditUrl(clientName);
  
  if (!auditUrl) {
    return {
      siteAuditUrl: null,
      errors: null,
      warnings: null,
      notices: null,
      healthScore: null,
    };
  }
  
  return await scrapeSiteAuditData(auditUrl);
}

// Fetch ALL work done for this client from Notion (SEO = blogs, content, technical, links, etc.)
async function fetchNotionClientTasks(clientName: string): Promise<{ completed: number; tasks: any[]; categories: Record<string, number> }> {
  const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
  if (!NOTION_API_KEY) {
    console.log("NOTION_API_KEY not configured");
    return { completed: 0, tasks: [], categories: {} };
  }

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const clientAliases = generateClientAliases(clientName);
    console.log(`Notion query for client: "${clientName}", aliases: ${JSON.stringify(clientAliases)}`);

    // SIMPLIFIED QUERY: Just get all Done tasks from last 90 days that mention client name
    // We'll filter SEO-related tasks in post-processing
    const clientFilters = clientAliases.map(alias => ({
      property: "Task name", 
      title: { contains: alias }
    }));

    console.log(`Querying Notion with ${clientFilters.length} client name filters`);

    // First, try a simple query - just Done tasks mentioning client
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          and: [
            // Must be completed
            {
              property: "Done",
              status: { equals: "Done" }
            },
            // Within last 90 days
            {
              property: "Last edited time",
              date: { on_or_after: ninetyDaysAgo.toISOString() }
            },
            // Client name in task title
            {
              or: clientFilters
            }
          ]
        },
        sorts: [{ property: "Last edited time", direction: "descending" }],
        page_size: 100
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Notion API error response:", response.status, errorText);
      
      // Try alternate: maybe "Done" property doesn't exist, try without status filter
      console.log("Trying fallback query without Done status filter...");
      const fallbackResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            and: [
              {
                property: "Last edited time",
                date: { on_or_after: ninetyDaysAgo.toISOString() }
              },
              {
                or: clientFilters
              }
            ]
          },
          sorts: [{ property: "Last edited time", direction: "descending" }],
          page_size: 100
        }),
      });
      
      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text();
        console.error("Notion fallback also failed:", fallbackResponse.status, fallbackError);
        
        // Last resort: get ALL recent tasks and filter by client name in code
        console.log("Trying last resort query: all recent tasks...");
        const lastResortResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${NOTION_API_KEY}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filter: {
              property: "Last edited time",
              date: { on_or_after: ninetyDaysAgo.toISOString() }
            },
            sorts: [{ property: "Last edited time", direction: "descending" }],
            page_size: 100
          }),
        });
        
        if (!lastResortResponse.ok) {
          console.error("All Notion queries failed:", await lastResortResponse.text());
          return { completed: 0, tasks: [], categories: {} };
        }
        
        const lastResortData = await lastResortResponse.json();
        console.log(`Last resort query returned ${lastResortData.results?.length || 0} total tasks`);
        
        // Filter by client name in code
        const filteredResults = (lastResortData.results || []).filter((page: any) => {
          const title = (page.properties?.["Task name"]?.title?.[0]?.plain_text || "").toLowerCase();
          return clientAliases.some(alias => title.includes(alias));
        });
        
        console.log(`After client filter: ${filteredResults.length} tasks for ${clientName}`);
        return processAndCategorizeTasks(filteredResults);
      }
      
      const fallbackData = await fallbackResponse.json();
      console.log(`Fallback query returned ${fallbackData.results?.length || 0} tasks`);
      return processAndCategorizeTasks(fallbackData.results || []);
    }

    const data = await response.json();
    console.log(`Primary query returned ${data.results?.length || 0} tasks for ${clientName}`);
    
    // Log first task properties for debugging
    if (data.results?.length > 0) {
      const firstTask = data.results[0];
      console.log("Sample task properties:", Object.keys(firstTask.properties || {}));
    }

    return processAndCategorizeTasks(data.results || []);
  } catch (error) {
    console.error("Notion fetch error:", error);
    return { completed: 0, tasks: [], categories: {} };
  }
}

function processAndCategorizeTasks(results: any[]): { completed: number; tasks: any[]; categories: Record<string, number> } {
  const categories: Record<string, number> = {
    "Blog/Content": 0,
    "Technical SEO": 0,
    "On-Page SEO": 0,
    "Link Building": 0,
    "Local SEO": 0,
    "Analytics/Reporting": 0,
    "General Web": 0
  };

  const tasks = results.map((page: any) => {
    const title = page.properties?.["Task name"]?.title?.[0]?.plain_text || "Untitled";
    const titleLower = title.toLowerCase();
    const doneStatus = page.properties?.["Done"]?.status?.name || "Unknown";
    const clients = page.properties?.["CLIENTS"]?.rich_text?.[0]?.plain_text || "";
    const lastEdited = page.last_edited_time;
    const completedOn = page.properties?.["Completed on"]?.date?.start;
    
    // Categorize the task
    let category = "General Web";
    if (/blog|article|content|copy|writing|writer|post/i.test(titleLower)) {
      category = "Blog/Content";
      categories["Blog/Content"]++;
    } else if (/technical|speed|performance|core web|crawl|index|schema|sitemap|robots|redirect|301|404|canonical|structured/i.test(titleLower)) {
      category = "Technical SEO";
      categories["Technical SEO"]++;
    } else if (/meta|title tag|h1|h2|heading|alt text|description|keyword|on-?page|internal link/i.test(titleLower)) {
      category = "On-Page SEO";
      categories["On-Page SEO"]++;
    } else if (/backlink|link building|outreach|guest post|citation|external link|off-?page|referring/i.test(titleLower)) {
      category = "Link Building";
      categories["Link Building"]++;
    } else if (/gmb|google business|local seo|map|nap|review/i.test(titleLower)) {
      category = "Local SEO";
      categories["Local SEO"]++;
    } else if (/ranking|traffic|organic|analytics|search console|gsc|serp|report/i.test(titleLower)) {
      category = "Analytics/Reporting";
      categories["Analytics/Reporting"]++;
    } else {
      categories["General Web"]++;
    }
    
    return { 
      title: title.replace(/https?:\/\/[^\s]+/g, '').trim(), 
      status: doneStatus, 
      clients,
      lastEdited,
      completedOn: completedOn || lastEdited,
      category
    };
  }) || [];

  return { completed: tasks.length, tasks, categories };
}

// Fetch historical SEO data for trending
async function fetchSeoHistory(domain: string, supabaseUrl: string, supabaseKey: string): Promise<any[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('seo_history')
      .select('analysis_date, organic_keywords, organic_traffic, domain_authority, backlinks, notion_tasks_completed')
      .eq('domain', domain)
      .order('analysis_date', { ascending: true })
      .limit(12);
    
    if (error) {
      console.error("Error fetching SEO history:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("SEO history fetch error:", error);
    return [];
  }
}

// Save analysis to history
async function saveSeoHistory(
  clientName: string,
  domain: string,
  analysis: any,
  notionData: { completed: number; tasks: any[]; categories: Record<string, number> },
  supabaseUrl: string,
  supabaseKey: string,
  userId?: string
): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase.from('seo_history').insert({
      client_name: clientName,
      domain: domain,
      analysis_date: new Date().toISOString().split('T')[0],
      organic_keywords: analysis.metrics?.organicKeywords || 0,
      organic_traffic: analysis.metrics?.organicTraffic || 0,
      domain_authority: analysis.metrics?.domainAuthority || 0,
      backlinks: analysis.metrics?.backlinks || 0,
      referring_domains: analysis.metrics?.referringDomains || 0,
      paid_keywords: analysis.metrics?.paidKeywords || 0,
      paid_traffic: analysis.metrics?.paidTraffic || 0,
      full_analysis: analysis,
      top_keywords: analysis.topKeywords || [],
      competitors: analysis.competitors || [],
      recommendations: analysis.recommendations || [],
      notion_tasks_completed: notionData.completed,
      notion_task_details: { tasks: notionData.tasks, categories: notionData.categories },
      slack_messages_count: 0,
      slack_highlights: [],
      overall_health: analysis.overallHealth,
      summary: analysis.summary,
      created_by: userId || null
    });

    if (error) {
      console.error("Error saving SEO history:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("SEO history save error:", error);
    return false;
  }
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
    const { clientName, domain, semrushData, websiteData, saveToHistory = true }: AnalysisRequest = await req.json();

    // AI analysis uses the shared Claude helper (ANTHROPIC_API_KEY checked inside callClaude)

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    console.log("SEO Bot analysis started:", { clientName, domain, hasSemrush: !!semrushData, hasWebsite: !!websiteData });

    // Fetch Notion tasks, history, and site audit data in parallel
    const [notionData, historyData, siteAuditData] = await Promise.all([
      fetchNotionClientTasks(clientName),
      fetchSeoHistory(domain, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
      fetchSiteAuditForClient(clientName)
    ]);

    console.log("Notion tasks found:", notionData.completed, "Categories:", JSON.stringify(notionData.categories), "History entries:", historyData.length);
    console.log("Site audit data:", { url: siteAuditData.siteAuditUrl, errors: siteAuditData.errors, warnings: siteAuditData.warnings, health: siteAuditData.healthScore });

    // Build comprehensive system prompt
    const systemPrompt = `You are an expert SEO analyst with 15+ years of experience in search engine optimization, content strategy, and technical SEO. You provide actionable, data-driven insights that help businesses improve their organic search visibility.

## YOUR ROLE
Analyze the provided SEO data and generate a comprehensive report that:
1. Assesses overall SEO health based on key metrics
2. Identifies strengths and weaknesses in the current SEO strategy
3. Highlights keyword opportunities and gaps vs competitors
4. Provides specific, prioritized recommendations
5. Suggests content opportunities based on search demand
6. IMPORTANT: Incorporates and celebrates the SEO work completed (from Notion task tracking)

## ANALYSIS FRAMEWORK

### Health Assessment Criteria:
- **Excellent**: Strong domain authority (40+), growing organic traffic, ranking for high-value keywords, good backlink profile
- **Good**: Moderate domain authority (20-40), stable traffic, some keyword rankings, building backlinks
- **Warning**: Low domain authority (10-20), declining traffic, few keyword rankings, weak backlink profile
- **Critical**: Very low domain authority (<10), minimal organic traffic, no meaningful keyword rankings

### Key Metrics to Analyze:
- Organic Keywords: Total number of keywords ranking in top 100
- Organic Traffic: Estimated monthly organic visitors
- Domain Authority: Overall site authority score
- Backlinks: Total backlinks and referring domains
- Top Keywords: Best performing keyword rankings
- Competitors: Who is competing for the same keywords
- **SITE AUDIT ERRORS**: This is CRITICAL - if provided, analyze the number of site errors found. High error counts indicate technical SEO problems that hurt rankings.

## SITE AUDIT ANALYSIS
If site audit data is provided, this is one of the most important factors for SEO health:
- **0-10 errors**: Excellent technical health
- **11-50 errors**: Good, but room for improvement  
- **51-200 errors**: Warning - significant technical issues need attention
- **200+ errors**: Critical - technical problems are likely hurting rankings

Always mention the site error count prominently in your analysis and recommendations if available.

## WORK PROGRESS SUMMARY
This is CRITICAL - you must provide a detailed, enthusiastic summary of the SEO work that has been completed. 
SEO work includes: blogs, articles, content writing, technical fixes, on-page optimization, link building, local SEO, and any web work.
Break down the work by category and highlight the effort put in by the team.

## OUTPUT FORMAT
Return your analysis as structured JSON:
{
  "summary": "2-3 sentence executive summary of SEO health and key findings",
  "overallHealth": "excellent|good|warning|critical",
  "metrics": {
    "domain": "example.com",
    "organicKeywords": 1234,
    "organicTraffic": 5678,
    "domainAuthority": 35,
    "backlinks": 12345,
    "referringDomains": 234,
    "paidKeywords": 50,
    "paidTraffic": 1000,
    "paidTrafficCost": 5000,
    "siteErrors": 42,
    "siteWarnings": 15,
    "siteHealthScore": 78
  },
  "topKeywords": [
    {
      "keyword": "example keyword",
      "position": 3,
      "volume": 1000,
      "cpc": 2.50,
      "url": "https://example.com/page",
      "trafficPercent": 15.5,
      "difficulty": 45
    }
  ],
  "competitors": [
    {
      "domain": "competitor.com",
      "commonKeywords": 150,
      "organicKeywords": 5000,
      "organicTraffic": 25000,
      "paidKeywords": 100
    }
  ],
  "insights": [
    {
      "type": "positive|warning|action|opportunity",
      "title": "Short insight title",
      "description": "Detailed explanation with specific data points",
      "impact": "high|medium|low"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "Specific action to take",
      "expectedImpact": "What improvement to expect",
      "effort": "quick-win|medium|strategic"
    }
  ],
  "keywordGaps": [
    {
      "keyword": "keyword competitor ranks for",
      "competitorRanking": 5,
      "ourPosition": null,
      "volume": 2000,
      "opportunity": "Why this keyword matters"
    }
  ],
  "technicalIssues": [
    {
      "issue": "Technical SEO problem",
      "severity": "high|medium|low",
      "fix": "How to fix it"
    }
  ],
  "contentOpportunities": [
    {
      "topic": "Content topic idea",
      "searchVolume": 5000,
      "difficulty": 35,
      "rationale": "Why this content would perform well"
    }
  ],
  "progressSummary": "Detailed summary of ALL SEO work completed, broken down by category (Blog/Content, Technical SEO, On-Page, Link Building, etc). Be specific about numbers and celebrate the team's efforts!"
}

Be specific with numbers and provide actionable insights. Focus on opportunities that will have the highest ROI.`;

    // Build user content with all available data
    let userContent = `Analyze the SEO performance for ${clientName} (${domain}).\n\n`;

    if (semrushData) {
      userContent += `## SEMRUSH SEO DATA\n`;
      userContent += `Domain: ${semrushData.domain || domain}\n`;
      userContent += `Organic Keywords: ${semrushData.organicKeywords?.toLocaleString() || 'N/A'}\n`;
      userContent += `Organic Traffic: ${semrushData.organicTraffic?.toLocaleString() || 'N/A'}/month\n`;
      userContent += `Domain Authority: ${semrushData.domainAuthority || 'N/A'}\n`;
      userContent += `Backlinks: ${semrushData.backlinks?.toLocaleString() || 'N/A'}\n`;
      userContent += `Referring Domains: ${semrushData.referringDomains?.toLocaleString() || 'N/A'}\n`;
      userContent += `Paid Keywords: ${semrushData.paidKeywords?.toLocaleString() || 'N/A'}\n`;
      userContent += `Paid Traffic: ${semrushData.paidTraffic?.toLocaleString() || 'N/A'}/month\n`;
      userContent += `Paid Traffic Cost: $${semrushData.paidTrafficCost?.toLocaleString() || 'N/A'}/month\n\n`;

      if (semrushData.topKeywords?.length > 0) {
        userContent += `### Top Organic Keywords:\n`;
        for (const kw of semrushData.topKeywords.slice(0, 20)) {
          userContent += `- "${kw.keyword}" - Position: ${kw.position}, Volume: ${kw.volume}, CPC: $${kw.cpc}\n`;
        }
        userContent += '\n';
      }

      if (semrushData.competitors?.length > 0) {
        userContent += `### Organic Competitors:\n`;
        for (const comp of semrushData.competitors.slice(0, 10)) {
          userContent += `- ${comp.domain}: ${comp.commonKeywords} common keywords, ${comp.organicKeywords || 'N/A'} organic KWs, ${comp.organicTraffic?.toLocaleString() || 'N/A'} traffic\n`;
        }
        userContent += '\n';
      }
    } else {
      userContent += `## NOTE: No Semrush data available for this domain. Provide general SEO recommendations based on best practices.\n\n`;
    }

    if (websiteData?.content || websiteData?.title) {
      userContent += `## WEBSITE CONTENT\n`;
      if (websiteData.title) userContent += `Title: ${websiteData.title}\n`;
      if (websiteData.description) userContent += `Meta Description: ${websiteData.description}\n`;
      if (websiteData.content) {
        const contentPreview = websiteData.content.substring(0, 3000);
        userContent += `Content Preview:\n${contentPreview}\n`;
      }
      userContent += '\n';
    }

    // Add Site Audit data - CRITICAL for technical SEO assessment
    userContent += `## SITE AUDIT (Technical SEO Health)\n`;
    if (siteAuditData.siteAuditUrl) {
      userContent += `Source: ${siteAuditData.siteAuditUrl}\n`;
      if (siteAuditData.errors !== null) {
        userContent += `**SITE ERRORS: ${siteAuditData.errors}** - This is a critical metric!\n`;
      }
      if (siteAuditData.warnings !== null) {
        userContent += `Site Warnings: ${siteAuditData.warnings}\n`;
      }
      if (siteAuditData.notices !== null) {
        userContent += `Notices/Passed: ${siteAuditData.notices}\n`;
      }
      if (siteAuditData.healthScore !== null) {
        userContent += `Health Score: ${siteAuditData.healthScore}%\n`;
      }
      if (siteAuditData.rawContent) {
        // Include a summary of the raw content for AI to parse
        const contentSummary = siteAuditData.rawContent.substring(0, 2000);
        userContent += `\n### Raw Audit Data:\n${contentSummary}\n`;
      }
    } else {
      userContent += `No site audit data available for this client.\n`;
    }
    userContent += '\n';

    // Add Notion task data - this is the KEY section for work progress
    userContent += `## COMPLETED SEO WORK (from Notion Task Tracking - Last 90 Days)\n`;
    userContent += `IMPORTANT: This shows all the SEO-related work our team has completed for this client.\n\n`;
    
    if (notionData.completed > 0) {
      userContent += `### TOTAL TASKS COMPLETED: ${notionData.completed}\n\n`;
      
      // Show breakdown by category
      userContent += `### BREAKDOWN BY CATEGORY:\n`;
      for (const [category, count] of Object.entries(notionData.categories)) {
        if (count > 0) {
          userContent += `- ${category}: ${count} tasks\n`;
        }
      }
      userContent += '\n';
      
      // Show recent task examples
      userContent += `### RECENT COMPLETED TASKS:\n`;
      for (const task of notionData.tasks.slice(0, 25)) {
        const date = task.completedOn ? new Date(task.completedOn).toLocaleDateString() : 'Recent';
        userContent += `- [${task.category}] ${task.title} (${date})\n`;
      }
      userContent += '\n';
    } else {
      userContent += `No completed tasks found in Notion for this client in the last 90 days.\n`;
      userContent += `This may mean tasks are tracked differently or the client name doesn't match task records.\n\n`;
    }

    // Add historical trends
    if (historyData.length > 1) {
      userContent += `## HISTORICAL SEO TRENDS\n`;
      const oldest = historyData[0];
      const newest = historyData[historyData.length - 1];
      const trafficChange = newest.organic_traffic - oldest.organic_traffic;
      const keywordChange = newest.organic_keywords - oldest.organic_keywords;
      userContent += `Traffic trend: ${trafficChange >= 0 ? '+' : ''}${trafficChange.toLocaleString()} over ${historyData.length} data points\n`;
      userContent += `Keyword trend: ${keywordChange >= 0 ? '+' : ''}${keywordChange.toLocaleString()} over ${historyData.length} data points\n`;
      userContent += `Total SEO tasks completed (tracked historically): ${historyData.reduce((sum, h) => sum + (h.notion_tasks_completed || 0), 0)}\n\n`;
    }

    userContent += `Provide a comprehensive SEO analysis following the JSON format in your instructions. Be specific with recommendations and prioritize by impact.\n\n`;
    userContent += `CRITICAL: The "progressSummary" field must provide an enthusiastic, detailed breakdown of all the SEO work completed based on the Notion task data above. Mention specific numbers for each category and celebrate the team's efforts!`;

    console.log("Sending to Claude for SEO analysis...");

    let aiContent: string;
    try {
      aiContent = await callClaude(userContent, {
        system: systemPrompt,
        temperature: 0.4,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429')) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Claude API error:", errMsg);
      throw new Error("Failed to analyze SEO data");
    }

    // Parse the JSON response
    let analysis;
    try {
      let jsonString = aiContent;
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1];
      }
      
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
      
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      analysis = JSON.parse(jsonString.trim());
      
      // Ensure metrics are populated from Semrush data if AI didn't extract them
      if (semrushData && analysis.metrics) {
        analysis.metrics = {
          ...analysis.metrics,
          domain: domain,
          organicKeywords: analysis.metrics.organicKeywords || semrushData.organicKeywords,
          organicTraffic: analysis.metrics.organicTraffic || semrushData.organicTraffic,
          domainAuthority: analysis.metrics.domainAuthority || semrushData.domainAuthority,
          backlinks: analysis.metrics.backlinks || semrushData.backlinks,
          referringDomains: analysis.metrics.referringDomains || semrushData.referringDomains,
          paidKeywords: analysis.metrics.paidKeywords || semrushData.paidKeywords,
          paidTraffic: analysis.metrics.paidTraffic || semrushData.paidTraffic,
          paidTrafficCost: analysis.metrics.paidTrafficCost || semrushData.paidTrafficCost,
        };
      }

      // Ensure site audit metrics are populated
      if (siteAuditData && analysis.metrics) {
        analysis.metrics.siteErrors = analysis.metrics.siteErrors ?? siteAuditData.errors;
        analysis.metrics.siteWarnings = analysis.metrics.siteWarnings ?? siteAuditData.warnings;
        analysis.metrics.siteHealthScore = analysis.metrics.siteHealthScore ?? siteAuditData.healthScore;
        analysis.metrics.siteAuditUrl = siteAuditData.siteAuditUrl;
      }

      // Ensure top keywords are populated
      if (semrushData?.topKeywords && (!analysis.topKeywords || analysis.topKeywords.length === 0)) {
        analysis.topKeywords = semrushData.topKeywords.slice(0, 15);
      }

      // Ensure competitors are populated
      if (semrushData?.competitors && (!analysis.competitors || analysis.competitors.length === 0)) {
        analysis.competitors = semrushData.competitors.slice(0, 8).map((c: any) => ({
          domain: c.domain,
          commonKeywords: c.commonKeywords,
          organicKeywords: c.organicKeywords,
          organicTraffic: c.organicTraffic,
          paidKeywords: c.paidKeywords,
        }));
      }
      
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      console.log("Raw content:", aiContent.substring(0, 500));
      
      // Build detailed progress summary from Notion data
      let progressSummary = "";
      if (notionData.completed > 0) {
        progressSummary = `Great progress! ${notionData.completed} SEO tasks completed in the last 90 days. `;
        const categoryBreakdown = Object.entries(notionData.categories)
          .filter(([_, count]) => count > 0)
          .map(([cat, count]) => `${cat}: ${count}`)
          .join(', ');
        progressSummary += `Breakdown: ${categoryBreakdown}.`;
      } else {
        progressSummary = "No tracked SEO tasks found in Notion for this client in the last 90 days.";
      }
      
      // Build fallback analysis from raw Semrush data
      analysis = {
        summary: `SEO analysis for ${clientName} (${domain}). ${semrushData ? `Currently ranking for ${semrushData.organicKeywords?.toLocaleString() || 0} organic keywords with an estimated ${semrushData.organicTraffic?.toLocaleString() || 0} monthly visitors.` : 'Limited data available.'}`,
        overallHealth: semrushData?.organicTraffic > 5000 ? 'good' : semrushData?.organicTraffic > 1000 ? 'warning' : 'critical',
        metrics: {
          domain,
          organicKeywords: semrushData?.organicKeywords || 0,
          organicTraffic: semrushData?.organicTraffic || 0,
          domainAuthority: semrushData?.domainAuthority || 0,
          backlinks: semrushData?.backlinks || 0,
          referringDomains: semrushData?.referringDomains || 0,
          siteErrors: siteAuditData?.errors,
          siteWarnings: siteAuditData?.warnings,
          siteHealthScore: siteAuditData?.healthScore,
          siteAuditUrl: siteAuditData?.siteAuditUrl,
        },
        topKeywords: semrushData?.topKeywords?.slice(0, 15) || [],
        competitors: semrushData?.competitors?.slice(0, 8) || [],
        insights: [
          {
            type: "action",
            title: "Review SEO Data",
            description: "AI analysis encountered an issue. Please review the raw metrics above and try again.",
            impact: "medium"
          }
        ],
        recommendations: [
          {
            priority: "medium",
            action: "Re-run SEO analysis for more detailed insights",
            expectedImpact: "Get specific, actionable SEO recommendations",
            effort: "quick-win"
          }
        ],
        keywordGaps: [],
        technicalIssues: [],
        contentOpportunities: [],
        progressSummary
      };
    }

    // Save to history if requested
    if (saveToHistory && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const saved = await saveSeoHistory(
        clientName,
        domain,
        analysis,
        notionData,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        authResult.userId
      );
      console.log("SEO history saved:", saved);
    }

    console.log("SEO Bot analysis complete for:", clientName);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        notionTasks: notionData,
        slackActivity: { count: 0, highlights: [] }, // Keep for backward compatibility
        historicalData: historyData,
        metadata: {
          analyzedAt: new Date().toISOString(),
          domain,
          hasSemrushData: !!semrushData,
          hasWebsiteData: !!websiteData,
          savedToHistory: saveToHistory
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SEO Bot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze SEO data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

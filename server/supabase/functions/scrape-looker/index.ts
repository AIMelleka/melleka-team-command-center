import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import {
  getDefaultTemplate,
  validateSectionCoverage,
  getAllSectionIds,
  type LookerTemplate,
  type SectionId,
} from "../_shared/lookerTemplates.ts";
import {
  parseCurrency,
  parseInteger,
  parsePercentage,
  validateDateRange,
  type ValidatedMetrics,
} from "../_shared/metricValidation.ts";
import {
  mapCategoryToSectionId,
  deduplicateScreenshots,
  type ScreenshotAnalysis,
  type CropRegion,
} from "../_shared/screenshotOrganizer.ts";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LookerRequest {
  url: string;
  startDate?: string;  // YYYY-MM-DD format
  endDate?: string;    // YYYY-MM-DD format
  clientName?: string; // For context in AI analysis
  captureMultiple?: boolean;  // Capture multiple views/screenshots
  minScreenshots?: number;    // Minimum screenshots to capture (default 12)
  waitMultiplier?: number;    // Multiplier for wait times (for retries)
  templateId?: string;        // Which template to use (default: melleka-standard-v1)
}

interface ScreenshotWithAnalysis {
  image: string;
  section: string;
  scrollPosition: number;
  sectionId?: SectionId;
  category?: string;
  metrics?: Record<string, string>;
  insights?: string[];
  feedback?: string;
  dateRangeConfirmed?: boolean;
  visibleDateRange?: string;
  isDuplicate?: boolean;
  cropRegions?: CropRegion[];
  confidence?: number;
}

/**
 * Enhanced Looker Studio scraper with template-aware extraction
 * 
 * Key improvements:
 * 1. Checkpoint-based scrolling aligned with template sections
 * 2. Template-aware AI prompts for better section identification
 * 3. Bounding box detection for accurate cropping
 * 4. Date range verification with explicit validation
 * 5. Coverage tracking to ensure all required sections are captured
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAdminAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const body: LookerRequest = await req.json();
    const { 
      url, 
      startDate, 
      endDate,
      clientName = "Client",
      captureMultiple = true, 
      minScreenshots = 12,
      waitMultiplier = 1,
      templateId,
    } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!url.includes('lookerstudio.google.com')) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Looker Studio URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the template for this report
    const template = getDefaultTemplate();
    const checkpoints = template.scrollStrategy.checkpointPositions;

    console.log("=== TEMPLATE-AWARE LOOKER STUDIO SCRAPE ===");
    console.log("Template:", template.templateId);
    console.log("Client:", clientName);
    console.log("Original URL:", url);
    console.log("Date range:", startDate, "to", endDate);
    console.log("Checkpoints:", checkpoints.join(", "));
    console.log("Wait multiplier:", waitMultiplier, "x");

    // STEP 1: Modify URL to include date range parameters
    const modifiedUrl = applyDateRangeToUrl(url, startDate, endDate);
    console.log("Modified URL with dates:", modifiedUrl);

    // STEP 2: Capture screenshots at checkpoint positions
    console.log("Step 1: Checkpoint-based screenshot capture...");
    
    const rawScreenshots = await captureCheckpointScreenshots(
      apiKey, 
      modifiedUrl, 
      template,
      waitMultiplier, 
      startDate, 
      endDate
    );
    console.log(`Captured ${rawScreenshots.length} raw screenshots`);

    // STEP 3: Primary content extraction (for text/tables)
    console.log("Step 2: Extracting text content...");
    
    let markdown = "";
    let html = "";
    let links: string[] = [];
    
    try {
      const contentResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: modifiedUrl,
          formats: ["markdown", "html", "links"],
          onlyMainContent: false,
          maxAge: 0,
          storeInCache: false,
          waitFor: 8000,
          timeout: 60000,
        }),
      });

      const contentData = await contentResponse.json();
      if (contentResponse.ok && contentData.success !== false) {
        const scraped = contentData.data || contentData;
        markdown = scraped.markdown || "";
        html = scraped.html || "";
        links = scraped.links || [];
        console.log(`Content extraction: ${markdown.length} chars markdown`);
      }
    } catch (e) {
      console.warn("Content extraction failed:", e);
    }

    // QA VALIDATION: Check for login page
    const loginIndicators = [
      'sign in', 'sign-in', 'login', 'email or phone', 'forgot email',
      'create account', 'continue to looker studio', 'password',
      'authenticate', 'use your google account', 'choose an account'
    ];
    
    const lowerContent = (markdown + html).toLowerCase();
    const loginMatchCount = loginIndicators.filter(ind => lowerContent.includes(ind)).length;
    const isLoginPage = loginMatchCount >= 2;

    if (isLoginPage) {
      console.warn("QA FAILED: Login page detected");
      return new Response(
        JSON.stringify({
          success: false,
          isBlocked: true,
          reason: 'login_page',
          error: "Dashboard requires Google login. Please upload screenshots manually.",
          url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 4: Template-aware AI analysis of EACH screenshot
    console.log("Step 3: Template-aware AI analysis...");
    
    const analyzedScreenshots = await analyzeWithTemplate(
      rawScreenshots, 
      template,
      clientName,
      startDate, 
      endDate
    );
    console.log(`Analyzed ${analyzedScreenshots.length} screenshots`);

    // STEP 5: Remove duplicate images
    console.log("Step 4: Removing duplicate images...");
    
    const uniqueScreenshots = await removeDuplicateScreenshots(analyzedScreenshots);
    console.log(`After deduplication: ${uniqueScreenshots.length} unique screenshots`);

    // STEP 6: Validate section coverage against template
    const capturedSectionIds = uniqueScreenshots
      .map(s => s.sectionId)
      .filter(Boolean) as SectionId[];
    
    const coverageResult = validateSectionCoverage(capturedSectionIds, template);
    console.log(`Section coverage: ${coverageResult.coverage}%`);
    if (coverageResult.missing.length > 0) {
      console.warn("Missing sections:", coverageResult.missing.join(", "));
    }

    // STEP 7: Validate date range
    let dateValidation = null;
    if (startDate && endDate) {
      const dateScreenshot = uniqueScreenshots.find(s => s.dateRangeConfirmed);
      if (dateScreenshot?.visibleDateRange) {
        dateValidation = validateDateRange(
          { startDate, endDate },
          dateScreenshot.visibleDateRange
        );
        console.log("Date validation:", dateValidation.matches ? "PASSED" : "FAILED");
      }
    }

    // STEP 8: Parse extracted content for metrics
    const extractedMetrics = parseMetricsFromContent(markdown, html);

    // Build AI analysis summary from individual screenshot analyses
    const aiAnalysis = buildAIAnalysisSummary(uniqueScreenshots, startDate, endDate);
    const dateRangeConfirmed = computeDateRangeConfirmed(aiAnalysis);

    console.log("=== EXTRACTION RESULTS ===");
    console.log("Raw screenshots:", rawScreenshots.length);
    console.log("Unique screenshots:", uniqueScreenshots.length);
    console.log("Section coverage:", coverageResult.coverage + "%");
    console.log("Date range confirmed:", dateRangeConfirmed);
    console.log("Categories found:", [...new Set(uniqueScreenshots.map(s => s.category))].join(", "));

    // Build response with enhanced structure
    return new Response(
      JSON.stringify({
        success: true,
        url: modifiedUrl,
        originalUrl: url,
        dateRange: { startDate, endDate },
        templateId: template.templateId,
        
        // PRIMARY: All unique screenshots with template-aware analysis
        screenshots: uniqueScreenshots.map(s => ({
          image: s.image,
          section: s.section,
          sectionId: s.sectionId,
          scrollPosition: s.scrollPosition,
          category: s.category || 'unknown',
          metrics: s.metrics || {},
          insights: s.insights || [],
          feedback: s.feedback || '',
          dateRangeConfirmed: s.dateRangeConfirmed,
          visibleDateRange: s.visibleDateRange,
          cropRegions: s.cropRegions || [],
          confidence: s.confidence,
        })),
        
        // Backward compatibility
        screenshot: uniqueScreenshots[0]?.image || null,
        
        // Text content
        markdown,
        html: html.length > 50000 ? html.substring(0, 50000) : html,
        extractedMetrics,
        
        // Combined AI analysis
        aiAnalysis,
        
        // Metadata
        metadata: {
          title: "Looker Studio Dashboard",
          sourceURL: modifiedUrl,
          clientName,
        },
        
        // Enhanced QA with template validation
        qa: {
          rawScreenshotCount: rawScreenshots.length,
          uniqueScreenshotCount: uniqueScreenshots.length,
          duplicatesRemoved: rawScreenshots.length - uniqueScreenshots.length,
          metricsFound: Object.keys(extractedMetrics.metrics).length > 0,
          metricsCount: Object.keys(extractedMetrics.metrics).length,
          capturedAt: new Date().toISOString(),
          dateRangeApplied: !!(startDate && endDate),
          dateRangeConfirmed,
          dateValidation,
          categoriesFound: [...new Set(uniqueScreenshots.map(s => s.category))],
          sectionsCaptured: capturedSectionIds,
          sectionCoverage: coverageResult,
          dataQuality: coverageResult.passed && dateRangeConfirmed 
            ? 'high' 
            : coverageResult.coverage >= 75 
              ? 'medium' 
              : 'low',
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error scraping Looker Studio:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to scrape dashboard",
        isBlocked: true,
        reason: 'exception'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Checkpoint-based screenshot capture
 * 
 * Instead of random scrolling, scrolls to specific pixel positions
 * that correspond to known section locations in the template.
 * This ensures consistent, repeatable screenshot capture.
 */
async function captureCheckpointScreenshots(
  apiKey: string, 
  url: string, 
  template: LookerTemplate,
  waitMultiplier: number = 1,
  startDate?: string,
  endDate?: string
): Promise<ScreenshotWithAnalysis[]> {
  const screenshots: ScreenshotWithAnalysis[] = [];
  const checkpoints = template.scrollStrategy.checkpointPositions;
  
  // Calculate wait times based on template + multiplier
  const { pauseMs, chartsRenderDelayMs } = template.scrollStrategy;
  const initialWait = Math.round(12000 * waitMultiplier);
  const scrollWait = Math.round(pauseMs * waitMultiplier);
  const chartWait = Math.round(chartsRenderDelayMs * waitMultiplier);
  
  console.log(`=== CHECKPOINT-BASED CAPTURE ===`);
  console.log(`Checkpoints: ${checkpoints.length}`);
  console.log(`Wait times: initial=${initialWait}ms, scroll=${scrollWait}ms, charts=${chartWait}ms`);
  
  // Build actions array
  const actions: any[] = [];
  
  // PHASE 1: Initial page load
  actions.push(
    { type: "wait", milliseconds: initialWait },
    { type: "screenshot" } // Checkpoint 0: Initial state
  );
  
  // NOTE: Date picker UI automation removed to stay under Firecrawl's 50-action limit.
  // Dates are passed via URL parameters instead (see applyDateRangeToUrl).
  // If dates don't update, user should set them manually in Looker before auto-capture.
  if (startDate && endDate) {
    console.log(`Date range will be set via URL params: ${startDate} to ${endDate}`);
  }
  
  // PHASE 2: Take initial screenshot at top
  actions.push({ type: "screenshot" }); // Top of dashboard
  
  // PHASE 3: Use Firecrawl's native scroll action for reliable scrolling
  // Firecrawl's scroll action works at the browser level, bypassing iframe/Shadow DOM issues
  // Each scroll action scrolls by approximately one viewport height
  
  // We want to capture ~6 positions. With native scroll, we scroll down multiple times.
  const numScrolls = checkpoints.length - 1; // Already captured position 0
  
  for (let i = 0; i < numScrolls; i++) {
    // Use Firecrawl's native scroll action - scrolls down by one viewport
    actions.push({ type: "scroll", direction: "down" });
    
    // Wait for charts to render
    const isChartSection = i >= 2 && i <= 4; // Middle positions likely have charts
    const waitTime = isChartSection ? chartWait : scrollWait;
    actions.push({ type: "wait", milliseconds: waitTime });
    
    // Take screenshot
    actions.push({ type: "screenshot" });
  }
  
  // PHASE 4: Extra scrolls to ensure we reach the bottom
  actions.push({ type: "scroll", direction: "down" });
  actions.push({ type: "wait", milliseconds: scrollWait });
  actions.push({ type: "screenshot" }); // Bottom of dashboard
  
  actions.push({ type: "scroll", direction: "down" });
  actions.push({ type: "wait", milliseconds: scrollWait });
  actions.push({ type: "screenshot" }); // Extra bottom capture
  
  // PHASE 5: Return to top for final overview - use native scroll up
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "scroll", direction: "up" });
  actions.push({ type: "wait", milliseconds: 2000 });
  actions.push({ type: "screenshot" }); // Final overview at top
  actions.push({ type: "wait", milliseconds: 2000 });
  actions.push({ type: "screenshot" }); // Final overview

  console.log(`Executing ${actions.length} total actions for checkpoint capture`);

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["screenshot"],
        maxAge: 0,
        storeInCache: false,
        timeout: 300000,
        actions,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.success !== false) {
      const scraped = data.data || data;
      const actionScreenshots = scraped.actions?.screenshots || [];
      
      console.log(`Firecrawl returned ${actionScreenshots.length} screenshots`);
      
      // Map screenshots to checkpoint positions
      let checkpointIndex = 0;
      for (let i = 0; i < actionScreenshots.length; i++) {
        const img = actionScreenshots[i];
        if (img) {
          // Estimate scroll position based on checkpoint index
          const position = checkpointIndex < checkpoints.length 
            ? checkpoints[checkpointIndex] 
            : checkpoints[checkpoints.length - 1];
          
          let sectionLabel = `checkpoint_${checkpointIndex}`;
          if (i === 0) sectionLabel = 'initial_load';
          else if (startDate && i <= 3) sectionLabel = `date_picker_${i}`;
          else if (i === actionScreenshots.length - 1) sectionLabel = 'final_overview';
          
          screenshots.push({
            image: img,
            section: sectionLabel,
            scrollPosition: position,
          });
          
          checkpointIndex++;
        }
      }
      
      if (scraped.screenshot && screenshots.length === 0) {
        screenshots.push({
          image: scraped.screenshot,
          section: "overview",
          scrollPosition: 0,
        });
      }
    } else {
      console.warn("Checkpoint capture failed:", data.error);
    }
  } catch (e) {
    console.error("Error during checkpoint capture:", e);
  }

  // Fallback if we didn't get enough screenshots
  if (screenshots.length < 3) {
    console.log("Falling back to simple screenshot capture...");
    const simpleScreenshot = await captureSimpleScreenshot(apiKey, url, 15000);
    if (simpleScreenshot) {
      screenshots.push({
        image: simpleScreenshot,
        section: "overview",
        scrollPosition: 0,
      });
    }
  }

  console.log(`=== Captured ${screenshots.length} total screenshots ===`);
  return screenshots;
}

/**
 * Simple single screenshot capture (fallback)
 */
async function captureSimpleScreenshot(apiKey: string, url: string, waitTime: number): Promise<string | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["screenshot"],
        maxAge: 0,
        storeInCache: false,
        waitFor: waitTime,
        timeout: 60000,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.success !== false) {
      const scraped = data.data || data;
      return scraped.screenshot || null;
    }
    return null;
  } catch (e) {
    console.warn("Simple screenshot capture failed:", e);
    return null;
  }
}

/**
 * Template-aware AI analysis of screenshots
 * 
 * Uses the template context to provide better prompts and
 * expects specific section identification and bounding boxes.
 */
async function analyzeWithTemplate(
  screenshots: ScreenshotWithAnalysis[],
  template: LookerTemplate,
  clientName: string,
  startDate?: string,
  endDate?: string
): Promise<ScreenshotWithAnalysis[]> {
  // AI analysis uses the shared Claude helper (ANTHROPIC_API_KEY checked inside callClaude)

  const analyzed: ScreenshotWithAnalysis[] = [];
  const sectionIds = getAllSectionIds(template);
  
  // Build section list for AI prompt
  const sectionList = template.expectedSections
    .map(s => `- ${s.id}: ${s.displayName}${s.required ? ' (REQUIRED)' : ''}`)
    .join('\n');
  
  // Process in batches
  const batchSize = 3;
  
  for (let i = 0; i < screenshots.length; i += batchSize) {
    const batch = screenshots.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (screenshot, batchIndex) => {
      const globalIndex = i + batchIndex;
      
      try {
        const dateRangeText = startDate && endDate
          ? `Expected date range: ${startDate} to ${endDate}`
          : 'No specific date range requested';

        const systemPrompt = `You are an expert at analyzing marketing dashboard screenshots from Looker Studio.

${template.aiPromptContext}

CONTEXT:
- Client: ${clientName}
- ${dateRangeText}
- Scroll Position: ${screenshot.scrollPosition}px
- Template: ${template.name}

KNOWN SECTIONS (identify which is visible):
${sectionList}

YOUR TASK:
1. SECTION IDENTIFICATION: Which section from the list above is primarily visible?
2. METRIC EXTRACTION: Extract ALL visible numeric metrics with exact values (include $ and % symbols)
3. INSIGHTS: 2-3 specific observations about the data
4. FEEDBACK: Brief description of what this screenshot shows
5. DATE VERIFICATION: Is the date range visible? Does it match expected?
6. BOUNDING BOXES: Identify crop regions for key data elements (as percentages)

Return ONLY valid JSON:
{
  "sectionId": "google_campaigns",
  "category": "google_ads",
  "confidence": 0.95,
  "metrics": { "conversions": "1", "cost": "$9.51", "ctr": "2.5%" },
  "insights": ["insight 1", "insight 2"],
  "feedback": "This screenshot shows...",
  "dateRangeConfirmed": true,
  "visibleDateRange": "Dec 10, 2025 - Dec 31, 2025",
  "cropRegions": [
    { "description": "KPI summary cards", "bounds": { "top": 5, "left": 5, "width": 90, "height": 15 }, "type": "kpi_card" },
    { "description": "Campaign table", "bounds": { "top": 25, "left": 5, "width": 90, "height": 50 }, "type": "table_header" }
  ]
}`;

        const userText = `Analyze screenshot ${globalIndex + 1} at scroll position ${screenshot.scrollPosition}px. Identify the section, extract metrics, and provide crop regions.`;

        // Convert image to base64 for Claude vision API (handles both URL and base64 input)
        let imageBlock: any;
        try {
          const { urlToBase64ImageBlock } = await import('../_shared/claude.ts');
          imageBlock = await urlToBase64ImageBlock(screenshot.image);
        } catch (imgErr: any) {
          console.warn(`Failed to convert image for screenshot ${globalIndex}:`, imgErr.message);
          return screenshot;
        }

        let content: string;
        try {
          content = await callClaude('', {
            system: systemPrompt,
            maxTokens: 1500,
            messages: [{
              role: 'user',
              content: [imageBlock, { type: 'text', text: userText }],
            }],
          });
        } catch (err) {
          console.warn(`AI analysis failed for screenshot ${globalIndex}:`, err);
          return screenshot;
        }

        const parsed = safeParseJsonObject(content);
        if (!parsed) {
          console.warn(`AI returned malformed JSON for screenshot ${globalIndex}`);
          return screenshot;
        }

        const result = parsed as any;
        
        // Map to section ID
        let sectionId: SectionId | undefined = result.sectionId;
        if (!sectionId || !sectionIds.includes(sectionId)) {
          // Fallback: map category to section ID
          sectionId = mapCategoryToSectionId(result.category || 'other', screenshot.scrollPosition);
        }

        return {
          ...screenshot,
          section: `${sectionId}_${globalIndex}`,
          sectionId,
          category: result.category || 'other',
          metrics: result.metrics || {},
          insights: result.insights || [],
          feedback: result.feedback || '',
          dateRangeConfirmed: result.dateRangeConfirmed,
          visibleDateRange: result.visibleDateRange,
          cropRegions: result.cropRegions || [],
          confidence: result.confidence || 0.5,
        };
      } catch (error) {
        console.error(`Error analyzing screenshot ${globalIndex}:`, error);
        return screenshot;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    analyzed.push(...batchResults);
    
    if (i + batchSize < screenshots.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return analyzed;
}

function extractFirstJsonObject(text: string): string | null {
  if (!text) return null;
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return stripped.slice(start, end + 1);
}

function repairCommonJsonIssues(json: string): string {
  let s = json.trim();
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/[""]/g, '"').replace(/['']/g, "'");
  return s;
}

function safeParseJsonObject(text: string): Record<string, unknown> | null {
  const candidate = extractFirstJsonObject(text);
  if (!candidate) return null;

  const candidates = [candidate, repairCommonJsonIssues(candidate)];
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Remove duplicate screenshots by comparing image fingerprints
 */
async function removeDuplicateScreenshots(screenshots: ScreenshotWithAnalysis[]): Promise<ScreenshotWithAnalysis[]> {
  const seen = new Set<string>();
  const unique: ScreenshotWithAnalysis[] = [];

  for (const screenshot of screenshots) {
    const fp = await fingerprintImage(screenshot.image);
    if (!fp) {
      unique.push(screenshot);
      continue;
    }

    if (seen.has(fp)) {
      console.log(`Duplicate detected at scroll position ${screenshot.scrollPosition}`);
      continue;
    }
    seen.add(fp);
    unique.push(screenshot);
  }

  return unique;
}

function bytesToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function fingerprintImage(image: string): Promise<string | null> {
  if (!image) return null;
  const trimmed = String(image).trim();

  // If Firecrawl returns hosted URLs, we need a content-based fingerprint (URL strings differ even when images don't).
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(trimmed, { signal: controller.signal });
      const buf = await res.arrayBuffer();
      clearTimeout(timeout);

      // Hash only the first 64KB for speed; enough to detect identical renders.
      const slice = buf.byteLength > 65536 ? buf.slice(0, 65536) : buf;
      const digest = await crypto.subtle.digest("SHA-256", slice);
      return `urlsha256:${bytesToHex(digest)}:len=${buf.byteLength}`;
    } catch (e) {
      // Fallback: stable-ish fingerprint from URL path only
      const noQuery = trimmed.split("?")[0];
      return `urlpath:${noQuery}`;
    }
  }

  // data URI or raw base64
  const imageData = trimmed.replace(/^data:image\/\w+;base64,/, '');
  if (imageData.length < 50) return null;

  const len = imageData.length;
  const start = imageData.slice(0, 1024);
  const midStart = Math.max(0, Math.floor(len / 2) - 512);
  const mid = imageData.slice(midStart, midStart + 1024);
  const end = imageData.slice(-1024);
  return `b64:${len}:${start}:${mid}:${end}`;
}

/**
 * Build combined AI analysis summary
 */
function buildAIAnalysisSummary(
  screenshots: ScreenshotWithAnalysis[],
  startDate?: string,
  endDate?: string
): {
  sections: Array<{
    section: string;
    sectionId?: SectionId;
    category: string;
    metrics: Record<string, string>;
    insights: string[];
    feedback: string;
    dateRangeConfirmed: boolean;
    visibleDateRange?: string;
    cropRegions?: CropRegion[];
    confidence?: number;
  }>;
  overallInsights: string[];
} {
  const sections = screenshots.map(s => ({
    section: s.section,
    sectionId: s.sectionId,
    category: s.category || 'other',
    metrics: s.metrics || {},
    insights: s.insights || [],
    feedback: s.feedback || '',
    dateRangeConfirmed: s.dateRangeConfirmed || false,
    visibleDateRange: s.visibleDateRange,
    cropRegions: s.cropRegions,
    confidence: s.confidence,
  }));

  const allInsights = screenshots.flatMap(s => s.insights || []);
  const uniqueInsights = [...new Set(allInsights)].slice(0, 10);

  const categories = [...new Set(screenshots.map(s => s.category).filter(Boolean))];
  const sectionIds = [...new Set(screenshots.map(s => s.sectionId).filter(Boolean))];
  const dateConfirmed = screenshots.some(s => s.dateRangeConfirmed);
  
  const overallInsights = [
    `Dashboard contains ${sectionIds.length} identified sections: ${sectionIds.join(", ")}`,
    `Captured and analyzed ${screenshots.length} unique screenshots`,
    dateConfirmed 
      ? `Date range ${startDate} to ${endDate} confirmed in screenshots` 
      : `Date range verification: Unable to confirm expected range`,
    ...uniqueInsights.slice(0, 5)
  ];

  return { sections, overallInsights };
}

function computeDateRangeConfirmed(aiAnalysis: any): boolean | null {
  if (!aiAnalysis) return null;
  const sections = aiAnalysis.sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const confirmations = sections
    .map((s: any) => s?.dateRangeConfirmed)
    .filter((v: any) => typeof v === "boolean") as boolean[];
  if (confirmations.length === 0) return null;
  return confirmations.some(Boolean);
}

/**
 * Apply date range to Looker Studio URL
 */
function applyDateRangeToUrl(url: string, startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return url;

  try {
    const urlObj = new URL(url);
    
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');
    const start = formatDate(startDate);
    const end = formatDate(endDate);

    const existingParams = urlObj.searchParams.get('params');
    
    let paramsObj: Record<string, any> = {};
    if (existingParams) {
      try {
        paramsObj = JSON.parse(decodeURIComponent(existingParams));
      } catch {
        // Start fresh
      }
    }

    const candidates: Record<string, string> = {
      "ds0.date_range.start_date": start,
      "ds0.date_range.end_date": end,
      "ds0.date_range_start_date": start,
      "ds0.date_range_end_date": end,
      "ds0.dateRange.startDate": start,
      "ds0.dateRange.endDate": end,
      "dateRange.startDate": start,
      "dateRange.endDate": end,
      "DS_START_DATE": start,
      "DS_END_DATE": end,
    };

    for (const [k, v] of Object.entries(candidates)) {
      paramsObj[k] = v;
    }

    urlObj.searchParams.set("_ts", Date.now().toString());
    urlObj.searchParams.set('params', JSON.stringify(paramsObj));

    console.log("Date range params added:", JSON.stringify(candidates));
    
    return urlObj.toString();
  } catch (error) {
    console.warn("Failed to modify URL with date range:", error);
    return url;
  }
}

/**
 * Parse markdown and HTML content to extract metrics
 */
function parseMetricsFromContent(markdown: string, html: string): {
  metrics: Record<string, string>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
  kpis: Array<{ label: string; value: string }>;
  rawNumbers: string[];
} {
  const metrics: Record<string, string> = {};
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const kpis: Array<{ label: string; value: string }> = [];
  const rawNumbers: string[] = [];

  const metricPatterns = [
    { pattern: /\$[\d,]+(?:\.\d{2})?/g, type: 'currency' },
    { pattern: /[\d.]+%/g, type: 'percentage' },
    { pattern: /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, type: 'number' },
    { pattern: /\b\d+\.\d{2,}\b/g, type: 'decimal' },
  ];

  for (const { pattern } of metricPatterns) {
    const matches = markdown.match(pattern) || [];
    rawNumbers.push(...matches);
  }

  const labeledPatterns = [
    /(?:^|\n|\|)\s*([A-Za-z\s]+?):\s*(\$?[\d,.]+%?)/gm,
    /\b(Spend|Cost|CPC|CTR|ROAS|Clicks|Impressions|Conversions|Conv\.?\s*Rate|CPL|CPA|CPM|Revenue)\s*[:\s]+(\$?[\d,.]+%?)/gi,
  ];

  for (const pattern of labeledPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const label = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      const value = match[2].trim();
      if (value && !metrics[label]) {
        metrics[label] = value;
      }
    }
  }

  // Parse markdown tables
  const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(markdown)) !== null) {
    const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
    const rowsText = tableMatch[2].trim().split('\n');
    const rows = rowsText.map(row => 
      row.split('|').map(cell => cell.trim()).filter(Boolean)
    );
    
    if (headers.length > 0 && rows.length > 0) {
      tables.push({ headers, rows });
    }
  }

  return { metrics, tables, kpis, rawNumbers };
}

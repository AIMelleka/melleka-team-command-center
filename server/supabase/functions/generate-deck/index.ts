import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateDateRange,
  validateClientData,
  validateLookerData,
  validateGHLData,
  validateBranding,
  validateDeckContent,
  generateQAReport,
  formatQAReportForLog,
  withQARetry,
  LOOKER_RETRY_CONFIG,
  BRANDING_RETRY_CONFIG,
  DATA_FETCH_RETRY_CONFIG,
  QACheckResult,
  QAReport,
} from "../_shared/deckQA.ts";
import { callClaude } from "../_shared/claude.ts";

// Declare EdgeRuntime for Deno edge environment (allows true background processing)
declare const EdgeRuntime:
  | {
      waitUntil: (promise: Promise<unknown>) => void;
    }
  | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UploadedScreenshot {
  url: string;
  name: string;
}

interface DeckRequest {
  clientName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  lookerUrl?: string;
  ga4PropertyId?: string;
  domain?: string;
  screenshots?: UploadedScreenshot[];
  supermetricsData?: Record<string, unknown>;
  taskNotes?: string;

  // Async job mode (used by deck builder)
  async?: boolean;
  deckId?: string;
  slug?: string;
}

// Looker Directory spreadsheet for client lookups
const LOOKER_DIRECTORY_SHEET_ID = "1t43DRbgSo7pOqKh2DIt7xSsKrN6JgLgLSWAJe92SDQI";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accumulate all QA checks throughout the process
  const allQAChecks: QACheckResult[] = [];
  const qaReports: QAReport[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: DeckRequest = await req.json();

    const isAsyncJob = !!body.async && !!body.deckId && !!body.slug;
    const jobDeckId = body.deckId;
    const jobSlug = body.slug;

    let jobContent: Record<string, unknown> | null = null;

    const updateJob = async (
      progress: number,
      progressMessage: string,
      patch?: Record<string, unknown>
    ) => {
      if (!isAsyncJob || !jobDeckId) return;
      try {
        jobContent = {
          ...(jobContent ?? {}),
          ...(patch ?? {}),
          progress,
          progressMessage,
        };
        await supabase
          .from("decks")
          .update({
            status: "generating",
            content: jobContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobDeckId);
      } catch (e) {
        console.error("Job progress update failed:", e);
      }
    };

    const failJob = async (errorMessage: string, qaReport?: unknown) => {
      if (!isAsyncJob || !jobDeckId) return;
      try {
        jobContent = {
          ...(jobContent ?? {}),
          progress: 0,
          progressMessage: errorMessage,
          error: errorMessage,
          ...(qaReport ? { qaReport } : {}),
        };
        await supabase
          .from("decks")
          .update({
            status: "failed",
            content: jobContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobDeckId);
      } catch (e) {
        console.error("Failed to mark job as failed:", e);
      }
    };

    const process = async (): Promise<Response> => {
      let { clientName, dateRangeStart, dateRangeEnd, lookerUrl, ga4PropertyId, domain, screenshots: uploadedScreenshots, supermetricsData, taskNotes } = body;
      const deckColors = (body as any).deckColors as { primary?: string; background?: string; text?: string; textMuted?: string } | undefined;
      const inputBranding = (body as any).branding as { logo?: string; colors?: Record<string, string>; screenshot?: string } | undefined;
      const inputSeoData = (body as any).seoData as Record<string, unknown> | undefined;
      const inputSeoDeckData = (body as any).seoDeckData as Record<string, unknown> | undefined;

      await updateJob(5, "Starting deck generation...", { inputParams: body });

      if (!clientName || !dateRangeStart || !dateRangeEnd) {
        const msg = "Missing required fields: clientName, dateRangeStart, dateRangeEnd";
        await failJob(msg);
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine data mode
      const hasUploadedScreenshots = Array.isArray(uploadedScreenshots) && uploadedScreenshots.length > 0;
      const hasSupermetricsData = supermetricsData && Object.keys(supermetricsData).length > 0;
      const hasTaskNotes = !!taskNotes && taskNotes.trim().length > 0;

      console.log("=== DECK BOT GENERATION ===");
      console.log(`Client: ${clientName}`);
      console.log(`Date Range: ${dateRangeStart} to ${dateRangeEnd}`);
      console.log(`Mode: ${hasSupermetricsData ? 'SUPERMETRICS DATA' : hasUploadedScreenshots ? 'UPLOADED SCREENSHOTS' : 'LOOKER SCRAPING'}`);
      if (hasUploadedScreenshots) {
        console.log(`Uploaded screenshots: ${uploadedScreenshots.length}`);
      }
      if (hasSupermetricsData) {
        console.log(`Supermetrics platforms: ${Object.keys(supermetricsData).join(', ')}`);
      }
      await updateJob(10, "QA Gate 1: Input validation...");

    // ============= QA GATE 1: Input Validation =============
    console.log("\n=== QA GATE 1: Input Validation ===");
    const dateCheck = validateDateRange(dateRangeStart, dateRangeEnd);
    allQAChecks.push(dateCheck);
    
      if (!dateCheck.passed && dateCheck.severity === 'critical') {
        const report = generateQAReport([dateCheck], 'INPUT_VALIDATION');
        console.log(formatQAReportForLog(report));
        await failJob(dateCheck.message, report);
        return new Response(
          JSON.stringify({ 
            error: dateCheck.message, 
            qaReport: report,
            suggestion: dateCheck.suggestion 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    // Step 1: If no Looker URL provided and no uploaded screenshots and no Supermetrics data, fetch from directory
      if (!lookerUrl && !hasUploadedScreenshots && !hasSupermetricsData) {
        console.log("Step 1: Fetching client info from Looker Directory...");
        const directoryData = await fetchClientFromDirectory(supabaseUrl, clientName);
        if (directoryData) {
          lookerUrl = directoryData.lookerUrl || lookerUrl;
          ga4PropertyId = directoryData.ga4PropertyId || ga4PropertyId;
          domain = directoryData.domain || domain;
          console.log(`Found in directory: Looker URL: ${lookerUrl ? 'YES' : 'NO'}`);
        }
      }

    // QA: Validate client data completeness (skip Looker check if screenshots uploaded or Supermetrics data or task notes available)
    const clientChecks = (hasUploadedScreenshots || hasSupermetricsData || hasTaskNotes)
      ? validateClientData(clientName, 'uploaded', domain) // Pass 'uploaded' to skip Looker URL check
      : validateClientData(clientName, lookerUrl, domain);
    allQAChecks.push(...clientChecks);
    
    const inputReport = generateQAReport(allQAChecks, 'INPUT_VALIDATION');
    qaReports.push(inputReport);
    console.log(formatQAReportForLog(inputReport));

    // Fail fast if no Looker URL AND no uploaded screenshots AND no Supermetrics data AND no task notes
    if (!hasUploadedScreenshots && !hasSupermetricsData && !hasTaskNotes) {
      const lookerCheck = clientChecks.find(c => c.checkName === 'LOOKER_URL_PROVIDED');
        if (lookerCheck && !lookerCheck.passed) {
          await failJob(lookerCheck.message, inputReport);
          return new Response(
            JSON.stringify({ 
              error: lookerCheck.message, 
              qaReport: inputReport,
              suggestion: lookerCheck.suggestion 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
    }

    // ============= QA GATE 2: Data Fetching =============
      console.log("\n=== QA GATE 2: Data Fetching ===");
      
      let lookerData: any = null;
      let lookerChecks: QACheckResult[] = [];
      
      if (hasSupermetricsData) {
        // Use Supermetrics data directly — no screenshots needed
        console.log("Step 2: Using Supermetrics ad performance data...");
        await updateJob(30, "Processing Supermetrics ad data...");
        
        lookerData = {
          screenshots: [],
          supermetricsData,
          dateRange: { start: dateRangeStart, end: dateRangeEnd },
          extractedMetrics: {},
          summary: {},
          keyFindings: [],
          executiveSummary: '',
        };
        
        lookerChecks = [{
          passed: true,
          checkName: 'SUPERMETRICS_DATA',
          severity: 'info' as const,
          message: `Supermetrics data loaded for ${Object.keys(supermetricsData).length} platform(s)`,
          details: { platforms: Object.keys(supermetricsData) },
        }];
        
        await updateJob(40, "Building deck from Supermetrics data...");
      } else if (hasUploadedScreenshots) {
        // Use uploaded screenshots with AI analysis
        console.log("Step 2: Analyzing uploaded screenshots with AI vision...");
        await updateJob(30, "Analyzing screenshots with AI vision...");
        
        // Call the screenshot analysis function
        let analysisResult: any = null;
        try {
          const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-deck-screenshots`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              screenshots: uploadedScreenshots,
              clientName,
              dateRangeStart,
              dateRangeEnd,
            }),
          });
          
          if (analysisResponse.ok) {
            analysisResult = await analysisResponse.json();
            console.log(`AI Vision Analysis: ${analysisResult.sections?.length || 0} sections detected`);
            console.log(`Summary: $${analysisResult.summary?.totalSpend || 0} spend, ${analysisResult.summary?.totalLeads || 0} leads`);
          } else {
            console.error("Screenshot analysis failed:", await analysisResponse.text());
          }
        } catch (err) {
          console.error("Screenshot analysis error:", err);
        }
        
        await updateJob(40, "Building deck from analyzed data...");
        
        // Convert uploaded screenshots + AI analysis to the format expected by the rest of the code
        lookerData = {
          screenshots: uploadedScreenshots.map((s: UploadedScreenshot, idx: number) => ({
            image: s.url,
            name: s.name,
            section: 'uploaded',
            index: idx,
          })),
          aiAnalysis: analysisResult,
          dateRange: { start: dateRangeStart, end: dateRangeEnd },
          // Extract metrics from AI analysis for deck content
          extractedMetrics: {
            googleAds: analysisResult?.sections?.find((s: any) => s.sectionType === 'google_ads'),
            metaAds: analysisResult?.sections?.find((s: any) => s.sectionType === 'meta_ads'),
            sms: analysisResult?.sections?.find((s: any) => s.sectionType === 'sms'),
            email: analysisResult?.sections?.find((s: any) => s.sectionType === 'email'),
            overview: analysisResult?.sections?.find((s: any) => s.sectionType === 'overview'),
          },
          summary: analysisResult?.summary || {},
          keyFindings: analysisResult?.keyFindings || [],
          executiveSummary: analysisResult?.executiveSummary || '',
        };
        
        // Add QA check for uploaded screenshots
        const analysisSuccess = analysisResult?.sections?.length > 0;
        lookerChecks = [{
          passed: uploadedScreenshots.length >= 1,
          checkName: 'SCREENSHOTS_UPLOADED',
          severity: uploadedScreenshots.length >= 5 ? 'info' : 'warning',
          message: `${uploadedScreenshots.length} screenshots uploaded`,
          details: { count: uploadedScreenshots.length },
          suggestion: uploadedScreenshots.length < 5 ? 'Consider uploading more screenshots for comprehensive coverage' : undefined,
        }, {
          passed: analysisSuccess,
          checkName: 'AI_VISION_ANALYSIS',
          severity: analysisSuccess ? 'info' : 'warning',
          message: analysisSuccess 
            ? `AI analyzed ${analysisResult.sections.length} sections with ${Object.keys(analysisResult.summary || {}).length} metrics`
            : 'AI vision analysis incomplete',
          details: analysisResult?.summary,
        }];
        
        console.log(`Uploaded screenshots: ${uploadedScreenshots.length}, AI sections: ${analysisResult?.sections?.length || 0}`);
      } else {
        // Use Looker scraping (original behavior)
        console.log("Step 2: Parallel data fetching with retry logic...");
        await updateJob(30, "Capturing Looker screenshots (this takes time)...");
      
        // Use retry wrapper for Looker - the most critical and flaky component
        const lookerRetryResult = await withQARetry(
          'LOOKER_FETCH',
          async (attempt, waitMultiplier) => {
            return await fetchLookerScreenshots(
              supabaseUrl, 
              lookerUrl, 
              dateRangeStart, 
              dateRangeEnd,
              waitMultiplier
            );
          },
          (result) => validateLookerData(result, dateRangeStart, dateRangeEnd),
          LOOKER_RETRY_CONFIG
        );

        lookerData = lookerRetryResult.result;
        lookerChecks = lookerRetryResult.checks;
        await updateJob(40, "Analyzing dashboard data with AI...");
      
        // Log retry attempts if any
        if (lookerRetryResult.attempts > 1) {
          console.log(`Looker fetch required ${lookerRetryResult.attempts} attempts`);
          allQAChecks.push({
            passed: true,
            checkName: 'LOOKER_RETRY_COUNT',
            severity: 'info',
            message: `Looker data fetched after ${lookerRetryResult.attempts} attempts`,
            details: { attempts: lookerRetryResult.attempts },
          });
        }
      }

    // Parallel fetch for other data sources (Notion removed — tasks come from user uploads only)
      const [sheetsResult, ghlResult] = await Promise.allSettled([
      // Google Sheets data
      fetchSheetsData(supabaseUrl, clientName),
      // GHL data with retry
      withQARetry(
        'GHL_FETCH',
        async () => fetchGHLData(supabaseUrl, clientName, dateRangeStart, dateRangeEnd),
        (result) => validateGHLData(result),
        DATA_FETCH_RETRY_CONFIG
      ),
    ]);

    // No Notion — tasks come exclusively from user-provided taskNotes
      const notionTasks: any[] = [];
      const sheetsData = sheetsResult.status === 'fulfilled' ? sheetsResult.value : null;
      const ghlData = ghlResult.status === 'fulfilled' ? ghlResult.value.result : null;
      await updateJob(50, "Fetching data sources...");

    console.log("=== DATA FETCH RESULTS ===");
    console.log(`Screenshots: ${lookerData ? `SUCCESS - ${lookerData.screenshots?.length || 0} screenshots` : 'FAILED'} (${hasUploadedScreenshots ? 'uploaded' : 'scraped'})`);
    console.log(`Sheets: ${sheetsData ? 'SUCCESS' : 'FAILED'}`);
    console.log(`GHL: ${ghlData ? `SUCCESS - ${ghlData.contacts?.total || 0} contacts, ${ghlData.workflows?.active || 0} workflows` : 'FAILED'}`);

    // Collect all data checks
    const dataChecks: QACheckResult[] = [...lookerChecks];
    
    if (ghlResult.status === 'fulfilled') {
      dataChecks.push(...ghlResult.value.checks);
    }
    
    allQAChecks.push(...dataChecks);

    const dataReport = generateQAReport(dataChecks, 'DATA_FETCHING');
    dataReport.retriesAttempted = 0;
    qaReports.push(dataReport);
    console.log(formatQAReportForLog(dataReport));

    // Critical failure on screenshot data - only fail if no screenshots AND no Supermetrics data AND no task notes
    const hasAnyScreenshots = lookerData?.screenshots?.length > 0;
    const hasAnySupermetrics = hasSupermetricsData;
    if (!hasAnyScreenshots && !hasAnySupermetrics && !hasTaskNotes) {
      const failureMessage = hasUploadedScreenshots 
        ? 'No screenshots were provided' 
        : 'Failed to capture screenshots from Looker Studio and no Supermetrics data available';
      console.error(`⚠️ CRITICAL: ${failureMessage}`);
      await failJob(failureMessage, dataReport);
      return new Response(
        JSON.stringify({ 
          error: failureMessage, 
          qaReport: dataReport,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= QA GATE 3: Branding Extraction =============
      console.log("\n=== QA GATE 3: Branding Extraction ===");
      console.log("Step 3: Extracting branding from client website...");
      await updateJob(20, "Extracting branding from client website...");
    let brandColors: any = { 
      primary: "#6366f1", 
      secondary: "#8b5cf6", 
      background: "#1A1F2C",
      textPrimary: "#FFFFFF",
      textSecondary: "#B0B0B0"
    };
    
    if (domain) {
      const extractedBranding = await extractBranding(supabaseUrl, domain);
      if (extractedBranding) {
        brandColors = extractedBranding;
        console.log(`Branding extracted: Primary=${brandColors.primary}, Logo=${brandColors.logo ? 'YES' : 'NO'}`);
      } else {
        console.log("Could not extract branding, using defaults");
      }
    } else {
      console.log("No domain provided, using default branding");
    }

    // Apply user-customized deck colors (override extracted ones)
    if (deckColors) {
      if (deckColors.primary) brandColors.primary = deckColors.primary;
      if (deckColors.background) brandColors.background = deckColors.background;
      if (deckColors.text) brandColors.textPrimary = deckColors.text;
      if (deckColors.textMuted) brandColors.textSecondary = deckColors.textMuted;
      console.log(`Deck colors overridden: primary=${deckColors.primary}, bg=${deckColors.background}`);
    }
    // Apply logo from input branding if not already extracted
    if (inputBranding?.logo && !brandColors.logo) {
      brandColors.logo = inputBranding.logo;
    }

    const brandingChecks = validateBranding(brandColors, domain);
    allQAChecks.push(...brandingChecks);

    const brandingReport = generateQAReport(brandingChecks, 'BRANDING_EXTRACTION');
    qaReports.push(brandingReport);
    console.log(formatQAReportForLog(brandingReport));

    // ============= QA GATE 4: Content Building =============
      console.log("\n=== QA GATE 4: Content Building ===");
      console.log("Step 4: Building deck content...");
      await updateJob(60, "Building deck content...");
    
    const deckContent = buildDeckContent(lookerData, notionTasks, sheetsData, ghlData, clientName, dateRangeStart, dateRangeEnd, supermetricsData || null, taskNotes || null);

    // Cache Meta creative images to permanent storage (CDN URLs expire)
    if (deckContent.adPlatforms && Array.isArray(deckContent.adPlatforms)) {
      await updateJob(62, "Caching ad creative images...");
      await cacheCreativeImages(deckContent.adPlatforms, supabase);
    }

    // Pass through social media posts if provided
    const socialMediaPosts = (body as any)?.socialMediaPosts;
    if (socialMediaPosts && Array.isArray(socialMediaPosts) && socialMediaPosts.length > 0) {
      (deckContent as any).socialMediaPosts = socialMediaPosts;
      console.log(`Attached ${socialMediaPosts.length} social media posts to deck content`);
    }

    // Pass through campaign assets (email/SMS screenshots) if provided
    const campaignAssets = (body as any)?.campaignAssets;
    if (campaignAssets) {
      (deckContent as any).campaignAssets = campaignAssets;
      const totalAssets = (campaignAssets.emailResults?.length || 0) + (campaignAssets.emailDesigns?.length || 0) + (campaignAssets.smsResults?.length || 0) + (campaignAssets.smsCampaign?.length || 0) + (campaignAssets.socialMedia?.length || 0);
      console.log(`Attached ${totalAssets} campaign asset URLs to deck content (incl ${campaignAssets.socialMedia?.length || 0} social media)`);
    }

    // Inject SEO data if provided
    if (inputSeoDeckData) {
      (deckContent as any).seo = inputSeoDeckData;
      console.log("Attached seoDeckData to deck content");
    } else if (inputSeoData) {
      (deckContent as any).seo = { current: inputSeoData };
      console.log("Attached seoData (as current) to deck content");
    }

    // QA: Validate deck content
    const contentChecks = validateDeckContent(deckContent);
    allQAChecks.push(...contentChecks);

    const contentReport = generateQAReport(contentChecks, 'CONTENT_BUILDING');
    qaReports.push(contentReport);
    console.log(formatQAReportForLog(contentReport));

    // ============= QA GATE 5: AI Insights =============
      console.log("\n=== QA GATE 5: AI Insights Generation ===");
      console.log("Step 5: Generating AI insights...");
      await updateJob(70, "Generating AI insights and recommendations...");
    const aiInsights = await generateAIInsights(deckContent, lookerData, clientName, dateRangeStart, dateRangeEnd);
    
    if (aiInsights) {
      deckContent.googleAds.insights = aiInsights.googleAdsInsights || [];
      deckContent.metaAds.insights = aiInsights.metaAdsInsights || [];
      deckContent.sms.highlights = aiInsights.smsHighlights || [];
      deckContent.nextSteps.recommendations = aiInsights.recommendations || [];
      deckContent.nextSteps.focusAreas = aiInsights.focusAreas || [];
      
      // Add narrative and enhanced data
      if (aiInsights.narrative) {
        deckContent.narrative = aiInsights.narrative;
      }
      if (aiInsights.performanceGrades) {
        deckContent.performanceGrades = aiInsights.performanceGrades;
        deckContent.hero.performanceGrades = aiInsights.performanceGrades;
      }
      if (aiInsights.trendAnalysis) {
        deckContent.trendAnalysis = aiInsights.trendAnalysis;
      }

      // Merge AI-categorized task notes into platform sections
      let categorized = aiInsights.categorizedTasks;
      
      // Fallback: keyword-based categorization if AI didn't return categorizedTasks
      if (!categorized && deckContent.taskNotes) {
        console.log("AI did not return categorizedTasks — running keyword fallback categorizer");
        categorized = fallbackCategorizeTasks(deckContent.taskNotes);
      }
      
      if (categorized) {
        deckContent.categorizedTasks = categorized;
        // Also inject into platform-specific sections for slide rendering
        if (categorized.googleAdsTasks?.length) {
          deckContent.googleAds.completedTasks = categorized.googleAdsTasks;
        }
        if (categorized.metaAdsTasks?.length) {
          deckContent.metaAds.completedTasks = categorized.metaAdsTasks;
        }
        if (categorized.seoTasks?.length) {
          deckContent.seoTasks = categorized.seoTasks;
        }
        if (categorized.websiteTasks?.length) {
          deckContent.websiteTasks = categorized.websiteTasks;
        }
        if (categorized.emailTasks?.length) {
          deckContent.email.completedTasks = categorized.emailTasks;
        }
        if (categorized.smsTasks?.length) {
          deckContent.sms.completedTasks = categorized.smsTasks;
        }
        if (categorized.crmTasks?.length) {
          deckContent.crmTasks = categorized.crmTasks;
        }
        if (categorized.socialMediaTasks?.length) {
          deckContent.socialMedia.completedTasks = categorized.socialMediaTasks;
        }
        if (categorized.clientNeeds?.length) {
          deckContent.clientNeeds = categorized.clientNeeds;
        }
        console.log(`Task notes categorized: ${Object.entries(categorized).filter(([_, v]) => (v as any[])?.length > 0).length} platform sections populated`);
      }

      // Merge AI gameplans into adPlatforms array
      if (aiInsights.platformGameplans && Array.isArray(deckContent.adPlatforms)) {
        for (const platform of deckContent.adPlatforms) {
          const gpKey = platform.platformKey;
          const gp = aiInsights.platformGameplans[gpKey] || aiInsights.platformGameplans[platform.key];
          if (gp) {
            platform.gameplan = gp;
          }
        }
        console.log(`Platform gameplans injected for: ${Object.keys(aiInsights.platformGameplans || {}).join(', ')}`);
      }

      allQAChecks.push({
        passed: true,
        checkName: 'AI_INSIGHTS_GENERATED',
        severity: 'info',
        message: `AI generated narrative + ${aiInsights.recommendations?.length || 0} recommendations`,
      });
    } else {
      // AI insights failed — still try to categorize tasks via fallback
      if (deckContent.taskNotes) {
        console.log("AI insights null but taskNotes present — running keyword fallback categorizer");
        const categorized = fallbackCategorizeTasks(deckContent.taskNotes);
        deckContent.categorizedTasks = categorized;
        if (categorized.googleAdsTasks?.length) deckContent.googleAds.completedTasks = categorized.googleAdsTasks;
        if (categorized.metaAdsTasks?.length) deckContent.metaAds.completedTasks = categorized.metaAdsTasks;
        if (categorized.seoTasks?.length) deckContent.seoTasks = categorized.seoTasks;
        if (categorized.websiteTasks?.length) deckContent.websiteTasks = categorized.websiteTasks;
        if (categorized.emailTasks?.length) deckContent.email.completedTasks = categorized.emailTasks;
        if (categorized.smsTasks?.length) deckContent.sms.completedTasks = categorized.smsTasks;
        if (categorized.crmTasks?.length) deckContent.crmTasks = categorized.crmTasks;
        if (categorized.socialMediaTasks?.length) deckContent.socialMedia.completedTasks = categorized.socialMediaTasks;
        if (categorized.clientNeeds?.length) deckContent.clientNeeds = categorized.clientNeeds;
        console.log(`Fallback categorized: ${Object.entries(categorized).filter(([_, v]) => (v as any[])?.length > 0).length} sections`);
      }
      allQAChecks.push({
        passed: true,
        checkName: 'AI_INSIGHTS_GENERATED',
        severity: 'warning',
        message: 'AI insights generation failed or skipped',
        suggestion: 'Check ANTHROPIC_API_KEY configuration',
      });
    }

    // ============= PAGE SCREENSHOTS: Auto-capture for SEO/Website tasks =============
    console.log("\n=== AUTO-CAPTURING PAGE SCREENSHOTS ===");
    await updateJob(85, "Capturing page screenshots...");

    try {
      const taskCategories = deckContent.services?.tasks || [];
      const seoWebsiteTasks = taskCategories
        .filter((cat: { category: string; items: string[] }) => {
          const lower = cat.category.toLowerCase();
          return lower.includes('seo') || lower.includes('website');
        })
        .flatMap((cat: { category: string; items: string[] }) => cat.items);

      if (seoWebsiteTasks.length > 0 && domain) {
        console.log(`Found ${seoWebsiteTasks.length} SEO/Website tasks, capturing page screenshots...`);

        // Extract page hints from tasks
        const pageKeywords = ['home', 'about', 'service', 'contact', 'blog', 'portfolio', 'team',
          'faq', 'pricing', 'testimonial', 'career', 'product', 'shop', 'location',
          'landing', 'gallery', 'review', 'case stud', 'resource'];
        const hints = new Set<string>();
        for (const item of seoWebsiteTasks) {
          const lower = (item as string).toLowerCase();
          const pageMatch = lower.match(/(\w[\w\s]*?)\s+page/i);
          if (pageMatch) hints.add(pageMatch[1].trim());
          for (const kw of pageKeywords) {
            if (lower.includes(kw)) hints.add(kw);
          }
        }
        const pageHints = [...hints].slice(0, 8);

        if (pageHints.length > 0) {
          const screenshotResponse = await fetch(`${supabaseUrl}/functions/v1/screenshot-pages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ websiteUrl: domain, pageHints }),
          });

          if (screenshotResponse.ok) {
            const screenshotData = await screenshotResponse.json();
            if (screenshotData.success && screenshotData.pages?.length > 0) {
              deckContent.pageScreenshots = screenshotData.pages;
              console.log(`Captured ${screenshotData.pages.length} page screenshots`);
            }
          } else {
            console.warn("Page screenshot capture failed:", screenshotResponse.status);
          }
        }
      } else {
        console.log("No SEO/Website tasks or no domain — skipping page screenshots");
      }
    } catch (screenshotError) {
      console.warn("Page screenshot capture error (non-fatal):", screenshotError);
    }

    // ============= QA GATE 6: Final Validation & Save =============
      console.log("\n=== QA GATE 6: Final Validation & Save ===");
      await updateJob(95, "Final QA + saving deck...");
    
    // Generate final comprehensive report
    const finalReport = generateQAReport(allQAChecks, 'FINAL');
    qaReports.push(finalReport);
    console.log(formatQAReportForLog(finalReport));

    // Generate unique slug and save to database
      const slug = isAsyncJob && jobSlug ? jobSlug : `d-${generateSlug()}`;
      console.log("Step 6: Saving deck to database...");

    // Add QA report to deck content
    deckContent.qaReport = {
      overallScore: finalReport.score,
      overallPassed: finalReport.overallPassed,
      criticalFailures: finalReport.criticalFailures,
      warnings: finalReport.warnings,
      checksSummary: allQAChecks.map(c => ({
        name: c.checkName,
        passed: c.passed,
        severity: c.severity,
        message: c.message,
      })),
      generatedAt: finalReport.timestamp,
    };

      const screenshots = lookerData?.screenshots?.map((s: { image: string }) => s.image) || [];
      const status = finalReport.overallPassed ? "published" : "needs_review";

      // Provide the summary shape the Deck Builder UI expects
      const qaReportSummary = {
        score: finalReport.score,
        passed: finalReport.overallPassed,
        criticalFailures: finalReport.criticalFailures,
        warnings: finalReport.warnings,
        status,
      };

      // Persist to DB
      if (isAsyncJob && jobDeckId) {
        await supabase
          .from("decks")
          .update({
            slug,
            client_name: clientName,
            date_range_start: dateRangeStart,
            date_range_end: dateRangeEnd,
            content: {
              ...deckContent,
              progress: 100,
              progressMessage: "Deck generated successfully!",
              qaReport: qaReportSummary,
            },
            screenshots,
            brand_colors: brandColors,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobDeckId);

        return new Response(
          JSON.stringify({
            success: true,
            slug,
            deckId: jobDeckId,
            qaReport: qaReportSummary,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: deck, error: dbError } = await supabase
        .from("decks")
        .insert({
          slug,
          client_name: clientName,
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd,
          content: deckContent,
          screenshots,
          brand_colors: brandColors,
          status,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(`Failed to save deck: ${dbError.message}`);
      }

    console.log(`=== DECK GENERATED ===`);
    console.log(`Slug: ${slug}`);
    console.log(`Deck ID: ${deck.id}`);
    console.log(`QA Score: ${finalReport.score}/100`);
    console.log(`Status: ${finalReport.overallPassed ? 'PUBLISHED' : 'NEEDS REVIEW'}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          slug, 
          deckId: deck.id,
          qaReport: {
            score: finalReport.score,
            passed: finalReport.overallPassed,
            criticalFailures: finalReport.criticalFailures,
            warnings: finalReport.warnings,
            status: finalReport.overallPassed ? 'published' : 'needs_review',
          },
          summary: {
            screenshots: lookerData?.screenshots?.length || 0,
            hasSheetData: !!sheetsData,
            hasGHLData: !!ghlData,
            dateRangeConfirmed: allQAChecks.find(c => c.checkName === 'DATE_RANGE_CONFIRMED')?.passed || false,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    };

    // Async mode: return immediately and keep working in background
    if (isAsyncJob && typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(
        process().catch(async (e) => {
          const msg = e instanceof Error ? e.message : "Unknown error";
          await failJob(msg);
          console.error("Background deck job failed:", e);
        })
      );

      return new Response(
        JSON.stringify({ success: true, deckId: jobDeckId, slug: jobSlug, status: "generating" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return await process();
  } catch (error) {
    console.error("Error generating deck:", error);
    
    // Generate error QA report
    allQAChecks.push({
      passed: false,
      checkName: 'GENERATION_COMPLETED',
      severity: 'critical',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
    
    const errorReport = generateQAReport(allQAChecks, 'ERROR');
    console.log(formatQAReportForLog(errorReport));

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        qaReport: errorReport,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Fetch client info from Looker Directory spreadsheet
 */
async function fetchClientFromDirectory(supabaseUrl: string, clientName: string): Promise<{
  lookerUrl?: string;
  ga4PropertyId?: string;
  domain?: string;
} | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-google-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        spreadsheetId: LOOKER_DIRECTORY_SHEET_ID,
        sheetName: "Directory"
      }),
    });

    if (!response.ok) {
      console.warn("Failed to fetch directory:", await response.text());
      return null;
    }

    const data = await response.json();
    const rows = data.rows || [];
    
    // Fuzzy match client name
    const clientLower = clientName.toLowerCase();
    for (const row of rows) {
      const rowClientName = (row["Client Name"] || row["client_name"] || row["Name"] || "").toLowerCase();
      if (rowClientName.includes(clientLower) || clientLower.includes(rowClientName)) {
        return {
          lookerUrl: row["Looker URL"] || row["looker_url"] || row["Dashboard URL"],
          ga4PropertyId: row["GA4 Property ID"] || row["ga4_property_id"],
          domain: row["Domain"] || row["Website"] || row["domain"],
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching directory:", error);
    return null;
  }
}

/**
 * Fetch Looker Studio screenshots with date range and AI analysis
 * @param waitMultiplier - Multiplier for wait times (increases on retry)
 */
async function fetchLookerScreenshots(
  supabaseUrl: string, 
  lookerUrl: string | undefined,
  startDate: string,
  endDate: string,
  waitMultiplier: number = 1
): Promise<{
  screenshots: Array<{ image: string; section: string; category?: string }>;
  extractedMetrics: any;
  aiAnalysis: any;
  markdown: string;
} | null> {
  if (!lookerUrl) {
    console.log("No Looker URL provided, skipping screenshot capture");
    return null;
  }

  try {
    console.log(`Fetching Looker with date range: ${startDate} to ${endDate} (wait multiplier: ${waitMultiplier}x)`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/scrape-looker`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ 
        url: lookerUrl,
        startDate,
        endDate,
        captureMultiple: true,  // Enable multi-screenshot capture
        waitMultiplier,         // Pass wait multiplier to increase wait times
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Looker scrape failed:", errorText);
      return null;
    }

    const data = await response.json();
    
    if (!data.success) {
      console.warn("Looker scrape returned error:", data.error);
      return null;
    }

    // Process screenshots with their categories from AI analysis
    const screenshots: Array<{ image: string; section: string; category?: string }> = [];
    
    if (data.screenshots && Array.isArray(data.screenshots)) {
      for (const s of data.screenshots) {
        screenshots.push({
          image: s.image,
          section: s.section || 'overview',
          category: data.aiAnalysis?.sections?.find((sec: any) => 
            sec.section === s.section
          )?.category
        });
      }
    } else if (data.screenshot) {
      // Backward compatibility
      screenshots.push({
        image: data.screenshot,
        section: 'overview',
        category: 'overview'
      });
    }

    console.log(`Looker scrape complete: ${screenshots.length} screenshots, AI analysis: ${data.aiAnalysis ? 'YES' : 'NO'}`);

    return {
      screenshots,
      extractedMetrics: data.extractedMetrics || {},
      aiAnalysis: data.aiAnalysis || null,
      markdown: data.markdown || "",
    };
  } catch (error) {
    console.error("Error fetching Looker screenshots:", error);
    return null;
  }
}

// Notion integration removed — tasks come from user-provided taskNotes only

/**
 * Fetch Google Sheets data for client metrics
 */
async function fetchSheetsData(supabaseUrl: string, clientName: string): Promise<any> {
  try {
    // First, get sheet names to find client tab
    const sheetsResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-google-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        spreadsheetId: LOOKER_DIRECTORY_SHEET_ID,
      }),
    });

    if (!sheetsResponse.ok) {
      return null;
    }

    const sheetsData = await sheetsResponse.json();
    const sheetNames = sheetsData.sheetNames || [];
    
    // Find client's sheet (fuzzy match)
    const clientLower = clientName.toLowerCase();
    const matchedSheet = sheetNames.find((name: string) => {
      const nameLower = name.toLowerCase();
      return nameLower.includes(clientLower) || clientLower.includes(nameLower);
    });

    if (!matchedSheet) {
      console.log(`No sheet found for client: ${clientName}`);
      return null;
    }

    // Fetch the client's sheet data
    const dataResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-google-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        spreadsheetId: LOOKER_DIRECTORY_SHEET_ID,
        sheetName: matchedSheet,
      }),
    });

    if (!dataResponse.ok) {
      return null;
    }

    const clientData = await dataResponse.json();
    return parseClientSheetData(clientData.rows || []);
  } catch (error) {
    console.error("Error fetching Sheets data:", error);
    return null;
  }
}

/**
 * Fetch GHL data (workflows, emails, SMS, contacts, opportunities, appointments, calls, forms, payments, reviews)
 */
async function fetchGHLData(
  supabaseUrl: string,
  clientName: string,
  startDate: string,
  endDate: string
): Promise<{
  contacts?: { total: number; newThisPeriod: number; bySource: Record<string, number> };
  opportunities?: { total: number; totalValue: number; wonThisPeriod: number; wonValue: number };
  workflows?: { active: number; executed: number; workflows: Array<{ name: string; status: string; enrolledCount?: number }> };
  emails?: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number; campaigns: any[] };
  sms?: { sent: number; delivered: number; deliveryRate: number; responses: number; responseRate: number };
  campaigns?: { total: number; active: number };
  socialPosts?: { total: number; published: number; scheduled: number };
  appointments?: { total: number; booked: number; confirmed: number; showed: number; noShow: number; cancelled: number; showRate: number; upcoming: any[] };
  calls?: { total: number; inbound: number; outbound: number; answered: number; missed: number; totalDuration: number; avgDuration: number; answerRate: number };
  forms?: { total: number; submissions: number; conversionRate: number; forms: any[] };
  payments?: { totalRevenue: number; transactionCount: number; avgTransactionValue: number; successfulPayments: number; failedPayments: number; refunds: number; refundAmount: number; recentTransactions: any[] };
  reviews?: { total: number; averageRating: number; byRating: Record<string, number>; newThisPeriod: number; recentReviews: any[] };
} | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-ghl-data`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ 
        clientName,
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        // Fetch ALL available GHL data types
        dataTypes: [
          'contacts', 'opportunities', 'workflows', 'emails', 'sms', 
          'campaigns', 'social-posts', 'appointments', 'calls', 
          'forms', 'payments', 'reviews'
        ],
      }),
    });

    if (!response.ok) {
      console.warn("GHL fetch failed:", await response.text());
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.metrics) {
      console.warn("GHL returned no metrics:", data.error || "Unknown error");
      return null;
    }

    return data.metrics;
  } catch (error) {
    console.error("Error fetching GHL data:", error);
    return null;
  }
}

/**
 * Parse client sheet data into structured metrics
 */
function parseClientSheetData(rows: Record<string, string>[]): any {
  const metrics = {
    googleAds: { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, roas: 0 },
    metaAds: { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpm: 0, frequency: 0 },
    sms: { messagesSent: 0, deliveryRate: 0, responseRate: 0 },
    email: { openRate: 0, clickRate: 0, campaigns: [] },
    workflows: { activeCount: 0, newAutomations: [] },
  };

  // Parse rows looking for metric labels and values
  for (const row of rows) {
    const values = Object.values(row);
    for (let i = 0; i < values.length - 1; i++) {
      const label = String(values[i] || "").toLowerCase();
      const value = values[i + 1];
      
      // Google Ads metrics
      if (label.includes("google") && label.includes("spend")) {
        metrics.googleAds.spend = parseNumber(value);
      } else if (label.includes("google") && label.includes("clicks")) {
        metrics.googleAds.clicks = parseNumber(value);
      } else if (label.includes("google") && label.includes("conv")) {
        metrics.googleAds.conversions = parseNumber(value);
      }
      
      // Meta Ads metrics
      if (label.includes("meta") && label.includes("spend") || label.includes("facebook") && label.includes("spend")) {
        metrics.metaAds.spend = parseNumber(value);
      }
      
      // SMS metrics
      if (label.includes("sms") && label.includes("sent")) {
        metrics.sms.messagesSent = parseNumber(value);
      } else if (label.includes("delivery")) {
        metrics.sms.deliveryRate = parsePercentage(value);
      }
      
      // Email metrics
      if (label.includes("open") && label.includes("rate")) {
        metrics.email.openRate = parsePercentage(value);
      } else if (label.includes("click") && label.includes("rate")) {
        metrics.email.clickRate = parsePercentage(value);
      }
      
      // Workflows
      if (label.includes("workflow") || label.includes("automation")) {
        metrics.workflows.activeCount = parseNumber(value) || metrics.workflows.activeCount;
      }
    }
  }

  return metrics;
}
/**
 * Extract comprehensive branding from website using Firecrawl
 */
async function extractBranding(supabaseUrl: string, domain: string): Promise<{
  primary: string;
  secondary: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  logo?: string;
  favicon?: string;
  fonts?: string[];
} | null> {
  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.log("FIRECRAWL_API_KEY not configured, using default branding");
      return null;
    }

    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    console.log(`Extracting branding from: ${url}`);
    
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["branding"],
        waitFor: 5000,
      }),
    });

    if (!response.ok) {
      console.warn(`Firecrawl branding request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const branding = data.data?.branding || data.branding;
    
    console.log("Firecrawl branding response:", JSON.stringify(branding, null, 2));

    if (branding) {
      const colors = branding.colors || {};
      const fonts = branding.fonts?.map((f: any) => f.family).filter(Boolean) || [];
      const images = branding.images || {};
      
      return {
        primary: colors.primary || "#6366f1",
        secondary: colors.secondary || colors.accent || "#8b5cf6",
        background: colors.background || "#1A1F2C",
        textPrimary: colors.textPrimary || "#FFFFFF",
        textSecondary: colors.textSecondary || "#B0B0B0",
        logo: images.logo || branding.logo || undefined,
        favicon: images.favicon || undefined,
        fonts: fonts.length > 0 ? fonts : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error("Error extracting branding:", error);
    return null;
  }
}

/**
 * Build deck content structure from all data sources including GHL
 */
function buildDeckContent(
  lookerData: { 
    screenshots: Array<{ image: string; section: string; category?: string }>; 
    extractedMetrics: any; 
    aiAnalysis: any;
    markdown?: string;
    summary?: any;
    keyFindings?: string[];
    executiveSummary?: string;
    supermetricsData?: Record<string, unknown>;
  } | null,
  notionTasks: any[],
  sheetsData: any,
  ghlData: {
    contacts?: { total: number; newThisPeriod: number; bySource: Record<string, number> };
    opportunities?: { total: number; totalValue: number; wonThisPeriod: number; wonValue: number };
    workflows?: { active: number; executed: number; workflows: Array<{ name: string; status: string; enrolledCount?: number }> };
    emails?: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number; campaigns: any[] };
    sms?: { sent: number; delivered: number; deliveryRate: number; responses: number; responseRate: number };
    campaigns?: { total: number; active: number };
    socialPosts?: { total: number; published: number; scheduled: number };
    appointments?: { total: number; booked: number; confirmed: number; showed: number; noShow: number; cancelled: number; showRate: number; upcoming: any[] };
    calls?: { total: number; inbound: number; outbound: number; answered: number; missed: number; totalDuration: number; avgDuration: number; answerRate: number };
    forms?: { total: number; submissions: number; conversionRate: number; forms: any[] };
    payments?: { totalRevenue: number; transactionCount: number; avgTransactionValue: number; successfulPayments: number; failedPayments: number; refunds: number; refundAmount: number; recentTransactions: any[] };
    reviews?: { total: number; averageRating: number; byRating: Record<string, number>; newThisPeriod: number; recentReviews: any[] };
  } | null,
  clientName: string,
  dateStart: string,
  dateEnd: string,
  supermetricsData: Record<string, any> | null,
  taskNotes: string | null
): any {
  // ===== SUPERMETRICS DATA (highest priority) =====
  // Support versioned keys (google_ads_v1, google_ads_v2) or legacy single keys (google_ads)
  const findSmPlatform = (prefix: string) => {
    if (!supermetricsData) return [];
    return Object.entries(supermetricsData)
      .filter(([k]) => k === prefix || k.startsWith(`${prefix}_v`))
      .map(([k, v]) => ({ key: k, data: v as any }));
  };
  
  const smGoogleEntries = findSmPlatform('google_ads');
  const smMetaEntries = findSmPlatform('meta_ads');
  const smTiktokEntries = findSmPlatform('tiktok_ads');
  const smBingEntries = findSmPlatform('bing_ads');
  const smLinkedinEntries = findSmPlatform('linkedin_ads');
  
  // For backward compat, use the first entry as primary
  const smGoogle = smGoogleEntries[0]?.data;
  const smMeta = smMetaEntries[0]?.data;
  const smTiktok = smTiktokEntries[0]?.data;
  const smBing = smBingEntries[0]?.data;
  const smLinkedin = smLinkedinEntries[0]?.data;
  
  const hasSupermetrics = !!supermetricsData && Object.keys(supermetricsData).length > 0;
  
  // Use AI vision analysis metrics from uploaded screenshots
  const extractedGoogle = lookerData?.extractedMetrics?.googleAds;
  const extractedMeta = lookerData?.extractedMetrics?.metaAds;
  const extractedSms = lookerData?.extractedMetrics?.sms;
  const extractedEmail = lookerData?.extractedMetrics?.email;
  const extractedOverview = lookerData?.extractedMetrics?.overview;
  const summaryData = lookerData?.summary || {};
  
  // Legacy AI analysis fallback
  const aiMetrics = lookerData?.aiAnalysis?.sections?.reduce((acc: any, sec: any) => {
    return { ...acc, ...sec.metrics };
  }, {}) || {};
  const metrics = { ...lookerData?.extractedMetrics?.metrics, ...aiMetrics };
  
  const sheets = sheetsData || {
    googleAds: {},
    metaAds: {},
    sms: {},
    email: {},
    workflows: {},
  };

  // Prioritize: Supermetrics > AI Vision > Legacy metrics > Sheets
  const googleMetrics = extractedGoogle?.metrics || {};
  const metaMetrics = extractedMeta?.metrics || {};
  
  const googleSpend = smGoogle?.summary?._cost || parseNumber(googleMetrics.spend || metrics.spend || metrics.google_spend) || summaryData.totalSpend * 0.6 || sheets.googleAds?.spend || 0;
  const googleClicks = smGoogle?.summary?._clicks || parseNumber(googleMetrics.clicks || metrics.clicks || metrics.google_clicks) || sheets.googleAds?.clicks || 0;
  const googleImpressions = smGoogle?.summary?._impressions || parseNumber(googleMetrics.impressions || metrics.impressions) || sheets.googleAds?.impressions || 0;
  const googleConversions = smGoogle?.summary?._conversions || parseNumber(googleMetrics.conversions || googleMetrics.leads || metrics.conversions || metrics.google_conversions) || sheets.googleAds?.conversions || 0;
  const googleCtr = smGoogle?.summary?._ctr || parseNumber(googleMetrics.ctr || metrics.ctr) || sheets.googleAds?.ctr || 0;
  const googleCpc = smGoogle?.summary?._cpc || parseNumber(googleMetrics.cpc || metrics.cpc) || sheets.googleAds?.cpc || 0;
  const googleRoas = parseNumber(googleMetrics.roas || metrics.roas || metrics.google_roas) || sheets.googleAds?.roas || 0;
  const googleCpa = smGoogle?.summary?._cpa || (googleSpend && googleConversions ? googleSpend / googleConversions : 0);
  const googleConvRate = smGoogle?.summary?._conversion_rate || parseNumber(googleMetrics.conversionRate) || 0;

  const metaSpend = smMeta?.summary?._cost || parseNumber(metaMetrics.spend || metrics.meta_spend || metrics.facebook_spend) || summaryData.totalSpend * 0.4 || sheets.metaAds?.spend || 0;
  const metaImpressions = smMeta?.summary?._impressions || parseNumber(metaMetrics.impressions || metrics.meta_impressions) || sheets.metaAds?.impressions || 0;
  const metaClicks = smMeta?.summary?._clicks || parseNumber(metaMetrics.clicks) || sheets.metaAds?.clicks || 0;
  const metaConversions = smMeta?.summary?._conversions || parseNumber(metaMetrics.conversions || metaMetrics.leads || metrics.meta_conversions) || sheets.metaAds?.conversions || 0;
  const metaCpm = smMeta?.summary?._cpm || parseNumber(metaMetrics.cpm || metrics.cpm) || sheets.metaAds?.cpm || 0;
  const metaCtr = smMeta?.summary?._ctr || parseNumber(metaMetrics.ctr) || 0;
  const metaCpc = smMeta?.summary?._cpc || 0;
  const metaCpa = smMeta?.summary?._cpa || (metaSpend && metaConversions ? metaSpend / metaConversions : 0);

  // Period-over-period changes from Supermetrics
  const googlePrev = smGoogle?.previousPeriod || {};
  const metaPrev = smMeta?.previousPeriod || {};

  // Use GHL data for SMS, Email, Workflows, Contacts with fallback to sheets
  const ghl = ghlData || {};
  
  // Get insights from AI vision analysis
  const googleInsights = extractedGoogle?.insights || lookerData?.aiAnalysis?.sections?.find((s: any) => s.sectionType === 'google_ads')?.insights || [];
  const metaInsights = extractedMeta?.insights || lookerData?.aiAnalysis?.sections?.find((s: any) => s.sectionType === 'meta_ads')?.insights || [];
  const allKeyFindings = lookerData?.keyFindings || [];
  const executiveSummary = lookerData?.executiveSummary || '';

  // Find screenshots by section type (new format: sectionType)
  const findScreenshotBySection = (sectionType: string) => {
    const section = lookerData?.aiAnalysis?.sections?.find((s: any) => s.sectionType === sectionType);
    return section?.sourceScreenshot || null;
  };

  // Calculate performance grades
  const googleGrade = calculatePerformanceGrade(googleSpend, googleConversions, googleCtr, googleRoas);
  const metaGrade = calculatePerformanceGrade(metaSpend, metaConversions, metaCtr, 0);

  // Helper to compute % change
  const pctChange = (current: number, prev: number) => {
    if (!prev || prev === 0) return null;
    return ((current - prev) / prev) * 100;
  };

  // Aggregate totals across ALL Supermetrics platforms (not just Google+Meta)
  const allPlatformTotals = hasSupermetrics ? (() => {
    let totalSpend = 0, totalClicks = 0, totalConversions = 0, totalLeads = 0, totalImpressions = 0;
    for (const [, data] of Object.entries(supermetricsData as Record<string, any>)) {
      totalSpend += data?.summary?._cost || 0;
      totalClicks += data?.summary?._clicks || 0;
      totalConversions += data?.summary?._conversions || 0;
      totalLeads += data?.summary?._leads || 0;
      totalImpressions += data?.summary?._impressions || 0;
    }
    return { totalSpend, totalClicks, totalConversions, totalLeads, totalImpressions };
  })() : null;

  return {
    // Flag that Supermetrics data was used
    dataSource: hasSupermetrics ? 'supermetrics' : 'screenshots',
    hero: {
      totalSpend: allPlatformTotals?.totalSpend || (googleSpend + metaSpend),
      totalLeads: allPlatformTotals?.totalLeads || allPlatformTotals?.totalConversions || (googleConversions + metaConversions),
      roas: googleRoas || calculateRoas(allPlatformTotals?.totalSpend || (googleSpend + metaSpend), allPlatformTotals?.totalConversions || (googleConversions + metaConversions)),
      totalImpressions: allPlatformTotals?.totalImpressions || (googleImpressions + metaImpressions),
      totalClicks: allPlatformTotals?.totalClicks || (googleClicks + metaClicks),
      avgCTR: ((googleCtr + metaCtr) / 2) || 0,
      avgCPC: ((googleCpc + metaCpc) / 2) || 0,
      overviewScreenshot: findScreenshotBySection('overview') || lookerData?.screenshots?.[0]?.image || null,
      executiveSummary,
      keyFindings: allKeyFindings,
      newContacts: ghl.contacts?.newThisPeriod || 0,
      pipelineValue: ghl.opportunities?.totalValue || 0,
      performanceGrades: {
        overall: googleGrade,
        google: googleGrade,
        meta: metaGrade,
      },
      // Period-over-period changes from Supermetrics
      changes: hasSupermetrics ? {
        spend: pctChange(googleSpend + metaSpend, (googlePrev._cost || 0) + (metaPrev._cost || 0)),
        clicks: pctChange(googleClicks + metaClicks, (googlePrev._clicks || 0) + (metaPrev._clicks || 0)),
        conversions: pctChange(googleConversions + metaConversions, (googlePrev._conversions || 0) + (metaPrev._conversions || 0)),
        impressions: pctChange(googleImpressions + metaImpressions, (googlePrev._impressions || 0) + (metaPrev._impressions || 0)),
      } : undefined,
    },
    adOverview: {
      screenshot: findScreenshotBySection('overview') || lookerData?.screenshots?.[0]?.image || null,
      screenshots: lookerData?.screenshots?.map((s: any) => s.image) || [],
      metrics: {
        totalSpend: googleSpend + metaSpend,
        totalClicks: googleClicks + metaClicks,
        totalConversions: googleConversions + metaConversions,
        totalImpressions: googleImpressions + metaImpressions,
      },
    },
    googleAds: {
      screenshot: findScreenshotBySection('google_ads') || findScreenshotByCategory(lookerData?.screenshots, 'google_ads') || lookerData?.screenshots?.[0]?.image || null,
      screenshots: lookerData?.aiAnalysis?.sections?.filter((s: any) => s.sectionType === 'google_ads').map((s: any) => s.sourceScreenshot) || [],
      spend: googleSpend,
      impressions: googleImpressions,
      clicks: googleClicks,
      conversions: googleConversions,
      ctr: googleCtr,
      cpc: googleCpc,
      cpa: googleCpa,
      conversionRate: googleConvRate,
      roas: googleRoas,
      insights: googleInsights,
      cropRegions: extractedGoogle?.cropRegions || [],
      rawData: smGoogle?.rawData || null,
      previousPeriod: hasSupermetrics ? {
        spend: googlePrev._cost || 0,
        impressions: googlePrev._impressions || 0,
        clicks: googlePrev._clicks || 0,
        conversions: googlePrev._conversions || 0,
        ctr: googlePrev._ctr || 0,
        cpc: googlePrev._cpc || 0,
      } : undefined,
      changes: hasSupermetrics ? {
        spend: pctChange(googleSpend, googlePrev._cost),
        clicks: pctChange(googleClicks, googlePrev._clicks),
        conversions: pctChange(googleConversions, googlePrev._conversions),
        ctr: pctChange(googleCtr, googlePrev._ctr),
        cpc: pctChange(googleCpc, googlePrev._cpc),
      } : undefined,
    },
    metaAds: {
      screenshot: findScreenshotBySection('meta_ads') || findScreenshotByCategory(lookerData?.screenshots, 'meta_ads') || null,
      screenshots: lookerData?.aiAnalysis?.sections?.filter((s: any) => s.sectionType === 'meta_ads').map((s: any) => s.sourceScreenshot) || [],
      spend: metaSpend,
      impressions: metaImpressions,
      clicks: metaClicks,
      conversions: metaConversions,
      ctr: metaCtr,
      cpc: metaCpc,
      cpa: metaCpa,
      cpm: metaCpm,
      frequency: parseNumber(metrics.frequency) || sheets.metaAds?.frequency || 0,
      insights: metaInsights,
      cropRegions: extractedMeta?.cropRegions || [],
      rawData: smMeta?.rawData || null,
      previousPeriod: hasSupermetrics ? {
        spend: metaPrev._cost || 0,
        impressions: metaPrev._impressions || 0,
        clicks: metaPrev._clicks || 0,
        conversions: metaPrev._conversions || 0,
        ctr: metaPrev._ctr || 0,
        cpc: metaPrev._cpc || 0,
      } : undefined,
      changes: hasSupermetrics ? {
        spend: pctChange(metaSpend, metaPrev._cost),
        clicks: pctChange(metaClicks, metaPrev._clicks),
        conversions: pctChange(metaConversions, metaPrev._conversions),
        ctr: pctChange(metaCtr, metaPrev._ctr),
        cpc: pctChange(metaCpc, metaPrev._cpc),
      } : undefined,
    },
    // Additional Supermetrics platforms
    ...(smTiktok ? {
      tiktokAds: {
        label: smTiktok.label,
        spend: smTiktok.summary?._cost || 0,
        impressions: smTiktok.summary?._impressions || 0,
        clicks: smTiktok.summary?._clicks || 0,
        conversions: smTiktok.summary?._conversions || 0,
        ctr: smTiktok.summary?._ctr || 0,
        cpc: smTiktok.summary?._cpc || 0,
        rawData: smTiktok.rawData || null,
        previousPeriod: smTiktok.previousPeriod || null,
      }
    } : {}),
    ...(smBing ? {
      bingAds: {
        label: smBing.label,
        spend: smBing.summary?._cost || 0,
        impressions: smBing.summary?._impressions || 0,
        clicks: smBing.summary?._clicks || 0,
        conversions: smBing.summary?._conversions || 0,
        ctr: smBing.summary?._ctr || 0,
        cpc: smBing.summary?._cpc || 0,
        rawData: smBing.rawData || null,
        previousPeriod: smBing.previousPeriod || null,
      }
    } : {}),
    ...(smLinkedin ? {
      linkedinAds: {
        label: smLinkedin.label,
        spend: smLinkedin.summary?._cost || 0,
        impressions: smLinkedin.summary?._impressions || 0,
        clicks: smLinkedin.summary?._clicks || 0,
        conversions: smLinkedin.summary?._conversions || 0,
        ctr: smLinkedin.summary?._ctr || 0,
        cpc: smLinkedin.summary?._cpc || 0,
        rawData: smLinkedin.rawData || null,
        previousPeriod: smLinkedin.previousPeriod || null,
      }
    } : {}),
    // SMS: prioritize GHL data, then AI extracted
    sms: {
      messagesSent: ghl.sms?.sent || parseNumber(extractedSms?.metrics?.messagesSent) || sheets.sms?.messagesSent || 0,
      delivered: ghl.sms?.delivered || 0,
      deliveryRate: ghl.sms?.deliveryRate || parseNumber(extractedSms?.metrics?.deliveryRate) || sheets.sms?.deliveryRate || 0,
      responses: ghl.sms?.responses || 0,
      responseRate: ghl.sms?.responseRate || parseNumber(extractedSms?.metrics?.responseRate) || sheets.sms?.responseRate || 0,
      highlights: extractedSms?.insights || [],
      screenshot: findScreenshotBySection('sms') || null,
    },
    // Email: prioritize GHL data
    email: {
      sent: ghl.emails?.sent || 0,
      opened: ghl.emails?.opened || 0,
      clicked: ghl.emails?.clicked || 0,
      openRate: ghl.emails?.openRate || sheets.email?.openRate || 0,
      clickRate: ghl.emails?.clickRate || sheets.email?.clickRate || 0,
      campaigns: ghl.emails?.campaigns || sheets.email?.campaigns || [],
    },
    // Workflows: prioritize GHL data
    workflows: {
      activeCount: ghl.workflows?.active || sheets.workflows?.activeCount || 0,
      totalExecuted: ghl.workflows?.executed || 0,
      workflows: ghl.workflows?.workflows || [],
      newAutomations: sheets.workflows?.newAutomations || [],
    },
    // NEW: Contacts from GHL
    contacts: {
      total: ghl.contacts?.total || 0,
      newThisPeriod: ghl.contacts?.newThisPeriod || 0,
      bySource: ghl.contacts?.bySource || {},
    },
    // NEW: Opportunities/Pipeline from GHL
    opportunities: {
      total: ghl.opportunities?.total || 0,
      totalValue: ghl.opportunities?.totalValue || 0,
      wonThisPeriod: ghl.opportunities?.wonThisPeriod || 0,
      wonValue: ghl.opportunities?.wonValue || 0,
    },
    // NEW: Campaigns summary from GHL
    campaigns: {
      total: ghl.campaigns?.total || 0,
      active: ghl.campaigns?.active || 0,
    },
    // NEW: Social posts from GHL
    socialMedia: {
      total: ghl.socialPosts?.total || 0,
      published: ghl.socialPosts?.published || 0,
      scheduled: ghl.socialPosts?.scheduled || 0,
    },
    // NEW: Appointments from GHL
    appointments: {
      total: ghl.appointments?.total || 0,
      booked: ghl.appointments?.booked || 0,
      confirmed: ghl.appointments?.confirmed || 0,
      showed: ghl.appointments?.showed || 0,
      noShow: ghl.appointments?.noShow || 0,
      cancelled: ghl.appointments?.cancelled || 0,
      showRate: ghl.appointments?.showRate || 0,
      upcoming: ghl.appointments?.upcoming || [],
    },
    // NEW: Calls from GHL
    calls: {
      total: ghl.calls?.total || 0,
      inbound: ghl.calls?.inbound || 0,
      outbound: ghl.calls?.outbound || 0,
      answered: ghl.calls?.answered || 0,
      missed: ghl.calls?.missed || 0,
      avgDuration: ghl.calls?.avgDuration || 0,
      answerRate: ghl.calls?.answerRate || 0,
    },
    // NEW: Forms from GHL
    forms: {
      total: ghl.forms?.total || 0,
      submissions: ghl.forms?.submissions || 0,
      conversionRate: ghl.forms?.conversionRate || 0,
      forms: ghl.forms?.forms || [],
    },
    // NEW: Payments from GHL
    payments: {
      totalRevenue: ghl.payments?.totalRevenue || 0,
      transactionCount: ghl.payments?.transactionCount || 0,
      avgTransactionValue: ghl.payments?.avgTransactionValue || 0,
      successfulPayments: ghl.payments?.successfulPayments || 0,
      failedPayments: ghl.payments?.failedPayments || 0,
      refunds: ghl.payments?.refunds || 0,
      refundAmount: ghl.payments?.refundAmount || 0,
      recentTransactions: ghl.payments?.recentTransactions || [],
    },
    // NEW: Reviews from GHL
    reviews: {
      total: ghl.reviews?.total || 0,
      averageRating: ghl.reviews?.averageRating || 0,
      byRating: ghl.reviews?.byRating || {},
      newThisPeriod: ghl.reviews?.newThisPeriod || 0,
      recentReviews: ghl.reviews?.recentReviews || [],
    },
    services: {
      tasks: categorizeNotionTasks(notionTasks),
    },
    // Raw task notes from user — AI will categorize by platform
    taskNotes: taskNotes || null,
    nextSteps: {
      recommendations: [],
      focusAreas: [],
    },
    // Include AI analysis data
    aiAnalysis: lookerData?.aiAnalysis || null,
    allScreenshots: lookerData?.screenshots || [],
    // Individual ad platform accounts (supports V1, V2, etc.)
    adPlatforms: buildAdPlatformsArray(supermetricsData, pctChange),
  };
}

/**
 * Download creative images from temporary CDN URLs and upload to permanent Supabase Storage.
 * This solves the issue of Meta/Facebook CDN URLs expiring after hours/days.
 */
async function cacheCreativeImages(adPlatforms: any[], supabase: any): Promise<void> {
  const BUCKET = 'creative-images';
  let cached = 0;
  let failed = 0;

  for (const platform of adPlatforms) {
    if (!platform.topContent || !Array.isArray(platform.topContent)) continue;

    for (const creative of platform.topContent) {
      const originalUrl = creative.imageUrl;
      if (!originalUrl || !originalUrl.startsWith('http')) continue;
      // Skip if already cached to our storage
      if (originalUrl.includes('supabase') && originalUrl.includes(BUCKET)) continue;

      try {
        // Download the image with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(originalUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn(`[IMG-CACHE] Failed to download ${originalUrl}: ${response.status}`);
          failed++;
          continue;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        const blob = await response.arrayBuffer();
        
        // Generate a unique path: platform/adname-hash.ext
        const safeName = (creative.adName || 'creative').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
        const hash = Array.from(new Uint8Array(blob.slice(0, 32)))
          .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
        const storagePath = `${platform.key}/${safeName}_${hash}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, blob, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.warn(`[IMG-CACHE] Upload failed for ${safeName}: ${uploadError.message}`);
          failed++;
          continue;
        }

        // Get the public URL
        const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        if (publicUrlData?.publicUrl) {
          creative.imageUrl = publicUrlData.publicUrl;
          cached++;
        }
      } catch (err) {
        console.warn(`[IMG-CACHE] Error caching ${creative.adName}: ${err instanceof Error ? err.message : err}`);
        failed++;
      }
    }
  }

  console.log(`[IMG-CACHE] ✅ Cached ${cached} images, ${failed} failed`);
}

/**
 * Build an array of individual ad platform entries from Supermetrics data
 * Each account gets its own entry with label like "Google Ads V1"
 */
function buildAdPlatformsArray(
  supermetricsData: Record<string, any> | null,
  pctChange: (current: number, prev: number) => number | null,
): any[] {
  if (!supermetricsData) return [];
  
  const platformIcons: Record<string, string> = {
    'google_ads': 'search',
    'meta_ads': 'megaphone',
    'tiktok_ads': 'video',
    'bing_ads': 'search',
    'linkedin_ads': 'briefcase',
  };
  
  return Object.entries(supermetricsData).map(([key, data]: [string, any]) => {
    const summary = data.summary || {};
    const prev = data.previousPeriod || {};
    const platformKey = data.platformKey || key.replace(/_v\d+$/, '');
    
    const spend = summary._cost || 0;
    const clicks = summary._clicks || 0;
    const conversions = summary._conversions || 0;
    const ctr = summary._ctr || 0;
    const cpa = summary._cpa || 0;
    const roas = spend > 0 && conversions > 0 ? (conversions * 100) / spend : 0;
    
    // Calculate grade
    const grade = calculatePerformanceGrade(spend, conversions, ctr, roas);
    
    // Conversion breakdown: leads, purchases, calls
    const leads = summary._leads || 0;
    const purchases = summary._purchases || 0;
    const calls = summary._phoneCalls || 0;
    const cpl = summary._cpl || 0;
    const costPerPurchase = summary._costPerPurchase || 0;

    return {
      key,
      label: data.label || key,
      accountName: data.accountName || '',
      platformKey,
      icon: platformIcons[platformKey] || 'bar-chart',
      spend,
      impressions: summary._impressions || 0,
      clicks,
      conversions,
      leads,
      purchases,
      calls,
      ctr,
      cpc: summary._cpc || 0,
      cpa,
      cpl,
      costPerPurchase,
      cpm: summary._cpm || 0,
      conversionRate: summary._conversion_rate || 0,
      grade,
      topContent: data.topContent || [],
      campaigns: data.campaigns || [],
      dailyData: data.dailyData || [],
      keywords: data.keywords || [],
      changes: {
        spend: pctChange(summary._cost || 0, prev._cost || 0),
        clicks: pctChange(summary._clicks || 0, prev._clicks || 0),
        conversions: pctChange(summary._conversions || 0, prev._conversions || 0),
        leads: pctChange(summary._leads || 0, prev._leads || 0),
        purchases: pctChange(summary._purchases || 0, prev._purchases || 0),
        ctr: pctChange(summary._ctr || 0, prev._ctr || 0),
        cpc: pctChange(summary._cpc || 0, prev._cpc || 0),
      },
    };
  });
}

/**
 * Find screenshot by category from AI analysis
 */
function findScreenshotByCategory(
  screenshots: Array<{ image: string; section: string; category?: string }> | undefined,
  category: string
): string | null {
  if (!screenshots || screenshots.length === 0) return null;
  const match = screenshots.find(s => s.category === category || s.section.toLowerCase().includes(category.replace('_', ' ')));
  return match?.image || null;
}

/**
 * Categorize Notion tasks by type
 */
function categorizeNotionTasks(tasks: any[]): { category: string; items: string[] }[] {
  const categories: Record<string, string[]> = {
    "Content & Blog": [],
    "Technical SEO": [],
    "Link Building": [],
    "Local SEO": [],
    "Design": [],
    "Website Updates": [],
    "Ads Management": [],
    "Social Media": [],
    "Other": [],
  };

  for (const task of tasks) {
    const title = task.title || task.name || "";
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("blog") || lowerTitle.includes("content") || lowerTitle.includes("article")) {
      categories["Content & Blog"].push(title);
    } else if (lowerTitle.includes("seo") || lowerTitle.includes("meta") || lowerTitle.includes("schema") || lowerTitle.includes("sitemap")) {
      categories["Technical SEO"].push(title);
    } else if (lowerTitle.includes("link") || lowerTitle.includes("backlink") || lowerTitle.includes("citation")) {
      categories["Link Building"].push(title);
    } else if (lowerTitle.includes("gmb") || lowerTitle.includes("local") || lowerTitle.includes("google business")) {
      categories["Local SEO"].push(title);
    } else if (lowerTitle.includes("design") || lowerTitle.includes("graphic") || lowerTitle.includes("banner") || lowerTitle.includes("creative")) {
      categories["Design"].push(title);
    } else if (lowerTitle.includes("website") || lowerTitle.includes("page") || lowerTitle.includes("landing") || lowerTitle.includes("wordpress")) {
      categories["Website Updates"].push(title);
    } else if (lowerTitle.includes("ad") || lowerTitle.includes("campaign") || lowerTitle.includes("ppc") || lowerTitle.includes("google ads") || lowerTitle.includes("meta ads")) {
      categories["Ads Management"].push(title);
    } else if (lowerTitle.includes("social") || lowerTitle.includes("facebook") || lowerTitle.includes("instagram") || lowerTitle.includes("post")) {
      categories["Social Media"].push(title);
    } else if (title.trim()) {
      categories["Other"].push(title);
    }
  }

  return Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }));
}

/**
 * Calculate performance grade based on metrics vs industry benchmarks
 */
function calculatePerformanceGrade(spend: number, conversions: number, ctr: number, roas: number): string {
  let score = 0;
  
  // ROAS scoring (0-30 points)
  if (roas >= 5) score += 30;
  else if (roas >= 3) score += 25;
  else if (roas >= 2) score += 20;
  else if (roas >= 1) score += 10;
  
  // CTR scoring (0-25 points) - based on industry averages
  if (ctr >= 5) score += 25;
  else if (ctr >= 3) score += 20;
  else if (ctr >= 2) score += 15;
  else if (ctr >= 1) score += 10;
  
  // Conversion volume scoring (0-25 points)
  if (conversions >= 100) score += 25;
  else if (conversions >= 50) score += 20;
  else if (conversions >= 20) score += 15;
  else if (conversions >= 10) score += 10;
  else if (conversions >= 1) score += 5;
  
  // Spend efficiency (0-20 points)
  const cpa = spend / Math.max(conversions, 1);
  if (cpa <= 25) score += 20;
  else if (cpa <= 50) score += 15;
  else if (cpa <= 100) score += 10;
  else if (cpa <= 200) score += 5;
  
  // Convert to letter grade
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Generate AI insights using Claude vision + metrics
 * Enhanced with narrative storytelling, performance grades, and trend analysis
 */
async function generateAIInsights(
  deckContent: any,
  lookerData: { 
    screenshots: Array<{ image: string; section: string; category?: string }>; 
    extractedMetrics: any; 
    aiAnalysis: any;
    markdown: string 
  } | null,
  clientName: string,
  startDate: string,
  endDate: string
): Promise<{
  googleAdsInsights: string[];
  metaAdsInsights: string[];
  smsHighlights: string[];
  recommendations: { title: string; priority: "high" | "medium" | "low"; impact?: string; category?: string }[];
  focusAreas: string[];
  narrative?: {
    summary: string;
    wins: string[];
    challenges: string[];
    outlook: string;
  };
  performanceGrades?: {
    overall: string;
    google: string;
    meta: string;
    engagement: string;
  };
  trendAnalysis?: {
    spending: 'up' | 'down' | 'stable';
    conversions: 'up' | 'down' | 'stable';
    efficiency: 'up' | 'down' | 'stable';
  };
} | null> {
  try {
    // AI insights uses the shared Claude helper (ANTHROPIC_API_KEY checked inside callClaude)

    // Calculate performance grades
    const googleGrade = calculatePerformanceGrade(
      deckContent.googleAds.spend,
      deckContent.googleAds.conversions,
      deckContent.googleAds.ctr,
      deckContent.googleAds.roas
    );
    const metaGrade = calculatePerformanceGrade(
      deckContent.metaAds.spend,
      deckContent.metaAds.conversions,
      deckContent.metaAds.ctr || 0,
      0 // Meta doesn't typically have ROAS in same way
    );
    
    // Overall grade is weighted average
    const gradeToNum = (g: string) => {
      const grades: Record<string, number> = { 'A+': 97, 'A': 93, 'A-': 90, 'B+': 87, 'B': 83, 'B-': 80, 'C+': 77, 'C': 73, 'C-': 70, 'D': 60, 'F': 50 };
      return grades[g] || 70;
    };
    const avgGradeNum = (gradeToNum(googleGrade) * 0.6 + gradeToNum(metaGrade) * 0.4);
    const overallGrade = avgGradeNum >= 90 ? 'A' : avgGradeNum >= 80 ? 'B' : avgGradeNum >= 70 ? 'C' : avgGradeNum >= 60 ? 'D' : 'F';
    if (avgGradeNum >= 95) deckContent.performanceGrades = { overall: 'A+', google: googleGrade, meta: metaGrade, engagement: 'A' };
    else if (avgGradeNum >= 87) deckContent.performanceGrades = { overall: 'A-', google: googleGrade, meta: metaGrade, engagement: 'B+' };

    // Build context from all available data
    const lookerContext = lookerData?.markdown 
      ? `\n\nLooker Dashboard Content:\n${lookerData.markdown.substring(0, 3000)}`
      : "";
    
    const aiAnalysisContext = lookerData?.aiAnalysis 
      ? `\n\nAI Analysis from Screenshots:\n${JSON.stringify(lookerData.aiAnalysis, null, 2)}`
      : "";
    
    const extractedMetricsCtx = lookerData?.extractedMetrics?.metrics 
      ? `\n\nExtracted Metrics from Dashboard:\n${JSON.stringify(lookerData.extractedMetrics.metrics, null, 2)}`
      : "";

    // Supermetrics period-over-period context
    const supermetricsContext = deckContent.dataSource === 'supermetrics' ? `
PERIOD-OVER-PERIOD COMPARISON (from Supermetrics):
Google Ads Changes: ${deckContent.googleAds.changes ? Object.entries(deckContent.googleAds.changes).map(([k,v]) => `${k}: ${v !== null ? `${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(1)}%` : 'N/A'}`).join(', ') : 'N/A'}
Meta Ads Changes: ${deckContent.metaAds.changes ? Object.entries(deckContent.metaAds.changes).map(([k,v]) => `${k}: ${v !== null ? `${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(1)}%` : 'N/A'}`).join(', ') : 'N/A'}
Google Ads CPA: $${deckContent.googleAds.cpa?.toFixed(2) || 'N/A'}
Meta Ads CPA: $${deckContent.metaAds.cpa?.toFixed(2) || 'N/A'}
${deckContent.tiktokAds ? `TikTok Ads: $${deckContent.tiktokAds.spend.toLocaleString()} spend, ${deckContent.tiktokAds.clicks} clicks, ${deckContent.tiktokAds.conversions} conversions` : ''}
${deckContent.bingAds ? `Microsoft/Bing Ads: $${deckContent.bingAds.spend.toLocaleString()} spend, ${deckContent.bingAds.clicks} clicks, ${deckContent.bingAds.conversions} conversions` : ''}
${deckContent.linkedinAds ? `LinkedIn Ads: $${deckContent.linkedinAds.spend.toLocaleString()} spend, ${deckContent.linkedinAds.clicks} clicks, ${deckContent.linkedinAds.conversions} conversions` : ''}
` : '';

    // Build deep per-platform context from adPlatforms array (campaigns, keywords, creatives, daily trends)
    const adPlatformsDeepContext = Array.isArray(deckContent.adPlatforms) && deckContent.adPlatforms.length > 0
      ? `\nDETAILED PER-PLATFORM DATA:\n` + deckContent.adPlatforms.map((p: any) => {
        const parts: string[] = [];
        parts.push(`\n--- ${p.label} (${p.platformKey}) | Grade: ${p.grade} ---`);
        parts.push(`KPIs: $${p.spend?.toLocaleString()} spend, ${p.clicks?.toLocaleString()} clicks, ${p.conversions} conversions, ${p.ctr?.toFixed(2)}% CTR, $${p.cpa?.toFixed(2)} CPA, ${p.conversionRate?.toFixed(2)}% CVR`);
        if (p.changes) {
          parts.push(`PoP Changes: ${Object.entries(p.changes).filter(([,v]) => v !== null).map(([k,v]) => `${k}: ${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(1)}%`).join(', ')}`);
        }
        // Top 5 campaigns by spend
        if (p.campaigns?.length > 0) {
          const topCampaigns = [...p.campaigns].sort((a: any, b: any) => (b._cost || 0) - (a._cost || 0)).slice(0, 5);
          parts.push(`Top Campaigns (by spend):`);
          topCampaigns.forEach((c: any) => {
            parts.push(`  • ${c._campaign_name || c.campaign || 'Unknown'}: $${(c._cost || 0).toFixed(0)} spend, ${c._clicks || 0} clicks, ${c._conversions || 0} conv, ${(c._ctr || 0).toFixed(2)}% CTR, $${(c._cpa || 0).toFixed(2)} CPA`);
          });
        }
        // Top 3 creatives
        if (p.topContent?.length > 0) {
          parts.push(`Top Creatives:`);
          p.topContent.slice(0, 3).forEach((tc: any) => {
            parts.push(`  • ${tc.headline || tc.ad_name || 'Creative'}: ${tc.ctr?.toFixed(2) || tc._ctr?.toFixed(2) || '?'}% CTR, ${tc.conversions || tc._conversions || 0} conv${tc.image_url ? ' [has image]' : ''}`);
          });
        }
        // Top 5 keywords
        if (p.keywords?.length > 0) {
          parts.push(`Top Keywords:`);
          p.keywords.slice(0, 5).forEach((kw: any) => {
            parts.push(`  • "${kw._keyword || kw.keyword || 'Unknown'}": ${kw._clicks || 0} clicks, ${kw._conversions || 0} conv, $${(kw._cpa || 0).toFixed(2)} CPA, QS: ${kw._quality_score || 'N/A'}`);
          });
        }
        // Daily trend summary (first/last 3 days to show trajectory)
        if (p.dailyData?.length > 3) {
          const first3Avg = p.dailyData.slice(0, 3).reduce((s: number, d: any) => s + (d._cost || 0), 0) / 3;
          const last3Avg = p.dailyData.slice(-3).reduce((s: number, d: any) => s + (d._cost || 0), 0) / 3;
          const trend = last3Avg > first3Avg * 1.1 ? 'increasing' : last3Avg < first3Avg * 0.9 ? 'decreasing' : 'stable';
          parts.push(`Daily spend trend: ${trend} (early avg: $${first3Avg.toFixed(0)}/day → recent avg: $${last3Avg.toFixed(0)}/day over ${p.dailyData.length} days)`);
        }
        return parts.join('\n');
      }).join('\n')
      : '';

    const prompt = `You are a senior digital marketing strategist creating a premium client presentation for ${clientName} for ${startDate} to ${endDate}.

PERFORMANCE DATA:
- Google Ads: $${deckContent.googleAds.spend.toLocaleString()} spend, ${deckContent.googleAds.clicks.toLocaleString()} clicks, ${deckContent.googleAds.conversions} conversions, ${deckContent.googleAds.roas}x ROAS (Grade: ${googleGrade})
- Meta Ads: $${deckContent.metaAds.spend.toLocaleString()} spend, ${deckContent.metaAds.impressions.toLocaleString()} impressions, ${deckContent.metaAds.conversions} conversions (Grade: ${metaGrade})
- Total Spend: $${(deckContent.googleAds.spend + deckContent.metaAds.spend).toLocaleString()}
- Total Leads/Conversions: ${deckContent.googleAds.conversions + deckContent.metaAds.conversions}
- SMS: ${deckContent.sms.messagesSent} sent, ${(deckContent.sms.deliveryRate * 100).toFixed(1)}% delivered
- Email: ${deckContent.email.sent || 0} sent, ${(deckContent.email.openRate * 100).toFixed(1)}% opens
- CRM Contacts: ${deckContent.contacts.newThisPeriod} new of ${deckContent.contacts.total} total
- Pipeline: $${deckContent.opportunities.totalValue.toLocaleString()} value, ${deckContent.opportunities.wonThisPeriod} won
- Appointments: ${deckContent.appointments.total} total, ${(deckContent.appointments.showRate * 100).toFixed(0)}% show rate
- Revenue: $${deckContent.payments.totalRevenue.toLocaleString()} from ${deckContent.payments.transactionCount} transactions
- Tasks Completed: ${deckContent.services.tasks.reduce((sum: number, cat: any) => sum + cat.items.length, 0)} tasks
${supermetricsContext}
${adPlatformsDeepContext}
${lookerContext}
${aiAnalysisContext}
${extractedMetricsCtx}
${deckContent.taskNotes ? `
COMPLETED TASKS & CLIENT NEEDS (raw notes from the team):
---
${deckContent.taskNotes}
---
IMPORTANT: Categorize EACH task/line above into the correct platform section. Use these categories:
- googleAdsTasks: tasks related to Google Ads, PPC, search campaigns
- metaAdsTasks: tasks related to Meta/Facebook/Instagram ads
- seoTasks: tasks related to SEO, keywords, rankings, backlinks
- websiteTasks: tasks related to website updates, landing pages, design
- emailTasks: tasks related to email marketing, newsletters
- smsTasks: tasks related to SMS/text campaigns
- crmTasks: tasks related to CRM, automations, workflows, pipelines
- socialMediaTasks: tasks related to social media posts, content
- otherTasks: anything that doesn't fit above
- clientNeeds: items that require action FROM the client (approvals, content, access, etc.)
` : ''}

Generate a COMPELLING narrative for a Zoom presentation. The client should feel confident about their investment.
Use the DETAILED PER-PLATFORM DATA above (campaigns, keywords, creatives, daily trends) to make your insights specific and actionable — reference actual campaign names, keyword performance, creative winners, and spend trajectories.

For EACH ad platform that has data above, generate a dedicated gameplan using its platform key (e.g. google_ads, meta_ads, google_ads_v2, tiktok_ads, bing_ads, linkedin_ads). Reference specific campaigns and keywords by name.

Return ONLY valid JSON:
{
  "narrative": {
    "summary": "2-3 sentence executive summary that tells the story of this period's performance. Lead with the biggest win. Be specific with numbers.",
    "wins": ["3-4 specific wins with numbers, e.g. 'Generated 47 qualified leads at $32 each, 18% below target CPA'"],
    "challenges": ["1-2 challenges identified with context, not just negatives"],
    "outlook": "1-2 sentences on momentum and what's coming next"
  },
  "googleAdsInsights": ["3 specific insights with numbers"],
  "metaAdsInsights": ["2-3 specific insights with numbers"],
  "smsHighlights": ["1-2 highlights about SMS/text performance"],
  "emailHighlights": ["1-2 highlights about email performance"],
  "workflowHighlights": ["highlights about automation"],
  "recommendations": [
    {"title": "specific action", "priority": "high", "impact": "Expected +X% improvement", "category": "Google Ads|Meta|Creative|Landing Page|Budget"},
    {"title": "another action", "priority": "medium", "impact": "Expected benefit", "category": "category"}
  ],
  "focusAreas": ["2-3 strategic focus areas for next period"],
  "trendAnalysis": {
    "spending": "up|down|stable",
    "conversions": "up|down|stable", 
    "efficiency": "up|down|stable"
  },
  "platformGameplans": {
    "google_ads": {
      "summary": "2-3 sentence strategy summary based on the data",
      "keyInsight": "The single most important data-driven insight for this platform",
      "budgetRecommendation": "Specific budget reallocation recommendation with amounts/percentages",
      "abTests": ["3 specific A/B tests to run, e.g. 'Test responsive search ads with benefit-focused headlines vs feature-focused'"],
      "nextSteps": ["4-5 specific, prioritized action items with expected impact"]
    },
    "meta_ads": {
      "summary": "...",
      "keyInsight": "...",
      "budgetRecommendation": "...",
      "abTests": ["..."],
      "nextSteps": ["..."]
    }
  }${deckContent.taskNotes ? `,
  "categorizedTasks": {
    "googleAdsTasks": ["task 1", "task 2"],
    "metaAdsTasks": ["task 1"],
    "seoTasks": ["task 1"],
    "websiteTasks": ["task 1"],
    "emailTasks": ["task 1"],
    "smsTasks": ["task 1"],
    "crmTasks": ["task 1"],
    "socialMediaTasks": ["task 1"],
    "otherTasks": ["task 1"],
    "clientNeeds": ["item requiring client action"]
  }` : ''}
}`;

    let content: string;
    try {
      content = await callClaude(prompt, {
        system: "You are a premium marketing analytics expert creating client presentations. Return ONLY valid JSON, no markdown. Be specific with numbers. Lead with wins.",
        temperature: 0.7,
      });
    } catch (err) {
      console.error("AI request failed:", err);
      return null;
    }
    
    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Add calculated performance grades
        parsed.performanceGrades = {
          overall: overallGrade,
          google: googleGrade,
          meta: metaGrade,
          engagement: deckContent.appointments.showRate > 0.7 ? 'A' : deckContent.appointments.showRate > 0.5 ? 'B' : 'C',
        };
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }

    return null;
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return null;
  }
}

// Fallback keyword-based task categorizer when AI fails to return categorizedTasks
function fallbackCategorizeTasks(taskNotes: string): Record<string, string[]> {
  const result: Record<string, string[]> = {
    googleAdsTasks: [],
    metaAdsTasks: [],
    seoTasks: [],
    websiteTasks: [],
    emailTasks: [],
    smsTasks: [],
    crmTasks: [],
    socialMediaTasks: [],
    otherTasks: [],
    clientNeeds: [],
  };

  // Split by section headers (e.g. "GOOGLE", "META", "WEBSITE", etc.)
  const sectionPattern = /^(GOOGLE|META|FACEBOOK|WEBSITE|WEB|SEO|EMAIL|SMS|TEXT|CRM|AUTOMATION|AUTOMATIONS|SOCIAL|SOCIAL MEDIA|PMAX|SEARCH|BING|TIKTOK|BLOG)[^\n]*/gim;
  const sections: Array<{ header: string; startIdx: number }> = [];
  let match;
  while ((match = sectionPattern.exec(taskNotes)) !== null) {
    sections.push({ header: match[0].trim().toUpperCase(), startIdx: match.index });
  }

  if (sections.length === 0) {
    // No recognizable headers — put everything in otherTasks
    const lines = taskNotes.split('\n').map(l => l.replace(/^[\s•\-\*]+/, '').trim()).filter(l => l.length > 3);
    result.otherTasks = lines;
    return result;
  }

  // Extract content for each section
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].startIdx + sections[i].header.length;
    const end = i + 1 < sections.length ? sections[i + 1].startIdx : taskNotes.length;
    const block = taskNotes.slice(start, end);
    const lines = block.split('\n').map(l => l.replace(/^[\s•\-\*]+/, '').trim()).filter(l => l.length > 3);
    if (lines.length === 0) continue;

    const h = sections[i].header;
    if (/GOOGLE|PMAX|SEARCH|BING/.test(h)) {
      result.googleAdsTasks.push(...lines);
    } else if (/META|FACEBOOK/.test(h)) {
      result.metaAdsTasks.push(...lines);
    } else if (/TIKTOK/.test(h)) {
      // tiktok — put in otherTasks since no dedicated key
      result.otherTasks.push(...lines);
    } else if (/SEO|BLOG/.test(h)) {
      result.seoTasks.push(...lines);
    } else if (/WEBSITE|WEB/.test(h)) {
      result.websiteTasks.push(...lines);
    } else if (/EMAIL/.test(h)) {
      result.emailTasks.push(...lines);
    } else if (/SMS|TEXT/.test(h)) {
      result.smsTasks.push(...lines);
    } else if (/CRM|AUTOMATION/.test(h)) {
      result.crmTasks.push(...lines);
    } else if (/SOCIAL/.test(h)) {
      result.socialMediaTasks.push(...lines);
    } else {
      result.otherTasks.push(...lines);
    }
  }

  return result;
}

// Utility functions
function parseNumber(value: any): number {
  if (!value) return 0;
  const str = String(value).replace(/[$,]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parsePercentage(value: any): number {
  if (!value) return 0;
  const str = String(value).replace(/%/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num / 100;
}

function calculateRoas(spend: number, conversions: number): number {
  if (spend <= 0) return 0;
  // Assume average conversion value of $100 if not provided
  return (conversions * 100) / spend;
}

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { validateUrl, createValidationErrorResponse } from "../_shared/validation.ts";
import { callClaude, callClaudeVision } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SiteAuditResult {
  success: boolean;
  errors: number;
  warnings: number;
  notices: number;
  totalIssues: number;
  siteHealthScore?: number;
  analysisMethod: string;
  confidence: 'high' | 'medium' | 'low';
  rawAnalysis?: string;
  unavailable?: boolean;
}

interface ExtractedMetrics {
  errors: number;
  warnings: number;
  notices: number;
  siteHealth: number;
}

// ===== REGEX-BASED EXTRACTION (PRIMARY — deterministic, zero hallucination) =====

/**
 * Parse numbers like "12.36K" → 12360, "1.2M" → 1200000, "369" → 369
 */
function parseMetricNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  const kMatch = cleaned.match(/^([\d.]+)\s*K$/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const mMatch = cleaned.match(/^([\d.]+)\s*M$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000);
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Try to extract metrics purely via regex from the markdown text.
 * We look for patterns like:
 *   "Errors\n\n369"  or  "Errors\n369"  or  "## Errors\n\n369"
 *   "Site Health\n\n82%"
 * 
 * The myinsights.io dashboard markdown typically renders metric boxes as:
 *   MetricLabel
 *   <blank line(s)>
 *   MainValue
 *   <optional trend value on next line>
 */
function extractWithRegex(text: string): ExtractedMetrics | null {
  if (!text || text.length < 30) return null;

  console.log(`[REGEX] Attempting regex extraction on ${text.length} chars...`);

  // Helper: find a metric value immediately following a label
  function findMetricAfterLabel(label: RegExp): number | null {
    // Match: label, then optional whitespace/newlines, then a number (possibly with K/M suffix)
    // We capture just the first number-like token after the label
    const pattern = new RegExp(label.source + '[\\s\\n]*?([\\d][\\d,.]*[KMkm]?)', label.flags);
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseMetricNumber(match[1]);
      console.log(`[REGEX] ${label.source} → raw="${match[1]}", parsed=${val}`);
      return val;
    }
    return null;
  }

  const errors = findMetricAfterLabel(/\bErrors?\b/i);
  const warnings = findMetricAfterLabel(/\bWarnings?\b/i);
  const notices = findMetricAfterLabel(/\bNotices?\b/i);

  // Site Health: look for a percentage
  let siteHealth: number | null = null;
  const healthMatch = text.match(/Site\s*Health[\s\n]*?(\d{1,3})%/i);
  if (healthMatch) {
    siteHealth = parseInt(healthMatch[1], 10);
    console.log(`[REGEX] Site Health → ${siteHealth}%`);
  }

  // We need at least errors OR siteHealth to consider this successful
  if (errors === null && siteHealth === null) {
    console.log(`[REGEX] ❌ Could not extract errors or health`);
    return null;
  }

  const result: ExtractedMetrics = {
    errors: errors ?? -1,
    warnings: warnings ?? -1,
    notices: notices ?? -1,
    siteHealth: siteHealth ?? -1,
  };

  console.log(`[REGEX] ✅ Extracted: errors=${result.errors}, warnings=${result.warnings}, notices=${result.notices}, health=${result.siteHealth}%`);
  return result;
}

/**
 * Fallback: Use AI to parse text when regex fails (complex layouts).
 */
async function extractFromTextWithAI(
  metricSection: string,
  _lovableKey: string,
  clientName: string
): Promise<ExtractedMetrics | null> {
  console.log(`[TEXT-AI] Parsing metric section (${metricSection.length} chars) for ${clientName}...`);

  let content: string;
  try {
    content = await callClaude(
      `You are parsing text from a Semrush Site Audit dashboard (myinsights.io).

Extract these metrics:
- "Site Health" — a percentage (0-100)
- "Errors" — the MAIN count (large bold number), NOT the small trend delta
- "Warnings" — the MAIN count
- "Notices" — the MAIN count

CRITICAL: The text may concatenate the main value with a trend delta (e.g., "3694" = 369 errors + 4 trend). The trend is always MUCH SMALLER. If you see a number like "3694" under Errors, the main count is likely 369 (not 3694).

Here is the text:
---
${metricSection}
---

Return ONLY valid JSON: {"errors": <number>, "warnings": <number>, "notices": <number>, "siteHealth": <number>}
If unavailable, return all -1.`,
      { maxTokens: 150 }
    );
  } catch (err) {
    console.error(`[TEXT-AI] API error:`, err);
    return null;
  }

  console.log(`[TEXT-AI] Response: ${content}`);

  const jsonMatch = content.match(/\{[^}]+\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const e = parseInt(parsed.errors), w = parseInt(parsed.warnings), n = parseInt(parsed.notices), h = parseInt(parsed.siteHealth);
    if (e === -1 && w === -1) return null;
    return {
      errors: isNaN(e) ? -1 : e,
      warnings: isNaN(w) ? -1 : w,
      notices: isNaN(n) ? -1 : n,
      siteHealth: isNaN(h) ? -1 : h,
    };
  } catch {
    return null;
  }
}

// ===== AI VISION EXTRACTION (FALLBACK — when text parsing fails) =====
async function runVisionExtraction(
  screenshotBase64: string,
  _lovableKey: string,
  passLabel: string
): Promise<{ metrics: ExtractedMetrics | null; raw: string; unavailable: boolean }> {
  console.log(`[${passLabel}] Sending screenshot to AI Vision...`);

  let content: string;
  try {
    content = await callClaudeVision(
      `You are reading a Semrush Site Audit dashboard screenshot from myinsights.io.

There are THREE metric boxes at the top:
1. "Errors" box — a LARGE BOLD NUMBER (count of critical site errors)
2. "Warnings" box — a LARGE BOLD NUMBER
3. "Notices" box — a LARGE BOLD NUMBER

There is also a "Site Health" percentage (circular gauge or large %).

RULES:
- Read the LARGE BOLD count from each box, NOT small trend numbers below
- For Site Health, read the main percentage (e.g. 82 for "82%")
- If "0", report 0. Numbers may have commas — remove them.
- If page shows "report unavailable" or error, return all -1
- Be EXACT. Double-check every number.

Return ONLY: {"errors": <number>, "warnings": <number>, "notices": <number>, "siteHealth": <number>}`,
      screenshotBase64,
      'image/png',
      { maxTokens: 100 }
    );
  } catch (err) {
    const errText = err instanceof Error ? err.message : String(err);
    console.error(`[${passLabel}] AI Vision error:`, errText);
    return { metrics: null, raw: errText, unavailable: false };
  }

  console.log(`[${passLabel}] AI response:`, content);

  const jsonMatch = content.match(/\{[^}]+\}/);
  if (!jsonMatch) return { metrics: null, raw: content, unavailable: false };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const e = parseInt(parsed.errors), w = parseInt(parsed.warnings), n = parseInt(parsed.notices), h = parseInt(parsed.siteHealth);
    if (e === -1 && w === -1) return { metrics: null, raw: content, unavailable: true };
    return {
      metrics: { errors: isNaN(e) ? -1 : e, warnings: isNaN(w) ? -1 : w, notices: isNaN(n) ? -1 : n, siteHealth: isNaN(h) ? -1 : h },
      raw: content,
      unavailable: false,
    };
  } catch {
    return { metrics: null, raw: content, unavailable: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(authResult.error || "Unauthorized", authResult.status || 401, corsHeaders);
  }

  try {
    const { url, clientName } = await req.json();

    let formattedUrl = (url || "").toString().trim();
    if (formattedUrl && !formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const urlValidation = validateUrl(formattedUrl, "Site Audit URL");
    if (!urlValidation.valid) return createValidationErrorResponse(urlValidation.error!, corsHeaders);

    if (!formattedUrl.includes("myinsights.io")) {
      return new Response(JSON.stringify({ success: false, error: "URL must be a myinsights.io dashboard" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ success: false, error: "Required API keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`\n========== Analyzing site audit for ${clientName}: ${formattedUrl} ==========`);

    // ===== Step 1: Scrape BOTH markdown AND screenshot =====
    let markdown = "";
    let screenshot = "";
    const waitTimes = [12000, 8000, 5000];
    
    for (const waitTime of waitTimes) {
      try {
        console.log(`Scraping with waitFor=${waitTime}ms (markdown + fullPage screenshot)...`);
        const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ["markdown", "screenshot@fullPage"],
            waitFor: waitTime,
            timeout: 60000,
          }),
        });
        const scrapeData = await scrapeResponse.json();
        if (!scrapeResponse.ok || scrapeData.success === false) {
          const errMsg = scrapeData.error || "Firecrawl scrape failed";
          if (errMsg.toLowerCase().includes("timed out") || errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("failed to load")) {
            console.warn(`Scrape timeout with waitFor=${waitTime}ms, retrying...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new Error(errMsg);
        }
        const content = scrapeData.data || scrapeData;
        markdown = content.markdown || "";
        screenshot = content.screenshot || "";
        console.log(`Scrape OK: markdown=${markdown.length} chars, screenshot=${screenshot ? 'yes' : 'no'}`);
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes("timed out") || errMsg.toLowerCase().includes("timeout")) {
          console.warn(`Scrape timeout, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!markdown && !screenshot) {
      return new Response(JSON.stringify({ success: false, error: "Could not scrape dashboard after multiple attempts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log first 1000 chars of markdown for debugging
    if (markdown) {
      console.log(`[MARKDOWN PREVIEW] ${markdown.substring(0, 1000)}`);
    }

    // ===== Step 2: PRIMARY — Regex extraction (deterministic, no AI needed) =====
    let finalMetrics: ExtractedMetrics | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let analysisMethod = 'unknown';

    if (markdown) {
      // Try pure regex first — this is bulletproof when the markdown structure is clean
      finalMetrics = extractWithRegex(markdown);
      if (finalMetrics && finalMetrics.errors >= 0 && finalMetrics.siteHealth >= 0) {
        confidence = 'high';
        analysisMethod = 'regex';
        console.log(`[PRIMARY] ✅ Regex extraction: errors=${finalMetrics.errors}, health=${finalMetrics.siteHealth}%`);
      } else {
        // Regex got partial or no results — try AI text parsing as second attempt
        console.log(`[PRIMARY] Regex incomplete (errors=${finalMetrics?.errors}, health=${finalMetrics?.siteHealth}), trying AI text...`);
        
        // Extract a focused section for AI
        const healthIdx = markdown.search(/Site\s*Health/i);
        const errIdx = markdown.search(/\bErrors?\b/i);
        if (healthIdx >= 0 || errIdx >= 0) {
          const firstIdx = healthIdx >= 0 && (healthIdx < errIdx || errIdx === -1) ? healthIdx : errIdx;
          const start = Math.max(0, firstIdx - 200);
          const end = Math.min(markdown.length, (errIdx >= 0 ? errIdx : firstIdx) + 1500);
          const metricSection = markdown.substring(start, end);
          
          const aiResult = await extractFromTextWithAI(metricSection, '', clientName);
          if (aiResult) {
            // If regex got partial results, merge: prefer regex values, fill gaps from AI
            if (finalMetrics && finalMetrics.errors >= 0) {
              // Regex errors are reliable, use AI only for missing fields
              aiResult.errors = finalMetrics.errors;
              if (finalMetrics.siteHealth >= 0) aiResult.siteHealth = finalMetrics.siteHealth;
              if (finalMetrics.warnings >= 0) aiResult.warnings = finalMetrics.warnings;
              if (finalMetrics.notices >= 0) aiResult.notices = finalMetrics.notices;
              finalMetrics = aiResult;
              confidence = 'high';
              analysisMethod = 'regex+ai-fill';
            } else {
              finalMetrics = aiResult;
              confidence = 'medium';
              analysisMethod = 'text-ai';
            }
            console.log(`[PRIMARY] AI text result: errors=${finalMetrics.errors}, health=${finalMetrics.siteHealth}%`);
          }
        }
      }
    }

    if (!finalMetrics) {
      console.log(`[PRIMARY] ❌ Regex + AI text extraction failed, falling back to AI Vision...`);
    }

    // ===== Step 3: FALLBACK — AI Vision (only if text failed) =====
    if (!finalMetrics && screenshot) {
      // Convert screenshot to base64
      let screenshotBase64 = screenshot;
      if (screenshot.startsWith("http")) {
        try {
          const imgResponse = await fetch(screenshot);
          if (!imgResponse.ok) throw new Error(`Download failed: ${imgResponse.status}`);
          const imgBuffer = await imgResponse.arrayBuffer();
          const uint8 = new Uint8Array(imgBuffer);
          let binary = "";
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          screenshotBase64 = btoa(binary);
        } catch (err) {
          console.error("Screenshot download failed:", err);
          return new Response(JSON.stringify({ success: false, error: "Failed to download screenshot" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (screenshot.startsWith("data:")) {
        screenshotBase64 = screenshot.split(",")[1] || screenshot;
      }

      if (screenshotBase64.length < 5000) {
        return new Response(JSON.stringify({ success: false, error: "Screenshot appears blank" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Run dual-pass vision
      const [pass1, pass2] = await Promise.all([
        runVisionExtraction(screenshotBase64, '', "VISION-1"),
        runVisionExtraction(screenshotBase64, '', "VISION-2"),
      ]);

      if (pass1.unavailable || pass2.unavailable) {
        return new Response(JSON.stringify({ success: false, error: "Report unavailable", unavailable: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (pass1.metrics && pass2.metrics && pass1.metrics.errors === pass2.metrics.errors && pass1.metrics.siteHealth === pass2.metrics.siteHealth) {
        finalMetrics = pass1.metrics;
        confidence = 'medium'; // Vision agreement, but still not as reliable as text
        analysisMethod = 'vision-dual-agree';
        console.log(`[FALLBACK] Vision passes agree: errors=${finalMetrics.errors}, health=${finalMetrics.siteHealth}%`);
      } else if (pass1.metrics && pass2.metrics) {
        // Disagree — run tiebreaker
        const pass3 = await runVisionExtraction(screenshotBase64, '', "TIEBREAKER");
        if (pass3.metrics) {
          const all = [pass1.metrics, pass2.metrics, pass3.metrics];
          const errMajority = all.map(p => p.errors).find(v => all.filter(p => p.errors === v).length >= 2) ?? pass3.metrics.errors;
          const healthMajority = all.map(p => p.siteHealth).find(v => all.filter(p => p.siteHealth === v).length >= 2) ?? pass3.metrics.siteHealth;
          finalMetrics = { errors: errMajority, warnings: all.find(p => p.errors === errMajority)!.warnings, notices: all.find(p => p.errors === errMajority)!.notices, siteHealth: healthMajority };
          confidence = 'low';
          analysisMethod = 'vision-tiebreaker';
        } else {
          finalMetrics = pass1.metrics;
          confidence = 'low';
          analysisMethod = 'vision-single';
        }
        console.log(`[FALLBACK] Vision tiebreaker: errors=${finalMetrics?.errors}, health=${finalMetrics?.siteHealth}%`);
      } else {
        finalMetrics = pass1.metrics || pass2.metrics || null;
        confidence = 'low';
        analysisMethod = 'vision-single';
      }
    }

    // Cross-validation placeholder — reserved for future use

    if (!finalMetrics) {
      return new Response(JSON.stringify({ success: false, error: "Failed to extract audit metrics from dashboard" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Step 5: Sanity checks =====
    if (finalMetrics.siteHealth > 100) finalMetrics.siteHealth = 100;
    if (finalMetrics.errors < 0) finalMetrics.errors = 0;
    if (finalMetrics.warnings < 0) finalMetrics.warnings = 0;
    if (finalMetrics.notices < 0) finalMetrics.notices = 0;

    const result: SiteAuditResult = {
      success: true,
      errors: finalMetrics.errors,
      warnings: finalMetrics.warnings,
      notices: finalMetrics.notices,
      totalIssues: finalMetrics.errors + finalMetrics.warnings + finalMetrics.notices,
      siteHealthScore: finalMetrics.siteHealth >= 0 && finalMetrics.siteHealth <= 100 ? finalMetrics.siteHealth : undefined,
      analysisMethod,
      confidence,
    };

    console.log(`✅ FINAL [${analysisMethod}] [${confidence}]: ${result.errors} errors, ${result.warnings} warnings, ${result.notices} notices, health: ${result.siteHealthScore ?? 'N/A'}%`);

    // ===== Step 6: Cache =====
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseServiceKey && clientName) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: cacheError } = await supabase
        .from('site_audit_cache')
        .upsert({
          client_name: clientName,
          site_audit_url: formattedUrl,
          site_errors: result.errors,
          site_warnings: result.warnings,
          site_notices: result.notices,
          site_health_score: result.siteHealthScore ?? null,
          last_scraped_at: new Date().toISOString()
        }, { onConflict: 'client_name' });
      
      if (cacheError) console.error("Cache error:", cacheError);
      else console.log(`Cached for ${clientName}`);
    }

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

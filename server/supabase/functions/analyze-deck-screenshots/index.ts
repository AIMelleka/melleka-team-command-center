import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getDefaultTemplate,
  type LookerTemplate,
  type SectionId,
} from "../_shared/lookerTemplates.ts";
import {
  crossValidate,
  autoCalculateMissingMetrics,
  parseCurrency,
  parseInteger,
  parsePercentage,
  type ValidatedMetrics,
  type ConfidenceLevel,
} from "../_shared/metricValidation.ts";
import {
  mapCategoryToSectionId,
  type CropRegion,
} from "../_shared/screenshotOrganizer.ts";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UploadedScreenshot {
  url: string;
  name: string;
  scrollPosition?: number;
  category?: string; // Pre-detected category from scraper
}

interface AnalyzedSection {
  sectionType: 'google_ads' | 'meta_ads' | 'sms' | 'email' | 'overview' | 'google_campaigns' | 'keyword_performance' | 'top_creatives' | 'other';
  sectionId: SectionId;
  confidence: number;
  sourceScreenshot: string;
  metrics: ValidatedMetrics;
  rawMetrics: Record<string, number | string>;
  insights: string[];
  cropRegions: CropRegion[];
  dateVisible: boolean;
  visibleDateRange?: string;
  dateMatchesExpected: boolean;
}

interface AnalysisResult {
  sections: AnalyzedSection[];
  summary: {
    totalSpend: number;
    totalLeads: number;
    totalImpressions: number;
    totalClicks: number;
    avgCTR: number;
    avgCPC: number;
    roas: number;
  };
  executiveSummary: string;
  keyFindings: string[];
  coverage: {
    percentage: number;
    captured: SectionId[];
    missing: SectionId[];
  };
  dateValidation: {
    verified: boolean;
    detectedRange?: string;
    expectedRange?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenshots, clientName, dateRangeStart, dateRangeEnd, templateId } = await req.json();
    
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
      return new Response(
        JSON.stringify({ error: "No screenshots provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI analysis uses the shared Claude helper (ANTHROPIC_API_KEY checked inside callClaude)

    // Get the template
    const template = getDefaultTemplate();
    
    console.log(`=== TEMPLATE-AWARE SCREENSHOT ANALYSIS ===`);
    console.log(`Template: ${template.templateId}`);
    console.log(`Analyzing ${screenshots.length} screenshots for ${clientName}`);
    console.log(`Date range: ${dateRangeStart} to ${dateRangeEnd}`);

    // Build section context for AI
    const sectionList = template.expectedSections
      .map(s => `- ${s.id}: ${s.displayName} (${s.required ? 'REQUIRED' : 'optional'})`)
      .join('\n');

    // Analyze each screenshot with template-aware AI vision
    const analyzedSections: AnalyzedSection[] = [];
    const capturedSectionIds: SectionId[] = [];
    let verifiedDateRange: string | undefined;
    
    for (const screenshot of screenshots as UploadedScreenshot[]) {
      console.log(`Analyzing screenshot: ${screenshot.name}`);
      
      const analysisPrompt = `You are an expert marketing analytics analyst analyzing a Looker Studio dashboard screenshot.

${template.aiPromptContext}

KNOWN SECTIONS (identify which is visible):
${sectionList}

CONTEXT:
- Client: ${clientName}
- Expected Date Range: ${dateRangeStart} to ${dateRangeEnd}
- Screenshot: ${screenshot.name}
${screenshot.scrollPosition !== undefined ? `- Scroll Position: ${screenshot.scrollPosition}px` : ''}
${screenshot.category ? `- Pre-detected category: ${screenshot.category}` : ''}

YOUR TASK:
1. **SECTION IDENTIFICATION**: Which section from the template is primarily visible? Be specific.

2. **METRIC EXTRACTION**: Extract ALL visible metrics with their EXACT values:
   - Currency: Include $ symbol and exact amount (e.g., "$9.51", "$1,234.56")
   - Percentages: Include % symbol (e.g., "2.5%", "15.3%")
   - Integers: Include commas for thousands (e.g., "4,853", "12,456")
   - Be precise - do NOT round or estimate

3. **DATE VERIFICATION**: 
   - Is the date picker/range visible in this screenshot?
   - If yes, what exact dates are shown?
   - Does it match the expected range?

4. **BOUNDING BOXES**: Identify precise crop regions for key data elements:
   - KPI summary cards (usually 80-120px tall at top)
   - Data tables (identify header row and key data rows)
   - Charts and graphs (exclude legends if possible)
   - Use percentages from 0-100 for bounds

5. **INSIGHTS**: 2-3 specific observations with actual numbers from the data

Return ONLY valid JSON:
{
  "sectionId": "google_campaigns",
  "sectionType": "google_ads",
  "confidence": 0.95,
  "dateVisible": true,
  "visibleDateRange": "Dec 10, 2025 - Dec 31, 2025",
  "dateMatchesExpected": true,
  "metrics": {
    "conversions": 1,
    "cost": 9.51,
    "cost_per_conv": 9.51,
    "phone_calls": 0,
    "impressions": 4853,
    "clicks": 12,
    "ctr": 0.25
  },
  "insights": [
    "PMAX | General campaign generated the only conversion at $7.43 cost",
    "Average CPC across campaigns is very low at $0.40-$1.29",
    "Search campaigns show 0 conversions despite 49 impressions"
  ],
  "cropRegions": [
    { 
      "description": "Google Ads summary KPI cards (Conversions: 1, Cost/conv: $9.51, Phone calls: 0, Cost: $9.51)", 
      "importance": "high",
      "type": "kpi_card",
      "bounds": { "top": 2, "left": 50, "width": 48, "height": 12 }
    },
    { 
      "description": "Campaign performance table with 7 campaigns", 
      "importance": "high",
      "type": "table",
      "bounds": { "top": 18, "left": 2, "width": 96, "height": 45 }
    },
    { 
      "description": "Top performing campaign: PMAX | General", 
      "importance": "medium",
      "type": "metric",
      "bounds": { "top": 26, "left": 2, "width": 96, "height": 6 }
    }
  ]
}`;

      try {
        // Download image and convert to base64 for Claude vision API
        let imageBlock: any;
        try {
          const { urlToBase64ImageBlock } = await import('../_shared/claude.ts');
          imageBlock = await urlToBase64ImageBlock(screenshot.url);
        } catch (imgErr: any) {
          console.error(`Failed to fetch image for ${screenshot.name}:`, imgErr.message);
          continue;
        }

        let content: string;
        try {
          content = await callClaude('', {
            maxTokens: 2000,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: analysisPrompt },
                imageBlock,
              ],
            }],
          });
        } catch (err) {
          console.error(`AI analysis failed for ${screenshot.name}:`, err);
          continue;
        }
        
        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(repairJson(jsonMatch[0]));
            
            // Map to section ID
            let sectionId: SectionId = parsed.sectionId;
            if (!sectionId || !isValidSectionId(sectionId, template)) {
              sectionId = mapCategoryToSectionId(
                parsed.sectionType || 'other', 
                screenshot.scrollPosition || 0
              );
            }
            
            // Convert raw metrics to validated metrics
            const rawMetrics = parsed.metrics || {};
            const validatedMetrics: ValidatedMetrics = {};
            
            for (const [key, value] of Object.entries(rawMetrics)) {
              if (value !== null && value !== undefined) {
                validatedMetrics[key] = {
                  value: typeof value === 'number' ? value : parseNumeric(value as string),
                  confidence: 'medium',
                  source: 'vision',
                  rawValue: String(value),
                };
              }
            }
            
            // Auto-calculate missing metrics
            const enrichedMetrics = autoCalculateMissingMetrics(validatedMetrics, [
              'ctr', 'cpc', 'cost_per_conv', 'conv_rate'
            ]);
            
            // Track date verification
            if (parsed.dateVisible && parsed.visibleDateRange) {
              if (!verifiedDateRange) {
                verifiedDateRange = parsed.visibleDateRange;
              }
            }
            
            // Add to captured sections
            if (!capturedSectionIds.includes(sectionId)) {
              capturedSectionIds.push(sectionId);
            }
            
            analyzedSections.push({
              sectionType: parsed.sectionType || 'other',
              sectionId,
              confidence: parsed.confidence || 0.5,
              sourceScreenshot: screenshot.url,
              metrics: enrichedMetrics,
              rawMetrics,
              insights: parsed.insights || [],
              cropRegions: (parsed.cropRegions || []).map((cr: any) => ({
                description: cr.description,
                importance: cr.importance || 'medium',
                type: cr.type || 'other',
                bounds: cr.bounds,
              })),
              dateVisible: parsed.dateVisible || false,
              visibleDateRange: parsed.visibleDateRange,
              dateMatchesExpected: parsed.dateMatchesExpected || false,
            });
            
            console.log(`✓ Analyzed ${screenshot.name} as ${sectionId} (${parsed.sectionType})`);
          } catch (parseErr) {
            console.error(`Failed to parse AI response for ${screenshot.name}:`, parseErr);
          }
        }
      } catch (err) {
        console.error(`Error analyzing screenshot ${screenshot.name}:`, err);
      }
    }

    // Calculate section coverage
    const requiredSections = template.expectedSections
      .filter(s => s.required)
      .map(s => s.id);
    const missingSections = requiredSections.filter(s => !capturedSectionIds.includes(s));
    const coveragePercentage = requiredSections.length > 0
      ? Math.round((requiredSections.filter(s => capturedSectionIds.includes(s)).length / requiredSections.length) * 100)
      : 100;

    // Aggregate metrics across all sections
    const googleAdsSection = analyzedSections.find(s => s.sectionType === 'google_ads');
    const metaAdsSection = analyzedSections.find(s => s.sectionType === 'meta_ads');
    const overviewSection = analyzedSections.find(s => s.sectionType === 'overview');
    
    const getMetricValue = (section: AnalyzedSection | undefined, key: string): number => {
      const metric = section?.metrics?.[key];
      if (!metric) return 0;
      return typeof metric.value === 'number' ? metric.value : 0;
    };
    
    const totalSpend = 
      getMetricValue(googleAdsSection, 'cost') + 
      getMetricValue(googleAdsSection, 'spend') +
      getMetricValue(metaAdsSection, 'spend') + 
      getMetricValue(metaAdsSection, 'cost') ||
      getMetricValue(overviewSection, 'spend') ||
      getMetricValue(overviewSection, 'cost');
    
    const totalLeads = 
      getMetricValue(googleAdsSection, 'leads') + 
      getMetricValue(googleAdsSection, 'conversions') + 
      getMetricValue(metaAdsSection, 'leads') +
      getMetricValue(metaAdsSection, 'conversions');
    
    const totalImpressions = 
      getMetricValue(googleAdsSection, 'impressions') + 
      getMetricValue(metaAdsSection, 'impressions');
    
    const totalClicks = 
      getMetricValue(googleAdsSection, 'clicks') + 
      getMetricValue(metaAdsSection, 'clicks');
    
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const roas = getMetricValue(googleAdsSection, 'roas') || getMetricValue(metaAdsSection, 'roas') || 0;

    // Generate executive summary
    const allInsights = analyzedSections.flatMap(s => s.insights);
    const keyFindings = allInsights.slice(0, 5);

    let executiveSummary = `Performance update for ${clientName} (${dateRangeStart} to ${dateRangeEnd}). `;
    if (totalSpend > 0) {
      executiveSummary += `Total ad spend: $${totalSpend.toLocaleString()}. `;
    }
    if (totalLeads > 0) {
      executiveSummary += `Generated ${totalLeads} conversions/leads. `;
    }
    if (roas > 0) {
      executiveSummary += `ROAS: ${roas.toFixed(2)}x. `;
    }
    if (coveragePercentage < 100) {
      executiveSummary += `Note: ${missingSections.length} section(s) not captured. `;
    }

    // Date validation result
    const dateVerified = analyzedSections.some(s => s.dateMatchesExpected);
    const dateValidation = {
      verified: dateVerified,
      detectedRange: verifiedDateRange,
      expectedRange: `${dateRangeStart} to ${dateRangeEnd}`,
    };

    const result: AnalysisResult = {
      sections: analyzedSections,
      summary: {
        totalSpend,
        totalLeads,
        totalImpressions,
        totalClicks,
        avgCTR: parseFloat(avgCTR.toFixed(2)),
        avgCPC: parseFloat(avgCPC.toFixed(2)),
        roas,
      },
      executiveSummary,
      keyFindings,
      coverage: {
        percentage: coveragePercentage,
        captured: capturedSectionIds,
        missing: missingSections,
      },
      dateValidation,
    };

    console.log(`=== ANALYSIS COMPLETE ===`);
    console.log(`Sections analyzed: ${analyzedSections.length}`);
    console.log(`Coverage: ${coveragePercentage}%`);
    console.log(`Missing: ${missingSections.join(', ') || 'none'}`);
    console.log(`Date verified: ${dateVerified}`);
    console.log(`Summary: $${totalSpend} spend, ${totalLeads} leads, ${roas}x ROAS`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Screenshot analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Check if a section ID is valid for the template
 */
function isValidSectionId(id: string, template: LookerTemplate): boolean {
  return template.expectedSections.some(s => s.id === id);
}

/**
 * Parse a numeric value from a string
 */
function parseNumeric(value: string): number | null {
  if (!value) return null;
  
  // Try currency first
  const currency = parseCurrency(value);
  if (currency !== null) return currency;
  
  // Try percentage
  const percentage = parsePercentage(value);
  if (percentage !== null) return percentage;
  
  // Try integer
  const integer = parseInteger(value);
  if (integer !== null) return integer;
  
  // Try plain float
  const cleaned = value.toString().replace(/[^0-9.-]/g, '');
  const float = parseFloat(cleaned);
  return isNaN(float) ? null : float;
}

/**
 * Repair common JSON issues from LLM output
 */
function repairJson(json: string): string {
  let s = json.trim();
  // Remove trailing commas
  s = s.replace(/,\s*([}\]])/g, "$1");
  // Smart quotes to normal quotes
  s = s.replace(/[""]/g, '"').replace(/['']/g, "'");
  return s;
}

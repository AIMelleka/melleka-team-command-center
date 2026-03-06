import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  validateUrl,
  validateString,
  createValidationErrorResponse,
} from "../_shared/validation.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { callClaude, callClaudeVision } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin authentication
  const authResult = await requireToolAuth(req, 'ad-generator');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { imageUrl, competitorName, platform } = await req.json();

    // Validate imageUrl (required)
    const urlValidation = validateUrl(imageUrl, "Image URL");
    if (!urlValidation.valid) {
      return createValidationErrorResponse(urlValidation.error!, corsHeaders);
    }

    // Validate optional string fields
    const nameValidation = validateString(competitorName, 200, "Competitor name");
    if (!nameValidation.valid) {
      return createValidationErrorResponse(nameValidation.error!, corsHeaders);
    }

    const platformValidation = validateString(platform, 100, "Platform");
    if (!platformValidation.valid) {
      return createValidationErrorResponse(platformValidation.error!, corsHeaders);
    }

    console.log("Analyzing ad for:", competitorName || "Unknown competitor");

    const systemPrompt = `You are an expert digital marketing strategist specializing in paid advertising. Analyze competitor ads to identify weaknesses and opportunities for improvement.

Your analysis should be actionable and specific. Focus on:
1. Visual design issues (cluttered layout, poor contrast, weak imagery)
2. Copy weaknesses (vague CTAs, missing urgency, unclear value proposition)
3. Targeting gaps (mismatched messaging to audience)
4. Brand presentation (inconsistent styling, unprofessional elements)
5. Conversion optimization (missing trust signals, unclear next steps)

Be direct and specific - don't be generic. Reference specific elements you see in the ad.`;

    const userPrompt = `Analyze this ${platform || 'digital'} ad${competitorName ? ` from ${competitorName}` : ''}.

Provide your analysis in this exact JSON format:
{
  "issues": [
    "Specific issue 1 - be very specific about what's wrong and where",
    "Specific issue 2",
    "Specific issue 3",
    "Specific issue 4"
  ],
  "ourSolution": "A 2-3 sentence paragraph explaining how we would create a better ad. Be specific about the improvements: stronger CTAs, cleaner design, better targeting, etc.",
  "overallScore": "A score from 1-10 rating the ad's effectiveness",
  "quickWins": ["Quick improvement 1", "Quick improvement 2", "Quick improvement 3"]
}

Identify 3-6 specific issues and provide actionable solutions. Be brutally honest but constructive.`;

    // Download image and convert to base64 for Claude vision
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const contentType = imgRes.headers.get('content-type') || 'image/png';

    const content = await callClaudeVision(
      userPrompt,
      imgBase64,
      contentType,
      { system: systemPrompt, temperature: 0.7 },
    );

    // Parse the JSON response
    let analysis;
    try {
      // Try to extract JSON from the response
      let jsonString = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1];
      }
      
      // Find JSON object in the response
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
      
      // Clean up common issues
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      analysis = JSON.parse(jsonString.trim());
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      console.log("Raw content:", content);
      // Fallback: create a basic analysis from the raw response
      analysis = {
        issues: [
          "Unable to parse detailed analysis - the ad may have complex elements",
          "Consider reviewing the ad manually for specific issues",
          "Look for weak CTAs and unclear value propositions"
        ],
        ourSolution: "We'll create clean, conversion-focused ads with strong calls-to-action, clear value propositions, and professional design that speaks directly to your target audience.",
        overallScore: "N/A",
        quickWins: ["Add stronger CTA", "Clarify value proposition", "Improve visual hierarchy"]
      };
    }

    console.log("Ad analysis complete");
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        rawContent: content 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analyze ad error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze ad" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

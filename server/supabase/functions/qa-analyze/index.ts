import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { callClaude, callClaudeVision } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QACriteria {
  name: string;
  score: number;
  weight: number;
  feedback: string;
}

interface QAAnalysis {
  criteria: QACriteria[];
  summary: string;
  improvements: string[];
  overallScore: number;
}

// Content type specific criteria - Grammar & Spelling ALWAYS first and highest weighted
const CRITERIA_BY_TYPE: Record<string, { name: string; weight: number; description: string }[]> = {
  image: [
    { name: "Text Accuracy", weight: 25, description: "Perfect spelling, grammar, and punctuation in any text overlays" },
    { name: "Visual Quality", weight: 20, description: "Resolution, clarity, sharpness, and professional appearance" },
    { name: "Composition", weight: 15, description: "Layout, balance, visual hierarchy, and focal points" },
    { name: "Brand Consistency", weight: 15, description: "Alignment with brand colors, fonts, and style guidelines" },
    { name: "Message Clarity", weight: 15, description: "Clear communication of intended message or call-to-action" },
    { name: "Premium Feel", weight: 10, description: "High-end, polished, professional aesthetic" },
  ],
  ad_copy: [
    { name: "Grammar & Spelling", weight: 30, description: "Perfect English with zero errors - no typos, misspellings, or grammatical mistakes" },
    { name: "Punctuation", weight: 10, description: "Correct use of commas, periods, apostrophes, and other punctuation" },
    { name: "Clarity & Conciseness", weight: 20, description: "Clear, direct messaging without fluff" },
    { name: "Persuasiveness", weight: 15, description: "Compelling copy that drives action" },
    { name: "Brand Voice", weight: 10, description: "Consistent tone and personality" },
    { name: "Call-to-Action", weight: 10, description: "Strong, clear CTA that motivates response" },
    { name: "Premium Feel", weight: 5, description: "Sophisticated, professional language" },
  ],
  email: [
    { name: "Grammar & Spelling", weight: 30, description: "Perfect English with zero errors throughout the entire email" },
    { name: "Punctuation", weight: 10, description: "Correct use of all punctuation marks" },
    { name: "Subject Line", weight: 15, description: "Compelling, clear, and appropriately sized" },
    { name: "Structure & Flow", weight: 15, description: "Logical organization and easy to scan" },
    { name: "Call-to-Action", weight: 10, description: "Clear, compelling CTAs" },
    { name: "Personalization", weight: 5, description: "Appropriate use of personalization tokens" },
    { name: "Premium Feel", weight: 15, description: "Professional, polished presentation" },
  ],
  text_campaign: [
    { name: "Grammar & Spelling", weight: 35, description: "Perfect English with zero errors - critical for SMS credibility" },
    { name: "Punctuation", weight: 10, description: "Correct punctuation within character limits" },
    { name: "Brevity", weight: 20, description: "Concise messaging within character limits" },
    { name: "Clarity", weight: 15, description: "Immediately understandable message" },
    { name: "Call-to-Action", weight: 10, description: "Clear next step for recipient" },
    { name: "Compliance", weight: 10, description: "Proper opt-out and legal requirements" },
  ],
  ugc_script: [
    { name: "Grammar & Spelling", weight: 25, description: "Perfect English with zero errors - actors need flawless scripts" },
    { name: "Natural Delivery", weight: 20, description: "Conversational tone that sounds authentic, not scripted or salesy" },
    { name: "Hook Strength", weight: 15, description: "Strong opening hook that captures attention in first 3 seconds" },
    { name: "Structure & Flow", weight: 15, description: "Clear sections (hook, problem, solution, CTA) with logical progression" },
    { name: "Speakability", weight: 10, description: "Easy to read aloud, proper pacing, natural pauses indicated" },
    { name: "Authenticity", weight: 10, description: "Feels genuine and relatable, not corporate or overly polished" },
    { name: "Call-to-Action", weight: 5, description: "Clear, organic CTA that doesn't feel forced" },
  ],
  video: [
    { name: "Text & Captions Accuracy", weight: 25, description: "Perfect spelling and grammar in all on-screen text, titles, and captions" },
    { name: "Visual Quality", weight: 20, description: "Resolution, lighting, and production value" },
    { name: "Audio Quality", weight: 15, description: "Clear audio, proper levels, no distortion" },
    { name: "Pacing & Editing", weight: 10, description: "Smooth transitions, appropriate length" },
    { name: "Message Clarity", weight: 15, description: "Clear communication of key points" },
    { name: "Premium Feel", weight: 15, description: "High-end, polished production" },
  ],
  document: [
    { name: "Grammar & Spelling", weight: 30, description: "Perfect English with zero errors throughout" },
    { name: "Punctuation", weight: 10, description: "Correct use of all punctuation marks" },
    { name: "Structure & Organization", weight: 20, description: "Logical flow and clear sections" },
    { name: "Formatting", weight: 15, description: "Consistent styling, proper headings" },
    { name: "Clarity", weight: 15, description: "Easy to understand content" },
    { name: "Premium Feel", weight: 10, description: "Professional, polished presentation" },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'qa-bot');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { submissionId, contentType, content, fileUrl, fileName } = await req.json();

    if (!submissionId || !contentType) {
      return new Response(
        JSON.stringify({ error: "Submission ID and content type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to analyzing
    await supabase
      .from("qa_submissions")
      .update({ status: "analyzing" })
      .eq("id", submissionId);

    // Fetch improvement notes for this content type
    const { data: improvementNotes } = await supabase
      .from("qa_improvement_notes")
      .select("note, priority")
      .or(`content_type.eq.all,content_type.eq.${contentType}`)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    const improvementContext = improvementNotes?.length
      ? `\n\nIMPORTANT LEARNED IMPROVEMENTS (apply these strictly):\n${improvementNotes.map((n, i) => `${i + 1}. ${n.note}`).join("\n")}`
      : "";

    // Get criteria for this content type
    const criteria = CRITERIA_BY_TYPE[contentType] || CRITERIA_BY_TYPE.document;

    // Build the analysis prompt
    const criteriaList = criteria
      .map(c => `- ${c.name} (${c.weight}% weight): ${c.description}`)
      .join("\n");

    const systemPrompt = `You are an elite quality assurance expert for a premium marketing agency. Your standards are EXTREMELY HIGH - only truly exceptional content should pass (score 95+).

You evaluate content with surgical precision, examining every detail for:
- Perfect grammar and spelling (zero tolerance for errors)
- Premium, professional quality that impresses high-value clients
- Clear, compelling messaging that drives results
- Brand consistency and visual excellence

SCORING CRITERIA for ${contentType.replace("_", " ").toUpperCase()}:
${criteriaList}

SCORING GUIDELINES:
- 95-100: EXCEPTIONAL - Flawless, ready for premium clients
- 85-94: GOOD - Minor improvements needed, not quite premium
- 70-84: FAIR - Noticeable issues requiring attention
- Below 70: POOR - Significant problems, needs major revision

Be STRICT. Premium quality means ZERO errors and MAXIMUM polish.
${improvementContext}`;

    const userPrompt = `Analyze this ${contentType.replace("_", " ")} content for quality:

${content ? `CONTENT:\n${content}` : `FILE: ${fileName}`}

Provide your analysis as a JSON object with this EXACT structure:
{
  "criteria": [
    { "name": "Criteria Name", "score": 0-100, "weight": percentage, "feedback": "specific feedback" }
  ],
  "summary": "2-3 sentence overall assessment",
  "improvements": ["specific improvement 1", "specific improvement 2", ...]
}

Score each criterion individually. Be specific in feedback. List concrete improvements needed.`;

    console.log(`Analyzing ${contentType} submission: ${submissionId}`);

    let aiResponse: string;

    // If there's a file URL for images/videos, use vision
    if (fileUrl && (contentType === "image" || contentType === "video")) {
      const imgRes = await fetch(fileUrl);
      if (!imgRes.ok) throw new Error(`Failed to download file: ${imgRes.status}`);
      const imgBuffer = await imgRes.arrayBuffer();
      const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      const imgContentType = imgRes.headers.get('content-type') || 'image/png';

      aiResponse = await callClaudeVision(
        userPrompt,
        imgBase64,
        imgContentType,
        { system: systemPrompt },
      );
    } else {
      aiResponse = await callClaude(userPrompt, {
        system: systemPrompt,
      });
    }

    // Parse the JSON from the response
    let analysis: QAAnalysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiResponse];
      const jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);

      // Calculate weighted overall score
      let totalWeight = 0;
      let weightedSum = 0;

      for (const criterion of parsed.criteria) {
        const weight = criterion.weight || (100 / parsed.criteria.length);
        weightedSum += criterion.score * weight;
        totalWeight += weight;
      }

      const overallScore = Math.round(weightedSum / totalWeight);

      analysis = {
        criteria: parsed.criteria,
        summary: parsed.summary,
        improvements: parsed.improvements || [],
        overallScore,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw response:", aiResponse);

      // Fallback analysis
      analysis = {
        criteria: criteria.map(c => ({
          name: c.name,
          score: 75,
          weight: c.weight,
          feedback: "Unable to fully analyze. Please review manually.",
        })),
        summary: "Analysis encountered issues. Manual review recommended.",
        improvements: ["Review content manually for quality issues"],
        overallScore: 75,
      };
    }

    // Update the submission with results
    const { error: updateError } = await supabase
      .from("qa_submissions")
      .update({
        status: "completed",
        score: analysis.overallScore,
        analysis: analysis,
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Failed to update submission:", updateError);
      throw new Error("Failed to save analysis results");
    }

    console.log(`Analysis complete for ${submissionId}: Score ${analysis.overallScore}`);

    return new Response(
      JSON.stringify({
        success: true,
        score: analysis.overallScore,
        passed: analysis.overallScore >= 95,
        analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QA analysis error:", error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

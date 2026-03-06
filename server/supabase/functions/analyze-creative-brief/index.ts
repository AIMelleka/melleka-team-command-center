import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a creative director AI for a marketing agency. Analyze the user's creative brief and determine the best generation configuration.

AVAILABLE OPTIONS:

OUTPUT TYPES: "ad" (platform-specific ad creative with text/branding), "image" (general purpose image/graphic), "video" (short motion video clip)

AD PLATFORMS (use when outputType is "ad"):
- facebook-feed (1200x628), facebook-square (1080x1080), facebook-story (1080x1920)
- instagram-post (1080x1080), instagram-portrait (1080x1350)
- google-medium-rectangle (640x480), google-leaderboard (1456x608), google-large-rectangle (672x560)
- tiktok-video (1080x1920), linkedin-sponsored (1200x628), linkedin-square (1080x1080)

IMAGE SIZES (use when outputType is "image"):
- 1200x628 (landscape), 1080x1080 (square), 1080x1920 (portrait/story)
- 1920x1080 (hero banner), 1200x630 (OG image), 640x360 (thumbnail)

VIDEO ASPECT RATIOS (use when outputType is "video"):
- 16:9 (landscape - YouTube, TV), 9:16 (portrait - TikTok, Reels), 1:1 (square - Instagram, Facebook)
- 4:3 (standard), 3:4 (portrait mobile), 21:9 (ultrawide cinematic)

INDUSTRIES: ecommerce, realestate, restaurant, fitness, tech, beauty, automotive, travel, finance, healthcare

VISUAL STYLES: minimalist, bold, luxury, playful, corporate, retro, modern, natural

CAMPAIGN TYPES (for ads): sale, launch, awareness, testimonial, seasonal, event, lead, retargeting

VIDEO STYLES: cinematic, commercial, social, corporate, dynamic, elegant

VIDEO MOTION STYLES: smooth, zoom, tracking, static, reveal, aerial

DECISION LOGIC:
- If the user mentions a specific platform (Facebook, Instagram, Google Ads, LinkedIn, TikTok), choose "ad" and match the platform.
- If the user mentions "video", "animation", "motion", "clip", or "animate", choose "video".
- If the user mentions "hero image", "background", "graphic", "photo", "illustration", or general image needs, choose "image".
- If unclear, default to "ad" for marketing/advertising context, "image" for general creative needs.
- Match dimensions to the platform automatically.
- Infer industry, style, and campaign type from context clues.
- Write an enhanced prompt that is detailed, specific, and optimized for AI image/video generation.
- Keep the enhanced prompt focused on visual description, not instructions.

WHEN RESEARCH DATA IS PROVIDED:
- Analyze competitor messaging and find differentiation angles
- Reference competitor weaknesses from ad analyses and position the creative to exploit them
- Use SEO keywords to inform headline and copy choices
- Match or deliberately contrast competitor visual styles based on strategic need
- Suggest messaging that addresses gaps in competitor communication
- Include competitive insights and differentiators in your response

ADDITIONAL RESEARCH-POWERED RESPONSE FIELDS (include when research data is present):
- "competitiveInsights": "1-2 sentences summarizing the competitive landscape"
- "targetAudienceRefinement": "Refined audience insight based on research"
- "messagingStrategy": "Recommended messaging angle that differentiates"
- "differentiators": ["3-5 things that should make this creative stand out"]
- "keywordsToInclude": ["SEO-informed keywords for copy"]
- "avoidPatterns": ["Things competitors do poorly to avoid"]

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "outputType": "ad" | "image" | "video",
  "platform": "string (platform key for ads, or 'general' for images/videos)",
  "dimensions": { "width": number, "height": number } | null,
  "aspectRatio": "string or null (for video)",
  "style": "string (style id)",
  "industry": "string or null (industry id)",
  "campaignType": "string or null (campaign id)",
  "motionStyle": "string or null (motion style id for video)",
  "videoDuration": number or null (5, 6, or 8 for video),
  "videoResolution": "string or null ('480p' or '1080p')",
  "enhancedPrompt": "string (detailed, optimized creative prompt)",
  "reasoning": "string (1-2 sentences explaining your choices)",
  "confidence": number (0-100),
  "suggestedHeadline": "string or null",
  "suggestedCta": "string or null",
  "competitiveInsights": "string or null (include when research data is present)",
  "targetAudienceRefinement": "string or null (include when research data is present)",
  "messagingStrategy": "string or null (include when research data is present)",
  "differentiators": ["string array or null (include when research data is present)"],
  "keywordsToInclude": ["string array or null (include when research data is present)"],
  "avoidPatterns": ["string array or null (include when research data is present)"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth
  const auth = await requireAdminAuth(req);
  if (!auth.authorized) {
    return createUnauthorizedResponse(auth.error!, auth.status!, corsHeaders);
  }

  try {
    const { brief, clientContext, researchContext } = await req.json();

    if (!brief || typeof brief !== "string" || brief.trim().length < 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Please provide a creative brief (at least 5 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect whether research data is present
    const hasResearch = researchContext && (
      researchContext.competitorWebsites?.length > 0 ||
      researchContext.competitorAds?.length > 0 ||
      researchContext.socialIntelligence?.length > 0 ||
      researchContext.seoData?.length > 0 ||
      researchContext.adAnalyses?.length > 0
    );

    // Build user message with optional client context
    let userMessage = brief;
    if (clientContext) {
      const contextParts: string[] = [];
      if (clientContext.brandName) contextParts.push(`Brand: ${clientContext.brandName}`);
      if (clientContext.industry) contextParts.push(`Industry: ${clientContext.industry}`);
      if (clientContext.colors?.primary) contextParts.push(`Primary color: ${clientContext.colors.primary}`);
      if (clientContext.colors?.secondary) contextParts.push(`Secondary color: ${clientContext.colors.secondary}`);
      if (contextParts.length > 0) {
        userMessage += `\n\nClient context: ${contextParts.join(", ")}`;
      }
    }

    // Build research sections when researchContext is present
    if (hasResearch) {
      userMessage += "\n\n--- RESEARCH DATA ---\n";

      // Competitor Website Research
      if (researchContext.competitorWebsites?.length > 0) {
        userMessage += "\nCOMPETITOR WEBSITE RESEARCH:\n";
        for (const site of researchContext.competitorWebsites) {
          userMessage += `- Business: ${site.businessName || "Unknown"}`;
          if (site.tagline) userMessage += ` | Tagline: ${site.tagline}`;
          if (site.messaging?.length > 0) {
            userMessage += ` | Key Messaging: ${site.messaging.slice(0, 3).join("; ")}`;
          }
          const colors = site.colors || {};
          const colorValues = Object.values(colors).filter(Boolean);
          if (colorValues.length > 0) {
            userMessage += ` | Brand Colors: ${colorValues.join(", ")}`;
          }
          userMessage += "\n";
        }
      }

      // Competitor Ad Transparency
      if (researchContext.competitorAds?.length > 0) {
        userMessage += "\nCOMPETITOR AD TRANSPARENCY:\n";
        for (const ad of researchContext.competitorAds) {
          userMessage += `- Advertiser: ${ad.advertiserName || "Unknown"}`;
          if (ad.content) {
            const truncated = ad.content.length > 500
              ? ad.content.substring(0, 500) + "..."
              : ad.content;
            userMessage += ` | Content: ${truncated}`;
          }
          userMessage += "\n";
        }
      }

      // Social Media Intelligence
      if (researchContext.socialIntelligence?.length > 0) {
        userMessage += "\nSOCIAL MEDIA INTELLIGENCE:\n";
        for (const social of researchContext.socialIntelligence) {
          userMessage += `- Platform: ${social.platform || "Unknown"} | Handle: ${social.handle || "N/A"}`;
          if (social.totalPosts != null) userMessage += ` | Total Posts: ${social.totalPosts}`;
          if (social.topPosts?.length > 0) {
            const top = social.topPosts.sort((a: any, b: any) => (b.engagementRate || 0) - (a.engagementRate || 0))[0];
            if (top) {
              const caption = (top.caption || "").substring(0, 100);
              userMessage += ` | Top Post: "${caption}" (${top.contentType || "post"}, ${(top.engagementRate || 0).toFixed(1)}% engagement)`;
            }
          }
          userMessage += "\n";
        }
      }

      // SEO Research
      if (researchContext.seoData?.length > 0) {
        userMessage += "\nSEO RESEARCH:\n";
        for (const seo of researchContext.seoData) {
          userMessage += `- Domain: ${seo.domain || "Unknown"}`;
          if (seo.domainAuthority != null) userMessage += ` | DA: ${seo.domainAuthority}`;
          if (seo.organicTraffic != null) userMessage += ` | Organic Traffic: ${seo.organicTraffic}`;
          if (seo.topKeywords?.length > 0) {
            const top5 = seo.topKeywords.slice(0, 5);
            const kwStrings = top5.map((kw: any) =>
              kw.keyword + (kw.volume != null ? ` (vol: ${kw.volume})` : "")
            );
            userMessage += ` | Top Keywords: ${kwStrings.join("; ")}`;
          }
          userMessage += "\n";
        }
      }

      // Competitor Ad Analysis
      if (researchContext.adAnalyses?.length > 0) {
        userMessage += "\nCOMPETITOR AD ANALYSIS:\n";
        for (const ad of researchContext.adAnalyses) {
          userMessage += `- Competitor: ${ad.competitorName || "Unknown"}`;
          if (ad.overallScore) userMessage += ` | Score: ${ad.overallScore}`;
          if (ad.issues?.length > 0) {
            userMessage += ` | Issues: ${ad.issues.slice(0, 3).join("; ")}`;
          }
          if (ad.quickWins?.length > 0) {
            userMessage += ` | Quick Wins: ${ad.quickWins.slice(0, 3).join("; ")}`;
          }
          userMessage += "\n";
        }
      }

      userMessage += "\nIMPORTANT: Use this research to inform your creative strategy. Identify differentiation opportunities, leverage competitor weaknesses, and incorporate relevant SEO keywords into your recommendations.\n";
    }

    // Select model and parameters based on research presence
    const model = hasResearch
      ? "claude-sonnet-4-6"
      : "claude-haiku-4-5-20251001";
    const maxTokens = hasResearch ? 16000 : 1024;

    // Build request body
    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    };

    // Add extended thinking for research-powered requests
    if (hasResearch) {
      requestBody.thinking = {
        type: "enabled",
        budget_tokens: 8000,
      };
    }

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error(`AI analysis failed (${response.status})`);
    }

    const result = await response.json();

    // Parse response - handle extended thinking vs standard response
    let text: string | undefined;
    if (hasResearch) {
      // Extended thinking response: find the text content block (not thinking)
      const textBlock = result.content?.find((b: any) => b.type === 'text');
      text = textBlock?.text;
    } else {
      // Standard response
      text = result.content?.[0]?.text;
    }

    if (!text) {
      throw new Error("Empty response from AI");
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let analysis;
    try {
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", text);
      throw new Error("AI returned invalid analysis format");
    }

    // Validate required fields
    if (!analysis.outputType || !analysis.enhancedPrompt) {
      throw new Error("AI analysis missing required fields");
    }

    return new Response(
      JSON.stringify({ success: true, analysis, researchEnhanced: !!hasResearch }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("analyze-creative-brief error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

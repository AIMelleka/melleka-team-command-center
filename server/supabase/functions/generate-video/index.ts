import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HIGGSFIELD_BASE = "https://platform.higgsfield.ai";

interface VideoRequest {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  cameraFixed?: boolean;
  startingImage?: string;
  generateAudio?: boolean;
  model?: string;
}

// Model endpoint mapping for text-to-video
const TEXT_TO_VIDEO_MODELS: Record<string, string> = {
  "kling-3": "kling-video/v3.0/pro/text-to-video",
  "kling-2.6": "kling-video/v2.6/pro/text-to-video",
  "sora-2": "sora-2/text-to-video",
  "minimax": "minimax/hailuo-02/pro/text-to-video",
  "seedance": "bytedance/seedance/v1.5/pro/text-to-video",
};

// Model endpoint mapping for image-to-video
const IMAGE_TO_VIDEO_MODELS: Record<string, string> = {
  "kling-3": "kling-video/v3.0/pro/image-to-video",
  "kling-2.1": "kling-video/v2.1/pro/image-to-video",
  "seedance": "bytedance/seedance/v1/pro/image-to-video",
  "dop": "higgsfield-ai/dop/standard",
};

// ── Cinematic Prompt Enhancer ─────────────────────────────────────────────
// Analyzes the incoming prompt for missing cinematic elements and adds
// professional defaults. This ensures EVERY video (superagent, UI, Smart Brief)
// gets premium production quality without the user needing filmmaking knowledge.

const CAMERA_WORDS = ["shot", "pan", "dolly", "tracking", "zoom", "crane", "orbit", "tilt", "close-up", "closeup", "wide", "medium shot", "aerial", "drone", "handheld", "static", "fixed", "locked", "push-in", "pull-back", "whip"];
const LIGHTING_WORDS = ["light", "lighting", "shadow", "glow", "rim", "backlit", "golden hour", "sunlight", "neon", "volumetric", "ambient", "illuminat", "key light", "fill light", "soft light", "hard light"];
const FILM_WORDS = ["lens", "bokeh", "depth of field", "film grain", "anamorphic", "35mm", "4k", "8k", "red ", "arri", "alexa", "kodak", "cinematic lens", "shallow focus", "deep focus"];
const PACING_WORDS = ["slowly", "gradually", "gently", "pauses", "holds", "reveals", "builds", "accelerates", "eases", "smooth motion", "half speed", "slow motion"];

function hasAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function enhanceCinematicPrompt(rawPrompt: string, cameraFixed: boolean): string {
  const parts: string[] = [rawPrompt.trim()];

  // Add camera direction if missing
  if (cameraFixed) {
    if (!hasAny(rawPrompt, ["static", "fixed", "locked"])) {
      parts.push("Locked-off camera on heavy tripod, absolutely no camera movement, all motion comes from the subject within frame.");
    }
  } else if (!hasAny(rawPrompt, CAMERA_WORDS)) {
    parts.push("Smooth dolly push-in, medium shot framing, steady gimbal-stabilized movement.");
  }

  // Add lighting if missing
  if (!hasAny(rawPrompt, LIGHTING_WORDS)) {
    parts.push("Soft directional key light from camera-left with warm color temperature, subtle rim light separation from background.");
  }

  // Add film quality if missing
  if (!hasAny(rawPrompt, FILM_WORDS)) {
    parts.push("Cinematic lens with shallow depth of field, professional color grading, rich contrast.");
  }

  // Add pacing if missing
  if (!hasAny(rawPrompt, PACING_WORDS)) {
    parts.push("Smooth gradual motion building visual interest throughout the shot.");
  }

  // Always append production quality baseline
  parts.push("Photorealistic, broadcast-quality rendering, natural motion at 24fps, film-accurate color science. Visually striking and scroll-stopping, premium commercial production value.");

  // Join and cap at ~150 words for optimal Kling performance
  let enhanced = parts.join(" ");
  const words = enhanced.split(/\s+/);
  if (words.length > 160) {
    enhanced = words.slice(0, 155).join(" ") + ".";
  }

  return enhanced;
}

// Poll for video generation completion
async function pollForCompletion(
  requestId: string,
  authHeader: string,
  maxAttempts: number = 120,
  pollIntervalMs: number = 5000
): Promise<any> {
  console.log(`Polling request: ${requestId}`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `${HIGGSFIELD_BASE}/requests/${requestId}/status`,
        { headers: { Authorization: authHeader } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Poll attempt ${attempt + 1} failed:`, response.status, errorText);

        if (response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          continue;
        }
        throw new Error(`Polling failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Poll attempt ${attempt + 1}: status=${result.status}`);

      if (result.status === "completed") {
        return result;
      }
      if (result.status === "failed") {
        throw new Error("Video generation failed");
      }
      if (result.status === "nsfw") {
        throw new Error("Content blocked by moderation. Please adjust the prompt.");
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error(`Poll attempt ${attempt + 1} error:`, error);
      if (attempt === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error("Video generation timed out after maximum polling attempts");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'video-generator');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const keyId = Deno.env.get("HIGGSFIELD_KEY_ID");
    const keySecret = Deno.env.get("HIGGSFIELD_KEY_SECRET");

    if (!keyId || !keySecret) {
      throw new Error("HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET are not configured. Please add them in Supabase secrets.");
    }

    const hfAuth = `Key ${keyId}:${keySecret}`;
    const body: VideoRequest = await req.json();
    const {
      prompt,
      aspectRatio = "16:9",
      duration = 5,
      cameraFixed = false,
      startingImage,
      model = "kling-3",
    } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if image-to-video or text-to-video
    const isImageToVideo = !!startingImage;
    const modelMap = isImageToVideo ? IMAGE_TO_VIDEO_MODELS : TEXT_TO_VIDEO_MODELS;
    const endpoint = modelMap[model] || (isImageToVideo ? IMAGE_TO_VIDEO_MODELS["kling-3"] : TEXT_TO_VIDEO_MODELS["kling-3"]);

    // Enhance prompt with cinematic production quality
    const enhancedPrompt = enhanceCinematicPrompt(prompt, cameraFixed);

    console.log("Higgsfield video generation request:", {
      originalPrompt: prompt.substring(0, 80) + "...",
      enhancedPrompt: enhancedPrompt.substring(0, 120) + "...",
      aspectRatio,
      duration,
      model,
      endpoint,
      isImageToVideo,
    });

    // Build request body (top-level params, NOT nested in input)
    const submitBody: Record<string, any> = {
      prompt: enhancedPrompt,
      duration: Math.max(4, Math.min(12, Math.round(duration))),
      aspect_ratio: aspectRatio,
    };

    // Seedance requires a seed parameter
    if (model === "seedance") {
      submitBody.seed = Math.floor(Math.random() * 999999);
    }

    // Image-to-video: pass image_url
    if (isImageToVideo && startingImage) {
      // If base64, convert to a data URL that Higgsfield can accept
      if (startingImage.startsWith("data:")) {
        submitBody.image_url = startingImage;
      } else {
        submitBody.image_url = `data:image/jpeg;base64,${startingImage}`;
      }
    }

    console.log("Calling Higgsfield API...");
    const startTime = Date.now();

    // Submit generation request
    const response = await fetch(`${HIGGSFIELD_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: hfAuth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submitBody),
    });

    const elapsed = Date.now() - startTime;
    console.log(`Initial API response in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Higgsfield API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Not enough credits or access denied. Please check your Higgsfield account." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 400) {
        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.detail || errorText;
          return new Response(
            JSON.stringify({ error: `Invalid request: ${message}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          // Fall through
        }
      }

      throw new Error(`Higgsfield API failed: ${response.status} - ${errorText}`);
    }

    const submitData = await response.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      // If completed immediately (unlikely for video)
      const videoUrl = submitData.video?.url || submitData.output?.video?.url;
      if (videoUrl) {
        return new Response(
          JSON.stringify({ success: true, videoUrl, duration, resolution: "1080p", model }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("No request_id in response");
    }

    console.log("Generation started, request_id:", requestId);

    // Poll for completion
    const result = await pollForCompletion(requestId, hfAuth);

    // Extract video URL from completed response
    const videoUrl = result.video?.url || result.output?.video?.url || result.images?.[0]?.url;

    if (!videoUrl) {
      console.error("Unexpected result format:", JSON.stringify(result).substring(0, 500));
      throw new Error("Video generated but URL not found in response");
    }

    console.log("Video generated:", videoUrl);

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        duration,
        resolution: "1080p",
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Video generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

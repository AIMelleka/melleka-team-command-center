import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
  if (!m) throw new Error("Invalid data URL");
  return {
    bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)),
    contentType: m[1],
    ext: m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg",
  };
}

async function uploadToStorage(dataUrl: string, prefix: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { bytes, contentType, ext } = parseDataUrl(dataUrl);
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("creative-images").upload(path, bytes, { contentType, upsert: true });
  if (error) { console.warn("Upload failed:", error); return dataUrl; }
  const { data } = sb.storage.from("creative-images").getPublicUrl(path);
  return data?.publicUrl || dataUrl;
}

/** Map arbitrary width/height to OpenAI's supported sizes */
function mapToOpenAISize(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024";   // landscape
  if (ratio < 0.83) return "1024x1536";  // portrait
  return "1024x1024";                     // square
}

// Rephrase prompts for safety using Claude Haiku (fast + cheap)
async function rephrasePromptForSafety(
  originalPrompt: string,
  mode: string,
): Promise<string> {
  if (mode === "generate") return originalPrompt;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return originalPrompt;

  try {
    console.log(`[REPHRASE] Rephrasing prompt for mode=${mode}`);
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{
          role: "user",
          content: `You are a professional photo retouching assistant. Rephrase this image editing instruction into professional photography/retouching terminology that avoids triggering AI safety filters. Keep the exact same intent. Output ONLY the rephrased instruction.\n\nOriginal: "${originalPrompt}"`,
        }],
      }),
    });

    if (!resp.ok) {
      console.warn(`[REPHRASE] Failed ${resp.status}, using original`);
      return originalPrompt;
    }

    const data = await resp.json();
    const rephrased = data.content?.[0]?.text?.trim();
    if (rephrased && rephrased.length > 5) {
      console.log(`[REPHRASE] Original: "${originalPrompt}" → Rephrased: "${rephrased}"`);
      return rephrased;
    }
  } catch (e) {
    console.warn("[REPHRASE] Error:", e);
  }
  return originalPrompt;
}

// Generate image with OpenAI gpt-image-2
async function generateWithOpenAI(
  prompt: string,
  mode: string,
  referenceImageUrl?: string,
  width: number = 1024,
  height: number = 1024,
): Promise<{ imageUrl: string; generator: string } | { finishReason: string } | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) { console.log("[OPENAI] No OPENAI_API_KEY, skipping"); return null; }

  const size = mapToOpenAISize(width, height);
  console.log(`[OPENAI] mode=${mode}, size=${size}, hasRef=${!!referenceImageUrl}`);

  try {
    if (mode === "generate" && !referenceImageUrl) {
      // Text-to-image: use /v1/images/generations
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt,
          n: 1,
          size,
          quality: "high",
          output_format: "b64_json",
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[OPENAI] generations error ${resp.status}:`, errText.slice(0, 300));
        if (errText.includes("content_policy")) return { finishReason: "SAFETY" };
        if (resp.status === 429 || resp.status >= 500) return null;
        return null;
      }

      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) { console.warn("[OPENAI] No image data in response"); return null; }

      const imageUrl = `data:image/png;base64,${b64}`;
      const publicUrl = await uploadToStorage(imageUrl, "openai");
      console.log("[OPENAI] Generated successfully (generations)");
      return { imageUrl: publicUrl, generator: "gpt-image-2" };
    } else {
      // Edit/Background/Upscale or generate-with-reference: use /v1/images/edits
      const formData = new FormData();
      formData.append("model", "gpt-image-2");
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", size);
      formData.append("quality", "high");

      if (referenceImageUrl) {
        // Fetch reference image and attach as PNG blob
        // FIXED: OpenAI expects field name "image" (singular), not "image[]"
        let imgBytes: Uint8Array | null = null;
        if (referenceImageUrl.startsWith("data:image/")) {
          const match = referenceImageUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.*)$/);
          if (match) {
            const raw = atob(match[1]);
            imgBytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) imgBytes[i] = raw.charCodeAt(i);
          }
        } else {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const imgResp = await fetch(referenceImageUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (imgResp.ok) {
              imgBytes = new Uint8Array(await imgResp.arrayBuffer());
            } else {
              console.warn(`[OPENAI] Failed to fetch reference image: ${imgResp.status}`);
            }
          } catch (fetchErr) {
            console.warn("[OPENAI] Reference image fetch error:", fetchErr);
          }
        }
        if (imgBytes) {
          formData.append("image", new Blob([imgBytes], { type: "image/png" }), "reference.png");
        } else {
          console.warn("[OPENAI] Reference image failed to load — proceeding without it");
        }
      }

      const resp = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[OPENAI] edits error ${resp.status}:`, errText.slice(0, 300));
        if (errText.includes("content_policy")) return { finishReason: "SAFETY" };
        if (resp.status === 429 || resp.status >= 500) return null;
        return null;
      }

      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) { console.warn("[OPENAI] No image data in edits response"); return null; }

      const imageUrl = `data:image/png;base64,${b64}`;
      const publicUrl = await uploadToStorage(imageUrl, "openai");
      console.log("[OPENAI] Generated successfully (edits)");
      return { imageUrl: publicUrl, generator: "gpt-image-2" };
    }
  } catch (e) {
    console.error("[OPENAI] Error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await requireToolAuth(req, 'creative-studio');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const body = await req.json();
    const {
      prompt,
      mode = "generate",
      referenceImage,
      width = 1024,
      height = 1024,
      style,
      numberOfImages = 1,
    } = body;

    if (!prompt && mode === "generate") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist reference image to storage if it's a data URL
    let refUrl = referenceImage;
    if (refUrl && refUrl.startsWith("data:image/")) {
      refUrl = await uploadToStorage(refUrl, "ref-inputs");
    }

    let enhancedPrompt = prompt || "";

    // Auto-rephrase for edit/background/upscale modes to reduce safety filter triggers
    if (mode !== "generate" && enhancedPrompt) {
      enhancedPrompt = await rephrasePromptForSafety(enhancedPrompt, mode);
    }

    if (style && style !== "none") {
      const styleMap: Record<string, string> = {
        photorealistic: "Ultra photorealistic, 8K, professional photography, perfect lighting, sharp focus",
        illustration: "Beautiful digital illustration, vibrant colors, clean lines, artistic composition",
        "3d-render": "Professional 3D render, volumetric lighting, ray tracing, ultra detailed",
        watercolor: "Delicate watercolor painting, soft washes, artistic brushstrokes, fine art quality",
        "flat-design": "Modern flat design, clean vectors, bold colors, minimal shadows, graphic design",
        "pop-art": "Bold pop art style, comic book aesthetic, halftone dots, vivid contrasting colors",
        cinematic: "Cinematic still frame, dramatic lighting, film grain, anamorphic bokeh, movie quality",
        "oil-painting": "Classical oil painting, rich impasto technique, museum quality, fine art",
        minimalist: "Ultra minimalist, clean negative space, single focal point, elegant simplicity",
        cyberpunk: "Cyberpunk aesthetic, neon lights, dark urban environment, futuristic tech",
        vintage: "Vintage aesthetic, warm tones, film grain, retro color grading, nostalgic feel",
        anime: "High quality anime art style, Studio Ghibli inspired, vibrant colors, detailed backgrounds",
      };
      const styleDesc = styleMap[style] || style;
      enhancedPrompt = `${enhancedPrompt}. Style: ${styleDesc}`;
    }

    const results: Array<{ imageUrl: string; generator: string }> = [];
    let blockedReason: string | null = null;

    for (let i = 0; i < Math.min(numberOfImages, 4); i++) {
      const result = await generateWithOpenAI(enhancedPrompt, mode, refUrl, width, height);

      if (result && "finishReason" in result && result.finishReason) {
        blockedReason = result.finishReason;
      } else if (result && "imageUrl" in result && result.imageUrl) {
        results.push({ imageUrl: result.imageUrl, generator: result.generator });
      } else {
        console.warn(`[GEN] Image ${i + 1} failed`);
      }
    }

    if (results.length === 0) {
      const isPolicyBlock = blockedReason === "PROHIBITED_CONTENT" || blockedReason === "SAFETY";
      const errorMessage = isPolicyBlock
        ? "This image was blocked by the AI's content policy. Try a different reference image or simpler instructions."
        : "Image generation failed. The AI may be temporarily unavailable. Try rephrasing your prompt.";

      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
        reason: blockedReason,
        rephrased: mode !== "generate" ? enhancedPrompt : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      images: results,
      count: results.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-generator error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

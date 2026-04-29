import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AttemptLog = {
  generator: string;
  ok: boolean;
  error?: string;
  meta?: Record<string, unknown>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDataUrl(str: string) {
  return typeof str === "string" && str.startsWith("data:image/");
}

function parseImageDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data URL");
  const contentType = match[1];
  const base64 = match[2];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : "img";
  return { bytes, contentType, ext };
}

async function persistImageToPublicBucket(urlOrData: string, prefix: string): Promise<string> {
  if (!isDataUrl(urlOrData)) return urlOrData;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Storage upload skipped: missing backend env vars");
    return urlOrData;
  }

  const { bytes, contentType, ext } = parseImageDataUrl(urlOrData);
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: uploadError } = await supabase.storage
    .from("proposal-assets")
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });

  if (uploadError) {
    console.warn("Storage upload failed, continuing with data URL:", uploadError);
    return urlOrData;
  }

  const { data } = supabase.storage.from("proposal-assets").getPublicUrl(path);
  if (!data?.publicUrl) return urlOrData;
  return data.publicUrl;
}

/** Fetch a URL and return its base64 + mime type for Gemini inline data */
async function urlToInlineData(url: string): Promise<{ mimeType: string; data: string } | null> {
  if (url.startsWith("data:image/")) {
    const match = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
    if (match) return { mimeType: match[1], data: match[2] };
    return null;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let b64 = "";
    for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
    const mimeType = resp.headers.get("content-type") || "image/png";
    return { mimeType, data: btoa(b64) };
  } catch (e) {
    console.error("Failed to fetch image URL:", e);
    return null;
  }
}

// Generate with Gemini Pro Image (best quality, good with references)
async function generateWithGeminiPro(
  prompt: string,
  width: number,
  height: number,
  apiKey: string,
  referenceImage?: string,
  websiteScreenshots?: string[],
  referenceMode: string = "embed_logo",
  logoPlacement: string = "top-left",
  referenceStrength: number = 0.7,
): Promise<{ imageUrl: string; generator: string } | null> {
  console.log("Generating image with Gemini Pro Image (direct Google AI)...");

  const aspectRatio = width > height ? "landscape" : height > width ? "portrait" : "square";
  const parts: any[] = [];

  // Add reference images as inline data
  if (websiteScreenshots && websiteScreenshots.length > 0) {
    for (const url of websiteScreenshots) {
      const inline = await urlToInlineData(url);
      if (inline) parts.push({ inlineData: inline });
    }
  }
  if (referenceImage) {
    const inline = await urlToInlineData(referenceImage);
    if (inline) parts.push({ inlineData: inline });
  }

  const refCount = (websiteScreenshots?.length || 0) + (referenceImage ? 1 : 0);
  let refInstructions = "";
  if (refCount > 0) {
    refInstructions = `\n=== REFERENCE IMAGE INSTRUCTIONS ===
You have ${refCount} reference image(s). MANDATORY:
1. REPRODUCE the exact logo/brand mark if visible
2. USE the EXACT color palette from the references
3. MATCH the visual style and design language
4. Mode: ${referenceMode}, Logo placement: ${logoPlacement}
5. Reference strength: ${Math.round(referenceStrength * 100)}%\n`;
  }

  parts.push({
    text: `CREATE THIS ADVERTISEMENT:\n\n${prompt}${refInstructions}\n=== TECHNICAL REQUIREMENTS ===\n- Aspect ratio: ${aspectRatio} (${width}x${height} pixels)\n- Ultra high resolution, magazine-quality output\n- Professional advertising quality\n- All text must be in perfect English with correct spelling\n\nGenerate the image now.`,
  });

  const models = ["gemini-2.0-flash-exp"];
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[GEMINI-PRO] Trying ${model} (attempt ${attempt})`);
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            }),
          }
        );

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`[GEMINI-PRO] ${model} error ${resp.status}:`, errText.slice(0, 300));
          if (resp.status === 429 && attempt < 2) { await sleep(1000); continue; }
          break;
        }

        const data = await resp.json();
        const candidate = data.candidates?.[0];

        if (candidate?.finishReason === "SAFETY") {
          console.warn("[GEMINI-PRO] Blocked by safety filters");
          return null;
        }

        // Extract image from response parts
        for (const part of candidate?.content?.parts || []) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
            const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            return { imageUrl, generator: "gemini-pro-image" };
          }
        }

        console.warn(`[GEMINI-PRO] No image in response from ${model}`);
        break;
      } catch (e) {
        console.error(`[GEMINI-PRO] ${model} error:`, e);
        if (attempt < 2) { await sleep(500); continue; }
      }
    }
  }
  return null;
}

// Generate with Gemini Flash Image (faster, good quality)
async function generateWithGeminiFlash(
  prompt: string,
  width: number,
  height: number,
  apiKey: string,
  referenceImage?: string,
  websiteScreenshots?: string[],
  referenceMode: string = "embed_logo",
  logoPlacement: string = "top-left",
  referenceStrength: number = 0.7,
): Promise<{ imageUrl: string; generator: string } | null> {
  console.log("Generating image with Gemini Flash Image (direct Google AI)...");

  const aspectRatio = width > height ? "landscape" : height > width ? "portrait" : "square";
  const parts: any[] = [];

  if (websiteScreenshots && websiteScreenshots.length > 0) {
    for (const url of websiteScreenshots) {
      const inline = await urlToInlineData(url);
      if (inline) parts.push({ inlineData: inline });
    }
  }
  if (referenceImage) {
    const inline = await urlToInlineData(referenceImage);
    if (inline) parts.push({ inlineData: inline });
  }

  const refCount = (websiteScreenshots?.length || 0) + (referenceImage ? 1 : 0);
  let modeInstructions = "";
  if (refCount > 0) {
    switch (referenceMode) {
      case "embed_logo":
        modeInstructions = `\n=== LOGO EMBEDDING MODE ===\nInclude the exact logo from the reference. Place it ${logoPlacement === "auto" ? "in the most balanced position" : "in the " + logoPlacement.replace("-", " ")}. Match brand colors. Strength: ${Math.round(referenceStrength * 100)}%`;
        break;
      case "preserve_subject":
        modeInstructions = `\n=== SUBJECT PRESERVATION MODE ===\nPreserve the identity of subjects in the reference. Maintain features/details. Strength: ${Math.round(referenceStrength * 100)}%`;
        break;
      case "match_style":
        modeInstructions = `\n=== STYLE MATCHING MODE ===\nMatch the color palette and design language from references. Strength: ${Math.round(referenceStrength * 100)}%`;
        break;
      case "light_inspiration":
        modeInstructions = `\n=== LIGHT INSPIRATION MODE ===\nUse references as loose inspiration only. Focus on the prompt. Strength: ${Math.round(referenceStrength * 100)}%`;
        break;
      default:
        modeInstructions = `\n=== REFERENCE MODE ===\nMatch brand style from references. Strength: ${Math.round(referenceStrength * 100)}%`;
    }
  }

  parts.push({
    text: `CREATE THIS ADVERTISEMENT:\n\n${prompt}${modeInstructions}\n\n=== TECHNICAL REQUIREMENTS ===\n- Aspect ratio: ${aspectRatio} (${width}x${height} pixels)\n- Ultra high resolution, professional advertising quality\n- All text in perfect English\n- Clean, balanced composition`,
  });

  const model = "gemini-2.0-flash-exp";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[GEMINI-FLASH] Trying ${model} (attempt ${attempt})`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[GEMINI-FLASH] error ${resp.status}:`, errText.slice(0, 300));
        if (resp.status === 429 && attempt < 2) { await sleep(1000); continue; }
        break;
      }

      const data = await resp.json();
      const candidate = data.candidates?.[0];

      if (candidate?.finishReason === "SAFETY") {
        console.warn("[GEMINI-FLASH] Blocked by safety filters");
        return null;
      }

      for (const part of candidate?.content?.parts || []) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          return { imageUrl, generator: "gemini-flash-image" };
        }
      }

      console.warn("[GEMINI-FLASH] No image in response");
      break;
    } catch (e) {
      console.error("[GEMINI-FLASH] error:", e);
      if (attempt < 2) { await sleep(500); continue; }
    }
  }
  return null;
}

/** Map arbitrary width/height to OpenAI's supported sizes */
function mapToOpenAISize(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024";   // landscape
  if (ratio < 0.83) return "1024x1536";  // portrait
  return "1024x1024";                     // square
}

// Generate ad image with OpenAI gpt-image-1
async function generateWithOpenAI(
  prompt: string,
  width: number,
  height: number,
  referenceImage?: string,
  websiteScreenshots?: string[],
  referenceMode: string = "embed_logo",
): Promise<{ imageUrl: string; generator: string } | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) { console.log("[OPENAI] No OPENAI_API_KEY, skipping"); return null; }

  const size = mapToOpenAISize(width, height);
  const hasRefImages = referenceImage || (websiteScreenshots && websiteScreenshots.length > 0);
  const useEdits = hasRefImages && (referenceMode === "embed_logo" || referenceMode === "preserve_subject");

  console.log(`[OPENAI] size=${size}, hasRef=${!!hasRefImages}, useEdits=${useEdits}`);

  try {
    if (useEdits) {
      // Use /v1/images/edits with reference image(s)
      const formData = new FormData();
      formData.append("model", "gpt-image-1");
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", size);
      formData.append("quality", "high");

      // Attach reference images
      const imageUrls = [
        ...(websiteScreenshots || []),
        ...(referenceImage ? [referenceImage] : []),
      ];
      for (const imgUrl of imageUrls) {
        let imgBytes: Uint8Array | null = null;
        if (imgUrl.startsWith("data:image/")) {
          const match = imgUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.*)$/);
          if (match) imgBytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
        } else {
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) imgBytes = new Uint8Array(await imgResp.arrayBuffer());
        }
        if (imgBytes) {
          formData.append("image[]", new Blob([imgBytes], { type: "image/png" }), "reference.png");
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
        return null;
      }

      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) { console.warn("[OPENAI] No image data in edits response"); return null; }

      const imageUrl = `data:image/png;base64,${b64}`;
      console.log("[OPENAI] Generated successfully (edits)");
      return { imageUrl, generator: "gpt-image-1" };
    } else {
      // Use /v1/images/generations (text-only, reference context is in the prompt)
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
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
        return null;
      }

      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) { console.warn("[OPENAI] No image data in response"); return null; }

      const imageUrl = `data:image/png;base64,${b64}`;
      console.log("[OPENAI] Generated successfully (generations)");
      return { imageUrl, generator: "gpt-image-1" };
    }
  } catch (e) {
    console.error("[OPENAI] Error:", e);
    return null;
  }
}

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
    const requestBody = await req.json();
    const {
      prompt,
      width = 1024,
      height = 1024,
      referenceImage,
      websiteScreenshots,
      referenceStrength = 0.7,
      referenceMode = "embed_logo",
      logoPlacement = "top-left",
      brandName,
      primaryColor,
      secondaryColor,
      accentColor,
      productDescription,
      headline,
      cta,
      industry,
      style,
      campaign,
    } = requestBody;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");

    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Google AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist data-url images to public storage so Gemini can fetch them
    const persistedReferenceImage = referenceImage
      ? await persistImageToPublicBucket(referenceImage, "ad-references")
      : undefined;
    const persistedWebsiteScreenshots = Array.isArray(websiteScreenshots)
      ? await Promise.all(websiteScreenshots.map((s: string) => persistImageToPublicBucket(s, "ad-site-screens")))
      : undefined;

    const hasReferenceImages = persistedReferenceImage || (persistedWebsiteScreenshots && persistedWebsiteScreenshots.length > 0);

    console.log("=== AD GENERATION REQUEST ===");
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log(`Dimensions: ${width}x${height}`);
    console.log(`Brand Name: ${brandName || "Not provided"}`);
    console.log(`Reference image: ${persistedReferenceImage ? "YES" : "NO"}`);
    console.log(`Website screenshots: ${persistedWebsiteScreenshots?.length || 0}`);
    console.log(`Reference mode: ${referenceMode}, strength: ${referenceStrength}`);

    const attempts: AttemptLog[] = [];
    let result: { imageUrl: string; generator: string } | null = null;

    // Try OpenAI gpt-image-1 first (primary generator)
    try {
      result = await generateWithOpenAI(
        prompt, width, height,
        persistedReferenceImage, persistedWebsiteScreenshots,
        referenceMode,
      );
      attempts.push({ generator: result?.generator || "gpt-image-1", ok: !!result?.imageUrl });
    } catch (error) {
      attempts.push({ generator: "gpt-image-1", ok: false, error: error instanceof Error ? error.message : "Failed" });
    }

    // If OpenAI succeeded, skip Gemini entirely
    if (!result) {
      console.log("[FALLBACK] OpenAI failed, falling back to Gemini chain");

      if (hasReferenceImages) {
        // With references: Gemini Pro first (best at understanding references), then Flash
        console.log("Reference images detected - using reference-preserving pipeline");

        try {
          result = await generateWithGeminiPro(
            prompt, width, height, GOOGLE_AI_API_KEY,
            persistedReferenceImage, persistedWebsiteScreenshots,
            referenceMode, logoPlacement, referenceStrength
          );
          attempts.push({ generator: result?.generator || "gemini-pro-image", ok: !!result?.imageUrl });
        } catch (error) {
          attempts.push({ generator: "gemini-pro-image", ok: false, error: error instanceof Error ? error.message : "Failed" });
        }

        if (!result) {
          try {
            result = await generateWithGeminiFlash(
              prompt, width, height, GOOGLE_AI_API_KEY,
              persistedReferenceImage, persistedWebsiteScreenshots,
              referenceMode, logoPlacement, referenceStrength
            );
            attempts.push({ generator: result?.generator || "gemini-flash-image", ok: !!result?.imageUrl });
          } catch (error) {
            attempts.push({ generator: "gemini-flash-image", ok: false, error: error instanceof Error ? error.message : "Failed" });
          }
        }
      } else {
        // No references: Flash first (fastest), then Pro
        console.log("No reference images - using fast generation mode");

        try {
          result = await generateWithGeminiFlash(prompt, width, height, GOOGLE_AI_API_KEY);
          attempts.push({ generator: result?.generator || "gemini-flash-image", ok: !!result?.imageUrl });
        } catch (error) {
          attempts.push({ generator: "gemini-flash-image", ok: false, error: error instanceof Error ? error.message : "Failed" });
        }

        if (!result) {
          try {
            result = await generateWithGeminiPro(prompt, width, height, GOOGLE_AI_API_KEY);
            attempts.push({ generator: result?.generator || "gemini-pro-image", ok: !!result?.imageUrl });
          } catch (error) {
            attempts.push({ generator: "gemini-pro-image", ok: false, error: error instanceof Error ? error.message : "Failed" });
          }
        }
      }
    }

    if (!result || !result.imageUrl) {
      const anySafety = attempts.some((a) => (a.error || "").includes("SAFETY"));
      const help = anySafety
        ? "Your prompt or reference image was blocked by safety filters. Try different wording or a different reference image."
        : "All generators failed (may be transient). Try again in 30-60 seconds.";
      return new Response(
        JSON.stringify({
          error: anySafety ? "Image blocked by safety filters" : "Failed to generate image",
          help, attempts,
          used: { referenceMode, logoPlacement, referenceStrength, usedReferenceImage: !!persistedReferenceImage, usedWebsiteScreenshots: persistedWebsiteScreenshots?.length || 0 },
        }),
        { status: anySafety ? 422 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist base64 data URL to public storage
    if (result.imageUrl && isDataUrl(result.imageUrl)) {
      result.imageUrl = await persistImageToPublicBucket(result.imageUrl, "ad-generated");
    }

    console.log(`=== GENERATION COMPLETE (${result.generator}) ===`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: result.imageUrl,
        generator: result.generator,
        prompt,
        dimensions: { width, height },
        usedReferenceImage: !!persistedReferenceImage,
        usedWebsiteScreenshots: persistedWebsiteScreenshots?.length || 0,
        attempts,
        used: { referenceMode, logoPlacement, referenceStrength, usedReferenceImage: !!persistedReferenceImage, usedWebsiteScreenshots: persistedWebsiteScreenshots?.length || 0 },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate ad image error:", error);
    if (error instanceof Error && (error.message.includes("429") || error.message.includes("Rate limit"))) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

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

/** Map arbitrary width/height to OpenAI's supported sizes */
function mapToOpenAISize(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024";   // landscape
  if (ratio < 0.83) return "1024x1536";  // portrait
  return "1024x1024";                     // square
}

// Generate ad image with OpenAI gpt-image-2
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
    // Try edits endpoint if we have reference images to attach
    if (useEdits) {
      const imageUrls = [
        ...(websiteScreenshots || []),
        ...(referenceImage ? [referenceImage] : []),
      ];
      const loadedImages: { bytes: Uint8Array; index: number }[] = [];

      for (let idx = 0; idx < imageUrls.length; idx++) {
        const imgUrl = imageUrls[idx];
        let imgBytes: Uint8Array | null = null;
        if (imgUrl.startsWith("data:image/")) {
          const match = imgUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.*)$/);
          if (match) {
            const raw = atob(match[1]);
            imgBytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) imgBytes[i] = raw.charCodeAt(i);
          }
        } else {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const imgResp = await fetch(imgUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (imgResp.ok) {
              imgBytes = new Uint8Array(await imgResp.arrayBuffer());
            } else {
              console.warn(`[OPENAI] Failed to fetch reference image ${imgUrl}: ${imgResp.status}`);
            }
          } catch (fetchErr) {
            console.warn(`[OPENAI] Reference image fetch error for ${imgUrl}:`, fetchErr);
          }
        }
        if (imgBytes) {
          loadedImages.push({ bytes: imgBytes, index: idx });
        }
      }

      // If we loaded at least one reference image, use /v1/images/edits
      if (loadedImages.length > 0) {
        const formData = new FormData();
        formData.append("model", "gpt-image-2");
        formData.append("prompt", prompt);
        formData.append("n", "1");
        formData.append("size", size);
        formData.append("quality", "high");

        for (const { bytes, index } of loadedImages) {
          formData.append("image", new Blob([bytes], { type: "image/png" }), `reference_${index}.png`);
        }

        const resp = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}` },
          body: formData,
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`[OPENAI] edits error ${resp.status}:`, errText.slice(0, 300));
          // Fall through to try generations endpoint
        } else {
          const data = await resp.json();
          const b64 = data.data?.[0]?.b64_json;
          if (b64) {
            const imageUrl = `data:image/png;base64,${b64}`;
            console.log("[OPENAI] Generated successfully (edits)");
            return { imageUrl, generator: "gpt-image-2" };
          }
          console.warn("[OPENAI] No image data in edits response, trying generations");
        }
      } else {
        console.warn("[OPENAI] All reference images failed to load — falling back to text-only generation");
      }
    }

    // Text-only generation (or fallback when edits failed)
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
      return null;
    }

    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) { console.warn("[OPENAI] No image data in response"); return null; }

    const imageUrl = `data:image/png;base64,${b64}`;
    console.log("[OPENAI] Generated successfully (generations)");
    return { imageUrl, generator: "gpt-image-2" };
  } catch (e) {
    console.error("[OPENAI] Error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'creative-studio');
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

    // Persist data-url images to public storage
    const persistedReferenceImage = referenceImage
      ? await persistImageToPublicBucket(referenceImage, "ad-references")
      : undefined;
    // FIXED: Use Promise.allSettled so one failed upload doesn't kill all screenshots
    const persistedWebsiteScreenshots = Array.isArray(websiteScreenshots)
      ? (await Promise.allSettled(websiteScreenshots.map((s: string) => persistImageToPublicBucket(s, "ad-site-screens"))))
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map(r => r.value)
      : undefined;

    console.log("=== AD GENERATION REQUEST ===");
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log(`Dimensions: ${width}x${height}`);
    console.log(`Brand Name: ${brandName || "Not provided"}`);
    console.log(`Reference image: ${persistedReferenceImage ? "YES" : "NO"}`);
    console.log(`Website screenshots: ${persistedWebsiteScreenshots?.length || 0}`);
    console.log(`Reference mode: ${referenceMode}, strength: ${referenceStrength}`);

    const attempts: AttemptLog[] = [];
    let result: { imageUrl: string; generator: string } | null = null;

    // Generate with OpenAI gpt-image-2 (sole generator — no Gemini fallback)
    try {
      result = await generateWithOpenAI(
        prompt, width, height,
        persistedReferenceImage, persistedWebsiteScreenshots,
        referenceMode,
      );
      attempts.push({ generator: result?.generator || "gpt-image-2", ok: !!result?.imageUrl });
    } catch (error) {
      attempts.push({ generator: "gpt-image-2", ok: false, error: error instanceof Error ? error.message : "Failed" });
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

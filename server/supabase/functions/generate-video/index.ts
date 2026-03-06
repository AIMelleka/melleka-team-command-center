import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VideoRequest {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  cameraFixed?: boolean;
  startingImage?: string;
  generateAudio?: boolean;
}

// Poll for video generation completion
async function pollForCompletion(
  operationName: string,
  apiKey: string,
  maxAttempts: number = 60,
  pollIntervalMs: number = 5000
): Promise<any> {
  console.log(`Polling operation: ${operationName}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/${operationName}?key=${apiKey}`,
        { method: "GET" }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Poll attempt ${attempt + 1} failed:`, response.status, errorText);
        
        // Continue polling on transient errors
        if (response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          continue;
        }
        throw new Error(`Polling failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Poll attempt ${attempt + 1}: done=${result.done}`);

      if (result.done) {
        if (result.error) {
          throw new Error(`Video generation failed: ${result.error.message}`);
        }
        return result.response;
      }

      // Wait before next poll
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
    // Try Google AI Studio API key first, then fall back to Lovable API key
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY is not configured. Please add it in Cloud secrets.");
    }

    const body: VideoRequest = await req.json();
    const {
      prompt,
      aspectRatio = "16:9",
      duration = 5,
      resolution = "720p",
      cameraFixed = false,
      startingImage,
      generateAudio = false,
    } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate duration (Veo supports 5-8 seconds inclusive)
    const validDuration = Math.max(5, Math.min(8, Math.round(duration)));

    console.log("Veo 3 video generation request:", {
      prompt: prompt.substring(0, 100) + "...",
      aspectRatio,
      duration: validDuration,
      resolution,
      cameraFixed,
      hasStartingImage: !!startingImage,
      generateAudio,
    });

    // Build enhanced prompt
    let enhancedPrompt = prompt;
    if (cameraFixed && !prompt.toLowerCase().includes("static") && !prompt.toLowerCase().includes("fixed camera")) {
      enhancedPrompt = `${prompt}. Static camera, minimal camera movement.`;
    }

    // Build request for Google AI Studio Veo API
    const requestBody: any = {
      instances: [
        {
          prompt: enhancedPrompt,
        },
      ],
      parameters: {
        aspectRatio: aspectRatio,
        durationSeconds: validDuration,
        sampleCount: 1,
      },
    };

    // Add starting image for image-to-video
    if (startingImage) {
      // Extract base64 data if it's a data URL
      const base64Data = startingImage.includes(",") 
        ? startingImage.split(",")[1] 
        : startingImage;
      
      requestBody.instances[0].image = {
        bytesBase64Encoded: base64Data,
      };
    }

    // Add audio generation if requested
    if (generateAudio) {
      requestBody.parameters.generateAudio = true;
    }

    console.log("Calling Google AI Studio Veo 3 API...");
    const startTime = Date.now();

    // Use the Veo 3 model via Google AI Studio
    // The predictLongRunning endpoint returns an operation that needs polling
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`Initial API response in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Veo API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: "API access denied. Please check your Google AI Studio API key has Veo access enabled." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 400) {
        // Parse error for better messaging
        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.error?.message || errorText;
          return new Response(
            JSON.stringify({ error: `Invalid request: ${message}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          // Fall through
        }
      }

      throw new Error(`Veo API failed: ${response.status} - ${errorText}`);
    }

    const operationData = await response.json();
    console.log("Operation started:", operationData.name);

    // For long-running operations, we need to poll for completion
    if (operationData.name && !operationData.done) {
      console.log("Video generation is async, polling for completion...");
      
      try {
        const result = await pollForCompletion(operationData.name, GOOGLE_API_KEY);
        console.log("Poll result structure:", JSON.stringify(result).substring(0, 500));
        
        // Extract video from the actual API response format
        // Format: { generateVideoResponse: { generatedSamples: [{ video: { uri: "..." } }] } }
        let videoUri = result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        
        // Fallback: check legacy format (predictions array)
        if (!videoUri) {
          const legacyVideoData = result?.predictions?.[0];
          if (legacyVideoData?.video?.uri) {
            videoUri = legacyVideoData.video.uri;
          } else if (legacyVideoData?.video?.bytesBase64Encoded) {
            const videoUrl = `data:video/mp4;base64,${legacyVideoData.video.bytesBase64Encoded}`;
            console.log("Video generated as base64");
            return new Response(
              JSON.stringify({
                success: true,
                videoUrl: videoUrl,
                duration: validDuration,
                resolution: resolution,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        if (videoUri) {
          console.log("Video generated at URI:", videoUri);
          
          // The Google API URL requires authentication - we need to fetch and convert to base64
          // Add the API key to the request
          const videoFetchUrl = videoUri.includes("?") 
            ? `${videoUri}&key=${GOOGLE_API_KEY}`
            : `${videoUri}?key=${GOOGLE_API_KEY}`;
          
          console.log("Fetching video content...");
          const videoResponse = await fetch(videoFetchUrl);
          
          if (!videoResponse.ok) {
            console.error("Failed to fetch video:", videoResponse.status);
            throw new Error(`Failed to fetch video content: ${videoResponse.status}`);
          }
          
          const videoBuffer = await videoResponse.arrayBuffer();
          const videoBase64 = btoa(
            new Uint8Array(videoBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          
          console.log("Video fetched and converted to base64, size:", videoBuffer.byteLength);
          
          return new Response(
            JSON.stringify({
              success: true,
              videoUrl: `data:video/mp4;base64,${videoBase64}`,
              duration: validDuration,
              resolution: resolution,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.error("Unexpected result format:", JSON.stringify(result).substring(0, 500));
        throw new Error("Video generated but format not recognized");
        
      } catch (pollError) {
        console.error("Polling error:", pollError);
        throw pollError;
      }
    }

    // If operation completed immediately (unlikely for video)
    if (operationData.done && operationData.response) {
      const videoData = operationData.response?.predictions?.[0];
      if (videoData?.video?.bytesBase64Encoded) {
        const videoUrl = `data:video/mp4;base64,${videoData.video.bytesBase64Encoded}`;
        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: videoUrl,
            duration: validDuration,
            resolution: resolution,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.error("Unexpected response:", JSON.stringify(operationData).substring(0, 500));
    throw new Error("Failed to start video generation");

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

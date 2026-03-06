import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

// Declare EdgeRuntime for Deno edge environment
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
} | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin authentication
  const authResult = await requireAdminAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Supabase environment variables not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const inputParams = await req.json();

    // Create a job record immediately
    const { data: job, error: jobError } = await supabase
      .from("proposal_generation_jobs")
      .insert({
        status: "processing",
        progress: 5,
        progress_message: "Starting proposal generation...",
        input_params: inputParams,
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    console.log(`Job created: ${job.id}`);

    // Helper to update progress with error handling
    const updateProgress = async (progress: number, message: string) => {
      try {
        const { error } = await supabase
          .from("proposal_generation_jobs")
          .update({ 
            progress, 
            progress_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        
        if (error) {
          console.error("Progress update error:", error);
        }
      } catch (e) {
        console.error("Progress update failed:", e);
      }
    };

    // Helper to mark job as failed
    const markFailed = async (errorMessage: string) => {
      console.error(`Job ${job.id} failed:`, errorMessage);
      try {
        await supabase
          .from("proposal_generation_jobs")
          .update({
            status: "failed",
            error: errorMessage,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } catch (e) {
        console.error("Failed to mark job as failed:", e);
      }
    };

    // Helper to mark job as complete
    const markComplete = async (result: unknown) => {
      console.log(`Job ${job.id} completed successfully`);
      try {
        await supabase
          .from("proposal_generation_jobs")
          .update({
            status: "complete",
            progress: 100,
            progress_message: "Proposal generated successfully!",
            result: result,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } catch (e) {
        console.error("Failed to mark job as complete:", e);
      }
    };

    // Background processing function with granular progress updates
    const processProposal = async () => {
      try {
        await updateProgress(5, "Starting proposal generation...");
        
        // Small delay to ensure progress is visible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await updateProgress(10, "Preparing client data...");
        await updateProgress(15, "Extracting business context...");
        await updateProgress(20, "Analyzing industry benchmarks...");

        // Call generate-proposal function with extended timeout for quality generation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minute timeout for quality

        try {
          await updateProgress(25, "Connecting to AI engine...");
          await updateProgress(30, "Generating personalized strategy...");

          console.log("Calling generate-proposal function...");
          const startTime = Date.now();

          const response = await fetch(`${supabaseUrl}/functions/v1/generate-proposal`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(inputParams),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`Generate-proposal completed in ${elapsed}s with status ${response.status}`);

          await updateProgress(75, "Processing AI response...");

          if (!response.ok) {
            let errorText = "";
            let errorJson: { error?: string } | null = null;
            try {
              const rawText = await response.text();
              errorText = rawText;
              try {
                errorJson = JSON.parse(rawText);
              } catch {
                // Not JSON, use raw text
              }
            } catch {
              errorText = `HTTP ${response.status}`;
            }
            
            // Use structured error message if available
            const errorMessage = errorJson?.error || errorText.slice(0, 200);
            
            // Handle specific error codes
            if (response.status === 429) {
              throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            }
            if (response.status === 402) {
              throw new Error("AI credits exhausted. Please add credits to continue.");
            }
            
            throw new Error(`AI generation failed: ${errorMessage}`);
          }

          await updateProgress(85, "Parsing proposal content...");

          let result;
          try {
            result = await response.json();
          } catch (parseError) {
            console.error("JSON parse error:", parseError);
            throw new Error("Failed to parse AI response - invalid JSON returned");
          }

          await updateProgress(90, "Validating proposal structure...");

          if (!result) {
            throw new Error("Empty response from AI engine");
          }
          
          if (!result.proposal) {
            // Check if there's an error in the result
            if (result.error) {
              throw new Error(result.error);
            }
            throw new Error("Invalid response: missing proposal data");
          }

          await updateProgress(95, "Finalizing proposal...");
          await markComplete(result);
          
          console.log("Proposal generation completed successfully");
          return result;

        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error("Generation timed out after 5 minutes. Please try with a simpler request.");
          }
          throw fetchError;
        }

      } catch (processingError) {
        const errorMessage = processingError instanceof Error 
          ? processingError.message 
          : "Unknown processing error";
        console.error("Processing error:", errorMessage);
        await markFailed(errorMessage);
        throw processingError;
      }
    };

    // Use EdgeRuntime.waitUntil if available for background processing
    // Otherwise process synchronously
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // Background processing - return job ID immediately
      EdgeRuntime.waitUntil(processProposal().catch((err) => {
        console.error("Background processing error:", err);
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          job_id: job.id,
          message: "Proposal generation started in background" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Synchronous processing (fallback)
      try {
        const result = await processProposal();
        return new Response(
          JSON.stringify({ 
            success: true, 
            job_id: job.id,
            result: result,
            message: "Proposal generated successfully" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (processingError) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            job_id: job.id,
            error: processingError instanceof Error ? processingError.message : "Unknown error" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

  } catch (error) {
    console.error("Error starting proposal generation:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

    // Fire-and-forget: dispatch generate-proposal as independent edge function.
    // It runs in its own invocation (up to 150s) and updates the job directly.
    // We do NOT use EdgeRuntime.waitUntil because it gets killed after ~30s.
    await updateProgress(10, "Dispatching AI generation...");

    fetch(`${supabaseUrl}/functions/v1/generate-proposal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ ...inputParams, _jobId: job.id }),
    }).then(async (response) => {
      console.log(`generate-proposal responded: ${response.status}`);
      await response.text().catch(() => "");
    }).catch((err) => {
      console.error("generate-proposal dispatch error:", err.message);
      // Try to mark job as failed (fire-and-forget)
      markFailed(`Dispatch failed: ${err.message}`);
    });

    // Return job ID immediately - frontend polls for completion
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: "Proposal generation started"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

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

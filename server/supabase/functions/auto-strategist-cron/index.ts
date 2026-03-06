import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log: string[] = [];
  const push = (msg: string) => { console.log(msg); log.push(msg); };

  push(`[AUTO-CRON] Triggered at ${new Date().toISOString()}`);

  // 1. Check if a fleet run is already in progress
  const { data: activeJobs } = await supabase
    .from('fleet_run_jobs')
    .select('id, created_at')
    .eq('status', 'processing')
    .order('created_at', { ascending: false })
    .limit(1);

  if (activeJobs && activeJobs.length > 0) {
    const activeJob = activeJobs[0];
    const jobAge = Date.now() - new Date(activeJob.created_at).getTime();
    const jobAgeMin = Math.round(jobAge / 60000);

    // If a job has been processing for more than 60 minutes, it's likely stuck — allow a new one
    if (jobAge < 60 * 60 * 1000) {
      push(`[AUTO-CRON] Fleet run already in progress (job ${activeJob.id}, ${jobAgeMin}m old). Skipping.`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'fleet_in_progress', jobId: activeJob.id, log }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      push(`[AUTO-CRON] Stale fleet job detected (${jobAgeMin}m old), marking as failed and starting new run.`);
      await supabase.from('fleet_run_jobs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        current_client: null,
      }).eq('id', activeJob.id);
    }
  }

  // 2. Delegate to run-full-fleet (no cooldown — the orchestrator fans out all batches immediately)
  push(`[AUTO-CRON] No active or recent fleet run. Invoking run-full-fleet...`);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/run-full-fleet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ source: 'auto-cron' }),
    });

    const body = await res.json();

    if (res.ok && body.jobId) {
      push(`[AUTO-CRON] ✅ Fleet run started: job ${body.jobId}, ${body.totalClients} clients`);
      return new Response(
        JSON.stringify({ ok: true, delegated: true, jobId: body.jobId, totalClients: body.totalClients, log }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      push(`[AUTO-CRON] ❌ Failed to start fleet run: ${JSON.stringify(body)}`);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to invoke fleet runner', details: body, log }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  } catch (e: any) {
    push(`[AUTO-CRON] ❌ Network error invoking fleet runner: ${e.message}`);
    return new Response(
      JSON.stringify({ ok: false, error: e.message, log }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

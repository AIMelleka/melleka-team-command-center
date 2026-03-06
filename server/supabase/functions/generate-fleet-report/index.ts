import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the fleet run job
    const { data: job, error: jobErr } = await supabase
      .from('fleet_run_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Fleet run job not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = job.results || [];

    // Compute summary stats
    const successCount = results.filter((r: any) => r.status === 'success').length;
    const partialCount = results.filter((r: any) => r.status === 'partial').length;
    const errorCount = results.filter((r: any) => r.status === 'error').length;
    const skippedCount = results.filter((r: any) => r.status === 'skipped').length;

    // Get sessions created during this fleet run (within last 30 min of job creation)
    const jobCreatedAt = new Date(job.created_at);
    const windowStart = new Date(jobCreatedAt.getTime() - 5 * 60000).toISOString();
    const windowEnd = job.completed_at || new Date().toISOString();

    const { data: sessions } = await supabase
      .from('ppc_optimization_sessions')
      .select('id, client_name, platform, ai_summary, status, auto_mode')
      .eq('auto_mode', true)
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false });

    // Get changes from these sessions
    const sessionIds = (sessions || []).map((s: any) => s.id);
    let totalChanges = 0;
    let autoExecuted = 0;
    let pendingReview = 0;

    if (sessionIds.length > 0) {
      const { data: changes } = await supabase
        .from('ppc_proposed_changes')
        .select('id, approval_status, executed_at')
        .in('session_id', sessionIds);

      if (changes) {
        totalChanges = changes.length;
        autoExecuted = changes.filter((c: any) => c.approval_status === 'auto_approved' && c.executed_at).length;
        pendingReview = changes.filter((c: any) => c.approval_status === 'pending').length;
      }
    }

    // Get learning count from this run
    const { count: newLearnings } = await supabase
      .from('client_ai_memory')
      .select('id', { count: 'exact', head: true })
      .eq('memory_type', 'strategist_learning')
      .gte('created_at', windowStart);

    // Per-client summaries
    const clientSummaries = results.map((r: any) => {
      const clientSessions = (sessions || []).filter((s: any) => s.client_name === r.client);
      return {
        client: r.client,
        status: r.status,
        strategistDone: r.strategistDone,
        adReviewDone: r.adReviewDone,
        platforms: clientSessions.map((s: any) => s.platform),
        aiSummary: clientSessions[0]?.ai_summary || null,
        errors: r.errors || [],
      };
    });

    const summary = {
      jobId,
      completedAt: job.completed_at,
      totalClients: job.total_clients || results.length,
      success: successCount,
      partial: partialCount,
      errors: errorCount,
      skipped: skippedCount,
      totalChanges,
      autoExecuted,
      pendingReview,
      newLearnings: newLearnings || 0,
      clientSummaries,
    };

    // Store the report summary in the fleet_run_jobs row
    await supabase
      .from('fleet_run_jobs')
      .update({ report_summary: summary })
      .eq('id', jobId);

    console.log(`[FLEET REPORT] Generated for job ${jobId}: ${successCount} success, ${errorCount} errors, ${totalChanges} changes, ${newLearnings || 0} learnings`);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-fleet-report error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

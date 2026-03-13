import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(msg); };

  push(`[AUTO-ASSESS] Triggered at ${new Date().toISOString()}`);

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find auto-executed sessions that have unassessed executed changes older than 24h
    const { data: sessions } = await supabase
      .from('ppc_optimization_sessions')
      .select('id, client_name, platform')
      .in('status', ['auto_executed', 'executed', 'auto_executing'])
      .eq('auto_mode', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!sessions || sessions.length === 0) {
      push('[AUTO-ASSESS] No auto-mode sessions found.');
      return new Response(JSON.stringify({ ok: true, assessed: 0, log }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    push(`[AUTO-ASSESS] Found ${sessions.length} candidate sessions`);

    let assessedCount = 0;
    let errorCount = 0;

    for (const session of sessions) {
      try {
        // Find executed changes that haven't been assessed yet and are old enough
        const { data: executedChanges } = await supabase
          .from('ppc_proposed_changes')
          .select('id, executed_at')
          .eq('session_id', session.id)
          .not('executed_at', 'is', null)
          .is('assessed_at', null)
          .lte('executed_at', twentyFourHoursAgo);

        if (!executedChanges || executedChanges.length === 0) continue;

        // Double-check: skip if results already exist for these changes
        const changeIds = executedChanges.map(c => c.id);
        const { data: existingResults } = await supabase
          .from('ppc_change_results')
          .select('change_id')
          .in('change_id', changeIds);

        const assessedIds = new Set((existingResults || []).map((r: any) => r.change_id));
        const unassessedCount = changeIds.filter(id => !assessedIds.has(id)).length;

        if (unassessedCount === 0) {
          // Results exist but assessed_at not set -- mark them as assessed
          await supabase
            .from('ppc_proposed_changes')
            .update({ assessed_at: new Date().toISOString() })
            .in('id', changeIds);
          continue;
        }

        push(`[AUTO-ASSESS] Assessing session ${session.id} for ${session.client_name}/${session.platform} (${unassessedCount} unassessed changes)`);

        // Call ppc-assess
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ppc-assess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ sessionId: session.id }),
        });

        if (res.ok) {
          const result = await res.json();

          // Mark all changes as assessed
          await supabase
            .from('ppc_proposed_changes')
            .update({ assessed_at: new Date().toISOString() })
            .eq('session_id', session.id)
            .not('executed_at', 'is', null);

          // Save outcomes to client_ai_memory for learning
          await saveAssessmentToMemory(supabase, session.client_name, result, session.id);

          // Update session status
          await supabase
            .from('ppc_optimization_sessions')
            .update({ status: 'assessed' })
            .eq('id', session.id);

          assessedCount++;
          push(`[AUTO-ASSESS] Session ${session.id} assessed: outcome=${result.outcome}, CPA change=${result.delta?.cpaChangePercent?.toFixed(1) || 'N/A'}%`);
        } else {
          const errText = await res.text();
          push(`[AUTO-ASSESS] Failed to assess session ${session.id}: ${res.status} ${errText}`);
          errorCount++;
        }
      } catch (e: any) {
        push(`[AUTO-ASSESS] Error processing session ${session.id}: ${e.message}`);
        errorCount++;
      }
    }

    push(`[AUTO-ASSESS] Complete: ${assessedCount} assessed, ${errorCount} errors`);

    return new Response(JSON.stringify({ ok: true, assessed: assessedCount, errors: errorCount, log }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    push(`[AUTO-ASSESS] Fatal error: ${error.message}`);
    return new Response(JSON.stringify({ ok: false, error: error.message, log }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function saveAssessmentToMemory(
  supabase: any,
  clientName: string,
  assessResult: any,
  sessionId: string,
) {
  const memories: any[] = [];

  // Overall outcome summary
  const cpaInfo = assessResult.delta?.cpaChangePercent
    ? `CPA ${assessResult.delta.cpaChangePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(assessResult.delta.cpaChangePercent).toFixed(1)}%`
    : 'CPA unchanged';
  const spendBefore = assessResult.beforeMetrics?.spend?.toFixed(0) || '?';
  const spendAfter = assessResult.afterMetrics?.spend?.toFixed(0) || '?';

  memories.push({
    client_name: clientName,
    memory_type: 'change_outcome',
    content: `Auto-optimization assessment: ${assessResult.outcome}. ${cpaInfo}. Spend: $${spendBefore} -> $${spendAfter}. Conversions: ${assessResult.beforeMetrics?.conversions || 0} -> ${assessResult.afterMetrics?.conversions || 0}.`,
    source: 'auto_assess',
    context: {
      date: new Date().toISOString().split('T')[0],
      sessionId,
      outcome: assessResult.outcome,
      delta: assessResult.delta,
    },
    relevance_score: 1.0,
  });

  // AI assessment as a learning entry
  if (assessResult.aiAssessment) {
    memories.push({
      client_name: clientName,
      memory_type: 'strategist_learning',
      content: assessResult.aiAssessment.substring(0, 500),
      source: 'auto_assess',
      context: {
        date: new Date().toISOString().split('T')[0],
        sessionId,
        outcome: assessResult.outcome,
      },
      relevance_score: 1.0,
    });
  }

  if (memories.length > 0) {
    await supabase.from('client_ai_memory').insert(memories);

    // Enforce 50-item rolling window
    const { data: allMemories } = await supabase
      .from('client_ai_memory')
      .select('id')
      .eq('client_name', clientName)
      .order('created_at', { ascending: true });

    if (allMemories && allMemories.length > 50) {
      const toDelete = allMemories.slice(0, allMemories.length - 50).map((m: any) => m.id);
      await supabase.from('client_ai_memory').delete().in('id', toDelete);
    }
  }
}

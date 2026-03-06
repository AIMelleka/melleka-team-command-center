import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPERMETRICS_API_URL = 'https://api.supermetrics.com/enterprise/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPERMETRICS_API_KEY = Deno.env.get('SUPERMETRICS_API_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch the session
    const { data: session, error: sessionErr } = await supabase
      .from('ppc_optimization_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch executed changes for this session
    const { data: changes, error: changesErr } = await supabase
      .from('ppc_proposed_changes')
      .select('*')
      .eq('session_id', sessionId)
      .not('executed_at', 'is', null);

    if (changesErr || !changes || changes.length === 0) {
      return new Response(JSON.stringify({ error: 'No executed changes found for this session' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Pull fresh Supermetrics data for post-period
    const dsId = session.platform === 'google' ? 'AW' : 'FA';
    const assessStart = session.date_range_end; // Start from where we left off
    const assessEnd = new Date().toISOString().split('T')[0]; // Today

    let afterMetrics: any = { campaigns: [], totalSpend: 0, totalConversions: 0 };

    if (session.account_id) {
      const fields = dsId === 'AW'
        ? 'Date,CampaignName,Impressions,Clicks,Cost,Conversions,CostPerConversion,Ctr,CPC'
        : 'Date,adcampaign_name,impressions,Clicks,cost,offsite_conversion,CPC,CTR';

      const res = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPERMETRICS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ds_id: dsId,
          ds_accounts: session.account_id,
          start_date: assessStart,
          end_date: assessEnd,
          fields,
          max_rows: 5000,
          settings: { no_headers: false },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 1) {
          const rows = json.data.slice(1) as (string | number)[][];
          const campMap: Record<string, any> = {};
          for (const row of rows) {
            const name = String(row[1] || '');
            if (!name) continue;
            if (!campMap[name]) campMap[name] = { name, impressions: 0, clicks: 0, cost: 0, conversions: 0 };
            campMap[name].impressions += parseFloat(String(row[2] || '0')) || 0;
            campMap[name].clicks += parseFloat(String(row[3] || '0')) || 0;
            campMap[name].cost += parseFloat(String(row[4] || '0')) || 0;
            campMap[name].conversions += parseFloat(String(row[5] || '0')) || 0;
          }
          const campaigns = Object.values(campMap);
          afterMetrics = {
            campaigns,
            totalSpend: campaigns.reduce((s: number, c: any) => s + c.cost, 0),
            totalConversions: campaigns.reduce((s: number, c: any) => s + c.conversions, 0),
          };
        }
      }
    }

    const beforeData = session.supermetrics_data as any || {};
    const beforeSpend = beforeData.totalSpend || 0;
    const beforeConversions = beforeData.totalConversions || 0;
    const afterSpend = afterMetrics.totalSpend;
    const afterConversions = afterMetrics.totalConversions;

    const beforeCPA = beforeConversions > 0 ? beforeSpend / beforeConversions : null;
    const afterCPA = afterConversions > 0 ? afterSpend / afterConversions : null;

    const delta = {
      spendChange: afterSpend - beforeSpend,
      conversionChange: afterConversions - beforeConversions,
      cpaChange: beforeCPA && afterCPA ? afterCPA - beforeCPA : null,
      cpaChangePercent: beforeCPA && afterCPA ? ((afterCPA - beforeCPA) / beforeCPA) * 100 : null,
    };

    // Determine overall outcome
    let outcome = 'neutral';
    if (delta.cpaChangePercent !== null) {
      if (delta.cpaChangePercent < -5) outcome = 'improved';
      else if (delta.cpaChangePercent > 5) outcome = 'worsened';
    } else if (delta.conversionChange > 0) {
      outcome = 'improved';
    }

    // AI assessment
    const aiPrompt = `You are The Strategist PPC AI. Assess the results of changes made to a ${session.platform} ads account for ${session.client_name}.

BEFORE METRICS (${session.date_range_start} to ${session.date_range_end}):
- Total Spend: $${beforeSpend.toFixed(2)}
- Total Conversions: ${beforeConversions}
- CPA: ${beforeCPA ? `$${beforeCPA.toFixed(2)}` : 'N/A'}

AFTER METRICS (${assessStart} to ${assessEnd}):
- Total Spend: $${afterSpend.toFixed(2)}
- Total Conversions: ${afterConversions}
- CPA: ${afterCPA ? `$${afterCPA.toFixed(2)}` : 'N/A'}

CHANGES THAT WERE EXECUTED (${changes.length} total):
${changes.map((c: any) => `- ${c.change_type}: ${c.entity_name} (expected: ${c.expected_impact})`).join('\n')}

Write a 2-3 paragraph assessment: what worked, what didn't, what to do next. Be honest and specific.`;

    let aiAssessment = 'Assessment pending.';
    try {
      aiAssessment = await callClaude(aiPrompt);
    } catch (e) {
      console.error('AI assessment failed:', e);
    }

    // Store results for each executed change
    const resultInserts = changes.map((c: any) => ({
      change_id: c.id,
      session_id: sessionId,
      metrics_before: { ...beforeData, forChange: c.before_value },
      metrics_after: afterMetrics,
      delta,
      outcome,
      ai_assessment: aiAssessment,
    }));

    await supabase.from('ppc_change_results').insert(resultInserts);

    // Update session status
    await supabase
      .from('ppc_optimization_sessions')
      .update({ status: 'executed' })
      .eq('id', sessionId);

    return new Response(JSON.stringify({
      success: true,
      outcome,
      delta,
      beforeMetrics: { spend: beforeSpend, conversions: beforeConversions, cpa: beforeCPA },
      afterMetrics: { spend: afterSpend, conversions: afterConversions, cpa: afterCPA },
      aiAssessment,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('ppc-assess error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

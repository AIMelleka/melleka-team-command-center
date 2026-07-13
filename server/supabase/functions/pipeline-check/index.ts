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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: any = {};
  try { body = await req.json(); } catch {}

  // Mode: full-report — return complete ad_review_history for a specific client
  if (body.mode === 'full-report') {
    const { data } = await supabase
      .from('ad_review_history')
      .select('*')
      .eq('client_name', body.clientName)
      .eq('review_date', body.date || new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false })
      .limit(1);
    return new Response(JSON.stringify(data?.[0] || null, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mode: snapshots — return all snapshots for a client
  if (body.mode === 'snapshots') {
    const { data } = await supabase
      .from('ppc_daily_snapshots')
      .select('*')
      .eq('client_name', body.clientName)
      .order('snapshot_date', { ascending: false })
      .limit(30);
    return new Response(JSON.stringify(data, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mode: compare — get a known-good April 8 report + today's for same client
  if (body.mode === 'compare') {
    const [apr, today] = await Promise.all([
      supabase.from('ad_review_history').select('*')
        .eq('client_name', body.clientName).eq('review_date', '2026-04-08').limit(1),
      supabase.from('ad_review_history').select('*')
        .eq('client_name', body.clientName).eq('review_date', '2026-05-26')
        .order('created_at', { ascending: false }).limit(1),
    ]);
    return new Response(JSON.stringify({
      april8: apr.data?.[0] || null,
      today: today.data?.[0] || null,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Default: summary
  const today = new Date().toISOString().split('T')[0];
  const { data: reviews } = await supabase.from('ad_review_history')
    .select('client_name, review_date, summary, platforms, insights, recommendations')
    .eq('review_date', today)
    .order('client_name');

  return new Response(JSON.stringify({
    today,
    reviewCount: reviews?.length || 0,
    reviews: reviews?.map((r: any) => ({
      client: r.client_name,
      summary: (r.summary || '').substring(0, 200),
      platformCount: r.platforms?.length || 0,
      insightCount: r.insights?.length || 0,
      recCount: r.recommendations?.length || 0,
    })),
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

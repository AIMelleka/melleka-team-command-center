import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({}));
  const token = body.token;

  if (!token) {
    return new Response(JSON.stringify({ error: 'No token provided' }), { status: 400 });
  }

  // Upsert into team_secrets
  const { error } = await supabase
    .from('team_secrets')
    .upsert({ key: 'META_ACCESS_TOKEN', value: token }, { onConflict: 'key' });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Verify it was stored
  const { data } = await supabase
    .from('team_secrets')
    .select('key')
    .eq('key', 'META_ACCESS_TOKEN')
    .maybeSingle();

  return new Response(JSON.stringify({ success: true, stored: !!data }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

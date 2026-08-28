const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);
async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const [r1, r3] = await Promise.all([
    sb.from('strategist_config').update({ config_value: '2000-01-01' }).eq('config_key', 'vegamour_daily_roas_last_sent'),
    sb.from('auto_client_updates').update({ last_sent_at: '2000-01-01T00:00:00+00:00' }).eq('client_name', 'Vegamour - Daily ROAS'),
  ]);
  console.log('Layer 1:', r1.error?.message || 'OK');
  console.log('Layer 3:', r3.error?.message || 'OK');
  const { data: tasks } = await sb.from('super_agent_tasks')
    .select('id, title').ilike('title', '%ROAS%').eq('status', 'completed').gte('created_at', today + 'T00:00:00Z');
  for (const t of (tasks || [])) {
    await sb.from('super_agent_tasks').update({ status: 'cancelled' }).eq('id', t.id);
    console.log('Layer 2 cleared:', t.title);
  }
  if (!tasks?.length) console.log('Layer 2: nothing to clear');
  console.log('All 3 dedup layers cleared.');
}
run().catch(console.error);

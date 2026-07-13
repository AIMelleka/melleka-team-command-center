const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

Promise.all([
  // Reset dedup flag so today's run is not blocked
  sb.from('strategist_config')
    .update({ config_value: '2026-06-25' })
    .eq('config_key', 'vegamour_roas_brief_last_sent'),
  // Clear conversation history so AI starts fresh
  sb.from('team_messages')
    .delete()
    .eq('conversation_id', 'bf81d90f-1528-42a5-b160-9bd08306233c'),
]).then(([d, m]) => {
  console.log('Dedup reset:', d.error?.message || 'ok (set to 2026-06-25)');
  console.log('Messages cleared:', m.error?.message || 'ok');

  // Now enable cron for 2 minutes
  return sb.from('team_cron_jobs')
    .update({ enabled: true, cron_expr: '* * * * *' })
    .eq('id', 'e9debbda-112f-4e2a-abca-269e719ffe43');
}).then(({ error }) => {
  console.log('Cron enabled:', error?.message || 'ok — firing every minute');
  console.log('Will auto-disable in 2 minutes...');
  setTimeout(() => {
    sb.from('team_cron_jobs')
      .update({ enabled: false, cron_expr: '0 12 * * *' })
      .eq('id', 'e9debbda-112f-4e2a-abca-269e719ffe43')
      .then(({ error: e }) => console.log('Auto-disabled:', e?.message || 'ok'));
  }, 120000);
});

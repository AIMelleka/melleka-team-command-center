const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);
// Enable for one minute, then this script will disable it again after 90 seconds
sb.from('team_cron_jobs')
  .update({ enabled: true, cron_expr: '* * * * *' })
  .eq('id', 'e9debbda-112f-4e2a-abca-269e719ffe43')
  .then(({ error }) => {
    console.log('Enabled:', error?.message || 'ok — will fire within 1 min');
    // Auto-disable after 90 seconds (after first fire)
    setTimeout(() => {
      sb.from('team_cron_jobs')
        .update({ enabled: false, cron_expr: '0 12 * * *' })
        .eq('id', 'e9debbda-112f-4e2a-abca-269e719ffe43')
        .then(({ error: e2 }) => console.log('Auto-disabled:', e2?.message || 'ok — back to daily schedule'));
    }, 90000);
  });

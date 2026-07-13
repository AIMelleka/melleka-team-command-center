const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

const weeklyTask = fs.readFileSync(path.join(__dirname, 'vegamour-weekly-task.txt'), 'utf8');

// Upsert the weekly rollup cron job (Thursday 8 AM LA time)
sb.from('team_cron_jobs')
  .upsert(
    {
      member_name: 'anthony',
      name: 'vegamour-weekly-rollup',
      cron_expr: '0 8 * * 4',
      task: weeklyTask,
      enabled: true,
    },
    { onConflict: 'member_name,name' }
  )
  .then(({ error }) => {
    if (error) console.error('ERROR:', error.message);
    else console.log('Weekly rollup cron created/updated successfully');
  });

// Seed dedup row if missing (keep existing value if already there)
sb.from('strategist_config')
  .upsert(
    { config_key: 'vegamour_weekly_rollup_last_sent', config_value: '2000-01-01' },
    { onConflict: 'config_key', ignoreDuplicates: true }
  )
  .then(({ error }) => {
    if (error) console.error('Seed error:', error.message);
    else console.log('Weekly rollup dedup row seeded (or already existed)');
  });

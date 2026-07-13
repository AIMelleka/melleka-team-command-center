/**
 * One-time setup script for the Slack Client Response Monitor.
 * Run with: node server/setup-slack-monitor.cjs
 *
 * Creates:
 *   - client_response_alerts table
 *   - slack_monitored_channels table
 * Then seeds all 31 client channels.
 */

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

// All 31 client channels from the spec
const MONITORED_CHANNELS = [
  { channel_id: 'C0ASU3KSMS9', channel_name: 'bay-street-lending' },
  { channel_id: 'C0ASRGQ83BM', channel_name: 'vegamour' },
  { channel_id: 'C09FZUYB15G', channel_name: 'sin-city-diabetics' },
  { channel_id: 'C08SN25G9KR', channel_name: 'fiber-connect-marketing' },
  { channel_id: 'C09AGHYR73K', channel_name: 'global-guard-ins' },
  { channel_id: 'C0B1Y8N00DP', channel_name: 'midwest' },
  { channel_id: 'C0B8X5WA3EC', channel_name: 'ng-slot' },
  { channel_id: 'C096WBCVAGN', channel_name: 'san-diego-parks-foundation' },
  { channel_id: 'C0A9WLYUKK2', channel_name: 'sensual-extensions' },
  { channel_id: 'C09H1NE8C03', channel_name: 'teachertainment' },
  { channel_id: 'C0AU317QVH7', channel_name: 'vegamour-seo-sem' },
  { channel_id: 'C0B4R53SJFR', channel_name: 'ab-plumbing-web' },
  { channel_id: 'C0B4R51UV39', channel_name: 'ab-sign-works-web' },
  { channel_id: 'C0B5A73ET9A', channel_name: 'ab-contracting-web' },
  { channel_id: 'C0B60SV4AEL', channel_name: 'ab-traffic-solutions-web' },
  { channel_id: 'C0B54G7RXGE', channel_name: 'ab-stakeholders' },
  { channel_id: 'C0B58NQL5DF', channel_name: 'ab-it' },
  { channel_id: 'C09FKE6BK7H', channel_name: 'st-joseph' },
  { channel_id: 'C09PBAH0068', channel_name: 'st-joseph-ops' },
  { channel_id: 'C09L55NAHS9', channel_name: 'st-joseph-it' },
  { channel_id: 'C0AHJLNGP32', channel_name: 'st-joseph-recruiting' },
  { channel_id: 'C09SZEHR4UD', channel_name: 'st-joseph-team-leads' },
  { channel_id: 'C0ALF7324VD', channel_name: 'stj-ai-bot-calls-chat' },
  { channel_id: 'C0A64KB2GG6', channel_name: 'fiber-connect-sales' },
  { channel_id: 'C0A4NKFFWLE', channel_name: 'global-staffing-partners' },
  { channel_id: 'C0AAZD3R2NS', channel_name: 'gruenberg-law' },
  { channel_id: 'C08KAK0AV4N', channel_name: 'los-angeles-photo-party' },
  { channel_id: 'C0AN84JBUJH', channel_name: 'pest-control' },
  { channel_id: 'C0AR9AWU3J7', channel_name: 'sgra' },
  { channel_id: 'C0A1TM0A8M7', channel_name: 'tim-wright-law' },
  { channel_id: 'C0ACRSQAVK8', channel_name: 'unleash' },
];

async function run() {
  console.log('Setting up Slack Client Response Monitor...\n');

  // NOTE: Tables must be created in Supabase SQL editor first.
  // Run the SQL from server/slack-monitor-migration.sql before this script.

  // Seed monitored channels (upsert so it's safe to re-run)
  console.log(`Seeding ${MONITORED_CHANNELS.length} monitored channels...`);
  const { error } = await sb
    .from('slack_monitored_channels')
    .upsert(MONITORED_CHANNELS, { onConflict: 'channel_id' });

  if (error) {
    console.error('Error seeding channels:', error.message);
    console.log('\nMake sure you ran slack-monitor-migration.sql in Supabase first.');
    return;
  }

  console.log(`✓ Seeded ${MONITORED_CHANNELS.length} client channels`);

  // Verify
  const { data } = await sb.from('slack_monitored_channels').select('channel_id, channel_name').eq('enabled', true);
  console.log(`\n✓ ${data?.length} channels active in database:`);
  data?.forEach(ch => console.log(`  • #${ch.channel_name} (${ch.channel_id})`));

  console.log('\n✅ Setup complete! Next steps:');
  console.log('1. Run slack-monitor-migration.sql in Supabase SQL editor (if not done yet)');
  console.log('2. Add SLACK_SIGNING_SECRET to team_secrets in Supabase');
  console.log('3. In your Slack app: enable Events API, set URL to:');
  console.log('   https://server-production-0486.up.railway.app/api/slack/events');
  console.log('4. Subscribe to: message.channels, message.groups');
  console.log('5. Invite @MellekaBot to each client channel');
}

run().catch(console.error);

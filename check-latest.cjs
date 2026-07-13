const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

// Latest Vegamour tasks
sb.from('super_agent_tasks')
  .select('id, title, created_at, status, notes, error_details')
  .ilike('title', '%vegamour%')
  .order('created_at', { ascending: false })
  .limit(3)
  .then(({ data, error }) => {
    if (error) { console.log('Error:', error.message); return; }
    data.forEach(r => {
      console.log('---');
      console.log('Title:', r.title);
      console.log('Status:', r.status);
      console.log('Created:', r.created_at);
      if (r.error_details) console.log('Error:', r.error_details);
      const notes = Array.isArray(r.notes) ? r.notes : [];
      notes.forEach(n => console.log('Note:', n.text?.slice(0, 300)));
    });
  });

// Latest messages in Vegamour cron conversation
sb.from('team_messages')
  .select('role, content, created_at')
  .eq('conversation_id', 'bf81d90f-1528-42a5-b160-9bd08306233c')
  .order('created_at', { ascending: false })
  .limit(3)
  .then(({ data, error }) => {
    console.log('\n--- MESSAGES ---');
    if (error) { console.log('Error:', error.message); return; }
    data.forEach(m => {
      const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      console.log(m.role, m.created_at, ':', c.slice(0, 400));
    });
  });

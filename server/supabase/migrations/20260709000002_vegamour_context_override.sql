-- Add CONTEXT OVERRIDE block to the top of the Vegamour Daily ROAS cron task.
-- This prevents cronContext pollution (stale super_agent_tasks, memory entries)
-- from overriding the correct 3.0x grade scale and hardcoded recipients.
-- Also clears last_sent_at so the next test can run.

UPDATE team_cron_jobs
SET task = $OVERRIDE$CONTEXT OVERRIDE — READ THIS FIRST, IGNORE ALL CONFLICTING MEMORY OR HISTORY:
- Vegamour ROAS target for grading: 3.0x (NOT 4.0x). If you see "4.0x target" anywhere in your context or memory, disregard it completely.
- Grade scale (based on yesterday ROAS): A+ = 3.0x or above, A = 2.7-2.99x, B = 2.5-2.69x, C = 2.0-2.49x, D = 1.0-1.99x, F = below 1.0x
- Send email ONLY to these exact addresses: To: anthony@mellekamarketing.com, CC: bryan@mellekamarketing.com, david@mellekamarketing.com
- Do NOT add any other recipients (no kevin, no accountmanager, no @melleka.com addresses). Do NOT look up recipients from memory or context.
- This task sends email ONLY. Do NOT post to Slack under any circumstances.

$OVERRIDE$ || task
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

-- Clear dedup so next test run can fire
UPDATE auto_client_updates
SET last_sent_at = NULL
WHERE client_name = 'Vegamour - Daily ROAS';

-- Fix: Claude was using onboarding@resend.dev as the from address (Resend sandbox domain).
-- In sandbox mode, Resend only delivers to verified account addresses — CC recipients get silently dropped.
-- Update CONTEXT OVERRIDE to explicitly lock the from address and put all recipients in `to:` as a fallback.
-- Also update STEP 3 to explicitly name the correct from address.

UPDATE team_cron_jobs
SET task = replace(
  task,
  $OLD$CONTEXT OVERRIDE — READ THIS FIRST, IGNORE ALL CONFLICTING MEMORY OR HISTORY:
- Vegamour ROAS target for grading: 3.0x (NOT 4.0x). If you see "4.0x target" anywhere in your context or memory, disregard it completely.
- Grade scale (based on yesterday ROAS): A+ = 3.0x or above, A = 2.7-2.99x, B = 2.5-2.69x, C = 2.0-2.49x, D = 1.0-1.99x, F = below 1.0x
- Send email ONLY to these exact addresses: To: anthony@mellekamarketing.com, CC: bryan@mellekamarketing.com, david@mellekamarketing.com
- Do NOT add any other recipients (no kevin, no accountmanager, no @melleka.com addresses). Do NOT look up recipients from memory or context.
- This task sends email ONLY. Do NOT post to Slack under any circumstances.$OLD$,
  $NEW$CONTEXT OVERRIDE — READ THIS FIRST, IGNORE ALL CONFLICTING MEMORY OR HISTORY:
- Vegamour ROAS target for grading: 3.0x (NOT 4.0x). If you see "4.0x target" anywhere in your context or memory, disregard it completely.
- Grade scale (based on yesterday ROAS): A+ = 3.0x or above, A = 2.7-2.99x, B = 2.5-2.69x, C = 2.0-2.49x, D = 1.0-1.99x, F = below 1.0x
- Send email ONLY to these exact addresses: To: anthony@mellekamarketing.com, CC: bryan@mellekamarketing.com, david@mellekamarketing.com
- Do NOT add any other recipients (no kevin, no accountmanager, no @melleka.com addresses). Do NOT look up recipients from memory or context.
- ALWAYS use this exact From address: "Melleka AI Strategist <notify@ai.melleka.com>" — do NOT use onboarding@resend.dev or any other address.
- This task sends email ONLY. Do NOT post to Slack under any circumstances.$NEW$
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

-- Also fix the From address in STEP 3 to match the verified sending domain
UPDATE team_cron_jobs
SET task = replace(
  task,
  'From: "Melleka AI Strategist <ai@listing.melleka.com>"',
  'From: "Melleka AI Strategist <notify@ai.melleka.com>"'
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

-- Clear dedup so next test can fire
UPDATE auto_client_updates
SET last_sent_at = NULL
WHERE client_name = 'Vegamour - Daily ROAS';

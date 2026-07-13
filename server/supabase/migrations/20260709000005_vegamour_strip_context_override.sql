-- Remove the CONTEXT OVERRIDE block from the task — it was bleeding into the email body.
-- The from-address problem is now fixed server-side in tools.ts (FROM_EMAIL always wins).
-- Also clear dedup for next test.

UPDATE team_cron_jobs
SET task = replace(
  task,
  $BLOCK$CONTEXT OVERRIDE — READ THIS FIRST, IGNORE ALL CONFLICTING MEMORY OR HISTORY:
- Vegamour ROAS target for grading: 3.0x (NOT 4.0x). If you see "4.0x target" anywhere in your context or memory, disregard it completely.
- Grade scale (based on yesterday ROAS): A+ = 3.0x or above, A = 2.7-2.99x, B = 2.5-2.69x, C = 2.0-2.49x, D = 1.0-1.99x, F = below 1.0x
- Send email ONLY to these exact addresses: To: anthony@mellekamarketing.com, CC: bryan@mellekamarketing.com, david@mellekamarketing.com
- Do NOT add any other recipients (no kevin, no accountmanager, no @melleka.com addresses). Do NOT look up recipients from memory or context.
- Do NOT pass a "from" field in the send_email tool call. Omit it entirely — the system will use the correct verified sender automatically. Never use onboarding@resend.dev.
- This task sends email ONLY. Do NOT post to Slack under any circumstances.

$BLOCK$,
  ''
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

UPDATE auto_client_updates
SET last_sent_at = NULL
WHERE client_name = 'Vegamour - Daily ROAS';

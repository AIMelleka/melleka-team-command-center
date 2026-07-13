-- Claude persistently ignores the From address instruction and passes onboarding@resend.dev.
-- In Resend, onboarding@resend.dev is the sandbox domain — CC recipients are silently dropped.
-- Fix: remove the From line entirely from STEP 3 so Claude does NOT pass a from field.
-- The send_email tool will then use the FROM_EMAIL env var (notify@ai.melleka.com) as the default,
-- which IS a verified domain and delivers CC correctly.
-- Also lock CONTEXT OVERRIDE to explicitly say: do NOT pass a From field.
-- Also add "send ONE email only, do not retry" to prevent double sends.

-- Step 1: Remove "From:" line from STEP 3
UPDATE team_cron_jobs
SET task = replace(
  task,
  E'From: "Melleka AI Strategist <notify@ai.melleka.com>"\n',
  ''
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

-- Step 2: Update CONTEXT OVERRIDE to block from field and double-send
UPDATE team_cron_jobs
SET task = replace(
  task,
  '- ALWAYS use this exact From address: "Melleka AI Strategist <notify@ai.melleka.com>" — do NOT use onboarding@resend.dev or any other address.',
  '- Do NOT pass a "from" field in the send_email tool call. Omit it entirely — the system will use the correct verified sender automatically. Never use onboarding@resend.dev.'
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

-- Step 3: Add "do not retry" to the send step
UPDATE team_cron_jobs
SET task = replace(
  task,
  'Send email ONLY to the recipients listed above. Do NOT add any additional recipients. Do NOT post to Slack.',
  'Send email ONLY to the recipients listed above. Do NOT add any additional recipients. Do NOT post to Slack. Send EXACTLY ONE email — do NOT retry or send again if you already called send_email once in this run.'
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

-- Clear dedup for next test
UPDATE auto_client_updates
SET last_sent_at = NULL
WHERE client_name = 'Vegamour - Daily ROAS';

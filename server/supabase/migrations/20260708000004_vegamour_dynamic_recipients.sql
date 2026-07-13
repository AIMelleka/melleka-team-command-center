-- Vegamour Daily ROAS Brief — read recipients dynamically from auto_client_updates
-- Replaces hardcoded To/CC in STEP 3 with a live lookup so UI changes take effect immediately

UPDATE team_cron_jobs
SET task = replace(
  task,
  $OLD$STEP 3 — Send email with the fully filled HTML:
CRITICAL: Pass the completed HTML DIRECTLY as the body. Do NOT wrap in markdown code fences. Body MUST start with <!DOCTYPE html>.
To: anthony@mellekamarketing.com
CC: bryan@mellekamarketing.com, david@mellekamarketing.com
From: "Melleka AI Strategist <ai@listing.melleka.com>"
Subject: "Vegamour ROAS Brief | [yesterday date] | [ROAS]x | Grade [letter]"$OLD$,
  $NEW$STEP 3 — Look up current recipients and send email:
A. supabase_query on table "auto_client_updates" where client_name = "Vegamour - Daily ROAS" — get the email_recipients array
B. Use element [0] as To:, elements [1..] joined with ", " as CC:
C. Send the fully filled HTML email:
   CRITICAL: Pass the completed HTML DIRECTLY as the body. Do NOT wrap in markdown code fences. Body MUST start with <!DOCTYPE html>.
   From: "Melleka AI Strategist <ai@listing.melleka.com>"
   Subject: "Vegamour ROAS Brief | [yesterday date] | [ROAS]x | Grade [letter]"$NEW$
)
WHERE id = '6c2f2c97-1c48-4898-94ed-60c3c15a1189';

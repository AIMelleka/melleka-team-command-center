-- Rebuild Vegamour - Daily ROAS cron job from scratch.
-- The original job (6c2f2c97) was deleted. This creates a clean system-managed replacement.
-- Migration 20260708000003 must run first — it sets the correct email_design on auto_client_updates.
-- Dedup uses auto_client_updates.last_sent_at (select="last_sent_at" only, never the full row).

DO $$
DECLARE
  v_html TEXT;
  v_task TEXT;
  v_new_id UUID;
BEGIN

  -- Read the rose/cream HTML design set by migration 20260708000003
  SELECT email_design INTO v_html
  FROM auto_client_updates
  WHERE client_name = 'Vegamour - Daily ROAS';

  IF v_html IS NULL THEN
    RAISE EXCEPTION 'Vegamour - Daily ROAS email_design not found. Ensure migration 20260708000003 has been applied.';
  END IF;

  -- Build the task with __HTML__ placeholder, then inject the actual HTML
  v_task := $TASK$VEGAMOUR DAILY ROAS BRIEF
IMPORTANT: This task sends email ONLY. Do NOT post to Slack. Do NOT call slack_post under any circumstances.

STEP 0 — DEDUP CHECK:
Call supabase_query: table="auto_client_updates", filter client_name="Vegamour - Daily ROAS", select="last_sent_at" — fetch ONLY this column (not all columns — the row is very large and will confuse context).
Call get_current_date to get today's date.
If last_sent_at already matches today's date: stop immediately. Log "Already sent today." Do not continue.

STEP 1 — Pull Google Ads data (account 7567846915, ENABLED campaigns only):
A. Yesterday totals: SUM(conversions_value), SUM(cost_micros/1000000). ROAS = revenue / spend.
B. Last 7 Days totals: same calculation.
C. Last 14 Days totals: same calculation.
D. Last 30 Days totals: same calculation.
E. Campaign breakdown for yesterday: per-campaign name, spend, revenue, ROAS. Sort by spend descending. Up to 8 campaigns.

STEP 2 — Fill the HTML template below. Replace ONLY the placeholder tokens — do NOT change any HTML structure, colors, or styling. The complete fill instructions for every placeholder are listed AFTER the HTML.

HTML TEMPLATE:
__HTML__

== PLACEHOLDER FILL INSTRUCTIONS ==
Read all instructions below carefully before filling.

DATA_DATE_PLACEHOLDER
Replace with yesterday's full date, e.g. "Tuesday, July 8, 2026"

GRADE_BG_COLOR — hex color for yesterday's ROAS (Vegamour target is 3.0x):
  A+ = 3.0x or above  → #1a7f4b
  A  = 2.7x to 2.99x  → #2e9e62
  B  = 2.5x to 2.69x  → #5cb85c
  C  = 2.0x to 2.49x  → #f5a623
  D  = 1.0x to 1.99x  → #e67e22
  F  = below 1.0x     → #e74c3c

GRADE_PLACEHOLDER — letter grade only: A+, A, B, C, D, or F

GRADE_LABEL_PLACEHOLDER — short label matching the grade, e.g.:
  A+ → "A+ — Exceeds Target (3.0x+)"
  A  → "A — Near Target (2.7-2.99x)"
  B  → "B — Below Target (2.5-2.69x)"
  C  → "C — Well Below Target (2.0-2.49x)"
  D  → "D — Significantly Below (1.0-1.99x)"
  F  → "F — Critical (below 1x)"

ROAS display placeholders (include the "x" suffix, e.g. "2.84x"):
  YESTERDAY_ROAS — yesterday's ROAS with x
  7D_ROAS        — 7-day ROAS with x
  14D_ROAS       — 14-day ROAS with x
  30D_ROAS       — 30-day ROAS with x

Spend and Revenue placeholders (include "$" and commas, e.g. "$1,234.56"):
  YESTERDAY_SPEND  YESTERDAY_REV
  7D_SPEND         7D_REV
  14D_SPEND        14D_REV
  30D_SPEND        30D_REV

ROAS color placeholders (same hex thresholds as GRADE_BG_COLOR above, based on each window's ROAS):
  YESTERDAY_COLOR  7D_COLOR  14D_COLOR  30D_COLOR

ATTRIBUTION_FORECAST_PLACEHOLDER
One sentence estimating monthly run-rate based on 30-day data.
Example: "At the current 30-day pace ($X spend, Xx ROAS), Vegamour is on track for approximately $X in attributed revenue this month."

CAMPAIGN_TABLE_PLACEHOLDER
HTML table rows ONLY (no surrounding <table> tags). Up to 8 campaigns sorted by spend descending.
Alternate row backgrounds: odd rows #fff5f0, even rows #ffffff.
Apply the correct ROAS color hex for each campaign row using the same thresholds as GRADE_BG_COLOR.
Row format (alternate backgrounds accordingly):
<tr style="background:#fff5f0;"><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f8e4d8;">[Campaign Name]</td><td style="padding:8px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f8e4d8;">$[Spend]</td><td style="padding:8px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f8e4d8;">$[Revenue]</td><td style="padding:8px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f8e4d8;font-weight:700;color:[ROAS_HEX];">[ROAS]x</td></tr>

SECTION_1_PLACEHOLDER — 1-2 sentences: yesterday's ROAS, spend, and revenue vs the 7-day average
SECTION_2_PLACEHOLDER — 1-2 sentences: 7-day trend direction (improving / declining / stable) with specific numbers
SECTION_3_PLACEHOLDER — 1 sentence: the best-performing campaign yesterday and its ROAS
SECTION_4_PLACEHOLDER — 1 sentence: the weakest campaign or any anomaly to flag
SECTION_5_PLACEHOLDER — 1 sentence: how yesterday's ROAS compares to the 30-day average
SECTION_6_PLACEHOLDER — 1 clear actionable recommendation for today or this week

STEP 3 — Send ONE email (do NOT send multiple):
CRITICAL: Pass the completed HTML DIRECTLY as the body. Do NOT wrap in markdown code fences. Body MUST start with <!DOCTYPE html>.
To: anthony@mellekamarketing.com
CC: bryan@mellekamarketing.com, david@mellekamarketing.com
From: "Melleka AI Strategist <ai@listing.melleka.com>"
Subject: "Vegamour ROAS Brief | [yesterday date] | [ROAS]x | Grade [letter]"
Send email ONLY to the recipients listed above. Do NOT add any additional recipients. Do NOT post to Slack.

STEP 4 — Update last_sent_at:
Call supabase_update on table "auto_client_updates": set last_sent_at = today's date WHERE client_name = "Vegamour - Daily ROAS"

STEP 5 — Log to super_agent_task: "Vegamour ROAS Brief sent for [yesterday date]. Grade [X]. ROAS [X]x."$TASK$;

  -- Inject the actual HTML into the task at the placeholder
  v_task := replace(v_task, '__HTML__', v_html);

  -- Create new system-managed cron job (name starts with "Auto Client Update:" so PATCH handler treats it correctly)
  INSERT INTO team_cron_jobs (member_name, name, cron_expr, task, enabled)
  VALUES (
    'system',
    'Auto Client Update: Vegamour - Daily ROAS',
    '0 8 * * *',
    v_task,
    true
  )
  RETURNING id INTO v_new_id;

  -- Link cron job to auto_client_updates, enable it, and lock recipients to the correct 3 people
  UPDATE auto_client_updates
  SET
    cron_job_id      = v_new_id,
    enabled          = true,
    email_recipients = ARRAY['anthony@mellekamarketing.com', 'bryan@mellekamarketing.com', 'david@mellekamarketing.com'],
    updated_at       = NOW()
  WHERE client_name = 'Vegamour - Daily ROAS';

  RAISE NOTICE 'Created Vegamour Daily ROAS cron job: %', v_new_id;
END;
$$;

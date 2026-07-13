-- Vegamour Daily ROAS Brief — restore attribution forecast, campaign breakdown, and 6-section analysis
-- Updates ONLY: email_design on auto_client_updates, task on team_cron_jobs
-- Does NOT touch: recipients, cron_expr, enabled, grade scale, or dedup logic

DO $DO$
DECLARE
  v_html TEXT;
  v_task TEXT;
BEGIN

-- ── Rose/cream HTML email design ──────────────────────────────────────────────
v_html := $HTML$<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fdf6f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6f0;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- HEADER -->
<tr><td style="background:#8b1a4a;padding:28px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Vegamour ROAS Brief</h1>
<p style="margin:6px 0 0;color:#f5c6d8;font-size:14px;">DATA_DATE_PLACEHOLDER | Prepared by Melleka AI Strategist</p>
</td></tr>

<!-- GRADE BADGE -->
<tr><td style="padding:24px 32px;background:#fef8f5;border-bottom:1px solid #f8e4d8;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;">
<span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Yesterday's Grade</span><br>
<span style="font-size:64px;font-weight:900;color:GRADE_BG_COLOR;line-height:1.1;">GRADE_PLACEHOLDER</span><br>
<span style="font-size:13px;color:#8b6b5a;font-weight:600;">GRADE_LABEL_PLACEHOLDER</span>
</td>
<td align="right" style="vertical-align:middle;">
<span style="background:GRADE_BG_COLOR;color:#fff;padding:10px 22px;border-radius:24px;font-size:20px;font-weight:700;display:inline-block;">YESTERDAY_ROAS</span>
</td>
</tr></table>
</td></tr>

<!-- ATTRIBUTION FORECAST -->
<tr><td style="padding:14px 32px;background:#fef8f5;border-bottom:1px solid #f8e4d8;">
<p style="margin:0 0 5px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">Attribution Forecast</p>
<p style="margin:0;font-size:13px;color:#555;line-height:1.6;">ATTRIBUTION_FORECAST_PLACEHOLDER</p>
</td></tr>

<!-- PERFORMANCE TABLE -->
<tr><td style="padding:24px 32px;">
<h2 style="margin:0 0 14px;color:#8b1a4a;font-size:15px;font-weight:700;">Performance Summary</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr style="background:#8b1a4a;color:#fff;">
<th style="padding:10px 14px;text-align:left;font-size:13px;font-weight:600;">Period</th>
<th style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;">Spend</th>
<th style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;">Revenue</th>
<th style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;">ROAS</th>
</tr>
<tr style="background:#fff5f0;">
<td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f8e4d8;">Yesterday</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;">YESTERDAY_SPEND</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;">YESTERDAY_REV</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;font-weight:700;color:YESTERDAY_COLOR;">YESTERDAY_ROAS</td>
</tr>
<tr style="background:#ffffff;">
<td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f8e4d8;">Last 7 Days</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;">7D_SPEND</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;">7D_REV</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;font-weight:700;color:7D_COLOR;">7D_ROAS</td>
</tr>
<tr style="background:#fff5f0;">
<td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f8e4d8;">Last 14 Days</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;">14D_SPEND</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;">14D_REV</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;border-bottom:1px solid #f8e4d8;font-weight:700;color:14D_COLOR;">14D_ROAS</td>
</tr>
<tr style="background:#ffffff;">
<td style="padding:10px 14px;font-size:13px;">Last 30 Days</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;">30D_SPEND</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;">30D_REV</td>
<td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:30D_COLOR;">30D_ROAS</td>
</tr>
</table>
</td></tr>

<!-- GRADE SCALE -->
<tr><td style="padding:0 32px 24px;">
<p style="margin:0 0 8px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Grade Scale (Target: 3.0x ROAS)</p>
<table cellpadding="0" cellspacing="3"><tr>
<td style="background:#1a7f4b;color:#fff;padding:4px 9px;border-radius:3px;font-size:11px;font-weight:600;">A+ 3.0x+</td>
<td style="background:#2e9e62;color:#fff;padding:4px 9px;border-radius:3px;font-size:11px;font-weight:600;">A 2.7-2.99x</td>
<td style="background:#5cb85c;color:#fff;padding:4px 9px;border-radius:3px;font-size:11px;font-weight:600;">B 2.5-2.69x</td>
<td style="background:#f5a623;color:#fff;padding:4px 9px;border-radius:3px;font-size:11px;font-weight:600;">C 2.0-2.49x</td>
<td style="background:#e67e22;color:#fff;padding:4px 9px;border-radius:3px;font-size:11px;font-weight:600;">D 1.0-1.99x</td>
<td style="background:#e74c3c;color:#fff;padding:4px 9px;border-radius:3px;font-size:11px;font-weight:600;">F below 1x</td>
</tr></table>
</td></tr>

<!-- CAMPAIGN BREAKDOWN -->
<tr><td style="padding:0 32px 24px;">
<h2 style="margin:0 0 12px;color:#8b1a4a;font-size:15px;font-weight:700;">Campaign Breakdown — Yesterday</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr style="background:#8b1a4a;color:#fff;">
<th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;">Campaign</th>
<th style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;">Spend</th>
<th style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;">Revenue</th>
<th style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;">ROAS</th>
</tr>
CAMPAIGN_TABLE_PLACEHOLDER
</table>
</td></tr>

<!-- STRATEGIST ANALYSIS - 6 SECTIONS -->
<tr><td style="padding:0 32px 28px;">
<h2 style="margin:0 0 16px;color:#8b1a4a;font-size:15px;font-weight:700;">Strategist Analysis</h2>

<div style="border-left:4px solid #8b1a4a;padding:10px 16px;background:#fef8f5;border-radius:0 4px 4px 0;margin-bottom:10px;">
<p style="margin:0 0 3px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">1. Yesterday Performance</p>
<p style="margin:0;font-size:13px;color:#333;line-height:1.6;">SECTION_1_PLACEHOLDER</p>
</div>

<div style="border-left:4px solid #8b1a4a;padding:10px 16px;background:#fef8f5;border-radius:0 4px 4px 0;margin-bottom:10px;">
<p style="margin:0 0 3px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">2. 7-Day Trend</p>
<p style="margin:0;font-size:13px;color:#333;line-height:1.6;">SECTION_2_PLACEHOLDER</p>
</div>

<div style="border-left:4px solid #8b1a4a;padding:10px 16px;background:#fef8f5;border-radius:0 4px 4px 0;margin-bottom:10px;">
<p style="margin:0 0 3px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">3. Top Performer</p>
<p style="margin:0;font-size:13px;color:#333;line-height:1.6;">SECTION_3_PLACEHOLDER</p>
</div>

<div style="border-left:4px solid #8b1a4a;padding:10px 16px;background:#fef8f5;border-radius:0 4px 4px 0;margin-bottom:10px;">
<p style="margin:0 0 3px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">4. Concern / Underperformer</p>
<p style="margin:0;font-size:13px;color:#333;line-height:1.6;">SECTION_4_PLACEHOLDER</p>
</div>

<div style="border-left:4px solid #8b1a4a;padding:10px 16px;background:#fef8f5;border-radius:0 4px 4px 0;margin-bottom:10px;">
<p style="margin:0 0 3px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">5. 30-Day Context</p>
<p style="margin:0;font-size:13px;color:#333;line-height:1.6;">SECTION_5_PLACEHOLDER</p>
</div>

<div style="border-left:4px solid #8b1a4a;padding:10px 16px;background:#fef8f5;border-radius:0 4px 4px 0;">
<p style="margin:0 0 3px;font-size:11px;font-weight:700;text-transform:uppercase;color:#8b1a4a;letter-spacing:0.5px;">6. Recommendation</p>
<p style="margin:0;font-size:13px;color:#333;line-height:1.6;">SECTION_6_PLACEHOLDER</p>
</div>

</td></tr>

<!-- FOOTER -->
<tr><td style="background:#8b1a4a;padding:16px 32px;text-align:center;">
<p style="margin:0;color:#f5c6d8;font-size:12px;">Generated by Melleka AI Strategist | Melleka Marketing</p>
</td></tr>

</table>
</td></tr></table>
</body></html>$HTML$;

-- ── Cron job task text ─────────────────────────────────────────────────────────
-- Fill instructions are placed AFTER the HTML template so they stay in context
v_task := $TASK$VEGAMOUR DAILY ROAS BRIEF — DUPLICATE PREVENTION IS MANDATORY

FORBIDDEN TOOLS — do not call under any circumstances:
slack_post: FORBIDDEN. This job sends ONE EMAIL only. No Slack. No exceptions.
slack_history: FORBIDDEN.

STEP 0 — DEDUP CHECK (do this before anything else):
1. supabase_query on table "strategist_config" where config_key = "vegamour_roas_brief_last_sent"
2. get_current_date — then subtract 1 day to get yesterday's date (YYYY-MM-DD)
3. If config_value already equals yesterday's date: log "Already sent today" and STOP immediately.
4. If not: proceed to STEP 1.

STEP 1 — Pull Google Ads data (account 7567846915, ENABLED campaigns only):
A. Yesterday totals: SUM(conversions_value), SUM(cost_micros/1000000). Compute ROAS = revenue / spend.
B. Last 7 Days totals: same computation.
C. Last 14 Days totals: same computation.
D. Last 30 Days totals: same computation.
E. Campaign breakdown for yesterday: per-campaign name, spend, revenue, ROAS. ENABLED campaigns only. Sort by spend descending. Take up to 8 campaigns.

STEP 2 — Fill the HTML template below. Replace ONLY the placeholder tokens — do NOT change any HTML structure, colors, or styling. The fill instructions for every placeholder are listed AFTER the HTML.

HTML TEMPLATE:
__HTML_GOES_HERE__

== PLACEHOLDER FILL INSTRUCTIONS ==
Read these after the HTML above and fill every placeholder before sending.

DATA_DATE_PLACEHOLDER
Replace with yesterday's full date, e.g. "Tuesday, July 8, 2026"

GRADE_BG_COLOR — use the hex color matching yesterday's ROAS (TARGET IS 3.0x):
  A+ = 3.0x or above  → #1a7f4b
  A  = 2.7x to 2.99x  → #2e9e62
  B  = 2.5x to 2.69x  → #5cb85c
  C  = 2.0x to 2.49x  → #f5a623
  D  = 1.0x to 1.99x  → #e67e22
  F  = below 1.0x     → #e74c3c

GRADE_PLACEHOLDER — grade letter only: A+, A, B, C, D, or F

GRADE_LABEL_PLACEHOLDER — short label, e.g. "A+ — Exceeds Target (3.0x+)" or "C — Below Target (2.0-2.49x)"

ROAS display placeholders (include the "x" suffix in the value, e.g. "2.84x"):
  YESTERDAY_ROAS → e.g. "2.84x"
  7D_ROAS        → e.g. "2.71x"
  14D_ROAS       → e.g. "2.65x"
  30D_ROAS       → e.g. "2.58x"

Spend/Revenue placeholders (include "$" and commas, e.g. "$1,234.56"):
  YESTERDAY_SPEND, YESTERDAY_REV
  7D_SPEND, 7D_REV
  14D_SPEND, 14D_REV
  30D_SPEND, 30D_REV

ROAS color placeholders (hex code based on that window's ROAS — same thresholds as grade above):
  YESTERDAY_COLOR, 7D_COLOR, 14D_COLOR, 30D_COLOR

ATTRIBUTION_FORECAST_PLACEHOLDER
One sentence estimating monthly run-rate based on 30-day data. Example: "At the current 30-day pace ($X spend, Xx ROAS), Vegamour is on track for approximately $X in attributed revenue this month."

CAMPAIGN_TABLE_PLACEHOLDER
HTML table rows ONLY — no surrounding table tags. Up to 8 campaigns sorted by spend. Alternate row backgrounds: odd rows background #fff5f0, even rows #ffffff. Apply the correct ROAS color for each row using the same thresholds. Format each row exactly as:
<tr style="background:#fff5f0;"><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f8e4d8;">CAMPAIGN NAME</td><td style="padding:8px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f8e4d8;">$SPEND</td><td style="padding:8px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f8e4d8;">$REVENUE</td><td style="padding:8px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f8e4d8;font-weight:700;color:ROAS_COLOR;">ROASx</td></tr>

SECTION_1_PLACEHOLDER — 1-2 sentences: yesterday's key numbers (ROAS, spend, revenue) vs 7-day average
SECTION_2_PLACEHOLDER — 1-2 sentences: 7-day trend direction (improving / declining / stable) with numbers
SECTION_3_PLACEHOLDER — 1 sentence: which campaign performed best yesterday and its ROAS
SECTION_4_PLACEHOLDER — 1 sentence: which campaign underperformed or any anomaly to flag
SECTION_5_PLACEHOLDER — 1 sentence: how yesterday ROAS compares to the 30-day average
SECTION_6_PLACEHOLDER — 1 clear actionable recommendation for today or this week

STEP 3 — Send email with the fully filled HTML:
CRITICAL: Pass the completed HTML DIRECTLY as the body. Do NOT wrap in markdown code fences. Body MUST start with <!DOCTYPE html>.
To: anthony@mellekamarketing.com
CC: bryan@mellekamarketing.com, david@mellekamarketing.com
From: "Melleka AI Strategist <ai@listing.melleka.com>"
Subject: "Vegamour ROAS Brief | [yesterday date] | [ROAS]x | Grade [letter]"

STEP 4 — Update dedup immediately after email sends:
supabase_update on table "strategist_config": set config_value = "[yesterday YYYY-MM-DD]" WHERE config_key = "vegamour_roas_brief_last_sent"

STEP 5 — Log to super_agent_task: "Vegamour ROAS Brief sent for [yesterday date]. Grade [X]. ROAS [X]x."$TASK$;

-- Inject the HTML into the task at the placeholder
v_task := replace(v_task, '__HTML_GOES_HERE__', v_html);

-- ── Apply updates ──────────────────────────────────────────────────────────────

-- Update the locked HTML design on the auto_client_updates row
UPDATE auto_client_updates
SET
  email_design        = v_html,
  email_design_locked = true,
  template_notes      = 'Daily ROAS brief. Grade scale: A+=3.0x+, A=2.7-2.99x, B=2.5-2.69x, C=2.0-2.49x, D=1.0-1.99x, F=below 1x. Includes attribution forecast, campaign breakdown, and 6-section strategist analysis.',
  updated_at          = NOW()
WHERE client_name = 'Vegamour - Daily ROAS';

-- Update the cron job task (Vegamour Daily ROAS Brief only — never touch other cron jobs)
UPDATE team_cron_jobs
SET task = v_task
WHERE id = '6c2f2c97-1c48-4898-94ed-60c3c15a1189';

END $DO$;

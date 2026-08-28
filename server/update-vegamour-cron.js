const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

const newTask = `VEGAMOUR DAILY PERFORMANCE BRIEF — DUPLICATE PREVENTION IS MANDATORY

STEP 0 — DEDUP CHECK (DO THIS FIRST, EVERY TIME):
1. Call supabase_query on table "strategist_config" with filter: config_key = "vegamour_daily_brief_last_sent"
2. Call get_current_date to get today's date (YYYY-MM-DD)
3. Determine yesterday's date = today minus 1 day (YYYY-MM-DD) — this is the data date the brief covers
4. If config_value equals yesterday's date: brief was ALREADY SENT for this data date. Log to super_agent_task and STOP IMMEDIATELY.
5. If config_value does not equal yesterday's date: PROCEED to Step 1.

STEP 1 — Pull Google Ads data (Account: 7567846915, ENABLED campaigns only):

PRIMARY METRIC: NCAC (New Customer Acquisition Cost) = total_spend / new_customer_conversions
SECONDARY METRIC: ROAS = conversions_value / spend * 100 (expressed as a percentage, e.g. "312%")

CRITICAL — THE NCAC HTML TEMPLATE MUST ALWAYS BE USED REGARDLESS OF DATA AVAILABILITY. Even if NCAC cannot be calculated, you MUST still use the NCAC template below and show "N/A" for NCAC fields. NEVER revert to a different email format or structure.

NCAC DATA PULL — USE TWO SEPARATE QUERIES (the API cannot combine cost_micros and new_versus_returning_customers in one query):

Query A — Spend (for each window): Pull campaign.name, metrics.cost_micros, metrics.conversions_value from campaign, filtered by campaign.status = 'ENABLED' and date range. Do NOT include segments.new_versus_returning_customers in this query.

Query B — New customer conversions (for each window): Pull metrics.conversions from campaign, filtered by campaign.status = 'ENABLED', date range, AND segments.new_versus_returning_customers = 'NEW'. Do NOT include metrics.cost_micros in this query.

NCAC = Query_A_total_spend / Query_B_total_new_customer_conversions

If Query B returns 0 conversions for a period, show NCAC = "N/A" for that period. Do NOT abandon the NCAC template.

Pull for all 4 windows (ENABLED campaigns only):
- Yesterday (1 day)
- Last 7 Days
- Last 14 Days
- Last 30 Days

For each window compute:
- total_spend: SUM(cost_micros) / 1,000,000 from Query A
- new_customer_conv: SUM(conversions) from Query B (new_versus_returning = NEW)
- ncac: total_spend / new_customer_conv (format: "$XX.XX"; if new_customer_conv = 0, show "N/A")
- revenue: SUM(conversions_value) from Query A
- roas_pct: (revenue / total_spend) * 100 (format: "XXX%")

Campaign-level breakdown (yesterday window only, ENABLED campaigns):
- Per campaign: name, spend (from Query A), new_customer_conv (from Query B matched by campaign), ncac, revenue, roas_pct
- Sort by spend descending

5-day daily trend (the 5 days ending on yesterday, listed oldest to newest):
- Per day: date (format "Mon DD"), spend, new_customer_conv (from Query B), ncac, roas_pct

STEP 2 — Build the HTML email using this EXACT template. Replace every [PLACEHOLDER] with real data. Do not change styling, colors, or structure.

PLACEHOLDER KEY:
- [BRIEF_DATE] = yesterday formatted as "Month DD, YYYY" (e.g. "August 17, 2026")
- [DATE_SHORT] = yesterday formatted as "Mon DD" (e.g. "Aug 17")
- [YDAY_NCAC], [YDAY_SPEND], [YDAY_NC] = yesterday NCAC/spend/new-customers
- [D7_NCAC], [D7_SPEND], [D7_NC] = 7-day NCAC/spend/new-customers
- [D14_NCAC], [D14_SPEND], [D14_NC] = 14-day NCAC/spend/new-customers
- [D30_NCAC], [D30_SPEND], [D30_NC] = 30-day NCAC/spend/new-customers
- [ROAS_ROWS] = 4 table rows (Yesterday / 7-Day / 14-Day / 30-Day) — see row format below
- [CAMPAIGN_ROWS] = one row per campaign — see row format below
- [INSIGHT_CARDS] = 3 to 5 insight cards — see card format below
- [TREND_ROWS] = 5 daily trend rows — see row format below
- [ATTRIBUTION_NOTE] = 1 to 2 sentences about attribution window, data freshness, or overnight conversion sealing

ROAS row format (alternate background: row 0,2 = #FFFFFF, row 1,3 = #F9FAFB):
<tr><td style="padding:11px 14px;font-size:12px;font-weight:600;color:#374151;background:[ROW_BG];border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">[PERIOD]</td><td style="padding:11px 14px;font-size:12px;color:#6B7280;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[SPEND]</td><td style="padding:11px 14px;font-size:12px;color:#6B7280;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[REVENUE]</td><td style="padding:11px 14px;font-size:13px;font-weight:700;color:[ROAS_COLOR];background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[ROAS_PCT]</td></tr>

Campaign row format (alternate background same as above):
<tr><td style="padding:11px 14px;font-size:12px;color:#374151;background:[ROW_BG];border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">[CAMPAIGN_NAME]</td><td style="padding:11px 14px;font-size:12px;color:#6B7280;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[SPEND]</td><td style="padding:11px 14px;font-size:12px;color:#374151;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[NEW_CUST]</td><td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111827;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[NCAC]</td><td style="padding:11px 14px;font-size:12px;color:#6B7280;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[REVENUE]</td><td style="padding:11px 14px;font-size:13px;font-weight:700;color:[ROAS_COLOR];background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[ROAS_PCT]</td></tr>

Trend row format (alternate background same as above):
<tr><td style="padding:10px 14px;font-size:12px;color:#374151;background:[ROW_BG];border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">[DATE]</td><td style="padding:10px 14px;font-size:12px;color:#6B7280;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[SPEND]</td><td style="padding:10px 14px;font-size:12px;color:#374151;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[NEW_CUST]</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[NCAC]</td><td style="padding:10px 14px;font-size:12px;font-weight:600;color:[ROAS_COLOR];background:[ROW_BG];border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">[ROAS_PCT]</td></tr>

Insight card format (use 3 to 5 cards; accent colors: #D97706 orange, #15803D green, #DC2626 red, #7C3AED purple, #0284C7 blue):
<tr><td style="padding:0 0 10px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="3" style="background:[COLOR];border-radius:3px 0 0 3px;">&nbsp;</td><td style="background:#FFFFFF;padding:14px 18px;border:1px solid #E5E5E0;border-left:none;border-radius:0 6px 6px 0;"><p style="margin:0 0 5px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">[INSIGHT_TITLE]</p><p style="margin:0;font-size:12px;color:#4B5563;line-height:1.65;font-family:Arial,sans-serif;">[INSIGHT_BODY]</p></td></tr></table></td></tr>

ROAS color rules: >=300% = #15803D, 200-299% = #1D4ED8, 100-199% = #C2410C, <100% = #DC2626

--- HTML TEMPLATE START ---

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Vegamour Performance Brief — [DATE_SHORT]</title>
<style>
body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0;mso-table-rspace:0;}
</style>
</head>
<body style="margin:0;padding:0;background:#EEEEE8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEEEE8">
<tr><td align="center" style="padding:24px 10px 40px;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;">

  <!-- Header -->
  <tr><td style="background:#2D6741;border-radius:8px 8px 0 0;padding:28px 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">VEGAMOUR</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.65);font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">Google Ads Performance Brief</p>
        </td>
        <td align="right">
          <p style="margin:0 0 2px;font-size:10px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;text-align:right;">Prepared by</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);font-family:Arial,sans-serif;text-align:right;">Melleka Marketing</p>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:26px;font-weight:800;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">Performance Report &mdash; [BRIEF_DATE]</p>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.65);font-family:Arial,sans-serif;">Enabled campaigns only &nbsp;&bull;&nbsp; Account 7567846915</p>
  </td></tr>

  <!-- NCAC Overview (Primary) -->
  <tr><td style="background:#FAFAF8;padding:20px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">New Customer Acquisition Cost (NCAC)</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <!-- Yesterday NCAC -->
        <td width="25%" style="padding:0 5px 0 0;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
            <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
              <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">Yesterday</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">[YDAY_NCAC]</p>
              <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">[YDAY_SPEND]</strong></p>
              <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">[YDAY_NC]</strong></p>
            </td></tr>
          </table>
        </td>
        <!-- 7-Day NCAC -->
        <td width="25%" style="padding:0 5px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
            <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
              <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">7-Day</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">[D7_NCAC]</p>
              <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">[D7_SPEND]</strong></p>
              <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">[D7_NC]</strong></p>
            </td></tr>
          </table>
        </td>
        <!-- 14-Day NCAC -->
        <td width="25%" style="padding:0 5px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
            <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
              <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">14-Day</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">[D14_NCAC]</p>
              <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">[D14_SPEND]</strong></p>
              <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">[D14_NC]</strong></p>
            </td></tr>
          </table>
        </td>
        <!-- 30-Day NCAC -->
        <td width="25%" style="padding:0 0 0 5px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
            <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
              <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">30-Day</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">[D30_NCAC]</p>
              <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">[D30_SPEND]</strong></p>
              <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">[D30_NC]</strong></p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ROAS Summary (Secondary) -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#6B7280;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #D1D5DB;padding-bottom:8px;display:inline-block;">ROAS Summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Period</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Revenue</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
      </tr>
      [ROAS_ROWS]
    </table>
  </td></tr>

  <!-- Campaign Breakdown -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">Campaign Breakdown &mdash; [DATE_SHORT]</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Campaign</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">New Cust.</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">NCAC</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Revenue</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
      </tr>
      [CAMPAIGN_ROWS]
    </table>
  </td></tr>

  <!-- Key Insights -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">Key Insights &mdash; [DATE_SHORT]</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      [INSIGHT_CARDS]
    </table>
  </td></tr>

  <!-- 5-Day Trend -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#6B7280;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #D1D5DB;padding-bottom:8px;display:inline-block;">5-Day Trend</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Date</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">New Cust.</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">NCAC</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
      </tr>
      [TREND_ROWS]
    </table>
  </td></tr>

  <!-- Attribution Note -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 20px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="3" style="background:#2563EB;border-radius:3px 0 0 3px;">&nbsp;</td>
            <td style="background:#FFFFFF;padding:14px 18px;border:1px solid #E5E5E0;border-left:none;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 5px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">Attribution Note</p>
              <p style="margin:0;font-size:12px;color:#4B5563;line-height:1.65;font-family:Arial,sans-serif;">[ATTRIBUTION_NOTE]</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer (download button inserted above this by STEP 4) -->
  <tr><td style="background:#2D6741;padding:24px 32px;border-radius:0 0 8px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#FFFFFF;font-family:Arial,sans-serif;">Melleka Marketing</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:Arial,sans-serif;">Prepared for Vegamour &nbsp;&bull;&nbsp; <a href="https://melleka.com" style="color:rgba(255,255,255,0.55);text-decoration:none;">melleka.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>

--- HTML TEMPLATE END ---

STEP 3 — Save brief for PDF download (do this BEFORE sending the email):
Call save_vegamour_brief with:
- html: the complete HTML from Step 2 (all placeholders replaced)
- token: "daily-{yesterday YYYY-MM-DD}" (e.g. "daily-2026-08-17")
The tool returns the public download URL.

STEP 4 — Insert download button then send:
Insert this row immediately before the footer row (the <tr> containing background:#2D6741):
<tr><td style="padding:16px 32px;text-align:center;background:#FAFAF8;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;"><a href="[URL from Step 3]" style="display:inline-block;background:#2D6741;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;font-family:Arial,sans-serif;">&#x2193; Download PDF</a></td></tr>

Then call send_vegamour_brief_email with:
- subject: "Vegamour Performance Brief | [BRIEF_DATE] | NCAC (7-Day): [D7_NCAC] | ROAS (7-Day): [D7_ROAS_PCT]"
- html: the complete updated HTML (with download button included)

STEP 5 — Update dedup flag after successful send:
Call supabase_update on table "strategist_config": config_key = "vegamour_daily_brief_last_sent", config_value = "{yesterday YYYY-MM-DD}"

STEP 6 — Log completion to super_agent_task with a summary: date covered, 7-day NCAC, 7-day ROAS, recipient count.

CRITICAL RULES:
- Never skip Step 0. If already sent for this data date, STOP.
- Never send more than ONE email per data date.
- Always use send_vegamour_brief_email (recipients are managed server-side, do not hard-code email addresses).
- If NCAC data is unavailable (no new customer tracking found), set all NCAC values to "N/A" and include an insight card noting the data gap. Still send the brief with ROAS data.`;

sb.from('team_cron_jobs')
  .update({ task: newTask })
  .eq('id', 'fb41a565-bf2d-40c7-84fd-8bef0df1a602')
  .then(({ error }) => {
    if (error) console.error('ERROR updating cron task:', error.message);
    else console.log('Cron task updated successfully');
  });

// Seed new dedup key (ignoreDuplicates so it never overwrites a real date)
sb.from('strategist_config')
  .upsert({ config_key: 'vegamour_daily_brief_last_sent', config_value: '2000-01-01' }, { onConflict: 'config_key', ignoreDuplicates: true })
  .then(({ error }) => {
    if (error) console.error('Seed error:', error.message);
    else console.log('Dedup row seeded (or already existed)');
  });

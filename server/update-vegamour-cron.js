const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

const newTask = `VEGAMOUR DAILY ROAS BRIEF — DUPLICATE PREVENTION IS MANDATORY

STEP 0 — DEDUP CHECK (DO THIS FIRST):
1. Call supabase_query on table "strategist_config" with filter: config_key = "vegamour_roas_brief_last_sent"
2. Call get_current_date to get today's date
3. Calculate "yesterday" (the data date this brief covers)
4. If config_value == yesterday's date (YYYY-MM-DD), brief was ALREADY SENT. Log to super_agent_task and STOP. EXIT IMMEDIATELY.
5. If config_value != yesterday's date, PROCEED to Step 1.

STEP 1 — Pull Vegamour Google Ads data:
- Account: 7567846915
- Filter: campaign.status = 'ENABLED' ONLY
- 4 date windows: Yesterday, 7-Day, 14-Day, 30-Day
- ROAS = SUM(conversions_value) / SUM(cost_micros / 1000000) for ENABLED campaigns only

STEP 2 — Build HTML email using this EXACT locked design template. Do NOT change the styling, colors, or layout. Only fill in the data values:

<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vegamour ROAS Brief</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <tr><td style="background:#2d1b4e;padding:32px 40px;text-align:center;">
    <div style="font-size:13px;color:#c9b8e8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">MELLEKA AI STRATEGIST</div>
    <div style="font-size:26px;font-weight:700;color:#fff;">Vegamour ROAS Brief</div>
    <div style="font-size:14px;color:#c9b8e8;margin-top:6px;">DATA_DATE_PLACEHOLDER — Yesterday Performance</div>
  </td></tr>
  <tr><td style="background:GRADE_BG_COLOR;padding:20px 40px;text-align:center;">
    <span style="font-size:48px;font-weight:900;color:#fff;letter-spacing:-2px;">GRADE_PLACEHOLDER</span>
    <span style="font-size:16px;color:rgba(255,255,255,0.85);margin-left:12px;">GRADE_LABEL_PLACEHOLDER</span>
  </td></tr>
  <tr><td style="padding:32px 40px 8px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px;">ROAS PERFORMANCE</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr style="background:#f8f6ff;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">Period</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">Spend</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">Revenue</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">ROAS</th>
      </tr>
      <tr>
        <td style="padding:12px 14px;font-size:14px;font-weight:600;color:#2d1b4e;border-bottom:1px solid #f0eaf8;">Yesterday</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">YESTERDAY_SPEND</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">YESTERDAY_REV</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:YESTERDAY_COLOR;border-bottom:1px solid #f0eaf8;">YESTERDAY_ROAS</td>
      </tr>
      <tr style="background:#fafaf9;">
        <td style="padding:12px 14px;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">7-Day</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">7D_SPEND</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">7D_REV</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:7D_COLOR;border-bottom:1px solid #f0eaf8;">7D_ROAS</td>
      </tr>
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">14-Day</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">14D_SPEND</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;border-bottom:1px solid #f0eaf8;">14D_REV</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:14D_COLOR;border-bottom:1px solid #f0eaf8;">14D_ROAS</td>
      </tr>
      <tr style="background:#fafaf9;">
        <td style="padding:12px 14px;font-size:14px;color:#444;">30-Day</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;">30D_SPEND</td>
        <td style="padding:12px 14px;text-align:right;font-size:14px;color:#444;">30D_REV</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:30D_COLOR;">30D_ROAS</td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 40px 8px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">GRADE SCALE (Yesterday ROAS)</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#1a7f4b;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;border-radius:4px 0 0 4px;">A+<br><span style="font-size:10px;font-weight:400;">5x+</span></td>
        <td style="background:#2e9e62;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;">A<br><span style="font-size:10px;font-weight:400;">4-5x</span></td>
        <td style="background:#5cb85c;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;">B+<br><span style="font-size:10px;font-weight:400;">3.5-4x</span></td>
        <td style="background:#8bc34a;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;">B<br><span style="font-size:10px;font-weight:400;">3-3.5x</span></td>
        <td style="background:#f5a623;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;">C<br><span style="font-size:10px;font-weight:400;">2.5-3x</span></td>
        <td style="background:#e67e22;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;">D<br><span style="font-size:10px;font-weight:400;">2-2.5x</span></td>
        <td style="background:#e74c3c;color:#fff;text-align:center;padding:8px 4px;font-size:12px;font-weight:700;border-radius:0 4px 4px 0;">F<br><span style="font-size:10px;font-weight:400;">below 2x</span></td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 40px 32px;">
    <div style="background:#f8f6ff;border-left:4px solid #7c5cbf;border-radius:0 8px 8px 0;padding:16px 20px;">
      <div style="font-size:12px;font-weight:700;color:#2d1b4e;margin-bottom:6px;">STRATEGIST NOTES</div>
      <div style="font-size:13px;color:#444;line-height:1.6;">NOTES_PLACEHOLDER</div>
    </div>
  </td></tr>
  <tr><td style="background:#f8f6ff;padding:16px 40px;text-align:center;border-top:1px solid #e8e0f5;">
    <div style="font-size:11px;color:#999;">Generated by Melleka AI Strategist — Internal Only. Do not forward.</div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>

ROAS color rules: 4x+ = #1a7f4b, 3-4x = #5cb85c, 2-3x = #f5a623, below 2x = #e74c3c.
Grade + color: A+(5x+)=#1a7f4b, A(4-5x)=#2e9e62, B+(3.5-4x)=#5cb85c, B(3-3.5x)=#8bc34a, C(2.5-3x)=#f5a623, D(2-2.5x)=#e67e22, F(below 2x)=#e74c3c.

STEP 3 — Send ONE email to all recipients. Use a single send_email call with:
To: anthony@mellekamarketing.com
CC: bryan@mellekamarketing.com, david@mellekamarketing.com, kevin@xy7elite.com, accountmanager@mellekamarketing.com, garetth@vegamour.com, chrisondatje@gmail.com
From: "Melleka AI Strategist <ai@listing.melleka.com>"
Subject: "Vegamour ROAS Brief | {Date} | {ROAS}x | Grade {X}"
Do NOT send 7 separate emails. ONE email, everyone on CC.

STEP 4 — After successful send, update dedup flag:
supabase_update on table "strategist_config": config_key = "vegamour_roas_brief_last_sent", config_value = "{yesterday YYYY-MM-DD}"

STEP 5 — Log completion to super_agent_task.

CRITICAL: Never skip Step 0. If already sent for this date, STOP. Never send more than one email per data date.`;

sb.from('team_cron_jobs')
  .update({ task: newTask })
  .eq('id', '6c2f2c97-1c48-4898-94ed-60c3c15a1189')
  .then(({ error }) => {
    if (error) console.error('ERROR:', error.message);
    else console.log('Cron task updated successfully');
  });

sb.from('strategist_config')
  .upsert({ config_key: 'vegamour_roas_brief_last_sent', config_value: '2000-01-01' }, { onConflict: 'config_key', ignoreDuplicates: true })
  .then(({ error }) => {
    if (error) console.error('Seed error:', error.message);
    else console.log('Dedup row seeded (or already existed)');
  });

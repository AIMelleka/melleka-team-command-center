const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://nhebotmrnxixvcvtspet.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxMDc5NywiZXhwIjoyMDg3OTg2Nzk3fQ.0X9qSWeoyewKUHxBksHq_EFBXQ_aQL6CXV_XdMflcK4'
);

const weeklyTask = String.raw`VEGAMOUR WEEKLY ROLL-UP — THURSDAY MORNING RECAP

STEP 0 — DEDUP CHECK (DO THIS FIRST, EVERY TIME):
1. Call supabase_query on table "strategist_config" with filter: config_key = "vegamour_weekly_rollup_last_sent"
2. Call get_current_date to get today's date
3. Calculate the most recent completed Monday-Sunday week (the Sunday that just passed)
4. If config_value == that Sunday's date (YYYY-MM-DD), roll-up was ALREADY SENT. Log to super_agent_task and STOP. EXIT IMMEDIATELY.
5. If config_value != that Sunday's date, PROCEED to Step 1.

STEP 1 — Pull Google Ads data for TWO full Mon-Sun weeks:
- Account: 7567846915
- Filter: campaign.status = 'ENABLED' ONLY
- ROAS = SUM(conversions_value) / SUM(cost_micros / 1000000) for ENABLED campaigns only
- THIS WEEK = most recently completed Monday through Sunday
- PRIOR WEEK = the Monday through Sunday before that
- Pull campaign-level breakdown for both weeks (name, spend, revenue, ROAS, conversions)

STEP 2 — Pull supporting data in parallel:
- Notion tasks completed this week (notion_query_tasks for the THIS WEEK date range)
- Google Ads change history for this week (change_event for THIS WEEK date range, account 7567846915)

STEP 3 — Compute and grade the numbers:
- THIS WEEK ROAS % = (this_week_revenue / this_week_spend) x 100
- PRIOR WEEK ROAS % = (prior_week_revenue / prior_week_spend) x 100
- WoW ROAS change = this_week_roas - prior_week_roas (show as + or -)
- WoW Spend change, Revenue change, Conversion change, CPA change
- Grade THIS WEEK ROAS using: A+(500%+), A(400-500%), B+(350-400%), B(300-350%), C(250-300%), D(200-250%), F(below 200%)
- Grade colors: A+(#1a7f4b), A(#2e9e62), B+(#5cb85c), B(#8bc34a), C(#f5a623), D(#e67e22), F(#e74c3c)
- Target = 300% ROAS. Calculate progress bar fill % = MIN(this_week_roas / 300 * 100, 100)
- Sort campaigns best-to-worst by ROAS for the campaign table

STEP 4 — Build the HTML email using this EXACT locked structure. Do NOT change colors, layout, or fonts. Only fill in the data:

<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vegamour Weekly Roll-Up</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="background:#2d1b4e;padding:32px 40px;text-align:center;">
    <div style="font-size:13px;color:#c9b8e8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">MELLEKA AI STRATEGIST</div>
    <div style="font-size:26px;font-weight:700;color:#fff;">Vegamour Weekly Roll-Up</div>
    <div style="font-size:14px;color:#c9b8e8;margin-top:6px;">{{WEEK_RANGE}} — Thursday Morning Recap</div>
  </td></tr>

  <!-- GRADE BAND -->
  <tr><td style="background:{{GRADE_COLOR}};padding:20px 40px;text-align:center;">
    <span style="font-size:48px;font-weight:900;color:#fff;letter-spacing:-2px;">{{GRADE}}</span>
    <span style="font-size:16px;color:rgba(255,255,255,0.85);margin-left:12px;">{{GRADE_LABEL}} — {{THIS_WEEK_ROAS}}% ROAS</span>
  </td></tr>

  <!-- EXECUTIVE SUMMARY -->
  <tr><td style="padding:28px 40px 16px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">EXECUTIVE SUMMARY</div>
    <div style="font-size:14px;color:#333;line-height:1.7;background:#f8f6ff;border-left:4px solid #7c5cbf;border-radius:0 8px 8px 0;padding:16px 20px;">{{EXEC_SUMMARY}}</div>
  </td></tr>

  <!-- WEEKLY ROAS vs TARGET -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px;">WEEKLY ROAS vs 300% TARGET</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="background:#f8f6ff;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">This Week</div>
          <div style="font-size:36px;font-weight:900;color:{{THIS_WEEK_COLOR}};">{{THIS_WEEK_ROAS}}%</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">\\${{THIS_WEEK_SPEND}} spend → \\${{THIS_WEEK_REVENUE}} revenue</div>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#f8f6ff;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Prior Week</div>
          <div style="font-size:36px;font-weight:900;color:{{PRIOR_WEEK_COLOR}};">{{PRIOR_WEEK_ROAS}}%</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">\\${{PRIOR_WEEK_SPEND}} spend → \\${{PRIOR_WEEK_REVENUE}} revenue</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:6px;">
        <span>Progress to 300% Target</span>
        <span>{{THIS_WEEK_ROAS}}% / 300%</span>
      </div>
      <div style="background:#e8e0f5;border-radius:99px;height:10px;overflow:hidden;">
        <div style="background:{{GRADE_COLOR}};height:10px;border-radius:99px;width:{{PROGRESS_PCT}}%;max-width:100%;"></div>
      </div>
    </div>
  </td></tr>

  <!-- WEEK-OVER-WEEK COMPARISON -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">WEEK-OVER-WEEK COMPARISON</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr style="background:#f8f6ff;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">Metric</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">This Week</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">Prior Week</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;border-bottom:2px solid #e8e0f5;">Change</th>
      </tr>
      <tr><td style="padding:10px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">Spend</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">\\${{THIS_WEEK_SPEND}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">\\${{PRIOR_WEEK_SPEND}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:{{SPEND_CHANGE_COLOR}};border-bottom:1px solid #f0eaf8;">{{SPEND_CHANGE}}</td></tr>
      <tr style="background:#fafaf9;"><td style="padding:10px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">Revenue</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">\\${{THIS_WEEK_REVENUE}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">\\${{PRIOR_WEEK_REVENUE}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:{{REVENUE_CHANGE_COLOR}};border-bottom:1px solid #f0eaf8;">{{REVENUE_CHANGE}}</td></tr>
      <tr><td style="padding:10px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">ROAS</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:{{THIS_WEEK_COLOR}};border-bottom:1px solid #f0eaf8;">{{THIS_WEEK_ROAS}}%</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:{{PRIOR_WEEK_COLOR}};border-bottom:1px solid #f0eaf8;">{{PRIOR_WEEK_ROAS}}%</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:{{ROAS_CHANGE_COLOR}};border-bottom:1px solid #f0eaf8;">{{ROAS_CHANGE}}</td></tr>
      <tr style="background:#fafaf9;"><td style="padding:10px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">Conversions</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">{{THIS_WEEK_CONV}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;border-bottom:1px solid #f0eaf8;">{{PRIOR_WEEK_CONV}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:{{CONV_CHANGE_COLOR}};border-bottom:1px solid #f0eaf8;">{{CONV_CHANGE}}</td></tr>
      <tr><td style="padding:10px 12px;font-size:13px;color:#333;">CPA</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;">\\${{THIS_WEEK_CPA}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;">\\${{PRIOR_WEEK_CPA}}</td><td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:{{CPA_CHANGE_COLOR}};">{{CPA_CHANGE}}</td></tr>
    </table>
    <div style="font-size:11px;color:#999;margin-top:8px;">Green = improvement. Red = decline. For CPA, lower is better (green = decrease).</div>
  </td></tr>

  <!-- WINS THIS WEEK -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">WINS THIS WEEK</div>
    <div style="font-size:13px;color:#333;line-height:1.8;">{{WINS_LIST}}</div>
  </td></tr>

  <!-- WORK COMPLETED (from Notion) -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">WORK COMPLETED</div>
    <div style="font-size:13px;color:#333;line-height:1.8;">{{NOTION_TASKS}}</div>
  </td></tr>

  <!-- CAMPAIGN PERFORMANCE TABLE -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">CAMPAIGN PERFORMANCE (This Week, best to worst)</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr style="background:#f8f6ff;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#666;border-bottom:2px solid #e8e0f5;">Campaign</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#666;border-bottom:2px solid #e8e0f5;">Spend</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#666;border-bottom:2px solid #e8e0f5;">Revenue</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#666;border-bottom:2px solid #e8e0f5;">ROAS</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#666;border-bottom:2px solid #e8e0f5;">Grade</th>
      </tr>
      {{CAMPAIGN_ROWS}}
    </table>
  </td></tr>

  <!-- BLOCKERS & RISKS -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">BLOCKERS &amp; RISKS</div>
    <div style="font-size:13px;color:#333;line-height:1.8;">{{BLOCKERS_LIST}}</div>
  </td></tr>

  <!-- KEY DECISIONS -->
  <tr><td style="padding:16px 40px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">KEY DECISIONS THIS WEEK</div>
    <div style="font-size:13px;color:#333;line-height:1.8;">{{DECISIONS_LIST}}</div>
  </td></tr>

  <!-- NEXT STEPS -->
  <tr><td style="padding:16px 40px 28px;">
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">NEXT STEPS — {{NEXT_WEEK_RANGE}}</div>
    <div style="font-size:13px;color:#333;line-height:1.8;">{{NEXT_STEPS_LIST}}</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f8f6ff;padding:16px 40px;text-align:center;border-top:1px solid #e8e0f5;">
    <div style="font-size:11px;color:#999;">Generated by Melleka AI Strategist — Internal Only. Do not forward.</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>

PLACEHOLDER RULES:
- {{WEEK_RANGE}}: e.g. "Jun 30 – Jul 6, 2026"
- {{NEXT_WEEK_RANGE}}: e.g. "Jul 7–13"
- {{GRADE_COLOR}}: hex from grade scale
- {{THIS_WEEK_COLOR}} / {{PRIOR_WEEK_COLOR}}: color based on ROAS %
- {{PROGRESS_PCT}}: MIN(roas/300*100, 100) as integer
- {{WINS_LIST}}: bulleted HTML list of 3-6 specific wins (use ✅ prefix)
- {{NOTION_TASKS}}: bulleted HTML list of completed Notion tasks (use • prefix)
- {{CAMPAIGN_ROWS}}: one <tr> per campaign, alternating #fff/#fafaf9 background, grade pill as colored <span> badge
- {{BLOCKERS_LIST}}: bulleted list, prefix 🔴 for urgent, 🟡 for watch
- {{DECISIONS_LIST}}: bulleted list with • prefix
- {{NEXT_STEPS_LIST}}: numbered list 1. 2. 3. etc.
- Change columns: green (#1a7f4b) for improvement, red (#e74c3c) for decline. For CPA, lower = green.
- ROAS color: 500%+=#1a7f4b, 400-500%=#2e9e62, 350-400%=#5cb85c, 300-350%=#8bc34a, 250-300%=#f5a623, 200-250%=#e67e22, below 200%=#e74c3c

STEP 5 — Send ONE email:
To: anthony@mellekamarketing.com
CC: garetth@vegamour.com
From: "Melleka AI Strategist <ai@listing.melleka.com>"
Subject: "Vegamour Weekly Roll-Up | {{WEEK_RANGE}} | {{THIS_WEEK_ROAS}}% ROAS | Grade {{GRADE}}"
Do NOT send separate emails. ONE email, Garett on CC.

STEP 6 — After successful send, update dedup flag:
supabase_update on table "strategist_config": config_key = "vegamour_weekly_rollup_last_sent", config_value = "{the Sunday end date of THIS WEEK in YYYY-MM-DD}"

STEP 7 — Log completion to super_agent_task.

CRITICAL: Never skip Step 0. Never send more than one roll-up per week.`;

// Upsert the weekly rollup cron job
sb.from('team_cron_jobs')
  .upsert(
    {
      member_name: 'anthony',
      name: 'vegamour-weekly-rollup',
      cron_expr: '0 8 * * 4',
      task: weeklyTask,
      enabled: true,
    },
    { onConflict: 'member_name,name' }
  )
  .then(({ error }) => {
    if (error) console.error('ERROR:', error.message);
    else console.log('Weekly rollup cron created/updated successfully');
  });

// Seed dedup row if missing (keep existing value if already there)
sb.from('strategist_config')
  .upsert(
    { config_key: 'vegamour_weekly_rollup_last_sent', config_value: '2000-01-01' },
    { onConflict: 'config_key', ignoreDuplicates: true }
  )
  .then(({ error }) => {
    if (error) console.error('Seed error:', error.message);
    else console.log('Weekly rollup dedup row seeded (or already existed)');
  });

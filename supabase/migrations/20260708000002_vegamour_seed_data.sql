-- Populate Vegamour auto_client_updates entries from existing cron jobs
-- Read-only data copy — does NOT modify the existing team_cron_jobs rows

-- Daily ROAS Brief
UPDATE auto_client_updates SET
  google_ads_account_id = '7567846915',
  email_recipients = ARRAY[
    'anthony@mellekamarketing.com',
    'bryan@mellekamarketing.com',
    'david@mellekamarketing.com',
    'kevin@xy7elite.com',
    'accountmanager@mellekamarketing.com',
    'garetth@vegamour.com',
    'chrisondatje@gmail.com'
  ],
  email_send_mode    = 'single_email',
  enabled            = true,
  cron_expr          = '0 8 * * *',
  cron_job_id        = '6c2f2c97-1c48-4898-94ed-60c3c15a1189',
  email_design       = (
    SELECT substring(task,
      strpos(task, '<!DOCTYPE html>'),
      strpos(task, E'\n\nROAS color rules:') - strpos(task, '<!DOCTYPE html>')
    )
    FROM team_cron_jobs
    WHERE id = '6c2f2c97-1c48-4898-94ed-60c3c15a1189'
  ),
  email_design_locked = true,
  template_notes     = 'Daily ROAS brief. Focus on yesterday performance and trend vs 7-day average. Keep strategist notes concise — 2 sentences max.',
  updated_at         = NOW()
WHERE client_name = 'Vegamour - Daily ROAS';

-- Weekly Roll-Up (runs Thursday, not Monday)
UPDATE auto_client_updates SET
  google_ads_account_id = '7567846915',
  email_recipients = ARRAY[
    'anthony@mellekamarketing.com',
    'garetth@vegamour.com'
  ],
  email_send_mode    = 'single_email',
  enabled            = true,
  cron_expr          = '0 8 * * 4',
  cron_job_id        = 'fb89840d-3c21-4f17-afc1-15ec5d6911e6',
  email_design       = (
    SELECT substring(task,
      strpos(task, '<!DOCTYPE html>'),
      strpos(task, E'\n\nPLACEHOLDER FILL RULES:') - strpos(task, '<!DOCTYPE html>')
    )
    FROM team_cron_jobs
    WHERE id = 'fb89840d-3c21-4f17-afc1-15ec5d6911e6'
  ),
  email_design_locked = true,
  template_notes     = 'Weekly roll-up. Summarize full week vs prior week. Include Notion tasks, change history, campaign table, wins, blockers, and next steps.',
  updated_at         = NOW()
WHERE client_name = 'Vegamour - Weekly Brief';

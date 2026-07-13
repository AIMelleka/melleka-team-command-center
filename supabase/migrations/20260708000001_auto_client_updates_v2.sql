-- Extend auto_client_updates with per-client design and email config
ALTER TABLE auto_client_updates
  ADD COLUMN IF NOT EXISTS email_design          TEXT,
  ADD COLUMN IF NOT EXISTS email_design_locked   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_send_mode       TEXT    NOT NULL DEFAULT 'single_email',
  ADD COLUMN IF NOT EXISTS template_notes        TEXT;

-- Seed pre-existing Vegamour automations (disabled until configured with recipients/design)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auto_client_updates WHERE client_name ILIKE 'vegamour%'
  ) THEN
    INSERT INTO auto_client_updates
      (client_name, cron_expr, email_send_mode, enabled, template_notes)
    VALUES
      (
        'Vegamour - Daily ROAS',
        '0 8 * * *',
        'single_email',
        false,
        'Daily ROAS brief. Focus on yesterday performance and trend vs 7-day average. Keep strategist notes concise — 2 sentences max.'
      ),
      (
        'Vegamour - Weekly Brief',
        '0 8 * * 1',
        'single_email',
        false,
        'Weekly ROAS brief. Summarize the full week performance and compare to prior week. Highlight any significant campaign changes or anomalies.'
      );
  END IF;
END $$;

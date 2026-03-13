-- Split cron schedule: auto-optimize at 7AM PST, daily reports at 8AM PST, assessment at 12PM PST
-- Also add assessed_at column for tracking assessment status

-- Remove existing fleet cron jobs (idempotent)
DO $$ BEGIN PERFORM cron.unschedule('fleet-morning-run'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fleet-evening-run'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fleet-auto-optimize'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fleet-daily-reports'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fleet-auto-assess'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 7:00 AM PST = 15:00 UTC -- Auto-optimize (strategist) only
SELECT cron.schedule(
  'fleet-auto-optimize',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-strategist-cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_auto_optimize", "mode": "strategist-only"}'::jsonb
  );
  $$
);

-- 8:00 AM PST = 16:00 UTC -- Daily ad reports only
SELECT cron.schedule(
  'fleet-daily-reports',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-strategist-cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_daily_reports", "mode": "ad-review-only"}'::jsonb
  );
  $$
);

-- 12:00 PM PST = 20:00 UTC -- Auto-assessment sweep
-- Runs at noon so changes from 7AM the previous day have had ~29 hours to take effect
SELECT cron.schedule(
  'fleet-auto-assess',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-assess-cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_assess"}'::jsonb
  );
  $$
);

-- 5:00 PM PST = 01:00 UTC (next day) -- Evening ad reports only (no changes)
SELECT cron.schedule(
  'fleet-evening-run',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-strategist-cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_evening", "mode": "ad-review-only"}'::jsonb
  );
  $$
);

-- Add assessed_at column for tracking which changes have been assessed
ALTER TABLE ppc_proposed_changes ADD COLUMN IF NOT EXISTS assessed_at timestamptz;

-- Indexes for efficient auto-assess queries
CREATE INDEX IF NOT EXISTS idx_ppc_proposed_changes_unassessed
  ON ppc_proposed_changes (executed_at)
  WHERE executed_at IS NOT NULL AND assessed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_ai_memory_change_outcome
  ON client_ai_memory (client_name, memory_type)
  WHERE memory_type IN ('change_outcome', 'strategist_learning');

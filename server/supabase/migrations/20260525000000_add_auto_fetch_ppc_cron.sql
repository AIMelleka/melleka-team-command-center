-- Schedule auto-fetch-ppc to run at 6:00 AM PST (14:00 UTC) daily
-- This populates ppc_daily_snapshots BEFORE the fleet-daily-reports cron at 8AM PST

-- Remove existing job if any (idempotent)
DO $$ BEGIN PERFORM cron.unschedule('auto-fetch-ppc-morning'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6:00 AM PST = 14:00 UTC
SELECT cron.schedule(
  'auto-fetch-ppc-morning',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-fetch-ppc',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_morning"}'::jsonb
  );
  $$
);

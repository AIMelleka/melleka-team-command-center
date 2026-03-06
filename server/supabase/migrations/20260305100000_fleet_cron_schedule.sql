-- Enable required extensions (already available on Supabase hosted)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing fleet cron jobs (idempotent)
DO $$ BEGIN
  PERFORM cron.unschedule('fleet-morning-run');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('fleet-evening-run');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- auto-strategist-cron has verify_jwt=false, so anon key is sufficient for the API gateway.
-- The function itself uses SUPABASE_SERVICE_ROLE_KEY from its own env vars internally.
-- Anon key is a public key (same one used by the frontend), safe to include in server-side SQL.

-- 8:00 AM PST = 16:00 UTC daily
-- (During PDT this fires at 9AM Pacific, but the auto-cron's duplicate guard prevents double runs)
SELECT cron.schedule(
  'fleet-morning-run',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-strategist-cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_morning"}'::jsonb
  );
  $$
);

-- 5:00 PM PST = 01:00 UTC (next day)
-- (During PDT this fires at 6PM Pacific, but again the guard handles it)
SELECT cron.schedule(
  'fleet-evening-run',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/auto-strategist-cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWJvdG1ybnhpeHZjdnRzcGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTA3OTcsImV4cCI6MjA4Nzk4Njc5N30.plESBHm0aV6SELl8t4qK-hDPtRMt0o_oJjecHNTzWZ4"}'::jsonb,
    body := '{"source": "pg_cron_evening"}'::jsonb
  );
  $$
);

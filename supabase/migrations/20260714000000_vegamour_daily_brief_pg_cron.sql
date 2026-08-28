-- Guarantee Vegamour daily ROAS brief fires at 8 AM PST (16:00 UTC) every day
-- Uses pg_cron + pg_net to hit the Railway trigger endpoint externally,
-- so server restarts and deployments cannot cause missed sends.

-- Remove existing job if any (idempotent)
DO $$ BEGIN PERFORM cron.unschedule('vegamour-daily-roas-brief-trigger'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 8 AM PST = 16:00 UTC (9 AM PDT in summer)
SELECT cron.schedule(
  'vegamour-daily-roas-brief-trigger',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://server-production-0486.up.railway.app/api/cron/trigger/fb41a565-bf2d-40c7-84fd-8bef0df1a602',
    headers := '{"x-cron-secret": "melleka-cron-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

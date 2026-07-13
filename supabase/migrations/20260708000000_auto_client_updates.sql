CREATE TABLE auto_client_updates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name          TEXT NOT NULL,
  google_ads_account_id TEXT,
  email_recipients     TEXT[] NOT NULL DEFAULT '{}',
  cron_expr            TEXT NOT NULL DEFAULT '0 8 * * 1-5',
  enabled              BOOLEAN NOT NULL DEFAULT true,
  cron_job_id          UUID,
  last_sent_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auto_client_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON auto_client_updates USING (true) WITH CHECK (true);

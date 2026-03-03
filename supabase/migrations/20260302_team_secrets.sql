-- team_secrets table
-- Stores API keys and credentials for the Team Command Center.
-- Read by server/src/services/secrets.ts via the Supabase service role key.
-- Row-level security is disabled — access is controlled at the application level
-- using the service role key (never exposed to clients).

CREATE TABLE IF NOT EXISTS public.team_secrets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        UNIQUE NOT NULL,
  value       text        NOT NULL,
  description text,
  updated_at  timestamptz DEFAULT now()
);

-- No RLS — service role only (never exposed via REST API to clients)
ALTER TABLE public.team_secrets DISABLE ROW LEVEL SECURITY;

-- Service role can do everything; no public access
REVOKE ALL ON public.team_secrets FROM anon, authenticated;
GRANT ALL ON public.team_secrets TO service_role;

-- -----------------------------------------------------------------------
-- Seed the required API keys below.
-- Replace the placeholder values with your real credentials.
-- -----------------------------------------------------------------------

INSERT INTO public.team_secrets (key, value, description) VALUES
  ('GOOGLE_CLIENT_ID',         'REPLACE_ME', 'Google OAuth 2.0 Client ID (from Google Cloud Console)'),
  ('GOOGLE_CLIENT_SECRET',     'REPLACE_ME', 'Google OAuth 2.0 Client Secret'),
  ('GOOGLE_ADS_DEVELOPER_TOKEN','REPLACE_ME', 'Google Ads developer token (Melleka account, Basic access)'),
  ('GOOGLE_ADS_REFRESH_TOKEN', 'REPLACE_ME', 'Long-lived Google OAuth refresh token for Google Ads API access'),
  ('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '',        'MCC / Manager account ID (optional — leave blank if not using MCC)'),
  ('SUPERMETRICS_API_KEY',     'REPLACE_ME', 'Supermetrics API key for cross-platform marketing data'),
  ('VERCEL_TOKEN',             'REPLACE_ME', 'Vercel personal access token for deploy_site tool'),
  ('RESEND_API_KEY',           'REPLACE_ME', 'Resend API key for send_email tool'),
  ('FROM_EMAIL',               'Melleka Team Hub <notify@ai.melleka.com>', 'Default sender address for emails')
ON CONFLICT (key) DO NOTHING;

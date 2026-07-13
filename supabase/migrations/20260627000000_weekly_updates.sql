-- Weekly Client Updates tool tables

CREATE TABLE IF NOT EXISTS weekly_update_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_prompt text NOT NULL DEFAULT '',
  slack_channel text DEFAULT '',
  email_recipients text[] DEFAULT '{}',
  send_slack boolean DEFAULT false,
  send_email boolean DEFAULT false,
  auto_enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);
INSERT INTO weekly_update_settings (master_prompt) VALUES ('') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS weekly_update_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL UNIQUE,
  enabled boolean DEFAULT true,
  added_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_update_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  html_content text,
  plain_text text,
  status text DEFAULT 'generating',
  sent_via text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- vegamour_briefs: stores generated brief HTML for PDF download via public URL
CREATE TABLE IF NOT EXISTS vegamour_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  html text NOT NULL,
  brief_type text NOT NULL DEFAULT 'daily',
  created_at timestamptz NOT NULL DEFAULT now()
);

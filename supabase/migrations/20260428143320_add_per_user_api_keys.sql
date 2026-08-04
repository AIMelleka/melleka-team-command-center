ALTER TABLE team_members ADD COLUMN IF NOT EXISTS anthropic_api_key text;

-- Per-user API keys seeded directly in DB after initial migration.
-- Keys redacted from version control.

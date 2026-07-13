-- Add unique constraint on name if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_name_key'
  ) THEN
    ALTER TABLE team_members ADD CONSTRAINT team_members_name_key UNIQUE (name);
  END IF;
END $$;

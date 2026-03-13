-- User preferences table for per-user settings (voice selection, etc.)
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_name text NOT NULL UNIQUE,
  voice_id text DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_member_name
  ON user_preferences(member_name);

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

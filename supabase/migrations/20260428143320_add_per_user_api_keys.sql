ALTER TABLE team_members ADD COLUMN IF NOT EXISTS anthropic_api_key text;

UPDATE team_members SET anthropic_api_key = CASE name
  WHEN 'bryan' THEN 'REDACTED'
  WHEN 'emely' THEN 'REDACTED'
  WHEN 'lexie' THEN 'REDACTED'
  WHEN 'david' THEN 'REDACTED'
  WHEN 'lino' THEN 'REDACTED'
  ELSE anthropic_api_key
END
WHERE name IN ('bryan', 'emely', 'lexie', 'david', 'lino');

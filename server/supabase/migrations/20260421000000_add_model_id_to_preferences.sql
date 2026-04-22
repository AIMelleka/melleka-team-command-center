-- Add model_id column to user_preferences for AI model selection
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS model_id text DEFAULT 'claude-opus-4-6';

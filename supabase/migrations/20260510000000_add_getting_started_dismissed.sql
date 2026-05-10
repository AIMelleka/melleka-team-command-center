-- Add getting_started_dismissed column to user_preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS getting_started_dismissed boolean DEFAULT false;

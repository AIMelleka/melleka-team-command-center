-- Add watcher_message_timestamps to client_response_alerts
-- Each element is the Slack message ts of a bot alert posted to #respond_watcher.
-- Lets us resolve alerts by thread_ts lookup in the DB, without needing Slack API history access.
ALTER TABLE client_response_alerts
  ADD COLUMN IF NOT EXISTS watcher_message_timestamps TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_alerts_watcher_ts
  ON client_response_alerts USING GIN (watcher_message_timestamps);

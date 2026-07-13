-- Slack Client Response Monitor — Database Migration
-- Run this in the Supabase SQL editor BEFORE running setup-slack-monitor.cjs

-- Table: tracks each open "unanswered client message" alert cycle
CREATE TABLE IF NOT EXISTS client_response_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          TEXT        NOT NULL,
  channel_name        TEXT        NOT NULL,
  first_message_ts    TEXT        NOT NULL,           -- Slack message timestamp (e.g. "1234567890.123456")
  first_message_text  TEXT,                           -- First ~500 chars of the client's message
  first_message_user  TEXT,                           -- Slack user ID of the client
  first_message_time  TIMESTAMPTZ NOT NULL,           -- When the first message arrived
  alerts_fired        TEXT[]      DEFAULT '{}',       -- e.g. ['30min', '1hr']
  resolved            BOOLEAN     DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (channel_id, first_message_ts)
);

-- Table: which Slack channels the bot monitors
CREATE TABLE IF NOT EXISTS slack_monitored_channels (
  channel_id    TEXT        PRIMARY KEY,
  channel_name  TEXT        NOT NULL,
  enabled       BOOLEAN     DEFAULT TRUE,
  added_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_alerts_channel_resolved
  ON client_response_alerts (channel_id, resolved);

CREATE INDEX IF NOT EXISTS idx_alerts_resolved_time
  ON client_response_alerts (resolved, first_message_time)
  WHERE resolved = FALSE;

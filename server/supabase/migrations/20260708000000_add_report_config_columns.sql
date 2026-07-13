-- Add scoring goals + report configuration columns to managed_clients.
-- All additions use IF NOT EXISTS so this is safe to run multiple times.

ALTER TABLE managed_clients
  ADD COLUMN IF NOT EXISTS target_cpl              NUMERIC,
  ADD COLUMN IF NOT EXISTS target_cpa              NUMERIC,
  ADD COLUMN IF NOT EXISTS target_roas             NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_budget          NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_lead_target     INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_conversion_target INTEGER,
  ADD COLUMN IF NOT EXISTS client_notes            TEXT,
  ADD COLUMN IF NOT EXISTS report_focus            TEXT,
  ADD COLUMN IF NOT EXISTS targeting_context       TEXT;

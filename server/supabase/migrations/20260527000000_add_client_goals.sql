-- Add goal columns to managed_clients for scoring and AI context
ALTER TABLE managed_clients
  ADD COLUMN IF NOT EXISTS target_cpl numeric,
  ADD COLUMN IF NOT EXISTS target_cpa numeric,
  ADD COLUMN IF NOT EXISTS target_roas numeric,
  ADD COLUMN IF NOT EXISTS monthly_budget numeric,
  ADD COLUMN IF NOT EXISTS monthly_lead_target integer,
  ADD COLUMN IF NOT EXISTS monthly_conversion_target integer,
  ADD COLUMN IF NOT EXISTS client_notes text;

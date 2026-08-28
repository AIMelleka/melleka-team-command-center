-- Revamp client settings: secondary/tertiary conversion goals and per-platform settings
-- All IF NOT EXISTS for idempotency

ALTER TABLE managed_clients
  ADD COLUMN IF NOT EXISTS secondary_conversion_goal TEXT,
  ADD COLUMN IF NOT EXISTS secondary_target_cpa NUMERIC,
  ADD COLUMN IF NOT EXISTS secondary_target_cpl NUMERIC,
  ADD COLUMN IF NOT EXISTS secondary_monthly_target INTEGER,
  ADD COLUMN IF NOT EXISTS tertiary_conversion_goal TEXT,
  ADD COLUMN IF NOT EXISTS tertiary_target_cpa NUMERIC,
  ADD COLUMN IF NOT EXISTS tertiary_target_cpl NUMERIC,
  ADD COLUMN IF NOT EXISTS tertiary_monthly_target INTEGER,
  ADD COLUMN IF NOT EXISTS platform_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN managed_clients.secondary_conversion_goal IS 'Secondary conversion goal type';
COMMENT ON COLUMN managed_clients.secondary_target_cpa IS 'Secondary goal: target cost per acquisition';
COMMENT ON COLUMN managed_clients.secondary_target_cpl IS 'Secondary goal: target cost per lead';
COMMENT ON COLUMN managed_clients.secondary_monthly_target IS 'Secondary goal: monthly volume target';
COMMENT ON COLUMN managed_clients.tertiary_conversion_goal IS 'Tertiary conversion goal type';
COMMENT ON COLUMN managed_clients.tertiary_target_cpa IS 'Tertiary goal: target cost per acquisition';
COMMENT ON COLUMN managed_clients.tertiary_target_cpl IS 'Tertiary goal: target cost per lead';
COMMENT ON COLUMN managed_clients.tertiary_monthly_target IS 'Tertiary goal: monthly volume target';
COMMENT ON COLUMN managed_clients.platform_settings IS 'Per-platform priority, focus metric, and targets as JSONB';

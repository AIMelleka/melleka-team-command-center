-- Add intelligence score columns to managed_clients for backfill data
ALTER TABLE managed_clients ADD COLUMN IF NOT EXISTS intelligence_score integer DEFAULT 0;
ALTER TABLE managed_clients ADD COLUMN IF NOT EXISTS intelligence_breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE managed_clients ADD COLUMN IF NOT EXISTS last_backfill_at timestamptz;

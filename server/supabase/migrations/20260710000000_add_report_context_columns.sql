ALTER TABLE managed_clients
  ADD COLUMN IF NOT EXISTS report_focus      TEXT,
  ADD COLUMN IF NOT EXISTS targeting_context TEXT;

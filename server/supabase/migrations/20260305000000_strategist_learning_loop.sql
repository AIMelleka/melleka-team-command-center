-- Add report_summary column to fleet_run_jobs for fleet report storage
ALTER TABLE fleet_run_jobs ADD COLUMN IF NOT EXISTS report_summary jsonb DEFAULT NULL;

-- Add competitor research columns to ppc_client_settings
ALTER TABLE ppc_client_settings ADD COLUMN IF NOT EXISTS competitor_domains text[] DEFAULT '{}';
ALTER TABLE ppc_client_settings ADD COLUMN IF NOT EXISTS competitor_names text[] DEFAULT '{}';

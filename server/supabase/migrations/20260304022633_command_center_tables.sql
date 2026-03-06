-- ============================================================
-- Command Center Tables Migration
-- Recreates all Genie Hub tables in nhebotmrnxixvcvtspet
-- DROP existing tables first (rebuild from scratch)
-- ============================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS social_media_posts CASCADE;
DROP TABLE IF EXISTS ppc_change_results CASCADE;
DROP TABLE IF EXISTS ppc_proposed_changes CASCADE;
DROP TABLE IF EXISTS ppc_optimization_sessions CASCADE;
DROP TABLE IF EXISTS ppc_daily_snapshots CASCADE;
DROP TABLE IF EXISTS ppc_client_settings CASCADE;
DROP TABLE IF EXISTS client_health_history CASCADE;
DROP TABLE IF EXISTS client_ai_memory CASCADE;
DROP TABLE IF EXISTS client_account_mappings CASCADE;
DROP TABLE IF EXISTS ad_review_history CASCADE;
DROP TABLE IF EXISTS seo_history CASCADE;
DROP TABLE IF EXISTS site_audit_cache CASCADE;
DROP TABLE IF EXISTS client_profiles CASCADE;
DROP TABLE IF EXISTS managed_clients CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS decks CASCADE;
DROP TABLE IF EXISTS fleet_run_jobs CASCADE;
DROP TABLE IF EXISTS strategist_config CASCADE;
DROP TABLE IF EXISTS strategist_knowledge_docs CASCADE;
DROP TABLE IF EXISTS generated_images CASCADE;
DROP TABLE IF EXISTS proposal_generation_jobs CASCADE;
DROP TABLE IF EXISTS seo_writer_jobs CASCADE;
DROP TABLE IF EXISTS package_definitions CASCADE;
DROP TABLE IF EXISTS ghl_oauth_tokens CASCADE;
DROP TABLE IF EXISTS api_usage_logs CASCADE;
DROP TABLE IF EXISTS qa_submissions CASCADE;
DROP TABLE IF EXISTS qa_improvement_notes CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS user_tool_permissions CASCADE;
DROP TABLE IF EXISTS mfa_recovery_codes CASCADE;

-- Drop functions that may conflict
DROP FUNCTION IF EXISTS generate_proposal_slug() CASCADE;
DROP FUNCTION IF EXISTS append_fleet_results(uuid, jsonb) CASCADE;

-- Enum for user roles
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Helper trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. managed_clients
-- ============================================================
CREATE TABLE managed_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL UNIQUE,
  domain text,
  site_audit_url text,
  ga4_property_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  tier text NOT NULL DEFAULT 'basic' CHECK (tier IN ('premium', 'advanced', 'basic')),
  industry text,
  primary_conversion_goal text NOT NULL DEFAULT 'all',
  tracked_conversion_types text[] NOT NULL DEFAULT '{leads,purchases,calls}',
  multi_account_enabled boolean NOT NULL DEFAULT false,
  last_reviewed_at timestamptz
);

-- ============================================================
-- 2. client_account_mappings
-- ============================================================
CREATE TABLE client_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  platform text NOT NULL,
  account_id text NOT NULL,
  account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(client_name, platform, account_id)
);

-- ============================================================
-- 3. client_profiles
-- ============================================================
CREATE TABLE client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  domain text,
  social_accounts jsonb DEFAULT '[]'::jsonb,
  brand_colors jsonb,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_profiles_name ON client_profiles (lower(client_name));
CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. client_ai_memory
-- ============================================================
CREATE TABLE client_ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  memory_type text NOT NULL DEFAULT 'recommendation',
  content text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'ad_review',
  relevance_score numeric DEFAULT 1.0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_ai_memory_client ON client_ai_memory (client_name);
CREATE INDEX IF NOT EXISTS idx_client_ai_memory_type ON client_ai_memory (client_name, memory_type);
CREATE TRIGGER update_client_ai_memory_updated_at BEFORE UPDATE ON client_ai_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. client_health_history
-- ============================================================
CREATE TABLE client_health_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  health_score integer NOT NULL DEFAULT 0,
  seo_errors integer,
  seo_health text,
  ad_health text,
  days_since_ad_review integer,
  config_completeness integer NOT NULL DEFAULT 0,
  missing_configs text[] DEFAULT '{}',
  score_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_name, recorded_date)
);
CREATE INDEX IF NOT EXISTS idx_client_health_history_client_date ON client_health_history (client_name, recorded_date DESC);

-- ============================================================
-- 6. ppc_daily_snapshots
-- ============================================================
CREATE TABLE ppc_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  platform text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  spend numeric NOT NULL DEFAULT 0,
  conversions numeric NOT NULL DEFAULT 0,
  calls integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  purchases integer NOT NULL DEFAULT 0,
  cost_per_conversion numeric NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  forms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_name, platform, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_ppc_snapshots_client_date ON ppc_daily_snapshots (client_name, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ppc_snapshots_date ON ppc_daily_snapshots (snapshot_date DESC);

-- ============================================================
-- 7. ppc_optimization_sessions
-- ============================================================
CREATE TABLE ppc_optimization_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  platform text NOT NULL,
  account_id text,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  supermetrics_data jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_summary text,
  status text NOT NULL DEFAULT 'pending_review',
  auto_mode boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. ppc_proposed_changes
-- ============================================================
CREATE TABLE ppc_proposed_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ppc_optimization_sessions(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  platform text NOT NULL,
  change_type text NOT NULL,
  entity_type text,
  entity_id text,
  entity_name text,
  before_value jsonb DEFAULT '{}'::jsonb,
  after_value jsonb DEFAULT '{}'::jsonb,
  ai_rationale text,
  confidence text NOT NULL DEFAULT 'medium',
  expected_impact text,
  priority text NOT NULL DEFAULT 'medium',
  approval_status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  execution_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. ppc_change_results
-- ============================================================
CREATE TABLE ppc_change_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid NOT NULL REFERENCES ppc_proposed_changes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES ppc_optimization_sessions(id) ON DELETE CASCADE,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  metrics_before jsonb DEFAULT '{}'::jsonb,
  metrics_after jsonb DEFAULT '{}'::jsonb,
  delta jsonb DEFAULT '{}'::jsonb,
  outcome text,
  ai_assessment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. ppc_client_settings
-- ============================================================
CREATE TABLE ppc_client_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL UNIQUE,
  auto_mode_enabled boolean NOT NULL DEFAULT false,
  auto_mode_platform text DEFAULT 'both',
  auto_mode_schedule text DEFAULT 'weekly',
  confidence_threshold text DEFAULT 'high',
  max_changes_per_run integer DEFAULT 5,
  google_account_id text,
  meta_account_id text,
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. ad_review_history
-- ============================================================
CREATE TABLE ad_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  platforms jsonb DEFAULT '[]'::jsonb,
  summary text,
  insights jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  week_over_week jsonb DEFAULT '[]'::jsonb,
  industry text,
  benchmark_comparison jsonb DEFAULT '{}'::jsonb,
  seo_data jsonb DEFAULT '{}'::jsonb,
  screenshots text[] DEFAULT '{}',
  action_items jsonb DEFAULT '[]'::jsonb,
  notes text,
  changes_made jsonb DEFAULT '[]'::jsonb,
  previous_review_id uuid REFERENCES ad_review_history(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_review_history_client ON ad_review_history (client_name);
CREATE INDEX IF NOT EXISTS idx_ad_review_history_date ON ad_review_history (review_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_review_history_client_date ON ad_review_history (client_name, review_date DESC);
CREATE TRIGGER update_ad_review_history_updated_at BEFORE UPDATE ON ad_review_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. seo_history
-- ============================================================
CREATE TABLE seo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  domain text NOT NULL,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  organic_keywords integer DEFAULT 0,
  organic_traffic integer DEFAULT 0,
  domain_authority integer DEFAULT 0,
  backlinks integer DEFAULT 0,
  referring_domains integer DEFAULT 0,
  paid_keywords integer DEFAULT 0,
  paid_traffic integer DEFAULT 0,
  full_analysis jsonb DEFAULT '{}'::jsonb,
  top_keywords jsonb DEFAULT '[]'::jsonb,
  competitors jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  notion_tasks_completed integer DEFAULT 0,
  notion_task_details jsonb DEFAULT '[]'::jsonb,
  slack_messages_count integer DEFAULT 0,
  slack_highlights jsonb DEFAULT '[]'::jsonb,
  overall_health text CHECK (overall_health IN ('excellent', 'good', 'warning', 'critical')),
  summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_history_client_date ON seo_history (client_name, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_history_domain ON seo_history (domain);
CREATE TRIGGER update_seo_history_updated_at BEFORE UPDATE ON seo_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 13. site_audit_cache
-- ============================================================
CREATE TABLE site_audit_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL UNIQUE,
  site_audit_url text NOT NULL,
  site_errors integer DEFAULT 0,
  site_warnings integer DEFAULT 0,
  site_notices integer DEFAULT 0,
  site_health_score numeric,
  last_scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_site_audit_cache_updated_at BEFORE UPDATE ON site_audit_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 14. proposals
-- ============================================================
CREATE TABLE proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_name text NOT NULL,
  project_description text NOT NULL,
  budget_range text,
  timeline text,
  services text[],
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  html_content text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Slug auto-generation function
CREATE OR REPLACE FUNCTION generate_proposal_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.client_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER generate_proposal_slug_trigger BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION generate_proposal_slug();

-- ============================================================
-- 15. decks
-- ============================================================
CREATE TABLE decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  client_name text NOT NULL,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  content jsonb DEFAULT '{}'::jsonb,
  screenshots jsonb DEFAULT '[]'::jsonb,
  brand_colors jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_decks_slug ON decks (slug);
CREATE INDEX IF NOT EXISTS idx_decks_client_name ON decks (client_name);
CREATE INDEX IF NOT EXISTS idx_decks_created_at ON decks (created_at DESC);
CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 16. fleet_run_jobs
-- ============================================================
CREATE TABLE fleet_run_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'processing',
  progress integer NOT NULL DEFAULT 0,
  total_clients integer NOT NULL DEFAULT 0,
  current_client text,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- 17. strategist_config
-- ============================================================
CREATE TABLE strategist_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Seed default config
INSERT INTO strategist_config (config_key, config_value) VALUES
  ('custom_instructions', ''),
  ('safety_overrides', '{}'),
  ('memory_cap_per_client', '80')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- 18. strategist_knowledge_docs
-- ============================================================
CREATE TABLE strategist_knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer DEFAULT 0,
  parsed_content text DEFAULT '',
  summary text DEFAULT '',
  category text DEFAULT 'general',
  tags text[] DEFAULT '{}',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_strategist_knowledge_docs_updated_at BEFORE UPDATE ON strategist_knowledge_docs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 19. generated_images
-- ============================================================
CREATE TABLE generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  prompt text NOT NULL,
  mode text NOT NULL DEFAULT 'generate',
  style text,
  width integer,
  height integer,
  image_url text NOT NULL,
  generator text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 20. social_media_posts
-- ============================================================
CREATE TABLE social_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  post_url text,
  post_date timestamptz,
  content_type text,
  caption text,
  thumbnail_url text,
  image_url text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  reach integer DEFAULT 0,
  impressions integer DEFAULT 0,
  engagement_rate numeric(6,3) DEFAULT 0,
  video_views integer DEFAULT 0,
  raw_data jsonb,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_posts_client ON social_media_posts (client_profile_id, platform, post_date DESC);

-- ============================================================
-- 21. proposal_generation_jobs
-- ============================================================
CREATE TABLE proposal_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'processing',
  progress integer DEFAULT 0,
  progress_message text,
  result jsonb,
  error text,
  input_params jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_status ON proposal_generation_jobs (status);
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_created_at ON proposal_generation_jobs (created_at DESC);
CREATE TRIGGER update_proposal_generation_jobs_updated_at BEFORE UPDATE ON proposal_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 22. seo_writer_jobs
-- ============================================================
CREATE TABLE seo_writer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  progress_message text,
  input_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_seo_writer_jobs_user_created_at ON seo_writer_jobs (user_id, created_at DESC);
CREATE TRIGGER update_seo_writer_jobs_updated_at BEFORE UPDATE ON seo_writer_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 23. package_definitions
-- ============================================================
CREATE TABLE package_definitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  tier integer NOT NULL,
  monthly_price integer NOT NULL,
  description text,
  tagline text,
  channels text NOT NULL,
  turnaround text NOT NULL,
  category text NOT NULL CHECK (category IN ('basic', 'advanced', 'premium')),
  services jsonb NOT NULL DEFAULT '{}'::jsonb,
  highlights text[] DEFAULT '{}',
  recommended boolean DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_package_definitions_updated_at BEFORE UPDATE ON package_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 24. ghl_oauth_tokens
-- ============================================================
CREATE TABLE ghl_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL UNIQUE,
  location_name text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  token_type text DEFAULT 'Bearer',
  scope text,
  company_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER update_ghl_oauth_tokens_updated_at BEFORE UPDATE ON ghl_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 25. api_usage_logs
-- ============================================================
CREATE TABLE api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_id uuid,
  user_email text,
  status_code integer NOT NULL DEFAULT 200,
  error_message text,
  request_params jsonb DEFAULT '{}'::jsonb,
  response_summary text,
  duration_ms integer,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_action ON api_usage_logs (action);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs (user_id);

-- ============================================================
-- 26. qa_submissions
-- ============================================================
CREATE TABLE qa_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  content_type text NOT NULL,
  file_name text,
  file_url text,
  raw_content text,
  score integer CHECK (score >= 0 AND score <= 100),
  passed boolean GENERATED ALWAYS AS (score >= 95) STORED,
  analysis jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  submitted_by uuid
);
CREATE TRIGGER update_qa_submissions_updated_at BEFORE UPDATE ON qa_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 27. qa_improvement_notes
-- ============================================================
CREATE TABLE qa_improvement_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  content_type text NOT NULL,
  note text NOT NULL,
  priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  is_active boolean DEFAULT true,
  added_by uuid
);
CREATE TRIGGER update_qa_improvement_notes_updated_at BEFORE UPDATE ON qa_improvement_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 28. user_roles
-- ============================================================
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================================
-- 29. user_tool_permissions
-- ============================================================
CREATE TABLE user_tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  UNIQUE(user_id, tool_key)
);

-- ============================================================
-- 30. mfa_recovery_codes
-- ============================================================
CREATE TABLE mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Also ensure team_secrets table exists (was missing before)
-- ============================================================
CREATE TABLE team_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Database functions
-- ============================================================

-- Append fleet results atomically
CREATE OR REPLACE FUNCTION append_fleet_results(job_uuid uuid, new_results jsonb)
RETURNS void AS $$
BEGIN
  UPDATE fleet_run_jobs
  SET results = results || new_results
  WHERE id = job_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Disable RLS on all command center tables (service role access)
-- ============================================================
ALTER TABLE managed_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_account_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_memory DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_health_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_daily_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_optimization_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_proposed_changes DISABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_change_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_client_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_review_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE seo_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_audit_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_run_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE strategist_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE strategist_knowledge_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_generation_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE seo_writer_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_oauth_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_improvement_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_tool_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_recovery_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_secrets DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Enable realtime for key tables
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE fleet_run_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE proposal_generation_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE seo_writer_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

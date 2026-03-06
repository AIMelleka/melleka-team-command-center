-- ============================================================
-- Auth Functions (needed by frontend for admin checks)
-- ============================================================

-- Check if a user has a specific role
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Admin user listing
CREATE OR REPLACE FUNCTION get_users_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin
  FROM auth.users u
  ORDER BY u.created_at;
END;
$$;

-- Check if user has access to a specific tool
CREATE OR REPLACE FUNCTION user_has_tool_access(_user_id uuid, _tool_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Admins have access to all tools
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_tool_permissions
    WHERE user_id = _user_id AND tool_key = _tool_key
  );
END;
$$;

-- Check if user has any tool permission
CREATE OR REPLACE FUNCTION user_has_any_tool(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Admins always have tools
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_tool_permissions WHERE user_id = _user_id
  );
END;
$$;

-- Make the existing users admins (they're the founding team)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Enable RLS on sensitive tables with basic policies
-- (Allow authenticated users to read/write — this is an internal team tool)
-- ============================================================

-- Enable RLS on command center tables
ALTER TABLE managed_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_optimization_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_proposed_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_change_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_audit_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_run_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategist_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategist_knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_writer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_improvement_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tool_permissions ENABLE ROW LEVEL SECURITY;

-- Create a single "authenticated users can do everything" policy for each table
-- (Internal team tool — all authenticated users are trusted)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'managed_clients', 'client_account_mappings', 'client_profiles', 'client_ai_memory',
      'client_health_history', 'ppc_daily_snapshots', 'ppc_optimization_sessions',
      'ppc_proposed_changes', 'ppc_change_results', 'ppc_client_settings',
      'ad_review_history', 'seo_history', 'site_audit_cache', 'proposals', 'decks',
      'fleet_run_jobs', 'strategist_config', 'strategist_knowledge_docs', 'generated_images',
      'social_media_posts', 'proposal_generation_jobs', 'seo_writer_jobs', 'package_definitions',
      'ghl_oauth_tokens', 'api_usage_logs', 'qa_submissions', 'qa_improvement_notes',
      'user_roles', 'user_tool_permissions'
    ])
  LOOP
    EXECUTE format('CREATE POLICY "authenticated_full_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END;
$$;

-- Service role bypasses RLS, so the server's cron jobs and tools still work

-- Fix missing RLS policies for all command center tables
-- RLS was enabled but policies were never created, blocking all authenticated queries

DO $$
DECLARE
  tbl text;
  tbl_exists boolean;
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
      'user_roles', 'user_tool_permissions',
      'team_members', 'team_conversations', 'messages', 'team_memory', 'team_notifications',
      'super_agent_tasks', 'user_preferences', 'seo_articles', 'agent_tool_executions',
      'client_crm_credentials'
    ])
  LOOP
    -- Check if table exists first
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO tbl_exists;

    IF tbl_exists THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      BEGIN
        EXECUTE format('CREATE POLICY "authenticated_full_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
        RAISE NOTICE 'Created policy on %', tbl;
      EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Policy already exists on %', tbl;
      END;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END IF;
  END LOOP;
END;
$$;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_review_history: {
        Row: {
          action_items: Json | null
          benchmark_comparison: Json | null
          changes_made: Json | null
          client_name: string
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
          id: string
          industry: string | null
          insights: Json | null
          notes: string | null
          platforms: Json | null
          previous_review_id: string | null
          recommendations: Json | null
          review_date: string
          screenshots: string[] | null
          seo_data: Json | null
          summary: string | null
          updated_at: string
          week_over_week: Json | null
        }
        Insert: {
          action_items?: Json | null
          benchmark_comparison?: Json | null
          changes_made?: Json | null
          client_name: string
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
          id?: string
          industry?: string | null
          insights?: Json | null
          notes?: string | null
          platforms?: Json | null
          previous_review_id?: string | null
          recommendations?: Json | null
          review_date?: string
          screenshots?: string[] | null
          seo_data?: Json | null
          summary?: string | null
          updated_at?: string
          week_over_week?: Json | null
        }
        Update: {
          action_items?: Json | null
          benchmark_comparison?: Json | null
          changes_made?: Json | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
          id?: string
          industry?: string | null
          insights?: Json | null
          notes?: string | null
          platforms?: Json | null
          previous_review_id?: string | null
          recommendations?: Json | null
          review_date?: string
          screenshots?: string[] | null
          seo_data?: Json | null
          summary?: string | null
          updated_at?: string
          week_over_week?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_review_history_previous_review_id_fkey"
            columns: ["previous_review_id"]
            isOneToOne: false
            referencedRelation: "ad_review_history"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          ip_address: string | null
          request_params: Json | null
          response_summary: string | null
          status_code: number
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          request_params?: Json | null
          response_summary?: string | null
          status_code?: number
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          request_params?: Json | null
          response_summary?: string | null
          status_code?: number
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_account_mappings: {
        Row: {
          account_id: string
          account_name: string | null
          client_name: string
          created_at: string
          created_by: string | null
          id: string
          platform: string
        }
        Insert: {
          account_id: string
          account_name?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          platform: string
        }
        Update: {
          account_id?: string
          account_name?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          platform?: string
        }
        Relationships: []
      }
      client_ai_memory: {
        Row: {
          client_name: string
          content: string
          context: Json | null
          created_at: string
          expires_at: string | null
          id: string
          memory_type: string
          relevance_score: number | null
          source: string | null
          updated_at: string
        }
        Insert: {
          client_name: string
          content: string
          context?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          memory_type?: string
          relevance_score?: number | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string
          content?: string
          context?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          memory_type?: string
          relevance_score?: number | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_health_history: {
        Row: {
          ad_health: string | null
          client_name: string
          config_completeness: number
          created_at: string
          days_since_ad_review: number | null
          health_score: number
          id: string
          missing_configs: string[] | null
          recorded_date: string
          score_breakdown: Json | null
          seo_errors: number | null
          seo_health: string | null
        }
        Insert: {
          ad_health?: string | null
          client_name: string
          config_completeness?: number
          created_at?: string
          days_since_ad_review?: number | null
          health_score?: number
          id?: string
          missing_configs?: string[] | null
          recorded_date?: string
          score_breakdown?: Json | null
          seo_errors?: number | null
          seo_health?: string | null
        }
        Update: {
          ad_health?: string | null
          client_name?: string
          config_completeness?: number
          created_at?: string
          days_since_ad_review?: number | null
          health_score?: number
          id?: string
          missing_configs?: string[] | null
          recorded_date?: string
          score_breakdown?: Json | null
          seo_errors?: number | null
          seo_health?: string | null
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          brand_colors: Json | null
          client_name: string
          created_at: string
          created_by: string | null
          domain: string | null
          id: string
          logo_url: string | null
          social_accounts: Json | null
          updated_at: string
        }
        Insert: {
          brand_colors?: Json | null
          client_name: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          social_accounts?: Json | null
          updated_at?: string
        }
        Update: {
          brand_colors?: Json | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          social_accounts?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      decks: {
        Row: {
          brand_colors: Json | null
          client_name: string
          content: Json | null
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
          id: string
          screenshots: Json | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_colors?: Json | null
          client_name: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
          id?: string
          screenshots?: Json | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_colors?: Json | null
          client_name?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
          id?: string
          screenshots?: Json | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fleet_run_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_client: string | null
          id: string
          progress: number
          results: Json
          status: string
          total_clients: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_client?: string | null
          id?: string
          progress?: number
          results?: Json
          status?: string
          total_clients?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_client?: string | null
          id?: string
          progress?: number
          results?: Json
          status?: string
          total_clients?: number
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          created_by: string
          generator: string | null
          height: number | null
          id: string
          image_url: string
          mode: string
          prompt: string
          style: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          generator?: string | null
          height?: number | null
          id?: string
          image_url: string
          mode?: string
          prompt: string
          style?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          generator?: string | null
          height?: number | null
          id?: string
          image_url?: string
          mode?: string
          prompt?: string
          style?: string | null
          width?: number | null
        }
        Relationships: []
      }
      ghl_oauth_tokens: {
        Row: {
          access_token: string
          company_id: string | null
          created_at: string
          expires_at: string
          id: string
          location_id: string
          location_name: string
          refresh_token: string
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          company_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          location_id: string
          location_name: string
          refresh_token: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          company_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          location_id?: string
          location_name?: string
          refresh_token?: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      managed_clients: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          domain: string | null
          ga4_property_id: string | null
          id: string
          industry: string | null
          is_active: boolean
          last_reviewed_at: string | null
          multi_account_enabled: boolean
          primary_conversion_goal: string
          site_audit_url: string | null
          tier: string
          tracked_conversion_types: string[]
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          ga4_property_id?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          last_reviewed_at?: string | null
          multi_account_enabled?: boolean
          primary_conversion_goal?: string
          site_audit_url?: string | null
          tier?: string
          tracked_conversion_types?: string[]
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          ga4_property_id?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          last_reviewed_at?: string | null
          multi_account_enabled?: boolean
          primary_conversion_goal?: string
          site_audit_url?: string | null
          tier?: string
          tracked_conversion_types?: string[]
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      package_definitions: {
        Row: {
          category: string
          channels: string
          color: string | null
          created_at: string
          description: string | null
          highlights: string[] | null
          id: string
          monthly_price: number
          name: string
          recommended: boolean | null
          services: Json
          tagline: string | null
          tier: number
          turnaround: string
          updated_at: string
        }
        Insert: {
          category: string
          channels: string
          color?: string | null
          created_at?: string
          description?: string | null
          highlights?: string[] | null
          id: string
          monthly_price: number
          name: string
          recommended?: boolean | null
          services?: Json
          tagline?: string | null
          tier: number
          turnaround: string
          updated_at?: string
        }
        Update: {
          category?: string
          channels?: string
          color?: string | null
          created_at?: string
          description?: string | null
          highlights?: string[] | null
          id?: string
          monthly_price?: number
          name?: string
          recommended?: boolean | null
          services?: Json
          tagline?: string | null
          tier?: number
          turnaround?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppc_change_results: {
        Row: {
          ai_assessment: string | null
          assessed_at: string
          change_id: string
          created_at: string
          delta: Json | null
          id: string
          metrics_after: Json | null
          metrics_before: Json | null
          outcome: string | null
          session_id: string
        }
        Insert: {
          ai_assessment?: string | null
          assessed_at?: string
          change_id: string
          created_at?: string
          delta?: Json | null
          id?: string
          metrics_after?: Json | null
          metrics_before?: Json | null
          outcome?: string | null
          session_id: string
        }
        Update: {
          ai_assessment?: string | null
          assessed_at?: string
          change_id?: string
          created_at?: string
          delta?: Json | null
          id?: string
          metrics_after?: Json | null
          metrics_before?: Json | null
          outcome?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppc_change_results_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "ppc_proposed_changes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppc_change_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ppc_optimization_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ppc_client_settings: {
        Row: {
          auto_mode_enabled: boolean
          auto_mode_platform: string | null
          auto_mode_schedule: string | null
          client_name: string
          confidence_threshold: string | null
          created_at: string
          created_by: string | null
          google_account_id: string | null
          id: string
          max_changes_per_run: number | null
          meta_account_id: string | null
          updated_at: string
        }
        Insert: {
          auto_mode_enabled?: boolean
          auto_mode_platform?: string | null
          auto_mode_schedule?: string | null
          client_name: string
          confidence_threshold?: string | null
          created_at?: string
          created_by?: string | null
          google_account_id?: string | null
          id?: string
          max_changes_per_run?: number | null
          meta_account_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_mode_enabled?: boolean
          auto_mode_platform?: string | null
          auto_mode_schedule?: string | null
          client_name?: string
          confidence_threshold?: string | null
          created_at?: string
          created_by?: string | null
          google_account_id?: string | null
          id?: string
          max_changes_per_run?: number | null
          meta_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ppc_daily_snapshots: {
        Row: {
          calls: number
          clicks: number
          client_name: string
          conversions: number
          cost_per_conversion: number
          created_at: string
          forms: number
          id: string
          impressions: number
          leads: number
          platform: string
          purchases: number
          snapshot_date: string
          spend: number
        }
        Insert: {
          calls?: number
          clicks?: number
          client_name: string
          conversions?: number
          cost_per_conversion?: number
          created_at?: string
          forms?: number
          id?: string
          impressions?: number
          leads?: number
          platform: string
          purchases?: number
          snapshot_date?: string
          spend?: number
        }
        Update: {
          calls?: number
          clicks?: number
          client_name?: string
          conversions?: number
          cost_per_conversion?: number
          created_at?: string
          forms?: number
          id?: string
          impressions?: number
          leads?: number
          platform?: string
          purchases?: number
          snapshot_date?: string
          spend?: number
        }
        Relationships: []
      }
      ppc_optimization_sessions: {
        Row: {
          account_id: string | null
          ai_reasoning: string | null
          ai_summary: string | null
          auto_mode: boolean
          client_name: string
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
          id: string
          platform: string
          status: string
          supermetrics_data: Json | null
        }
        Insert: {
          account_id?: string | null
          ai_reasoning?: string | null
          ai_summary?: string | null
          auto_mode?: boolean
          client_name: string
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
          id?: string
          platform: string
          status?: string
          supermetrics_data?: Json | null
        }
        Update: {
          account_id?: string | null
          ai_reasoning?: string | null
          ai_summary?: string | null
          auto_mode?: boolean
          client_name?: string
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
          id?: string
          platform?: string
          status?: string
          supermetrics_data?: Json | null
        }
        Relationships: []
      }
      ppc_proposed_changes: {
        Row: {
          after_value: Json | null
          ai_rationale: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          before_value: Json | null
          change_type: string
          client_name: string
          confidence: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          executed_at: string | null
          execution_error: string | null
          expected_impact: string | null
          id: string
          platform: string
          priority: string
          session_id: string
        }
        Insert: {
          after_value?: Json | null
          ai_rationale?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          before_value?: Json | null
          change_type: string
          client_name: string
          confidence?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          executed_at?: string | null
          execution_error?: string | null
          expected_impact?: string | null
          id?: string
          platform: string
          priority?: string
          session_id: string
        }
        Update: {
          after_value?: Json | null
          ai_rationale?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          before_value?: Json | null
          change_type?: string
          client_name?: string
          confidence?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          executed_at?: string | null
          execution_error?: string | null
          expected_impact?: string | null
          id?: string
          platform?: string
          priority?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppc_proposed_changes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ppc_optimization_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          input_params: Json
          progress: number | null
          progress_message: string | null
          result: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_params: Json
          progress?: number | null
          progress_message?: string | null
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_params?: Json
          progress?: number | null
          progress_message?: string | null
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          budget_range: string | null
          client_name: string
          content: Json
          created_at: string
          html_content: string | null
          id: string
          project_description: string
          services: string[] | null
          slug: string
          status: string
          timeline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          client_name: string
          content?: Json
          created_at?: string
          html_content?: string | null
          id?: string
          project_description: string
          services?: string[] | null
          slug: string
          status?: string
          timeline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          client_name?: string
          content?: Json
          created_at?: string
          html_content?: string | null
          id?: string
          project_description?: string
          services?: string[] | null
          slug?: string
          status?: string
          timeline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_improvement_notes: {
        Row: {
          added_by: string | null
          content_type: string
          created_at: string
          id: string
          is_active: boolean | null
          note: string
          priority: number | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          content_type: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          note: string
          priority?: number | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          note?: string
          priority?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      qa_submissions: {
        Row: {
          analysis: Json | null
          content_type: string
          created_at: string
          error_message: string | null
          file_name: string | null
          file_url: string | null
          id: string
          passed: boolean | null
          raw_content: string | null
          score: number | null
          status: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          analysis?: Json | null
          content_type: string
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          passed?: boolean | null
          raw_content?: string | null
          score?: number | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json | null
          content_type?: string
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          passed?: boolean | null
          raw_content?: string | null
          score?: number | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_history: {
        Row: {
          analysis_date: string
          backlinks: number | null
          client_name: string
          competitors: Json | null
          created_at: string
          created_by: string | null
          domain: string
          domain_authority: number | null
          full_analysis: Json | null
          id: string
          notion_task_details: Json | null
          notion_tasks_completed: number | null
          organic_keywords: number | null
          organic_traffic: number | null
          overall_health: string | null
          paid_keywords: number | null
          paid_traffic: number | null
          recommendations: Json | null
          referring_domains: number | null
          slack_highlights: Json | null
          slack_messages_count: number | null
          summary: string | null
          top_keywords: Json | null
          updated_at: string
        }
        Insert: {
          analysis_date?: string
          backlinks?: number | null
          client_name: string
          competitors?: Json | null
          created_at?: string
          created_by?: string | null
          domain: string
          domain_authority?: number | null
          full_analysis?: Json | null
          id?: string
          notion_task_details?: Json | null
          notion_tasks_completed?: number | null
          organic_keywords?: number | null
          organic_traffic?: number | null
          overall_health?: string | null
          paid_keywords?: number | null
          paid_traffic?: number | null
          recommendations?: Json | null
          referring_domains?: number | null
          slack_highlights?: Json | null
          slack_messages_count?: number | null
          summary?: string | null
          top_keywords?: Json | null
          updated_at?: string
        }
        Update: {
          analysis_date?: string
          backlinks?: number | null
          client_name?: string
          competitors?: Json | null
          created_at?: string
          created_by?: string | null
          domain?: string
          domain_authority?: number | null
          full_analysis?: Json | null
          id?: string
          notion_task_details?: Json | null
          notion_tasks_completed?: number | null
          organic_keywords?: number | null
          organic_traffic?: number | null
          overall_health?: string | null
          paid_keywords?: number | null
          paid_traffic?: number | null
          recommendations?: Json | null
          referring_domains?: number | null
          slack_highlights?: Json | null
          slack_messages_count?: number | null
          summary?: string | null
          top_keywords?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_writer_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          input_params: Json
          job_type: string
          progress: number
          progress_message: string | null
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_params?: Json
          job_type: string
          progress?: number
          progress_message?: string | null
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_params?: Json
          job_type?: string
          progress?: number
          progress_message?: string | null
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_audit_cache: {
        Row: {
          client_name: string
          created_at: string
          id: string
          last_scraped_at: string
          site_audit_url: string
          site_errors: number | null
          site_health_score: number | null
          site_notices: number | null
          site_warnings: number | null
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          last_scraped_at?: string
          site_audit_url: string
          site_errors?: number | null
          site_health_score?: number | null
          site_notices?: number | null
          site_warnings?: number | null
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          last_scraped_at?: string
          site_audit_url?: string
          site_errors?: number | null
          site_health_score?: number | null
          site_notices?: number | null
          site_warnings?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          caption: string | null
          client_profile_id: string
          comments: number | null
          content_type: string | null
          created_at: string
          engagement_rate: number | null
          id: string
          image_url: string | null
          impressions: number | null
          likes: number | null
          platform: string
          post_date: string | null
          post_url: string | null
          raw_data: Json | null
          reach: number | null
          saves: number | null
          scraped_at: string
          shares: number | null
          thumbnail_url: string | null
          video_views: number | null
        }
        Insert: {
          caption?: string | null
          client_profile_id: string
          comments?: number | null
          content_type?: string | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          likes?: number | null
          platform: string
          post_date?: string | null
          post_url?: string | null
          raw_data?: Json | null
          reach?: number | null
          saves?: number | null
          scraped_at?: string
          shares?: number | null
          thumbnail_url?: string | null
          video_views?: number | null
        }
        Update: {
          caption?: string | null
          client_profile_id?: string
          comments?: number | null
          content_type?: string | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          likes?: number | null
          platform?: string
          post_date?: string | null
          post_url?: string | null
          raw_data?: Json | null
          reach?: number | null
          saves?: number | null
          scraped_at?: string
          shares?: number | null
          thumbnail_url?: string | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategist_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      strategist_knowledge_docs: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          parsed_content: string | null
          summary: string | null
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          parsed_content?: string | null
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          parsed_content?: string | null
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      team_pit_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_pit_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          role: string
          tool_suggestions: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          tool_suggestions?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          tool_suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "team_pit_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "team_pit_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tool_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          tool_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          tool_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          tool_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_fleet_results: {
        Args: { job_uuid: string; new_results: Json }
        Returns: undefined
      }
      get_cron_status: { Args: never; Returns: Json }
      get_users_for_admin: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          is_admin: boolean
          last_sign_in_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_any_tool: { Args: { _user_id: string }; Returns: boolean }
      user_has_tool_access: {
        Args: { _tool_key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

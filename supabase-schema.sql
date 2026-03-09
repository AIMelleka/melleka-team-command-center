-- Run this in your Supabase SQL Editor to create the team hub tables

-- Team members (created on first login)
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

-- Conversations
create table if not exists team_conversations (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_team_conversations_member on team_conversations(member_name);
create index if not exists idx_team_conversations_updated on team_conversations(updated_at desc);

-- Messages
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references team_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  tool_name text,
  created_at timestamptz default now()
);
create index if not exists idx_team_messages_conv on team_messages(conversation_id);

-- Memory (one row per person, upserted)
create table if not exists team_memory (
  id uuid primary key default gen_random_uuid(),
  member_name text unique not null,
  content text not null default '',
  updated_at timestamptz default now()
);

-- Secrets (API keys stored centrally — one row per key)
create table if not exists team_secrets (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz default now()
);

-- Disable RLS (service role key bypasses it anyway, but just in case)
alter table team_members disable row level security;
alter table team_conversations disable row level security;
alter table team_messages disable row level security;
alter table team_memory disable row level security;
alter table team_secrets disable row level security;

-- Super Agent task tracker (shared across all team members)
create table if not exists super_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'not_started',
  priority text not null default 'medium',
  requested_by text,
  assigned_to text not null default 'Super Agent',
  category text,
  client_name text,
  conversation_id uuid references team_conversations(id) on delete set null,
  links jsonb default '[]'::jsonb,
  error_details text,
  notes jsonb default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_super_agent_tasks_status on super_agent_tasks(status);
create index if not exists idx_super_agent_tasks_category on super_agent_tasks(category);
create index if not exists idx_super_agent_tasks_client on super_agent_tasks(client_name);
create index if not exists idx_super_agent_tasks_created on super_agent_tasks(created_at desc);
create index if not exists idx_super_agent_tasks_conversation on super_agent_tasks(conversation_id);

alter table super_agent_tasks disable row level security;

-- =============================================
-- Website Builder Tables
-- =============================================

-- Website projects
create table if not exists website_projects (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  name text not null,
  slug text unique not null,
  description text,
  status text not null default 'draft',
  template_id text,
  custom_domain text,
  vercel_project_id text,
  vercel_deployment_url text,
  branded_url text,
  thumbnail_url text,
  seo_defaults jsonb default '{}'::jsonb,
  settings jsonb default '{}'::jsonb,
  conversation_id uuid references team_conversations(id) on delete set null,
  last_deployed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_projects_member on website_projects(member_name);
create index if not exists idx_website_projects_slug on website_projects(slug);
create index if not exists idx_website_projects_status on website_projects(status);
alter table website_projects disable row level security;

-- Website pages
create table if not exists website_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references website_projects(id) on delete cascade,
  filename text not null default 'index.html',
  title text not null default 'Home',
  html_content text not null default '',
  is_homepage boolean default false,
  sort_order integer default 0,
  seo jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(project_id, filename)
);
create index if not exists idx_website_pages_project on website_pages(project_id);
alter table website_pages disable row level security;

-- Website version history
create table if not exists website_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references website_projects(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  deploy_url text,
  deployed_by text,
  commit_message text,
  created_at timestamptz default now()
);
create index if not exists idx_website_versions_project on website_versions(project_id);
alter table website_versions disable row level security;

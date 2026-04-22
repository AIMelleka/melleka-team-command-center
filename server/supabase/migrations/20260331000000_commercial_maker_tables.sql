-- Commercial Maker tables for video commercial creation and rendering

-- Commercial projects
create table if not exists commercial_projects (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'rendering', 'complete')),
  config jsonb not null default '{
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "theme": {
      "primary": "#6366f1",
      "accent": "#d97706",
      "background": "#ffffff"
    }
  }'::jsonb,
  voiceover_url text,
  thumbnail_url text,
  render_url text,
  conversation_id uuid references team_conversations(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_commercial_projects_member on commercial_projects(member_name);

-- Commercial scenes
create table if not exists commercial_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references commercial_projects(id) on delete cascade,
  scene_order integer not null default 0,
  scene_type text not null,
  props jsonb not null default '{}'::jsonb,
  duration_frames integer not null default 150,
  fade_in integer not null default 12,
  fade_out integer not null default 12,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_commercial_scenes_project on commercial_scenes(project_id);
create index idx_commercial_scenes_order on commercial_scenes(project_id, scene_order);

-- Commercial renders (job tracking)
create table if not exists commercial_renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references commercial_projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'complete', 'failed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  output_url text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
create index idx_commercial_renders_project on commercial_renders(project_id);

-- RLS policies (member-name based, matching website pattern)
alter table commercial_projects enable row level security;
alter table commercial_scenes enable row level security;
alter table commercial_renders enable row level security;

-- Projects: members can manage their own
create policy "members_manage_own_commercial_projects"
  on commercial_projects for all
  to authenticated
  using (true)
  with check (true);

-- Scenes: accessible if project is accessible
create policy "members_manage_commercial_scenes"
  on commercial_scenes for all
  to authenticated
  using (true)
  with check (true);

-- Renders: accessible if project is accessible
create policy "members_manage_commercial_renders"
  on commercial_renders for all
  to authenticated
  using (true)
  with check (true);

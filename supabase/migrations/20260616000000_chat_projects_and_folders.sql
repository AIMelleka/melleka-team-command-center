-- Chat Projects: knowledge containers that inject context into every chat within the project
CREATE TABLE chat_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'folder',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project resources: links, files, images, docs attached to a project
CREATE TABLE chat_project_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES chat_projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('link', 'file', 'image', 'doc')),
  name text NOT NULL,
  url text,
  content text,
  storage_path text,
  mime_type text,
  file_size int,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat folders: organize conversations in the sidebar
CREATE TABLE chat_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link conversations to projects and folders
ALTER TABLE team_conversations ADD COLUMN project_id uuid REFERENCES chat_projects(id) ON DELETE SET NULL;
ALTER TABLE team_conversations ADD COLUMN folder_id uuid REFERENCES chat_folders(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_chat_projects_member ON chat_projects(member_name);
CREATE INDEX idx_chat_project_resources_project ON chat_project_resources(project_id);
CREATE INDEX idx_chat_folders_member ON chat_folders(member_name);
CREATE INDEX idx_team_conversations_project ON team_conversations(project_id);
CREATE INDEX idx_team_conversations_folder ON team_conversations(folder_id);

-- RLS: authenticated full access (same pattern as other tables in this project)
ALTER TABLE chat_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_project_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON chat_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON chat_project_resources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON chat_folders FOR ALL TO authenticated USING (true) WITH CHECK (true);

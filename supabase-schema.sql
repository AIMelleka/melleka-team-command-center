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

-- Disable RLS (service role key bypasses it anyway, but just in case)
alter table team_members disable row level security;
alter table team_conversations disable row level security;
alter table team_messages disable row level security;
alter table team_memory disable row level security;

import { supabase } from "./supabase.js";
import fs from "fs/promises";
import path from "path";

const LOCAL_TEAM_DIR = process.env.LOCAL_TEAM_DIR ?? "/Users/aimelleka/Clients/ai/melleka/team";
const TEAM_TIMEZONE = "America/New_York";

export interface MemoryEntry {
  id: string;
  member_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function getMemberDir(name: string): Promise<string> {
  const dir = path.join(LOCAL_TEAM_DIR, name.toLowerCase().replace(/\s+/g, "-"));
  await fs.mkdir(path.join(dir, "work"), { recursive: true });
  await fs.mkdir(path.join(dir, "conversations"), { recursive: true });
  return dir;
}

// ── Legacy blob memory (kept for migration) ──

export async function readMemory(name: string): Promise<string> {
  const { data } = await supabase
    .from("team_memory")
    .select("content")
    .eq("member_name", name.toLowerCase())
    .single();
  return data?.content ?? "";
}

export async function writeMemory(name: string, content: string): Promise<void> {
  const lowerName = name.toLowerCase();
  await supabase.from("team_memory").upsert(
    { member_name: lowerName, content, updated_at: new Date().toISOString() },
    { onConflict: "member_name" }
  );
  try {
    const dir = await getMemberDir(name);
    await fs.writeFile(path.join(dir, "memory.md"), content, "utf-8");
  } catch {
    // Local sync is best-effort
  }
}

export async function appendMemory(name: string, note: string): Promise<void> {
  const existing = await readMemory(name);
  const timestamp = new Date().toLocaleDateString("en-CA", { timeZone: TEAM_TIMEZONE });
  const updated = existing
    ? `${existing}\n\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`;
  await writeMemory(name, updated);
}

// ── Individual memory entries (agent_memories table) ──

export async function listMemoryEntries(memberName: string): Promise<MemoryEntry[]> {
  const { data, error } = await supabase
    .from("agent_memories")
    .select("*")
    .eq("member_name", memberName.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as MemoryEntry[];
}

export async function getMemoryEntry(id: string): Promise<MemoryEntry | null> {
  const { data, error } = await supabase
    .from("agent_memories")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as MemoryEntry;
}

export async function createMemoryEntry(
  memberName: string,
  title: string,
  content: string
): Promise<MemoryEntry> {
  const { data, error } = await supabase
    .from("agent_memories")
    .insert({
      member_name: memberName.toLowerCase(),
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as MemoryEntry;
}

export async function updateMemoryEntry(
  id: string,
  updates: { title?: string; content?: string }
): Promise<MemoryEntry> {
  const { data, error } = await supabase
    .from("agent_memories")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as MemoryEntry;
}

export async function deleteMemoryEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("agent_memories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function findMemoryByTitle(
  memberName: string,
  title: string
): Promise<MemoryEntry | null> {
  const { data } = await supabase
    .from("agent_memories")
    .select("*")
    .eq("member_name", memberName.toLowerCase())
    .ilike("title", title)
    .limit(1)
    .maybeSingle();
  return (data as MemoryEntry) || null;
}

export async function buildMemoryForPrompt(memberName: string): Promise<string> {
  const entries = await listMemoryEntries(memberName);
  if (entries.length === 0) return "";
  return entries
    .reverse() // oldest first for chronological order
    .map((e) => `### ${e.title}\n${e.content}`)
    .join("\n\n");
}

const migratedMembers = new Set<string>();

export async function migrateMemoryIfNeeded(memberName: string): Promise<void> {
  const lowerName = memberName.toLowerCase();
  // Skip if already checked this server session
  if (migratedMembers.has(lowerName)) return;

  // Check if already has entries in DB
  const { count } = await supabase
    .from("agent_memories")
    .select("id", { count: "exact", head: true })
    .eq("member_name", lowerName);
  if (count && count > 0) {
    migratedMembers.add(lowerName);
    return;
  }

  // Check if old blob exists
  const oldContent = await readMemory(memberName);
  if (!oldContent || oldContent.trim().length === 0) {
    migratedMembers.add(lowerName);
    return;
  }

  // Parse the old blob into entries
  // Split by date markers like [2026-03-01] or by --- separators
  const sections = oldContent.split(/\n\n(?=\[[\d-]+\])|---+/).filter((s) => s.trim());

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Try to extract a title from the first line
    const lines = trimmed.split("\n");
    let title = "Memory Note";
    let content = trimmed;

    // If starts with a date marker [YYYY-MM-DD], use it as part of the title
    const dateMatch = lines[0].match(/^\[([\d-]+)\]\s*(.*)/);
    if (dateMatch) {
      title = dateMatch[2] || `Note from ${dateMatch[1]}`;
      content = lines.length > 1 ? lines.slice(1).join("\n").trim() || lines[0] : lines[0];
    } else if (lines[0].startsWith("#")) {
      title = lines[0].replace(/^#+\s*/, "");
      content = lines.slice(1).join("\n").trim() || trimmed;
    } else {
      // Use first ~60 chars of first line as title
      title = lines[0].slice(0, 60) + (lines[0].length > 60 ? "..." : "");
    }

    await supabase.from("agent_memories").insert({
      member_name: lowerName,
      title,
      content,
    });
  }

  migratedMembers.add(lowerName);
}

import { supabase } from "./supabase.js";
import fs from "fs/promises";
import path from "path";

const LOCAL_TEAM_DIR = process.env.LOCAL_TEAM_DIR ?? "/Users/aimelleka/Clients/ai/melleka/team";
const TEAM_TIMEZONE = "America/New_York";

export async function getMemberDir(name: string): Promise<string> {
  const dir = path.join(LOCAL_TEAM_DIR, name.toLowerCase().replace(/\s+/g, "-"));
  await fs.mkdir(path.join(dir, "work"), { recursive: true });
  await fs.mkdir(path.join(dir, "conversations"), { recursive: true });
  return dir;
}

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
  // Sync to local file
  try {
    const dir = await getMemberDir(name);
    await fs.writeFile(path.join(dir, "memory.md"), content, "utf-8");
  } catch {
    // Local sync is best-effort
  }
}

export async function appendMemory(name: string, note: string): Promise<void> {
  const existing = await readMemory(name);
  // Get YYYY-MM-DD in team timezone (not UTC)
  const timestamp = new Date().toLocaleDateString("en-CA", { timeZone: TEAM_TIMEZONE });
  const updated = existing
    ? `${existing}\n\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`;
  await writeMemory(name, updated);
}

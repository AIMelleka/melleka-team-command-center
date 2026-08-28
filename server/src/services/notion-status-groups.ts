/**
 * Shared service: fetches the real STATUS property groups from the Notion
 * database and caches them for 10 minutes. Both tasks.ts (stats) and
 * task-settings.ts use this so they always agree on what "Complete" means.
 */

import { getSecret } from "./secrets.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CACHE_TTL = 10 * 60 * 1000;

export const FALLBACK_STATUS_GROUPS: Record<string, string[]> = {
  "To-do": ["👋 NEW 👋"],
  "In progress": [
    "👥TEAM IS WORKING ON IT 👥",
    "READY 🚀",
    "IN PROGRESS",
    "⏱️ ON-GOING ⏱️",
    "⚠️ HELD UP ⚠️",
    "🛠️ Working on it 🛠️",
    "1QA - Needed",
    "Internal (COUNT)",
    "🐂 BullShit Fires 🐂",
  ],
  Complete: [
    "✅ Done (NO QA) ✅",
    "QA - DONE (Lexie)",
    "QA - DONE (Tony)",
    "QA - DONE (Bryan)",
    "QA - DONE (Emely)",
    "QA - DONE (David)",
    "QA - DONE (Gavin)",
    "QA DONE (send to client)",
    "NON-ESSENTIAL (DONE)",
    "Internal (DONE)",
  ],
};

let cachedGroups: Record<string, string[]> | null = null;
let cachedAt = 0;

export async function getNotionStatusGroups(): Promise<Record<string, string[]>> {
  if (cachedGroups && Date.now() - cachedAt < CACHE_TTL) return cachedGroups;

  try {
    const [apiKey, databaseId] = await Promise.all([
      getSecret("NOTION_API_KEY"),
      getSecret("NOTION_TASK_DATABASE_ID"),
    ]);
    const dbId = databaseId || "9e7cd72f-e62c-4514-9456-5f51cbcfe981";

    const resp = await fetch(`${NOTION_API}/databases/${dbId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) throw new Error(`Notion DB fetch failed: ${resp.status}`);

    const db = await resp.json();
    const statusProp = db?.properties?.["STATUS"]?.status;
    if (!statusProp?.options || !statusProp?.groups) {
      throw new Error("STATUS property missing groups");
    }

    // Build option_id → name map
    const optionById: Record<string, string> = {};
    for (const opt of statusProp.options as { id: string; name: string }[]) {
      optionById[opt.id] = opt.name;
    }

    // Build group name → status names
    const groups: Record<string, string[]> = {};
    for (const grp of statusProp.groups as { name: string; option_ids: string[] }[]) {
      const names = grp.option_ids.map((id) => optionById[id]).filter(Boolean);
      if (names.length > 0) groups[grp.name] = names;
    }

    cachedGroups = groups;
    cachedAt = Date.now();
    return groups;
  } catch (err: any) {
    console.warn("[notion-status-groups] Using fallback:", err?.message);
    return FALLBACK_STATUS_GROUPS;
  }
}

/** Returns a Set of status names that belong to the "Complete" group. */
export async function getCompleteStatusSet(): Promise<Set<string>> {
  const groups = await getNotionStatusGroups();
  return new Set(groups["Complete"] ?? FALLBACK_STATUS_GROUPS.Complete);
}

/** Returns a Set of status names that belong to the "In progress" group. */
export async function getInProgressStatusSet(): Promise<Set<string>> {
  const groups = await getNotionStatusGroups();
  return new Set(groups["In progress"] ?? FALLBACK_STATUS_GROUPS["In progress"]);
}

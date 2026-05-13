/**
 * Shared client matching module — ported from fetch-notion-tasks/index.ts
 * Provides strict alias registry + smart matching to prevent cross-client confusion
 * (e.g., "Global Guard Insurance" vs "Global Staffing Partners").
 */

import { supabase } from "./supabase.js";

export type MatchingRegistry = Record<string, { aliases: string[]; excludePatterns: string[]; exactOnly?: boolean }>;

export const CLIENT_ALIAS_REGISTRY: MatchingRegistry = {
  // Global Guard Insurance Services - CLIENTS field uses: "Global Guard", "GGIS", "Global Guard Insurance"
  "global guard": {
    aliases: ["ggis", "global guard", "global guard insurance", "global guardins"],
    excludePatterns: ["gsp", "global staffing partners"],
    exactOnly: true,
  },
  "global guard insurance": {
    aliases: ["ggis", "global guard", "global guard insurance", "global guardins"],
    excludePatterns: ["gsp", "global staffing partners"],
    exactOnly: true,
  },
  "ggis": {
    aliases: ["ggis", "global guard", "global guard insurance", "global guardins"],
    excludePatterns: ["gsp", "global staffing partners"],
    exactOnly: true,
  },
  // Global Staffing Partners - CLIENTS field uses: "GSP", "Global Staffing Partners"
  "global staffing": {
    aliases: ["gsp", "global staffing partners"],
    excludePatterns: ["ggis", "global guard", "global guard insurance", "global guardins"],
    exactOnly: true,
  },
  "global staffing partners": {
    aliases: ["gsp", "global staffing partners"],
    excludePatterns: ["ggis", "global guard", "global guard insurance", "global guardins"],
    exactOnly: true,
  },
  "gsp": {
    aliases: ["gsp", "global staffing partners"],
    excludePatterns: ["ggis", "global guard", "global guard insurance", "global guardins"],
    exactOnly: true,
  },
};

// --- DB-backed registry with 5-minute cache ---
let cachedRegistry: MatchingRegistry | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function loadMatchingRegistry(): Promise<MatchingRegistry> {
  const now = Date.now();
  if (cachedRegistry && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRegistry;
  }

  // Start from hardcoded defaults
  const registry: MatchingRegistry = { ...CLIENT_ALIAS_REGISTRY };

  try {
    const { data, error } = await supabase
      .from("managed_clients")
      .select("client_name, match_aliases, match_exclude_patterns, match_exact_only")
      .eq("is_active", true);

    if (error) {
      console.error("[loadMatchingRegistry] DB error, using hardcoded fallback:", error.message);
      cachedRegistry = registry;
      cacheTimestamp = now;
      return registry;
    }

    for (const row of data || []) {
      if (!row.match_aliases || row.match_aliases.length === 0) continue;

      const aliases = row.match_aliases.map((a: string) => a.toLowerCase());
      const excludePatterns = (row.match_exclude_patterns || []).map((p: string) => p.toLowerCase());
      const exactOnly = row.match_exact_only || false;
      const rules = { aliases, excludePatterns, exactOnly };

      // Register under client name (lowercased)
      const clientKey = row.client_name.toLowerCase().trim();
      registry[clientKey] = rules;

      // Also register under each alias as a key (so lookups by alias work)
      for (const alias of aliases) {
        registry[alias] = rules;
      }
    }
  } catch (err: any) {
    console.error("[loadMatchingRegistry] Unexpected error, using hardcoded fallback:", err.message);
  }

  cachedRegistry = registry;
  cacheTimestamp = now;
  console.log(`[loadMatchingRegistry] Registry loaded with ${Object.keys(registry).length} keys`);
  return registry;
}

export function clearMatchingRegistryCache(): void {
  cachedRegistry = null;
  cacheTimestamp = 0;
}

export function getClientMatchingRules(clientName: string, registry?: MatchingRegistry): { aliases: string[]; excludePatterns: string[]; exactOnly?: boolean } | null {
  const reg = registry || CLIENT_ALIAS_REGISTRY;
  const lowerName = clientName.toLowerCase().trim();

  // Direct match on registry key
  if (reg[lowerName]) {
    return reg[lowerName];
  }

  // Check if any registry entry's aliases contain this name (exact match on alias only)
  for (const [_key, rules] of Object.entries(reg)) {
    if (rules.aliases.some(a => a === lowerName)) {
      return rules;
    }
  }

  return null;
}

export function isAmbiguousWord(word: string): boolean {
  const ambiguousWords = new Set([
    "global", "national", "international", "american", "usa",
    "services", "solutions", "partners", "group", "consulting",
    "management", "associates", "industries", "enterprises",
    "the", "and", "for", "inc", "llc", "co", "company"
  ]);
  return ambiguousWords.has(word.toLowerCase());
}

export function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    "the", "and", "for", "inc", "llc", "co", "company", "group", "services",
    "global", "usa", "america", "american", "national", "international",
    "solutions", "consulting", "management", "partners", "associates"
  ]);
  return commonWords.has(word.toLowerCase());
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateClientAliases(clientName: string, registry?: MatchingRegistry): string[] {
  const name = clientName.toLowerCase().trim();

  // Check for strict registry match first
  const strictRules = getClientMatchingRules(clientName, registry);
  if (strictRules) {
    console.log(`Using STRICT aliases for "${clientName}": ${strictRules.aliases.join(", ")}`);
    console.log(`Excluding patterns: ${strictRules.excludePatterns.join(", ")}`);
    return strictRules.aliases;
  }

  // Fall back to dynamic alias generation for non-registered clients
  const aliases = new Set<string>();

  // Full name
  aliases.add(name);

  const words = name.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    // First letter acronym: "San Diego Parks Foundation" → "sdpf"
    aliases.add(words.map((w) => w[0]).join(""));

    // First two letters acronym
    aliases.add(words.map((w) => w.slice(0, 2)).join(""));

    // First word only
    aliases.add(words[0]);

    // First two words
    if (words.length >= 2) {
      aliases.add(words.slice(0, 2).join(" "));
      aliases.add(words.slice(0, 2).join(""));
    }

    // Each significant word (3+ chars) as standalone - BUT NOT ambiguous words
    words.forEach((w) => {
      if (w.length >= 3 && !isAmbiguousWord(w)) {
        aliases.add(w);
      }
    });

    // Common abbreviation patterns
    if (words.length >= 2) {
      aliases.add(words[0][0] + words[1][0]);
    }
    if (words.length >= 3) {
      aliases.add(words[0][0] + words[1][0] + words[2][0]);
    }
  }

  // Variations without spaces
  aliases.add(name.replace(/\s+/g, "-"));
  aliases.add(name.replace(/\s+/g, "_"));
  aliases.add(name.replace(/\s+/g, ""));

  return [...aliases].filter(Boolean);
}

export function makeClientMatcher(clientName: string, registry?: MatchingRegistry) {
  const aliases = generateClientAliases(clientName, registry);
  const clientNameLower = clientName.toLowerCase().trim();
  const strictRules = getClientMatchingRules(clientName, registry);

  // Precompute flexible-mode strict aliases (long/specific)
  const flexibleStrictAliases = aliases.filter((a) => a.length >= 6 || (a.length >= 3 && !isCommonWord(a)));

  return (clientField: string, titleForLog?: string) => {
    const clientLower = (clientField || "").toLowerCase();

    if (!clientLower) return false;

    if (strictRules) {
      const hasExcludedPattern = strictRules.excludePatterns.some((pattern) => clientLower === pattern.toLowerCase());
      if (hasExcludedPattern) {
        if (titleForLog) {
          console.log(`EXCLUDED: Task "${titleForLog}" client "${clientField}" excluded for "${clientName}"`);
        }
        return false;
      }

      // For exactOnly mode, require the CLIENTS field to exactly equal one of the aliases
      if (strictRules.exactOnly) {
        return strictRules.aliases.some((alias) => clientLower === alias.toLowerCase());
      }

      // Otherwise, use word-boundary matching for short aliases and substring for longer ones
      return strictRules.aliases.some((alias) => {
        const aliasLower = alias.toLowerCase();
        if (aliasLower.length <= 4) {
          const regex = new RegExp(`\\b${escapeRegex(aliasLower)}\\b`, "i");
          return regex.test(clientLower);
        }
        return clientLower.includes(aliasLower) || aliasLower.includes(clientLower);
      });
    }

    // FLEXIBLE MODE
    if (clientLower === clientNameLower) return true;

    if (clientLower.includes(clientNameLower) || clientNameLower.includes(clientLower)) {
      const clientWords = clientLower.split(/[\s,]+/).filter(Boolean);
      const searchWords = clientNameLower.split(/\s+/).filter(Boolean);
      const matchedWords = searchWords.filter((sw) => clientWords.some((cw) => cw.includes(sw) || sw.includes(cw)));
      if (matchedWords.length >= Math.min(2, searchWords.length)) return true;
    }

    return flexibleStrictAliases.some((a) => {
      const aLower = a.toLowerCase();
      if (aLower.length <= 4) {
        const regex = new RegExp(`\\b${escapeRegex(aLower)}\\b`, "i");
        return regex.test(clientLower);
      }
      return clientLower.includes(aLower);
    });
  };
}

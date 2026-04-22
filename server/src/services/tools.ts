import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createMemoryEntry,
  findMemoryByTitle,
  updateMemoryEntry,
  deleteMemoryEntry,
  listMemoryEntries,
} from "./memory.js";
import { getSecret, requireSecret } from "./secrets.js";
import { listZapierTools, callZapierTool } from "./zapier-mcp.js";
import { deployToVercel } from "./deployer.js";

const execAsync = promisify(exec);

// Env vars stripped from child processes to prevent secret leakage
const SENSITIVE_ENV_KEYS = [
  "ANTHROPIC_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_AUTH_KEY",
  "JWT_SECRET", "TEAM_PASSWORD",
  "GOOGLE_CLIENT_SECRET", "GOOGLE_SA_PRIVATE_KEY", "META_ACCESS_TOKEN",
  "CANVA_CLIENT_SECRET", "ELEVENLABS_API_KEY", "RESEND_API_KEY",
  "VERCEL_TOKEN", "NOTION_API_KEY", "SLACK_BOT_TOKEN",
  "GHL_AGENCY_API_KEY",
];
function safeEnv(extra?: Record<string, string>): Record<string, string | undefined> {
  const env = { ...process.env, ...extra };
  for (const k of SENSITIVE_ENV_KEYS) delete env[k];
  return env;
}

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR || "";
const TEAM_TIMEZONE = "America/New_York";
const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v23";

// ── Servis CRM token cache (keyed by client_name, 50-min TTL) ──
interface ServisTokenEntry { token: string; expiresAt: number; }
const servisTokenCache = new Map<string, ServisTokenEntry>();

async function getServisToken(clientName: string, clientId: string, clientSecret: string): Promise<string> {
  const cached = servisTokenCache.get(clientName);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const resp = await fetch("https://freeagent.network/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Servis CRM OAuth failed (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  const token = data.access_token as string;
  // Cache for 50 minutes (tokens expire in 1 hour)
  servisTokenCache.set(clientName, { token, expiresAt: Date.now() + 50 * 60 * 1000 });
  return token;
}

// ── GoHighLevel (GHL) API helpers ──
const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

interface GhlRequestOptions {
  method?: string;
  endpoint: string;
  locationId?: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  accessToken?: string; // Override: use this token instead of agency PIT
}

async function ghlRequest(options: GhlRequestOptions): Promise<any> {
  // Use provided OAuth token, fall back to agency PIT
  const token = options.accessToken
    || process.env.GHL_AGENCY_API_KEY
    || await getSecret("GHL_AGENCY_API_KEY");
  if (!token) throw new Error("No GHL token available. Connect a GHL location via OAuth or set GHL_AGENCY_API_KEY.");

  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Version": GHL_API_VERSION,
    "Accept": "application/json",
  };

  let url = `${GHL_API_BASE}${options.endpoint}`;
  let fetchBody: string | undefined;

  if (method === "GET" || method === "DELETE") {
    const qs = new URLSearchParams();
    if (options.locationId) qs.set("locationId", options.locationId);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
    }
    const qsStr = qs.toString();
    if (qsStr) url += (url.includes("?") ? "&" : "?") + qsStr;
  } else {
    headers["Content-Type"] = "application/json";
    const bodyObj: Record<string, unknown> = { ...options.body };
    if (options.locationId && !bodyObj.locationId) bodyObj.locationId = options.locationId;
    fetchBody = JSON.stringify(bodyObj);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, { method, headers, body: fetchBody, signal: controller.signal });
    if (resp.status === 429) {
      throw new Error("GHL rate limit exceeded (100 req/10s). Wait a moment and retry.");
    }
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`GHL API error (${resp.status}): ${errText.slice(0, 1500)}`);
    }
    const ct = resp.headers.get("content-type") || "";
    return ct.includes("application/json") ? await resp.json() : await resp.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Refresh a GHL OAuth location token and update the DB */
async function refreshGhlLocationToken(locationId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.GHL_CLIENT_ID || await getSecret("GHL_CLIENT_ID");
  const clientSecret = process.env.GHL_CLIENT_SECRET || await getSecret("GHL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("GHL_CLIENT_ID and GHL_CLIENT_SECRET required for token refresh.");

  const resp = await fetch("https://services.leadconnectorhq.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`GHL token refresh failed (${resp.status}): ${errText.slice(0, 500)}`);
  }
  const data = await resp.json();
  const newExpiresAt = new Date(Date.now() + (data.expires_in * 1000));

  // Update DB with new tokens
  const client = await getSupabaseClient();
  await client.from("ghl_oauth_tokens").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: newExpiresAt.toISOString(),
  }).eq("location_id", locationId);

  console.log(`[ghl] Refreshed OAuth token for location ${locationId}`);
  return data.access_token;
}

/** Get a valid GHL OAuth token for a location (refreshing if expired) */
async function getGhlLocationToken(locationId: string): Promise<string | null> {
  const client = await getSupabaseClient();
  const { data: row } = await client
    .from("ghl_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("location_id", locationId)
    .maybeSingle();

  if (!row) return null;

  // Check if expired (5-min buffer)
  const expiresAt = new Date(row.expires_at);
  if (expiresAt.getTime() - 5 * 60 * 1000 < Date.now()) {
    if (row.refresh_token) {
      try {
        return await refreshGhlLocationToken(locationId, row.refresh_token);
      } catch (err: any) {
        console.error(`[ghl] Token refresh failed for ${locationId}:`, err.message);
        return null;
      }
    }
    return null; // Expired, no refresh token
  }

  return row.access_token;
}

interface GhlLocationResult {
  locationId: string;
  locationName: string;
  accessToken: string | null; // OAuth location token (null = use agency PIT)
}

async function resolveGhlLocation(clientName: string): Promise<GhlLocationResult | string> {
  const client = await getSupabaseClient();
  const search = clientName.toLowerCase().trim();
  let locationId: string | null = null;
  let locationName: string = clientName;

  // Strategy 1: exact ilike match in client_account_mappings
  const { data: mapping } = await client
    .from("client_account_mappings")
    .select("account_id, account_name, client_name")
    .ilike("client_name", clientName)
    .eq("platform", "ghl")
    .limit(1)
    .maybeSingle();
  if (mapping?.account_id) {
    locationId = mapping.account_id;
    locationName = mapping.account_name || mapping.client_name;
  }

  // Strategy 2: fuzzy match (contains / reverse contains)
  let allMappings: any[] | null = null;
  if (!locationId) {
    const { data } = await client
      .from("client_account_mappings")
      .select("client_name, account_id, account_name")
      .eq("platform", "ghl");
    allMappings = data;
    if (allMappings && allMappings.length > 0) {
      const fuzzy = allMappings.find(m => m.client_name.toLowerCase().includes(search) || search.includes(m.client_name.toLowerCase()));
      if (fuzzy) { locationId = fuzzy.account_id; locationName = fuzzy.account_name || fuzzy.client_name; }
      if (!locationId) {
        const searchWords = search.split(/\s+/);
        const wordMatch = allMappings.find(m => {
          const nameWords = m.client_name.toLowerCase().split(/\s+/);
          return searchWords.some((sw: string) => nameWords.some((nw: string) => nw === sw && sw.length > 2));
        });
        if (wordMatch) { locationId = wordMatch.account_id; locationName = wordMatch.account_name || wordMatch.client_name; }
      }
    }
  }

  // Strategy 3: ghl_oauth_tokens table (find by location name)
  if (!locationId) {
    const { data: oauthToken } = await client
      .from("ghl_oauth_tokens")
      .select("location_id, location_name")
      .ilike("location_name", `%${clientName}%`)
      .limit(1)
      .maybeSingle();
    if (oauthToken) { locationId = oauthToken.location_id; locationName = oauthToken.location_name; }
  }

  if (!locationId) {
    const names = allMappings?.map(m => m.client_name).join(", ") || "(none linked)";
    // Also list OAuth-connected locations
    const { data: oauthLocs } = await client.from("ghl_oauth_tokens").select("location_name");
    const oauthNames = oauthLocs?.map(l => l.location_name).join(", ") || "(none)";
    return `Error: No GHL location found for "${clientName}". Linked clients: ${names}. OAuth-connected locations: ${oauthNames}. Connect a location via OAuth or add to client_account_mappings (platform='ghl').`;
  }

  // Get OAuth location token (for sub-account level API access)
  const accessToken = await getGhlLocationToken(locationId);
  return { locationId, locationName, accessToken };
}

/** Format GHL result with truncation */
function ghlResult(data: unknown, maxLen = 8000): string {
  const out = JSON.stringify(data, null, 2);
  return out.length > maxLen ? out.slice(0, maxLen) + "\n[...truncated]" : out;
}

/** Make a GHL API request scoped to a location, using OAuth token with agency PIT fallback */
async function ghlLocationRequest(accessToken: string | null, options: Omit<GhlRequestOptions, "accessToken">): Promise<any> {
  if (!accessToken) {
    throw new Error(
      "No OAuth token for this GHL location. The agency API key cannot access sub-account data (contacts, conversations, etc.).\n" +
      "To connect this location, open this URL in your browser and authorize:\n" +
      "https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/ghl-oauth-start\n" +
      "Then try again."
    );
  }
  return ghlRequest({ ...options, accessToken });
}

/** Format an ISO timestamp to a human-readable string in the team's timezone */
function formatTZ(isoStr: string): string {
  return new Date(isoStr).toLocaleString("en-US", {
    timeZone: TEAM_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Registered callbacks that fire when cron jobs change, so the scheduler can reload */
export const cronReloadCallbacks: Array<() => void> = [];
const LOCAL_TEAM_DIR = process.env.LOCAL_TEAM_DIR || "/tmp/team";

/** Member's dedicated scratch space — always writable */
function memberTmpDir(memberName: string): string {
  const slug = memberName.toLowerCase().replace(/\s+/g, "-");
  return `/tmp/${slug}`;
}

/** Refresh a Google OAuth2 access token and return it */
async function refreshGoogleToken(): Promise<string> {
  const clientId = await requireSecret("GOOGLE_CLIENT_ID", "Google Client ID");
  const clientSecret = await requireSecret("GOOGLE_CLIENT_SECRET", "Google Client Secret");
  const refreshToken = await requireSecret("GOOGLE_ADS_REFRESH_TOKEN", "Google Ads Refresh Token");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

/** Ensure a directory exists */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Get a Supabase client for the specified project */
async function getSupabaseClient(project?: string): Promise<SupabaseClient> {
  // All tables (team + command center) now live in one project
  if (!project || project === "team" || project === "genie") {
    const { supabase } = await import("./supabase.js");
    return supabase;
  }
  const prefix = project === "turbo" ? "TURBO" : project.toUpperCase();
  const url = await requireSecret(`${prefix}_SUPABASE_URL`, `${prefix} Supabase URL`);
  const key = await requireSecret(`${prefix}_SUPABASE_SERVICE_ROLE_KEY`, `${prefix} Supabase Service Role Key`);
  return createClient(url, key);
}

/** Apply filters to a Supabase query builder */
function applyFilters(query: ReturnType<SupabaseClient["from"]>, filters?: Array<{ column: string; op: string; value: unknown }>) {
  let q = query as unknown as ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
  if (!filters) return q;
  for (const f of filters) {
    switch (f.op) {
      case "eq": q = q.eq(f.column, f.value) as typeof q; break;
      case "neq": q = q.neq(f.column, f.value) as typeof q; break;
      case "gt": q = q.gt(f.column, f.value) as typeof q; break;
      case "gte": q = q.gte(f.column, f.value) as typeof q; break;
      case "lt": q = q.lt(f.column, f.value) as typeof q; break;
      case "lte": q = q.lte(f.column, f.value) as typeof q; break;
      case "like": q = q.like(f.column, f.value as string) as typeof q; break;
      case "ilike": q = q.ilike(f.column, f.value as string) as typeof q; break;
      case "in": q = q.in(f.column, f.value as unknown[]) as typeof q; break;
      case "is": q = q.is(f.column, f.value as null) as typeof q; break;
      default: q = q.eq(f.column, f.value) as typeof q;
    }
  }
  return q;
}

/** Get a Google access token for Sheets API using a service account */
async function getGoogleSheetsAccessToken(): Promise<string> {
  const saJson = await requireSecret("GOOGLE_SERVICE_ACCOUNT_JSON", "Google Service Account JSON");
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri: string };

  // Build JWT
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(sa.private_key, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const resp = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await resp.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Google auth failed: ${data.error}`);
  return data.access_token;
}

/** ElevenLabs API helper — handles auth and returns raw response */
async function elevenLabsRequest(
  endpoint: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; isFormData?: boolean } = {}
): Promise<Response> {
  const apiKey = await requireSecret("ELEVENLABS_API_KEY", "ElevenLabs API Key");
  const method = options.method || "GET";
  const headers: Record<string, string> = { "xi-api-key": apiKey, ...options.headers };

  let fetchBody: BodyInit | undefined;
  if (options.isFormData) {
    // FormData: let fetch set Content-Type with boundary
    fetchBody = options.body as unknown as FormData;
  } else if (options.body) {
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    fetchBody = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    return await fetch(`https://api.elevenlabs.io${endpoint}`, {
      method,
      headers: options.isFormData
        ? Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== "content-type"))
        : headers,
      body: fetchBody,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Upload audio binary to Supabase Storage and return the public URL */
async function uploadAudioToStorage(
  audioBuffer: ArrayBuffer,
  prefix: string,
  ext: string = "mp3",
  contentType: string = "audio/mpeg"
): Promise<string> {
  const { randomUUID } = await import("crypto");
  const supabase = await getSupabaseClient();
  const filePath = `${prefix}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("creative-images")
    .upload(filePath, new Uint8Array(audioBuffer), { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from("creative-images").getPublicUrl(filePath);
  return data.publicUrl;
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of any file from the filesystem.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Absolute file path to read." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a file. Use /tmp/{your-name}/ as scratch space when no other path is specified.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Absolute file path to write to." },
        content: { type: "string", description: "File content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description:
      "Execute any shell command. Use /tmp/{your-name}/ as working directory for scratch work.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to run." },
        cwd: {
          type: "string",
          description:
            "Working directory. Defaults to member scratch dir if not specified.",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a given path.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path to list." },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description: "Search for a pattern in code using ripgrep.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for." },
        search_path: {
          type: "string",
          description: "Directory to search in. Defaults to Melleka project root if available.",
        },
        file_glob: {
          type: "string",
          description: "File glob pattern to filter (e.g. '*.tsx'). Optional.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "deploy_site",
    description:
      "Deploy a directory of HTML/CSS/JS files as a live website. Returns a branded melleka.app URL (e.g. client-name.melleka.app).",
    input_schema: {
      type: "object" as const,
      properties: {
        directory: {
          type: "string",
          description: "Absolute path to the directory containing your site files (index.html, etc.).",
        },
        project_name: {
          type: "string",
          description: "Short, descriptive project name used as the subdomain (e.g. 'teachertainment-content' becomes teachertainment-content.melleka.app). ALWAYS provide this.",
        },
      },
      required: ["directory", "project_name"],
    },
  },
  {
    name: "save_memory",
    description:
      "Save a new memory entry with a title and content. Each memory is stored as a separate entry that can be edited or deleted later.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short descriptive title for this memory (e.g. 'Client preferences', 'Project setup notes')." },
        content: { type: "string", description: "Full memory content in markdown." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "append_memory",
    description: "Append a note to an existing memory entry by title. If no matching entry is found, creates a new one.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Title of the memory entry to append to." },
        note: { type: "string", description: "Note to append to the memory entry." },
      },
      required: ["title", "note"],
    },
  },
  {
    name: "delete_memory",
    description: "Delete a memory entry by title.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Title of the memory entry to delete." },
      },
      required: ["title"],
    },
  },
  {
    name: "list_memories",
    description: "List all saved memory entries with their titles and content previews.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "super_agent_task",
    description:
      "Create, update, or list Super Agent Dashboard tasks. Use this to track significant work items, update progress, log errors, and maintain a team-visible task board. Actions: 'create' (new task), 'update' (change status/add notes), 'list' (view tasks).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description: "Action to perform: 'create', 'update', or 'list'.",
        },
        title: {
          type: "string",
          description: "Task title (required for create).",
        },
        description: {
          type: "string",
          description: "Detailed description of the task.",
        },
        priority: {
          type: "string",
          description: "Priority: 'low', 'medium', 'high', 'urgent'. Defaults to 'medium'.",
        },
        category: {
          type: "string",
          description: "Category: 'Ad Campaign', 'SEO', 'Content', 'Client Work', 'Analytics', 'Website', 'Email', 'Report', 'PPC', 'Social Media', 'Development', 'Other'.",
        },
        client_name: {
          type: "string",
          description: "Client name this task is for (optional).",
        },
        requested_by: {
          type: "string",
          description: "Team member who requested this work.",
        },
        task_id: {
          type: "string",
          description: "UUID of the task to update (required for update).",
        },
        status: {
          type: "string",
          description: "New status: 'not_started', 'working_on_it', 'completed', 'in_review', 'error', 'blocked', 'cancelled'.",
        },
        note: {
          type: "string",
          description: "A progress note to append to the task's notes timeline.",
        },
        error_details: {
          type: "string",
          description: "Error details if status is 'error'.",
        },
        links: {
          type: "array",
          description: "Array of {label, url} objects to add to the task's links.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
          },
        },
        filter_status: {
          type: "string",
          description: "Filter by status when listing.",
        },
        filter_client: {
          type: "string",
          description: "Filter by client_name when listing.",
        },
        limit: {
          type: "number",
          description: "Max rows to return (default 20).",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "create_agent",
    description:
      "Spawn a background sub-agent to handle a long-running or parallel task.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: { type: "string", description: "Description of the task for the agent to execute." },
        context: {
          type: "string",
          description: "Additional context or files the agent needs.",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "http_request",
    description:
      "Make an HTTP request to any URL (REST APIs, Google Ads, Slack, etc.). Returns status + response body.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Full URL to request." },
        method: {
          type: "string",
          description: "HTTP method: GET, POST, PUT, PATCH, DELETE. Defaults to GET.",
        },
        headers: {
          type: "object",
          description: "Request headers as key-value pairs (e.g. Authorization, Content-Type).",
        },
        body: {
          type: "object",
          description: "Request body (will be JSON-serialized). Optional.",
        },
        body_string: {
          type: "string",
          description: "Raw request body string (use instead of body when you need exact format).",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "send_email",
    description:
      "Send an email to any recipient. Uses Resend. Requires RESEND_API_KEY to be configured.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient email address (or comma-separated list)." },
        subject: { type: "string", description: "Email subject line." },
        body: {
          type: "string",
          description: "Email body. HTML is supported (e.g. <p>Hello</p>). Plain text also works.",
        },
        from: {
          type: "string",
          description: "Sender name and email. Defaults to 'Melleka Team Hub <onboarding@resend.dev>'.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "create_cron_job",
    description:
      "Schedule a recurring task that Claude will execute automatically. Examples: daily reports, weekly summaries, reminder emails.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Short name for this job (e.g. 'daily-ads-report').",
        },
        cron_expr: {
          type: "string",
          description:
            "Cron expression: '0 9 * * 1-5' = 9am weekdays, '0 8 * * 1' = 8am Mondays, '0 */4 * * *' = every 4 hours.",
        },
        task: {
          type: "string",
          description:
            "What Claude should do when this job runs. Write it as a clear instruction, e.g. 'Pull our Google Ads report for the last 7 days and email it to aimelleka@melleka.io'.",
        },
      },
      required: ["name", "cron_expr", "task"],
    },
  },
  {
    name: "list_cron_jobs",
    description: "List all scheduled cron jobs for this team member.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "delete_cron_job",
    description: "Delete a scheduled cron job by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name of the cron job to delete." },
      },
      required: ["name"],
    },
  },
  {
    name: "google_ads_query",
    description:
      "Query Google Ads data using GAQL (Google Ads Query Language). Use this to pull campaign performance, keywords, ad groups, conversions, spend, clicks, impressions, etc. for any client account.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: {
          type: "string",
          description:
            "Google Ads customer account ID (digits only, e.g. '1234567890'). Use list_google_ads_accounts first if you don't know it.",
        },
        query: {
          type: "string",
          description:
            "GAQL query string. Example: SELECT campaign.name, metrics.clicks, metrics.cost_micros, metrics.impressions FROM campaign WHERE segments.date BETWEEN '2026-02-23' AND '2026-03-01' ORDER BY metrics.cost_micros DESC",
        },
      },
      required: ["customer_id", "query"],
    },
  },
  {
    name: "list_google_ads_accounts",
    description:
      "List all Google Ads accounts accessible with the configured credentials. Use this to find a client's customer ID before running a query.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "supermetrics_query",
    description:
      "Query marketing data from any platform via Supermetrics (Google Analytics, Google Ads, Facebook/Meta Ads, Instagram, LinkedIn, etc.). Returns metrics like impressions, clicks, spend, conversions, sessions, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        ds_id: {
          type: "string",
          description:
            "Data source ID. Common values: GA4 (Google Analytics 4), AW (Google Ads), FA (Facebook Ads), IG (Instagram Insights), LI (LinkedIn Ads), TW (Twitter/X Ads), MA (Mailchimp), BI (Bing/Microsoft Ads), SC (Search Console).",
        },
        ds_accounts: {
          type: "string",
          description:
            "Account IDs to query, comma-separated. Use 'list.all_accounts' to query all connected accounts. Example: '567890' or '567890, 1358618'.",
        },
        fields: {
          type: "string",
          description:
            "Comma-separated list of dimensions and metrics. Examples: 'Date, campaign, impressions, clicks, cost, conversions' for ads, 'Date, sessions, pageviews, users, bounceRate' for analytics.",
        },
        date_range_type: {
          type: "string",
          description:
            "Preset date range. Examples: 'last_7_days', 'last_30_days', 'last_month', 'this_month_inc', 'this_year_inc', 'custom'. Use 'custom' with start_date/end_date for specific ranges.",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format. Required when date_range_type is 'custom'.",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (or 'today'). Required when date_range_type is 'custom'.",
        },
        filter: {
          type: "string",
          description: "Optional filter expression. Example: 'impressions > 0 AND cost > 0'.",
        },
        order_rows: {
          type: "string",
          description: "Optional sort order. Example: 'cost desc, clicks desc'.",
        },
        max_rows: {
          type: "number",
          description: "Max rows to return. Defaults to 1000.",
        },
      },
      required: ["ds_id", "fields"],
    },
  },
  {
    name: "supermetrics_accounts",
    description:
      "List available accounts for a Supermetrics data source. Use this to find account IDs before running a supermetrics_query.",
    input_schema: {
      type: "object" as const,
      properties: {
        ds_id: {
          type: "string",
          description:
            "Data source ID to list accounts for. Examples: GA4, AW, FA, IG, LI, SC.",
        },
      },
      required: ["ds_id"],
    },
  },
  {
    name: "supabase_query",
    description:
      "Query any Supabase table directly. Supports selecting specific columns, filtering, ordering, and limiting. Use this to pull data from team_conversations, team_messages, team_memory, oauth_connections, agent_memory, or any other table.",
    input_schema: {
      type: "object" as const,
      properties: {
        table: { type: "string", description: "Table name to query (e.g. 'team_conversations', 'oauth_connections', 'profiles')." },
        select: { type: "string", description: "Columns to select (e.g. '*' or 'id, name, created_at'). Defaults to '*'." },
        filters: {
          type: "array",
          description: "Array of filter objects. Each has: column, op (eq, neq, gt, gte, lt, lte, like, ilike, in, is), value.",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string" },
              value: {},
            },
          },
        },
        order: { type: "string", description: "Column to order by (e.g. 'created_at'). Append '.desc' for descending (e.g. 'created_at.desc')." },
        limit: { type: "number", description: "Max rows to return. Defaults to 100." },
        project: {
          type: "string",
          description: "Which Supabase project: 'team' (default — includes all command center tables), or 'turbo' (Turbo AI platform). 'genie' is an alias for 'team'.",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "supabase_insert",
    description:
      "Insert one or more rows into any Supabase table. Returns the inserted rows.",
    input_schema: {
      type: "object" as const,
      properties: {
        table: { type: "string", description: "Table name to insert into." },
        rows: {
          type: "array",
          description: "Array of row objects to insert. Each object's keys are column names.",
          items: { type: "object" },
        },
        project: {
          type: "string",
          description: "Which Supabase project: 'team' (default — includes command center tables), or 'turbo'. 'genie' is an alias for 'team'.",
        },
      },
      required: ["table", "rows"],
    },
  },
  {
    name: "supabase_update",
    description:
      "Update rows in any Supabase table matching the given filters. Returns the updated rows.",
    input_schema: {
      type: "object" as const,
      properties: {
        table: { type: "string", description: "Table name to update." },
        values: {
          type: "object",
          description: "Object of column-value pairs to set on matching rows.",
        },
        filters: {
          type: "array",
          description: "Array of filter objects (same as supabase_query). At least one filter is required to prevent accidental full-table updates.",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string" },
              value: {},
            },
          },
        },
        project: {
          type: "string",
          description: "Which Supabase project: 'team' (default — includes command center tables), or 'turbo'. 'genie' is an alias for 'team'.",
        },
      },
      required: ["table", "values", "filters"],
    },
  },
  {
    name: "slack_post",
    description:
      "Post a message to a Slack channel. NEVER post to #general — use a specific channel instead. Requires SLACK_BOT_TOKEN in team_secrets.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Slack channel ID or name (e.g. '#general' or 'C01234ABCDE')." },
        text: { type: "string", description: "Message text. Supports Slack mrkdwn formatting (*bold*, _italic_, `code`, etc.)." },
        thread_ts: { type: "string", description: "Optional thread timestamp to reply in a thread." },
      },
      required: ["channel", "text"],
    },
  },
  {
    name: "slack_history",
    description:
      "Read message history from a Slack channel. Returns the most recent messages.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Slack channel ID (e.g. 'C01234ABCDE'). Use slack_list_channels to find IDs." },
        limit: { type: "number", description: "Number of messages to return (default 20, max 100)." },
      },
      required: ["channel"],
    },
  },
  {
    name: "slack_list_channels",
    description:
      "List all Slack channels the bot has access to. Use this to find channel IDs for slack_post and slack_history.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "slack_send_dm",
    description:
      "Send a direct message to a Slack user by their email address. Use this to proactively reach out to team members. " +
      "The bot will look up the user by email, open a DM channel, and send the message.",
    input_schema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description: "Email address of the Slack user to DM.",
        },
        message: {
          type: "string",
          description: "Message to send. Supports Slack mrkdwn formatting (*bold*, _italic_, `code`, etc.).",
        },
      },
      required: ["email", "message"],
    },
  },
  {
    name: "query_deliverables",
    description:
      "Query the task_deliverables table to see what work has been generated, proposed, or completed. " +
      "Use this at the START of every conversation to check if there are pending deliverables the user should know about. " +
      "Also use when a user mentions a task you previously worked on to recall what was done.",
    input_schema: {
      type: "object" as const,
      properties: {
        assignee_email: {
          type: "string",
          description: "Filter by assignee email. Leave empty to get all deliverables.",
        },
        status: {
          type: "string",
          description: "Filter by status: 'pending_review', 'approved', 'revision_requested', 'in_progress', 'launched', 'rejected'. Leave empty for all.",
        },
        client_name: {
          type: "string",
          description: "Filter by client name. Leave empty for all clients.",
        },
      },
      required: [],
    },
  },
  {
    name: "save_deliverable",
    description:
      "Save a record of completed work to the task_deliverables table. Use this EVERY TIME you generate a deliverable " +
      "(SEO pages, email campaigns, ad proposals, templates, decks, audits, reports, etc.) so it persists across sessions. " +
      "Also use to update the status of an existing deliverable (e.g. when approved, revised, or launched).",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "UUID of existing deliverable to update. Omit when creating a new record.",
        },
        notion_task_name: {
          type: "string",
          description: "The Notion task name this deliverable fulfills.",
        },
        client_name: {
          type: "string",
          description: "Client this deliverable is for.",
        },
        assignee_email: {
          type: "string",
          description: "Email of the person this was sent to / assigned to.",
        },
        assignee_name: {
          type: "string",
          description: "Name of the assignee.",
        },
        deliverable_url: {
          type: "string",
          description: "URL of the branded page with the completed work.",
        },
        deliverable_type: {
          type: "string",
          description: "Type: 'seo_pages', 'email_campaign', 'ad_proposal', 'template', 'deck', 'audit', 'report', 'ad_copy', 'general'.",
        },
        status: {
          type: "string",
          description: "Status: 'pending_review', 'approved', 'revision_requested', 'in_progress', 'launched', 'rejected'.",
        },
        content_summary: {
          type: "string",
          description: "Brief description of what was delivered.",
        },
        revision_notes: {
          type: "string",
          description: "Notes about requested revisions or feedback received.",
        },
        slack_message_ts: {
          type: "string",
          description: "Slack message timestamp for threading follow-ups.",
        },
        slack_channel_id: {
          type: "string",
          description: "Slack DM channel ID for follow-ups.",
        },
      },
      required: [],
    },
  },
  {
    name: "build_deck",
    description:
      "Trigger the full deck generation pipeline for a client. This calls the generate-deck-async edge function which creates a " +
      "performance report deck with QA validation, branding extraction, AI insights, and Supermetrics data processing. " +
      "Returns a deckId and slug immediately — the deck generates in the background. " +
      "Use this instead of manually inserting into the decks table. " +
      "After calling this, poll the deck status using supabase_query on the 'decks' table filtering by the returned deckId. " +
      "When status is 'published' or 'needs_review', the deck is ready at https://teams.melleka.com/deck/{slug}.",
    input_schema: {
      type: "object" as const,
      properties: {
        clientName: {
          type: "string",
          description: "Client name exactly as it appears in managed_clients.",
        },
        dateRangeStart: {
          type: "string",
          description: "Start date in YYYY-MM-DD format.",
        },
        dateRangeEnd: {
          type: "string",
          description: "End date in YYYY-MM-DD format.",
        },
        domain: {
          type: "string",
          description: "Client website domain (e.g. 'example.com') for branding extraction. Optional but recommended.",
        },
        taskNotes: {
          type: "string",
          description: "Freeform notes about completed work this period. These get AI-categorized into platform sections (Google Ads, Meta, SEO, Email, SMS, etc.).",
        },
        supermetricsData: {
          type: "object",
          description: "Pre-fetched Supermetrics ad data keyed by platform (e.g. { google_ads: {...}, meta: {...} }). Optional — if not provided, the pipeline will try to fetch from Looker or directory.",
        },
      },
      required: ["clientName", "dateRangeStart", "dateRangeEnd"],
    },
  },
  {
    name: "generate_image",
    description:
      "Generate an image from a text description using AI. Creates images for ad creatives, social media posts, blog headers, presentations, or any visual content. " +
      "Returns a public URL to the generated image. Use this when building deliverables that need visuals (ad proposals, decks, SEO pages, email campaigns).",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate. Be specific about style, composition, colors, and subject matter.",
        },
        aspect_ratio: {
          type: "string",
          description: "Aspect ratio: '1:1' (square, default), '16:9' (landscape), '9:16' (portrait/stories), '4:3', '3:4'.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description:
      "Generate a premium AI video from a text description using Higgsfield AI. Access to Kling 3.0, Sora 2, MiniMax, and Seedance models. Returns a public URL to the generated video.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "Detailed video description. Write like a cinematographer: specify shot type (wide/medium/close-up), camera movement (dolly, tracking, crane, pan), lighting (direction, quality, color temperature), and mood. Example: 'Medium shot, slow dolly forward: premium headphones on dark surface, soft key light from left, warm rim light from behind, shallow depth of field, aspirational luxury mood, smooth motion.' Avoid vague terms like 'cinematic quality' or 'good lighting' -- be SPECIFIC about camera and light.",
        },
        aspect_ratio: {
          type: "string",
          description: "Aspect ratio: '16:9' (landscape, default), '9:16' (portrait/stories/reels), '1:1' (square).",
        },
        duration: {
          type: "string",
          description: "Duration in seconds. Kling: '5' or '10' (default '5'). Sora: '4', '8', or '12'. MiniMax: '6'.",
        },
        model: {
          type: "string",
          description: "Video model: 'kling-3' (default, best quality), 'kling-2.6', 'sora-2', 'minimax', 'seedance'. Default: 'kling-3'.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "upload_to_storage",
    description:
      "Upload a local file (video, image, document) to permanent Supabase storage and get a public URL. Use this after creating files with run_command (e.g. ffmpeg output, stitched videos, processed images). The returned URL is permanent and shareable.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to the local file to upload (e.g. /tmp/output.mp4, /tmp/final-video.mp4).",
        },
        content_type: {
          type: "string",
          description: "MIME type: 'video/mp4', 'image/png', 'image/jpeg', 'application/pdf', etc. Default: auto-detect from extension.",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "google_sheets_read",
    description:
      "Read data from a Google Sheets spreadsheet. Requires GOOGLE_SERVICE_ACCOUNT_JSON in team_secrets.",
    input_schema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string", description: "The spreadsheet ID from the Google Sheets URL (the part between /d/ and /edit)." },
        range: { type: "string", description: "Cell range in A1 notation (e.g. 'Sheet1!A1:D10' or 'Sheet1'). Defaults to first sheet." },
      },
      required: ["spreadsheet_id"],
    },
  },
  {
    name: "google_sheets_write",
    description:
      "Write data to a Google Sheets spreadsheet. Requires GOOGLE_SERVICE_ACCOUNT_JSON in team_secrets.",
    input_schema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string", description: "The spreadsheet ID." },
        range: { type: "string", description: "Cell range in A1 notation (e.g. 'Sheet1!A1')." },
        values: {
          type: "array",
          description: "2D array of values. Each inner array is a row. Example: [['Name', 'Email'], ['Alice', 'alice@example.com']]",
          items: { type: "array", items: {} },
        },
        append: { type: "boolean", description: "If true, appends rows after existing data instead of overwriting. Defaults to false." },
      },
      required: ["spreadsheet_id", "range", "values"],
    },
  },
  {
    name: "semrush_query",
    description:
      "Query SEMrush for SEO data: domain overview, organic keywords, backlinks, keyword research, competitor analysis, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Report type. Common values: 'domain_organic' (organic keywords), 'domain_adwords' (paid keywords), 'domain_overview' (domain summary), 'url_organic' (URL keywords), 'backlinks_overview' (backlinks), 'phrase_organic' (keyword difficulty), 'phrase_related' (related keywords), 'phrase_questions' (question keywords).",
        },
        domain: { type: "string", description: "Domain to analyze (e.g. 'melleka.com'). Required for domain_* reports." },
        phrase: { type: "string", description: "Keyword phrase. Required for phrase_* reports." },
        url: { type: "string", description: "URL to analyze. Required for url_* reports." },
        database: { type: "string", description: "Country database. Default 'us'. Options: 'us', 'uk', 'ca', 'au', 'de', 'fr', etc." },
        display_limit: { type: "number", description: "Max results to return. Default 10." },
        display_sort: { type: "string", description: "Sort field. Example: 'tr_desc' (traffic desc), 'po_asc' (position asc)." },
        export_columns: { type: "string", description: "Comma-separated columns to include. Varies by report type. Example for domain_organic: 'Ph,Po,Nq,Cp,Ur,Tr'." },
      },
      required: ["type"],
    },
  },
  {
    name: "apollo_search",
    description:
      "Search Apollo.io for people or companies. Use this to find leads, contacts, and company data for prospecting and outreach. Supports searching by job title, company, location, industry, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        search_type: {
          type: "string",
          description: "Type of search: 'people' (find contacts/leads) or 'organizations' (find companies). Default: 'people'.",
        },
        person_titles: {
          type: "array",
          items: { type: "string" },
          description: "Job titles to search for (people search). Example: ['CEO', 'Marketing Director'].",
        },
        person_locations: {
          type: "array",
          items: { type: "string" },
          description: "Locations to filter by. Example: ['California, US', 'New York, US'].",
        },
        q_organization_name: {
          type: "string",
          description: "Company name to search within (people search) or company to find (org search).",
        },
        organization_locations: {
          type: "array",
          items: { type: "string" },
          description: "Organization HQ locations. Example: ['United States'].",
        },
        organization_num_employees_ranges: {
          type: "array",
          items: { type: "string" },
          description: "Employee count ranges. Example: ['1,10', '11,50', '51,200', '201,500', '501,1000', '1001,5000', '5001,10000'].",
        },
        q_keywords: {
          type: "string",
          description: "Keywords to search for in person or org profiles.",
        },
        per_page: {
          type: "number",
          description: "Results per page. Default 10, max 100.",
        },
        page: {
          type: "number",
          description: "Page number for pagination. Default 1.",
        },
      },
      required: ["search_type"],
    },
  },
  {
    name: "apollo_enrich",
    description:
      "Enrich a person or company with Apollo.io data. Provide an email, domain, or name to get full profile data including contact info, company details, social links, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        enrich_type: {
          type: "string",
          description: "Type of enrichment: 'person' or 'organization'. Default: 'person'.",
        },
        email: {
          type: "string",
          description: "Email address to enrich (person enrichment).",
        },
        first_name: {
          type: "string",
          description: "First name (person enrichment, use with last_name and domain).",
        },
        last_name: {
          type: "string",
          description: "Last name (person enrichment, use with first_name and domain).",
        },
        domain: {
          type: "string",
          description: "Company domain for enrichment. Example: 'apollo.io'. Used for both person and org enrichment.",
        },
        organization_name: {
          type: "string",
          description: "Company name (org enrichment). Example: 'Apollo'.",
        },
      },
      required: ["enrich_type"],
    },
  },
  {
    name: "get_current_date",
    description:
      "Get the current date and time in the team's timezone (America/New_York). Use this before constructing any date ranges for API calls to ensure accuracy.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "google_ads_mutate",
    description:
      "Mutate Google Ads resources — create, update, or remove campaigns, budgets, ad groups, ads, keywords, and more. Uses the Google Ads API v23 mutate endpoint with proper authentication (developer token + OAuth). Common operations:\n" +
      "- Pause/enable campaign: resource='campaigns', operations=[{update:{resourceName:'customers/{cid}/campaigns/{id}', status:'PAUSED'}, updateMask:'status'}]\n" +
      "- Update budget: resource='campaignBudgets', operations=[{update:{resourceName:'customers/{cid}/campaignBudgets/{bid}', amountMicros:'50000000'}, updateMask:'amount_micros'}]\n" +
      "- Add negative keyword: resource='campaignCriteria', operations=[{create:{campaign:'customers/{cid}/campaigns/{id}', negative:true, keyword:{text:'free',matchType:'BROAD'}}}]\n" +
      "- Create campaign: resource='campaigns', operations=[{create:{name:'New Campaign', advertisingChannelType:'SEARCH', status:'PAUSED', campaignBudget:'customers/{cid}/campaignBudgets/{bid}'}}]\n" +
      "IMPORTANT: To update a budget, first query the campaign to get the campaign_budget resource name, then mutate campaignBudgets (not campaigns).",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: {
          type: "string",
          description: "Google Ads customer account ID (digits only, e.g. '1234567890').",
        },
        resource: {
          type: "string",
          description:
            "Resource type to mutate. Common values: 'campaigns', 'campaignBudgets', 'adGroups', 'adGroupAds', 'adGroupCriteria', 'campaignCriteria', 'assets', 'adGroupAssets'. See Google Ads API v23 docs for full list.",
        },
        operations: {
          type: "array",
          description:
            "Array of mutation operations. Each operation must have exactly one of: 'create' (new resource object), 'update' (existing resource with resourceName + changed fields), or 'remove' (resource name string to delete). For 'update', also include 'updateMask' with comma-separated field names to update (snake_case).",
          items: {
            type: "object",
            properties: {
              create: { type: "object", description: "New resource to create." },
              update: { type: "object", description: "Existing resource to update. Must include 'resourceName'." },
              updateMask: { type: "string", description: "Comma-separated snake_case field names to update. Required for update operations. Example: 'status' or 'amount_micros' or 'name,status'." },
              remove: { type: "string", description: "Resource name to delete. Example: 'customers/123/campaigns/456'." },
            },
          },
        },
      },
      required: ["customer_id", "resource", "operations"],
    },
  },
  {
    name: "meta_ads_manage",
    description:
      "Read or write Meta (Facebook/Instagram) Ads data via the Graph API v21.0. Authentication: pass the client's access_token (from oauth_connections table), or omit it to auto-lookup the first available token.\n\n" +
      "READ examples:\n" +
      "- List campaigns: method='GET', endpoint='/{ad_account_id}/campaigns', params={fields:'id,name,status,objective,daily_budget,lifetime_budget'}\n" +
      "- Get insights: method='GET', endpoint='/{ad_account_id}/insights', params={fields:'impressions,clicks,spend,cpm,ctr,cpc,actions', date_preset:'last_30d'}\n" +
      "- List ad sets: method='GET', endpoint='/{campaign_id}/adsets', params={fields:'id,name,status,daily_budget,targeting'}\n\n" +
      "WRITE examples:\n" +
      "- Pause campaign: method='POST', endpoint='/{campaign_id}', params={status:'PAUSED'}\n" +
      "- Update budget: method='POST', endpoint='/{campaign_id}', params={daily_budget:'5000'} (budgets in CENTS: $50 = '5000')\n" +
      "- Create campaign: method='POST', endpoint='/{ad_account_id}/campaigns', params={name:'New Campaign', objective:'OUTCOME_LEADS', status:'PAUSED', special_ad_categories:'[]'}\n" +
      "- Create ad set: method='POST', endpoint='/{campaign_id}/adsets', params={name:'Ad Set 1', daily_budget:'5000', billing_event:'IMPRESSIONS', optimization_goal:'LEAD_GENERATION', targeting:'{...}', start_time:'...'}\n\n" +
      "IMPORTANT: Ad account IDs must be prefixed with 'act_' (e.g. 'act_123456789'). Budgets are in CENTS ($50/day = '5000').",
    input_schema: {
      type: "object" as const,
      properties: {
        method: {
          type: "string",
          description: "HTTP method: GET, POST, or DELETE. Default: GET.",
        },
        endpoint: {
          type: "string",
          description: "Graph API endpoint path (without base URL). Examples: '/act_123456789/campaigns', '/12345678/insights', '/12345678' (for updating a campaign by ID).",
        },
        params: {
          type: "object",
          description:
            "Parameters to send. For GET requests, these become query params. For POST requests, these become form body fields. Always include 'fields' for GET requests to specify which data to return.",
        },
        access_token: {
          type: "string",
          description: "Optional. The client's Meta access token from oauth_connections. If omitted, auto-queries oauth_connections for the first available meta_ads token.",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "get_client_accounts",
    description:
      "Look up a client's linked ad accounts, social media pages, GA4 property, domain, and other metadata from the command center database. " +
      "Returns all account mappings (Google Ads, Meta Ads, TikTok, Bing, LinkedIn, Facebook Page, Instagram Account, Ayrshare Profile) plus client profile info. " +
      "The response includes 'accounts' (grouped by platform), 'linked_platforms' (array), and 'total_linked_accounts' (count). " +
      "If 'accounts' is empty {}, the client has no linked accounts. If it has platform keys, those accounts ARE linked and ready to use. " +
      "Platform keys: 'google_ads' = Google Ads customer ID, 'meta_ads' = Meta ad account ID (act_xxx), 'facebook_page' = Facebook Page ID (use with Meta Graph API for published_posts and page insights), 'instagram_account' = IG business account ID, 'ayrshare_profile' = Ayrshare profile key for per-client social media management, 'ghl' = GoHighLevel location ID (sub-account) for CRM operations. " +
      "If client_name is omitted, returns ALL active clients with their linked accounts. " +
      "ALWAYS call this FIRST before any Google Ads, Meta Ads, social media, Supermetrics, GA4, or GoHighLevel operation. Uses smart fuzzy matching on client names.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name to search for (fuzzy, case-insensitive). Omit to get all active clients.",
        },
      },
      required: [],
    },
  },
  {
    name: "ga4_query",
    description:
      "Query Google Analytics 4 data using the GA4 Data API v1. Requires a GA4 property ID (get it from get_client_accounts). " +
      "Returns metrics (sessions, conversions, bounceRate, etc.) broken down by dimensions (date, source/medium, page, device, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        property_id: {
          type: "string",
          description: "GA4 property ID — just the numeric part (e.g. '123456789') or full format 'properties/123456789'.",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description:
            "Metrics to retrieve. Examples: 'sessions', 'totalUsers', 'newUsers', 'bounceRate', 'averageSessionDuration', " +
            "'screenPageViews', 'conversions', 'eventCount', 'totalRevenue', 'ecommercePurchases'. At least 1 required.",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description:
            "Dimensions to group by. Examples: 'date', 'sessionSource', 'sessionMedium', 'sessionSourceMedium', " +
            "'pagePath', 'pageTitle', 'deviceCategory', 'country', 'city', 'sessionCampaignName', 'landingPage'. Optional.",
        },
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD) or relative: 'today', 'yesterday', '7daysAgo', '30daysAgo', '90daysAgo'.",
        },
        end_date: {
          type: "string",
          description: "End date (YYYY-MM-DD) or relative: 'today', 'yesterday'. Defaults to 'today'.",
        },
        dimension_filter: {
          type: "object",
          description: "Optional filter on a dimension. Example: {fieldName:'sessionSourceMedium', stringFilter:{matchType:'CONTAINS', value:'google'}}",
        },
        order_bys: {
          type: "array",
          items: { type: "object" },
          description: "Optional ordering. Example: [{metric:{metricName:'sessions'}, desc:true}]",
        },
        limit: {
          type: "number",
          description: "Max rows to return. Default 100.",
        },
      },
      required: ["property_id", "metrics", "start_date"],
    },
  },
  {
    name: "notion_query_tasks",
    description:
      "Query the Melleka team's Notion task database (IN HOUSE TO-DO). Returns tasks filtered by client name, date range, and completion status. " +
      "Use this to pull completed or pending tasks for a specific client OR all clients (pass empty client_name or omit it). " +
      "Handles client name fuzzy matching automatically (abbreviations, acronyms, partial names). " +
      "Example: notion_query_tasks({client_name:'SDPF', start_date:'2026-02-26', end_date:'2026-03-05', status_filter:'completed'}) " +
      "or notion_query_tasks({status_filter:'pending'}) to get ALL pending tasks across all clients.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name to filter by. Supports fuzzy matching (e.g. 'SDPF' matches 'San Diego Parks Foundation', 'GG' matches 'Global Guard'). Leave empty or omit to return tasks for ALL clients.",
        },
        database_id: {
          type: "string",
          description: "Notion database ID. Defaults to IN HOUSE TO-DO (9e7cd72f-e62c-4514-9456-5f51cbcfe981). Override only if querying a different database.",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format. Filters tasks by last_edited_time >= this date.",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format. Filters tasks by last_edited_time <= this date.",
        },
        status_filter: {
          type: "string",
          description: "Which tasks to return: 'completed' (default) = Done/Archived tasks, 'pending' = in-progress/not-done, 'all' = everything.",
        },
      },
      required: [],
    },
  },
  {
    name: "add_task_to_notion",
    description:
      "Add one or more tasks to the Melleka IN HOUSE TO-DO Notion database. " +
      "Use this when the user asks you to create a task, add a to-do, or assign work. " +
      "Each task needs a task_name and client_name. Optionally set assignee, manager, and status. " +
      "Assignee and manager names are automatically resolved to Notion user IDs.",
    input_schema: {
      type: "object" as const,
      properties: {
        tasks: {
          type: "array",
          description: "Array of tasks to create.",
          items: {
            type: "object",
            properties: {
              task_name: { type: "string", description: "The task title/description." },
              client_name: { type: "string", description: "Client name to tag the task with." },
              assignee: { type: "string", description: "Team member name to assign (e.g. 'Anthony Melleka'). Resolved to Notion user ID automatically." },
              manager: { type: "string", description: "Manager name for the task (e.g. 'Anthony Melleka'). Resolved to Notion user ID automatically." },
              status: { type: "string", description: "Task status. Defaults to '👋 NEW 👋'. Other options: 'In progress', 'Done', etc." },
            },
            required: ["task_name", "client_name"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  // ─── Canva Design Tools ─────────────────────────────────────
  {
    name: "canva_create_design",
    description:
      "Create a new Canva design. Can create presets (doc, whiteboard, presentation) or custom-size designs. Optionally insert an image asset.",
    input_schema: {
      type: "object" as const,
      properties: {
        design_type: {
          type: "string",
          description:
            "Preset type: 'doc', 'whiteboard', 'presentation'. Or use 'custom' for custom dimensions.",
        },
        width: {
          type: "number",
          description: "Width in pixels (40-8000). Required when design_type is 'custom'.",
        },
        height: {
          type: "number",
          description: "Height in pixels (40-8000). Required when design_type is 'custom'.",
        },
        title: {
          type: "string",
          description: "Name for the design (1-255 characters). Optional.",
        },
        asset_id: {
          type: "string",
          description: "Canva asset ID of an image to insert into the design. Optional.",
        },
      },
      required: ["design_type"],
    },
  },
  {
    name: "canva_list_designs",
    description: "List the user's Canva designs. Returns design IDs, titles, edit/view URLs, and thumbnails.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to filter designs by title. Optional.",
        },
        continuation: {
          type: "string",
          description: "Pagination token from a previous response. Optional.",
        },
      },
      required: [],
    },
  },
  {
    name: "canva_get_design",
    description: "Get metadata for a specific Canva design including title, URLs, thumbnail, and page count.",
    input_schema: {
      type: "object" as const,
      properties: {
        design_id: { type: "string", description: "The Canva design ID." },
      },
      required: ["design_id"],
    },
  },
  {
    name: "canva_export_design",
    description:
      "Export a Canva design to PDF, PNG, JPG, GIF, PPTX, or MP4. Creates an async export job and polls for the result. Returns download URLs.",
    input_schema: {
      type: "object" as const,
      properties: {
        design_id: { type: "string", description: "The Canva design ID to export." },
        format: {
          type: "string",
          description: "Export format: 'pdf', 'png', 'jpg', 'gif', 'pptx', or 'mp4'.",
        },
        width: { type: "number", description: "Output width in pixels (40-25000). Optional, for image formats." },
        height: { type: "number", description: "Output height in pixels (40-25000). Optional, for image formats." },
        quality: { type: "number", description: "JPG quality 1-100. Only for jpg format. Optional." },
        transparent_background: { type: "boolean", description: "Transparent background for PNG. Optional." },
        pages: {
          type: "array",
          items: { type: "number" },
          description: "Array of page numbers to export (0-indexed). Optional, exports all pages by default.",
        },
      },
      required: ["design_id", "format"],
    },
  },
  {
    name: "canva_upload_asset",
    description:
      "Upload an asset (image/video) to Canva from a URL. Returns the asset ID for use in designs.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Public URL of the image or video to upload." },
        name: { type: "string", description: "Name for the asset. Optional." },
      },
      required: ["url"],
    },
  },
  {
    name: "canva_list_brand_templates",
    description:
      "List the user's Canva brand templates. Brand templates can be autofilled with custom data to create personalized designs.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query to filter templates. Optional." },
        continuation: { type: "string", description: "Pagination token. Optional." },
      },
      required: [],
    },
  },
  {
    name: "canva_autofill_design",
    description:
      "Create a personalized design by autofilling a Canva brand template with custom text and images. Great for generating personalized marketing materials, invites, proposals, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        brand_template_id: { type: "string", description: "The brand template ID to autofill." },
        title: { type: "string", description: "Title for the new design (1-255 chars). Optional." },
        data: {
          type: "object",
          description:
            'Field-value pairs to autofill. Text fields: { "field_name": { "type": "text", "text": "value" } }. Image fields: { "field_name": { "type": "image", "asset_id": "canva_asset_id" } }.',
        },
      },
      required: ["brand_template_id", "data"],
    },
  },
  {
    name: "automations",
    description:
      "Execute automations via connected Zapier actions (8000+ apps). Supports listing available automations, searching for actions, and executing them.\n\n" +
      "Examples:\n" +
      "- List all available actions: action='list'\n" +
      "- Search for actions: action='search', query='gmail'\n" +
      "- Execute an action: action='execute', tool_name='gmail_send_email', params={to:'user@example.com', subject:'Hello', body:'Test'}\n\n" +
      "IMPORTANT: Always call action='list' first to see what automations are available and what parameters each accepts.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description:
            "Action to perform: 'list' (show all available automations), 'search' (find by name/keyword), or 'execute' (run a specific automation).",
        },
        tool_name: {
          type: "string",
          description:
            "The exact name of the Zapier tool to execute (e.g. 'gmail_send_email'). Required when action='execute'.",
        },
        params: {
          type: "object",
          description:
            "Parameters to pass to the Zapier action. Each action has different required params — use action='list' first to see the schema.",
        },
        query: {
          type: "string",
          description: "Search query to filter available automations. Used with action='search'.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "voice",
    description:
      "Generate voiceovers, sound effects, clone voices, isolate audio, and dub/translate audio using ElevenLabs.\n\n" +
      "Actions:\n" +
      "- speak: Text-to-speech with voice selection and style control\n" +
      "- voices: List or search available voices\n" +
      "- sound_effect: Generate sound effects from a text description\n" +
      "- isolate: Remove background noise from an audio file\n" +
      "- clone: Clone a voice from an audio file URL\n" +
      "- dub: Translate/dub audio to another language\n\n" +
      "Returns a public URL to the generated audio file.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description: "Action: 'speak', 'voices', 'sound_effect', 'isolate', 'clone', or 'dub'.",
        },
        text: {
          type: "string",
          description: "Text to speak (for speak) or description of sound effect (for sound_effect).",
        },
        voice_id: {
          type: "string",
          description: "Voice ID to use for TTS. Use action='voices' to find IDs. Defaults to Rachel (professional female narrator).",
        },
        voice_search: {
          type: "string",
          description: "Search query to find voices by name (for voices action).",
        },
        model: {
          type: "string",
          description: "Model: 'eleven_v3' (best, default), 'eleven_multilingual_v2', 'eleven_turbo_v2_5' (fast), 'eleven_flash_v2_5' (fastest).",
        },
        stability: {
          type: "number",
          description: "Voice stability 0.0-1.0. Lower = more expressive, higher = more consistent. Default 0.5.",
        },
        similarity_boost: {
          type: "number",
          description: "Voice similarity 0.0-1.0. Higher = closer to original voice. Default 0.75.",
        },
        audio_url: {
          type: "string",
          description: "URL of source audio file (for isolate, clone, or dub actions).",
        },
        target_language: {
          type: "string",
          description: "Target language code for dubbing (e.g. 'es', 'fr', 'de', 'ja', 'pt', 'zh').",
        },
        voice_name: {
          type: "string",
          description: "Name for the cloned voice (for clone action).",
        },
        duration: {
          type: "number",
          description: "Duration in seconds for sound effects (max 30). Optional.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "servis_crm",
    description:
      "Query or modify data in Servis CRM (servis.ai) for a specific client. Credentials are per-client — you MUST always provide client_name.\n\n" +
      "ACTIONS:\n" +
      "- list_records: List records from an entity (Contacts, Deals, Accounts, Tasks, etc.). Supports filters, sorting, pagination.\n" +
      "- get_record: Get a single record by entity + record_id.\n" +
      "- create_record: Create a new record. Provide entity + field_values (JSON object with field names as keys).\n" +
      "- update_record: Update a record. Provide entity + record_id + field_values.\n" +
      "- delete_record: Delete a record by entity + record_id.\n" +
      "- list_activities: List activities (emails, calls, notes, meetings) for a record. Provide entity + record_id.\n" +
      "- list_apps: List all available entities/apps in the CRM account.\n" +
      "- list_fields: List all fields for an entity. Useful to discover field names before creating/updating records.\n" +
      "- list_users: List all team members/agents in the CRM account.\n\n" +
      "IMPORTANT: client_name is REQUIRED for every call. CRM credentials are isolated per client and NEVER shared between clients.\n" +
      "Rate limit: 50 requests per 10 seconds.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name (REQUIRED). CRM credentials are looked up per-client. Example: 'Sin City'.",
        },
        action: {
          type: "string",
          description: "Action to perform: list_records, get_record, create_record, update_record, delete_record, list_activities, list_apps, list_fields, list_users.",
        },
        entity: {
          type: "string",
          description: "Entity/app name (e.g. 'contact', 'deal', 'account', 'task'). Required for record operations and list_fields.",
        },
        record_id: {
          type: "string",
          description: "Record ID for get_record, update_record, delete_record, or list_activities.",
        },
        field_values: {
          type: "object",
          description: "Field values for create_record or update_record. Use field system names as keys (get them from list_fields). Example: {\"first_name\": \"John\", \"work_email\": \"john@example.com\"}.",
        },
        filters: {
          type: "array",
          description: "Filters for list_records. Each filter: {\"field\": \"field_name\", \"operator\": \"contains|equals|not_equals|starts_with|after|before|between\", \"value\": \"...\"}.",
          items: { type: "object" },
        },
        order: {
          type: "array",
          description: "Sort order for list_records. Array of [field, direction] pairs. Example: [[\"created_at\", \"desc\"]].",
          items: { type: "array", items: { type: "string" } },
        },
        limit: {
          type: "number",
          description: "Max records to return (default 50, max 200).",
        },
        offset: {
          type: "number",
          description: "Offset for pagination.",
        },
        pattern: {
          type: "string",
          description: "Search pattern/keyword for list_records.",
        },
      },
      required: ["client_name", "action"],
    },
  },
  {
    name: "social_media",
    description:
      "Manage social media via Ayrshare API. Post, schedule, delete, and analyze content across Facebook, Instagram, X/Twitter, LinkedIn, TikTok, Pinterest, Reddit, YouTube, Threads, Telegram, Bluesky, Google Business Profile, and Snapchat. Also supports comments, analytics, hashtag suggestions, AI content generation, media uploads, RSS feeds, and more.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description:
            'Action to perform: "post" (publish/schedule a post), "delete_post" (delete a post), "get_post" (get post by ID), "update_post" (update scheduled post), "history" (get post history), "analytics_post" (post analytics), "analytics_social" (profile analytics), "comment" (add comment), "get_comments" (get comments), "reply_comment" (reply to comment), "delete_comment" (delete comment), "auto_schedule" (set auto-schedule times), "get_auto_schedule" (list schedules), "generate_text" (AI generate post), "generate_rewrite" (AI rewrite post), "generate_translate" (translate post), "upload_media" (upload image/video), "get_media" (list uploaded media), "hashtags_recommend" (suggest hashtags), "hashtags_auto" (auto-add hashtags), "shorten_link" (shorten URL), "add_feed" (add RSS feed), "get_feeds" (list RSS feeds), "get_user" (account info), "get_reviews" (get reviews), "reply_review" (reply to review), "validate_post" (validate before publishing), "send_message" (send DM), "get_messages" (get messages), "brand_search" (search social accounts), "custom" (raw API call).',
        },
        platforms: {
          type: "array",
          items: { type: "string" },
          description:
            'Social platforms to target. Options: "facebook", "instagram", "twitter", "linkedin", "tiktok", "pinterest", "reddit", "youtube", "threads", "telegram", "bluesky", "gmb", "snapchat".',
        },
        post: {
          type: "string",
          description: "Text content for the post.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Array of image/video URLs to include in the post.",
        },
        schedule_date: {
          type: "string",
          description:
            'ISO 8601 date-time to schedule the post (e.g. "2026-03-15T14:00:00Z"). Omit to post immediately.',
        },
        post_id: {
          type: "string",
          description: "Ayrshare post ID (for delete, get, update, analytics, comments).",
        },
        comment: {
          type: "string",
          description: "Comment text (for comment/reply_comment actions).",
        },
        comment_id: {
          type: "string",
          description: "Comment ID (for reply_comment, delete_comment).",
        },
        platform: {
          type: "string",
          description: "Single platform (for history by platform, analytics, brand_search, etc.).",
        },
        params: {
          type: "object",
          description:
            "Additional parameters passed directly to the Ayrshare API. Use for advanced options like title, subreddit, flair_id, pin, shortenLinks, requiresApproval, etc.",
        },
        method: {
          type: "string",
          description: 'HTTP method for "custom" action: GET, POST, PUT, DELETE. Default: GET.',
        },
        endpoint: {
          type: "string",
          description:
            'API endpoint path for "custom" action (e.g. "/user", "/feeds"). Relative to https://api.ayrshare.com/api.',
        },
        profile_key: {
          type: "string",
          description: "Profile key for multi-profile accounts. Omit for primary profile.",
        },
        client_name: {
          type: "string",
          description: "Client name to auto-resolve the Ayrshare profile_key from client_account_mappings (platform='ayrshare_profile'). If provided and the client has a linked Ayrshare profile, the profile_key will be set automatically. Overridden by explicit profile_key parameter.",
        },
      },
      required: ["action"],
    },
  },

  // ── Website Builder Tools ──
  {
    name: "website_create_project",
    description: "Create a new website builder project. Returns the project ID and slug. Always call this before saving pages.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Human-readable project name (e.g. 'Acme Corp Website')" },
        slug: { type: "string", description: "URL-safe slug used as subdomain (e.g. 'acme-corp' -> acme-corp.melleka.app). Lowercase, hyphens only." },
        description: { type: "string", description: "Brief description of the website project." },
      },
      required: ["name", "slug"],
    },
  },
  {
    name: "website_save_page",
    description: "Create or update a page in a website project. Provide the COMPLETE HTML content for the page. Uses upsert by project_id + filename.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the website project." },
        filename: { type: "string", description: "HTML filename (e.g. 'index.html', 'about.html', 'contact.html')." },
        title: { type: "string", description: "Page title for display and SEO." },
        html_content: { type: "string", description: "Complete HTML content of the page including <!DOCTYPE html>, <head>, and <body>." },
      },
      required: ["project_id", "filename", "html_content"],
    },
  },
  {
    name: "website_get_project",
    description: "Get a website project's details including its page list. Optionally fetch full HTML for a specific page.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the website project." },
        page_filename: { type: "string", description: "If provided, also return the full HTML content of this specific page." },
      },
      required: ["project_id"],
    },
  },
  {
    name: "website_list_projects",
    description: "List all website projects for the current team member.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "website_deploy",
    description: "Deploy a website project to production. Publishes all pages as static HTML to Vercel and returns the branded melleka.app URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the website project to deploy." },
        commit_message: { type: "string", description: "Optional note describing what changed in this version." },
      },
      required: ["project_id"],
    },
  },
  {
    name: "website_upload_asset",
    description: "Upload an image or file to the website's asset storage. Accepts a URL to download from or base64-encoded data. Returns a public URL to use in HTML.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the website project." },
        source_url: { type: "string", description: "URL of an image/file to download and store. Use this OR base64_data." },
        base64_data: { type: "string", description: "Base64-encoded file data. Use this OR source_url." },
        filename: { type: "string", description: "Filename with extension (e.g. 'hero-image.jpg', 'logo.png')." },
        content_type: { type: "string", description: "MIME type (e.g. 'image/jpeg', 'image/png', 'video/mp4'). Auto-detected from filename if omitted." },
      },
      required: ["project_id", "filename"],
    },
  },
  // ── Commercial Maker Tools ──
  {
    name: "commercial_create_project",
    description: "Create a new commercial video project. Returns the project ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name of the commercial project (e.g. 'TurboAgency Product Demo')" },
        theme_primary: { type: "string", description: "Primary brand color hex (e.g. '#6366f1'). Optional." },
        theme_accent: { type: "string", description: "Accent color hex (e.g. '#d97706'). Optional." },
      },
      required: ["name"],
    },
  },
  {
    name: "commercial_add_scene",
    description: "Add a scene to a commercial project. Scene types: 'hook' (opening with logo+tagline), 'feature_showcase' (screenshots with title), 'mega_prompt' (typing animation+tasks), 'dual_screenshot' (two screenshots with transition), 'badges' (feature with tech badges), 'stats' (stat cards+feature list), 'cta' (closing call-to-action), 'text_only' (full-screen text). Each scene type has specific props — see the scene type documentation in context.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the commercial project." },
        scene_type: { type: "string", description: "Type of scene: hook, feature_showcase, mega_prompt, dual_screenshot, badges, stats, cta, text_only." },
        props: { type: "object", description: "Scene-specific properties. Varies by scene_type. See scene type catalog." },
        duration_frames: { type: "number", description: "Duration in frames at 30fps. Default 150 (5s). Common: 90 (3s), 150 (5s), 180 (6s), 240 (8s)." },
        scene_order: { type: "number", description: "Position in sequence (0-based). If omitted, appended at end." },
      },
      required: ["project_id", "scene_type", "props"],
    },
  },
  {
    name: "commercial_update_scene",
    description: "Update an existing scene's properties, type, duration, or order.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the commercial project." },
        scene_id: { type: "string", description: "UUID of the scene to update." },
        scene_type: { type: "string", description: "New scene type (optional)." },
        props: { type: "object", description: "Updated props (merged with existing)." },
        duration_frames: { type: "number", description: "Updated duration in frames." },
        fade_in: { type: "number", description: "Fade-in duration in frames (default 12)." },
        fade_out: { type: "number", description: "Fade-out duration in frames (default 12)." },
        scene_order: { type: "number", description: "New position in sequence." },
      },
      required: ["project_id", "scene_id"],
    },
  },
  {
    name: "commercial_remove_scene",
    description: "Delete a scene from a commercial project.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the commercial project." },
        scene_id: { type: "string", description: "UUID of the scene to delete." },
      },
      required: ["project_id", "scene_id"],
    },
  },
  {
    name: "commercial_reorder_scenes",
    description: "Reorder all scenes in a commercial project. Provide scene IDs in the desired order.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the commercial project." },
        scene_ids: { type: "array", items: { type: "string" }, description: "Scene UUIDs in desired order." },
      },
      required: ["project_id", "scene_ids"],
    },
  },
  {
    name: "commercial_update_config",
    description: "Update project-level configuration (theme colors, fps, dimensions).",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the commercial project." },
        name: { type: "string", description: "Updated project name." },
        theme_primary: { type: "string", description: "Primary color hex." },
        theme_accent: { type: "string", description: "Accent color hex." },
        theme_background: { type: "string", description: "Background color hex." },
      },
      required: ["project_id"],
    },
  },
  {
    name: "commercial_get_project",
    description: "Fetch a commercial project with all its scenes. Use this to see current state before making changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "UUID of the commercial project." },
      },
      required: ["project_id"],
    },
  },
  {
    name: "manage_uploads",
    description: "Search, list, describe, and manage uploaded files/images. Use this to find previously uploaded files, get their public URLs for embedding in reports/content/HTML, view specific images, or add descriptions/tags. Actions: 'list' (paginated with filters), 'search' (by name/description), 'view' (single upload details), 'describe' (add description + optionally assign client), 'tag' (add/remove tags), 'delete' (remove upload).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", description: "Action: 'list', 'search', 'view', 'describe', 'tag', 'delete'." },
        upload_id: { type: "string", description: "UUID of a specific upload (required for 'view', 'describe', 'tag', 'delete')." },
        query: { type: "string", description: "Search query — matches original_name or description (for 'search' action)." },
        client_name: { type: "string", description: "Filter by client name (for 'list' and 'search')." },
        batch_id: { type: "string", description: "Filter by batch ID to see all files from one upload session." },
        conversation_id: { type: "string", description: "Filter by conversation ID." },
        mime_filter: { type: "string", description: "Filter by MIME type prefix, e.g. 'image/' (for 'list')." },
        description: { type: "string", description: "Description text to save (for 'describe' action)." },
        tags: { type: "array", items: { type: "string" }, description: "Tags to add (for 'tag'). Prefix with '-' to remove, e.g. ['-old', 'new']." },
        limit: { type: "number", description: "Max results (default 20, max 50)." },
        assign_client: { type: "string", description: "Client name to associate with the upload (for 'describe' action)." },
      },
      required: ["action"],
    },
  },

  // ── GoHighLevel (GHL) Tools ──

  {
    name: "ghl_contacts",
    description:
      "Manage contacts in GoHighLevel CRM for a client. Requires client_name to resolve the GHL location.\n\n" +
      "ACTIONS:\n" +
      "- search_contacts: Search contacts by query, email, phone. Params: query, email, phone, limit, startAfter (cursor)\n" +
      "- get_contact: Get contact by ID. Params: contact_id\n" +
      "- create_contact: Create a new contact. Params: fields (firstName, lastName, email, phone, tags[], source, companyName, address1, city, state, postalCode, country, website, timezone, etc.)\n" +
      "- update_contact: Update a contact. Params: contact_id, fields\n" +
      "- delete_contact: Delete a contact. Params: contact_id\n" +
      "- upsert_contact: Create or update by email/phone dedup. Params: fields\n" +
      "- add_tags: Add tags to a contact. Params: contact_id, tags (string array)\n" +
      "- remove_tags: Remove tags from a contact. Params: contact_id, tags (string array)\n" +
      "- list_tasks: List tasks for a contact. Params: contact_id\n" +
      "- create_task: Create a task on a contact. Params: contact_id, title, dueDate, description\n" +
      "- list_notes: List notes for a contact. Params: contact_id\n" +
      "- create_note: Add a note to a contact. Params: contact_id, body\n" +
      "- list_tags: List all tags in the location\n" +
      "- create_tag: Create a new tag. Params: name\n" +
      "- delete_tag: Delete a tag. Params: tag_id\n" +
      "- get_custom_fields: List custom fields. Params: model (default 'contact')\n" +
      "- bulk_update: Update multiple contacts. Params: contact_ids (array, max 25), fields\n\n" +
      "ALWAYS use get_client_accounts first to verify the client has a GHL location linked (platform='ghl').",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name (REQUIRED). Resolves to GHL locationId via client_account_mappings." },
        action: { type: "string", description: "Action to perform (see list above)." },
        contact_id: { type: "string", description: "Contact ID (for get, update, delete, add_tags, remove_tags, tasks, notes)." },
        fields: { type: "object", description: "Contact fields for create/update/upsert: firstName, lastName, email, phone, tags[], source, companyName, address1, city, state, postalCode, country, website, timezone, customFields[]." },
        query: { type: "string", description: "Search query string." },
        email: { type: "string", description: "Filter by email." },
        phone: { type: "string", description: "Filter by phone." },
        tags: { type: "array", items: { type: "string" }, description: "Tag names for add_tags/remove_tags." },
        contact_ids: { type: "array", items: { type: "string" }, description: "Contact IDs for bulk_update (max 25)." },
        title: { type: "string", description: "Task title." },
        body: { type: "string", description: "Note body." },
        name: { type: "string", description: "Tag name for create_tag." },
        tag_id: { type: "string", description: "Tag ID for delete_tag." },
        dueDate: { type: "string", description: "ISO date for task due date." },
        description: { type: "string", description: "Task description." },
        model: { type: "string", description: "Model type for get_custom_fields (default 'contact')." },
        limit: { type: "number", description: "Max results (default 20, max 100)." },
        startAfter: { type: "string", description: "Pagination cursor from previous response." },
      },
      required: ["client_name", "action"],
    },
  },

  {
    name: "ghl_conversations",
    description:
      "Manage conversations and send messages (SMS, email, WhatsApp) in GoHighLevel for a client.\n\n" +
      "ACTIONS:\n" +
      "- list_conversations: List recent conversations. Params: limit, status (all/read/unread/starred)\n" +
      "- get_conversation: Get a conversation by ID. Params: conversation_id\n" +
      "- search_conversations: Search conversations. Params: query, contact_id\n" +
      "- get_messages: Get messages in a conversation. Params: conversation_id, limit\n" +
      "- send_message: Send a message (SMS, Email, WhatsApp, etc.). Params: contact_id, type (SMS/Email/WhatsApp/GMB/IG/FB/Live_Chat/Custom), message, subject (for email), html (for email HTML body), emailFrom\n" +
      "- update_conversation: Update conversation status. Params: conversation_id, status (read/unread/starred/unstarred)\n" +
      "- create_conversation: Create a new conversation. Params: contact_id\n\n" +
      "For SMS: set type='SMS', message='your text'\n" +
      "For Email: set type='Email', subject='Subject', html='<p>HTML body</p>' or message='plain text'\n" +
      "For WhatsApp: set type='WhatsApp', message='your text'",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name (REQUIRED)." },
        action: { type: "string", description: "Action to perform." },
        conversation_id: { type: "string", description: "Conversation ID." },
        contact_id: { type: "string", description: "Contact ID (for sending messages or creating conversations)." },
        type: { type: "string", description: "Message type: SMS, Email, WhatsApp, GMB, IG, FB, Live_Chat, Custom." },
        message: { type: "string", description: "Message text." },
        subject: { type: "string", description: "Email subject." },
        html: { type: "string", description: "Email HTML body." },
        emailFrom: { type: "string", description: "From email address (optional)." },
        query: { type: "string", description: "Search query." },
        status: { type: "string", description: "Conversation status filter or update value." },
        limit: { type: "number", description: "Max results." },
      },
      required: ["client_name", "action"],
    },
  },

  {
    name: "ghl_calendar",
    description:
      "Manage calendars and appointments in GoHighLevel for a client.\n\n" +
      "ACTIONS:\n" +
      "- list_calendars: List all calendars in the location\n" +
      "- get_calendar: Get calendar details. Params: calendar_id\n" +
      "- create_calendar: Create a calendar. Params: name, description, calendarType (round_robin/event/class_booking/collective/service_menu)\n" +
      "- update_calendar: Update a calendar. Params: calendar_id, fields\n" +
      "- delete_calendar: Delete a calendar. Params: calendar_id\n" +
      "- get_free_slots: Get available booking slots. Params: calendar_id, start_date, end_date, timezone\n" +
      "- list_events: List calendar events/appointments. Params: start_date, end_date, calendar_id, contact_id\n" +
      "- get_event: Get event details. Params: event_id\n" +
      "- create_event: Book an appointment. Params: calendar_id, contact_id, start_time, end_time, title, notes, status\n" +
      "- update_event: Update an event. Params: event_id, fields (status: confirmed/cancelled/showed/noshow/invalid)\n" +
      "- delete_event: Cancel/delete an event. Params: event_id\n" +
      "- list_calendar_groups: List calendar groups\n\n" +
      "Dates: ISO 8601 format (e.g. 2026-03-15T10:00:00-05:00). Timezone defaults to location timezone.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name (REQUIRED)." },
        action: { type: "string", description: "Action to perform." },
        calendar_id: { type: "string", description: "Calendar ID." },
        event_id: { type: "string", description: "Event/appointment ID." },
        contact_id: { type: "string", description: "Contact ID." },
        name: { type: "string", description: "Calendar name." },
        title: { type: "string", description: "Event title." },
        notes: { type: "string", description: "Event notes." },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD or ISO)." },
        end_date: { type: "string", description: "End date (YYYY-MM-DD or ISO)." },
        start_time: { type: "string", description: "Event start time (ISO)." },
        end_time: { type: "string", description: "Event end time (ISO)." },
        timezone: { type: "string", description: "Timezone (e.g. America/New_York)." },
        status: { type: "string", description: "Event status." },
        fields: { type: "object", description: "Fields for update operations." },
        calendarType: { type: "string", description: "Calendar type for creation." },
        description: { type: "string", description: "Calendar description." },
      },
      required: ["client_name", "action"],
    },
  },

  {
    name: "ghl_pipeline",
    description:
      "Manage opportunities and sales pipelines in GoHighLevel for a client.\n\n" +
      "ACTIONS:\n" +
      "- list_pipelines: List all pipelines in the location\n" +
      "- list_stages: List stages in a pipeline. Params: pipeline_id\n" +
      "- search_opportunities: Search opportunities. Params: pipeline_id, stage_id, status (open/won/lost/abandoned/all), query, contact_id, limit\n" +
      "- get_opportunity: Get opportunity details. Params: opportunity_id\n" +
      "- create_opportunity: Create an opportunity. Params: pipeline_id, stage_id, contact_id, name, monetaryValue, status\n" +
      "- update_opportunity: Update an opportunity. Params: opportunity_id, fields (name, stageId, status, monetaryValue, assignedTo)\n" +
      "- delete_opportunity: Delete an opportunity. Params: opportunity_id\n" +
      "- upsert_opportunity: Create or update by pipeline + contact. Params: pipeline_id, contact_id, fields\n\n" +
      "Monetary values in dollars (not cents). Status: open, won, lost, abandoned.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name (REQUIRED)." },
        action: { type: "string", description: "Action to perform." },
        pipeline_id: { type: "string", description: "Pipeline ID." },
        stage_id: { type: "string", description: "Stage ID." },
        opportunity_id: { type: "string", description: "Opportunity ID." },
        contact_id: { type: "string", description: "Contact ID." },
        name: { type: "string", description: "Opportunity name." },
        monetaryValue: { type: "number", description: "Deal value in dollars." },
        status: { type: "string", description: "Status: open, won, lost, abandoned." },
        query: { type: "string", description: "Search query." },
        fields: { type: "object", description: "Fields for update/upsert." },
        assignedTo: { type: "string", description: "User ID to assign." },
        limit: { type: "number", description: "Max results." },
      },
      required: ["client_name", "action"],
    },
  },

  {
    name: "ghl_marketing",
    description:
      "Manage marketing assets in GoHighLevel for a client: campaigns, workflows, forms, funnels, social media, email templates, surveys, blogs.\n\n" +
      "ACTIONS:\n" +
      "- list_campaigns: List campaigns\n" +
      "- list_workflows: List automation workflows (read-only)\n" +
      "- list_forms: List forms\n" +
      "- get_form_submissions: Get form submissions. Params: form_id, limit, page\n" +
      "- list_funnels: List funnels\n" +
      "- get_funnel_pages: Get pages in a funnel. Params: funnel_id\n" +
      "- list_email_templates: List email templates\n" +
      "- list_surveys: List surveys\n" +
      "- get_survey_submissions: Get survey submissions. Params: survey_id, limit, page\n" +
      "- list_social_posts: List social media posts. Params: status, type\n" +
      "- create_social_post: Create a social post. Params: platforms (array: facebook/instagram/linkedin/twitter/tiktok/google_my_business), content, media_urls, schedule_date\n" +
      "- delete_social_post: Delete a social post. Params: post_id\n" +
      "- list_blogs: List blog posts\n\n" +
      "Note: Workflows are read-only via API. Trigger them by adding tags to contacts (use ghl_contacts add_tags).",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name (REQUIRED)." },
        action: { type: "string", description: "Action to perform." },
        form_id: { type: "string", description: "Form ID." },
        funnel_id: { type: "string", description: "Funnel ID." },
        survey_id: { type: "string", description: "Survey ID." },
        post_id: { type: "string", description: "Social post ID." },
        platforms: { type: "array", items: { type: "string" }, description: "Social platforms: facebook, instagram, linkedin, twitter, tiktok, google_my_business." },
        content: { type: "string", description: "Post content text." },
        media_urls: { type: "array", items: { type: "string" }, description: "Media URLs for social posts." },
        schedule_date: { type: "string", description: "ISO date to schedule the post." },
        status: { type: "string", description: "Filter by status." },
        type: { type: "string", description: "Post type filter." },
        limit: { type: "number", description: "Max results." },
        page: { type: "number", description: "Page number." },
      },
      required: ["client_name", "action"],
    },
  },

  {
    name: "ghl_admin",
    description:
      "GoHighLevel admin operations: manage locations (sub-accounts), users, invoices, products, media, documents, custom fields, and raw API access.\n\n" +
      "ACTIONS:\n" +
      "- list_locations: List ALL agency sub-accounts (client_name NOT required)\n" +
      "- get_location: Get location details. Uses client_name to resolve locationId\n" +
      "- list_users: List users/team members in a location\n" +
      "- list_custom_fields: List custom fields. Params: model (contact/opportunity)\n" +
      "- create_custom_field: Create a custom field. Params: name, dataType, model, placeholder\n" +
      "- list_invoices: List invoices. Params: status, limit\n" +
      "- get_invoice: Get invoice details. Params: invoice_id\n" +
      "- create_invoice: Create an invoice. Params: fields (name, contactId, items[], dueDate, etc.)\n" +
      "- list_products: List products\n" +
      "- create_product: Create a product. Params: name, description, prices[]\n" +
      "- list_media: List media files\n" +
      "- upload_media: Upload a file. Params: url (public URL), name\n" +
      "- list_documents: List documents/contracts\n" +
      "- send_document: Send a document. Params: contact_id, template_id\n" +
      "- list_businesses: List businesses\n" +
      "- raw_api: Make any GHL API call not covered above. Params: method (GET/POST/PUT/DELETE), endpoint (e.g. /contacts/), body, params\n\n" +
      "The raw_api action is an escape hatch for any GHL v2 endpoint. Use it when a specific endpoint is not covered by the other GHL tools.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name (required for most actions, optional for list_locations)." },
        action: { type: "string", description: "Action to perform." },
        location_id: { type: "string", description: "Location ID (usually auto-resolved from client_name)." },
        model: { type: "string", description: "Model type for custom fields: contact, opportunity." },
        name: { type: "string", description: "Name for creation operations." },
        dataType: { type: "string", description: "Data type for custom fields." },
        placeholder: { type: "string", description: "Placeholder for custom fields." },
        invoice_id: { type: "string", description: "Invoice ID." },
        contact_id: { type: "string", description: "Contact ID." },
        template_id: { type: "string", description: "Document template ID." },
        url: { type: "string", description: "Public URL for media upload." },
        status: { type: "string", description: "Filter by status." },
        method: { type: "string", description: "HTTP method for raw_api: GET, POST, PUT, DELETE." },
        endpoint: { type: "string", description: "API endpoint path for raw_api (e.g. /contacts/)." },
        body: { type: "object", description: "Request body for raw_api or creation operations." },
        params: { type: "object", description: "Query params for raw_api GET requests." },
        fields: { type: "object", description: "Fields for creation/update operations." },
        limit: { type: "number", description: "Max results." },
        description: { type: "string", description: "Description for products/custom fields." },
        prices: { type: "array", items: { type: "object" }, description: "Price definitions for products." },
      },
      required: ["action"],
    },
  },
];

/** Refresh a Canva OAuth access token and update the DB */
async function refreshCanvaToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  const clientId = await requireSecret("CANVA_CLIENT_ID", "Canva Client ID");
  const clientSecret = await requireSecret("CANVA_CLIENT_SECRET", "Canva Client Secret");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resp = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await resp.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error(`Canva token refresh failed: ${data.error_description || data.error || "Unknown error"}`);
  }

  // Update tokens in DB
  const { supabase } = await import("./supabase.js");
  const expiresAt = new Date(Date.now() + (data.expires_in || 14400) * 1000).toISOString();
  await supabase
    .from("oauth_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt,
    })
    .eq("provider", "canva");

  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

/** Get a valid Canva access token, refreshing if expired */
async function getCanvaToken(): Promise<string> {
  // Check env var first
  const envToken = process.env.CANVA_ACCESS_TOKEN;
  if (envToken) return envToken;

  // Look up from oauth_connections
  const { supabase } = await import("./supabase.js");
  const { data: row } = await supabase
    .from("oauth_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("provider", "canva")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    throw new Error("Canva not connected. Please connect Canva via OAuth first (GET /api/canva/oauth).");
  }

  // Check if token is expired (with 5-min buffer)
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;
  const isExpired = expiresAt && expiresAt.getTime() - 5 * 60 * 1000 < Date.now();

  if (isExpired && row.refresh_token) {
    const refreshed = await refreshCanvaToken(row.refresh_token);
    return refreshed.access_token;
  }

  if (isExpired) {
    throw new Error("Canva access token expired and no refresh token available. Please reconnect via OAuth.");
  }

  return row.access_token;
}

/** Make an authenticated Canva API request */
async function canvaApi(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await getCanvaToken();
  const url = `https://api.canva.com/rest/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

/** Poll a Canva async job until it completes */
async function pollCanvaJob(
  path: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const { ok, data } = await canvaApi("GET", path);
    if (!ok) throw new Error(`Canva job poll error: ${JSON.stringify(data)}`);
    const job = data.job || data;
    if (job.status === "success") return job;
    if (job.status === "failed") throw new Error(`Canva job failed: ${JSON.stringify(job.error || job)}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Canva job timed out after polling.");
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  memberName: string
): Promise<string> {
  const tmpDir = memberTmpDir(memberName);

  console.log(`[tool] ${memberName} | ${toolName}(${JSON.stringify(toolInput).slice(0, 200)})`);
  try {
    switch (toolName) {
      case "read_file": {
        const filePath = toolInput.path as string;
        const content = await fs.readFile(filePath, "utf-8");
        return content.length > 50000
          ? content.slice(0, 50000) + "\n\n[...truncated at 50k chars]"
          : content;
      }

      case "write_file": {
        const filePath = toolInput.path as string;
        const content = toolInput.content as string;
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf-8");
        return `File written successfully: ${filePath}`;
      }

      case "run_command": {
        const command = toolInput.command as string;
        // Default cwd: Melleka project if available, otherwise member's tmp dir
        let cwd = (toolInput.cwd as string) || MELLEKA_PROJECT || tmpDir;
        // Only block truly destructive system-wide commands
        const dangerous =
          /\b(rm\s+-rf\s+\/(?!tmp)|sudo\s+passwd|dd\s+if=\/dev\/zero|mkfs|shutdown|reboot)\b/i;
        if (dangerous.test(command)) {
          return `Error: Command blocked for safety (would damage the server).`;
        }
        // Ensure the cwd exists (especially for tmp dirs)
        try {
          await fs.mkdir(cwd, { recursive: true });
        } catch {
          // ignore if it already exists or can't be created
        }
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          timeout: 120000, // 2 min
          env: safeEnv({ HOME: tmpDir }),
        });
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        return output || "(no output)";
      }

      case "list_files": {
        const dirPath = toolInput.path as string;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
          .map((e) => `${e.isDirectory() ? "[dir]" : "[file]"} ${e.name}`)
          .join("\n") || "(empty directory)";
      }

      case "search_code": {
        const pattern = toolInput.pattern as string;
        const searchPath =
          (toolInput.search_path as string) || MELLEKA_PROJECT || tmpDir;
        const glob = toolInput.file_glob as string | undefined;
        const shellEsc = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
        const globFlag = glob ? `--glob ${shellEsc(glob)}` : "";
        const { stdout } = await execAsync(
          `rg --max-count=5 --max-filesize=500K ${globFlag} ${shellEsc(pattern)} ${shellEsc(searchPath)}`,
          { timeout: 15000 }
        ).catch(() => ({ stdout: "(no matches)" }));
        return stdout || "(no matches)";
      }

      case "deploy_site": {
        const dir = toolInput.directory as string;
        const projectName = toolInput.project_name as string | undefined;
        if (!projectName) {
          return "(deploy completed — provide project_name for a branded URL)";
        }
        const result = await deployToVercel(dir, projectName, tmpDir);

        // Record in website_projects + pages so the site appears in the dashboard
        try {
          const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
          const db = await getSupabaseClient();
          // Upsert by slug — update if re-deploying the same project
          const { data: existing } = await db
            .from("website_projects")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();

          let projectId: string;
          if (existing) {
            projectId = existing.id;
            await db.from("website_projects").update({
              status: "published",
              branded_url: result.brandedUrl,
              vercel_deployment_url: result.vercelUrl,
              vercel_project_id: slug,
              last_deployed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            const { data: inserted } = await db.from("website_projects").insert({
              member_name: memberName,
              name: projectName,
              slug,
              status: "published",
              branded_url: result.brandedUrl,
              vercel_deployment_url: result.vercelUrl,
              vercel_project_id: slug,
              last_deployed_at: new Date().toISOString(),
            }).select("id").single();
            projectId = inserted!.id;
          }

          // Save deployed HTML files as website_pages
          const htmlFiles = await fs.readdir(dir).catch(() => [] as string[]);
          for (let i = 0; i < htmlFiles.length; i++) {
            const fname = htmlFiles[i];
            if (!fname.endsWith(".html")) continue;
            const htmlContent = await fs.readFile(`${dir}/${fname}`, "utf-8").catch(() => "");
            if (!htmlContent) continue;
            const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/is);
            const pageTitle = titleMatch?.[1]?.trim()?.slice(0, 200) || fname.replace(".html", "");
            // Upsert page by project_id + filename
            const { data: existingPage } = await db
              .from("website_pages")
              .select("id")
              .eq("project_id", projectId)
              .eq("filename", fname)
              .maybeSingle();
            if (existingPage) {
              await db.from("website_pages").update({
                html_content: htmlContent,
                title: pageTitle,
                updated_at: new Date().toISOString(),
              }).eq("id", existingPage.id);
            } else {
              await db.from("website_pages").insert({
                project_id: projectId,
                filename: fname,
                title: pageTitle,
                html_content: htmlContent,
                is_homepage: fname === "index.html",
                sort_order: i,
              });
            }
          }
        } catch (dbErr: any) {
          console.warn("[deploy_site] Failed to record in website_projects:", dbErr.message);
        }

        if (result.domainOk) {
          return `Live at: https://${result.brandedUrl}`;
        }
        return `Live at: https://${result.brandedUrl}\n(Note: domain assignment had issues — verify the URL works)`;
      }

      case "save_memory": {
        const title = toolInput.title as string;
        const content = toolInput.content as string;
        await createMemoryEntry(memberName, title, content);
        return `Memory entry "${title}" saved.`;
      }

      case "append_memory": {
        const title = toolInput.title as string;
        const note = toolInput.note as string;
        const existing = await findMemoryByTitle(memberName, title);
        if (existing) {
          const timestamp = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          const updated = `${existing.content}\n\n[${timestamp}] ${note}`;
          await updateMemoryEntry(existing.id, { content: updated });
          return `Appended note to memory "${title}".`;
        } else {
          const timestamp = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          await createMemoryEntry(memberName, title, `[${timestamp}] ${note}`);
          return `Created new memory "${title}" with note.`;
        }
      }

      case "delete_memory": {
        const title = toolInput.title as string;
        const entry = await findMemoryByTitle(memberName, title);
        if (entry) {
          await deleteMemoryEntry(entry.id);
          return `Memory "${title}" deleted.`;
        }
        return `No memory found with title "${title}".`;
      }

      case "list_memories": {
        const entries = await listMemoryEntries(memberName);
        if (entries.length === 0) return "No memories saved yet.";
        return entries
          .map((e) => `- **${e.title}**: ${e.content.slice(0, 100)}${e.content.length > 100 ? "..." : ""}`)
          .join("\n");
      }

      case "create_agent": {
        const task = toolInput.task as string;
        const context = toolInput.context as string | undefined;
        return `Sub-agent task queued: "${task}"${context ? `\nContext: ${context.slice(0, 200)}` : ""}.\nNote: Background agents run asynchronously — results will be saved to your work folder.`;
      }

      case "http_request": {
        const url = toolInput.url as string;
        const method = ((toolInput.method as string) || "GET").toUpperCase();
        const headers = (toolInput.headers as Record<string, string>) || {};
        const body = toolInput.body;
        const bodyString = toolInput.body_string as string | undefined;
        const reqBody = bodyString ?? (body ? JSON.stringify(body) : undefined);
        if (!headers["Content-Type"] && reqBody) {
          headers["Content-Type"] = "application/json";
        }
        // 10-minute timeout — only kills truly dead connections, not slow ones
        const abortCtrl = new AbortController();
        const timeoutId = setTimeout(() => abortCtrl.abort(), 600000);
        try {
          const response = await fetch(url, {
            method,
            headers,
            body: reqBody,
            signal: abortCtrl.signal,
          });
          clearTimeout(timeoutId);
          const text = await response.text();
          const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n[...truncated]" : text;
          return `Status: ${response.status} ${response.statusText}\n\n${truncated}`;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === "AbortError") {
            return `Error: HTTP request to ${url} timed out after 10 minutes. The server is unresponsive.`;
          }
          return `Error: HTTP request failed — ${err.message}`;
        }
      }

      case "send_email": {
        const apiKey = await requireSecret("RESEND_API_KEY", "Resend API Key");
        const to = toolInput.to as string;
        const subject = toolInput.subject as string;
        const htmlBody = toolInput.body as string;
        const defaultFrom = await getSecret("FROM_EMAIL") || "Melleka Team Hub <onboarding@resend.dev>";
        const from = (toolInput.from as string) || defaultFrom;
        const toArray = to.split(",").map((e) => e.trim());
        // Auto-wrap plain text in a basic HTML template
        const html = htmlBody.includes("<") ? htmlBody : `<p>${htmlBody.replace(/\n/g, "<br>")}</p>`;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: toArray, subject, html }),
        });
        const result = await response.json() as Record<string, unknown>;
        if (response.ok) {
          return `Email sent successfully! ID: ${result.id}`;
        }
        return `Error sending email (${response.status}): ${JSON.stringify(result)}`;
      }

      case "create_cron_job": {
        const { supabase } = await import("./supabase.js");
        const jobName = toolInput.name as string;
        const cronExpr = toolInput.cron_expr as string;
        const task = toolInput.task as string;
        const lowerName = memberName.toLowerCase();
        // Upsert (update if same name exists for this member)
        const { error } = await supabase.from("team_cron_jobs").upsert(
          { member_name: lowerName, name: jobName, cron_expr: cronExpr, task, enabled: true },
          { onConflict: "member_name,name" }
        );
        if (error) return `Error saving cron job: ${error.message}`;
        // Notify scheduler to reload
        cronReloadCallbacks.forEach((cb) => cb());
        return `Cron job "${jobName}" scheduled!\nSchedule: ${cronExpr}\nTask: ${task}\n\nIt will run automatically on the server. Use list_cron_jobs to see all your scheduled tasks.`;
      }

      case "list_cron_jobs": {
        const { supabase } = await import("./supabase.js");
        const { data } = await supabase
          .from("team_cron_jobs")
          .select("name, cron_expr, task, enabled, last_run, created_at")
          .eq("member_name", memberName.toLowerCase())
          .order("created_at");
        if (!data || data.length === 0) return "No scheduled cron jobs yet.";
        return data
          .map(
            (j) =>
              `• **${j.name}** [${j.enabled ? "active" : "paused"}]\n  Schedule: ${j.cron_expr} (${TEAM_TIMEZONE})\n  Task: ${j.task}\n  Last run: ${j.last_run ? formatTZ(j.last_run) : "never"}`
          )
          .join("\n\n");
      }

      case "delete_cron_job": {
        const { supabase } = await import("./supabase.js");
        const jobName = toolInput.name as string;

        // Find the job first to get its conversation_id
        const { data: jobToDelete } = await supabase
          .from("team_cron_jobs")
          .select("id, conversation_id")
          .eq("member_name", memberName.toLowerCase())
          .eq("name", jobName)
          .single();

        if (!jobToDelete) return `No job named "${jobName}" found.`;

        // Delete the cron job row
        const { error } = await supabase
          .from("team_cron_jobs")
          .delete()
          .eq("id", jobToDelete.id);
        if (error) return `Error deleting job: ${error.message}`;

        // Clean up the associated conversation and messages
        if (jobToDelete.conversation_id) {
          await supabase
            .from("team_messages")
            .delete()
            .eq("conversation_id", jobToDelete.conversation_id);
          await supabase
            .from("team_conversations")
            .delete()
            .eq("id", jobToDelete.conversation_id);
        }

        cronReloadCallbacks.forEach((cb) => cb());
        return `Cron job "${jobName}" deleted (conversation history cleaned up).`;
      }

      case "google_ads_query": {
        const customerId = (toolInput.customer_id as string).replace(/-/g, "");
        const query = toolInput.query as string;
        const developerToken = await requireSecret("GOOGLE_ADS_DEVELOPER_TOKEN", "Google Ads Developer Token");
        const loginCustomerId = await getSecret("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
        const accessToken = await refreshGoogleToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        };
        if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

        const resp = await fetch(
          `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
          { method: "POST", headers, body: JSON.stringify({ query }) }
        );
        const data = await resp.json() as { results?: unknown[]; error?: unknown };
        if (!resp.ok) {
          return `Google Ads API error (${resp.status}): ${JSON.stringify(data).slice(0, 3000)}`;
        }
        const results = data.results ?? [];
        if (results.length === 0) return "Query returned no results.";
        return JSON.stringify(results, null, 2).slice(0, 12000);
      }

      case "list_google_ads_accounts": {
        const developerToken = await requireSecret("GOOGLE_ADS_DEVELOPER_TOKEN", "Google Ads Developer Token");
        const accessToken = await refreshGoogleToken();
        const loginCustomerId = await getSecret("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
        };
        if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

        const resp = await fetch(
          `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
          { headers }
        );
        const data = await resp.json() as { resourceNames?: string[]; error?: unknown };
        if (!resp.ok) return `Error listing accounts: ${JSON.stringify(data).slice(0, 2000)}`;

        const ids = (data.resourceNames ?? []).map((r) => r.replace("customers/", ""));
        if (ids.length === 0) return "No accessible Google Ads accounts found.";

        // Fetch account names in one batched query using the first ID as the seed
        // (for MCC accounts, use the login customer ID)
        const seedId = (loginCustomerId ?? ids[0]).replace(/-/g, "");
        const nameResp = await fetch(
          `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${seedId}/googleAds:search`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `SELECT customer_client.id, customer_client.descriptive_name, customer_client.level FROM customer_client WHERE customer_client.level <= 1`,
            }),
          }
        );
        const nameData = await nameResp.json() as { results?: Array<{ customerClient: { id: string; descriptiveName: string; level: number } }> };
        if (nameResp.ok && nameData.results?.length) {
          const accounts = nameData.results
            .filter((r) => r.customerClient?.level === 1)
            .map((r) => `• ${r.customerClient.descriptiveName} — ID: ${r.customerClient.id}`)
            .join("\n");
          return `Google Ads client accounts:\n${accounts}\n\nUse the ID with google_ads_query.`;
        }

        return `Accessible account IDs:\n${ids.map((id) => `• ${id}`).join("\n")}\n\nUse google_ads_query with one of these IDs.`;
      }

      case "supermetrics_query": {
        const apiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key");
        const queryParams: Record<string, unknown> = {
          api_key: apiKey,
          ds_id: toolInput.ds_id as string,
          fields: toolInput.fields as string,
        };
        if (toolInput.ds_accounts) queryParams.ds_accounts = toolInput.ds_accounts as string;
        if (toolInput.date_range_type) queryParams.date_range_type = toolInput.date_range_type as string;
        if (toolInput.start_date) queryParams.start_date = toolInput.start_date as string;
        if (toolInput.end_date) queryParams.end_date = toolInput.end_date as string;
        if (toolInput.filter) queryParams.filter = toolInput.filter as string;
        if (toolInput.order_rows) queryParams.order_rows = toolInput.order_rows as string;
        if (toolInput.max_rows) queryParams.max_rows = toolInput.max_rows as number;

        const resp = await fetch(
          `https://api.supermetrics.com/enterprise/v2/query/data/json?json=${encodeURIComponent(JSON.stringify(queryParams))}`,
          { method: "GET" }
        );
        const data = await resp.json() as Record<string, unknown>;
        if (!resp.ok) {
          return `Supermetrics API error (${resp.status}): ${JSON.stringify(data).slice(0, 3000)}`;
        }
        const result = JSON.stringify(data, null, 2);
        return result.length > 12000 ? result.slice(0, 12000) + "\n[...truncated]" : result;
      }

      case "supermetrics_accounts": {
        const apiKey = await requireSecret("SUPERMETRICS_API_KEY", "Supermetrics API Key");
        const dsId = toolInput.ds_id as string;
        const resp = await fetch(
          `https://api.supermetrics.com/enterprise/v2/query/accounts/json?json=${encodeURIComponent(JSON.stringify({ api_key: apiKey, ds_id: dsId }))}`,
          { method: "GET" }
        );
        const data = await resp.json() as Record<string, unknown>;
        if (!resp.ok) {
          return `Supermetrics API error (${resp.status}): ${JSON.stringify(data).slice(0, 3000)}`;
        }
        return JSON.stringify(data, null, 2).slice(0, 8000);
      }

      case "supabase_query": {
        const client = await getSupabaseClient(toolInput.project as string | undefined);
        const table = toolInput.table as string;
        const select = (toolInput.select as string) || "*";
        const limit = (toolInput.limit as number) || 100;
        const filters = toolInput.filters as Array<{ column: string; op: string; value: unknown }> | undefined;
        const orderRaw = toolInput.order as string | undefined;

        let query = client.from(table).select(select);
        query = applyFilters(query as unknown as ReturnType<SupabaseClient["from"]>, filters) as typeof query;
        if (orderRaw) {
          const desc = orderRaw.endsWith(".desc");
          const col = orderRaw.replace(/\.(asc|desc)$/, "");
          query = query.order(col, { ascending: !desc });
        }
        query = query.limit(limit);

        const { data, error } = await query;
        if (error) return `Supabase query error: ${error.message}`;
        if (!data || (data as unknown[]).length === 0) return "Query returned no results.";
        const result = JSON.stringify(data, null, 2);
        return result.length > 12000 ? result.slice(0, 12000) + "\n[...truncated]" : result;
      }

      case "supabase_insert": {
        const client = await getSupabaseClient(toolInput.project as string | undefined);
        const table = toolInput.table as string;
        const rows = toolInput.rows as Record<string, unknown>[];
        const { data, error } = await client.from(table).insert(rows).select();
        if (error) return `Supabase insert error: ${error.message}`;
        return `Inserted ${(data as unknown[])?.length ?? rows.length} row(s).\n${JSON.stringify(data, null, 2).slice(0, 4000)}`;
      }

      case "supabase_update": {
        const client = await getSupabaseClient(toolInput.project as string | undefined);
        const table = toolInput.table as string;
        const values = toolInput.values as Record<string, unknown>;
        const filters = toolInput.filters as Array<{ column: string; op: string; value: unknown }>;
        if (!filters || filters.length === 0) return "Error: At least one filter is required to prevent accidental full-table updates.";
        // Build update query, applying filters manually to avoid complex type juggling
        let q: unknown = client.from(table).update(values);
        for (const f of filters) {
          const method = f.op === "eq" ? "eq" : f.op === "neq" ? "neq" : f.op === "gt" ? "gt" : f.op === "gte" ? "gte" : f.op === "lt" ? "lt" : f.op === "lte" ? "lte" : "eq";
          q = (q as Record<string, (...args: unknown[]) => unknown>)[method](f.column, f.value);
        }
        const { data, error } = await (q as ReturnType<ReturnType<SupabaseClient["from"]>["select"]>).select();
        if (error) return `Supabase update error: ${(error as { message: string }).message}`;
        return `Updated ${(data as unknown[])?.length ?? 0} row(s).\n${JSON.stringify(data, null, 2).slice(0, 4000)}`;
      }

      case "slack_post": {
        const token = await requireSecret("SLACK_BOT_TOKEN", "Slack Bot Token");
        const channel = toolInput.channel as string;
        // HARD BLOCK: never post to #general
        const normalizedChannel = channel.replace(/^#/, "").toLowerCase();
        if (normalizedChannel === "general") {
          return "Error: Posting to #general is not allowed. Use a more specific channel instead.";
        }
        const text = toolInput.text as string;
        const threadTs = toolInput.thread_ts as string | undefined;
        const body: Record<string, string> = { channel, text };
        if (threadTs) body.thread_ts = threadTs;
        const resp = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await resp.json() as { ok: boolean; error?: string; ts?: string; channel?: string };
        if (!data.ok) return `Slack error: ${data.error}`;
        return `Message posted to ${data.channel} (ts: ${data.ts})`;
      }

      case "slack_history": {
        const token = await requireSecret("SLACK_BOT_TOKEN", "Slack Bot Token");
        const channel = toolInput.channel as string;
        const limit = Math.min((toolInput.limit as number) || 20, 100);
        const resp = await fetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json() as { ok: boolean; error?: string; messages?: Array<{ user?: string; text: string; ts: string }> };
        if (!data.ok) return `Slack error: ${data.error}`;
        if (!data.messages?.length) return "No messages found.";
        return data.messages
          .reverse()
          .map((m) => `[${new Date(parseFloat(m.ts) * 1000).toLocaleString("en-US", { timeZone: TEAM_TIMEZONE, dateStyle: "short", timeStyle: "short" })}] ${m.user ?? "bot"}: ${m.text}`)
          .join("\n");
      }

      case "slack_list_channels": {
        const token = await requireSecret("SLACK_BOT_TOKEN", "Slack Bot Token");
        const resp = await fetch("https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json() as { ok: boolean; error?: string; channels?: Array<{ id: string; name: string; is_member: boolean; num_members: number }> };
        if (!data.ok) return `Slack error: ${data.error}`;
        if (!data.channels?.length) return "No channels found.";
        return data.channels
          .map((c) => `• #${c.name} — ID: ${c.id} ${c.is_member ? "(joined)" : ""} (${c.num_members} members)`)
          .join("\n");
      }

      case "slack_send_dm": {
        const token = await requireSecret("SLACK_BOT_TOKEN", "Slack Bot Token");
        const email = toolInput.email as string;
        const message = toolInput.message as string;
        if (!email || !message) return "Error: email and message are required.";

        // Step 1: Look up user by email
        const lookupResp = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lookupData = await lookupResp.json() as { ok: boolean; error?: string; user?: { id: string; real_name?: string } };
        if (!lookupData.ok) {
          if (lookupData.error === "users_not_found") return `No Slack user found with email "${email}". They may not be in this workspace.`;
          return `Slack lookup error: ${lookupData.error}`;
        }
        const userId = lookupData.user!.id;
        const userName = lookupData.user!.real_name || email;

        // Step 2: Open DM channel
        const openResp = await fetch("https://slack.com/api/conversations.open", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ users: userId }),
        });
        const openData = await openResp.json() as { ok: boolean; error?: string; channel?: { id: string } };
        if (!openData.ok) return `Slack DM open error: ${openData.error}`;
        const dmChannelId = openData.channel!.id;

        // Step 3: Send message
        const sendResp = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ channel: dmChannelId, text: message }),
        });
        const sendData = await sendResp.json() as { ok: boolean; error?: string; ts?: string };
        if (!sendData.ok) return `Slack send error: ${sendData.error}`;
        return `DM sent to ${userName} (${email}) successfully.`;
      }

      case "query_deliverables": {
        const filters: string[] = [];
        const assigneeEmail = toolInput.assignee_email as string | undefined;
        const statusFilter = toolInput.status as string | undefined;
        const clientFilter = toolInput.client_name as string | undefined;
        if (assigneeEmail) filters.push(`assignee_email=ilike.*${encodeURIComponent(assigneeEmail)}*`);
        if (statusFilter) filters.push(`status=eq.${encodeURIComponent(statusFilter)}`);
        if (clientFilter) filters.push(`client_name=ilike.*${encodeURIComponent(clientFilter)}*`);
        const qs = filters.length ? `&${filters.join("&")}` : "";
        const resp = await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/task_deliverables?select=*&order=created_at.desc&limit=50${qs}`,
          { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } }
        );
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          return `Error querying deliverables (${resp.status}): ${JSON.stringify(errData)}`;
        }
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) return "No deliverables found matching those filters.";
        const lines = data.map((d: any) =>
          `- [${d.status}] ${d.notion_task_name} (${d.client_name})${d.deliverable_url ? `\n  URL: ${d.deliverable_url}` : ""}${d.content_summary ? `\n  Summary: ${d.content_summary}` : ""}${d.assignee_name ? `\n  Assignee: ${d.assignee_name}` : ""}${d.revision_notes ? `\n  Revision notes: ${d.revision_notes}` : ""}\n  Created: ${new Date(d.created_at).toLocaleDateString()}\n  ID: ${d.id}`
        );
        return `${data.length} deliverable(s) found:\n\n${lines.join("\n\n")}`;
      }

      case "save_deliverable": {
        const delivId = toolInput.id as string | undefined;
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (toolInput.notion_task_name) payload.notion_task_name = toolInput.notion_task_name;
        if (toolInput.client_name) payload.client_name = toolInput.client_name;
        if (toolInput.assignee_email) payload.assignee_email = toolInput.assignee_email;
        if (toolInput.assignee_name) payload.assignee_name = toolInput.assignee_name;
        if (toolInput.deliverable_url) payload.deliverable_url = toolInput.deliverable_url;
        if (toolInput.deliverable_type) payload.deliverable_type = toolInput.deliverable_type;
        if (toolInput.status) payload.status = toolInput.status;
        if (toolInput.content_summary) payload.content_summary = toolInput.content_summary;
        if (toolInput.revision_notes !== undefined) payload.revision_notes = toolInput.revision_notes;
        if (toolInput.slack_message_ts) payload.slack_message_ts = toolInput.slack_message_ts;
        if (toolInput.slack_channel_id) payload.slack_channel_id = toolInput.slack_channel_id;
        if (toolInput.created_by) payload.created_by = toolInput.created_by;

        if (delivId) {
          // Update existing
          const resp = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/task_deliverables?id=eq.${delivId}`,
            {
              method: "PATCH",
              headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify(payload),
            }
          );
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            return `Error updating deliverable: ${JSON.stringify(errData)}`;
          }
          const data = await resp.json();
          if (Array.isArray(data) && data.length === 0) return `Error: No deliverable found with ID ${delivId}. Use query_deliverables to find the correct ID.`;
          return `Deliverable updated: ${delivId}`;
        } else {
          // Insert new
          if (!payload.notion_task_name || !payload.client_name) return "Error: notion_task_name and client_name are required for new deliverables.";
          payload.created_by = payload.created_by || memberName || "agent";
          const resp = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/task_deliverables`,
            {
              method: "POST",
              headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify(payload),
            }
          );
          const data = await resp.json();
          if (!resp.ok) return `Error saving deliverable: ${JSON.stringify(data)}`;
          const newId = Array.isArray(data) ? data[0]?.id : data?.id;
          return `Deliverable saved with ID: ${newId}`;
        }
      }

      case "build_deck": {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) return "Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.";

        const deckClientName = toolInput.clientName as string;
        const deckDateStart = toolInput.dateRangeStart as string;
        const deckDateEnd = toolInput.dateRangeEnd as string;
        const deckDomain = toolInput.domain as string | undefined;
        const deckTaskNotes = toolInput.taskNotes as string | undefined;
        const deckSupermetricsData = toolInput.supermetricsData as Record<string, unknown> | undefined;

        if (!deckClientName || !deckDateStart || !deckDateEnd) {
          return "Error: clientName, dateRangeStart, and dateRangeEnd are all required.";
        }

        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/generate-deck-async`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              clientName: deckClientName,
              dateRangeStart: deckDateStart,
              dateRangeEnd: deckDateEnd,
              domain: deckDomain,
              taskNotes: deckTaskNotes,
              supermetricsData: deckSupermetricsData,
            }),
          });

          const result = await resp.json();
          if (!resp.ok || !result.success) {
            return `Error triggering deck generation: ${result.error || resp.statusText}`;
          }

          return (
            `Deck generation started!\n` +
            `- Deck ID: ${result.deckId}\n` +
            `- Slug: ${result.slug}\n` +
            `- Status: generating (background)\n` +
            `- View URL (when ready): https://teams.melleka.com/deck/${result.slug}\n\n` +
            `The deck is building in the background. Poll the status with:\n` +
            `supabase_query({ table: "decks", select: "status, content->progress, content->progressMessage, content->error", filters: [{ column: "id", op: "eq", value: "${result.deckId}" }] })\n\n` +
            `When status is "published" or "needs_review", the deck is ready.`
          );
        } catch (err) {
          return `Error calling generate-deck-async: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      case "generate_image": {
        const googleAiKey = process.env.GOOGLE_AI_API_KEY;
        if (!googleAiKey) return "Error: GOOGLE_AI_API_KEY is not configured.";
        const { supabase: sbImg } = await import("./supabase.js");

        const imgPrompt = toolInput.prompt as string;
        const imgAspect = (toolInput.aspect_ratio as string) || "1:1";

        const uploadGenImage = async (buf: Buffer, mimeType: string): Promise<string> => {
          const ext = mimeType.includes("png") ? "png" : "jpg";
          const storagePath = `generated/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error } = await sbImg.storage
            .from("ad-creatives")
            .upload(storagePath, buf, { contentType: mimeType, upsert: false });
          if (error) throw new Error(`Upload failed: ${error.message}`);
          const { data: urlData } = sbImg.storage
            .from("ad-creatives")
            .getPublicUrl(storagePath);
          return urlData.publicUrl;
        };

        const tryGeminiImgModel = async (model: string): Promise<string | null> => {
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleAiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `Generate an image with the following description. Aspect ratio: ${imgAspect}.\n\n${imgPrompt}` }] }],
                  generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
                }),
              }
            );
            if (!resp.ok) { console.log(`[generate_image] ${model} HTTP ${resp.status}`); return null; }
            const data = await resp.json() as any;
            const parts = data.candidates?.[0]?.content?.parts || [];
            let text = "";
            for (const part of parts) {
              if (part.text) text += part.text;
              if (part.inlineData?.mimeType?.startsWith("image/")) {
                const buf = Buffer.from(part.inlineData.data, "base64");
                const url = await uploadGenImage(buf, part.inlineData.mimeType);
                return `${text}\n\n![Generated Image](${url})`;
              }
            }
            return null;
          } catch (err) { console.error(`[generate_image] ${model} error:`, err); return null; }
        };

        const tryImagenModel = async (model: string): Promise<string | null> => {
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${googleAiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instances: [{ prompt: imgPrompt }], parameters: { sampleCount: 1, aspectRatio: imgAspect } }),
              }
            );
            if (!resp.ok) { console.log(`[generate_image] ${model} HTTP ${resp.status}`); return null; }
            const data = await resp.json() as any;
            const imageB64 = data.predictions?.[0]?.bytesBase64Encoded;
            if (!imageB64) return null;
            const buf = Buffer.from(imageB64, "base64");
            const url = await uploadGenImage(buf, "image/png");
            return `![Generated Image](${url})`;
          } catch (err) { console.error(`[generate_image] ${model} error:`, err); return null; }
        };

        const imgModels: Array<{ name: string; fn: () => Promise<string | null> }> = [
          { name: "gemini-2.0-flash-exp-image-generation", fn: () => tryGeminiImgModel("gemini-2.0-flash-exp-image-generation") },
          { name: "imagen-4.0-generate-001", fn: () => tryImagenModel("imagen-4.0-generate-001") },
        ];

        for (const model of imgModels) {
          console.log(`[generate_image] Trying ${model.name}...`);
          const result = await model.fn();
          if (result) { console.log(`[generate_image] Success with ${model.name}`); return result; }
        }
        return "Image generation failed across all models. The prompt may have been blocked by safety filters. Try rephrasing.";
      }

      case "generate_video": {
        const hfKeyId = process.env.HIGGSFIELD_KEY_ID;
        const hfKeySecret = process.env.HIGGSFIELD_KEY_SECRET;
        if (!hfKeyId || !hfKeySecret) return "Error: HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET are not configured.";
        const { supabase: sbVid } = await import("./supabase.js");

        // Cinematic prompt enhancer - adds missing camera, lighting, film quality, pacing
        const CAMERA_KW = ["shot", "pan", "dolly", "tracking", "zoom", "crane", "orbit", "tilt", "close-up", "closeup", "wide", "medium shot", "aerial", "drone", "handheld", "static", "fixed", "locked", "push-in", "pull-back", "whip"];
        const LIGHT_KW = ["light", "lighting", "shadow", "glow", "rim", "backlit", "golden hour", "sunlight", "neon", "volumetric", "ambient", "illuminat", "key light"];
        const FILM_KW = ["lens", "bokeh", "depth of field", "film grain", "anamorphic", "35mm", "4k", "8k", "red ", "arri", "alexa", "kodak", "cinematic lens", "shallow focus"];
        const PACE_KW = ["slowly", "gradually", "gently", "pauses", "holds", "reveals", "builds", "accelerates", "eases", "smooth motion", "half speed", "slow motion"];
        const hasKw = (t: string, kws: string[]) => kws.some(k => t.toLowerCase().includes(k));

        const enhanceVideoPrompt = (raw: string): string => {
          const parts = [raw.trim()];
          if (!hasKw(raw, CAMERA_KW)) parts.push("Smooth dolly push-in, medium shot framing, steady gimbal-stabilized movement.");
          if (!hasKw(raw, LIGHT_KW)) parts.push("Soft directional key light from camera-left with warm color temperature, subtle rim light separation from background.");
          if (!hasKw(raw, FILM_KW)) parts.push("Cinematic lens with shallow depth of field, professional color grading, rich contrast.");
          if (!hasKw(raw, PACE_KW)) parts.push("Smooth gradual motion building visual interest throughout the shot.");
          parts.push("Photorealistic, broadcast-quality rendering, natural motion at 24fps, film-accurate color science.");
          let out = parts.join(" ");
          const words = out.split(/\s+/);
          if (words.length > 160) out = words.slice(0, 155).join(" ") + ".";
          return out;
        };

        const rawVideoPrompt = toolInput.prompt as string;
        const videoPrompt = enhanceVideoPrompt(rawVideoPrompt);
        const videoAspect = (toolInput.aspect_ratio as string) || "16:9";
        const videoDuration = (toolInput.duration as string) || "5";
        const modelChoice = (toolInput.model as string) || "kling-3";

        const VIDEO_MODEL_MAP: Record<string, string> = {
          "kling-3": "kling-video/v3.0/pro/text-to-video",
          "kling-2.6": "kling-video/v2.6/pro/text-to-video",
          "sora-2": "sora-2/text-to-video",
          "minimax": "minimax/hailuo-02/pro/text-to-video",
          "seedance": "bytedance/seedance/v1.5/pro/text-to-video",
        };
        const endpoint = VIDEO_MODEL_MAP[modelChoice] || VIDEO_MODEL_MAP["kling-3"];
        const hfAuth = `Key ${hfKeyId}:${hfKeySecret}`;
        const hfBase = "https://platform.higgsfield.ai";

        try {
          console.log(`[generate_video] Higgsfield: model=${modelChoice}, endpoint=${endpoint}`);

          // Submit generation request
          const submitBody: Record<string, any> = {
            prompt: videoPrompt,
            duration: parseInt(videoDuration, 10) || 5,
            aspect_ratio: videoAspect,
          };
          if (modelChoice === "seedance") submitBody.seed = Math.floor(Math.random() * 999999);

          const startResp = await fetch(`${hfBase}/${endpoint}`, {
            method: "POST",
            headers: { Authorization: hfAuth, "Content-Type": "application/json" },
            body: JSON.stringify(submitBody),
          });

          if (!startResp.ok) {
            const errText = await startResp.text().catch(() => "");
            return `Video generation failed (${startResp.status}): ${errText.slice(0, 500)}`;
          }

          const startData = await startResp.json() as any;
          const requestId = startData.request_id;
          if (!requestId) return `Video generation failed: no request_id returned. Response: ${JSON.stringify(startData).slice(0, 300)}`;

          console.log(`[generate_video] Higgsfield request_id: ${requestId}`);

          // Poll for completion (max 120 attempts x 5s = 10 minutes)
          const maxPolls = 120;
          for (let i = 0; i < maxPolls; i++) {
            await new Promise(r => setTimeout(r, 5_000));
            const pollResp = await fetch(`${hfBase}/requests/${requestId}/status`, {
              headers: { Authorization: hfAuth },
            });
            if (!pollResp.ok) {
              if (pollResp.status >= 500) continue;
              const pollErr = await pollResp.text().catch(() => "");
              return `Video poll failed (${pollResp.status}): ${pollErr.slice(0, 300)}`;
            }
            const pollData = await pollResp.json() as any;
            console.log(`[generate_video] Poll ${i + 1}: status=${pollData.status}`);

            if (pollData.status === "completed") {
              const videoUrl = pollData.video?.url || pollData.output?.video?.url || pollData.images?.[0]?.url;
              if (!videoUrl) return `Video completed but no URL in response: ${JSON.stringify(pollData).slice(0, 500)}`;

              // Download and upload to Supabase for permanent hosting
              const videoResp = await fetch(videoUrl);
              if (!videoResp.ok) return `Video generated but download failed (${videoResp.status}).`;
              const videoBuf = Buffer.from(await videoResp.arrayBuffer());
              const storagePath = `generated/video-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp4`;
              const { error: uploadErr } = await sbVid.storage
                .from("ad-creatives")
                .upload(storagePath, videoBuf, { contentType: "video/mp4", upsert: false });
              if (uploadErr) return `Video generated but upload failed: ${uploadErr.message}`;
              const { data: urlData } = sbVid.storage.from("ad-creatives").getPublicUrl(storagePath);
              return `Video generated!\n\nWatch here: ${urlData.publicUrl}\n\nDuration: ${videoDuration}s | Aspect: ${videoAspect} | Model: ${modelChoice}`;
            }
            if (pollData.status === "failed") return `Video generation failed. Try a different prompt or model.`;
            if (pollData.status === "nsfw") return `Video blocked by content moderation. Please adjust the prompt.`;
          }
          return `Video generation timed out after 10 minutes. Try again or use a faster model.`;
        } catch (err: any) {
          console.error("[generate_video] Higgsfield error:", err);
          return `Video generation failed: ${err.message || "Unknown error"}`;
        }
      }

      case "upload_to_storage": {
        const { supabase: sbUpload } = await import("./supabase.js");
        const filePath = toolInput.file_path as string;

        try {
          const fileData = await import("fs/promises").then(fs => fs.readFile(filePath));
          const ext = filePath.split(".").pop()?.toLowerCase() || "bin";
          const mimeMap: Record<string, string> = {
            mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
            png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
            pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav",
          };
          const contentType = (toolInput.content_type as string) || mimeMap[ext] || "application/octet-stream";
          const storagePath = `generated/${ext}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

          const { error: uploadErr } = await sbUpload.storage
            .from("ad-creatives")
            .upload(storagePath, fileData, { contentType, upsert: false });
          if (uploadErr) return `Upload failed: ${uploadErr.message}`;

          const { data: urlData } = sbUpload.storage.from("ad-creatives").getPublicUrl(storagePath);
          console.log(`[upload_to_storage] Uploaded ${filePath} -> ${urlData.publicUrl}`);
          return `File uploaded successfully!\n\nPermanent URL: ${urlData.publicUrl}\n\nSize: ${(fileData.length / 1024 / 1024).toFixed(1)}MB | Type: ${contentType}`;
        } catch (err: any) {
          console.error("[upload_to_storage] Error:", err);
          return `Upload failed: ${err.message || "Unknown error"}`;
        }
      }

      case "google_sheets_read": {
        const accessToken = await getGoogleSheetsAccessToken();
        const spreadsheetId = toolInput.spreadsheet_id as string;
        const range = (toolInput.range as string) || "Sheet1";
        const resp = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await resp.json() as { values?: unknown[][]; error?: { message: string } };
        if (!resp.ok) return `Google Sheets error: ${(data.error as { message: string })?.message ?? resp.statusText}`;
        if (!data.values?.length) return "No data found in the specified range.";
        // Format as a readable table
        const result = data.values.map((row) => row.join("\t")).join("\n");
        return result.length > 12000 ? result.slice(0, 12000) + "\n[...truncated]" : result;
      }

      case "google_sheets_write": {
        const accessToken = await getGoogleSheetsAccessToken();
        const spreadsheetId = toolInput.spreadsheet_id as string;
        const range = toolInput.range as string;
        const values = toolInput.values as unknown[][];
        const append = toolInput.append as boolean;

        const url = append
          ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
          : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

        const resp = await fetch(url, {
          method: append ? "POST" : "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ range, values }),
        });
        const data = await resp.json() as { updatedCells?: number; updates?: { updatedCells?: number }; error?: { message: string } };
        if (!resp.ok) return `Google Sheets error: ${(data.error as { message: string })?.message ?? resp.statusText}`;
        const cells = data.updatedCells ?? data.updates?.updatedCells ?? 0;
        return `Successfully ${append ? "appended" : "wrote"} ${values.length} row(s) (${cells} cells) to ${range}.`;
      }

      case "semrush_query": {
        const apiKey = await requireSecret("SEMRUSH_API_KEY", "SEMrush API Key");
        const reportType = toolInput.type as string;
        const params = new URLSearchParams({
          type: reportType,
          key: apiKey,
          export_columns: (toolInput.export_columns as string) || "",
          database: (toolInput.database as string) || "us",
          display_limit: String((toolInput.display_limit as number) || 10),
        });
        if (toolInput.domain) params.set("domain", toolInput.domain as string);
        if (toolInput.phrase) params.set("phrase", toolInput.phrase as string);
        if (toolInput.url) params.set("url", toolInput.url as string);
        if (toolInput.display_sort) params.set("display_sort", toolInput.display_sort as string);
        // Remove empty params
        for (const [k, v] of params) { if (!v) params.delete(k); }

        const resp = await fetch(`https://api.semrush.com/?${params.toString()}`);
        const text = await resp.text();
        if (!resp.ok) return `SEMrush API error (${resp.status}): ${text.slice(0, 2000)}`;
        if (text.startsWith("ERROR")) return `SEMrush error: ${text}`;
        // SEMrush returns semicolon-delimited CSV — convert to readable format
        const lines = text.trim().split("\n");
        if (lines.length <= 1) return text.trim() || "No results found.";
        const headers = lines[0].split(";");
        const rows = lines.slice(1).map((line) => {
          const cols = line.split(";");
          return headers.map((h, i) => `${h}: ${cols[i] ?? ""}`).join(" | ");
        });
        const result = rows.join("\n");
        return result.length > 12000 ? result.slice(0, 12000) + "\n[...truncated]" : result;
      }

      case "apollo_search": {
        const apiKey = await requireSecret("APOLLO_API_KEY", "Apollo API Key");
        const searchType = (toolInput.search_type as string) || "people";
        const endpoint = searchType === "organizations"
          ? "https://api.apollo.io/api/v1/mixed_companies/search"
          : "https://api.apollo.io/api/v1/mixed_people/api_search";

        const body: Record<string, unknown> = {
          per_page: (toolInput.per_page as number) || 10,
          page: (toolInput.page as number) || 1,
        };
        if (toolInput.person_titles) body.person_titles = toolInput.person_titles;
        if (toolInput.person_locations) body.person_locations = toolInput.person_locations;
        if (toolInput.q_organization_name) body.q_organization_name = toolInput.q_organization_name;
        if (toolInput.organization_locations) body.organization_locations = toolInput.organization_locations;
        if (toolInput.organization_num_employees_ranges) body.organization_num_employees_ranges = toolInput.organization_num_employees_ranges;
        if (toolInput.q_keywords) body.q_keywords = toolInput.q_keywords;

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json() as Record<string, unknown>;
        if (!resp.ok) {
          return `Apollo API error (${resp.status}): ${JSON.stringify(data).slice(0, 3000)}`;
        }
        const r = JSON.stringify(data, null, 2);
        return r.length > 12000 ? r.slice(0, 12000) + "\n[...truncated]" : r;
      }

      case "apollo_enrich": {
        const apiKey = await requireSecret("APOLLO_API_KEY", "Apollo API Key");
        const enrichType = (toolInput.enrich_type as string) || "person";

        if (enrichType === "organization") {
          const body: Record<string, unknown> = {};
          if (toolInput.domain) body.domain = toolInput.domain;
          if (toolInput.organization_name) body.organization_name = toolInput.organization_name;

          const resp = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": apiKey,
            },
            body: JSON.stringify(body),
          });
          const data = await resp.json() as Record<string, unknown>;
          if (!resp.ok) {
            return `Apollo API error (${resp.status}): ${JSON.stringify(data).slice(0, 3000)}`;
          }
          const r = JSON.stringify(data, null, 2);
          return r.length > 12000 ? r.slice(0, 12000) + "\n[...truncated]" : r;
        } else {
          const body: Record<string, unknown> = {};
          if (toolInput.email) body.email = toolInput.email;
          if (toolInput.first_name) body.first_name = toolInput.first_name;
          if (toolInput.last_name) body.last_name = toolInput.last_name;
          if (toolInput.domain) body.domain = toolInput.domain;

          const resp = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": apiKey,
            },
            body: JSON.stringify(body),
          });
          const data = await resp.json() as Record<string, unknown>;
          if (!resp.ok) {
            return `Apollo API error (${resp.status}): ${JSON.stringify(data).slice(0, 3000)}`;
          }
          const r = JSON.stringify(data, null, 2);
          return r.length > 12000 ? r.slice(0, 12000) + "\n[...truncated]" : r;
        }
      }

      case "get_current_date": {
        const now = new Date();
        const full = now.toLocaleString("en-US", {
          timeZone: TEAM_TIMEZONE,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        });
        const isoDate = now.toLocaleDateString("en-CA", { timeZone: TEAM_TIMEZONE });
        const dayOfWeek = now.toLocaleDateString("en-US", { timeZone: TEAM_TIMEZONE, weekday: "long" });
        return `Current date/time: ${full}\nISO date: ${isoDate}\nDay of week: ${dayOfWeek}\nTimezone: ${TEAM_TIMEZONE} (Eastern Time)\n\nUse the ISO date (${isoDate}) as "today" when calculating date ranges for API calls.`;
      }

      case "google_ads_mutate": {
        const customerId = (toolInput.customer_id as string).replace(/-/g, "");
        const resource = toolInput.resource as string;
        const operations = toolInput.operations as Array<Record<string, unknown>>;

        if (!customerId || !resource || !operations?.length) {
          return "Error: customer_id, resource, and operations (non-empty array) are all required.";
        }

        const developerToken = await requireSecret("GOOGLE_ADS_DEVELOPER_TOKEN", "Google Ads Developer Token");
        const loginCustomerId = await getSecret("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
        const accessToken = await refreshGoogleToken();

        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        };
        if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

        // Build mapped operations
        const mappedOps = operations.map((op) => {
          const mutateOp: Record<string, unknown> = {};
          if (op.create) mutateOp.create = op.create;
          if (op.update) mutateOp.update = op.update;
          if (op.remove) mutateOp.remove = op.remove;
          if (op.updateMask) mutateOp.updateMask = op.updateMask;
          return mutateOp;
        });

        // Auto-batch: send in chunks of 5 to avoid Google 500 errors on bulk mutations
        const BATCH_SIZE = 5;
        const allResults: unknown[] = [];
        const errors: string[] = [];

        for (let i = 0; i < mappedOps.length; i += BATCH_SIZE) {
          const batch = mappedOps.slice(i, i + BATCH_SIZE);
          const mutateBody = { operations: batch };

          const resp = await fetch(
            `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/${resource}:mutate`,
            { method: "POST", headers, body: JSON.stringify(mutateBody) }
          );
          const data = await resp.json();

          if (!resp.ok) {
            errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error (${resp.status}): ${JSON.stringify(data).slice(0, 1000)}`);
          } else if (data.results) {
            allResults.push(...data.results);
          }
        }

        if (errors.length > 0 && allResults.length === 0) {
          return `Google Ads mutation error:\n${errors.join("\n").slice(0, 4000)}`;
        }

        const summary = allResults.length > 0
          ? `Mutation successful! ${allResults.length}/${mappedOps.length} operations completed.`
          : `Mutation completed.`;
        const resultStr = JSON.stringify({ results: allResults }, null, 2);
        const errNote = errors.length > 0 ? `\n\nPartial errors (${errors.length} batch(es) failed):\n${errors.join("\n").slice(0, 1000)}` : "";
        return `${summary}\n${resultStr.slice(0, 4000)}${errNote}`;
      }

      case "meta_ads_manage": {
        const method = ((toolInput.method as string) || "GET").toUpperCase();
        const endpoint = toolInput.endpoint as string;
        const params = (toolInput.params as Record<string, unknown>) || {};
        let token = toolInput.access_token as string | undefined;

        if (!endpoint) return "Error: endpoint is required.";

        // Token resolution: explicit param → env var → oauth_connections DB
        if (!token) {
          token = process.env.META_ACCESS_TOKEN;
        }
        if (!token) {
          const client = await getSupabaseClient();
          const { data: oauthRow } = await client
            .from("oauth_connections")
            .select("access_token, token_expires_at")
            .eq("provider", "meta_ads")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (oauthRow?.token_expires_at && new Date(oauthRow.token_expires_at) < new Date()) {
            return "Error: Meta access token has expired. Meta tokens expire every 60 days. Please reconnect via OAuth or update META_ACCESS_TOKEN in environment variables. For a permanent solution, use a System User token from Meta Business Manager (these never expire).";
          }
          token = oauthRow?.access_token ?? undefined;
        }
        if (!token) {
          return "Error: No Meta access token available. Set META_ACCESS_TOKEN environment variable (recommended: use a System User token from Meta Business Manager — it never expires), or connect via OAuth.";
        }

        const META_API_VERSION = process.env.META_API_VERSION || "v21.0";
        const baseUrl = `https://graph.facebook.com/${META_API_VERSION}`;

        // Helper: serialize params for POST — handles nested objects (targeting, etc.)
        const buildFormBody = (p: Record<string, unknown>, tok: string): URLSearchParams => {
          const form = new URLSearchParams();
          form.set("access_token", tok);
          for (const [key, val] of Object.entries(p)) {
            if (val === undefined || val === null) continue;
            // Objects/arrays must be JSON-stringified for Meta API
            form.set(key, typeof val === "object" ? JSON.stringify(val) : String(val));
          }
          return form;
        };

        // Helper: serialize params for GET query string
        const buildQueryString = (p: Record<string, unknown>, tok: string): string => {
          const qs = new URLSearchParams();
          qs.set("access_token", tok);
          for (const [key, val] of Object.entries(p)) {
            if (val === undefined || val === null) continue;
            qs.set(key, typeof val === "object" ? JSON.stringify(val) : String(val));
          }
          return qs.toString();
        };

        // Helper: format Meta API errors with actionable guidance
        const formatMetaError = (status: number, data: any): string => {
          const errJson = JSON.stringify(data, null, 2).slice(0, 3000);
          const code = data?.error?.code;
          const subcode = data?.error?.error_subcode;
          let hint = "";
          if (code === 190) hint = "\nHINT: Token is invalid or expired. Update META_ACCESS_TOKEN or reconnect via OAuth.";
          else if (code === 100 && subcode === 33) hint = "\nHINT: Endpoint not found. Check the ad account ID or resource ID.";
          else if (code === 10 || code === 200) hint = "\nHINT: Permission denied. The token may not have ads_management or business_management scope.";
          else if (code === 17 || code === 4) hint = "\nHINT: Rate limited. Wait a moment and retry.";
          else if (code === 2635) hint = "\nHINT: Budget is too low. Meta requires minimum $1/day ($100 in cents).";
          return `Meta API error (${status}):${hint}\n${errJson}`;
        };

        // Auto-resolve page access token for Page API endpoints (published_posts, feed, photos, etc.)
        // The System User token can't read page content directly -- need a page-specific token
        const pageEndpointPattern = /^\/(\d+)\/(published_posts|feed|photos|videos|posts|conversations|messages)/;
        const pageMatch = endpoint.match(pageEndpointPattern);
        if (pageMatch) {
          try {
            const pageId = pageMatch[1];
            const pagesResp = await fetch(`${baseUrl}/me/accounts?fields=id,access_token&limit=200&access_token=${token}`);
            const pagesData = await pagesResp.json() as { data?: Array<{ id: string; access_token: string }> };
            const page = pagesData.data?.find(p => p.id === pageId);
            if (page?.access_token) token = page.access_token;
          } catch { /* fall through with original token */ }
        }

        try {
          if (method === "GET") {
            const url = `${baseUrl}${endpoint}?${buildQueryString(params, token)}`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (!resp.ok) return formatMetaError(resp.status, data);
            const resultStr = JSON.stringify(data, null, 2);
            return resultStr.length > 8000 ? resultStr.slice(0, 8000) + "\n[...truncated]" : resultStr;
          } else if (method === "POST") {
            const resp = await fetch(`${baseUrl}${endpoint}`, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: buildFormBody(params, token).toString(),
            });
            const data = await resp.json();
            if (!resp.ok) return formatMetaError(resp.status, data);
            return `Success!\n${JSON.stringify(data, null, 2).slice(0, 4000)}`;
          } else if (method === "DELETE") {
            const resp = await fetch(`${baseUrl}${endpoint}?${buildQueryString({}, token)}`, { method: "DELETE" });
            const data = await resp.json();
            if (!resp.ok) return formatMetaError(resp.status, data);
            return `Deleted successfully.\n${JSON.stringify(data, null, 2)}`;
          } else {
            return `Error: Unsupported method '${method}'. Use GET, POST, or DELETE.`;
          }
        } catch (fetchErr: any) {
          return `Meta API network error: ${fetchErr.message}. Check if the endpoint and parameters are correct.`;
        }
      }

      case "get_client_accounts": {
        const clientName = toolInput.client_name as string | undefined;
        const client = await getSupabaseClient();

        let matchedClients: typeof allClients = [];
        // Fetch ALL active clients first (needed for fuzzy fallback)
        const { data: allClients, error: cErr } = await client
          .from("managed_clients")
          .select("client_name, domain, ga4_property_id, industry, tier, is_active, primary_conversion_goal, tracked_conversion_types, multi_account_enabled, site_audit_url")
          .eq("is_active", true);
        if (cErr) return `Error querying managed_clients: ${cErr.message}`;
        if (!allClients || allClients.length === 0) return "No active clients found in managed_clients.";

        if (clientName) {
          const search = clientName.toLowerCase().trim();
          // Strategy 1: Exact match (case-insensitive)
          matchedClients = allClients.filter((c) => c.client_name.toLowerCase() === search);
          // Strategy 2: DB name contains search term
          if (matchedClients.length === 0) {
            matchedClients = allClients.filter((c) => c.client_name.toLowerCase().includes(search));
          }
          // Strategy 3: Search term contains DB name (handles "Sin City Diabetics" matching "Sin City")
          if (matchedClients.length === 0) {
            matchedClients = allClients.filter((c) => search.includes(c.client_name.toLowerCase()));
          }
          // Strategy 4: Word overlap (handles "TMI Traffic" matching "TMI")
          if (matchedClients.length === 0) {
            const searchWords = search.split(/[\s\-_]+/).filter(Boolean);
            matchedClients = allClients.filter((c) => {
              const nameWords = c.client_name.toLowerCase().split(/[\s\-_]+/).filter(Boolean);
              return searchWords.some((sw: string) => nameWords.some((nw: string) => nw.includes(sw) || sw.includes(nw)));
            });
          }
          if (matchedClients.length === 0) {
            const allNames = allClients.map((c) => c.client_name).join(", ");
            return `No client found matching "${clientName}". Active clients: ${allNames}`;
          }
          console.log(`[get_client_accounts] Searched "${clientName}" -> matched: ${matchedClients.map((c) => c.client_name).join(", ")}`);
        } else {
          matchedClients = allClients;
        }

        // Fetch all account mappings for matched clients
        const names = matchedClients.map((c) => c.client_name);
        const { data: mappings, error: mapErr } = await client
          .from("client_account_mappings")
          .select("client_name, platform, account_id, account_name")
          .in("client_name", names);
        if (mapErr) console.error(`[get_client_accounts] Error fetching mappings: ${mapErr.message}`);

        // Build result
        const result = matchedClients.map((c) => {
          const accts = (mappings || []).filter((m) => m.client_name === c.client_name);
          const grouped: Record<string, Array<{ account_id: string; account_name: string | null }>> = {};
          for (const a of accts) {
            if (!grouped[a.platform]) grouped[a.platform] = [];
            grouped[a.platform].push({ account_id: a.account_id, account_name: a.account_name });
          }
          return {
            client_name: c.client_name,
            domain: c.domain,
            ga4_property_id: c.ga4_property_id,
            industry: c.industry,
            tier: c.tier,
            primary_conversion_goal: c.primary_conversion_goal,
            tracked_conversion_types: (c as any).tracked_conversion_types,
            multi_account_enabled: (c as any).multi_account_enabled,
            site_audit_url: (c as any).site_audit_url,
            accounts: grouped,
            linked_platforms: Object.keys(grouped),
            total_linked_accounts: Object.values(grouped).flat().length,
          };
        });

        return JSON.stringify(clientName ? result[0] : result, null, 2);
      }

      case "ga4_query": {
        let propertyId = toolInput.property_id as string;
        if (!propertyId) return "Error: property_id is required.";
        // Normalize: remove "properties/" prefix if present, we'll add it back
        propertyId = propertyId.replace(/^properties\//, "");

        const metrics = toolInput.metrics as string[];
        const dimensions = (toolInput.dimensions as string[]) || [];
        const startDate = toolInput.start_date as string;
        const endDate = (toolInput.end_date as string) || "today";
        const dimensionFilter = toolInput.dimension_filter as Record<string, unknown> | undefined;
        const orderBys = toolInput.order_bys as Array<Record<string, unknown>> | undefined;
        const limit = (toolInput.limit as number) || 100;

        if (!metrics || metrics.length === 0) return "Error: at least one metric is required.";
        if (!startDate) return "Error: start_date is required.";

        // Get access token via service account (same as Google Sheets but with analytics scope)
        const saJson = await requireSecret("GOOGLE_SERVICE_ACCOUNT_JSON", "Google Service Account JSON");
        const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri: string };

        const { createSign } = await import("crypto");
        const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
        const now = Math.floor(Date.now() / 1000);
        const payload = Buffer.from(JSON.stringify({
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/analytics.readonly",
          aud: sa.token_uri || "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        })).toString("base64url");
        const sign = createSign("RSA-SHA256");
        sign.update(`${header}.${payload}`);
        const signature = sign.sign(sa.private_key, "base64url");
        const jwt = `${header}.${payload}.${signature}`;

        const tokenResp = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
          }),
        });
        const tokenData = await tokenResp.json() as { access_token?: string; error?: string; error_description?: string };
        if (!tokenData.access_token) {
          return `GA4 auth failed: ${tokenData.error} — ${tokenData.error_description || ""}. Make sure the service account has Viewer access on the GA4 property.`;
        }

        // Build the runReport request body
        const body: Record<string, unknown> = {
          dateRanges: [{ startDate, endDate }],
          metrics: metrics.map((m) => ({ name: m })),
          limit,
        };
        if (dimensions.length > 0) {
          body.dimensions = dimensions.map((d) => ({ name: d }));
        }
        if (dimensionFilter) {
          body.dimensionFilter = dimensionFilter;
        }
        if (orderBys && orderBys.length > 0) {
          body.orderBys = orderBys;
        }

        const resp = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        const data = await resp.json();
        if (!resp.ok) {
          const errMsg = (data as { error?: { message?: string } }).error?.message || JSON.stringify(data);
          return `GA4 API error (${resp.status}): ${errMsg}`;
        }

        // Format the response nicely
        const rows = (data as { rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }> }).rows || [];
        const dimHeaders = dimensions.length > 0 ? dimensions : [];
        const metricHeaders = metrics;

        if (rows.length === 0) {
          return "No data returned for this query. Check the property ID, date range, and that the service account has access.";
        }

        // Build a readable table
        const header_row = [...dimHeaders, ...metricHeaders].join(" | ");
        const separator = [...dimHeaders, ...metricHeaders].map(() => "---").join(" | ");
        const dataRows = rows.map((r) => {
          const dims = (r.dimensionValues || []).map((d) => d.value);
          const mets = (r.metricValues || []).map((m) => m.value);
          return [...dims, ...mets].join(" | ");
        });

        return `GA4 Report (${rows.length} rows):\n\n${header_row}\n${separator}\n${dataRows.join("\n")}`;
      }

      case "notion_query_tasks": {
        const clientName = ((toolInput.client_name as string) || "").trim();

        const notionApiKey = process.env.NOTION_API_KEY;
        if (!notionApiKey) return "Error: NOTION_API_KEY is not configured.";

        const databaseId = (toolInput.database_id as string) || process.env.NOTION_TASK_DATABASE_ID || "9e7cd72f-e62c-4514-9456-5f51cbcfe981";
        const startDate = toolInput.start_date as string | undefined;
        const endDate = toolInput.end_date as string | undefined;
        const statusFilter = (toolInput.status_filter as string) || "completed";

        const notionHeaders = {
          Authorization: `Bearer ${notionApiKey}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        };

        // Build filter clauses
        const filterClauses: unknown[] = [];

        // Always exclude tasks where "Done ?" checkbox is checked
        if (statusFilter !== "all" && statusFilter !== "completed") {
          filterClauses.push({ property: "Done ?", checkbox: { equals: false } });
        }

        if (startDate) {
          filterClauses.push({ timestamp: "last_edited_time", last_edited_time: { on_or_after: startDate } });
        }
        if (endDate) {
          const endPlusOne = new Date(endDate);
          endPlusOne.setDate(endPlusOne.getDate() + 1);
          filterClauses.push({ timestamp: "last_edited_time", last_edited_time: { before: endPlusOne.toISOString().split("T")[0] } });
        }

        const filter = filterClauses.length === 0 ? undefined
          : filterClauses.length === 1 ? filterClauses[0]
          : { and: filterClauses };

        // Paginate through Notion results
        const allTasks: any[] = [];
        let cursor: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const queryBody: any = {
            sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
            page_size: 100,
            ...(filter ? { filter } : {}),
            ...(cursor ? { start_cursor: cursor } : {}),
          };

          let resp: Response | undefined;
          for (let attempt = 0; attempt < 3; attempt++) {
            resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
              method: "POST", headers: notionHeaders, body: JSON.stringify(queryBody),
            });
            if (resp.status === 429) {
              const wait = Math.min(2000 * Math.pow(2, attempt), 10000);
              await new Promise(r => setTimeout(r, wait));
              continue;
            }
            break;
          }

          if (!resp) {
            return "Notion API rate limited after 3 retries. Please try again in a minute.";
          }

          if (!resp.ok) {
            const errText = await resp!.text();
            return `Notion API error (${resp!.status}): ${errText.slice(0, 1000)}`;
          }

          const data = await resp!.json();
          allTasks.push(...(data.results || []));
          hasMore = Boolean(data.has_more);
          cursor = data.next_cursor || undefined;
          if (allTasks.length >= 2000) hasMore = false;
        }

        // Build client name aliases for fuzzy matching
        const clientLower = clientName.toLowerCase().trim();
        const clientWords = clientLower.split(/\s+/).filter(Boolean);
        const aliases = new Set<string>([clientLower]);
        if (clientWords.length > 1) {
          aliases.add(clientWords.map(w => w[0]).join("")); // acronym
          aliases.add(clientWords.slice(0, 2).join(" ")); // first two words
          aliases.add(clientWords[0]); // first word
          aliases.add(clientWords.join("")); // no spaces
          if (clientWords.length >= 3) aliases.add(clientWords.map(w => w[0]).join("").slice(0, 3));
        }
        // Also add the raw input as-is (handles cases like "SDPF", "STJ", "GGIS")
        aliases.add(clientLower.replace(/\s+/g, ""));

        const matchesClient = (clientField: string, title: string): boolean => {
          const field = (clientField || "").toLowerCase();
          const titleLower = (title || "").toLowerCase();
          for (const alias of aliases) {
            if (field.includes(alias) || (alias.length >= 2 && field.includes(alias))) return true;
            if (alias.length >= 3 && titleLower.includes(alias)) return true;
          }
          // Also check if any alias is a substring of the client field or vice versa
          for (const alias of aliases) {
            if (alias.length >= 3 && field && (field.includes(alias) || alias.includes(field))) return true;
          }
          return false;
        };

        // Parse and filter tasks
        const results: Array<{ title: string; status: string; client: string; assignee: string; manager: string; lastEdited: string; isCompleted: boolean }> = [];

        for (const task of allTasks) {
          const props = task.properties || {};

          // Title
          let title = "";
          const titleProp = props["Task name"]?.title || props["Name"]?.title;
          if (titleProp) title = titleProp.map((t: any) => t.plain_text).join("");

          // Status
          let status = "";
          if (props["STATUS"]?.status) status = props["STATUS"].status.name || "";
          else if (props["STATUS"]?.select) status = props["STATUS"].select?.name || "";

          // Client
          let client = "";
          const cp = props["CLIENTS"];
          if (cp?.type === "rich_text") client = cp.rich_text.map((x: any) => x.plain_text).join("");
          else if (cp?.type === "multi_select") client = cp.multi_select.map((x: any) => x.name).join(", ");
          else if (cp?.type === "select") client = cp.select?.name || "";

          // Assignee (include email for Slack DM lookups)
          let assignee = "";
          const assignProp = props["Assign"];
          if (assignProp?.people) assignee = assignProp.people.map((p: any) => {
            const name = p.name || "";
            const email = p.person?.email || "";
            return email ? `${name} <${email}>` : name;
          }).filter(Boolean).join(", ");

          // Manager (separate field for DM routing)
          let manager = "";
          const managerProp = props["Managers"];
          if (managerProp?.people) manager = managerProp.people.map((p: any) => {
            const name = p.name || "";
            const email = p.person?.email || "";
            return email ? `${name} <${email}>` : name;
          }).filter(Boolean).join(", ");

          const lastEdited = task.last_edited_time || "";
          const statusLower = status.toLowerCase();
          const isCompleted = ["done", "good to launch", "archived", "complete", "completed", "finished", "approved", "launched", "published"].some(s => statusLower.includes(s));
          const isNonEssential = statusLower.includes("non-essential") || statusLower.includes("non essential");

          // Check "Done ?" checkbox
          const doneCheckbox = props["Done ?"]?.checkbox === true;

          if (isNonEssential) continue;
          if (clientName && !matchesClient(client, title)) continue;
          if (statusFilter === "completed" && !isCompleted && !doneCheckbox) continue;
          if (statusFilter === "pending" && (isCompleted || doneCheckbox)) continue;

          results.push({ title, status, client, assignee, manager, lastEdited, isCompleted });
        }

        // Format output
        const label = statusFilter === "completed" ? "Completed" : statusFilter === "pending" ? "Pending" : "All";
        const scope = clientName ? `"${clientName}"` : "ALL clients";
        let output = `${label} Tasks for ${scope}\n`;
        output += `Database: IN HOUSE TO-DO | Date range: ${startDate || "all time"} to ${endDate || "present"}\n`;
        output += `Total tasks scanned: ${allTasks.length} | Matched: ${results.length}\n\n`;

        if (results.length === 0) {
          output += `No ${label.toLowerCase()} tasks found for ${scope} in the given date range.\n`;
          if (clientName) output += `\nTip: Try broader date range or different name/alias. Aliases tried: ${[...aliases].join(", ")}`;
        } else {
          for (const t of results) {
            output += `- ${t.title}`;
            if (!clientName && t.client) output += ` [${t.client}]`;
            output += "\n";
            output += `  Status: ${t.status} | Edited: ${new Date(t.lastEdited).toLocaleDateString()}`;
            if (t.assignee) output += ` | Assignee: ${t.assignee}`;
            if (t.manager) output += ` | Manager: ${t.manager}`;
            output += "\n";
          }
        }

        return output;
      }

      case "add_task_to_notion": {
        const notionApiKey = process.env.NOTION_API_KEY;
        if (!notionApiKey) return "Error: NOTION_API_KEY is not configured.";

        const databaseId = process.env.NOTION_TASK_DATABASE_ID || "9e7cd72f-e62c-4514-9456-5f51cbcfe981";
        const ntHeaders = {
          Authorization: `Bearer ${notionApiKey}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        };

        const tasks = toolInput.tasks as Array<{
          task_name: string;
          client_name: string;
          assignee?: string;
          manager?: string;
          status?: string;
        }>;

        if (!tasks || tasks.length === 0) return "Error: No tasks provided. Pass an array of tasks with task_name and client_name.";

        // Fetch Notion workspace users once to resolve names to IDs
        let notionUsers: Array<{ id: string; name: string }> = [];
        const needsUserLookup = tasks.some(t => t.assignee || t.manager);
        if (needsUserLookup) {
          try {
            const usersResp = await fetch("https://api.notion.com/v1/users", { headers: ntHeaders });
            if (usersResp.ok) {
              const usersData = await usersResp.json();
              notionUsers = (usersData.results || [])
                .filter((u: any) => u.type === "person")
                .map((u: any) => ({ id: u.id, name: u.name || "" }));
            }
          } catch { /* proceed without user resolution */ }
        }

        const resolveUserId = (name: string): string | null => {
          if (!name) return null;
          const lower = name.toLowerCase().trim();
          // Exact match first
          const exact = notionUsers.find(u => u.name.toLowerCase() === lower);
          if (exact) return exact.id;
          // Partial/fuzzy match
          const partial = notionUsers.find(u =>
            u.name.toLowerCase().includes(lower) || lower.includes(u.name.toLowerCase())
          );
          if (partial) return partial.id;
          // First name match
          const firstName = lower.split(/\s+/)[0];
          const firstMatch = notionUsers.find(u => u.name.toLowerCase().startsWith(firstName));
          return firstMatch?.id || null;
        };

        const results: Array<{ task_name: string; success: boolean; error?: string; notionId?: string }> = [];

        for (const task of tasks) {
          try {
            const properties: Record<string, any> = {
              "Task name": {
                title: [{ text: { content: task.task_name } }],
              },
              STATUS: {
                status: { name: task.status || "👋 NEW 👋" },
              },
              CLIENTS: {
                rich_text: [{ text: { content: task.client_name } }],
              },
            };

            // Set Teammate (select) and Assign (people) for assignee
            if (task.assignee && task.assignee !== "Unassigned") {
              properties["Teammate"] = {
                select: { name: task.assignee },
              };
              const assigneeId = resolveUserId(task.assignee);
              if (assigneeId) {
                properties["Assign"] = {
                  people: [{ id: assigneeId }],
                };
              }
            }

            // Set Managers (people) for manager
            if (task.manager) {
              const managerId = resolveUserId(task.manager);
              if (managerId) {
                properties["Managers"] = {
                  people: [{ id: managerId }],
                };
              }
            }

            const resp = await fetch(`https://api.notion.com/v1/pages`, {
              method: "POST",
              headers: ntHeaders,
              body: JSON.stringify({
                parent: { database_id: databaseId },
                properties,
              }),
            });

            if (!resp.ok) {
              const err = await resp.json();
              results.push({
                task_name: task.task_name,
                success: false,
                error: err.message || JSON.stringify(err).slice(0, 300),
              });
            } else {
              const data = await resp.json();
              results.push({
                task_name: task.task_name,
                success: true,
                notionId: data.id,
              });
            }

            // Small delay to avoid Notion rate limits
            if (tasks.length > 1) await new Promise((r) => setTimeout(r, 350));
          } catch (err: any) {
            results.push({
              task_name: task.task_name,
              success: false,
              error: err.message,
            });
          }
        }

        const successCount = results.filter((r) => r.success).length;
        let output = `Created ${successCount}/${tasks.length} tasks in Notion.\n\n`;
        for (const r of results) {
          if (r.success) {
            output += `✓ "${r.task_name}" — added (ID: ${r.notionId})\n`;
          } else {
            output += `✗ "${r.task_name}" — failed: ${r.error}\n`;
          }
        }
        return output;
      }

      // ─── Canva Design Tools ─────────────────────────────────────

      case "canva_create_design": {
        const designType = toolInput.design_type as string;
        const title = toolInput.title as string | undefined;
        const assetId = toolInput.asset_id as string | undefined;

        const body: Record<string, unknown> = {};
        if (title) body.title = title;
        if (assetId) body.asset_id = assetId;

        if (designType === "custom") {
          const width = toolInput.width as number;
          const height = toolInput.height as number;
          if (!width || !height) return "Error: width and height are required for custom design type.";
          body.design_type = { type: "custom", width, height };
        } else {
          body.design_type = { type: "preset", name: designType };
        }

        const { ok, data } = await canvaApi("POST", "/designs", body);
        if (!ok) return `Canva error: ${JSON.stringify(data, null, 2)}`;

        const d = data.design;
        return [
          `Design created successfully!`,
          `ID: ${d.id}`,
          `Title: ${d.title}`,
          `Edit URL: ${d.urls?.edit_url}`,
          `View URL: ${d.urls?.view_url}`,
          `Pages: ${d.page_count}`,
          d.thumbnail?.url ? `Thumbnail: ${d.thumbnail.url}` : "",
        ].filter(Boolean).join("\n");
      }

      case "canva_list_designs": {
        const query = toolInput.query as string | undefined;
        const continuation = toolInput.continuation as string | undefined;

        let path = "/designs";
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (continuation) params.set("continuation", continuation);
        const qs = params.toString();
        if (qs) path += `?${qs}`;

        const { ok, data } = await canvaApi("GET", path);
        if (!ok) return `Canva error: ${JSON.stringify(data, null, 2)}`;

        const items = data.items || [];
        if (items.length === 0) return "No designs found.";

        let output = `Found ${items.length} design(s):\n\n`;
        for (const d of items) {
          output += `- ${d.title || "(Untitled)"} [ID: ${d.id}]\n`;
          if (d.urls?.edit_url) output += `  Edit: ${d.urls.edit_url}\n`;
          output += `  Updated: ${d.updated_at ? new Date(d.updated_at * 1000).toLocaleDateString() : "unknown"}\n`;
        }
        if (data.continuation) {
          output += `\n[More results available — use continuation: "${data.continuation}"]`;
        }
        return output;
      }

      case "canva_get_design": {
        const designId = toolInput.design_id as string;
        if (!designId) return "Error: design_id is required.";

        const { ok, data } = await canvaApi("GET", `/designs/${designId}`);
        if (!ok) return `Canva error: ${JSON.stringify(data, null, 2)}`;

        const d = data.design;
        return [
          `Design: ${d.title}`,
          `ID: ${d.id}`,
          `Pages: ${d.page_count}`,
          `Edit URL: ${d.urls?.edit_url}`,
          `View URL: ${d.urls?.view_url}`,
          `Created: ${d.created_at ? new Date(d.created_at * 1000).toLocaleString() : "unknown"}`,
          `Updated: ${d.updated_at ? new Date(d.updated_at * 1000).toLocaleString() : "unknown"}`,
          d.thumbnail?.url ? `Thumbnail: ${d.thumbnail.url} (${d.thumbnail.width}x${d.thumbnail.height})` : "",
        ].filter(Boolean).join("\n");
      }

      case "canva_export_design": {
        const designId = toolInput.design_id as string;
        const format = toolInput.format as string;
        if (!designId || !format) return "Error: design_id and format are required.";

        const formatObj: Record<string, unknown> = { type: format };
        if (toolInput.width) formatObj.width = toolInput.width;
        if (toolInput.height) formatObj.height = toolInput.height;
        if (toolInput.quality) formatObj.quality = toolInput.quality;
        if (toolInput.transparent_background) formatObj.transparent_background = toolInput.transparent_background;
        if (toolInput.pages) formatObj.pages = toolInput.pages;

        const { ok, data } = await canvaApi("POST", "/exports", {
          design_id: designId,
          format: formatObj,
        });
        if (!ok) return `Canva export error: ${JSON.stringify(data, null, 2)}`;

        // Poll for completion
        const jobId = data.job?.id;
        if (!jobId) return `Unexpected response: ${JSON.stringify(data)}`;

        const result = await pollCanvaJob(`/exports/${jobId}`);
        const urls = result.urls || [];
        if (urls.length === 0) return "Export completed but no download URLs returned.";

        let output = `Export complete! Format: ${format.toUpperCase()}\n\nDownload URLs (valid 24 hours):\n`;
        for (const url of urls) {
          output += `- ${url}\n`;
        }
        return output;
      }

      case "canva_upload_asset": {
        const assetUrl = toolInput.url as string;
        const name = toolInput.name as string | undefined;
        if (!assetUrl) return "Error: url is required.";

        const body: Record<string, unknown> = { url: assetUrl };
        if (name) body.name = name;

        const { ok, data } = await canvaApi("POST", "/assets/url", body);
        if (!ok) return `Canva upload error: ${JSON.stringify(data, null, 2)}`;

        // Poll for upload completion
        const jobId = data.job?.id;
        if (!jobId) return `Unexpected response: ${JSON.stringify(data)}`;

        const result = await pollCanvaJob(`/assets/url/${jobId}`);
        const asset = result.asset || result.result?.asset;
        if (!asset) return `Upload completed. Job result: ${JSON.stringify(result)}`;

        return [
          `Asset uploaded successfully!`,
          `Asset ID: ${asset.id}`,
          `Name: ${asset.name || name || "unnamed"}`,
          `Type: ${asset.type || "unknown"}`,
          `Use this asset_id when creating designs or autofilling templates.`,
        ].join("\n");
      }

      case "canva_list_brand_templates": {
        const query = toolInput.query as string | undefined;
        const continuation = toolInput.continuation as string | undefined;

        let path = "/brand-templates";
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (continuation) params.set("continuation", continuation);
        const qs = params.toString();
        if (qs) path += `?${qs}`;

        const { ok, data } = await canvaApi("GET", path);
        if (!ok) return `Canva error: ${JSON.stringify(data, null, 2)}`;

        const items = data.items || [];
        if (items.length === 0) return "No brand templates found.";

        let output = `Found ${items.length} brand template(s):\n\n`;
        for (const t of items) {
          output += `- ${t.title || "(Untitled)"} [ID: ${t.id}]\n`;
          if (t.urls?.view_url) output += `  View: ${t.urls.view_url}\n`;
          if (t.thumbnail?.url) output += `  Thumbnail: ${t.thumbnail.url}\n`;
        }
        if (data.continuation) {
          output += `\n[More results available — use continuation: "${data.continuation}"]`;
        }
        return output;
      }

      case "canva_autofill_design": {
        const templateId = toolInput.brand_template_id as string;
        const data_fields = toolInput.data as Record<string, unknown>;
        const title = toolInput.title as string | undefined;

        if (!templateId || !data_fields) return "Error: brand_template_id and data are required.";

        const body: Record<string, unknown> = {
          brand_template_id: templateId,
          data: data_fields,
        };
        if (title) body.title = title;

        const { ok, data } = await canvaApi("POST", "/autofills", body);
        if (!ok) return `Canva autofill error: ${JSON.stringify(data, null, 2)}`;

        // Poll for completion
        const jobId = data.job?.id;
        if (!jobId) return `Unexpected response: ${JSON.stringify(data)}`;

        const result = await pollCanvaJob(`/autofills/${jobId}`);
        const design = result.result?.design || result.design;
        if (!design) return `Autofill completed. Result: ${JSON.stringify(result)}`;

        return [
          `Design created from template!`,
          `Design ID: ${design.id}`,
          `Title: ${design.title}`,
          `Edit URL: ${design.urls?.edit_url}`,
          `View URL: ${design.urls?.view_url}`,
          design.thumbnail?.url ? `Thumbnail: ${design.thumbnail.url}` : "",
        ].filter(Boolean).join("\n");
      }

      case "automations": {
        const action = toolInput.action as string;

        if (action === "list" || action === "search") {
          const tools = await listZapierTools();
          if (tools.length === 0) {
            return "No Zapier automations configured. To fix: 1) Go to zapier.com/mcp and create an MCP endpoint, 2) Save the endpoint URL (https://mcpp.zapier.app/YOUR-ID) as ZAPIER_MCP_URL in team_secrets, 3) Save the API key (zapier_mcp_key_xxx) as ZAPIER_MCP_API_KEY in team_secrets.";
          }

          let filtered = tools;
          if (action === "search" && toolInput.query) {
            const q = (toolInput.query as string).toLowerCase();
            filtered = tools.filter(
              (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
            );
            if (filtered.length === 0) {
              return `No automations matching "${toolInput.query}". Available: ${tools.map((t) => t.name).join(", ")}`;
            }
          }

          let output = `Available Zapier Automations (${filtered.length}):\n\n`;
          for (const t of filtered) {
            output += `- ${t.name}\n  ${t.description}\n`;
            if (t.inputSchema?.properties) {
              const props = t.inputSchema.properties as Record<string, { type?: string; description?: string }>;
              const required = (t.inputSchema.required as string[]) || [];
              const paramList = Object.entries(props)
                .map(([k, v]) => `    ${k}${required.includes(k) ? " (required)" : ""}: ${v.description || v.type || ""}`)
                .join("\n");
              if (paramList) output += `  Parameters:\n${paramList}\n`;
            }
            output += "\n";
          }
          return output.length > 12000 ? output.slice(0, 12000) + "\n[...truncated]" : output;
        }

        if (action === "execute") {
          const toolName = toolInput.tool_name as string;
          if (!toolName) return "Error: tool_name is required when action='execute'. Call action='list' first to see available tools.";
          const params = (toolInput.params as Record<string, unknown>) || {};
          const result = await callZapierTool(toolName, params);
          if (typeof result === "string") return result;
          const resultStr = JSON.stringify(result, null, 2);
          return resultStr.length > 8000 ? resultStr.slice(0, 8000) + "\n[...truncated]" : resultStr;
        }

        return `Unknown action "${action}". Use "list", "search", or "execute".`;
      }

      case "voice": {
        const action = toolInput.action as string;

        if (action === "speak") {
          const text = toolInput.text as string;
          if (!text) return "Error: text is required for speak action.";
          const voiceId = (toolInput.voice_id as string) || "21m00Tcm4TlvDq8ikWAM"; // Rachel
          const model = (toolInput.model as string) || "eleven_v3";
          const stability = (toolInput.stability as number) ?? 0.5;
          const similarityBoost = (toolInput.similarity_boost as number) ?? 0.75;

          const resp = await elevenLabsRequest(`/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            body: {
              text,
              model_id: model,
              voice_settings: { stability, similarity_boost: similarityBoost },
            },
            headers: { Accept: "audio/mpeg" },
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            return `ElevenLabs TTS error (${resp.status}): ${errBody.slice(0, 500)}`;
          }

          const audioBuffer = await resp.arrayBuffer();
          const url = await uploadAudioToStorage(audioBuffer, "audio-generated");
          const duration = Math.ceil(audioBuffer.byteLength / (128 * 128)); // rough estimate
          return `Voiceover generated!\nAudio URL: ${url}\nVoice: ${voiceId}\nModel: ${model}\nApprox size: ${Math.round(audioBuffer.byteLength / 1024)}KB`;
        }

        if (action === "voices") {
          const search = toolInput.voice_search as string;
          const endpoint = search
            ? `/v1/voices?search=${encodeURIComponent(search)}`
            : "/v1/voices";
          const resp = await elevenLabsRequest(endpoint);
          if (!resp.ok) {
            const errBody = await resp.text();
            return `ElevenLabs voices error (${resp.status}): ${errBody.slice(0, 500)}`;
          }
          const data = await resp.json() as { voices: Array<{ voice_id: string; name: string; category: string; labels: Record<string, string>; description: string }> };
          if (!data.voices?.length) return search ? `No voices found matching "${search}".` : "No voices available.";

          let output = `Available Voices (${data.voices.length}):\n\n`;
          for (const v of data.voices.slice(0, 50)) {
            const labels = v.labels ? Object.entries(v.labels).map(([k, val]) => `${k}: ${val}`).join(", ") : "";
            output += `- ${v.name} (${v.voice_id})\n  Category: ${v.category || "unknown"}${labels ? ` | ${labels}` : ""}\n`;
            if (v.description) output += `  ${v.description.slice(0, 100)}\n`;
            output += "\n";
          }
          return output.length > 8000 ? output.slice(0, 8000) + "\n[...truncated]" : output;
        }

        if (action === "sound_effect") {
          const text = toolInput.text as string;
          if (!text) return "Error: text description is required for sound_effect action.";
          const duration = toolInput.duration as number;

          const body: Record<string, unknown> = { text };
          if (duration) body.duration_seconds = Math.min(duration, 30);

          const resp = await elevenLabsRequest("/v1/sound-generation", {
            method: "POST",
            body,
            headers: { Accept: "audio/mpeg" },
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            return `ElevenLabs SFX error (${resp.status}): ${errBody.slice(0, 500)}`;
          }

          const audioBuffer = await resp.arrayBuffer();
          const url = await uploadAudioToStorage(audioBuffer, "audio-sfx");
          return `Sound effect generated!\nAudio URL: ${url}\nDescription: ${text}\nSize: ${Math.round(audioBuffer.byteLength / 1024)}KB`;
        }

        if (action === "isolate") {
          const audioUrl = toolInput.audio_url as string;
          if (!audioUrl) return "Error: audio_url is required for isolate action.";

          // Download the source audio first
          const sourceResp = await fetch(audioUrl);
          if (!sourceResp.ok) return `Failed to download source audio: ${sourceResp.status}`;
          const sourceBuffer = await sourceResp.arrayBuffer();

          // Send to ElevenLabs for isolation
          const formData = new FormData();
          formData.append("audio", new Blob([sourceBuffer]), "audio.mp3");

          const resp = await elevenLabsRequest("/v1/audio-isolation", {
            method: "POST",
            body: formData,
            isFormData: true,
            headers: { Accept: "audio/mpeg" },
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            return `ElevenLabs isolation error (${resp.status}): ${errBody.slice(0, 500)}`;
          }

          const audioBuffer = await resp.arrayBuffer();
          const url = await uploadAudioToStorage(audioBuffer, "audio-isolated");
          return `Audio isolated (background noise removed)!\nAudio URL: ${url}\nSize: ${Math.round(audioBuffer.byteLength / 1024)}KB`;
        }

        if (action === "clone") {
          const audioUrl = toolInput.audio_url as string;
          const voiceName = (toolInput.voice_name as string) || "Cloned Voice";
          if (!audioUrl) return "Error: audio_url is required for clone action.";

          // Download the source audio
          const sourceResp = await fetch(audioUrl);
          if (!sourceResp.ok) return `Failed to download source audio: ${sourceResp.status}`;
          const sourceBuffer = await sourceResp.arrayBuffer();

          const apiKey = await requireSecret("ELEVENLABS_API_KEY", "ElevenLabs API Key");
          const formData = new FormData();
          formData.append("name", voiceName);
          formData.append("files", new Blob([sourceBuffer], { type: "audio/mpeg" }), "voice_sample.mp3");
          formData.append("description", `Cloned voice: ${voiceName}`);

          const resp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
            method: "POST",
            headers: { "xi-api-key": apiKey },
            body: formData,
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            return `ElevenLabs clone error (${resp.status}): ${errBody.slice(0, 500)}`;
          }

          const data = await resp.json() as { voice_id: string };
          return `Voice cloned successfully!\nVoice ID: ${data.voice_id}\nName: ${voiceName}\nUse this voice_id with action='speak' to generate speech with this voice.`;
        }

        if (action === "dub") {
          const audioUrl = toolInput.audio_url as string;
          const targetLang = toolInput.target_language as string;
          if (!audioUrl) return "Error: audio_url is required for dub action.";
          if (!targetLang) return "Error: target_language is required for dub action (e.g. 'es', 'fr', 'de', 'ja').";

          const resp = await elevenLabsRequest("/v1/dubbing", {
            method: "POST",
            body: {
              source_url: audioUrl,
              target_lang: targetLang,
            },
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            return `ElevenLabs dubbing error (${resp.status}): ${errBody.slice(0, 500)}`;
          }

          const data = await resp.json() as { dubbing_id: string; expected_duration_sec: number };
          return `Dubbing started!\nDubbing ID: ${data.dubbing_id}\nTarget language: ${targetLang}\nEstimated duration: ${data.expected_duration_sec}s\n\nNote: Dubbing is asynchronous. Use http_request to check status at: https://api.elevenlabs.io/v1/dubbing/${data.dubbing_id} (with xi-api-key header).`;
        }

        return `Unknown voice action "${action}". Use "speak", "voices", "sound_effect", "isolate", "clone", or "dub".`;
      }

      case "super_agent_task": {
        const client = await getSupabaseClient();
        const action = toolInput.action as string;

        if (action === "create") {
          const title = toolInput.title as string;
          if (!title) return "Error: 'title' is required for create action.";
          const row: Record<string, unknown> = {
            title,
            description: (toolInput.description as string) || null,
            status: "working_on_it",
            started_at: new Date().toISOString(),
            priority: (toolInput.priority as string) || "medium",
            category: (toolInput.category as string) || null,
            client_name: (toolInput.client_name as string) || null,
            requested_by: (toolInput.requested_by as string) || memberName,
            assigned_to: "Super Agent",
            links: toolInput.links || [],
            notes: toolInput.note
              ? [{ timestamp: new Date().toISOString(), text: toolInput.note as string }]
              : [],
          };
          const { data, error } = await client.from("super_agent_tasks").insert(row).select().single();
          if (error) return `Error creating task: ${error.message}`;
          return `Task created!\nID: ${(data as Record<string, unknown>).id}\nTitle: ${title}\nStatus: working_on_it\nPriority: ${row.priority}`;
        }

        if (action === "update") {
          const taskId = toolInput.task_id as string;
          if (!taskId) return "Error: 'task_id' is required for update action.";

          const { data: existing, error: fetchErr } = await client
            .from("super_agent_tasks")
            .select("*")
            .eq("id", taskId)
            .single();
          if (fetchErr || !existing) return `Error: Task ${taskId} not found.`;

          const ex = existing as Record<string, unknown>;
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

          if (toolInput.status) {
            updates.status = toolInput.status as string;
            if (toolInput.status === "working_on_it" && !ex.started_at) {
              updates.started_at = new Date().toISOString();
            }
            if (toolInput.status === "completed") {
              updates.completed_at = new Date().toISOString();
            }
          }
          if (toolInput.error_details) updates.error_details = toolInput.error_details as string;
          if (toolInput.description) updates.description = toolInput.description as string;
          if (toolInput.priority) updates.priority = toolInput.priority as string;
          if (toolInput.category) updates.category = toolInput.category as string;
          if (toolInput.client_name) updates.client_name = toolInput.client_name as string;

          if (toolInput.note) {
            const existingNotes = (ex.notes as Array<{ timestamp: string; text: string }>) || [];
            existingNotes.push({ timestamp: new Date().toISOString(), text: toolInput.note as string });
            updates.notes = existingNotes;
          }

          if (toolInput.links) {
            const existingLinks = (ex.links as Array<{ label: string; url: string }>) || [];
            existingLinks.push(...(toolInput.links as Array<{ label: string; url: string }>));
            updates.links = existingLinks;
          }

          const { data, error } = await client
            .from("super_agent_tasks")
            .update(updates)
            .eq("id", taskId)
            .select()
            .single();
          if (error) return `Error updating task: ${error.message}`;
          const d = data as Record<string, unknown>;
          return `Task updated!\nID: ${taskId}\nTitle: ${d.title}\nStatus: ${d.status}${toolInput.note ? `\nNote added: ${toolInput.note}` : ""}`;
        }

        if (action === "list") {
          let query = client.from("super_agent_tasks").select("id, title, status, priority, category, client_name, requested_by, created_at, updated_at, started_at, completed_at");
          if (toolInput.filter_status) query = query.eq("status", toolInput.filter_status as string);
          if (toolInput.filter_client) query = query.ilike("client_name", `%${toolInput.filter_client}%`);
          query = query.order("created_at", { ascending: false }).limit((toolInput.limit as number) || 20);
          const { data, error } = await query;
          if (error) return `Error listing tasks: ${error.message}`;
          if (!data || (data as unknown[]).length === 0) return "No super agent tasks found.";
          return JSON.stringify(data, null, 2).slice(0, 8000);
        }

        return `Unknown action "${action}". Use "create", "update", or "list".`;
      }

      case "servis_crm": {
        const clientName = toolInput.client_name as string;
        const action = toolInput.action as string;
        if (!clientName) return "Error: client_name is required. CRM credentials are per-client.";
        if (!action) return "Error: action is required.";

        // Fetch per-client CRM credentials (strict isolation)
        const client = await getSupabaseClient();
        const { data: creds, error: credsErr } = await client
          .from("client_crm_credentials")
          .select("client_id, client_secret, base_url")
          .eq("client_name", clientName)
          .eq("crm_provider", "servis")
          .eq("is_active", true)
          .single();

        if (credsErr || !creds) {
          return `Error: Servis CRM not configured for "${clientName}". Set up CRM credentials in Client Settings > Manage CRM.`;
        }

        const baseUrl = (creds.base_url as string) || "https://freeagent.network";
        let token: string;
        try {
          token = await getServisToken(clientName, creds.client_id as string, creds.client_secret as string);
        } catch (err: any) {
          return `Error authenticating with Servis CRM for "${clientName}": ${err.message}`;
        }

        const graphqlUrl = `${baseUrl}/api/graphql`;

        // Helper to execute GraphQL
        const runGraphQL = async (query: string, variables: Record<string, unknown>): Promise<any> => {
          const resp = await fetch(graphqlUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ query, variables }),
          });

          if (resp.status === 401) {
            // Token expired — clear cache and retry once
            servisTokenCache.delete(clientName);
            token = await getServisToken(clientName, creds.client_id as string, creds.client_secret as string);
            const retry = await fetch(graphqlUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ query, variables }),
            });
            if (!retry.ok) {
              const errText = await retry.text().catch(() => "");
              throw new Error(`Servis API error (${retry.status}): ${errText.slice(0, 1000)}`);
            }
            return retry.json();
          }

          if (resp.status === 429) {
            throw new Error("Servis CRM rate limit exceeded (50 req/10s). Wait a moment and retry.");
          }

          if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            throw new Error(`Servis API error (${resp.status}): ${errText.slice(0, 1000)}`);
          }

          const result = await resp.json();
          if (result.errors && result.errors.length > 0) {
            throw new Error(`GraphQL error: ${JSON.stringify(result.errors).slice(0, 1000)}`);
          }
          return result;
        };

        try {
          switch (action) {
            case "list_records": {
              const entity = toolInput.entity as string;
              if (!entity) return "Error: entity is required for list_records (e.g. 'contact', 'deal', 'account').";
              const q = `query listEntityValues($entity: String!, $fields: [String], $order: [[String]], $limit: Int, $offset: Int, $pattern: String, $filters: [Filter], $count_only: Boolean) {
                listEntityValues(entity: $entity, fields: $fields, order: $order, limit: $limit, offset: $offset, pattern: $pattern, filters: $filters, count_only: $count_only) {
                  count
                  entity_values { id seq_id field_values }
                }
              }`;
              const vars: Record<string, unknown> = { entity };
              if (toolInput.limit) vars.limit = toolInput.limit;
              if (toolInput.offset) vars.offset = toolInput.offset;
              if (toolInput.order) vars.order = toolInput.order;
              if (toolInput.pattern) vars.pattern = toolInput.pattern;
              if (toolInput.filters) vars.filters = toolInput.filters;
              const result = await runGraphQL(q, vars);
              const out = JSON.stringify(result.data?.listEntityValues, null, 2);
              return out.length > 8000 ? out.slice(0, 8000) + "\n[...truncated]" : out;
            }

            case "get_record": {
              const entity = toolInput.entity as string;
              const recordId = toolInput.record_id as string;
              if (!entity || !recordId) return "Error: entity and record_id are required for get_record.";
              const q = `query listEntityValues($entity: String!, $id: String) {
                listEntityValues(entity: $entity, id: $id) {
                  entity_values { id seq_id field_values lines }
                }
              }`;
              const result = await runGraphQL(q, { entity, id: recordId });
              const vals = result.data?.listEntityValues?.entity_values;
              if (!vals || vals.length === 0) return `No record found with ID "${recordId}" in ${entity}.`;
              return JSON.stringify(vals[0], null, 2).slice(0, 8000);
            }

            case "create_record": {
              const entity = toolInput.entity as string;
              const fieldValues = toolInput.field_values as Record<string, unknown>;
              if (!entity || !fieldValues) return "Error: entity and field_values are required for create_record.";
              const q = `mutation createEntity($entity: String!, $field_values: JSON!) {
                createEntity(entity: $entity, field_values: $field_values) {
                  entity_value { id seq_id field_values }
                }
              }`;
              const result = await runGraphQL(q, { entity, field_values: fieldValues });
              const created = result.data?.createEntity?.entity_value;
              return created
                ? `Record created successfully!\n${JSON.stringify(created, null, 2).slice(0, 4000)}`
                : `Create response: ${JSON.stringify(result.data, null, 2).slice(0, 4000)}`;
            }

            case "update_record": {
              const entity = toolInput.entity as string;
              const recordId = toolInput.record_id as string;
              const fieldValues = toolInput.field_values as Record<string, unknown>;
              if (!entity || !recordId || !fieldValues) return "Error: entity, record_id, and field_values are required for update_record.";
              const q = `mutation updateEntity($entity: String!, $id: String!, $field_values: JSON!) {
                updateEntity(entity: $entity, id: $id, field_values: $field_values) {
                  entity_value { id seq_id field_values }
                }
              }`;
              const result = await runGraphQL(q, { entity, id: recordId, field_values: fieldValues });
              const updated = result.data?.updateEntity?.entity_value;
              return updated
                ? `Record updated successfully!\n${JSON.stringify(updated, null, 2).slice(0, 4000)}`
                : `Update response: ${JSON.stringify(result.data, null, 2).slice(0, 4000)}`;
            }

            case "delete_record": {
              const entity = toolInput.entity as string;
              const recordId = toolInput.record_id as string;
              if (!entity || !recordId) return "Error: entity and record_id are required for delete_record.";
              const q = `mutation deleteEntity($entity: String!, $id: String!) {
                deleteEntity(entity: $entity, id: $id) {
                  success
                }
              }`;
              const result = await runGraphQL(q, { entity, id: recordId });
              return result.data?.deleteEntity?.success
                ? `Record ${recordId} deleted successfully from ${entity}.`
                : `Delete response: ${JSON.stringify(result.data, null, 2)}`;
            }

            case "list_activities": {
              const entity = toolInput.entity as string;
              const recordId = toolInput.record_id as string;
              if (!entity || !recordId) return "Error: entity and record_id are required for list_activities.";
              const q = `query listEventLogs($entity: String!, $fa_entity_id: String!, $limit: Int, $offset: Int) {
                listEventLogs(entity: $entity, fa_entity_id: $fa_entity_id, limit: $limit, offset: $offset) {
                  count
                  entity_values { id seq_id field_values }
                }
              }`;
              const vars: Record<string, unknown> = { entity, fa_entity_id: recordId };
              if (toolInput.limit) vars.limit = toolInput.limit;
              if (toolInput.offset) vars.offset = toolInput.offset;
              const result = await runGraphQL(q, vars);
              const out = JSON.stringify(result.data?.listEventLogs, null, 2);
              return out.length > 8000 ? out.slice(0, 8000) + "\n[...truncated]" : out;
            }

            case "list_apps": {
              const q = `query getEntities($alphabetical_order: Boolean) {
                getEntities(alphabetical_order: $alphabetical_order) {
                  name display_name label label_plural entity_id
                }
              }`;
              const result = await runGraphQL(q, { alphabetical_order: true });
              return JSON.stringify(result.data?.getEntities, null, 2).slice(0, 8000);
            }

            case "list_fields": {
              const entity = toolInput.entity as string;
              if (!entity) return "Error: entity is required for list_fields.";
              const q = `query getFields($entity: String) {
                getFields(entity: $entity) {
                  id name name_label main_type is_required is_visible default_value
                }
              }`;
              const result = await runGraphQL(q, { entity });
              return JSON.stringify(result.data?.getFields, null, 2).slice(0, 8000);
            }

            case "list_users": {
              const q = `query getTeamMembers {
                getTeamMembers {
                  agents { id full_name email_address job_title access_level status }
                }
              }`;
              const result = await runGraphQL(q, {});
              return JSON.stringify(result.data?.getTeamMembers?.agents, null, 2).slice(0, 8000);
            }

            default:
              return `Unknown Servis CRM action "${action}". Use: list_records, get_record, create_record, update_record, delete_record, list_activities, list_apps, list_fields, list_users.`;
          }
        } catch (err: any) {
          return `Servis CRM error for "${clientName}": ${err.message}`;
        }
      }

      case "social_media": {
        const apiKey = await requireSecret("AYRSHARE_API_KEY", "Ayrshare API Key");
        const action = toolInput.action as string;
        const platforms = toolInput.platforms as string[] | undefined;
        const postText = toolInput.post as string | undefined;
        const mediaUrls = toolInput.media_urls as string[] | undefined;
        const scheduleDate = toolInput.schedule_date as string | undefined;
        const postId = toolInput.post_id as string | undefined;
        const commentText = toolInput.comment as string | undefined;
        const commentId = toolInput.comment_id as string | undefined;
        const singlePlatform = toolInput.platform as string | undefined;
        const extraParams = (toolInput.params as Record<string, unknown>) || {};
        let profileKey = toolInput.profile_key as string | undefined;
        const smClientName = toolInput.client_name as string | undefined;
        const customMethod = ((toolInput.method as string) || "GET").toUpperCase();
        const customEndpoint = toolInput.endpoint as string | undefined;

        // Auto-resolve profile_key from client_account_mappings if client_name provided
        if (smClientName && !profileKey) {
          try {
            const smClient = await getSupabaseClient();
            const { data: ayrMapping } = await smClient
              .from("client_account_mappings")
              .select("account_id")
              .ilike("client_name", smClientName)
              .eq("platform", "ayrshare_profile")
              .limit(1)
              .maybeSingle();
            if (ayrMapping?.account_id) {
              profileKey = ayrMapping.account_id;
            }
          } catch { /* ignore, proceed without profile key */ }
        }

        const BASE = "https://api.ayrshare.com/api";
        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };
        if (profileKey) headers["Profile-Key"] = profileKey;

        // Helper to make Ayrshare API calls
        async function ayrCall(
          method: string,
          path: string,
          body?: Record<string, unknown>
        ): Promise<string> {
          const url = `${BASE}${path}`;
          const opts: RequestInit = { method, headers };
          if (body && (method === "POST" || method === "PUT" || method === "DELETE")) {
            opts.body = JSON.stringify(body);
          }
          const resp = await fetch(url, opts);
          const text = await resp.text();
          if (!resp.ok) {
            return `Ayrshare API error (${resp.status}): ${text.slice(0, 2000)}`;
          }
          try {
            const json = JSON.parse(text);
            return JSON.stringify(json, null, 2).slice(0, 8000);
          } catch {
            return text.slice(0, 8000);
          }
        }

        switch (action) {
          case "post": {
            const body: Record<string, unknown> = { ...extraParams };
            if (platforms) body.platforms = platforms;
            if (postText) body.post = postText;
            if (mediaUrls) body.mediaUrls = mediaUrls;
            if (scheduleDate) body.scheduleDate = scheduleDate;
            return ayrCall("POST", "/post", body);
          }
          case "delete_post": {
            if (!postId) return "post_id is required for delete_post.";
            return ayrCall("DELETE", "/post", { id: postId, ...extraParams });
          }
          case "get_post": {
            if (!postId) return "post_id is required for get_post.";
            return ayrCall("GET", `/post/${postId}`);
          }
          case "update_post": {
            if (!postId) return "post_id is required for update_post.";
            return ayrCall("PUT", `/post/${postId}`, { ...extraParams });
          }
          case "history": {
            if (singlePlatform) return ayrCall("GET", `/history/platform/${singlePlatform}`);
            return ayrCall("GET", "/history");
          }
          case "analytics_post": {
            const body: Record<string, unknown> = { ...extraParams };
            if (postId) body.id = postId;
            if (platforms) body.platforms = platforms;
            return ayrCall("POST", "/analytics/post", body);
          }
          case "analytics_social": {
            const body: Record<string, unknown> = { ...extraParams };
            if (platforms) body.platforms = platforms;
            return ayrCall("POST", "/analytics/social", body);
          }
          case "comment": {
            if (!postId) return "post_id is required for comment.";
            if (!commentText) return "comment text is required.";
            const body: Record<string, unknown> = { id: postId, comment: commentText, ...extraParams };
            if (platforms) body.platforms = platforms;
            return ayrCall("POST", "/comments", body);
          }
          case "get_comments": {
            if (!postId) return "post_id is required for get_comments.";
            return ayrCall("GET", `/comments/${postId}`);
          }
          case "reply_comment": {
            if (!commentId) return "comment_id is required for reply_comment.";
            if (!commentText) return "comment text is required.";
            return ayrCall("POST", "/comments/reply", { commentId, comment: commentText, ...extraParams });
          }
          case "delete_comment": {
            const body: Record<string, unknown> = { ...extraParams };
            if (commentId) body.commentId = commentId;
            if (postId) body.id = postId;
            return ayrCall("DELETE", "/comments", body);
          }
          case "auto_schedule": {
            const body: Record<string, unknown> = { ...extraParams };
            if (platforms) body.platforms = platforms;
            return ayrCall("POST", "/auto-schedule", body);
          }
          case "get_auto_schedule": {
            return ayrCall("GET", "/auto-schedule");
          }
          case "generate_text": {
            return ayrCall("POST", "/generate/text", { ...extraParams });
          }
          case "generate_rewrite": {
            const body: Record<string, unknown> = { ...extraParams };
            if (postText) body.post = postText;
            return ayrCall("POST", "/generate/rewrite", body);
          }
          case "generate_translate": {
            const body: Record<string, unknown> = { ...extraParams };
            if (postText) body.post = postText;
            return ayrCall("POST", "/generate/translate", body);
          }
          case "upload_media": {
            return ayrCall("POST", "/media/upload", { ...extraParams });
          }
          case "get_media": {
            return ayrCall("GET", "/media");
          }
          case "hashtags_recommend": {
            return ayrCall("GET", `/hashtags/recommend?${new URLSearchParams(extraParams as Record<string, string>).toString()}`);
          }
          case "hashtags_auto": {
            const body: Record<string, unknown> = { ...extraParams };
            if (postText) body.post = postText;
            return ayrCall("POST", "/hashtags/auto", body);
          }
          case "shorten_link": {
            return ayrCall("POST", "/links/shorten", { ...extraParams });
          }
          case "add_feed": {
            return ayrCall("POST", "/feeds", { ...extraParams });
          }
          case "get_feeds": {
            return ayrCall("GET", "/feeds");
          }
          case "get_user": {
            return ayrCall("GET", "/user");
          }
          case "get_reviews": {
            const qs = singlePlatform ? `?platform=${singlePlatform}` : "";
            return ayrCall("GET", `/reviews${qs}`);
          }
          case "reply_review": {
            return ayrCall("POST", "/reviews/reply", { ...extraParams });
          }
          case "validate_post": {
            const body: Record<string, unknown> = { ...extraParams };
            if (postText) body.post = postText;
            if (platforms) body.platforms = platforms;
            return ayrCall("POST", "/validate/post", body);
          }
          case "send_message": {
            return ayrCall("POST", "/messages", { ...extraParams });
          }
          case "get_messages": {
            return ayrCall("GET", "/messages");
          }
          case "brand_search": {
            if (!singlePlatform) return "platform is required for brand_search (e.g. 'facebook', 'linkedin').";
            return ayrCall("GET", `/brand/search/${singlePlatform}?${new URLSearchParams(extraParams as Record<string, string>).toString()}`);
          }
          case "custom": {
            if (!customEndpoint) return 'endpoint is required for "custom" action.';
            const body = (customMethod === "POST" || customMethod === "PUT" || customMethod === "DELETE")
              ? { ...extraParams }
              : undefined;
            return ayrCall(customMethod, customEndpoint, body);
          }
          default:
            return `Unknown social_media action "${action}". Available: post, delete_post, get_post, update_post, history, analytics_post, analytics_social, comment, get_comments, reply_comment, delete_comment, auto_schedule, get_auto_schedule, generate_text, generate_rewrite, generate_translate, upload_media, get_media, hashtags_recommend, hashtags_auto, shorten_link, add_feed, get_feeds, get_user, get_reviews, reply_review, validate_post, send_message, get_messages, brand_search, custom.`;
        }
      }

      // ── Website Builder Tools ──

      case "website_create_project": {
        const name = toolInput.name as string;
        const slug = (toolInput.slug as string).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const description = toolInput.description as string | undefined;

        const client = await getSupabaseClient();
        const { data, error } = await client
          .from("website_projects")
          .insert({
            member_name: memberName.toLowerCase(),
            name,
            slug,
            description: description || null,
          })
          .select("id, slug")
          .single();

        if (error) {
          if (error.code === "23505") return `A project with slug "${slug}" already exists. Use a different slug.`;
          return `Error creating project: ${error.message}`;
        }

        // Auto-create index.html
        await client.from("website_pages").insert({
          project_id: data.id,
          filename: "index.html",
          title: "Home",
          html_content: "",
          is_homepage: true,
          sort_order: 0,
        });

        return `Project created!\nproject_id: ${data.id}\nslug: ${data.slug}\nThe index.html page has been created. Use website_save_page to add content.`;
      }

      case "website_save_page": {
        const projectId = toolInput.project_id as string;
        const filename = toolInput.filename as string;
        const title = toolInput.title as string | undefined;
        let htmlContent = toolInput.html_content as string;

        // Ensure valid HTML document
        if (htmlContent && !htmlContent.trim().toLowerCase().startsWith("<!doctype") && !htmlContent.trim().toLowerCase().startsWith("<html")) {
          htmlContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${title || filename.replace(".html", "")}</title>\n<script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body>\n${htmlContent}\n</body>\n</html>`;
        }

        const client = await getSupabaseClient();

        // Check if page exists
        const { data: existing } = await client
          .from("website_pages")
          .select("id")
          .eq("project_id", projectId)
          .eq("filename", filename)
          .single();

        if (existing) {
          // Update existing page
          const updates: Record<string, unknown> = {
            html_content: htmlContent,
            updated_at: new Date().toISOString(),
          };
          if (title) updates.title = title;

          const { error: updateErr } = await client.from("website_pages").update(updates).eq("id", existing.id);
          if (updateErr) return `Error updating page: ${updateErr.message}`;
        } else {
          // Create new page
          const { error } = await client.from("website_pages").insert({
            project_id: projectId,
            filename,
            title: title || filename.replace(".html", ""),
            html_content: htmlContent,
            is_homepage: filename === "index.html",
          });
          if (error) return `Error saving page: ${error.message}`;
        }

        // Update project timestamp
        const { error: tsErr } = await client.from("website_projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
        if (tsErr) console.error(`[tools] Failed to update project timestamp: ${tsErr.message}`);

        return `Page saved: ${filename} (project_id: ${projectId}). The preview will update automatically.`;
      }

      case "website_get_project": {
        const projectId = toolInput.project_id as string;
        const pageFilename = toolInput.page_filename as string | undefined;

        const client = await getSupabaseClient();
        const { data: project, error } = await client
          .from("website_projects")
          .select("id, name, slug, status, branded_url, custom_domain, settings, seo_defaults")
          .eq("id", projectId)
          .single();

        if (error || !project) return `Project not found: ${projectId}`;

        // Get page list
        const { data: pages } = await client
          .from("website_pages")
          .select("id, filename, title, is_homepage, sort_order, updated_at")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });

        let result = `Project: ${project.name} (${project.slug})\nStatus: ${project.status}`;
        if (project.branded_url) result += `\nLive: https://${project.branded_url}`;
        if (project.custom_domain) result += `\nCustom domain: ${project.custom_domain}`;
        result += `\n\nPages:\n${(pages ?? []).map(p => `- ${p.filename} (${p.title})`).join("\n")}`;

        // Optionally fetch full HTML for a specific page
        if (pageFilename) {
          const { data: page } = await client
            .from("website_pages")
            .select("html_content")
            .eq("project_id", projectId)
            .eq("filename", pageFilename)
            .single();

          if (page) {
            result += `\n\n--- ${pageFilename} content ---\n${page.html_content}`;
          } else {
            result += `\n\nPage "${pageFilename}" not found.`;
          }
        }

        return result;
      }

      case "website_list_projects": {
        const client = await getSupabaseClient();
        const { data, error } = await client
          .from("website_projects")
          .select("id, name, slug, status, branded_url, last_deployed_at, updated_at")
          .eq("member_name", memberName.toLowerCase())
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(20);

        if (error) return `Error listing projects: ${error.message}`;
        if (!data || data.length === 0) return "No website projects found. Use website_create_project to start one.";

        return data.map(p =>
          `- ${p.name} (${p.slug}) [${p.status}]${p.branded_url ? ` → https://${p.branded_url}` : ""}`
        ).join("\n");
      }

      case "website_deploy": {
        const projectId = toolInput.project_id as string;
        const commitMessage = toolInput.commit_message as string | undefined;

        const client = await getSupabaseClient();

        // Fetch project
        const { data: project } = await client
          .from("website_projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (!project) return `Project not found: ${projectId}`;

        // Fetch all pages
        const { data: pages } = await client
          .from("website_pages")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });

        if (!pages || pages.length === 0) return "No pages to deploy. Use website_save_page first.";

        // Write pages to temp directory
        const siteDir = `${tmpDir}/website-${project.slug}`;
        await fs.mkdir(siteDir, { recursive: true });

        for (const page of pages) {
          const filePath = path.join(siteDir, page.filename);
          await fs.writeFile(filePath, page.html_content, "utf-8");
        }

        // Deploy
        let result;
        try {
          result = await deployToVercel(siteDir, project.slug, tmpDir);
        } catch (deployErr: any) {
          return `Deployment failed: ${deployErr.message}`;
        }

        // Get next version number
        const { data: lastVersion } = await client
          .from("website_versions")
          .select("version_number")
          .eq("project_id", projectId)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        const nextVersion = (lastVersion?.version_number ?? 0) + 1;

        // Create version snapshot
        const { error: versionErr } = await client.from("website_versions").insert({
          project_id: projectId,
          version_number: nextVersion,
          snapshot: { pages: pages.map(p => ({ filename: p.filename, title: p.title, html_content: p.html_content, seo: p.seo })) },
          deploy_url: result.vercelUrl,
          deployed_by: memberName.toLowerCase(),
          commit_message: commitMessage || `Version ${nextVersion}`,
        });
        if (versionErr) console.error(`[tools] Failed to save version snapshot: ${versionErr.message}`);

        // Update project
        const { error: projUpdateErr } = await client.from("website_projects").update({
          status: "published",
          branded_url: result.brandedUrl,
          vercel_deployment_url: result.vercelUrl,
          vercel_project_id: project.slug,
          last_deployed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", projectId);
        if (projUpdateErr) console.error(`[tools] Failed to update project after deploy: ${projUpdateErr.message}`);

        return `Website deployed! 🌐\nLive at: https://${result.brandedUrl}\nVersion: ${nextVersion}${result.vercelUrl ? `\nVercel URL: ${result.vercelUrl}` : ""}`;
      }

      case "website_upload_asset": {
        const projectId = toolInput.project_id as string;
        const sourceUrl = toolInput.source_url as string | undefined;
        const base64Data = toolInput.base64_data as string | undefined;
        const filename = toolInput.filename as string;
        const contentType = toolInput.content_type as string | undefined;

        if (!sourceUrl && !base64Data) return "Provide either source_url or base64_data.";

        let buffer: Buffer;
        let mimeType = contentType || "application/octet-stream";

        if (sourceUrl) {
          // Download from URL
          const resp = await fetch(sourceUrl);
          if (!resp.ok) return `Failed to download from ${sourceUrl}: ${resp.status}`;
          buffer = Buffer.from(await resp.arrayBuffer());
          if (!contentType) {
            mimeType = resp.headers.get("content-type") || mimeType;
          }
        } else {
          // Decode base64
          buffer = Buffer.from(base64Data!, "base64");
        }

        // Auto-detect mime type from extension if not provided
        if (!contentType) {
          const ext = filename.split(".").pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
            webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm",
            pdf: "application/pdf", ico: "image/x-icon",
          };
          if (ext && mimeMap[ext]) mimeType = mimeMap[ext];
        }

        const { randomUUID } = await import("crypto");
        const storagePath = `${projectId}/${randomUUID()}-${filename}`;

        const client = await getSupabaseClient();
        const { error: uploadErr } = await client.storage
          .from("website-assets")
          .upload(storagePath, buffer, { contentType: mimeType, upsert: true, cacheControl: "3600" });

        if (uploadErr) return `Upload failed: ${uploadErr.message}`;

        const { data: urlData } = client.storage.from("website-assets").getPublicUrl(storagePath);
        return `Asset uploaded! Use this URL in your HTML:\n${urlData.publicUrl}`;
      }

      case "manage_uploads": {
        const action = toolInput.action as string;
        const client = await getSupabaseClient();

        switch (action) {
          case "list": {
            let query = client
              .from("team_uploads")
              .select("id, member_name, client_name, batch_id, original_name, public_url, mime_type, file_size, description, tags, created_at")
              .order("created_at", { ascending: false })
              .limit(Math.min(Number(toolInput.limit) || 20, 50));

            if (toolInput.client_name) query = query.ilike("client_name", `%${toolInput.client_name}%`);
            if (toolInput.batch_id) query = query.eq("batch_id", toolInput.batch_id as string);
            if (toolInput.conversation_id) query = query.eq("conversation_id", toolInput.conversation_id as string);
            if (toolInput.mime_filter) query = query.ilike("mime_type", `${toolInput.mime_filter}%`);

            const { data, error } = await query;
            if (error) return `Error listing uploads: ${error.message}`;
            if (!data || data.length === 0) return "No uploads found matching those filters.";

            const lines = data.map((u: any) =>
              `- ${u.original_name} | ${u.public_url} | ${u.mime_type} | ${(u.file_size / 1024).toFixed(0)}KB | client: ${u.client_name || "none"} | tags: [${(u.tags || []).join(", ")}] | ${u.description ? `desc: "${u.description}"` : "no description"} | id: ${u.id}`
            );
            return `Found ${data.length} uploads:\n${lines.join("\n")}`;
          }

          case "search": {
            const q = toolInput.query as string;
            if (!q) return "Provide a 'query' for search.";

            let query = client
              .from("team_uploads")
              .select("id, original_name, public_url, mime_type, client_name, description, tags, created_at")
              .or(`original_name.ilike.%${q}%,description.ilike.%${q}%`)
              .order("created_at", { ascending: false })
              .limit(Math.min(Number(toolInput.limit) || 20, 50));

            if (toolInput.client_name) query = query.ilike("client_name", `%${toolInput.client_name}%`);

            const { data, error } = await query;
            if (error) return `Search error: ${error.message}`;
            if (!data || data.length === 0) return `No uploads found matching "${q}".`;

            const lines = data.map((u: any) =>
              `- ${u.original_name} | ${u.public_url} | client: ${u.client_name || "none"} | id: ${u.id}`
            );
            return `Found ${data.length} uploads matching "${q}":\n${lines.join("\n")}`;
          }

          case "view": {
            const uploadId = toolInput.upload_id as string;
            if (!uploadId) return "Provide upload_id to view.";

            const { data: upload } = await client
              .from("team_uploads")
              .select("*")
              .eq("id", uploadId)
              .single();

            if (!upload) return "Upload not found.";

            return `Upload details:\n- Name: ${upload.original_name}\n- URL: ${upload.public_url}\n- Type: ${upload.mime_type}\n- Size: ${(upload.file_size / 1024).toFixed(0)}KB\n- Client: ${upload.client_name || "none"}\n- Description: ${upload.description || "none"}\n- Tags: [${(upload.tags || []).join(", ")}]\n- Uploaded: ${upload.created_at}\n- Batch: ${upload.batch_id}`;
          }

          case "describe": {
            const uploadId = toolInput.upload_id as string;
            if (!uploadId) return "Provide upload_id to describe.";
            const desc = toolInput.description as string;
            if (!desc) return "Provide description text.";

            const updates: Record<string, unknown> = { description: desc };
            if (toolInput.assign_client) updates.client_name = toolInput.assign_client;

            const { error } = await client
              .from("team_uploads")
              .update(updates)
              .eq("id", uploadId);

            if (error) return `Error updating description: ${error.message}`;
            return `Description saved for upload ${uploadId}.${toolInput.assign_client ? ` Client set to "${toolInput.assign_client}".` : ""}`;
          }

          case "tag": {
            const uploadId = toolInput.upload_id as string;
            if (!uploadId) return "Provide upload_id to tag.";
            const newTags = toolInput.tags as string[];
            if (!newTags || newTags.length === 0) return "Provide tags array.";

            const { data: upload } = await client
              .from("team_uploads")
              .select("tags")
              .eq("id", uploadId)
              .single();

            if (!upload) return "Upload not found.";

            let currentTags: string[] = upload.tags || [];
            const toRemove = newTags.filter((t: string) => t.startsWith("-")).map((t: string) => t.slice(1));
            const toAdd = newTags.filter((t: string) => !t.startsWith("-"));

            currentTags = currentTags.filter((t: string) => !toRemove.includes(t));
            currentTags = [...new Set([...currentTags, ...toAdd])];

            const { error } = await client
              .from("team_uploads")
              .update({ tags: currentTags })
              .eq("id", uploadId);

            if (error) return `Error updating tags: ${error.message}`;
            return `Tags updated: [${currentTags.join(", ")}]`;
          }

          case "delete": {
            const uploadId = toolInput.upload_id as string;
            if (!uploadId) return "Provide upload_id to delete.";

            const { data: upload } = await client
              .from("team_uploads")
              .select("storage_path, original_name")
              .eq("id", uploadId)
              .single();

            if (!upload) return "Upload not found.";

            await client.storage.from("team-uploads").remove([upload.storage_path]);
            await client.from("team_uploads").delete().eq("id", uploadId);

            return `Deleted upload: ${upload.original_name}`;
          }

          default:
            return `Unknown manage_uploads action "${action}". Available: list, search, view, describe, tag, delete.`;
        }
      }

      // ── Commercial Maker Tool Cases ──

      case "commercial_create_project": {
        const client = await getSupabaseClient();
        const name = toolInput.name as string;
        if (!name) return "Error: name is required.";

        const config: any = {
          fps: 30,
          width: 1080,
          height: 1920,
          theme: {
            primary: (toolInput.theme_primary as string) || "#6366f1",
            accent: (toolInput.theme_accent as string) || "#d97706",
            background: "#ffffff",
          },
        };

        const { data, error } = await client
          .from("commercial_projects")
          .insert({
            member_name: memberName.toLowerCase(),
            name,
            config,
          })
          .select("id, name")
          .single();

        if (error) return `Error creating project: ${error.message}`;
        return `Commercial project created!\nproject_id: ${data.id}\nname: ${data.name}\n\nNow add scenes using commercial_add_scene.`;
      }

      case "commercial_add_scene": {
        const client = await getSupabaseClient();
        const projectId = toolInput.project_id as string;
        const sceneType = toolInput.scene_type as string;
        const props = toolInput.props as Record<string, unknown>;
        if (!projectId || !sceneType || !props) return "Error: project_id, scene_type, and props are required.";

        const durationFrames = (toolInput.duration_frames as number) || 150;

        // Determine scene_order
        let sceneOrder = toolInput.scene_order as number | undefined;
        if (sceneOrder === undefined) {
          const { data: existing } = await client
            .from("commercial_scenes")
            .select("scene_order")
            .eq("project_id", projectId)
            .order("scene_order", { ascending: false })
            .limit(1);
          sceneOrder = existing && existing.length > 0 ? existing[0].scene_order + 1 : 0;
        }

        const { data, error } = await client
          .from("commercial_scenes")
          .insert({
            project_id: projectId,
            scene_type: sceneType,
            props,
            duration_frames: durationFrames,
            scene_order: sceneOrder,
          })
          .select("id, scene_order, scene_type")
          .single();

        if (error) return `Error adding scene: ${error.message}`;

        // Update project timestamp
        await client.from("commercial_projects")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", projectId);

        return `Scene added!\nscene_id: ${data.id}\ntype: ${data.scene_type}\norder: ${data.scene_order}\nduration: ${durationFrames} frames (${(durationFrames / 30).toFixed(1)}s)`;
      }

      case "commercial_update_scene": {
        const client = await getSupabaseClient();
        const projectId = toolInput.project_id as string;
        const sceneId = toolInput.scene_id as string;
        if (!projectId || !sceneId) return "Error: project_id and scene_id are required.";

        const updates: any = { updated_at: new Date().toISOString() };
        if (toolInput.scene_type) updates.scene_type = toolInput.scene_type;
        if (toolInput.duration_frames) updates.duration_frames = toolInput.duration_frames;
        if (toolInput.fade_in !== undefined) updates.fade_in = toolInput.fade_in;
        if (toolInput.fade_out !== undefined) updates.fade_out = toolInput.fade_out;
        if (toolInput.scene_order !== undefined) updates.scene_order = toolInput.scene_order;

        // Merge props with existing
        if (toolInput.props) {
          const { data: existing } = await client
            .from("commercial_scenes")
            .select("props")
            .eq("id", sceneId)
            .single();
          updates.props = { ...(existing?.props as any || {}), ...(toolInput.props as any) };
        }

        const { error } = await client
          .from("commercial_scenes")
          .update(updates)
          .eq("id", sceneId)
          .eq("project_id", projectId);

        if (error) return `Error updating scene: ${error.message}`;

        await client.from("commercial_projects")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", projectId);

        return `Scene ${sceneId} updated successfully.`;
      }

      case "commercial_remove_scene": {
        const client = await getSupabaseClient();
        const projectId = toolInput.project_id as string;
        const sceneId = toolInput.scene_id as string;
        if (!projectId || !sceneId) return "Error: project_id and scene_id are required.";

        const { error } = await client
          .from("commercial_scenes")
          .delete()
          .eq("id", sceneId)
          .eq("project_id", projectId);

        if (error) return `Error removing scene: ${error.message}`;

        await client.from("commercial_projects")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", projectId);

        return `Scene ${sceneId} removed.`;
      }

      case "commercial_reorder_scenes": {
        const client = await getSupabaseClient();
        const projectId = toolInput.project_id as string;
        const sceneIds = toolInput.scene_ids as string[];
        if (!projectId || !sceneIds?.length) return "Error: project_id and scene_ids are required.";

        for (let i = 0; i < sceneIds.length; i++) {
          await client
            .from("commercial_scenes")
            .update({ scene_order: i, updated_at: new Date().toISOString() })
            .eq("id", sceneIds[i])
            .eq("project_id", projectId);
        }

        await client.from("commercial_projects")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", projectId);

        return `Scenes reordered: ${sceneIds.length} scenes updated.`;
      }

      case "commercial_update_config": {
        const client = await getSupabaseClient();
        const projectId = toolInput.project_id as string;
        if (!projectId) return "Error: project_id is required.";

        const { data: existing } = await client
          .from("commercial_projects")
          .select("config, name")
          .eq("id", projectId)
          .single();

        if (!existing) return "Project not found.";

        const config = existing.config as any;
        if (toolInput.theme_primary) config.theme.primary = toolInput.theme_primary;
        if (toolInput.theme_accent) config.theme.accent = toolInput.theme_accent;
        if (toolInput.theme_background) config.theme.background = toolInput.theme_background;

        const updates: any = { config, updated_at: new Date().toISOString() };
        if (toolInput.name) updates.name = toolInput.name;

        const { error } = await client
          .from("commercial_projects")
          .update(updates)
          .eq("id", projectId);

        if (error) return `Error updating config: ${error.message}`;
        return `Project config updated. Theme: primary=${config.theme.primary}, accent=${config.theme.accent}${toolInput.name ? `, name="${toolInput.name}"` : ""}`;
      }

      case "commercial_get_project": {
        const client = await getSupabaseClient();
        const projectId = toolInput.project_id as string;
        if (!projectId) return "Error: project_id is required.";

        const { data: proj, error: projErr } = await client
          .from("commercial_projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (projErr || !proj) return `Project not found: ${projErr?.message || "no data"}`;

        const { data: scenes } = await client
          .from("commercial_scenes")
          .select("*")
          .eq("project_id", projectId)
          .order("scene_order", { ascending: true });

        const config = proj.config as any;
        let result = `Commercial Project: "${proj.name}"\n`;
        result += `project_id: ${proj.id}\n`;
        result += `status: ${proj.status}\n`;
        result += `theme: primary=${config.theme?.primary}, accent=${config.theme?.accent}\n`;
        result += `voiceover: ${proj.voiceover_url ? "yes" : "no"}\n`;
        result += `render: ${proj.render_url || "not rendered"}\n\n`;
        result += `Scenes (${scenes?.length || 0}):\n`;

        for (const s of scenes || []) {
          result += `  [${s.scene_order}] ${s.scene_type} | ${s.duration_frames}f (${(s.duration_frames / 30).toFixed(1)}s) | id: ${s.id}\n`;
          result += `       props: ${JSON.stringify(s.props).slice(0, 200)}\n`;
        }

        return result;
      }

      // ── GoHighLevel (GHL) Tool Cases ──

      case "ghl_contacts": {
        const clientName = toolInput.client_name as string;
        const action = toolInput.action as string;
        if (!clientName) return "Error: client_name is required. Use get_client_accounts to find client names.";
        if (!action) return "Error: action is required.";

        const location = await resolveGhlLocation(clientName);
        if (typeof location === "string") return location;
        const { locationId, accessToken } = location;
        const ghl = (opts: Omit<GhlRequestOptions, "accessToken">) => ghlLocationRequest(accessToken, opts);
        console.log(`[ghl] ${memberName} | ${action} | ${clientName} (${locationId})`);

        try {
          switch (action) {
            case "search_contacts": {
              const result = await ghl({
                endpoint: "/contacts/",
                locationId,
                params: {
                  query: toolInput.query as string,
                  email: toolInput.email as string,
                  phone: toolInput.phone as string,
                  limit: (toolInput.limit as number) || 20,
                  startAfter: toolInput.startAfter as string,
                },
              });
              return ghlResult(result);
            }
            case "get_contact": {
              const contactId = toolInput.contact_id as string;
              if (!contactId) return "Error: contact_id is required.";
              const result = await ghl({ endpoint: `/contacts/${contactId}` });
              return ghlResult(result);
            }
            case "create_contact": {
              const fields = toolInput.fields as Record<string, unknown>;
              if (!fields) return "Error: fields is required (firstName, lastName, email, phone, etc.).";
              const result = await ghl({ method: "POST", endpoint: "/contacts/", body: { ...fields, locationId } });
              return `Contact created!\n${ghlResult(result, 4000)}`;
            }
            case "update_contact": {
              const contactId = toolInput.contact_id as string;
              const fields = toolInput.fields as Record<string, unknown>;
              if (!contactId || !fields) return "Error: contact_id and fields are required.";
              const result = await ghl({ method: "PUT", endpoint: `/contacts/${contactId}`, body: fields });
              return `Contact updated!\n${ghlResult(result, 4000)}`;
            }
            case "delete_contact": {
              const contactId = toolInput.contact_id as string;
              if (!contactId) return "Error: contact_id is required.";
              await ghl({ method: "DELETE", endpoint: `/contacts/${contactId}` });
              return `Contact ${contactId} deleted.`;
            }
            case "upsert_contact": {
              const fields = toolInput.fields as Record<string, unknown>;
              if (!fields) return "Error: fields is required.";
              const result = await ghl({ method: "POST", endpoint: "/contacts/upsert", body: { ...fields, locationId } });
              return `Contact upserted!\n${ghlResult(result, 4000)}`;
            }
            case "add_tags": {
              const contactId = toolInput.contact_id as string;
              const tags = toolInput.tags as string[];
              if (!contactId || !tags?.length) return "Error: contact_id and tags (array) are required.";
              const result = await ghl({ method: "POST", endpoint: `/contacts/${contactId}/tags`, body: { tags } });
              return `Tags added to contact!\n${ghlResult(result, 4000)}`;
            }
            case "remove_tags": {
              const contactId = toolInput.contact_id as string;
              const tags = toolInput.tags as string[];
              if (!contactId || !tags?.length) return "Error: contact_id and tags (array) are required.";
              const result = await ghl({ method: "DELETE", endpoint: `/contacts/${contactId}/tags`, body: { tags } });
              return `Tags removed from contact!\n${ghlResult(result, 4000)}`;
            }
            case "list_tasks": {
              const contactId = toolInput.contact_id as string;
              if (!contactId) return "Error: contact_id is required.";
              const result = await ghl({ endpoint: `/contacts/${contactId}/tasks` });
              return ghlResult(result);
            }
            case "create_task": {
              const contactId = toolInput.contact_id as string;
              if (!contactId) return "Error: contact_id is required.";
              const result = await ghl({
                method: "POST",
                endpoint: `/contacts/${contactId}/tasks`,
                body: { title: toolInput.title as string, dueDate: toolInput.dueDate as string, description: toolInput.description as string },
              });
              return `Task created!\n${ghlResult(result, 4000)}`;
            }
            case "list_notes": {
              const contactId = toolInput.contact_id as string;
              if (!contactId) return "Error: contact_id is required.";
              const result = await ghl({ endpoint: `/contacts/${contactId}/notes` });
              return ghlResult(result);
            }
            case "create_note": {
              const contactId = toolInput.contact_id as string;
              const noteBody = toolInput.body as string;
              if (!contactId || !noteBody) return "Error: contact_id and body are required.";
              const result = await ghl({ method: "POST", endpoint: `/contacts/${contactId}/notes`, body: { body: noteBody } });
              return `Note added!\n${ghlResult(result, 4000)}`;
            }
            case "list_tags": {
              const result = await ghl({ endpoint: `/locations/${locationId}/tags` });
              return ghlResult(result);
            }
            case "create_tag": {
              const tagName = toolInput.name as string;
              if (!tagName) return "Error: name is required.";
              const result = await ghl({ method: "POST", endpoint: `/locations/${locationId}/tags`, body: { name: tagName } });
              return `Tag created!\n${ghlResult(result, 4000)}`;
            }
            case "delete_tag": {
              const tagId = toolInput.tag_id as string;
              if (!tagId) return "Error: tag_id is required.";
              await ghl({ method: "DELETE", endpoint: `/locations/${locationId}/tags/${tagId}` });
              return `Tag ${tagId} deleted.`;
            }
            case "get_custom_fields": {
              const model = (toolInput.model as string) || "contact";
              const result = await ghl({ endpoint: `/locations/${locationId}/customFields`, params: { model } });
              return ghlResult(result);
            }
            case "bulk_update": {
              const contactIds = toolInput.contact_ids as string[];
              const fields = toolInput.fields as Record<string, unknown>;
              if (!contactIds?.length || !fields) return "Error: contact_ids (array) and fields are required.";
              const results: string[] = [];
              for (const id of contactIds.slice(0, 25)) {
                try {
                  await ghl({ method: "PUT", endpoint: `/contacts/${id}`, body: fields });
                  results.push(`${id}: updated`);
                } catch (err: any) {
                  results.push(`${id}: FAILED - ${err.message}`);
                }
              }
              return `Bulk update (${results.length}/${contactIds.length}):\n${results.join("\n")}`;
            }
            default:
              return `Unknown ghl_contacts action "${action}". Available: search_contacts, get_contact, create_contact, update_contact, delete_contact, upsert_contact, add_tags, remove_tags, list_tasks, create_task, list_notes, create_note, list_tags, create_tag, delete_tag, get_custom_fields, bulk_update.`;
          }
        } catch (err: any) {
          return `GHL Contacts error (${clientName}): ${err.message}`;
        }
      }

      case "ghl_conversations": {
        const clientName = toolInput.client_name as string;
        const action = toolInput.action as string;
        if (!clientName) return "Error: client_name is required.";
        if (!action) return "Error: action is required.";

        const location = await resolveGhlLocation(clientName);
        if (typeof location === "string") return location;
        const { locationId, accessToken } = location;
        const ghl = (opts: Omit<GhlRequestOptions, "accessToken">) => ghlLocationRequest(accessToken, opts);
        console.log(`[ghl] ${memberName} | ${action} | ${clientName} (${locationId})`);

        try {
          switch (action) {
            case "list_conversations": {
              const result = await ghl({
                endpoint: "/conversations/search",
                locationId,
                params: { status: toolInput.status as string, limit: (toolInput.limit as number) || 20 },
              });
              return ghlResult(result);
            }
            case "get_conversation": {
              const convId = toolInput.conversation_id as string;
              if (!convId) return "Error: conversation_id is required.";
              const result = await ghl({ endpoint: `/conversations/${convId}` });
              return ghlResult(result);
            }
            case "search_conversations": {
              const result = await ghl({
                endpoint: "/conversations/search",
                locationId,
                params: { query: toolInput.query as string, contactId: toolInput.contact_id as string, limit: (toolInput.limit as number) || 20 },
              });
              return ghlResult(result);
            }
            case "get_messages": {
              const convId = toolInput.conversation_id as string;
              if (!convId) return "Error: conversation_id is required.";
              const result = await ghl({
                endpoint: `/conversations/${convId}/messages`,
                params: { limit: (toolInput.limit as number) || 20 },
              });
              return ghlResult(result);
            }
            case "send_message": {
              const contactId = toolInput.contact_id as string;
              const msgType = toolInput.type as string;
              if (!contactId) return "Error: contact_id is required.";
              if (!msgType) return "Error: type is required (SMS, Email, WhatsApp, etc.).";
              const body: Record<string, unknown> = {
                type: msgType,
                contactId,
              };
              if (toolInput.message) body.message = toolInput.message;
              if (toolInput.subject) body.subject = toolInput.subject;
              if (toolInput.html) body.html = toolInput.html;
              if (toolInput.emailFrom) body.emailFrom = toolInput.emailFrom;
              const result = await ghl({ method: "POST", endpoint: "/conversations/messages", body });
              return `Message sent (${msgType})!\n${ghlResult(result, 4000)}`;
            }
            case "update_conversation": {
              const convId = toolInput.conversation_id as string;
              if (!convId) return "Error: conversation_id is required.";
              const result = await ghl({
                method: "PUT",
                endpoint: `/conversations/${convId}`,
                body: { status: toolInput.status as string },
              });
              return `Conversation updated!\n${ghlResult(result, 4000)}`;
            }
            case "create_conversation": {
              const contactId = toolInput.contact_id as string;
              if (!contactId) return "Error: contact_id is required.";
              const result = await ghl({ method: "POST", endpoint: "/conversations/", body: { contactId, locationId } });
              return `Conversation created!\n${ghlResult(result, 4000)}`;
            }
            default:
              return `Unknown ghl_conversations action "${action}". Available: list_conversations, get_conversation, search_conversations, get_messages, send_message, update_conversation, create_conversation.`;
          }
        } catch (err: any) {
          return `GHL Conversations error (${clientName}): ${err.message}`;
        }
      }

      case "ghl_calendar": {
        const clientName = toolInput.client_name as string;
        const action = toolInput.action as string;
        if (!clientName) return "Error: client_name is required.";
        if (!action) return "Error: action is required.";

        const location = await resolveGhlLocation(clientName);
        if (typeof location === "string") return location;
        const { locationId, accessToken } = location;
        const ghl = (opts: Omit<GhlRequestOptions, "accessToken">) => ghlLocationRequest(accessToken, opts);
        console.log(`[ghl] ${memberName} | ${action} | ${clientName} (${locationId})`);

        try {
          switch (action) {
            case "list_calendars": {
              const result = await ghl({ endpoint: "/calendars/", locationId });
              return ghlResult(result);
            }
            case "get_calendar": {
              const calId = toolInput.calendar_id as string;
              if (!calId) return "Error: calendar_id is required.";
              const result = await ghl({ endpoint: `/calendars/${calId}` });
              return ghlResult(result);
            }
            case "create_calendar": {
              const result = await ghl({
                method: "POST",
                endpoint: "/calendars/",
                body: {
                  locationId,
                  name: toolInput.name as string,
                  description: toolInput.description as string,
                  calendarType: toolInput.calendarType as string,
                },
              });
              return `Calendar created!\n${ghlResult(result, 4000)}`;
            }
            case "update_calendar": {
              const calId = toolInput.calendar_id as string;
              const fields = toolInput.fields as Record<string, unknown>;
              if (!calId || !fields) return "Error: calendar_id and fields are required.";
              const result = await ghl({ method: "PUT", endpoint: `/calendars/${calId}`, body: fields });
              return `Calendar updated!\n${ghlResult(result, 4000)}`;
            }
            case "delete_calendar": {
              const calId = toolInput.calendar_id as string;
              if (!calId) return "Error: calendar_id is required.";
              await ghl({ method: "DELETE", endpoint: `/calendars/${calId}` });
              return `Calendar ${calId} deleted.`;
            }
            case "get_free_slots": {
              const calId = toolInput.calendar_id as string;
              if (!calId) return "Error: calendar_id is required.";
              const result = await ghl({
                endpoint: `/calendars/${calId}/free-slots`,
                params: {
                  startDate: toolInput.start_date as string,
                  endDate: toolInput.end_date as string,
                  timezone: toolInput.timezone as string,
                },
              });
              return ghlResult(result);
            }
            case "list_events": {
              const result = await ghl({
                endpoint: "/calendars/events",
                locationId,
                params: {
                  startTime: toolInput.start_date ? new Date(toolInput.start_date as string).getTime().toString() : undefined,
                  endTime: toolInput.end_date ? new Date(toolInput.end_date as string).getTime().toString() : undefined,
                  calendarId: toolInput.calendar_id as string,
                  contactId: toolInput.contact_id as string,
                },
              });
              return ghlResult(result);
            }
            case "get_event": {
              const eventId = toolInput.event_id as string;
              if (!eventId) return "Error: event_id is required.";
              const result = await ghl({ endpoint: `/calendars/events/appointments/${eventId}` });
              return ghlResult(result);
            }
            case "create_event": {
              const calId = toolInput.calendar_id as string;
              const contactId = toolInput.contact_id as string;
              if (!calId || !contactId) return "Error: calendar_id and contact_id are required.";
              const result = await ghl({
                method: "POST",
                endpoint: "/calendars/events",
                body: {
                  locationId,
                  calendarId: calId,
                  contactId,
                  startTime: toolInput.start_time as string,
                  endTime: toolInput.end_time as string,
                  title: toolInput.title as string,
                  notes: toolInput.notes as string,
                  status: toolInput.status as string || "confirmed",
                },
              });
              return `Event created!\n${ghlResult(result, 4000)}`;
            }
            case "update_event": {
              const eventId = toolInput.event_id as string;
              const fields = toolInput.fields as Record<string, unknown>;
              if (!eventId || !fields) return "Error: event_id and fields are required.";
              const result = await ghl({ method: "PUT", endpoint: `/calendars/events/${eventId}`, body: fields });
              return `Event updated!\n${ghlResult(result, 4000)}`;
            }
            case "delete_event": {
              const eventId = toolInput.event_id as string;
              if (!eventId) return "Error: event_id is required.";
              await ghl({ method: "DELETE", endpoint: `/calendars/events/${eventId}` });
              return `Event ${eventId} deleted.`;
            }
            case "list_calendar_groups": {
              const result = await ghl({ endpoint: "/calendars/groups", locationId });
              return ghlResult(result);
            }
            default:
              return `Unknown ghl_calendar action "${action}". Available: list_calendars, get_calendar, create_calendar, update_calendar, delete_calendar, get_free_slots, list_events, get_event, create_event, update_event, delete_event, list_calendar_groups.`;
          }
        } catch (err: any) {
          return `GHL Calendar error (${clientName}): ${err.message}`;
        }
      }

      case "ghl_pipeline": {
        const clientName = toolInput.client_name as string;
        const action = toolInput.action as string;
        if (!clientName) return "Error: client_name is required.";
        if (!action) return "Error: action is required.";

        const location = await resolveGhlLocation(clientName);
        if (typeof location === "string") return location;
        const { locationId, accessToken } = location;
        const ghl = (opts: Omit<GhlRequestOptions, "accessToken">) => ghlLocationRequest(accessToken, opts);
        console.log(`[ghl] ${memberName} | ${action} | ${clientName} (${locationId})`);

        try {
          switch (action) {
            case "list_pipelines": {
              const result = await ghl({ endpoint: "/opportunities/pipelines", locationId });
              return ghlResult(result);
            }
            case "list_stages": {
              const pipelineId = toolInput.pipeline_id as string;
              if (!pipelineId) return "Error: pipeline_id is required. Use list_pipelines first.";
              const result = await ghl({ endpoint: `/opportunities/pipelines/${pipelineId}`, locationId });
              return ghlResult(result);
            }
            case "search_opportunities": {
              const result = await ghl({
                endpoint: "/opportunities/search",
                locationId,
                params: {
                  pipeline_id: toolInput.pipeline_id as string,
                  stage_id: toolInput.stage_id as string,
                  status: toolInput.status as string,
                  q: toolInput.query as string,
                  contact_id: toolInput.contact_id as string,
                  limit: (toolInput.limit as number) || 20,
                },
              });
              return ghlResult(result);
            }
            case "get_opportunity": {
              const oppId = toolInput.opportunity_id as string;
              if (!oppId) return "Error: opportunity_id is required.";
              const result = await ghl({ endpoint: `/opportunities/${oppId}` });
              return ghlResult(result);
            }
            case "create_opportunity": {
              const pipelineId = toolInput.pipeline_id as string;
              const stageId = toolInput.stage_id as string;
              const contactId = toolInput.contact_id as string;
              if (!pipelineId || !stageId || !contactId) return "Error: pipeline_id, stage_id, and contact_id are required.";
              const result = await ghl({
                method: "POST",
                endpoint: "/opportunities/",
                body: {
                  locationId,
                  pipelineId,
                  pipelineStageId: stageId,
                  contactId,
                  name: toolInput.name as string,
                  monetaryValue: toolInput.monetaryValue as number,
                  status: (toolInput.status as string) || "open",
                  assignedTo: toolInput.assignedTo as string,
                },
              });
              return `Opportunity created!\n${ghlResult(result, 4000)}`;
            }
            case "update_opportunity": {
              const oppId = toolInput.opportunity_id as string;
              const fields = toolInput.fields as Record<string, unknown>;
              if (!oppId || !fields) return "Error: opportunity_id and fields are required.";
              const result = await ghl({ method: "PUT", endpoint: `/opportunities/${oppId}`, body: fields });
              return `Opportunity updated!\n${ghlResult(result, 4000)}`;
            }
            case "delete_opportunity": {
              const oppId = toolInput.opportunity_id as string;
              if (!oppId) return "Error: opportunity_id is required.";
              await ghl({ method: "DELETE", endpoint: `/opportunities/${oppId}` });
              return `Opportunity ${oppId} deleted.`;
            }
            case "upsert_opportunity": {
              const pipelineId = toolInput.pipeline_id as string;
              const contactId = toolInput.contact_id as string;
              const fields = toolInput.fields as Record<string, unknown>;
              if (!pipelineId || !contactId) return "Error: pipeline_id and contact_id are required.";
              const result = await ghl({
                method: "POST",
                endpoint: "/opportunities/upsert",
                body: { locationId, pipelineId, contactId, ...fields },
              });
              return `Opportunity upserted!\n${ghlResult(result, 4000)}`;
            }
            default:
              return `Unknown ghl_pipeline action "${action}". Available: list_pipelines, list_stages, search_opportunities, get_opportunity, create_opportunity, update_opportunity, delete_opportunity, upsert_opportunity.`;
          }
        } catch (err: any) {
          return `GHL Pipeline error (${clientName}): ${err.message}`;
        }
      }

      case "ghl_marketing": {
        const clientName = toolInput.client_name as string;
        const action = toolInput.action as string;
        if (!clientName) return "Error: client_name is required.";
        if (!action) return "Error: action is required.";

        const location = await resolveGhlLocation(clientName);
        if (typeof location === "string") return location;
        const { locationId, accessToken } = location;
        const ghl = (opts: Omit<GhlRequestOptions, "accessToken">) => ghlLocationRequest(accessToken, opts);
        console.log(`[ghl] ${memberName} | ${action} | ${clientName} (${locationId})`);

        try {
          switch (action) {
            case "list_campaigns": {
              const result = await ghl({ endpoint: "/campaigns/", locationId, params: { status: toolInput.status as string } });
              return ghlResult(result);
            }
            case "list_workflows": {
              const result = await ghl({ endpoint: "/workflows/", locationId });
              return ghlResult(result);
            }
            case "list_forms": {
              const result = await ghl({ endpoint: "/forms/", locationId });
              return ghlResult(result);
            }
            case "get_form_submissions": {
              const formId = toolInput.form_id as string;
              if (!formId) return "Error: form_id is required.";
              const result = await ghl({
                endpoint: `/forms/submissions`,
                locationId,
                params: { formId, limit: (toolInput.limit as number) || 20, page: toolInput.page as number },
              });
              return ghlResult(result);
            }
            case "list_funnels": {
              const result = await ghl({ endpoint: "/funnels/funnel/list", locationId });
              return ghlResult(result);
            }
            case "get_funnel_pages": {
              const funnelId = toolInput.funnel_id as string;
              if (!funnelId) return "Error: funnel_id is required.";
              const result = await ghl({ endpoint: `/funnels/funnel/${funnelId}`, locationId });
              return ghlResult(result);
            }
            case "list_email_templates": {
              const result = await ghl({ endpoint: "/emails/builder", locationId });
              return ghlResult(result);
            }
            case "list_surveys": {
              const result = await ghl({ endpoint: "/surveys/", locationId });
              return ghlResult(result);
            }
            case "get_survey_submissions": {
              const surveyId = toolInput.survey_id as string;
              if (!surveyId) return "Error: survey_id is required.";
              const result = await ghl({
                endpoint: `/surveys/submissions`,
                locationId,
                params: { surveyId, limit: (toolInput.limit as number) || 20, page: toolInput.page as number },
              });
              return ghlResult(result);
            }
            case "list_social_posts": {
              const result = await ghl({
                endpoint: `/social-media-posting/${locationId}/posts/list`,
                params: { status: toolInput.status as string, type: toolInput.type as string },
              });
              return ghlResult(result);
            }
            case "create_social_post": {
              const platforms = toolInput.platforms as string[];
              const content = toolInput.content as string;
              if (!platforms?.length || !content) return "Error: platforms (array) and content are required.";
              const body: Record<string, unknown> = { platforms, post: content };
              if (toolInput.media_urls) body.mediaUrls = toolInput.media_urls;
              if (toolInput.schedule_date) body.scheduledAt = toolInput.schedule_date;
              const result = await ghl({
                method: "POST",
                endpoint: `/social-media-posting/${locationId}/posts`,
                body,
              });
              return `Social post created!\n${ghlResult(result, 4000)}`;
            }
            case "delete_social_post": {
              const postId = toolInput.post_id as string;
              if (!postId) return "Error: post_id is required.";
              await ghl({ method: "DELETE", endpoint: `/social-media-posting/${locationId}/posts/${postId}` });
              return `Social post ${postId} deleted.`;
            }
            case "list_blogs": {
              const result = await ghl({ endpoint: "/blogs/", locationId });
              return ghlResult(result);
            }
            default:
              return `Unknown ghl_marketing action "${action}". Available: list_campaigns, list_workflows, list_forms, get_form_submissions, list_funnels, get_funnel_pages, list_email_templates, list_surveys, get_survey_submissions, list_social_posts, create_social_post, delete_social_post, list_blogs.`;
          }
        } catch (err: any) {
          return `GHL Marketing error (${clientName}): ${err.message}`;
        }
      }

      case "ghl_admin": {
        const action = toolInput.action as string;
        if (!action) return "Error: action is required.";

        // list_locations doesn't need a client_name
        if (action === "list_locations") {
          console.log(`[ghl] ${memberName} | list_locations`);
          try {
            const result = await ghlRequest({ endpoint: "/locations/search", params: { limit: 100, skip: 0 } });
            const locations = (result.locations || []).map((loc: any) => ({
              id: loc.id, name: loc.name, address: loc.address, city: loc.city,
              state: loc.state, phone: loc.phone, email: loc.email, website: loc.website,
              timezone: loc.timezone,
            }));
            return `Found ${locations.length} GHL locations:\n${ghlResult(locations)}`;
          } catch (err: any) {
            return `GHL Admin error: ${err.message}`;
          }
        }

        const clientName = toolInput.client_name as string;
        if (!clientName) return "Error: client_name is required for this action. Use list_locations to see all locations first.";

        const location = await resolveGhlLocation(clientName);
        if (typeof location === "string") return location;
        const { locationId, accessToken } = location;
        const ghl = (opts: Omit<GhlRequestOptions, "accessToken">) => ghlLocationRequest(accessToken, opts);
        console.log(`[ghl] ${memberName} | ${action} | ${clientName} (${locationId})`);

        try {
          switch (action) {
            case "get_location": {
              const result = await ghlRequest({ endpoint: `/locations/${locationId}` });
              return ghlResult(result);
            }
            case "list_users": {
              const result = await ghl({ endpoint: `/locations/${locationId}/users` });
              return ghlResult(result);
            }
            case "list_custom_fields": {
              const model = (toolInput.model as string) || "contact";
              const result = await ghl({ endpoint: `/locations/${locationId}/customFields`, params: { model } });
              return ghlResult(result);
            }
            case "create_custom_field": {
              const name = toolInput.name as string;
              const dataType = toolInput.dataType as string;
              if (!name || !dataType) return "Error: name and dataType are required.";
              const result = await ghl({
                method: "POST",
                endpoint: `/locations/${locationId}/customFields`,
                body: {
                  name,
                  dataType,
                  model: (toolInput.model as string) || "contact",
                  placeholder: toolInput.placeholder as string,
                },
              });
              return `Custom field created!\n${ghlResult(result, 4000)}`;
            }
            case "list_invoices": {
              const result = await ghl({
                endpoint: "/invoices/",
                params: { locationId, status: toolInput.status as string, limit: (toolInput.limit as number) || 20 },
              });
              return ghlResult(result);
            }
            case "get_invoice": {
              const invoiceId = toolInput.invoice_id as string;
              if (!invoiceId) return "Error: invoice_id is required.";
              const result = await ghl({ endpoint: `/invoices/${invoiceId}` });
              return ghlResult(result);
            }
            case "create_invoice": {
              const fields = toolInput.fields as Record<string, unknown>;
              if (!fields) return "Error: fields is required (name, contactId, items[], dueDate, etc.).";
              const result = await ghl({ method: "POST", endpoint: "/invoices/", body: { ...fields, locationId } });
              return `Invoice created!\n${ghlResult(result, 4000)}`;
            }
            case "list_products": {
              const result = await ghl({ endpoint: "/products/", locationId });
              return ghlResult(result);
            }
            case "create_product": {
              const name = toolInput.name as string;
              if (!name) return "Error: name is required.";
              const result = await ghl({
                method: "POST",
                endpoint: "/products/",
                body: { locationId, name, description: toolInput.description as string, prices: toolInput.prices as unknown[] },
              });
              return `Product created!\n${ghlResult(result, 4000)}`;
            }
            case "list_media": {
              const result = await ghl({ endpoint: "/medias/", params: { locationId, limit: (toolInput.limit as number) || 20 } });
              return ghlResult(result);
            }
            case "upload_media": {
              const fileUrl = toolInput.url as string;
              const fileName = toolInput.name as string;
              if (!fileUrl) return "Error: url is required (public URL of file to upload).";
              const result = await ghl({
                method: "POST",
                endpoint: "/medias/upload-file",
                body: { locationId, url: fileUrl, name: fileName },
              });
              return `Media uploaded!\n${ghlResult(result, 4000)}`;
            }
            case "list_documents": {
              const result = await ghl({ endpoint: "/documents/", locationId });
              return ghlResult(result);
            }
            case "send_document": {
              const contactId = toolInput.contact_id as string;
              const templateId = toolInput.template_id as string;
              if (!contactId || !templateId) return "Error: contact_id and template_id are required.";
              const result = await ghl({
                method: "POST",
                endpoint: "/documents/send",
                body: { locationId, contactId, templateId },
              });
              return `Document sent!\n${ghlResult(result, 4000)}`;
            }
            case "list_businesses": {
              const result = await ghl({ endpoint: "/businesses/", locationId });
              return ghlResult(result);
            }
            case "raw_api": {
              const method = (toolInput.method as string) || "GET";
              const endpoint = toolInput.endpoint as string;
              if (!endpoint) return "Error: endpoint is required (e.g. /contacts/).";
              const result = await ghl({
                method,
                endpoint,
                locationId,
                params: toolInput.params as Record<string, unknown>,
                body: toolInput.body as Record<string, unknown>,
              });
              return ghlResult(result);
            }
            default:
              return `Unknown ghl_admin action "${action}". Available: list_locations, get_location, list_users, list_custom_fields, create_custom_field, list_invoices, get_invoice, create_invoice, list_products, create_product, list_media, upload_media, list_documents, send_document, list_businesses, raw_api.`;
          }
        } catch (err: any) {
          return `GHL Admin error (${clientName}): ${err.message}`;
        }
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    console.error(`[tool] ERROR ${toolName}:`, err instanceof Error ? err.message : String(err));
    return `Error executing ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

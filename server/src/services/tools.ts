import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appendMemory, writeMemory } from "./memory.js";
import { getSecret, requireSecret } from "./secrets.js";
import { listZapierTools, callZapierTool } from "./zapier-mcp.js";

const execAsync = promisify(exec);

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR || "";
const TEAM_TIMEZONE = "America/New_York";
const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v23";

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
      "Replace this team member's entire memory with new content.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Full memory content in markdown." },
      },
      required: ["content"],
    },
  },
  {
    name: "append_memory",
    description: "Append a new note to this team member's memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        note: { type: "string", description: "Note to append." },
      },
      required: ["note"],
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
      "Make an HTTP request to any URL (REST APIs, Google Ads, Slack, Stripe, etc.). Returns status + response body.",
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
      "Post a message to a Slack channel. Requires SLACK_BOT_TOKEN in team_secrets.",
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
      "Look up a client's linked ad accounts, GA4 property, domain, and other metadata from the command center database. " +
      "Returns all account mappings (Google Ads, Meta Ads, TikTok, Bing, LinkedIn) plus client profile info. " +
      "If client_name is omitted, returns ALL active clients with their linked accounts. " +
      "ALWAYS call this before any Google Ads, Meta Ads, Supermetrics, or GA4 operation to avoid asking the user for account IDs.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name (case-insensitive). Omit to get all active clients with their accounts.",
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
      "Use this to pull completed or pending tasks for a specific client when generating client updates, weekly reports, or workload analysis. " +
      "Handles client name fuzzy matching automatically (abbreviations, acronyms, partial names). " +
      "Example: notion_query_tasks({client_name:'SDPF', start_date:'2026-02-26', end_date:'2026-03-05', status_filter:'completed'})",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name to filter by. Supports fuzzy matching (e.g. 'SDPF' matches 'San Diego Parks Foundation', 'GG' matches 'Global Guard').",
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
      required: ["client_name"],
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
          env: { ...process.env, HOME: tmpDir },
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
        const globFlag = glob ? `--glob '${glob}'` : "";
        const { stdout } = await execAsync(
          `rg --max-count=5 --max-filesize=500K ${globFlag} '${pattern.replace(/'/g, "\\'")}' '${searchPath}'`,
          { timeout: 15000 }
        ).catch(() => ({ stdout: "(no matches)" }));
        return stdout || "(no matches)";
      }

      case "deploy_site": {
        const dir = toolInput.directory as string;
        const projectName = toolInput.project_name as string | undefined;
        const token = await requireSecret("VERCEL_TOKEN", "Vercel Token");
        // Build the vercel deploy command (production so custom domains work)
        const nameFlag = projectName ? `--name "${projectName}"` : "";
        const cmd = `vercel deploy --yes --prod --token ${token} ${nameFlag}`.trim();
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: dir,
          timeout: 120000,
          env: { ...process.env, HOME: tmpDir },
        });
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();

        // Assign branded domain if project_name is provided
        const BRANDED_DOMAIN = "melleka.app";
        if (projectName) {
          const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
          const brandedUrl = `${slug}.${BRANDED_DOMAIN}`;
          try {
            await execAsync(
              `vercel alias set ${output.split("\n").pop()?.trim()} ${brandedUrl} --token ${token}`,
              { timeout: 30000, env: { ...process.env, HOME: tmpDir } }
            );
            return `Live at: https://${brandedUrl}`;
          } catch (aliasErr: any) {
            // Alias failed (domain not configured yet) — fall back to default URL
            return `${output}\n\n(Branded domain ${brandedUrl} not yet configured — using default Vercel URL above)`;
          }
        }

        return output || "(deploy completed, check Vercel dashboard for URL)";
      }

      case "save_memory": {
        await writeMemory(memberName, toolInput.content as string);
        return "Memory saved.";
      }

      case "append_memory": {
        await appendMemory(memberName, toolInput.note as string);
        return "Memory updated.";
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
        const { error, count } = await supabase
          .from("team_cron_jobs")
          .delete({ count: "exact" })
          .eq("member_name", memberName.toLowerCase())
          .eq("name", jobName);
        if (error) return `Error deleting job: ${error.message}`;
        cronReloadCallbacks.forEach((cb) => cb());
        return count ? `Cron job "${jobName}" deleted.` : `No job named "${jobName}" found.`;
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
          (q as Record<string, (...args: unknown[]) => unknown>)[f.op === "eq" ? "eq" : f.op === "neq" ? "neq" : f.op === "gt" ? "gt" : f.op === "gte" ? "gte" : f.op === "lt" ? "lt" : f.op === "lte" ? "lte" : "eq"](f.column, f.value);
        }
        const { data, error } = await (q as ReturnType<ReturnType<SupabaseClient["from"]>["select"]>).select();
        if (error) return `Supabase update error: ${(error as { message: string }).message}`;
        return `Updated ${(data as unknown[])?.length ?? 0} row(s).\n${JSON.stringify(data, null, 2).slice(0, 4000)}`;
      }

      case "slack_post": {
        const token = await requireSecret("SLACK_BOT_TOKEN", "Slack Bot Token");
        const channel = toolInput.channel as string;
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
          method: "PUT",
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

        // Fetch clients
        let clientQuery = client
          .from("managed_clients")
          .select("client_name, domain, ga4_property_id, industry, tier, is_active, primary_conversion_goal");
        if (clientName) {
          clientQuery = clientQuery.ilike("client_name", `%${clientName}%`);
        } else {
          clientQuery = clientQuery.eq("is_active", true);
        }
        const { data: clients, error: cErr } = await clientQuery;
        if (cErr) return `Error querying managed_clients: ${cErr.message}`;
        if (!clients || clients.length === 0) {
          return clientName
            ? `No client found matching "${clientName}". Use supabase_query on managed_clients to see all clients.`
            : "No active clients found in managed_clients.";
        }

        // Fetch all account mappings for these clients
        const names = clients.map((c) => c.client_name);
        const { data: mappings } = await client
          .from("client_account_mappings")
          .select("client_name, platform, account_id, account_name")
          .in("client_name", names);

        // Also fetch ppc_client_settings for any extra account IDs
        const { data: ppcSettings } = await client
          .from("ppc_client_settings")
          .select("client_name, google_account_id, meta_account_id")
          .in("client_name", names);

        // Build result
        const result = clients.map((c) => {
          const accts = (mappings || []).filter((m) => m.client_name === c.client_name);
          const ppc = (ppcSettings || []).find((p) => p.client_name === c.client_name);
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
            accounts: grouped,
            ppc_settings: ppc ? { google_account_id: ppc.google_account_id, meta_account_id: ppc.meta_account_id } : null,
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
        const clientName = toolInput.client_name as string;
        if (!clientName) return "Error: client_name is required.";

        const notionApiKey = process.env.NOTION_API_KEY;
        if (!notionApiKey) return "Error: NOTION_API_KEY is not configured.";

        const databaseId = (toolInput.database_id as string) || "9e7cd72f-e62c-4514-9456-5f51cbcfe981";
        const startDate = toolInput.start_date as string | undefined;
        const endDate = toolInput.end_date as string | undefined;
        const statusFilter = (toolInput.status_filter as string) || "completed";

        const notionHeaders = {
          Authorization: `Bearer ${notionApiKey}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        };

        // Build date filter
        const filterClauses: unknown[] = [];
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

          let resp: Response;
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

          if (!resp!.ok) {
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
        const results: Array<{ title: string; status: string; client: string; assignee: string; lastEdited: string; isCompleted: boolean }> = [];

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

          // Assignee
          let assignee = "";
          const ap = props["Assign"] || props["Managers"];
          if (ap?.people) assignee = ap.people.map((p: any) => p.name || "").filter(Boolean).join(", ");

          const lastEdited = task.last_edited_time || "";
          const statusLower = status.toLowerCase();
          const isCompleted = ["done", "good to launch", "archived", "complete", "completed"].some(s => statusLower.includes(s));
          const isNonEssential = statusLower.includes("non-essential") || statusLower.includes("non essential");

          if (isNonEssential) continue;
          if (!matchesClient(client, title)) continue;
          if (statusFilter === "completed" && !isCompleted) continue;
          if (statusFilter === "pending" && isCompleted) continue;

          results.push({ title, status, client, assignee, lastEdited, isCompleted });
        }

        // Format output
        const label = statusFilter === "completed" ? "Completed" : statusFilter === "pending" ? "Pending" : "All";
        let output = `${label} Tasks for "${clientName}"\n`;
        output += `Database: IN HOUSE TO-DO | Date range: ${startDate || "all time"} to ${endDate || "present"}\n`;
        output += `Total tasks scanned: ${allTasks.length} | Matched: ${results.length}\n\n`;

        if (results.length === 0) {
          output += `No ${label.toLowerCase()} tasks found for "${clientName}" in the given date range.\n`;
          output += `\nTip: Try broader date range or different name/alias. Aliases tried: ${[...aliases].join(", ")}`;
        } else {
          for (const t of results) {
            output += `- ${t.title}\n`;
            output += `  Status: ${t.status} | Edited: ${new Date(t.lastEdited).toLocaleDateString()}`;
            if (t.assignee) output += ` | Assigned: ${t.assignee}`;
            output += "\n";
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
            return "No Zapier automations configured. Visit mcp.zapier.com to set up actions, then add the MCP URL as ZAPIER_MCP_URL in team_secrets.";
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

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    console.error(`[tool] ERROR ${toolName}:`, err instanceof Error ? err.message : String(err));
    return `Error executing ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

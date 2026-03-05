import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appendMemory, writeMemory } from "./memory.js";
import { getSecret, requireSecret } from "./secrets.js";

const execAsync = promisify(exec);

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR || "";
const TEAM_TIMEZONE = "America/New_York";

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
      "Deploy a directory of HTML/CSS/JS files as a live website on Vercel. Returns the public URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        directory: {
          type: "string",
          description: "Absolute path to the directory containing your site files (index.html, etc.).",
        },
        project_name: {
          type: "string",
          description: "Vercel project name (optional, auto-generated if omitted).",
        },
      },
      required: ["directory"],
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
];

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
        // Build the vercel deploy command
        const nameFlag = projectName ? `--name "${projectName}"` : "";
        const cmd = `vercel deploy --yes --token ${token} ${nameFlag}`.trim();
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: dir,
          timeout: 120000,
          env: { ...process.env, HOME: tmpDir },
        });
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
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
          `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
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
          "https://googleads.googleapis.com/v23/customers:listAccessibleCustomers",
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
          `https://googleads.googleapis.com/v23/customers/${seedId}/googleAds:search`,
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

        // Build the mutation request body
        const mutateBody: Record<string, unknown> = {
          operations: operations.map((op) => {
            const mutateOp: Record<string, unknown> = {};
            if (op.create) mutateOp.create = op.create;
            if (op.update) mutateOp.update = op.update;
            if (op.remove) mutateOp.remove = op.remove;
            if (op.updateMask) mutateOp.updateMask = op.updateMask;
            return mutateOp;
          }),
        };

        const resp = await fetch(
          `https://googleads.googleapis.com/v23/customers/${customerId}/${resource}:mutate`,
          { method: "POST", headers, body: JSON.stringify(mutateBody) }
        );
        const data = await resp.json();

        if (!resp.ok) {
          const errStr = JSON.stringify(data, null, 2);
          return `Google Ads mutation error (${resp.status}):\n${errStr.slice(0, 4000)}`;
        }

        const resultStr = JSON.stringify(data, null, 2);
        return `Mutation successful!\n${resultStr.slice(0, 8000)}`;
      }

      case "meta_ads_manage": {
        const method = ((toolInput.method as string) || "GET").toUpperCase();
        const endpoint = toolInput.endpoint as string;
        const params = (toolInput.params as Record<string, string>) || {};
        let token = toolInput.access_token as string | undefined;

        if (!endpoint) return "Error: endpoint is required.";

        // If no token provided, try oauth_connections for a valid meta_ads token
        if (!token) {
          const client = await getSupabaseClient();
          const { data: oauthRow } = await client
            .from("oauth_connections")
            .select("access_token")
            .eq("provider", "meta_ads")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          token = oauthRow?.access_token ?? undefined;
          if (!token) {
            return "Error: No Meta access token available. Either pass access_token parameter or ensure a client has connected their Meta Ads account via OAuth (oauth_connections table).";
          }
        }

        const baseUrl = "https://graph.facebook.com/v21.0";

        if (method === "GET") {
          // Build query string
          const qs = new URLSearchParams({ ...params, access_token: token });
          const url = `${baseUrl}${endpoint}?${qs.toString()}`;
          const resp = await fetch(url);
          const data = await resp.json();

          if (!resp.ok) {
            return `Meta API error (${resp.status}): ${JSON.stringify(data, null, 2).slice(0, 4000)}`;
          }

          const resultStr = JSON.stringify(data, null, 2);
          return resultStr.length > 12000 ? resultStr.slice(0, 12000) + "\n[...truncated]" : resultStr;
        } else if (method === "POST") {
          // POST with form body
          const formParams = new URLSearchParams({ ...params, access_token: token });
          const resp = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formParams.toString(),
          });
          const data = await resp.json();

          if (!resp.ok) {
            return `Meta API error (${resp.status}): ${JSON.stringify(data, null, 2).slice(0, 4000)}`;
          }

          return `Success!\n${JSON.stringify(data, null, 2).slice(0, 8000)}`;
        } else if (method === "DELETE") {
          const qs = new URLSearchParams({ access_token: token });
          const resp = await fetch(`${baseUrl}${endpoint}?${qs.toString()}`, { method: "DELETE" });
          const data = await resp.json();

          if (!resp.ok) {
            return `Meta API error (${resp.status}): ${JSON.stringify(data, null, 2).slice(0, 4000)}`;
          }

          return `Deleted successfully.\n${JSON.stringify(data, null, 2)}`;
        } else {
          return `Error: Unsupported method '${method}'. Use GET, POST, or DELETE.`;
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

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    console.error(`[tool] ERROR ${toolName}:`, err instanceof Error ? err.message : String(err));
    return `Error executing ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

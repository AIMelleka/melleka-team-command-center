import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { appendMemory, writeMemory } from "./memory.js";

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
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Ads credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN on the server."
    );
  }
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
    name: "get_current_date",
    description:
      "Get the current date and time in the team's timezone (America/New_York). Use this before constructing any date ranges for API calls to ensure accuracy.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  memberName: string
): Promise<string> {
  const tmpDir = memberTmpDir(memberName);

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
        const token = process.env.VERCEL_TOKEN;
        if (!token) {
          return `Error: VERCEL_TOKEN is not configured on the server. Please ask the admin to add it.`;
        }
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
        const response = await fetch(url, {
          method,
          headers,
          body: reqBody,
        });
        const text = await response.text();
        const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n[...truncated]" : text;
        return `Status: ${response.status} ${response.statusText}\n\n${truncated}`;
      }

      case "send_email": {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          return `Error: RESEND_API_KEY is not configured. Ask the admin to add it to the server environment variables. Sign up free at resend.com to get one.`;
        }
        const to = toolInput.to as string;
        const subject = toolInput.subject as string;
        const htmlBody = toolInput.body as string;
        const from =
          (toolInput.from as string) ||
          process.env.FROM_EMAIL ||
          "Melleka Team Hub <onboarding@resend.dev>";
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
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
        if (!developerToken) {
          return "Error: GOOGLE_ADS_DEVELOPER_TOKEN not configured on the server.";
        }
        const accessToken = await refreshGoogleToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        };
        if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

        const resp = await fetch(
          `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
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
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!developerToken) {
          return "Error: GOOGLE_ADS_DEVELOPER_TOKEN not configured on the server.";
        }
        const accessToken = await refreshGoogleToken();
        const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
        };
        if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

        const resp = await fetch(
          "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
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
          `https://googleads.googleapis.com/v18/customers/${seedId}/googleAds:search`,
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

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    return `Error executing ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

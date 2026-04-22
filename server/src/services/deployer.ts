import { exec } from "child_process";
import { promisify } from "util";
import { requireSecret } from "./secrets.js";

const execAsync = promisify(exec);

// Env vars stripped from child processes to prevent secret leakage
const SENSITIVE_ENV_KEYS = [
  "ANTHROPIC_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_AUTH_KEY",
  "JWT_SECRET", "TEAM_PASSWORD",
  "GOOGLE_CLIENT_SECRET", "GOOGLE_SA_PRIVATE_KEY", "META_ACCESS_TOKEN",
  "CANVA_CLIENT_SECRET", "ELEVENLABS_API_KEY", "RESEND_API_KEY",
  "VERCEL_TOKEN", "NOTION_API_KEY", "SLACK_BOT_TOKEN",
];

function safeEnv(extra?: Record<string, string>): Record<string, string | undefined> {
  const env = { ...process.env, ...extra };
  for (const k of SENSITIVE_ENV_KEYS) delete env[k];
  return env;
}

export interface DeployResult {
  brandedUrl: string;
  vercelUrl: string | null;
  output: string;
  domainOk: boolean;
}

/**
 * Deploy a directory of static files to Vercel with branded domain.
 * Extracted from the deploy_site tool so both the tool and the websites API can share it.
 */
export async function deployToVercel(
  directory: string,
  projectName: string,
  homeDir: string = "/tmp"
): Promise<DeployResult> {
  const token = await requireSecret("VERCEL_TOKEN", "Vercel Token");

  // Link to Vercel project first (replaces deprecated --name flag)
  if (projectName) {
    try {
      await execAsync(
        `vercel link --yes --project "${projectName}" --token ${token}`,
        { cwd: directory, timeout: 30000, env: safeEnv({ HOME: homeDir }) }
      );
    } catch {
      // Project may not exist yet — vercel deploy --prod will create it
    }
  }

  const cmd = `vercel deploy --yes --prod --token ${token}`;
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: directory,
    timeout: 120000,
    env: safeEnv({ HOME: homeDir }),
  });
  const output = [stdout, stderr].filter(Boolean).join("\n").trim();

  const BRANDED_DOMAIN = process.env.BRANDED_DOMAIN || "melleka.app";
  const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const brandedUrl = `${slug}.${BRANDED_DOMAIN}`;

  // Extract deployment URL from output for alias fallback
  const deployUrlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
  const vercelUrl = deployUrlMatch?.[0] || null;

  // Try method 1: vercel domains add (project domain)
  let domainOk = false;
  try {
    await execAsync(
      `vercel domains add ${brandedUrl} ${projectName} --token ${token}`,
      { timeout: 30000, env: safeEnv({ HOME: homeDir }) }
    );
    domainOk = true;
  } catch (domainErr: any) {
    const errMsg = domainErr?.stderr || domainErr?.message || "";
    if (errMsg.includes("already") || errMsg.includes("exists")) {
      domainOk = true;
    }
  }

  // Try method 2: vercel alias (if domains add failed)
  if (!domainOk && vercelUrl) {
    try {
      await execAsync(
        `vercel alias set ${vercelUrl} ${brandedUrl} --token ${token}`,
        { timeout: 30000, env: safeEnv({ HOME: homeDir }) }
      );
      domainOk = true;
    } catch {
      // alias also failed
    }
  }

  if (!domainOk) {
    console.warn(`[deployer] Failed to assign ${brandedUrl} — returning it anyway (wildcard DNS may handle it)`);
  }

  return { brandedUrl, vercelUrl, output, domainOk };
}

/**
 * Add a custom domain to a Vercel project via the API.
 */
export async function addCustomDomain(
  vercelProjectName: string,
  domain: string
): Promise<{ success: boolean; message: string }> {
  const token = await requireSecret("VERCEL_TOKEN", "Vercel Token");

  try {
    const resp = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectName}/domains`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        success: false,
        message: data?.error?.message || `Failed to add domain: ${resp.status}`,
      };
    }

    return {
      success: true,
      message: `Domain ${domain} added. Configure DNS: ${data.apexName ? `A record -> 76.76.21.21` : `CNAME -> cname.vercel-dns.com`}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to add domain" };
  }
}

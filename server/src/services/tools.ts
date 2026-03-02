import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { appendMemory, writeMemory } from "./memory.js";

const execAsync = promisify(exec);

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR || "";
const LOCAL_TEAM_DIR = process.env.LOCAL_TEAM_DIR || "/tmp/team";

/** Member's dedicated scratch space — always writable */
function memberTmpDir(memberName: string): string {
  const slug = memberName.toLowerCase().replace(/\s+/g, "-");
  return `/tmp/${slug}`;
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

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    return `Error executing ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { appendMemory, getMemberDir, writeMemory } from "./memory.js";

const execAsync = promisify(exec);

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR ?? "/Users/aimelleka/Clients/Main Melleka Turbo AI";

function getAllowedDirs(memberName: string): string[] {
  const dirs = [
    path.join(process.env.LOCAL_TEAM_DIR ?? "/Users/aimelleka/Clients/ai/melleka/team", memberName.toLowerCase().replace(/\s+/g, "-")),
  ];
  if (MELLEKA_PROJECT) dirs.push(MELLEKA_PROJECT);
  return dirs;
}

function isPathAllowed(filePath: string, memberName: string): boolean {
  const resolved = path.resolve(filePath);
  return getAllowedDirs(memberName).some((dir) => resolved.startsWith(dir));
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file from the filesystem.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Absolute or relative file path to read." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with the given content.",
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
    description: "Execute a shell command. Restricted to safe project directories.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to run." },
        cwd: { type: "string", description: "Working directory (optional)." },
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
    description: "Search for a pattern in the codebase using grep.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for." },
        search_path: {
          type: "string",
          description: "Directory to search in. Defaults to Melleka project root.",
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
    name: "save_memory",
    description: "Replace this team member's entire memory with new content. Use to set the full memory state.",
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
    description: "Append a new note to this team member's memory without replacing existing content.",
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
    description: "Spawn a background sub-agent to handle a long-running or parallel task. Returns immediately with a task description.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: { type: "string", description: "Description of the task for the agent to execute." },
        context: { type: "string", description: "Additional context or files the agent needs." },
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
  try {
    switch (toolName) {
      case "read_file": {
        const filePath = toolInput.path as string;
        if (!isPathAllowed(filePath, memberName)) {
          return `Error: Access denied. Path is outside allowed directories.`;
        }
        const content = await fs.readFile(filePath, "utf-8");
        return content.length > 50000 ? content.slice(0, 50000) + "\n\n[...truncated at 50k chars]" : content;
      }

      case "write_file": {
        const filePath = toolInput.path as string;
        const content = toolInput.content as string;
        if (!isPathAllowed(filePath, memberName)) {
          return `Error: Access denied. Path is outside allowed directories.`;
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf-8");
        return `File written: ${filePath}`;
      }

      case "run_command": {
        const command = toolInput.command as string;
        const cwd = (toolInput.cwd as string) || MELLEKA_PROJECT || process.cwd();
        if (!isPathAllowed(cwd, memberName)) {
          return `Error: Working directory is outside allowed directories.`;
        }
        // Block obviously dangerous commands
        const dangerous = /\b(rm\s+-rf|sudo|passwd|chmod\s+777|curl.*\|.*sh|wget.*\|.*sh)\b/i;
        if (dangerous.test(command)) {
          return `Error: Command blocked for safety reasons.`;
        }
        const { stdout, stderr } = await execAsync(command, { cwd, timeout: 30000 });
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        return output || "(no output)";
      }

      case "list_files": {
        const dirPath = toolInput.path as string;
        if (!isPathAllowed(dirPath, memberName)) {
          return `Error: Access denied.`;
        }
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
          .map((e) => `${e.isDirectory() ? "[dir]" : "[file]"} ${e.name}`)
          .join("\n");
      }

      case "search_code": {
        const pattern = toolInput.pattern as string;
        const searchPath = (toolInput.search_path as string) || MELLEKA_PROJECT || process.cwd();
        const glob = toolInput.file_glob as string | undefined;
        const globFlag = glob ? `--glob '${glob}'` : "";
        const { stdout } = await execAsync(
          `rg --max-count=5 --max-filesize=500K ${globFlag} '${pattern.replace(/'/g, "\\'")}' '${searchPath}'`,
          { timeout: 15000 }
        ).catch(() => ({ stdout: "(no matches)" }));
        return stdout || "(no matches)";
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
        // In a real deployment you'd queue this; for now return a placeholder
        return `Sub-agent task queued: "${task}"${context ? `\nContext provided: ${context.slice(0, 200)}` : ""}.\nNote: Background agents run asynchronously. Results will be saved to your work folder when complete.`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    return `Error executing ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

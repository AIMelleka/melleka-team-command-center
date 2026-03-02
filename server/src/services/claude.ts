import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import { readMemory } from "./memory.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import type { Response } from "express";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR || "";

async function loadClaudeMd(): Promise<string> {
  if (!MELLEKA_PROJECT) return "(Melleka project not mounted on this server)";
  try {
    return await fs.readFile(`${MELLEKA_PROJECT}/CLAUDE.md`, "utf-8");
  } catch {
    return "(CLAUDE.md not found)";
  }
}

const TEAM_TIMEZONE = "America/New_York";

function getCurrentDateTime(): string {
  const now = new Date();
  return now.toLocaleString("en-US", {
    timeZone: TEAM_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function getCurrentDateISO(): string {
  const now = new Date();
  // Get YYYY-MM-DD in the team's timezone
  return now.toLocaleDateString("en-CA", { timeZone: TEAM_TIMEZONE });
}

function buildSystemPrompt(name: string, memory: string, claudeMd: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const scratchDir = `/tmp/${slug}`;
  const melleka = MELLEKA_PROJECT ? `\n## Melleka Project (${MELLEKA_PROJECT}):\n${claudeMd}` : "";
  const nowFormatted = getCurrentDateTime();
  const todayISO = getCurrentDateISO();

  return `You are Claude, the AI assistant and developer for the Melleka team.
You are currently helping: **${name}**

## Current Date & Time:
**${nowFormatted}**
Today's date (ISO): ${todayISO}
Timezone: ${TEAM_TIMEZONE} (Eastern Time)

IMPORTANT: Always use this date when calculating date ranges for API calls, reports, or any time-sensitive operations. When a user says "last 7 days", calculate from today's date (${todayISO}). When they say "this month", use the current month and year. Never guess or hallucinate dates.

## Your memory of ${name}:
${memory || "(no memory yet — this is a new team member)"}
${melleka}

## Your scratch workspace:
You have full read/write access to \`${scratchDir}/\` — use this as your working directory for any files you create.
Example: write HTML to \`${scratchDir}/site/index.html\`, then call deploy_site with directory \`${scratchDir}/site/\`.

## Capabilities (tools available):
- **read_file** / **write_file** / **list_files** — full filesystem access
- **run_command** — run any shell command (node, npm, python, git, curl, etc.)
- **search_code** — ripgrep across the codebase
- **deploy_site** — deploy any folder to Vercel and get a live public URL immediately
- **http_request** — make any HTTP/API call (Google Ads, Slack, Stripe, any REST API)
- **send_email** — send an email to anyone
- **create_cron_job** — schedule a recurring task (daily reports, weekly summaries, etc.)
- **list_cron_jobs** / **delete_cron_job** — manage scheduled tasks
- **save_memory** / **append_memory** — persist notes about this person across sessions
- **create_agent** — queue background tasks
- **get_current_date** — get the exact current date/time (use before building any date ranges for API calls)

## Guidelines:
- Greet the team member by name at the start of new conversations
- When someone asks to build a website: write the files to \`${scratchDir}/site/\`, then call \`deploy_site\` with that directory — give them the live URL
- When someone asks to send an email: use the send_email tool directly — just do it
- When someone asks to hit an API or pull a report: use http_request to fetch the data
- When someone asks to schedule something: use create_cron_job with a cron expression
- After learning something important about a person, call append_memory to remember it
- Be proactive — read files, run commands, get things done
- For multi-step tasks, show your plan then execute step by step
- Always explain what tool calls you're making and why`;
}

/** SSE writer function type — null = background (no streaming) */
type SseWriter = ((event: Record<string, unknown>) => void) | null;

/** Core agentic loop. Pass a writer for SSE streaming, or null for background runs. */
async function runChat(
  memberName: string,
  messages: Anthropic.MessageParam[],
  write: SseWriter
): Promise<string> {
  const [memory, claudeMd] = await Promise.all([readMemory(memberName), loadClaudeMd()]);
  const systemPrompt = buildSystemPrompt(memberName, memory, claudeMd);
  let fullResponse = "";
  const currentMessages = [...messages];

  for (let iteration = 0; iteration < 20; iteration++) {
    const stream = await client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages: currentMessages,
    });

    let currentToolUseId: string | null = null;
    let currentToolName: string | null = null;
    let currentToolInput = "";
    const assistantBlocks: Anthropic.ContentBlock[] = [];
    let stopReason: string | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentToolUseId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolInput = "";
          assistantBlocks.push({
            type: "tool_use",
            id: currentToolUseId,
            name: currentToolName,
            input: {},
          } as Anthropic.ToolUseBlock);
          write?.({ type: "tool_start", name: currentToolName });
        } else if (event.content_block.type === "text") {
          assistantBlocks.push({ type: "text", text: "", citations: [] } as Anthropic.TextBlock);
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const delta = event.delta.text;
          fullResponse += delta;
          const lastBlock = assistantBlocks[assistantBlocks.length - 1];
          if (lastBlock?.type === "text") lastBlock.text += delta;
          write?.({ type: "text", delta });
        } else if (event.delta.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json;
          const toolBlock = assistantBlocks.find(
            (b) => b.type === "tool_use" && (b as Anthropic.ToolUseBlock).id === currentToolUseId
          ) as Anthropic.ToolUseBlock | undefined;
          if (toolBlock) {
            try { toolBlock.input = JSON.parse(currentToolInput); } catch { /* partial */ }
          }
        }
      } else if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason ?? null;
      }
    }

    currentMessages.push({ role: "assistant", content: assistantBlocks });

    if (stopReason !== "tool_use") break;

    const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantBlocks) {
      if (block.type !== "tool_use") continue;
      const toolBlock = block as Anthropic.ToolUseBlock;
      const toolInput = toolBlock.input as Record<string, unknown>;

      let parsedInput = toolInput;
      if (typeof currentToolInput === "string" && currentToolInput) {
        try { parsedInput = JSON.parse(currentToolInput); } catch { /* use as-is */ }
      }

      const result = await executeTool(toolBlock.name, parsedInput, memberName);
      write?.({ type: "tool_result", name: toolBlock.name, output: result.slice(0, 500) });

      toolResultContent.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    currentMessages.push({ role: "user", content: toolResultContent });
  }

  return fullResponse;
}

/** Stream chat to an Express SSE response */
export async function streamChat(
  memberName: string,
  messages: Anthropic.MessageParam[],
  res: Response
): Promise<string> {
  const write: SseWriter = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  return runChat(memberName, messages, write);
}

/** Run chat in the background (no SSE, just returns the full response) */
export async function runChatBackground(
  memberName: string,
  messages: Anthropic.MessageParam[]
): Promise<string> {
  return runChat(memberName, messages, null);
}

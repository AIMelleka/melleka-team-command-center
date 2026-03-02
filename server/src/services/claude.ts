import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import { readMemory } from "./memory.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import type { Response } from "express";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR ?? "/Users/aimelleka/Clients/Main Melleka Turbo AI";

async function loadClaudeMd(): Promise<string> {
  try {
    return await fs.readFile(`${MELLEKA_PROJECT}/CLAUDE.md`, "utf-8");
  } catch {
    return "(CLAUDE.md not available — Melleka project not mounted)";
  }
}

function buildSystemPrompt(name: string, memory: string, claudeMd: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const scratchDir = `/tmp/${slug}`;
  const melleka = MELLEKA_PROJECT ? `\n## Melleka Project (${MELLEKA_PROJECT}):\n${claudeMd}` : "";

  return `You are Claude, the AI assistant and developer for the Melleka team.
You are currently helping: **${name}**

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
- **save_memory** / **append_memory** — persist notes about this person across sessions
- **create_agent** — queue background tasks

## Guidelines:
- Greet the team member by name at the start of new conversations
- When someone asks to build a website: write the files to \`${scratchDir}/site/\`, then call \`deploy_site\` with that directory — give them the live URL
- After learning something important about a person, call append_memory to remember it
- Be proactive — read files, run commands, get things done
- For multi-step tasks, show your plan then execute step by step
- Always explain what tool calls you're making and why`;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamChat(
  memberName: string,
  messages: Anthropic.MessageParam[],
  res: Response
): Promise<string> {
  const [memory, claudeMd] = await Promise.all([
    readMemory(memberName),
    loadClaudeMd(),
  ]);

  const systemPrompt = buildSystemPrompt(memberName, memory, claudeMd);

  let fullResponse = "";

  // Agentic loop — keep going until end_turn (no more tool calls)
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
          // Tell the client a tool call is starting
          res.write(
            `data: ${JSON.stringify({ type: "tool_start", name: currentToolName })}\n\n`
          );
        } else if (event.content_block.type === "text") {
          assistantBlocks.push({ type: "text", text: "", citations: [] } as Anthropic.TextBlock);
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const delta = event.delta.text;
          fullResponse += delta;
          // Update the last text block
          const lastBlock = assistantBlocks[assistantBlocks.length - 1];
          if (lastBlock?.type === "text") lastBlock.text += delta;
          res.write(`data: ${JSON.stringify({ type: "text", delta })}\n\n`);
        } else if (event.delta.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json;
          // Update the tool_use block input
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

    // Add assistant message to history
    currentMessages.push({ role: "assistant", content: assistantBlocks });

    if (stopReason !== "tool_use") break;

    // Execute all tool calls and collect results
    const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantBlocks) {
      if (block.type !== "tool_use") continue;
      const toolBlock = block as Anthropic.ToolUseBlock;
      const toolInput = toolBlock.input as Record<string, unknown>;

      // Parse input if it's still a string
      let parsedInput = toolInput;
      if (typeof currentToolInput === "string" && currentToolInput) {
        try { parsedInput = JSON.parse(currentToolInput); } catch { /* use as-is */ }
      }

      const result = await executeTool(toolBlock.name, parsedInput, memberName);

      res.write(
        `data: ${JSON.stringify({ type: "tool_result", name: toolBlock.name, output: result.slice(0, 500) })}\n\n`
      );

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

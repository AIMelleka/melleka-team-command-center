/**
 * LLM Provider Fallback Layer
 * Tries Claude -> Gemini -> OpenAI in order.
 * Normalizes all streaming responses to Claude's event format so the
 * existing agentic loop works unchanged.
 */
import Anthropic from "@anthropic-ai/sdk";

// ── Types ────────────────────────────────────────────────────────────

type SseWriter = ((event: Record<string, unknown>) => void) | null;

/** Normalized stream event — matches Claude's streaming format exactly */
export interface LLMStreamEvent {
  type: "content_block_start" | "content_block_delta" | "message_delta";
  index?: number;
  content_block?: {
    type: "text" | "tool_use";
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  delta?: {
    type?: "text_delta" | "input_json_delta";
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
}

type Provider = "claude" | "gemini" | "openai";
const PROVIDERS: Provider[] = ["claude", "gemini", "openai"];

// ── Circuit breaker ──────────────────────────────────────────────────

const providerCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60_000;

function isProviderCoolingDown(provider: string): boolean {
  const lastFail = providerCooldowns.get(provider);
  if (!lastFail) return false;
  if (Date.now() - lastFail > COOLDOWN_MS) {
    providerCooldowns.delete(provider);
    return false;
  }
  return true;
}

function shouldFallback(err: any): boolean {
  const status = err.status ?? err.statusCode ?? 0;
  const msg = (err.message ?? "").toLowerCase();
  // Provider is down, rate limited, billing issue, overloaded
  if ([429, 500, 502, 503, 529].includes(status)) return true;
  if (msg.includes("credit balance") || msg.includes("too low")) return true;
  if (msg.includes("overloaded") || msg.includes("capacity")) return true;
  if (msg.includes("billing") || msg.includes("quota")) return true;
  if (msg.includes("econnrefused") || msg.includes("enotfound")) return true;
  if (msg.includes("fetch failed") || msg.includes("network")) return true;
  // Billing errors come as 400 from Anthropic — must fallback
  if (status === 400 && (msg.includes("credit") || msg.includes("billing"))) return true;
  // Auth config issues — try next provider
  if (status === 401 || status === 403) return true;
  // Other 400 errors = bad request = our fault, don't fallback
  if (status === 400) return false;
  return true; // default: try next provider
}

// ── Tool schema converters ───────────────────────────────────────────

function toGeminiTools(tools: Anthropic.Tool[]): any {
  return [{
    functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    })),
  }];
}

function toOpenAITools(tools: Anthropic.Tool[]): any[] {
  return tools.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// ── Message format converters ────────────────────────────────────────

function toGeminiMessages(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
): { systemInstruction: any; contents: any[] } {
  const contents: any[] = [];

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    const parts: any[] = [];

    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push({ text: (block as any).text });
        } else if (block.type === "tool_use") {
          const tb = block as Anthropic.ToolUseBlock;
          parts.push({ functionCall: { name: tb.name, args: tb.input } });
        } else if (block.type === "tool_result") {
          const tr = block as any;
          const resultText = typeof tr.content === "string"
            ? tr.content
            : JSON.stringify(tr.content);
          parts.push({
            functionResponse: {
              name: tr.tool_use_id || "unknown",
              response: { result: resultText },
            },
          });
        } else if (block.type === "image") {
          // Skip images for Gemini fallback
          parts.push({ text: "[image omitted in fallback mode]" });
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
  };
}

function toOpenAIMessages(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
): any[] {
  const result: any[] = [{ role: "system", content: systemPrompt }];

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      result.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      // Check for tool results (they become separate messages in OpenAI)
      const toolResults = (msg.content as any[]).filter(b => b.type === "tool_result");
      const otherBlocks = (msg.content as any[]).filter(b => b.type !== "tool_result");

      if (otherBlocks.length > 0) {
        const textParts: string[] = [];
        const toolCalls: any[] = [];

        for (const block of otherBlocks) {
          if (block.type === "text") {
            textParts.push((block as any).text);
          } else if (block.type === "tool_use") {
            const tb = block as Anthropic.ToolUseBlock;
            toolCalls.push({
              id: tb.id,
              type: "function",
              function: {
                name: tb.name,
                arguments: JSON.stringify(tb.input),
              },
            });
          }
        }

        const assistantMsg: any = {
          role: msg.role,
          content: textParts.join("\n") || null,
        };
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls;
        }
        result.push(assistantMsg);
      }

      for (const tr of toolResults) {
        result.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
        });
      }
    }
  }

  return result;
}

// ── Stream normalizers ───────────────────────────────────────────────

/** Normalize Claude's native stream (already in the right format) */
async function* normalizeClaude(
  stream: AsyncIterable<any>,
): AsyncGenerator<LLMStreamEvent> {
  for await (const event of stream) {
    yield event as LLMStreamEvent;
  }
}

/** Parse Gemini SSE stream and normalize to Claude format */
async function* normalizeGemini(
  response: globalThis.Response,
): AsyncGenerator<LLMStreamEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let blockIndex = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;

      let chunk: any;
      try { chunk = JSON.parse(raw); } catch { continue; }

      const parts = chunk.candidates?.[0]?.content?.parts || [];
      const finishReason = chunk.candidates?.[0]?.finishReason;

      for (const part of parts) {
        if (part.text !== undefined) {
          yield {
            type: "content_block_start",
            index: blockIndex,
            content_block: { type: "text" },
          };
          yield {
            type: "content_block_delta",
            index: blockIndex,
            delta: { type: "text_delta", text: part.text },
          };
          blockIndex++;
        } else if (part.functionCall) {
          const toolId = `toolu_gemini_${blockIndex}`;
          yield {
            type: "content_block_start",
            index: blockIndex,
            content_block: {
              type: "tool_use",
              id: toolId,
              name: part.functionCall.name,
            },
          };
          yield {
            type: "content_block_delta",
            index: blockIndex,
            delta: {
              type: "input_json_delta",
              partial_json: JSON.stringify(part.functionCall.args || {}),
            },
          };
          blockIndex++;
        }
      }

      if (finishReason) {
        const stopReason = finishReason === "STOP" ? "end_turn"
          : parts.some((p: any) => p.functionCall) ? "tool_use"
          : "end_turn";
        yield {
          type: "message_delta",
          delta: { stop_reason: stopReason },
        };
      }
    }
  }

  // If no explicit finish, emit end_turn
  yield {
    type: "message_delta",
    delta: { stop_reason: "end_turn" },
  };
}

/** Parse OpenAI SSE stream and normalize to Claude format */
async function* normalizeOpenAI(
  response: globalThis.Response,
): AsyncGenerator<LLMStreamEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let blockIndex = 0;
  let activeToolCalls = new Map<number, { id: string; name: string; argsBuffer: string }>();
  let textStarted = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;

      let chunk: any;
      try { chunk = JSON.parse(raw); } catch { continue; }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;
      const finishReason = choice.finish_reason;

      // Text content
      if (delta?.content) {
        if (!textStarted) {
          yield {
            type: "content_block_start",
            index: blockIndex,
            content_block: { type: "text" },
          };
          textStarted = true;
        }
        yield {
          type: "content_block_delta",
          index: blockIndex,
          delta: { type: "text_delta", text: delta.content },
        };
      }

      // Tool calls
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (tc.id) {
            // New tool call starting
            if (textStarted) {
              blockIndex++;
              textStarted = false;
            }
            activeToolCalls.set(idx, { id: tc.id, name: tc.function?.name || "", argsBuffer: "" });
            yield {
              type: "content_block_start",
              index: blockIndex + idx,
              content_block: {
                type: "tool_use",
                id: tc.id,
                name: tc.function?.name || "",
              },
            };
          }
          if (tc.function?.arguments) {
            const existing = activeToolCalls.get(idx);
            if (existing) {
              existing.argsBuffer += tc.function.arguments;
              yield {
                type: "content_block_delta",
                index: blockIndex + idx,
                delta: {
                  type: "input_json_delta",
                  partial_json: tc.function.arguments,
                },
              };
            }
          }
        }
      }

      // Finish
      if (finishReason) {
        const stopReason = finishReason === "tool_calls" ? "tool_use"
          : finishReason === "length" ? "max_tokens"
          : "end_turn";
        yield {
          type: "message_delta",
          delta: { stop_reason: stopReason },
        };
      }
    }
  }
}

// ── Provider call functions ──────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  model?: string,
  anthropicApiKey?: string,
): Promise<AsyncGenerator<LLMStreamEvent>> {
  const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error("ANTHROPIC_API_KEY not configured"), { status: 401 });

  const client = new Anthropic({ apiKey });

  // Use the non-streaming API first to detect billing/auth errors immediately
  // rather than discovering them mid-stream where the fallback can't catch them.
  // We make a minimal preflight check, then stream the real request.
  try {
    const stream = await client.messages.stream(
      {
        model: model || "claude-opus-4-6",
        max_tokens: 32768,
        system: systemPrompt,
        tools,
        messages,
      },
      {},
    );

    // Consume the first event to validate the connection works.
    // If billing is the issue, the error fires here where callLLMWithFallback catches it.
    const gen = normalizeClaude(stream);
    const first = await gen.next();

    // Return a generator that yields the first event then the rest
    return (async function* () {
      if (!first.done) yield first.value;
      yield* gen;
    })();
  } catch (err: any) {
    // Re-throw with status so shouldFallback can evaluate it
    const msg = err.message || "";
    if (msg.includes("credit balance") || msg.includes("too low")) {
      throw Object.assign(new Error(msg), { status: 400 });
    }
    throw err;
  }
}

async function callGemini(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
): Promise<AsyncGenerator<LLMStreamEvent>> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw Object.assign(new Error("GOOGLE_AI_API_KEY not configured"), { status: 401 });

  const { systemInstruction, contents } = toGeminiMessages(systemPrompt, messages);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction,
        contents,
        tools: toGeminiTools(tools),
        generationConfig: { maxOutputTokens: 16384 },
      }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(new Error(`Gemini ${resp.status}: ${text.slice(0, 300)}`), { status: resp.status });
  }

  return normalizeGemini(resp);
}

async function callOpenAI(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
): Promise<AsyncGenerator<LLMStreamEvent>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("OPENAI_API_KEY not configured"), { status: 401 });

  const openaiMessages = toOpenAIMessages(systemPrompt, messages);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 16384,
      messages: openaiMessages,
      tools: toOpenAITools(tools),
      stream: true,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(new Error(`OpenAI ${resp.status}: ${text.slice(0, 300)}`), { status: resp.status });
  }

  return normalizeOpenAI(resp);
}

// ── Main fallback function ───────────────────────────────────────────

export async function callLLMWithFallback(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  write: SseWriter,
  memberName: string,
  model?: string,
  anthropicApiKey?: string,
): Promise<AsyncGenerator<LLMStreamEvent>> {
  const errors: Array<{ provider: string; error: string }> = [];

  for (const provider of PROVIDERS) {
    // Skip providers in cooldown (unless all others already failed)
    if (isProviderCoolingDown(provider) && errors.length < PROVIDERS.length - 1) {
      console.log(`[llm] ${memberName} | skipping ${provider} (cooldown)`);
      errors.push({ provider, error: "cooldown" });
      continue;
    }

    // Skip if no API key (for Claude, per-user key also counts)
    const keyMap: Record<Provider, string | undefined> = {
      claude: anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GOOGLE_AI_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    };
    if (!keyMap[provider]) {
      errors.push({ provider, error: "no API key" });
      continue;
    }

    try {
      console.log(`[llm] ${memberName} | trying ${provider}...`);

      const callers = { claude: callClaude, gemini: callGemini, openai: callOpenAI };
      const stream = provider === "claude"
        ? await callClaude(systemPrompt, messages, tools, model, anthropicApiKey)
        : await callers[provider](systemPrompt, messages, tools);

      console.log(`[llm] ${memberName} | connected to ${provider}${provider === "claude" && anthropicApiKey ? " (per-user key)" : ""}`);

      // Fallback is silent to the user - just log it server-side

      return stream;
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.error(`[llm] ${memberName} | ${provider} failed: ${errMsg}`);
      errors.push({ provider, error: errMsg });

      if (shouldFallback(err)) {
        providerCooldowns.set(provider, Date.now());
        continue;
      } else {
        // Non-fallback error (400 bad request) — throw immediately
        throw err;
      }
    }
  }

  throw new Error(
    `All LLM providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join("; ")}`,
  );
}

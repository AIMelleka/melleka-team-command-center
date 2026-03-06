/**
 * Zapier MCP client — JSON-RPC 2.0 over Streamable HTTP.
 * Calls the user's Zapier MCP server to list and execute configured actions.
 */

import { getSecret } from "./secrets.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ZapierTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

let reqId = 0;

async function mcpRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const mcpUrl = await getSecret("ZAPIER_MCP_URL");
  if (!mcpUrl) {
    throw new Error(
      "ZAPIER_MCP_URL not configured. Get your MCP URL from mcp.zapier.com and add it to team_secrets or .env."
    );
  }

  const body: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: ++reqId,
    method,
    ...(params ? { params } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const resp = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Zapier MCP HTTP ${resp.status}: ${text.slice(0, 500)}`);
    }

    const data = (await resp.json()) as JsonRpcResponse;
    if (data.error) {
      throw new Error(`Zapier MCP error [${data.error.code}]: ${data.error.message}`);
    }
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

/** List all configured Zapier MCP tools. */
export async function listZapierTools(): Promise<ZapierTool[]> {
  const result = (await mcpRequest("tools/list")) as { tools?: ZapierTool[] };
  return result?.tools ?? [];
}

/** Execute a specific Zapier MCP tool by name. */
export async function callZapierTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return await mcpRequest("tools/call", { name: toolName, arguments: args });
}

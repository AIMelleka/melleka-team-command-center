/**
 * Zapier MCP client — JSON-RPC 2.0 over Streamable HTTP.
 * Calls the user's Zapier MCP server to list and execute configured actions.
 * Uses OAuth 2.0 with automatic token refresh.
 */

import { getSecret } from "./secrets.js";
import { supabase } from "./supabase.js";

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

/** Refresh the Zapier OAuth access token using the refresh token. */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getSecret("ZAPIER_MCP_REFRESH_TOKEN");
  const clientId = await getSecret("ZAPIER_MCP_CLIENT_ID");
  if (!refreshToken || !clientId) return null;

  try {
    const resp = await fetch("https://mcp.zapier.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // Store new access token
    await supabase.from("team_secrets").upsert({
      key: "ZAPIER_MCP_API_KEY",
      value: data.access_token,
      description: "Zapier MCP OAuth access token (Bearer token)",
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    // Store new refresh token if rotated
    if (data.refresh_token) {
      await supabase.from("team_secrets").upsert({
        key: "ZAPIER_MCP_REFRESH_TOKEN",
        value: data.refresh_token,
        description: "Zapier MCP OAuth refresh token for auto-renewal",
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    }

    console.log("[zapier-mcp] Token refreshed successfully");
    return data.access_token;
  } catch (err) {
    console.error("[zapier-mcp] Token refresh failed:", err);
    return null;
  }
}

/** Parse SSE response body to extract JSON-RPC result. */
function parseSSEResponse(text: string): JsonRpcResponse {
  // SSE format: "event: message\ndata: {...}\n\n"
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice(6)) as JsonRpcResponse;
    }
  }
  // Fallback: try parsing entire body as JSON
  return JSON.parse(text) as JsonRpcResponse;
}

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

  const makeRequest = async (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  };

  try {
    let apiKey = await getSecret("ZAPIER_MCP_API_KEY");
    let resp = await makeRequest(apiKey);

    // If unauthorized, try refreshing the token
    if (resp.status === 401 || resp.status === 403) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        apiKey = newToken;
        resp = await makeRequest(apiKey);
      }
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Zapier MCP HTTP ${resp.status}: ${text.slice(0, 500)}`);
    }

    const text = await resp.text();
    const data = parseSSEResponse(text);

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

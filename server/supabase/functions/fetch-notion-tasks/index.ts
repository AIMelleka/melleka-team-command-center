const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotionRequest {
  clientName?: string;
  clientNames?: string[];
  databaseId?: string;
  startDate?: string;
  endDate?: string;
  testConnection?: boolean; // New: just test if DB is accessible
  fetchPending?: boolean; // New: fetch pending/unfinished tasks instead of completed
  discoverClients?: boolean; // New: discover all unique client names in the database
}

// The IN HOUSE TO-DO database ID
const DEFAULT_TASK_DATABASE_ID = "9e7cd72f-e62c-4514-9456-5f51cbcfe981";
// Legacy ID that was previously used in older builds; not accessible in current integration.
const LEGACY_TASK_DATABASE_ID = "bf762858-67b7-49ca-992d-fdfc8c43d7fa";

/**
 * Extract database ID from a Notion URL or return the raw ID if already in UUID format.
 * Supports formats like:
 * - https://www.notion.so/workspace/Database-Name-abc123def456...
 * - https://notion.so/abc123def456...?v=...
 * - abc123def456... (raw ID with or without dashes)
 */
function extractDatabaseId(input: string): string {
  if (!input) return "";
  
  const trimmed = input.trim();
  
  // If it's already a UUID format (with or without dashes), return it
  const uuidPattern = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
  if (uuidPattern.test(trimmed)) {
    // Normalize to dashed format
    const clean = trimmed.replace(/-/g, "");
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  
  // Try to extract from Notion URL
  // Pattern: last 32 hex characters before any query params
  const urlMatch = trimmed.match(/([a-f0-9]{32})(?:\?|$)/i);
  if (urlMatch) {
    const clean = urlMatch[1];
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  
  // Also try pattern with dashes already in URL
  const dashedMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (dashedMatch) {
    return dashedMatch[1];
  }
  
  // Return as-is if we can't parse it
  return trimmed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Google Sheets authentication helper
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  
  const base64url = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const headerB64 = base64url(header);
  const claimsB64 = base64url(claims);
  const signatureInput = `${headerB64}.${claimsB64}`;
  
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  // Notion 429s are often "retry in a few minutes". We should not block the UI that long.
  // Default to a short backoff and then return 429 so the frontend can keep showing cached data.
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    if (res.status !== 429) return res;

    // Rate limited: respect Retry-After when provided; otherwise exponential backoff.
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(5_000, Math.max(500, retryAfterSeconds * 1000))
      : Math.min(5_000, baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250));

    if (attempt === maxRetries) return res;
    await sleep(delayMs);
  }

  // Unreachable, but TS wants a return.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return fetch(url, init);
}

type ParsedTask = {
  title: string;
  status: string;
  client: string;
  assignee: string;
  lastEdited: string;
  isCompleted: boolean;
  isNonEssential: boolean;
  url: string;
};

function extractTaskFields(task: any): ParsedTask {
  const props = task.properties || {};

  // Extract title
  let title = "";
  if (props["Name"]?.title) {
    title = props["Name"].title.map((t: any) => t.plain_text).join("");
  } else if (props["Task name"]?.title) {
    title = props["Task name"].title.map((t: any) => t.plain_text).join("");
  }

  // Extract status
  let status = "";
  if (props["STATUS"]?.status) {
    status = props["STATUS"].status.name || "";
  } else {
    for (const value of Object.values(props)) {
      if ((value as any)?.type === "status" && (value as any)?.status?.name) {
        status = (value as any).status.name;
        break;
      }
    }
  }

  // Extract client(s)
  let client = "";
  const clientsProp = props["CLIENTS"];
  if (clientsProp) {
    const t = clientsProp.type;
    if (t === "rich_text") {
      client = clientsProp.rich_text.map((x: any) => x.plain_text).join("");
    } else if (t === "multi_select") {
      client = clientsProp.multi_select.map((x: any) => x.name).join(", ");
    } else if (t === "select") {
      client = clientsProp.select?.name || "";
    } else if (t === "title") {
      client = clientsProp.title.map((x: any) => x.plain_text).join("");
    }
  }

  // Extract assignee
  let assignee = "";
  if (props["Assign"]?.people) {
    assignee = props["Assign"].people.map((p: any) => p.name || p.id).join(", ");
  } else if (props["Managers"]?.people) {
    assignee = props["Managers"].people.map((p: any) => p.name || p.id).join(", ");
  }

  const lastEdited = task.last_edited_time || "";
  const statusLower = String(status).toLowerCase();

  // COMPLETED statuses from the Notion database schema:
  // - "GOOD TO LAUNCH" (complete group)
  // - "Done" (complete group in Done property)
  // - "Archived" (complete group in Done property)
  const completedStatuses = ["good to launch", "done", "archived", "complete", "completed"];
  const isCompleted = completedStatuses.some((s) => statusLower.includes(s));
  const isNonEssential = statusLower.includes("non-essential") || statusLower.includes("non essential");

  return {
    title,
    status,
    client,
    assignee,
    lastEdited,
    isCompleted,
    isNonEssential,
    url: task.url,
  };
}

function makeClientMatcher(clientName: string) {
  const aliases = generateClientAliases(clientName);
  const clientNameLower = clientName.toLowerCase().trim();
  const strictRules = getClientMatchingRules(clientName);

  // Precompute flexible-mode strict aliases (long/specific)
  const flexibleStrictAliases = aliases.filter((a) => a.length >= 6 || (a.length >= 3 && !isCommonWord(a)));

  return (clientField: string, titleForLog?: string) => {
    const clientLower = (clientField || "").toLowerCase();

    if (!clientLower) return false;

    if (strictRules) {
      const hasExcludedPattern = strictRules.excludePatterns.some((pattern) => clientLower === pattern.toLowerCase());
      if (hasExcludedPattern) {
        // Keep logs minimal; only log exclusions when a title is available.
        if (titleForLog) {
          console.log(`EXCLUDED: Task "${titleForLog}" client "${clientField}" excluded for "${clientName}"`);
        }
        return false;
      }

      // For exactOnly mode, require the CLIENTS field to exactly equal one of the aliases
      if (strictRules.exactOnly) {
        return strictRules.aliases.some((alias) => clientLower === alias.toLowerCase());
      }

      // Otherwise, use word-boundary matching for short aliases and substring for longer ones
      return strictRules.aliases.some((alias) => {
        const aliasLower = alias.toLowerCase();
        if (aliasLower.length <= 4) {
          const regex = new RegExp(`\\b${escapeRegex(aliasLower)}\\b`, "i");
          return regex.test(clientLower);
        }
        return clientLower.includes(aliasLower) || aliasLower.includes(clientLower);
      });
    }

    // FLEXIBLE MODE
    if (clientLower === clientNameLower) return true;

    if (clientLower.includes(clientNameLower) || clientNameLower.includes(clientLower)) {
      const clientWords = clientLower.split(/[\s,]+/).filter(Boolean);
      const searchWords = clientNameLower.split(/\s+/).filter(Boolean);
      const matchedWords = searchWords.filter((sw) => clientWords.some((cw) => cw.includes(sw) || sw.includes(cw)));
      if (matchedWords.length >= Math.min(2, searchWords.length)) return true;
    }

    return flexibleStrictAliases.some((a) => {
      const aLower = a.toLowerCase();
      if (aLower.length <= 4) {
        const regex = new RegExp(`\\b${escapeRegex(aLower)}\\b`, "i");
        return regex.test(clientLower);
      }
      return clientLower.includes(aLower);
    });
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionToken = Deno.env.get("NOTION_API_KEY");
    if (!notionToken) {
      return json(
        {
          error: "NOTION_API_KEY is not configured",
          errorCode: "MISSING_API_KEY",
          help: "Add your Notion integration token as NOTION_API_KEY in your backend secrets.",
        },
        500
      );
    }

    const body: NotionRequest = await req.json();
    const { clientName, clientNames, databaseId, startDate, endDate, testConnection, fetchPending, discoverClients } = body;

    // Extract and normalize the database ID
    const rawDbId = databaseId || DEFAULT_TASK_DATABASE_ID;
    const normalizedDbId = extractDatabaseId(rawDbId);
    const dbId = normalizedDbId === LEGACY_TASK_DATABASE_ID ? DEFAULT_TASK_DATABASE_ID : normalizedDbId;

    console.log(`Database ID input: "${rawDbId}" → normalized: "${normalizedDbId}" → using: "${dbId}"`);

    // Validate DB access up front
    const dbCheck = await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
    });

    if (!dbCheck.ok) {
      const errorBody = await dbCheck.text();
      let parsedError: { code?: string; message?: string } = {};
      try {
        parsedError = JSON.parse(errorBody);
      } catch {
        // Not JSON
      }

      const isNotFound = dbCheck.status === 404 || parsedError.code === "object_not_found";
      const isUnauthorized = dbCheck.status === 401 || dbCheck.status === 403;
      const isRateLimited = dbCheck.status === 429 || parsedError.code === "rate_limited";

      let helpMessage = "";
      if (isNotFound) {
        helpMessage = "The database was not found. This usually means:\n" +
          "1. The Database ID is incorrect, OR\n" +
          "2. The database is not shared with your Notion integration.\n\n" +
          "To fix: Open the database in Notion → Click '...' → 'Add connections' → Select your integration.";
      } else if (isUnauthorized) {
        helpMessage = "The Notion API key is invalid or expired. Please check your NOTION_API_KEY secret.";
      } else if (isRateLimited) {
        helpMessage = "Notion rate limit reached. Please try again in a few minutes.";
      } else {
        helpMessage = `Notion API returned status ${dbCheck.status}. Check your configuration.`;
      }

      return json(
        {
          error: `Notion database is not accessible (${parsedError.code || dbCheck.status})`,
          errorCode: isNotFound ? "DATABASE_NOT_FOUND" : isUnauthorized ? "UNAUTHORIZED" : "API_ERROR",
          databaseId: dbId,
          inputDatabaseId: rawDbId,
          help: helpMessage,
          details: parsedError.message || errorBody,
        },
        isRateLimited ? 429 : isUnauthorized ? 401 : 404
      );
    }

    // Parse database info for diagnostic response
    const dbInfo = await dbCheck.json();
    const dbTitle = dbInfo.title?.map((t: { plain_text: string }) => t.plain_text).join("") || "Untitled";

    // If this is just a connection test, return success now
    if (testConnection) {
      return json({
        success: true,
        databaseId: dbId,
        databaseTitle: dbTitle,
        message: `Successfully connected to "${dbTitle}"`,
      });
    }

    // DISCOVER CLIENTS MODE: Fetch all unique client names from the database
    // AND cross-reference against master Google Sheet for current clients only
    if (discoverClients) {
      console.log(`Discovering all unique clients in database "${dbTitle}"`);
      
      // Step 1: Fetch master client list from Google Sheet
      const MASTER_SHEET_ID = "1t43DRbgSo7pOqKh2DIt7xSsKrN6JgLgLSWAJe92SDQI";
      let masterClientNames: string[] = [];
      
      try {
        const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
        if (serviceAccountJson) {
          const accessToken = await getGoogleAccessToken(serviceAccountJson);
          
          // Fetch the "Looker Directory" sheet which has client names in column A
          const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/A:A?majorDimension=COLUMNS`;
          const sheetRes = await fetch(sheetUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          
          if (sheetRes.ok) {
            const sheetData = await sheetRes.json();
            const columnA = sheetData.values?.[0] || [];
            // Skip header row and filter empty values
            masterClientNames = columnA.slice(1)
              .map((name: string) => String(name).trim())
              .filter((name: string) => name.length > 0);
            console.log(`Loaded ${masterClientNames.length} clients from master sheet`);
          } else {
            console.warn(`Failed to fetch master sheet: ${sheetRes.status}`);
          }
        } else {
          console.warn("GOOGLE_SERVICE_ACCOUNT_JSON not configured, showing all Notion clients");
        }
      } catch (sheetErr) {
        console.error("Error fetching master sheet:", sheetErr);
      }
      
      // Fetch tasks with minimal data to extract unique clients
      const discoveryTasks: any[] = [];
      let discoveryCursor: string | undefined = undefined;
      let discoveryHasMore = true;
      
      // Apply same status exclusions to only count pending tasks
      const statusPropNameForDiscovery = Object.entries((dbInfo as any)?.properties || {}).find(
        ([, prop]: any) => prop?.type === "status"
      )?.[0];
      
      const discoveryFilterClauses: any[] = [];
      if (statusPropNameForDiscovery) {
        const excludeStatuses = [
          "GOOD TO LAUNCH", "Good to launch", "Good to Launch",
          "Done", "Archived", "Complete", "Completed",
          "NON-ESSENTIAL", "NON ESSENTIAL",
        ];
        excludeStatuses.forEach((s) => {
          discoveryFilterClauses.push({
            property: statusPropNameForDiscovery,
            status: { does_not_equal: s },
          });
        });
      }
      
      const discoveryFilter = discoveryFilterClauses.length > 0 
        ? { and: discoveryFilterClauses } 
        : undefined;
      
      while (discoveryHasMore) {
        const queryRes: Response = await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({
            ...(discoveryFilter ? { filter: discoveryFilter } : {}),
            page_size: 100,
            ...(discoveryCursor ? { start_cursor: discoveryCursor } : {}),
          }),
        });
        
        if (!queryRes.ok) {
          const errorTxt = await queryRes.text();
          return json({
            error: `Discovery query failed (status ${queryRes.status})`,
            errorCode: queryRes.status === 429 ? "RATE_LIMITED" : "QUERY_FAILED",
            details: errorTxt,
          }, queryRes.status);
        }
        
        const queryData: any = await queryRes.json();
        discoveryTasks.push(...(queryData.results || []));
        discoveryHasMore = Boolean(queryData.has_more);
        discoveryCursor = queryData.next_cursor || undefined;
        
        // Safety cap
        if (discoveryTasks.length >= 2000) discoveryHasMore = false;
        if (discoveryHasMore) await sleep(350);
      }
      
      // Extract unique client names AND count tasks per client in ONE pass
      const clientTaskCounts: Record<string, number> = {};
      for (const task of discoveryTasks) {
        const parsed = extractTaskFields(task);
        if (parsed.client && !parsed.isNonEssential && !parsed.isCompleted) {
          // Split by comma in case of multi-select
          const clientValues = parsed.client.split(",").map((c: string) => c.trim()).filter(Boolean);
          clientValues.forEach((c: string) => {
            clientTaskCounts[c] = (clientTaskCounts[c] || 0) + 1;
          });
        }
      }
      
      // Step 2: Filter and aggregate against master sheet using fuzzy matching
      const masterClientLower = masterClientNames.map(n => n.toLowerCase());
      const aggregatedCounts: Record<string, { masterName: string; count: number }> = {};
      
      for (const [notionClient, count] of Object.entries(clientTaskCounts)) {
        const notionLower = notionClient.toLowerCase().trim();
        
        // Try to find a matching master client
        let matchedMaster: string | null = null;
        
        for (let i = 0; i < masterClientNames.length; i++) {
          const masterName = masterClientNames[i];
          const masterLower = masterClientLower[i];
          
          // Exact match
          if (notionLower === masterLower) {
            matchedMaster = masterName;
            break;
          }
          
          // Partial match (one contains the other)
          if (notionLower.includes(masterLower) || masterLower.includes(notionLower)) {
            matchedMaster = masterName;
            break;
          }
          
          // Acronym match (e.g., "SDPF" matches "San Diego Parks Foundation")
          const masterAcronym = masterName
            .split(/\s+/)
            .filter(w => w.length > 0 && /[a-zA-Z]/.test(w[0]))
            .map(w => w[0].toUpperCase())
            .join('');
          if (masterAcronym.length >= 2 && notionLower === masterAcronym.toLowerCase()) {
            matchedMaster = masterName;
            break;
          }
          
          // Word overlap match (at least 2 significant words match)
          const masterWords = masterLower.split(/\s+/).filter(w => w.length > 2);
          const notionWords = notionLower.split(/\s+/).filter(w => w.length > 2);
          const matchedWords = masterWords.filter(mw => 
            notionWords.some(nw => mw.includes(nw) || nw.includes(mw))
          );
          if (matchedWords.length >= 2 || (matchedWords.length >= 1 && masterWords.length === 1)) {
            matchedMaster = masterName;
            break;
          }
        }
        
        // Only include if matched to a master client
        if (matchedMaster) {
          const key = matchedMaster.toLowerCase();
          if (!aggregatedCounts[key]) {
            aggregatedCounts[key] = { masterName: matchedMaster, count: 0 };
          }
          aggregatedCounts[key].count += count;
        }
      }
      
      // Convert to sorted array with counts, using master client names
      const clientCounts = Object.values(aggregatedCounts)
        .map(({ masterName, count }) => ({ name: masterName, unfinishedTasks: count }))
        .sort((a, b) => b.unfinishedTasks - a.unfinishedTasks);
      
      const totalUnfinished = clientCounts.reduce((sum, c) => sum + c.unfinishedTasks, 0);
      
      console.log(`Matched ${clientCounts.length} clients from master sheet with ${totalUnfinished} total pending tasks`);
      console.log(`Filtered out ${Object.keys(clientTaskCounts).length - clientCounts.length} non-current clients`);
      
      return json({
        databaseId: dbId,
        databaseTitle: dbTitle,
        clientCounts,
        totalUnfinished,
        masterClientsLoaded: masterClientNames.length,
      });
    }

    const normalizedClientNames = Array.isArray(clientNames)
      ? clientNames.map((c) => String(c).trim()).filter(Boolean)
      : [];

    const isSummaryRequest = !clientName && normalizedClientNames.length > 0;

    // For task fetching, require either a single clientName OR a list of clientNames
    if (!clientName && !isSummaryRequest) {
      return json(
        { error: "clientName or clientNames is required", errorCode: "MISSING_CLIENT_INPUT" },
        400
      );
    }

    console.log(
      isSummaryRequest
        ? `Fetching Notion tasks summary for ${normalizedClientNames.length} clients`
        : `Fetching Notion tasks for client: ${clientName}`
    );
    console.log(`Database: "${dbTitle}" (${dbId})`);
    console.log(`Date range: ${startDate || 'none'} to ${endDate || 'none'}`);

    // Build filter clauses (date range + pending-only optimization)
    const filterClauses: any[] = [];
    if (startDate || endDate) {
      const lastEditedClause: any = {
        timestamp: "last_edited_time",
        last_edited_time: {},
      };

      if (startDate) {
        lastEditedClause.last_edited_time.on_or_after = startDate;
      }

      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        lastEditedClause.last_edited_time.before = endDateObj.toISOString().split("T")[0];
      }

      filterClauses.push(lastEditedClause);
    }

    // If we're fetching pending tasks, exclude completed/non-essential statuses at the API level
    // to reduce payload size and avoid timeouts/rate limits.
    const statusPropName = Object.entries((dbInfo as any)?.properties || {}).find(
      ([, prop]: any) => prop?.type === "status"
    )?.[0];

    if (fetchPending && statusPropName) {
      const excludeExactStatuses = [
        "GOOD TO LAUNCH",
        "Good to launch",
        "Good to Launch",
        "Done",
        "Archived",
        "Complete",
        "Completed",
        "NON-ESSENTIAL",
        "NON ESSENTIAL",
      ];

      excludeExactStatuses.forEach((s) => {
        filterClauses.push({
          property: statusPropName,
          status: { does_not_equal: s },
        });
      });
    }

    const filter =
      filterClauses.length === 0
        ? null
        : filterClauses.length === 1
          ? filterClauses[0]
          : { and: filterClauses };

    console.log("Applying filter:", JSON.stringify(filter ?? {}, null, 2));

    // Paginate to avoid missing results
    const tasks: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const queryResponse: Response = await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
         body: JSON.stringify({
           ...(filter ? { filter } : {}),
          sorts: [
            {
              timestamp: "last_edited_time",
              direction: "descending",
            },
          ],
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      });

      if (!queryResponse.ok) {
        const errorTxt = await queryResponse.text();
        return json(
          {
            error: `Notion query failed (status ${queryResponse.status})`,
            errorCode: queryResponse.status === 429 ? "RATE_LIMITED" : "QUERY_FAILED",
            details: errorTxt,
            databaseId: dbId,
          },
          queryResponse.status
        );
      }

      const data: any = await queryResponse.json();
      tasks.push(...(data.results || []));
      hasMore = Boolean(data.has_more);
      cursor = data.next_cursor || undefined;

      // Safety cap
      if (tasks.length >= 2000) {
        hasMore = false;
      }

      // Gentle pacing to reduce odds of rate limiting during pagination.
      if (hasMore) {
        await sleep(350);
      }
    }

    const parsedTasks: ParsedTask[] = tasks.map(extractTaskFields);

    // SUMMARY MODE: return counts for multiple clients in one request
    if (isSummaryRequest) {
      const matchers = normalizedClientNames.map((name) => ({
        name,
        matches: makeClientMatcher(name),
      }));

      const shouldCountTask = (t: ParsedTask) => {
        if (t.isNonEssential) return false;
        return fetchPending ? !t.isCompleted : t.isCompleted;
      };

      const clientCounts = matchers
        .map(({ name, matches }) => {
          const count = parsedTasks.filter((t) => shouldCountTask(t) && matches(t.client)).length;
          return { name, unfinishedTasks: count };
        })
        .filter((c) => c.unfinishedTasks > 0)
        .sort((a, b) => b.unfinishedTasks - a.unfinishedTasks);

      const totalUnfinished = clientCounts.reduce((sum, c) => sum + c.unfinishedTasks, 0);

      return json({
        databaseId: dbId,
        databaseTitle: dbTitle,
        clientCounts,
        totalUnfinished,
        dateRange: { startDate, endDate },
        fetchPending: !!fetchPending,
      });
    }

    // SINGLE CLIENT MODE (existing behavior)
    const matcher = makeClientMatcher(clientName!);
    const matchingTasks = parsedTasks.map((t) => ({
      ...t,
      clientMatched: matcher(t.client, t.title),
    }));

    // Filter to valid tasks based on fetchPending flag
    const validTasks = matchingTasks.filter((t: any) => {
      if (t.isNonEssential) return false;
      if (!t.clientMatched) return false;
      return fetchPending ? !t.isCompleted : t.isCompleted;
    });

    // Format for AI consumption
    const taskType = fetchPending ? "Pending" : "Completed";
    let formattedContent = `# ${taskType} Tasks for ${clientName}\n`;
    formattedContent += `Date Range: ${startDate || 'All time'} to ${endDate || 'Present'}\n\n`;

    if (validTasks.length > 0) {
      formattedContent += `## ${taskType} Tasks (${validTasks.length})\n\n`;
      validTasks.forEach((task: any) => {
        const cleanTitle = stripUrls(task.title).trim() || "Untitled";
        formattedContent += `- ${cleanTitle}\n`;
        if (task.assignee) formattedContent += `  Assigned to: ${task.assignee}\n`;
        if (task.lastEdited) formattedContent += `  Last edited: ${new Date(task.lastEdited).toLocaleDateString()}\n`;
      });
    }

    if (validTasks.length === 0) {
      formattedContent += `No ${taskType.toLowerCase()} tasks found for client "${clientName}" in the selected date range.\n`;
    }

    console.log(`Found ${validTasks.length} ${taskType.toLowerCase()} tasks for ${clientName}`);

    return json({
      clientName,
      databaseId: dbId,
      databaseTitle: dbTitle,
      totalTasks: validTasks.length,
      activeTasks: fetchPending ? validTasks.length : 0,
      completedTasks: fetchPending ? 0 : validTasks.length,
      formattedContent,
      tasks: validTasks,
      dateRange: { startDate, endDate },
      fetchPending: !!fetchPending,
    });
  } catch (error) {
    console.error("Error in fetch-notion-tasks function:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "INTERNAL_ERROR",
      },
      500
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * STRICT CLIENT ALIAS REGISTRY
 * Defines explicit aliases AND exclusions for clients that have similar names.
 * This prevents confusion between clients like "Global Guard" and "Global Staffing".
 * 
 * IMPORTANT: Aliases here must match the EXACT values used in the Notion CLIENTS field.
 * For example, if a task's CLIENTS field is "GSP", the alias must be "gsp" (case-insensitive).
 * Do NOT add broad terms like "staffing" that could match task titles or unrelated clients.
 */
const CLIENT_ALIAS_REGISTRY: Record<string, { aliases: string[]; excludePatterns: string[]; exactOnly?: boolean }> = {
  // Global Guard Insurance Services - CLIENTS field uses: "Global Guard", "GGIS", "Global Guard Insurance"
  "global guard": {
    aliases: ["ggis", "global guard", "global guard insurance", "global guardins"],
    excludePatterns: ["gsp", "global staffing partners"],
    exactOnly: true,
  },
  "global guard insurance": {
    aliases: ["ggis", "global guard", "global guard insurance", "global guardins"],
    excludePatterns: ["gsp", "global staffing partners"],
    exactOnly: true,
  },
  "ggis": {
    aliases: ["ggis", "global guard", "global guard insurance", "global guardins"],
    excludePatterns: ["gsp", "global staffing partners"],
    exactOnly: true,
  },
  // Global Staffing Partners - CLIENTS field uses: "GSP", "Global Staffing Partners"
  "global staffing": {
    aliases: ["gsp", "global staffing partners"],
    excludePatterns: ["ggis", "global guard", "global guard insurance", "global guardins"],
    exactOnly: true,
  },
  "global staffing partners": {
    aliases: ["gsp", "global staffing partners"],
    excludePatterns: ["ggis", "global guard", "global guard insurance", "global guardins"],
    exactOnly: true,
  },
  "gsp": {
    aliases: ["gsp", "global staffing partners"],
    excludePatterns: ["ggis", "global guard", "global guard insurance", "global guardins"],
    exactOnly: true,
  },
};

/**
 * Get strict matching rules for a client, checking both the input name and generated aliases
 */
function getClientMatchingRules(clientName: string): { aliases: string[]; excludePatterns: string[]; exactOnly?: boolean } | null {
  const lowerName = clientName.toLowerCase().trim();
  
  // Direct match on registry key
  if (CLIENT_ALIAS_REGISTRY[lowerName]) {
    return CLIENT_ALIAS_REGISTRY[lowerName];
  }
  
  // Check if any registry entry's aliases contain this name (exact match on alias only)
  for (const [key, rules] of Object.entries(CLIENT_ALIAS_REGISTRY)) {
    if (rules.aliases.some(a => a === lowerName)) {
      return rules;
    }
  }
  
  return null;
}

/**
 * Generate comprehensive client aliases for fuzzy matching.
 * Handles abbreviations like "San Diego Parks Foundation" → ["sdpf", "sd", "san diego", etc.]
 * 
 * For clients in the STRICT REGISTRY, uses only the defined aliases.
 */
function generateClientAliases(clientName: string): string[] {
  const name = clientName.toLowerCase().trim();
  
  // Check for strict registry match first
  const strictRules = getClientMatchingRules(clientName);
  if (strictRules) {
    console.log(`Using STRICT aliases for "${clientName}": ${strictRules.aliases.join(", ")}`);
    console.log(`Excluding patterns: ${strictRules.excludePatterns.join(", ")}`);
    return strictRules.aliases;
  }
  
  // Fall back to dynamic alias generation for non-registered clients
  const aliases = new Set<string>();
  
  // Full name
  aliases.add(name);
  
  const words = name.split(/\s+/).filter(Boolean);
  
  if (words.length > 1) {
    // First letter acronym: "San Diego Parks Foundation" → "sdpf"
    aliases.add(words.map((w) => w[0]).join(""));
    
    // First two letters acronym
    aliases.add(words.map((w) => w.slice(0, 2)).join(""));
    
    // First word only
    aliases.add(words[0]);
    
    // First two words
    if (words.length >= 2) {
      aliases.add(words.slice(0, 2).join(" "));
      aliases.add(words.slice(0, 2).join(""));
    }
    
    // Each significant word (3+ chars) as standalone - BUT NOT "global" or other ambiguous words
    words.forEach((w) => {
      if (w.length >= 3 && !isAmbiguousWord(w)) {
        aliases.add(w);
      }
    });
    
    // Common abbreviation patterns
    if (words.length >= 2) {
      aliases.add(words[0][0] + words[1][0]);
    }
    if (words.length >= 3) {
      aliases.add(words[0][0] + words[1][0] + words[2][0]);
    }
  }
  
  // Variations without spaces
  aliases.add(name.replace(/\s+/g, "-"));
  aliases.add(name.replace(/\s+/g, "_"));
  aliases.add(name.replace(/\s+/g, ""));
  
  return [...aliases].filter(Boolean);
}

/**
 * Check if a word is too ambiguous for standalone matching
 * These words should only match when combined with other words
 */
function isAmbiguousWord(word: string): boolean {
  const ambiguousWords = new Set([
    "global", "national", "international", "american", "usa",
    "services", "solutions", "partners", "group", "consulting",
    "management", "associates", "industries", "enterprises",
    "the", "and", "for", "inc", "llc", "co", "company"
  ]);
  return ambiguousWords.has(word.toLowerCase());
}

function stripUrls(input: string): string {
  return (input || "")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/www\.[^\s]+/gi, "")
    .replace(/\b[^\s]+\.(com|io|net|org|app|co|ly)\b/gi, "")
    .replace(/\s{2,}/g, " ");
}

/**
 * Check if a word is too common to use for fuzzy matching
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    "the", "and", "for", "inc", "llc", "co", "company", "group", "services",
    "global", "usa", "america", "american", "national", "international",
    "solutions", "consulting", "management", "partners", "associates"
  ]);
  return commonWords.has(word.toLowerCase());
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

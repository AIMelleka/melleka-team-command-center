import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getSecret } from "../services/secrets.js";
import { getCompleteStatusSet, getInProgressStatusSet } from "../services/notion-status-groups.js";

const router = Router();

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionHeaders(): Promise<Record<string, string>> {
  const key = await getSecret("NOTION_API_KEY");
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function getDefaultDbId(): Promise<string> {
  return (await getSecret("NOTION_TASK_DATABASE_ID")) || "9e7cd72f-e62c-4514-9456-5f51cbcfe981";
}

// ── Stats cache (in-memory, 5-min TTL, max 20 entries) ────────────────────
interface StatsCacheEntry { tasks: any[]; fetchedAt: number; }
const statsCache = new Map<string, StatsCacheEntry>();
const STATS_TTL_MS = 5 * 60 * 1000;

function pruneStatsCache(): void {
  if (statsCache.size <= 20) return;
  let oldestKey = "";
  let oldestTime = Infinity;
  for (const [k, v] of statsCache) {
    if (v.fetchedAt < oldestTime) { oldestKey = k; oldestTime = v.fetchedAt; }
  }
  if (oldestKey) statsCache.delete(oldestKey);
}

// Status sets are fetched dynamically from Notion — see services/notion-status-groups.ts

/**
 * A "Complete" task only counts for a given date range if its "Completed on"
 * date falls within [dateFrom, dateTo]. If the field is absent we fall back to
 * trusting last_edited_time (the fetch filter already narrowed the window).
 */
function getCompletedDate(task: any): string | undefined {
  return task.properties?.["Completed Date"]?.date?.start
    ?? task.properties?.["Completed on"]?.date?.start;
}

function completedOnInRange(task: any, dateFrom?: string, dateTo?: string): boolean {
  const completedOn = getCompletedDate(task);
  if (!completedOn) return true; // no date set — accept it
  if (dateFrom && completedOn < dateFrom) return false;
  if (dateTo && completedOn > dateTo) return false;
  return true;
}

// ── GET /api/tasks — list tasks from Notion database ──────────────────────
router.get("/", requireAuth, async (_req, res) => {
  try {
    const databaseId = (_req.query.databaseId as string) || await getDefaultDbId();
    const cursor = _req.query.cursor as string | undefined;
    const pageSize = Math.min(Number(_req.query.pageSize) || 100, 100);

    // Build filter from query params
    const statusFilter = _req.query.status as string | undefined;
    const clientFilter = _req.query.client as string | undefined;
    const priorityFilter = _req.query.priority as string | undefined;
    const teammateFilter = _req.query.teammate as string | undefined;
    const searchQuery = _req.query.search as string | undefined;

    const filters: any[] = [];

    if (statusFilter) {
      filters.push({
        property: "STATUS",
        status: { equals: statusFilter },
      });
    }
    if (clientFilter) {
      filters.push({
        property: "CLIENTS",
        rich_text: { contains: clientFilter },
      });
    }
    if (priorityFilter) {
      filters.push({
        property: "Priority",
        select: { equals: priorityFilter },
      });
    }
    if (teammateFilter) {
      filters.push({
        property: "Teammate",
        select: { equals: teammateFilter },
      });
    }
    if (searchQuery) {
      filters.push({
        property: "Task name",
        title: { contains: searchQuery },
      });
    }

    const body: any = {
      page_size: pageSize,
      ...(cursor && { start_cursor: cursor }),
    };

    if (filters.length === 1) {
      body.filter = filters[0];
    } else if (filters.length > 1) {
      body.filter = { and: filters };
    }

    // Sort by last edited time descending by default
    const sortBy = _req.query.sortBy as string || "last_edited_time";
    const sortDir = (_req.query.sortDir as string) || "descending";

    if (sortBy === "last_edited_time") {
      body.sorts = [{ timestamp: "last_edited_time", direction: sortDir }];
    } else if (sortBy === "created_time") {
      body.sorts = [{ timestamp: "created_time", direction: sortDir }];
    } else {
      body.sorts = [{ property: sortBy, direction: sortDir }];
    }

    const resp = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: await notionHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    console.error("[tasks] list error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/database — get database schema ─────────────────────────
router.get("/database", requireAuth, async (_req, res) => {
  try {
    const databaseId = (_req.query.databaseId as string) || await getDefaultDbId();

    const resp = await fetch(`${NOTION_API}/databases/${databaseId}`, {
      headers: await notionHeaders(),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    console.error("[tasks] database error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/stats — paginate ALL tasks for date range + compute stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const databaseId = (req.query.databaseId as string) || await getDefaultDbId();
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const bypass = req.query.refresh === "1";
    const useLastEdited = req.query.lastEdited === "1";

    const cacheKey = `${databaseId}|${dateFrom ?? ""}|${dateTo ?? ""}|${useLastEdited ? "le" : "cd"}`;

    const [COMPLETE_STATUSES, IN_PROGRESS_STATUSES] = await Promise.all([
      getCompleteStatusSet(),
      getInProgressStatusSet(),
    ]);

    if (!bypass) {
      const hit = statsCache.get(cacheKey);
      if (hit && Date.now() - hit.fetchedAt < STATS_TTL_MS) {
        let complete = 0, inProgress = 0;
        for (const t of hit.tasks) {
          const sn: string = t.properties?.["STATUS"]?.status?.name ?? "";
          if (COMPLETE_STATUSES.has(sn) && completedOnInRange(t, dateFrom, dateTo)) complete++;
          else if (IN_PROGRESS_STATUSES.has(sn)) inProgress++;
        }
        const total = hit.tasks.length;
        res.json({
          stats: { total, complete, inProgress, todo: total - complete - inProgress, rate: total > 0 ? Math.round((complete / total) * 100) : 0 },
          tasks: hit.tasks, cached: true, fetchedAt: new Date(hit.fetchedAt).toISOString(),
        });
        return;
      }
    }

    // Always filter by last_edited_time so we don't miss tasks regardless of
    // what the "Completed Date" / "Completed on" property is named in Notion.
    // Client-side useIsTaskDoneInRange does the precise completedOn + status filter.
    const filters: any[] = [];
    if (dateFrom || dateTo) {
      const tsFilter: any = {};
      if (dateFrom) tsFilter.on_or_after = dateFrom;
      if (dateTo) tsFilter.on_or_before = dateTo;
      filters.push({ timestamp: "last_edited_time", last_edited_time: tsFilter });
    }
    const filterBody = filters.length === 0 ? undefined
      : filters.length === 1 ? filters[0]
      : { and: filters };

    const headers = await notionHeaders();

    // Paginate through ALL matching results (up to 10,000 tasks)
    const allTasks: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore && allTasks.length < 10_000) {
      const body: any = { page_size: 100, sorts: [{ timestamp: "last_edited_time", direction: "descending" }] };
      if (cursor) body.start_cursor = cursor;
      if (filterBody) body.filter = filterBody;

      const resp = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
        method: "POST", headers, body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        res.status(resp.status).json({ error: err });
        return;
      }
      const pageData = await resp.json();
      allTasks.push(...(pageData.results ?? []));
      hasMore = pageData.has_more ?? false;
      cursor = pageData.next_cursor ?? undefined;
    }

    statsCache.set(cacheKey, { tasks: allTasks, fetchedAt: Date.now() });
    pruneStatsCache();

    let complete = 0, inProgress = 0;
    for (const t of allTasks) {
      const sn: string = t.properties?.["STATUS"]?.status?.name ?? "";
      if (COMPLETE_STATUSES.has(sn) && completedOnInRange(t, dateFrom, dateTo)) complete++;
      else if (IN_PROGRESS_STATUSES.has(sn)) inProgress++;
    }
    const total = allTasks.length;
    res.json({
      stats: { total, complete, inProgress, todo: total - complete - inProgress, rate: total > 0 ? Math.round((complete / total) * 100) : 0 },
      tasks: allTasks, cached: false, fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[tasks/stats] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id — get single task ──────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const resp = await fetch(`${NOTION_API}/pages/${req.params.id}`, {
      headers: await notionHeaders(),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    console.error("[tasks] get error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id/blocks — get page content blocks ───────────────────
router.get("/:id/blocks", requireAuth, async (req, res) => {
  try {
    const resp = await fetch(
      `${NOTION_API}/blocks/${req.params.id}/children?page_size=100`,
      { headers: await notionHeaders(), signal: AbortSignal.timeout(45_000) }
    );

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    console.error("[tasks] blocks error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks — create a new task ───────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { properties, databaseId } = req.body;
    const dbId = databaseId || await getDefaultDbId();

    const resp = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: await notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.status(201).json(data);
  } catch (err: any) {
    console.error("[tasks] create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/tasks/:id — update task properties ─────────────────────────
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { properties } = req.body;

    const resp = await fetch(`${NOTION_API}/pages/${req.params.id}`, {
      method: "PATCH",
      headers: await notionHeaders(),
      body: JSON.stringify({ properties }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    console.error("[tasks] update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/tasks/:id — archive (trash) a task ────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const resp = await fetch(`${NOTION_API}/pages/${req.params.id}`, {
      method: "PATCH",
      headers: await notionHeaders(),
      body: JSON.stringify({ in_trash: true }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[tasks] delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/blocks — append content blocks to a page ──────────
router.post("/:id/blocks", requireAuth, async (req, res) => {
  try {
    const { children } = req.body;

    const resp = await fetch(
      `${NOTION_API}/blocks/${req.params.id}/children`,
      {
        method: "PATCH",
        headers: await notionHeaders(),
        body: JSON.stringify({ children }),
        signal: AbortSignal.timeout(45_000),
      }
    );

    if (!resp.ok) {
      const err = await resp.json();
      res.status(resp.status).json({ error: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    console.error("[tasks] append blocks error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const DEFAULT_DB_ID = "9e7cd72f-e62c-4514-9456-5f51cbcfe981";

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// ── GET /api/tasks — list tasks from Notion database ──────────────────────
router.get("/", requireAuth, async (_req, res) => {
  try {
    const databaseId = (_req.query.databaseId as string) || DEFAULT_DB_ID;
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
      headers: notionHeaders(),
      body: JSON.stringify(body),
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
    const databaseId = (_req.query.databaseId as string) || DEFAULT_DB_ID;

    const resp = await fetch(`${NOTION_API}/databases/${databaseId}`, {
      headers: notionHeaders(),
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

// ── GET /api/tasks/:id — get single task ──────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const resp = await fetch(`${NOTION_API}/pages/${req.params.id}`, {
      headers: notionHeaders(),
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
      { headers: notionHeaders() }
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
    const dbId = databaseId || DEFAULT_DB_ID;

    const resp = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties,
      }),
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
      headers: notionHeaders(),
      body: JSON.stringify({ properties }),
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
      headers: notionHeaders(),
      body: JSON.stringify({ in_trash: true }),
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
        headers: notionHeaders(),
        body: JSON.stringify({ children }),
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

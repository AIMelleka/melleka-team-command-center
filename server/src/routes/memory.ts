import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import {
  readMemory,
  writeMemory,
  listMemoryEntries,
  getMemoryEntry,
  createMemoryEntry,
  updateMemoryEntry,
  deleteMemoryEntry,
} from "../services/memory.js";

const router = Router();

// Legacy blob endpoints (kept for backwards compatibility)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const content = await readMemory(req.memberName!);
  res.json({ content });
});

router.patch("/", requireAuth, async (req: AuthRequest, res) => {
  const { content } = req.body as { content: string };
  if (typeof content !== "string") {
    res.status(400).json({ error: "content must be a string" });
    return;
  }
  await writeMemory(req.memberName!, content);
  res.json({ ok: true });
});

// Individual memory entry endpoints
router.get("/entries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const entries = await listMemoryEntries(req.memberName!);
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/entries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, content } = req.body as { title: string; content: string };
    if (!title || !content) {
      res.status(400).json({ error: "title and content are required" });
      return;
    }
    const entry = await createMemoryEntry(req.memberName!, title, content);
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/entries/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { title, content } = req.body as { title?: string; content?: string };
    if (!title && !content) {
      res.status(400).json({ error: "title or content required" });
      return;
    }
    const existing = await getMemoryEntry(id);
    if (!existing || existing.member_name !== req.memberName!.toLowerCase()) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const updated = await updateMemoryEntry(id, { title, content });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/entries/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await getMemoryEntry(id);
    if (!existing || existing.member_name !== req.memberName!.toLowerCase()) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await deleteMemoryEntry(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

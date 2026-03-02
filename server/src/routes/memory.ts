import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { readMemory, writeMemory } from "../services/memory.js";

const router = Router();

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

export default router;

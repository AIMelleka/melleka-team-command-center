import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

// Session check — returns the authenticated member name
router.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json({ name: req.memberName });
});

export default router;

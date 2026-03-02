import { Router } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../services/supabase.js";
import { getMemberDir } from "../services/memory.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: "Name and password are required." });
    return;
  }

  if (password !== process.env.TEAM_PASSWORD) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 50) {
    res.status(400).json({ error: "Name must be 2–50 characters." });
    return;
  }

  // Upsert team member in Supabase
  await supabase
    .from("team_members")
    .upsert({ name: cleanName.toLowerCase() }, { onConflict: "name" });

  // Ensure local folder exists (best-effort)
  try {
    await getMemberDir(cleanName);
  } catch { /* no-op */ }

  const token = jwt.sign(
    { name: cleanName },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" }
  );

  res.json({ token, name: cleanName });
});

export default router;

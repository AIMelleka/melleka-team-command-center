import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { deployToVercel } from "../services/deployer.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

const router = Router();

/**
 * POST /api/client-updates/publish
 * Accepts HTML content + client slug, writes to a temp directory,
 * deploys via Vercel, and returns the branded melleka.app URL.
 */
router.post("/publish", requireAuth, async (req: AuthRequest, res) => {
  const { html, clientSlug } = req.body;

  if (!html || typeof html !== "string") {
    res.status(400).json({ error: "html is required" });
    return;
  }
  if (!clientSlug || typeof clientSlug !== "string") {
    res.status(400).json({ error: "clientSlug is required" });
    return;
  }

  const slug = clientSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const projectName = `${slug}-update`;
  const tmpDir = path.join(os.tmpdir(), req.memberName || "unknown", `update-${slug}`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, "index.html"), html, "utf-8");

    const result = await deployToVercel(tmpDir, projectName, os.tmpdir());

    // Clean up temp files (fire-and-forget)
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    res.json({
      url: `https://${result.brandedUrl}`,
      vercelUrl: result.vercelUrl,
      domainOk: result.domainOk,
    });
  } catch (err: any) {
    console.error("[client-updates] Deploy failed:", err?.message || err);
    res.status(500).json({ error: err?.message || "Deployment failed" });
  }
});

export default router;

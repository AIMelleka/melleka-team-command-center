import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { supabase } from "../services/supabase.js";
import fs from "fs/promises";
import { randomUUID } from "crypto";

const router = Router();

const BUCKET = "team-uploads";

// POST /api/uploads/bulk — bulk upload files to Supabase storage
router.post("/bulk", requireAuth, upload.array("files"), async (req: AuthRequest, res) => {
  const memberName = req.memberName!;
  const files = (req.files as Express.Multer.File[]) ?? [];

  if (files.length === 0) {
    res.status(400).json({ error: "No files provided" });
    return;
  }

  const clientName = (req.body.client_name as string) || null;
  const conversationId = (req.body.conversation_id as string) || null;
  const batchId = randomUUID();
  let tags: string[] = [];
  try { tags = req.body.tags ? JSON.parse(req.body.tags) : []; } catch { /* ignore */ }

  const results: Array<{ id: string; original_name: string; public_url: string; error?: string }> = [];
  const slug = memberName.toLowerCase().replace(/\s+/g, "-");

  // Process in batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (file) => {
        const fileBuffer = await fs.readFile(file.path);
        const ext = file.originalname.split(".").pop() || "bin";
        const storagePath = `${slug}/${batchId}/${randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: true,
            cacheControl: "31536000",
          });

        // Clean up temp file
        await fs.unlink(file.path).catch(() => {});

        if (uploadErr) throw new Error(uploadErr.message);

        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        const { data: row, error: dbErr } = await supabase
          .from("team_uploads")
          .insert({
            member_name: memberName.toLowerCase(),
            client_name: clientName,
            batch_id: batchId,
            conversation_id: conversationId,
            original_name: file.originalname,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            mime_type: file.mimetype,
            file_size: file.size,
            tags,
          })
          .select("id, original_name, public_url")
          .single();

        if (dbErr) throw new Error(dbErr.message);
        return row!;
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value as any);
      } else {
        results.push({ id: "", original_name: "unknown", public_url: "", error: result.reason.message });
      }
    }
  }

  res.json({
    batch_id: batchId,
    total: files.length,
    successful: results.filter((r) => !r.error).length,
    uploads: results,
  });
});

// POST /api/uploads/proposal-logo — upload a logo for a proposal
router.post("/proposal-logo", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  const file = req.file;
  const proposalId = req.body.proposal_id as string;

  if (!file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  if (!proposalId) {
    res.status(400).json({ error: "proposal_id is required" });
    return;
  }

  try {
    const fileBuffer = await fs.readFile(file.path);
    const ext = file.originalname.split(".").pop() || "png";
    const storagePath = `${proposalId}/logo-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("proposal-assets")
      .upload(storagePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: true,
        cacheControl: "3600",
      });

    await fs.unlink(file.path).catch(() => {});

    if (uploadErr) {
      res.status(500).json({ error: uploadErr.message });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("proposal-assets")
      .getPublicUrl(storagePath);

    const newLogoUrl = urlData.publicUrl;

    // Update proposal content with new logo
    const { data: proposal } = await supabase
      .from("proposals")
      .select("content")
      .eq("id", proposalId)
      .single();

    if (proposal) {
      const content = (proposal.content as Record<string, any>) || {};
      const updatedContent = {
        ...content,
        hero: { ...(content.hero || {}), clientLogo: newLogoUrl },
        brandStyles: { ...(content.brandStyles || {}), logo: newLogoUrl },
      };
      await supabase
        .from("proposals")
        .update({ content: updatedContent as any })
        .eq("id", proposalId);
    }

    res.json({ url: newLogoUrl });
  } catch (err: any) {
    console.error("Proposal logo upload error:", err);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// POST /api/uploads/portfolio — upload files to proposal-assets/portfolio
router.post("/portfolio", requireAuth, upload.array("files"), async (req: AuthRequest, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];

  if (files.length === 0) {
    res.status(400).json({ error: "No files provided" });
    return;
  }

  const results: Array<{ name: string; url: string; type: string; error?: string }> = [];

  for (const file of files) {
    try {
      const fileBuffer = await fs.readFile(file.path);
      const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
      const fileName = `${Date.now()}-${cleanName}`;

      const { error: uploadErr } = await supabase.storage
        .from("proposal-assets")
        .upload(`portfolio/${fileName}`, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
          cacheControl: "3600",
        });

      await fs.unlink(file.path).catch(() => {});

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: urlData } = supabase.storage
        .from("proposal-assets")
        .getPublicUrl(`portfolio/${fileName}`);

      results.push({
        name: fileName,
        url: urlData.publicUrl,
        type: file.mimetype.startsWith("video/") ? "video" : "image",
      });
    } catch (err: any) {
      await fs.unlink(file.path).catch(() => {});
      results.push({ name: file.originalname, url: "", type: "image", error: err.message });
    }
  }

  res.json({
    total: files.length,
    successful: results.filter((r) => !r.error).length,
    uploads: results,
  });
});

// DELETE /api/uploads/portfolio/:name — delete a portfolio file
router.delete("/portfolio/:name", requireAuth, async (_req: AuthRequest, res) => {
  const name = _req.params.name;

  const { error } = await supabase.storage
    .from("proposal-assets")
    .remove([`portfolio/${name}`]);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// GET /api/uploads/portfolio — list portfolio files (authenticated, full details)
router.get("/portfolio", requireAuth, async (_req: AuthRequest, res) => {
  const { data, error } = await supabase.storage
    .from("proposal-assets")
    .list("portfolio", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const items = (data || [])
    .filter((file) => file.name !== ".emptyFolderPlaceholder")
    .map((file) => ({
      name: file.name,
      url: supabase.storage.from("proposal-assets").getPublicUrl(`portfolio/${file.name}`).data.publicUrl,
      type: file.metadata?.mimetype?.startsWith("video/") ? "video" : "image",
      created_at: file.created_at || "",
    }));

  res.json(items);
});

// GET /api/uploads/portfolio-images — public endpoint returning image URLs for proposal carousel
router.get("/portfolio-images", async (_req, res) => {
  try {
    const { data, error } = await supabase.storage
      .from("proposal-assets")
      .list("portfolio", { limit: 50, sortBy: { column: "created_at", order: "desc" } });

    if (error) {
      res.status(500).json([]);
      return;
    }

    const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif)$/i;
    const urls = (data || [])
      .filter((file) => file.name !== ".emptyFolderPlaceholder" && IMAGE_EXTENSIONS.test(file.name))
      .map((file) => supabase.storage.from("proposal-assets").getPublicUrl(`portfolio/${file.name}`).data.publicUrl);

    res.json(urls);
  } catch {
    res.json([]);
  }
});

// GET /api/uploads — list uploads with filters
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  let query = supabase
    .from("team_uploads")
    .select("id, member_name, client_name, batch_id, original_name, public_url, mime_type, file_size, description, tags, created_at")
    .order("created_at", { ascending: false })
    .limit(Number(req.query.limit) || 50);

  if (req.query.client) query = query.ilike("client_name", `%${req.query.client}%`);
  if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id as string);
  if (req.query.member) query = query.eq("member_name", req.query.member as string);
  if (req.query.mime_type) query = query.ilike("mime_type", `${req.query.mime_type}%`);
  if (req.query.conversation_id) query = query.eq("conversation_id", req.query.conversation_id as string);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data ?? []);
});

// DELETE /api/uploads/:id — remove from storage + DB
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { data: upload } = await supabase
    .from("team_uploads")
    .select("storage_path")
    .eq("id", req.params.id)
    .single();

  if (!upload) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }

  await supabase.storage.from(BUCKET).remove([upload.storage_path]);
  await supabase.from("team_uploads").delete().eq("id", req.params.id);

  res.json({ ok: true });
});

export default router;

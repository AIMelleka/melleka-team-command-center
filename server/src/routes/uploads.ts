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

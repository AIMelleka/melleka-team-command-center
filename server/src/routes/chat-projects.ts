import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { supabase } from "../services/supabase.js";
import { scrapeUrl } from "../services/scraper.js";
import { randomUUID } from "crypto";
import fs from "fs/promises";

const router = Router();

// List projects for the logged-in member
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data: projects } = await supabase
    .from("chat_projects")
    .select("id, name, description, icon, created_at, updated_at")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("updated_at", { ascending: false });

  // Get resource counts per project
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: counts } = projectIds.length > 0
    ? await supabase
        .from("chat_project_resources")
        .select("project_id")
        .in("project_id", projectIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.project_id] = (countMap[row.project_id] || 0) + 1;
  }

  const result = (projects ?? []).map((p) => ({
    ...p,
    resource_count: countMap[p.id] || 0,
  }));

  res.json(result);
});

// Create a project
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required." });
    return;
  }

  const { data, error } = await supabase
    .from("chat_projects")
    .insert({
      member_name: req.memberName!.toLowerCase(),
      name: name.trim(),
      description: description?.trim() || "",
    })
    .select("id, name, description, icon, created_at, updated_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json({ ...data, resource_count: 0 });
});

// Get a single project with its resources
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { data: project } = await supabase
    .from("chat_projects")
    .select("id, name, description, icon, created_at, updated_at")
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase())
    .single();

  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const { data: resources } = await supabase
    .from("chat_project_resources")
    .select("id, type, name, url, mime_type, file_size, metadata, created_at")
    .eq("project_id", req.params.id)
    .order("created_at", { ascending: true });

  res.json({ ...project, resources: resources ?? [] });
});

// Update a project
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof name === "string") updates.name = name.trim();
  if (typeof description === "string") updates.description = description.trim();

  const { error } = await supabase
    .from("chat_projects")
    .update(updates)
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

// Delete a project (resources cascade-deleted via FK)
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { data: project } = await supabase
    .from("chat_projects")
    .select("member_name")
    .eq("id", req.params.id)
    .single();

  if (!project || project.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  await supabase.from("chat_projects").delete().eq("id", req.params.id);
  res.json({ ok: true });
});

// Add a resource to a project
router.post("/:id/resources", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  const projectId = req.params.id;

  // Verify project ownership
  const { data: project } = await supabase
    .from("chat_projects")
    .select("member_name")
    .eq("id", projectId)
    .single();

  if (!project || project.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const { type, name, url } = req.body;
  const file = req.file;

  if (type === "link") {
    if (!url) {
      res.status(400).json({ error: "URL is required for link resources." });
      return;
    }

    // Insert resource first, then scrape in background
    const { data: resource, error } = await supabase
      .from("chat_project_resources")
      .insert({
        project_id: projectId,
        type: "link",
        name: name?.trim() || url,
        url,
      })
      .select("id, type, name, url, mime_type, file_size, metadata, created_at")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Scrape in background (don't block the response)
    scrapeUrl(url)
      .then(async ({ title, content }) => {
        await supabase
          .from("chat_project_resources")
          .update({
            content,
            name: name?.trim() || title,
            metadata: { scraped_at: new Date().toISOString(), title },
          })
          .eq("id", resource!.id);
        console.log(`[chat-projects] Scraped link: ${url} (${content.length} chars)`);
      })
      .catch((err) => {
        console.error(`[chat-projects] Scrape failed for ${url}:`, err.message);
        supabase
          .from("chat_project_resources")
          .update({ metadata: { scrape_error: err.message, scraped_at: new Date().toISOString() } })
          .eq("id", resource!.id)
          .then(() => {});
      });

    // Update project timestamp
    await supabase
      .from("chat_projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", projectId);

    res.status(201).json(resource);
    return;
  }

  // File/image/doc upload
  if (!file) {
    res.status(400).json({ error: "File is required." });
    return;
  }

  const buffer = await fs.readFile(file.path);
  const ext = file.originalname.split(".").pop() || "bin";
  const slug = req.memberName!.toLowerCase().replace(/\s+/g, "-");
  const storagePath = `${slug}/projects/${projectId}/${randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("team-uploads")
    .upload(storagePath, buffer, {
      contentType: file.mimetype,
      upsert: true,
      cacheControl: "31536000",
    });

  await fs.unlink(file.path).catch(() => {});

  if (uploadErr) {
    res.status(500).json({ error: `Upload failed: ${uploadErr.message}` });
    return;
  }

  // Determine resource type
  const isImage = file.mimetype.startsWith("image/");
  const resourceType = type || (isImage ? "image" : "file");

  // For text-based files, extract content
  let textContent: string | null = null;
  if (!isImage && file.mimetype.startsWith("text/")) {
    textContent = buffer.toString("utf-8").slice(0, 50_000);
  }

  const { data: resource, error: insertErr } = await supabase
    .from("chat_project_resources")
    .insert({
      project_id: projectId,
      type: resourceType,
      name: name?.trim() || file.originalname,
      storage_path: storagePath,
      mime_type: file.mimetype,
      file_size: file.size,
      content: textContent,
    })
    .select("id, type, name, url, mime_type, file_size, metadata, created_at")
    .single();

  if (insertErr) {
    res.status(500).json({ error: insertErr.message });
    return;
  }

  // Update project timestamp
  await supabase
    .from("chat_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  res.status(201).json(resource);
});

// Delete a resource from a project
router.delete("/:id/resources/:rid", requireAuth, async (req: AuthRequest, res) => {
  // Verify project ownership
  const { data: project } = await supabase
    .from("chat_projects")
    .select("member_name")
    .eq("id", req.params.id)
    .single();

  if (!project || project.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  // Get resource to clean up storage
  const { data: resource } = await supabase
    .from("chat_project_resources")
    .select("storage_path")
    .eq("id", req.params.rid)
    .eq("project_id", req.params.id)
    .single();

  if (resource?.storage_path) {
    await supabase.storage.from("team-uploads").remove([resource.storage_path]);
  }

  await supabase.from("chat_project_resources").delete().eq("id", req.params.rid);

  // Update project timestamp
  await supabase
    .from("chat_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", req.params.id);

  res.json({ ok: true });
});

// Re-scrape a link resource
router.post("/:id/resources/:rid/rescrape", requireAuth, async (req: AuthRequest, res) => {
  const { data: resource } = await supabase
    .from("chat_project_resources")
    .select("id, url, type")
    .eq("id", req.params.rid)
    .eq("project_id", req.params.id)
    .single();

  if (!resource || resource.type !== "link" || !resource.url) {
    res.status(400).json({ error: "Resource is not a scrapeable link." });
    return;
  }

  try {
    const { title, content } = await scrapeUrl(resource.url);
    await supabase
      .from("chat_project_resources")
      .update({
        content,
        metadata: { scraped_at: new Date().toISOString(), title },
      })
      .eq("id", resource.id);

    res.json({ ok: true, chars: content.length });
  } catch (err: any) {
    res.status(500).json({ error: `Scrape failed: ${err.message}` });
  }
});

export default router;

import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { deployToVercel, addCustomDomain } from "../services/deployer.js";
import { upload } from "../middleware/upload.js";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const router = Router();

// ── List all website projects for the member ──
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("website_projects")
    .select("id, name, slug, description, status, branded_url, custom_domain, thumbnail_url, last_deployed_at, created_at, updated_at")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("updated_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── Get a single project with all its pages ──
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { data: project, error } = await supabase
    .from("website_projects")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.member_name !== req.memberName!.toLowerCase()) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const { data: pages } = await supabase
    .from("website_pages")
    .select("*")
    .eq("project_id", req.params.id)
    .order("sort_order", { ascending: true });

  res.json({ ...project, pages: pages ?? [] });
});

// ── Create a new project ──
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { name, slug, description, template_id, settings } = req.body;
  if (!name || !slug) { res.status(400).json({ error: "name and slug are required" }); return; }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("website_projects")
    .insert({
      member_name: req.memberName!.toLowerCase(),
      name,
      slug: cleanSlug,
      description: description || null,
      template_id: template_id || null,
      settings: settings || {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { res.status(409).json({ error: "A project with this slug already exists" }); return; }
    res.status(500).json({ error: error.message }); return;
  }

  // Auto-create a default index.html page
  await supabase.from("website_pages").insert({
    project_id: data.id,
    filename: "index.html",
    title: "Home",
    html_content: "",
    is_homepage: true,
    sort_order: 0,
  });

  res.status(201).json(data);
});

// ── Update project metadata ──
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { name, description, seo_defaults, settings, custom_domain, status } = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (seo_defaults !== undefined) updates.seo_defaults = seo_defaults;
  if (settings !== undefined) updates.settings = settings;
  if (custom_domain !== undefined) updates.custom_domain = custom_domain;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase
    .from("website_projects")
    .update(updates)
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase())
    .select()
    .single();

  if (error || !data) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(data);
});

// ── Archive (soft delete) a project ──
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { error } = await supabase
    .from("website_projects")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase());

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── Add a page to a project ──
router.post("/:id/pages", requireAuth, async (req: AuthRequest, res) => {
  const { filename, title, html_content, is_homepage, sort_order } = req.body;
  if (!filename) { res.status(400).json({ error: "filename is required" }); return; }

  // Verify project ownership
  const { data: project } = await supabase
    .from("website_projects")
    .select("member_name")
    .eq("id", req.params.id)
    .single();
  if (!project || project.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Project not found" }); return;
  }

  const { data, error } = await supabase
    .from("website_pages")
    .insert({
      project_id: req.params.id,
      filename,
      title: title || filename.replace(".html", ""),
      html_content: html_content || "",
      is_homepage: is_homepage || false,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { res.status(409).json({ error: "Page with this filename already exists" }); return; }
    res.status(500).json({ error: error.message }); return;
  }

  // Update project timestamp
  await supabase.from("website_projects").update({ updated_at: new Date().toISOString() }).eq("id", req.params.id);

  res.status(201).json(data);
});

// ── Update a page ──
router.patch("/:id/pages/:pageId", requireAuth, async (req: AuthRequest, res) => {
  const { title, html_content, seo, sort_order } = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (html_content !== undefined) updates.html_content = html_content;
  if (seo !== undefined) updates.seo = seo;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase
    .from("website_pages")
    .update(updates)
    .eq("id", req.params.pageId)
    .eq("project_id", req.params.id)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ error: "Page not found" }); return; }

  // Update project timestamp
  await supabase.from("website_projects").update({ updated_at: new Date().toISOString() }).eq("id", req.params.id);

  res.json(data);
});

// ── Delete a page ──
router.delete("/:id/pages/:pageId", requireAuth, async (req: AuthRequest, res) => {
  const { error } = await supabase
    .from("website_pages")
    .delete()
    .eq("id", req.params.pageId)
    .eq("project_id", req.params.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── Deploy a website project ──
router.post("/:id/deploy", requireAuth, async (req: AuthRequest, res) => {
  const { commit_message } = req.body;

  // Fetch project + pages
  const { data: project } = await supabase
    .from("website_projects")
    .select("*")
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase())
    .single();

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const { data: pages } = await supabase
    .from("website_pages")
    .select("*")
    .eq("project_id", req.params.id)
    .order("sort_order", { ascending: true });

  if (!pages || pages.length === 0) {
    res.status(400).json({ error: "No pages to deploy" }); return;
  }

  try {
    // Write pages to temp directory
    const slug = req.memberName!.toLowerCase().replace(/\s+/g, "-");
    const siteDir = `/tmp/${slug}/website-${project.slug}`;
    await fs.mkdir(siteDir, { recursive: true });

    for (const page of pages) {
      const filePath = path.join(siteDir, page.filename);
      await fs.writeFile(filePath, page.html_content, "utf-8");
    }

    // Deploy to Vercel
    const result = await deployToVercel(siteDir, project.slug, `/tmp/${slug}`);

    // Get next version number
    const { data: lastVersion } = await supabase
      .from("website_versions")
      .select("version_number")
      .eq("project_id", project.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (lastVersion?.version_number ?? 0) + 1;

    // Create version snapshot
    await supabase.from("website_versions").insert({
      project_id: project.id,
      version_number: nextVersion,
      snapshot: { pages: pages.map(p => ({ filename: p.filename, title: p.title, html_content: p.html_content, seo: p.seo })) },
      deploy_url: result.vercelUrl,
      deployed_by: req.memberName!.toLowerCase(),
      commit_message: commit_message || `Version ${nextVersion}`,
    });

    // Update project
    await supabase.from("website_projects").update({
      status: "published",
      branded_url: result.brandedUrl,
      vercel_deployment_url: result.vercelUrl,
      vercel_project_id: project.slug,
      last_deployed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);

    res.json({
      url: `https://${result.brandedUrl}`,
      vercelUrl: result.vercelUrl,
      version: nextVersion,
      domainOk: result.domainOk,
    });
  } catch (err: any) {
    console.error("[websites/deploy] Error:", err);
    res.status(500).json({ error: err.message || "Deploy failed" });
  }
});

// ── Upload an asset ──
router.post("/:id/assets", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  try {
    const fileBuffer = await fs.readFile(req.file.path);
    const ext = path.extname(req.file.originalname) || ".bin";
    const storagePath = `${req.params.id}/${randomUUID()}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("website-assets")
      .upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: true,
        cacheControl: "3600",
      });

    // Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});

    if (uploadErr) { res.status(500).json({ error: uploadErr.message }); return; }

    const { data: urlData } = supabase.storage.from("website-assets").getPublicUrl(storagePath);
    res.json({ url: urlData.publicUrl, path: storagePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// ── List version history ──
router.get("/:id/versions", requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("website_versions")
    .select("id, version_number, deploy_url, deployed_by, commit_message, created_at")
    .eq("project_id", req.params.id)
    .order("version_number", { ascending: false })
    .limit(50);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── Rollback to a specific version ──
router.post("/:id/rollback", requireAuth, async (req: AuthRequest, res) => {
  const { version_id } = req.body;
  if (!version_id) { res.status(400).json({ error: "version_id required" }); return; }

  // Fetch the version snapshot
  const { data: version } = await supabase
    .from("website_versions")
    .select("*")
    .eq("id", version_id)
    .eq("project_id", req.params.id)
    .single();

  if (!version) { res.status(404).json({ error: "Version not found" }); return; }

  const snapshot = version.snapshot as { pages: Array<{ filename: string; title: string; html_content: string; seo: Record<string, unknown> }> };

  // Delete current pages and recreate from snapshot
  await supabase.from("website_pages").delete().eq("project_id", req.params.id);

  for (let i = 0; i < snapshot.pages.length; i++) {
    const page = snapshot.pages[i];
    await supabase.from("website_pages").insert({
      project_id: req.params.id,
      filename: page.filename,
      title: page.title,
      html_content: page.html_content,
      is_homepage: page.filename === "index.html",
      sort_order: i,
      seo: page.seo || {},
    });
  }

  // Update project timestamp
  await supabase.from("website_projects").update({ updated_at: new Date().toISOString() }).eq("id", req.params.id);

  res.json({ ok: true, restored_version: version.version_number });
});

// ── Connect a custom domain ──
router.post("/:id/domain", requireAuth, async (req: AuthRequest, res) => {
  const { domain } = req.body;
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  const { data: project } = await supabase
    .from("website_projects")
    .select("slug, vercel_project_id")
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase())
    .single();

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const projectName = project.vercel_project_id || project.slug;
  const result = await addCustomDomain(projectName, domain);

  if (result.success) {
    await supabase.from("website_projects").update({
      custom_domain: domain,
      updated_at: new Date().toISOString(),
    }).eq("id", req.params.id);
  }

  res.json(result);
});

export default router;

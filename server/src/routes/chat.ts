import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { streamChat } from "../services/claude.js";
import { supabase } from "../services/supabase.js";
import {
  registerJob, pushEvent, completeJob, failJob,
  getJob, getActiveJobs, addListener, isConversationRunning,
} from "../services/activeJobs.js";
import fs from "fs/promises";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

const router = Router();

let activeSseConnections = 0;
export function getActiveSseConnections(): number { return activeSseConnections; }

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

router.post("/", requireAuth, upload.array("files"), async (req: AuthRequest, res) => {
  const memberName = req.memberName!;
  const { message, conversationId, websiteProjectId, commercialProjectId, model } = req.body as {
    message: string;
    conversationId?: string;
    websiteProjectId?: string;
    commercialProjectId?: string;
    model?: string;
  };
  const lowTokenMode = req.body.lowTokenMode === true || req.body.lowTokenMode === "true";

  // mentionedClients may come as JSON string (FormData) or array (JSON body)
  let mentionedClients: string[] | undefined;
  const rawMentions = req.body.mentionedClients;
  if (typeof rawMentions === "string") {
    try { mentionedClients = JSON.parse(rawMentions); } catch { /* ignore */ }
  } else if (Array.isArray(rawMentions)) {
    mentionedClients = rawMentions;
  }
  console.log(`[chat] ${memberName} | mentions raw=${JSON.stringify(rawMentions)} parsed=${JSON.stringify(mentionedClients)}`);

  const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
  const hasText = message?.trim();
  const hasFiles = uploadedFiles.length > 0;

  if (!hasText && !hasFiles) {
    res.status(400).json({ error: "Message or files required." });
    return;
  }

  activeSseConnections++;

  // Set up SSE headers — aggressive anti-buffering for Railway/Cloudflare/nginx
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.flushHeaders();

  // Send keepalive pings every 3s to prevent Railway/proxy timeout
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { /* connection gone */ }
  }, 3000);

  // Track if client disconnected so we still save the response
  let clientDisconnected = false;
  res.on("close", () => { clientDisconnected = true; });

  let convId = conversationId;

  try {
    // Process uploaded files — persist to Supabase storage, smart context for Claude
    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    const fileAnnotations: string[] = [];
    const batchId = uploadedFiles.length > 0 ? randomUUID() : null;
    const BUCKET = "team-uploads";
    const slug = memberName.toLowerCase().replace(/\s+/g, "-");
    let imageCount = 0;

    // We'll persist uploads to Supabase after convId is established (need FK).
    // For now, read image data for inline vision (first 3 images only).
    const pendingUploads: Array<{
      file: Express.Multer.File;
      buffer: Buffer;
      storagePath: string;
      publicUrl?: string;
    }> = [];

    for (const file of uploadedFiles) {
      const buffer = await fs.readFile(file.path);
      const ext = file.originalname.split(".").pop() || "bin";
      const storagePath = `${slug}/${batchId}/${randomUUID()}.${ext}`;

      // Upload to Supabase storage immediately
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.mimetype,
          upsert: true,
          cacheControl: "31536000",
        });

      // Clean up temp file
      await fs.unlink(file.path).catch(() => {});

      if (uploadErr) {
        console.error(`[chat] Upload failed for ${file.originalname}:`, uploadErr.message);
        fileAnnotations.push(`[Upload FAILED: ${file.originalname} — ${uploadErr.message}]`);
        continue;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      pendingUploads.push({ file, buffer, storagePath, publicUrl });

      if (IMAGE_TYPES.has(file.mimetype)) {
        imageCount++;
        // Only send first 3 images as inline base64 for vision analysis
        if (imageBlocks.length < 3) {
          imageBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: buffer.toString("base64"),
            },
          });
        }
        fileAnnotations.push(`[Uploaded image: ${file.originalname} — URL: ${publicUrl}]`);
      } else {
        const sizeKB = (file.size / 1024).toFixed(1);
        fileAnnotations.push(
          `[Uploaded file: ${file.originalname} (${file.mimetype}, ${sizeKB}KB) — URL: ${publicUrl}]`
        );
      }
    }

    // If more than 3 images, tell Claude about the manage_uploads tool
    if (imageCount > 3) {
      fileAnnotations.push(
        `[NOTE: ${imageCount} images uploaded (first 3 shown inline for analysis). Use the manage_uploads tool with batch_id="${batchId}" to view/search all uploads. Use the public URLs above to embed images in any generated content.]`
      );
    } else if (imageCount > 0) {
      fileAnnotations.push(
        `[NOTE: Use the public URLs above to embed these images in any generated content (reports, HTML, etc.).]`
      );
    }

    // Build the message text that gets saved to DB (includes file annotations)
    const savedMessage = [message || "", ...fileAnnotations].filter(Boolean).join("\n");
    const title = (message || uploadedFiles[0]?.originalname || "Attachment").slice(0, 60);

    // Create or load conversation
    if (!convId) {
      const { data } = await supabase
        .from("team_conversations")
        .insert({
          member_name: memberName.toLowerCase(),
          title,
        })
        .select("id")
        .single();
      if (!data?.id) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Database tables not set up yet. Please run supabase-schema.sql in your Supabase dashboard first." })}\n\n`);
        res.end();
        return;
      }
      convId = data.id;
    } else {
      await supabase
        .from("team_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId)
        .eq("member_name", memberName.toLowerCase());
    }

    // Persist upload metadata to team_uploads now that convId is available
    if (pendingUploads.length > 0) {
      const rows = pendingUploads.map((u) => ({
        member_name: memberName.toLowerCase(),
        batch_id: batchId,
        conversation_id: convId,
        original_name: u.file.originalname,
        storage_path: u.storagePath,
        public_url: u.publicUrl!,
        mime_type: u.file.mimetype,
        file_size: u.file.size,
      }));
      const { error: metaErr } = await supabase.from("team_uploads").insert(rows);
      if (metaErr) console.error("[chat] Failed to save upload metadata:", metaErr.message);
      else console.log(`[chat] Persisted ${rows.length} uploads (batch ${batchId}) for ${memberName}`);
    }

    // Save user message first, then load history + fetch @mentions in parallel
    const hasMentions = mentionedClients && mentionedClients.length > 0;

    // 1. Save user message (must complete before history query)
    await supabase.from("team_messages").insert({
      conversation_id: convId,
      role: "user",
      content: savedMessage,
    });

    const [historyResult, mentionResult] = await Promise.all([
      // 2. Load conversation history (most recent 40 messages)
      supabase
        .from("team_messages")
        .select("role, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(40),
      // 3. Pre-fetch @mentioned client data (or skip)
      hasMentions
        ? Promise.all([
            supabase
              .from("managed_clients")
              .select("client_name, domain, ga4_property_id, industry, tier, primary_conversion_goal, tracked_conversion_types, multi_account_enabled, site_audit_url")
              .in("client_name", mentionedClients!),
            supabase
              .from("client_account_mappings")
              .select("client_name, platform, account_id, account_name")
              .in("client_name", mentionedClients!),
          ])
        : Promise.resolve(null),
    ]);

    const history = (historyResult.data ?? []).reverse();

    const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => {
      const ts = new Date(m.created_at).toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "short",
        timeStyle: "short",
      });
      return {
        role: m.role as "user" | "assistant",
        content: `[${ts}] ${m.content}`,
      };
    });

    // Guard: ensure at least one message before calling the API
    if (messages.length === 0) {
      messages.push({ role: "user" as const, content: savedMessage });
    }

    // Inject @mention context if available
    if (mentionResult) {
      const [{ data: mcData }, { data: mappings }] = mentionResult;
      console.log(`[chat] @mention lookup: clients found=${mcData?.length ?? 0}, mappings found=${mappings?.length ?? 0}`);
      if (mcData && mcData.length > 0) {
        const contextLines: string[] = ["[Client Context — auto-resolved from @mentions]"];
        for (const mc of mcData) {
          const accts = (mappings || []).filter(m => m.client_name === mc.client_name);
          const byPlatform: Record<string, string[]> = {};
          for (const a of accts) {
            if (!byPlatform[a.platform]) byPlatform[a.platform] = [];
            byPlatform[a.platform].push(`${a.account_id}${a.account_name ? ` (${a.account_name})` : ""}`);
          }
          const parts = [`@${mc.client_name}: domain=${mc.domain || "N/A"}`];
          if (mc.ga4_property_id) parts.push(`ga4=${mc.ga4_property_id}`);
          if (mc.industry) parts.push(`industry=${mc.industry}`);
          if (mc.tier) parts.push(`tier=${mc.tier}`);
          if (mc.primary_conversion_goal) parts.push(`goal=${mc.primary_conversion_goal}`);
          if ((mc as any).tracked_conversion_types?.length) parts.push(`tracked_conversions=[${(mc as any).tracked_conversion_types.join(", ")}]`);
          if ((mc as any).multi_account_enabled) parts.push(`multi_account=true`);
          if ((mc as any).site_audit_url) parts.push(`site_audit=${(mc as any).site_audit_url}`);
          for (const [platform, ids] of Object.entries(byPlatform)) {
            parts.push(`${platform}_accounts=[${ids.join(", ")}]`);
          }
          contextLines.push(parts.join(", "));
        }
        contextLines.push("");

        // Prepend client context to the last user message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          const prefix = contextLines.join("\n");
          if (typeof lastMsg.content === "string") {
            lastMsg.content = prefix + lastMsg.content;
          }
          console.log(`[chat] Injected @mention context:\n${prefix}`);
        }
      }
    }

    // Inject website builder context if a project is active
    if (websiteProjectId) {
      const { data: wp, error: wpErr } = await supabase
        .from("website_projects")
        .select("id, name, slug, status, branded_url, settings, seo_defaults")
        .eq("id", websiteProjectId)
        .single();

      if (wpErr) {
        console.error(`[chat] Failed to load website project ${websiteProjectId}:`, wpErr.message);
      }

      if (wp) {
        const { data: wpPages, error: pagesErr } = await supabase
          .from("website_pages")
          .select("filename, title, id")
          .eq("project_id", websiteProjectId)
          .order("sort_order", { ascending: true });

        if (pagesErr) console.error(`[chat] Failed to load website pages:`, pagesErr.message);

        const pageList = (wpPages ?? []).map(p => `${p.filename} (${p.title})`).join(", ");
        const prefix = `[Website Builder Context — project: "${wp.name}" (${wp.slug}), project_id: ${wp.id}, status: ${wp.status}${wp.branded_url ? `, live: https://${wp.branded_url}` : ""}, pages: ${pageList || "none yet"}]\n`;

        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          if (typeof lastMsg.content === "string") {
            lastMsg.content = prefix + lastMsg.content;
          }
        }
        console.log(`[chat] Injected website builder context for project ${wp.slug}`);
      } else {
        console.warn(`[chat] Website project ${websiteProjectId} not found, proceeding without context`);
      }
    }

    // Inject commercial maker context if a project is active
    if (commercialProjectId) {
      const { data: cp, error: cpErr } = await supabase
        .from("commercial_projects")
        .select("id, name, status, config, voiceover_url, render_url")
        .eq("id", commercialProjectId)
        .single();

      if (cpErr) {
        console.error(`[chat] Failed to load commercial project ${commercialProjectId}:`, cpErr.message);
      }

      if (cp) {
        const { data: cpScenes } = await supabase
          .from("commercial_scenes")
          .select("id, scene_order, scene_type, duration_frames, props")
          .eq("project_id", commercialProjectId)
          .order("scene_order", { ascending: true });

        const config = cp.config as any;
        const sceneList = (cpScenes ?? []).map((s: any) =>
          `  [${s.scene_order}] ${s.scene_type} (${s.duration_frames}f/${(s.duration_frames/30).toFixed(1)}s) id:${s.id}`
        ).join("\n");

        const prefix = `[Commercial Maker Context — project: "${cp.name}", project_id: ${cp.id}, status: ${cp.status}, theme: primary=${config.theme?.primary} accent=${config.theme?.accent}, voiceover: ${cp.voiceover_url ? "yes" : "no"}, render: ${cp.render_url ? "rendered" : "not rendered"}]\n[Scenes (${cpScenes?.length || 0}):\n${sceneList || "  none yet"}]\n[Scene Type Catalog: hook(brandName,tagline,taglineHighlight), feature_showcase(title,subtitle,screenshot1), mega_prompt(promptText,tasks[]), dual_screenshot(title,screenshot1,screenshot2), badges(title,subtitle,screenshot,badges[]), stats(title,features[],stats[]), cta(brandName,headline,buttonText,url), text_only(headline,subtext)]\n[Duration: 90f=3s, 150f=5s, 180f=6s, 240f=8s. Default 150.]\n`;

        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          if (typeof lastMsg.content === "string") {
            lastMsg.content = prefix + lastMsg.content;
          }
        }
        console.log(`[chat] Injected commercial maker context for project ${cp.name}`);
      }
    }

    // For the current message: if there are images, replace the last user message
    // content with multi-block content (image blocks + text) for Claude vision
    if (imageBlocks.length > 0 && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        const contentBlocks: Anthropic.ContentBlockParam[] = [
          ...imageBlocks,
          { type: "text", text: lastMsg.content as string },
        ];
        lastMsg.content = contentBlocks;
      }
    }

    // Register active job so clients can reconnect
    registerJob(convId!, memberName);

    // Stream response from Claude (events also buffered for reconnect)
    console.log(`[chat] ${memberName} | starting streamChat with ${messages.length} messages`);
    const fullResponse = await streamChat(memberName, messages, res, (event) => {
      pushEvent(convId!, event as any);
    }, convId, lowTokenMode, model);
    console.log(`[chat] ${memberName} | streamChat done, response length=${fullResponse.length}, disconnected=${clientDisconnected}`);

    // Always save assistant response (even if client disconnected mid-stream)
    if (fullResponse.trim()) {
      await supabase.from("team_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: fullResponse,
      });
    }

    completeJob(convId!, fullResponse);

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ type: "done", conversationId: convId })}\n\n`);
    }
  } catch (err) {
    console.error(`Chat error for ${memberName}:`, err);
    if (convId) failJob(convId, String(err));
    // Save partial response so conversation context isn't lost on reload
    if (convId) {
      try {
        await supabase.from("team_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: `[Response interrupted by error: ${String(err)}]\n\nPlease try again — I was working on your request when an error occurred.`,
        });
      } catch { /* best effort */ }
    }
    if (!clientDisconnected) {
      try {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: "An internal error occurred. Please try again." })}\n\n`
        );
      } catch { /* response already gone */ }
    }
  } finally {
    activeSseConnections--;
    clearInterval(keepalive);
    if (!clientDisconnected) res.end();
  }
});

// ── Reconnect endpoints for persistent background chats ──

// Check if a conversation has an active agent job
router.get("/status/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  const job = getJob(req.params.conversationId as string);
  if (!job || job.memberName !== req.memberName!) {
    res.json({ active: false });
    return;
  }
  res.json({
    active: job.status === "running",
    status: job.status,
    startedAt: job.startedAt,
    eventCount: job.events.length,
  });
});

// SSE endpoint: replay buffered events then stream live
router.get("/reconnect/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  const convId = req.params.conversationId as string;
  const job = getJob(convId);

  if (!job || job.memberName !== req.memberName!) {
    res.status(404).json({ error: "No active job for this conversation" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Replay buffered events
  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // If already done, close immediately
  if (job.status !== "running") {
    res.write(`data: ${JSON.stringify({ type: "done", conversationId: convId })}\n\n`);
    res.end();
    return;
  }

  // Subscribe to live events
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { /* gone */ }
  }, 5000);

  const removeListener = addListener(convId, (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      removeListener();
      clearInterval(keepalive);
    }
  });

  res.on("close", () => {
    removeListener();
    clearInterval(keepalive);
  });
});

// List conversation IDs with active agent loops for this member
router.get("/active-jobs", requireAuth, async (req: AuthRequest, res) => {
  const memberName = req.memberName!;
  const active: string[] = [];
  for (const [convId, job] of getActiveJobs()) {
    if (job.memberName === memberName && job.status === "running") {
      active.push(convId);
    }
  }
  res.json({ activeConversationIds: active });
});

export default router;

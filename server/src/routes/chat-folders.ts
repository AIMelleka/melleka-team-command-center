import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// List folders for the logged-in member
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase
    .from("chat_folders")
    .select("id, name, sort_order, is_collapsed, created_at")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("sort_order", { ascending: true });
  res.json(data ?? []);
});

// Create a folder
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required." });
    return;
  }

  // Set sort_order to max + 1
  const { data: existing } = await supabase
    .from("chat_folders")
    .select("sort_order")
    .eq("member_name", req.memberName!.toLowerCase())
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("chat_folders")
    .insert({
      member_name: req.memberName!.toLowerCase(),
      name: name.trim(),
      sort_order: nextOrder,
    })
    .select("id, name, sort_order, is_collapsed, created_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

// Bulk reorder folders — must come before /:id to avoid route conflict
router.patch("/reorder", requireAuth, async (req: AuthRequest, res) => {
  const { folderIds } = req.body as { folderIds: string[] };
  if (!Array.isArray(folderIds)) {
    res.status(400).json({ error: "folderIds array required." });
    return;
  }

  const updates = folderIds.map((id, index) =>
    supabase
      .from("chat_folders")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("member_name", req.memberName!.toLowerCase())
  );
  await Promise.all(updates);
  res.json({ ok: true });
});

// Update a folder (rename, toggle collapsed)
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { name, is_collapsed } = req.body;

  const updates: Record<string, any> = {};
  if (typeof name === "string") updates.name = name.trim();
  if (typeof is_collapsed === "boolean") updates.is_collapsed = is_collapsed;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  const { error } = await supabase
    .from("chat_folders")
    .update(updates)
    .eq("id", req.params.id)
    .eq("member_name", req.memberName!.toLowerCase());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

// Delete a folder (conversations get folder_id = null via ON DELETE SET NULL)
// But we also need to explicitly null them since ON DELETE SET NULL is on the FK
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  // Verify ownership
  const { data: folder } = await supabase
    .from("chat_folders")
    .select("member_name")
    .eq("id", req.params.id)
    .single();

  if (!folder || folder.member_name !== req.memberName!.toLowerCase()) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  await supabase.from("chat_folders").delete().eq("id", req.params.id);
  res.json({ ok: true });
});

export default router;

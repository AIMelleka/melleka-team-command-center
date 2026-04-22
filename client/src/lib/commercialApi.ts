import { supabase } from "@/integrations/supabase/client";
import type {
  CommercialProject,
  CommercialProjectWithScenes,
  CommercialScene,
  CommercialRender,
} from "@/types/commercial";

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || "https://api.teams.melleka.com/api")
  : "/api";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Projects ──

export async function fetchCommercialProjects(): Promise<CommercialProject[]> {
  const res = await fetch(`${API_BASE}/commercials`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load commercial projects");
  return res.json();
}

export async function fetchCommercialProject(id: string): Promise<CommercialProjectWithScenes> {
  const res = await fetch(`${API_BASE}/commercials/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load commercial project");
  return res.json();
}

export async function createCommercialProject(data: {
  name: string;
  config?: Record<string, unknown>;
}): Promise<CommercialProject> {
  const res = await fetch(`${API_BASE}/commercials`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create project");
  }
  return res.json();
}

export async function updateCommercialProject(
  id: string,
  data: Partial<Pick<CommercialProject, "name" | "config" | "status">>
): Promise<CommercialProject> {
  const res = await fetch(`${API_BASE}/commercials/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function deleteCommercialProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/commercials/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete project");
}

// ── Scenes ──

export async function addCommercialScene(
  projectId: string,
  data: { scene_type: string; props: Record<string, unknown>; duration_frames?: number; scene_order?: number }
): Promise<CommercialScene> {
  const res = await fetch(`${API_BASE}/commercials/${projectId}/scenes`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to add scene");
  return res.json();
}

export async function updateCommercialScene(
  projectId: string,
  sceneId: string,
  data: Partial<Pick<CommercialScene, "scene_type" | "props" | "duration_frames" | "fade_in" | "fade_out" | "scene_order">>
): Promise<CommercialScene> {
  const res = await fetch(`${API_BASE}/commercials/${projectId}/scenes/${sceneId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update scene");
  return res.json();
}

export async function deleteCommercialScene(projectId: string, sceneId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/commercials/${projectId}/scenes/${sceneId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete scene");
}

// ── Rendering ──

export async function triggerRender(projectId: string): Promise<CommercialRender> {
  const res = await fetch(`${API_BASE}/commercials/${projectId}/render`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to start render");
  return res.json();
}

export async function fetchRenderStatus(renderId: string): Promise<CommercialRender> {
  const res = await fetch(`${API_BASE}/commercials/renders/${renderId}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to get render status");
  return res.json();
}

// ── Voiceover ──

export async function generateVoiceover(projectId: string): Promise<{ voiceover_url: string }> {
  const res = await fetch(`${API_BASE}/commercials/${projectId}/voiceover`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to generate voiceover");
  return res.json();
}

import { supabase } from "@/integrations/supabase/client";
import type {
  WebsiteProject,
  WebsiteProjectWithPages,
  WebsitePage,
  WebsiteVersion,
  DeployResult,
  AssetUploadResult,
  DomainResult,
} from "@/types/website";

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

async function authHeadersNoContentType(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Projects ──

export async function fetchWebsiteProjects(): Promise<WebsiteProject[]> {
  const res = await fetch(`${API_BASE}/websites`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load website projects");
  return res.json();
}

export async function fetchWebsiteProject(id: string): Promise<WebsiteProjectWithPages> {
  const res = await fetch(`${API_BASE}/websites/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load website project");
  return res.json();
}

export async function createWebsiteProject(data: {
  name: string;
  slug: string;
  description?: string;
  template_id?: string;
  settings?: Record<string, unknown>;
}): Promise<WebsiteProject> {
  const res = await fetch(`${API_BASE}/websites`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create project" }));
    throw new Error(err.error || "Failed to create project");
  }
  return res.json();
}

export async function updateWebsiteProject(
  id: string,
  data: Partial<Pick<WebsiteProject, "name" | "description" | "seo_defaults" | "settings" | "custom_domain" | "status">>
): Promise<WebsiteProject> {
  const res = await fetch(`${API_BASE}/websites/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function archiveWebsiteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/websites/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to archive project");
}

// ── Pages ──

export async function addWebsitePage(
  projectId: string,
  data: { filename: string; title?: string; html_content?: string; sort_order?: number }
): Promise<WebsitePage> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/pages`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to add page" }));
    throw new Error(err.error || "Failed to add page");
  }
  return res.json();
}

export async function updateWebsitePage(
  projectId: string,
  pageId: string,
  data: Partial<Pick<WebsitePage, "title" | "html_content" | "seo" | "sort_order">>
): Promise<WebsitePage> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/pages/${pageId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update page");
  return res.json();
}

export async function deleteWebsitePage(projectId: string, pageId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/pages/${pageId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete page");
}

// ── Deploy ──

export async function deployWebsite(
  projectId: string,
  commitMessage?: string
): Promise<DeployResult> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/deploy`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ commit_message: commitMessage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Deploy failed" }));
    throw new Error(err.error || "Deploy failed");
  }
  return res.json();
}

// ── Assets ──

export async function uploadWebsiteAsset(
  projectId: string,
  file: File
): Promise<AssetUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/websites/${projectId}/assets`, {
    method: "POST",
    headers: await authHeadersNoContentType(),
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload asset");
  return res.json();
}

// ── Versions ──

export async function fetchVersionHistory(projectId: string): Promise<WebsiteVersion[]> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/versions`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load version history");
  return res.json();
}

export async function rollbackVersion(
  projectId: string,
  versionId: string
): Promise<{ ok: boolean; restored_version: number }> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/rollback`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ version_id: versionId }),
  });
  if (!res.ok) throw new Error("Failed to rollback");
  return res.json();
}

// ── Custom Domain ──

export async function connectCustomDomain(
  projectId: string,
  domain: string
): Promise<DomainResult> {
  const res = await fetch(`${API_BASE}/websites/${projectId}/domain`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) throw new Error("Failed to connect domain");
  return res.json();
}

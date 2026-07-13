import { supabase } from "./supabase.js";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_IMAGES = 8;

interface ProjectContext {
  textPrefix: string;
  imageBlocks: Anthropic.ImageBlockParam[];
}

/**
 * Build context from a chat project's resources.
 * Returns text to prepend to the user message and image blocks for Claude vision.
 */
export async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const [{ data: project }, { data: resources }] = await Promise.all([
    supabase
      .from("chat_projects")
      .select("name, description")
      .eq("id", projectId)
      .single(),
    supabase
      .from("chat_project_resources")
      .select("id, type, name, url, content, storage_path, mime_type, metadata")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);

  if (!project) {
    return { textPrefix: "", imageBlocks: [] };
  }

  const lines: string[] = [
    `[Chat Project Context — "${project.name}"]`,
  ];
  if (project.description) {
    lines.push(`Description: ${project.description}`);
  }

  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  let imageCount = 0;

  for (const resource of resources ?? []) {
    switch (resource.type) {
      case "link": {
        lines.push(`\n--- Link: ${resource.name} (${resource.url}) ---`);
        if (resource.content) {
          lines.push(resource.content);
        } else {
          lines.push("[Content not yet scraped]");
        }
        break;
      }
      case "file":
      case "doc": {
        lines.push(`\n--- ${resource.type === "doc" ? "Document" : "File"}: ${resource.name} ---`);
        if (resource.content) {
          lines.push(resource.content);
        }
        break;
      }
      case "image": {
        if (imageCount < MAX_IMAGES && resource.storage_path) {
          try {
            const { data: urlData } = supabase.storage
              .from("team-uploads")
              .getPublicUrl(resource.storage_path);

            if (urlData?.publicUrl) {
              const imgRes = await fetch(urlData.publicUrl);
              if (imgRes.ok) {
                const buffer = Buffer.from(await imgRes.arrayBuffer());
                const mimeType = (resource.mime_type || "image/png") as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp";

                imageBlocks.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: buffer.toString("base64"),
                  },
                });
                imageCount++;
                lines.push(`[Image: ${resource.name} — included for vision analysis]`);
              }
            }
          } catch (err) {
            console.error(`[project-context] Failed to load image ${resource.name}:`, err);
            lines.push(`[Image: ${resource.name} — failed to load]`);
          }
        } else {
          lines.push(`[Image: ${resource.name} — skipped (max ${MAX_IMAGES} images)]`);
        }
        break;
      }
    }
  }

  lines.push(`\n[End of project context]\n`);

  return {
    textPrefix: lines.join("\n"),
    imageBlocks,
  };
}

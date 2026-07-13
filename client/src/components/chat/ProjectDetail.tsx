import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Link2,
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
  Image,
  File,
  Pencil,
  Save,
  X,
} from "lucide-react";
import {
  getChatProject,
  updateChatProject,
  addProjectResource,
  deleteProjectResource,
  rescrapeProjectResource,
  type ChatProjectWithResources,
  type ChatProjectResource,
} from "@/lib/chatApi";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onStartChat: (projectId: string) => void;
}

const typeIcons: Record<string, typeof FileText> = {
  link: Link2,
  file: File,
  image: Image,
  doc: FileText,
};

export function ProjectDetail({ projectId, onBack, onStartChat }: ProjectDetailProps) {
  const [project, setProject] = useState<ChatProjectWithResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [addingResource, setAddingResource] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChatProject(projectId);
      setProject(data);
      setEditName(data.name);
      setEditDesc(data.description);
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load on mount
  useState(() => { loadProject(); });

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateChatProject(projectId, { name: editName.trim(), description: editDesc.trim() });
      setProject((prev) => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev);
      setEditingName(false);
      toast.success("Project updated");
    } catch {
      toast.error("Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    setAddingResource(true);
    try {
      const resource = await addProjectResource(projectId, {
        type: "link",
        name: linkName.trim() || undefined,
        url: linkUrl.trim(),
      });
      setProject((prev) =>
        prev ? { ...prev, resources: [...prev.resources, resource] } : prev
      );
      setLinkUrl("");
      setLinkName("");
      setAddingLink(false);
      toast.success("Link added — scraping in background");
    } catch {
      toast.error("Failed to add link");
    } finally {
      setAddingResource(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddingResource(true);
    try {
      const isImage = file.type.startsWith("image/");
      const resource = await addProjectResource(projectId, {
        type: isImage ? "image" : "file",
        file,
      });
      setProject((prev) =>
        prev ? { ...prev, resources: [...prev.resources, resource] } : prev
      );
      toast.success("File uploaded");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setAddingResource(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteResource = async (rid: string) => {
    setDeletingId(rid);
    try {
      await deleteProjectResource(projectId, rid);
      setProject((prev) =>
        prev ? { ...prev, resources: prev.resources.filter((r) => r.id !== rid) } : prev
      );
      toast.success("Resource removed");
    } catch {
      toast.error("Failed to delete resource");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRescrape = async (rid: string) => {
    setRescrapingId(rid);
    try {
      await rescrapeProjectResource(projectId, rid);
      toast.success("Re-scraped successfully");
    } catch {
      toast.error("Failed to re-scrape");
    } finally {
      setRescrapingId(null);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Project not found</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  const groupedResources: Record<string, ChatProjectResource[]> = {};
  for (const r of project.resources) {
    if (!groupedResources[r.type]) groupedResources[r.type] = [];
    groupedResources[r.type].push(r);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editingName ? (
            <div className="flex-1 space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-muted/30 text-sm h-8"
                autoFocus
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Project description..."
                rows={2}
                className="bg-muted/30 text-sm resize-none"
              />
              <div className="flex gap-1.5 justify-end">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingName(false)}>
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" className="h-7" onClick={handleSaveName} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{project.name}</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingName(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
              )}
            </div>
          )}
        </div>
        <Button size="sm" className="w-full" onClick={() => onStartChat(projectId)}>
          Start Chat in Project
        </Button>
      </div>

      {/* Add resource buttons */}
      <div className="px-4 py-3 border-b border-border">
        {addingLink ? (
          <div className="space-y-2">
            <Input
              placeholder="URL (https://...)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="bg-muted/30 text-sm h-8"
              autoFocus
            />
            <Input
              placeholder="Name (optional)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="bg-muted/30 text-sm h-8"
            />
            <div className="flex gap-1.5 justify-end">
              <Button variant="ghost" size="sm" className="h-7" onClick={() => { setAddingLink(false); setLinkUrl(""); setLinkName(""); }}>
                Cancel
              </Button>
              <Button size="sm" className="h-7" onClick={handleAddLink} disabled={addingResource || !linkUrl.trim()}>
                {addingResource ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Add
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setAddingLink(true)}>
              <Link2 className="h-3 w-3 mr-1.5" /> Add Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={addingResource}
            >
              {addingResource ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Upload className="h-3 w-3 mr-1.5" />}
              Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}
      </div>

      {/* Resources list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3 space-y-4">
          {project.resources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No resources yet</p>
              <p className="text-xs mt-1">Add links, files, or images to build project context</p>
            </div>
          ) : (
            Object.entries(groupedResources).map(([type, resources]) => {
              const Icon = typeIcons[type] || File;
              return (
                <div key={type}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    {type === "link" ? "Links" : type === "file" ? "Files" : type === "image" ? "Images" : "Documents"}
                    <span className="ml-1">({resources.length})</span>
                  </p>
                  <div className="space-y-1">
                    {resources.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{r.name}</p>
                          {r.url && <p className="text-[10px] text-muted-foreground truncate">{r.url}</p>}
                          {r.file_size && <p className="text-[10px] text-muted-foreground">{formatSize(r.file_size)}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {r.type === "link" && (
                            <button
                              onClick={() => handleRescrape(r.id)}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                              title="Re-scrape"
                              disabled={rescrapingId === r.id}
                            >
                              <RefreshCw className={`h-3 w-3 ${rescrapingId === r.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteResource(r.id)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            disabled={deletingId === r.id}
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

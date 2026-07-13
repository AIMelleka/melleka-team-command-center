import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FolderKanban,
  Plus,
  Trash2,
  Loader2,
  MessageSquarePlus,
} from "lucide-react";
import {
  fetchChatProjects,
  createChatProject,
  deleteChatProject,
  type ChatProject,
} from "@/lib/chatApi";
import { ProjectDetail } from "./ProjectDetail";

interface ProjectsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (projectId: string) => void;
}

export function ProjectsPanel({ open, onOpenChange, onStartChat }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchChatProjects();
      setProjects(data);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadProjects();
      setSelectedProjectId(null);
    }
  }, [open, loadProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const project = await createChatProject(newName.trim(), newDesc.trim() || undefined);
      setProjects((prev) => [project, ...prev]);
      setNewName("");
      setNewDesc("");
      setCreating(false);
      toast.success("Project created");
    } catch {
      toast.error("Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteChatProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedProjectId === id) setSelectedProjectId(null);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartChat = (projectId: string) => {
    onStartChat(projectId);
    onOpenChange(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Show project detail if one is selected
  if (selectedProjectId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
          <ProjectDetail
            projectId={selectedProjectId}
            onBack={() => { setSelectedProjectId(null); loadProjects(); }}
            onStartChat={handleStartChat}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Chat Projects
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border">
          {creating ? (
            <div className="space-y-3">
              <Input
                placeholder="Project name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-muted/30"
                autoFocus
              />
              <Textarea
                placeholder="Description (optional)..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="bg-muted/30 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setNewDesc("");
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No projects yet.</p>
                <p className="text-xs mt-1">
                  Create a project to attach persistent knowledge (links, files, docs) that loads into every chat.
                </p>
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className="w-full text-left rounded-lg border border-border bg-card overflow-hidden hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {project.resource_count} {project.resource_count === 1 ? "resource" : "resources"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(project.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartChat(project.id);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                        title="Start chat in project"
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(project.id, e)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        disabled={deletingId === project.id}
                      >
                        {deletingId === project.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

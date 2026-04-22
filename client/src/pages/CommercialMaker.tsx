import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminHeader from "@/components/AdminHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageSquare, Video, ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import CommercialChat from "@/components/commercial-maker/CommercialChat";
import CommercialPreview from "@/components/commercial-maker/CommercialPreview";

import {
  fetchCommercialProjects,
  fetchCommercialProject,
  createCommercialProject,
  deleteCommercialProject,
  triggerRender,
  fetchRenderStatus,
} from "@/lib/commercialApi";
import type { CommercialProject, CommercialProjectWithScenes } from "@/types/commercial";

export default function CommercialMaker() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Project list
  const [projects, setProjects] = useState<CommercialProject[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Active project
  const [project, setProject] = useState<CommercialProjectWithScenes | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");

  // New project dialog
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Render state
  const [renderLoading, setRenderLoading] = useState(false);

  // Load project list
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCommercialProjects();
        setProjects(list);
      } catch {
        // silently fail
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  const loadProject = async (id: string) => {
    setLoading(true);
    try {
      const full = await fetchCommercialProject(id);
      setProject(full);
      setConversationId(full.conversation_id);
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createCommercialProject({ name: newName });
      const full = await fetchCommercialProject(created.id);
      setProject(full);
      setConversationId(full.conversation_id);
      setProjects(prev => [created, ...prev]);
      setShowNewProject(false);
      setNewName("");
      toast.success("Project created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteCommercialProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (project?.id === id) setProject(null);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const refreshProject = useCallback(async () => {
    if (!project) return;
    try {
      const updated = await fetchCommercialProject(project.id);
      setProject(updated);
    } catch { /* silently fail */ }
  }, [project]);

  const handleRender = async () => {
    if (!project) return;
    setRenderLoading(true);
    try {
      const render = await triggerRender(project.id);
      toast.success("Render started!");

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const status = await fetchRenderStatus(render.id);
          if (status.status === "complete") {
            clearInterval(poll);
            setRenderLoading(false);
            await refreshProject();
            toast.success("Render complete! Download your video.");
          } else if (status.status === "failed") {
            clearInterval(poll);
            setRenderLoading(false);
            toast.error(`Render failed: ${status.error}`);
          }
        } catch {
          clearInterval(poll);
          setRenderLoading(false);
        }
      }, 3000);
    } catch (err: any) {
      setRenderLoading(false);
      toast.error(err.message || "Failed to start render");
    }
  };

  // Project list view (when no project is selected)
  if (!project) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AdminHeader />
        <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold">Commercial Maker</h1>
              <p className="text-sm text-muted-foreground">Create professional video commercials with AI</p>
            </div>
            <Button onClick={() => setShowNewProject(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Commercial
            </Button>
          </div>

          {loadingList ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium">No commercials yet</p>
              <p className="text-xs mt-1">Create your first commercial to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                  onClick={() => loadProject(p.id)}
                >
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.status === "complete" ? "Rendered" : p.status === "rendering" ? "Rendering..." : "Draft"}
                      {" \u00B7 "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.render_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(p.render_url!, "_blank");
                        }}
                      >
                        Download
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(p.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New project dialog */}
        <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Commercial</DialogTitle></DialogHeader>
            <Input
              placeholder="My SaaS Product Commercial"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewProject(false)}>Cancel</Button>
              <Button onClick={handleCreateProject} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <div className="h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
        <AdminHeader />

        <div className="flex border-b border-border bg-card">
          <button
            className={`flex-1 py-2 text-sm font-medium text-center ${mobileTab === "chat" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            onClick={() => setMobileTab("chat")}
          >
            <MessageSquare className="h-4 w-4 inline mr-1" /> Chat
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium text-center ${mobileTab === "preview" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            onClick={() => setMobileTab("preview")}
          >
            <Video className="h-4 w-4 inline mr-1" /> Preview
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileTab === "chat" ? (
            <CommercialChat
              commercialProjectId={project.id}
              conversationId={conversationId}
              onConversationCreated={setConversationId}
              onProjectUpdated={refreshProject}
            />
          ) : (
            <CommercialPreview
              scenes={project.scenes}
              config={project.config}
              voiceoverUrl={project.voiceover_url}
              onRender={handleRender}
              renderLoading={renderLoading}
            />
          )}
        </div>

        <div className="border-t border-border bg-card px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate mr-2">{project.name}</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setProject(null)}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Projects
          </Button>
        </div>
      </div>
    );
  }

  // DESKTOP LAYOUT
  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
      <AdminHeader />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setProject(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm">{project.name}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
            {project.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {project.render_url && (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <a href={project.render_url} target="_blank" rel="noopener noreferrer">
                Download MP4
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* LEFT PANE: Chat */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <CommercialChat
              commercialProjectId={project.id}
              conversationId={conversationId}
              onConversationCreated={setConversationId}
              onProjectUpdated={refreshProject}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT PANE: Preview */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <CommercialPreview
              scenes={project.scenes}
              config={project.config}
              voiceoverUrl={project.voiceover_url}
              onRender={handleRender}
              renderLoading={renderLoading}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

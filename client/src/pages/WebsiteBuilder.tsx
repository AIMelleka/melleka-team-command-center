import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { MessageSquare, Code, ArrowLeft, Plus, Loader2, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";

import WebsiteChat from "@/components/website-builder/WebsiteChat";
import WebsitePreview from "@/components/website-builder/WebsitePreview";
import PageTabs from "@/components/website-builder/PageTabs";
import DeployButton from "@/components/website-builder/DeployButton";
import VersionHistory from "@/components/website-builder/VersionHistory";
import TemplateGallery, { type Template } from "@/components/website-builder/TemplateGallery";

import {
  fetchWebsiteProject,
  createWebsiteProject,
  addWebsitePage,
  deleteWebsitePage,
  updateWebsitePage,
} from "@/lib/websiteApi";
import type { WebsiteProjectWithPages, WebsitePage } from "@/types/website";

export default function WebsiteBuilder() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [project, setProject] = useState<WebsiteProjectWithPages | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [activeFilename, setActiveFilename] = useState("index.html");
  const [activeTab, setActiveTab] = useState<"chat" | "code">("chat");
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [conversationId, setConversationId] = useState<string | null>(null);

  // New project dialog
  const [showNewProject, setShowNewProject] = useState(!slug);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // Add page dialog
  const [showAddPage, setShowAddPage] = useState(false);
  const [newPageFilename, setNewPageFilename] = useState("");

  // Template gallery
  const [showTemplates, setShowTemplates] = useState(false);

  // Code editor state
  const [codeValue, setCodeValue] = useState("");
  const [codeDirty, setCodeDirty] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (newName && !slug) {
      setNewSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [newName, slug]);

  // Load existing project
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      try {
        // Look up project by slug via list then get by ID
        const { fetchWebsiteProjects } = await import("@/lib/websiteApi");
        const projects = await fetchWebsiteProjects();
        const match = projects.find(p => p.slug === slug);
        if (match) {
          const full = await fetchWebsiteProject(match.id);
          setProject(full);
          setConversationId(full.conversation_id);
          setShowNewProject(false);
          if (full.pages.length > 0) {
            setActiveFilename(full.pages[0].filename);
          }
        } else {
          toast.error("Project not found");
          navigate("/websites");
        }
      } catch {
        toast.error("Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, navigate]);

  // Update code editor when active page changes
  useEffect(() => {
    if (!project) return;
    const page = project.pages.find(p => p.filename === activeFilename);
    if (page) {
      setCodeValue(page.html_content);
      setCodeDirty(false);
    }
  }, [activeFilename, project]);

  const handleCreateProject = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    try {
      const created = await createWebsiteProject({ name: newName, slug: newSlug });
      const full = await fetchWebsiteProject(created.id);
      setProject(full);
      setShowNewProject(false);
      navigate(`/website-builder/${full.slug}`, { replace: true });
      toast.success("Project created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const refreshProject = useCallback(async () => {
    if (!project) return;
    try {
      const updated = await fetchWebsiteProject(project.id);
      setProject(updated);
    } catch {
      // Silently fail on refresh
    }
  }, [project]);

  const handleAddPage = async () => {
    if (!project || !newPageFilename.trim()) return;
    let filename = newPageFilename.trim();
    if (!filename.endsWith(".html")) filename += ".html";

    try {
      await addWebsitePage(project.id, { filename, title: filename.replace(".html", "") });
      await refreshProject();
      setActiveFilename(filename);
      setShowAddPage(false);
      setNewPageFilename("");
      toast.success(`Page ${filename} added`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add page");
    }
  };

  const handleDeletePage = async (pageId: string, filename: string) => {
    if (!project) return;
    try {
      await deleteWebsitePage(project.id, pageId);
      await refreshProject();
      if (activeFilename === filename) setActiveFilename("index.html");
      toast.success(`Page ${filename} deleted`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete page");
    }
  };

  const handleCodeSave = async () => {
    if (!project || !codeDirty) return;
    const page = project.pages.find(p => p.filename === activeFilename);
    if (!page) return;
    try {
      await updateWebsitePage(project.id, page.id, { html_content: codeValue });
      await refreshProject();
      setCodeDirty(false);
      toast.success("Page saved");
    } catch {
      toast.error("Failed to save page");
    }
  };

  const handleDeployed = (url: string) => {
    refreshProject();
  };

  // Track a pending message to send (from template selection)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleSelectTemplate = (template: Template) => {
    setPendingMessage(template.prompt);
    setShowTemplates(false);
  };

  // Get current page's HTML for preview
  const currentPageHtml = project?.pages.find(p => p.filename === activeFilename)?.html_content || "";

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

  // New project dialog
  if (showNewProject && !project) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold">New Website Project</h2>
              <p className="text-sm text-muted-foreground mt-1">Give your website a name to get started</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  placeholder="Acme Corp Website"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">URL Slug</label>
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="acme-corp"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">.melleka.app</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/websites")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button className="flex-1" onClick={handleCreateProject} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <div className="h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
        <AdminHeader />

        {/* Mobile tab bar */}
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
            <Code className="h-4 w-4 inline mr-1" /> Preview
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileTab === "chat" ? (
            <WebsiteChat
              websiteProjectId={project.id}
              conversationId={conversationId}
              onConversationCreated={setConversationId}
              onPageUpdated={refreshProject}
              pendingMessage={pendingMessage}
              onPendingMessageConsumed={() => setPendingMessage(null)}
            />
          ) : (
            <div className="flex flex-col h-full">
              <WebsitePreview htmlContent={currentPageHtml} />
              <PageTabs
                pages={project.pages}
                activeFilename={activeFilename}
                onSelectPage={setActiveFilename}
                onAddPage={() => setShowAddPage(true)}
                onDeletePage={handleDeletePage}
              />
            </div>
          )}
        </div>

        {/* Deploy bar */}
        <div className="border-t border-border bg-card px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate mr-2">{project.name}</span>
          <DeployButton projectId={project.id} onDeployed={handleDeployed} />
        </div>

        {/* Add page dialog */}
        <Dialog open={showAddPage} onOpenChange={setShowAddPage}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Page</DialogTitle></DialogHeader>
            <Input
              placeholder="about.html"
              value={newPageFilename}
              onChange={(e) => setNewPageFilename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPage()}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddPage(false)}>Cancel</Button>
              <Button onClick={handleAddPage}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // DESKTOP LAYOUT
  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
      <AdminHeader />

      {/* Top bar with project info and deploy */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/websites")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm">{project.name}</span>
          {project.branded_url && (
            <a href={`https://${project.branded_url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              {project.branded_url}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowTemplates(true)} title="Templates">
            <LayoutTemplate className="h-4 w-4" />
          </Button>
          <VersionHistory projectId={project.id} onRollback={refreshProject} />
          <DeployButton projectId={project.id} onDeployed={handleDeployed} />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* LEFT PANE: Chat / Code */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="flex flex-col h-full">
              {/* Tab toggle */}
              <div className="flex border-b border-border bg-card/50">
                <button
                  className={`flex-1 py-1.5 text-xs font-medium text-center flex items-center justify-center gap-1 ${
                    activeTab === "chat" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("chat")}
                >
                  <MessageSquare className="h-3 w-3" /> Chat
                </button>
                <button
                  className={`flex-1 py-1.5 text-xs font-medium text-center flex items-center justify-center gap-1 ${
                    activeTab === "code" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("code")}
                >
                  <Code className="h-3 w-3" /> Code
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === "chat" ? (
                  <WebsiteChat
                    websiteProjectId={project.id}
                    conversationId={conversationId}
                    onConversationCreated={setConversationId}
                    onPageUpdated={refreshProject}
                  />
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                      <span className="text-xs text-muted-foreground">{activeFilename}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        disabled={!codeDirty}
                        onClick={handleCodeSave}
                      >
                        {codeDirty ? "Save" : "Saved"}
                      </Button>
                    </div>
                    <textarea
                      className="flex-1 w-full p-3 bg-background font-mono text-xs resize-none focus:outline-none"
                      value={codeValue}
                      onChange={(e) => {
                        setCodeValue(e.target.value);
                        setCodeDirty(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleCodeSave();
                        }
                      }}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT PANE: Preview */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="flex flex-col h-full">
              <WebsitePreview htmlContent={currentPageHtml} />
              <PageTabs
                pages={project.pages}
                activeFilename={activeFilename}
                onSelectPage={setActiveFilename}
                onAddPage={() => setShowAddPage(true)}
                onDeletePage={handleDeletePage}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Add page dialog */}
      <Dialog open={showAddPage} onOpenChange={setShowAddPage}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Page</DialogTitle></DialogHeader>
          <Input
            placeholder="about.html"
            value={newPageFilename}
            onChange={(e) => setNewPageFilename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddPage()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPage(false)}>Cancel</Button>
            <Button onClick={handleAddPage}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template gallery */}
      <TemplateGallery
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleSelectTemplate}
      />
    </div>
  );
}

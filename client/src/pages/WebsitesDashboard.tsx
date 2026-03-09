import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Globe,
  Plus,
  ExternalLink,
  Pencil,
  Archive,
  Loader2,
  Search,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchWebsiteProjects,
  archiveWebsiteProject,
  deployWebsite,
} from "@/lib/websiteApi";
import type { WebsiteProject } from "@/types/website";

export default function WebsitesDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<WebsiteProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const data = await fetchWebsiteProjects();
      setProjects(data.filter(p => p.status !== "archived"));
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleArchive = async (id: string) => {
    try {
      await archiveWebsiteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success("Project archived");
    } catch {
      toast.error("Failed to archive project");
    }
  };

  const handleDeploy = async (id: string) => {
    setDeployingId(id);
    try {
      const result = await deployWebsite(id);
      toast.success(`Deployed to ${result.url}`);
      loadProjects();
    } catch (err: any) {
      toast.error(err.message || "Deploy failed");
    } finally {
      setDeployingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Websites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build and manage websites with AI
            </p>
          </div>
          <Button onClick={() => navigate("/website-builder")} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Website
          </Button>
        </div>

        {/* Search */}
        {projects.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search websites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Globe className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h2 className="text-lg font-semibold mb-1">No websites yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first website with AI-powered vibe coding
            </p>
            <Button onClick={() => navigate("/website-builder")} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Website
            </Button>
          </div>
        )}

        {/* Project grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors group"
              >
                {/* Preview thumbnail area */}
                <div
                  className="h-40 bg-muted/30 flex items-center justify-center cursor-pointer relative"
                  onClick={() => navigate(`/website-builder/${project.slug}`)}
                >
                  {project.thumbnail_url ? (
                    <img
                      src={project.thumbnail_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Globe className="h-12 w-12 text-muted-foreground/20" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    project.status === "published"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}>
                    {project.status === "published" ? "Live" : "Draft"}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                  {project.branded_url && (
                    <a
                      href={`https://${project.branded_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      {project.branded_url}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated {formatDate(project.updated_at)}
                    {project.last_deployed_at && ` | Deployed ${formatDate(project.last_deployed_at)}`}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1"
                      onClick={() => navigate(`/website-builder/${project.slug}`)}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleDeploy(project.id)}
                      disabled={deployingId === project.id}
                    >
                      {deployingId === project.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Rocket className="h-3 w-3" />
                      )}
                    </Button>
                    {project.branded_url && (
                      <a href={`https://${project.branded_url}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleArchive(project.id)}
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

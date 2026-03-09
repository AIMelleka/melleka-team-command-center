import { useState, useEffect } from "react";
import { History, RotateCcw, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fetchVersionHistory, rollbackVersion } from "@/lib/websiteApi";
import type { WebsiteVersion } from "@/types/website";
import { toast } from "sonner";

interface VersionHistoryProps {
  projectId: string;
  onRollback: () => void;
}

export default function VersionHistory({ projectId, onRollback }: VersionHistoryProps) {
  const [versions, setVersions] = useState<WebsiteVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchVersionHistory(projectId)
      .then(setVersions)
      .catch(() => toast.error("Failed to load versions"))
      .finally(() => setLoading(false));
  }, [projectId, open]);

  const handleRollback = async (versionId: string) => {
    setRollingBack(versionId);
    try {
      await rollbackVersion(projectId, versionId);
      toast.success("Rolled back successfully");
      onRollback();
      setOpen(false);
    } catch {
      toast.error("Rollback failed");
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Version History">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && versions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No versions yet. Deploy your website to create the first version.
            </p>
          )}
          {versions.map((version) => (
            <div
              key={version.id}
              className="p-3 rounded-lg border border-border bg-card/50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">v{version.version_number}</span>
                <span className="text-xs text-muted-foreground">{formatDate(version.created_at)}</span>
              </div>
              {version.commit_message && (
                <p className="text-xs text-muted-foreground">{version.commit_message}</p>
              )}
              <div className="flex items-center gap-2">
                {version.deploy_url && (
                  <a href={version.deploy_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                      <ExternalLink className="h-3 w-3" /> View
                    </Button>
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  disabled={rollingBack === version.id}
                  onClick={() => handleRollback(version.id)}
                >
                  {rollingBack === version.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

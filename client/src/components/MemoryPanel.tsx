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
  Brain,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  fetchMemoryEntries,
  createMemoryEntryApi,
  updateMemoryEntryApi,
  deleteMemoryEntryApi,
  type MemoryEntry,
} from "@/lib/chatApi";

interface MemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemoryPanel({ open, onOpenChange }: MemoryPanelProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMemoryEntries();
      setEntries(data);
    } catch {
      toast.error("Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadEntries();
  }, [open, loadEntries]);

  const handleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setEditingId(null);
  };

  const handleStartEdit = (entry: MemoryEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setExpandedId(entry.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const updated = await updateMemoryEntryApi(editingId, {
        title: editTitle,
        content: editContent,
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === editingId ? updated : e))
      );
      setEditingId(null);
      toast.success("Memory updated");
    } catch {
      toast.error("Failed to update memory");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMemoryEntryApi(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) setEditingId(null);
      toast.success("Memory deleted");
    } catch {
      toast.error("Failed to delete memory");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const entry = await createMemoryEntryApi(newTitle.trim(), newContent.trim());
      setEntries((prev) => [entry, ...prev]);
      setNewTitle("");
      setNewContent("");
      setCreating(false);
      toast.success("Memory created");
    } catch {
      toast.error("Failed to create memory");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Agent Memory
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border">
          {creating ? (
            <div className="space-y-3">
              <Input
                placeholder="Memory title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-muted/30"
                autoFocus
              />
              <Textarea
                placeholder="Memory content..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="bg-muted/30 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
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
              Add Memory
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No memories saved yet.</p>
                <p className="text-xs mt-1">
                  The agent will save memories as you chat, or add one manually
                  above.
                </p>
              </div>
            ) : (
              entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const isEditing = editingId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    {/* Header row */}
                    <button
                      onClick={() => handleExpand(entry.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.title}
                        </p>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {entry.content.split("\n")[0].slice(0, 100)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(entry.updated_at)}
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border">
                        {isEditing ? (
                          <div className="space-y-3 pt-3">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-muted/30 text-sm"
                            />
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={8}
                              className="bg-muted/30 resize-none text-sm font-mono"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Save className="h-4 w-4 mr-1" />
                                )}
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-3">
                            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto">
                              {entry.content}
                            </pre>
                            <div className="flex gap-2 justify-end mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(entry)}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingId === entry.id}
                              >
                                {deletingId === entry.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-1" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Plus, MoreHorizontal, Eye, Trash2, Copy, ExternalLink,
  Presentation, ArrowLeft, Loader2, Files,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nanoid } from "nanoid";

interface Deck {
  id: string;
  client_name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  date_range_start: string;
  date_range_end: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft:     { label: "Draft",     variant: "secondary" },
  published: { label: "Published", variant: "default"   },
  archived:  { label: "Archived",  variant: "outline"   },
};

export default function DecksDashboard() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("decks")
      .select("id, client_name, slug, status, created_at, updated_at, date_range_start, date_range_end")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load decks");
    } else {
      setDecks(data || []);
    }
    setLoading(false);
  };

  const filteredDecks = decks.filter(d =>
    d.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/deck/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Deck link copied to clipboard");
  };

  const handleDelete = async () => {
    if (!deckToDelete) return;
    setDeletingId(deckToDelete.id);
    const { error } = await supabase.from("decks").delete().eq("id", deckToDelete.id);
    if (error) {
      toast.error("Failed to delete deck");
    } else {
      setDecks(prev => prev.filter(d => d.id !== deckToDelete.id));
      toast.success("Deck deleted");
    }
    setDeletingId(null);
    setDeleteDialogOpen(false);
    setDeckToDelete(null);
  };

  const handleDuplicate = async (deck: Deck) => {
    setDuplicatingId(deck.id);
    try {
      // Fetch full deck content (content, screenshots, brand_colors)
      const { data: full, error: fetchErr } = await supabase
        .from("decks")
        .select("content, screenshots, brand_colors")
        .eq("id", deck.id)
        .single();
      if (fetchErr) throw fetchErr;

      const { data: { user } } = await supabase.auth.getUser();
      const uid = nanoid(8);
      const newSlug = `${deck.slug}-copy-${uid}`;

      const { data: inserted, error: insertErr } = await supabase
        .from("decks")
        .insert({
          client_name: `${deck.client_name} (Copy)`,
          slug: newSlug,
          status: "draft",
          date_range_start: deck.date_range_start,
          date_range_end: deck.date_range_end,
          content: full?.content ?? {},
          screenshots: full?.screenshots ?? [],
          brand_colors: full?.brand_colors ?? {},
          created_by: user?.id ?? null,
        })
        .select("id, client_name, slug, status, created_at, updated_at, date_range_start, date_range_end")
        .single();

      if (insertErr) throw insertErr;

      setDecks(prev => [inserted!, ...prev]);
      toast.success(`Duplicated as "${inserted!.client_name}" — draft saved`);
      navigate(`/deck/${inserted!.slug}`);
    } catch (err: any) {
      toast.error("Failed to duplicate deck", { description: err.message });
    } finally {
      setDuplicatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.draft;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Presentation className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Decks</h1>
          </div>
          <Button onClick={() => navigate("/deck-builder")} className="gap-2">
            <Plus className="h-4 w-4" />
            New Deck
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{decks.length}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="text-2xl font-bold text-primary">
              {decks.filter(d => d.status === "published").length}
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {decks.filter(d => d.status === "draft").length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredDecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Presentation className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No decks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try a different search" : "Build your first performance deck"}
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate("/deck-builder")} className="gap-2">
                  <Plus className="h-4 w-4" /> Create Deck
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-border">
                {filteredDecks.map(deck => (
                  <div key={deck.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{deck.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(deck.date_range_start + 'T00:00:00'), "MMM d")} – {format(new Date(deck.date_range_end + 'T00:00:00'), "MMM d, yyyy")}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/deck/${deck.slug}`)}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyLink(deck.slug)}>
                            <Copy className="h-4 w-4 mr-2" /> Copy Client Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`/deck/${deck.slug}`, "_blank")}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(deck)}
                            disabled={duplicatingId === deck.id}
                          >
                            {duplicatingId === deck.id
                              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              : <Files className="h-4 w-4 mr-2" />}
                            Duplicate as Draft
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setDeckToDelete(deck); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(deck.status)}
                      <span className="text-xs text-muted-foreground">
                        Updated {format(new Date(deck.updated_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDecks.map(deck => (
                    <TableRow key={deck.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/deck/${deck.slug}`)}>
                      <TableCell className="font-medium">{deck.client_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(deck.date_range_start + 'T00:00:00'), "MMM d")} – {format(new Date(deck.date_range_end + 'T00:00:00'), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(deck.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(deck.updated_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/deck/${deck.slug}`)}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyLink(deck.slug)}>
                              <Copy className="h-4 w-4 mr-2" /> Copy Client Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/deck/${deck.slug}`, "_blank")}>
                              <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { setDeckToDelete(deck); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deck</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the deck for <strong>{deckToDelete?.client_name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingId}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

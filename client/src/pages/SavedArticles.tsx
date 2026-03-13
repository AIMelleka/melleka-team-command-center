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
  Search, MoreHorizontal, Eye, Trash2, Copy, FileText,
  ArrowLeft, Loader2, Files,
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/dateUtils";

interface SavedArticle {
  id: string;
  title: string;
  slug: string;
  primary_keyword: string | null;
  article_type: string;
  word_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  prompt:           { label: "Prompt",   color: "bg-purple-500/15 text-purple-400" },
  "topic-writer":   { label: "Topic",    color: "bg-blue-500/15 text-blue-400" },
  "domain-analysis":{ label: "Domain",   color: "bg-emerald-500/15 text-emerald-400" },
  editor:           { label: "Editor",   color: "bg-amber-500/15 text-amber-400" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft:     { label: "Draft",     variant: "secondary" },
  published: { label: "Published", variant: "default" },
};

export default function SavedArticles() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<SavedArticle | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("seo_articles" as any)
      .select("id, title, slug, primary_keyword, article_type, word_count, status, created_at, updated_at")
      .order("updated_at", { ascending: false }) as any);
    if (error) {
      toast.error("Failed to load articles");
    } else {
      setArticles((data || []) as SavedArticle[]);
    }
    setLoading(false);
  };

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.primary_keyword || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!articleToDelete) return;
    setDeletingId(articleToDelete.id);
    const { error } = await (supabase.from("seo_articles" as any).delete().eq("id", articleToDelete.id) as any);
    if (error) {
      toast.error("Failed to delete article");
    } else {
      setArticles(prev => prev.filter(a => a.id !== articleToDelete.id));
      toast.success("Article deleted");
    }
    setDeletingId(null);
    setDeleteDialogOpen(false);
    setArticleToDelete(null);
  };

  const handleCopyContent = async (id: string) => {
    try {
      const { data, error } = await (supabase.from("seo_articles" as any).select("content").eq("id", id).single() as any);
      if (error) throw error;
      if (data?.content) {
        navigator.clipboard.writeText(data.content);
        toast.success("Article content copied");
      }
    } catch (err: any) {
      toast.error("Failed to copy content");
    }
  };

  const getTypeBadge = (type: string) => {
    const cfg = typeConfig[type] || typeConfig.prompt;
    return <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.draft;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/seo-writer")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Files className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Saved Articles</h1>
          </div>
          <Button onClick={() => navigate("/seo-writer")} variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            SEO Writer
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{articles.length}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="text-2xl font-bold text-primary">
              {articles.filter(a => a.status === "published").length}
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {articles.filter(a => a.status === "draft").length}
            </p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {searchQuery ? "No articles match your search." : "No saved articles yet. Generate one in the SEO Writer."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Words</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(article => (
                  <TableRow key={article.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium max-w-[250px] truncate">{article.title}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[180px] truncate">
                      {article.primary_keyword || "-"}
                    </TableCell>
                    <TableCell>{getTypeBadge(article.article_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {article.word_count.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(article.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {safeFormatDate(article.updated_at, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCopyContent(article.id)}>
                            <Copy className="h-4 w-4 mr-2" /> Copy Content
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setArticleToDelete(article); setDeleteDialogOpen(true); }}
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
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{articleToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!deletingId} className="bg-destructive text-destructive-foreground">
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { nanoid } from 'nanoid';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Copy, 
  ExternalLink,
  FileText,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Pencil,
  Files,
  Loader2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ProposalCardSkeleton, ProposalRowSkeleton } from "@/components/LoadingSkeletons";
import { ErrorBoundary, InlineErrorFallback } from "@/components/ErrorBoundary";

interface Proposal {
  id: string;
  title: string;
  client_name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  services: string[] | null;
  budget_range: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Draft", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  published: { label: "Published", variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
  archived: { label: "Archived", variant: "outline", icon: <XCircle className="w-3 h-3" /> },
};

const ProposalsDashboard = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, title, client_name, slug, status, created_at, updated_at, services, budget_range")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      toast.error("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals.filter((proposal) => {
    const title = proposal.title || '';
    const clientName = proposal.client_name || '';
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || proposal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/proposal/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Proposal link copied to clipboard");
  };

  const handleDelete = async () => {
    if (!proposalToDelete) return;

    try {
      const { error } = await supabase
        .from("proposals")
        .delete()
        .eq("id", proposalToDelete.id);

      if (error) throw error;

      setProposals((prev) => prev.filter((p) => p.id !== proposalToDelete.id));
      toast.success("Proposal deleted successfully");
    } catch (error) {
      console.error("Error deleting proposal:", error);
      toast.error("Failed to delete proposal");
    } finally {
      setDeleteDialogOpen(false);
      setProposalToDelete(null);
    }
  };

  const handleStatusChange = async (proposalId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: newStatus })
        .eq("id", proposalId);

      if (error) throw error;

      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: newStatus } : p))
      );
      toast.success(`Proposal ${newStatus === "published" ? "published" : "updated"} successfully`);
    } catch (error) {
      console.error("Error updating proposal:", error);
      toast.error("Failed to update proposal status");
    }
  };

  const handleDuplicate = async (proposalId: string) => {
    setDuplicatingId(proposalId);
    try {
      // Fetch the full proposal including content
      const { data: original, error: fetchError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (fetchError) throw fetchError;

      // Create cryptographically secure slug that's impossible to guess
      const newSlug = `p-${nanoid(21)}`;
      const newTitle = original.title.includes('(Copy)') 
        ? original.title 
        : `${original.title} (Copy)`;

      // Insert duplicate
      const { data: duplicate, error: insertError } = await supabase
        .from("proposals")
        .insert({
          title: newTitle,
          client_name: original.client_name,
          project_description: original.project_description,
          budget_range: original.budget_range,
          timeline: original.timeline,
          services: original.services,
          content: original.content,
          slug: newSlug,
          status: 'draft', // New copies start as drafts
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add to local state
      setProposals((prev) => [duplicate as Proposal, ...prev]);
      toast.success("Proposal duplicated! Opening editor...");
      
      // Navigate to edit the new proposal
      navigate(`/proposal-builder?edit=${duplicate.id}`);
    } catch (error) {
      console.error("Error duplicating proposal:", error);
      toast.error("Failed to duplicate proposal");
    } finally {
      setDuplicatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile: Two rows */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <h1 className="text-base sm:text-xl font-bold">Proposals</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button 
                onClick={() => navigate("/proposal-builder")} 
                className="gap-1 sm:gap-2 h-9 sm:h-10 px-3 sm:px-4 text-sm"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Proposal</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 sm:h-11"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-10 sm:h-11">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-card rounded-lg border p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
            <p className="text-xl sm:text-2xl font-bold">{proposals.length}</p>
          </div>
          <div className="bg-card rounded-lg border p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Published</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {proposals.filter((p) => p.status === "published").length}
            </p>
          </div>
          <div className="bg-card rounded-lg border p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Drafts</p>
            <p className="text-xl sm:text-2xl font-bold text-muted-foreground">
              {proposals.filter((p) => p.status === "draft").length}
            </p>
          </div>
        </div>

        {/* Proposals List */}
        <ErrorBoundary fallback={<InlineErrorFallback message="Failed to load proposals" onRetry={fetchProposals} />}>
          <div className="bg-card rounded-lg border overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-4">
              {/* Mobile Loading Skeletons */}
              <div className="md:hidden space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <ProposalCardSkeleton key={i} />
                ))}
              </div>
              {/* Desktop Loading Skeletons */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Title</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Client</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Created</th>
                    <th className="p-4 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <ProposalRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No proposals found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first proposal"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => navigate("/proposal-builder")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Proposal
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border">
                {filteredProposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{proposal.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">{proposal.client_name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/proposal/${proposal.slug}`} className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/proposal-builder?edit=${proposal.id}`} className="flex items-center gap-2">
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(proposal.id)}
                            disabled={duplicatingId === proposal.id}
                          >
                            {duplicatingId === proposal.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Files className="h-4 w-4 mr-2" />
                            )}
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyLink(proposal.slug)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                          {proposal.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(proposal.id, "published")}
                              className="text-primary"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setProposalToDelete(proposal);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {getStatusBadge(proposal.status)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(proposal.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {proposal.title}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {proposal.client_name}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(proposal.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/proposal/${proposal.slug}`} className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                View Proposal
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/proposal-builder?edit=${proposal.id}`} className="flex items-center gap-2">
                                <Pencil className="h-4 w-4" />
                                Edit Proposal
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(proposal.id)}
                              disabled={duplicatingId === proposal.id}
                              className="flex items-center gap-2"
                            >
                              {duplicatingId === proposal.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Files className="h-4 w-4" />
                              )}
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCopyLink(proposal.slug)}
                              className="flex items-center gap-2"
                            >
                              <Copy className="h-4 w-4" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={`/proposal/${proposal.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open in New Tab
                              </a>
                            </DropdownMenuItem>
                            {proposal.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(proposal.id, "published")}
                                className="flex items-center gap-2 text-primary"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Publish
                              </DropdownMenuItem>
                            )}
                            {proposal.status === "published" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(proposal.id, "archived")}
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setProposalToDelete(proposal);
                                setDeleteDialogOpen(true);
                              }}
                              className="flex items-center gap-2 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
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
        </ErrorBoundary>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{proposalToDelete?.title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProposalsDashboard;

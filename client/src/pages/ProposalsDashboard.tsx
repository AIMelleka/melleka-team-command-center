import { useState, useEffect, useCallback } from "react";
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
  DropdownMenuSeparator,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  CheckCircle2,
  Clock,
  XCircle,
  Pencil,
  Files,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Palette,
  Navigation,
  Globe,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ProposalCardSkeleton, ProposalRowSkeleton } from "@/components/LoadingSkeletons";
import { ErrorBoundary, InlineErrorFallback } from "@/components/ErrorBoundary";

// ── Types ─────────────────────────────────────────────────────────────────

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

interface QACheck {
  id: string;
  name: string;
  category: 'branding' | 'content' | 'navigation' | 'structure' | 'data';
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  details?: string;
}

interface ProposalQAResult {
  proposalId: string;
  proposalSlug: string;
  clientName: string;
  proposalType: string;
  checks: QACheck[];
  overallScore: number;
  timestamp: Date;
}

// ── Constants ─────────────────────────────────────────────────────────────

const MARKETING_NAV_IDS = [
  'hero', 'executive', 'phases', 'business-audit', 'target-personas',
  'website-design', 'google-ads', 'meta-ads', 'seo', 'analytics',
  'ai-solutions', 'automation-crm', 'ugc', 'social', 'email',
  'budget', 'timeline', 'trusted', 'cta'
];

const WEBSITE_NAV_IDS = [
  'hero', 'your-package', 'design-process', 'whats-included',
  'seo-analytics', 'automations', 'blog-content', 'timeline', 'cta'
];

const REQUIRED_CONTENT_FIELDS = ['hero', 'brandStyles', 'selectedPackage'];

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Draft", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  published: { label: "Published", variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
  archived: { label: "Archived", variant: "outline", icon: <XCircle className="w-3 h-3" /> },
};

// ── QA Helper Functions ───────────────────────────────────────────────────

function getCategoryIcon(category: string) {
  switch (category) {
    case 'branding': return <Palette className="w-4 h-4" />;
    case 'content': return <FileText className="w-4 h-4" />;
    case 'navigation': return <Navigation className="w-4 h-4" />;
    case 'structure': return <Zap className="w-4 h-4" />;
    case 'data': return <Globe className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
}

function getQAStatusIcon(status: string) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    case 'fail': return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
    default: return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />;
  }
}

function getQAStatusBadge(status: string) {
  switch (status) {
    case 'pass': return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] px-1.5 py-0">Pass</Badge>;
    case 'fail': return <Badge className="bg-red-500/20 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0">Fail</Badge>;
    case 'warning': return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0">Warning</Badge>;
    default: return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pending</Badge>;
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
}

function getScoreBadgeClasses(score: number): string {
  if (score >= 90) return 'bg-green-500/20 text-green-600 border-green-500/30';
  if (score >= 70) return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
  return 'bg-red-500/20 text-red-600 border-red-500/30';
}

// ── QA Checks Logic ───────────────────────────────────────────────────────

function runQAChecks(proposal: { id: string; slug: string; client_name: string; content: unknown }): ProposalQAResult {
  const content = (proposal.content || {}) as Record<string, unknown>;
  const proposalType = (content.proposalType as string) || 'marketing';
  const isWebsiteOnly = proposalType === 'website';
  const isCombined = proposalType === 'combined';
  const checks: QACheck[] = [];

  // BRANDING CHECKS
  const heroContent = content.hero as Record<string, unknown> | undefined;
  const brandStyles = content.brandStyles as Record<string, unknown> | undefined;

  const hasLogo = !!(heroContent?.clientLogo || brandStyles?.logo);
  checks.push({
    id: 'logo-present', name: 'Client Logo Present', category: 'branding',
    status: hasLogo ? 'pass' : 'fail',
    message: hasLogo ? 'Logo found in proposal' : 'No logo detected',
    details: hasLogo
      ? `Logo URL: ${(heroContent?.clientLogo || brandStyles?.logo) as string}`
      : 'Use "Refresh Logo" button in proposal view to fix'
  });

  const primaryColor = brandStyles?.primaryColor as string;
  const hasValidPrimaryColor = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor);
  checks.push({
    id: 'primary-color', name: 'Primary Color Valid', category: 'branding',
    status: hasValidPrimaryColor ? 'pass' : 'warning',
    message: hasValidPrimaryColor ? `Primary color: ${primaryColor}` : 'Invalid or missing primary color',
    details: hasValidPrimaryColor ? undefined : 'Using default fallback color'
  });

  const secondaryColor = brandStyles?.secondaryColor as string;
  const hasValidSecondaryColor = secondaryColor && /^#[0-9A-Fa-f]{6}$/.test(secondaryColor);
  checks.push({
    id: 'secondary-color', name: 'Secondary Color Valid', category: 'branding',
    status: hasValidSecondaryColor ? 'pass' : 'warning',
    message: hasValidSecondaryColor ? `Secondary color: ${secondaryColor}` : 'Invalid or missing secondary color',
    details: hasValidSecondaryColor ? undefined : 'Using default fallback color'
  });

  const websiteUrl = content.websiteUrl as string;
  checks.push({
    id: 'website-url', name: 'Website URL Present', category: 'branding',
    status: websiteUrl ? 'pass' : 'warning',
    message: websiteUrl ? `Website: ${websiteUrl}` : 'No website URL stored',
    details: websiteUrl ? undefined : 'Logo refresh will not work without website URL'
  });

  // CONTENT CHECKS
  const hasHeroHeadline = !!(heroContent?.headline);
  const hasHeroSubheadline = !!(heroContent?.subheadline);
  checks.push({
    id: 'hero-content', name: 'Hero Section Content', category: 'content',
    status: hasHeroHeadline && hasHeroSubheadline ? 'pass' : hasHeroHeadline || hasHeroSubheadline ? 'warning' : 'fail',
    message: hasHeroHeadline && hasHeroSubheadline ? 'Hero has headline and subheadline' : 'Missing hero content',
    details: `Headline: ${hasHeroHeadline ? '\u2713' : '\u2717'}, Subheadline: ${hasHeroSubheadline ? '\u2713' : '\u2717'}`
  });

  const selectedPackage = content.selectedPackage as Record<string, unknown> | undefined;
  const hasPackage = !!(selectedPackage?.id && selectedPackage?.name);
  checks.push({
    id: 'package-selected', name: 'Marketing Package Selected', category: 'content',
    status: hasPackage ? 'pass' : isWebsiteOnly ? 'warning' : 'fail',
    message: hasPackage ? `Package: ${selectedPackage?.name}` : isWebsiteOnly ? 'Website-only proposal (no marketing package)' : 'No package selected',
  });

  if (isWebsiteOnly || isCombined) {
    const selectedWebsitePackage = content.selectedWebsitePackage as Record<string, unknown> | undefined;
    const hasWebsitePackage = !!(selectedWebsitePackage?.id);
    checks.push({
      id: 'website-package', name: 'Website Package Selected', category: 'content',
      status: hasWebsitePackage ? 'pass' : 'warning',
      message: hasWebsitePackage ? `Website Package: ${selectedWebsitePackage?.name}` : 'No website package selected',
    });
  }

  const aiGenerated = content.aiGenerated as Record<string, unknown> | undefined;
  const hasAiContent = !!(aiGenerated && Object.keys(aiGenerated).length > 0);
  const aiSections = aiGenerated ? Object.keys(aiGenerated) : [];
  checks.push({
    id: 'ai-content', name: 'Custom Content', category: 'content',
    status: hasAiContent ? 'pass' : 'fail',
    message: hasAiContent ? `${aiSections.length} custom sections generated` : 'No custom content generated',
    details: hasAiContent ? `Sections: ${aiSections.join(', ')}` : 'Regenerate proposal to fix'
  });

  const executiveSummary = aiGenerated?.executiveSummary as Record<string, unknown> | undefined;
  const hasExecutiveSummary = !!(executiveSummary?.title && executiveSummary?.description);
  checks.push({
    id: 'executive-summary', name: 'Executive Summary', category: 'content',
    status: hasExecutiveSummary ? 'pass' : 'warning',
    message: hasExecutiveSummary ? 'Executive summary present' : 'Missing executive summary',
  });

  // NAVIGATION CHECKS
  const expectedNavIds = isWebsiteOnly ? WEBSITE_NAV_IDS : MARKETING_NAV_IDS;
  checks.push({
    id: 'nav-ids-defined', name: 'Navigation IDs Defined', category: 'navigation',
    status: 'pass',
    message: `${expectedNavIds.length} navigation items for ${isWebsiteOnly ? 'website' : 'marketing'} proposal`,
    details: `IDs: ${expectedNavIds.join(', ')}`
  });

  const criticalSections = isWebsiteOnly
    ? ['hero', 'your-package', 'design-process', 'cta']
    : ['hero', 'executive', 'business-audit', 'budget', 'cta'];
  checks.push({
    id: 'critical-sections', name: 'Critical Section IDs', category: 'navigation',
    status: 'pass',
    message: `${criticalSections.length} critical sections expected`,
    details: `Sections: ${criticalSections.join(', ')}`
  });

  // STRUCTURE CHECKS
  const validTypes = ['marketing', 'website', 'combined'];
  const hasValidType = validTypes.includes(proposalType);
  checks.push({
    id: 'proposal-type', name: 'Proposal Type Valid', category: 'structure',
    status: hasValidType ? 'pass' : 'fail',
    message: hasValidType ? `Type: ${proposalType}` : `Invalid type: ${proposalType}`,
  });

  const contentKeys = Object.keys(content);
  const hasMinimalContent = contentKeys.length >= 3;
  checks.push({
    id: 'content-structure', name: 'Content Structure', category: 'structure',
    status: hasMinimalContent ? 'pass' : 'fail',
    message: `${contentKeys.length} top-level content keys`,
    details: `Keys: ${contentKeys.slice(0, 10).join(', ')}${contentKeys.length > 10 ? '...' : ''}`
  });

  const missingFields = REQUIRED_CONTENT_FIELDS.filter(field => !content[field]);
  checks.push({
    id: 'required-fields', name: 'Required Fields Present', category: 'structure',
    status: missingFields.length === 0 ? 'pass' : 'warning',
    message: missingFields.length === 0 ? 'All required fields present' : `Missing: ${missingFields.join(', ')}`,
  });

  // DATA INTEGRITY CHECKS
  const slugValid = proposal.slug && /^[a-z0-9-]+$/.test(proposal.slug);
  checks.push({
    id: 'slug-valid', name: 'URL Slug Valid', category: 'data',
    status: slugValid ? 'pass' : 'fail',
    message: slugValid ? `Slug: ${proposal.slug}` : 'Invalid slug format',
  });

  checks.push({
    id: 'client-name', name: 'Client Name Present', category: 'data',
    status: proposal.client_name ? 'pass' : 'fail',
    message: proposal.client_name ? `Client: ${proposal.client_name}` : 'Missing client name',
  });

  const seoData = content.seoData as Record<string, unknown> | undefined;
  const hasSeoData = !!(seoData && Object.keys(seoData).length > 0);
  checks.push({
    id: 'seo-data', name: 'SEO Data Available', category: 'data',
    status: hasSeoData ? 'pass' : 'warning',
    message: hasSeoData ? 'SEO data present' : 'No SEO data (optional)',
  });

  const keywordStrategy = content.keywordStrategy as Record<string, unknown> | undefined;
  const keywordGaps = (keywordStrategy?.keywordGaps as string[]) || [];
  const genericPatterns = [
    /industry\s+(alternatives|comparison|solutions)/i,
    /^affordable\s+\w+\s+solutions$/i,
    /^best\s+\w+\s+for\s+small\s+business$/i,
    /^top\s+rated\s+\w+$/i,
    /^\w+\s+alternatives$/i,
    /^\w+\s+comparison$/i,
  ];
  const genericGaps = keywordGaps.filter(gap =>
    genericPatterns.some(pattern => pattern.test(gap)) ||
    gap.toLowerCase().includes('industry') ||
    (gap.split(' ').length <= 2 && gap.toLowerCase().endsWith('alternatives'))
  );
  const hasGenericGaps = genericGaps.length > 0;
  checks.push({
    id: 'keyword-gaps-specific', name: 'Keyword Gaps Are Client-Specific', category: 'data',
    status: keywordGaps.length === 0 ? 'warning' : hasGenericGaps ? 'fail' : 'pass',
    message: keywordGaps.length === 0
      ? 'No keyword gaps found'
      : hasGenericGaps
        ? `${genericGaps.length} generic keyword gaps detected`
        : `${keywordGaps.length} client-specific keyword gaps`,
    details: hasGenericGaps ? `Generic patterns found: ${genericGaps.slice(0, 3).join(', ')}` : undefined
  });

  const screenshots = content.screenshots as unknown[] | undefined;
  const hasScreenshots = !!(screenshots && screenshots.length > 0);
  checks.push({
    id: 'screenshots', name: 'Website Screenshots', category: 'data',
    status: hasScreenshots ? 'pass' : 'warning',
    message: hasScreenshots ? `${screenshots.length} screenshots` : 'No screenshots captured',
  });

  // Calculate overall score
  const passCount = checks.filter(c => c.status === 'pass').length;
  const overallScore = Math.round((passCount / checks.length) * 100);

  return {
    proposalId: proposal.id,
    proposalSlug: proposal.slug,
    clientName: proposal.client_name,
    proposalType,
    checks,
    overallScore,
    timestamp: new Date(),
  };
}

// ── Component ─────────────────────────────────────────────────────────────

const ProposalsDashboard = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // QA state
  const [qaResults, setQaResults] = useState<Record<string, ProposalQAResult>>({});
  const [runningQAId, setRunningQAId] = useState<string | null>(null);
  const [qaSheetOpen, setQaSheetOpen] = useState(false);
  const [activeQAId, setActiveQAId] = useState<string | null>(null);

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
      const { data: original, error: fetchError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();
      if (fetchError) throw fetchError;

      const newSlug = `p-${nanoid(21)}`;
      const newTitle = original.title.includes('(Copy)')
        ? original.title
        : `${original.title} (Copy)`;

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
          status: 'draft',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      setProposals((prev) => [duplicate as Proposal, ...prev]);
      toast.success("Proposal duplicated! Opening editor...");
      navigate(`/proposal-builder?edit=${duplicate.id}`);
    } catch (error) {
      console.error("Error duplicating proposal:", error);
      toast.error("Failed to duplicate proposal");
    } finally {
      setDuplicatingId(null);
    }
  };

  // ── QA Functions ──────────────────────────────────────────────────────

  const handleRunQA = useCallback(async (proposalId: string) => {
    setRunningQAId(proposalId);
    try {
      // Fetch full proposal content on demand
      const { data, error } = await supabase
        .from("proposals")
        .select("id, slug, client_name, content")
        .eq("id", proposalId)
        .single();
      if (error) throw error;

      const result = runQAChecks(data);
      setQaResults(prev => ({ ...prev, [proposalId]: result }));
      setActiveQAId(proposalId);
      setQaSheetOpen(true);

      const failCount = result.checks.filter(c => c.status === 'fail').length;
      if (failCount === 0) {
        toast.success(`QA Complete: ${result.overallScore}% - All critical checks passed!`);
      } else {
        toast.warning(`QA Complete: ${result.overallScore}% - ${failCount} issues found`);
      }
    } catch (error) {
      console.error("Error running QA:", error);
      toast.error("Failed to run QA checks");
    } finally {
      setRunningQAId(null);
    }
  }, []);

  const handleViewQA = useCallback((proposalId: string) => {
    setActiveQAId(proposalId);
    setQaSheetOpen(true);
  }, []);

  const activeQAResult = activeQAId ? qaResults[activeQAId] : null;

  const groupedChecks = activeQAResult?.checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, QACheck[]>) || {};

  // ── Render Helpers ────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const renderQABadge = (proposalId: string) => {
    if (runningQAId === proposalId) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    }
    const result = qaResults[proposalId];
    if (!result) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleViewQA(proposalId); }}
        className="cursor-pointer"
      >
        <Badge className={`${getScoreBadgeClasses(result.overallScore)} text-[10px] px-1.5 py-0`}>
          QA {result.overallScore}%
        </Badge>
      </button>
    );
  };

  // Dropdown items shared between mobile and desktop
  const renderDropdownItems = (proposal: Proposal) => (
    <>
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
        className="flex items-center gap-2"
      >
        {duplicatingId === proposal.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Files className="h-4 w-4" />
        )}
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleCopyLink(proposal.slug)} className="flex items-center gap-2">
        <Copy className="h-4 w-4" />
        Copy Link
      </DropdownMenuItem>
      <DropdownMenuItem asChild className="hidden md:flex">
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
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => handleRunQA(proposal.id)}
        disabled={runningQAId === proposal.id}
        className="flex items-center gap-2"
      >
        {runningQAId === proposal.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        Run QA
      </DropdownMenuItem>
      {qaResults[proposal.id] && (
        <DropdownMenuItem onClick={() => handleViewQA(proposal.id)} className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          View QA Results
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
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
    </>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
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
                <div className="md:hidden space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <ProposalCardSkeleton key={i} />
                  ))}
                </div>
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
                            {renderDropdownItems(proposal)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(proposal.status)}
                          {renderQABadge(proposal.id)}
                        </div>
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
                      <TableHead>QA</TableHead>
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
                        <TableCell>
                          {renderQABadge(proposal.id)}
                        </TableCell>
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
                              {renderDropdownItems(proposal)}
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

      {/* QA Results Sheet */}
      <Sheet open={qaSheetOpen} onOpenChange={setQaSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px] p-0 overflow-y-auto">
          <SheetHeader className="p-4 border-b sticky top-0 bg-background z-10">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base">
                  {activeQAResult ? `QA: ${activeQAResult.clientName}` : 'QA Results'}
                </SheetTitle>
                {activeQAResult && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Type: {activeQAResult.proposalType} | {activeQAResult.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
              {activeQAResult && (
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: getScoreColor(activeQAResult.overallScore) }}>
                    {activeQAResult.overallScore}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Overall</p>
                </div>
              )}
            </div>
          </SheetHeader>

          {activeQAResult ? (
            <div className="p-4 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-bold">{activeQAResult.checks.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10 text-center">
                  <p className="text-lg font-bold text-green-600">
                    {activeQAResult.checks.filter(c => c.status === 'pass').length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Passed</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10 text-center">
                  <p className="text-lg font-bold text-yellow-600">
                    {activeQAResult.checks.filter(c => c.status === 'warning').length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Warnings</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10 text-center">
                  <p className="text-lg font-bold text-red-600">
                    {activeQAResult.checks.filter(c => c.status === 'fail').length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Failed</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleRunQA(activeQAResult.proposalId)}
                  disabled={runningQAId === activeQAResult.proposalId}
                >
                  {runningQAId === activeQAResult.proposalId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  Re-run QA
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => window.open(`/proposal/${activeQAResult.proposalSlug}`, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Proposal
                </Button>
              </div>

              {/* Grouped Checks */}
              {Object.entries(groupedChecks).map(([category, checks]) => (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium capitalize text-muted-foreground">
                    {getCategoryIcon(category)}
                    {category}
                  </div>
                  <div className="space-y-1.5">
                    {checks.map((check) => (
                      <div
                        key={check.id}
                        className={`p-2.5 rounded-lg border ${
                          check.status === 'fail' ? 'border-red-500/30 bg-red-500/5' :
                          check.status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                          'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {getQAStatusIcon(check.status)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{check.name}</p>
                              <p className="text-xs text-muted-foreground">{check.message}</p>
                              {check.details && (
                                <p className="text-[10px] text-muted-foreground mt-1 font-mono bg-muted/50 px-1.5 py-0.5 rounded truncate">
                                  {check.details}
                                </p>
                              )}
                            </div>
                          </div>
                          {getQAStatusBadge(check.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <ShieldCheck className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No QA results</p>
              <p className="text-xs text-muted-foreground">Run QA from a proposal's menu</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

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

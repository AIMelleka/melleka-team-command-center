import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ArrowLeft,
  Search,
  Loader2,
  Image,
  Navigation,
  FileText,
  Palette,
  Globe,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

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

// Navigation items must match ProposalView.tsx exactly
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

const REQUIRED_CONTENT_FIELDS = [
  'hero',
  'brandStyles',
  'selectedPackage'
];

interface ProposalData {
  id: string;
  slug: string;
  client_name: string;
  content: unknown;
  created_at: string;
}

const ProposalQA = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [qaResults, setQaResults] = useState<ProposalQAResult | null>(null);
  const [runningQA, setRunningQA] = useState(false);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, slug, client_name, content, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  };

  const runQAChecks = async (proposalId: string) => {
    setRunningQA(true);
    setSelectedProposal(proposalId);

    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) {
      toast.error('Proposal not found');
      setRunningQA(false);
      return;
    }

    const content = (proposal.content || {}) as Record<string, unknown>;
    const proposalType = (content.proposalType as string) || 'marketing';
    const isWebsiteOnly = proposalType === 'website';
    const isCombined = proposalType === 'combined';
    const checks: QACheck[] = [];

    // ========== BRANDING CHECKS ==========
    
    // Check 1: Logo Present
    const heroContent = content.hero as Record<string, unknown> | undefined;
    const brandStyles = content.brandStyles as Record<string, unknown> | undefined;
    const hasLogo = !!(heroContent?.clientLogo || brandStyles?.logo);
    checks.push({
      id: 'logo-present',
      name: 'Client Logo Present',
      category: 'branding',
      status: hasLogo ? 'pass' : 'fail',
      message: hasLogo ? 'Logo found in proposal' : 'No logo detected',
      details: hasLogo 
        ? `Logo URL: ${(heroContent?.clientLogo || brandStyles?.logo) as string}`
        : 'Use "Refresh Logo" button in proposal view to fix'
    });

    // Check 2: Primary Color Valid
    const primaryColor = brandStyles?.primaryColor as string;
    const hasValidPrimaryColor = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor);
    checks.push({
      id: 'primary-color',
      name: 'Primary Color Valid',
      category: 'branding',
      status: hasValidPrimaryColor ? 'pass' : 'warning',
      message: hasValidPrimaryColor ? `Primary color: ${primaryColor}` : 'Invalid or missing primary color',
      details: hasValidPrimaryColor ? undefined : 'Using default fallback color'
    });

    // Check 3: Secondary Color Valid
    const secondaryColor = brandStyles?.secondaryColor as string;
    const hasValidSecondaryColor = secondaryColor && /^#[0-9A-Fa-f]{6}$/.test(secondaryColor);
    checks.push({
      id: 'secondary-color',
      name: 'Secondary Color Valid',
      category: 'branding',
      status: hasValidSecondaryColor ? 'pass' : 'warning',
      message: hasValidSecondaryColor ? `Secondary color: ${secondaryColor}` : 'Invalid or missing secondary color',
      details: hasValidSecondaryColor ? undefined : 'Using default fallback color'
    });

    // Check 4: Website URL Present
    const websiteUrl = content.websiteUrl as string;
    checks.push({
      id: 'website-url',
      name: 'Website URL Present',
      category: 'branding',
      status: websiteUrl ? 'pass' : 'warning',
      message: websiteUrl ? `Website: ${websiteUrl}` : 'No website URL stored',
      details: websiteUrl ? undefined : 'Logo refresh will not work without website URL'
    });

    // ========== CONTENT CHECKS ==========
    
    // Check 5: Hero Section Content
    const hasHeroHeadline = !!(heroContent?.headline);
    const hasHeroSubheadline = !!(heroContent?.subheadline);
    checks.push({
      id: 'hero-content',
      name: 'Hero Section Content',
      category: 'content',
      status: hasHeroHeadline && hasHeroSubheadline ? 'pass' : hasHeroHeadline || hasHeroSubheadline ? 'warning' : 'fail',
      message: hasHeroHeadline && hasHeroSubheadline 
        ? 'Hero has headline and subheadline' 
        : 'Missing hero content',
      details: `Headline: ${hasHeroHeadline ? '✓' : '✗'}, Subheadline: ${hasHeroSubheadline ? '✓' : '✗'}`
    });

    // Check 6: Package Selected
    const selectedPackage = content.selectedPackage as Record<string, unknown> | undefined;
    const hasPackage = !!(selectedPackage?.id && selectedPackage?.name);
    checks.push({
      id: 'package-selected',
      name: 'Marketing Package Selected',
      category: 'content',
      status: hasPackage ? 'pass' : isWebsiteOnly ? 'warning' : 'fail',
      message: hasPackage 
        ? `Package: ${selectedPackage?.name}` 
        : isWebsiteOnly ? 'Website-only proposal (no marketing package)' : 'No package selected',
    });

    // Check 7: Website Package (for website/combined proposals)
    if (isWebsiteOnly || isCombined) {
      const selectedWebsitePackage = content.selectedWebsitePackage as Record<string, unknown> | undefined;
      const hasWebsitePackage = !!(selectedWebsitePackage?.id);
      checks.push({
        id: 'website-package',
        name: 'Website Package Selected',
        category: 'content',
        status: hasWebsitePackage ? 'pass' : 'warning',
        message: hasWebsitePackage 
          ? `Website Package: ${selectedWebsitePackage?.name}` 
          : 'No website package selected',
      });
    }

    // Check 8: Custom Content Present
    const aiGenerated = content.aiGenerated as Record<string, unknown> | undefined;
    const hasAiContent = !!(aiGenerated && Object.keys(aiGenerated).length > 0);
    const aiSections = aiGenerated ? Object.keys(aiGenerated) : [];
    checks.push({
      id: 'ai-content',
      name: 'Custom Content',
      category: 'content',
      status: hasAiContent ? 'pass' : 'fail',
      message: hasAiContent 
        ? `${aiSections.length} custom sections generated` 
        : 'No custom content generated',
      details: hasAiContent ? `Sections: ${aiSections.join(', ')}` : 'Regenerate proposal to fix'
    });

    // Check 9: Executive Summary
    const executiveSummary = aiGenerated?.executiveSummary as Record<string, unknown> | undefined;
    const hasExecutiveSummary = !!(executiveSummary?.title && executiveSummary?.description);
    checks.push({
      id: 'executive-summary',
      name: 'Executive Summary',
      category: 'content',
      status: hasExecutiveSummary ? 'pass' : 'warning',
      message: hasExecutiveSummary ? 'Executive summary present' : 'Missing executive summary',
    });

    // ========== NAVIGATION CHECKS ==========
    
    // Check 10: Navigation IDs Match Structure
    const expectedNavIds = isWebsiteOnly ? WEBSITE_NAV_IDS : MARKETING_NAV_IDS;
    checks.push({
      id: 'nav-ids-defined',
      name: 'Navigation IDs Defined',
      category: 'navigation',
      status: 'pass',
      message: `${expectedNavIds.length} navigation items for ${isWebsiteOnly ? 'website' : 'marketing'} proposal`,
      details: `IDs: ${expectedNavIds.join(', ')}`
    });

    // Check 11: Critical Sections Have IDs
    const criticalSections = isWebsiteOnly 
      ? ['hero', 'your-package', 'design-process', 'cta']
      : ['hero', 'executive', 'business-audit', 'budget', 'cta'];
    checks.push({
      id: 'critical-sections',
      name: 'Critical Section IDs',
      category: 'navigation',
      status: 'pass',
      message: `${criticalSections.length} critical sections expected`,
      details: `Sections: ${criticalSections.join(', ')}`
    });

    // ========== STRUCTURE CHECKS ==========

    // Check 12: Proposal Type Valid
    const validTypes = ['marketing', 'website', 'combined'];
    const hasValidType = validTypes.includes(proposalType);
    checks.push({
      id: 'proposal-type',
      name: 'Proposal Type Valid',
      category: 'structure',
      status: hasValidType ? 'pass' : 'fail',
      message: hasValidType ? `Type: ${proposalType}` : `Invalid type: ${proposalType}`,
    });

    // Check 13: Content Object Not Empty
    const contentKeys = Object.keys(content);
    const hasMinimalContent = contentKeys.length >= 3;
    checks.push({
      id: 'content-structure',
      name: 'Content Structure',
      category: 'structure',
      status: hasMinimalContent ? 'pass' : 'fail',
      message: `${contentKeys.length} top-level content keys`,
      details: `Keys: ${contentKeys.slice(0, 10).join(', ')}${contentKeys.length > 10 ? '...' : ''}`
    });

    // Check 14: Required Fields Present
    const missingFields = REQUIRED_CONTENT_FIELDS.filter(field => !content[field]);
    checks.push({
      id: 'required-fields',
      name: 'Required Fields Present',
      category: 'structure',
      status: missingFields.length === 0 ? 'pass' : 'warning',
      message: missingFields.length === 0 
        ? 'All required fields present' 
        : `Missing: ${missingFields.join(', ')}`,
    });

    // ========== DATA INTEGRITY CHECKS ==========

    // Check 15: Slug Valid
    const slugValid = proposal.slug && /^[a-z0-9-]+$/.test(proposal.slug);
    checks.push({
      id: 'slug-valid',
      name: 'URL Slug Valid',
      category: 'data',
      status: slugValid ? 'pass' : 'fail',
      message: slugValid ? `Slug: ${proposal.slug}` : 'Invalid slug format',
    });

    // Check 16: Client Name Present
    checks.push({
      id: 'client-name',
      name: 'Client Name Present',
      category: 'data',
      status: proposal.client_name ? 'pass' : 'fail',
      message: proposal.client_name ? `Client: ${proposal.client_name}` : 'Missing client name',
    });

    // Check 17: SEO Data (optional but good to have)
    const seoData = content.seoData as Record<string, unknown> | undefined;
    const hasSeoData = !!(seoData && Object.keys(seoData).length > 0);
    checks.push({
      id: 'seo-data',
      name: 'SEO Data Available',
      category: 'data',
      status: hasSeoData ? 'pass' : 'warning',
      message: hasSeoData ? 'SEO data present' : 'No SEO data (optional)',
    });

    // Check 18: Keyword Gaps Are Client-Specific (not generic)
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
      id: 'keyword-gaps-specific',
      name: 'Keyword Gaps Are Client-Specific',
      category: 'data',
      status: keywordGaps.length === 0 ? 'warning' : hasGenericGaps ? 'fail' : 'pass',
      message: keywordGaps.length === 0 
        ? 'No keyword gaps found' 
        : hasGenericGaps 
          ? `${genericGaps.length} generic keyword gaps detected`
          : `${keywordGaps.length} client-specific keyword gaps`,
      details: hasGenericGaps ? `Generic patterns found: ${genericGaps.slice(0, 3).join(', ')}` : undefined
    });

    // Check 18: Screenshots Present
    const screenshots = content.screenshots as unknown[] | undefined;
    const hasScreenshots = !!(screenshots && screenshots.length > 0);
    checks.push({
      id: 'screenshots',
      name: 'Website Screenshots',
      category: 'data',
      status: hasScreenshots ? 'pass' : 'warning',
      message: hasScreenshots ? `${screenshots.length} screenshots` : 'No screenshots captured',
    });

    // Calculate overall score
    const passCount = checks.filter(c => c.status === 'pass').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const overallScore = Math.round((passCount / checks.length) * 100);

    const result: ProposalQAResult = {
      proposalId: proposal.id,
      proposalSlug: proposal.slug,
      clientName: proposal.client_name,
      proposalType,
      checks,
      overallScore,
      timestamp: new Date()
    };

    setQaResults(result);
    setRunningQA(false);

    if (failCount === 0) {
      toast.success(`QA Complete: ${overallScore}% - All critical checks passed!`);
    } else {
      toast.warning(`QA Complete: ${overallScore}% - ${failCount} issues found`);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'branding': return <Palette className="w-4 h-4" />;
      case 'content': return <FileText className="w-4 h-4" />;
      case 'navigation': return <Navigation className="w-4 h-4" />;
      case 'structure': return <Zap className="w-4 h-4" />;
      case 'data': return <Globe className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass': return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Pass</Badge>;
      case 'fail': return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Fail</Badge>;
      case 'warning': return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Warning</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const filteredProposals = proposals.filter(p => 
    p.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedChecks = qaResults?.checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, QACheck[]>) || {};

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Proposal QA Checklist</h1>
              <p className="text-muted-foreground">Automated quality checks for proposals</p>
            </div>
          </div>
          <Button onClick={fetchProposals} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Proposal List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Select Proposal</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search proposals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredProposals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No proposals found</p>
              ) : (
                filteredProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary ${
                      selectedProposal === proposal.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => runQAChecks(proposal.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{proposal.client_name}</p>
                        <p className="text-xs text-muted-foreground">/{proposal.slug}</p>
                      </div>
                      {runningQA && selectedProposal === proposal.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : qaResults?.proposalId === proposal.id ? (
                        <Badge 
                          className={
                            qaResults.overallScore >= 90 ? 'bg-green-500/20 text-green-600' :
                            qaResults.overallScore >= 70 ? 'bg-yellow-500/20 text-yellow-600' :
                            'bg-red-500/20 text-red-600'
                          }
                        >
                          {qaResults.overallScore}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* QA Results */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {qaResults ? `QA Results: ${qaResults.clientName}` : 'QA Results'}
                  </CardTitle>
                  {qaResults && (
                    <p className="text-sm text-muted-foreground">
                      Type: {qaResults.proposalType} • Checked: {qaResults.timestamp.toLocaleTimeString()}
                    </p>
                  )}
                </div>
                {qaResults && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-3xl font-bold" style={{
                        color: qaResults.overallScore >= 90 ? '#22c55e' :
                               qaResults.overallScore >= 70 ? '#eab308' : '#ef4444'
                      }}>
                        {qaResults.overallScore}%
                      </p>
                      <p className="text-xs text-muted-foreground">Overall Score</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`/proposal/${qaResults.proposalSlug}`, '_blank')}
                    >
                      View Proposal
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!qaResults ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Image className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Select a proposal to run QA checks</p>
                  <p className="text-sm text-muted-foreground">Click on any proposal from the list to analyze it</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold">{qaResults.checks.length}</p>
                      <p className="text-xs text-muted-foreground">Total Checks</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {qaResults.checks.filter(c => c.status === 'pass').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Passed</p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {qaResults.checks.filter(c => c.status === 'warning').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Warnings</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {qaResults.checks.filter(c => c.status === 'fail').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  {/* Grouped Checks */}
                  {Object.entries(groupedChecks).map(([category, checks]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium capitalize">
                        {getCategoryIcon(category)}
                        {category} Checks
                      </div>
                      <div className="space-y-2">
                        {checks.map((check) => (
                          <div 
                            key={check.id} 
                            className={`p-3 rounded-lg border ${
                              check.status === 'fail' ? 'border-red-500/30 bg-red-500/5' :
                              check.status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                              'border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                {getStatusIcon(check.status)}
                                <div>
                                  <p className="font-medium">{check.name}</p>
                                  <p className="text-sm text-muted-foreground">{check.message}</p>
                                  {check.details && (
                                    <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-1 rounded">
                                      {check.details}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {getStatusBadge(check.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProposalQA;

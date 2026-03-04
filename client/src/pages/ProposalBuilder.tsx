import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Globe, Check, AlertCircle, Search, TrendingUp, FileText, Camera, Palette, Eye, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import GenieLamp from '@/components/icons/GenieLamp';
import PackageSelector from '@/components/PackageSelector';
import { getPackageById } from '@/data/packages';
import { CompetitiveAdAnalysis, AdAnalysisItem } from '@/components/CompetitiveAdAnalysis';
import { apiService } from '@/lib/apiService';
import { useProposalGeneration } from '@/hooks/useProposalGeneration';
import { ProposalGenerationProgress } from '@/components/ProposalGenerationProgress';
interface ScreenshotData {
  url: string;
  screenshot: string | null;
  title: string;
}

interface BrandingData {
  logo?: string | null;
  favicon?: string | null;
  ogImage?: string | null;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textPrimary?: string;
    textSecondary?: string;
  };
  fonts?: Array<{ family: string }>;
  colorScheme?: string;
  metadata?: {
    title?: string;
    description?: string;
  };
  screenshot?: string | null;
  screenshots?: ScreenshotData[];
  discoveredPages?: string[];
}

interface SeoData {
  domain: string;
  organicKeywords?: number;
  organicTraffic?: number;
  domainAuthority?: number;
  backlinks?: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty: number;
  }>;
  competitors?: Array<{
    domain: string;
    commonKeywords: number;
  }>;
}

// Helper function to check if a color is light (for contrast)
const isLightColorCheck = (color: string): boolean => {
  if (!color) return false;
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }
  return false;
};

const ProposalBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = !!editId;
  
  // Use the async proposal generation hook
  const { 
    isGenerating, 
    progress: generationProgress, 
    progressMessage: generationMessage,
    error: generationError,
    startGeneration,
    cancelGeneration,
    retryGeneration,
  } = useProposalGeneration();
  
  const [step, setStep] = useState(1);
  const [isScraping, setIsScraping] = useState(false);
  const [isFetchingSeo, setIsFetchingSeo] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [websiteContent, setWebsiteContent] = useState<string>('');
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  const [existingSlug, setExistingSlug] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clientName: '',
    websiteUrl: '',
    projectDescription: '',
    proposalType: 'marketing' as 'marketing' | 'website' | 'combined', // Proposal type selector
    selectedPackages: [] as string[], // Now supports multiple packages
    primaryPackage: null as string | null, // The main package for proposal generation
    customBudget: '',
    timeline: '12 months',
    proposalPrimaryColor: '#9b87f5', // Default genie purple
    proposalBackgroundColor: '#1A1F2C', // Default dark background
    proposalTextColor: '', // Empty means auto-detect based on background
    proposalTextMutedColor: '', // Empty means auto-detect based on background
    // Website Design specific fields
    selectedWebsitePackage: null as string | null,
    portfolioWebsites: [] as Array<{ url: string; title: string; description: string }>,
  });
  const [screenshotCount, setScreenshotCount] = useState(6);
  const [isRetakingScreenshots, setIsRetakingScreenshots] = useState(false);
  const [competitiveAdAnalysis, setCompetitiveAdAnalysis] = useState<AdAnalysisItem[]>([]);
  // Load existing proposal data when in edit mode
  useEffect(() => {
    if (editId) {
      loadProposalForEdit(editId);
    }
  }, [editId]);

  const loadProposalForEdit = async (proposalId: string) => {
    setIsLoadingProposal(true);
    try {
      const { data: proposal, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .maybeSingle();

      if (error) throw error;
      
      if (!proposal) {
        toast.error('Proposal not found');
        navigate('/proposals');
        return;
      }

      const content = proposal.content as any;
      
      // Populate form with existing data
      setFormData({
        clientName: proposal.client_name,
        websiteUrl: content?.brandStyles?.website || content?.websiteUrl || '',
        projectDescription: proposal.project_description,
        proposalType: content?.selectedWebsitePackage && !content?.selectedPackage 
          ? 'website' 
          : content?.selectedWebsitePackage && content?.selectedPackage 
            ? 'combined' 
            : 'marketing',
        selectedPackages: content?.selectedPackage ? [content.selectedPackage.id] : [],
        primaryPackage: content?.selectedPackage?.id || null,
        customBudget: proposal.budget_range || '',
        timeline: proposal.timeline || '12 months',
        proposalPrimaryColor: content?.proposalColors?.primary || '#9b87f5',
        proposalBackgroundColor: content?.proposalColors?.background || '#1A1F2C',
        proposalTextColor: content?.proposalColors?.text || '',
        proposalTextMutedColor: content?.proposalColors?.textMuted || '',
        selectedWebsitePackage: content?.selectedWebsitePackage?.id || null,
        portfolioWebsites: content?.websiteDesign?.portfolioWebsites || [],
      });
      
      // Set branding if available
      if (content?.brandStyles || content?.screenshots) {
        setBranding({
          logo: content?.brandStyles?.logo,
          colors: content?.brandStyles?.colors,
          screenshot: content?.brandStyles?.screenshot,
          screenshots: content?.screenshots || [],
        });
        setScraped(true);
      }
      
      // Set SEO data if available
      if (content?.seoData) {
        setSeoData(content.seoData);
      }
      
      setExistingSlug(proposal.slug);
      setStep(2); // Start at package selection since we already have client info
      
      toast.success('Proposal loaded for editing');
    } catch (error) {
      console.error('Error loading proposal:', error);
      toast.error('Failed to load proposal');
      navigate('/proposals');
    } finally {
      setIsLoadingProposal(false);
    }
  };

  const primaryPackageData = formData.primaryPackage ? getPackageById(formData.primaryPackage) : null;

  const handleScrapeWebsite = async (maxScreenshots = 6) => {
    if (!formData.websiteUrl) {
      toast.error('Please enter a website URL');
      return;
    }

    setIsScraping(true);
    setScraped(false);
    setBranding(null);

    try {
      const { data, error, cached } = await apiService.scrapeWebsite(
        formData.websiteUrl,
        maxScreenshots,
        (attempt) => toast.info(`Retrying website scrape (attempt ${attempt + 1})...`)
      );

      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data returned');

      if (cached) {
        toast.info('Using cached website data');
      }

      if (data.success) {
        setBranding({
          logo: data.branding?.logo,
          favicon: data.branding?.favicon,
          ogImage: data.branding?.ogImage,
          colors: data.branding?.colors,
          fonts: data.branding?.fonts,
          colorScheme: data.branding?.colorScheme,
          metadata: data.metadata,
          screenshot: data.screenshot,
          screenshots: data.screenshots || [],
          discoveredPages: data.discoveredPages || [],
        });
        
        // Auto-set proposal colors from extracted branding
        if (data.branding?.colors?.primary) {
          setFormData(prev => ({ ...prev, proposalPrimaryColor: data.branding!.colors!.primary }));
        }
        if (data.branding?.colors?.background) {
          setFormData(prev => ({ ...prev, proposalBackgroundColor: data.branding!.colors!.background }));
        }
        setWebsiteContent(data.content || '');
        setScraped(true);
        
        // Always auto-fill client name from website title
        if (data.metadata?.title) {
          // Clean up the title - remove common suffixes and get just the company name
          let cleanName = data.metadata.title
            .split('|')[0]
            .split('-')[0]
            .split('–')[0]
            .split(':')[0]
            .replace(/Home|Official|Website|Site|Page/gi, '')
            .trim();
          
          // If we still have a name, use it
          if (cleanName.length > 0) {
            setFormData(prev => ({ ...prev, clientName: cleanName }));
            toast.success(`Company detected: ${cleanName}`);
          }
        }
        
        toast.success('Website branding extracted successfully!');
        
        // Also fetch SEO data
        handleFetchSeoData();
      } else {
        throw new Error(data.error || 'Failed to scrape website');
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      toast.error('Failed to extract branding. You can still generate the proposal.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleFetchSeoData = async () => {
    if (!formData.websiteUrl) return;

    setIsFetchingSeo(true);
    try {
      const { data, error, cached } = await apiService.getSeoData(
        formData.websiteUrl,
        (attempt) => toast.info(`Retrying SEO data fetch (attempt ${attempt + 1})...`)
      );

      if (error) throw new Error(error.message);
      if (!data) throw new Error('No SEO data returned');

      if (cached) {
        toast.info('Using cached SEO data');
      }

      if (data.success) {
        setSeoData({ ...data.data, domain: formData.websiteUrl } as SeoData);
        if (data.isMock) {
          toast.info('Using estimated SEO data (connect Semrush for real data)');
        } else if (!cached) {
          toast.success('Real SEO data fetched from Semrush!');
        }
      }
    } catch (error) {
      console.error('Error fetching SEO data:', error);
    } finally {
      setIsFetchingSeo(false);
    }
  };

  const handleGenerate = async () => {
    // Validate based on proposal type
    const isValid = formData.clientName && (
      (formData.proposalType === 'marketing' && formData.primaryPackage) ||
      (formData.proposalType === 'website' && formData.selectedWebsitePackage) ||
      (formData.proposalType === 'combined' && formData.primaryPackage && formData.selectedWebsitePackage)
    );
    
    if (!isValid) {
      const message = formData.proposalType === 'combined' 
        ? 'Please select both marketing and website packages, and enter client name'
        : formData.proposalType === 'website'
          ? 'Please select a website package and enter client name'
          : 'Please select a marketing package and enter client name';
      toast.error(message);
      return;
    }

    try {
      const packageData = formData.primaryPackage ? getPackageById(formData.primaryPackage) : null;
      const isWebsiteOnly = formData.proposalType === 'website';
      
      // Use async background generation
      const result = await startGeneration({
        clientName: formData.clientName,
        websiteUrl: formData.websiteUrl,
        projectDescription: formData.projectDescription || (isWebsiteOnly 
          ? `${formData.clientName} website design project` 
          : `${formData.clientName} marketing partnership`),
        selectedPackage: packageData,
        selectedWebsitePackage: formData.selectedWebsitePackage,
        isWebsiteOnlyProposal: isWebsiteOnly,
        budgetRange: packageData?.monthlyPrice 
          ? `$${(packageData.monthlyPrice * 12).toLocaleString()}/year`
          : isWebsiteOnly 
            ? `$${formData.selectedWebsitePackage === 'website-basic' ? '2,900' 
                : formData.selectedWebsitePackage === 'website-premium' ? '3,999' 
                : '5,999'}`
            : formData.customBudget,
        timeline: formData.timeline,
        branding: branding ? {
          logo: branding.logo,
          ogImage: branding.ogImage,
          colors: branding.colors,
          fonts: branding.fonts,
          colorScheme: branding.colorScheme,
          metadata: branding.metadata,
          screenshot: branding.screenshot,
          screenshots: branding.screenshots,
        } : undefined,
        proposalColors: {
          primary: formData.proposalPrimaryColor,
          background: formData.proposalBackgroundColor,
          text: formData.proposalTextColor || undefined,
          textMuted: formData.proposalTextMutedColor || undefined,
        },
        websiteContent: websiteContent,
        seoData: seoData,
        portfolioWebsites: formData.portfolioWebsites.filter(p => p.url.trim() && p.title.trim()),
      });

      if (!result || !result.proposal) {
        toast.error('Failed to generate proposal. Please try again.');
        return;
      }

      const proposal = result.proposal;
      // Generate cryptographically secure slug that's impossible to guess
      const slug = isEditMode && existingSlug 
        ? existingSlug 
        : `p-${nanoid(21)}`;

      const proposalData = {
        title: String(proposal.title || (isWebsiteOnly 
          ? `Website Design Proposal: ${formData.clientName}` 
          : `Strategic Marketing Partnership: ${formData.clientName}`)),
        client_name: formData.clientName,
        project_description: formData.projectDescription || (isWebsiteOnly 
          ? `${formData.clientName} website design project` 
          : `${formData.clientName} marketing partnership`),
        budget_range: packageData?.monthlyPrice 
          ? `$${(packageData.monthlyPrice * 12).toLocaleString()}/year`
          : isWebsiteOnly 
            ? `$${formData.selectedWebsitePackage === 'website-basic' ? '2,900' 
                : formData.selectedWebsitePackage === 'website-premium' ? '3,999' 
                : '5,999'}`
            : formData.customBudget,
        timeline: formData.timeline,
        services: packageData ? Object.keys(packageData.services).filter(
          k => packageData.services[k as keyof typeof packageData.services].included
        ) : isWebsiteOnly ? ['websiteDesign'] : [],
        content: { 
          ...(proposal as Record<string, unknown>), 
          proposalType: formData.proposalType, // Save the proposal type
          selectedPackage: packageData ? JSON.parse(JSON.stringify(packageData)) : null,
          proposalColors: {
            primary: formData.proposalPrimaryColor,
            background: formData.proposalBackgroundColor,
            text: formData.proposalTextColor || null,
            textMuted: formData.proposalTextMutedColor || null,
          },
          screenshots: branding?.screenshots || [],
          websiteUrl: formData.websiteUrl,
          seoData: seoData,
          competitiveAdAnalysis: competitiveAdAnalysis.filter(
            item => item.screenshot || item.issues.some(i => i.trim()) || item.ourSolution.trim()
          ),
          // Website Design Package
          selectedWebsitePackage: formData.selectedWebsitePackage ? {
            id: formData.selectedWebsitePackage,
            name: formData.selectedWebsitePackage === 'website-basic' ? 'Website Starter' 
                : formData.selectedWebsitePackage === 'website-premium' ? 'Premium Website' 
                : 'Ultra Premium Website',
            price: formData.selectedWebsitePackage === 'website-basic' ? 2900 
                 : formData.selectedWebsitePackage === 'website-premium' ? 3999 
                 : 5999,
            pages: formData.selectedWebsitePackage === 'website-basic' ? 'Up to 15 Pages' 
                 : formData.selectedWebsitePackage === 'website-premium' ? 'Up to 20 Pages' 
                 : 'Up to 25+ Pages',
            services: {
              seo: { included: formData.selectedWebsitePackage !== 'website-basic' },
              googleAnalytics: { included: formData.selectedWebsitePackage !== 'website-basic' },
              metaPixel: { included: formData.selectedWebsitePackage !== 'website-basic' },
              automations: { included: formData.selectedWebsitePackage === 'website-executive' },
              blogs: { 
                included: formData.selectedWebsitePackage === 'website-executive', 
                count: formData.selectedWebsitePackage === 'website-executive' ? 2 : 0 
              },
            },
          } : null,
          websiteDesign: formData.selectedWebsitePackage && proposal.websiteDesign ? {
            ...(proposal.websiteDesign as Record<string, unknown>),
            portfolioWebsites: formData.portfolioWebsites.filter(p => p.url.trim() && p.title.trim()),
          } : null,
        } as Record<string, unknown>,
        slug: slug,
        status: 'published',
      };

      let savedProposal;

      if (isEditMode && editId) {
        // Update existing proposal
        const { data: updated, error: updateError } = await supabase
          .from('proposals')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(proposalData as any)
          .eq('id', editId)
          .select()
          .single();

        if (updateError) throw updateError;
        savedProposal = updated;
        toast.success('Proposal updated!');
      } else {
        // Create new proposal
        const { data: created, error: saveError } = await supabase
          .from('proposals')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(proposalData as any)
          .select()
          .single();

        if (saveError) throw saveError;
        savedProposal = created;
        toast.success('Proposal generated!');
      }

      navigate(`/proposal/${savedProposal.slug}`);
    } catch (error) {
      console.error('Error saving proposal:', error);
      toast.error(`Failed to ${isEditMode ? 'update' : 'generate'} proposal. Please try again.`);
    }
  };

  const canProceedToStep2 = (scraped || isEditMode) && formData.clientName;
  // Validate based on proposal type
  const canGenerate = formData.clientName && (
    (formData.proposalType === 'marketing' && formData.primaryPackage) ||
    (formData.proposalType === 'website' && formData.selectedWebsitePackage) ||
    (formData.proposalType === 'combined' && formData.primaryPackage && formData.selectedWebsitePackage)
  );

  if (isLoadingProposal) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center overflow-y-auto">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading proposal...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Proposal Generation Progress Overlay */}
      {isGenerating && (
        <ProposalGenerationProgress
          progress={generationProgress}
          progressMessage={generationMessage}
          error={generationError}
          onCancel={cancelGeneration}
          onRetry={retryGeneration}
        />
      )}
      
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile Layout */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <GenieLamp size={24} />
              <span className="font-display font-semibold text-sm">
                {isEditMode ? 'Edit' : 'Builder'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile Step Dots */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      s === step ? 'bg-genie-purple' : s < step ? 'bg-genie-gold' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
              <Link
                to="/proposals"
                className="p-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
              >
                <FileText className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <GenieLamp size={28} />
              <h1 className="text-xl font-display font-semibold">
                {isEditMode ? 'Edit Proposal' : 'Melleka Marketing Proposal Builder'}
              </h1>
            </div>
            
            {/* Step Indicator */}
            <div className="ml-auto flex items-center gap-4">
              <Link
                to="/proposals"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                View All Proposals
              </Link>
              <div className="flex items-center gap-2">
                <StepIndicator step={1} currentStep={step} label="Website" />
                <div className="w-8 h-0.5 bg-border" />
                <StepIndicator step={2} currentStep={step} label="Package" />
                <div className="w-8 h-0.5 bg-border" />
                <StepIndicator step={3} currentStep={step} label="Generate" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Step 1: Website & Client Info */}
        {step === 1 && (
          <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">
                Let's Start With Their Website
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                We'll extract their branding, analyze their SEO, and personalize the proposal.
              </p>
            </div>

            {/* Website URL */}
            <section className="genie-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Client Website</h3>
              </div>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, websiteUrl: e.target.value });
                    setScraped(false);
                    setSeoData(null);
                  }}
                  placeholder="https://example.com"
                  className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50"
                />
                <button
                  onClick={() => handleScrapeWebsite()}
                  disabled={isScraping || !formData.websiteUrl}
                  className="px-6 py-3 rounded-xl bg-genie-purple text-foreground font-medium flex items-center gap-2 disabled:opacity-50 hover:bg-genie-purple-light transition-colors"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : scraped ? (
                    <>
                      <Check className="w-4 h-4" />
                      Scanned
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Analyze
                    </>
                  )}
                </button>
              </div>

              {/* Branding & SEO Preview */}
              {(branding || seoData) && (
                <div className="mt-6 space-y-4">
                  {/* Branding */}
                  {branding && (
                    <div className="p-4 rounded-xl bg-background border border-border">
                      <h4 className="text-sm font-medium text-foreground mb-3">Extracted Branding:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Logo with change option */}
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Logo</p>
                          <div className="flex items-center gap-2">
                            {branding.logo ? (
                              <img src={branding.logo} alt="Logo" className="h-10 object-contain rounded p-1" style={{ background: 'transparent' }} />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Camera className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <label className="cursor-pointer p-1.5 rounded-lg bg-genie-purple/20 hover:bg-genie-purple/30 transition-colors" title="Upload different logo">
                              <Upload className="w-4 h-4 text-genie-purple-light" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (!file.type.startsWith('image/')) {
                                    toast.error('Please select an image file');
                                    return;
                                  }
                                  if (file.size > 5 * 1024 * 1024) {
                                    toast.error('Image must be less than 5MB');
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const dataUrl = event.target?.result as string;
                                    setBranding(prev => prev ? { ...prev, logo: dataUrl } : { logo: dataUrl });
                                    toast.success('Logo updated! It will be saved when you generate the proposal.');
                                  };
                                  reader.readAsDataURL(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {branding.logo && (
                              <button 
                                onClick={() => setBranding(prev => prev ? { ...prev, logo: null } : null)}
                                className="p-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 transition-colors" 
                                title="Remove logo"
                              >
                                <X className="w-4 h-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </div>
                        {branding.colors?.primary && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Primary Color</p>
                            <div 
                              className="w-10 h-10 rounded-lg border border-border" 
                              style={{ backgroundColor: branding.colors.primary }}
                            />
                          </div>
                        )}
                        {/* Multiple Page Screenshots */}
                        {branding.screenshots && branding.screenshots.length > 0 && (
                          <div className="space-y-2 col-span-2 md:col-span-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                Page Screenshots ({branding.screenshots.filter(s => s.screenshot).length} captured)
                              </p>
                              <div className="flex items-center gap-2">
                                <select
                                  value={screenshotCount}
                                  onChange={(e) => setScreenshotCount(Number(e.target.value))}
                                  className="text-xs px-2 py-1 rounded bg-card border border-border text-foreground"
                                >
                                  <option value={6}>6 pages</option>
                                  <option value={10}>10 pages</option>
                                  <option value={15}>15 pages</option>
                                  <option value={20}>20 pages</option>
                                </select>
                                <button
                                  onClick={() => handleScrapeWebsite(screenshotCount)}
                                  disabled={isScraping}
                                  className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-genie-purple/20 text-genie-purple-light hover:bg-genie-purple/30 transition-colors disabled:opacity-50"
                                >
                                  <Camera className="w-3 h-3" />
                                  {isScraping ? 'Capturing...' : 'Retake'}
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {branding.screenshots.filter(s => s.screenshot).map((page, i) => (
                                <div key={i} className="group relative">
                                  <img 
                                    src={page.screenshot!} 
                                    alt={page.title} 
                                    className="w-full h-24 object-cover object-top rounded-lg border border-border transition-transform group-hover:scale-105 cursor-pointer"
                                    onClick={() => window.open(page.url, '_blank')}
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-lg">
                                    <p className="text-xs text-white truncate">{page.title}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Fallback to single screenshot if no array */}
                        {(!branding.screenshots || branding.screenshots.length === 0) && branding.screenshot && (
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs text-muted-foreground">Screenshot</p>
                            <img src={branding.screenshot} alt="Website" className="h-20 object-cover rounded-lg" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEO Data */}
                  {seoData && (
                    <div className="p-4 rounded-xl bg-background border border-genie-gold/30">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-genie-gold" />
                        <h4 className="text-sm font-medium text-foreground">SEO Analysis</h4>
                        {isFetchingSeo && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.organicKeywords?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Organic Keywords</p>
                        </div>
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.organicTraffic?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Monthly Traffic</p>
                        </div>
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.domainAuthority}</p>
                          <p className="text-xs text-muted-foreground">Domain Authority</p>
                        </div>
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.backlinks?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Backlinks</p>
                        </div>
                      </div>
                      
                      {seoData.topKeywords && seoData.topKeywords.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs text-muted-foreground mb-2">Top Ranking Keywords:</p>
                          <div className="flex flex-wrap gap-2">
                            {seoData.topKeywords.slice(0, 5).map((kw, i) => (
                              <span key={i} className="px-2 py-1 bg-genie-purple/20 text-genie-purple-light rounded text-xs">
                                #{kw.position} {kw.keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Proposal Colors */}
            {scraped && (
              <section className="genie-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-genie-gold" />
                  <h3 className="text-lg font-semibold text-foreground">Proposal Colors</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Customize the proposal's color scheme. Colors are auto-detected from the client's website.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.proposalPrimaryColor}
                        onChange={(e) => setFormData({ ...formData, proposalPrimaryColor: e.target.value })}
                        className="w-12 h-12 rounded-lg border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.proposalPrimaryColor}
                        onChange={(e) => setFormData({ ...formData, proposalPrimaryColor: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono"
                        placeholder="#9b87f5"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for headings, buttons, and accents</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Background Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.proposalBackgroundColor}
                        onChange={(e) => setFormData({ ...formData, proposalBackgroundColor: e.target.value })}
                        className="w-12 h-12 rounded-lg border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.proposalBackgroundColor}
                        onChange={(e) => setFormData({ ...formData, proposalBackgroundColor: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono"
                        placeholder="#1A1F2C"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Main background of the proposal</p>
                  </div>
                </div>
                
                {/* Text Color Overrides */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Text Color Overrides</h4>
                      <p className="text-xs text-muted-foreground">Leave empty for auto-contrast detection, or set manually if needed</p>
                    </div>
                    {(formData.proposalTextColor || formData.proposalTextMutedColor) && (
                      <button
                        onClick={() => setFormData({ ...formData, proposalTextColor: '', proposalTextMutedColor: '' })}
                        className="text-xs text-genie-purple hover:underline"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Main Text Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.proposalTextColor || (formData.proposalBackgroundColor && isLightColorCheck(formData.proposalBackgroundColor) ? '#1a1a2e' : '#f8fafc')}
                          onChange={(e) => setFormData({ ...formData, proposalTextColor: e.target.value })}
                          className="w-12 h-12 rounded-lg border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.proposalTextColor}
                          onChange={(e) => setFormData({ ...formData, proposalTextColor: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono"
                          placeholder="Auto-detected"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Primary body and heading text</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Muted Text Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.proposalTextMutedColor || (formData.proposalBackgroundColor && isLightColorCheck(formData.proposalBackgroundColor) ? '#4a4a5e' : '#a0a0b0')}
                          onChange={(e) => setFormData({ ...formData, proposalTextMutedColor: e.target.value })}
                          className="w-12 h-12 rounded-lg border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.proposalTextMutedColor}
                          onChange={(e) => setFormData({ ...formData, proposalTextMutedColor: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono"
                          placeholder="Auto-detected"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Secondary/subtitle text</p>
                    </div>
                  </div>
                </div>

                {/* Color Preview */}
                <div className="mt-6 p-4 rounded-xl border border-border" style={{ backgroundColor: formData.proposalBackgroundColor }}>
                  <p className="text-sm font-medium mb-1" style={{ color: formData.proposalPrimaryColor }}>
                    Preview: Accent Color
                  </p>
                  <p className="text-base font-semibold mb-1" style={{ 
                    color: formData.proposalTextColor || (isLightColorCheck(formData.proposalBackgroundColor) ? '#1a1a2e' : '#f8fafc') 
                  }}>
                    Main Text Preview
                  </p>
                  <p className="text-sm mb-3" style={{ 
                    color: formData.proposalTextMutedColor || (isLightColorCheck(formData.proposalBackgroundColor) ? 'rgba(26, 26, 46, 0.7)' : 'rgba(248, 250, 252, 0.7)') 
                  }}>
                    Muted text preview for subtitles and descriptions
                  </p>
                  <div className="flex gap-2">
                    <span 
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: formData.proposalPrimaryColor, color: formData.proposalBackgroundColor }}
                    >
                      Button Preview
                    </span>
                    <span 
                      className="px-4 py-2 rounded-lg text-sm font-medium border"
                      style={{ borderColor: formData.proposalPrimaryColor, color: formData.proposalPrimaryColor }}
                    >
                      Outline Button
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Client Name */}
            <section className="genie-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-foreground mb-4">Client Information</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Client/Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="e.g., Acme Corporation"
                    className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={formData.projectDescription}
                    onChange={(e) => setFormData({ ...formData, projectDescription: e.target.value })}
                    placeholder="Any specific goals, challenges, or notes about this client..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Next Step */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className="gold-button px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Choose Package
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
            
            {!scraped && formData.websiteUrl && (
              <p className="text-sm text-center text-genie-gold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Analyze the website first to continue
              </p>
            )}
          </div>
        )}

        {/* Step 2: Package Selection */}
        {step === 2 && (
          <div className="space-y-8">
            {/* Proposal Type Selector */}
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-card border border-border">
                {[
                  { id: 'marketing', label: 'Marketing', icon: TrendingUp, description: 'Ad campaigns, SEO, social media' },
                  { id: 'website', label: 'Website Design', icon: Globe, description: 'Custom website development' },
                  { id: 'combined', label: 'Combined', icon: Sparkles, description: 'Marketing + Website bundle' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      const updates: Partial<typeof formData> = { proposalType: type.id as 'marketing' | 'website' | 'combined' };
                      // Clear irrelevant selections when switching types
                      if (type.id === 'website') {
                        updates.primaryPackage = null;
                        updates.selectedPackages = [];
                      } else if (type.id === 'marketing') {
                        updates.selectedWebsitePackage = null;
                        updates.portfolioWebsites = [];
                      }
                      setFormData({ ...formData, ...updates });
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
                      formData.proposalType === type.id
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-3">
                {formData.proposalType === 'marketing' && 'Create a marketing-focused proposal with ad campaigns, SEO, and digital growth strategies.'}
                {formData.proposalType === 'website' && 'Create a website design proposal showcasing your portfolio and design approach.'}
                {formData.proposalType === 'combined' && 'Create a comprehensive proposal combining marketing services with a custom website.'}
              </p>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                {formData.proposalType === 'website' 
                  ? `Select Website Package for ${formData.clientName}`
                  : formData.proposalType === 'combined'
                    ? `Select Packages for ${formData.clientName}`
                    : `Select Marketing Package for ${formData.clientName}`
                }
              </h2>
              <p className="text-muted-foreground">
                {formData.proposalType === 'website' 
                  ? 'Choose the website design package that matches their project scope.'
                  : formData.proposalType === 'combined'
                    ? 'Select both marketing and website packages for a complete solution.'
                    : 'Choose the package that best fits their needs. You can compare features below.'
                }
              </p>
            </div>

            {/* Marketing Package Selector - Show for marketing and combined */}
            {(formData.proposalType === 'marketing' || formData.proposalType === 'combined') && (
              <>
                <PackageSelector
                  selectedPackages={formData.selectedPackages}
                  primaryPackage={formData.primaryPackage}
                  onSelectPackages={(packages, primary) => setFormData({ 
                    ...formData, 
                    selectedPackages: packages,
                    primaryPackage: primary
                  })}
                />

                {/* Custom Budget for Custom Package */}
                {formData.primaryPackage === 'custom' && (
                  <div className="max-w-md mx-auto genie-card p-6 rounded-2xl">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Custom Annual Budget
                    </label>
                    <input
                      type="text"
                      value={formData.customBudget}
                      onChange={(e) => setFormData({ ...formData, customBudget: e.target.value })}
                      placeholder="e.g., $500,000/year"
                      className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                )}
              </>
            )}

            {/* Website Design Package Selection - Show for website and combined */}
            {(formData.proposalType === 'website' || formData.proposalType === 'combined') && (
            <div className="max-w-4xl mx-auto genie-card p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-genie-purple" />
                <h3 className="text-lg font-medium text-foreground">
                  {formData.proposalType === 'combined' ? 'Website Design Package' : 'Select Website Package'}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {formData.proposalType === 'combined' 
                  ? `Add a website design package to complete the bundle for ${formData.clientName}.`
                  : `Choose the website design package for ${formData.clientName}.`
                }
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { id: 'website-basic', name: 'Starter', price: '$2,900', pages: '15 pages' },
                  { id: 'website-premium', name: 'Premium', price: '$3,999', pages: '20 pages + SEO' },
                  { id: 'website-executive', name: 'Executive', price: '$5,999', pages: '25+ pages + Automations' },
                ].map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setFormData({ 
                      ...formData, 
                      selectedWebsitePackage: formData.selectedWebsitePackage === pkg.id ? null : pkg.id 
                    })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      formData.selectedWebsitePackage === pkg.id 
                        ? 'border-genie-purple bg-genie-purple/10' 
                        : 'border-border hover:border-genie-purple/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">{pkg.name}</span>
                      <span className="text-genie-gold font-bold">{pkg.price}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{pkg.pages}</span>
                    {formData.selectedWebsitePackage === pkg.id && (
                      <Check className="w-5 h-5 text-genie-purple mt-2" />
                    )}
                  </button>
                ))}
              </div>

              {/* Portfolio Websites Input - Only show when website package is selected */}
              {formData.selectedWebsitePackage && (
                <div className="pt-6 border-t border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Eye className="w-5 h-5 text-genie-gold" />
                    <h4 className="font-medium text-foreground">Portfolio Showcase</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add similar websites you've built. These will be displayed as interactive previews in the proposal.
                  </p>
                  
                  {/* Portfolio entries */}
                  {formData.portfolioWebsites.map((site, idx) => (
                    <div key={idx} className="flex gap-3 mb-3">
                      <input
                        type="text"
                        value={site.url}
                        onChange={(e) => {
                          const updated = [...formData.portfolioWebsites];
                          updated[idx] = { ...updated[idx], url: e.target.value };
                          setFormData({ ...formData, portfolioWebsites: updated });
                        }}
                        placeholder="https://example.com"
                        className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm"
                      />
                      <input
                        type="text"
                        value={site.title}
                        onChange={(e) => {
                          const updated = [...formData.portfolioWebsites];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setFormData({ ...formData, portfolioWebsites: updated });
                        }}
                        placeholder="Project Name"
                        className="w-40 px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm"
                      />
                      <input
                        type="text"
                        value={site.description}
                        onChange={(e) => {
                          const updated = [...formData.portfolioWebsites];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setFormData({ ...formData, portfolioWebsites: updated });
                        }}
                        placeholder="Brief description (optional)"
                        className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm"
                      />
                      <button
                        onClick={() => {
                          const updated = formData.portfolioWebsites.filter((_, i) => i !== idx);
                          setFormData({ ...formData, portfolioWebsites: updated });
                        }}
                        className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => setFormData({
                      ...formData,
                      portfolioWebsites: [...formData.portfolioWebsites, { url: '', title: '', description: '' }]
                    })}
                    className="w-full px-4 py-2 rounded-lg border border-dashed border-genie-purple/50 text-genie-purple hover:bg-genie-purple/10 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">+</span> Add Portfolio Website
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Selected Packages Summary */}
            {formData.selectedPackages.length > 1 && (
              <div className="max-w-2xl mx-auto genie-card p-4 rounded-xl bg-genie-purple/10 border-genie-purple/30">
                <p className="text-sm text-muted-foreground mb-2">
                  Comparing {formData.selectedPackages.length} packages:
                </p>
                <div className="flex flex-wrap gap-2">
                  {formData.selectedPackages.map(id => {
                    const pkg = getPackageById(id);
                    return pkg ? (
                      <span 
                        key={id} 
                        className={`px-3 py-1 rounded-full text-sm ${
                          id === formData.primaryPackage 
                            ? 'bg-genie-gold text-genie-navy font-medium' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {pkg.name} {id === formData.primaryPackage && '(Primary)'}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl border border-border text-foreground hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={
                  (formData.proposalType === 'marketing' && !formData.primaryPackage) ||
                  (formData.proposalType === 'website' && !formData.selectedWebsitePackage) ||
                  (formData.proposalType === 'combined' && (!formData.primaryPackage || !formData.selectedWebsitePackage))
                }
                className="gold-button px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Review & Generate
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Generate */}
        {step === 3 && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                Ready to Generate
              </h2>
              <p className="text-muted-foreground">
                Review the details and generate your branded proposal.
              </p>
            </div>

            {/* Summary Card */}
            <div className="genie-card p-8 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-semibold text-foreground">Proposal Summary</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  formData.proposalType === 'website' 
                    ? 'bg-genie-purple/20 text-genie-purple-light'
                    : formData.proposalType === 'combined'
                      ? 'bg-genie-gold/20 text-genie-gold'
                      : 'bg-primary/20 text-primary'
                }`}>
                  {formData.proposalType === 'website' ? 'Website Design' 
                   : formData.proposalType === 'combined' ? 'Marketing + Website' 
                   : 'Marketing'}
                </span>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="text-lg font-semibold text-foreground">{formData.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Website</p>
                    <p className="text-foreground">{formData.websiteUrl}</p>
                  </div>
                  {/* Only show timeline for marketing proposals */}
                  {formData.proposalType !== 'website' && (
                    <div>
                      <p className="text-sm text-muted-foreground">Timeline</p>
                      <p className="text-foreground">{formData.timeline}</p>
                    </div>
                  )}
                  {/* Show delivery timeline for website proposals */}
                  {(formData.proposalType === 'website' || formData.proposalType === 'combined') && (
                    <div>
                      <p className="text-sm text-muted-foreground">Website Delivery</p>
                      <p className="text-foreground">4-6 Weeks</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {primaryPackageData ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Primary Package</p>
                        <p className="text-lg font-semibold text-genie-gold">{primaryPackageData.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Investment</p>
                        <p className="text-2xl font-bold text-foreground">
                          {primaryPackageData.monthlyPrice > 0 
                            ? `$${primaryPackageData.monthlyPrice.toLocaleString()}/mo`
                            : 'Custom'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Annual Investment</p>
                        <p className="text-foreground">
                          {primaryPackageData.monthlyPrice > 0 
                            ? `$${(primaryPackageData.monthlyPrice * 12).toLocaleString()}/year`
                            : formData.customBudget || 'To be discussed'
                          }
                        </p>
                      </div>
                    </>
                  ) : formData.selectedWebsitePackage ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Website Package</p>
                        <p className="text-lg font-semibold text-genie-gold">
                          {formData.selectedWebsitePackage === 'website-basic' ? 'Website Starter' 
                           : formData.selectedWebsitePackage === 'website-premium' ? 'Premium Website' 
                           : 'Ultra Premium Website'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">One-Time Investment</p>
                        <p className="text-2xl font-bold text-foreground">
                          ${formData.selectedWebsitePackage === 'website-basic' ? '2,900' 
                            : formData.selectedWebsitePackage === 'website-premium' ? '3,999' 
                            : '5,999'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pages Included</p>
                        <p className="text-foreground">
                          {formData.selectedWebsitePackage === 'website-basic' ? 'Up to 15 Pages' 
                           : formData.selectedWebsitePackage === 'website-premium' ? 'Up to 20 Pages' 
                           : 'Up to 25+ Pages'}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Included Services Preview */}
              {primaryPackageData ? (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Included Services:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(primaryPackageData.services)
                      .filter(([, value]) => (value as { included: boolean }).included)
                      .map(([key]) => (
                        <span key={key} className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))
                    }
                  </div>
                </div>
              ) : formData.selectedWebsitePackage ? (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Website Package Features:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Unlimited Revisions</span>
                    <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Dedicated Manager</span>
                    <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Unique Design</span>
                    <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Mobile Optimized</span>
                    {formData.selectedWebsitePackage !== 'website-basic' && (
                      <>
                        <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">SEO</span>
                        <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Google Analytics</span>
                        <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Meta Pixel</span>
                      </>
                    )}
                    {formData.selectedWebsitePackage === 'website-executive' && (
                      <>
                        <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">Automations</span>
                        <span className="px-3 py-1 bg-genie-purple/20 text-genie-purple-light rounded-full text-sm">2 Blogs Included</span>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {/* SEO Data Preview */}
              {seoData && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">SEO Data (will be included in proposal):</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.organicKeywords?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Keywords</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.organicTraffic?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Traffic</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.domainAuthority}</p>
                      <p className="text-xs text-muted-foreground">DA</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.backlinks?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Backlinks</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Competitive Ad Analysis Section - Marketing Only */}
            {formData.proposalType !== 'website' && (
              <div className="genie-card p-8 rounded-2xl">
                <CompetitiveAdAnalysis
                  items={competitiveAdAnalysis}
                  onChange={setCompetitiveAdAnalysis}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl border border-border text-foreground hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className="gold-button px-10 py-4 rounded-xl text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isEditMode ? 'Updating Proposal...' : 'Generating Proposal...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {isEditMode ? 'Update Proposal' : 'Generate Proposal'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
    </>
  );
};

const StepIndicator = ({ step, currentStep, label }: { step: number; currentStep: number; label: string }) => (
  <div className={`flex items-center gap-2 ${currentStep >= step ? 'text-foreground' : 'text-muted-foreground'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
      currentStep > step 
        ? 'bg-genie-gold text-genie-navy' 
        : currentStep === step 
          ? 'bg-genie-purple text-foreground' 
          : 'bg-muted text-muted-foreground'
    }`}>
      {currentStep > step ? <Check className="w-4 h-4" /> : step}
    </div>
    <span className="hidden sm:block text-sm font-medium">{label}</span>
  </div>
);

export default ProposalBuilder;

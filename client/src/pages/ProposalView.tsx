import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Loader2, ChevronRight, Download, TrendingUp, Target, DollarSign, Users, BarChart3, Mail, Calendar, Sparkles, Menu, PanelLeftClose, PanelLeft, Home, FileText, Map, Search, Megaphone, BarChart2, Video, MessageSquare, Clock, Heart, Phone, Layers, Zap, Globe, Shield, Palette, Smartphone, Monitor, Play, Image, CheckCircle2, ArrowRight, Camera, Mic, Star, Award, Rocket, Eye, MousePointer, ShoppingCart, LineChart as LineChartIcon, ExternalLink, PieChart as PieChartIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PieChart as PieChartComponent, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts';
import { FloatingPackageSelector } from '@/components/FloatingPackageSelector';
import { MARKETING_PACKAGES, MarketingPackage, WEBSITE_PACKAGES, WebsitePackage } from '@/data/packages';
import { AnimatedSection, AnimatedChild } from '@/components/AnimatedSection';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import mellekaLogo from '@/assets/melleka-logo.png';
import mellekaLogoDark from '@/assets/melleka-logo-dark.png';
import { CompetitiveAdDisplay, AdAnalysisItem } from '@/components/CompetitiveAdDisplay';
import { CalloutBadge, SpotlightStat, EmphasisBracket, FloatingAnnotation, PulsingIndicator, TextHighlight } from '@/components/ProposalAnnotations';
import { GoogleLogo, MetaLogo, InstagramLogo, YouTubeLogo, GoogleAnalyticsLogo, GoogleTagManagerLogo, LookerStudioLogo, SemrushLogo, PlatformBadge, PlatformLogoStrip, LinkedInLogo, XTwitterLogo, FacebookLogo, TikTokLogo, platformConfig, SocialPlatformKey, isLightColor } from '@/components/PlatformLogos';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { IndustryBenchmarkBadge } from '@/components/IndustryBenchmarkBadge';
import { AdCopyRecommendations } from '@/components/AdCopyRecommendations';
import { KeywordStrategy } from '@/components/KeywordStrategy';
import { AudienceStrategy } from '@/components/AudienceStrategy';
import { BusinessAudit } from '@/components/BusinessAudit';
import { ContentStrategy } from '@/components/ContentStrategy';
import { BudgetScalingCalculator } from '@/components/BudgetScalingCalculator';
import { AiSolutionsSection } from '@/components/AiSolutionsSection';
import { AutomationCrmSection } from '@/components/AutomationCrmSection';
import { WebsiteDesignSection } from '@/components/WebsiteDesignSection';
import { YourPackageSection, DesignProcessSection, SeoAnalyticsSection, AutomationsSection, BlogContentSection } from '@/components/WebsiteProposalSections';
import { PortfolioShowcaseSection } from '@/components/PortfolioShowcaseSection';
import { TrustBadges } from '@/components/TrustBadges';
import { ErrorBoundary, InlineErrorFallback } from '@/components/ErrorBoundary';
import { ProposalHeroSkeleton, SectionSkeleton, ChartSkeleton } from '@/components/LoadingSkeletons';
import { apiService } from '@/lib/apiService';
import { AdminEditProvider, useAdminEdit } from '@/components/editor/AdminEditContext';
import { AdminToolbar } from '@/components/editor/AdminToolbar';
import { LogoUploader } from '@/components/LogoUploader';
import { ReliableLogo } from '@/components/ReliableLogo';
import { MarketingTimelineSection } from '@/components/MarketingTimelineSection';
import { ScrollDebugOverlay } from '@/components/ScrollDebugOverlay';
import { TextingCampaignsSection } from '@/components/TextingCampaignsSection';
import { EmailCampaignsSection } from '@/components/EmailCampaignsSection';
import { MellekaAppSection } from '@/components/MellekaAppSection';

// Melleka Services - Full list of what we offer
const MELLEKA_SERVICES = [{
  icon: Search,
  name: 'Google Ads',
  description: 'Search, Shopping, Display & YouTube campaigns'
}, {
  icon: Megaphone,
  name: 'Meta Ads',
  description: 'Facebook, Instagram & Threads advertising'
}, {
  icon: TrendingUp,
  name: 'SEO',
  description: 'Technical, On-Page & Off-Page optimization'
}, {
  icon: BarChart3,
  name: 'Analytics',
  description: 'GA4, GTM & custom dashboards'
}, {
  icon: Video,
  name: 'UGC Content',
  description: 'Creator-led authentic content at scale'
}, {
  icon: MessageSquare,
  name: 'Social Media',
  description: 'Community management & content'
}, {
  icon: Mail,
  name: 'Email Marketing',
  description: 'Flows, campaigns & automation'
}, {
  icon: Palette,
  name: 'Creative Design',
  description: 'Ads, graphics & brand assets'
}, {
  icon: Globe,
  name: 'Web Development',
  description: 'Landing pages & website optimization'
}, {
  icon: Shield,
  name: 'Reputation Mgmt',
  description: 'Review management & monitoring'
}, {
  icon: Mic,
  name: 'AI Voice Agent',
  description: '24/7 intelligent call handling'
}, {
  icon: Zap,
  name: 'AI Chatbot',
  description: 'Automated customer support'
}];

// Ad creative samples with optional image support
interface ProposalContent {
  proposalType?: 'marketing' | 'website' | 'combined';
  title?: string;
  hero?: {
    headline?: string;
    subheadline?: string;
    stats?: Array<{
      value: string;
      label: string;
    }>;
    clientLogo?: string;
  };
  executiveSummary?: {
    overview?: string;
    objectives?: string[];
    approach?: string;
  };
  marketAnalysis?: {
    industry?: string;
    competitors?: string[];
    opportunities?: string[];
    challenges?: string[];
  };
  currentState?: {
    seoMetrics?: {
      keywords?: string;
      traffic?: string;
      domainAuthority?: string;
      backlinks?: string;
    };
    topKeywords?: Array<{
      keyword: string;
      position: number;
      volume: number;
      difficulty: number;
    }>;
    competitors?: Array<{
      domain: string;
      commonKeywords: number;
      relevance?: number;
      organicTraffic?: number;
    }>;
    opportunities?: string[];
    challenges?: string[];
    domain?: string;
  };
  websiteUrl?: string;
  phases?: Array<{
    number: number;
    name: string;
    duration: string;
    focus: string;
    deliverables: string[];
    milestones: string[];
  }>;
  channelStrategies?: {
    paidSearch?: {
      included: boolean;
      strategy?: string;
      tactics?: string[];
      expectedResults?: {
        impressions?: string;
        clicks?: string;
        conversions?: string;
      };
    };
    paidSocial?: {
      included: boolean;
      strategy?: string;
      tactics?: string[];
      platforms?: string[];
    };
    seo?: {
      included: boolean;
      currentPosition?: string;
      strategy?: string;
      targetKeywords?: string[];
      expectedResults?: {
        trafficIncrease?: string;
        newKeywords?: string;
        daImprovement?: string;
      };
    };
    email?: {
      included: boolean;
      strategy?: string;
      flows?: string[];
      expectedResults?: {
        openRate?: string;
        revenue?: string;
      };
    };
    social?: {
      included: boolean;
      strategy?: string;
      platforms?: string[];
      frequency?: string;
    };
  };
  packageDetails?: {
    name?: string;
    monthlyInvestment?: string;
    annualInvestment?: string;
    channels?: string;
    turnaround?: string;
    includedServices?: string[];
    teamStructure?: string[];
  };
  googleAds?: {
    budget?: string;
    strategy?: string;
    campaigns?: Array<{
      type: string;
      budget: string;
      target: string;
      kpis: string[];
    }>;
    keywords?: string[];
    expectedResults?: {
      impressions?: string;
      clicks?: string;
      conversions?: string;
      roas?: string;
    };
  };
  metaAds?: {
    budget?: string;
    strategy?: string;
    funnelStages?: Array<{
      stage: string;
      budget: string;
      tactics: string[];
    }>;
    adFormats?: string[];
    targeting?: {
      demographics?: string;
      interests?: string[];
      lookalikes?: string;
    };
    creativePillars?: string[];
  };
  seo?: {
    strategy?: string;
    technical?: string[];
    onPage?: string[];
    offPage?: string[];
    keywords?: Array<{
      keyword: string;
      volume: string;
      difficulty: string;
      priority: string;
    }>;
    contentStrategy?: string;
    expectedResults?: {
      organicTraffic?: string;
      rankings?: string;
      domainAuthority?: string;
    };
  };
  analytics?: {
    strategy?: string;
    trackingPoints?: string[];
    dashboards?: string[];
    reportingCadence?: string;
    stack?: string[];
    kpiFramework?: Array<{
      category: string;
      metrics: string[];
    }>;
  };
  ugc?: {
    strategy?: string;
    creatorTiers?: Array<{
      tier: string;
      count: string;
      budget: string;
      content: string;
    }>;
    contentPillars?: string[];
    platforms?: string[];
    annualOutput?: string;
    licensingStrategy?: string;
  };
  socialMedia?: {
    strategy?: string;
    platforms?: Array<{
      name: string;
      approach: string;
      postingFrequency: string;
      contentTypes: string[];
    }>;
    communityManagement?: string;
    brandVoice?: string;
  };
  email?: {
    strategy?: string;
    flows?: Array<{
      name: string;
      emails: number;
      purpose: string;
    }>;
    campaigns?: string;
    segmentation?: string[];
    expectedResults?: {
      openRate?: string;
      clickRate?: string;
      revenue?: string;
    };
  };
  budget?: {
    total?: string;
    breakdown?: Array<{
      category: string;
      amount: string;
      percentage: number;
    }>;
    quarterlyAllocation?: Array<{
      quarter: string;
      focus: string;
      budget: string;
    }>;
    roiProjections?: {
      expectedRevenue?: string;
      roas?: string;
      cac?: string;
      ltv?: string;
    };
  };
  timeline?: {
    duration?: string;
    phases?: Array<{
      name: string;
      duration?: string;
      milestones: string[];
      deliverables: string[];
    }>;
    keyDates?: string[];
  };
  team?: {
    structure?: string;
    members?: Array<{
      role: string;
      responsibility: string;
    }>;
  };
  whyMelleka?: {
    headline?: string;
    points?: Array<{
      title: string;
      description: string;
    }>;
    caseStudies?: Array<{
      client: string;
      result: string;
      metric: string;
    }>;
    testimonials?: Array<{
      name: string;
      company: string;
      quote: string;
      image?: string;
    }>;
  };
  trustedBy?: {
    headline?: string;
    logos?: Array<{
      name: string;
      logo: string;
    }>;
  };
  cta?: {
    headline?: string;
    subheadline?: string;
    nextSteps?: string[];
    contact?: {
      name?: string;
      email?: string;
      phone?: string;
      website?: string;
    };
    summaryStats?: Array<{
      value: string;
      label: string;
    }>;
  };
  brandStyles?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    textPrimary?: string;
    textSecondary?: string;
    logo?: string;
    ogImage?: string;
    favicon?: string;
    screenshot?: string;
  };
  screenshots?: Array<{
    url: string;
    screenshot?: string | null;
    title: string;
  }>;
  selectedPackage?: any;
  rawContent?: string;
  competitiveAdAnalysis?: AdAnalysisItem[];
  // New personalized sections
  businessAudit?: {
    currentStrengths?: string[];
    improvementOpportunities?: string[];
    competitiveGaps?: string[];
    quickWins?: string[];
  };
  adCopyRecommendations?: {
    googleAdsHeadlines?: string[];
    googleAdsDescriptions?: string[];
    metaAdPrimaryText?: string[];
    metaAdHeadlines?: string[];
    callToActions?: string[];
    hooks?: string[];
  };
  keywordStrategy?: {
    primaryKeywords?: Array<{
      keyword: string;
      intent: string;
      priority: string;
      monthlySearches: string;
      difficulty?: string;
    }>;
    longTailKeywords?: Array<{
      keyword: string;
      intent: string;
      priority: string;
      monthlySearches: string;
    }>;
    localKeywords?: string[];
    negativeKeywords?: string[];
    keywordGaps?: string[];
  };
  audienceStrategy?: {
    primaryPersona?: {
      name?: string;
      demographics?: string;
      psychographics?: string;
      painPoints?: string[];
      triggers?: string[];
      objections?: string[];
    };
    secondaryPersona?: {
      name?: string;
      demographics?: string;
      psychographics?: string;
      painPoints?: string[];
    };
    metaTargeting?: {
      interests?: string[];
      behaviors?: string[];
      customAudiences?: string[];
      lookalikeStrategy?: string;
    };
    googleAudiences?: {
      inMarket?: string[];
      affinity?: string[];
      customIntent?: string[];
    };
  };
  contentStrategy?: {
    blogTopics?: Array<{
      title: string;
      goal: string;
      priority: string;
    }>;
    videoIdeas?: Array<{
      title: string;
      platform: string;
      format: string;
    }>;
    socialPosts?: string[];
    emailSubjectLines?: string[];
  };
  websiteImprovements?: {
    conversionOptimization?: string[];
    seoFixes?: string[];
    userExperience?: string[];
    landingPageRecommendations?: string;
  };
  // AI Solutions
  aiSolutions?: {
    aiVoiceAgent?: {
      headline?: string;
      description?: string;
      features?: string[];
      useCases?: string[];
      availability?: string;
      expectedResults?: {
        callsHandled?: string;
        responseTime?: string;
        customerSatisfaction?: string;
      };
      sampleConversations?: Array<{
        scenario: string;
        conversation: Array<{
          speaker: 'caller' | 'agent';
          text: string;
        }>;
      }>;
    };
    aiChatbot?: {
      headline?: string;
      description?: string;
      features?: string[];
      platforms?: string[];
      responseExamples?: Array<{
        userMessage: string;
        botResponse: string;
      }>;
      expectedResults?: {
        conversationsHandled?: string;
        leadsCaptured?: string;
        responseTime?: string;
      };
    };
    aiToolsOnDemand?: {
      description?: string;
      tools?: string[];
      customizations?: string[];
    };
  };
  // Automation Workflows
  automationWorkflows?: {
    headline?: string;
    description?: string;
    workflows?: Array<{
      name: string;
      trigger: string;
      actions: string[];
      benefit: string;
    }>;
    integrations?: string[];
  };
  // CRM Management
  crmManagement?: {
    headline?: string;
    description?: string;
    features?: string[];
    pipeline?: Array<{
      stage: string;
      actions: string[];
    }>;
    automations?: string[];
    reporting?: string[];
    aiCapabilities?: {
      description?: string;
      features?: string[];
    };
  };
  // Text/SMS Marketing
  textMarketing?: {
    headline?: string;
    description?: string;
    campaigns?: Array<{
      type: string;
      purpose: string;
      timing: string;
    }>;
    features?: string[];
    expectedResults?: {
      openRate?: string;
      responseRate?: string;
      conversionRate?: string;
    };
    complianceNote?: string;
  };
  // Website Design Section
  websiteDesign?: {
    headline?: string;
    description?: string;
    designApproach?: {
      headline?: string;
      philosophy?: string;
      steps?: Array<{
        title: string;
        description: string;
      }>;
    };
    pages?: Array<{
      name: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    features?: Array<{
      name: string;
      description: string;
      included: boolean;
    }>;
    techStack?: {
      platform?: string;
      technologies?: string[];
      integrations?: string[];
    };
    seoFeatures?: {
      included: boolean;
      features?: string[];
    };
    analyticsSetup?: {
      included: boolean;
      tools?: string[];
    };
    automations?: {
      included: boolean;
      workflows?: string[];
    };
    timeline?: {
      discovery?: string;
      design?: string;
      development?: string;
      launch?: string;
      total?: string;
    };
    deliverables?: string[];
    portfolioWebsites?: Array<{
      url: string;
      title: string;
      description?: string;
    }>;
  };
  // Selected website package
  selectedWebsitePackage?: {
    id?: string;
    name?: string;
    price?: number;
    pages?: string;
    services?: {
      seo?: {
        included: boolean;
      };
      googleAnalytics?: {
        included: boolean;
      };
      metaPixel?: {
        included: boolean;
      };
      automations?: {
        included: boolean;
      };
      blogs?: {
        included: boolean;
        count?: number;
      };
    };
  };
  // Blog content for website proposals
  blogContent?: {
    headline?: string;
    description?: string;
    topics?: Array<{
      title: string;
      category: string;
      targetKeyword: string;
      purpose: string;
    }>;
    contentCalendar?: {
      frequency?: string;
      themes?: string[];
    };
  };
}
interface Proposal {
  id: string;
  title: string;
  client_name: string;
  project_description: string;
  content: ProposalContent;
  created_at: string;
  services: string[];
  budget_range: string;
  timeline: string;
}

// Marketing/Combined proposal navigation
// Complete Marketing Nav Items - matches exact package service mapping
const MARKETING_NAV_ITEMS = [
  { id: 'hero', label: 'Overview', icon: Home },
  { id: 'executive', label: 'Executive Summary', icon: FileText },
  { id: 'phases', label: 'Our Approach', icon: Rocket },
  { id: 'business-audit', label: 'Business Audit', icon: Target },
  { id: 'target-personas', label: 'Target Personas', icon: Users },
  { id: 'website-design', label: 'Website Design', icon: Globe },
  { id: 'google-ads', label: 'Google Ads Strategy', icon: Search },
  { id: 'meta-ads', label: 'Meta Ads Strategy', icon: Megaphone },
  { id: 'seo', label: 'SEO Strategy', icon: TrendingUp },
  { id: 'live-dashboard', label: 'Live Dashboard & Reporting', icon: BarChart3 },
  { id: 'content-strategy', label: 'Content Strategy', icon: Layers },
  { id: 'analytics', label: 'Analytics & Tracking', icon: BarChart2 },
  { id: 'social', label: 'Social Media', icon: MessageSquare },
  { id: 'email', label: 'Email Marketing', icon: Mail },
  { id: 'texting', label: 'Texting Campaigns', icon: Phone },
  { id: 'melleka-app', label: 'Melleka App', icon: Smartphone },
  { id: 'reputation', label: 'Reputation Management', icon: Star },
  { id: 'ai-solutions', label: 'AI Solutions', icon: Sparkles },
  { id: 'automation-crm', label: 'Automation & CRM', icon: Zap },
  { id: 'influencer', label: 'Influencer & UGC', icon: Users },
  { id: 'tv-ads', label: 'Television Ads', icon: Monitor },
  { id: 'budget', label: 'Investment', icon: DollarSign },
  { id: 'timeline', label: 'Project Timeline', icon: Clock },
  { id: 'cta', label: 'Next Steps', icon: Target },
];

// Website-only proposal navigation - clean and focused
const WEBSITE_NAV_ITEMS = [{
  id: 'hero',
  label: 'Overview',
  icon: Home
}, {
  id: 'your-package',
  label: 'Your Investment',
  icon: DollarSign
}, {
  id: 'design-process',
  label: 'Our Process',
  icon: Palette
}, {
  id: 'seo-analytics',
  label: 'SEO & Analytics',
  icon: BarChart2
}, {
  id: 'automations',
  label: 'Automations',
  icon: Zap
}, {
  id: 'blog-content',
  label: 'Blog Content',
  icon: FileText
}, {
  id: 'portfolio',
  label: 'Our Work',
  icon: Monitor
}, {
  id: 'cta',
  label: 'Next Steps',
  icon: Target
}];

// Melleka testimonials
const TESTIMONIALS = [{
  name: 'William Holland',
  company: 'Holland Enterprises',
  quote: 'Melleka transformed our digital presence completely. We saw a 340% increase in qualified leads within the first quarter.',
  image: 'https://randomuser.me/api/portraits/men/32.jpg',
  result: '340% more leads'
}, {
  name: 'Joe Turk',
  company: 'Turk Industries',
  quote: 'The ROI we\'ve seen with Melleka has been phenomenal. Their data-driven approach and dedicated team made all the difference.',
  image: 'https://randomuser.me/api/portraits/men/45.jpg',
  result: '5.2x ROAS'
}, {
  name: 'Sarah Chen',
  company: 'Chen Digital',
  quote: 'From strategy to execution, Melleka delivers. Our organic traffic increased by 280% and our brand is now a market leader.',
  image: 'https://randomuser.me/api/portraits/women/44.jpg',
  result: '280% traffic growth'
}];

// Inner component that uses the admin edit context
const ProposalViewInner = () => {
  const {
    slug
  } = useParams();
  const navigate = useNavigate();
  const {
    isAdmin
  } = useAuth();
  const {
    isAdminVerified
  } = useAdminEdit();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('hero');
  const [selectedPackage, setSelectedPackage] = useState<MarketingPackage | null>(null);
  const [selectedWebsitePackage, setSelectedWebsitePackage] = useState<WebsitePackage | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveSeoData, setLiveSeoData] = useState<{
    seoMetrics?: {
      keywords?: string;
      traffic?: string;
      domainAuthority?: string;
      backlinks?: string;
    };
    topKeywords?: Array<{
      keyword: string;
      position: number;
      volume: number;
      difficulty: number;
    }>;
    competitors?: Array<{
      domain: string;
      commonKeywords: number;
      relevance?: number;
      organicTraffic?: number;
    }>;
    keywordGap?: Array<{
      keyword: string;
      competitorPosition: number;
      volume: number;
      difficulty: number;
      competitorDomain: string;
    }>;
    lastUpdated?: string;
    domain?: string;
  } | null>(null);
  const [isFetchingSeo, setIsFetchingSeo] = useState(false);
const [seoSearchDomain, setSeoSearchDomain] = useState('');
  const [debugEnabled, setDebugEnabled] = useState(false);
  const scrollLockRef = useRef<{ targetId: string; until: number } | null>(null);
  const scrollAnimFrameRef = useRef<number | null>(null);

  const NAV_SCROLL_OFFSET = 120;
  const NEAR_BOTTOM_OFFSET = 200;
  
  // Enable debug mode via ?debug=1 query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      setDebugEnabled(true);
    }
  }, []);

  // Scroll to top when proposal loads
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    });
  }, []);
  useEffect(() => {
    const fetchProposal = async () => {
      if (!slug) return;
      const {
        data,
        error
      } = await supabase.from('proposals').select('*').eq('slug', slug).maybeSingle();
      if (error) {
        console.error('Error fetching proposal:', error);
        toast.error('Failed to load proposal');
      } else if (!data) {
        toast.error('Proposal not found');
        navigate('/');
      } else {
        setProposal(data as Proposal);
        // Ensure we're at the top after data loads
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
      }
      setLoading(false);
    };
    fetchProposal();
  }, [slug, navigate]);

  // Initialize selected package from proposal
  useEffect(() => {
    if (proposal?.content?.selectedPackage) {
      const pkg = MARKETING_PACKAGES.find(p => p.id === proposal.content.selectedPackage?.id);
      if (pkg) setSelectedPackage(pkg);
    }
    // Initialize website package
    if (proposal?.content?.selectedWebsitePackage) {
      const websitePkgId = proposal.content.selectedWebsitePackage?.id;
      const pkg = WEBSITE_PACKAGES.find(p => p.id === websitePkgId);
      if (pkg) setSelectedWebsitePackage(pkg);
    }
  }, [proposal]);

  // Pre-fill SEO search with client's website URL and auto-fetch
  useEffect(() => {
    if (proposal) {
      const websiteUrl = proposal.content?.websiteUrl || proposal.content?.currentState?.domain;
      if (websiteUrl) {
        const cleanDomain = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!seoSearchDomain) {
          setSeoSearchDomain(cleanDomain);
        }
        // Auto-fetch SEO data on load (only if not already fetched)
        if (!liveSeoData && !isFetchingSeo) {
          fetchLiveSeoData(cleanDomain);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id]);

  // Bulletproof scroll-spy (single source of truth): determine active section by
  // the last section whose top has crossed the header offset line.
  useEffect(() => {
    if (!proposal) return;
    
    // Determine which nav items to use based on proposal type
    const isWebsiteOnlyCheck = proposal.content?.proposalType === 'website';
    const allNavItems = isWebsiteOnlyCheck ? WEBSITE_NAV_ITEMS : MARKETING_NAV_ITEMS;
    // Keep scroll tracking perfectly in sync with what the sidebar is actually rendering.
    // (Fallback to the full list if, for any reason, the visible list is not available.)
    const trackedNavItems = (Array.isArray(visibleNavItems) && visibleNavItems.length > 0)
      ? visibleNavItems
      : allNavItems;
    
    // IMPORTANT: sections can mount/unmount after initial render (package switching,
    // async content, admin edits). To prevent skipped sections (e.g. live-dashboard),
    // we resolve + order the tracked sections dynamically on each scroll tick.
    const getExistingSections = (scrollY: number) => {
      const seen = new Set<string>();
      const sections: Array<{ id: string; absTop: number }> = [];

      for (const item of trackedNavItems) {
        const id = item.id;
        if (seen.has(id)) continue;
        const el = document.getElementById(id);
        if (!el) continue;
        seen.add(id);

        sections.push({
          id,
          absTop: el.getBoundingClientRect().top + scrollY,
        });
      }

      // Order by actual page position, not assumed nav order.
      sections.sort((a, b) => a.absTop - b.absTop);
      return sections;
    };
    
    const handleScroll = () => {
      // If we're in the middle of a programmatic scroll (nav click), keep the
      // highlight locked to the intended target to avoid flicker/jumps.
      const now = performance.now();
      if (scrollLockRef.current) {
        if (now < scrollLockRef.current.until) {
          setActiveSection(scrollLockRef.current.targetId);
          return;
        }
        scrollLockRef.current = null;
      }

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      const existingSections = getExistingSections(scrollY);
      if (existingSections.length === 0) return;

      // Check if we're near the bottom of the page
      const isNearBottom = scrollY + viewportHeight >= documentHeight - NEAR_BOTTOM_OFFSET;

      // If near bottom, force the final section to stay active.
      if (isNearBottom) {
        setActiveSection(existingSections[existingSections.length - 1].id);
        return;
      }

      // Bulletproof selection: choose the section whose top is closest to the
      // header line (preferring sections that have already crossed it).
      const line = NAV_SCROLL_OFFSET + 1;
      let bestCrossedId = existingSections[0].id;
      let bestCrossedTop = -Infinity;
      let bestFutureId = existingSections[0].id;
      let bestFutureTop = Infinity;

      for (const section of existingSections) {
        const top = section.absTop - scrollY;
        if (top <= line && top > bestCrossedTop) {
          bestCrossedTop = top;
          bestCrossedId = section.id;
        }
        if (top > line && top < bestFutureTop) {
          bestFutureTop = top;
          bestFutureId = section.id;
        }
      }

      setActiveSection(bestCrossedTop !== -Infinity ? bestCrossedId : bestFutureId);
    };

    // Throttle scroll handler for performance
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', throttledScroll, {
      passive: true
    });

    window.addEventListener('resize', throttledScroll, { passive: true });

    // Initial check after a small delay to ensure DOM is rendered
    const timeoutId = setTimeout(() => handleScroll(), 100);
    return () => {
      window.removeEventListener('scroll', throttledScroll);
      window.removeEventListener('resize', throttledScroll);
      clearTimeout(timeoutId);
    };
  }, [proposal, selectedPackage?.id, selectedWebsitePackage?.id]);
  const handlePackageChange = (pkg: MarketingPackage) => {
    setSelectedPackage(pkg);
    toast.success(`Viewing ${pkg.name} package`, {
      description: `$${pkg.monthlyPrice.toLocaleString()}/month • ${pkg.channels}`
    });
  };
  const handleWebsitePackageChange = (pkg: WebsitePackage) => {
    // Update selected website package state for dynamic rendering
    setSelectedWebsitePackage(pkg);
    toast.success(`Viewing ${pkg.name}`, {
      description: `$${pkg.price.toLocaleString()} • ${pkg.pages}`
    });
  };
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };
  const scrollToSection = useCallback((id: string) => {
    // Immediately set active section for instant visual feedback
    setActiveSection(id);

    // Close mobile menu if open
    setMobileMenuOpen(false);

    // Scroll to section with bounce effect
    const element = document.getElementById(id);
    if (element) {
      // Cancel any in-flight scroll animation
      if (scrollAnimFrameRef.current) {
        cancelAnimationFrame(scrollAnimFrameRef.current);
        scrollAnimFrameRef.current = null;
      }

      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const targetPosition = element.getBoundingClientRect().top + window.scrollY - NAV_SCROLL_OFFSET;
      const startPosition = window.scrollY;
      const distance = targetPosition - startPosition;
      const duration = prefersReducedMotion ? 1 : 650; // ms - faster for smoother feel
      let startTime: number | null = null;

      // Lock highlight during the click-scroll to prevent any mid-animation jumps.
      scrollLockRef.current = { targetId: id, until: performance.now() + duration + 120 };

      if (prefersReducedMotion) {
        window.scrollTo(0, targetPosition);
        return;
      }

      // Smooth easing without bounce - easeOutQuart for elegant deceleration
      const easeOutQuart = (t: number): number => {
        return 1 - Math.pow(1 - t, 4);
      };

      const animateScroll = (currentTime: number) => {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        
        const easedProgress = easeOutQuart(progress);
        window.scrollTo(0, startPosition + distance * easedProgress);

        if (timeElapsed < duration) {
          scrollAnimFrameRef.current = requestAnimationFrame(animateScroll);
        } else {
          scrollAnimFrameRef.current = null;
        }
      };

      scrollAnimFrameRef.current = requestAnimationFrame(animateScroll);
    }
  }, []);

  // Fetch live SEO data from Semrush
  const fetchLiveSeoData = async (domainToSearch?: string) => {
    const websiteUrl = domainToSearch || seoSearchDomain.trim();
    if (!websiteUrl) {
      toast.error('Please enter a domain to analyze');
      return;
    }
    setIsFetchingSeo(true);
    try {
      const {
        data,
        error,
        cached
      } = await apiService.getSeoData(websiteUrl, attempt => toast.info(`Retrying SEO data fetch (attempt ${attempt + 1})...`));
      if (error) throw new Error(error.message);
      if (!data) throw new Error('No SEO data returned');
      if (cached) {
        toast.info('Using cached SEO data');
      }
      if (data.success) {
        setLiveSeoData({
          seoMetrics: {
            keywords: data.data.organicKeywords?.toLocaleString() || '0',
            traffic: data.data.organicTraffic?.toLocaleString() || '0',
            domainAuthority: data.data.domainAuthority?.toString() || '0',
            backlinks: data.data.backlinks?.toLocaleString() || '0'
          },
          topKeywords: data.data.topKeywords || [],
          competitors: data.data.competitors || [],
          keywordGap: data.data.keywordGap || [],
          lastUpdated: new Date().toLocaleString(),
          domain: websiteUrl
        });
        if (data.isMock) {
          toast.info('Using estimated SEO data (Semrush API key needed for real data)');
        } else if (!cached) {
          toast.success(`SEO data loaded for ${websiteUrl}`);
        }
      }
    } catch (error) {
      console.error('Error fetching live SEO data:', error);
      toast.error('Failed to fetch SEO data');
    } finally {
      setIsFetchingSeo(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background">
        <ProposalHeroSkeleton />
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          <SectionSkeleton rows={3} />
          <ChartSkeleton />
          <SectionSkeleton rows={4} />
        </div>
      </div>;
  }
  if (!proposal) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <InlineErrorFallback message="Proposal not found or failed to load" onRetry={() => window.location.reload()} />
      </div>;
  }
  const rawContent = proposal.content;

  // Enrich audience strategy with intelligent defaults if missing metaTargeting/googleAudiences
  const enrichAudienceStrategy = (audience: any, clientName: string, industry?: string): any => {
    if (!audience) return audience;
    const ind = industry || 'General';
    const existing = {
      ...audience
    };

    // If metaTargeting is missing or empty, generate from existing data
    if (!existing.metaTargeting || !existing.metaTargeting.interests?.length) {
      // Extract interests from customIntentKeywords or generate from industry
      const customKeywords = existing.customIntentKeywords || [];
      const lookalikeSources = existing.lookalikeSources || [];
      existing.metaTargeting = {
        interests: customKeywords.length > 0 ? customKeywords.slice(0, 10) : [`${ind} solutions`, `${ind} services`, "Business decision makers", "Technology enthusiasts", "Professional development", "Industry trends", "Enterprise software", "Digital transformation"],
        behaviors: ["Engaged shoppers", "Technology early adopters", "Business page admins", "Active online purchasers", "Research-focused buyers", "Professional networking"],
        customAudiences: lookalikeSources.length > 0 ? lookalikeSources.map((s: string) => `Lookalike: ${s}`) : ["Website visitors - Last 30 days", "Email subscriber list", "Video viewers - 50%+ watched", "Lead form engagers", "Content downloaders"],
        lookalikeStrategy: `Create 1% lookalike from highest-value customers for precision targeting, 3-5% from engaged website visitors for scale. Layer with ${ind.toLowerCase()} interest targeting for optimal reach.`
      };
    }

    // If googleAudiences is missing or empty, generate intelligent defaults
    if (!existing.googleAudiences || !existing.googleAudiences.inMarket?.length) {
      const customIntentBase = existing.metaTargeting?.interests || [];
      existing.googleAudiences = {
        inMarket: [`${ind} software`, `${ind} solutions`, "Business services", "Enterprise technology", "Professional services", "SaaS platforms"],
        affinity: ["Business professionals", "Technology enthusiasts", "Value shoppers", "Research-driven buyers", "Productivity focused", "Innovation seekers"],
        customIntent: customIntentBase.length > 0 ? customIntentBase.slice(0, 10) : [`${ind.toLowerCase()} solutions`, `best ${ind.toLowerCase()} tools`, `${ind.toLowerCase()} comparison`, `${ind.toLowerCase()} pricing`, `${ind.toLowerCase()} reviews`, `enterprise ${ind.toLowerCase()}`, `${ind.toLowerCase()} vendors`, `${ind.toLowerCase()} platforms`]
      };
    }

    // Ensure primaryPersona has psychographics and triggers
    if (existing.primaryPersona) {
      if (!existing.primaryPersona.psychographics && existing.primaryPersona.painPoints?.length) {
        existing.primaryPersona.psychographics = `"${existing.primaryPersona.painPoints[0]} - I need a solution I can trust and that delivers real results."`;
      }
      if (!existing.primaryPersona.triggers && existing.primaryPersona.painPoints?.length) {
        existing.primaryPersona.triggers = existing.primaryPersona.painPoints.slice(0, 4).map((p: string) => p.replace(/^(Fear of |Inability to |Risk of |Difficulty )/i, 'When '));
      }
    }

    // Ensure secondaryPersona has psychographics
    if (existing.secondaryPersona && !existing.secondaryPersona.psychographics && existing.secondaryPersona.painPoints?.length) {
      existing.secondaryPersona.psychographics = `"${existing.secondaryPersona.painPoints[0]} - I need guidance to make the right decision."`;
    }
    return existing;
  };

  // Apply enrichment to content
  const content: ProposalContent = {
    ...rawContent,
    audienceStrategy: enrichAudienceStrategy(rawContent.audienceStrategy, proposal.client_name, (rawContent as any).detectedIndustry || rawContent.marketAnalysis?.industry)
  };
  const brandColors = content.brandStyles || {};
  const proposalColors = (content as any).proposalColors || {};

  // Use proposalColors (user-customized) first, then brandStyles, then defaults
  const primaryColor = proposalColors.primary || brandColors.primaryColor || 'hsl(var(--genie-purple))';
  // Secondary color: use stored value, or derive from primary (lighter/shifted version), fallback to primary
  const secondaryColor = proposalColors.secondary || brandColors.secondaryColor || primaryColor;
  const accentColor = brandColors.accentColor || primaryColor;
  const backgroundColor = proposalColors.background || brandColors.backgroundColor || 'hsl(var(--background))';

  // Helper function to determine if a color is light or dark
  const isLightColor = (color: string): boolean => {
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
    // Handle hsl
    if (color.startsWith('hsl')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const l = parseInt(match[2]);
        return l > 50;
      }
    }
    // Default to dark background
    return false;
  };
  const isLightBackground = isLightColor(backgroundColor);

  // Use manually set text colors if provided, otherwise auto-detect based on background
  const textColor = proposalColors.text || (isLightBackground ? '#1a1a2e' : '#f8fafc');
  const textMutedColor = proposalColors.textMuted || (isLightBackground ? 'rgba(26, 26, 46, 0.7)' : 'rgba(248, 250, 252, 0.7)');

  // Premium glass effect - subtle on light backgrounds, DEEP glassmorphism on dark
  const cardBackground = isLightBackground ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 15, 35, 0.6)'; // Deeper dark glass
  const borderColor = isLightBackground ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
  const glassBackground = isLightBackground ? 'rgba(255, 255, 255, 0.98)' : 'rgba(20, 20, 50, 0.7)'; // Deeper glass for dark mode
  const glassShadow = isLightBackground ? '0 4px 24px rgba(0, 0, 0, 0.04)' : `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px ${primaryColor}15`;

  // NEON GLOW EFFECTS - Only active on dark backgrounds
  const neonGlow = !isLightBackground ? {
    primary: `0 0 20px ${primaryColor}60, 0 0 40px ${primaryColor}30, 0 0 60px ${primaryColor}15`,
    secondary: `0 0 20px ${secondaryColor}60, 0 0 40px ${secondaryColor}30, 0 0 60px ${secondaryColor}15`,
    accent: `0 0 20px ${accentColor}60, 0 0 40px ${accentColor}30, 0 0 60px ${accentColor}15`,
    text: `0 0 10px ${primaryColor}40`,
    border: `0 0 15px ${primaryColor}20`,
    subtle: `0 0 30px ${primaryColor}10`
  } : {
    primary: 'none',
    secondary: 'none',
    accent: 'none',
    text: 'none',
    border: 'none',
    subtle: 'none'
  };

  // Neon border gradients for dark mode
  const neonBorderStyle = !isLightBackground ? `1px solid color-mix(in srgb, ${primaryColor} 40%, transparent)` : `1px solid ${borderColor}`;

  // Deep glassmorphism card style for dark mode
  const deepGlassCard = !isLightBackground ? {
    background: `linear-gradient(145deg, rgba(20, 20, 50, 0.8), rgba(10, 10, 30, 0.6))`,
    backdropFilter: 'blur(20px)',
    border: `1px solid color-mix(in srgb, ${primaryColor} 25%, rgba(255,255,255,0.1))`,
    boxShadow: `0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05), ${neonGlow.subtle}`
  } : {
    background: cardBackground,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${borderColor}`,
    boxShadow: glassShadow
  };

  // Alternating section glass overlay for visual separation
  const glassSectionStyle = isLightBackground ? {
    background: 'rgba(0, 0, 0, 0.02)',
    borderTop: '1px solid rgba(0, 0, 0, 0.04)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)'
  } : {
    background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(15, 15, 40, 0.2) 100%)',
    borderTop: `1px solid color-mix(in srgb, ${primaryColor} 15%, rgba(255,255,255,0.05))`,
    borderBottom: `1px solid color-mix(in srgb, ${secondaryColor} 10%, rgba(255,255,255,0.03))`,
    boxShadow: `inset 0 0 100px rgba(0,0,0,0.2)`
  };

  // Determine proposal type - use explicit type if set, otherwise infer from packages
  const proposalType: 'marketing' | 'website' | 'combined' = content.proposalType || (content.selectedWebsitePackage && !content.selectedPackage ? 'website' : content.selectedWebsitePackage && content.selectedPackage ? 'combined' : 'marketing');
  const isWebsiteOnly = proposalType === 'website';
  const isMarketing = proposalType === 'marketing';
  const isCombined = proposalType === 'combined';

  // Use the selected website package from state, or fall back to proposal content
  const displayWebsitePackage = selectedWebsitePackage || (content.selectedWebsitePackage?.id ? WEBSITE_PACKAGES.find(p => p.id === content.selectedWebsitePackage?.id) : null);

  // Website hero copy (override AI marketing phrasing for website-only proposals)
  const websitePkg = displayWebsitePackage;
  const websiteHeroHeadline = `Premium Website Design For`;
  const websiteHeroSubheadline = [`Includes unlimited revisions, a dedicated manager, and a unique custom design: ${websitePkg?.pages || 'Up to 15 Pages'}.`, websitePkg?.services?.seo?.included ? 'SEO foundations included.' : null, websitePkg?.services?.googleAnalytics?.included ? 'Google Analytics setup included.' : null, websitePkg?.services?.metaPixel?.included ? 'Meta Pixel setup included.' : null, websitePkg?.services?.automations?.included ? 'Automations included to streamline leads & follow-up.' : null, websitePkg?.services?.blogs?.included ? `${websitePkg?.services?.blogs?.count || 2} SEO blog posts included.` : null].filter(Boolean).join('\n');

  // Get nav items based on proposal type - completely separate for website vs marketing
  const getFilteredNavItems = () => {
    if (isWebsiteOnly) {
      // Website-only: use dedicated website navigation with dynamic package
      return WEBSITE_NAV_ITEMS.filter(item => {
        // Only show SEO & Analytics if included in package
        if (item.id === 'seo-analytics') {
          return displayWebsitePackage?.services?.seo?.included || displayWebsitePackage?.services?.googleAnalytics?.included;
        }
        // Only show Automations if included in package
        if (item.id === 'automations') {
          return displayWebsitePackage?.services?.automations?.included;
        }
        // Only show Blog Content if included in package
        if (item.id === 'blog-content') {
          return displayWebsitePackage?.services?.blogs?.included;
        }
        return true;
      });
    }
    // Marketing or Combined: use marketing navigation
    return MARKETING_NAV_ITEMS.filter(item => {
      if (item.id === 'website-design') {
        return !!displayWebsitePackage;
      }
      return true;
    });
  };
  const filteredNavItems = getFilteredNavItems();

  // Get current package details
  const currentPackageId = content.selectedPackage?.id;
  const displayPackage = selectedPackage || (currentPackageId ? MARKETING_PACKAGES.find(p => p.id === currentPackageId) : null);

  // Calculate package-based pricing
  const monthlyInvestment = displayPackage?.monthlyPrice || 0;
  const annualInvestment = monthlyInvestment * 12;

  // Website package pricing - use dynamic package
  const websitePackagePrice = displayWebsitePackage?.price || 0;

  // Dynamic budget breakdown based on selected package
  const getDynamicBudgetBreakdown = () => {
    if (!displayPackage) return content.budget?.breakdown || [];
    const services = displayPackage.services;
    const breakdown: Array<{
      category: string;
      amount: string;
      percentage: number;
    }> = [];

    // Calculate percentages based on included services
    const includedServices = [];
    if (services.channels?.included) includedServices.push({
      name: 'Paid Advertising',
      weight: 35
    });
    if (services.seo?.included) includedServices.push({
      name: 'SEO & Content',
      weight: 20
    });
    if (services.analytics?.included) includedServices.push({
      name: 'Analytics & Reporting',
      weight: 10
    });
    if (services.socialMediaManagement?.included) includedServices.push({
      name: 'Social Media',
      weight: 15
    });
    if (services.emailCampaigns?.included) includedServices.push({
      name: 'Email Marketing',
      weight: 10
    });
    if (services.ugcContent?.included) includedServices.push({
      name: 'UGC & Content Creation',
      weight: 15
    });
    if (services.aiVoiceAgent?.included || services.aiChatBot?.included) includedServices.push({
      name: 'AI Tools',
      weight: 10
    });
    if (services.reputationManagement?.included) includedServices.push({
      name: 'Reputation Management',
      weight: 5
    });

    // Normalize percentages
    const totalWeight = includedServices.reduce((sum, s) => sum + s.weight, 0);
    includedServices.forEach(service => {
      const percentage = Math.round(service.weight / totalWeight * 100);
      const amount = Math.round(percentage / 100 * monthlyInvestment);
      breakdown.push({
        category: service.name,
        amount: `$${amount.toLocaleString()}`,
        percentage
      });
    });
    return breakdown;
  };
  const dynamicBudgetBreakdown = getDynamicBudgetBreakdown();

  // Budget pie chart data - now dynamic with brand-cohesive colors
  const budgetChartData = dynamicBudgetBreakdown.map((item, i) => ({
    name: item.category,
    value: item.percentage,
    // Use primary, secondary, and complementary shades - no random colors
    color: [primaryColor, secondaryColor, `color-mix(in srgb, ${primaryColor} 60%, ${secondaryColor})`, `color-mix(in srgb, ${secondaryColor} 70%, white)`, `color-mix(in srgb, ${primaryColor} 40%, white)`, `color-mix(in srgb, ${primaryColor} 80%, black)`][i % 6]
  }));

  // Dynamic ROI projections based on package tier
  const getDynamicRoiProjections = () => {
    if (!displayPackage) return content.budget?.roiProjections;
    const tier = displayPackage.tier;
    const multiplier = tier <= 2 ? 1 : tier <= 4 ? 1.5 : 2;
    return {
      expectedRevenue: `$${Math.round(monthlyInvestment * 3 * multiplier).toLocaleString()}-${Math.round(monthlyInvestment * 5 * multiplier).toLocaleString()}/mo`,
      roas: `${(2 + tier * 0.5).toFixed(1)}x`,
      cac: `$${Math.round(150 - tier * 15)}`,
      ltv: `$${Math.round(500 + tier * 100).toLocaleString()}`
    };
  };
  const dynamicRoiProjections = getDynamicRoiProjections();

  // Dynamic hero stats based on package and proposal type
  const getDynamicHeroStats = () => {
    // For marketing proposals with a selected package
    if (displayPackage) {
      return [{
        value: `$${displayPackage.monthlyPrice.toLocaleString()}`,
        label: 'Monthly Investment'
      }, {
        value: displayPackage.channels,
        label: 'Marketing Channels'
      }, {
        value: displayPackage.turnaround,
        label: 'Task Turnaround'
      }];
    }

    // For website-only proposals, use the dynamic website package
    if (isWebsiteOnly && displayWebsitePackage) {
      return [{
        value: `$${displayWebsitePackage.price.toLocaleString()}`,
        label: 'Project Investment'
      }, {
        value: displayWebsitePackage.pages,
        label: 'Website Pages'
      }, {
        value: '4-6 Weeks',
        label: 'Delivery Timeline'
      }];
    }

    // Fallback for website proposals without displayWebsitePackage
    if (isWebsiteOnly) {
      return [{
        value: '$2,900',
        label: 'Project Investment'
      }, {
        value: 'Up to 15',
        label: 'Website Pages'
      }, {
        value: '4-6 Weeks',
        label: 'Delivery Timeline'
      }];
    }

    // Fallback to AI-generated stats, but filter out $0 values
    const heroStats = content.hero?.stats || [];
    return heroStats.filter(stat => !stat.value.includes('$0'));
  };
  const dynamicHeroStats = getDynamicHeroStats();

  // Dynamic CTA summary stats - show different info than hero to avoid redundancy
  // Hero shows: Investment, Channels, Turnaround
  // CTA shows: condensed action-focused summary
  const dynamicCtaStats = displayPackage ? [{
    value: displayPackage.name,
    label: 'Your Package'
  }, {
    value: displayPackage.channels,
    label: 'Full Coverage'
  }, {
    value: 'Ready to Start',
    label: 'Onboarding'
  }] : content.cta?.summaryStats || [];

  // Determine which sections to show based on selected marketing package
  // This is STRICTLY tied to package services - sections only appear if included
  const packageServices = displayPackage?.services;
  const packageTier = displayPackage?.tier || 0;

  // EXACT PACKAGE SERVICE MAPPING:
  // Basic Silver (tier 1): 1 channel, monthly optimization, basic setup, online listing ONLY
  // Basic Gold (tier 2): 2 channels, bi-weekly meetings, slack, weekly opt, advanced setup/content/analytics, basic SEO/workflow/website, audit, sales/marketing consultation
  // Advanced Silver (tier 3): 3 channels, weekly meetings, daily opt, advanced SEO/website, landing pages, funnels, advanced workflow, email/texting, A/B tests, creatives, live dashboard, dedicated team, social media, 1hr extra tasks
  // Advanced Gold (tier 4): 4 channels, 2-3 day turnaround, reputation mgmt, AI voice agent, AI chatbot, 2hrs extra tasks
  // Premium Silver (tier 5): Omni-channel, 1hr meetings, UGC (2), influencer, TV ads, automated systems, automated CRM, experience consultation, 3hrs extra tasks
  // Premium Gold (tier 6): 1.5hr meetings, in-person content, UGC (3), AI CRM Manager, AI tools on-demand, 5hrs extra tasks

  // Google Ads - available in ALL tiers (at least 1 channel)
  const showGoogleAds = !isWebsiteOnly && (packageServices?.channels?.included ?? true);
  
  // Meta Ads - requires 2+ channels (Basic Gold+, tier >= 2)
  const showMetaAds = !isWebsiteOnly && packageTier >= 2 && (packageServices?.channels?.included ?? false);
  
  // SEO - Basic Gold+ (tier >= 2) - uses package flag OR content existence
  const showSeo = !isWebsiteOnly && (packageServices?.seo?.included || !!content.seo);
  
  // Analytics - Basic Gold+ (tier >= 2) - uses package flag OR content existence
  const showAnalytics = !isWebsiteOnly && (packageServices?.analytics?.included || !!content.analytics);
  
  // Email Campaigns - Advanced Silver+ (tier >= 3)
  const showEmail = !isWebsiteOnly && (packageServices?.emailCampaigns?.included ?? false);
  
  // Texting Campaigns - Advanced Silver+ (tier >= 3) - separate section
  const showTexting = !isWebsiteOnly && (packageServices?.textingCampaigns?.included ?? false);
  
  // Social Media Management - Advanced Silver+ (tier >= 3)
  const showSocialMedia = !isWebsiteOnly && (packageServices?.socialMediaManagement?.included ?? false);
  
  // Reputation Management - Advanced Gold+ (tier >= 4)
  const showReputationManagement = !isWebsiteOnly && (packageServices?.reputationManagement?.included ?? false);
  
  // AI Voice Agent & AI Chat Bot - Advanced Gold+ (tier >= 4)
  const showAiFeatures = !isWebsiteOnly && (packageServices?.aiVoiceAgent?.included || packageServices?.aiChatBot?.included);
  
  // Automation & CRM - Premium Silver+ (tier >= 5) for full automation systems
  const showAutomationCrm = !isWebsiteOnly && (
    packageServices?.automatedSystems?.included || 
    packageServices?.automatedCRM?.included
  );
  
  // UGC Content - Premium Silver+ (tier >= 5)
  const showUgc = !isWebsiteOnly && (packageServices?.ugcContent?.included ?? false);
  
  // Influencer Marketing - Premium Silver+ (tier >= 5)
  const showInfluencer = !isWebsiteOnly && (packageServices?.influencerMarketing?.included ?? false);
  
  // Television Ads - Premium Silver+ (tier >= 5)
  const showTvAds = !isWebsiteOnly && (packageServices?.televisionAds?.included ?? false);
  
  // Dedicated Team - Advanced Silver+ (tier >= 3)
  const showDedicatedTeam = packageServices?.dedicatedTeam?.included ?? false;
  
  // Live Dashboard - Advanced Silver+ (tier >= 3)
  const showLiveDashboard = !isWebsiteOnly && (packageServices?.liveDashboard?.included ?? false);
  
  // Website Design section - only if website package selected
  const showWebsiteDesign = !!displayWebsitePackage;

  // Get base package for comparison (to detect newly added sections on upgrade)
  const basePackageId = content.selectedPackage?.id;
  const baseMarketingPackage = basePackageId ? MARKETING_PACKAGES.find(p => p.id === basePackageId) : null;

  // Filter NAV_ITEMS based on package and proposal type - COMPLETE mapping
  const visibleNavItems = filteredNavItems.filter(item => {
    if (item.id === 'google-ads') return showGoogleAds;
    if (item.id === 'meta-ads') return showMetaAds;
    if (item.id === 'seo') return showSeo;
    if (item.id === 'content-strategy') return !isWebsiteOnly && !!content.contentStrategy;
    if (item.id === 'analytics') return showAnalytics;
    if (item.id === 'social') return showSocialMedia;
    if (item.id === 'email') return showEmail;
    if (item.id === 'texting') return showTexting;
    if (item.id === 'melleka-app') return showEmail || showTexting;
    if (item.id === 'reputation') return showReputationManagement;
    if (item.id === 'ai-solutions') return showAiFeatures;
    if (item.id === 'automation-crm') return showAutomationCrm;
    if (item.id === 'influencer') return showInfluencer || showUgc;
    if (item.id === 'tv-ads') return showTvAds;
    if (item.id === 'live-dashboard') return showLiveDashboard;
    if (item.id === 'website-design') return showWebsiteDesign;
    return true; // Always show hero, executive, phases, business-audit, target-personas, budget, timeline, trusted, cta
  });

  const brandStyle = {
    '--brand-primary': primaryColor,
    '--brand-secondary': secondaryColor,
    '--brand-accent': accentColor,
    '--brand-background': backgroundColor,
    '--brand-text': textColor,
    '--brand-text-muted': textMutedColor,
    '--brand-card': cardBackground,
    '--brand-border': borderColor,
    '--brand-glass': glassBackground,
    backgroundColor: backgroundColor,
    color: textColor
  } as React.CSSProperties;

  // Handle saving admin changes
  const handleSaveChanges = async (changes: Record<string, unknown>) => {
    if (!proposal) return;
    const {
      data: currentProposal
    } = await supabase.from('proposals').select('content').eq('id', proposal.id).single();
    if (currentProposal) {
      const currentContent = currentProposal.content as Record<string, unknown> || {};
      const updatedContent = {
        ...currentContent,
        ...changes
      };
      await supabase.from('proposals')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        content: updatedContent as any
      }).eq('id', proposal.id);
    }
  };
  return <div className="min-h-screen min-h-[100dvh] flex flex-col lg:flex-row overflow-x-hidden overflow-y-auto" style={brandStyle}>
      {/* Admin Toolbar */}
      <AdminToolbar onSave={handleSaveChanges} primaryColor={primaryColor} isAdmin={isAdmin} />
      
      {/* Floating Package Selector */}
      <FloatingPackageSelector basePackageId={currentPackageId} currentPackageId={displayPackage?.id || currentPackageId} onPackageChange={handlePackageChange} baseWebsitePackageId={content.selectedWebsitePackage?.id} onWebsitePackageChange={handleWebsitePackageChange} proposalType={proposalType} currentWebsitePackageId={displayWebsitePackage?.id || content.selectedWebsitePackage?.id} />

      {/* Fixed Sidebar Navigation - Desktop */}
      <aside className={`hidden lg:flex fixed left-0 top-0 bottom-0 flex-col z-50 border-r transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`} style={{
      backgroundColor: `color-mix(in srgb, ${backgroundColor} 98%, transparent)`,
      borderColor: borderColor
    }}>
        {/* Sidebar Header */}
        <div className="p-3 border-b flex items-center justify-between" style={{
        borderColor: borderColor
      }}>
          {!sidebarCollapsed && <span className="text-xs font-medium" style={{
          color: textMutedColor
        }}>
              {isWebsiteOnly ? 'Website Design Proposal By Melleka Marketing' : 'Marketing Plan By Melleka Marketing'}
            </span>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 rounded-lg transition-colors hover:opacity-80" style={{
          backgroundColor: cardBackground,
          color: textColor
        }} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Client Logo - Only when expanded */}
        {!sidebarCollapsed && <div className="p-3 border-b" style={{
        borderColor: borderColor
      }}>
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{
          backgroundColor: cardBackground
        }}>
              <ReliableLogo sources={[content.brandStyles?.logo, content.hero?.clientLogo, content.brandStyles?.ogImage, content.brandStyles?.favicon]} alt={proposal.client_name} className="h-7 w-auto max-w-[80px] object-contain" fallback={<div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{
            backgroundColor: primaryColor
          }}>
                    <span className="text-white font-bold text-xs">{proposal.client_name.charAt(0)}</span>
                  </div>} />
              <span className="text-xs font-medium truncate" style={{
            color: textColor
          }}>
                {proposal.client_name}
              </span>
            </div>
          </div>}

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {visibleNavItems.map(({
            id,
            label,
            icon: Icon
          }) => {
            // Check if this is an "extra" section gained from upgrading packages
            const isExtraSection = (() => {
              if (!displayPackage || !baseMarketingPackage) return false;
              // Only show +NEW if viewing a higher tier than the base package
              if (displayPackage.tier <= baseMarketingPackage.tier) return false;
              
              // Map nav IDs to package service keys (some sections map to multiple services)
              const navToServiceMap: Record<string, (keyof typeof displayPackage.services)[]> = {
                'ai-solutions': ['aiVoiceAgent', 'aiChatBot', 'aiCRMManager', 'aiToolsOnDemand'],
                'automation-crm': ['automatedCRM', 'automatedSystems'],
                'email': ['emailCampaigns'],
                'texting': ['textingCampaigns'],
                'social': ['socialMediaManagement'],
                'reputation': ['reputationManagement'],
                'influencer': ['influencerMarketing', 'ugcContent'],
                'tv-ads': ['televisionAds'],
                'live-dashboard': ['liveDashboard'],
              };
              
              const serviceKeys = navToServiceMap[id];
              if (!serviceKeys || serviceKeys.length === 0) return false;
              
              // Check if ANY of the mapped services are in current tier but NOT in base tier
              for (const serviceKey of serviceKeys) {
                const currentHas = displayPackage.services[serviceKey]?.included;
                const baseHas = baseMarketingPackage.services[serviceKey]?.included;
                if (currentHas && !baseHas) {
                  return true;
                }
              }
              
              return false;
            })();
            
            return <button key={id} onClick={() => scrollToSection(id)} className={`w-full rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${sidebarCollapsed ? 'justify-center p-2.5' : 'text-left px-3 py-2.5'}`} style={{
              backgroundColor: activeSection === id 
                ? `color-mix(in srgb, ${primaryColor} 20%, transparent)` 
                : isExtraSection 
                  ? `color-mix(in srgb, ${secondaryColor} 15%, transparent)` 
                  : 'transparent',
              color: activeSection === id ? primaryColor : isExtraSection ? secondaryColor : textMutedColor,
              borderLeft: sidebarCollapsed ? 'none' : activeSection === id ? `3px solid ${primaryColor}` : isExtraSection ? `3px solid ${secondaryColor}` : '3px solid transparent'
            }} title={sidebarCollapsed ? label : undefined}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="flex items-center gap-2">
                      {label}
                      {isExtraSection && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded" style={{
                          backgroundColor: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`,
                          color: secondaryColor
                        }}>
                          +NEW
                        </span>
                      )}
                    </span>
                  )}
                </button>;
          })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className={`border-t ${sidebarCollapsed ? 'p-2' : 'p-3'}`} style={{
        borderColor: borderColor
      }}>
          <a href="tel:8185992696" className={`w-full flex items-center justify-center rounded-lg font-semibold transition-all ${sidebarCollapsed ? 'p-2.5' : 'gap-2 px-4 py-2.5 text-sm'}`} style={{
          backgroundColor: primaryColor,
          color: isLightColor(primaryColor) ? '#1a1a2e' : '#ffffff'
        }} title={sidebarCollapsed ? 'Call Us: 818.599.2696' : undefined}>
            <Phone className="w-4 h-4" />
            {!sidebarCollapsed && <span>Call Us</span>}
          </a>
          {!sidebarCollapsed && <div className="flex gap-2 mt-2">
              <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors" style={{
            backgroundColor: cardBackground,
            color: textColor
          }}>
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors" style={{
            backgroundColor: cardBackground,
            color: textColor
          }}>
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>}
          {sidebarCollapsed && <div className="flex flex-col gap-1 mt-2">
              <button onClick={handleShare} className="p-2.5 rounded-lg transition-colors flex items-center justify-center" style={{
            backgroundColor: cardBackground,
            color: textColor
          }} title="Share">
                <Share2 className="w-4 h-4" />
              </button>
              <button onClick={() => window.print()} className="p-2.5 rounded-lg transition-colors flex items-center justify-center" style={{
            backgroundColor: cardBackground,
            color: textColor
          }} title="Download PDF">
                <Download className="w-4 h-4" />
              </button>
            </div>}
        </div>
      </aside>

      {/* Mobile Top Navigation */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b" style={{
      backgroundColor: `color-mix(in srgb, ${backgroundColor} 95%, transparent)`,
      borderColor: borderColor
    }}>
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg transition-colors" style={{
            color: textColor
          }}>
              <Menu className="w-5 h-5" />
            </button>
            <img src={mellekaLogo} alt="Melleka" className="h-6 w-auto" />
          </div>
          <a href="tel:8185992696" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{
          backgroundColor: primaryColor,
          color: isLightColor(primaryColor) ? '#1a1a2e' : '#ffffff'
        }}>
            📞 Call Us
          </a>
        </div>
      </nav>

      {/* Mobile Slide-out Menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col h-full" style={{
        backgroundColor: backgroundColor,
        borderColor: borderColor
      }}>
          <SheetHeader className="p-4 border-b" style={{
          borderColor: borderColor
        }}>
            <SheetTitle style={{
            color: textColor
          }}>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {visibleNavItems.map(({
            id,
            label
          }) => {
            // Check if this is an "extra" section gained from upgrading packages
            const isExtraSection = (() => {
              if (!displayPackage || !baseMarketingPackage) return false;
              // Only show +NEW if viewing a higher tier than the base package
              if (displayPackage.tier <= baseMarketingPackage.tier) return false;
              
              // Map nav IDs to package service keys (some sections map to multiple services)
              const navToServiceMap: Record<string, (keyof typeof displayPackage.services)[]> = {
                'ai-solutions': ['aiVoiceAgent', 'aiChatBot', 'aiCRMManager', 'aiToolsOnDemand'],
                'automation-crm': ['automatedCRM', 'automatedSystems'],
                'email': ['emailCampaigns'],
                'texting': ['textingCampaigns'],
                'social': ['socialMediaManagement'],
                'reputation': ['reputationManagement'],
                'influencer': ['influencerMarketing', 'ugcContent'],
                'tv-ads': ['televisionAds'],
                'live-dashboard': ['liveDashboard'],
              };
              
              const serviceKeys = navToServiceMap[id];
              if (!serviceKeys || serviceKeys.length === 0) return false;
              
              // Check if ANY of the mapped services are in current tier but NOT in base tier
              for (const serviceKey of serviceKeys) {
                const currentHas = displayPackage.services[serviceKey]?.included;
                const baseHas = baseMarketingPackage.services[serviceKey]?.included;
                if (currentHas && !baseHas) {
                  return true;
                }
              }
              
              return false;
            })();
            
            return <button key={id} onClick={() => {
              scrollToSection(id);
              setMobileMenuOpen(false);
            }} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2" style={{
              backgroundColor: activeSection === id 
                ? `color-mix(in srgb, ${primaryColor} 20%, transparent)` 
                : isExtraSection 
                  ? `color-mix(in srgb, ${secondaryColor} 15%, transparent)` 
                  : 'transparent',
              color: activeSection === id ? primaryColor : isExtraSection ? secondaryColor : textMutedColor
            }}>
                  <span className="flex items-center gap-2">
                    {label}
                    {isExtraSection && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded" style={{
                        backgroundColor: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`,
                        color: secondaryColor
                      }}>
                        +NEW
                      </span>
                    )}
                  </span>
                </button>;
          })}
          </div>
          <div className="flex-shrink-0 p-4 border-t" style={{
          borderColor: borderColor
        }}>
            <a href="tel:8185992696" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{
            backgroundColor: primaryColor,
            color: isLightColor(primaryColor) ? '#1a1a2e' : '#ffffff'
          }}>
              📞 Call Us: 818.599.2696
            </a>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content - Offset for sidebar */}
      <main className={`flex-1 pt-14 lg:pt-0 transition-all duration-300 overflow-x-hidden overflow-y-auto ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Hero Section - Premium Futuristic Design with Neon Glow */}
        <section id="hero" className="relative min-h-[90vh] flex items-center overflow-hidden" style={{
        backgroundColor
      }}>
          {/* Animated Background Grid - Enhanced for Dark Mode */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated Grid Lines - Neon on dark */}
            <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(${primaryColor}${isLightBackground ? '08' : '15'} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor}${isLightBackground ? '08' : '15'} 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            opacity: isLightBackground ? 0.5 : 1
          }} />
            
            {/* NEON Floating Orbs - More intense on dark backgrounds */}
            <div className="absolute top-10 right-[15%] w-96 h-96 rounded-full blur-[100px] animate-pulse" style={{
            backgroundColor: primaryColor,
            animationDuration: '4s',
            opacity: isLightBackground ? 0.15 : 0.4,
            boxShadow: !isLightBackground ? `0 0 120px ${primaryColor}60` : 'none'
          }} />
            <div className="absolute bottom-10 left-[10%] w-80 h-80 rounded-full blur-[80px] animate-pulse" style={{
            backgroundColor: secondaryColor,
            animationDuration: '6s',
            opacity: isLightBackground ? 0.1 : 0.35,
            boxShadow: !isLightBackground ? `0 0 100px ${secondaryColor}50` : 'none'
          }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px]" style={{
            background: `radial-gradient(circle, ${primaryColor}, transparent)`,
            opacity: isLightBackground ? 0.08 : 0.2
          }} />
            
            {/* Background gradient accents - subtle, no distracting floating circles */}
          </div>

          <div className="container max-w-6xl mx-auto px-4 py-24 relative z-10">
            {/* Hero Content - Logo first, then title */}
            <div className="text-center mb-10">
              {/* Client Logo - On top with multi-step fallback */}
              <div className="relative inline-block mb-8">
                <ReliableLogo sources={[currentLogo, content.hero?.clientLogo, content.brandStyles?.logo, content.brandStyles?.ogImage, content.brandStyles?.favicon]} alt={proposal.client_name} className="h-20 md:h-28 mx-auto object-contain" fallback={<div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl" style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`,
                border: `1px solid color-mix(in srgb, ${primaryColor} 30%, transparent)`
              }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                  backgroundColor: primaryColor
                }}>
                        <span className="text-white font-bold text-lg">{proposal.client_name.charAt(0)}</span>
                      </div>
                      <span className="font-display font-semibold text-lg" style={{
                  color: textColor
                }}>{proposal.client_name}</span>
                    </div>} />
                {/* Admin Logo Tools */}
                {isAdminVerified && <div className="mt-4 flex justify-center">
                    <LogoUploader currentLogo={currentLogo || content.hero?.clientLogo || content.brandStyles?.logo} proposalId={proposal.id} websiteUrl={content.websiteUrl} onLogoUpdated={newUrl => setCurrentLogo(newUrl)} primaryColor={primaryColor} isLightBackground={isLightBackground} />
                  </div>}
              </div>

              {/* Premium Badge */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{
                background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 70%, ${secondaryColor}))`,
                color: isLightColor(primaryColor) ? '#1a1a2e' : 'white',
                boxShadow: isLightBackground ? `0 4px 20px color-mix(in srgb, ${primaryColor} 40%, transparent)` : `0 4px 20px ${primaryColor}60, 0 0 40px ${primaryColor}30, 0 0 60px ${primaryColor}15`
              }}>
                  <Sparkles className="w-4 h-4" />
                  <span>{isWebsiteOnly ? "Custom Website Design Proposal" : "Strategic Marketing Partnership"}</span>
                </div>
              </div>
              
              {/* Main Title - "Marketing Proposal for (Client Name)" */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-4 leading-tight" style={{
              color: textColor,
              textShadow: isLightBackground ? 'none' : `0 2px 40px color-mix(in srgb, ${primaryColor} 30%, transparent)`
            }}>
                {isWebsiteOnly ? <>
                    Website Design Proposal For<br />
                    <span style={{
                  color: primaryColor
                }}>{proposal.client_name}</span>
                  </> : <>
                    Marketing Proposal For<br />
                    <span style={{
                  color: primaryColor
                }}>{proposal.client_name}</span>
                  </>}
              </h1>
              
              {/* AI-Generated Headline - Smaller and Italicized */}
              <p className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed italic mb-4" style={{
              color: textMutedColor
            }}>
                {isWebsiteOnly 
                  ? (content.hero?.headline || "Custom Website Designed for Your Brand")
                  : (content.hero?.headline || content.title || `Strategic Growth Plan for ${proposal.client_name}`)}
              </p>
              
              {/* Subheadline */}
              <p className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{
              color: textMutedColor,
              opacity: 0.8
            }}>
                {isWebsiteOnly ? websiteHeroSubheadline : content.hero?.subheadline || proposal.project_description}
              </p>
            </div>

            {/* Selected Package Banner - Premium Glassmorphic with Neon */}
            {!isWebsiteOnly && displayPackage && <div className="mb-10 p-6 rounded-3xl max-w-3xl mx-auto relative overflow-hidden group" style={{
            background: isLightBackground ? `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 95%, ${primaryColor}), ${cardBackground})` : `linear-gradient(145deg, rgba(20, 20, 50, 0.8), rgba(10, 10, 30, 0.6))`,
            border: isLightBackground ? `1px solid color-mix(in srgb, ${primaryColor} 30%, ${borderColor})` : `1px solid color-mix(in srgb, ${primaryColor} 40%, rgba(255,255,255,0.1))`,
            boxShadow: isLightBackground ? `0 8px 32px color-mix(in srgb, ${primaryColor} 15%, transparent)` : `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 60px ${primaryColor}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
            backdropFilter: isLightBackground ? 'none' : 'blur(20px)'
          }}>
                {/* Animated Gradient Border - Enhanced for Dark */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
              background: isLightBackground ? `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 10%, transparent), transparent)` : `linear-gradient(135deg, ${primaryColor}15, transparent 50%, ${secondaryColor}10)`
            }} />
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 70%, ${secondaryColor}))`,
                  boxShadow: isLightBackground ? `0 8px 24px color-mix(in srgb, ${primaryColor} 40%, transparent)` : `0 8px 24px ${primaryColor}50, 0 0 40px ${primaryColor}30`
                }}>
                      <Sparkles className="w-8 h-8 text-white" />
                      <div className="absolute -top-1 -right-1">
                        <PulsingIndicator color={secondaryColor} size="sm" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{
                    color: secondaryColor,
                    textShadow: !isLightBackground ? `0 0 10px ${secondaryColor}60` : 'none'
                  }}>
                        Recommended Plan
                      </p>
                      <p className="font-display font-bold text-xl" style={{
                    color: textColor,
                    textShadow: !isLightBackground ? `0 0 20px ${primaryColor}30` : 'none'
                  }}>
                        {displayPackage.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm flex items-center gap-1" style={{
                      color: textMutedColor
                    }}>
                          <Layers className="w-3.5 h-3.5" /> {displayPackage.channels}
                        </span>
                        <span className="text-sm flex items-center gap-1" style={{
                      color: textMutedColor
                    }}>
                          <Clock className="w-3.5 h-3.5" /> {displayPackage.turnaround}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-4xl font-display font-bold" style={{
                  color: primaryColor,
                  textShadow: !isLightBackground ? `0 0 30px ${primaryColor}50` : 'none'
                }}>
                      ${displayPackage.monthlyPrice.toLocaleString()}
                    </p>
                    <p className="text-sm" style={{
                  color: textMutedColor
                }}>per month</p>
                  </div>
                </div>
              </div>}

            {/* Stats Grid - Premium 3D Cards with Neon Glow */}
            {dynamicHeroStats.length > 0 && <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
                {dynamicHeroStats.map((stat, i) => {
              const statColor = i === 0 ? primaryColor : i === 1 ? secondaryColor : primaryColor;
              return <div key={i} className="relative group">
                      {/* Neon glow background on hover */}
                      <div className="absolute inset-0 rounded-3xl blur-xl transition-all duration-500" style={{
                  backgroundColor: statColor,
                  opacity: isLightBackground ? 0 : 0.15,
                  boxShadow: !isLightBackground ? `0 0 60px ${statColor}30` : 'none'
                }} />
                      <div className="absolute inset-0 rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-all duration-500" style={{
                  backgroundColor: statColor,
                  boxShadow: !isLightBackground ? `0 0 80px ${statColor}50` : 'none'
                }} />
                      <div className="relative p-8 rounded-3xl text-center transition-all duration-500 hover:scale-105 hover:-translate-y-2" style={{
                  background: isLightBackground ? i === 0 ? `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, ${cardBackground}), ${cardBackground})` : cardBackground : `linear-gradient(145deg, rgba(20, 20, 50, 0.8), rgba(10, 10, 30, 0.6))`,
                  border: isLightBackground ? i === 0 ? `2px solid color-mix(in srgb, ${primaryColor} 50%, transparent)` : `1px solid ${borderColor}` : `1px solid color-mix(in srgb, ${statColor} 35%, rgba(255,255,255,0.08))`,
                  boxShadow: isLightBackground ? i === 0 ? `0 12px 40px color-mix(in srgb, ${primaryColor} 25%, transparent)` : '0 8px 32px rgba(0, 0, 0, 0.08)' : `0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px ${statColor}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  backdropFilter: isLightBackground ? 'none' : 'blur(20px)'
                }}>
                        {/* Stat Icon - Neon Enhanced */}
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{
                    background: `linear-gradient(135deg, ${statColor}, color-mix(in srgb, ${statColor} 70%, transparent))`,
                    boxShadow: isLightBackground ? `0 4px 16px color-mix(in srgb, ${statColor} 30%, transparent)` : `0 4px 16px ${statColor}50, 0 0 30px ${statColor}30`
                  }}>
                          {i === 0 && <DollarSign className="w-6 h-6 text-white" />}
                          {i === 1 && <Layers className="w-6 h-6 text-white" />}
                          {i === 2 && <Clock className="w-6 h-6 text-white" />}
                        </div>
                        
                        {/* Value - High contrast text: black on light, white on dark */}
                        <p className="text-4xl md:text-5xl font-display font-bold mb-3" style={{
                    color: textColor,
                    textShadow: isLightBackground ? 'none' : `0 0 30px ${statColor}60, 0 0 60px ${statColor}30`
                  }}>
                          {isWebsiteOnly ? stat.value : <AnimatedCounter value={stat.value} duration={2000} />}
                        </p>
                        
                        {/* Label */}
                        <p className="text-sm font-medium uppercase tracking-wider" style={{
                    color: textMutedColor
                  }}>
                          {stat.label}
                        </p>
                        
                        {/* First stat badge - Neon Enhanced */}
                        {i === 0 && <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full text-xs font-bold" style={{
                    background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 80%, ${primaryColor}))`,
                    color: 'white',
                    boxShadow: isLightBackground ? `0 4px 12px color-mix(in srgb, ${secondaryColor} 40%, transparent)` : `0 4px 12px ${secondaryColor}60, 0 0 20px ${secondaryColor}40`
                  }}>
                            Your Plan
                          </div>}
                      </div>
                    </div>;
            })}
              </div>}

            {/* Industry Benchmark Badge - Only for Marketing proposals */}
            {!isWebsiteOnly && <div className="mt-12">
                <IndustryBenchmarkBadge detectedIndustry={(content as any).detectedIndustry || content.marketAnalysis?.industry} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} glassBackground={glassBackground} borderColor={borderColor} />
              </div>}

            {/* Premium CTA Button - with Neon Glow on Dark */}
            <div className="flex flex-col items-center mt-14 gap-4">
              <button onClick={() => scrollToSection(isWebsiteOnly ? 'your-package' : 'executive')} className="px-10 py-5 rounded-2xl font-semibold flex items-center gap-3 transition-all duration-300 hover:scale-105 hover:-translate-y-1 group relative overflow-hidden" style={{
              background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 80%, ${secondaryColor}))`,
              color: 'white',
              boxShadow: isLightBackground ? `0 8px 32px color-mix(in srgb, ${primaryColor} 40%, transparent)` : `0 8px 32px ${primaryColor}50, 0 0 60px ${primaryColor}30, 0 0 100px ${primaryColor}15`
            }}>
                {/* Animated shine effect for dark mode */}
                {!isLightBackground && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                animation: 'shimmer 2s infinite'
              }} />}
                <span className="text-lg relative z-10">{isWebsiteOnly ? 'View Your Package' : 'Explore the Strategy'}</span>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1 relative z-10" />
              </button>
              
              {/* Trust indicators */}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-sm" style={{
                color: textMutedColor
              }}>
                  <CheckCircle2 className="w-4 h-4" style={{
                  color: '#22c55e'
                }} />
                  <span>Custom Strategy</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm" style={{
                color: textMutedColor
              }}>
                  <CheckCircle2 className="w-4 h-4" style={{
                  color: '#22c55e'
                }} />
                  <span>Dedicated Team</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm" style={{
                color: textMutedColor
              }}>
                  <CheckCircle2 className="w-4 h-4" style={{
                  color: '#22c55e'
                }} />
                  <span>{isWebsiteOnly ? 'Premium Design' : 'White Glove Experience'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Gradient Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{
          background: `linear-gradient(to top, ${backgroundColor}, transparent)`
        }} />
        </section>

        {/* =============== WEBSITE-ONLY SECTIONS =============== */}
        {/* These sections ONLY appear for website proposals - no marketing content */}
        
        {/* Your Package Section - Website Only */}
        {isWebsiteOnly && displayWebsitePackage && <YourPackageSection websitePackage={displayWebsitePackage} clientName={proposal.client_name} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} backgroundColor={backgroundColor} />}

        {/* Design Process Section - Website Only */}
        {isWebsiteOnly && <DesignProcessSection clientName={proposal.client_name} websitePackage={displayWebsitePackage} websiteDescription={content.websiteDesign?.description} designApproach={content.websiteDesign?.designApproach} pages={content.websiteDesign?.pages} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} backgroundColor={backgroundColor} />}


        {/* SEO & Analytics Section - Website Only (Premium & Ultra Premium) */}
        {isWebsiteOnly && displayWebsitePackage?.services?.seo?.included && <SeoAnalyticsSection websitePackage={displayWebsitePackage} clientName={proposal.client_name} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} backgroundColor={backgroundColor} liveSeoData={liveSeoData} isFetchingSeo={isFetchingSeo} seoSearchDomain={seoSearchDomain} onSeoSearchChange={setSeoSearchDomain} onFetchSeo={fetchLiveSeoData} isLightBackground={isLightBackground} />}

        {/* Automations Section - Website Only (Ultra Premium) */}
        {isWebsiteOnly && displayWebsitePackage?.services?.automations?.included && <AutomationsSection clientName={proposal.client_name} automationWorkflows={content.automationWorkflows} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} backgroundColor={backgroundColor} />}

        {/* Blog Content Section - Website Only (Ultra Premium) */}
        {isWebsiteOnly && displayWebsitePackage?.services?.blogs?.included && <BlogContentSection websitePackage={displayWebsitePackage} clientName={proposal.client_name} blogContent={content.blogContent} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} backgroundColor={backgroundColor} />}

        {/* Portfolio Showcase Section - Website Only */}
        {isWebsiteOnly && <PortfolioShowcaseSection portfolioWebsites={content.websiteDesign?.portfolioWebsites} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} backgroundColor={backgroundColor} />}


        {/* =============== END WEBSITE-ONLY SECTIONS =============== */}

        {/* Executive Summary - Premium Futuristic Design */}
        {!isWebsiteOnly && content.executiveSummary && <section id="executive" className="py-28 relative overflow-hidden" style={{
        backgroundColor
      }}>
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[120px] opacity-10" style={{
            backgroundColor: primaryColor
          }} />
              <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-[100px] opacity-10" style={{
            backgroundColor: secondaryColor
          }} />
            </div>

            <div className="container max-w-6xl mx-auto px-4 relative z-10">
              {/* Section Header with Premium Badge */}
              <AnimatedSection>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 70%, ${secondaryColor}))`,
                  boxShadow: `0 8px 32px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                }}>
                      <Target className="w-8 h-8 text-white" />
                      <div className="absolute -top-1 -right-1">
                        <PulsingIndicator color={secondaryColor} size="sm" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{
                    color: secondaryColor
                  }}>Prepared for {proposal.client_name}</p>
                      <h2 className="text-3xl md:text-4xl font-display font-bold" style={{
                    color: textColor
                  }}>
                        Executive Summary
                      </h2>
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="flex items-center gap-4">
                    {displayPackage && <>
                        <div className="px-4 py-2 rounded-xl text-center" style={{
                    background: `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`
                  }}>
                          <p className="text-xl font-bold" style={{
                      color: primaryColor
                    }}>{displayPackage.channels}</p>
                          <p className="text-xs" style={{
                      color: textMutedColor
                    }}>Channels</p>
                        </div>
                        <div className="px-4 py-2 rounded-xl text-center" style={{
                    background: `color-mix(in srgb, ${secondaryColor} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${secondaryColor} 20%, transparent)`
                  }}>
                          <p className="text-xl font-bold" style={{
                      color: secondaryColor
                    }}>{displayPackage.turnaround}</p>
                          <p className="text-xs" style={{
                      color: textMutedColor
                    }}>Turnaround</p>
                        </div>
                      </>}
                  </div>
                </div>
              </AnimatedSection>
              
              {/* Overview Card - Premium Glass */}
              <AnimatedSection delay={100}>
                <div className="p-8 md:p-10 rounded-3xl relative overflow-hidden mb-10" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 95%, ${primaryColor}), ${cardBackground})`,
              border: `1px solid color-mix(in srgb, ${primaryColor} 20%, ${borderColor})`,
              boxShadow: `0 8px 40px color-mix(in srgb, ${primaryColor} 10%, transparent)`
            }}>
                  <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none" style={{
                backgroundColor: primaryColor
              }} />
                  
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                  background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                }}>
                      <FileText className="w-6 h-6" style={{
                    color: primaryColor
                  }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-semibold mb-1" style={{
                    color: textColor
                  }}>
                        Strategic Overview for {proposal.client_name}
                      </h3>
                      <p className="text-sm" style={{
                    color: secondaryColor
                  }}>Personalized growth strategy</p>
                    </div>
                  </div>
                  
                  <p className="text-lg leading-relaxed whitespace-pre-line relative z-10" style={{
                color: textMutedColor
              }}>
                    {content.executiveSummary.overview}
                  </p>
                </div>
              </AnimatedSection>

              {/* Key Objectives - Premium Cards with Numbers */}
              {content.executiveSummary.objectives && content.executiveSummary.objectives.length > 0 && <AnimatedSection delay={200} className="mb-12">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`
              }}>
                      <Rocket className="w-5 h-5" style={{
                  color: secondaryColor
                }} />
                    </div>
                    <h3 className="text-2xl font-display font-bold" style={{
                color: textColor
              }}>
                      Key Objectives for {proposal.client_name}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {content.executiveSummary.objectives.map((obj, i) => <div key={i} className="group p-6 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)'
              }}>
                        {/* Hover gradient */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 5%, transparent), transparent)`
                }} />
                        
                        <div className="relative z-10">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-xl mb-4" style={{
                    background: `linear-gradient(135deg, ${i % 2 === 0 ? primaryColor : secondaryColor}, color-mix(in srgb, ${i % 2 === 0 ? primaryColor : secondaryColor} 70%, transparent))`,
                    color: 'white',
                    boxShadow: `0 4px 16px color-mix(in srgb, ${i % 2 === 0 ? primaryColor : secondaryColor} 30%, transparent)`
                  }}>
                            {i + 1}
                          </div>
                          <p className="font-medium leading-relaxed" style={{
                    color: textColor
                  }}>{obj}</p>
                        </div>
                      </div>)}
                  </div>
                </AnimatedSection>}

              {/* Approach Section - Premium Gradient Card */}
              {content.executiveSummary.approach && <AnimatedSection delay={300}>
                  <div className="p-8 md:p-10 rounded-3xl relative overflow-hidden" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 12%, ${cardBackground}), color-mix(in srgb, ${secondaryColor} 8%, ${cardBackground}))`,
              border: `1px solid color-mix(in srgb, ${primaryColor} 25%, ${borderColor})`,
              boxShadow: `0 12px 48px color-mix(in srgb, ${primaryColor} 15%, transparent)`
            }}>
                    {/* Decorative elements */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl opacity-20" style={{
                backgroundColor: secondaryColor
              }} />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-2xl opacity-15" style={{
                backgroundColor: primaryColor
              }} />
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    boxShadow: `0 8px 24px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                  }}>
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-widest mb-1" style={{
                      color: secondaryColor
                    }}>Our Strategy</p>
                          <h3 className="text-2xl font-display font-bold" style={{
                      color: textColor
                    }}>
                            How We'll Help {proposal.client_name} Succeed
                          </h3>
                        </div>
                      </div>
                      
                      <p className="text-lg leading-relaxed" style={{
                  color: textMutedColor
                }}>
                        {content.executiveSummary.approach}
                      </p>
                      
                      {/* Quick Benefits */}
                      <div className="flex flex-wrap gap-3 mt-8">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
                    background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`
                  }}>
                          <CheckCircle2 className="w-4 h-4" style={{
                      color: primaryColor
                    }} />
                          <span className="text-sm font-medium" style={{
                      color: textColor
                    }}>Data-Driven</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
                    background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${secondaryColor} 20%, transparent)`
                  }}>
                          <CheckCircle2 className="w-4 h-4" style={{
                      color: secondaryColor
                    }} />
                          <span className="text-sm font-medium" style={{
                      color: textColor
                    }}>ROI Focused</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
                    background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`
                  }}>
                          <CheckCircle2 className="w-4 h-4" style={{
                      color: primaryColor
                    }} />
                          <span className="text-sm font-medium" style={{
                      color: textColor
                    }}>Industry Expert</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>}
            </div>
          </section>}

        {/* Services Overview Section - Only for marketing/combined proposals */}
        {!isWebsiteOnly && <section className="py-24" style={{
        backgroundColor,
        ...glassSectionStyle
      }}>
            <div className="container max-w-6xl mx-auto px-4">
              <AnimatedSection>
                <div className="text-center mb-16">
                  <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{
                color: secondaryColor
              }}>
                    Full-Service Marketing Agency
                  </p>
                  <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
                color: textColor
              }}>
                    Everything You Need, Under One Roof
                  </h2>
                  <p className="text-lg max-w-3xl mx-auto" style={{
                color: textMutedColor
              }}>
                    From paid advertising to organic growth, creative production to analytics, 
                    Melleka Marketing handles every aspect of your digital presence.
                  </p>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {MELLEKA_SERVICES.map((service, i) => {
                const ServiceIcon = service.icon;
                return <div key={i} className="p-5 rounded-2xl transition-all duration-300 hover:scale-105 group" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{
                    backgroundColor: primaryColor
                  }}>
                          <ServiceIcon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-semibold mb-1" style={{
                    color: textColor
                  }}>{service.name}</h3>
                        <p className="text-sm" style={{
                    color: textMutedColor
                  }}>{service.description}</p>
                      </div>;
              })}
                </div>
              </AnimatedSection>
            </div>
          </section>}

        {/* Website Design Services Overview removed - now integrated into DesignProcessSection */}

        {/* Phased Approach - Visual Roadmap (Marketing) */}
        {!isWebsiteOnly && content.timeline?.phases && content.timeline.phases.length > 0 && <section id="phases" className="py-24" style={{
        backgroundColor
      }}>
            <div className="container max-w-6xl mx-auto px-4">
              <AnimatedSection>
                <div className="text-center mb-16">
                  <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{
                color: secondaryColor
              }}>
                    Our Approach
                  </p>
                  <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
                color: textColor
              }}>
                    A Proven Path to Success
                  </h2>
                  <p className="text-lg max-w-3xl mx-auto" style={{
                color: textMutedColor
              }}>
                    Our three-phase methodology ensures we build a solid foundation, 
                    optimize for performance, and scale for maximum growth.
                  </p>
                </div>
              </AnimatedSection>

              {/* Visual Phase Cards */}
              <div className="grid md:grid-cols-3 gap-8">
                {[{
              phase: 1,
              name: 'Foundation',
              icon: Layers,
              duration: 'Months 1-3',
              focus: 'Build the infrastructure for success',
              items: ['Complete marketing audit', 'Setup all tracking & analytics', 'Launch initial campaigns', 'Establish performance baselines'],
              color: primaryColor
            }, {
              phase: 2,
              name: 'Zero In',
              icon: Target,
              duration: 'Months 4-6',
              focus: 'Optimize and refine for peak performance',
              items: ['A/B test all creative', 'Identify top performers', 'Optimize conversion funnels', 'Scale winning strategies'],
              color: secondaryColor
            }, {
              phase: 3,
              name: 'Scale',
              icon: Rocket,
              duration: 'Months 7-12',
              focus: 'Accelerate growth and dominate',
              items: ['Expand to new channels', 'Increase ad spend on winners', 'Launch new initiatives', 'Achieve market leadership'],
              color: accentColor
            }].map((phase, i) => {
              const PhaseIcon = phase.icon;
              return <AnimatedSection key={i} delay={i * 150}>
                      <div className="relative p-8 rounded-3xl h-full group hover:scale-[1.02] transition-all duration-300" style={{
                  background: cardBackground,
                  border: `2px solid ${i === 0 ? phase.color : borderColor}`
                }}>
                        {/* Phase Number Badge */}
                        <div className="absolute -top-5 left-8 px-4 py-2 rounded-full font-bold text-sm" style={{
                    backgroundColor: phase.color,
                    color: 'white'
                  }}>
                          PHASE {phase.phase}
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                        backgroundColor: `color-mix(in srgb, ${phase.color} 20%, transparent)`
                      }}>
                              <PhaseIcon className="w-7 h-7" style={{
                          color: phase.color
                        }} />
                            </div>
                            <div>
                              <h3 className="text-2xl font-display font-bold" style={{
                          color: textColor
                        }}>{phase.name}</h3>
                              <p className="text-sm" style={{
                          color: secondaryColor
                        }}>{phase.duration}</p>
                            </div>
                          </div>

                          <p className="mb-6" style={{
                      color: textMutedColor
                    }}>{phase.focus}</p>

                          <ul className="space-y-3">
                            {phase.items.map((item, j) => <li key={j} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{
                          color: phase.color
                        }} />
                                <span style={{
                          color: textMutedColor
                        }}>{item}</span>
                              </li>)}
                          </ul>
                        </div>

                        {/* Connector Arrow (except last) */}
                        {i < 2 && <div className="hidden md:block absolute -right-6 top-1/2 -translate-y-1/2 z-10">
                            <ArrowRight className="w-8 h-8" style={{
                      color: borderColor
                    }} />
                          </div>}
                      </div>
                    </AnimatedSection>;
            })}
              </div>
            </div>
          </section>}

        {/* Website Design Process removed - now handled by DesignProcessSection */}

        {/* Business Audit Section - Marketing Only */}
        {!isWebsiteOnly && content.businessAudit && <BusinessAudit businessAudit={content.businessAudit} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} clientName={proposal.client_name} />}

        {/* Audience Strategy Section - Marketing Only */}
        {!isWebsiteOnly && content.audienceStrategy && <AudienceStrategy audienceStrategy={content.audienceStrategy} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} clientName={proposal.client_name} />}

        {/* Ad Copy Recommendations Section - Marketing Only */}
        {!isWebsiteOnly && content.adCopyRecommendations && <AdCopyRecommendations adCopyRecommendations={content.adCopyRecommendations} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} clientName={proposal.client_name} />}

        {/* Website Design Section - Only for Combined proposals (not website-only)
            IMPORTANT: must stay near its nav position (between target-personas and google-ads)
            to prevent sidebar/scroll-spy from appearing to “skip” later sections like UGC. */}
        {!isWebsiteOnly && content.websiteDesign && content.selectedWebsitePackage && <WebsiteDesignSection content={content.websiteDesign} clientName={proposal?.client_name || 'Your Business'} selectedPackage={content.selectedWebsitePackage} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} screenshots={content.screenshots} />}
        {/* Google Ads Section */}
        {content.googleAds && showGoogleAds && <section id="google-ads" className="py-24" style={{
        backgroundColor,
        ...glassSectionStyle
      }}>
            <div className="container max-w-6xl mx-auto px-4">
              <AnimatedSection>
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl md:text-4xl font-display font-bold" style={{
                      color: textColor
                    }}>Google Ads Strategy</h2>
                        <CalloutBadge text="Paid Search" variant="important" />
                      </div>
                      <p style={{
                    color: textMutedColor
                  }}>Search, Shopping, Display & YouTube</p>
                    </div>
                  </div>
                  {content.googleAds.budget && <div className="text-right">
                      <p className="text-3xl font-display font-bold" style={{
                  color: secondaryColor
                }}>{content.googleAds.budget}</p>
                      <p className="text-sm" style={{
                  color: textMutedColor
                }}>Annual Budget</p>
                    </div>}
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <p className="text-lg mb-12 max-w-4xl" style={{
              color: textMutedColor
            }}>
                  {content.googleAds.strategy}
                </p>
              </AnimatedSection>

              {/* Campaigns Grid */}
              {content.googleAds.campaigns && content.googleAds.campaigns.length > 0 && <AnimatedSection delay={200}>
                  <div className="grid md:grid-cols-2 gap-6 mb-12">
                    {content.googleAds.campaigns.map((campaign, i) => <div key={i} className="genie-card p-6 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-display font-semibold" style={{
                    color: textColor
                  }}>{campaign.type}</h3>
                          <span className="font-bold" style={{
                    color: secondaryColor
                  }}>{campaign.budget}</span>
                        </div>
                        <p className="mb-4" style={{
                  color: textMutedColor
                }}>{campaign.target}</p>
                        {campaign.kpis && campaign.kpis.length > 0 && <div className="flex flex-wrap gap-2">
                            {campaign.kpis.map((kpi, j) => <span key={j} className="px-3 py-1 rounded-full text-sm" style={{
                    backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`,
                    color: primaryColor
                  }}>
                                {kpi}
                              </span>)}
                          </div>}
                      </div>)}
                  </div>
                </AnimatedSection>}

              {/* Budget Scaling Calculator */}
              <AnimatedSection delay={250}>
                <div className="mb-12">
                  <BudgetScalingCalculator primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} initialAdsCount={10} platform="google" />
                </div>
              </AnimatedSection>

              {/* Expected Results */}
              {content.googleAds.expectedResults && <AnimatedSection delay={300}>
                  <div className="genie-card p-8 rounded-2xl" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 10%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`
            }}>
                    <h3 className="text-xl font-display font-semibold mb-6" style={{
                color: textColor
              }}>Projected Performance</h3>
                    {(() => {
                const results = content.googleAds.expectedResults as Record<string, unknown>;
                // Check if results are nested (month1, month3, month6 structure)
                const isNested = 'month1' in results || 'month3' in results || 'month6' in results;
                if (isNested) {
                  // Render timeline-based projections
                  const timeframes = [{
                    key: 'month1',
                    label: 'Month 1',
                    data: results.month1 as Record<string, string> | undefined
                  }, {
                    key: 'month3',
                    label: 'Month 3',
                    data: results.month3 as Record<string, string> | undefined
                  }, {
                    key: 'month6',
                    label: 'Month 6',
                    data: results.month6 as Record<string, string> | undefined
                  }].filter(t => t.data);
                  return <div className="grid md:grid-cols-3 gap-6">
                            {timeframes.map((timeframe, idx) => <div key={timeframe.key} className="p-6 rounded-xl" style={{
                      backgroundColor: `color-mix(in srgb, ${primaryColor} ${5 + idx * 5}%, transparent)`,
                      border: `1px solid ${borderColor}`
                    }}>
                                <h4 className="text-lg font-semibold mb-4 text-center" style={{
                        color: idx === 2 ? secondaryColor : primaryColor
                      }}>
                                  {timeframe.label}
                                </h4>
                                <div className="space-y-3">
                                  {Object.entries(timeframe.data).map(([metric, val]) => <div key={metric} className="flex justify-between items-center">
                                      <span className="text-sm capitalize" style={{
                            color: textMutedColor
                          }}>
                                        {metric.replace(/([A-Z])/g, ' $1').trim()}
                                      </span>
                                      <span className="font-semibold" style={{
                            color: textColor
                          }}>
                                        {String(val)}
                                      </span>
                                    </div>)}
                                </div>
                              </div>)}
                          </div>;
                }

                // Flat structure - original rendering
                return <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          {Object.entries(results).map(([key, value]) => <div key={key} className="text-center">
                              <p className="text-2xl md:text-3xl font-bold" style={{
                      color: primaryColor
                    }}>
                                <AnimatedCounter value={String(value)} duration={2000} />
                              </p>
                              <p className="capitalize" style={{
                      color: textMutedColor
                    }}>{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            </div>)}
                        </div>;
              })()}
                  </div>
                </AnimatedSection>}
            </div>
          </section>}

        {/* Meta Ads Section */}
        {content.metaAds && showMetaAds && <section id="meta-ads" className="py-24" style={{
        backgroundColor
      }}>
            <div className="container max-w-6xl mx-auto px-4">
              <AnimatedSection>
                <div className="flex flex-col gap-6 mb-12">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-3xl md:text-4xl font-display font-bold" style={{
                        color: textColor
                      }}>Meta Ads Strategy</h2>
                          <CalloutBadge text="Paid Social" variant="important" />
                        </div>
                        <p style={{
                      color: textMutedColor
                    }}>Facebook, Instagram & Threads</p>
                      </div>
                    </div>
                    {content.metaAds.budget && <div className="text-right">
                        <p className="text-3xl font-display font-bold" style={{
                    color: secondaryColor
                  }}>{content.metaAds.budget}</p>
                        <p className="text-sm" style={{
                    color: textMutedColor
                  }}>Annual Budget</p>
                      </div>}
                  </div>
                  
                  {/* Platform Logos */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium" style={{
                  color: textMutedColor
                }}>Platforms:</span>
                    <PlatformBadge platform="meta" />
                    <PlatformBadge platform="instagram" />
                  </div>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <p className="text-lg mb-12 max-w-4xl" style={{
              color: textMutedColor
            }}>
                  {content.metaAds.strategy}
                </p>
              </AnimatedSection>

              {/* Funnel Stages */}
              {content.metaAds.funnelStages && content.metaAds.funnelStages.length > 0 && <AnimatedSection delay={200}>
                  <div className="mb-12 relative">
                    <div className="flex items-center gap-3 mb-6">
                      <h3 className="text-xl font-display font-semibold" style={{
                  color: textColor
                }}>Full-Funnel Approach</h3>
                      <CalloutBadge text="4-Stage Strategy" variant="highlight" />
                    </div>
                    <FloatingAnnotation text="🎯 Optimized for conversion" position="top-right" />
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {content.metaAds.funnelStages.map((stage, i) => <div key={i} className="genie-card p-5 rounded-xl relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1" style={{
                    backgroundColor: primaryColor
                  }} />
                          <h4 className="font-semibold mb-1" style={{
                    color: textColor
                  }}>{stage.stage}</h4>
                          <p className="text-sm mb-3" style={{
                    color: secondaryColor
                  }}>{stage.budget}</p>
                          <ul className="space-y-1">
                            {stage.tactics.map((tactic, j) => <li key={j} className="text-sm flex items-start gap-2" style={{
                      color: textMutedColor
                    }}>
                                <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{
                        color: primaryColor
                      }} />
                                {tactic}
                              </li>)}
                          </ul>
                        </div>)}
                    </div>
                  </div>
                </AnimatedSection>}

              {/* Budget Scaling Calculator for Meta */}
              <AnimatedSection delay={250}>
                <div className="my-12">
                  <BudgetScalingCalculator primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} initialAdsCount={12} platform="meta" />
                </div>
              </AnimatedSection>

              {content.metaAds.creativePillars && content.metaAds.creativePillars.length > 0 && <AnimatedSection delay={300}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium" style={{
                color: textMutedColor
              }}>Creative Pillars:</span>
                    {content.metaAds.creativePillars.map((pillar, i) => <span key={i} className="px-4 py-2 rounded-full text-sm font-medium" style={{
                backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`,
                color: primaryColor
              }}>
                        {pillar}
                      </span>)}
                  </div>
                </AnimatedSection>}
            </div>
          </section>}

        {/* Competitive Ad Analysis Section - Marketing Only */}
        {!isWebsiteOnly && content.competitiveAdAnalysis && content.competitiveAdAnalysis.length > 0 && <CompetitiveAdDisplay items={content.competitiveAdAnalysis} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} clientName={proposal.client_name} />}


        {/* SEO Section - Completely Redesigned */}
        {content.seo && showSeo && <section id="seo" className="py-24" style={glassSectionStyle}>
            <div className="container max-w-6xl mx-auto px-4">
              {/* Hero Header with Client Branding */}
              <AnimatedSection>
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{
                background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`
              }}>
                    <BarChart3 className="w-4 h-4" style={{
                  color: secondaryColor
                }} />
                    <span className="text-sm font-medium" style={{
                  color: secondaryColor
                }}>SEO & Organic Growth Strategy</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-display font-bold mb-4" style={{
                color: textColor
              }}>
                    Dominate Search Results for{' '}
                    <span style={{
                  color: primaryColor
                }}>{proposal.client_name}</span>
                  </h2>
                  <p className="text-lg max-w-3xl mx-auto" style={{
                color: textMutedColor
              }}>
                    Real-time SEO analysis powered by Semrush data. See exactly where you stand and the opportunities waiting to be captured.
                  </p>
                </div>
              </AnimatedSection>

              {/* Interactive Domain Search - Premium Design */}
              <AnimatedSection delay={50}>
                <div className="relative p-8 rounded-3xl mb-12 overflow-hidden" style={{
              background: cardBackground,
              border: `1px solid ${borderColor}`,
              boxShadow: `0 20px 60px color-mix(in srgb, ${primaryColor} 10%, transparent)`
            }}>
                  {/* Background Decoration */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30" style={{
                background: primaryColor
              }} />
                  <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-3xl opacity-20" style={{
                background: secondaryColor
              }} />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                  }}>
                        <Search className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-bold" style={{
                      color: textColor
                    }}>
                          Analyze Any Domain
                        </h3>
                        <p className="text-sm" style={{
                      color: textMutedColor
                    }}>
                          Pre-filled with your website • Pull live Semrush data instantly
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{
                      color: primaryColor
                    }} />
                        <input type="text" placeholder="Enter any domain to analyze..." value={seoSearchDomain} onChange={e => setSeoSearchDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchLiveSeoData()} className="w-full pl-12 pr-4 py-4 rounded-xl text-lg outline-none transition-all focus:ring-2" style={{
                      backgroundColor: isLightBackground ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.3)',
                      border: `2px solid ${borderColor}`,
                      color: textColor
                    }} />
                      </div>
                      <button onClick={() => fetchLiveSeoData()} disabled={isFetchingSeo || !seoSearchDomain.trim()} className="flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100" style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    color: 'white',
                    boxShadow: `0 10px 30px color-mix(in srgb, ${primaryColor} 40%, transparent)`
                  }}>
                        {isFetchingSeo ? <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Analyzing...
                          </> : <>
                            <Sparkles className="w-5 h-5" />
                            Get SEO Insights
                          </>}
                      </button>
                    </div>

                    {/* Platform Attribution */}
                    <div className="flex items-center gap-4 mt-6 pt-6" style={{
                  borderTop: `1px solid ${borderColor}`
                }}>
                      <span className="text-sm" style={{
                    color: textMutedColor
                  }}>Data powered by:</span>
                      <PlatformBadge platform="semrush" />
                      <PlatformBadge platform="google" />
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {/* Live SEO Dashboard */}
              {(() => {
            const seoMetrics = liveSeoData?.seoMetrics || content.currentState?.seoMetrics;
            const topKeywords = liveSeoData?.topKeywords || content.currentState?.topKeywords;
            const competitors = liveSeoData?.competitors || content.currentState?.competitors;
            return seoMetrics ? <>
                    {/* Metrics Cards - Premium Design */}
                    <AnimatedSection delay={100}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
                        {[{
                    label: 'Organic Keywords',
                    value: seoMetrics.keywords,
                    icon: Target,
                    color: primaryColor
                  }, {
                    label: 'Monthly Traffic',
                    value: seoMetrics.traffic,
                    icon: TrendingUp,
                    color: secondaryColor
                  }, {
                    label: 'Domain Authority',
                    value: seoMetrics.domainAuthority,
                    icon: Shield,
                    color: accentColor
                  }, {
                    label: 'Backlinks',
                    value: seoMetrics.backlinks,
                    icon: Layers,
                    color: primaryColor
                  }].map((metric, i) => {
                    const MetricIcon = metric.icon;
                    return <div key={i} className="relative p-6 rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all" style={{
                      background: cardBackground,
                      border: `1px solid ${borderColor}`,
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
                    }}>
                              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" style={{
                        background: metric.color
                      }} />
                              <div className="relative">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{
                          background: `color-mix(in srgb, ${metric.color} 15%, transparent)`
                        }}>
                                  <MetricIcon className="w-5 h-5" style={{
                            color: metric.color
                          }} />
                                </div>
                                <p className="text-3xl md:text-4xl font-display font-bold mb-1" style={{
                          color: metric.color
                        }}>
                                  <AnimatedCounter value={metric.value || '0'} duration={2000} />
                                </p>
                                <p className="text-sm" style={{
                          color: textMutedColor
                        }}>{metric.label}</p>
                              </div>
                            </div>;
                  })}
                      </div>
                    </AnimatedSection>

                    {/* Custom Keywords Section for Client */}
                    {topKeywords && topKeywords.length > 0 && <AnimatedSection delay={150}>
                        <div className="p-8 rounded-3xl mb-12" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                              <h3 className="text-2xl font-display font-bold mb-2" style={{
                        color: textColor
                      }}>
                                Your Top Ranking Keywords
                              </h3>
                              <p className="text-sm" style={{
                        color: textMutedColor
                      }}>
                                Live keyword rankings for {liveSeoData?.domain || content.currentState?.domain}
                              </p>
                            </div>
                            {liveSeoData?.lastUpdated && <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{
                      background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                      color: secondaryColor
                    }}>
                                <Clock className="w-3 h-3" />
                                Updated: {liveSeoData.lastUpdated}
                              </div>}
                          </div>
                          
                          <div className="grid gap-3">
                            {topKeywords.slice(0, 6).map((kw, i) => <div key={i} className="flex items-center justify-between p-4 rounded-xl transition-all hover:scale-[1.01]" style={{
                      background: isLightBackground ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${borderColor}`
                    }}>
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{
                          background: kw.position <= 3 ? `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 70%, ${primaryColor}))` : kw.position <= 10 ? `color-mix(in srgb, ${primaryColor} 20%, transparent)` : cardBackground,
                          color: kw.position <= 3 ? 'white' : kw.position <= 10 ? primaryColor : textMutedColor,
                          border: kw.position > 10 ? `1px solid ${borderColor}` : 'none'
                        }}>
                                    #{kw.position}
                                  </div>
                                  <div>
                                    <p className="font-medium" style={{
                            color: textColor
                          }}>{kw.keyword}</p>
                                    <p className="text-xs" style={{
                            color: textMutedColor
                          }}>
                                      {kw.volume?.toLocaleString()} monthly searches
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right hidden sm:block">
                                    <p className="text-xs font-medium" style={{
                            color: textMutedColor
                          }}>Difficulty</p>
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-2 rounded-full overflow-hidden" style={{
                              background: borderColor
                            }}>
                                        <div className="h-full rounded-full transition-all" style={{
                                width: `${kw.difficulty}%`,
                                background: kw.difficulty < 30 ? '#22c55e' : kw.difficulty < 60 ? '#eab308' : '#ef4444'
                              }} />
                                      </div>
                                      <span className="text-xs font-medium" style={{
                              color: kw.difficulty < 30 ? '#22c55e' : kw.difficulty < 60 ? '#eab308' : '#ef4444'
                            }}>
                                        {kw.difficulty}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>)}
                          </div>
                        </div>
                      </AnimatedSection>}

                    {/* Competitor Landscape + Chart */}
                    {competitors && competitors.length > 0 && <AnimatedSection delay={200}>
                        <div className="grid md:grid-cols-2 gap-6 mb-12">
                          {/* Competitors List */}
                          <div className="p-8 rounded-3xl" style={{
                    background: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}>
                            <h3 className="text-xl font-display font-bold mb-6" style={{
                      color: textColor
                    }}>
                              Your SEO Competitors
                            </h3>
                            <div className="space-y-4">
                              {competitors.slice(0, 4).map((comp, i) => <div key={i} className="flex items-center justify-between p-4 rounded-xl" style={{
                        background: isLightBackground ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${borderColor}`
                      }}>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{
                            background: `color-mix(in srgb, ${primaryColor} ${100 - i * 20}%, transparent)`,
                            color: i === 0 ? 'white' : primaryColor
                          }}>
                                      {i + 1}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm" style={{
                              color: textColor
                            }}>{comp.domain}</p>
                                      <p className="text-xs" style={{
                              color: textMutedColor
                            }}>
                                        {comp.commonKeywords} shared keywords
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold" style={{
                            color: secondaryColor
                          }}>
                                      {comp.organicTraffic?.toLocaleString() || '-'}
                                    </p>
                                    <p className="text-xs" style={{
                            color: textMutedColor
                          }}>traffic/mo</p>
                                  </div>
                                </div>)}
                            </div>
                          </div>

                          {/* Traffic Comparison Chart */}
                          <div className="p-8 rounded-3xl" style={{
                    background: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}>
                            <h3 className="text-xl font-display font-bold mb-6" style={{
                      color: textColor
                    }}>
                              Traffic Comparison
                            </h3>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[{
                          name: 'You',
                          traffic: parseInt(seoMetrics.traffic?.replace(/,/g, '') || '0'),
                          fill: primaryColor
                        }, ...competitors.slice(0, 3).map((comp, idx) => ({
                          name: comp.domain.split('.')[0].substring(0, 10),
                          traffic: comp.organicTraffic || 0,
                          fill: `color-mix(in srgb, ${secondaryColor} ${80 - idx * 20}%, transparent)`
                        }))]} layout="vertical" margin={{
                          top: 5,
                          right: 20,
                          left: 60,
                          bottom: 5
                        }}>
                                  <XAxis type="number" tickFormatter={value => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()} stroke={textMutedColor} fontSize={11} />
                                  <YAxis type="category" dataKey="name" stroke={textMutedColor} fontSize={11} width={55} />
                                  <Tooltip contentStyle={{
                            backgroundColor: cardBackground,
                            border: `1px solid ${borderColor}`,
                            borderRadius: '12px',
                            color: textColor,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                          }} formatter={(value: number) => [value.toLocaleString() + ' visits/mo', 'Traffic']} />
                                  <Bar dataKey="traffic" radius={[0, 8, 8, 0]}>
                                    {[0, 1, 2, 3].map(index => <Cell key={`cell-${index}`} fill={index === 0 ? primaryColor : `color-mix(in srgb, ${secondaryColor} ${80 - index * 15}%, ${backgroundColor})`} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </AnimatedSection>}

                    {/* Keyword Gap - Opportunities */}
                    {liveSeoData?.keywordGap && liveSeoData.keywordGap.length > 0 && <AnimatedSection delay={250}>
                        <div className="p-8 rounded-3xl mb-12" style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 8%, ${cardBackground}), ${cardBackground})`,
                  border: `1px solid ${borderColor}`
                }}>
                          <div className="flex items-start gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
                      background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})`
                    }}>
                              <Target className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-display font-bold mb-2" style={{
                        color: textColor
                      }}>
                                🎯 Keyword Opportunities for {proposal.client_name}
                              </h3>
                              <p style={{
                        color: textMutedColor
                      }}>
                                These are keywords your competitors rank for that you're missing. Each represents untapped traffic potential.
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-3">
                            {liveSeoData.keywordGap.slice(0, 6).map((gap, i) => {
                      const priorityScore = gap.volume / 100 * (100 - gap.difficulty) / 100;
                      const priority = priorityScore > 50 ? 'High' : priorityScore > 20 ? 'Medium' : 'Low';
                      return <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl transition-all hover:scale-[1.01]" style={{
                        background: cardBackground,
                        border: priority === 'High' ? `2px solid color-mix(in srgb, ${secondaryColor} 50%, transparent)` : `1px solid ${borderColor}`,
                        boxShadow: priority === 'High' ? `0 4px 20px color-mix(in srgb, ${secondaryColor} 15%, transparent)` : 'none'
                      }}>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <p className="font-semibold" style={{
                              color: textColor
                            }}>{gap.keyword}</p>
                                      {priority === 'High' && <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1" style={{
                              background: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`,
                              color: secondaryColor
                            }}>
                                          <Sparkles className="w-3 h-3" />
                                          Quick Win
                                        </span>}
                                    </div>
                                    <p className="text-xs" style={{
                            color: textMutedColor
                          }}>
                                      Competitor "{gap.competitorDomain}" ranks #{gap.competitorPosition} for this keyword
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="text-center">
                                      <p className="text-lg font-bold" style={{
                              color: primaryColor
                            }}>
                                        {gap.volume?.toLocaleString()}
                                      </p>
                                      <p className="text-xs" style={{
                              color: textMutedColor
                            }}>searches/mo</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-lg font-bold" style={{
                              color: gap.difficulty < 30 ? '#22c55e' : gap.difficulty < 60 ? '#eab308' : '#ef4444'
                            }}>
                                        {gap.difficulty}%
                                      </p>
                                      <p className="text-xs" style={{
                              color: textMutedColor
                            }}>difficulty</p>
                                    </div>
                                  </div>
                                </div>;
                    })}
                          </div>

                          <div className="mt-6 p-4 rounded-xl flex items-start gap-3" style={{
                    background: `color-mix(in srgb, ${primaryColor} 10%, transparent)`
                  }}>
                            <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" style={{
                      color: primaryColor
                    }} />
                            <p className="text-sm" style={{
                      color: textColor
                    }}>
                              <strong>Strategy Tip:</strong> Focus on "Quick Win" keywords first. These have high search volume and low difficulty, 
                              meaning you can rank faster and capture traffic within 3-6 months.
                            </p>
                          </div>
                        </div>
                      </AnimatedSection>}
                  </> : (/* Loading/Empty State */
            <AnimatedSection delay={100}>
                    <div className="p-12 rounded-3xl text-center" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`
              }}>
                      {isFetchingSeo ? <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-12 h-12 animate-spin" style={{
                    color: primaryColor
                  }} />
                          <p className="text-lg font-medium" style={{
                    color: textColor
                  }}>
                            Analyzing SEO data...
                          </p>
                          <p className="text-sm" style={{
                    color: textMutedColor
                  }}>
                            Pulling live metrics from Semrush
                          </p>
                        </div> : <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
                    background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                  }}>
                            <Search className="w-8 h-8" style={{
                      color: primaryColor
                    }} />
                          </div>
                          <p className="text-lg font-medium" style={{
                    color: textColor
                  }}>
                            Enter a domain above to see SEO insights
                          </p>
                          <p className="text-sm" style={{
                    color: textMutedColor
                  }}>
                            Get real-time keyword rankings, traffic data, and competitor analysis
                          </p>
                        </div>}
                    </div>
                  </AnimatedSection>);
          })()}

              {/* SEO Strategy Pillars */}
              <AnimatedSection delay={300}>
                <div className="mt-12">
                  <h3 className="text-2xl font-display font-bold text-center mb-8" style={{
                color: textColor
              }}>
                    Our SEO Approach for {proposal.client_name}
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {content.seo.technical && content.seo.technical.length > 0 && <div className="p-6 rounded-2xl group hover:scale-[1.02] transition-all" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{
                    background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                  }}>
                          <Zap className="w-6 h-6" style={{
                      color: primaryColor
                    }} />
                        </div>
                        <h4 className="text-lg font-semibold mb-4" style={{
                    color: textColor
                  }}>Technical SEO</h4>
                        <ul className="space-y-3">
                          {content.seo.technical.slice(0, 4).map((item, i) => <li key={i} className="flex items-start gap-2 text-sm" style={{
                      color: textMutedColor
                    }}>
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{
                        color: primaryColor
                      }} />
                              {item}
                            </li>)}
                        </ul>
                      </div>}
                    {content.seo.onPage && content.seo.onPage.length > 0 && <div className="p-6 rounded-2xl group hover:scale-[1.02] transition-all" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{
                    background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`
                  }}>
                          <FileText className="w-6 h-6" style={{
                      color: secondaryColor
                    }} />
                        </div>
                        <h4 className="text-lg font-semibold mb-4" style={{
                    color: textColor
                  }}>On-Page SEO</h4>
                        <ul className="space-y-3">
                          {content.seo.onPage.slice(0, 4).map((item, i) => <li key={i} className="flex items-start gap-2 text-sm" style={{
                      color: textMutedColor
                    }}>
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{
                        color: secondaryColor
                      }} />
                              {item}
                            </li>)}
                        </ul>
                      </div>}
                    {content.seo.offPage && content.seo.offPage.length > 0 && <div className="p-6 rounded-2xl group hover:scale-[1.02] transition-all" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{
                    background: `color-mix(in srgb, ${accentColor} 15%, transparent)`
                  }}>
                          <Globe className="w-6 h-6" style={{
                      color: accentColor
                    }} />
                        </div>
                        <h4 className="text-lg font-semibold mb-4" style={{
                    color: textColor
                  }}>Off-Page SEO</h4>
                        <ul className="space-y-3">
                          {content.seo.offPage.slice(0, 4).map((item, i) => <li key={i} className="flex items-start gap-2 text-sm" style={{
                      color: textMutedColor
                    }}>
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{
                        color: accentColor
                      }} />
                              {item}
                            </li>)}
                        </ul>
                      </div>}
                  </div>
                </div>
              </AnimatedSection>

              {/* Projected Results */}
              {content.seo.expectedResults && <AnimatedSection delay={400}>
                  <div className="mt-12 p-8 rounded-3xl relative overflow-hidden" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, ${cardBackground}), color-mix(in srgb, ${secondaryColor} 10%, ${cardBackground}))`,
              border: `1px solid ${borderColor}`
            }}>
                    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-20" style={{
                background: secondaryColor
              }} />
                    <div className="relative z-10">
                      <div className="text-center mb-8">
                        <h3 className="text-2xl font-display font-bold mb-2" style={{
                    color: textColor
                  }}>
                          Projected Results for {proposal.client_name}
                        </h3>
                        <p className="text-sm" style={{
                    color: textMutedColor
                  }}>
                          Expected growth over 12 months with our SEO strategy
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        {Object.entries(content.seo.expectedResults).map(([key, value], i) => <div key={key} className="text-center">
                            <p className="text-3xl md:text-4xl font-display font-bold mb-2" style={{
                      color: i === 0 ? primaryColor : i === 1 ? secondaryColor : accentColor
                    }}>
                              <AnimatedCounter value={String(value)} duration={2000} />
                            </p>
                            <p className="text-sm capitalize" style={{
                      color: textMutedColor
                    }}>
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                          </div>)}
                      </div>
                    </div>
                  </div>
                </AnimatedSection>}

              {/* Keyword Strategy - Integrated into SEO */}
              {content.keywordStrategy && (
                <div className="mt-16">
                  <KeywordStrategy 
                    keywordStrategy={content.keywordStrategy} 
                    liveSeoData={liveSeoData}
                    primaryColor={primaryColor} 
                    secondaryColor={secondaryColor} 
                    textColor={textColor} 
                    textMutedColor={textMutedColor} 
                    cardBackground={cardBackground} 
                    borderColor={borderColor} 
                    clientName={proposal.client_name} 
                  />
                </div>
              )}
            </div>
          </section>}

        {/* Live Dashboard & Reporting Section - Right after SEO */}
        {showLiveDashboard && <section id="live-dashboard" className="py-24 relative overflow-hidden" style={{
          background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${primaryColor} 3%, ${backgroundColor}))`
        }}>
          <div className="container max-w-6xl mx-auto px-4 relative z-10">
            <AnimatedSection>
              <div className="text-center mb-16">
                <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
                  Real-Time Intelligence
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
                  <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                    Live Performance Dashboard
                  </h2>
                  <CalloutBadge text="24/7 Access" variant="highlight" />
                </div>
                <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
                  Your custom dashboard with real-time metrics across all channels. Track performance, ROI, and campaign health at a glance.
                </p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={100}>
              <div className="p-8 rounded-3xl relative overflow-hidden" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 25px 50px -15px ${primaryColor}20`
              }}>
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                  {[
                    { icon: BarChart3, label: 'Ad Spend', value: 'Real-time' },
                    { icon: TrendingUp, label: 'Conversions', value: 'Live' },
                    { icon: DollarSign, label: 'ROAS', value: 'Updated' },
                    { icon: Users, label: 'Leads', value: 'Instant' }
                  ].map((item, i) => (
                    <div key={i} className="text-center p-4 rounded-xl" style={{ background: `color-mix(in srgb, ${primaryColor} 10%, transparent)` }}>
                      <item.icon className="w-8 h-8 mx-auto mb-2" style={{ color: primaryColor }} />
                      <p className="font-bold" style={{ color: textColor }}>{item.label}</p>
                      <p className="text-sm" style={{ color: secondaryColor }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <span className="text-sm font-medium" style={{ color: textMutedColor }}>Integrated with:</span>
                  <PlatformBadge platform="ga4" />
                  <PlatformBadge platform="google" />
                  <PlatformBadge platform="meta" />
                  <PlatformBadge platform="looker" />
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>}

        {/* Content Strategy Section - Marketing Only (after reporting) */}
        {!isWebsiteOnly && content.contentStrategy && (
          <ContentStrategy
            contentStrategy={content.contentStrategy}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            textColor={textColor}
            textMutedColor={textMutedColor}
            cardBackground={cardBackground}
            borderColor={borderColor}
            clientName={proposal.client_name}
          />
        )}

        {/* Analytics Section */}
        {content.analytics && showAnalytics && <section id="analytics" className="py-24 relative overflow-hidden" style={{
          background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor}))`
        }}>
            {/* Subtle grid background */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }} />
            
            <div className="container max-w-6xl mx-auto px-4 relative z-10">
              <AnimatedSection>
                <div className="flex flex-col gap-6 mb-12">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-3xl md:text-4xl font-display font-bold" style={{
                      color: textColor
                    }}>Analytics & Measurement</h2>
                        <CalloutBadge text="Data-Driven" variant="important" />
                      </div>
                      <p style={{
                    color: textMutedColor
                  }}>Data-Driven Decision Making</p>
                    </div>
                  </div>
                  
                  {/* Platform Logos */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium" style={{
                  color: textMutedColor
                }}>Tech Stack:</span>
                    <PlatformBadge platform="ga4" />
                    <PlatformBadge platform="gtm" />
                    <PlatformBadge platform="looker" />
                  </div>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <p className="text-lg mb-6 max-w-4xl" style={{
              color: textMutedColor
            }}>
                  {content.analytics.strategy}
                </p>
                <div className="flex items-center gap-3 mb-12 p-4 rounded-xl" style={{
                  backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`
                }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{
                    backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`
                  }}>
                    <Monitor className="w-5 h-5" style={{ color: primaryColor }} />
                  </div>
                  <p className="font-medium" style={{ color: textColor }}>
                    You'll receive a live dashboard to monitor all ads and results 24/7.
                  </p>
                </div>
              </AnimatedSection>

              {/* Dashboards */}
              {content.analytics.dashboards && content.analytics.dashboards.length > 0 && <AnimatedSection delay={200}>
                  <div className="grid md:grid-cols-4 gap-4 mb-12">
                    {content.analytics.dashboards.map((dashboard, i) => <div key={i} className="p-5 rounded-xl text-center backdrop-blur-sm transition-all duration-300 hover:scale-105" style={{
                      backgroundColor: cardBackground,
                      border: `1px solid ${borderColor}`,
                      boxShadow: `0 10px 30px -10px ${primaryColor}15`
                    }}>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{
                  backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`
                }}>
                          <BarChart3 className="w-6 h-6" style={{
                    color: primaryColor
                  }} />
                        </div>
                        <p className="font-medium" style={{
                  color: textColor
                }}>{dashboard}</p>
                      </div>)}
                  </div>
                </AnimatedSection>}

              {/* Tech Stack */}
              {content.analytics.stack && content.analytics.stack.length > 0 && <AnimatedSection delay={300}>
                  <div className="flex flex-wrap gap-3">
                    <span className="font-medium" style={{
                color: textMutedColor
              }}>Additional Tools:</span>
                    {content.analytics.stack.map((tool, i) => <span key={i} className="px-4 py-2 rounded-full text-sm" style={{
                backgroundColor: cardBackground,
                color: textColor
              }}>
                        {tool}
                      </span>)}
                  </div>
                </AnimatedSection>}
            </div>
          </section>}

        {/* Social Media Section - Premium Futuristic Design */}
        {content.socialMedia && showSocialMedia && <section id="social" className="py-24 relative overflow-hidden" style={{
        background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${primaryColor} 3%, ${backgroundColor}))`
      }}>
            {/* Animated grid background */}
            <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
            
            <div className="container max-w-6xl mx-auto px-4 relative z-10">
              <AnimatedSection>
                <div className="text-center mb-16">
                  <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{
                color: secondaryColor
              }}>
                    Community & Engagement
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
                    <h2 className="text-3xl md:text-5xl font-display font-bold" style={{
                  color: textColor
                }}>
                      Social Media Strategy
                    </h2>
                    <CalloutBadge text="Multi-Platform" variant="important" />
                  </div>
                  <p className="text-lg max-w-3xl mx-auto mb-6" style={{
                color: textMutedColor
              }}>
                    {content.socialMedia.strategy}
                  </p>
                  
                  {/* Platform Logos - Fixed 6 platforms */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span className="text-sm font-medium" style={{
                  color: textMutedColor
                }}>Platforms:</span>
                    <PlatformBadge platform="linkedin" />
                    <PlatformBadge platform="facebook" />
                    <PlatformBadge platform="instagram" />
                    <PlatformBadge platform="tiktok" />
                    <PlatformBadge platform="youtube" />
                    <PlatformBadge platform="gmb" />
                  </div>
                </div>
              </AnimatedSection>

              {/* Platform Grid - Fixed 6 platforms in 3x3 layout */}
              <AnimatedSection delay={100}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { key: 'linkedin' as SocialPlatformKey, name: 'LinkedIn', description: 'Professional networking and B2B content to build industry authority and generate quality leads.' },
                    { key: 'facebook' as SocialPlatformKey, name: 'Facebook', description: 'Community engagement and targeted advertising to reach your ideal audience at scale.' },
                    { key: 'instagram' as SocialPlatformKey, name: 'Instagram', description: 'Visual storytelling through posts, stories, and reels to showcase your brand personality.' },
                    { key: 'tiktok' as SocialPlatformKey, name: 'TikTok', description: 'Short-form video content to capture attention and connect with younger demographics.' },
                    { key: 'youtube' as SocialPlatformKey, name: 'YouTube', description: 'Long-form video content for tutorials, testimonials, and brand storytelling.' },
                    { key: 'gmb' as SocialPlatformKey, name: 'Google My Business', description: 'Local presence optimization with posts, updates, and customer engagement.' }
                  ].map((platform, i) => {
                    const config = platformConfig[platform.key];
                    const Logo = config?.Logo;
                    const gradient = config?.gradient || `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
                    const glowColor = config?.color || primaryColor;
                    
                    return <div key={i} className="relative p-6 rounded-2xl overflow-hidden group transform transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1" style={{
                      background: `color-mix(in srgb, ${cardBackground} 95%, transparent)`,
                      border: `1px solid ${borderColor}`,
                      boxShadow: `0 15px 40px -10px ${glowColor}15`
                    }}>
                      {/* Platform accent bar with glow */}
                      <div className="absolute top-0 left-0 right-0 h-1" style={{
                        background: gradient
                      }} />
                      <div className="absolute top-0 left-0 right-0 h-12 opacity-10" style={{
                        background: `linear-gradient(180deg, ${glowColor}, transparent)`
                      }} />
                      
                      {/* Hover glow effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                        background: `radial-gradient(circle at 50% 0%, ${glowColor}10, transparent 60%)`
                      }} />
                      
                      <div className="flex flex-col items-center text-center relative">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 mb-4 transform transition-transform duration-300 group-hover:scale-110" style={{
                          background: gradient,
                          boxShadow: `0 8px 25px -5px ${glowColor}40`
                        }}>
                          {Logo && <Logo className="w-7 h-7 text-white" />}
                        </div>
                        <h3 className="text-lg font-bold mb-3" style={{
                          color: textColor
                        }}>{platform.name}</h3>
                        <p className="text-sm leading-relaxed" style={{
                          color: textMutedColor
                        }}>{platform.description}</p>
                      </div>
                    </div>;
                  })}
                </div>
              </AnimatedSection>

              {/* Community Management - Premium Glass Card */}
              {content.socialMedia.communityManagement && <AnimatedSection delay={200}>
                  <div className="mt-12 p-10 rounded-3xl text-center relative overflow-hidden backdrop-blur-md transform transition-all duration-300 hover:scale-[1.01]" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 90%, ${primaryColor} 10%), color-mix(in srgb, ${cardBackground} 95%, ${secondaryColor} 5%))`,
              border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
              boxShadow: `0 25px 50px -15px ${primaryColor}15`
            }}>
                    {/* Decorative elements */}
                    <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full blur-3xl opacity-10" style={{
                background: primaryColor
              }} />
                    <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full blur-3xl opacity-10" style={{
                background: secondaryColor
              }} />
                    
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                }}>
                        <MessageSquare className="w-10 h-10 text-white" />
                      </div>
                      <h4 className="text-2xl font-bold mb-4" style={{
                  color: textColor
                }}>Community Management</h4>
                      <p className="max-w-2xl mx-auto text-lg leading-relaxed" style={{
                  color: textMutedColor
                }}>{content.socialMedia.communityManagement}</p>
                      
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-6 mt-8 pt-8" style={{
                  borderTop: `1px solid ${borderColor}`
                }}>
                        <div>
                          <p className="text-3xl font-bold" style={{
                      color: primaryColor
                    }}>&lt;2hr</p>
                          <p className="text-sm" style={{
                      color: textMutedColor
                    }}>Response Time</p>
                        </div>
                        <div>
                          <p className="text-3xl font-bold" style={{
                      color: secondaryColor
                    }}>24/7</p>
                          <p className="text-sm" style={{
                      color: textMutedColor
                    }}>Monitoring</p>
                        </div>
                        <div>
                          <p className="text-3xl font-bold" style={{
                      color: accentColor
                    }}>100%</p>
                          <p className="text-sm" style={{
                      color: textMutedColor
                    }}>Engagement</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>}
            </div>
          </section>}

        {/* Email Section - Premium Component */}
        {content.email && showEmail && (
          <EmailCampaignsSection
            clientName={proposal.client_name}
            clientIndustry={(content as any).detectedIndustry || 'Business'}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
            textColor={textColor}
            textMutedColor={textMutedColor}
            cardBackground={cardBackground}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
            content={content.email}
          />
        )}

        {/* Texting Campaigns Section - Premium Component */}
        {showTexting && (
          <TextingCampaignsSection
            clientName={proposal.client_name}
            clientIndustry={(content as any).detectedIndustry || 'Business'}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
            textColor={textColor}
            textMutedColor={textMutedColor}
            cardBackground={cardBackground}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
            content={content.textMarketing}
          />
        )}

        {/* Melleka App Section - Shows when Email or Texting is enabled */}
        {(showEmail || showTexting) && (
          <MellekaAppSection
            clientName={proposal.client_name}
            clientLogo={currentLogo || content.hero?.clientLogo || content.brandStyles?.logo}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            textColor={textColor}
            textMutedColor={textMutedColor}
            cardBackground={cardBackground}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
          />
        )}

        {/* Reputation Management Section - Advanced Gold+ (tier >= 4) */}
        {showReputationManagement && <section id="reputation" className="py-24 relative overflow-hidden" style={{ backgroundColor }}>
          <div className="container max-w-6xl mx-auto px-4 relative z-10">
            <AnimatedSection>
              <div className="text-center mb-16">
                <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
                  Brand Protection & Growth
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
                  <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                    Reputation Management
                  </h2>
                  <CalloutBadge text="5-Star Strategy" variant="important" />
                </div>
                <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
                  Monitor, manage, and grow your online reputation across Google, Yelp, Facebook, and industry-specific platforms.
                </p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={100}>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Star, title: 'Review Monitoring', desc: '24/7 alerts for new reviews across all platforms' },
                  { icon: MessageSquare, title: 'Response Management', desc: 'Professional responses within 24 hours' },
                  { icon: TrendingUp, title: 'Review Generation', desc: 'Automated campaigns to collect positive reviews' },
                  { icon: Shield, title: 'Crisis Management', desc: 'Rapid response protocols for negative PR' }
                ].map((item, i) => (
                  <div key={i} className="p-6 rounded-2xl text-center transition-all duration-300 hover:scale-105" style={{
                    background: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}>
                    <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                    }}>
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold mb-2" style={{ color: textColor }}>{item.title}</h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>}

        {/* AI Solutions Section - Only for marketing/combined proposals */}
        {!isWebsiteOnly && content.aiSolutions && showAiFeatures && <AiSolutionsSection content={content.aiSolutions} clientName={proposal?.client_name || 'Your Business'} clientBusinessContext={content.executiveSummary?.overview || proposal?.project_description || ''} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} showVoiceAgent={packageServices?.aiVoiceAgent?.included} showChatbot={packageServices?.aiChatBot?.included} showAiTools={false} />}

        {/* Automation & CRM Section - Only for marketing/combined proposals with Premium Silver+ */}
        {!isWebsiteOnly && showAutomationCrm && (content.automationWorkflows || content.crmManagement || content.textMarketing) && <AutomationCrmSection automationContent={{
        workflowAutomation: content.automationWorkflows
      }} crmContent={content.crmManagement || {}} textMarketingContent={content.textMarketing || {}} clientName={proposal?.client_name || 'Your Business'} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} textMutedColor={textMutedColor} cardBackground={cardBackground} borderColor={borderColor} showWorkflowAutomation={packageServices?.automatedSystems?.included || false} showAutomatedSystems={packageServices?.automatedSystems?.included || false} showCrm={packageServices?.automatedCRM?.included || false} showTextMarketing={packageServices?.textingCampaigns?.included || false} />}

        {/* Influencer & UGC Section - Premium Silver+ (tier >= 5) */}
        {(showInfluencer || showUgc) && <section id="influencer" className="py-24 relative overflow-hidden" style={{
          background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${secondaryColor} 3%, ${backgroundColor}))`
        }}>
          {/* Animated background orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl animate-pulse opacity-20" style={{
              background: `radial-gradient(circle, ${primaryColor}, transparent)`
            }} />
            <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl animate-pulse opacity-15" style={{
              background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
              animationDelay: '1s'
            }} />
          </div>

          <div className="container max-w-6xl mx-auto px-4 relative z-10">
            <AnimatedSection>
              <div className="text-center mb-16">
                <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
                  Creator Partnerships
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
                  <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                    Influencer & UGC Program
                  </h2>
                  <CalloutBadge text="Authentic Reach" variant="highlight" />
                </div>
                <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
                  Strategic partnerships with micro and macro influencers combined with authentic user-generated content to expand your reach and build brand advocacy.
                </p>
              </div>
            </AnimatedSection>
            
            {/* Influencer Tiers */}
            {showInfluencer && (
              <AnimatedSection delay={100}>
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                  {[
                    { tier: 'Micro', range: '10K-100K', benefit: 'High engagement, niche audiences' },
                    { tier: 'Mid-Tier', range: '100K-500K', benefit: 'Balanced reach and authenticity' },
                    { tier: 'Macro', range: '500K+', benefit: 'Maximum brand awareness' }
                  ].map((item, i) => (
                    <div key={i} className="p-8 rounded-3xl relative overflow-hidden group" style={{
                      background: cardBackground,
                      border: `1px solid ${borderColor}`,
                      boxShadow: `0 20px 40px -15px ${primaryColor}15`
                    }}>
                      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ 
                        background: i === 0 ? primaryColor : i === 1 ? secondaryColor : accentColor 
                      }} />
                      <Users className="w-12 h-12 mb-4" style={{ color: i === 0 ? primaryColor : i === 1 ? secondaryColor : accentColor }} />
                      <h3 className="text-xl font-bold mb-2" style={{ color: textColor }}>{item.tier} Influencers</h3>
                      <p className="text-2xl font-bold mb-4" style={{ color: secondaryColor }}>{item.range} followers</p>
                      <p style={{ color: textMutedColor }}>{item.benefit}</p>
                    </div>
                  ))}
                </div>
              </AnimatedSection>
            )}

            {/* UGC Content Subsection */}
            {content.ugc && showUgc && (
              <>
                <AnimatedSection delay={showInfluencer ? 200 : 100}>
                  <div className="text-center mb-12">
                    <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                      <h3 className="text-2xl md:text-3xl font-display font-bold" style={{ color: textColor }}>
                        User-Generated Content
                      </h3>
                      <CalloutBadge text="Creator-Led" variant="important" />
                    </div>
                    <p className="text-lg max-w-3xl mx-auto mb-6" style={{ color: textMutedColor }}>
                      {content.ugc.strategy}
                    </p>
                    
                    {/* Platform Logos */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <span className="text-sm font-medium" style={{ color: textMutedColor }}>Platforms:</span>
                      <PlatformBadge platform="tiktok" />
                      <PlatformBadge platform="instagram" />
                      <PlatformBadge platform="youtube" />
                    </div>
                  </div>
                </AnimatedSection>

                {/* UGC Content Types - Compact Cards */}
                <AnimatedSection delay={showInfluencer ? 300 : 200}>
                  <div className="grid md:grid-cols-3 gap-6 mb-12">
                    {[
                      { icon: Video, title: 'Product Reviews', desc: 'TikTok & Instagram Reels', tags: ['UGC', 'Viral'] },
                      { icon: Camera, title: 'Testimonials', desc: 'Stories & Static Posts', tags: ['Authentic', 'Trust'] },
                      { icon: Play, title: 'Tutorials', desc: 'YouTube Shorts & Guides', tags: ['Educational', 'How-To'] }
                    ].map((item, i) => (
                      <div key={i} className="p-6 rounded-2xl text-center transition-all duration-300 hover:scale-105" style={{
                        background: cardBackground,
                        border: `1px solid ${borderColor}`
                      }}>
                        <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{
                          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                        }}>
                          <item.icon className="w-7 h-7 text-white" />
                        </div>
                        <h4 className="font-bold mb-2" style={{ color: textColor }}>{item.title}</h4>
                        <p className="text-sm mb-3" style={{ color: textMutedColor }}>{item.desc}</p>
                        <div className="flex justify-center gap-2">
                          {item.tags.map((tag, j) => (
                            <span key={j} className="px-2 py-1 rounded-full text-xs" style={{
                              background: `${j === 0 ? primaryColor : secondaryColor}20`,
                              color: j === 0 ? primaryColor : secondaryColor
                            }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AnimatedSection>

                {/* Annual Output & Content Pillars */}
                <AnimatedSection delay={showInfluencer ? 400 : 300}>
                  <div className="grid md:grid-cols-2 gap-6">
                    {content.ugc.annualOutput && (
                      <div className="relative p-8 rounded-3xl text-center overflow-hidden group" style={{
                        background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, ${cardBackground}), color-mix(in srgb, ${secondaryColor} 10%, ${cardBackground}))`,
                        border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 20%)`
                      }}>
                        <Award className="w-12 h-12 mx-auto mb-4" style={{ color: secondaryColor }} />
                        <p className="text-4xl font-display font-bold mb-2" style={{ color: textColor }}>
                          <AnimatedCounter value={content.ugc.annualOutput} />
                        </p>
                        <p className="text-lg font-medium" style={{ color: textMutedColor }}>Content Pieces Annually</p>
                      </div>
                    )}
                    
                    {content.ugc.contentPillars && content.ugc.contentPillars.length > 0 && (
                      <div className="p-8 rounded-3xl" style={{
                        background: cardBackground,
                        border: `1px solid ${borderColor}`
                      }}>
                        <h4 className="font-bold text-xl mb-4" style={{ color: textColor }}>Content Pillars</h4>
                        <div className="flex flex-wrap gap-2">
                          {content.ugc.contentPillars.map((pillar, i) => (
                            <span key={i} className="px-4 py-2 rounded-lg text-sm font-medium" style={{
                              background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 20%, transparent), color-mix(in srgb, ${secondaryColor} 15%, transparent))`,
                              color: primaryColor,
                              border: `1px solid color-mix(in srgb, ${primaryColor} 30%, transparent)`
                            }}>
                              {pillar}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AnimatedSection>
              </>
            )}
          </div>
        </section>}

        {/* Television Ads Section - Premium Silver+ (tier >= 5) */}
        {showTvAds && <section id="tv-ads" className="py-24 relative overflow-hidden" style={{ backgroundColor }}>
          <div className="container max-w-6xl mx-auto px-4 relative z-10">
            <AnimatedSection>
              <div className="text-center mb-16">
                <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
                  Traditional Media Dominance
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
                  <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                    Television Advertising
                  </h2>
                  <CalloutBadge text="Mass Reach" variant="important" />
                </div>
                <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
                  Strategic TV placements for maximum brand awareness. We handle everything from creative production to media buying and performance tracking.
                </p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={100}>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-8 rounded-3xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
                  <Monitor className="w-12 h-12 mb-4" style={{ color: primaryColor }} />
                  <h3 className="text-xl font-bold mb-4" style={{ color: textColor }}>What's Included</h3>
                  <ul className="space-y-3">
                    {['Commercial Production', 'Media Planning & Buying', 'Audience Targeting', 'Performance Analytics', 'A/B Testing Creatives'].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span style={{ color: textColor }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-8 rounded-3xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                  <h3 className="text-xl font-bold mb-4 text-white">Expected Reach</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { value: '500K+', label: 'Households' },
                      { value: '2-4x', label: 'Brand Recall' },
                      { value: '15-30s', label: 'Spot Length' },
                      { value: 'Local+', label: 'Markets' }
                    ].map((stat, i) => (
                      <div key={i} className="text-center">
                        <p className="text-3xl font-bold text-white">{stat.value}</p>
                        <p className="text-sm text-white/80">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>}


        {!isWebsiteOnly && <section id="budget" className="py-24 relative overflow-hidden" style={{
        backgroundColor,
        ...glassSectionStyle
      }}>
            {/* Animated Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10 animate-pulse" style={{
            background: `radial-gradient(circle, ${primaryColor}, transparent)`
          }} />
              <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" style={{
            background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
            animationDelay: '1s'
          }} />
              {/* Floating Dollar Signs */}
              <div className="absolute top-1/4 left-10 opacity-5">
                <DollarSign className="w-24 h-24 animate-bounce" style={{
              color: primaryColor,
              animationDuration: '3s'
            }} />
              </div>
              <div className="absolute bottom-1/3 right-16 opacity-5">
                <TrendingUp className="w-20 h-20 animate-bounce" style={{
              color: secondaryColor,
              animationDuration: '4s',
              animationDelay: '1.5s'
            }} />
              </div>
            </div>
            
            <div className="container max-w-6xl mx-auto px-4 relative z-10">
              <AnimatedSection>
                {/* Premium Header with 3D Investment Card */}
                <div className="flex flex-col lg:flex-row lg:items-stretch justify-between gap-8 mb-12">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: `0 10px 40px ${primaryColor}40`
                }}>
                      <DollarSign className="w-8 h-8 text-white" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full animate-ping" style={{
                    backgroundColor: secondaryColor
                  }} />
                    </div>
                    <div>
                      <h2 className="text-3xl md:text-4xl font-display font-bold" style={{
                    color: textColor
                  }}>Investment Overview</h2>
                      <p style={{
                    color: textMutedColor
                  }}>
                        {displayPackage ? `${displayPackage.name} Package` : 'Budget Allocation & ROI'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 3D Investment Summary Card */}
                  <div className="relative group" style={{
                perspective: '1000px'
              }}>
                    <div className="p-6 rounded-2xl backdrop-blur-md transition-all duration-500 group-hover:scale-[1.02]" style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, ${cardBackground}), color-mix(in srgb, ${secondaryColor} 10%, ${cardBackground}))`,
                  border: `2px solid color-mix(in srgb, ${primaryColor} 30%, transparent)`,
                  boxShadow: `0 20px 60px ${primaryColor}20, inset 0 1px 0 rgba(255,255,255,0.1)`
                }}>
                      <div className="flex items-center gap-6">
                        <div className="text-left">
                          <p className="text-sm font-medium mb-1" style={{
                        color: textMutedColor
                      }}>Monthly Investment</p>
                          <p className="text-4xl font-display font-bold" style={{
                        color: primaryColor
                      }}>
                            <AnimatedCounter value={`$${monthlyInvestment.toLocaleString()}`} duration={2000} />
                          </p>
                        </div>
                        <div className="w-px h-16" style={{
                      backgroundColor: borderColor
                    }} />
                        <div className="text-left">
                          <p className="text-sm font-medium mb-1" style={{
                        color: textMutedColor
                      }}>Annual Total</p>
                          <p className="text-2xl font-display font-bold" style={{
                        color: secondaryColor
                      }}>
                            <AnimatedCounter value={`$${annualInvestment.toLocaleString()}`} duration={2500} />
                          </p>
                        </div>
                      </div>
                      {/* Savings callout */}
                      <div className="mt-4 pt-4 border-t flex items-center gap-2" style={{
                    borderColor
                  }}>
                        <Sparkles className="w-4 h-4" style={{
                      color: secondaryColor
                    }} />
                        <span className="text-sm" style={{
                      color: textMutedColor
                    }}>
                          Save <span className="font-semibold" style={{
                        color: secondaryColor
                      }}>15%</span> with annual commitment
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

            {/* Package Highlights */}
            {displayPackage && <AnimatedSection delay={100}>
                <div className="glass-banner p-8 rounded-2xl mb-12">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-2xl font-display font-semibold" style={{
                    color: textColor
                  }}>{displayPackage.name}</h3>
                      <p style={{
                    color: textMutedColor
                  }}>{displayPackage.tagline}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-2 rounded-full text-sm font-medium" style={{
                    background: glassBackground,
                    color: textColor
                  }}>
                        {displayPackage.channels}
                      </span>
                      <span className="px-4 py-2 rounded-full text-sm font-medium" style={{
                    background: glassBackground,
                    color: textColor
                  }}>
                        {displayPackage.turnaround} Turnaround
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {displayPackage.highlights.map((highlight, i) => <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full" style={{
                    backgroundColor: secondaryColor
                  }} />
                        <span style={{
                    color: textColor
                  }}>{highlight}</span>
                      </div>)}
                    {showDedicatedTeam && <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full" style={{
                    backgroundColor: secondaryColor
                  }} />
                        <span style={{
                    color: textColor
                  }}>Dedicated Team</span>
                      </div>}
                    {showLiveDashboard && <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full" style={{
                    backgroundColor: secondaryColor
                  }} />
                        <span style={{
                    color: textColor
                  }}>Live Dashboard</span>
                      </div>}
                    {showReputationManagement && <div className="flex items-center gap-2 text-sm">
                        
                        
                      </div>}
                  </div>
                  
                  {packageServices && <div className="mt-6 pt-6 border-t" style={{
                borderColor: borderColor
              }}>
                      <h4 className="font-medium mb-4" style={{
                  color: textColor
                }}>Services Included in This Package:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {packageServices.channels?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>{displayPackage?.channels} Advertising</span>
                          </div>}
                        {packageServices.meetings?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>{packageServices.meetings.frequency} Meetings</span>
                          </div>}
                        {packageServices.slackChannel?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Dedicated Slack</span>
                          </div>}
                        {packageServices.optimization?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>{packageServices.optimization.frequency} Optimization</span>
                          </div>}
                        {packageServices.seo?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>{packageServices.seo.level} SEO</span>
                          </div>}
                        {packageServices.analytics?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>{packageServices.analytics.level} Analytics</span>
                          </div>}
                        {packageServices.emailCampaigns?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Email Campaigns</span>
                          </div>}
                        {packageServices.socialMediaManagement?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Social Media</span>
                          </div>}
                        {packageServices.ugcContent?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>{packageServices.ugcContent.count} UGC Pieces</span>
                          </div>}
                        {(packageServices.aiVoiceAgent?.included || packageServices.aiChatBot?.included) && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>
                              {packageServices.aiVoiceAgent?.included && packageServices.aiChatBot?.included ? 'AI Voice & Chatbot' : packageServices.aiVoiceAgent?.included ? 'AI Voice Agent' : 'AI Chatbot'}
                            </span>
                          </div>}
                        {packageServices.reputationManagement?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Reputation Mgmt</span>
                          </div>}
                        {packageServices.dedicatedTeam?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Dedicated Team</span>
                          </div>}
                        {packageServices.liveDashboard?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Live Dashboard</span>
                          </div>}
                        {packageServices.influencerMarketing?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>Influencer Marketing</span>
                          </div>}
                        {packageServices.televisionAds?.included && <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span style={{
                      color: textMutedColor
                    }}>TV Advertising</span>
                          </div>}
                      </div>
                    </div>}
                </div>
              </AnimatedSection>}

            {/* ROI Projections removed here (previously empty wrappers were causing build errors) */}
          </div>
        </section>}

        {/* Budget Section - Website Only */}
        {isWebsiteOnly && displayWebsitePackage && <section id="budget" className="py-24 relative overflow-hidden" style={{
        backgroundColor: 'transparent'
      }}>
            {/* Animated Background */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-20 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" style={{
            background: `radial-gradient(circle, ${primaryColor}, transparent)`
          }} />
              <div className="absolute bottom-20 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-10 animate-pulse" style={{
            background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
            animationDelay: '1.5s'
          }} />
            </div>
            
            <div className="container max-w-6xl mx-auto px-4 relative z-10">
              {/* Premium Header */}

              {/* Website Package Highlights - Futuristic Card */}
              <AnimatedSection delay={100}>
                <div className="relative p-8 rounded-3xl mb-12 overflow-hidden backdrop-blur-sm" style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${primaryColor} 8%, ${cardBackground}), ${cardBackground})`,
              border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`,
              boxShadow: `0 20px 60px ${primaryColor}10`
            }}>
                  {/* Decorative corner gradient */}
                  
                  
                  <div className="relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                      <div>
                        <h3 className="text-2xl font-display font-semibold" style={{
                      color: textColor
                    }}>
                          {displayWebsitePackage.name}
                        </h3>
                        <p style={{
                      color: textMutedColor
                    }}>
                          {displayWebsitePackage.pages} • Custom Design
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[{
                    icon: CheckCircle2,
                    label: 'Unlimited Revisions',
                    show: true
                  }, {
                    icon: Users,
                    label: 'Dedicated Manager',
                    show: true
                  }, {
                    icon: Smartphone,
                    label: 'Mobile Responsive',
                    show: true
                  }, {
                    icon: Shield,
                    label: 'SSL Security',
                    show: true
                  }, {
                    icon: Search,
                    label: 'SEO Optimized',
                    show: displayWebsitePackage.services?.seo?.included
                  }, {
                    icon: BarChart3,
                    label: 'Google Analytics',
                    show: displayWebsitePackage.services?.googleAnalytics?.included
                  }, {
                    icon: Target,
                    label: 'Meta Pixel',
                    show: displayWebsitePackage.services?.metaPixel?.included
                  }, {
                    icon: Zap,
                    label: 'Automations',
                    show: displayWebsitePackage.services?.automations?.included
                  }, {
                    icon: FileText,
                    label: `${displayWebsitePackage.services?.blogs?.count || 2} Blog Posts`,
                    show: displayWebsitePackage.services?.blogs?.included
                  }].filter(item => item.show).map((item, i) => <div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-105 group/feature" style={{
                    background: `color-mix(in srgb, ${secondaryColor} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${secondaryColor} 15%, transparent)`
                  }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/feature:rotate-12" style={{
                      backgroundColor: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`
                    }}>
                            <item.icon className="w-4 h-4" style={{
                        color: secondaryColor
                      }} />
                          </div>
                          <span className="text-sm font-medium" style={{
                      color: textColor
                    }}>{item.label}</span>
                        </div>)}
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {/* What's Included Summary - 3D Cards */}
              <AnimatedSection delay={200}>
                <div className="grid md:grid-cols-3 gap-6">
                  {[{
                icon: Globe,
                color: primaryColor,
                title: 'Custom Design',
                desc: 'No templates. 100% custom designed to match your brand and vision.'
              }, {
                icon: Smartphone,
                color: secondaryColor,
                title: 'Mobile-First',
                desc: 'Perfect on every device: phone, tablet, and desktop.'
              }, {
                icon: Zap,
                color: primaryColor,
                title: 'Speed Optimized',
                desc: 'Fast loading times for better user experience and SEO.'
              }].map((card, i) => <div key={i} className="relative group p-8 rounded-2xl text-center transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2 overflow-hidden" style={{
                background: `linear-gradient(145deg, color-mix(in srgb, ${card.color} 10%, ${cardBackground}), ${cardBackground})`,
                border: `1px solid color-mix(in srgb, ${card.color} 20%, transparent)`,
                boxShadow: `0 15px 50px ${card.color}10`
              }}>
                      {/* Glow on hover */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-30 transition-opacity blur-xl -z-10" style={{
                  backgroundColor: card.color
                }} />
                      
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:rotate-12" style={{
                  background: `linear-gradient(135deg, ${card.color}30, ${card.color}10)`,
                  border: `1px solid ${card.color}30`,
                  boxShadow: `0 8px 32px ${card.color}20`
                }}>
                        <card.icon className="w-8 h-8" style={{
                    color: card.color
                  }} />
                      </div>
                      <h4 className="font-display font-semibold text-lg mb-2" style={{
                  color: textColor
                }}>{card.title}</h4>
                      <p className="text-sm" style={{
                  color: textMutedColor
                }}>{card.desc}</p>
                    </div>)}
                </div>
              </AnimatedSection>
            </div>
          </section>}

        {/* Timeline Section - Fixed 12-Month Roadmap */}
        <MarketingTimelineSection
          sectionStyle={{
            backgroundColor,
            ...glassSectionStyle,
          }}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          textColor={textColor}
          textMutedColor={textMutedColor}
          cardBackground={cardBackground}
          borderColor={borderColor}
        />

        {/* Trusted By Section */}
        

        {/* CTA Section - with Neon Glow on Dark */}
        <section id="cta" className="py-24 relative overflow-hidden" style={{
        backgroundColor
      }}>
          {/* Neon Background Effects for Dark Mode */}
          {!isLightBackground && <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse" style={{
            background: `radial-gradient(circle, ${primaryColor}, transparent)`,
            animationDuration: '4s'
          }} />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15 animate-pulse" style={{
            background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
            animationDuration: '5s'
          }} />
            </div>}
          
          <div className="container max-w-5xl mx-auto px-4 text-center relative z-10">
            <div className="inline-block mb-4">
              <CalloutBadge text="Take Action" variant="new" />
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor,
            textShadow: !isLightBackground ? `0 0 40px ${primaryColor}30` : 'none'
          }}>
              {isWebsiteOnly ? content.cta?.headline || "Ready to Launch Your New Website?" : content.cta?.headline || "Ready to Transform Your Marketing?"}
            </h2>
            <p className="text-xl mb-12 max-w-2xl mx-auto" style={{
            color: textMutedColor
          }}>
              {isWebsiteOnly ? content.cta?.subheadline || "Let's create a stunning website that converts visitors into customers" : content.cta?.subheadline || "Let's build something extraordinary together"}
            </p>

            {/* Summary Stats - Neon Enhanced */}
            {dynamicCtaStats.length > 0 && <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mb-12 pt-10 overflow-visible">
                {dynamicCtaStats.map((stat, i) => <div key={i} className="relative group overflow-visible">
                    {i === 0 && <FloatingAnnotation text="Best Value" position="top-right" color={secondaryColor} />}
                    {/* Neon glow on dark backgrounds */}
                    {!isLightBackground && <div className="absolute inset-0 rounded-2xl blur-xl opacity-15 group-hover:opacity-30 transition-opacity" style={{
                backgroundColor: i === 0 ? secondaryColor : primaryColor
              }} />}
                    <div className="relative p-6 rounded-2xl transition-all duration-300 group-hover:scale-105" style={{
                background: isLightBackground ? glassBackground : `linear-gradient(145deg, rgba(20, 20, 50, 0.8), rgba(10, 10, 30, 0.6))`,
                backdropFilter: isLightBackground ? 'blur(8px)' : 'blur(20px)',
                border: i === 0 ? `2px solid ${secondaryColor}` : `1px solid ${isLightBackground ? borderColor : `color-mix(in srgb, ${primaryColor} 30%, rgba(255,255,255,0.08))`}`,
                boxShadow: isLightBackground ? i === 0 ? `0 0 25px ${secondaryColor}30` : 'none' : i === 0 ? `0 0 40px ${secondaryColor}40, 0 20px 60px rgba(0,0,0,0.4)` : `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${primaryColor}15`
              }}>
                      <p className="text-3xl md:text-4xl font-display font-bold" style={{
                  color: i === 0 ? secondaryColor : primaryColor,
                  textShadow: !isLightBackground ? `0 0 20px ${i === 0 ? secondaryColor : primaryColor}50` : 'none'
                }}>
                        <AnimatedCounter value={stat.value} duration={2000} />
                      </p>
                      <p className="text-sm mt-1" style={{
                  color: textMutedColor
                }}>{stat.label}</p>
                    </div>
                  </div>)}
              </div>}

            {/* Next Steps */}
            {content.cta?.nextSteps && content.cta.nextSteps.length > 0 && <div className="mb-12">
                <h3 className="text-xl font-semibold mb-6" style={{
              color: textColor
            }}>Next Steps</h3>
                <div className="flex flex-wrap justify-center gap-4">
                  {content.cta.nextSteps.map((step, i) => <div key={i} className="flex items-center gap-2 px-5 py-3 rounded-full" style={{
                background: glassBackground
              }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{
                  backgroundColor: secondaryColor,
                  color: isLightColor(secondaryColor) ? '#1a1a2e' : '#ffffff'
                }}>
                        {i + 1}
                      </span>
                      <span style={{
                  color: textColor
                }}>
                        {step.toLowerCase().includes('discovery call') ? <>
                            {step}{' '}
                            <a href="https://www.calendly.com/mellekamarketing/meeting" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-90" style={{
                      backgroundColor: primaryColor,
                      color: isLightColor(primaryColor) ? '#1a1a2e' : '#ffffff'
                    }}>
                              Schedule Now
                            </a>
                          </> : step}
                      </span>
                    </div>)}
                </div>
              </div>}

            {/* Melleka Contact - Always consistent */}
            <div className="inline-block p-8 rounded-2xl" style={{
            background: glassBackground,
            border: `1px solid ${borderColor}`
          }}>
              <p className="font-display font-semibold text-lg mb-4" style={{
              color: textColor
            }}>Get in Touch with Melleka</p>
              <div className="space-y-2">
                <a href="mailto:Support@MellekaMarketing.com" className="hover:underline block text-lg" style={{
                color: secondaryColor
              }}>
                  Support@MellekaMarketing.com
                </a>
                <a href="tel:818-599-2696" className="block hover:opacity-80" style={{
                color: textMutedColor
              }}>
                  818.599.2696
                </a>
              </div>
            </div>

            <div className="mt-12">
              <a href={isWebsiteOnly ? "https://melleka.com/pricing/#website-pricing" : "https://melleka.com/pricing/"} target="_blank" rel="noopener noreferrer" className="inline-block px-12 py-5 rounded-xl text-xl font-bold hover:scale-105 transition-transform" style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              color: isLightColor(primaryColor) ? '#1a1a2e' : '#ffffff',
              boxShadow: `0 8px 32px color-mix(in srgb, ${primaryColor} 40%, transparent)`
            }}>
                Let's Get Started
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative overflow-hidden" style={{
        background: `linear-gradient(180deg, ${backgroundColor} 0%, color-mix(in srgb, ${primaryColor} 8%, ${backgroundColor}) 100%)`,
        borderTop: `1px solid ${borderColor}`
      }}>
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 opacity-30" style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 100%, color-mix(in srgb, ${primaryColor} 15%, transparent), transparent)`
        }} />
          
          <div className="relative container max-w-6xl mx-auto px-4 py-16">
            {/* Main Footer Content */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
              {/* Brand Column */}
              <div className="flex flex-col items-center md:items-start">
                <a href="https://melleka.com" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 mb-4 transition-transform hover:scale-105">
                  <img src={isLightBackground ? mellekaLogoDark : mellekaLogo} alt="Melleka Marketing" className="h-14 object-contain" />
                </a>
                <p className="text-sm text-center md:text-left max-w-xs" style={{
                color: textMutedColor
              }}>
                  Empowering businesses with data-driven marketing strategies that deliver measurable results.
                </p>
              </div>

              {/* Contact Column */}
              <div className="flex flex-col items-center">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4" style={{
                color: secondaryColor
              }}>
                  Get in Touch
                </h4>
                <div className="flex flex-col items-center gap-3">
                  <a href="mailto:Support@MellekaMarketing.com" className="flex items-center gap-2 text-sm transition-colors hover:opacity-80" style={{
                  color: textColor
                }}>
                    <Mail className="w-4 h-4" style={{
                    color: primaryColor
                  }} />
                    Support@MellekaMarketing.com
                  </a>
                  <a href="tel:818-599-2696" className="flex items-center gap-2 text-sm transition-colors hover:opacity-80" style={{
                  color: textColor
                }}>
                    <Phone className="w-4 h-4" style={{
                    color: primaryColor
                  }} />
                    818.599.2696
                  </a>
                  <a href="https://melleka.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm transition-colors hover:opacity-80" style={{
                  color: textColor
                }}>
                    <ExternalLink className="w-4 h-4" style={{
                    color: primaryColor
                  }} />
                    melleka.com
                  </a>
                </div>
              </div>

              {/* CTA Column */}
              <div className="flex flex-col items-center md:items-end">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4" style={{
                color: secondaryColor
              }}>
                  Ready to Start?
                </h4>
                <a href="https://melleka.com/pricing/" target="_blank" rel="noopener noreferrer" className="group relative px-6 py-3 rounded-xl font-semibold text-sm overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg" style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                color: 'white',
                boxShadow: `0 4px 20px color-mix(in srgb, ${primaryColor} 40%, transparent)`
              }}>
                  <span className="relative z-10 flex items-center gap-2">
                    View Pricing
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </a>
                <p className="text-xs mt-3 text-center md:text-right" style={{
                color: textMutedColor
              }}>
                  No commitment required
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px mb-8" style={{
            background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`
          }} />

            {/* Bottom Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs" style={{
              color: textMutedColor
            }}>
                Proposal by Melleka Marketing • {new Date(proposal.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              </p>
              <p className="text-xs" style={{
              color: `color-mix(in srgb, ${textMutedColor} 70%, transparent)`
            }}>
                © {new Date().getFullYear()} Melleka Marketing. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
        
        {/* Debug Overlay - enable with ?debug=1 in URL */}
        <ScrollDebugOverlay
          activeSection={activeSection}
          navItems={isWebsiteOnly ? WEBSITE_NAV_ITEMS : MARKETING_NAV_ITEMS}
          isEnabled={debugEnabled}
        />
      </main>
    </div>;
};

// Main wrapper component with ErrorBoundary and AdminEditProvider
const ProposalView = () => {
  return <ErrorBoundary>
      <AdminEditProvider>
        <ProposalViewInner />
      </AdminEditProvider>
    </ErrorBoundary>;
};
export default ProposalView;
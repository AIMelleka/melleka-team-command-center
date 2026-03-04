export interface PackageFeature {
  name: string;
  included: boolean;
  details?: string;
}

export interface MarketingPackage {
  id: string;
  name: string;
  tier: number;
  monthlyPrice: number;
  description: string;
  tagline: string;
  channels: string;
  turnaround: string;
  features: PackageFeature[];
  services: {
    channels: { included: boolean; count?: string; details?: string };
    meetings: { included: boolean; frequency?: string; duration?: string; details?: string };
    slackChannel: { included: boolean; details?: string };
    optimization: { included: boolean; frequency?: string; details?: string };
    setupManagement: { included: boolean; level?: string; details?: string };
    adCopyContent: { included: boolean; level?: string; details?: string };
    analytics: { included: boolean; level?: string; details?: string };
    seo: { included: boolean; level?: string; details?: string };
    websiteUpdate: { included: boolean; level?: string; details?: string };
    landingPages: { included: boolean; level?: string; details?: string };
    funnelCreation: { included: boolean; level?: string; details?: string };
    workflow: { included: boolean; level?: string; details?: string };
    audit: { included: boolean; details?: string };
    onlineListing: { included: boolean; details?: string };
    reporting: { included: boolean; type?: string; details?: string };
    dedicatedTeam: { included: boolean; details?: string };
    emailCampaigns: { included: boolean; details?: string };
    textingCampaigns: { included: boolean; details?: string };
    abTesting: { included: boolean; details?: string };
    creatives: { included: boolean; details?: string };
    liveDashboard: { included: boolean; details?: string };
    salesConsultation: { included: boolean; details?: string };
    marketingConsultation: { included: boolean; details?: string };
    reputationManagement: { included: boolean; details?: string };
    socialMediaManagement: { included: boolean; details?: string };
    aiVoiceAgent: { included: boolean; details?: string };
    aiChatBot: { included: boolean; details?: string };
    additionalHours: { included: boolean; hours?: number; details?: string };
    inPersonContent: { included: boolean; details?: string };
    experienceConsultation: { included: boolean; details?: string };
    ugcContent: { included: boolean; count?: number; details?: string };
    influencerMarketing: { included: boolean; details?: string };
    televisionAds: { included: boolean; details?: string };
    automatedSystems: { included: boolean; details?: string };
    automatedCRM: { included: boolean; details?: string };
    aiCRMManager: { included: boolean; details?: string };
    aiToolsOnDemand: { included: boolean; details?: string };
  };
  highlights: string[];
  recommended?: boolean;
  color: string;
  category: 'basic' | 'advanced' | 'premium';
}

// Melleka Marketing Packages - EXACT service mappings per tier
export const MARKETING_PACKAGES: MarketingPackage[] = [
  // BASIC PLANS
  {
    id: 'basic-silver',
    name: 'Basic Silver',
    tier: 1,
    monthlyPrice: 1499,
    description: 'Perfect for businesses just starting their digital marketing journey',
    tagline: 'Start Your Growth',
    channels: '1 Channel',
    turnaround: '4-5 Days',
    color: 'from-slate-400 to-slate-500',
    category: 'basic',
    features: [
      { name: 'Monthly Optimization', included: true },
      { name: 'Basic Setup & Management', included: true },
      { name: 'Online Listing Placement', included: true },
      { name: 'Dedicated Slack Channel', included: false },
      { name: 'Weekly Meetings', included: false },
    ],
    services: {
      channels: { included: true, count: '1', details: 'Single channel focus' },
      meetings: { included: false },
      slackChannel: { included: false },
      optimization: { included: true, frequency: 'Monthly' },
      setupManagement: { included: true, level: 'Basic' },
      adCopyContent: { included: false },
      analytics: { included: false },
      seo: { included: false },
      websiteUpdate: { included: false },
      landingPages: { included: false },
      funnelCreation: { included: false },
      workflow: { included: false },
      audit: { included: false },
      onlineListing: { included: true },
      reporting: { included: false },
      dedicatedTeam: { included: false },
      emailCampaigns: { included: false },
      textingCampaigns: { included: false },
      abTesting: { included: false },
      creatives: { included: false },
      liveDashboard: { included: false },
      salesConsultation: { included: false },
      marketingConsultation: { included: false },
      reputationManagement: { included: false },
      socialMediaManagement: { included: false },
      aiVoiceAgent: { included: false },
      aiChatBot: { included: false },
      additionalHours: { included: false },
      inPersonContent: { included: false },
      experienceConsultation: { included: false },
      ugcContent: { included: false },
      influencerMarketing: { included: false },
      televisionAds: { included: false },
      automatedSystems: { included: false },
      automatedCRM: { included: false },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: false },
    },
    highlights: ['1 Channel', '4-5 Day Turnaround', 'Monthly Optimization'],
  },
  {
    id: 'basic-gold',
    name: 'Basic Gold',
    tier: 2,
    monthlyPrice: 2499,
    description: 'Enhanced marketing with bi-weekly strategy calls and advanced setup',
    tagline: 'Accelerate Growth',
    channels: '2 Channels',
    turnaround: '3-4 Days',
    color: 'from-amber-500 to-yellow-500',
    category: 'basic',
    features: [
      { name: 'Bi-Weekly 30-Min Strategy Meeting', included: true },
      { name: 'Dedicated Slack Channel', included: true },
      { name: 'Weekly Optimization', included: true },
      { name: 'Advanced Analytics & Conversion Setup', included: true },
      { name: 'Basic SEO Improvements', included: true },
    ],
    services: {
      channels: { included: true, count: '2', details: 'Two channel strategy' },
      meetings: { included: true, frequency: 'Bi-Weekly', duration: '30 minutes' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Weekly' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Basic' },
      websiteUpdate: { included: true, level: 'Basic' },
      landingPages: { included: false },
      funnelCreation: { included: false },
      workflow: { included: true, level: 'Basic' },
      audit: { included: true, details: 'All Channels' },
      onlineListing: { included: true },
      reporting: { included: false },
      dedicatedTeam: { included: false },
      emailCampaigns: { included: false },
      textingCampaigns: { included: false },
      abTesting: { included: false },
      creatives: { included: false },
      liveDashboard: { included: false },
      salesConsultation: { included: true },
      marketingConsultation: { included: true },
      reputationManagement: { included: false },
      socialMediaManagement: { included: false },
      aiVoiceAgent: { included: false },
      aiChatBot: { included: false },
      additionalHours: { included: false },
      inPersonContent: { included: false },
      experienceConsultation: { included: false },
      ugcContent: { included: false },
      influencerMarketing: { included: false },
      televisionAds: { included: false },
      automatedSystems: { included: false },
      automatedCRM: { included: false },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: false },
    },
    highlights: ['2 Channels', 'Bi-Weekly Meetings', 'Advanced Analytics'],
  },

  // ADVANCED PLANS
  {
    id: 'advanced-silver',
    name: 'Advanced Silver',
    tier: 3,
    monthlyPrice: 4299,
    description: 'Full-service marketing with dedicated team and multi-channel approach',
    tagline: 'Scale Your Business',
    channels: '3 Channels',
    turnaround: '3-4 Days',
    color: 'from-slate-500 to-slate-600',
    category: 'advanced',
    recommended: true,
    features: [
      { name: '1 Hour Monthly Additional Tasks', included: true },
      { name: 'Weekly 30-Min Strategy Meeting', included: true },
      { name: 'Dedicated Team', included: true },
      { name: 'Email & Texting Campaigns', included: true },
      { name: 'Social Media Management', included: true },
      { name: 'Live Performance Dashboard', included: true },
    ],
    services: {
      channels: { included: true, count: '3', details: 'Three channel strategy' },
      meetings: { included: true, frequency: 'Weekly', duration: '30 minutes' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Daily' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Basic & Advanced' },
      websiteUpdate: { included: true, level: 'Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Advanced' },
      audit: { included: true, details: 'All Channels' },
      onlineListing: { included: true },
      reporting: { included: true, type: 'On-Demand' },
      dedicatedTeam: { included: true },
      emailCampaigns: { included: true },
      textingCampaigns: { included: true },
      abTesting: { included: true, details: 'Multiple A/B Tests' },
      creatives: { included: true, details: 'Multiple Creatives' },
      liveDashboard: { included: true },
      salesConsultation: { included: true },
      marketingConsultation: { included: true },
      reputationManagement: { included: false },
      socialMediaManagement: { included: true },
      aiVoiceAgent: { included: false },
      aiChatBot: { included: false },
      additionalHours: { included: true, hours: 1, details: '1 Hour Monthly' },
      inPersonContent: { included: false },
      experienceConsultation: { included: false },
      ugcContent: { included: false },
      influencerMarketing: { included: false },
      televisionAds: { included: false },
      automatedSystems: { included: false },
      automatedCRM: { included: false },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: false },
    },
    highlights: ['3 Channels', 'Dedicated Team', 'Live Dashboard'],
  },
  {
    id: 'advanced-gold',
    name: 'Advanced Gold',
    tier: 4,
    monthlyPrice: 5799,
    description: 'Comprehensive marketing with AI-powered tools and reputation management',
    tagline: 'Dominate Your Market',
    channels: '4 Channels',
    turnaround: '2-3 Days',
    color: 'from-amber-600 to-orange-500',
    category: 'advanced',
    features: [
      { name: '2 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 30-Min Strategy Meeting', included: true },
      { name: 'AI Voice Agent', included: true },
      { name: 'AI Chat Bot', included: true },
      { name: 'Reputation Management', included: true },
    ],
    services: {
      channels: { included: true, count: '4', details: 'Four channel strategy' },
      meetings: { included: true, frequency: 'Weekly', duration: '30 minutes' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Daily' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Basic & Advanced' },
      websiteUpdate: { included: true, level: 'Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Advanced' },
      audit: { included: true, details: 'All Channels' },
      onlineListing: { included: true },
      reporting: { included: true, type: 'On-Demand' },
      dedicatedTeam: { included: true },
      emailCampaigns: { included: true },
      textingCampaigns: { included: true },
      abTesting: { included: true, details: 'Multiple A/B Tests' },
      creatives: { included: true, details: 'Multiple Creatives' },
      liveDashboard: { included: true },
      salesConsultation: { included: true },
      marketingConsultation: { included: true },
      reputationManagement: { included: true },
      socialMediaManagement: { included: true },
      aiVoiceAgent: { included: true },
      aiChatBot: { included: true },
      additionalHours: { included: true, hours: 2, details: '2 Hours Monthly' },
      inPersonContent: { included: false },
      experienceConsultation: { included: false },
      ugcContent: { included: false },
      influencerMarketing: { included: false },
      televisionAds: { included: false },
      automatedSystems: { included: false },
      automatedCRM: { included: false },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: false },
    },
    highlights: ['4 Channels', 'AI Voice & Chat', 'Reputation Management'],
  },

  // PREMIUM PLANS
  {
    id: 'premium-silver',
    name: 'Premium Silver',
    tier: 5,
    monthlyPrice: 7499,
    description: 'Full omni-channel marketing with UGC, influencers, and TV advertising',
    tagline: 'Premium Performance',
    channels: 'Omni-Channel',
    turnaround: '1-2 Days',
    color: 'from-purple-500 to-violet-600',
    category: 'premium',
    features: [
      { name: '3 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 1-Hour Strategy Meeting', included: true },
      { name: 'UGC Content (2 Pieces)', included: true },
      { name: 'Influencer Marketing', included: true },
      { name: 'Television Ads (TV)', included: true },
      { name: 'Automated Systems & CRM', included: true },
    ],
    services: {
      channels: { included: true, count: 'Omni', details: 'All channels included' },
      meetings: { included: true, frequency: 'Weekly', duration: '1 hour' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Daily' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Basic & Advanced' },
      websiteUpdate: { included: true, level: 'Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Advanced' },
      audit: { included: true, details: 'All Channels' },
      onlineListing: { included: true },
      reporting: { included: true, type: 'On-Demand' },
      dedicatedTeam: { included: true },
      emailCampaigns: { included: true },
      textingCampaigns: { included: true },
      abTesting: { included: true, details: 'Multiple A/B Tests' },
      creatives: { included: true, details: 'Multiple Creatives' },
      liveDashboard: { included: true },
      salesConsultation: { included: true },
      marketingConsultation: { included: true },
      reputationManagement: { included: true },
      socialMediaManagement: { included: true },
      aiVoiceAgent: { included: true },
      aiChatBot: { included: true },
      additionalHours: { included: true, hours: 3, details: '3 Hours Monthly' },
      inPersonContent: { included: false },
      experienceConsultation: { included: true },
      ugcContent: { included: true, count: 2, details: '2 UGC pieces' },
      influencerMarketing: { included: true },
      televisionAds: { included: true },
      automatedSystems: { included: true },
      automatedCRM: { included: true },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: false },
    },
    highlights: ['Omni-Channel', 'UGC & Influencers', 'TV Advertising'],
  },
  {
    id: 'premium-gold',
    name: 'Premium Gold',
    tier: 6,
    monthlyPrice: 9499,
    description: 'The ultimate marketing solution with in-person content and AI CRM management',
    tagline: 'Maximum Impact',
    channels: 'Omni-Channel',
    turnaround: '1-2 Days',
    color: 'from-amber-400 to-yellow-300',
    category: 'premium',
    features: [
      { name: '5 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 1.5-Hour Strategy Meeting', included: true },
      { name: 'In-Person Content', included: true },
      { name: 'UGC Content (3 Pieces)', included: true },
      { name: 'AI CRM Manager', included: true },
      { name: 'AI Tools On-Demand', included: true },
    ],
    services: {
      channels: { included: true, count: 'Omni', details: 'All channels included' },
      meetings: { included: true, frequency: 'Weekly', duration: '1.5 hours' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Daily' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Basic & Advanced' },
      websiteUpdate: { included: true, level: 'Basic & Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Basic & Advanced' },
      audit: { included: true, details: 'All Channels' },
      onlineListing: { included: true },
      reporting: { included: true, type: 'On-Demand' },
      dedicatedTeam: { included: true },
      emailCampaigns: { included: true },
      textingCampaigns: { included: true },
      abTesting: { included: true, details: 'Multiple A/B Tests' },
      creatives: { included: true, details: 'Multiple Creatives' },
      liveDashboard: { included: true },
      salesConsultation: { included: true },
      marketingConsultation: { included: true },
      reputationManagement: { included: true },
      socialMediaManagement: { included: true },
      aiVoiceAgent: { included: true },
      aiChatBot: { included: true },
      additionalHours: { included: true, hours: 5, details: '5 Hours Monthly' },
      inPersonContent: { included: true },
      experienceConsultation: { included: true },
      ugcContent: { included: true, count: 3, details: '3 UGC pieces' },
      influencerMarketing: { included: true },
      televisionAds: { included: true },
      automatedSystems: { included: true },
      automatedCRM: { included: true },
      aiCRMManager: { included: true },
      aiToolsOnDemand: { included: true },
    },
    highlights: ['5 Hours Extra Tasks', 'In-Person Content', 'AI CRM Manager'],
  },
];

// Website Design Package Interface
export interface WebsitePackage {
  id: string;
  name: string;
  tier: number;
  price: number;
  description: string;
  tagline: string;
  pages: string;
  color: string;
  category: 'basic' | 'premium' | 'executive';
  features: Array<{ name: string; included: boolean; details?: string }>;
  services: {
    revisions: { included: boolean; details?: string };
    dedicatedManager: { included: boolean; details?: string };
    uniqueDesign: { included: boolean; details?: string };
    pages: { included: boolean; count?: string; details?: string };
    googleAnalytics: { included: boolean; details?: string };
    metaPixel: { included: boolean; details?: string };
    seo: { included: boolean; details?: string };
    automations: { included: boolean; details?: string };
    blogs: { included: boolean; count?: number; details?: string };
    mobileOptimized: { included: boolean; details?: string };
    contactForms: { included: boolean; details?: string };
    socialIntegration: { included: boolean; details?: string };
    speedOptimization: { included: boolean; details?: string };
    securitySSL: { included: boolean; details?: string };
  };
  highlights: string[];
  recommended?: boolean;
}

// Website Design Packages
export const WEBSITE_PACKAGES: WebsitePackage[] = [
  {
    id: 'website-basic',
    name: 'Website Starter',
    tier: 1,
    price: 2900,
    description: 'Perfect for small businesses needing a professional online presence',
    tagline: 'Launch Your Brand Online',
    pages: 'Up to 15',
    color: 'from-slate-400 to-slate-500',
    category: 'basic',
    features: [
      { name: 'Unlimited Revisions', included: true },
      { name: 'Dedicated Manager', included: true },
      { name: 'Unique Design', included: true },
      { name: 'Up to 15 Pages', included: true },
      { name: 'Mobile Responsive', included: true },
    ],
    services: {
      revisions: { included: true, details: 'Unlimited Revisions' },
      dedicatedManager: { included: true, details: 'Personal project manager' },
      uniqueDesign: { included: true, details: 'Custom design tailored to your brand' },
      pages: { included: true, count: '15', details: 'Up to 15 pages' },
      googleAnalytics: { included: false },
      metaPixel: { included: false },
      seo: { included: false },
      automations: { included: false },
      blogs: { included: false },
      mobileOptimized: { included: true, details: 'Fully responsive on all devices' },
      contactForms: { included: true, details: 'Contact & inquiry forms' },
      socialIntegration: { included: true, details: 'Social media links' },
      speedOptimization: { included: true, details: 'Fast loading pages' },
      securitySSL: { included: true, details: 'SSL certificate included' },
    },
    highlights: ['15 Pages', 'Unlimited Revisions', 'Custom Design'],
  },
  {
    id: 'website-premium',
    name: 'Premium Website',
    tier: 2,
    price: 3999,
    description: 'Enhanced website with analytics, tracking, and SEO for growth-focused businesses',
    tagline: 'Grow With Data',
    pages: 'Up to 20',
    color: 'from-amber-500 to-yellow-500',
    category: 'premium',
    recommended: true,
    features: [
      { name: 'Unlimited Revisions', included: true },
      { name: 'Dedicated Manager', included: true },
      { name: 'Unique Design For You', included: true },
      { name: 'Up to 20 Pages', included: true },
      { name: 'Google Analytics', included: true },
      { name: 'Meta Pixel', included: true },
      { name: 'SEO Optimized', included: true },
    ],
    services: {
      revisions: { included: true, details: 'Unlimited Revisions' },
      dedicatedManager: { included: true, details: 'Personal project manager' },
      uniqueDesign: { included: true, details: 'Premium custom design' },
      pages: { included: true, count: '20', details: 'Up to 20 pages' },
      googleAnalytics: { included: true, details: 'Full GA4 setup & configuration' },
      metaPixel: { included: true, details: 'Meta Pixel for retargeting' },
      seo: { included: true, details: 'On-page SEO optimization' },
      automations: { included: false },
      blogs: { included: false },
      mobileOptimized: { included: true, details: 'Fully responsive on all devices' },
      contactForms: { included: true, details: 'Advanced forms with validation' },
      socialIntegration: { included: true, details: 'Full social media integration' },
      speedOptimization: { included: true, details: 'Performance optimized' },
      securitySSL: { included: true, details: 'SSL certificate included' },
    },
    highlights: ['20 Pages', 'SEO Included', 'Analytics Setup'],
  },
  {
    id: 'website-executive',
    name: 'Ultra Premium Website',
    tier: 3,
    price: 5999,
    description: 'The ultimate website package with automation, blog content, and premium features',
    tagline: 'Maximum Impact',
    pages: 'Up to 25+',
    color: 'from-purple-500 to-violet-600',
    category: 'executive',
    features: [
      { name: 'Unlimited Revisions', included: true },
      { name: 'Premium Design', included: true },
      { name: 'Dedicated Manager', included: true },
      { name: 'Up to 25 Pages (Inquire for 25+)', included: true },
      { name: 'Google Analytics', included: true },
      { name: 'Meta Pixel', included: true },
      { name: 'SEO Optimized', included: true },
      { name: 'Automations Included', included: true },
      { name: '2 Blogs Included', included: true },
    ],
    services: {
      revisions: { included: true, details: 'Unlimited Revisions' },
      dedicatedManager: { included: true, details: 'Dedicated project manager' },
      uniqueDesign: { included: true, details: 'Ultra premium custom design' },
      pages: { included: true, count: '25+', details: 'Up to 25+ pages' },
      googleAnalytics: { included: true, details: 'Advanced GA4 with events' },
      metaPixel: { included: true, details: 'Meta Pixel + Conversion API' },
      seo: { included: true, details: 'Comprehensive SEO package' },
      automations: { included: true, details: 'Contact form automations, email sequences' },
      blogs: { included: true, count: 2, details: '2 professionally written blogs' },
      mobileOptimized: { included: true, details: 'Fully responsive on all devices' },
      contactForms: { included: true, details: 'Advanced forms with CRM integration' },
      socialIntegration: { included: true, details: 'Full social media integration' },
      speedOptimization: { included: true, details: 'Maximum performance optimization' },
      securitySSL: { included: true, details: 'SSL + security hardening' },
    },
    highlights: ['25+ Pages', 'Automations', '2 Blogs Included'],
  },
];

export const getWebsitePackageById = (id: string): WebsitePackage | undefined => {
  return WEBSITE_PACKAGES.find(p => p.id === id);
};

export const getPackageById = (id: string): MarketingPackage | undefined => {
  return MARKETING_PACKAGES.find(p => p.id === id);
};

export const getPackagesByCategory = (category: 'basic' | 'advanced' | 'premium'): MarketingPackage[] => {
  return MARKETING_PACKAGES.filter(p => p.category === category);
};

export const comparePackages = (package1Id: string, package2Id: string) => {
  const p1 = getPackageById(package1Id);
  const p2 = getPackageById(package2Id);
  
  if (!p1 || !p2) return null;

  const differences: Array<{
    feature: string;
    inPackage1: string | boolean;
    inPackage2: string | boolean;
    upgradeValue: boolean;
  }> = [];

  const getServiceLabel = (service: Record<string, unknown>): string => {
    if (!service.included) return 'Not included';
    if (typeof service.details === 'string') return service.details;
    if (typeof service.level === 'string') return service.level;
    if (typeof service.frequency === 'string') return service.frequency;
    if (typeof service.count === 'string' || typeof service.count === 'number') return `${service.count}`;
    return 'Included';
  };

  const serviceNames: Record<string, string> = {
    channels: 'Marketing Channels',
    meetings: 'Strategy Meetings',
    slackChannel: 'Dedicated Slack',
    optimization: 'Optimization',
    setupManagement: 'Setup & Management',
    adCopyContent: 'Ad Copy/Content',
    analytics: 'Analytics Setup',
    seo: 'SEO Improvements',
    websiteUpdate: 'Website Updates',
    landingPages: 'Landing Pages',
    funnelCreation: 'Funnel Creation',
    workflow: 'Workflow Automation',
    audit: 'Channel Audit',
    reporting: 'Reporting',
    dedicatedTeam: 'Dedicated Team',
    emailCampaigns: 'Email Campaigns',
    textingCampaigns: 'Texting Campaigns',
    abTesting: 'A/B Testing',
    liveDashboard: 'Live Dashboard',
    reputationManagement: 'Reputation Management',
    socialMediaManagement: 'Social Media Management',
    aiVoiceAgent: 'AI Voice Agent',
    aiChatBot: 'AI Chatbot',
    additionalHours: 'Additional Task Hours',
    ugcContent: 'UGC Content',
    influencerMarketing: 'Influencer Marketing',
    televisionAds: 'Television Ads',
    automatedCRM: 'Automated CRM',
    aiCRMManager: 'AI CRM Manager',
    aiToolsOnDemand: 'AI Tools On Demand',
  };

  Object.entries(p1.services).forEach(([key, value]) => {
    const p2Service = p2.services[key as keyof typeof p2.services];
    const label1 = getServiceLabel(value as Record<string, unknown>);
    const label2 = getServiceLabel(p2Service as Record<string, unknown>);
    
    if (label1 !== label2) {
      differences.push({
        feature: serviceNames[key] || key,
        inPackage1: label1,
        inPackage2: label2,
        upgradeValue: p2.tier > p1.tier
      });
    }
  });

  return {
    package1: p1,
    package2: p2,
    differences,
    priceDifference: p2.monthlyPrice - p1.monthlyPrice
  };
};

// Compare website packages
export const compareWebsitePackages = (package1Id: string, package2Id: string) => {
  const p1 = WEBSITE_PACKAGES.find(p => p.id === package1Id);
  const p2 = WEBSITE_PACKAGES.find(p => p.id === package2Id);
  
  if (!p1 || !p2) return null;

  const differences: Array<{
    feature: string;
    inPackage1: string | boolean;
    inPackage2: string | boolean;
    upgradeValue: boolean;
  }> = [];

  const getServiceLabel = (service: Record<string, unknown>): string => {
    if (!service.included) return 'Not included';
    if (typeof service.details === 'string') return service.details;
    if (typeof service.count === 'string' || typeof service.count === 'number') return `${service.count}`;
    return 'Included';
  };

  const serviceNames: Record<string, string> = {
    revisions: 'Revisions',
    dedicatedManager: 'Dedicated Manager',
    uniqueDesign: 'Custom Design',
    pages: 'Website Pages',
    googleAnalytics: 'Google Analytics',
    metaPixel: 'Meta Pixel',
    seo: 'SEO Optimization',
    automations: 'Automations',
    blogs: 'Blog Content',
    mobileOptimized: 'Mobile Optimized',
    contactForms: 'Contact Forms',
    socialIntegration: 'Social Integration',
    speedOptimization: 'Speed Optimization',
    securitySSL: 'SSL Security',
  };

  Object.entries(p1.services).forEach(([key, value]) => {
    const p2Service = p2.services[key as keyof typeof p2.services];
    const label1 = getServiceLabel(value as Record<string, unknown>);
    const label2 = getServiceLabel(p2Service as Record<string, unknown>);
    
    if (label1 !== label2) {
      differences.push({
        feature: serviceNames[key] || key,
        inPackage1: label1,
        inPackage2: label2,
        upgradeValue: p2.tier > p1.tier
      });
    }
  });

  return {
    package1: p1,
    package2: p2,
    differences,
    priceDifference: p2.price - p1.price
  };
};

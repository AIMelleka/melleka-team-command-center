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
  category: 'basic' | 'advanced' | 'premium' | 'enterprise';
  pricingModel?: string; // e.g. "15% of ad spend" for enterprise custom pricing
  adSpendRange?: string; // e.g. "Under $2K/mo"
}

// Melleka Marketing Packages - EXACT service mappings per tier (synced with melleka.com/pricing)
export const MARKETING_PACKAGES: MarketingPackage[] = [
  // GOOGLE ADS ONLY (Bridge)
  {
    id: 'google-only',
    name: 'Google Ads Only',
    tier: -2,
    monthlyPrice: 999,
    adSpendRange: 'Under $2K/mo',
    description: 'Starter Google Ads management for businesses spending under $2K/month. Basic setup, monthly optimization, and live dashboard.',
    tagline: 'Start With Google',
    channels: 'Google Ads',
    turnaround: '5-7 Days',
    color: 'from-blue-400 to-blue-500',
    category: 'basic',
    features: [
      { name: 'Google Ads Setup & Management', included: true },
      { name: 'Monthly Optimization', included: true },
      { name: 'Basic Ad Copy', included: true },
      { name: 'Live Performance Dashboard', included: true },
    ],
    services: {
      channels: { included: true, count: '1', details: 'Google Ads only' },
      meetings: { included: false },
      slackChannel: { included: false },
      optimization: { included: true, frequency: 'Monthly' },
      setupManagement: { included: true, level: 'Basic' },
      adCopyContent: { included: true, level: 'Basic' },
      analytics: { included: false },
      seo: { included: false },
      websiteUpdate: { included: false },
      landingPages: { included: false },
      funnelCreation: { included: false },
      workflow: { included: false },
      audit: { included: false },
      onlineListing: { included: false },
      reporting: { included: false },
      dedicatedTeam: { included: false },
      emailCampaigns: { included: false },
      textingCampaigns: { included: false },
      abTesting: { included: false },
      creatives: { included: false },
      liveDashboard: { included: true },
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
    highlights: ['Google Ads Only', 'Under $2K Budget', 'Live Dashboard'],
  },

  // META ADS ONLY (Bridge)
  {
    id: 'meta-only',
    name: 'Meta Ads Only',
    tier: -1,
    monthlyPrice: 1499,
    adSpendRange: 'Under $2K/mo',
    description: 'Starter Meta (Facebook/Instagram) Ads management for businesses spending under $2K/month. Basic setup, monthly optimization, and live dashboard.',
    tagline: 'Start With Meta',
    channels: 'Meta Ads',
    turnaround: '5-7 Days',
    color: 'from-indigo-400 to-blue-500',
    category: 'basic',
    features: [
      { name: 'Meta Ads Setup & Management', included: true },
      { name: 'Monthly Optimization', included: true },
      { name: 'Basic Ad Copy & Creative', included: true },
      { name: 'Live Performance Dashboard', included: true },
    ],
    services: {
      channels: { included: true, count: '1', details: 'Meta Ads only' },
      meetings: { included: false },
      slackChannel: { included: false },
      optimization: { included: true, frequency: 'Monthly' },
      setupManagement: { included: true, level: 'Basic' },
      adCopyContent: { included: true, level: 'Basic' },
      analytics: { included: false },
      seo: { included: false },
      websiteUpdate: { included: false },
      landingPages: { included: false },
      funnelCreation: { included: false },
      workflow: { included: false },
      audit: { included: false },
      onlineListing: { included: false },
      reporting: { included: false },
      dedicatedTeam: { included: false },
      emailCampaigns: { included: false },
      textingCampaigns: { included: false },
      abTesting: { included: false },
      creatives: { included: false },
      liveDashboard: { included: true },
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
    highlights: ['Meta Ads Only', 'Under $2K Budget', 'Live Dashboard'],
  },

  // GOOGLE + META (Bridge)
  {
    id: 'google-meta',
    name: 'Google + Meta',
    tier: 0,
    monthlyPrice: 2499,
    adSpendRange: 'Under $5K/mo',
    description: 'Starter Google and Meta Ads management for businesses spending under $5K/month. Includes Slack channel, monthly strategy call, bi-weekly optimization, and live dashboard.',
    tagline: 'Google + Meta',
    channels: 'Google + Meta',
    turnaround: '4-5 Days',
    color: 'from-violet-400 to-purple-500',
    category: 'basic',
    features: [
      { name: 'Google + Meta Ads Management', included: true },
      { name: 'Dedicated Slack Channel', included: true },
      { name: '30-Min Monthly Strategy Meeting', included: true },
      { name: 'Bi-Weekly Optimization', included: true },
      { name: 'Live Performance Dashboard', included: true },
    ],
    services: {
      channels: { included: true, count: '2', details: 'Google + Meta Ads' },
      meetings: { included: true, frequency: 'Monthly', duration: '30 minutes' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Bi-Weekly' },
      setupManagement: { included: true, level: 'Basic' },
      adCopyContent: { included: true, level: 'Basic' },
      analytics: { included: false },
      seo: { included: false },
      websiteUpdate: { included: false },
      landingPages: { included: false },
      funnelCreation: { included: false },
      workflow: { included: false },
      audit: { included: false },
      onlineListing: { included: false },
      reporting: { included: false },
      dedicatedTeam: { included: false },
      emailCampaigns: { included: false },
      textingCampaigns: { included: false },
      abTesting: { included: false },
      creatives: { included: true, details: 'Basic Creatives' },
      liveDashboard: { included: true },
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
    highlights: ['Google + Meta', 'Slack Channel', 'Under $5K Budget'],
  },

  // ADVANCED SILVER
  {
    id: 'advanced-silver',
    name: 'Advanced Silver',
    tier: 1,
    monthlyPrice: 4299,
    adSpendRange: 'Under $10K/mo',
    description: 'Full-service marketing with dedicated team and multi-channel approach',
    tagline: 'Scale Your Business',
    channels: '4 Channels',
    turnaround: '4-5 Days',
    color: 'from-slate-500 to-slate-600',
    category: 'advanced',
    recommended: true,
    features: [
      { name: '30-Min Bi-Weekly Strategy Meeting', included: true },
      { name: 'Dedicated Slack Channel', included: true },
      { name: 'Dedicated Team', included: true },
      { name: 'Email & SMS Campaigns', included: true },
      { name: 'Social Media Management', included: true },
      { name: 'Live Performance Dashboard', included: true },
    ],
    services: {
      channels: { included: true, count: '4', details: 'Four channel strategy' },
      meetings: { included: true, frequency: 'Bi-Weekly', duration: '30 minutes' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Bi-Weekly' },
      setupManagement: { included: true, level: 'Basic' },
      adCopyContent: { included: true, level: 'Basic' },
      analytics: { included: true, level: 'Basic' },
      seo: { included: true, level: 'Basic' },
      websiteUpdate: { included: true, level: 'Basic' },
      landingPages: { included: true },
      funnelCreation: { included: true },
      workflow: { included: true, level: 'Basic' },
      audit: { included: true, details: 'All Channels' },
      onlineListing: { included: true },
      reporting: { included: false },
      dedicatedTeam: { included: true },
      emailCampaigns: { included: true },
      textingCampaigns: { included: true },
      abTesting: { included: false },
      creatives: { included: true, details: 'Basic Creatives' },
      liveDashboard: { included: true },
      salesConsultation: { included: false },
      marketingConsultation: { included: false },
      reputationManagement: { included: false },
      socialMediaManagement: { included: true },
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
    highlights: ['4 Channels', 'Dedicated Team', 'Live Dashboard'],
  },

  // PREMIUM SILVER
  {
    id: 'premium-silver',
    name: 'Premium Silver',
    tier: 2,
    monthlyPrice: 7499,
    adSpendRange: 'Under $20K/mo',
    description: 'Advanced marketing with AI-powered tools, reputation management, and UGC content',
    tagline: 'Premium Performance',
    channels: '5 Channels',
    turnaround: '3-4 Days',
    color: 'from-purple-500 to-violet-600',
    category: 'premium',
    features: [
      { name: '3 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 30-Min Strategy Meeting', included: true },
      { name: 'AI Voice Agent & Chatbot', included: true },
      { name: 'Reputation Management', included: true },
      { name: 'UGC Content (2 Pieces)', included: true },
      { name: 'Sales & Experience Consultation', included: true },
    ],
    services: {
      channels: { included: true, count: '5', details: 'Five channel strategy' },
      meetings: { included: true, frequency: 'Weekly', duration: '30 minutes' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Weekly' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Advanced' },
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
      influencerMarketing: { included: false },
      televisionAds: { included: false },
      automatedSystems: { included: false },
      automatedCRM: { included: false },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: false },
    },
    highlights: ['5 Channels', 'AI Voice & Chat', 'Reputation Management'],
  },

  // PREMIUM GOLD
  {
    id: 'premium-gold',
    name: 'Premium Gold',
    tier: 3,
    monthlyPrice: 9499,
    adSpendRange: 'Under $30K/mo',
    description: 'Full omni-channel marketing with influencers, TV ads, and automated CRM for up to 3 franchise locations',
    tagline: 'Maximum Impact',
    channels: 'Omni-Channel',
    turnaround: '1-2 Days',
    color: 'from-amber-400 to-yellow-300',
    category: 'premium',
    features: [
      { name: '5 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 1-Hour Strategy Meeting', included: true },
      { name: 'Up to 3 Franchise Locations', included: true },
      { name: 'UGC Content (3 Pieces)', included: true },
      { name: 'Influencer Marketing & TV Ads', included: true },
      { name: 'AI Tools On-Demand', included: true },
    ],
    services: {
      channels: { included: true, count: 'Omni', details: 'All channels included' },
      meetings: { included: true, frequency: 'Weekly', duration: '1 hour' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Daily' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Advanced' },
      websiteUpdate: { included: true, level: 'Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Full' },
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
      inPersonContent: { included: false },
      experienceConsultation: { included: true },
      ugcContent: { included: true, count: 3, details: '3 UGC pieces' },
      influencerMarketing: { included: true },
      televisionAds: { included: true },
      automatedSystems: { included: true },
      automatedCRM: { included: true, details: 'Automated' },
      aiCRMManager: { included: false },
      aiToolsOnDemand: { included: true },
    },
    highlights: ['Up to 3 Franchises', 'Omni-Channel', 'TV Ads & Influencers'],
  },

  // PREMIUM PLATINUM
  {
    id: 'premium-platinum',
    name: 'Premium Platinum',
    tier: 4,
    monthlyPrice: 14999,
    adSpendRange: 'Under $75K/mo',
    description: 'The ultimate marketing solution with in-person content, TV ads, AI-managed CRM, and support for up to 15 franchise locations',
    tagline: 'Enterprise Dominance',
    channels: 'Omni-Channel',
    turnaround: '1-2 Days',
    color: 'from-emerald-400 to-cyan-400',
    category: 'premium',
    features: [
      { name: '5 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 1.5-Hour Strategy Meeting', included: true },
      { name: 'Up to 15 Franchise Locations', included: true },
      { name: 'In-Person Content', included: true },
      { name: 'Television Ads (TV)', included: true },
      { name: 'UGC Content (5 Pieces)', included: true },
      { name: 'AI-Managed CRM', included: true },
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
      seo: { included: true, level: 'Advanced' },
      websiteUpdate: { included: true, level: 'Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Full' },
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
      ugcContent: { included: true, count: 5, details: '5 UGC pieces' },
      influencerMarketing: { included: true },
      televisionAds: { included: true },
      automatedSystems: { included: true },
      automatedCRM: { included: true, details: 'AI-Managed' },
      aiCRMManager: { included: true },
      aiToolsOnDemand: { included: true },
    },
    highlights: ['Up to 15 Franchises', 'TV Ads & In-Person Content', 'Everything Included'],
  },

  // ENTERPRISE
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 5,
    monthlyPrice: 0,
    pricingModel: '15% of ad spend',
    adSpendRange: '$75K+/mo',
    description: 'Enterprise-grade marketing with unlimited franchise support, same-day turnaround, and dedicated 2-hour weekly strategy sessions. $500K/mo minimum ad spend.',
    tagline: 'Unlimited Scale',
    channels: 'Omni-Channel',
    turnaround: 'Same Day',
    color: 'from-blue-600 to-indigo-700',
    category: 'enterprise',
    features: [
      { name: '10 Hours Monthly Additional Tasks', included: true },
      { name: 'Weekly 2-Hour Strategy Meeting', included: true },
      { name: 'Unlimited Franchise Locations', included: true },
      { name: 'Same Day Turnaround', included: true },
      { name: 'In-Person Content', included: true },
      { name: 'Television Ads (TV)', included: true },
      { name: 'UGC Content (10 Pieces)', included: true },
      { name: 'AI-Managed CRM', included: true },
      { name: 'AI Tools On-Demand', included: true },
    ],
    services: {
      channels: { included: true, count: 'Omni', details: 'All channels included' },
      meetings: { included: true, frequency: 'Weekly', duration: '2 hours' },
      slackChannel: { included: true },
      optimization: { included: true, frequency: 'Daily' },
      setupManagement: { included: true, level: 'Advanced' },
      adCopyContent: { included: true, level: 'Advanced' },
      analytics: { included: true, level: 'Advanced' },
      seo: { included: true, level: 'Advanced' },
      websiteUpdate: { included: true, level: 'Advanced' },
      landingPages: { included: true, level: 'Advanced' },
      funnelCreation: { included: true, level: 'Advanced' },
      workflow: { included: true, level: 'Full' },
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
      additionalHours: { included: true, hours: 10, details: '10 Hours Monthly' },
      inPersonContent: { included: true },
      experienceConsultation: { included: true },
      ugcContent: { included: true, count: 10, details: '10 UGC pieces' },
      influencerMarketing: { included: true },
      televisionAds: { included: true },
      automatedSystems: { included: true },
      automatedCRM: { included: true, details: 'AI-Managed' },
      aiCRMManager: { included: true },
      aiToolsOnDemand: { included: true },
    },
    highlights: ['Unlimited Franchises', 'Same Day Turnaround', '15% of Ad Spend'],
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

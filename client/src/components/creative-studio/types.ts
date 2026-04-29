import type { LucideIcon } from 'lucide-react';

// ── Output types ──
export type CreativeType = 'ad' | 'image' | 'video' | 'canva';
export type StudioMode = 'smart' | 'manual';

// ── Smart Brief analysis result ──
export interface BriefAnalysis {
  outputType: CreativeType;
  platform: string;
  dimensions: { width: number; height: number } | null;
  aspectRatio: string | null;
  style: string;
  industry: string | null;
  campaignType: string | null;
  motionStyle: string | null;
  videoDuration: number | null;
  videoResolution: string | null;
  enhancedPrompt: string;
  reasoning: string;
  confidence: number;
  suggestedHeadline: string | null;
  suggestedCta: string | null;
  // Research-powered fields (present when research data was provided)
  competitiveInsights?: string;
  targetAudienceRefinement?: string;
  messagingStrategy?: string;
  differentiators?: string[];
  keywordsToInclude?: string[];
  avoidPatterns?: string[];
}

// ── Gallery ──
export interface GalleryItem {
  id: string;
  type: CreativeType;
  url: string;
  prompt: string;
  timestamp: number;
  metadata: {
    platform?: string;
    dimensions?: { width: number; height: number };
    generator?: string;
    mode?: string;
    style?: string;
    qa?: { passed: boolean; issues: string[]; score: number; textQuality?: string };
    comparison?: {
      nanoBanana: { imageUrl: string | null; error: string | null; generator: string } | null;
      runware: { imageUrl: string | null; error: string | null; generator: string } | null;
    };
    duration?: number;
    generationTime?: number;
    model?: string;
  };
  dbId?: string;
}

// ── Shared brand context ──
export interface BrandContext {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  productDescription: string;
  headline: string;
  cta: string;
  extractedLogo: string | null;
  extractedScreenshots: { url: string; screenshot: string | null; title: string }[];
}

// ── Prefill from Smart Brief ──
export interface AdPrefill {
  prompt?: string;
  platform?: string;
  industry?: string;
  style?: string;
  campaignType?: string;
  headline?: string;
  cta?: string;
}

export interface ImagePrefill {
  prompt?: string;
  style?: string;
  width?: number;
  height?: number;
}

export interface VideoPrefill {
  prompt?: string;
  style?: string;
  motionStyle?: string;
  aspectRatio?: string;
  duration?: string;
  resolution?: string;
}

// ── Research Types ──

export type ResearchSourceType =
  | 'website'
  | 'ad-transparency'
  | 'social-media'
  | 'seo'
  | 'ad-screenshot';

export type ResearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ResearchSource {
  id: string;
  type: ResearchSourceType;
  input: string;
  label: string;
  status: ResearchStatus;
  error?: string;
  data?: any;
  addedAt: number;
}

export interface ResearchContext {
  sources: ResearchSource[];
  competitorWebsites: Array<{
    url: string;
    businessName: string;
    tagline: string;
    colors: Record<string, string>;
    messaging: string[];
    logo: string | null;
    screenshots: Array<{ url: string; screenshot: string | null; title: string }>;
  }>;
  competitorAds: Array<{
    advertiserName: string;
    screenshot: string | null;
    content: string;
    url: string;
  }>;
  socialIntelligence: Array<{
    platform: string;
    handle: string;
    topPosts: Array<{
      caption: string;
      likes: number;
      comments: number;
      contentType: string;
      engagementRate: number;
    }>;
    totalPosts: number;
  }>;
  seoData: Array<{
    domain: string;
    organicTraffic: number;
    topKeywords: Array<{ keyword: string; volume: number; position: number }>;
    competitors: Array<{ domain: string; commonKeywords: number }>;
    domainAuthority: number;
  }>;
  adAnalyses: Array<{
    imageUrl: string;
    competitorName: string;
    issues: string[];
    ourSolution: string;
    overallScore: string;
    quickWins: string[];
  }>;
}

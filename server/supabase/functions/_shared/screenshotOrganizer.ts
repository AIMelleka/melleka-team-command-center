/**
 * Screenshot Organization System
 * 
 * Organizes captured screenshots into deck-ready sections,
 * selects the best screenshot for each section, and generates
 * crop regions for key data points.
 */

import type { SectionId, LookerTemplate } from './lookerTemplates.ts';
import type { ValidatedMetrics, ConfidenceLevel } from './metricValidation.ts';

// =============================================================================
// TYPES
// =============================================================================

export interface CropRegion {
  description: string;
  bounds: {
    top: number;    // Percentage from top
    left: number;   // Percentage from left
    width: number;  // Percentage width
    height: number; // Percentage height
  };
  type: 'kpi_card' | 'table_header' | 'table_row' | 'chart' | 'creative' | 'full';
}

export interface ScreenshotAnalysis {
  url: string;
  sectionId: SectionId;
  confidence: number; // 0-1
  scrollPosition: number;
  dateVisible: boolean;
  visibleDateRange?: string;
  dateMatchesExpected: boolean;
  metrics: ValidatedMetrics;
  cropRegions: CropRegion[];
  insights: string[];
  quality: 'high' | 'medium' | 'low';
  fingerprint?: string; // For deduplication
}

export interface OrganizedSection {
  sectionId: SectionId;
  displayName: string;
  screenshot: string;
  cropRegions: CropRegion[];
  metrics: ValidatedMetrics;
  confidence: ConfidenceLevel;
  insights: string[];
  hasData: boolean;
  alternativeScreenshots?: string[];
}

export interface OrganizedDeck {
  hero: {
    screenshot: string;
    clientLogo?: string;
    dateRange: string;
    dateVerified: boolean;
  };
  googleSummary?: OrganizedSection;
  metaSummary?: OrganizedSection;
  googleCampaigns?: OrganizedSection;
  conversionTypes?: OrganizedSection;
  charts: OrganizedSection[];
  keywords?: OrganizedSection;
  creatives: OrganizedSection[];
  coverage: {
    percentage: number;
    capturedSections: SectionId[];
    missingSections: SectionId[];
  };
  qualityScore: number;
}

// =============================================================================
// SCREENSHOT QUALITY SCORING
// =============================================================================

/**
 * Calculate quality score for a screenshot analysis
 */
function calculateQualityScore(analysis: ScreenshotAnalysis): number {
  let score = 0;
  
  // Base confidence score (0-40 points)
  score += analysis.confidence * 40;
  
  // Metrics extracted (0-30 points)
  const metricCount = Object.keys(analysis.metrics).length;
  score += Math.min(metricCount * 5, 30);
  
  // Crop regions defined (0-15 points)
  const cropCount = analysis.cropRegions.length;
  score += Math.min(cropCount * 3, 15);
  
  // Insights provided (0-10 points)
  const insightCount = analysis.insights.length;
  score += Math.min(insightCount * 2, 10);
  
  // Date verification bonus (0-5 points)
  if (analysis.dateVisible && analysis.dateMatchesExpected) {
    score += 5;
  }
  
  return Math.min(score, 100);
}

/**
 * Select the best screenshot for a section from multiple candidates
 */
function selectBestScreenshot(
  candidates: ScreenshotAnalysis[],
  sectionId: SectionId
): ScreenshotAnalysis | null {
  if (candidates.length === 0) return null;
  
  // Filter to only screenshots matching this section
  const matching = candidates.filter(c => c.sectionId === sectionId);
  if (matching.length === 0) return null;
  
  // Score each and pick the best
  const scored = matching.map(s => ({
    analysis: s,
    score: calculateQualityScore(s),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored[0].analysis;
}

// =============================================================================
// DEDUPLICATION
// =============================================================================

/**
 * Remove duplicate screenshots based on fingerprint or visual similarity
 */
export function deduplicateScreenshots(
  screenshots: ScreenshotAnalysis[]
): ScreenshotAnalysis[] {
  const seen = new Set<string>();
  const unique: ScreenshotAnalysis[] = [];
  
  for (const screenshot of screenshots) {
    // Use fingerprint if available
    const key = screenshot.fingerprint || 
      `${screenshot.sectionId}-${screenshot.scrollPosition}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(screenshot);
    }
  }
  
  return unique;
}

// =============================================================================
// SECTION MAPPING
// =============================================================================

/**
 * Map AI-detected category to section ID
 */
export function mapCategoryToSectionId(
  category: string,
  scrollPosition: number
): SectionId {
  const categoryLower = category.toLowerCase();
  
  // Overview/Header detection
  if (categoryLower.includes('overview') || categoryLower.includes('header') ||
      categoryLower.includes('date') || categoryLower.includes('logo')) {
    return 'overview_header';
  }
  
  // Google sections
  if (categoryLower.includes('google')) {
    if (categoryLower.includes('campaign') || categoryLower.includes('table')) {
      return 'google_campaigns';
    }
    if (categoryLower.includes('demographic') || categoryLower.includes('age')) {
      return 'google_demographics';
    }
    if (categoryLower.includes('timeline') || categoryLower.includes('chart') || 
        categoryLower.includes('trend')) {
      return 'google_timeline';
    }
    if (categoryLower.includes('summary') || categoryLower.includes('kpi')) {
      return 'google_summary';
    }
  }
  
  // Meta sections
  if (categoryLower.includes('meta') || categoryLower.includes('facebook') ||
      categoryLower.includes('instagram')) {
    if (categoryLower.includes('campaign') || categoryLower.includes('table')) {
      return 'meta_campaigns';
    }
    if (categoryLower.includes('timeline') || categoryLower.includes('chart')) {
      return 'meta_timeline';
    }
    return 'meta_summary';
  }
  
  // Conversion types
  if (categoryLower.includes('conversion') && 
      (categoryLower.includes('type') || categoryLower.includes('action'))) {
    return 'conversion_types';
  }
  
  // Keywords
  if (categoryLower.includes('keyword') || categoryLower.includes('search term')) {
    return 'keyword_performance';
  }
  
  // Creatives
  if (categoryLower.includes('creative') || categoryLower.includes('ad image') ||
      categoryLower.includes('ad preview')) {
    return 'top_creatives';
  }
  
  // SMS/Email
  if (categoryLower.includes('sms') || categoryLower.includes('text')) {
    return 'sms_summary';
  }
  if (categoryLower.includes('email')) {
    return 'email_summary';
  }
  
  // Default based on scroll position
  if (scrollPosition < 200) return 'overview_header';
  if (scrollPosition < 600) return 'google_summary';
  if (scrollPosition < 1400) return 'google_campaigns';
  if (scrollPosition < 2200) return 'conversion_types';
  if (scrollPosition < 2800) return 'google_timeline';
  
  return 'keyword_performance';
}

// =============================================================================
// MAIN ORGANIZER
// =============================================================================

/**
 * Organize screenshots into deck-ready structure
 */
export function organizeScreenshots(
  screenshots: ScreenshotAnalysis[],
  template: LookerTemplate,
  clientInfo: { name: string; startDate: string; endDate: string }
): OrganizedDeck {
  // Deduplicate
  const uniqueScreenshots = deduplicateScreenshots(screenshots);
  
  // Find hero screenshot (overview with date)
  const heroScreenshot = uniqueScreenshots.find(
    s => s.sectionId === 'overview_header' && s.dateVisible
  ) || uniqueScreenshots.find(s => s.sectionId === 'overview_header');
  
  // Helper to create organized section
  const createSection = (sectionId: SectionId): OrganizedSection | undefined => {
    const best = selectBestScreenshot(uniqueScreenshots, sectionId);
    if (!best) return undefined;
    
    const templateSection = template.expectedSections.find(s => s.id === sectionId);
    const hasData = Object.keys(best.metrics).length > 0 || 
                    best.insights.length > 0 ||
                    best.cropRegions.length > 0;
    
    // Get alternative screenshots
    const alternatives = uniqueScreenshots
      .filter(s => s.sectionId === sectionId && s.url !== best.url)
      .map(s => s.url);
    
    // Determine overall confidence
    const metricConfidences = Object.values(best.metrics).map(m => m.confidence);
    const avgConfidence = metricConfidences.length > 0
      ? metricConfidences.reduce((sum, c) => {
          const scores = { high: 4, medium: 3, calculated: 2, low: 1, manual: 0 };
          return sum + (scores[c] || 0);
        }, 0) / metricConfidences.length
      : 2;
    
    let confidence: ConfidenceLevel = 'medium';
    if (avgConfidence >= 3.5) confidence = 'high';
    else if (avgConfidence >= 2.5) confidence = 'medium';
    else if (avgConfidence >= 1.5) confidence = 'calculated';
    else confidence = 'low';
    
    return {
      sectionId,
      displayName: templateSection?.displayName || sectionId,
      screenshot: best.url,
      cropRegions: best.cropRegions,
      metrics: best.metrics,
      confidence,
      insights: best.insights,
      hasData,
      alternativeScreenshots: alternatives.length > 0 ? alternatives : undefined,
    };
  };
  
  // Collect chart sections
  const chartSections: OrganizedSection[] = [];
  const chartIds: SectionId[] = ['google_timeline', 'meta_timeline', 'google_demographics'];
  for (const chartId of chartIds) {
    const section = createSection(chartId);
    if (section) chartSections.push(section);
  }
  
  // Collect creative sections
  const creativeSection = createSection('top_creatives');
  
  // Calculate coverage
  const capturedSections = Array.from(
    new Set(uniqueScreenshots.map(s => s.sectionId))
  );
  const requiredSections = template.expectedSections
    .filter(s => s.required)
    .map(s => s.id);
  const missingSections = requiredSections.filter(
    s => !capturedSections.includes(s)
  );
  const coveragePercentage = requiredSections.length > 0
    ? Math.round((requiredSections.filter(s => capturedSections.includes(s)).length / 
                  requiredSections.length) * 100)
    : 100;
  
  // Calculate overall quality score
  const allScores = uniqueScreenshots.map(s => calculateQualityScore(s));
  const qualityScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;
  
  return {
    hero: {
      screenshot: heroScreenshot?.url || uniqueScreenshots[0]?.url || '',
      dateRange: heroScreenshot?.visibleDateRange || 
                 `${clientInfo.startDate} - ${clientInfo.endDate}`,
      dateVerified: heroScreenshot?.dateMatchesExpected ?? false,
    },
    googleSummary: createSection('google_summary'),
    metaSummary: createSection('meta_summary'),
    googleCampaigns: createSection('google_campaigns'),
    conversionTypes: createSection('conversion_types'),
    charts: chartSections,
    keywords: createSection('keyword_performance'),
    creatives: creativeSection ? [creativeSection] : [],
    coverage: {
      percentage: coveragePercentage,
      capturedSections,
      missingSections,
    },
    qualityScore,
  };
}

// =============================================================================
// CROP REGION HELPERS
// =============================================================================

/**
 * Generate CSS clip-path from crop region bounds
 */
export function boundsToClipPath(bounds: CropRegion['bounds']): string {
  const { top, left, width, height } = bounds;
  const right = 100 - (left + width);
  const bottom = 100 - (top + height);
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

/**
 * Generate CSS object-position and object-fit for cropped image
 */
export function boundsToCssPosition(bounds: CropRegion['bounds']): {
  objectPosition: string;
  transform: string;
} {
  const { top, left, width, height } = bounds;
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  
  return {
    objectPosition: `${centerX}% ${centerY}%`,
    transform: `scale(${100 / Math.min(width, height)})`,
  };
}

/**
 * Merge overlapping crop regions
 */
export function mergeOverlappingRegions(regions: CropRegion[]): CropRegion[] {
  if (regions.length <= 1) return regions;
  
  // Sort by top position
  const sorted = [...regions].sort((a, b) => a.bounds.top - b.bounds.top);
  const merged: CropRegion[] = [];
  
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    // Check if regions overlap vertically
    const currentBottom = current.bounds.top + current.bounds.height;
    const overlap = next.bounds.top < currentBottom;
    
    if (overlap && current.type === next.type) {
      // Merge regions
      const newTop = Math.min(current.bounds.top, next.bounds.top);
      const newLeft = Math.min(current.bounds.left, next.bounds.left);
      const newBottom = Math.max(
        current.bounds.top + current.bounds.height,
        next.bounds.top + next.bounds.height
      );
      const newRight = Math.max(
        current.bounds.left + current.bounds.width,
        next.bounds.left + next.bounds.width
      );
      
      current = {
        description: `${current.description} + ${next.description}`,
        bounds: {
          top: newTop,
          left: newLeft,
          width: newRight - newLeft,
          height: newBottom - newTop,
        },
        type: current.type,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  
  merged.push(current);
  return merged;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type {
  SectionId,
  LookerTemplate,
} from './lookerTemplates.ts';

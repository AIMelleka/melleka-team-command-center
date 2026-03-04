// Slide-based deck presentation system types

export type SlideType = 
  | 'title'
  | 'metrics' 
  | 'screenshot'
  | 'platform'
  | 'insights'
  | 'action-items'
  | 'comparison'
  | 'section-header'
  | 'blank';

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
  notes?: string;        // Speaker notes for presenter mode
  hidden?: boolean;       // Hidden slides skip in presentation
  data: SlideData;
}

export interface SlideData {
  // Title slide
  clientName?: string;
  clientLogo?: string;
  dateRange?: string;
  headline?: string;
  brandPrimary?: string;
  brandSecondary?: string;

  // Metrics slide
  metrics?: SlideMetric[];

  // Screenshot slide
  screenshotUrl?: string;
  screenshotCaption?: string;
  screenshotCategory?: string;

  // Platform slide
  platform?: 'google' | 'meta' | 'sms' | 'email' | 'workflows' | 'calls' | 'forms' | 'payments' | 'reviews' | 'appointments';
  platformMetrics?: SlideMetric[];
  platformInsights?: string[];
  platformScreenshots?: string[];
  grade?: string;

  // Insights slide
  summary?: string;
  wins?: string[];
  challenges?: string[];

  // Action items slide
  actionItems?: ActionItem[];

  // Comparison slide
  comparisonData?: ComparisonItem[];

  // Section header
  sectionIcon?: string;
  sectionColor?: string;

  // Generic content
  bullets?: string[];
  imageUrl?: string;
}

export interface SlideMetric {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: number;       // % change from last period
  icon?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  owner?: string;
  dueDate?: string;
  completed?: boolean;
}

export interface ComparisonItem {
  label: string;
  current: number;
  previous: number;
  prefix?: string;
  suffix?: string;
}

export interface DeckPresentation {
  id: string;
  slug: string;
  clientName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  brandColors: {
    primary: string;
    secondary: string;
    logo?: string;
  };
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

// Convert old deck content format to slides
export function contentToSlides(content: Record<string, any>, meta: {
  clientName: string;
  dateRange: string;
  brandPrimary: string;
  brandSecondary: string;
  clientLogo?: string;
  screenshots?: string[];
}): Slide[] {
  const slides: Slide[] = [];
  let slideIndex = 0;
  const makeId = () => `slide-${slideIndex++}`;

  // 1. Title slide
  slides.push({
    id: makeId(),
    type: 'title',
    title: meta.clientName,
    subtitle: 'Performance Report',
    data: {
      clientName: meta.clientName,
      clientLogo: meta.clientLogo,
      dateRange: meta.dateRange,
      headline: content.hero?.executiveSummary?.split('.')[0] || `${meta.clientName} Performance Report`,
      brandPrimary: meta.brandPrimary,
      brandSecondary: meta.brandSecondary,
    },
  });

  // 2. Executive Summary / Insights
  if (content.hero?.executiveSummary) {
    slides.push({
      id: makeId(),
      type: 'insights',
      title: 'Executive Summary',
      data: {
        summary: content.hero.executiveSummary,
        wins: content.hero.keyFindings?.slice(0, 4) || [],
        challenges: [],
      },
    });
  }

  // 3. Overview metrics
  const heroMetrics: SlideMetric[] = [];
  if (content.hero?.totalSpend) heroMetrics.push({ label: 'Total Spend', value: content.hero.totalSpend, prefix: '$' });
  if (content.hero?.totalLeads) heroMetrics.push({ label: 'Total Leads', value: content.hero.totalLeads });
  if (content.hero?.roas) heroMetrics.push({ label: 'ROAS', value: content.hero.roas, suffix: 'x', decimals: 2 });
  if (content.hero?.totalImpressions) heroMetrics.push({ label: 'Impressions', value: content.hero.totalImpressions });
  if (content.hero?.totalClicks) heroMetrics.push({ label: 'Clicks', value: content.hero.totalClicks });

  if (heroMetrics.length > 0) {
    slides.push({
      id: makeId(),
      type: 'metrics',
      title: 'Performance Overview',
      data: { metrics: heroMetrics },
    });
  }

  // 4. Platform sections
  const platforms = [
    { key: 'googleAds', name: 'Google Ads', platform: 'google' as const },
    { key: 'metaAds', name: 'Meta Ads', platform: 'meta' as const },
    { key: 'sms', name: 'SMS Campaigns', platform: 'sms' as const },
    { key: 'email', name: 'Email Marketing', platform: 'email' as const },
    { key: 'workflows', name: 'Workflows', platform: 'workflows' as const },
    { key: 'appointments', name: 'Appointments', platform: 'appointments' as const },
    { key: 'calls', name: 'Calls', platform: 'calls' as const },
    { key: 'forms', name: 'Forms', platform: 'forms' as const },
    { key: 'payments', name: 'Payments', platform: 'payments' as const },
    { key: 'reviews', name: 'Reviews', platform: 'reviews' as const },
  ];

  for (const p of platforms) {
    const data = content[p.key];
    if (!data) continue;

    // Check if section has any meaningful data
    const hasData = Object.values(data).some((v: any) => {
      if (typeof v === 'number') return v > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.length > 0;
      return false;
    });
    if (!hasData) continue;

    const platformMetrics: SlideMetric[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number' && v > 0 && !['frequency'].includes(k)) {
        const isRate = k.includes('Rate') || k === 'ctr' || k === 'cpm' || k === 'cpc';
        const isMoney = k.includes('spend') || k.includes('Spend') || k === 'cpc' || k === 'cpm' || k.includes('revenue') || k.includes('Revenue') || k.includes('Value');
        platformMetrics.push({
          label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
          value: isRate && v < 1 ? v * 100 : v,
          prefix: isMoney ? '$' : undefined,
          suffix: isRate ? '%' : undefined,
          decimals: isRate || isMoney ? 2 : 0,
        });
      }
    }

    slides.push({
      id: makeId(),
      type: 'platform',
      title: p.name,
      data: {
        platform: p.platform,
        platformMetrics: platformMetrics.slice(0, 6),
        platformInsights: data.insights || data.highlights || [],
        platformScreenshots: data.screenshots || (data.screenshot ? [data.screenshot] : []),
        grade: data.roas >= 3 ? 'A' : data.roas >= 2 ? 'B+' : data.conversions > 10 ? 'B' : 'C',
      },
    });
  }

  // 5. Screenshot slides for any uploaded screenshots
  const allScreenshots = meta.screenshots || [];
  if (allScreenshots.length > 0) {
    // Group into pairs for 2-up layout
    for (let i = 0; i < allScreenshots.length; i++) {
      slides.push({
        id: makeId(),
        type: 'screenshot',
        title: `Dashboard View ${i + 1}`,
        data: {
          screenshotUrl: allScreenshots[i],
          screenshotCaption: `Dashboard screenshot ${i + 1}`,
        },
      });
    }
  }

  // 6. Services / Other Work
  if (content.services?.tasks?.length > 0) {
    const allItems: string[] = [];
    for (const cat of content.services.tasks) {
      allItems.push(...(cat.items || []).map((item: string) => `${cat.category}: ${item}`));
    }
    slides.push({
      id: makeId(),
      type: 'insights',
      title: 'Other Work Completed',
      data: {
        wins: allItems.slice(0, 8),
        summary: `${allItems.length} tasks completed across ${content.services.tasks.length} categories`,
      },
    });
  }

  // 7. Action Items / Next Steps
  if (content.nextSteps?.recommendations?.length > 0) {
    slides.push({
      id: makeId(),
      type: 'action-items',
      title: 'Next Steps & Recommendations',
      data: {
        actionItems: content.nextSteps.recommendations.map((r: any, i: number) => ({
          id: `action-${i}`,
          title: r.title,
          description: r.description || r.impact,
          priority: r.priority || 'medium',
        })),
      },
    });
  }

  // 8. Thank you slide
  slides.push({
    id: makeId(),
    type: 'title',
    title: 'Thank You',
    data: {
      clientName: meta.clientName,
      clientLogo: meta.clientLogo,
      headline: 'Questions & Discussion',
      brandPrimary: meta.brandPrimary,
      brandSecondary: meta.brandSecondary,
      dateRange: meta.dateRange,
    },
  });

  return slides;
}

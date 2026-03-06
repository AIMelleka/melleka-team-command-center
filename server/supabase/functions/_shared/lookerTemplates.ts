/**
 * Looker Studio Report Template System
 * 
 * Defines expected sections, metrics, and scroll strategies for known report structures.
 * This ensures 100% accurate and repeatable screenshot capture and data extraction.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SectionId = 
  | 'overview_header'
  | 'google_summary'
  | 'meta_summary'
  | 'google_campaigns'
  | 'meta_campaigns'
  | 'conversion_types'
  | 'google_timeline'
  | 'meta_timeline'
  | 'google_demographics'
  | 'keyword_performance'
  | 'top_creatives'
  | 'sms_summary'
  | 'email_summary';

export type MetricType = 'currency' | 'integer' | 'percentage' | 'decimal' | 'text';
export type ChartType = 'timeseries' | 'bar' | 'pie' | 'table' | 'kpi_cards';

export interface ExpectedMetric {
  id: string;
  label: string;
  type: MetricType;
  required: boolean;
  canCalculate?: boolean;
  formula?: string;
}

export interface TemplateSection {
  id: SectionId;
  displayName: string;
  required: boolean;
  platform?: 'google' | 'meta' | 'sms' | 'email';
  expectedMetrics: ExpectedMetric[];
  chartType?: ChartType;
  isImage?: boolean;
  scrollPositionHint?: number; // Approximate pixel position from top
}

export interface ScrollStrategy {
  totalScrollDistance: number;
  incrementPx: number;
  pauseMs: number;
  checkpointPositions: number[];
  chartsRenderDelayMs: number;
}

export interface ValidationRules {
  minimumScreenshots: number;
  requiredCategories: SectionId[];
  minimumMetricsPerSection: number;
  dateRangeMustMatch: boolean;
  requireCrossValidation: boolean;
}

export interface LookerTemplate {
  templateId: string;
  name: string;
  description: string;
  version: string;
  expectedSections: TemplateSection[];
  scrollStrategy: ScrollStrategy;
  validationRules: ValidationRules;
  aiPromptContext: string;
}

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

const COMMON_GOOGLE_METRICS: ExpectedMetric[] = [
  { id: 'conversions', label: 'Conversions', type: 'integer', required: true },
  { id: 'cost_per_conv', label: 'Cost/Conv', type: 'currency', required: true, canCalculate: true, formula: 'cost/conversions' },
  { id: 'phone_calls', label: 'Phone Calls', type: 'integer', required: false },
  { id: 'cost', label: 'Cost', type: 'currency', required: true },
  { id: 'impressions', label: 'Impressions', type: 'integer', required: true },
  { id: 'clicks', label: 'Clicks', type: 'integer', required: true },
  { id: 'ctr', label: 'CTR', type: 'percentage', required: false, canCalculate: true, formula: '(clicks/impressions)*100' },
  { id: 'cpc', label: 'Avg CPC', type: 'currency', required: false, canCalculate: true, formula: 'cost/clicks' },
  { id: 'conv_rate', label: 'Conv. Rate', type: 'percentage', required: false, canCalculate: true, formula: '(conversions/clicks)*100' },
];

const COMMON_META_METRICS: ExpectedMetric[] = [
  { id: 'spend', label: 'Spend', type: 'currency', required: true },
  { id: 'reach', label: 'Reach', type: 'integer', required: false },
  { id: 'impressions', label: 'Impressions', type: 'integer', required: true },
  { id: 'clicks', label: 'Link Clicks', type: 'integer', required: true },
  { id: 'ctr', label: 'CTR', type: 'percentage', required: false, canCalculate: true, formula: '(clicks/impressions)*100' },
  { id: 'cpc', label: 'CPC', type: 'currency', required: false, canCalculate: true, formula: 'spend/clicks' },
  { id: 'conversions', label: 'Conversions', type: 'integer', required: true },
  { id: 'cost_per_result', label: 'Cost per Result', type: 'currency', required: false, canCalculate: true, formula: 'spend/conversions' },
  { id: 'frequency', label: 'Frequency', type: 'decimal', required: false },
];

const CAMPAIGN_TABLE_METRICS: ExpectedMetric[] = [
  { id: 'campaign_name', label: 'Campaign', type: 'text', required: true },
  { id: 'status', label: 'Status', type: 'text', required: true },
  { id: 'budget', label: 'Budget', type: 'currency', required: false },
  { id: 'impressions', label: 'Impressions', type: 'integer', required: true },
  { id: 'phone_calls', label: 'Phone calls', type: 'integer', required: false },
  { id: 'conv_rate', label: 'Conv. rate', type: 'percentage', required: false },
  { id: 'conversions', label: 'Conversions', type: 'integer', required: true },
  { id: 'cost_per_conv', label: 'Cost/conv', type: 'currency', required: false },
  { id: 'cost', label: 'Cost', type: 'currency', required: true },
];

const KEYWORD_METRICS: ExpectedMetric[] = [
  { id: 'keyword', label: 'Search keyword', type: 'text', required: true },
  { id: 'impressions', label: 'Impressions', type: 'integer', required: true },
  { id: 'clicks', label: 'Clicks', type: 'integer', required: true },
  { id: 'ctr', label: 'CTR', type: 'percentage', required: true },
  { id: 'conversions', label: 'Conversions', type: 'integer', required: false },
  { id: 'avg_cpc', label: 'Avg. CPC', type: 'currency', required: false },
];

// =============================================================================
// TEMPLATE REGISTRY
// =============================================================================

export const MELLEKA_STANDARD_V1: LookerTemplate = {
  templateId: 'melleka-standard-v1',
  name: 'Melleka Standard Report',
  description: 'Standard client report with Google Ads, Meta Ads, campaign tables, and keyword performance',
  version: '1.0.0',
  
  expectedSections: [
    {
      id: 'overview_header',
      displayName: 'Report Header',
      required: true,
      expectedMetrics: [
        { id: 'date_range', label: 'Date Range', type: 'text', required: true },
        { id: 'client_logo', label: 'Client Logo', type: 'text', required: false },
      ],
      chartType: 'kpi_cards',
      scrollPositionHint: 0,
    },
    {
      id: 'google_summary',
      displayName: 'Google Ads Summary',
      required: true,
      platform: 'google',
      expectedMetrics: COMMON_GOOGLE_METRICS.slice(0, 4), // Conversions, Cost/conv, Phone Calls, Cost
      chartType: 'kpi_cards',
      scrollPositionHint: 100,
    },
    {
      id: 'meta_summary',
      displayName: 'Meta Ads Summary',
      required: false, // May be empty for some clients
      platform: 'meta',
      expectedMetrics: COMMON_META_METRICS.slice(0, 4),
      chartType: 'kpi_cards',
      scrollPositionHint: 200,
    },
    {
      id: 'google_campaigns',
      displayName: 'Google Ads Campaigns',
      required: true,
      platform: 'google',
      expectedMetrics: CAMPAIGN_TABLE_METRICS,
      chartType: 'table',
      scrollPositionHint: 800,
    },
    {
      id: 'conversion_types',
      displayName: 'Conversion Types',
      required: true,
      platform: 'google',
      expectedMetrics: [
        { id: 'conversion_type', label: 'Conversion action', type: 'text', required: true },
        { id: 'count', label: 'Conversions', type: 'integer', required: true },
      ],
      chartType: 'table',
      scrollPositionHint: 1600,
    },
    {
      id: 'google_timeline',
      displayName: 'Performance Over Time',
      required: true,
      platform: 'google',
      expectedMetrics: [
        { id: 'phone_calls_trend', label: 'Phone Calls Trend', type: 'integer', required: false },
        { id: 'conversions_trend', label: 'Conversions Trend', type: 'integer', required: true },
      ],
      chartType: 'timeseries',
      scrollPositionHint: 2000,
    },
    {
      id: 'google_demographics',
      displayName: 'Demographics',
      required: false,
      platform: 'google',
      expectedMetrics: [
        { id: 'age_breakdown', label: 'Age Groups', type: 'text', required: true },
      ],
      chartType: 'bar',
      scrollPositionHint: 2400,
    },
    {
      id: 'keyword_performance',
      displayName: 'Keyword Performance',
      required: true,
      platform: 'google',
      expectedMetrics: KEYWORD_METRICS,
      chartType: 'table',
      scrollPositionHint: 2800,
    },
    {
      id: 'top_creatives',
      displayName: 'Top Performing Creatives',
      required: false,
      expectedMetrics: [],
      isImage: true,
      scrollPositionHint: 3400,
    },
  ],

  scrollStrategy: {
    totalScrollDistance: 4000,
    incrementPx: 800,
    pauseMs: 2500,
    chartsRenderDelayMs: 3000,
    // Reduced to 6 checkpoints to stay under Firecrawl's 50-action limit
    checkpointPositions: [0, 800, 1600, 2400, 3200, 4000],
  },

  validationRules: {
    minimumScreenshots: 10,
    requiredCategories: ['overview_header', 'google_summary', 'google_campaigns', 'keyword_performance'],
    minimumMetricsPerSection: 2,
    dateRangeMustMatch: true,
    requireCrossValidation: true,
  },

  aiPromptContext: `This is a Melleka Standard marketing dashboard from Looker Studio.
The report typically contains:
1. Header with client logo and date picker (top of report)
2. Summary cards for Meta Ads (left) and Google Ads (right) - Meta may be empty
3. Google Ads campaign table with columns: Campaign, Status, Budget, Impressions, Phone calls, Conv. rate, Conversions, Cost/conv, Cost
4. Conversion type breakdown table
5. Time series charts for Phone Calls and Conversions over time
6. Demographics bar chart (Google Conversions by Age)
7. Keyword performance table with Search keyword, Impressions, Clicks, CTR, Conversions, Avg. CPC
8. Optional: Top performing ad creatives`,
};

// =============================================================================
// TEMPLATE MATCHING & UTILITIES
// =============================================================================

/**
 * Registry of all available templates
 */
export const TEMPLATE_REGISTRY: Record<string, LookerTemplate> = {
  'melleka-standard-v1': MELLEKA_STANDARD_V1,
};

/**
 * Get the default template (Melleka Standard)
 */
export function getDefaultTemplate(): LookerTemplate {
  return MELLEKA_STANDARD_V1;
}

/**
 * Get a template by ID
 */
export function getTemplateById(templateId: string): LookerTemplate | null {
  return TEMPLATE_REGISTRY[templateId] || null;
}

/**
 * Check if all required sections have been captured
 */
export function validateSectionCoverage(
  capturedSections: SectionId[],
  template: LookerTemplate
): { passed: boolean; coverage: number; missing: SectionId[] } {
  const requiredSections = template.expectedSections
    .filter(s => s.required)
    .map(s => s.id);
  
  const missing = requiredSections.filter(s => !capturedSections.includes(s));
  const captured = requiredSections.filter(s => capturedSections.includes(s));
  const coverage = (captured.length / requiredSections.length) * 100;
  
  return {
    passed: missing.length === 0,
    coverage: Math.round(coverage),
    missing,
  };
}

/**
 * Get the expected metrics for a section
 */
export function getSectionMetrics(
  sectionId: SectionId,
  template: LookerTemplate
): ExpectedMetric[] {
  const section = template.expectedSections.find(s => s.id === sectionId);
  return section?.expectedMetrics || [];
}

/**
 * Get scroll checkpoints for a template
 */
export function getScrollCheckpoints(template: LookerTemplate): number[] {
  return template.scrollStrategy.checkpointPositions;
}

/**
 * Map a section ID to its platform
 */
export function getSectionPlatform(
  sectionId: SectionId,
  template: LookerTemplate
): string | null {
  const section = template.expectedSections.find(s => s.id === sectionId);
  return section?.platform || null;
}

/**
 * Generate the AI prompt context for a specific section
 */
export function generateSectionPrompt(
  sectionId: SectionId,
  template: LookerTemplate,
  context: { clientName: string; startDate: string; endDate: string; scrollPx: number }
): string {
  const section = template.expectedSections.find(s => s.id === sectionId);
  if (!section) return '';

  const metricsList = section.expectedMetrics
    .map(m => `- ${m.label} (${m.type}${m.required ? ', required' : ''})`)
    .join('\n');

  return `
CONTEXT:
- Client: ${context.clientName}
- Expected Date Range: ${context.startDate} to ${context.endDate}
- Scroll Position: ${context.scrollPx}px
- Template: ${template.name}
- Current Section: ${section.displayName}

EXPECTED METRICS FOR THIS SECTION:
${metricsList}

CHART TYPE: ${section.chartType || 'mixed'}
${section.isImage ? 'This section contains creative images.' : ''}
`;
}

/**
 * Get all section IDs that should be detected
 */
export function getAllSectionIds(template: LookerTemplate): SectionId[] {
  return template.expectedSections.map(s => s.id);
}

/**
 * Check if a section allows "no data" (optional sections)
 */
export function sectionAllowsNoData(sectionId: SectionId, template: LookerTemplate): boolean {
  const section = template.expectedSections.find(s => s.id === sectionId);
  return section ? !section.required : true;
}

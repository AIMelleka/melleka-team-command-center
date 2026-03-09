// Types for the Daily Ad Reports feature
// Data comes from ad_review_history table + seo_data.fullAnalysis JSONB

// ── Date Selection ──
export type DateMode = 'single' | 'range';
export type DatePreset = 'last_7' | 'last_14' | 'last_30' | 'custom';

export interface DateRangeSelection {
  mode: DateMode;
  singleDate: string | null;
  startDate: string | null;
  endDate: string | null;
  preset: DatePreset | null;
}

// ── Deep Analysis (AI multi-day comparison) ──
export interface DeepAnalysis {
  clientName: string;
  trendSummary: string;
  patterns: PatternInsight[];
  anomalies: AnomalyDetection[];
  periodComparison: PeriodComparison;
  strategicOutlook: string;
  actionableRecommendations: ActionableRecommendation[];
}

export interface PatternInsight {
  pattern: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  affectedMetrics: string[];
}

export interface AnomalyDetection {
  date: string;
  metric: string;
  expected: string;
  actual: string;
  severity: 'high' | 'medium' | 'low';
  possibleCause: string;
}

export interface PeriodComparison {
  spendTrend: 'increasing' | 'decreasing' | 'stable';
  conversionTrend: 'increasing' | 'decreasing' | 'stable';
  cplTrend: 'improving' | 'declining' | 'stable';
  cpaTrend: 'improving' | 'declining' | 'stable';
  bestDay: string;
  worstDay: string;
}

// ── Actionable Recommendation (extends Recommendation with execution data) ──
export interface ActionableRecommendation extends Recommendation {
  id?: string;
  clientName: string;
  changeType: string;
  platformTarget: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed';
  executionError?: string;
  sessionId?: string;
}

export interface Platform {
  name: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversions: string;
  leads?: string;
  cpc: string;
  ctr: string;
  roas?: string;
  conversionRate?: string;
  costPerLead?: string;
  costPerConversion?: string;
  qualityScore?: string;
  trend: 'up' | 'down' | 'stable';
  health: 'good' | 'warning' | 'critical';
  vsBenchmark?: 'above' | 'at' | 'below';
  cplVsBenchmark?: 'above' | 'at' | 'below';
  cpaVsBenchmark?: 'above' | 'at' | 'below';
}

export interface CplCpaAnalysis {
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  googleCpl?: number;
  googleCpa?: number;
  metaCpl?: number;
  metaCpa?: number;
  googleCplVsBenchmark?: 'above' | 'at' | 'below';
  metaCplVsBenchmark?: 'above' | 'at' | 'below';
  googleCpaVsBenchmark?: 'above' | 'at' | 'below';
  metaCpaVsBenchmark?: 'above' | 'at' | 'below';
  primaryConcerns?: string[];
  quickWins?: string[];
}

export interface Insight {
  type: 'positive' | 'warning' | 'action' | 'opportunity';
  title: string;
  description: string;
  impact?: 'high' | 'medium' | 'low';
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
  platform?: string;
  effort?: 'quick-win' | 'medium' | 'strategic';
  timeline?: string;
}

export interface WeekOverWeekItem {
  metric: string;
  change: number;
  direction: 'up' | 'down';
  isGood?: boolean;
}

export interface CompetitorInsight {
  competitor: string;
  insight: string;
  opportunity: string;
  keywords?: string[];
}

export interface CrossPlatformSynergy {
  opportunity: string;
  platforms: string[];
  action: string;
}

export interface BenchmarkAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface HistoricalComparison {
  improved: string[];
  declined: string[];
  unchanged: string[];
}

export interface TopKeyword {
  keyword: string;
  spend: number;
  conversions: number;
  cpa: number;
  ctr: number;
}

export interface WastedKeyword {
  keyword: string;
  spend: number;
  conversions: number;
  wastedSpend: number;
}

export interface HeadlineEffectiveness {
  headline: string;
  ctr: number;
  verdict: 'strong' | 'average' | 'needs_rewrite';
}

export interface KeyMetrics {
  topKeywords?: TopKeyword[];
  bottomKeywords?: WastedKeyword[];
  ctrByPlatform?: Record<string, number>;
  headlineEffectiveness?: HeadlineEffectiveness[];
}

export interface QaValidation {
  passed: boolean;
  issues: string[];
  recommendation: string | null;
}

export interface ClientDailyReport {
  id: string;
  clientName: string;
  reviewDate: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  updatedAt: string;
  industry: string | null;
  summary: string | null;
  platforms: Platform[];
  cplCpaAnalysis: CplCpaAnalysis | null;
  insights: Insight[];
  recommendations: Recommendation[];
  weekOverWeek: WeekOverWeekItem[];
  competitorInsights: CompetitorInsight[];
  crossPlatformSynergies: CrossPlatformSynergy[];
  benchmarkAnalysis: BenchmarkAnalysis | null;
  historicalComparison: HistoricalComparison | null;
  keyMetrics: KeyMetrics | null;
  qaValidation: QaValidation | null;
  actionItems: any[];
  notes: string | null;
}

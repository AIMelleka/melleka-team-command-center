import type {
  ClientDailyReport,
  Platform,
  CplCpaAnalysis,
  Insight,
  Recommendation,
} from '@/types/dailyReports';
import { parseCurrency } from './shared';

/* ── Health tier from score ── */
export type HealthTier = 'excellent' | 'good' | 'warning' | 'critical';

export function tierFromScore(score: number): HealthTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

export const tierColors: Record<HealthTier, string> = {
  excellent: '#10b981', // emerald-500
  good: '#3b82f6',     // blue-500
  warning: '#f59e0b',  // amber-500
  critical: '#ef4444', // red-500
};

/* ── Signal scorers ── */

/** Platform Health signal (0-100) — returns -1 if no data */
function scorePlatformHealth(platforms: Platform[]): number {
  if (!platforms || platforms.length === 0) return -1;

  let total = 0;
  let count = 0;

  for (const p of platforms) {
    let base = 50;
    // health status
    if (p.health === 'good') base = 80;
    else if (p.health === 'warning') base = 50;
    else if (p.health === 'critical') base = 20;

    // vsBenchmark boost/penalty
    if (p.vsBenchmark === 'above') base += 15;
    else if (p.vsBenchmark === 'below') base -= 15;

    // CPL/CPA benchmark adjustments
    if (p.cplVsBenchmark === 'above') base += 5;
    else if (p.cplVsBenchmark === 'below') base -= 5;
    if (p.cpaVsBenchmark === 'above') base += 5;
    else if (p.cpaVsBenchmark === 'below') base -= 5;

    total += Math.max(0, Math.min(100, base));
    count++;
  }

  return count > 0 ? Math.round(total / count) : -1;
}

/** CPL/CPA Health signal (0-100) — returns -1 if no data */
function scoreCplCpaHealth(analysis: CplCpaAnalysis | null): number {
  if (!analysis) return -1;

  const healthMap: Record<string, number> = {
    excellent: 95,
    good: 75,
    warning: 45,
    critical: 20,
  };

  let score = healthMap[analysis.overallHealth] ?? 50;

  // Adjust based on concerns vs quickWins balance
  const concerns = analysis.primaryConcerns?.length ?? 0;
  const wins = analysis.quickWins?.length ?? 0;

  if (wins > concerns) score += 10;
  else if (concerns > wins + 1) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Insight Sentiment signal (0-100) — returns -1 if no data */
function scoreInsightSentiment(insights: Insight[]): number {
  if (!insights || insights.length === 0) return -1;

  const impactWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  let positive = 0;
  let negative = 0;

  for (const ins of insights) {
    const w = impactWeight[ins.impact || 'medium'] ?? 2;
    if (ins.type === 'positive' || ins.type === 'opportunity') {
      positive += w;
    } else {
      negative += w;
    }
  }

  const total = positive + negative;
  if (total === 0) return -1;

  // Ratio of positive sentiment → scale 0-100
  return Math.round((positive / total) * 100);
}

/** Recommendation Load signal (0-100) — returns -1 if no data */
function scoreRecommendationLoad(recs: Recommendation[]): number {
  if (!recs || recs.length === 0) return -1;

  const highCount = recs.filter(r => r.priority === 'high').length;

  // Fewer high-priority = higher score
  if (highCount === 0) return 95;
  if (highCount === 1) return 75;
  if (highCount === 2) return 55;
  if (highCount <= 4) return 35;
  return 15;
}

/* ── Composite score ── */

interface SignalBreakdown {
  platformHealth: number;
  cplCpaHealth: number;
  insightSentiment: number;
  recommendationLoad: number;
}

export interface ReportScore {
  score: number;
  tier: HealthTier;
  signals: SignalBreakdown;
}

const WEIGHTS = {
  platformHealth: 0.35,
  cplCpaHealth: 0.25,
  insightSentiment: 0.20,
  recommendationLoad: 0.20,
};

export function computeReportScore(report: ClientDailyReport): ReportScore {
  const signals: SignalBreakdown = {
    platformHealth: scorePlatformHealth(report.platforms),
    cplCpaHealth: scoreCplCpaHealth(report.cplCpaAnalysis),
    insightSentiment: scoreInsightSentiment(report.insights),
    recommendationLoad: scoreRecommendationLoad(report.recommendations),
  };

  // Weighted average, excluding signals with no data (-1)
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const val = signals[key as keyof SignalBreakdown];
    if (val >= 0) {
      weightedSum += val * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  return { score, tier: tierFromScore(score), signals };
}

/* ── KPI Aggregation ── */

export interface AggregatedKpis {
  spend: number;
  cpa: number;
  cpl: number;
  conversions: number;
  roas: number;
}

export function aggregateKpis(report: ClientDailyReport): AggregatedKpis {
  let spend = 0;
  let conversions = 0;
  let leads = 0;
  let roasTotal = 0;
  let roasCount = 0;

  for (const p of report.platforms) {
    spend += parseCurrency(p.spend);
    conversions += parseCurrency(p.conversions);
    leads += parseCurrency(p.leads);
    const r = parseCurrency(p.roas);
    if (r > 0) {
      roasTotal += r;
      roasCount++;
    }
  }

  return {
    spend,
    cpa: conversions > 0 ? spend / conversions : 0,
    cpl: leads > 0 ? spend / leads : 0,
    conversions,
    roas: roasCount > 0 ? roasTotal / roasCount : 0,
  };
}

/* ── Dominant Trend ── */

export function computeDominantTrend(
  platforms: Platform[],
): 'up' | 'down' | 'stable' {
  if (!platforms || platforms.length === 0) return 'stable';

  let up = 0;
  let down = 0;

  for (const p of platforms) {
    if (p.trend === 'up') up++;
    else if (p.trend === 'down') down++;
  }

  if (up > down) return 'up';
  if (down > up) return 'down';
  return 'stable';
}

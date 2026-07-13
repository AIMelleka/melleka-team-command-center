import type {
  ClientDailyReport,
  Platform,
} from '@/types/dailyReports';
import { parseCurrency } from './shared';

/* ── Client Goals + Report Configuration type ── */
export interface ClientGoals {
  // ── Scoring inputs ──────────────────────────────────────────────────────
  target_cpl?: number | null;
  target_cpa?: number | null;
  target_roas?: number | null;
  monthly_budget?: number | null;
  monthly_lead_target?: number | null;
  monthly_conversion_target?: number | null;
  // ── Client profile (affects AI analysis & benchmark matching) ──────────
  industry?: string | null;
  primary_conversion_goal?: string | null;
  // ── Report context (sent to AI when generating report) ─────────────────
  client_notes?: string | null;
  report_focus?: string | null;
  targeting_context?: string | null;
}

/* ── Health tier from score ── */
export type HealthTier = 'excellent' | 'good' | 'warning' | 'critical';

export function tierFromScore(score: number): HealthTier {
  if (score >= 80) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 60) return 'warning';
  return 'critical';
}

export const tierColors: Record<HealthTier, string> = {
  excellent: '#10b981', // emerald-500
  good: '#3b82f6',     // blue-500
  warning: '#f59e0b',  // amber-500
  critical: '#ef4444', // red-500
};

/* ── Signal scorers (data-driven) ── */

/**
 * Cost Efficiency signal (0-100) — 50% weight
 * Uses actual CPA/CPL from aggregated KPIs vs client goals or industry benchmarks.
 */
function scoreCostEfficiency(
  kpis: AggregatedKpis,
  goals?: ClientGoals | null,
  industryBenchmarks?: { googleCpa?: number; metaCpa?: number } | null,
): number {
  // Determine targets: goals take priority, then industry benchmarks
  const hasGoalCpa = goals?.target_cpa != null && goals.target_cpa > 0;
  const hasGoalCpl = goals?.target_cpl != null && goals.target_cpl > 0;
  const targetCpa = hasGoalCpa
    ? goals!.target_cpa!
    : (industryBenchmarks ? averageBenchmarkCpa(industryBenchmarks) : null);
  const targetCpl = hasGoalCpl ? goals!.target_cpl! : null;

  // Use strict scoring for explicit goals, lenient for benchmarks
  const usingGoals = hasGoalCpa || hasGoalCpl;
  const scorer = usingGoals ? goalRatioToScore : benchmarkRatioToScore;

  // If we have neither goals nor benchmarks, return neutral
  if (targetCpa == null && targetCpl == null) return 60;

  const scores: number[] = [];

  // Score CPA against target
  if (targetCpa != null && targetCpa > 0 && kpis.conversions > 0) {
    const ratio = kpis.cpa / targetCpa;
    scores.push(scorer(ratio));
  }

  // Score CPL against target
  if (targetCpl != null && targetCpl > 0 && kpis.cpl > 0) {
    const ratio = kpis.cpl / targetCpl;
    scores.push(scorer(ratio));
  }

  if (scores.length === 0) return 60; // No actionable data
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Average the Google and Meta CPA benchmarks for a blended target. */
function averageBenchmarkCpa(bm: { googleCpa?: number; metaCpa?: number }): number | null {
  const vals = [bm.googleCpa, bm.metaCpa].filter((v): v is number => v != null && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Convert actual/target ratio to score when comparing against explicit client goals. */
function goalRatioToScore(ratio: number): number {
  if (ratio <= 0.7) return 100;       // 30%+ under target
  if (ratio <= 0.85) return 92;       // 15-30% under
  if (ratio <= 1.0) return 85;        // at or below target
  if (ratio <= 1.1) return 75;        // 0-10% over
  if (ratio <= 1.25) return 60;       // 10-25% over
  if (ratio <= 1.5) return 45;        // 25-50% over
  if (ratio <= 2.0) return 30;        // 50-100% over
  return 20;                           // 100%+ over target
}

/** Convert actual/benchmark ratio to score. More lenient since benchmarks are industry averages, not client targets. */
function benchmarkRatioToScore(ratio: number): number {
  if (ratio <= 0.5) return 95;        // way below average — great
  if (ratio <= 0.75) return 85;       // well below average
  if (ratio <= 1.0) return 75;        // at or below average
  if (ratio <= 1.5) return 65;        // somewhat above average
  if (ratio <= 2.0) return 55;        // notably above average
  if (ratio <= 3.0) return 45;        // well above average
  if (ratio <= 5.0) return 35;        // very high vs average
  return 25;                           // extremely high vs average
}

/**
 * Volume & Pacing signal (0-100) — 30% weight
 * Compares conversions/leads against monthly targets if set.
 */
function scoreVolumePacing(
  kpis: AggregatedKpis,
  goals?: ClientGoals | null,
): number {
  const convTarget = goals?.monthly_conversion_target;
  const leadTarget = goals?.monthly_lead_target;

  // If targets exist, score against daily pacing
  if (convTarget && convTarget > 0 && kpis.conversions > 0) {
    const dailyTarget = convTarget / 30;
    const pace = kpis.conversions / dailyTarget;
    return paceToScore(pace);
  }

  if (leadTarget && leadTarget > 0 && kpis.cpl > 0) {
    // Estimate leads from spend / cpl
    const budgetTarget = goals?.monthly_budget;
    if (budgetTarget && budgetTarget > 0) {
      const dailyBudget = budgetTarget / 30;
      const estimatedDailyLeads = dailyBudget / kpis.cpl;
      const dailyLeadTarget = leadTarget / 30;
      const pace = estimatedDailyLeads / dailyLeadTarget;
      return paceToScore(pace);
    }
  }

  // No targets — score based on data presence
  let base = 60;
  if (kpis.conversions > 0) base += 10;
  if (kpis.spend > 0) base += 5;
  return Math.min(100, base);
}

/** Convert pacing ratio to score. 1.0 = on track. */
function paceToScore(pace: number): number {
  if (pace >= 1.2) return 95;     // ahead of pace
  if (pace >= 1.0) return 85;     // on target
  if (pace >= 0.8) return 70;     // slightly behind
  if (pace >= 0.6) return 50;     // significantly behind
  if (pace >= 0.4) return 30;     // way behind
  return 15;                       // barely any volume
}

/**
 * Trend Direction signal (0-100) — 20% weight
 * Simple mapping of platform trend fields.
 */
function scoreTrendDirection(platforms: Platform[]): number {
  if (!platforms || platforms.length === 0) return -1;

  const trendMap: Record<string, number> = {
    up: 85,
    stable: 60,
    down: 30,
  };

  let total = 0;
  let count = 0;

  for (const p of platforms) {
    const val = trendMap[p.trend] ?? 60;
    total += val;
    count++;
  }

  return count > 0 ? Math.round(total / count) : -1;
}

/* ── Composite score ── */

export interface SignalBreakdown {
  costEfficiency: number;
  volumePacing: number;
  trendDirection: number;
}

export interface ReportScore {
  score: number;
  tier: HealthTier;
  signals: SignalBreakdown;
  /** Whether client goals were used for scoring */
  usedGoals: boolean;
  /** Whether industry benchmarks were used as fallback */
  usedBenchmarks: boolean;
}

const WEIGHTS = {
  costEfficiency: 0.50,
  volumePacing: 0.30,
  trendDirection: 0.20,
};

export function computeReportScore(
  report: ClientDailyReport,
  goals?: ClientGoals | null,
  industryBenchmarks?: { googleCpa?: number; metaCpa?: number } | null,
): ReportScore {
  const kpis = aggregateKpis(report);
  const usedGoals = !!(goals?.target_cpa || goals?.target_cpl || goals?.monthly_conversion_target || goals?.monthly_lead_target);
  const usedBenchmarks = !usedGoals && !!(industryBenchmarks?.googleCpa || industryBenchmarks?.metaCpa);

  const signals: SignalBreakdown = {
    costEfficiency: scoreCostEfficiency(kpis, goals, industryBenchmarks),
    volumePacing: scoreVolumePacing(kpis, goals),
    trendDirection: scoreTrendDirection(report.platforms),
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
  return { score, tier: tierFromScore(score), signals, usedGoals, usedBenchmarks };
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

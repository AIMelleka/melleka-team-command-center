/**
 * Server-side port of client/src/components/daily-reports/scoring.ts
 *
 * Keeps the EXACT same formula so Slack reports always match the Daily Reports UI:
 *   Cost Efficiency  50%
 *   Volume & Pacing  30%
 *   Trend Direction  20%
 *
 * Goals from managed_clients (target_cpa, target_cpl, etc.) take priority over
 * benchmarks exactly as they do in the frontend.
 */

export interface ClientGoals {
  target_cpl?: number | null;
  target_cpa?: number | null;
  target_roas?: number | null;
  monthly_budget?: number | null;
  monthly_lead_target?: number | null;
  monthly_conversion_target?: number | null;
}

export interface Platform {
  name?: string;
  spend?: string | number;
  conversions?: string | number;
  leads?: string | number;
  roas?: string | number;
  trend?: "up" | "down" | "stable";
  [key: string]: unknown;
}

export type HealthTier = "excellent" | "good" | "warning" | "critical";

export function tierFromScore(score: number): HealthTier {
  if (score >= 80) return "excellent";
  if (score >= 70) return "good";
  if (score >= 60) return "warning";
  return "critical";
}

/** Slack emoji for each tier. good + excellent = green, warning = yellow, critical = red. */
export function tierEmoji(tier: HealthTier): string {
  if (tier === "excellent" || tier === "good") return ":large_green_circle:";
  if (tier === "warning") return ":large_yellow_circle:";
  return ":red_circle:";
}

// ── parseCurrency — identical to shared.tsx ──────────────────────────────────
function parseCurrency(val: string | number | undefined | null): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  return parseFloat((val as string).replace(/[^0-9.-]/g, "") || "0");
}

// ── KPI Aggregation — identical to scoring.ts ─────────────────────────────────
interface AggregatedKpis {
  spend: number;
  cpa: number;
  cpl: number;
  conversions: number;
  roas: number;
}

function aggregateKpis(platforms: Platform[]): AggregatedKpis {
  let spend = 0, conversions = 0, leads = 0, roasTotal = 0, roasCount = 0;

  for (const p of platforms) {
    spend += parseCurrency(p.spend);
    conversions += parseCurrency(p.conversions);
    leads += parseCurrency(p.leads);
    const r = parseCurrency(p.roas);
    if (r > 0) { roasTotal += r; roasCount++; }
  }

  return {
    spend,
    cpa: conversions > 0 ? spend / conversions : 0,
    cpl: leads > 0 ? spend / leads : 0,
    conversions,
    roas: roasCount > 0 ? roasTotal / roasCount : 0,
  };
}

// ── Ratio scorers ─────────────────────────────────────────────────────────────
function goalRatioToScore(ratio: number): number {
  if (ratio <= 0.70) return 100;
  if (ratio <= 0.85) return 92;
  if (ratio <= 1.00) return 85;
  if (ratio <= 1.10) return 75;
  if (ratio <= 1.25) return 60;
  if (ratio <= 1.50) return 45;
  if (ratio <= 2.00) return 30;
  return 20;
}

function benchmarkRatioToScore(ratio: number): number {
  if (ratio <= 0.50) return 95;
  if (ratio <= 0.75) return 85;
  if (ratio <= 1.00) return 75;
  if (ratio <= 1.50) return 65;
  if (ratio <= 2.00) return 55;
  if (ratio <= 3.00) return 45;
  if (ratio <= 5.00) return 35;
  return 25;
}

// ── Signal scorers ────────────────────────────────────────────────────────────
function scoreCostEfficiency(kpis: AggregatedKpis, goals?: ClientGoals | null): number {
  const hasGoalCpa = goals?.target_cpa != null && goals.target_cpa > 0;
  const hasGoalCpl = goals?.target_cpl != null && goals.target_cpl > 0;
  const targetCpa = hasGoalCpa ? goals!.target_cpa! : null;
  const targetCpl = hasGoalCpl ? goals!.target_cpl! : null;

  if (targetCpa == null && targetCpl == null) return 60;

  const usingGoals = hasGoalCpa || hasGoalCpl;
  const scorer = usingGoals ? goalRatioToScore : benchmarkRatioToScore;
  const scores: number[] = [];

  if (targetCpa != null && targetCpa > 0 && kpis.conversions > 0) {
    scores.push(scorer(kpis.cpa / targetCpa));
  }
  if (targetCpl != null && targetCpl > 0 && kpis.cpl > 0) {
    scores.push(scorer(kpis.cpl / targetCpl));
  }

  if (scores.length === 0) return 60;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function scoreVolumePacing(kpis: AggregatedKpis, goals?: ClientGoals | null): number {
  const convTarget = goals?.monthly_conversion_target;
  const leadTarget = goals?.monthly_lead_target;

  if (convTarget && convTarget > 0 && kpis.conversions > 0) {
    return paceToScore(kpis.conversions / (convTarget / 30));
  }

  if (leadTarget && leadTarget > 0 && kpis.cpl > 0) {
    const budgetTarget = goals?.monthly_budget;
    if (budgetTarget && budgetTarget > 0) {
      const estimatedDailyLeads = (budgetTarget / 30) / kpis.cpl;
      return paceToScore(estimatedDailyLeads / (leadTarget / 30));
    }
  }

  let base = 60;
  if (kpis.conversions > 0) base += 10;
  if (kpis.spend > 0) base += 5;
  return Math.min(100, base);
}

function paceToScore(pace: number): number {
  if (pace >= 1.2) return 95;
  if (pace >= 1.0) return 85;
  if (pace >= 0.8) return 70;
  if (pace >= 0.6) return 50;
  if (pace >= 0.4) return 30;
  return 15;
}

function scoreTrendDirection(platforms: Platform[]): number {
  if (!platforms || platforms.length === 0) return -1;
  const trendMap: Record<string, number> = { up: 85, stable: 60, down: 30 };
  let total = 0, count = 0;
  for (const p of platforms) {
    total += trendMap[p.trend ?? "stable"] ?? 60;
    count++;
  }
  return count > 0 ? Math.round(total / count) : -1;
}

// ── Composite score ───────────────────────────────────────────────────────────
const WEIGHTS = { costEfficiency: 0.50, volumePacing: 0.30, trendDirection: 0.20 };

export interface ReportScore {
  score: number;
  tier: HealthTier;
  usedGoals: boolean;
}

export function computeReportScore(
  platforms: Platform[],
  goals?: ClientGoals | null,
): ReportScore {
  const kpis = aggregateKpis(platforms);
  const usedGoals = !!(
    goals?.target_cpa ||
    goals?.target_cpl ||
    goals?.monthly_conversion_target ||
    goals?.monthly_lead_target
  );

  const signals = {
    costEfficiency: scoreCostEfficiency(kpis, goals),
    volumePacing: scoreVolumePacing(kpis, goals),
    trendDirection: scoreTrendDirection(platforms),
  };

  let weightedSum = 0, totalWeight = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const val = signals[key as keyof typeof signals];
    if (val >= 0) {
      weightedSum += val * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  return { score, tier: tierFromScore(score), usedGoals };
}

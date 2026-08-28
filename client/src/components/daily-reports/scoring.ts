import type {
  ClientDailyReport,
  Platform,
} from '@/types/dailyReports';
import { parseCurrency } from './shared';

/* ── Platform Setting interface ── */
export interface PlatformSetting {
  priority: 'primary' | 'secondary' | 'off';
  focus_metric: 'cpa' | 'cpl' | 'roas' | 'cpm' | 'ctr';
  target_value?: number | null;    // platform-specific $ target (overrides global)
  monthly_target?: number | null;  // platform-specific monthly volume target
}

/* ── Client Goals + Report Configuration type ── */
export interface ClientGoals {
  // ── Primary conversion goal ────────────────────────────────────────────────
  primary_conversion_goal?: string | null;
  target_cpl?: number | null;
  target_cpa?: number | null;
  target_roas?: number | null;
  monthly_lead_target?: number | null;
  monthly_conversion_target?: number | null;
  // ── Secondary conversion goal ──────────────────────────────────────────────
  secondary_conversion_goal?: string | null;
  secondary_target_cpa?: number | null;
  secondary_target_cpl?: number | null;
  secondary_monthly_target?: number | null;
  // ── Tertiary conversion goal ───────────────────────────────────────────────
  tertiary_conversion_goal?: string | null;
  tertiary_target_cpa?: number | null;
  tertiary_target_cpl?: number | null;
  tertiary_monthly_target?: number | null;
  // ── Platform settings ──────────────────────────────────────────────────────
  platform_settings?: Record<string, PlatformSetting> | null;
  // ── Client profile (affects AI analysis & benchmark matching) ──────────────
  industry?: string | null;
  // ── Report context (sent to AI when generating report) ─────────────────────
  client_notes?: string | null;
  report_focus?: string | null;
  targeting_context?: string | null;
  // ── Active ad platforms (derived from client_account_mappings) ──────────────
  // e.g. ['google_ads', 'meta_ads']. When set, scoring only weighs these platforms.
  active_platforms?: string[] | null;
  // ── Legacy — kept in DB but removed from UI ───────────────────────────────
  monthly_budget?: number | null;
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

/* ── Platform normalization helpers ── */

/**
 * Maps a human-readable platform name from the report (e.g. "Google Ads", "Meta Ads")
 * to the canonical key used in client_account_mappings (e.g. "google_ads", "meta_ads").
 */
export function normalizePlatformKey(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('google')) return 'google_ads';
  if (l.includes('meta') || l.includes('facebook') || l.includes('fb ')) return 'meta_ads';
  if (l.includes('reddit')) return 'reddit_ads';
  if (l.includes('tiktok')) return 'tiktok_ads';
  if (l.includes('bing') || l.includes('microsoft')) return 'bing_ads';
  if (l.includes('linkedin')) return 'linkedin_ads';
  if (l.includes('vibe')) return 'vibe_tv_ads';
  return l.replace(/\s+/g, '_');
}

/** Get the priority of a platform from platform_settings, defaulting to 'primary' when no settings. */
function getPlatformPriority(
  platformName: string,
  settings?: Record<string, PlatformSetting> | null,
): 'primary' | 'secondary' | 'off' {
  if (!settings) return 'primary';
  const key = normalizePlatformKey(platformName);
  return settings[key]?.priority ?? 'primary';
}

/**
 * Filters a platform list to only those in activePlatforms AND not marked 'off' in platform_settings.
 * If activePlatforms is empty/null, returns all platforms not marked 'off'.
 */
function filterScoringPlatforms(
  platforms: Platform[],
  activePlatforms: string[] | null | undefined,
  settings?: Record<string, PlatformSetting> | null,
): Platform[] {
  return platforms.filter(p => {
    if (!p.name) return false;
    const key = normalizePlatformKey(p.name);
    // Exclude if explicitly marked off
    if (settings?.[key]?.priority === 'off') return false;
    // Filter to active platforms if set
    if (activePlatforms && activePlatforms.length > 0) {
      return activePlatforms.includes(key);
    }
    return true;
  });
}

/* ── Signal scorers (data-driven) ── */

/**
 * Cost Efficiency signal (0-100) — 50% weight
 * When platform_settings exist: scores per-platform with priority weighting.
 * Falls back to global target comparison when no platform settings.
 */
function scoreCostEfficiency(
  kpis: AggregatedKpis,
  goals?: ClientGoals | null,
  industryBenchmarks?: { googleCpa?: number; metaCpa?: number } | null,
  activePlatforms?: string[] | null,
  platforms?: Platform[],
): number {
  const settings = goals?.platform_settings;

  // Platform-aware scoring when settings are configured and platform data available
  if (settings && platforms && platforms.length > 0) {
    return scoreCostEfficiencyPerPlatform(platforms, goals, industryBenchmarks, activePlatforms);
  }

  // Legacy: global target comparison
  const hasGoalCpa = goals?.target_cpa != null && goals.target_cpa > 0;
  const hasGoalCpl = goals?.target_cpl != null && goals.target_cpl > 0;
  const targetCpa = hasGoalCpa
    ? goals!.target_cpa!
    : (industryBenchmarks ? averageBenchmarkCpa(industryBenchmarks, activePlatforms) : null);
  const targetCpl = hasGoalCpl ? goals!.target_cpl! : null;

  const usingGoals = hasGoalCpa || hasGoalCpl;
  const scorer = usingGoals ? goalRatioToScore : benchmarkRatioToScore;

  if (targetCpa == null && targetCpl == null) return 60;

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

/**
 * Per-platform cost efficiency scoring.
 * Primary platforms get 0.7 weight, secondary 0.3. Off platforms are excluded.
 */
function scoreCostEfficiencyPerPlatform(
  platforms: Platform[],
  goals?: ClientGoals | null,
  industryBenchmarks?: { googleCpa?: number; metaCpa?: number } | null,
  activePlatforms?: string[] | null,
): number {
  const settings = goals?.platform_settings;
  const scored: Array<{ score: number; weight: number }> = [];

  for (const p of platforms) {
    if (!p.name) continue;
    const priority = getPlatformPriority(p.name, settings);
    if (priority === 'off') continue;
    if (activePlatforms && activePlatforms.length > 0 && !activePlatforms.includes(normalizePlatformKey(p.name))) continue;

    const key = normalizePlatformKey(p.name);
    const platformSetting = settings?.[key];
    const focusMetric = platformSetting?.focus_metric ?? 'cpa';
    const platformTarget = platformSetting?.target_value;

    let score = 60;

    if (focusMetric === 'cpl' || focusMetric === 'cpa') {
      const actual = focusMetric === 'cpl'
        ? parseCurrency(p.costPerLead ?? p.leads)
        : parseCurrency(p.costPerConversion ?? p.conversions);

      const target = platformTarget
        ?? (focusMetric === 'cpl' ? goals?.target_cpl : goals?.target_cpa)
        ?? (industryBenchmarks ? averageBenchmarkCpa(industryBenchmarks, activePlatforms) : null);

      if (actual > 0 && target != null && target > 0) {
        const usingGoal = !!(platformTarget || (focusMetric === 'cpl' ? goals?.target_cpl : goals?.target_cpa));
        score = usingGoal
          ? goalRatioToScore(actual / target)
          : benchmarkRatioToScore(actual / target);
      }
    } else if (focusMetric === 'roas') {
      const actual = parseCurrency(p.roas);
      const target = platformTarget ?? goals?.target_roas;
      if (actual > 0 && target != null && target > 0) {
        score = goalRatioToScore(target / actual); // inverted: higher ROAS is better
      }
    }

    const weight = priority === 'primary' ? 0.7 : 0.3;
    scored.push({ score, weight });
  }

  if (scored.length === 0) return 60;

  const totalWeight = scored.reduce((s, x) => s + x.weight, 0);
  const weighted = scored.reduce((s, x) => s + x.score * (x.weight / totalWeight), 0);
  return Math.round(weighted);
}

/**
 * Average the benchmark CPA values for platforms the client actually uses.
 */
function averageBenchmarkCpa(
  bm: { googleCpa?: number; metaCpa?: number },
  activePlatforms?: string[] | null,
): number | null {
  const hasFilter = activePlatforms && activePlatforms.length > 0;
  const includeGoogle = !hasFilter || activePlatforms!.includes('google_ads');
  const includeMeta = !hasFilter || activePlatforms!.includes('meta_ads');

  const vals: number[] = [];
  if (includeGoogle && bm.googleCpa != null && bm.googleCpa > 0) vals.push(bm.googleCpa);
  if (includeMeta && bm.metaCpa != null && bm.metaCpa > 0) vals.push(bm.metaCpa);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Convert actual/target ratio to score when comparing against explicit client goals. */
function goalRatioToScore(ratio: number): number {
  if (ratio <= 0.7) return 100;
  if (ratio <= 0.85) return 92;
  if (ratio <= 1.0) return 85;
  if (ratio <= 1.1) return 75;
  if (ratio <= 1.25) return 60;
  if (ratio <= 1.5) return 45;
  if (ratio <= 2.0) return 30;
  return 20;
}

/** Convert actual/benchmark ratio to score. More lenient since benchmarks are industry averages. */
function benchmarkRatioToScore(ratio: number): number {
  if (ratio <= 0.5) return 95;
  if (ratio <= 0.75) return 85;
  if (ratio <= 1.0) return 75;
  if (ratio <= 1.5) return 65;
  if (ratio <= 2.0) return 55;
  if (ratio <= 3.0) return 45;
  if (ratio <= 5.0) return 35;
  return 25;
}

/**
 * Volume & Pacing signal (0-100) — 30% weight
 */
function scoreVolumePacing(
  kpis: AggregatedKpis,
  goals?: ClientGoals | null,
): number {
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

/**
 * Trend Direction signal (0-100) — 20% weight
 * When platform_settings exist: primary 0.7, secondary 0.3, off excluded.
 */
function scoreTrendDirection(
  platforms: Platform[],
  goals?: ClientGoals | null,
): number {
  if (!platforms || platforms.length === 0) return -1;

  const trendMap: Record<string, number> = { up: 85, stable: 60, down: 30 };
  const settings = goals?.platform_settings;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const p of platforms) {
    if (!p.name) continue;
    const priority = getPlatformPriority(p.name, settings);
    if (priority === 'off') continue;

    const val = trendMap[p.trend] ?? 60;
    const weight = settings ? (priority === 'primary' ? 0.7 : 0.3) : 1;
    weightedSum += val * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : -1;
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
  usedGoals: boolean;
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
  const activePlatforms = goals?.active_platforms ?? null;
  const settings = goals?.platform_settings;
  // Prefer verified Supermetrics data for scoring — guaranteed accurate numbers.
  // Falls back to AI-extracted platforms for old reports that predate verified_platforms.
  const sourcePlatforms = (report.verifiedPlatforms && report.verifiedPlatforms.length > 0)
    ? report.verifiedPlatforms
    : report.platforms;
  const scoringPlatforms = filterScoringPlatforms(sourcePlatforms, activePlatforms, settings);

  const kpis = aggregateKpisFromList(scoringPlatforms);
  const usedGoals = !!(
    goals?.target_cpa || goals?.target_cpl ||
    goals?.monthly_conversion_target || goals?.monthly_lead_target ||
    goals?.platform_settings
  );
  const usedBenchmarks = !usedGoals && !!(industryBenchmarks?.googleCpa || industryBenchmarks?.metaCpa);

  const signals: SignalBreakdown = {
    costEfficiency: scoreCostEfficiency(kpis, goals, industryBenchmarks, activePlatforms, scoringPlatforms),
    volumePacing: scoreVolumePacing(kpis, goals),
    trendDirection: scoreTrendDirection(scoringPlatforms, goals),
  };

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

function aggregateKpisFromList(platforms: Platform[]): AggregatedKpis {
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

export function aggregateKpis(report: ClientDailyReport): AggregatedKpis {
  return aggregateKpisFromList(report.platforms);
}

/* ── Dominant Trend ── */

export function computeDominantTrend(platforms: Platform[]): 'up' | 'down' | 'stable' {
  if (!platforms || platforms.length === 0) return 'stable';
  let up = 0, down = 0;
  for (const p of platforms) {
    if (p.trend === 'up') up++;
    else if (p.trend === 'down') down++;
  }
  if (up > down) return 'up';
  if (down > up) return 'down';
  return 'stable';
}

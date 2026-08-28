import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { ExternalLink, ChevronLeft, ChevronRight, Newspaper, RefreshCw, ChevronDown, BarChart3, ArrowRight, CheckCircle2, Trophy } from 'lucide-react';
import { useTaskStats, getManagers } from '@/hooks/useNotionTasks';
import { useBonusProfile } from '@/hooks/useBonusProfile';
import { useIsTaskDoneInRange } from '@/hooks/useTaskSettings';
import { ScoreRing } from '@/components/daily-reports/ScoreRing';
import { computeReportScore, type HealthTier } from '@/components/daily-reports/scoring';
import { INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK } from '@/data/industryBenchmarks';
import { parseISO, format as formatDate } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.PROD ? 'https://api.teams.melleka.com/api' : '/api';

const SHORTCUT_SECTIONS = [
  {
    label: 'Super Agent',
    description: 'Your AI-powered marketing agent. Chat, delegate tasks, and run automations.',
    route: '/chat',
    icon: '🤖',
  },
  {
    label: 'Daily Ad Reports',
    description: 'View daily performance reports for all client ad accounts.',
    route: '/daily-reports',
    icon: '📊',
  },
  {
    label: 'Weekly Client Updates',
    description: 'Review and send weekly client update summaries.',
    route: '/weekly-updates',
    icon: '📅',
  },
];

const GUIDE_SUBSECTIONS = [
  {
    label: 'Sales Guide',
    description: 'Scripts, objection handling, and closing strategies for the Melleka sales process.',
    route: '/sales-guide',
    icon: '💼',
  },
  {
    label: 'SOP',
    description: 'Master operating manual with policies, QA checklists, role cards, and an AI assistant to answer your questions.',
    route: '/sop',
    icon: '📋',
  },
  {
    label: 'New Hire Guide',
    description: 'Everything a new team member needs to get up and running at Melleka.',
    route: '/guide/new-hire',
    icon: '🚀',
  },
];

// ── Bonus tracker constants ───────────────────────────────────────────────

const BONUS_TIERS = [
  { tasks: 150, bonus: 100 },
  { tasks: 200, bonus: 150 },
  { tasks: 250, bonus: 200 },
  { tasks: 300, bonus: 250 },
  { tasks: 350, bonus: 300 },
  { tasks: 400, bonus: 350 },
  { tasks: 450, bonus: 400 },
  { tasks: 500, bonus: 450 },
  { tasks: 550, bonus: 500 },
  { tasks: 600, bonus: 550 },
  { tasks: 650, bonus: 600 },
  { tasks: 700, bonus: 650 },
  { tasks: 750, bonus: 700 },
  { tasks: 800, bonus: 750 },
  { tasks: 850, bonus: 800 },
  { tasks: 900, bonus: 850 },
  { tasks: 950, bonus: 900 },
  { tasks: 1000, bonus: 950 },
  { tasks: 1050, bonus: 1000 },
];

function getBonusTier(taskCount: number) {
  const currentTier = [...BONUS_TIERS].reverse().find((t) => taskCount >= t.tasks) ?? null;
  const nextTier = BONUS_TIERS.find((t) => t.tasks > taskCount) ?? null;
  return { currentTier, nextTier };
}

function getMonthDateRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: first.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  'Platform Update': 'bg-blue-500/15 text-blue-400',
  'SEO': 'bg-green-500/15 text-green-400',
  'AI': 'bg-purple-500/15 text-purple-400',
  'Social Media': 'bg-pink-500/15 text-pink-400',
  'Ads': 'bg-orange-500/15 text-orange-400',
  'Industry': 'bg-slate-500/15 text-slate-400',
};

const CYCLE_MS = 5000; // 5 seconds per item

interface NewsItem {
  headline: string;
  source: string;
  summary: string;
  category: string;
  url?: string;
}

function MarketingNewsTicker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ items: NewsItem[]; fetchedAt: string; cached: boolean }>({
    queryKey: ['marketing-news'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${API_BASE}/marketing-news`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.status === 503) {
        // Server still warming up — throw so react-query retries
        throw new Error('retry');
      }
      if (!resp.ok) throw new Error('Failed to fetch news');
      return resp.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: 6,
    retryDelay: (attempt) => Math.min(5000 * attempt, 30000),
  });

  const items = data?.items ?? [];

  const advance = useCallback((dir: 1 | -1) => {
    if (items.length === 0) return;
    setVisible(false);
    setTimeout(() => {
      setIndex((i) => (i + dir + items.length) % items.length);
      setVisible(true);
    }, 200);
  }, [items.length]);

  // Auto-cycle
  useEffect(() => {
    if (paused || items.length <= 1) return;
    timerRef.current = setInterval(() => advance(1), CYCLE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, items.length, advance]);

  // Reset index when news loads
  useEffect(() => { setIndex(0); }, [items.length]);

  const handleRefresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${API_BASE}/marketing-news?refresh=1`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    refetch();
  };

  if (isLoading || (isFetching && items.length === 0)) {
    return (
      <div className="mb-8 rounded-xl border bg-card p-4 flex items-center gap-3 text-muted-foreground text-sm">
        <Newspaper className="h-4 w-4 shrink-0 text-primary" />
        <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span>Loading marketing news...</span>
      </div>
    );
  }

  if (isError || items.length === 0) {
    return (
      <div className="mb-8 rounded-xl border bg-card/50 p-4 flex items-center gap-3 text-muted-foreground text-sm">
        <Newspaper className="h-4 w-4 shrink-0" />
        <span className="flex-1">Marketing news unavailable right now.</span>
        <button onClick={() => refetch()} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  const item = items[index];
  const catColor = CATEGORY_COLORS[item.category] ?? 'bg-slate-500/15 text-slate-400';

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Newspaper className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-foreground">Recent Marketing News</h2>
        <span className="text-xs text-muted-foreground ml-1">
          {index + 1}/{items.length}
        </span>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh news"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        className="relative rounded-xl border bg-card overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Progress bar */}
        {!paused && items.length > 1 && (
          <div className="absolute top-0 left-0 h-0.5 bg-primary/20 w-full">
            <div
              key={`${index}-${paused}`}
              className="h-full bg-primary origin-left"
              style={{
                animation: `growWidth ${CYCLE_MS}ms linear forwards`,
              }}
            />
          </div>
        )}

        <div
          className="p-4 sm:p-5 transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${catColor}`}>
                  {item.category}
                </span>
                <span className="text-xs text-muted-foreground">{item.source}</span>
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors leading-snug line-clamp-2 block mb-1"
                >
                  {item.headline}
                </a>
              ) : (
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
                  {item.headline}
                </p>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
            </div>

            {items.length > 1 && (
              <div className="flex gap-1 shrink-0 mt-1">
                <button
                  onClick={() => advance(-1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => advance(1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Dot indicators */}
          {items.length > 1 && (
            <div className="flex gap-1 mt-3 justify-center">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setVisible(false); setTimeout(() => { setIndex(i); setVisible(true); }, 200); }}
                  className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes growWidth {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── Daily Task Tracker Widget ─────────────────────────

const DAILY_GOAL = 35;

function TodayTasksPanel() {
  const navigate = useNavigate();
  const today = formatDate(new Date(), 'yyyy-MM-dd');
  const isTaskDoneToday = useIsTaskDoneInRange(today, today);

  const { data, isLoading } = useTaskStats(today, today);

  const taskCount = useMemo(() => {
    if (!data?.tasks) return 0;
    return data.tasks.filter(t => isTaskDoneToday(t)).length;
  }, [data, isTaskDoneToday]);

  const isGoalMet = taskCount >= DAILY_GOAL;
  const progressPct = Math.min(100, Math.round((taskCount / DAILY_GOAL) * 100));
  const toGoal = DAILY_GOAL - taskCount;

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progressPct / 100) * circumference;

  if (isLoading) return (
    <button
      onClick={() => navigate('/task-tracker')}
      className="w-full rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2"
    >
      <div className="flex items-center gap-1.5 w-full">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Tracker</span>
      </div>
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground my-6" />
    </button>
  );

  return (
    <button
      onClick={() => navigate('/task-tracker')}
      className="w-full rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-accent/10 transition-all group text-left"
    >
      <div className="flex items-center gap-1.5 w-full">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Tracker</span>
      </div>

      {/* Donut chart */}
      <div className="relative my-1">
        <svg width="110" height="110" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={isGoalMet ? '#10b981' : '#6366f1'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
          />
          <text x="50" y="46" textAnchor="middle" fill="currentColor" fontSize="18" fontWeight="bold" className="fill-foreground">
            {taskCount}
          </text>
          <text x="50" y="60" textAnchor="middle" fill="currentColor" fontSize="9" className="fill-muted-foreground">
            of {DAILY_GOAL}
          </text>
        </svg>
      </div>

      <p className="text-xs text-muted-foreground text-center leading-snug">
        {isGoalMet
          ? <span className="text-emerald-400 font-semibold">Daily goal reached!</span>
          : <><span className="font-semibold text-foreground">{toGoal} more</span> to reach {DAILY_GOAL}</>
        }
      </p>
    </button>
  );
}

// ── Bonus Tracker Widget ─────────────────────────────

function BonusTrackerWidget() {
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useBonusProfile();
  const { dateFrom, dateTo } = useMemo(getMonthDateRange, []);
  const isTaskDoneInRange = useIsTaskDoneInRange(dateFrom, dateTo);

  const enabled = !!profile?.bonusEnabled;
  const { data: statsData, isLoading: statsLoading } = useTaskStats(
    enabled ? dateFrom : undefined,
    enabled ? dateTo : undefined,
  );

  const taskCount = useMemo(() => {
    if (!profile?.notionManagerName || !statsData?.tasks) return 0;
    const managerName = profile.notionManagerName;
    return statsData.tasks.filter(
      (t) => isTaskDoneInRange(t) && getManagers(t.properties).some((m) => m.name === managerName),
    ).length;
  }, [statsData, profile?.notionManagerName, isTaskDoneInRange]);

  const { currentTier, nextTier } = useMemo(() => getBonusTier(taskCount), [taskCount]);

  if (profileLoading) return null;
  if (!profile?.bonusEnabled) return null;

  const isMaxed = taskCount >= BONUS_TIERS[BONUS_TIERS.length - 1].tasks;
  const preTier = taskCount < BONUS_TIERS[0].tasks;
  const progressStart = currentTier?.tasks ?? 0;
  const progressEnd = nextTier?.tasks ?? BONUS_TIERS[BONUS_TIERS.length - 1].tasks;
  const progressPct = isMaxed
    ? 100
    : preTier
    ? Math.round((taskCount / BONUS_TIERS[0].tasks) * 100)
    : Math.round(((taskCount - progressStart) / (progressEnd - progressStart)) * 100);

  // SVG donut chart values
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const dashOffset = circumference - (progressPct / 100) * circumference;

  return (
    <button
      onClick={() => navigate('/my-tasks')}
      className="w-full rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-accent/10 transition-all group text-left"
    >
      <div className="flex items-center gap-1.5 w-full">
        <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bonus Tracker</span>
      </div>

      {/* Donut chart */}
      <div className="relative my-1">
        <svg width="110" height="110" viewBox="0 0 100 100">
          {/* Background track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="#22c55e"
            strokeWidth="10"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          {/* Center: task count */}
          <text x="50" y="46" textAnchor="middle" fill="currentColor" fontSize="20" fontWeight="700" className="fill-foreground">
            {statsLoading ? '—' : taskCount}
          </text>
          <text x="50" y="60" textAnchor="middle" fill="currentColor" fontSize="10" className="fill-muted-foreground">
            tasks
          </text>
          <text x="50" y="72" textAnchor="middle" fill="currentColor" fontSize="10" className="fill-muted-foreground">
            this month
          </text>
        </svg>
      </div>

      {/* Bonus label */}
      <div className="text-center leading-tight">
        {currentTier ? (
          <p className="text-sm font-bold text-green-500">${currentTier.bonus} earned</p>
        ) : (
          <p className="text-xs text-muted-foreground">{BONUS_TIERS[0].tasks - taskCount} tasks to first bonus</p>
        )}
        {nextTier && !isMaxed && (
          <p className="text-xs text-muted-foreground mt-0.5">${nextTier.bonus} at {nextTier.tasks} tasks</p>
        )}
        {isMaxed && (
          <p className="text-xs text-yellow-500 font-medium mt-0.5">Max bonus reached!</p>
        )}
      </div>

      <span className="text-xs text-primary group-hover:underline mt-0.5">View Details</span>
    </button>
  );
}

// ── Daily Scores Panel ───────────────────────────────

interface ClientScore {
  clientName: string;
  score: number;
  tier: HealthTier;
}

const TIER_LABEL: Record<HealthTier, string> = {
  excellent: 'Excellent',
  good: 'Good',
  warning: 'Warning',
  critical: 'Critical',
};

const TIER_BG: Record<HealthTier, string> = {
  excellent: 'bg-emerald-500/15 text-emerald-500',
  good: 'bg-blue-500/15 text-blue-500',
  warning: 'bg-amber-500/15 text-amber-500',
  critical: 'bg-red-500/15 text-red-500',
};

function getBenchmarks(industry: string | null): { googleCpa?: number; metaCpa?: number } {
  if (!industry) return { googleCpa: DEFAULT_BENCHMARK.google.cpa, metaCpa: DEFAULT_BENCHMARK.facebook.cpa };
  const lower = industry.toLowerCase();
  const exact = INDUSTRY_BENCHMARKS.find(b => b.industry.toLowerCase() === lower);
  if (exact) return { googleCpa: exact.google.cpa, metaCpa: exact.facebook.cpa };
  const partial = INDUSTRY_BENCHMARKS.find(b =>
    b.industry.toLowerCase().includes(lower) || lower.includes(b.industry.toLowerCase().split(' ')[0])
  );
  if (partial) return { googleCpa: partial.google.cpa, metaCpa: partial.facebook.cpa };
  let bestMatch: typeof INDUSTRY_BENCHMARKS[0] | null = null;
  let bestScore = 0;
  for (const bm of INDUSTRY_BENCHMARKS) {
    let score = 0;
    for (const kw of bm.keywords) { if (lower.includes(kw)) score += 2; }
    for (const word of lower.split(/\s+/)) {
      if (word.length >= 3 && bm.keywords.some(kw => kw.includes(word))) score += 1;
    }
    if (score > bestScore) { bestScore = score; bestMatch = bm; }
  }
  if (bestMatch && bestScore >= 2) return { googleCpa: bestMatch.google.cpa, metaCpa: bestMatch.facebook.cpa };
  return { googleCpa: DEFAULT_BENCHMARK.google.cpa, metaCpa: DEFAULT_BENCHMARK.facebook.cpa };
}

function DailyScoresPanel() {
  const navigate = useNavigate();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['home-daily-scores'],
    queryFn: async () => {
      const { data: dateRows } = await supabase
        .from('ad_review_history')
        .select('review_date')
        .order('review_date', { ascending: false })
        .limit(1);

      if (!dateRows?.length) return null;
      const latestDate = dateRows[0].review_date;

      const [{ data: rows }, { data: goals }] = await Promise.all([
        supabase
          .from('ad_review_history')
          .select('client_name, platforms, seo_data, created_at, industry')
          .eq('review_date', latestDate)
          .order('client_name', { ascending: true }),
        supabase
          .from('managed_clients')
          .select('client_name, target_cpa, target_cpl, target_roas, monthly_budget, monthly_lead_target, monthly_conversion_target, industry, primary_conversion_goal')
          .eq('is_active', true),
      ]);

      return { latestDate, rows: rows || [], goals: goals || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const scores = useMemo((): ClientScore[] => {
    if (!data?.rows?.length) return [];

    const byClient = new Map<string, any>();
    for (const row of data.rows) {
      const existing = byClient.get(row.client_name);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        byClient.set(row.client_name, row);
      }
    }

    return Array.from(byClient.values()).map((row): ClientScore => {
      const fullAnalysis = row.seo_data?.fullAnalysis || {};
      const platforms = Array.isArray(row.platforms) && row.platforms.length > 0
        ? row.platforms : (fullAnalysis.platforms || []);
      const industry = row.industry || fullAnalysis.industry || null;
      const clientGoals = data.goals.find(
        (g: any) => g.client_name?.toLowerCase() === row.client_name?.toLowerCase()
      ) || null;
      const { score, tier } = computeReportScore({ platforms } as any, clientGoals, getBenchmarks(clientGoals?.industry ?? industry));
      return { clientName: row.client_name, score, tier };
    }).sort((a, b) => a.score - b.score);
  }, [data]);

  const dateLabel = data?.latestDate
    ? formatDate(parseISO(data.latestDate), 'EEEE, MMMM d')
    : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Daily Ad Reports</p>
          {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Client list */}
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : scores.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No reports yet today.
          </div>
        ) : (
          scores.map((s) => (
            <div
              key={s.clientName}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate('/daily-reports')}
            >
              <ScoreRing score={s.score} size={36} strokeWidth={3} />
              <span className="flex-1 text-sm font-medium text-foreground truncate min-w-0">
                {s.clientName}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TIER_BG[s.tier]}`}>
                {TIER_LABEL[s.tier]}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {scores.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={() => navigate('/daily-reports')}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            View Full Reports
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────

const TheGuide = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, user } = useAuth();
  const [guidesOpen, setGuidesOpen] = useState(false);
  const { data: bonusProfile } = useBonusProfile();

  const welcomeName = bonusProfile?.displayName
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || null;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      <AdminHeader />
      <main className="container mx-auto px-4 py-8">
        {welcomeName && (
          <h1 className="text-2xl font-bold text-foreground mb-6">
            Welcome Back, {welcomeName}
          </h1>
        )}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left column */}
          <div className="flex-1 min-w-0">
            <MarketingNewsTicker />

            {/* Tasks today + bonus tracker row */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 items-start">
              <div className="flex-1 min-w-0">
                <TodayTasksPanel />
              </div>
              <div className="flex-1 min-w-0">
                <BonusTrackerWidget />
              </div>
            </div>

            <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-display font-bold mb-1">Shortcuts</h1>
                <p className="text-muted-foreground">Quick access to your most-used tools and resources.</p>
              </div>
              {isSuperAdmin && (
                <Button variant="outline" onClick={() => navigate('/websites')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage in Website Builder
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SHORTCUT_SECTIONS.map((section) => (
                <button
                  key={section.route}
                  onClick={() => navigate(section.route)}
                  className="text-left bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:bg-accent/10 transition-all group min-h-[44px]"
                >
                  <div className="text-3xl mb-3">{section.icon}</div>
                  <h2 className="text-base font-semibold mb-2 group-hover:text-primary transition-colors">{section.label}</h2>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </button>
              ))}

              {/* Guides expandable card */}
              <button
                onClick={() => setGuidesOpen((o) => !o)}
                className={`text-left bg-card border rounded-xl p-6 hover:border-primary/50 hover:bg-accent/10 transition-all group min-h-[44px] ${guidesOpen ? 'border-primary/50 bg-accent/10' : 'border-border'}`}
              >
                <div className="text-3xl mb-3">📚</div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold group-hover:text-primary transition-colors">Guides</h2>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${guidesOpen ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-sm text-muted-foreground">Sales Guide, SOP, and New Hire resources.</p>
              </button>
            </div>

            {/* Guides sub-sections */}
            {guidesOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {GUIDE_SUBSECTIONS.map((section) => (
                  <button
                    key={section.route}
                    onClick={() => navigate(section.route)}
                    className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:bg-accent/10 transition-all group min-h-[44px]"
                  >
                    <div className="text-2xl mb-3">{section.icon}</div>
                    <h2 className="text-base font-semibold mb-2 group-hover:text-primary transition-colors">{section.label}</h2>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right column: Daily Ad Scores */}
          <div className="w-full lg:w-72 shrink-0">
            <DailyScoresPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TheGuide;

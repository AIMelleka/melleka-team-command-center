import { useMemo, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import AdminHeader from '@/components/AdminHeader';
import { useBonusProfile } from '@/hooks/useBonusProfile';
import { useTaskStats } from '@/hooks/useNotionTasks';
import { useIsTaskDoneInRange } from '@/hooks/useTaskSettings';
import {
  getManagers,
} from '@/hooks/useNotionTasks';
import { Trophy, Loader2, Lock, TrendingUp, Star, ChevronRight, Crown, Zap, MessageSquare } from 'lucide-react';
import { useMyAchievements } from '@/hooks/useAchievements';

// ── Bonus tier table ────────────────────────────────────────────────────────
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

// Achievement milestones
const ACHIEVEMENTS = [
  { tasks: 150,  label: 'First Bonus',      emoji: '🎉' },
  { tasks: 300,  label: '$250 Earner',       emoji: '💰' },
  { tasks: 500,  label: 'Half-K Club',       emoji: '⚡' },
  { tasks: 750,  label: '$700 Milestone',    emoji: '🔥' },
  { tasks: 1000, label: 'Four Digits',       emoji: '🚀' },
  { tasks: 1050, label: 'Max Bonus',         emoji: '👑' },
];

function getMonthDateRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: first.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
    monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function getBonusTier(taskCount: number) {
  const currentTier = [...BONUS_TIERS].reverse().find((t) => taskCount >= t.tasks) ?? null;
  const nextTier = BONUS_TIERS.find((t) => t.tasks > taskCount) ?? null;
  return { currentTier, nextTier };
}

function computePersonalProgress(taskCount: number) {
  const { currentTier, nextTier } = getBonusTier(taskCount);
  const isMaxed = taskCount >= BONUS_TIERS[BONUS_TIERS.length - 1].tasks;
  const preTier = taskCount < BONUS_TIERS[0].tasks;
  const progressStart = currentTier?.tasks ?? 0;
  const progressEnd = nextTier?.tasks ?? BONUS_TIERS[BONUS_TIERS.length - 1].tasks;
  const progressPct = isMaxed
    ? 100
    : preTier
    ? Math.round((taskCount / BONUS_TIERS[0].tasks) * 100)
    : Math.round(((taskCount - progressStart) / (progressEnd - progressStart)) * 100);
  return { currentTier, nextTier, isMaxed, preTier, progressStart, progressEnd, progressPct };
}

// ── Celebratory sound ───────────────────────────────────────────────────────
function playYaySound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {
    // silent fail
  }
}

function fireConfetti() {
  const colors = ['#FFD700', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#60a5fa'];
  const shared = { spread: 80, startVelocity: 45, ticks: 200, colors };
  confetti({ ...shared, particleCount: 90, origin: { x: 0.2, y: 0.55 } });
  confetti({ ...shared, particleCount: 90, origin: { x: 0.8, y: 0.55 } });
  setTimeout(() => {
    confetti({ particleCount: 50, spread: 100, origin: { x: 0.5, y: 0.4 }, colors, scalar: 1.2 });
  }, 400);
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MyTaskTracker() {
  const { data: profile, isLoading: profileLoading } = useBonusProfile();
  const { dateFrom, dateTo, monthLabel } = useMemo(getMonthDateRange, []);
  const isTaskDoneInRange = useIsTaskDoneInRange(dateFrom, dateTo);
  const hasCelebrated = useRef(false);

  const enabled = !!profile?.bonusEnabled;
  const { data: statsData, isLoading: statsLoading } = useTaskStats(
    enabled ? dateFrom : undefined,
    enabled ? dateTo : undefined,
  );

  const completedTasks = useMemo(() => {
    if (!profile?.notionManagerName || !statsData?.tasks) return [];
    const managerName = profile.notionManagerName;
    return statsData.tasks.filter(
      (t) =>
        isTaskDoneInRange(t) &&
        getManagers(t.properties).some((m) => m.name === managerName),
    );
  }, [statsData, profile?.notionManagerName, isTaskDoneInRange]);

  const taskCount = completedTasks.length;
  const { currentTier, nextTier } = useMemo(() => getBonusTier(taskCount), [taskCount]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const { data: myAchievements, isLoading: achievementsLoading } = useMyAchievements(
    profile?.bonusEnabled ? profile.notionManagerName : undefined,
  );
  const praiseThisMonth = myAchievements?.praiseCounts[currentMonthKey] ?? 0;
  const praiseBonusEarned = praiseThisMonth >= 10 ? 100 : 0;
  const totalReviews = myAchievements?.reviews.length ?? 0;
  const reviewBonusEarned = Math.floor(totalReviews / 5) * 100;
  const unlockedAchievements = useMemo(
    () => ACHIEVEMENTS.filter((a) => taskCount >= a.tasks),
    [taskCount],
  );

  // Celebration effect
  useEffect(() => {
    if (!statsLoading && currentTier && !hasCelebrated.current) {
      hasCelebrated.current = true;
      setTimeout(() => {
        fireConfetti();
        playYaySound();
      }, 700);
    }
  }, [statsLoading, currentTier]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ── No profile / disabled ──────────────────────────────────────────────────
  if (!profile?.bonusEnabled) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Bonus Tracker Not Available</h2>
          <p className="text-muted-foreground max-w-sm">
            Your account hasn't been linked to the bonus tracker yet. Ask an admin to set you up.
          </p>
        </div>
      </div>
    );
  }

  // Personal progress values (used only if profile?.bonusEnabled)
  const {
    currentTier: _ct, nextTier: _nt,
    isMaxed, progressStart, progressEnd, progressPct,
  } = computePersonalProgress(taskCount);
  const tasksToNext = nextTier ? nextTier.tasks - taskCount : 0;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Trophy className="h-8 w-8 text-yellow-500 shrink-0 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                {currentTier && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">My Bonus Tracker</h1>
                <p className="text-sm text-muted-foreground">{monthLabel}</p>
              </div>
            </div>

            {/* Bonus earned card */}
            <div className={`relative rounded-2xl border p-8 text-center overflow-hidden transition-all ${
              currentTier
                ? 'border-green-500/40 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-card shadow-lg shadow-green-500/10'
                : 'border-border bg-card shadow-sm'
            }`}>
              {currentTier && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-green-500/20 blur-3xl" />
                  <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl" />
                </div>
              )}
              {currentTier && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-400/50 to-transparent" />
              )}
              <div className="relative z-10">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Bonus Earned This Month
                </p>
                {currentTier ? (
                  <>
                    {isMaxed && <Crown className="mx-auto mb-2 h-6 w-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.7)]" />}
                    <p className="text-6xl font-black tabular-nums leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-emerald-600">
                      ${currentTier.bonus}
                    </p>
                    {isMaxed ? (
                      <p className="mt-3 text-sm font-semibold text-yellow-400">Maximum bonus reached — incredible work!</p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Keep going — next tier is <span className="font-semibold text-green-400">${nextTier?.bonus}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-black text-muted-foreground/30">$0</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Complete <span className="font-semibold text-foreground">{BONUS_TIERS[0].tasks} tasks</span> to earn your first{' '}
                      <span className="font-semibold text-green-500">${BONUS_TIERS[0].bonus}</span> bonus
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Task count + progress */}
            <div className="rounded-2xl border bg-card p-6 space-y-5 shadow-sm overflow-hidden relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tasks Completed</p>
                  <div className="flex items-end gap-2">
                    <p className="text-5xl font-black tabular-nums text-foreground leading-none">
                      {statsLoading ? <span className="text-muted-foreground/30">—</span> : taskCount}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">this month</p>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 shadow-inner">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>

              {!isMaxed && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progressStart} tasks</span>
                    <span className="font-medium text-foreground">{progressPct}%</span>
                    <span>{progressEnd} tasks</span>
                  </div>
                  <div className="relative h-3.5 bg-muted/60 rounded-full overflow-hidden shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${progressPct}%`,
                        background: progressPct >= 80
                          ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)'
                          : progressPct >= 40
                          ? 'linear-gradient(90deg, #f59e0b, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #7c3aed, #f59e0b)',
                        boxShadow: progressPct > 0 ? '0 0 12px rgba(16,185,129,0.5), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none',
                      }}
                    />
                    {progressPct > 0 && (
                      <div
                        className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[progress-shine_2.5s_ease-in-out_infinite]"
                        style={{ left: `calc(${progressPct}% - 2rem)` }}
                      />
                    )}
                  </div>
                  {nextTier && (
                    <p className="text-center text-sm font-semibold text-foreground pt-1">
                      <span className="text-muted-foreground font-normal">{tasksToNext} more {tasksToNext === 1 ? 'task' : 'tasks'} to unlock</span>{' '}
                      <span className="text-green-400">${nextTier.bonus}</span>
                    </p>
                  )}
                </div>
              )}

              {isMaxed && (
                <div className="flex items-center justify-center gap-2 text-sm text-yellow-400 font-semibold">
                  <Zap className="h-4 w-4" />
                  You've hit the maximum bonus tier. Incredible!
                  <Zap className="h-4 w-4" />
                </div>
              )}
            </div>

            {/* Achievement Bonuses */}
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-foreground">Achievement Bonuses</h3>
                {achievementsLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />}
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Slack Praise */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💬</span>
                      <span className="text-sm font-semibold text-foreground">Slack Praise</span>
                    </div>
                    <span className={`text-sm font-bold ${praiseBonusEarned > 0 ? 'text-green-500' : 'text-muted-foreground/40'}`}>
                      {praiseBonusEarned > 0 ? `+$${praiseBonusEarned}` : '$0'}
                    </span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${Math.min((praiseThisMonth / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {praiseThisMonth}/10 praises this month
                    {praiseThisMonth >= 10 && <span className="text-green-500 font-medium"> — Bonus unlocked!</span>}
                  </p>
                </div>

                {/* Review Hero */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm font-semibold text-foreground">Review Hero</span>
                    </div>
                    <span className={`text-sm font-bold ${reviewBonusEarned > 0 ? 'text-green-500' : 'text-muted-foreground/40'}`}>
                      {reviewBonusEarned > 0 ? `+$${reviewBonusEarned}` : '$0'}
                    </span>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all duration-500"
                      style={{ width: `${totalReviews === 0 ? 0 : ((totalReviews % 5) / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalReviews % 5}/5 reviews to next $100
                    {totalReviews > 0 && ` — ${totalReviews} total (earned $${reviewBonusEarned})`}
                  </p>
                </div>
              </div>
            </div>

            {/* Task Achievements */}
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500/40" />
                <h3 className="text-sm font-semibold text-foreground">Task Achievements</h3>
                {unlockedAchievements.length > 0 && (
                  <span className="ml-auto text-xs font-medium text-muted-foreground">
                    {unlockedAchievements.length}/{ACHIEVEMENTS.length} unlocked
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = taskCount >= a.tasks;
                  return (
                    <div
                      key={a.tasks}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                        unlocked
                          ? 'border-yellow-500/40 bg-yellow-500/5 shadow-sm'
                          : 'border-border opacity-40 grayscale'
                      }`}
                    >
                      <span className="text-2xl">{a.emoji}</span>
                      <p className="text-xs font-semibold text-foreground leading-tight">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground">{a.tasks} tasks</p>
                      {unlocked && (
                        <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Unlocked</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bonus roadmap */}
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-foreground">Bonus Roadmap</h3>
                <span className="ml-auto text-xs text-muted-foreground">Every 50 tasks = +$50</span>
              </div>
              <div className="divide-y divide-border">
                {BONUS_TIERS.map((tier) => {
                  const isUnlocked = taskCount >= tier.tasks;
                  const isCurrent = currentTier?.tasks === tier.tasks;
                  const isNext = nextTier?.tasks === tier.tasks;
                  return (
                    <div
                      key={tier.tasks}
                      className={`flex items-center justify-between px-5 py-3 text-sm transition-colors ${
                        isCurrent ? 'bg-green-500/10' : isNext ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isUnlocked ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[11px] font-bold">✓</span>
                        ) : isNext ? (
                          <span className="text-primary text-base leading-none">→</span>
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-muted-foreground/20 block" />
                        )}
                        <span className={isUnlocked ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                          {tier.tasks} tasks
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                            Current
                          </span>
                        )}
                        {isNext && !isCurrent && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                            Next
                          </span>
                        )}
                      </div>
                      <span className={`font-bold tabular-nums ${isUnlocked ? 'text-green-400' : 'text-muted-foreground/50'}`}>
                        ${tier.bonus}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

      </div>
    </div>
  );
}

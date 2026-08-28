import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminHeader from '@/components/AdminHeader';
import { useAuth } from '@/hooks/useAuth';
import { type BonusProfile } from '@/hooks/useBonusProfile';
import { useTaskStats } from '@/hooks/useNotionTasks';
import { useIsTaskDoneInRange } from '@/hooks/useTaskSettings';
import { getManagers, type NotionTask } from '@/hooks/useNotionTasks';
import { supabase } from '@/integrations/supabase/client';
import { useAllAchievements, useAddReview, useRemoveReview, useSlackScan } from '@/hooks/useAchievements';
import { Users, Loader2, Lock, Crown, Trophy, RefreshCw, PlusCircle, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.PROD
  ? 'https://api.teams.melleka.com/api'
  : '/api';

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
    monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function computeProgress(taskCount: number) {
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
  return { currentTier, nextTier, isMaxed, progressPct };
}

export default function TeamBonus() {
  const { isSuperAdmin } = useAuth();
  const { dateFrom, dateTo, monthLabel } = useMemo(getMonthDateRange, []);
  const isTaskDoneInRange = useIsTaskDoneInRange(dateFrom, dateTo);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Form state for adding reviews
  const [reviewEmployee, setReviewEmployee] = useState('');
  const [reviewPlatform, setReviewPlatform] = useState<'Yelp' | 'Google' | 'Other'>('Yelp');
  const [reviewNote, setReviewNote] = useState('');
  const [addFormOpen, setAddFormOpen] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useTaskStats(
    isSuperAdmin ? dateFrom : undefined,
    isSuperAdmin ? dateTo : undefined,
  );

  const { data: allProfiles = [], isLoading: profilesLoading } = useQuery<BonusProfile[]>({
    queryKey: ['all-bonus-profiles'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${API_BASE}/task-bonus/profiles`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch profiles');
      return resp.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: isSuperAdmin,
  });

  const { data: allAchievements, isLoading: achievementsLoading, refetch: refetchAchievements } = useAllAchievements();

  const addReview = useAddReview();
  const removeReview = useRemoveReview();
  const slackScan = useSlackScan();

  const enabledProfiles = useMemo(() => allProfiles.filter((p) => p.bonusEnabled), [allProfiles]);

  const teamData = useMemo(() => {
    if (!enabledProfiles.length) return [];
    return enabledProfiles
      .map((p) => {
        const count = statsData?.tasks
          ? statsData.tasks.filter(
              (t: NotionTask) =>
                isTaskDoneInRange(t) &&
                getManagers(t.properties).some((m) => m.name === p.notionManagerName),
            ).length
          : 0;
        const { currentTier, nextTier, isMaxed, progressPct } = computeProgress(count);
        const praiseCount = allAchievements?.slackPraise[currentMonthKey]?.[p.notionManagerName]?.length ?? 0;
        const reviewCount = allAchievements?.reviews.filter((r) => r.employeeName === p.notionManagerName).length ?? 0;
        return { profile: p, count, currentTier, nextTier, isMaxed, progressPct, praiseCount, reviewCount };
      })
      .sort((a, b) => b.count - a.count);
  }, [enabledProfiles, statsData, isTaskDoneInRange, allAchievements, currentMonthKey]);

  const totalBonusPool = useMemo(
    () => teamData.reduce((sum, d) => sum + (d.currentTier?.bonus ?? 0), 0),
    [teamData],
  );

  const allReviews = useMemo(() => {
    if (!allAchievements) return [];
    return [...allAchievements.reviews].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );
  }, [allAchievements]);

  async function handleAddReview() {
    if (!reviewEmployee) { toast.error('Select an employee'); return; }
    try {
      await addReview.mutateAsync({ employeeName: reviewEmployee, platform: reviewPlatform, note: reviewNote });
      toast.success('Review added');
      setReviewNote('');
      setAddFormOpen(false);
    } catch {
      toast.error('Failed to add review');
    }
  }

  async function handleRemoveReview(id: string) {
    try {
      await removeReview.mutateAsync(id);
      toast.success('Review removed');
    } catch {
      toast.error('Failed to remove review');
    }
  }

  async function handleSlackScan() {
    try {
      const result = await slackScan.mutateAsync();
      toast.success(result.message ?? 'Slack scan started — results will appear in ~30 seconds');
      setTimeout(() => refetchAchievements(), 10000);
    } catch {
      toast.error('Slack scan failed');
    }
  }

  // ── Not super admin ────────────────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">This page is only available to super admins.</p>
        </div>
      </div>
    );
  }

  const isLoading = profilesLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Team Bonus</h1>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          <button
            onClick={handleSlackScan}
            disabled={slackScan.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${slackScan.isPending ? 'animate-spin' : ''}`} />
            Scan Slack
          </button>
        </div>

        {/* Summary cards */}
        {!isLoading && teamData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Team Members</p>
              <p className="text-3xl font-black text-foreground">{teamData.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Tasks</p>
              <p className="text-3xl font-black text-foreground">{teamData.reduce((s, d) => s + d.count, 0)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Bonuses</p>
              <p className="text-3xl font-black text-green-500">${totalBonusPool}</p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
            <span className="ml-auto text-xs text-muted-foreground">Sorted by tasks completed</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No bonus profiles configured yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {teamData.map(({ profile, count, currentTier, nextTier, isMaxed, progressPct, praiseCount, reviewCount }, idx) => (
                <div key={profile.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Rank */}
                  <span className={`text-sm font-bold w-6 text-center shrink-0 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-600' : 'text-muted-foreground/40'}`}>
                    {idx + 1}
                  </span>

                  {/* Name + progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{profile.displayName}</p>
                      {isMaxed && <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                      {praiseCount > 0 && (
                        <span className="text-[11px] font-medium text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                          💬 {praiseCount}
                        </span>
                      )}
                      {reviewCount > 0 && (
                        <span className="text-[11px] font-medium text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">
                          ⭐ {reviewCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct >= 80
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : progressPct >= 40
                              ? 'linear-gradient(90deg, #f59e0b, #10b981)'
                              : 'linear-gradient(90deg, #7c3aed, #f59e0b)',
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{progressPct}%</span>
                    </div>
                    {nextTier && !isMaxed && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {nextTier.tasks - count} tasks to ${nextTier.bonus}
                      </p>
                    )}
                    {isMaxed && (
                      <p className="text-[11px] text-yellow-500 font-medium mt-0.5">Maximum bonus reached!</p>
                    )}
                  </div>

                  {/* Task count */}
                  <div className="text-center shrink-0 w-12">
                    <p className="text-lg font-black text-foreground tabular-nums">{count}</p>
                    <p className="text-[11px] text-muted-foreground">tasks</p>
                  </div>

                  {/* Bonus */}
                  <div className="text-right shrink-0 w-16">
                    {currentTier ? (
                      <>
                        <p className="text-base font-bold text-green-500 tabular-nums">${currentTier.bonus}</p>
                        <p className="text-[11px] text-muted-foreground">earned</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground/40">$0</p>
                        <p className="text-[11px] text-muted-foreground">earned</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Management */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500/40" />
            <h3 className="text-sm font-semibold text-foreground">Review Management</h3>
            <span className="ml-auto text-xs text-muted-foreground">{allReviews.length} total reviews</span>
            <button
              onClick={() => setAddFormOpen((o) => !o)}
              className="flex items-center gap-1.5 ml-2 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add Review
            </button>
          </div>

          {/* Add Review Form */}
          {addFormOpen && (
            <div className="p-4 border-b bg-muted/10 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add New Review</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={reviewEmployee}
                  onChange={(e) => setReviewEmployee(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select employee...</option>
                  {enabledProfiles.map((p) => (
                    <option key={p.id} value={p.notionManagerName}>{p.displayName}</option>
                  ))}
                </select>
                <select
                  value={reviewPlatform}
                  onChange={(e) => setReviewPlatform(e.target.value as 'Yelp' | 'Google' | 'Other')}
                  className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Yelp">Yelp</option>
                  <option value="Google">Google</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddReview}
                  disabled={addReview.isPending || !reviewEmployee}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {addReview.isPending ? 'Adding...' : 'Add Review'}
                </button>
                <button
                  onClick={() => setAddFormOpen(false)}
                  className="px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Review List */}
          {achievementsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : allReviews.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              No reviews yet. Add the first one above.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {allReviews.map((r) => {
                const emp = enabledProfiles.find((p) => p.notionManagerName === r.employeeName);
                const displayName = emp?.displayName ?? r.employeeName;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{displayName}</span>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                          r.platform === 'Yelp' ? 'bg-red-500/10 text-red-500' :
                          r.platform === 'Google' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {r.platform}
                        </span>
                      </div>
                      {r.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.note}</p>}
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {new Date(r.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveReview(r.id)}
                      disabled={removeReview.isPending}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

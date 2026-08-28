import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminHeader from '@/components/AdminHeader';
import SettingsTabs from '@/components/SettingsTabs';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Zap, Trash2, RefreshCw, Info, BookOpen } from 'lucide-react';

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

const TIERS = [
  {
    points: 1,
    label: "Quick",
    timeRange: "5–30 min",
    description: "Simple, fast tasks with minimal effort",
    examples: "Social posts, email replies, minor ad tweaks, status updates, quick edits",
  },
  {
    points: 2,
    label: "Short",
    timeRange: "30–60 min",
    description: "Moderate effort with a clear deliverable",
    examples: "Simple reports, basic graphics, small copy edits, ad optimization tweaks",
  },
  {
    points: 3,
    label: "Medium",
    timeRange: "1–1.5 hrs",
    description: "Focused work requiring skill and attention",
    examples: "Blog posts, email campaigns, full ad copy sets, SEO updates, analytics reports",
  },
  {
    points: 4,
    label: "Substantial",
    timeRange: "1.5–2 hrs",
    description: "Complex work requiring significant time investment",
    examples: "Landing pages, full campaign setup, video editing, comprehensive audits",
  },
  {
    points: 5,
    label: "Major",
    timeRange: "2+ hrs",
    description: "Large deliverables requiring deep, sustained work",
    examples: "Website builds, full redesigns, complex multi-platform campaigns, major deliverables",
  },
];

interface CacheStats {
  total: number;
  oldest: string | null;
  newest: string | null;
}

interface LearningsStats {
  total: number;
  corrections: number;
  newest: string | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

export default function TaskWeightsSettings() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const [learningsStats, setLearningsStats] = useState<LearningsStats | null>(null);
  const [learningsLoading, setLearningsLoading] = useState(true);
  const [clearingLearnings, setClearingLearnings] = useState(false);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/task-weights/cache-stats`, {
        headers: await authHeaders(),
      });
      if (resp.ok) setStats(await resp.json());
    } catch (err) {
      console.error('Failed to load cache stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadLearningsStats = async () => {
    setLearningsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/task-weights/learnings-stats`, {
        headers: await authHeaders(),
      });
      if (resp.ok) setLearningsStats(await resp.json());
    } catch (err) {
      console.error('Failed to load learnings stats:', err);
    } finally {
      setLearningsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadLearningsStats();
  }, []);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const resp = await fetch(`${API_BASE}/task-weights/cache`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        toast.success(`Cleared ${data.cleared} cached scores. Tasks will be re-scored on next load.`);
        await loadStats();
      } else {
        toast.error('Failed to clear cache');
      }
    } catch (err) {
      console.error('Clear cache error:', err);
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const handleClearLearnings = async () => {
    setClearingLearnings(true);
    try {
      const resp = await fetch(`${API_BASE}/task-weights/learnings`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        toast.success(`Cleared ${data.cleared} learnings. AI scoring will reset to defaults.`);
        await loadLearningsStats();
      } else {
        toast.error('Failed to clear learnings');
      }
    } catch (err) {
      console.error('Clear learnings error:', err);
      toast.error('Failed to clear learnings');
    } finally {
      setClearingLearnings(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <SettingsTabs />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Task Weight Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered effort scoring for completed tasks
            </p>
          </div>
        </div>

        {/* Tier Table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Point Tiers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Claude reads each task title and assigns points based on estimated effort
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-20">Points</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-28">Label</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-28">Time Range</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Example Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {TIERS.map((tier) => (
                  <tr key={tier.points} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/10 text-yellow-500 font-bold text-sm">
                          {tier.points}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{tier.label}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{tier.timeRange}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tier.description}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tier.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Learnings */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold">AI Learnings</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={loadLearningsStats} disabled={learningsLoading} className="h-7 px-2">
              <RefreshCw className={`h-3.5 w-3.5 ${learningsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {learningsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : learningsStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-500">{learningsStats.corrections.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">corrections learned</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-2xl font-bold">{learningsStats.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">total overrides</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium">{fmtDate(learningsStats.newest)}</p>
                <p className="text-xs text-muted-foreground">last correction</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load learnings</p>
          )}

          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={clearingLearnings || learningsStats?.total === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset AI Learnings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset AI Learnings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will erase all {learningsStats?.total.toLocaleString()} corrections the AI has learned from.
                    Future scoring will revert to the default rubric until new corrections are made.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearLearnings} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Reset Learnings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Cache Stats */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Score Cache</h2>
            <Button variant="ghost" size="sm" onClick={loadStats} disabled={statsLoading} className="h-7 px-2">
              <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {statsLoading ? (
            <p className="text-sm text-muted-foreground">Loading stats...</p>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">tasks scored</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium">{fmtDate(stats.newest)}</p>
                <p className="text-xs text-muted-foreground">most recently scored</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium">{fmtDate(stats.oldest)}</p>
                <p className="text-xs text-muted-foreground">oldest cached score</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load cache stats</p>
          )}

          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing || (stats?.total === 0)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Score Cache
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Score Cache?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {stats?.total.toLocaleString()} cached AI scores.
                    The next time anyone loads the Task Tracker, all tasks will be re-scored by AI.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearCache} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear Cache
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Info box */}
        <div className="flex gap-3 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-400">How AI Scoring and Learning Works</p>
            <p className="text-sm text-muted-foreground">
              When the Task Tracker loads, completed task titles are sent to Claude (Haiku) in batches.
              Claude assigns 1–5 points based on estimated effort. Scores are cached in server memory so
              subsequent loads are instant.
            </p>
            <p className="text-sm text-muted-foreground">
              Every time you click a score badge and correct it, the AI learns from that correction.
              Up to 25 corrections are injected as few-shot examples into every future scoring call,
              so the AI continuously improves to match how your team thinks about task effort.
            </p>
            <p className="text-sm text-muted-foreground">
              Learnings and cache persist until the next server deploy. Use "Reset AI Learnings" only if
              the AI starts scoring in a direction you do not want.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

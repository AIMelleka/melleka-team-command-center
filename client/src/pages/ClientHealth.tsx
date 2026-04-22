import React, { useState, useEffect, useCallback, useMemo, Fragment, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Globe, BarChart3, Target, Zap, AlertTriangle, CheckCircle, CheckCircle2, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Megaphone, Activity, DollarSign, Users, MousePointer, TableProperties, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, X, ArrowUpDown, Link, Settings, Plus, Trash2, GripVertical, Crown, Star, Layers, CalendarDays, Building2, ClipboardList, Brain, Play, Shield, History, Save, Link2, XCircle, Rocket, Clock, Timer } from 'lucide-react';
import { INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK, getIndustryBenchmark, type IndustryBenchmark } from '@/data/industryBenchmarks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AccountMappingModal from '@/components/AccountMappingModal';
import { ChangeCard } from '@/components/ppc/ChangeCard';
import { AnalysisSession } from '@/components/ppc/AnalysisSession';
import { SessionHistory } from '@/components/ppc/SessionHistory';
import { PerformanceDashboard } from '@/components/ppc/PerformanceDashboard';
import { AutoModeSettingsPanel } from '@/components/ppc/AutoModeSettings';
import { AutoModeAuditLog } from '@/components/ppc/AutoModeAuditLog';
import AiResultsTab from '@/components/AiResultsTab';
import { useClient } from '@/contexts/ClientContext';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import SupermetricsDebugPanel from '@/components/SupermetricsDebugPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, differenceInDays } from 'date-fns';
import { safeFormatDate } from '@/lib/dateUtils';
import AdminHeader from '@/components/AdminHeader';
import MiniSparkline from '@/components/MiniSparkline';
import {
  ComposedChart, Area, Line, CartesianGrid as RCartesianGrid, Legend as RLegend,
  ResponsiveContainer, XAxis as RXAxis, YAxis as RYAxis, Tooltip as RTooltip,
} from 'recharts';

interface ClientDirectoryEntry {
  name: string;
  domain?: string;
  siteAuditUrl?: string;
  ga4PropertyId?: string;
  lookerUrl?: string;
}

interface ScoreBreakdown {
  cpaBenchmark: number;      // 0-100: CPA vs industry benchmarks (simple avg, no spend weighting)
  conversionTrend: number;   // 0-100: Are conversions growing period-over-period?
  cpaTrend: number;          // 0-100: Is CPA improving (decreasing)?
  aiReviewQuality: number;   // 0-100: Severity-weighted AI review scoring
}

interface ClientHealthData {
  name: string;
  domain?: string;
  siteAuditUrl?: string;
  ga4PropertyId?: string;
  lookerUrl?: string;
  overallHealth: 'critical' | 'warning' | 'healthy' | 'unknown';
  healthScore: number;
  scoreBreakdown?: ScoreBreakdown;
  seoErrors?: number | null;
  siteHealthScore?: number | null;
  seoHealth?: 'critical' | 'warning' | 'healthy' | 'unknown';
  adHealth: 'critical' | 'warning' | 'healthy' | 'unknown';
  hasAdAccounts: boolean;
  matchedAccounts?: Record<string, string[]>;
}

interface SupermetricsAccount { id: string; name: string; }

interface PlatformSummary {
  label: string;
  accountName: string;
  platformKey: string;
  summary: Record<string, number>;
  previousPeriod?: Record<string, number>;
  campaigns?: { name: string; spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; cpa: number }[];
  keywords?: { keyword: string; campaignName: string; impressions: number; clicks: number; cost: number; conversions: number; ctr: number; cpc: number; cpa: number }[];
  dailyData?: { date: string; label: string; spend: number; clicks: number; impressions: number; conversions: number }[];
  errors?: string[];
}

interface SeoAnalysis {
  summary: string;
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  metrics: { domain: string; organicKeywords: number; organicTraffic: number; domainAuthority: number; backlinks: number; referringDomains: number; siteErrors?: number | null };
  insights: { type: string; title: string; description: string }[];
  recommendations: { priority: string; action: string; expectedImpact: string }[];
}

// ===== Status dot component =====
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-400',
    healthy: 'bg-emerald-500',
    unknown: 'bg-zinc-500',
  };
  return (
    <span className={`inline-block h-3 w-3 rounded-full ${colors[status] || colors.unknown}`} />
  );
}

// ===== Metric pill =====
function MetricPill({ label, value, variant }: { label: string; value: string; variant?: 'danger' | 'warn' | 'good' | 'neutral' }) {
  const styles: Record<string, string> = {
    danger: 'bg-red-500/15 text-red-400 border-red-500/20',
    warn: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    good: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[variant || 'neutral']}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

// ===== Trend arrow component =====
function TrendArrow({ current, previous, invert, format: fmtFn }: { current: number; previous?: number; invert?: boolean; format?: (n: number) => string }) {
  const display = fmtFn ? fmtFn(current) : current.toLocaleString();
  if (!previous || previous === 0) return <span className="text-xs text-muted-foreground">{current > 0 ? display : '—'}</span>;
  const pct = ((current - previous) / previous) * 100;
  const isPositive = invert ? pct < 0 : pct > 0;
  const isNegative = invert ? pct > 0 : pct < 0;
  const ArrowIcon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <span>{display}</span>
      {ArrowIcon && (
        <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
          <ArrowIcon className="h-3 w-3" />
          <span className="text-[10px]">{Math.abs(pct).toFixed(0)}%</span>
        </span>
      )}
    </span>
  );
}

// ===== Cron Jobs Status Panel =====
function CronJobsPanel() {
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Friendly name mapping
  const friendlyNames: Record<string, { label: string; description: string; icon: string }> = {
    'auto-fetch-ppc-morning': { label: 'PPC Data Fetch (AM)', description: 'Fetches live ad spend & conversion data', icon: '📊' },
    'auto-fetch-ppc-afternoon': { label: 'PPC Data Fetch (PM)', description: 'Afternoon snapshot of ad metrics', icon: '📊' },
    'daily-bulk-ad-review': { label: 'Daily Ad Reviews', description: 'AI-powered ad review for all clients', icon: '🔍' },
    'daily-health-refresh': { label: 'Health Score Refresh', description: 'Updates client health scores & site audits', icon: '💚' },
  };

  // Group auto-cron-* jobs
  const isStrategistCron = (name: string) => name.startsWith('auto-cron-');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_cron_status');
        if (!error && data) {
          const jobs = Array.isArray(data) ? data : (typeof data === 'string' ? JSON.parse(data) : []);
          setCronJobs(jobs);
        }
      } catch (e) { console.error('Failed to load cron status:', e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  // Separate strategist crons from other jobs
  const strategistJobs = cronJobs.filter(j => isStrategistCron(j.jobname));
  const otherJobs = cronJobs.filter(j => !isStrategistCron(j.jobname));

  // Get latest strategist run
  const latestStrategistRun = strategistJobs
    .filter(j => j.last_run_at)
    .sort((a, b) => new Date(b.last_run_at).getTime() - new Date(a.last_run_at).getTime())[0];

  const formatSchedule = (schedule: string) => {
    // Parse common cron patterns
    const parts = schedule.split(' ');
    if (parts.length !== 5) return schedule;
    const [min, hour] = parts;
    const hourNum = parseInt(hour);
    // Convert UTC to PST (UTC-8)
    const pstHour = ((hourNum - 8) + 24) % 24;
    const ampm = pstHour >= 12 ? 'PM' : 'AM';
    const h12 = pstHour === 0 ? 12 : pstHour > 12 ? pstHour - 12 : pstHour;
    return `${h12}:${min.padStart(2, '0')} ${ampm} PST`;
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getStatusColor = (status: string | null, lastRun: string | null) => {
    if (!lastRun) return 'bg-zinc-500';
    if (status === 'succeeded') return 'bg-emerald-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-amber-400';
  };

  const renderJobCard = (job: { jobname: string; schedule: string; active: boolean; last_status: string | null; last_run_at: string | null; last_end_at: string | null }, label: string, description: string, icon: string, scheduleLabel?: string) => (
    <Card key={job.jobname} className="bg-card/60 backdrop-blur-sm border-border/50">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{label}</span>
              <span className={`h-2 w-2 rounded-full shrink-0 ${getStatusColor(job.last_status, job.last_run_at)}`} />
              {!job.active && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-500">Paused</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{scheduleLabel || formatSchedule(job.schedule)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Timer className="h-3 w-3 text-muted-foreground" />
            <span className={job.last_status === 'succeeded' ? 'text-emerald-500' : job.last_status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}>
              {job.last_run_at ? formatTimeAgo(job.last_run_at) : 'Never run'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Active Automation Jobs</h2>
        <Badge variant="outline" className="text-[10px] gap-1">
          <Zap className="h-3 w-3" /> {cronJobs.filter(j => j.active).length} active
        </Badge>
      </div>

      <div className="space-y-2">
        {/* AI Strategist (grouped) */}
        {strategistJobs.length > 0 && renderJobCard(
          {
            jobname: 'ai-strategist',
            schedule: '0 */2 * * *',
            active: strategistJobs.every(j => j.active),
            last_status: latestStrategistRun?.last_status || null,
            last_run_at: latestStrategistRun?.last_run_at || null,
            last_end_at: latestStrategistRun?.last_end_at || null,
          },
          `AI Strategist (${strategistJobs.length} slots)`,
          'PPC optimization analysis every 2 hours across the fleet',
          '🤖',
          'Every 2 hours',
        )}

        {/* Other named jobs */}
        {otherJobs.map(job => {
          const info = friendlyNames[job.jobname] || {
            label: job.jobname,
            description: 'Scheduled automation task',
            icon: '⚙️',
          };
          return renderJobCard(job, info.label, info.description, info.icon);
        })}
      </div>

      {/* Summary footer */}
      <div className="border-t border-border/50 pt-3 mt-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-foreground">{strategistJobs.length + otherJobs.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Jobs</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-500">
              {cronJobs.filter(j => j.last_status === 'succeeded').length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Succeeded</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-500">
              {cronJobs.filter(j => j.last_status === 'failed').length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Fleet Run History Component =====
function FleetRunHistory() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('fleet_run_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setRuns(data);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (runs.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No fleet runs recorded yet.</div>
  );

  return (
    <div className="space-y-3">
      {runs.map(run => {
        const results = (run.results as any[]) || [];
        const successCount = results.filter((r: any) => r.status === 'success').length;
        const partialCount = results.filter((r: any) => r.status === 'partial').length;
        const errorCount = results.filter((r: any) => r.status === 'error').length;
        const skippedCount = results.filter((r: any) => r.status === 'skipped').length;
        const isExpanded = expandedRun === run.id;
        const duration = run.completed_at && run.created_at
          ? Math.round((new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000)
          : null;

        return (
          <Card key={run.id} className="bg-card/60 backdrop-blur-sm border-border/50">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
              onClick={() => setExpandedRun(isExpanded ? null : run.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${run.status === 'complete' || run.status === 'completed' ? 'bg-emerald-500' : run.status === 'processing' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {safeFormatDate(run.created_at, 'MMM d, yyyy · h:mm a')}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{run.total_clients} clients</span>
                    {duration !== null && <span>· {duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m ${duration % 60}s`}</span>}
                    {run.status === 'processing' && <span className="text-amber-500">· In progress ({run.progress}/{run.total_clients})</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {successCount > 0 && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 gap-0.5"><CheckCircle2 className="h-3 w-3" />{successCount}</Badge>}
                {partialCount > 0 && <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-500 gap-0.5"><AlertTriangle className="h-3 w-3" />{partialCount}</Badge>}
                {errorCount > 0 && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-500 gap-0.5"><XCircle className="h-3 w-3" />{errorCount}</Badge>}
                {skippedCount > 0 && <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground gap-0.5">⏭️ {skippedCount}</Badge>}
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && results.length > 0 && (
              <div className="border-t border-border/50 px-4 py-2 space-y-1 max-h-80 overflow-y-auto">
                {results.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1">
                    <span className={r.status === 'success' ? 'text-emerald-500' : r.status === 'partial' ? 'text-orange-500' : r.status === 'error' ? 'text-red-500' : 'text-muted-foreground'}>
                      {r.status === 'success' ? '✅' : r.status === 'partial' ? '⚠️' : r.status === 'error' ? '❌' : '⏭️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{r.client}</span>
                      {r.message && <span className="text-muted-foreground ml-1">— {r.message}</span>}
                      {(r.strategistDone !== undefined || r.adReviewDone !== undefined) && (
                        <div className="flex items-center gap-3 mt-0.5 text-[11px]">
                          <span className={r.strategistDone ? 'text-emerald-500' : 'text-red-400'}>
                            {r.strategistDone ? '✓' : '✗'} Strategist
                            {r.strategistAttempts > 1 && ` (${r.strategistAttempts} tries)`}
                          </span>
                          <span className={r.adReviewDone ? 'text-emerald-500' : 'text-red-400'}>
                            {r.adReviewDone ? '✓' : '✗'} Ad Review
                            {r.adReviewAttempts > 1 && ` (${r.adReviewAttempts} tries)`}
                          </span>
                        </div>
                      )}
                      {r.strategistErrors?.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {r.strategistErrors.map((err: string, j: number) => (
                            <div key={j} className="text-amber-500 text-[11px] truncate" title={err}>⚠ Strategist: {err}</div>
                          ))}
                        </div>
                      )}
                      {r.errors?.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {r.errors.slice(0, 4).map((err: string, j: number) => (
                            <div key={j} className="text-red-400/80 text-[11px] truncate" title={err}>⚠ {err}</div>
                          ))}
                          {r.errors.length > 4 && <div className="text-muted-foreground text-[11px]">+{r.errors.length - 4} more errors</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}


// ===== Latest Fleet Report Card =====
function LatestFleetReportCard() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('fleet_run_jobs')
        .select('id, report_summary, completed_at, total_clients, status')
        .not('report_summary', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.report_summary) setReport(data);
      setLoading(false);
    })();
  }, []);

  if (loading || !report) return null;

  const s = report.report_summary;
  const completedAgo = report.completed_at ? (() => {
    const diffH = Math.round((Date.now() - new Date(report.completed_at).getTime()) / 3600000);
    return diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.round(diffH / 24)}d ago`;
  })() : '';

  return (
    <Card className="mx-4 mb-3 bg-gradient-to-r from-card to-card/80 border-primary/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Latest Fleet Report</span>
            {completedAgo && <span className="text-xs text-muted-foreground">{completedAgo}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Clients</span>
            <span className="font-semibold text-sm">{s.success}/{s.totalClients} OK</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Changes Made</span>
            <span className="font-semibold text-sm">{s.autoExecuted} auto / {s.totalChanges} total</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Pending Review</span>
            <span className="font-semibold text-sm">{s.pendingReview}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">New Learnings</span>
            <span className="font-semibold text-sm text-primary">{s.newLearnings}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Errors</span>
            <span className={`font-semibold text-sm ${s.errors > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{s.errors}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ClientHealth = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    selectedClient: contextSelectedClient,
    setSelectedClient: setContextSelectedClient,
    googleAccountId,
    googleAccountName,
    metaAccountId,
    metaAccountName,
    googleAccounts,
    metaAccounts,
    accountsLoading: contextAccountsLoading,
    saveAccounts,
    savingAccounts,
  } = useClient();

  const [clients, setClients] = useState<ClientHealthData[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [previousScores, setPreviousScores] = useState<Map<string, number>>(new Map());
  const [scoreHistory, setScoreHistory] = useState<Map<string, number[]>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ppc' | 'seo'>('ppc');
  const [fleetView, setFleetView] = useState<'clients' | 'audit' | 'history' | 'crons'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'health' | 'name' | 'seo'>('health');


  const [smAccounts, setSmAccounts] = useState<Record<string, SupermetricsAccount[]>>({});
  const [smAccountsLoaded, setSmAccountsLoaded] = useState(false);
  const [isLoadingSmAccounts, setIsLoadingSmAccounts] = useState(false);
  const [manualMappings, setManualMappings] = useState<Record<string, Record<string, string[]>>>({});
  const [mappingClient, setMappingClient] = useState<string | null>(null);

  const [selectedClient, setSelectedClient] = useState<ClientHealthData | null>(null);
  const [seoAnalysis, setSeoAnalysis] = useState<SeoAnalysis | null>(null);
  const [isAnalyzingSeo, setIsAnalyzingSeo] = useState(false);
  const [liveAdData, setLiveAdData] = useState<Record<string, PlatformSummary> | null>(null);
  const [isLoadingAdData, setIsLoadingAdData] = useState(false);

  // Managed clients (local DB, independent of Sheet)
  const [managedClients, setManagedClients] = useState<{ id: string; client_name: string; domain?: string; site_audit_url?: string; ga4_property_id?: string; is_active: boolean; tier?: string; primary_conversion_goal?: string }[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showSmDebug, setShowSmDebug] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDomain, setNewClientDomain] = useState('');
  const [newClientTier, setNewClientTier] = useState<'premium' | 'advanced' | 'basic'>('basic');

  // Tier assignments: client_name -> tier
  const [clientTiers, setClientTiers] = useState<Record<string, 'premium' | 'advanced' | 'basic'>>({});
  // Industry assignments: client_name -> industry name
  const [clientIndustries, setClientIndustries] = useState<Record<string, string>>({});
  const [clientConversionGoals, setClientConversionGoals] = useState<Record<string, string>>({});
  const [clientTrackedTypes, setClientTrackedTypes] = useState<Record<string, string[]>>({});
  const [clientMultiAccount, setClientMultiAccount] = useState<Record<string, boolean>>({});
  const [expandedMultiAcct, setExpandedMultiAcct] = useState<Set<string>>(new Set());
  const [collapsedTiers, setCollapsedTiers] = useState<Record<string, boolean>>({});
  const [clientColWidth, setClientColWidth] = useState(160);
  const clientColResizing = useRef(false);
  const [draggedClient, setDraggedClient] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);
  const [kwSortCol, setKwSortCol] = useState<'clicks' | 'impressions' | 'ctr' | 'cpc' | 'cost' | 'conversions' | 'cpa'>('clicks');
  const [kwSortAsc, setKwSortAsc] = useState(false);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [keywordsSectionOpen, setKeywordsSectionOpen] = useState(true);
  const [campaignSortCol, setCampaignSortCol] = useState<'spend' | 'conversions' | 'cpa' | 'ctr'>('spend');
  const [campaignSortAsc, setCampaignSortAsc] = useState(false);

  // Last Auto Run tracking
  const [lastAutoRuns, setLastAutoRuns] = useState<Record<string, { date: string; status: string; platform: string }>>({});
  // Fleet-wide auto mode enabled status
  const [autoModeEnabledClients, setAutoModeEnabledClients] = useState<Set<string>>(new Set());

  // Last Ad Review per client (fleet view)
  const [lastAdReviewByClient, setLastAdReviewByClient] = useState<Record<string, { review_date: string; summary?: string; hasIssues?: boolean }>>({});
  // Last Auto (autopilot) Ad Review per client
  const [lastAutoReviewByClient, setLastAutoReviewByClient] = useState<Record<string, { review_date: string; created_at: string }>>({}); 
  const [runningAdReviewClient, setRunningAdReviewClient] = useState<string | null>(null);

  // AI memory counts per client
  const [memoryCountByClient, setMemoryCountByClient] = useState<Record<string, number>>({});


  // Per-platform trend data cache
  interface PlatformTrend { spend: number; conv: number; calls: number; costPerConv: number; leads: number; purchases: number; }
  const [clientTrends, setClientTrends] = useState<Record<string, Record<string, PlatformTrend>>>({});
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // Historical PPC snapshots for trend markers
  interface SnapshotTrend { current: PlatformTrend; previous: PlatformTrend | null; }
  const [snapshotTrends, setSnapshotTrends] = useState<Record<string, Record<string, SnapshotTrend>>>({});
  const [lastSnapshotTime, setLastSnapshotTime] = useState<string | null>(null);

  // SEO metrics cache
  interface SeoMetrics { organicKeywords: number; organicTraffic: number; domainAuthority: number; backlinks: number; }
  const [clientSeoData, setClientSeoData] = useState<Record<string, SeoMetrics>>({});
  const [isLoadingSeo, setIsLoadingSeo] = useState(false);
  const [seoFetchProgress, setSeoFetchProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [seoCacheTimestamp, setSeoCacheTimestamp] = useState<string | null>(null);
  const [auditConfidence, setAuditConfidence] = useState<Record<string, 'high' | 'medium' | 'low'>>({});

  // Fleet coverage from last completed run
  const [fleetCoverage, setFleetCoverage] = useState<{ success: number; partial: number; error: number; total: number; completedAt: string | null; runStatus: string } | null>(null);

  // ===== DETAIL VIEW STATE (unified command center) =====
  const [detailClient, setDetailClient] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  // Local account IDs tied to detailClient (avoids race condition with ClientContext)
  const [detailGoogleAccountId, setDetailGoogleAccountId] = useState('');
  const [detailMetaAccountId, setDetailMetaAccountId] = useState('');

  // Strategist state
  const [stratPlatform, setStratPlatform] = useState('google');
  const [stratDatePreset, setStratDatePreset] = useState(30);
  const [stratAnalyzing, setStratAnalyzing] = useState(false);
  const [stratExecuting, setStratExecuting] = useState(false);
  const [stratAssessing, setStratAssessing] = useState(false);
  const [stratSessions, setStratSessions] = useState<any[]>([]);
  const [stratActiveSession, setStratActiveSession] = useState<any>(null);
  const [stratChanges, setStratChanges] = useState<any[]>([]);
  const [stratAllChanges, setStratAllChanges] = useState<any[]>([]);
  const [stratResults, setStratResults] = useState<any[]>([]);
  const [stratClientSettings, setStratClientSettings] = useState<any>({
    auto_mode_enabled: false, auto_mode_platform: 'both', auto_mode_schedule: 'weekly',
    confidence_threshold: 'high', max_changes_per_run: 5,
  });

  // Ad Review detail state
  const [detailAdReview, setDetailAdReview] = useState<any>(null);
  const [detailAdReviewHistory, setDetailAdReviewHistory] = useState<any[]>([]);
  const [isRunningClientAdReview, setIsRunningClientAdReview] = useState(false);
  // Fleet-wide ad review data (includes insights for fleet scoring)
  const [fleetAdReviews, setFleetAdReviews] = useState<Record<string, any>>({});
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  // (Draft account IDs removed — account linking now uses AccountMappingModal exclusively)

  // Learning Insights
  interface LearningInsight { type: 'success' | 'failure' | 'trend'; label: string; detail: string; count?: number; }
  const [learningInsights, setLearningInsights] = useState<LearningInsight[]>([]);

  const [dateRangeDays, setDateRangeDays] = useState(30);
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [datePickerField, setDatePickerField] = useState<'from' | 'to'>('from');

  const dateEnd = useMemo(() => {
    if (customDateTo) return format(customDateTo, 'yyyy-MM-dd');
    return format(new Date(), 'yyyy-MM-dd');
  }, [customDateTo, dateRangeDays]);
  const dateStart = useMemo(() => {
    if (customDateFrom) return format(customDateFrom, 'yyyy-MM-dd');
    return format(subDays(new Date(), dateRangeDays), 'yyyy-MM-dd');
  }, [customDateFrom, dateRangeDays]);
  const prevDateEnd = useMemo(() => {
    const rangeDays = customDateFrom && customDateTo ? differenceInDays(customDateTo, customDateFrom) : dateRangeDays;
    const endDate = customDateTo || new Date();
    return format(subDays(endDate, rangeDays + 1), 'yyyy-MM-dd');
  }, [customDateFrom, customDateTo, dateRangeDays]);
  const prevDateStart = useMemo(() => {
    const rangeDays = customDateFrom && customDateTo ? differenceInDays(customDateTo, customDateFrom) : dateRangeDays;
    const endDate = customDateTo || new Date();
    return format(subDays(endDate, rangeDays * 2 + 1), 'yyyy-MM-dd');
  }, [customDateFrom, customDateTo, dateRangeDays]);

  const dateLabel = useMemo(() => {
    if (customDateFrom && customDateTo) return `${format(customDateFrom, 'MMM d')} – ${format(customDateTo, 'MMM d, yyyy')}`;
    return `Last ${dateRangeDays} days`;
  }, [customDateFrom, customDateTo, dateRangeDays]);

  const applyPresetDays = useCallback((days: number) => {
    setDateRangeDays(days);
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
    setShowCustomDate(false);
    setLiveAdData(null);
  }, []);

  const applyCustomRange = useCallback(() => {
    if (customDateFrom && customDateTo) {
      setDateRangeDays(differenceInDays(customDateTo, customDateFrom));
      setShowCustomDate(false);
      setLiveAdData(null);
    }
  }, [customDateFrom, customDateTo]);

  // ===== Supermetrics =====
  const loadSmAccounts = useCallback(async () => {
    setIsLoadingSmAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', { body: { action: 'list-accounts' } });
      if (error) throw error;
      if (data?.success && data?.accounts) { setSmAccounts(data.accounts); setSmAccountsLoaded(true); }
    } catch (err) { console.error('Failed to load Supermetrics accounts:', err); }
    finally { setIsLoadingSmAccounts(false); }
  }, []);

  // Load manual mappings from DB
  const loadManualMappings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('client_account_mappings').select('*');
      if (error) throw error;
      const map: Record<string, Record<string, string[]>> = {};
      for (const row of data || []) {
        if (!map[row.client_name]) map[row.client_name] = {};
        if (!map[row.client_name][row.platform]) map[row.client_name][row.platform] = [];
        map[row.client_name][row.platform].push(row.account_id);
      }
      setManualMappings(map);
    } catch (err) { console.error('Failed to load manual mappings:', err); }
  }, []);

  // Load managed clients from DB
  const loadManagedClients = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('managed_clients').select('*').eq('is_active', true);
      if (error) throw error;
      setManagedClients(data || []);
    } catch (err) { console.error('Failed to load managed clients:', err); }
  }, []);

  // Build tier map from managed_clients
  const loadClientTiers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('managed_clients').select('client_name, tier, industry, primary_conversion_goal, tracked_conversion_types, multi_account_enabled');
      if (error) throw error;
      const tierMap: Record<string, 'premium' | 'advanced' | 'basic'> = {};
      const industryMap: Record<string, string> = {};
      const goalMap: Record<string, string> = {};
      const trackedMap: Record<string, string[]> = {};
      const multiAcctMap: Record<string, boolean> = {};
      for (const row of data || []) {
        tierMap[row.client_name] = (row.tier as 'premium' | 'advanced' | 'basic') || 'basic';
        if ((row as any).industry) industryMap[row.client_name] = (row as any).industry;
        if ((row as any).primary_conversion_goal) goalMap[row.client_name] = (row as any).primary_conversion_goal;
        trackedMap[row.client_name] = (row as any).tracked_conversion_types || ['leads', 'purchases', 'calls'];
        multiAcctMap[row.client_name] = !!(row as any).multi_account_enabled;
      }
      setClientTiers(tierMap);
      setClientIndustries(industryMap);
      setClientConversionGoals(goalMap);
      setClientTrackedTypes(trackedMap);
      setClientMultiAccount(multiAcctMap);
    } catch (err) { console.error('Failed to load tiers:', err); }
  }, []);

  const updateClientTier = useCallback(async (clientName: string, tier: 'premium' | 'advanced' | 'basic') => {
    setClientTiers(prev => ({ ...prev, [clientName]: tier }));
    try {
      // Upsert into managed_clients
      const { data: existing } = await supabase.from('managed_clients').select('id').eq('client_name', clientName).single();
      if (existing) {
        await supabase.from('managed_clients').update({ tier } as any).eq('id', existing.id);
      } else {
        await supabase.from('managed_clients').insert({
          client_name: clientName,
          tier,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }
    } catch (err) { console.error('Failed to update tier:', err); }
  }, []);

  const updateClientIndustry = useCallback(async (clientName: string, industry: string) => {
    setClientIndustries(prev => ({ ...prev, [clientName]: industry }));
    try {
      const { data: existing } = await supabase.from('managed_clients').select('id').eq('client_name', clientName).maybeSingle();
      if (existing) {
        await supabase.from('managed_clients').update({ industry } as any).eq('id', existing.id);
      } else {
        await supabase.from('managed_clients').insert({
          client_name: clientName,
          industry,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        } as any);
      }
    } catch (err) { console.error('Failed to update industry:', err); }
  }, []);

  // Conversion goal helpers
  const GOAL_CONFIG: Record<string, { label: string; costLabel: string }> = {
    all: { label: 'Conversions', costLabel: 'CPA' },
    leads: { label: 'Leads', costLabel: 'CPL' },
    purchases: { label: 'Purchases', costLabel: 'Cost/Purchase' },
    calls: { label: 'Calls', costLabel: 'Cost/Call' },
    forms: { label: 'Forms', costLabel: 'Cost/Form' },
    bookings: { label: 'Bookings', costLabel: 'Cost/Booking' },
    signups: { label: 'Sign-ups', costLabel: 'Cost/Sign-up' },
    revenue: { label: 'Revenue', costLabel: 'ROAS' },
    downloads: { label: 'Downloads', costLabel: 'Cost/Download' },
  };

  const CONVERSION_TYPE_CONFIG = [
    { key: 'leads', label: 'Leads', icon: '📋', description: 'Form fills, contact requests, demo requests' },
    { key: 'purchases', label: 'Purchases', icon: '🛒', description: 'E-commerce transactions, sales' },
    { key: 'calls', label: 'Calls', icon: '📞', description: 'Phone calls, click-to-call' },
    { key: 'forms', label: 'Forms', icon: '📝', description: 'Quote requests, applications, signups' },
    { key: 'bookings', label: 'Bookings', icon: '📅', description: 'Appointments, consultations, reservations' },
    { key: 'signups', label: 'Sign-ups', icon: '👤', description: 'Account creation, free trials, subscriptions' },
    { key: 'revenue', label: 'Revenue', icon: '💰', description: 'ROAS-focused, revenue value tracking' },
    { key: 'downloads', label: 'Downloads', icon: '📥', description: 'App installs, PDF downloads, resources' },
  ];

  /** Get the tracked conversion count for scoring — sums only the types that matter for this client */
  const getTrackedConversions = useCallback((clientName: string, trend: PlatformTrend): { count: number; costPer: number } => {
    const tracked = clientTrackedTypes[clientName] || ['leads', 'purchases', 'calls'];
    let count = 0;
    if (tracked.includes('leads')) count += trend.leads || 0;
    if (tracked.includes('purchases')) count += trend.purchases || 0;
    if (tracked.includes('calls')) count += trend.calls || 0;
    // If nothing tracked or no tracked conversions, fall back to total conversions
    if (count === 0) count = trend.conv;
    const costPer = count > 0 ? trend.spend / count : 0;
    return { count, costPer };
  }, [clientTrackedTypes]);

  const getGoalMetric = useCallback((clientName: string, trend: PlatformTrend): { count: number; costPer: number } => {
    const goal = clientConversionGoals[clientName] || 'all';
    if (goal === 'leads' && trend.leads > 0) return { count: trend.leads, costPer: trend.leads > 0 ? trend.spend / trend.leads : 0 };
    if (goal === 'purchases' && trend.purchases > 0) return { count: trend.purchases, costPer: trend.purchases > 0 ? trend.spend / trend.purchases : 0 };
    if (goal === 'calls' && trend.calls > 0) return { count: trend.calls, costPer: trend.calls > 0 ? trend.spend / trend.calls : 0 };
    return { count: trend.conv, costPer: trend.costPerConv };
  }, [clientConversionGoals]);

  const getGoalLabel = useCallback((clientName: string) => {
    const goal = clientConversionGoals[clientName] || 'all';
    return GOAL_CONFIG[goal] || GOAL_CONFIG.all;
  }, [clientConversionGoals]);

  const updateTrackedTypes = useCallback(async (clientName: string, types: string[]) => {
    setClientTrackedTypes(prev => ({ ...prev, [clientName]: types }));
    try {
      const { data: existing } = await supabase.from('managed_clients').select('id').eq('client_name', clientName).maybeSingle();
      if (existing) {
        await supabase.from('managed_clients').update({ tracked_conversion_types: types } as any).eq('id', existing.id);
      } else {
        await supabase.from('managed_clients').insert({
          client_name: clientName,
          tracked_conversion_types: types,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        } as any);
      }
    } catch (err) { console.error('Failed to update tracked types:', err); }
  }, []);

  const updateConversionGoal = useCallback(async (clientName: string, goal: string) => {
    setClientConversionGoals(prev => ({ ...prev, [clientName]: goal }));
    try {
      const { data: existing } = await supabase.from('managed_clients').select('id').eq('client_name', clientName).maybeSingle();
      if (existing) {
        await supabase.from('managed_clients').update({ primary_conversion_goal: goal } as any).eq('id', existing.id);
      } else {
        await supabase.from('managed_clients').insert({
          client_name: clientName,
          primary_conversion_goal: goal,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        } as any);
      }
    } catch (err) { console.error('Failed to update conversion goal:', err); }
  }, []);
  const getClientBenchmark = useCallback((clientName: string): IndustryBenchmark => {
    const industry = clientIndustries[clientName];
    if (industry) return getIndustryBenchmark(industry);
    return DEFAULT_BENCHMARK;
  }, [clientIndustries]);



  const addClient = useCallback(async () => {
    if (!newClientName.trim()) return;
    try {
      const { error } = await supabase.from('managed_clients').insert({
        client_name: newClientName.trim(),
        domain: newClientDomain.trim() || null,
        tier: newClientTier,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast({ title: `Added "${newClientName.trim()}" to ${newClientTier}` });
      setNewClientName('');
      setNewClientDomain('');
      setNewClientTier('basic');
      setShowAddClient(false);
      await Promise.all([loadManagedClients(), loadClientTiers()]);
    } catch (err: any) {
      toast({ title: err?.message?.includes('unique') ? 'Client already exists' : 'Failed to add client', variant: 'destructive' });
    }
  }, [newClientName, newClientDomain, newClientTier, toast, loadManagedClients, loadClientTiers]);

  const removeClient = useCallback(async (clientName: string) => {
    // Soft-delete: set is_active = false. Also works if the client is Sheet-only (just removes from managed_clients if present)
    try {
      // Try to deactivate in managed_clients
      const { data } = await supabase.from('managed_clients').select('id').eq('client_name', clientName).single();
      if (data) {
        await supabase.from('managed_clients').update({ is_active: false } as any).eq('id', data.id);
      } else {
        // Sheet-only client: insert as inactive to "hide" it
        await supabase.from('managed_clients').insert({ client_name: clientName, is_active: false, created_by: (await supabase.auth.getUser()).data.user?.id });
      }
      toast({ title: `Removed "${clientName}"` });
      await loadManagedClients();
    } catch (err) {
      toast({ title: 'Failed to remove client', variant: 'destructive' });
    }
  }, [toast, loadManagedClients]);

  const getMatchedAccounts = useCallback((clientName: string): Record<string, string[]> => {
    // Only use explicit manual mappings from the database
    if (manualMappings[clientName] && Object.keys(manualMappings[clientName]).length > 0) {
      return manualMappings[clientName];
    }
    return {};
  }, [manualMappings]);

  const fetchLiveAdData = useCallback(async (clientName: string, matchedAccounts: Record<string, string[]>) => {
    const activeSources = Object.keys(matchedAccounts).filter(k => matchedAccounts[k]?.length > 0);
    if (activeSources.length === 0) return;
    setIsLoadingAdData(true);
    setLiveAdData(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', {
        body: { action: 'fetch-data', dataSources: activeSources, accounts: matchedAccounts, dateStart, dateEnd, compareStart: prevDateStart, compareEnd: prevDateEnd },
      });
      if (error) throw error;
      if (data?.success && data?.platforms) setLiveAdData(data.platforms);
    } catch (err) {
      console.error('Error fetching live ad data:', err);
      toast({ title: 'Failed to pull live ad data', variant: 'destructive' });
    } finally { setIsLoadingAdData(false); }
  }, [dateStart, dateEnd, prevDateStart, prevDateEnd, toast]);

  // ===== Build health =====
  const buildClientsWithAdHealth = useCallback((
    clientEntries: Map<string, ClientDirectoryEntry>,
    siteErrors: Map<string, number>,
    siteHealthScores?: Map<string, number>,
  ): ClientHealthData[] => {
    const healthData: ClientHealthData[] = [];
    clientEntries.forEach((entry, key) => {
      const seoErrors = siteErrors.get(key) ?? null;
      let seoHealth: ClientHealthData['seoHealth'] = 'unknown';
      if (seoErrors !== null) {
        if (seoErrors > 200) seoHealth = 'critical';
        else if (seoErrors > 50) seoHealth = 'warning';
        else seoHealth = 'healthy';
      } else if (!entry.siteAuditUrl) seoHealth = 'unknown';

      const matched = getMatchedAccounts(entry.name);
      const hasAdAccounts = Object.keys(matched).length > 0;
      const adHealth: ClientHealthData['adHealth'] = hasAdAccounts ? 'healthy' : 'unknown';

      // All 5 signals start unknown — will be recalculated when async data loads
      const breakdown: ScoreBreakdown = {
        cpaBenchmark: -1,      // -1 means no data yet
        conversionTrend: -1,
        cpaTrend: -1,
        aiReviewQuality: -1,
      };

      // At initial build, no signals have data yet — score is unknown
      const score = -1; // Will be recalculated in the useEffect

      let overallHealth: ClientHealthData['overallHealth'] = 'unknown';

      healthData.push({ name: entry.name, domain: entry.domain, siteAuditUrl: entry.siteAuditUrl, ga4PropertyId: entry.ga4PropertyId, lookerUrl: entry.lookerUrl, overallHealth, healthScore: score, scoreBreakdown: breakdown, seoErrors, siteHealthScore: siteHealthScores?.get(key) ?? null, seoHealth, adHealth, hasAdAccounts, matchedAccounts: matched });
    });
    return healthData;
  }, [getMatchedAccounts]);

  const [directoryEntries, setDirectoryEntries] = useState<Map<string, ClientDirectoryEntry>>(new Map());
  const [siteErrorMap, setSiteErrorMap] = useState<Map<string, number>>(new Map());
  const [siteHealthMap, setSiteHealthMap] = useState<Map<string, number>>(new Map());

  const loadClients = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      // Load all active clients from managed_clients (single source of truth)
      const { data: mcData, error: mcError } = await supabase
        .from('managed_clients')
        .select('*')
        .eq('is_active', true);
      if (mcError) throw mcError;

      const clientsMap = new Map<string, ClientDirectoryEntry>();
      for (const mc of mcData || []) {
        clientsMap.set(mc.client_name.toLowerCase(), {
          name: mc.client_name,
          domain: mc.domain || undefined,
          siteAuditUrl: mc.site_audit_url || undefined,
          ga4PropertyId: mc.ga4_property_id || undefined,
          lookerUrl: (mc as any).looker_url || undefined,
        });
      }

      const { data: siteAuditCache } = await supabase.from('site_audit_cache').select('client_name, site_errors, site_health_score, last_scraped_at');
      const errorMap = new Map<string, number>();
      const healthScoreMap = new Map<string, number>();
      for (const row of siteAuditCache || []) {
        errorMap.set(row.client_name.toLowerCase().trim(), row.site_errors || 0);
        if (row.site_health_score != null) healthScoreMap.set(row.client_name.toLowerCase().trim(), Number(row.site_health_score));
      }

      // Load previous health scores for trend arrows
      const { data: historyRows } = await supabase
        .from('client_health_history')
        .select('client_name, health_score, recorded_date')
        .gte('recorded_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
        .order('recorded_date', { ascending: true });
      if (historyRows && historyRows.length > 0) {
        const prevMap = new Map<string, number>();
        const histMap = new Map<string, number[]>();
        for (const row of historyRows) {
          const key = row.client_name.toLowerCase().trim();
          const arr = histMap.get(key) || [];
          arr.push(row.health_score);
          histMap.set(key, arr);
          prevMap.set(key, row.health_score);
        }
        setPreviousScores(prevMap);
        setScoreHistory(histMap);
      }

      setDirectoryEntries(clientsMap);
      setSiteErrorMap(errorMap);
      setSiteHealthMap(healthScoreMap);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({ title: 'Error loading clients', variant: 'destructive' });
    } finally { setIsLoadingClients(false); }
  }, [toast]);

  useEffect(() => {
    if (directoryEntries.size > 0) {
      // directoryEntries is already loaded from managed_clients (active only)
      const healthData = buildClientsWithAdHealth(directoryEntries, siteErrorMap, siteHealthMap);
      // Preserve existing scores when rebuilding client list
      setClients(prev => {
        const prevMap = new Map(prev.map(c => [c.name, c]));
        return healthData.map(c => {
          const existing = prevMap.get(c.name);
          if (existing && existing.healthScore >= 0) {
            return { ...c, healthScore: existing.healthScore, scoreBreakdown: existing.scoreBreakdown, overallHealth: existing.overallHealth };
          }
          return c;
        });
      });
    }
  }, [directoryEntries, siteErrorMap, siteHealthMap, buildClientsWithAdHealth]);

  // ===== Recalculate composite scores when async data loads =====
  // 4-Signal Model: CPA vs Benchmark (35%), Conversion Trend (25%), CPA Trend (25%), AI Review Quality (15%)
  useEffect(() => {
    if (clients.length === 0) return;
    setClients(prev => prev.map(client => {
      const snapTrend = snapshotTrends[client.name];

      // Signal 1: CPA vs Benchmark (35%) — Simple average across platforms (NOT spend-weighted)
      let cpaBenchmark = -1;
      if (snapTrend && Object.keys(snapTrend).length > 0) {
        const benchmark = getClientBenchmark(client.name);
        const platformBenchmarks: Record<string, number> = {
          google: benchmark.google.cpa,
          meta: benchmark.facebook.cpa,
          bing: benchmark.google.cpa * 1.1,
          linkedin: benchmark.google.cpa * 2.0,
          tiktok: benchmark.facebook.cpa * 0.9,
        };

        const ratios: number[] = [];
        for (const [platform, snap] of Object.entries(snapTrend)) {
          if (snap.current.spend <= 0) continue; // Skip platforms with no spend
          // Use tracked conversion types for scoring instead of generic conv
          const trackedMetric = getTrackedConversions(client.name, snap.current);
          if (trackedMetric.count <= 0) {
            ratios.push(0); // Spend but no tracked conversions = genuinely bad
            continue;
          }
          const actualCpa = trackedMetric.costPer;
          const benchCpa = platformBenchmarks[platform] || ((benchmark.google.cpa + benchmark.facebook.cpa) / 2);
          const ratio = actualCpa / benchCpa;
          // Map ratio: 0.5 = 100, 1.0 = 70, 1.5 = 40, 2.0+ = 0
          let score: number;
          if (ratio <= 0.5) score = 100;
          else if (ratio <= 1.0) score = 100 - ((ratio - 0.5) / 0.5) * 30; // 100 → 70
          else if (ratio <= 1.5) score = 70 - ((ratio - 1.0) / 0.5) * 30;  // 70 → 40
          else if (ratio <= 2.0) score = 40 - ((ratio - 1.5) / 0.5) * 40;  // 40 → 0
          else score = 0;
          ratios.push(Math.round(score));
        }
        if (ratios.length > 0) {
          cpaBenchmark = Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length);
        }
      }

      // Signal 2: Conversion Trend (25%) — Period-over-period conversion change
      let conversionTrend = -1;
      if (snapTrend && Object.keys(snapTrend).length > 0) {
        const pctChanges: number[] = [];
        for (const snap of Object.values(snapTrend)) {
          if (!snap.previous || snap.current.spend <= 0) continue;
          // Use tracked conversions for trend
          const currentTracked = getTrackedConversions(client.name, snap.current);
          const previousTracked = getTrackedConversions(client.name, snap.previous);
          if (previousTracked.count <= 0 && currentTracked.count <= 0) continue;
          if (previousTracked.count <= 0) {
            pctChanges.push(currentTracked.count > 0 ? 100 : 0);
            continue;
          }
          const pct = ((currentTracked.count - previousTracked.count) / previousTracked.count) * 100;
          pctChanges.push(pct);
        }
        if (pctChanges.length > 0) {
          const avgPct = pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length;
          // Map: +20% or better = 100, flat (0%) = 60, -20% or worse = 0
          if (avgPct >= 20) conversionTrend = 100;
          else if (avgPct >= 0) conversionTrend = Math.round(60 + (avgPct / 20) * 40); // 60 → 100
          else if (avgPct >= -20) conversionTrend = Math.round(60 + (avgPct / 20) * 60); // 60 → 0
          else conversionTrend = 0;
        }
      }

      // Signal 3: CPA Trend (20%) — Period-over-period CPA change (decrease is good)
      let cpaTrend = -1;
      if (snapTrend && Object.keys(snapTrend).length > 0) {
        const pctChanges: number[] = [];
        for (const snap of Object.values(snapTrend)) {
          if (!snap.previous) continue;
          // Use tracked conversions for CPA trend
          const currentTracked = getTrackedConversions(client.name, snap.current);
          const previousTracked = getTrackedConversions(client.name, snap.previous);
          if (currentTracked.count <= 0 || previousTracked.count <= 0) continue;
          const pct = ((currentTracked.costPer - previousTracked.costPer) / previousTracked.costPer) * 100;
          pctChanges.push(pct);
        }
        if (pctChanges.length > 0) {
          const avgPct = pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length;
          // Inverted: -20% improvement = 100, flat = 60, +20% worse = 0
          if (avgPct <= -20) cpaTrend = 100;
          else if (avgPct <= 0) cpaTrend = Math.round(60 + (Math.abs(avgPct) / 20) * 40); // 60 → 100
          else if (avgPct <= 20) cpaTrend = Math.round(60 - (avgPct / 20) * 60); // 60 → 0
          else cpaTrend = 0;
        }
      }

      // Signal 4: AI Review Quality (15%) — severity-based scoring
      let aiReviewQuality = -1;
      const latestReviewData = fleetAdReviews[client.name];
      if (latestReviewData?.insights && Array.isArray(latestReviewData.insights) && latestReviewData.insights.length > 0) {
        const insights = latestReviewData.insights as any[];
        let severityPoints = 0;
        let totalInsights = insights.length;
        for (const insight of insights) {
          const impact = (insight.impact || 'medium').toLowerCase();
          const type = (insight.type || '').toLowerCase();
          if (type === 'positive' || type === 'opportunity') severityPoints += 100;
          else if (impact === 'high') severityPoints += 0;
          else if (impact === 'medium') severityPoints += 50;
          else severityPoints += 80;
        }
        const actionItems = Array.isArray(latestReviewData.action_items) ? latestReviewData.action_items : [];
        const urgentActions = actionItems.filter((a: any) => (a.priority || '').toLowerCase() === 'high').length;
        const actionPenalty = Math.min(urgentActions * 5, 30);
        aiReviewQuality = totalInsights > 0
          ? Math.max(0, Math.round(severityPoints / totalInsights) - actionPenalty)
          : -1;
      }

      const breakdown: ScoreBreakdown = { cpaBenchmark, conversionTrend, cpaTrend, aiReviewQuality };

      // Dynamic re-weighting: Conversion-heavy scoring
      // CPA vs Benchmark 40%, Conv Trend 30%, CPA Trend 20%, AI Review 10%
      const signals: { key: keyof ScoreBreakdown; weight: number }[] = [
        { key: 'cpaBenchmark', weight: 0.40 },
        { key: 'conversionTrend', weight: 0.30 },
        { key: 'cpaTrend', weight: 0.20 },
        { key: 'aiReviewQuality', weight: 0.10 },
      ];

      const activeSignals = signals.filter(s => breakdown[s.key] >= 0);
      const totalWeight = activeSignals.reduce((sum, s) => sum + s.weight, 0);
      const score = totalWeight > 0
        ? Math.round(activeSignals.reduce((sum, s) => sum + breakdown[s.key] * (s.weight / totalWeight), 0))
        : -1;

      let overallHealth: ClientHealthData['overallHealth'] = 'unknown';
      if (score >= 0) {
        if (score < 50) overallHealth = 'critical';
        else if (score < 80) overallHealth = 'warning';
        else overallHealth = 'healthy';
      }

      return { ...client, healthScore: score, scoreBreakdown: breakdown, overallHealth };
    }));
  }, [snapshotTrends, fleetAdReviews, lastAdReviewByClient, getClientBenchmark, isLoadingClients]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist composite scores to history for future trend comparisons
  useEffect(() => {
    if (clients.length === 0) return;
    const hasRealData = Object.keys(clientTrends).length > 0 || Object.keys(snapshotTrends).length > 0;
    if (!hasRealData) return; // Only persist after real data has loaded

    const today = format(new Date(), 'yyyy-MM-dd');
    const rows = clients.filter(c => c.healthScore >= 0).map(c => ({
      client_name: c.name,
      health_score: c.healthScore,
      recorded_date: today,
      config_completeness: 0,
      seo_errors: c.seoErrors ?? null,
      seo_health: c.seoHealth ?? null,
      ad_health: c.adHealth ?? null,
      score_breakdown: c.scoreBreakdown ? {
        cpaBenchmark: c.scoreBreakdown.cpaBenchmark,
        conversionTrend: c.scoreBreakdown.conversionTrend,
        cpaTrend: c.scoreBreakdown.cpaTrend,
        aiReviewQuality: c.scoreBreakdown.aiReviewQuality,
      } : {},
    }));

    // Upsert today's scores (one record per client per day)
    supabase.from('client_health_history').upsert(rows, { onConflict: 'client_name,recorded_date' }).then(({ error }) => {
      if (error) console.warn('[HealthHistory] Failed to persist scores:', error.message);
    });
  }, [clients, snapshotTrends, fleetAdReviews]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load last auto-run data per client
  const loadLastAutoRuns = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('ppc_optimization_sessions')
        .select('client_name, created_at, status, platform')
        .eq('auto_mode', true)
        .order('created_at', { ascending: false });
      if (data) {
        const map: Record<string, { date: string; status: string; platform: string }> = {};
        for (const row of data) {
          if (!map[row.client_name]) {
            map[row.client_name] = { date: row.created_at, status: row.status, platform: row.platform };
          }
        }
        setLastAutoRuns(map);
      }
    } catch (err) { console.error('Failed to load auto runs:', err); }
  }, []);

  // Load which clients have auto mode enabled (fleet-wide)
  const loadAutoModeStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('ppc_client_settings')
        .select('client_name, auto_mode_enabled')
        .eq('auto_mode_enabled', true);
      if (data) {
        setAutoModeEnabledClients(new Set(data.map(r => r.client_name)));
      }
    } catch (err) { console.error('Failed to load auto mode status:', err); }
  }, []);

  // (fleetAdReviews state declared above, near line 270)

  // Load last ad review date per client (with insights for fleet-wide scoring)
  const loadLastAdReviews = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('ad_review_history')
        .select('client_name, review_date, summary, recommendations, action_items, insights, created_by, created_at')
        .order('review_date', { ascending: false })
        .limit(500);
      if (data) {
        const map: Record<string, { review_date: string; summary?: string; hasIssues?: boolean }> = {};
        const autoMap: Record<string, { review_date: string; created_at: string }> = {};
        const fleetMap: Record<string, any> = {};
        for (const row of data) {
          if (!map[row.client_name]) {
            const actions = Array.isArray(row.action_items) ? row.action_items : [];
            const hasIssues = actions.length > 0;
            map[row.client_name] = { review_date: row.review_date, summary: row.summary || undefined, hasIssues };
          }
          // Store latest review with full insights for fleet scoring (Fix 1)
          if (!fleetMap[row.client_name]) {
            fleetMap[row.client_name] = row;
          }
          // Track last autopilot review (created_by is null for edge function/service role)
          if (!autoMap[row.client_name] && !row.created_by) {
            autoMap[row.client_name] = { review_date: row.review_date, created_at: row.created_at };
          }
        }
        setLastAdReviewByClient(map);
        setLastAutoReviewByClient(autoMap);
        setFleetAdReviews(fleetMap);
      }
    } catch (err) { console.error('Failed to load ad reviews:', err); }
  }, []);

  // Load AI memory counts per client
  const loadMemoryCounts = useCallback(async () => {
    try {
      const { data } = await supabase.from('client_ai_memory').select('client_name');
      if (data) {
        const counts: Record<string, number> = {};
        for (const row of data) {
          counts[row.client_name] = (counts[row.client_name] || 0) + 1;
        }
        setMemoryCountByClient(counts);
      }
    } catch (err) { console.error('Failed to load memory counts:', err); }
  }, []);


  useEffect(() => { loadClients(); loadSmAccounts(); loadManualMappings(); loadManagedClients(); loadClientTiers(); loadLastAutoRuns(); loadLastAdReviews(); loadAutoModeStatus(); loadMemoryCounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load fleet coverage from most recent run (any status)
  const loadFleetCoverage = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('fleet_run_jobs')
        .select('results, completed_at, total_clients, status, progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      if (data.status === 'processing') {
        setFleetCoverage({ success: 0, partial: 0, error: 0, total: data.total_clients || 0, completedAt: null, runStatus: 'processing' });
      } else if (data.results && Array.isArray(data.results)) {
        const results = data.results as any[];
        const success = results.filter((r: any) => r.status === 'success').length;
        const partial = results.filter((r: any) => r.status === 'partial').length;
        const error = results.filter((r: any) => r.status === 'error').length;
        setFleetCoverage({ success, partial, error, total: data.total_clients || results.length, completedAt: data.completed_at, runStatus: data.status });
      } else {
        setFleetCoverage({ success: 0, partial: 0, error: 0, total: data.total_clients || 0, completedAt: data.completed_at, runStatus: data.status });
      }
    } catch {}
  }, []);

  useEffect(() => { loadFleetCoverage(); }, [loadFleetCoverage]);

  // ===== Bulk trend fetch — ONE call for ALL clients =====
  const loadAllTrends = useCallback(async (clientList: ClientHealthData[]) => {
    const clientsWithAds = clientList.filter(c => c.matchedAccounts && Object.keys(c.matchedAccounts).length > 0);
    if (clientsWithAds.length === 0) return;
    setIsLoadingTrends(true);

    // Build the bulk request: { clientName: { platform: accountIds[] } }
    const bulkClients: Record<string, Record<string, string[]>> = {};
    for (const client of clientsWithAds) {
      const activeSources: Record<string, string[]> = {};
      for (const [key, ids] of Object.entries(client.matchedAccounts!)) {
        if (ids && ids.length > 0) activeSources[key] = ids;
      }
      if (Object.keys(activeSources).length > 0) {
        bulkClients[client.name] = activeSources;
      }
    }

    if (Object.keys(bulkClients).length === 0) { setIsLoadingTrends(false); return; }

    console.log(`[BULK] Fetching trends for ${Object.keys(bulkClients).length} clients in one call...`);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', {
        body: { action: 'fetch-data-bulk', bulkClients, dateStart, dateEnd },
      });

      if (error || !data?.success) {
        console.error('[BULK] Bulk fetch failed:', error || data);
        // Fallback: retry failed clients individually
        setIsLoadingTrends(false);
        return;
      }

      const allTrends: Record<string, Record<string, PlatformTrend>> = {};

      for (const [clientName, platforms] of Object.entries(data.clients || {} as Record<string, Record<string, { spend: number; conv: number; calls: number; costPerConv: number; leads: number; purchases: number; forms?: number; error?: string }>>)) {
        const result: Record<string, PlatformTrend> = {};
        for (const [dsKey, metrics] of Object.entries(platforms as Record<string, { spend: number; conv: number; calls: number; costPerConv: number; leads: number; purchases: number; forms?: number; error?: string }>)) {
          // Skip platforms with errors and no data
          if (metrics.spend === 0 && metrics.conv === 0 && metrics.error) continue;

          // Normalize platform key
          const k = dsKey.toLowerCase();
          let canonical = 'other';
          if (k.includes('google') || k.includes('aw') || k.includes('adwords')) canonical = 'google';
          else if (k.includes('meta') || k.includes('fa') || k.includes('facebook') || k.includes('ig')) canonical = 'meta';
          else if (k.includes('tiktok') || k.includes('tik')) canonical = 'tiktok';
          else if (k.includes('bing') || k.includes('ac') || k.includes('microsoft')) canonical = 'bing';
          else if (k.includes('linkedin') || k.includes('lia')) canonical = 'linkedin';

          if (result[canonical]) {
            result[canonical].spend += metrics.spend;
            result[canonical].conv += metrics.conv;
            result[canonical].calls += metrics.calls;
            result[canonical].leads += (metrics.leads || 0);
            result[canonical].purchases += (metrics.purchases || 0);
            
            result[canonical].costPerConv = result[canonical].conv > 0 ? result[canonical].spend / result[canonical].conv : 0;
          } else {
            result[canonical] = { spend: metrics.spend, conv: metrics.conv, calls: metrics.calls, leads: metrics.leads || 0, purchases: metrics.purchases || 0, costPerConv: metrics.costPerConv };
          }

          // Fallback: If non-Meta platform has conversions but all breakdown is in leads (no breakdown data from API),
          // redistribute based on client's tracked_conversion_types config
          if (canonical !== 'meta' && result[canonical].conv > 0 && result[canonical].purchases === 0 && result[canonical].calls === 0 && result[canonical].leads === result[canonical].conv) {
            const tracked = clientTrackedTypes[clientName] || ['leads', 'purchases', 'calls'];
            // If client tracks only ONE type, reclassify all conversions as that type
            if (tracked.length === 1) {
              const totalConv = result[canonical].conv;
              if (tracked[0] === 'purchases') {
                result[canonical].purchases = totalConv;
                result[canonical].leads = 0;
              } else if (tracked[0] === 'calls') {
                result[canonical].calls = totalConv;
                result[canonical].leads = 0;
              }
            }
          }
        }
        if (Object.keys(result).length > 0) {
          allTrends[clientName] = result;
        }
      }

      // Set ALL trends at once (not incrementally)
      setClientTrends(allTrends);
      console.log(`[BULK] ✅ Loaded trends for ${Object.keys(allTrends).length} clients`);
    } catch (err) {
      console.error('[BULK] Unexpected error:', err);
    }

    setIsLoadingTrends(false);
  }, [dateStart, dateEnd]);

  // Load cached trends from localStorage on mount
  const TRENDS_CACHE_KEY = 'ppc_trends_cache';
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(TRENDS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.trends && Object.keys(parsed.trends).length > 0) {
          setClientTrends(parsed.trends);
          if (parsed.savedAt) setCacheTimestamp(parsed.savedAt);
          console.log(`[CACHE] Loaded ${Object.keys(parsed.trends).length} cached client trends (from ${parsed.dateStart} to ${parsed.dateEnd})`);
        }
      }
    } catch (e) { console.warn('[CACHE] Failed to load cached trends:', e); }
  }, []);

  // Save trends to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(clientTrends).length > 0) {
      try {
        const now = new Date().toISOString();
        localStorage.setItem(TRENDS_CACHE_KEY, JSON.stringify({ trends: clientTrends, dateStart, dateEnd, savedAt: now }));
        setCacheTimestamp(now);
      } catch (e) { console.warn('[CACHE] Failed to save trends:', e); }
    }
  }, [clientTrends, dateStart, dateEnd]);

  // Load historical PPC snapshots from DB — 14-day rolling window
  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const fourteenDaysAgo = format(subDays(new Date(), 14), 'yyyy-MM-dd');
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const { data: rawSnaps } = await supabase
          .from('ppc_daily_snapshots')
          .select('*')
          .gte('snapshot_date', fourteenDaysAgo)
          .order('snapshot_date', { ascending: false });

        if (!rawSnaps || rawSnaps.length === 0) return;

        // Build dynamic name alias map from managed_clients to normalize snapshot names
        // This handles cases where ad platform names differ from managed_clients names
        const nameAliasMap: Record<string, string> = {};
        if (directoryEntries.size > 0) {
          const canonicalNames = new Set<string>();
          directoryEntries.forEach((_, key) => {
            const entry = directoryEntries.get(key);
            if (entry) canonicalNames.add(entry.name);
          });
          // For each snapshot name not in canonical set, try to find a match
          const snapshotNames = new Set(rawSnaps.map(s => s.client_name));
          for (const sn of snapshotNames) {
            if (canonicalNames.has(sn)) continue; // Already matches
            // Try partial matching: canonical name contains snapshot name or vice versa
            for (const cn of canonicalNames) {
              const snLower = sn.toLowerCase();
              const cnLower = cn.toLowerCase();
              if (cnLower.includes(snLower) || snLower.includes(cnLower)) {
                nameAliasMap[sn] = cn;
                break;
              }
            }
          }
        }

        // Normalize snapshot client names to match managed_clients
        const allSnaps = rawSnaps.map(s => ({
          ...s,
          client_name: nameAliasMap[s.client_name] || s.client_name,
        }));

        // Exclude today's partial data from trend calculations
        const completedSnaps = allSnaps.filter(s => s.snapshot_date !== todayStr);
        const todaySnaps = allSnaps.filter(s => s.snapshot_date === todayStr);

        // Use completed days for trends, but include today for "current" display
        const distinctCompletedDates = [...new Set(completedSnaps.map(s => s.snapshot_date))].sort();

        // Aggregate helper
        const aggregate = (snaps: any[]): PlatformTrend => {
          let spend = 0, conv = 0, calls = 0, leads = 0, purchases = 0;
          for (const s of snaps) {
            spend += Number(s.spend);
            conv += Number(s.conversions);
            calls += s.calls || 0;
            leads += s.leads || 0;
            purchases += s.purchases || 0;
          }
          return { spend, conv, calls, leads, purchases, costPerConv: conv > 0 ? spend / conv : 0 };
        };

        const trends: Record<string, Record<string, SnapshotTrend>> = {};

        if (distinctCompletedDates.length >= 8) {
          // 7-day rolling window: recent 7 vs prior 7 (using completed days only)
          const cutoffMs = Date.now() - 7 * 86400000;
          const grouped: Record<string, Record<string, { recent: any[]; prior: any[] }>> = {};
          for (const snap of completedSnaps) {
            if (!grouped[snap.client_name]) grouped[snap.client_name] = {};
            if (!grouped[snap.client_name][snap.platform]) grouped[snap.client_name][snap.platform] = { recent: [], prior: [] };
            const snapMs = new Date(snap.snapshot_date).getTime();
            if (snapMs > cutoffMs) {
              grouped[snap.client_name][snap.platform].recent.push(snap);
            } else {
              grouped[snap.client_name][snap.platform].prior.push(snap);
            }
          }
          for (const [clientName, platforms] of Object.entries(grouped)) {
            trends[clientName] = {};
            for (const [platform, windows] of Object.entries(platforms)) {
              // Include today's partial data in current for display purposes
              const todayPlatSnaps = todaySnaps.filter(s => s.client_name === clientName && s.platform === platform);
              const currentSnaps = [...windows.recent, ...todayPlatSnaps];
              trends[clientName][platform] = {
                current: aggregate(currentSnaps),
                previous: windows.prior.length > 0 ? aggregate(windows.prior) : null,
              };
            }
          }
        } else if (distinctCompletedDates.length >= 4) {
          // Split-half: divide completed dates into two halves for comparison
          const midIdx = Math.floor(distinctCompletedDates.length / 2);
          const recentDates = new Set(distinctCompletedDates.slice(midIdx));
          const priorDates = new Set(distinctCompletedDates.slice(0, midIdx));
          const grouped: Record<string, Record<string, { recent: any[]; prior: any[] }>> = {};
          for (const snap of completedSnaps) {
            if (!grouped[snap.client_name]) grouped[snap.client_name] = {};
            if (!grouped[snap.client_name][snap.platform]) grouped[snap.client_name][snap.platform] = { recent: [], prior: [] };
            if (recentDates.has(snap.snapshot_date)) {
              grouped[snap.client_name][snap.platform].recent.push(snap);
            } else if (priorDates.has(snap.snapshot_date)) {
              grouped[snap.client_name][snap.platform].prior.push(snap);
            }
          }
          for (const [clientName, platforms] of Object.entries(grouped)) {
            trends[clientName] = {};
            for (const [platform, windows] of Object.entries(platforms)) {
              const todayPlatSnaps = todaySnaps.filter(s => s.client_name === clientName && s.platform === platform);
              const currentSnaps = [...windows.recent, ...todayPlatSnaps];
              trends[clientName][platform] = {
                current: aggregate(currentSnaps),
                previous: windows.prior.length > 0 ? aggregate(windows.prior) : null,
              };
            }
          }
        } else if (distinctCompletedDates.length >= 2) {
          // 2-3 completed days: compare latest completed day vs prior completed day
          const latestDate = distinctCompletedDates[distinctCompletedDates.length - 1];
          const priorDate = distinctCompletedDates[distinctCompletedDates.length - 2];
          const grouped: Record<string, Record<string, { recent: any[]; prior: any[] }>> = {};
          for (const snap of completedSnaps) {
            if (!grouped[snap.client_name]) grouped[snap.client_name] = {};
            if (!grouped[snap.client_name][snap.platform]) grouped[snap.client_name][snap.platform] = { recent: [], prior: [] };
            if (snap.snapshot_date === latestDate) {
              grouped[snap.client_name][snap.platform].recent.push(snap);
            } else if (snap.snapshot_date === priorDate) {
              grouped[snap.client_name][snap.platform].prior.push(snap);
            }
          }
          for (const [clientName, platforms] of Object.entries(grouped)) {
            trends[clientName] = {};
            for (const [platform, windows] of Object.entries(platforms)) {
              const todayPlatSnaps = todaySnaps.filter(s => s.client_name === clientName && s.platform === platform);
              const currentSnaps = [...windows.recent, ...todayPlatSnaps];
              trends[clientName][platform] = {
                current: aggregate(currentSnaps),
                previous: windows.prior.length > 0 ? aggregate(windows.prior) : null,
              };
            }
          }
        } else {
          // Only 1 completed date (or none) — current only from all data, no comparison
          const grouped: Record<string, Record<string, any[]>> = {};
          for (const snap of allSnaps) {
            if (!grouped[snap.client_name]) grouped[snap.client_name] = {};
            if (!grouped[snap.client_name][snap.platform]) grouped[snap.client_name][snap.platform] = [];
            grouped[snap.client_name][snap.platform].push(snap);
          }
          for (const [clientName, platforms] of Object.entries(grouped)) {
            trends[clientName] = {};
            for (const [platform, snaps] of Object.entries(platforms)) {
              trends[clientName][platform] = { current: aggregate(snaps), previous: null };
            }
          }
        }
        setSnapshotTrends(trends);

        // Get the latest snapshot timestamp
        const { data: latest } = await supabase
          .from('ppc_daily_snapshots')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
        if (latest && latest.length > 0) setLastSnapshotTime(latest[0].created_at);
      } catch (e) { console.warn('[SNAPSHOTS] Failed to load:', e); }
    };
    loadSnapshots();
  }, [directoryEntries]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleFetchData = useCallback(() => {
    if (clients.length > 0 && smAccountsLoaded) {
      setClientTrends({});
      loadAllTrends(clients);
    } else {
      toast({ title: 'Still loading client list or accounts...', variant: 'destructive' });
    }
  }, [clients, smAccountsLoaded, loadAllTrends, toast]);

  // ===== Bulk Ad Review Runner =====
  const [isRunningAdReviews, setIsRunningAdReviews] = useState(false);
  const [adReviewProgress, setAdReviewProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const runAdReviewForAllClients = useCallback(async () => {
    // Trigger the bulk-ad-review cloud function so it runs in the background
    setIsRunningAdReviews(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-ad-review', {
        body: {},
      });

      if (error) {
        toast({ title: 'Failed to start bulk ad reviews', description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: '🚀 Ad Reviews Running in Cloud',
          description: 'All clients are being processed in the background. You can close this page — reviews will complete automatically.',
        });
      }
    } catch (err: any) {
      toast({ title: 'Failed to trigger ad reviews', description: err.message, variant: 'destructive' });
    } finally {
      setIsRunningAdReviews(false);
      setAdReviewProgress(null);
      // Reload after a short delay to show any early completions
      setTimeout(() => loadLastAdReviews(), 5000);
    }
  }, [toast, loadLastAdReviews]);

  // ===== Full Fleet Run (strategist + ad review + AI memory for ALL clients) =====
  const [fleetJobId, setFleetJobId] = useState<string | null>(null);
  const [fleetProgress, setFleetProgress] = useState<{ progress: number; total: number; currentClient: string | null; status: string } | null>(null);
  const [fleetResults, setFleetResults] = useState<any[] | null>(null);
  const fleetPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runFullFleet = useCallback(async () => {
    try {
      setFleetProgress({ progress: 0, total: 0, currentClient: null, status: 'starting' });
      const { data, error } = await supabase.functions.invoke('run-full-fleet', { body: {} });

      if (error || !data?.ok) {
        toast({ title: 'Failed to start fleet run', description: error?.message || 'Unknown error', variant: 'destructive' });
        setFleetProgress(null);
        return;
      }

      setFleetJobId(data.jobId);
      setFleetProgress({ progress: 0, total: data.totalClients, currentClient: null, status: 'processing' });
      toast({ title: '🚀 Full Fleet Run Started', description: `Processing ${data.totalClients} clients sequentially with strategist + AI memory.` });
    } catch (err: any) {
      toast({ title: 'Fleet run error', description: err.message, variant: 'destructive' });
      setFleetProgress(null);
    }
  }, [toast]);

  // Poll fleet_run_jobs for progress
  useEffect(() => {
    if (!fleetJobId) return;

    const poll = async () => {
      try {
      const { data, error } = await supabase
        .from('fleet_run_jobs')
        .select('status, progress, total_clients, current_client, results')
        .eq('id', fleetJobId)
        .single();

      if (error || !data) return;

      setFleetProgress({
        progress: data.progress,
        total: data.total_clients,
        currentClient: data.current_client,
        status: data.status,
      });

      const isDone = data.status === 'complete' || data.status === 'completed' || data.status === 'error';
      if (isDone) {
        // Done — clean up
        if (fleetPollRef.current) clearInterval(fleetPollRef.current);
        setFleetJobId(null);

        const results = (data.results as any[]) || [];
        const successCount = results.filter((r: any) => r.status === 'success').length;
        const errorCount = results.filter((r: any) => r.status === 'error').length;
        const skippedCount = results.filter((r: any) => r.status === 'skipped').length;
        const withStratErrors = results.filter((r: any) => r.strategistErrors?.length > 0);

        setFleetResults(results);

        let desc = `${successCount} success, ${errorCount} errors, ${skippedCount} skipped`;
        if (withStratErrors.length > 0) {
          desc += ` · ${withStratErrors.length} had strategist warnings`;
        }

        toast({
          title: data.status !== 'error' ? '✅ Fleet Run Complete' : '⚠️ Fleet Run Finished with Errors',
          description: desc,
        });

        // Reload data
        setTimeout(() => loadLastAdReviews(), 2000);
        setTimeout(() => setFleetProgress(null), 10000);
      }
      } catch (e) { console.warn('[FLEET POLL] Error polling fleet job:', e); }
    };

    // Poll immediately, then every 5 seconds
    poll();
    fleetPollRef.current = setInterval(poll, 5000);

    return () => {
      if (fleetPollRef.current) clearInterval(fleetPollRef.current);
    };
  }, [fleetJobId, toast, loadLastAdReviews]);

  // ===== Single-client Ad Review Runner (for fleet "Run" button) =====
  const runSingleClientAdReview = useCallback(async (clientName: string) => {
    setRunningAdReviewClient(clientName);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: 'Not authenticated', variant: 'destructive' }); return; }

      // Load mappings for this client
      const { data: mappings } = await supabase
        .from('client_account_mappings')
        .select('platform, account_id')
        .eq('client_name', clientName);
      const accounts: Record<string, string[]> = {};
      for (const m of (mappings || [])) {
        if (!accounts[m.platform]) accounts[m.platform] = [];
        accounts[m.platform].push(m.account_id);
      }
      const activeSources = Object.keys(accounts).filter(k => accounts[k]?.length > 0);
      if (activeSources.length === 0) {
        toast({ title: 'No ad accounts linked', description: 'Map ad accounts first in Settings.', variant: 'destructive' });
        return;
      }

      // Fetch Supermetrics data
      const { data: smData } = await supabase.functions.invoke('fetch-supermetrics', {
        body: { action: 'fetch-data', dataSources: activeSources, accounts, dateStart, dateEnd },
      });

      let supermetricsContext = '';
      if (smData?.success && smData?.platforms) {
        supermetricsContext = `=== SUPERMETRICS LIVE AD DATA ===\nDate Range: ${dateStart} to ${dateEnd}\n\n`;
        for (const [platform, platformData] of Object.entries(smData.platforms as Record<string, any>)) {
          const summary = platformData.summary || {};
          supermetricsContext += `## ${platformData.label || platform}\nAccount: ${platformData.accountName || 'N/A'}\n`;
          if (summary.spend > 0) supermetricsContext += `Spend: $${summary.spend?.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
          if (summary.impressions > 0) supermetricsContext += `Impressions: ${summary.impressions?.toLocaleString()}\n`;
          if (summary.clicks > 0) supermetricsContext += `Clicks: ${summary.clicks?.toLocaleString()}\n`;
          if (summary.conversions > 0) supermetricsContext += `Conversions: ${summary.conversions?.toLocaleString()}\n`;
          if (summary.ctr > 0) supermetricsContext += `CTR: ${(summary.ctr * 100).toFixed(2)}%\n`;
          if (summary.cpc > 0) supermetricsContext += `CPC: $${summary.cpc?.toFixed(2)}\n`;
          if (summary.cpa > 0) supermetricsContext += `CPA: $${summary.cpa?.toFixed(2)}\n`;
          if (platformData.campaigns?.length > 0) {
            supermetricsContext += `\nTop Campaigns:\n`;
            for (const c of (platformData.campaigns as any[]).slice(0, 5)) {
              supermetricsContext += `  - ${c.name}: $${c.spend?.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend, ${c.conversions} conv, CPA $${c.cpa?.toFixed(2)}\n`;
            }
          }
          supermetricsContext += '\n';
        }
      }

      const dirEntry = directoryEntries.get(clientName.toLowerCase());
      const industryName = clientIndustries[clientName];
      const benchmark = industryName ? getIndustryBenchmark(industryName) : DEFAULT_BENCHMARK;

      const { data: prevReviews } = await supabase
        .from('ad_review_history')
        .select('*')
        .eq('client_name', clientName)
        .order('review_date', { ascending: false })
        .limit(1);

      const { data: reviewData, error: reviewError } = await supabase.functions.invoke('ad-review', {
        body: {
          type: 'sheets',
          clientName,
          dateRange: { start: dateStart, end: dateEnd },
          sheetsData: supermetricsContext,
          lookerUrl: dirEntry?.lookerUrl || undefined,
          benchmarkData: benchmark,
          previousReview: prevReviews?.[0] || undefined,
        },
      });

      if (reviewError || !reviewData?.analysis) {
        toast({ title: `Ad Review failed for ${clientName}`, variant: 'destructive' });
        return;
      }

      await supabase.from('ad_review_history').insert({
        client_name: clientName,
        review_date: new Date().toISOString().split('T')[0],
        date_range_start: dateStart,
        date_range_end: dateEnd,
        summary: reviewData.analysis.summary || '',
        platforms: reviewData.analysis.platforms || [],
        insights: reviewData.analysis.insights || [],
        recommendations: reviewData.analysis.recommendations || [],
        week_over_week: reviewData.analysis.weekOverWeek || [],
        benchmark_comparison: reviewData.analysis.benchmarkAnalysis || {},
        industry: benchmark.industry,
        created_by: user.id,
      });

      toast({ title: `Ad Review complete for ${clientName}` });
      loadLastAdReviews();
    } catch (err: any) {
      toast({ title: `Ad Review failed`, description: err.message, variant: 'destructive' });
    } finally {
      setRunningAdReviewClient(null);
    }
  }, [dateStart, dateEnd, directoryEntries, clientIndustries, toast, loadLastAdReviews]);

  const SEO_CACHE_KEY = 'seo_metrics_cache';

  useEffect(() => {
    try {
      const cached = localStorage.getItem(SEO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.data && Object.keys(parsed.data).length > 0) {
          setClientSeoData(parsed.data);
          if (parsed.savedAt) setSeoCacheTimestamp(parsed.savedAt);
          console.log(`[SEO CACHE] Loaded ${Object.keys(parsed.data).length} cached SEO records`);
        }
      }
    } catch (e) { console.warn('[SEO CACHE] Failed to load:', e); }
  }, []);

  useEffect(() => {
    if (Object.keys(clientSeoData).length > 0) {
      try {
        const now = new Date().toISOString();
        localStorage.setItem(SEO_CACHE_KEY, JSON.stringify({ data: clientSeoData, savedAt: now }));
        setSeoCacheTimestamp(now);
      } catch (e) { console.warn('[SEO CACHE] Failed to save:', e); }
    }
  }, [clientSeoData]);

  const handleFetchSeoData = useCallback(async () => {
    setIsLoadingSeo(true);
    setClientSeoData({});

    // Step 1: Re-fetch site_audit_url from managed_clients
    let freshClients = [...clients];
    try {
      const { data: mcRows } = await supabase.from('managed_clients').select('client_name, site_audit_url').not('site_audit_url', 'is', null);
      const freshAuditMap = new Map<string, string>();
      for (const mc of mcRows || []) {
        if (mc.site_audit_url) freshAuditMap.set(mc.client_name.toLowerCase(), mc.site_audit_url);
      }
      freshClients = freshClients.map(c => {
        const freshUrl = freshAuditMap.get(c.name.toLowerCase());
        return freshUrl ? { ...c, siteAuditUrl: freshUrl } : c;
      });
    } catch (err) {
      console.error('[SEO] Failed to refresh audit URLs:', err);
    }

    const clientsWithDomains = freshClients.filter(c => c.domain);
    if (clientsWithDomains.length === 0) {
      toast({ title: 'No clients with domains found', variant: 'destructive' });
      setIsLoadingSeo(false);
      return;
    }

    const totalSteps = clientsWithDomains.length + freshClients.filter(c => c.siteAuditUrl).length;
    let stepsDone = 0;
    const results: Record<string, SeoMetrics> = {};
    const freshErrors = new Map<string, number>();
    const freshHealthScores = new Map<string, number>();
    const freshConfidence: Record<string, 'high' | 'medium' | 'low'> = {};

    // Step 2: Fetch Semrush SEO data for each client with a domain
    for (let i = 0; i < clientsWithDomains.length; i++) {
      const client = clientsWithDomains[i];
      stepsDone++;
      setSeoFetchProgress({ current: stepsDone, total: totalSteps, name: `SEO: ${client.name}` });
      try {
        const { data, error } = await supabase.functions.invoke('get-seo-data', {
          body: { domain: client.domain },
        });
        if (!error && data) {
          const seoData = data.data || data;
          results[client.name] = {
            organicKeywords: seoData.organicKeywords || 0,
            organicTraffic: seoData.organicTraffic || 0,
            domainAuthority: seoData.domainAuthority || 0,
            backlinks: seoData.backlinks || 0,
          };
        }
      } catch (err) {
        console.error(`[SEO] Failed for ${client.name}:`, err);
      }
      if (i < clientsWithDomains.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    // Step 3: Scrape site audit URLs for fresh error counts
    const clientsWithAudit = freshClients.filter(c => c.siteAuditUrl);
    console.log(`[SEO] Processing ${clientsWithAudit.length} clients with audit URLs out of ${freshClients.length} total clients`);
    for (let i = 0; i < clientsWithAudit.length; i++) {
      const client = clientsWithAudit[i];
      stepsDone++;
      setSeoFetchProgress({ current: stepsDone, total: totalSteps, name: `Audit: ${client.name}` });
      try {
        const { data, error } = await supabase.functions.invoke('analyze-site-audit', {
          body: { url: client.siteAuditUrl, clientName: client.name },
        });
        if (!error && data?.success) {
          freshErrors.set(client.name.toLowerCase(), data.errors || 0);
          if (data.siteHealthScore != null) freshHealthScores.set(client.name.toLowerCase(), data.siteHealthScore);
          if (data.confidence) freshConfidence[client.name.toLowerCase()] = data.confidence;
          console.log(`[SEO] Audit for ${client.name}: ${data.errors} errors, health: ${data.siteHealthScore ?? 'N/A'}%, confidence: ${data.confidence || 'unknown'} (method: ${data.analysisMethod})`);
        } else if (data?.unavailable) {
          console.log(`[SEO] Audit unavailable for ${client.name} - URL expired`);
        } else {
          console.warn(`[SEO] Audit failed for ${client.name}: ${data?.error || error?.message} — will use cached value if available`);
        }
      } catch (err) {
        console.error(`[SEO] Audit failed for ${client.name}:`, err);
      }
      if (i < clientsWithAudit.length - 1) await new Promise(r => setTimeout(r, 500));
    }

    // Step 4: Update local state with fresh error counts and health scores
    if (freshErrors.size > 0) {
      setSiteErrorMap(prev => {
        const updated = new Map(prev);
        freshErrors.forEach((errors, key) => updated.set(key, errors));
        return updated;
      });
    }
    if (freshHealthScores.size > 0) {
      setSiteHealthMap(prev => {
        const updated = new Map(prev);
        freshHealthScores.forEach((score, key) => updated.set(key, score));
        return updated;
      });
    }
    if (Object.keys(freshConfidence).length > 0) {
      setAuditConfidence(prev => ({ ...prev, ...freshConfidence }));
    }

    setClientSeoData(results);
    setSeoFetchProgress(null);
    setIsLoadingSeo(false);
    toast({ title: `SEO data loaded for ${Object.keys(results).length} clients, ${freshErrors.size} audits scraped` });
  }, [clients, toast]);

  // ===== Client selection — opens detail view =====
  const handleSelectClient = useCallback(async (client: ClientHealthData) => {
    setSelectedClient(client);
    setDetailClient(client.name);
    setDetailTab('overview');
    setContextSelectedClient(client.name);
    setSeoAnalysis(null);
    setLiveAdData(null);

    // Immediately clear stale account IDs to prevent race condition
    setDetailGoogleAccountId('');
    setDetailMetaAccountId('');

    // Query account mappings directly for this client (bypasses async ClientContext)
    try {
      const { data: mappings } = await supabase
        .from('client_account_mappings')
        .select('platform, account_id')
        .eq('client_name', client.name);
      if (mappings) {
        for (const m of mappings) {
          if (m.platform === 'google_ads') setDetailGoogleAccountId(m.account_id);
          if (m.platform === 'meta_ads') setDetailMetaAccountId(m.account_id);
        }
      }
    } catch (err) {
      console.error('Failed to load detail account mappings:', err);
    }

    if (client.domain) runSeoAnalysis(client);
    if (client.matchedAccounts && Object.keys(client.matchedAccounts).length > 0) {
      fetchLiveAdData(client.name, client.matchedAccounts);
    } else if (smAccountsLoaded) {
      const matched = getMatchedAccounts(client.name);
      client.matchedAccounts = matched;
      if (Object.keys(matched).length > 0) fetchLiveAdData(client.name, matched);
    }
    // Load strategist data for this client
    loadStrategistData(client.name);
    loadDetailAdReview(client.name);
    // Sync draft accounts from the direct query (will be populated after await above)
    setDraftGoogle(detailGoogleAccountId);
    setDraftMeta(detailMetaAccountId);
  }, [smAccountsLoaded, getMatchedAccounts, fetchLiveAdData, setContextSelectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const backToFleet = useCallback(() => {
    setDetailClient(null);
    setSelectedClient(null);
    setStratActiveSession(null);
    setStratChanges([]);
  }, []);

  // ===== Strategist data loading =====
  const loadStrategistData = useCallback(async (clientName: string) => {
    const [settingsRes, sessionsRes, changesRes, resultsRes] = await Promise.all([
      supabase.from('ppc_client_settings').select('*').eq('client_name', clientName).maybeSingle(),
      supabase.from('ppc_optimization_sessions').select('*').eq('client_name', clientName).order('created_at', { ascending: false }).limit(50),
      supabase.from('ppc_proposed_changes').select('*').eq('client_name', clientName).order('created_at', { ascending: false }).limit(500),
      supabase.from('ppc_change_results').select('*').order('assessed_at', { ascending: false }),
    ]);
    if (settingsRes.data) {
      setStratClientSettings({
        auto_mode_enabled: settingsRes.data.auto_mode_enabled,
        auto_mode_platform: settingsRes.data.auto_mode_platform || 'both',
        auto_mode_schedule: settingsRes.data.auto_mode_schedule || 'weekly',
        confidence_threshold: settingsRes.data.confidence_threshold || 'high',
        max_changes_per_run: settingsRes.data.max_changes_per_run || 5,
      });
    } else {
      setStratClientSettings({ auto_mode_enabled: false, auto_mode_platform: 'both', auto_mode_schedule: 'weekly', confidence_threshold: 'high', max_changes_per_run: 5 });
    }
    if (sessionsRes.data) setStratSessions(sessionsRes.data);
    if (changesRes.data) setStratAllChanges(changesRes.data);
    if (resultsRes.data) setStratResults(resultsRes.data);

    // Build learning insights from change results + proposed changes
    const clientChanges = (changesRes.data || []).filter((c: any) => c.client_name === clientName);
    const clientResults = (resultsRes.data || []);
    const insights: LearningInsight[] = [];

    // Map results by change_id for lookup
    const resultsByChange: Record<string, any> = {};
    for (const r of clientResults) resultsByChange[r.change_id] = r;

    // Tally successes and failures by change_type
    const successTypes: Record<string, { count: number; entities: string[] }> = {};
    const failureTypes: Record<string, { count: number; entities: string[] }> = {};

    for (const change of clientChanges) {
      const result = resultsByChange[change.id];
      if (!result) continue;
      const outcome = result.outcome?.toLowerCase() || '';
      const bucket = (outcome === 'improved' || outcome === 'positive') ? successTypes : (outcome === 'declined' || outcome === 'negative' || outcome === 'no change') ? failureTypes : null;
      if (!bucket) continue;
      const key = change.change_type || 'unknown';
      if (!bucket[key]) bucket[key] = { count: 0, entities: [] };
      bucket[key].count++;
      if (change.entity_name && !bucket[key].entities.includes(change.entity_name)) bucket[key].entities.push(change.entity_name);
    }

    // Top successes
    const sortedSuccesses = Object.entries(successTypes).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
    for (const [type, info] of sortedSuccesses) {
      insights.push({ type: 'success', label: type.replace(/_/g, ' '), detail: info.entities.length > 0 ? `Worked on: ${info.entities.slice(0, 3).join(', ')}` : `${info.count} successful application(s)`, count: info.count });
    }

    // Top failures
    const sortedFailures = Object.entries(failureTypes).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
    for (const [type, info] of sortedFailures) {
      insights.push({ type: 'failure', label: type.replace(/_/g, ' '), detail: info.entities.length > 0 ? `Declined on: ${info.entities.slice(0, 3).join(', ')}` : `${info.count} unsuccessful attempt(s)`, count: info.count });
    }

    // Trend: sessions over time
    const clientSessions = (sessionsRes.data || []).filter((s: any) => s.client_name === clientName);
    if (clientSessions.length >= 2) {
      const recent = clientSessions.slice(0, Math.ceil(clientSessions.length / 2));
      const older = clientSessions.slice(Math.ceil(clientSessions.length / 2));
      const recentAuto = recent.filter((s: any) => s.auto_mode).length;
      const olderAuto = older.filter((s: any) => s.auto_mode).length;
      if (recentAuto > olderAuto) {
        insights.push({ type: 'trend', label: 'Automation increasing', detail: `${recentAuto} auto runs recently vs ${olderAuto} earlier` });
      }
      // Check for improving win rate
      const totalResults = clientResults.length;
      if (totalResults >= 4) {
        const recentResults = clientResults.slice(0, Math.ceil(totalResults / 2));
        const olderResults = clientResults.slice(Math.ceil(totalResults / 2));
        const recentWinRate = recentResults.filter((r: any) => r.outcome === 'improved').length / recentResults.length;
        const olderWinRate = olderResults.filter((r: any) => r.outcome === 'improved').length / olderResults.length;
        if (recentWinRate > olderWinRate + 0.05) {
          insights.push({ type: 'trend', label: 'Win rate improving', detail: `${Math.round(recentWinRate * 100)}% recently vs ${Math.round(olderWinRate * 100)}% earlier` });
        } else if (olderWinRate > recentWinRate + 0.05) {
          insights.push({ type: 'trend', label: 'Win rate declining', detail: `${Math.round(recentWinRate * 100)}% recently vs ${Math.round(olderWinRate * 100)}% earlier` });
        }
      }
    }

    if (insights.length === 0 && clientSessions.length > 0) {
      insights.push({ type: 'trend', label: 'Building knowledge', detail: `${clientSessions.length} session(s) analyzed, waiting for more assessed outcomes` });
    }

    setLearningInsights(insights);
  }, []);

  const loadDetailAdReview = useCallback(async (clientName: string) => {
    const { data } = await supabase.from('ad_review_history').select('*').eq('client_name', clientName).order('review_date', { ascending: false }).limit(50);
    if (data && data.length > 0) {
      setDetailAdReview(data[0]);
      setDetailAdReviewHistory(data);
    } else {
      setDetailAdReview(null);
      setDetailAdReviewHistory([]);
    }
  }, []);

  // Strategist handlers — use local detail account IDs (not ClientContext) to avoid race condition
  const stratAccountId = stratPlatform === 'google' ? detailGoogleAccountId : detailMetaAccountId;

  const handleStratAnalyze = useCallback(async () => {
    if (!detailClient) return;
    setStratAnalyzing(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - stratDatePreset);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ppc-analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            clientName: detailClient, platform: stratPlatform, accountId: stratAccountId || undefined,
            dateStart: start.toISOString().split('T')[0], dateEnd: end.toISOString().split('T')[0],
            createdBy: user?.id, autoMode: stratClientSettings.auto_mode_enabled,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      if (data.autoMode && data.autoExecuted > 0) {
        toast({ title: `⚡ Auto Mode: ${data.autoExecuted} changes executed`, description: `${data.changesCount - data.autoExecuted} pending review.` });
      } else {
        toast({ title: `Analysis complete! ${data.changesCount} recommendations.` });
      }
      loadStrategistData(detailClient);
      if (data.session) setStratActiveSession(data.session);
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally { setStratAnalyzing(false); }
  }, [detailClient, stratPlatform, stratAccountId, stratDatePreset, stratClientSettings, user, toast, loadStrategistData]);

  const handleStratApprove = useCallback(async (changeId: string) => {
    await supabase.from('ppc_proposed_changes').update({ approval_status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', changeId);
    setStratChanges(prev => prev.map(c => c.id === changeId ? { ...c, approval_status: 'approved' } : c));
  }, [user]);

  const handleStratReject = useCallback(async (changeId: string) => {
    await supabase.from('ppc_proposed_changes').update({ approval_status: 'rejected' }).eq('id', changeId);
    setStratChanges(prev => prev.map(c => c.id === changeId ? { ...c, approval_status: 'rejected' } : c));
  }, []);

  const handleStratApproveAll = useCallback(async () => {
    const pendingIds = stratChanges.filter(c => c.approval_status === 'pending').map(c => c.id);
    if (pendingIds.length === 0) return;
    await supabase.from('ppc_proposed_changes').update({ approval_status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() }).in('id', pendingIds);
    setStratChanges(prev => prev.map(c => pendingIds.includes(c.id) ? { ...c, approval_status: 'approved' } : c));
    toast({ title: `${pendingIds.length} changes approved` });
  }, [stratChanges, user, toast]);

  const handleStratExecute = useCallback(async () => {
    const approvedIds = stratChanges.filter(c => c.approval_status === 'approved' && !c.executed_at).map(c => c.id);
    if (approvedIds.length === 0) return toast({ title: 'No approved changes to execute', variant: 'destructive' });
    setStratExecuting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ppc-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ changeIds: approvedIds, sessionId: stratActiveSession?.id, approvedBy: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');
      const succeeded = data.results?.filter((r: any) => r.success) || [];
      const failed = data.results?.filter((r: any) => !r.success) || [];
      if (failed.length === 0) {
        toast({ title: `✅ ${succeeded.length} change(s) executed successfully!` });
      } else if (succeeded.length === 0) {
        toast({ title: `❌ All ${failed.length} changes failed`, description: failed.map((f: any) => `${f.entity_name}: ${f.error}`).slice(0, 3).join('\n'), variant: 'destructive' });
      } else {
        toast({ title: `${succeeded.length} succeeded, ${failed.length} failed`, description: failed.map((f: any) => `${f.entity_name}: ${f.error}`).slice(0, 3).join('\n') });
      }
      if (detailClient) loadStrategistData(detailClient);
    } catch (e: any) {
      toast({ title: 'Execution failed', description: e.message, variant: 'destructive' });
    } finally { setStratExecuting(false); }
  }, [stratChanges, stratActiveSession, user, toast, detailClient, loadStrategistData]);

  const handleStratAssess = useCallback(async () => {
    if (!stratActiveSession) return;
    setStratAssessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ppc-assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ sessionId: stratActiveSession.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assessment failed');
      toast({ title: `Assessment complete! Outcome: ${data.outcome}` });
      if (detailClient) loadStrategistData(detailClient);
    } catch (e: any) {
      toast({ title: 'Assessment failed', description: e.message, variant: 'destructive' });
    } finally { setStratAssessing(false); }
  }, [stratActiveSession, toast, detailClient, loadStrategistData]);

  // Load session changes when active session changes
  useEffect(() => {
    if (!stratActiveSession) return;
    supabase.from('ppc_proposed_changes').select('*').eq('session_id', stratActiveSession.id).order('priority', { ascending: false })
      .then(({ data }) => { if (data) setStratChanges(data); });
  }, [stratActiveSession]);

  // (handleSaveAccounts removed — account linking now uses AccountMappingModal exclusively)

  const runSeoAnalysis = async (client: ClientHealthData) => {
    if (!client.domain) return;
    setIsAnalyzingSeo(true);
    setSeoAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke('seo-bot-analyze', {
        body: { clientName: client.name, domain: client.domain, saveToHistory: false },
      });
      if (error) throw error;
      if (data?.success && data?.analysis) setSeoAnalysis(data.analysis);
    } catch (error) {
      console.error('SEO analysis error:', error);
      toast({ title: 'SEO analysis failed', variant: 'destructive' });
    } finally { setIsAnalyzingSeo(false); }
  };

  // ===== Derived =====
  const filteredClients = useMemo(() => {
    let list = [...clients];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.domain?.toLowerCase().includes(q));
    }
    if (sortBy === 'health') list.sort((a, b) => (a.healthScore < 0 ? 999 : a.healthScore) - (b.healthScore < 0 ? 999 : b.healthScore));
    else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'seo') list.sort((a, b) => (b.seoErrors ?? -1) - (a.seoErrors ?? -1));
    return list;
  }, [clients, searchQuery, sortBy]);

  const TIER_CONFIG = [
    { key: 'premium' as const, label: 'Premium', icon: Crown, color: 'text-amber-400', borderColor: 'border-amber-500/20', bgColor: 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent', accentColor: 'hsl(38 92% 50% / 0.4)' },
    { key: 'advanced' as const, label: 'Advanced', icon: Star, color: 'text-purple-400', borderColor: 'border-purple-500/20', bgColor: 'bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent', accentColor: 'hsl(270 60% 55% / 0.4)' },
    { key: 'basic' as const, label: 'Standard', icon: Layers, color: 'text-sky-400', borderColor: 'border-sky-500/20', bgColor: 'bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent', accentColor: 'hsl(200 80% 55% / 0.4)' },
  ];

  const tieredClients = useMemo(() => {
    const groups: Record<string, ClientHealthData[]> = { premium: [], advanced: [], basic: [] };
    for (const client of filteredClients) {
      const tier = clientTiers[client.name] || 'basic';
      groups[tier].push(client);
    }
    return groups;
  }, [filteredClients, clientTiers]);

  const stats = useMemo(() => {
    const critical = clients.filter(c => c.overallHealth === 'critical').length;
    const warning = clients.filter(c => c.overallHealth === 'warning').length;
    const healthy = clients.filter(c => c.overallHealth === 'healthy').length;
    return { critical, warning, healthy, total: clients.length };
  }, [clients]);

  const liveAdTotals = useMemo(() => {
    if (!liveAdData) return null;
    let spend = 0, clicks = 0, impressions = 0, conversions = 0, leads = 0, purchases = 0, calls = 0;
    for (const platform of Object.values(liveAdData)) {
      const p = platform as PlatformSummary;
      spend += p.summary?._cost || 0;
      clicks += p.summary?._clicks || 0;
      impressions += p.summary?._impressions || 0;
      conversions += p.summary?._conversions || 0;
      leads += p.summary?._leads || 0;
      purchases += p.summary?._purchases || 0;
      calls += p.summary?._phoneCalls || 0;
    }
    return { spend, clicks, impressions, conversions, leads, purchases, calls, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0, cpc: clicks > 0 ? spend / clicks : 0, cpl: conversions > 0 ? spend / conversions : 0 };
  }, [liveAdData]);

  const fmt = (n: number | null | undefined) => { if (n == null) return '—'; if (n >= 1_000_000) return `${(n/1e6).toFixed(1)}M`; if (n >= 1000) return `${(n/1000).toFixed(1)}K`; return n.toLocaleString(); };
  const fmtCur = (n: number | null | undefined) => n == null ? '—' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(2)}%`;

  const getChange = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return null;
    const pct = ((current - previous) / previous) * 100;
    return { pct, direction: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'stable' as const };
  };

  const seoErrorVariant = (n: number | null | undefined): 'danger' | 'warn' | 'good' | 'neutral' => {
    if (n == null) return 'neutral';
    if (n > 200) return 'danger';
    if (n > 50) return 'warn';
    return 'good';
  };

  const truncateUrl = (url: string, maxLen = 40) => url && url.length > maxLen ? url.substring(0, maxLen) + '…' : url || '';

  // Strategist derived values
  const stratApprovedCount = stratChanges.filter(c => c.approval_status === 'approved' && !c.executed_at).length;
  const stratExecutedCount = stratChanges.filter(c => c.executed_at).length;
  const stratPendingCount = stratChanges.filter(c => c.approval_status === 'pending').length;
  const stratHasExecuted = stratExecutedCount > 0;

  const detailDaysSinceAdReview = detailAdReview
    ? Math.floor((Date.now() - new Date(detailAdReview.review_date).getTime()) / 86400000)
    : null;

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">

        {/* ═══════════════ DETAIL VIEW ═══════════════ */}
        {detailClient ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Button variant="ghost" size="sm" onClick={backToFleet} className="gap-1 -ml-1 shrink-0 px-2">
                  <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">All Clients</span>
                </Button>
                <span className="text-muted-foreground hidden sm:inline">/</span>
                <h1 className="text-base sm:text-lg font-bold text-foreground truncate">{detailClient}</h1>
                {selectedClient && <StatusDot status={selectedClient.overallHealth} />}
                <span className="hidden sm:inline-flex items-center text-xs text-muted-foreground bg-muted/50 border border-border/50 rounded-md px-2 py-0.5 shrink-0">
                  {safeFormatDate(dateStart, 'MMM d')} – {safeFormatDate(dateEnd, 'MMM d, yyyy')}
                </span>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => {
                if (selectedClient) handleSelectClient(selectedClient);
              }}>
                <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="mb-4 w-full sm:w-auto overflow-x-auto">
                <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm"><Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Overview</span><span className="sm:hidden">View</span></TabsTrigger>
                <TabsTrigger value="ai-results" className="gap-1.5 text-xs sm:text-sm"><TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">AI Results</span><span className="sm:hidden">AI</span></TabsTrigger>
                <TabsTrigger value="adreview" className="gap-1.5 text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Ad Review</span><span className="sm:hidden">Ads</span></TabsTrigger>
                <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm"><Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Settings</span><span className="sm:hidden">⚙️</span></TabsTrigger>
              </TabsList>

              {/* ── OVERVIEW TAB ── */}
              <TabsContent value="overview">
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">Days Since Ad Review</p>
                      <p className="text-2xl font-bold text-foreground">{detailDaysSinceAdReview ?? '—'}</p>
                      {detailAdReview && <p className="text-xs text-muted-foreground">Last: {new Date(detailAdReview.review_date).toLocaleDateString()}</p>}
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">Industry</p>
                      <p className="text-2xl font-bold text-foreground">{clientIndustries[detailClient] || '—'}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">Pending Changes</p>
                      <p className="text-2xl font-bold text-foreground">{stratPendingCount}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold text-foreground">
                        {stratResults.length > 0 ? `${Math.round((stratResults.filter(r => r.outcome === 'improved').length / stratResults.length) * 100)}%` : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                      <p className="text-xs text-muted-foreground">Last Auto Run</p>
                      {(() => {
                        const autoRun = detailClient ? lastAutoRuns[detailClient] : null;
                        if (!autoRun) return <p className="text-2xl font-bold text-foreground">—</p>;
                        const daysAgo = Math.floor((Date.now() - new Date(autoRun.date).getTime()) / 86400000);
                        const isFailed = autoRun.status === 'error' || autoRun.status === 'failed';
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${isFailed ? 'bg-red-500' : daysAgo <= 1 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                              <p className="text-2xl font-bold text-foreground">{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{isFailed ? 'Failed' : autoRun.status === 'auto_executed' ? '✅ Auto-executed' : autoRun.status} · {autoRun.platform}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Linked Accounts Summary */}
                  {(() => {
                    const clientMappings = manualMappings[detailClient] || {};
                    const platformLabels: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', tiktok_ads: 'TikTok Ads', bing_ads: 'Microsoft Ads', linkedin_ads: 'LinkedIn Ads' };
                    const platformColors: Record<string, string> = { google_ads: 'bg-blue-500/10 border-blue-500/20 text-blue-400', meta_ads: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', tiktok_ads: 'bg-pink-500/10 border-pink-500/20 text-pink-400', bing_ads: 'bg-teal-500/10 border-teal-500/20 text-teal-400', linkedin_ads: 'bg-sky-500/10 border-sky-500/20 text-sky-400' };
                    const entries = Object.entries(clientMappings);
                    return (
                      <Card>
                        <CardContent className="pt-5">
                          <p className="text-xs text-muted-foreground mb-2">Linked Ad Accounts</p>
                          {entries.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 italic">No ad accounts linked. Go to Settings to connect.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {entries.map(([platform, ids]) => (
                                <span key={platform} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${platformColors[platform] || 'bg-muted border-border text-muted-foreground'}`}>
                                  <CheckCircle className="h-3 w-3" />
                                  {platformLabels[platform] || platform}
                                  {ids.length > 1 && <span className="text-[10px] opacity-70">({ids.length})</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* ── Ad Analytics Dashboard ── */}
                  {isLoadingAdData ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    </div>
                  ) : liveAdData && Object.keys(liveAdData).length > 0 ? (
                    <div className="space-y-4">
                      {(() => {
                        // ── Aggregate totals + previous ──
                        let totSpend = 0, totConv = 0, totClicks = 0, totImpr = 0;
                        let prevSpend = 0, prevConv = 0, prevClicks = 0, prevImpr = 0;
                        let hasPrev = false;
                        for (const pv of Object.values(liveAdData)) {
                          const ps = pv as PlatformSummary;
                          totSpend += ps.summary?._cost || 0;
                          totConv += ps.summary?._conversions || 0;
                          totClicks += ps.summary?._clicks || 0;
                          totImpr += ps.summary?._impressions || 0;
                          if (ps.previousPeriod) {
                            hasPrev = true;
                            prevSpend += ps.previousPeriod._cost || 0;
                            prevConv += ps.previousPeriod._conversions || 0;
                            prevClicks += ps.previousPeriod._clicks || 0;
                            prevImpr += ps.previousPeriod._impressions || 0;
                          }
                        }
                        const totCpa = totConv > 0 ? totSpend / totConv : 0;
                        const prevCpa = prevConv > 0 ? prevSpend / prevConv : 0;
                        const totCtr = totImpr > 0 ? (totClicks / totImpr) * 100 : 0;
                        const prevCtr = prevImpr > 0 ? (prevClicks / prevImpr) * 100 : 0;
                        const pctChg = (curr: number, prev: number) => hasPrev && prev > 0 ? ((curr - prev) / prev) * 100 : null;

                        const kpis = [
                          { label: 'Total Spend', value: fmtCur(totSpend), change: pctChg(totSpend, prevSpend), invert: true, icon: <DollarSign className="h-4 w-4" /> },
                          { label: 'Conversions', value: fmt(totConv), change: pctChg(totConv, prevConv), invert: false, icon: <Target className="h-4 w-4" /> },
                          { label: 'CPA', value: totCpa > 0 ? fmtCur(totCpa) : '—', change: pctChg(totCpa, prevCpa), invert: true, icon: <DollarSign className="h-4 w-4" /> },
                          { label: 'CTR', value: fmtPct(totCtr), change: pctChg(totCtr, prevCtr), invert: false, icon: <MousePointer className="h-4 w-4" /> },
                          { label: 'Clicks', value: fmt(totClicks), change: pctChg(totClicks, prevClicks), invert: false, icon: <TrendingUp className="h-4 w-4" /> },
                        ];

                        // ── Merge all campaigns ──
                        const allCampaigns: { platform: string; name: string; spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; cpa: number }[] = [];
                        for (const [key, pv] of Object.entries(liveAdData)) {
                          const ps = pv as PlatformSummary;
                          if (ps.campaigns) {
                            for (const c of ps.campaigns) allCampaigns.push({ platform: key, ...c });
                          }
                        }
                        const totalCampSpend = allCampaigns.reduce((s, c) => s + c.spend, 0);
                        const clientBm = getIndustryBenchmark(clientIndustries[detailClient || ""] || "");

                        // ── Sort function (shared for both platforms) ──
                        const sortCamps = (camps: typeof allCampaigns) => [...camps].sort((a, b) => {
                          const dir = campaignSortAsc ? 1 : -1;
                          switch (campaignSortCol) {
                            case 'conversions': return dir * (b.conversions - a.conversions);
                            case 'cpa': return dir * (b.cpa - a.cpa);
                            case 'ctr': return dir * (b.ctr - a.ctr);
                            default: return dir * (b.spend - a.spend);
                          }
                        });
                        const googleCamps = sortCamps(allCampaigns.filter(c => c.platform === 'google'));
                        const metaCamps = sortCamps(allCampaigns.filter(c => c.platform === 'meta'));
                        const sortedCamps = [...googleCamps, ...metaCamps];
                        const displayedCamps = showAllCampaigns ? sortedCamps : sortedCamps.slice(0, 10);

                        // ── Google keywords ──
                        const gKeywords = (liveAdData['google'] as PlatformSummary | undefined)?.keywords || [];
                        const sortedKws = [...gKeywords].sort((a, b) => b.clicks - a.clicks);
                        const displayedKws = showAllKeywords ? sortedKws : sortedKws.slice(0, 15);

                        // ── Daily trend data ──
                        const dailyMap: Record<string, { dateKey: string; label: string; googleSpend: number; metaSpend: number; googleConv: number; metaConv: number }> = {};
                        for (const [key, pv] of Object.entries(liveAdData)) {
                          const ps = pv as PlatformSummary;
                          if (!ps.dailyData) continue;
                          const isG = key === 'google';
                          for (const d of ps.dailyData) {
                            if (!dailyMap[d.date]) dailyMap[d.date] = { dateKey: d.date, label: d.label || d.date, googleSpend: 0, metaSpend: 0, googleConv: 0, metaConv: 0 };
                            if (isG) { dailyMap[d.date].googleSpend += d.spend; dailyMap[d.date].googleConv += d.conversions; }
                            else { dailyMap[d.date].metaSpend += d.spend; dailyMap[d.date].metaConv += d.conversions; }
                          }
                        }
                        const trendData = Object.values(dailyMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
                        const hasGoogle = !!liveAdData['google'];
                        const hasMeta = !!liveAdData['meta'];
                        const hasTrendData = trendData.length > 0;

                        const campSortTh = (col: 'spend' | 'conversions' | 'cpa' | 'ctr', label: string) => (
                          <TableHead
                            key={col}
                            className="text-xs cursor-pointer hover:text-foreground select-none text-right"
                            onClick={() => { if (campaignSortCol === col) setCampaignSortAsc(!campaignSortAsc); else { setCampaignSortCol(col); setCampaignSortAsc(false); } }}
                          >
                            {label} {campaignSortCol === col ? (campaignSortAsc ? '↑' : '↓') : ''}
                          </TableHead>
                        );

                        return (
                          <>
                            {/* A. KPI Hero Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              {kpis.map(kpi => {
                                const isGood = kpi.change !== null ? (kpi.invert ? kpi.change < 0 : kpi.change > 0) : null;
                                return (
                                  <div key={kpi.label} className={`rounded-xl border p-4 space-y-1 transition-colors ${isGood === true ? 'bg-emerald-500/5 border-emerald-500/25' : isGood === false ? 'bg-red-500/5 border-red-500/25' : 'bg-card border-border'}`}>
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      {kpi.icon}
                                      <span className="text-[10px] uppercase tracking-wide font-medium">{kpi.label}</span>
                                    </div>
                                    <div className="text-2xl font-bold">{kpi.value}</div>
                                    {kpi.change !== null && (
                                      <div className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-emerald-500' : 'text-red-400'}`}>
                                        {isGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {Math.abs(kpi.change).toFixed(1)}% vs prev
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* B. Platform Breakdown Cards */}
                            <div className="grid sm:grid-cols-2 gap-4">
                              {(['google', 'meta'] as const).map(platformKey => {
                                const ps = liveAdData[platformKey] as PlatformSummary | undefined;
                                if (!ps) return null;
                                const isG = platformKey === 'google';
                                const spend = ps.summary?._cost || 0;
                                const conv = ps.summary?._conversions || 0;
                                const cpa = conv > 0 ? spend / conv : 0;
                                const clicks = ps.summary?._clicks || 0;
                                const impr = ps.summary?._impressions || 0;
                                const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
                                const pp = ps.previousPeriod;
                                const ppSpend = pp?._cost || 0;
                                const ppConv = pp?._conversions || 0;
                                const ppCpa = ppConv > 0 ? ppSpend / ppConv : 0;
                                const ppClicks = pp?._clicks || 0;
                                const ppImpr = pp?._impressions || 0;
                                const ppCtr = ppImpr > 0 ? (ppClicks / ppImpr) * 100 : 0;
                                const spendShare = totSpend > 0 ? (spend / totSpend) * 100 : 0;
                                const chg = (curr: number, prev: number) => pp && prev > 0 ? ((curr - prev) / prev) * 100 : null;
                                const metrics = [
                                  { label: 'Spend', value: fmtCur(spend), change: chg(spend, ppSpend), invert: true },
                                  { label: 'Conversions', value: fmt(conv), change: chg(conv, ppConv), invert: false },
                                  { label: 'CPA', value: cpa > 0 ? fmtCur(cpa) : '—', change: chg(cpa, ppCpa), invert: true },
                                  { label: 'CTR', value: fmtPct(ctr), change: chg(ctr, ppCtr), invert: false },
                                ];
                                return (
                                  <Card key={platformKey} className={`border ${isG ? 'border-blue-500/30' : 'border-orange-500/30'}`}>
                                    <CardHeader className="pb-3 pt-4">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-white text-xs font-bold ${isG ? 'bg-blue-500' : 'bg-orange-500'}`}>
                                          {isG ? 'G' : 'M'}
                                        </span>
                                        <div>
                                          <p className="text-sm font-semibold">{isG ? 'Google Ads' : 'Meta Ads'}</p>
                                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{ps.accountName}</p>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-2 gap-3 mb-3">
                                        {metrics.map(m => {
                                          const good = m.change !== null ? (m.invert ? m.change < 0 : m.change > 0) : null;
                                          return (
                                            <div key={m.label}>
                                              <p className="text-xs text-muted-foreground">{m.label}</p>
                                              <p className="text-sm font-bold">{m.value}</p>
                                              {m.change !== null && (
                                                <span className={`text-[10px] flex items-center gap-0.5 ${good ? 'text-emerald-500' : 'text-red-400'}`}>
                                                  {good ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                  {Math.abs(m.change).toFixed(1)}%
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                          <span>Spend share</span>
                                          <span>{spendShare.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full ${isG ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${spendShare}%` }} />
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>

                            {/* C. Performance Trend Chart */}
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Performance Trend</CardTitle>
                                <p className="text-xs text-muted-foreground">{dateLabel}</p>
                              </CardHeader>
                              <CardContent>
                                {hasTrendData ? (
                                  <div style={{ height: 240 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <ComposedChart data={trendData}>
                                        <defs>
                                          <linearGradient id="gSpendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                          </linearGradient>
                                          <linearGradient id="mSpendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                                          </linearGradient>
                                        </defs>
                                        <RCartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <RXAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                                        <RYAxis yAxisId="spend" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} />
                                        <RYAxis yAxisId="conv" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                                        <RTooltip
                                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                          formatter={(val: number, name: string) => (name || '').toLowerCase().includes('spend') ? [`$${val.toFixed(0)}`, name] : [val.toFixed(0), name]}
                                        />
                                        <RLegend wrapperStyle={{ fontSize: 11 }} />
                                        {hasGoogle && <Area yAxisId="spend" type="monotone" dataKey="googleSpend" name="Google Spend" stroke="#3b82f6" fill="url(#gSpendGrad)" strokeWidth={2} dot={false} />}
                                        {hasMeta && <Area yAxisId="spend" type="monotone" dataKey="metaSpend" name="Meta Spend" stroke="#f97316" fill="url(#mSpendGrad)" strokeWidth={2} dot={false} />}
                                        {hasGoogle && <Line yAxisId="conv" type="monotone" dataKey="googleConv" name="Google Conv." stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />}
                                        {hasMeta && <Line yAxisId="conv" type="monotone" dataKey="metaConv" name="Meta Conv." stroke="#fb923c" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />}
                                      </ComposedChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                                    <RefreshCw className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-sm">Run a data refresh to load trend charts</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* D. Campaign Performance Table */}
                            {allCampaigns.length > 0 && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
                                  <p className="text-xs text-muted-foreground">{dateLabel} · {allCampaigns.length} campaigns</p>
                                </CardHeader>
                                <CardContent className="px-0 pb-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs pl-4 w-[28px]">Plt</TableHead>
                                        <TableHead className="text-xs">Campaign</TableHead>
                                        {campSortTh('spend', 'Spend')}
                                        <TableHead className="text-xs text-right">Share</TableHead>
                                        {campSortTh('conversions', 'Conv')}
                                        {campSortTh('cpa', 'CPA')}
                                        {campSortTh('ctr', 'CTR')}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(() => {
                                        const rows: React.ReactNode[] = [];
                                        let lastPlatform = '';
                                        displayedCamps.forEach((c, i) => {
                                          const isG = c.platform === 'google';
                                          // Platform section header when platform changes
                                          if (c.platform !== lastPlatform) {
                                            lastPlatform = c.platform;
                                            rows.push(
                                              <TableRow key={`header-${c.platform}`} className={`border-0 ${isG ? 'bg-blue-500/5' : 'bg-orange-500/5'}`}>
                                                <TableCell colSpan={7} className="py-1.5 pl-4">
                                                  <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold text-white ${isG ? 'bg-blue-500' : 'bg-orange-500'}`}>{isG ? 'G' : 'M'}</span>
                                                    <span className={`text-xs font-semibold ${isG ? 'text-blue-400' : 'text-orange-400'}`}>{isG ? 'Google Ads' : 'Meta Ads'}</span>
                                                    <span className="text-xs text-muted-foreground">· {isG ? googleCamps.length : metaCamps.length} campaigns</span>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          }
                                          const spendPct = totalCampSpend > 0 ? (c.spend / totalCampSpend) * 100 : 0;
                                          const bmCpa = isG ? clientBm.google.cpa : clientBm.facebook.cpa;
                                          const cpaCls = c.cpa > 0 ? (c.cpa <= bmCpa ? 'text-emerald-400' : c.cpa <= bmCpa * 1.5 ? 'text-amber-400' : 'text-red-400') : 'text-muted-foreground';
                                          rows.push(
                                            <TableRow key={`${c.platform}-${c.name}-${i}`} className={`border-l-2 ${isG ? 'border-l-blue-500/40' : 'border-l-orange-500/40'} ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                                              <TableCell className="py-2 pl-4">
                                                <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold text-white ${isG ? 'bg-blue-500' : 'bg-orange-500'}`}>{isG ? 'G' : 'M'}</span>
                                              </TableCell>
                                              <TableCell className="py-2 text-xs font-medium max-w-[180px] truncate" title={c.name}>{c.name}</TableCell>
                                              <TableCell className="py-2 text-xs text-right font-mono">{fmtCur(c.spend)}</TableCell>
                                              <TableCell className="py-2 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                  <div className="h-1.5 w-10 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${isG ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(spendPct, 100)}%` }} />
                                                  </div>
                                                  <span className="text-[10px] text-muted-foreground w-6 text-right">{spendPct.toFixed(0)}%</span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="py-2 text-xs text-right font-mono">{c.conversions > 0 ? c.conversions.toLocaleString() : '—'}</TableCell>
                                              <TableCell className={`py-2 text-xs text-right font-mono font-semibold ${cpaCls}`}>{c.cpa > 0 ? fmtCur(c.cpa) : '—'}</TableCell>
                                              <TableCell className="py-2 text-xs text-right font-mono">{c.ctr > 0 ? fmtPct(c.ctr) : '—'}</TableCell>
                                            </TableRow>
                                          );
                                        });
                                        return rows;
                                      })()}
                                    </TableBody>
                                  </Table>
                                  {sortedCamps.length > 10 && (
                                    <div className="flex justify-center py-3 border-t border-border/30">
                                      <button onClick={() => setShowAllCampaigns(!showAllCampaigns)} className="text-xs text-primary hover:underline">
                                        {showAllCampaigns ? 'Show top 10' : `Show all ${sortedCamps.length} campaigns`}
                                      </button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {/* E. Top Keywords (Google only, collapsible) */}
                            {gKeywords.length > 0 && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <CardTitle className="text-sm font-semibold">Top Keywords</CardTitle>
                                      <p className="text-xs text-muted-foreground">Google Ads · {gKeywords.length} keywords</p>
                                    </div>
                                    <button onClick={() => setKeywordsSectionOpen(!keywordsSectionOpen)} className="text-muted-foreground hover:text-foreground transition-colors">
                                      {keywordsSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </CardHeader>
                                {keywordsSectionOpen && (
                                  <CardContent className="px-0 pb-0">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs pl-4">Keyword</TableHead>
                                          <TableHead className="text-xs text-right">Impr</TableHead>
                                          <TableHead className="text-xs text-right">Clicks</TableHead>
                                          <TableHead className="text-xs text-right">CTR</TableHead>
                                          <TableHead className="text-xs text-right">Conv</TableHead>
                                          <TableHead className="text-xs text-right pr-4">CPA</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {displayedKws.map((kw, i) => {
                                          const cpaCls = kw.cpa > 0 ? (kw.cpa <= clientBm.google.cpa ? 'text-emerald-400' : kw.cpa <= clientBm.google.cpa * 1.5 ? 'text-amber-400' : 'text-red-400') : 'text-muted-foreground';
                                          return (
                                            <TableRow key={`${kw.keyword}-${i}`} className={i % 2 === 1 ? 'bg-muted/20' : ''}>
                                              <TableCell className="py-1.5 text-xs font-medium max-w-[200px] truncate pl-4" title={kw.keyword}>{kw.keyword}</TableCell>
                                              <TableCell className="py-1.5 text-xs text-right font-mono">{fmt(kw.impressions)}</TableCell>
                                              <TableCell className="py-1.5 text-xs text-right font-mono">{fmt(kw.clicks)}</TableCell>
                                              <TableCell className="py-1.5 text-xs text-right font-mono">{fmtPct(kw.ctr)}</TableCell>
                                              <TableCell className="py-1.5 text-xs text-right font-mono">{kw.conversions > 0 ? kw.conversions : '—'}</TableCell>
                                              <TableCell className={`py-1.5 text-xs text-right font-mono font-semibold pr-4 ${cpaCls}`}>{kw.cpa > 0 ? fmtCur(kw.cpa) : '—'}</TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                    {sortedKws.length > 15 && (
                                      <div className="flex justify-center py-3 border-t border-border/30">
                                        <button onClick={() => setShowAllKeywords(!showAllKeywords)} className="text-xs text-primary hover:underline">
                                          {showAllKeywords ? 'Show top 15' : `Show all ${sortedKws.length} keywords`}
                                        </button>
                                      </div>
                                    )}
                                  </CardContent>
                                )}
                              </Card>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : !isLoadingAdData ? (
                    /* F. No Data Empty State */
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                          <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <p className="font-medium text-foreground mb-1">No ad data loaded yet</p>
                        <p className="text-sm text-muted-foreground mb-4">Fetch live data to see ad performance analytics for this client.</p>
                        <Button size="sm" onClick={() => {
                          if (detailClient && selectedClient?.matchedAccounts && Object.keys(selectedClient.matchedAccounts).length > 0) {
                            fetchLiveAdData(detailClient, selectedClient.matchedAccounts);
                          }
                        }} disabled={!selectedClient?.matchedAccounts || Object.keys(selectedClient?.matchedAccounts || {}).length === 0}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Fetch Live Data
                        </Button>
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* Latest AI Summaries — Per Platform */}
                  {(() => {
                    const clientSessions = stratSessions.filter(s => s.client_name === detailClient && s.ai_summary);
                    const latestGoogle = clientSessions.find(s => s.platform === 'google');
                    const latestMeta = clientSessions.find(s => s.platform === 'meta');
                    if (!latestGoogle && !latestMeta) return null;
                    return (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" /> Latest Strategist Summaries
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {latestGoogle && (
                            <div>
                              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 mb-1.5">🔵 Google</Badge>
                              <p className="text-sm text-muted-foreground leading-relaxed">{latestGoogle.ai_summary}</p>
                            </div>
                          )}
                          {latestMeta && (
                            <div>
                              <Badge variant="outline" className="text-[10px] border-blue-400/30 text-blue-300 mb-1.5">🔷 Meta</Badge>
                              <p className="text-sm text-muted-foreground leading-relaxed">{latestMeta.ai_summary}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              </TabsContent>

              {/* ── AI RESULTS TAB ── */}
              <TabsContent value="ai-results">
                <AiResultsTab clientName={selectedClient!.name} />
              </TabsContent>

              {/* ── STRATEGIST TAB ── */}
              <TabsContent value="strategist">
                <div className="space-y-6">
                  {/* Auto Mode Banner */}
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-5 ${stratClientSettings.auto_mode_enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-border'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${stratClientSettings.auto_mode_enabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
                        {stratClientSettings.auto_mode_enabled ? <Zap className="h-5 w-5 text-emerald-400" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">Auto Mode</span>
                        <Badge className={`ml-2 ${stratClientSettings.auto_mode_enabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                          {stratClientSettings.auto_mode_enabled ? 'ON' : 'OFF'}
                        </Badge>
                        {stratClientSettings.auto_mode_enabled && (
                          <p className="text-xs text-muted-foreground mt-0.5">{stratClientSettings.auto_mode_schedule} · {stratClientSettings.auto_mode_platform} · Min: {stratClientSettings.confidence_threshold}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Budget lock active</span>
                    </div>
                  </div>

                  {/* Learning Insights */}
                  {learningInsights.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" /> Learning Insights
                          <Badge variant="outline" className="text-[10px] ml-auto">{learningInsights.length} insight{learningInsights.length !== 1 ? 's' : ''}</Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">What the AI learned from past sessions for this client</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {learningInsights.map((insight, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                            insight.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                            insight.type === 'failure' ? 'bg-red-500/5 border-red-500/20' :
                            'bg-blue-500/5 border-blue-500/20'
                          }`}>
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              insight.type === 'success' ? 'bg-emerald-500/15' :
                              insight.type === 'failure' ? 'bg-red-500/15' :
                              'bg-blue-500/15'
                            }`}>
                              {insight.type === 'success' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> :
                               insight.type === 'failure' ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> :
                               <TrendingUp className="h-3.5 w-3.5 text-blue-400" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground capitalize">{insight.label}</p>
                                {insight.count && (
                                  <Badge variant="outline" className="text-[10px] h-4">{insight.count}×</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Analysis Controls */}
                  <Card>
                    <CardContent className="pt-5 space-y-4">
                      <div className="flex flex-wrap items-end gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Platform</p>
                          <div className="flex gap-2">
                            {[{ value: 'google', label: '🔵 Google' }, { value: 'meta', label: '🔷 Meta' }].map(opt => (
                              <button key={opt.value} onClick={() => setStratPlatform(opt.value)}
                                className={`rounded-lg border py-2 px-3 text-xs font-medium transition-all ${stratPlatform === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-border/80'}`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Date Range</p>
                          <div className="flex gap-1">
                            {[7, 14, 30, 60, 90].map(d => (
                              <button key={d} onClick={() => setStratDatePreset(d)}
                                className={`rounded-md border py-1.5 px-2.5 text-xs transition-all ${stratDatePreset === d ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                                {d}d
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button onClick={handleStratAnalyze} disabled={stratAnalyzing} className="gap-2">
                          {stratAnalyzing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Brain className="h-4 w-4" /> Run Analysis</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Session */}
                  {stratActiveSession ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h2 className="font-semibold text-foreground">{stratActiveSession.client_name} — {stratActiveSession.platform === 'google' ? 'Google Ads' : 'Meta Ads'}</h2>
                          <p className="text-xs text-muted-foreground">{new Date(stratActiveSession.date_range_start).toLocaleDateString()} – {new Date(stratActiveSession.date_range_end).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {stratApprovedCount > 0 && (
                            <Button onClick={handleStratExecute} disabled={stratExecuting} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                              {stratExecuting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Execute {stratApprovedCount}
                            </Button>
                          )}
                          {stratHasExecuted && (
                            <Button variant="outline" onClick={handleStratAssess} disabled={stratAssessing} className="gap-2">
                              {stratAssessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} Assess
                            </Button>
                          )}
                        </div>
                      </div>
                      <AnalysisSession session={stratActiveSession} />
                      {stratChanges.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-foreground">Proposed Changes ({stratChanges.length})</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {stratChanges.filter(c => c.approval_status === 'approved').length} approved · {stratChanges.filter(c => c.approval_status === 'rejected').length} rejected · {stratPendingCount} pending
                              </span>
                              {stratPendingCount > 0 && (
                                <Button size="sm" variant="outline" onClick={handleStratApproveAll} className="text-xs h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                                  <CheckCircle className="h-3 w-3 mr-1" /> Approve All
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {stratChanges.sort((a, b) => {
                              const p = { high: 0, medium: 1, low: 2 };
                              return (p[a.priority as keyof typeof p] || 1) - (p[b.priority as keyof typeof p] || 1);
                            }).map(change => (
                              <ChangeCard key={change.id} change={change} onApprove={handleStratApprove} onReject={handleStratReject} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <Brain className="h-14 w-14 mx-auto mb-4 opacity-20" />
                      <p className="font-medium text-lg">Ready to Optimize</p>
                      <p className="text-sm mt-2">Select platform & date range, then click <strong>Run Analysis</strong>.</p>
                    </div>
                  )}

                  {/* Session History & Performance */}
                  <Tabs defaultValue="history">
                    <TabsList>
                      <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> History</TabsTrigger>
                      <TabsTrigger value="performance" className="gap-2"><BarChart3 className="h-4 w-4" /> Performance</TabsTrigger>
                    </TabsList>
                    <TabsContent value="history">
                      <SessionHistory sessions={stratSessions} onSelectSession={(id) => {
                        const s = stratSessions.find(s => s.id === id);
                        if (s) setStratActiveSession(s);
                      }} selectedId={stratActiveSession?.id} />
                    </TabsContent>
                    <TabsContent value="performance">
                      <PerformanceDashboard sessions={stratSessions} changes={stratAllChanges} results={stratResults} />
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              {/* ── AD REVIEW TAB ── */}
              <TabsContent value="adreview">
                <div className="space-y-6">
                  {detailAdReview ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold">Review — {new Date(detailAdReview.review_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{new Date(detailAdReview.date_range_start).toLocaleDateString()} – {new Date(detailAdReview.date_range_end).toLocaleDateString()}</p>
                          </div>
                          {detailDaysSinceAdReview != null && (
                            <Badge variant="outline" className={`text-[10px] ${detailDaysSinceAdReview > 14 ? 'border-red-500/30 text-red-400' : detailDaysSinceAdReview > 7 ? 'border-amber-500/30 text-amber-400' : 'border-emerald-500/30 text-emerald-400'}`}>
                              {detailDaysSinceAdReview}d ago
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {detailAdReview.summary && <p className="text-sm text-muted-foreground leading-relaxed">{detailAdReview.summary}</p>}
                        {Array.isArray(detailAdReview.insights) && detailAdReview.insights.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Insights</p>
                            <div className="space-y-2">
                              {(detailAdReview.insights as any[]).slice(0, 5).map((ins, i) => {
                                if (typeof ins === 'string') {
                                  return (
                                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                                      <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                      <span>{ins}</span>
                                    </div>
                                  );
                                }
                                const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
                                  positive: { icon: <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-emerald-500' },
                                  warning: { icon: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-amber-500' },
                                  action: { icon: <Zap className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-red-500' },
                                  opportunity: { icon: <Target className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-blue-500' },
                                };
                                const style = iconMap[ins.type] || iconMap.opportunity;
                                const impactColors: Record<string, string> = { high: 'bg-red-500/10 text-red-500', medium: 'bg-amber-500/10 text-amber-500', low: 'bg-muted text-muted-foreground' };
                                return (
                                  <div key={i} className="rounded-lg border bg-muted/30 p-3">
                                    <div className="flex items-start gap-2">
                                      <span className={style.color}>{style.icon}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-semibold">{ins.title}</p>
                                          {ins.impact && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${impactColors[ins.impact] || impactColors.low}`}>{ins.impact.charAt(0).toUpperCase() + ins.impact.slice(1)}</span>}
                                        </div>
                                        {ins.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.description}</p>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-muted-foreground">
                      <BarChart3 className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">No ad reviews yet</p>
                        <p className="text-xs">Run an ad review to see insights here</p>
                      </div>
                    </div>
                  )}

                  <Button variant="outline" onClick={() => navigate(`/ad-review?client=${encodeURIComponent(detailClient)}`)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Full Ad Review
                  </Button>

                  {/* Ad Review History */}
                  {detailAdReviewHistory.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Review History</h3>
                      <div className="space-y-3">
                        {detailAdReviewHistory.map((review, i) => {
                          const isExpanded = expandedReviewId === review.id;
                          return (
                            <div key={review.id} className={`rounded-lg border ${i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                              <button
                                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg"
                                onClick={() => setExpandedReviewId(isExpanded ? null : review.id)}
                              >
                                <div className="text-left">
                                  <p className="text-sm font-medium">{new Date(review.review_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(review.date_range_start).toLocaleDateString()} – {new Date(review.date_range_end).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {i === 0 && <Badge className="text-[10px]">Latest</Badge>}
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 border-t pt-3">
                                  {/* Summary */}
                                  {review.summary && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.summary}</p>
                                    </div>
                                  )}

                                  {/* Platform Metrics */}
                                  {Array.isArray(review.platforms) && review.platforms.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Platform Performance</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(review.platforms as any[]).map((p: any, pi: number) => (
                                          <div key={pi} className="p-3 bg-background rounded-lg border">
                                            <p className="text-sm font-medium mb-1">{p.name || p.platform}</p>
                                            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                              {p.spend && <span>Spend: {p.spend}</span>}
                                              {p.impressions && <span>Imp: {p.impressions}</span>}
                                              {p.clicks && <span>Clicks: {p.clicks}</span>}
                                              {p.conversions && <span>Conv: {p.conversions}</span>}
                                              {p.ctr && <span>CTR: {p.ctr}</span>}
                                              {p.cpc && <span>CPC: {p.cpc}</span>}
                                              {p.cpa && <span>CPA: {p.cpa}</span>}
                                              {p.roas && <span>ROAS: {p.roas}</span>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                   {/* Insights */}
                                   {Array.isArray(review.insights) && review.insights.length > 0 && (
                                     <div>
                                       <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Insights</p>
                                       <div className="space-y-2">
                                         {(review.insights as any[]).map((ins: any, ii: number) => {
                                           if (typeof ins === 'string') {
                                             return (
                                               <div key={ii} className="flex items-start gap-2 text-sm">
                                                 <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                                 <span>{ins}</span>
                                               </div>
                                             );
                                           }
                                           const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
                                             positive: { icon: <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-emerald-500' },
                                             warning: { icon: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-amber-500' },
                                             action: { icon: <Zap className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-red-500' },
                                             opportunity: { icon: <Target className="h-4 w-4 shrink-0 mt-0.5" />, color: 'text-blue-500' },
                                           };
                                           const style = iconMap[ins.type] || iconMap.opportunity;
                                           const impactColors: Record<string, string> = { high: 'bg-red-500/10 text-red-500', medium: 'bg-amber-500/10 text-amber-500', low: 'bg-muted text-muted-foreground' };
                                           return (
                                             <div key={ii} className="rounded-lg border bg-muted/30 p-3">
                                               <div className="flex items-start gap-2">
                                                 <span className={style.color}>{style.icon}</span>
                                                 <div className="flex-1 min-w-0">
                                                   <div className="flex items-center gap-2 flex-wrap">
                                                     <p className="text-sm font-semibold">{ins.title || ins.text || ins.insight}</p>
                                                     {ins.impact && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${impactColors[ins.impact] || impactColors.low}`}>{ins.impact.charAt(0).toUpperCase() + ins.impact.slice(1)}</span>}
                                                   </div>
                                                   {ins.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.description}</p>}
                                                 </div>
                                               </div>
                                             </div>
                                           );
                                         })}
                                       </div>
                                     </div>
                                   )}

                                  {/* Recommendations */}
                                  {Array.isArray(review.recommendations) && review.recommendations.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recommendations</p>
                                      <ul className="space-y-1.5">
                                        {(review.recommendations as any[]).map((rec: any, ri: number) => (
                                          <li key={ri} className="flex items-start gap-2 text-sm">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                            <span>{typeof rec === 'string' ? rec : rec.text || rec.recommendation || JSON.stringify(rec)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Action Items */}
                                  {Array.isArray(review.action_items) && review.action_items.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Action Items</p>
                                      <ul className="space-y-1.5">
                                        {(review.action_items as any[]).map((item: any, ai: number) => (
                                          <li key={ai} className="flex items-start gap-2 text-sm">
                                            <span className="text-xs font-bold text-primary shrink-0 mt-0.5">{ai + 1}.</span>
                                            <span>{typeof item === 'string' ? item : item.text || item.action || JSON.stringify(item)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Week over Week */}
                                  {Array.isArray(review.week_over_week) && review.week_over_week.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Week-over-Week Changes</p>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {(review.week_over_week as any[]).map((wow: any, wi: number) => (
                                          <div key={wi} className="p-2 bg-background rounded border text-xs">
                                            <p className="font-medium">{wow.metric || wow.name}</p>
                                            <p className={`${wow.direction === 'up' || (wow.change && String(wow.change).startsWith('+')) ? 'text-emerald-400' : wow.direction === 'down' || (wow.change && String(wow.change).startsWith('-')) ? 'text-red-400' : 'text-muted-foreground'}`}>
                                              {wow.change || wow.value || '—'}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Benchmark Comparison */}
                                  {review.benchmark_comparison && typeof review.benchmark_comparison === 'object' && Object.keys(review.benchmark_comparison as object).length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Benchmark Comparison</p>
                                      <div className="p-3 bg-background rounded border text-sm">
                                        {typeof (review.benchmark_comparison as any).summary === 'string' 
                                          ? <p>{(review.benchmark_comparison as any).summary}</p>
                                          : <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{JSON.stringify(review.benchmark_comparison, null, 2)}</pre>
                                        }
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {review.notes && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                                      <p className="text-sm text-muted-foreground">{review.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── SETTINGS TAB ── */}
              <TabsContent value="settings">
                <div className="space-y-6 max-w-2xl">

                  {/* ── Ad Platform Accounts ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Link className="h-4 w-4" /> Ad Platform Accounts
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Link this client's ad accounts so the AI agent and reports can pull data automatically.</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Show currently linked accounts */}
                      {(() => {
                        const clientMappings = manualMappings[detailClient] || {};
                        const platformLabels: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', tiktok_ads: 'TikTok Ads', bing_ads: 'Microsoft Ads', linkedin_ads: 'LinkedIn Ads' };
                        const platformColors: Record<string, string> = { google_ads: 'bg-blue-500/15 text-blue-400', meta_ads: 'bg-indigo-500/15 text-indigo-400', tiktok_ads: 'bg-pink-500/15 text-pink-400', bing_ads: 'bg-teal-500/15 text-teal-400', linkedin_ads: 'bg-sky-500/15 text-sky-400' };
                        const entries = Object.entries(clientMappings);
                        if (entries.length === 0) {
                          return <p className="text-sm text-muted-foreground italic py-2">No accounts linked yet. Click below to connect ad platforms.</p>;
                        }
                        return (
                          <div className="space-y-2">
                            {entries.map(([platform, accountIds]) => (
                              <div key={platform} className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-xs ${platformColors[platform] || 'bg-muted text-muted-foreground'}`}>
                                  {platformLabels[platform] || platform}
                                </Badge>
                                <span className="text-sm text-foreground">
                                  {accountIds.map(id => {
                                    const dsKey = platform === 'google_ads' ? 'AW' : platform === 'meta_ads' ? 'FA' : platform;
                                    const name = smAccounts[dsKey]?.find(a => a.id === id)?.name;
                                    return name || id;
                                  }).join(', ')}
                                </span>
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 ml-auto flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 w-full"
                        onClick={() => setMappingClient(detailClient)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        {(manualMappings[detailClient] && Object.keys(manualMappings[detailClient]).length > 0) ? 'Manage Linked Accounts' : 'Link Ad Accounts'}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* ── Conversion Focus ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" /> Conversion Focus
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Select the conversion types this client cares about, then pick the primary goal. The AI agent, health scores, and all reporting will prioritize these.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Tracked types grid */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Track these conversion types</p>
                        <div className="grid grid-cols-2 gap-2">
                          {CONVERSION_TYPE_CONFIG.map(ct => {
                            const tracked = clientTrackedTypes[detailClient] || ['leads', 'purchases', 'calls'];
                            const isActive = tracked.includes(ct.key);
                            const isPrimary = (clientConversionGoals[detailClient] || 'all') === ct.key;
                            return (
                              <button
                                key={ct.key}
                                onClick={() => {
                                  const current = clientTrackedTypes[detailClient] || ['leads', 'purchases', 'calls'];
                                  const updated = isActive ? current.filter(t => t !== ct.key) : [...current, ct.key];
                                  if (updated.length === 0) { toast({ title: 'Must track at least one type', variant: 'destructive' }); return; }
                                  updateTrackedTypes(detailClient, updated);
                                  // If untracking the primary goal, reset to 'all'
                                  if (!updated.includes(clientConversionGoals[detailClient] || '')) {
                                    updateConversionGoal(detailClient, 'all');
                                  }
                                }}
                                className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                                  isActive
                                    ? isPrimary
                                      ? 'bg-primary/10 border-primary ring-1 ring-primary/30'
                                      : 'bg-primary/5 border-primary/50'
                                    : 'bg-muted/50 border-border text-muted-foreground hover:border-border/80'
                                }`}
                              >
                                <span className="text-base mt-0.5">{ct.icon}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{ct.label}</span>
                                    {isPrimary && <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">Primary</Badge>}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{ct.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Primary goal selector — only shows tracked types */}
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Primary goal (the #1 metric)</p>
                        <p className="text-xs text-muted-foreground mb-2">This controls which metric is highlighted in KPIs, fleet table, and what the AI agent optimizes toward.</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => { updateConversionGoal(detailClient, 'all'); toast({ title: 'Primary goal: All Conversions' }); }}
                            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${(clientConversionGoals[detailClient] || 'all') === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}
                          >
                            All Conversions
                          </button>
                          {CONVERSION_TYPE_CONFIG
                            .filter(ct => (clientTrackedTypes[detailClient] || ['leads', 'purchases', 'calls']).includes(ct.key))
                            .map(ct => (
                              <button
                                key={ct.key}
                                onClick={() => { updateConversionGoal(detailClient, ct.key); toast({ title: `Primary goal: ${ct.label}` }); }}
                                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all flex items-center gap-1 ${(clientConversionGoals[detailClient] || 'all') === ct.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}
                              >
                                <span>{ct.icon}</span> {ct.label}
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Industry & Tier ── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Industry & Tier
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Industry</p>
                        <Select value={clientIndustries[detailClient] || 'General / All Industries'} onValueChange={(val) => { updateClientIndustry(detailClient, val); toast({ title: `Industry set to "${val}"` }); }}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {[...INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK].map(b => <SelectItem key={b.industry} value={b.industry} className="text-sm">{b.industry}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Service Tier</p>
                        <div className="flex gap-2">
                          {(['premium', 'advanced', 'basic'] as const).map(t => (
                            <button key={t} onClick={() => { updateClientTier(detailClient, t); toast({ title: `Tier set to ${t}` }); }}
                              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${(clientTiers[detailClient] || 'basic') === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Multi-Account Display</p>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={!!clientMultiAccount[detailClient]}
                            onCheckedChange={async (checked) => {
                              setClientMultiAccount(prev => ({ ...prev, [detailClient]: checked }));
                              try {
                                const { data: existing } = await supabase.from('managed_clients').select('id').eq('client_name', detailClient).maybeSingle();
                                if (existing) {
                                  await supabase.from('managed_clients').update({ multi_account_enabled: checked } as any).eq('id', existing.id);
                                }
                                toast({ title: checked ? 'Multi-account display enabled' : 'Multi-account display disabled' });
                              } catch (err) { console.error('Failed to update multi-account:', err); }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">{clientMultiAccount[detailClient] ? 'Show sub-rows per account in fleet table' : 'Disabled — single row per client'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Auto Mode Settings */}
                  <AutoModeSettingsPanel clientName={detailClient} settings={stratClientSettings} onSettingsChange={setStratClientSettings} onSave={loadAutoModeStatus} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
        <>
        {/* ═══════════════ FLEET VIEW ═══════════════ */}
        {/* ===== HEADER ROW ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Command Center</h1>
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setFleetView('clients')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${fleetView === 'clients' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Users className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Clients
                </button>
                <button
                  onClick={() => setFleetView('audit')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${fleetView === 'audit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <ClipboardList className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Audit Log
                </button>
                <button
                  onClick={() => setFleetView('history')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${fleetView === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <History className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Fleet History
                </button>
                <button
                  onClick={() => setFleetView('crons')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${fleetView === 'crons' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Timer className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Cron Jobs
                </button>
                <button
                  onClick={() => navigate('/daily-reports')}
                  className="px-3 py-1 text-xs font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
                >
                  <BarChart3 className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Daily Reports
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {stats.total} clients · {stats.critical} need attention
              </p>
              {(() => {
                const allAutoTimes = Object.values(lastAutoReviewByClient).map(r => new Date(r.created_at).getTime());
                if (allAutoTimes.length === 0) return null;
                const lastCron = new Date(Math.max(...allAutoTimes));
                const now = new Date();
                const diffH = Math.round((now.getTime() - lastCron.getTime()) / 3600000);
                const isRecent = diffH < 4;
                const timeStr = diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.round(diffH / 24)}d ago`;
                return (
                  <Badge variant="outline" className={`text-[10px] gap-1 ${isRecent ? 'border-green-500/40 text-green-600' : 'border-yellow-500/40 text-yellow-600'}`}>
                    <Zap className="h-3 w-3" /> Cron: {timeStr}
                  </Badge>
                );
              })()}
              {lastSnapshotTime && (() => {
                const snap = new Date(lastSnapshotTime);
                const diffH = Math.round((new Date().getTime() - snap.getTime()) / 3600000);
                const isRecent = diffH < 4;
                const t = diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.round(diffH / 24)}d ago`;
                return (
                  <Badge variant="outline" className={`text-[10px] gap-1 ${isRecent ? 'border-emerald-500/40 text-emerald-600' : 'border-amber-500/40 text-amber-600'}`}>
                    <BarChart3 className="h-3 w-3" /> PPC Snapshot: {t}
                  </Badge>
                );
              })()}
              {fleetCoverage && (() => {
                const { success, partial, error, total, completedAt, runStatus } = fleetCoverage;
                if (runStatus === 'processing') {
                  return (
                    <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer border-blue-500/40 text-blue-500 animate-pulse" onClick={() => setFleetView('history')}>
                      <Shield className="h-3 w-3" />
                      Fleet: Running ({total} clients)
                    </Badge>
                  );
                }
                const fullyCovered = success;
                const allGood = partial === 0 && error === 0 && (runStatus === 'complete' || runStatus === 'completed');
                const timeStr = completedAt ? (() => {
                  const diffH = Math.round((Date.now() - new Date(completedAt).getTime()) / 3600000);
                  return diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : `${Math.round(diffH / 24)}d ago`;
                })() : '';
                const statusColor = runStatus === 'failed' ? 'border-red-500/40 text-red-500' : allGood ? 'border-green-500/40 text-green-600' : 'border-orange-500/40 text-orange-600';
                return (
                  <Badge
                    variant="outline"
                    className={`text-[10px] gap-1 cursor-pointer ${statusColor}`}
                    onClick={() => setFleetView('history')}
                  >
                    <Shield className="h-3 w-3" />
                    Fleet: {fullyCovered}/{total} covered
                    {partial > 0 && ` · ${partial} partial`}
                    {error > 0 && ` · ${error} failed`}
                    {runStatus === 'failed' && partial === 0 && error === 0 && ' · run failed'}
                    {timeStr && ` · ${timeStr}`}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isLoadingSmAccounts && (
              <Badge variant="outline" className="text-xs animate-pulse gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing
              </Badge>
            )}
            {isLoadingTrends && !isLoadingSmAccounts && (
              <Badge variant="outline" className="text-xs animate-pulse gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading
              </Badge>
            )}
            {isLoadingSeo && seoFetchProgress && (
              <Badge variant="outline" className="text-xs animate-pulse gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> SEO {seoFetchProgress.current}/{seoFetchProgress.total}
              </Badge>
            )}
            <Button variant="default" size="sm" onClick={() => setShowAddClient(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Client
            </Button>
          </div>
        </div>

        {fleetView === 'audit' ? (
          <AutoModeAuditLog clients={clients.map(c => c.name)} />
        ) : fleetView === 'history' ? (
          <FleetRunHistory />
        ) : fleetView === 'crons' ? (
          <CronJobsPanel />
        ) : (
        <>
        {/* ===== TABS + TOOLBAR ROW ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border mb-4 gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('ppc')}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'ppc' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Megaphone className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              PPC
            </button>
            <button
              onClick={() => setActiveTab('seo')}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'seo' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Search className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              SEO
            </button>
          </div>

          {activeTab === 'ppc' && (
            <div className="flex items-center gap-2 pb-2 flex-wrap overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
              {/* Date Range */}
              <div className="flex items-center gap-1 mr-2 shrink-0">
                {[7, 14, 30, 60, 90].map(d => (
                  <Button
                    key={d}
                    variant={dateRangeDays === d && !customDateFrom ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => applyPresetDays(d)}
                  >
                    {d}d
                  </Button>
                ))}
                <Popover open={showCustomDate} onOpenChange={setShowCustomDate}>
                  <PopoverTrigger asChild>
                    <Button variant={customDateFrom ? 'default' : 'ghost'} size="sm" className="text-xs h-7 gap-1">
                      <CalendarDays className="h-3 w-3" />
                      <span className="hidden sm:inline">{customDateFrom ? dateLabel : 'Custom'}</span>
                      <span className="sm:hidden">📅</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Button variant={datePickerField === 'from' ? 'default' : 'outline'} size="sm" className="text-xs flex-1" onClick={() => setDatePickerField('from')}>
                          From: {customDateFrom ? format(customDateFrom, 'MMM d, yyyy') : '—'}
                        </Button>
                        <Button variant={datePickerField === 'to' ? 'default' : 'outline'} size="sm" className="text-xs flex-1" onClick={() => setDatePickerField('to')}>
                          To: {customDateTo ? format(customDateTo, 'MMM d, yyyy') : '—'}
                        </Button>
                      </div>
                      <Calendar
                        mode="single"
                        selected={datePickerField === 'from' ? customDateFrom : customDateTo}
                        onSelect={(day) => {
                          if (datePickerField === 'from') {
                            setCustomDateFrom(day);
                            setDatePickerField('to');
                          } else {
                            setCustomDateTo(day);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                      <Button size="sm" className="w-full" disabled={!customDateFrom || !customDateTo} onClick={applyCustomRange}>
                        Apply Range
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active date range display */}
              <span className="text-xs text-muted-foreground hidden sm:inline shrink-0 px-1">
                {safeFormatDate(dateStart, 'MMM d')} – {safeFormatDate(dateEnd, 'MMM d, yyyy')}
              </span>

              <div className="h-5 w-px bg-border hidden sm:block" />

              <Button variant="default" size="sm" onClick={handleFetchData} disabled={isLoadingTrends || isRunningAdReviews} className="shrink-0">
                {isLoadingTrends ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 sm:mr-1" />}
                <span className="hidden sm:inline">Fetch PPC</span>
              </Button>
              {cacheTimestamp && !isLoadingTrends && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline" title={new Date(cacheTimestamp).toLocaleString()}>
                  {(() => {
                    const diff = Math.round((Date.now() - new Date(cacheTimestamp).getTime()) / 60000);
                    if (diff < 1) return 'Just now';
                    if (diff < 60) return `${diff}m ago`;
                    if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
                    return `${Math.round(diff / 1440)}d ago`;
                  })()}
                </span>
              )}
              <div className="h-5 w-px bg-border hidden sm:block" />
              <Button
                variant="outline"
                size="sm"
                onClick={runAdReviewForAllClients}
                disabled={isRunningAdReviews || isLoadingTrends}
                className="gap-1.5 shrink-0"
                title="Run AI ad review for all clients with linked accounts using live Supermetrics data"
              >
                {isRunningAdReviews
                  ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">{adReviewProgress ? `${adReviewProgress.current}/${adReviewProgress.total}` : 'Running...'}</span></>
                  : <><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Ad Reviews</span></>
                }
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={runFullFleet}
                disabled={!!fleetJobId || isRunningAdReviews || isLoadingTrends}
                className="gap-1.5 shrink-0"
                title="Run full fleet: strategist + ad review + AI memory for every client sequentially"
              >
                {fleetProgress && fleetProgress.status !== 'complete' && fleetProgress.status !== 'completed'
                  ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">{fleetProgress.progress}/{fleetProgress.total}</span></>
                  : <><Rocket className="h-4 w-4" /><span className="hidden sm:inline">Full Fleet</span></>
                }
              </Button>
              <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={() => { setIsRefreshing(true); Promise.all([loadClients(), loadSmAccounts(), loadManagedClients()]).finally(() => setIsRefreshing(false)); }} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hidden sm:flex" onClick={() => setShowSmDebug(true)} title="SM Status">
                <Activity className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hidden sm:flex" asChild title="Manage Clients">
                <a href="/client-settings">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* ===== Fleet Run Progress Bar ===== */}
        {fleetProgress && fleetProgress.status !== 'complete' && fleetProgress.status !== 'completed' && (
          <div className="mx-4 mb-3 p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Rocket className="h-4 w-4 text-primary" />
                <span>Fleet Run: Processing {fleetProgress.progress} of {fleetProgress.total}</span>
              </div>
              {fleetProgress.currentClient && (
                <span className="text-xs text-muted-foreground">{fleetProgress.currentClient}</span>
              )}
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${fleetProgress.total > 0 ? (fleetProgress.progress / fleetProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ===== Fleet Run Results Summary ===== */}
        {fleetResults && fleetResults.length > 0 && !fleetJobId && (
          <div className="mx-4 mb-3 p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Fleet Run Results</span>
              <Button variant="ghost" size="sm" onClick={() => setFleetResults(null)} className="h-6 px-2 text-xs">Dismiss</Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {fleetResults.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={r.status === 'success' ? 'text-green-500' : r.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                    {r.status === 'success' ? '✅' : r.status === 'error' ? '❌' : '⏭️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{r.client}</span>
                    {r.status !== 'success' && <span className="text-muted-foreground ml-1">— {r.message}</span>}
                    {r.strategistErrors?.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {r.strategistErrors.map((err: string, j: number) => (
                          <div key={j} className="text-amber-500 text-[11px] truncate" title={err}>⚠ Strategist: {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Latest Fleet Report Card ===== */}
        {fleetCoverage && fleetCoverage.runStatus !== 'processing' && (
          <LatestFleetReportCard />
        )}

        {activeTab === 'seo' && (
          <div className="flex items-center justify-center py-20">
            <a
              href="https://www.semrush.com/siteaudit/#sorting/errors_desc/page/1/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-12 py-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <ExternalLink className="h-7 w-7" />
              GO TO SEO TABLE
            </a>
          </div>
        )}

        {/* ===== SEARCH + SORT BAR ===== */}
        {activeTab !== 'seo' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-5">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card/60 backdrop-blur-sm border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-muted-foreground/40"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSortBy(sortBy === 'health' ? 'name' : 'health')} className="rounded-lg">
            <ArrowUpDown className="h-4 w-4 mr-1" />
            {sortBy === 'health' ? 'By Health' : 'A–Z'}
          </Button>
        </div>
        )}

        {/* ===== TIERED CLIENT SECTIONS ===== */}
        {activeTab !== 'seo' && (isLoadingClients ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {TIER_CONFIG.map(tier => {
              const tierClients = tieredClients[tier.key] || [];
              const isCollapsed = collapsedTiers[tier.key] ?? false;
              const TierIcon = tier.icon;

              return (
                <div
                  key={tier.key}
                  className={`rounded-xl border backdrop-blur-sm ${dragOverTier === tier.key ? 'border-primary border-2 shadow-lg shadow-primary/10' : tier.borderColor} overflow-hidden bg-card/50 transition-all duration-300`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverTier(tier.key); }}
                  onDragLeave={() => setDragOverTier(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTier(null);
                    if (draggedClient) {
                      updateClientTier(draggedClient, tier.key);
                      toast({ title: `Moved to ${tier.label}` });
                    }
                    setDraggedClient(null);
                  }}
                >
                  {/* Tier Header */}
                  <button
                    onClick={() => setCollapsedTiers(prev => ({ ...prev, [tier.key]: !isCollapsed }))}
                    className={`w-full flex items-center justify-between px-5 py-3 ${tier.bgColor} hover:opacity-90 transition-all duration-200`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tier.accentColor}, transparent)` }}>
                        <TierIcon className={`h-3.5 w-3.5 ${tier.color}`} />
                      </div>
                      <span className={`font-semibold text-sm tracking-wide ${tier.color}`}>{tier.label}</span>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{tierClients.length}</span>
                    </div>
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {/* Tier Content */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      {tierClients.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {searchQuery ? 'No matching clients' : 'Drag clients here or add new ones'}
                        </div>
                      ) : (
                        <Table className="min-w-[800px]">
                          {activeTab === 'ppc' && (() => {
                            const PLATFORM_CONFIG: { key: string; label: string }[] = [
                              { key: 'google', label: 'Google' },
                              { key: 'meta', label: 'Meta' },
                              { key: 'bing', label: 'Bing' },
                              { key: 'tiktok', label: 'TikTok' },
                              { key: 'linkedin', label: 'LinkedIn' },
                            ];
                            const platformsToShow = PLATFORM_CONFIG;

                            return (
                              <>
                                <TableHeader>
                                  <TableRow className="border-b border-border/50 hover:bg-transparent">
                                    <TableHead rowSpan={2} className="w-[36px] border-b border-border/50 sticky left-0 z-20 bg-card/80 backdrop-blur-sm"></TableHead>
                                    <TableHead rowSpan={2} className="border-b border-border/50 sticky left-[36px] z-20 bg-card/80 backdrop-blur-sm after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/30 text-xs font-semibold text-foreground/70 uppercase tracking-wider px-2 select-none" style={{ width: clientColWidth, minWidth: 60, maxWidth: clientColWidth }}>
                                      <div className="flex items-center justify-between">
                                        <span>Client</span>
                                        <div
                                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-30 group/resize flex items-center justify-center"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            clientColResizing.current = true;
                                            const startX = e.clientX;
                                            const startW = clientColWidth;
                                            const onMove = (ev: MouseEvent) => {
                                              if (!clientColResizing.current) return;
                                              const newW = Math.max(60, Math.min(400, startW + ev.clientX - startX));
                                              setClientColWidth(newW);
                                            };
                                            const onUp = () => { clientColResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                                            window.addEventListener('mousemove', onMove);
                                            window.addEventListener('mouseup', onUp);
                                          }}
                                          onTouchStart={(e) => {
                                            e.stopPropagation();
                                            clientColResizing.current = true;
                                            const startX = e.touches[0].clientX;
                                            const startW = clientColWidth;
                                            const onMove = (ev: TouchEvent) => {
                                              if (!clientColResizing.current) return;
                                              const newW = Math.max(60, Math.min(400, startW + ev.touches[0].clientX - startX));
                                              setClientColWidth(newW);
                                            };
                                            const onUp = () => { clientColResizing.current = false; window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
                                            window.addEventListener('touchmove', onMove);
                                            window.addEventListener('touchend', onUp);
                                          }}
                                        >
                                          <div className="w-px h-4 bg-border group-hover/resize:bg-primary/60 transition-colors rounded-full" />
                                        </div>
                                      </div>
                                    </TableHead>
                                    <TableHead rowSpan={2} className="text-center border-b border-border/50 border-l border-border/30 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/80" style={{ width: 80, minWidth: 60 }}>Score</TableHead>
                                    <TableHead rowSpan={2} className="text-center border-b border-border/50 border-l border-border/30 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/80" style={{ width: 65, minWidth: 50 }}>Review</TableHead>
                                    <TableHead rowSpan={2} className="text-center border-b border-border/50 border-l border-border/30 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/80" style={{ width: 55, minWidth: 40 }}>AI</TableHead>
                                    {platformsToShow.map((p) => (
                                      <TableHead key={p.key} colSpan={7} className="text-center border-b-0 border-l border-border/30 text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground/80" style={{ minWidth: 240 }}>
                                        {p.label}
                                      </TableHead>
                                    ))}
                                  </TableRow>
                                  <TableRow className="border-b border-border/30 hover:bg-transparent">
                                    {platformsToShow.map(p => (
                                      <Fragment key={p.key}>
                                        <TableHead className="text-center text-xs font-medium text-muted-foreground/60 border-l border-border/30 min-w-[40px]">Spend</TableHead>
                                        <TableHead className="text-center text-xs font-medium text-muted-foreground/60 min-w-[30px] bg-primary/5 font-bold">Conv</TableHead>
                                        <TableHead className="text-center text-xs font-medium text-muted-foreground/60 min-w-[30px]">Leads</TableHead>
                                        <TableHead className="text-center text-xs font-medium text-muted-foreground/60 min-w-[30px]">Purch</TableHead>
                                        <TableHead className="text-center text-xs font-medium text-muted-foreground/60 min-w-[30px]">Calls</TableHead>

                                        <TableHead className="text-center text-xs font-medium text-muted-foreground/60 min-w-[35px]">CPA</TableHead>
                                      </Fragment>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tierClients.map((client) => {
                                    // Fall back to snapshot data when live trends haven't been fetched
                                    const liveTrend = clientTrends[client.name];
                                    const snapFallback = snapshotTrends[client.name];
                                    const snapCurrent = snapFallback
                                      ? Object.fromEntries(Object.entries(snapFallback).map(([p, s]) => [p, s.current])) as Record<string, PlatformTrend>
                                      : undefined;
                                    // Merge: if live trend has conv=0 but snapshot has real conv, use snapshot conv
                                    const trend: Record<string, PlatformTrend> | undefined = liveTrend
                                      ? Object.fromEntries(Object.entries(liveTrend).map(([p, lt]) => {
                                          const sc = snapCurrent?.[p];
                                          if (lt.conv === 0 && sc && sc.conv > 0) {
                                            return [p, { ...lt, conv: sc.conv, leads: lt.leads || sc.leads, purchases: lt.purchases || sc.purchases, calls: lt.calls || sc.calls, costPerConv: sc.conv > 0 ? lt.spend / sc.conv : 0 }];
                                          }
                                          return [p, lt];
                                        }))
                                      : snapCurrent;
                                    const fmtD = (n: number) => `$${n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0)}`;
                                    const loading = isLoadingTrends && !trend && client.hasAdAccounts;
                                    const dash = <span className="text-xs text-muted-foreground/50">—</span>;
                                    const dots = <span className="text-[10px] text-muted-foreground animate-pulse">…</span>;

                                    return (
                                      <Fragment key={client.name}>
                                      <TableRow
                                        draggable
                                        onDragStart={() => setDraggedClient(client.name)}
                                        onDragEnd={() => { setDraggedClient(null); setDragOverTier(null); }}
                                        className={`h-[42px] cursor-pointer transition-all duration-200 group ${selectedClient?.name === client.name ? 'bg-primary/8 border-l-2 border-l-primary shadow-[inset_0_0_20px_hsl(var(--primary)/0.05)]' : 'hover:bg-muted/20'} ${draggedClient === client.name ? 'opacity-40 scale-[0.98]' : ''}`}
                                        onClick={() => handleSelectClient(client)}
                                      >
                                        <TableCell className={`w-[36px] px-2 py-0 sticky left-0 z-10 ${selectedClient?.name === client.name ? 'bg-primary/8' : 'bg-card/80'} group-hover:bg-muted/20 backdrop-blur-sm`}>
                                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 cursor-grab active:cursor-grabbing transition-colors" />
                                        </TableCell>
                                        <TableCell className={`py-0 px-2 overflow-hidden sticky left-[36px] z-10 ${selectedClient?.name === client.name ? 'bg-primary/8' : 'bg-card/80'} group-hover:bg-muted/20 backdrop-blur-sm after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/30`} style={{ width: clientColWidth, minWidth: 60, maxWidth: clientColWidth }}>
                                          {(() => {
                                            const hasMappings = manualMappings[client.name] && Object.keys(manualMappings[client.name]).length > 0;
                                            const review = lastAdReviewByClient[client.name];
                                            const hasAdIssues = review?.hasIssues;
                                            const noAccounts = !hasMappings;
                                            const hasTrendData = !!clientTrends[client.name] || !!snapshotTrends[client.name];
                                            const connectionIssue = hasMappings && !loading && !hasTrendData && !isLoadingClients;
                                            const hasBlocker = noAccounts || connectionIssue;
                                            return (
                                              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                                <span className="font-medium text-sm text-foreground/90 truncate min-w-0 flex-1 group-hover:text-foreground transition-colors" title={client.name}>{client.name}</span>
                                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                                  {hasMappings && (
                                                    <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-emerald-500/15 border border-emerald-500/20" title="Mapped">
                                                      <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                                                    </span>
                                                  )}
                                                  {autoModeEnabledClients.has(client.name) && (
                                                    <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-primary/15 border border-primary/20 animate-pulse" title="Auto Mode">
                                                      <Zap className="h-2.5 w-2.5 text-primary" />
                                                    </span>
                                                  )}
                                                  {memoryCountByClient[client.name] > 0 && (
                                                    <span className="inline-flex items-center justify-center h-4 rounded bg-violet-500/10 border border-violet-500/20 px-1 gap-0.5" title={`${memoryCountByClient[client.name]} AI memories`}>
                                                      <Brain className="h-2.5 w-2.5 text-violet-400" />
                                                      <span className="text-[8px] font-bold text-violet-400">{memoryCountByClient[client.name]}</span>
                                                    </span>
                                                  )}
                                                  {hasAdIssues && !hasBlocker && (
                                                    <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-amber-500/15 border border-amber-500/20" title="Ad review flagged issues">
                                                      <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                                                    </span>
                                                  )}
                                                  {hasBlocker && (
                                                    <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-destructive/15 border border-destructive/20" title={noAccounts ? 'No ad accounts mapped' : 'Connection issue'}>
                                                      <XCircle className="h-2.5 w-2.5 text-destructive" />
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                  {clientMultiAccount[client.name] && (
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); setExpandedMultiAcct(prev => { const next = new Set(prev); next.has(client.name) ? next.delete(client.name) : next.add(client.name); return next; }); }}
                                                      className="p-1 rounded-md hover:bg-muted/50"
                                                      title="Toggle account breakdown"
                                                    >
                                                      {expandedMultiAcct.has(client.name) ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setMappingClient(client.name); }}
                                                    className="p-1 rounded-md hover:bg-muted/50"
                                                    title="Map ad accounts"
                                                  >
                                                    <Link className="h-3 w-3 text-muted-foreground" />
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); if (confirm(`Remove "${client.name}" from the dashboard?`)) removeClient(client.name); }}
                                                    className="p-1 rounded-md hover:bg-destructive/10"
                                                    title="Remove client"
                                                  >
                                                    <Trash2 className="h-3 w-3 text-destructive/60" />
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </TableCell>
                                        {/* Score/Review/Strat/AI cells follow */}
                                        <TableCell className="text-center border-l border-border/30 py-0">
                                          {(() => {
                                            const score = client.healthScore;
                                            const bd = client.scoreBreakdown;
                                            const prevScore = previousScores.get(client.name.toLowerCase().trim());
                                            const delta = prevScore != null ? score - prevScore : null;
                                            const isUnknown = score < 0;
                                            const color = isUnknown ? 'text-muted-foreground' : score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
                                            const sparkData = scoreHistory.get(client.name.toLowerCase().trim());
                                            return (
                                              <TooltipProvider delayDuration={200}>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className={`inline-flex flex-col items-center gap-0.5 cursor-default`}>
                                                      <span className="inline-flex items-center gap-1">
                                                        <MiniSparkline data={sparkData || []} width={48} height={20} className="opacity-80" />
                                                        <span className={`text-sm font-bold ${color}`}>{isUnknown ? '--' : score}</span>
                                                        {delta != null && delta !== 0 && (
                                                          <span className={`inline-flex items-center gap-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                            <span className="text-[10px] font-medium">{Math.abs(delta)}</span>
                                                          </span>
                                                        )}
                                                      </span>
                                                      {!isUnknown && (
                                                        <div className="h-1 w-14 bg-muted rounded-full overflow-hidden">
                                                          <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.max(score, 0)}%` }} />
                                                        </div>
                                                      )}
                                                    </span>
                                                  </TooltipTrigger>
                                                  {bd && (
                                                    <TooltipContent side="left" className="w-56 p-3">
                                                      <p className="font-semibold text-xs mb-2">Score Breakdown</p>
                                                      {[
                                                        { label: 'CPA vs Benchmark', value: bd.cpaBenchmark, weight: '40%' },
                                                        { label: 'Conv. Trend', value: bd.conversionTrend, weight: '30%' },
                                                        { label: 'CPA Trend', value: bd.cpaTrend, weight: '20%' },
                                                        { label: 'AI Review', value: bd.aiReviewQuality, weight: '10%' },
                                                      ].map(s => (
                                                        <div key={s.label} className="flex items-center justify-between text-[11px] py-0.5">
                                                          <span className="text-muted-foreground">{s.label} <span className="opacity-50">({s.weight})</span></span>
                                                          <span className={`font-medium ${s.value < 0 ? 'text-muted-foreground' : s.value >= 70 ? 'text-emerald-400' : s.value >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{s.value < 0 ? '--' : s.value}</span>
                                                        </div>
                                                      ))}
                                                      <div className="border-t border-border mt-1.5 pt-1.5 flex items-center justify-between text-xs font-semibold">
                                                        <span>Composite</span>
                                                        <span className={color}>{isUnknown ? '--' : score}</span>
                                                      </div>
                                                      {prevScore != null && (
                                                        <div className="text-[10px] text-muted-foreground mt-1">Previous: {prevScore}</div>
                                                      )}
                                                    </TooltipContent>
                                                  )}
                                                </Tooltip>
                                              </TooltipProvider>
                                            );
                                          })()}
                                        </TableCell>
                                        <TableCell className="text-center border-l border-border/30 py-0">
                                          {(() => {
                                            const manualReview = lastAdReviewByClient[client.name];
                                            const autoReview = lastAutoReviewByClient[client.name];
                                            const isRunning = runningAdReviewClient === client.name;
                                            // Pick the most recent of manual vs auto
                                            const manualTime = manualReview ? new Date(manualReview.review_date).getTime() : 0;
                                            const autoTime = autoReview ? new Date(autoReview.created_at).getTime() : 0;
                                            const isAuto = autoTime >= manualTime && autoTime > 0;
                                            const latestDate = isAuto ? new Date(autoReview!.created_at) : manualReview ? new Date(manualReview.review_date) : null;
                                            const daysAgo = latestDate ? differenceInDays(new Date(), latestDate) : null;
                                            const summary = manualReview?.summary?.substring(0, 100) || 'View ad review';
                                            return (
                                              <div className="flex items-center justify-center gap-1">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); runSingleClientAdReview(client.name); }}
                                                  disabled={isRunning || !!runningAdReviewClient}
                                                  className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                                                  title={`Run ad review for ${client.name}`}
                                                >
                                                  {isRunning ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Play className="h-3 w-3 text-muted-foreground hover:text-primary" />}
                                                </button>
                                                {latestDate ? (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const c = clients.find(cl => cl.name === client.name);
                                                      if (c) { handleSelectClient(c); setTimeout(() => setDetailTab('adreview'), 50); }
                                                    }}
                                                    className="hover:underline flex items-center gap-0.5"
                                                    title={summary}
                                                  >
                                                    <span className={`text-[10px] font-medium ${daysAgo! > 14 ? 'text-red-400' : daysAgo! > 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                      {daysAgo === 0 ? 'Today' : `${daysAgo}d`}
                                                    </span>
                                                    <span className={`text-[8px] font-bold ${isAuto ? 'text-sky-400' : 'text-orange-400'}`} title={isAuto ? 'Automated review' : 'Manual review'}>
                                                      {isAuto ? '⚡' : '✋'}
                                                    </span>
                                                  </button>
                                                ) : (
                                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </TableCell>
                                        {/* AI Results cell */}
                                        <TableCell className="text-center border-l border-border/30 py-0">
                                          {(() => {
                                            if (!autoModeEnabledClients.has(client.name)) return <span className="text-[10px] text-muted-foreground/50">—</span>;
                                            return (
                                              <button onClick={(e) => { e.stopPropagation(); handleSelectClient(client); setTimeout(() => { setDetailTab('ai-results'); }, 50); }}
                                                className="hover:opacity-80 transition-opacity" title="Click to view AI results">
                                                <span className="inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded border text-primary bg-primary/10 border-primary/30">
                                                  View
                                                </span>
                                              </button>
                                            );
                                          })()}
                                        </TableCell>
                                        {/* Platform cells — show all conversion types */}
                                        {platformsToShow.map(p => {
                                          const d = trend?.[p.key];
                                          const tracked = clientTrackedTypes[client.name] || ['leads', 'purchases', 'calls'];
                                          const trackedMetric = d ? getTrackedConversions(client.name, d) : null;
                                          const snap = snapshotTrends[client.name]?.[p.key];
                                          const spendDelta = snap?.previous ? snap.current.spend - snap.previous.spend : null;
                                          const leadsDelta = snap?.previous ? (snap.current.leads || 0) - (snap.previous.leads || 0) : null;
                                          const purchDelta = snap?.previous ? (snap.current.purchases || 0) - (snap.previous.purchases || 0) : null;
                                          const callsDelta = snap?.previous ? (snap.current.calls || 0) - (snap.previous.calls || 0) : null;
                                          
                                          const cpaDelta = snap?.previous && trackedMetric ? (() => {
                                            const prevTracked = getTrackedConversions(client.name, snap.previous);
                                            return prevTracked.costPer > 0 ? trackedMetric.costPer - prevTracked.costPer : null;
                                          })() : null;
                                          const arrow = (delta: number | null, invert?: boolean) => {
                                            if (delta === null || delta === 0) return null;
                                            const up = delta > 0;
                                            const good = invert ? !up : up;
                                            return up
                                              ? <TrendingUp className={`inline h-3 w-3 ml-0.5 ${good ? 'text-emerald-400' : 'text-red-400'}`} />
                                              : <TrendingDown className={`inline h-3 w-3 ml-0.5 ${good ? 'text-emerald-400' : 'text-red-400'}`} />;
                                          };
                                          const isTracked = (type: string) => tracked.includes(type);
                                          const trackedCellClass = (type: string) => isTracked(type) ? 'text-center text-xs py-0 font-mono tabular-nums bg-primary/5' : 'text-center text-xs py-0 font-mono tabular-nums opacity-40';
                                          // CPA color-coding vs industry benchmark
                                          const cpaBm = getIndustryBenchmark(clientIndustries[client.name] || "");
                                          const benchmarkCpaVal = p.key === 'google' ? cpaBm.google.cpa : cpaBm.facebook.cpa;
                                          const cpaCellColor = trackedMetric && trackedMetric.costPer > 0
                                            ? (trackedMetric.costPer <= benchmarkCpaVal ? 'text-emerald-400' : trackedMetric.costPer <= benchmarkCpaVal * 1.5 ? 'text-amber-400' : 'text-red-400')
                                            : '';
                                          return (
                                            <Fragment key={p.key}>
                                              <TableCell className="text-center text-xs py-0 border-l border-border/30 font-mono tabular-nums">{d ? <span className="inline-flex items-center gap-0.5">{fmtD(d.spend)}{arrow(spendDelta)}</span> : loading ? dots : dash}</TableCell>
                                              <TableCell className="text-center text-xs py-0 font-mono tabular-nums bg-primary/5 font-semibold">{d ? <span className="inline-flex items-center gap-0.5">{(d.conv || 0) > 0 ? d.conv.toLocaleString() : '0'}{(() => { const convDelta = snap?.previous ? (snap.current.conv || 0) - (snap.previous.conv || 0) : null; return arrow(convDelta); })()}</span> : loading ? dots : dash}</TableCell>
                                              <TableCell className={trackedCellClass('leads')}>{d ? <span className="inline-flex items-center gap-0.5">{(d.leads || 0) > 0 ? d.leads.toLocaleString() : '0'}{arrow(leadsDelta)}</span> : loading ? dots : dash}</TableCell>
                                              <TableCell className={trackedCellClass('purchases')}>{d ? <span className="inline-flex items-center gap-0.5">{(d.purchases || 0) > 0 ? d.purchases.toLocaleString() : '0'}{arrow(purchDelta)}</span> : loading ? dots : dash}</TableCell>
                                              <TableCell className={trackedCellClass('calls')}>{d ? <span className="inline-flex items-center gap-0.5">{(d.calls || 0) > 0 ? d.calls.toLocaleString() : '0'}{arrow(callsDelta)}</span> : loading ? dots : dash}</TableCell>

                                              <TableCell className={`text-center text-xs py-0 font-mono tabular-nums font-semibold ${cpaCellColor}`}>{trackedMetric ? <span className="inline-flex items-center gap-0.5">{trackedMetric.costPer > 0 ? fmtD(trackedMetric.costPer) : '—'}{arrow(cpaDelta, true)}</span> : loading ? dots : dash}</TableCell>
                                            </Fragment>
                                          );
                                        })}
                                      </TableRow>
                                      {/* Multi-account sub-rows */}
                                      {clientMultiAccount[client.name] && expandedMultiAcct.has(client.name) && (() => {
                                        const mappings = manualMappings[client.name] || {};
                                        const subRows: React.ReactNode[] = [];
                                        for (const p of platformsToShow) {
                                          const acctIds = mappings[p.key === 'google' ? 'GA' : p.key === 'meta' ? 'FA' : p.key === 'bing' ? 'BA' : p.key === 'tiktok' ? 'TA' : 'LA'];
                                          if (!acctIds || acctIds.length <= 1) continue;
                                          for (const acctId of acctIds) {
                                            // Find account name from smAccounts
                                            const dsKey = p.key === 'google' ? 'GA' : p.key === 'meta' ? 'FA' : p.key === 'bing' ? 'BA' : p.key === 'tiktok' ? 'TA' : 'LA';
                                            const acctName = smAccounts[dsKey]?.find(a => a.id === acctId)?.name || acctId;
                                            subRows.push(
                                              <TableRow key={`${client.name}-${p.key}-${acctId}`} className="h-[32px] bg-muted/10 border-b border-border/20">
                                                <TableCell className="w-[36px] px-2 py-0 sticky left-0 z-10 bg-muted/10 backdrop-blur-sm" />
                                                <TableCell className="py-0 px-2 overflow-hidden sticky left-[36px] z-10 bg-muted/10 backdrop-blur-sm after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/30" style={{ width: clientColWidth, minWidth: 60, maxWidth: clientColWidth }}>
                                                  <span className="text-[11px] text-muted-foreground pl-3 truncate block" title={acctName}>
                                                    ↳ <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1">{p.label}</Badge>{acctName}
                                                  </span>
                                                </TableCell>
                                                <TableCell colSpan={4} className="py-0 border-l border-border/30" />
                                                {platformsToShow.map(pp => (
                                                  <Fragment key={pp.key}>
                                                    {pp.key === p.key ? (
                                                      <>
                                                        <TableCell colSpan={7} className="text-center text-[10px] py-0 border-l border-border/30 text-muted-foreground italic">
                                                          Acct: {acctId.substring(0, 12)}{acctId.length > 12 ? '…' : ''}
                                                        </TableCell>
                                                      </>
                                                    ) : (
                                                      <TableCell colSpan={7} className="py-0 border-l border-border/30" />
                                                    )}
                                                  </Fragment>
                                                ))}
                                              </TableRow>
                                            );
                                          }
                                        }
                                        return subRows;
                                      })()}
                                    </Fragment>
                                    );
                                  })}
                                </TableBody>
                              </>
                            );
                          })()}
                          
                        </Table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </>
        )}

        {/* ===== ADD CLIENT DIALOG ===== */}
        <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="client-name">Client Name *</Label>
                <Input id="client-name" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="e.g. Acme Corp" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="client-domain">Domain (optional)</Label>
                <Input id="client-domain" value={newClientDomain} onChange={e => setNewClientDomain(e.target.value)} placeholder="e.g. acme.com" className="mt-1" />
              </div>
              <div>
                <Label>Client Tier *</Label>
                <div className="flex gap-2 mt-1">
                  {(['premium', 'advanced', 'basic'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewClientTier(t)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${newClientTier === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddClient(false)}>Cancel</Button>
              <Button onClick={addClient} disabled={!newClientName.trim()}>Add Client</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <SupermetricsDebugPanel open={showSmDebug} onOpenChange={setShowSmDebug} />
        </>
        )}
        {/* ===== ACCOUNT MAPPING MODAL (renders in both detail + fleet views) ===== */}
        {mappingClient && (
          <AccountMappingModal
            clientName={mappingClient}
            smAccounts={smAccounts}
            onClose={() => setMappingClient(null)}
            onSaved={() => {
              loadManualMappings();
              setClientTrends(prev => { const next = { ...prev }; delete next[mappingClient]; return next; });
            }}
          />
        )}
      </main>
    </div>
  );
};

// ===== Shared UI Components =====

function SummaryCard({ count, label, color }: { count: number; label: string; color: 'red' | 'amber' | 'emerald' | 'zinc' }) {
  const colorMap = {
    red: 'border-red-500/30 bg-red-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    zinc: 'border-border bg-muted/20',
  };
  const textMap = { red: 'text-red-400', amber: 'text-amber-400', emerald: 'text-emerald-400', zinc: 'text-foreground' };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className={`text-3xl font-bold ${textMap[color]}`}>{count}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function BigMetric({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value, change, invertColor, bold }: { label: string; value: string; change?: { pct: number; direction: 'up' | 'down' | 'stable' } | null; invertColor?: boolean; bold?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className={`flex items-center gap-1 ${bold ? 'font-bold text-primary' : 'font-semibold'}`}>
        {value}
        {change && change.direction !== 'stable' && (
          <span className={`text-xs flex items-center ${(invertColor ? change.direction === 'down' : change.direction === 'up') ? 'text-emerald-400' : 'text-red-400'}`}>
            {change.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change.pct).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default ClientHealth;

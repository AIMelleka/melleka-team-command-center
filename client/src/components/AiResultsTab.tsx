import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle, Zap, Clock, BarChart3, Brain, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, startOfWeek, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface SessionWithChanges {
  id: string;
  client_name: string;
  platform: string;
  created_at: string;
  auto_mode: boolean;
  ai_summary: string | null;
  changes: ChangeRow[];
}

interface ChangeRow {
  id: string;
  change_type: string;
  entity_name: string | null;
  confidence: string;
  approval_status: string;
  executed_at: string | null;
  expected_impact: string | null;
  ai_rationale: string | null;
  result?: {
    outcome: string | null;
    ai_assessment: string | null;
    metrics_before: any;
    metrics_after: any;
    delta: any;
  } | null;
}

interface HealthRecord {
  recorded_date: string;
  health_score: number;
}

interface CorrelationPoint {
  week: string;
  aiScore: number | null;
  clientScore: number | null;
}

interface Props {
  clientName: string;
}

// ─── Scoring Engine ─────────────────────────────────────────────

export function computeAiStrategyScore(sessions: SessionWithChanges[]): {
  score: number;
  signals: { name: string; value: number; weight: number; raw: string }[];
  reasoning: string;
  positiveTypes: string[];
  negativeTypes: string[];
  hasEnoughData: boolean;
} {
  let totalChanges = 0;
  let executed = 0;
  let assessed = 0;
  let wins = 0;
  let losses = 0;
  let neutral = 0;
  let cpaImprovements = 0;
  let cpaDeclines = 0;
  let cpaAssessed = 0;
  let convImprovements = 0;
  let convDeclines = 0;
  let convAssessed = 0;
  const sessionWinCounts: number[] = [];
  const typePerformance: Record<string, { wins: number; losses: number }> = {};

  for (const session of sessions) {
    let sessionWins = 0;
    for (const c of session.changes) {
      totalChanges++;
      if (c.executed_at) executed++;
      if (c.result?.outcome) {
        assessed++;
        const o = c.result.outcome.toLowerCase();
        const type = c.change_type.replace(/_/g, ' ');
        if (!typePerformance[type]) typePerformance[type] = { wins: 0, losses: 0 };

        if (o === 'positive' || o === 'win' || o === 'improved') {
          wins++;
          sessionWins++;
          typePerformance[type].wins++;
        } else if (o === 'negative' || o === 'loss' || o === 'declined' || o === 'worsened') {
          losses++;
          typePerformance[type].losses++;
        } else {
          neutral++;
        }

        // Delta analysis
        const delta = c.result.delta as any;
        if (delta) {
          if (delta.cost_per_conversion !== undefined || delta.cpa !== undefined) {
            cpaAssessed++;
            const cpaDelta = delta.cost_per_conversion ?? delta.cpa ?? 0;
            if (cpaDelta < 0) cpaImprovements++; // Lower CPA = good
            else if (cpaDelta > 0) cpaDeclines++;
          }
          if (delta.conversions !== undefined || delta.conv !== undefined) {
            convAssessed++;
            const convDelta = delta.conversions ?? delta.conv ?? 0;
            if (convDelta > 0) convImprovements++; // More conversions = good
            else if (convDelta < 0) convDeclines++;
          }
        }
      }
    }
    if (session.changes.some(c => c.result?.outcome)) {
      sessionWinCounts.push(sessionWins);
    }
  }

  const hasEnoughData = assessed >= 2;

  // Signal 1: Win Rate (30%)
  const winRateRaw = assessed > 0 ? (wins / assessed) * 100 : 50;
  const winRateScore = Math.min(100, Math.max(0, winRateRaw));

  // Signal 2: CPA Impact (25%)
  let cpaScore = 50; // neutral default
  if (cpaAssessed > 0) {
    const cpaWinRate = cpaImprovements / cpaAssessed;
    cpaScore = Math.min(100, Math.max(0, cpaWinRate * 100));
  }

  // Signal 3: Conversion Impact (20%)
  let convScore = 50;
  if (convAssessed > 0) {
    const convWinRate = convImprovements / convAssessed;
    convScore = Math.min(100, Math.max(0, convWinRate * 100));
  }

  // Signal 4: Change Efficiency (15%) - ratio of executed to proposed
  const efficiencyScore = totalChanges > 0 ? Math.min(100, (executed / totalChanges) * 100) : 0;

  // Signal 5: Consistency (10%) - % of sessions with at least one win
  let consistencyScore = 50;
  if (sessionWinCounts.length > 0) {
    const sessionsWithWins = sessionWinCounts.filter(w => w > 0).length;
    consistencyScore = Math.min(100, (sessionsWithWins / sessionWinCounts.length) * 100);
  }

  const score = Math.round(
    winRateScore * 0.30 +
    cpaScore * 0.25 +
    convScore * 0.20 +
    efficiencyScore * 0.15 +
    consistencyScore * 0.10
  );

  const positiveTypes = Object.entries(typePerformance)
    .filter(([, v]) => v.wins > v.losses)
    .sort((a, b) => (b[1].wins - b[1].losses) - (a[1].wins - a[1].losses))
    .map(([t]) => t);

  const negativeTypes = Object.entries(typePerformance)
    .filter(([, v]) => v.losses > v.wins)
    .sort((a, b) => (b[1].losses - b[1].wins) - (a[1].losses - a[1].wins))
    .map(([t]) => t);

  // Build reasoning
  const parts: string[] = [];
  if (!hasEnoughData) {
    parts.push(`Only ${assessed} assessed result${assessed !== 1 ? 's' : ''} — score is preliminary.`);
  }
  if (wins > 0) parts.push(`${wins} winning change${wins !== 1 ? 's' : ''} out of ${assessed} assessed.`);
  if (losses > 0) parts.push(`${losses} losing change${losses !== 1 ? 's' : ''}.`);
  if (cpaAssessed > 0) parts.push(`CPA improved in ${cpaImprovements}/${cpaAssessed} cases.`);
  if (convAssessed > 0) parts.push(`Conversions improved in ${convImprovements}/${convAssessed} cases.`);

  return {
    score,
    signals: [
      { name: 'Win Rate', value: winRateScore, weight: 30, raw: assessed > 0 ? `${wins}/${assessed}` : 'N/A' },
      { name: 'CPA Impact', value: cpaScore, weight: 25, raw: cpaAssessed > 0 ? `${cpaImprovements}/${cpaAssessed} improved` : 'N/A' },
      { name: 'Conv Impact', value: convScore, weight: 20, raw: convAssessed > 0 ? `${convImprovements}/${convAssessed} improved` : 'N/A' },
      { name: 'Efficiency', value: efficiencyScore, weight: 15, raw: `${executed}/${totalChanges} executed` },
      { name: 'Consistency', value: consistencyScore, weight: 10, raw: sessionWinCounts.length > 0 ? `${sessionWinCounts.filter(w => w > 0).length}/${sessionWinCounts.length} sessions` : 'N/A' },
    ],
    reasoning: parts.join(' '),
    positiveTypes,
    negativeTypes,
    hasEnoughData,
  };
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/30';
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'AI is winning';
  if (score >= 40) return 'Mixed results';
  return 'AI is losing';
}

// ─── Component ──────────────────────────────────────────────────

export default function AiResultsTab({ clientName }: Props) {
  const [sessions, setSessions] = useState<SessionWithChanges[]>([]);
  const [healthHistory, setHealthHistory] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [clientName]);

  async function loadData() {
    setLoading(true);

    const [sessionsRes, healthRes] = await Promise.all([
      supabase
        .from('ppc_optimization_sessions')
        .select('id, client_name, platform, created_at, auto_mode, ai_summary')
        .eq('client_name', clientName)
        .eq('auto_mode', true)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('client_health_history')
        .select('recorded_date, health_score')
        .eq('client_name', clientName)
        .order('recorded_date', { ascending: true })
        .limit(200),
    ]);

    setHealthHistory(healthRes.data || []);

    const sessionsData = sessionsRes.data;
    if (!sessionsData?.length) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const sessionIds = sessionsData.map(s => s.id);

    const [changesRes, resultsRes] = await Promise.all([
      supabase
        .from('ppc_proposed_changes')
        .select('id, session_id, change_type, entity_name, confidence, approval_status, executed_at, expected_impact, ai_rationale')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('ppc_change_results')
        .select('change_id, outcome, ai_assessment, metrics_before, metrics_after, delta')
        .in('session_id', sessionIds),
    ]);

    const resultsMap: Record<string, any> = {};
    for (const r of (resultsRes.data || [])) {
      resultsMap[r.change_id] = r;
    }

    const built: SessionWithChanges[] = sessionsData.map(s => ({
      ...s,
      changes: (changesRes.data || [])
        .filter(c => c.session_id === s.id)
        .map(c => ({
          ...c,
          result: resultsMap[c.id] || null,
        })),
    }));

    setSessions(built);
    setLoading(false);
  }

  // Compute the AI Strategy Score
  const aiScoreResult = useMemo(() => computeAiStrategyScore(sessions), [sessions]);

  // Build weekly correlation data
  const correlationData = useMemo((): CorrelationPoint[] => {
    if (sessions.length === 0 && healthHistory.length === 0) return [];

    // Group sessions by week and compute per-week AI scores
    const weeklySessionMap: Record<string, SessionWithChanges[]> = {};
    for (const s of sessions) {
      const weekKey = format(startOfWeek(new Date(s.created_at), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weeklySessionMap[weekKey]) weeklySessionMap[weekKey] = [];
      weeklySessionMap[weekKey].push(s);
    }

    // Group health by week (average per week)
    const weeklyHealthMap: Record<string, number[]> = {};
    for (const h of healthHistory) {
      const weekKey = format(startOfWeek(parseISO(h.recorded_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weeklyHealthMap[weekKey]) weeklyHealthMap[weekKey] = [];
      weeklyHealthMap[weekKey].push(h.health_score);
    }

    // Merge all week keys
    const allWeeks = new Set([...Object.keys(weeklySessionMap), ...Object.keys(weeklyHealthMap)]);
    const sorted = Array.from(allWeeks).sort();

    return sorted.map(week => {
      const weekSessions = weeklySessionMap[week];
      const aiScore = weekSessions ? computeAiStrategyScore(weekSessions).score : null;
      const healthScores = weeklyHealthMap[week];
      const clientScore = healthScores ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : null;

      return {
        week: format(parseISO(week), 'MMM d'),
        aiScore,
        clientScore,
      };
    });
  }, [sessions, healthHistory]);

  // Correlation summary
  const correlationSummary = useMemo(() => {
    const points = correlationData.filter(p => p.aiScore !== null && p.clientScore !== null);
    if (points.length < 2) return 'Not enough overlapping data to determine correlation.';

    const aiValues = points.map(p => p.aiScore!);
    const clientValues = points.map(p => p.clientScore!);
    const avgAi = aiValues.reduce((a, b) => a + b, 0) / aiValues.length;
    const avgClient = clientValues.reduce((a, b) => a + b, 0) / clientValues.length;

    // Simple Pearson correlation
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < points.length; i++) {
      const dA = aiValues[i] - avgAi;
      const dB = clientValues[i] - avgClient;
      num += dA * dB;
      denA += dA * dA;
      denB += dB * dB;
    }
    const r = denA > 0 && denB > 0 ? num / Math.sqrt(denA * denB) : 0;

    if (r > 0.5) return 'AI Strategy Score and Client Performance Score are positively aligned — AI optimizations are translating to real performance gains.';
    if (r < -0.3) return 'AI Strategy Score and Client Performance Score are diverging — AI changes may not be translating to real-world improvements.';
    return 'AI Strategy Score and Client Performance Score show weak correlation — more data needed to draw conclusions.';
  }, [correlationData]);

  // Aggregate stats for existing tables
  const stats = useMemo(() => {
    let totalChanges = 0, executed = 0, withResults = 0, wins = 0, losses = 0, neutral = 0, pending = 0;
    const byType: Record<string, { total: number; executed: number; wins: number; losses: number }> = {};

    for (const session of sessions) {
      for (const c of session.changes) {
        totalChanges++;
        const type = c.change_type.replace(/_/g, ' ');
        if (!byType[type]) byType[type] = { total: 0, executed: 0, wins: 0, losses: 0 };
        byType[type].total++;
        if (c.executed_at) {
          executed++;
          byType[type].executed++;
          if (c.result?.outcome) {
            withResults++;
            const o = c.result.outcome.toLowerCase();
            if (o === 'positive' || o === 'win' || o === 'improved') { wins++; byType[type].wins++; }
            else if (o === 'negative' || o === 'loss' || o === 'declined') { losses++; byType[type].losses++; }
            else neutral++;
          } else pending++;
        }
      }
    }
    const winRate = withResults > 0 ? Math.round((wins / withResults) * 100) : null;
    return { totalChanges, executed, withResults, wins, losses, neutral, pending, winRate, byType, totalSessions: sessions.length };
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin mr-2" /> Loading AI results...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No auto-strategist sessions yet</p>
          <p className="text-sm mt-1">Enable auto mode to start tracking AI performance for this client.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── AI Strategy Score Hero ─────────────────────────────── */}
      <Card className={`border ${getScoreBg(aiScoreResult.score)}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor(aiScoreResult.score)}`}>
                {aiScoreResult.score}
              </div>
              <p className="text-xs text-muted-foreground mt-1">/ 100</p>
              <Badge variant="outline" className={`mt-2 text-[10px] ${getScoreColor(aiScoreResult.score)}`}>
                {getScoreLabel(aiScoreResult.score)}
              </Badge>
              {!aiScoreResult.hasEnoughData && (
                <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Preliminary
                </p>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4" /> AI Strategy Score Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {aiScoreResult.signals.map(s => (
                  <div key={s.name} className="bg-background/50 rounded-md p-2 border border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground/60">{s.weight}%</span>
                    </div>
                    <p className={`text-sm font-bold ${getScoreColor(s.value)}`}>{Math.round(s.value)}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{s.raw}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Correlation Graph ──────────────────────────────────── */}
      {correlationData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> AI Score vs Client Performance Over Time
            </CardTitle>
            <CardDescription className="text-xs">
              Weekly comparison — are AI optimizations driving real results?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={correlationData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: any, name: string) => [
                      value !== null ? value : '—',
                      name === 'aiScore' ? 'AI Strategy Score' : 'Client Health Score',
                    ]}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs">
                        {value === 'aiScore' ? 'AI Strategy Score' : 'Client Health Score'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="aiScore"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="clientScore"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Period Analysis / Reasoning ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" /> Period Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{aiScoreResult.reasoning}</p>

          {aiScoreResult.positiveTypes.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-emerald-500 mb-1">✓ Positive contributors</p>
              <div className="flex flex-wrap gap-1">
                {aiScoreResult.positiveTypes.map(t => (
                  <Badge key={t} variant="outline" className="text-[10px] capitalize border-emerald-500/30 text-emerald-600">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {aiScoreResult.negativeTypes.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-red-500 mb-1">✗ Negative contributors</p>
              <div className="flex flex-wrap gap-1">
                {aiScoreResult.negativeTypes.map(t => (
                  <Badge key={t} variant="outline" className="text-[10px] capitalize border-red-500/30 text-red-600">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-md p-3 mt-2">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Correlation Summary</p>
            <p className="text-xs">{correlationSummary}</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Existing: Performance by Change Type ────────────────── */}
      {Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Performance by Change Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Change Type</TableHead>
                  <TableHead className="text-xs text-center">Total</TableHead>
                  <TableHead className="text-xs text-center">Executed</TableHead>
                  <TableHead className="text-xs text-center">Wins</TableHead>
                  <TableHead className="text-xs text-center">Losses</TableHead>
                  <TableHead className="text-xs text-center">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([type, data]) => {
                    const assessed = data.wins + data.losses;
                    const rate = assessed > 0 ? Math.round((data.wins / assessed) * 100) : null;
                    return (
                      <TableRow key={type}>
                        <TableCell className="text-xs font-medium capitalize">{type}</TableCell>
                        <TableCell className="text-xs text-center">{data.total}</TableCell>
                        <TableCell className="text-xs text-center">{data.executed}</TableCell>
                        <TableCell className="text-xs text-center text-green-600">{data.wins || '—'}</TableCell>
                        <TableCell className="text-xs text-center text-red-600">{data.losses || '—'}</TableCell>
                        <TableCell className="text-xs text-center">
                          {rate !== null ? (
                            <Badge variant={rate >= 60 ? 'default' : rate >= 40 ? 'secondary' : 'destructive'} className="text-[10px]">
                              {rate}%
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── Existing: Session Timeline ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Session Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map(session => {
            const successCount = session.changes.filter(c => c.executed_at).length;
            const resultCount = session.changes.filter(c => c.result?.outcome).length;
            const winCount = session.changes.filter(c => {
              const o = c.result?.outcome?.toLowerCase();
              return o === 'positive' || o === 'win' || o === 'improved';
            }).length;
            const isExpanded = expandedSession === session.id;
            const daysAgo = differenceInDays(new Date(), new Date(session.created_at));

            return (
              <div key={session.id} className="border rounded-lg">
                <button
                  onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] capitalize">{session.platform}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                      {daysAgo > 0 && <span className="ml-1">({daysAgo}d ago)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{session.changes.length} changes</span>
                    {successCount > 0 && <Badge variant="secondary" className="text-[10px]">{successCount} executed</Badge>}
                    {resultCount > 0 && (
                      <Badge variant={winCount > resultCount / 2 ? 'default' : 'destructive'} className="text-[10px]">
                        {winCount}/{resultCount} wins
                      </Badge>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2 space-y-2">
                    {session.ai_summary && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3">{session.ai_summary}</p>
                    )}
                    {session.changes.map(change => (
                      <div key={change.id} className="flex items-start gap-2 text-xs border-l-2 pl-3 py-1.5"
                        style={{ borderColor: change.result?.outcome
                          ? (['positive','win','improved'].includes(change.result.outcome.toLowerCase()) ? 'var(--color-green-500, #22c55e)' : 'var(--color-red-500, #ef4444)')
                          : change.executed_at ? 'var(--color-yellow-500, #eab308)' : 'var(--color-gray-300, #d1d5db)'
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium capitalize">{change.change_type.replace(/_/g, ' ')}</span>
                            {change.entity_name && <span className="text-muted-foreground truncate max-w-[200px]">{change.entity_name}</span>}
                            <Badge variant="outline" className="text-[9px]">{change.confidence}</Badge>
                          </div>
                          {change.expected_impact && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1">{change.expected_impact}</p>
                          )}
                          {change.result?.ai_assessment && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-muted-foreground mt-1 line-clamp-2 cursor-help italic">{change.result.ai_assessment.substring(0, 200)}...</p>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="text-xs whitespace-pre-wrap">{change.result.ai_assessment.substring(0, 1000)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="shrink-0">
                          {change.result?.outcome ? (
                            ['positive','win','improved'].includes(change.result.outcome.toLowerCase())
                              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                              : <XCircle className="h-4 w-4 text-red-500" />
                          ) : change.executed_at ? (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {stats.pending > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <span>{stats.pending} executed changes are still awaiting outcome assessment. Results will populate automatically on the next assessment run.</span>
        </div>
      )}
    </div>
  );
}

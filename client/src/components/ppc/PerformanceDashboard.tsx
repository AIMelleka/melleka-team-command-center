import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Zap, BarChart3, CheckCircle, XCircle, Clock, TrendingUp, Minus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

interface PerformanceDashboardProps {
  sessions: any[];
  changes: any[];
  results: any[];
}

// Custom bar tooltip
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs space-y-1 min-w-[120px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function PerformanceDashboard({ sessions, changes, results }: PerformanceDashboardProps) {
  // ── Derive all stats from sessions + changes (results may be empty) ──

  const totalSessions = sessions.length;
  const autoSessions = sessions.filter(s => s.auto_mode).length;
  const manualSessions = totalSessions - autoSessions;

  const totalChanges = changes.length;
  const approved = changes.filter(c => c.approval_status === 'approved' || c.approval_status === 'auto_approved').length;
  const rejected = changes.filter(c => c.approval_status === 'rejected').length;
  const pending = changes.filter(c => c.approval_status === 'pending').length;
  const executed = changes.filter(c => c.executed_at).length;
  const autoApproved = changes.filter(c => c.approval_status === 'auto_approved').length;
  const failed = changes.filter(c => c.execution_error).length;
  const approvalRate = totalChanges > 0 ? ((approved / totalChanges) * 100) : 0;
  const executionRate = approved > 0 ? ((executed / approved) * 100) : 0;

  // Change type breakdown
  const changeTypeMap: Record<string, { total: number; approved: number; executed: number; autoApproved: number }> = {};
  for (const c of changes) {
    const t = c.change_type;
    if (!changeTypeMap[t]) changeTypeMap[t] = { total: 0, approved: 0, executed: 0, autoApproved: 0 };
    changeTypeMap[t].total++;
    if (c.approval_status === 'approved' || c.approval_status === 'auto_approved') changeTypeMap[t].approved++;
    if (c.executed_at) changeTypeMap[t].executed++;
    if (c.approval_status === 'auto_approved') changeTypeMap[t].autoApproved++;
  }

  // Platform breakdown
  const platformMap: Record<string, number> = {};
  for (const s of sessions) {
    platformMap[s.platform] = (platformMap[s.platform] || 0) + 1;
  }

  // Pie data for approval status
  const statusPie = [
    { name: 'Auto-approved', value: autoApproved, color: '#a855f7' },
    { name: 'Approved', value: approved - autoApproved, color: '#22c55e' },
    { name: 'Rejected', value: rejected, color: '#ef4444' },
    { name: 'Pending', value: pending, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  // Activity over time (last 14 days)
  const activityByDay: Record<string, { sessions: number; changes: number; executed: number }> = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    activityByDay[key] = { sessions: 0, changes: 0, executed: 0 };
  }
  for (const s of sessions) {
    const day = s.created_at?.split('T')[0];
    if (activityByDay[day]) activityByDay[day].sessions++;
  }
  for (const c of changes) {
    const day = c.created_at?.split('T')[0];
    if (activityByDay[day]) activityByDay[day].changes++;
    if (c.executed_at) {
      const exDay = c.executed_at.split('T')[0];
      if (activityByDay[exDay]) activityByDay[exDay].executed++;
    }
  }
  const activityData = Object.entries(activityByDay).map(([date, d]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Sessions: d.sessions,
    Changes: d.changes,
    Executed: d.executed,
  }));

  // Also use ppc_change_results if available
  const assessedResults = results.filter((r) => r.outcome);
  const improved = assessedResults.filter(r => r.outcome === 'improved').length;
  const worsened = assessedResults.filter(r => r.outcome === 'worsened').length;
  const neutral = assessedResults.filter(r => r.outcome === 'neutral').length;
  const hasResults = assessedResults.length > 0;

  if (totalSessions === 0 && totalChanges === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="font-medium">No strategist activity yet</p>
        <p className="text-sm mt-1">Run an analysis or enable Auto Mode to start tracking performance.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Sessions */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Sessions</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalSessions}</p>
            <div className="flex gap-2 mt-2">
              {autoSessions > 0 && <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-400 bg-purple-500/5">{autoSessions} auto</Badge>}
              {manualSessions > 0 && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400 bg-blue-500/5">{manualSessions} manual</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Approval Rate */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Approval Rate</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{approvalRate.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground mt-2">{approved} of {totalChanges} changes</p>
          </CardContent>
        </Card>

        {/* Executed */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Executed</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{executed}</p>
            <div className="flex gap-2 mt-2 items-center">
              {failed > 0 && <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400 bg-red-500/5">{failed} failed</Badge>}
              <p className="text-[10px] text-muted-foreground">{executionRate.toFixed(0)}% exec rate</p>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Pending</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{pending}</p>
            <p className="text-[10px] text-muted-foreground mt-2">awaiting review</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity over time */}
      {activityData.some(d => d.Sessions > 0 || d.Changes > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-semibold">Activity (Last 14 Days)</p>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} barGap={2}>
                  <defs>
                    <linearGradient id="barSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="barChanges" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="barExecuted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="Sessions" fill="url(#barSessions)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Changes" fill="url(#barChanges)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Executed" fill="url(#barExecuted)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Approval status breakdown */}
        {statusPie.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold">Change Status Breakdown</p>
              <p className="text-xs text-muted-foreground">{totalChanges} total proposed changes</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div style={{ height: 200, width: 200 }} className="shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} cx="50%" cy="50%" innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={3} label={({ name, value }) => `${value}`} labelLine={false}>
                        {statusPie.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 flex-1">
                  {statusPie.map(item => (
                    <div key={item.name} className="flex items-center gap-2.5">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground flex-1">{item.name}</span>
                      <span className="text-sm font-bold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change type breakdown */}
        {Object.keys(changeTypeMap).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold">Change Type Breakdown</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(changeTypeMap)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([type, data]) => {
                    const pct = totalChanges > 0 ? (data.total / totalChanges) * 100 : 0;
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-foreground capitalize">{type.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            {data.autoApproved > 0 && <span className="text-purple-400">{data.autoApproved} auto</span>}
                            <span className="text-green-400">{data.executed} exec</span>
                            <span className="text-muted-foreground">{data.total}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Outcome tracking (only if ppc_change_results has data) */}
      {hasResults && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-semibold">Change Outcomes</p>
            <p className="text-xs text-muted-foreground">Post-execution impact assessments</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Improved', value: improved, icon: <CheckCircle className="h-5 w-5 text-emerald-400" />, color: 'text-emerald-400', bg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20' },
                { label: 'Neutral', value: neutral, icon: <Minus className="h-5 w-5 text-muted-foreground" />, color: 'text-muted-foreground', bg: 'bg-muted/50 border border-border' },
                { label: 'Worsened', value: worsened, icon: <XCircle className="h-5 w-5 text-red-400" />, color: 'text-red-400', bg: 'bg-gradient-to-br from-red-500/15 to-red-500/5 border border-red-500/20' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-xl p-4 text-center', item.bg)}>
                  <div className="flex justify-center mb-2">{item.icon}</div>
                  <p className={cn('text-3xl font-bold', item.color)}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session timeline */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-semibold">Recent Sessions</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {sessions.slice(0, 8).map(s => {
                const sessionChanges = changes.filter(c => c.session_id === s.id);
                const sessionExecuted = sessionChanges.filter(c => c.executed_at).length;
                const isGoogle = s.platform === 'google';
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn(
                        'inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold text-white shrink-0',
                        isGoogle ? 'bg-blue-500' : 'bg-indigo-500'
                      )}>
                        {isGoogle ? 'G' : 'M'}
                      </span>
                      {s.auto_mode && <Zap className="h-3 w-3 text-purple-400 shrink-0" />}
                      <span className="text-xs text-muted-foreground truncate">
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <Badge variant="outline" className="text-[9px] capitalize">{s.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] shrink-0">
                      <span className="text-muted-foreground">{sessionChanges.length} changes</span>
                      {sessionExecuted > 0 && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">{sessionExecuted} exec</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

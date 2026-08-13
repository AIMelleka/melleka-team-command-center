import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTitle,
  getStatus,
  getClient,
  getTeammate,
  getPriority,
  getDue,
  getCheckbox,
  getStatusGroup,
  colorClass,
  fetchTaskStats,
  useTaskStats,
  type NotionTask,
} from '@/hooks/useNotionTasks';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
} from 'lucide-react';

const PAGE_SIZE = 100;

function isTaskDone(task: NotionTask): boolean {
  const st = getStatus(task.properties);
  if (st && getStatusGroup(st.name) === 'Complete') return true;
  return getCheckbox(task.properties);
}

const PRESETS = [
  { label: 'Today', key: 'today' },
  { label: 'This Week', key: 'this-week' },
  { label: 'Last Week', key: 'last-week' },
  { label: 'This Month', key: 'this-month' },
  { label: 'Last Month', key: 'last-month' },
  { label: 'Last 30D', key: 'last-30' },
  { label: 'Last 90D', key: 'last-90' },
  { label: 'All Time', key: 'all-time' },
];

function getPresetDates(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const today = fmt(now);
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'this-week': {
      const dow = now.getDay();
      const mon = addDays(now, dow === 0 ? -6 : 1 - dow);
      return { from: fmt(mon), to: fmt(addDays(mon, 6)) };
    }
    case 'last-week': {
      const dow = now.getDay();
      const thisMon = addDays(now, dow === 0 ? -6 : 1 - dow);
      const lastMon = addDays(thisMon, -7);
      return { from: fmt(lastMon), to: fmt(addDays(lastMon, 6)) };
    }
    case 'this-month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case 'last-month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case 'last-30': return { from: fmt(addDays(now, -30)), to: today };
    case 'last-90': return { from: fmt(addDays(now, -90)), to: today };
    default: return null;
  }
}

function StatCard({ label, value, icon, sub }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 space-y-2">
      <div className="w-8 h-8 flex items-center justify-center text-emerald-500">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function TaskTracker() {
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState('this-month');
  const [isCustom, setIsCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [teammate, setTeammate] = useState('All');
  const [client, setClient] = useState('');
  const [search, setSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);

  const { dateFrom, dateTo } = useMemo(() => {
    if (isCustom) return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    const range = getPresetDates(preset);
    return { dateFrom: range?.from, dateTo: range?.to };
  }, [preset, isCustom, customFrom, customTo]);

  const { data, isLoading, isError } = useTaskStats(dateFrom, dateTo);

  // Only show completed/done tasks
  const doneTasks: NotionTask[] = useMemo(() =>
    (data?.tasks ?? []).filter(isTaskDone),
    [data]
  );

  const teammateOptions = useMemo(() => {
    const seen = new Set<string>();
    doneTasks.forEach(t => { const tm = getTeammate(t.properties); if (tm) seen.add(tm.name); });
    return Array.from(seen).sort();
  }, [doneTasks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return doneTasks.filter(t => {
      const p = t.properties;
      if (teammate !== 'All') {
        const tm = getTeammate(p);
        if (!tm || tm.name !== teammate) return false;
      }
      if (client) {
        if (!getClient(p).toLowerCase().includes(client.toLowerCase())) return false;
      }
      if (search) {
        if (!getTitle(p).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [doneTasks, teammate, client, search]);

  // Stats: total done, top teammate, top client
  const stats = useMemo(() => {
    const byTeammate: Record<string, number> = {};
    const byClient: Record<string, number> = {};

    for (const t of filtered) {
      const tm = getTeammate(t.properties)?.name;
      if (tm) byTeammate[tm] = (byTeammate[tm] || 0) + 1;
      const cl = getClient(t.properties);
      if (cl) byClient[cl] = (byClient[cl] || 0) + 1;
    }

    const topTeammate = Object.entries(byTeammate).sort((a, b) => b[1] - a[1])[0];
    const topClient = Object.entries(byClient).sort((a, b) => b[1] - a[1])[0];

    return {
      total: filtered.length,
      topTeammate: topTeammate ? { name: topTeammate[0], count: topTeammate[1] } : null,
      topClient: topClient ? { name: topClient[0], count: topClient[1] } : null,
      teammateCount: Object.keys(byTeammate).length,
      clientCount: Object.keys(byClient).length,
    };
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  const handleRefresh = useCallback(async () => {
    const fresh = await fetchTaskStats(dateFrom, dateTo, true);
    queryClient.setQueryData(['notion-task-stats', dateFrom ?? '', dateTo ?? ''], fresh);
  }, [queryClient, dateFrom, dateTo]);

  const handlePreset = (key: string) => {
    setPreset(key);
    setIsCustom(false);
    setTablePage(0);
  };

  const hasFilters = teammate !== 'All' || client || search;
  const clearFilters = () => {
    setTeammate('All');
    setClient('');
    setSearch('');
    setTablePage(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Task Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isLoading
                ? 'Fetching from Notion...'
                : data?.cached
                ? `Cached · ${new Date(data.fetchedAt).toLocaleTimeString()}`
                : data?.fetchedAt
                ? `Updated ${new Date(data.fetchedAt).toLocaleTimeString()}`
                : 'Completed tasks only'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="min-h-[44px] sm:min-h-0">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Date Presets */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <Button
                key={p.key}
                variant={!isCustom && preset === p.key ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <Button
              variant={isCustom ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs px-3"
              onClick={() => { setIsCustom(true); setTablePage(0); }}
            >
              Custom
            </Button>
          </div>
          {isCustom && (
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                type="date"
                value={customFrom}
                onChange={e => { setCustomFrom(e.target.value); setTablePage(0); }}
                className="h-8 text-sm w-40"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={customTo}
                onChange={e => { setCustomTo(e.target.value); setTablePage(0); }}
                className="h-8 text-sm w-40"
              />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Tasks Completed"
            value={isLoading ? '...' : stats.total}
            icon={<CheckCircle2 className="h-5 w-5" />}
            sub={stats.total > 0 ? `across ${stats.clientCount} client${stats.clientCount !== 1 ? 's' : ''}` : undefined}
          />
          <StatCard
            label="Top Teammate"
            value={isLoading ? '...' : stats.topTeammate ? stats.topTeammate.count : 0}
            icon={<Users className="h-5 w-5" />}
            sub={stats.topTeammate?.name}
          />
          <StatCard
            label="Top Client"
            value={isLoading ? '...' : stats.topClient ? stats.topClient.count : 0}
            icon={<Building2 className="h-5 w-5" />}
            sub={stats.topClient?.name}
          />
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Client</p>
              <Input
                placeholder="Filter client..."
                value={client}
                onChange={e => { setClient(e.target.value); setTablePage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Teammate</p>
              <Select value={teammate} onValueChange={v => { setTeammate(v); setTablePage(0); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {teammateOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Search</p>
                <Input
                  placeholder="Search tasks..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setTablePage(0); }}
                  className="h-8 text-sm"
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Task Table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Completed Tasks</span>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <p className="text-sm">Fetching completed tasks from Notion...</p>
            </div>
          ) : isError ? (
            <div className="py-16 text-center space-y-1">
              <p className="text-sm text-destructive font-medium">Failed to connect to Notion</p>
              <p className="text-xs text-muted-foreground">Check that NOTION_API_KEY is set on the server</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No completed tasks found for this period
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Task</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Done Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Client</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Teammate</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Priority</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paginated.map(task => {
                      const p = task.properties;
                      const status = getStatus(p);
                      const prio = getPriority(p);
                      const tm = getTeammate(p);
                      const due = getDue(p);
                      return (
                        <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5 max-w-[260px]">
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 group hover:underline text-foreground"
                            >
                              <span className="truncate">{getTitle(p) || 'Untitled'}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </a>
                          </td>
                          <td className="px-3 py-2.5">
                            {status && (
                              <span className={`inline-flex items-center h-5 rounded px-1.5 text-xs whitespace-nowrap ${colorClass(status.color)}`}>
                                {status.name}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[110px] truncate">
                            {getClient(p)}
                          </td>
                          <td className="px-3 py-2.5">
                            {tm && (
                              <span className={`inline-flex h-5 rounded px-1.5 text-xs items-center ${colorClass(tm.color)}`}>
                                {tm.name}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {prio && (
                              <span className={`inline-flex h-5 rounded px-1.5 text-xs items-center ${colorClass(prio.color)}`}>
                                {prio.name}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {due
                              ? new Date(due + 'T00:00:00').toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {tablePage * PAGE_SIZE + 1}&ndash;{Math.min((tablePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setTablePage(p => p - 1)}
                      disabled={tablePage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{tablePage + 1} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setTablePage(p => p + 1)}
                      disabled={tablePage >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

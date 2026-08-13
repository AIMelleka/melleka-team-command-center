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
  Clock,
  ListTodo,
  TrendingUp,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 100;

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
    default: return null; // all-time
  }
}

function StatCard({ label, value, icon, sub, highlight }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
  highlight?: 'green' | 'blue' | 'purple' | 'orange';
}) {
  const colors = {
    green: 'text-emerald-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
  };
  const iconColor = highlight ? colors[highlight] : 'text-muted-foreground';
  return (
    <div className="bg-card border rounded-lg p-4 space-y-2">
      <div className={`w-8 h-8 flex items-center justify-center ${iconColor}`}>{icon}</div>
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

  const [preset, setPreset] = useState('last-30');
  const [isCustom, setIsCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [teammate, setTeammate] = useState('All');
  const [priority, setPriority] = useState('All');
  const [client, setClient] = useState('');
  const [search, setSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);

  const { dateFrom, dateTo } = useMemo(() => {
    if (isCustom) return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    const range = getPresetDates(preset);
    return { dateFrom: range?.from, dateTo: range?.to };
  }, [preset, isCustom, customFrom, customTo]);

  const { data, isLoading, isError } = useTaskStats(dateFrom, dateTo);
  const allTasks: NotionTask[] = data?.tasks ?? [];

  const teammateOptions = useMemo(() => {
    const seen = new Set<string>();
    allTasks.forEach(t => { const tm = getTeammate(t.properties); if (tm) seen.add(tm.name); });
    return Array.from(seen).sort();
  }, [allTasks]);

  const priorityOptions = useMemo(() => {
    const seen = new Set<string>();
    allTasks.forEach(t => { const pr = getPriority(t.properties); if (pr) seen.add(pr.name); });
    return Array.from(seen).sort();
  }, [allTasks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTasks.filter(t => {
      const p = t.properties;
      if (teammate !== 'All') {
        const tm = getTeammate(p);
        if (!tm || tm.name !== teammate) return false;
      }
      if (priority !== 'All') {
        const pr = getPriority(p);
        if (!pr || pr.name !== priority) return false;
      }
      if (client) {
        if (!getClient(p).toLowerCase().includes(client.toLowerCase())) return false;
      }
      if (search) {
        if (!getTitle(p).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allTasks, teammate, priority, client, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const complete = filtered.filter(t => {
      const st = getStatus(t.properties);
      return st && getStatusGroup(st.name) === 'Complete';
    }).length;
    const inProgress = filtered.filter(t => {
      const st = getStatus(t.properties);
      return st && getStatusGroup(st.name) === 'In progress';
    }).length;
    const todo = total - complete - inProgress;
    const rate = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, complete, inProgress, todo, rate };
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

  const hasFilters = teammate !== 'All' || priority !== 'All' || client || search;
  const clearFilters = () => {
    setTeammate('All');
    setPriority('All');
    setClient('');
    setSearch('');
    setTablePage(0);
  };

  const isAllTime = !isCustom && preset === 'all-time';

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
                : 'Notion'}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            label="Total Tasks"
            value={isLoading ? '...' : stats.total}
            icon={<ListTodo className="h-5 w-5" />}
          />
          <StatCard
            label="Completed"
            value={isLoading ? '...' : stats.complete}
            icon={<CheckCircle2 className="h-5 w-5" />}
            highlight="green"
          />
          <StatCard
            label="In Progress"
            value={isLoading ? '...' : stats.inProgress}
            icon={<Clock className="h-5 w-5" />}
            highlight="blue"
          />
          <StatCard
            label="To-do"
            value={isLoading ? '...' : stats.todo}
            icon={<ListTodo className="h-5 w-5" />}
            highlight="orange"
          />
          <StatCard
            label="Completion Rate"
            value={isLoading ? '...' : `${stats.rate}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            highlight="purple"
            sub={stats.total > 0 ? `${stats.complete} of ${stats.total}` : undefined}
          />
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            <div>
              <p className="text-xs text-muted-foreground mb-1">Priority</p>
              <Select value={priority} onValueChange={v => { setPriority(v); setTablePage(0); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {priorityOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
            <span className="text-sm font-medium">Tasks</span>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <div className="text-center">
                <p className="text-sm">Fetching tasks from Notion...</p>
                {isAllTime && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    All-time queries may take a moment
                  </p>
                )}
              </div>
            </div>
          ) : isError ? (
            <div className="py-16 text-center space-y-1">
              <p className="text-sm text-destructive font-medium">Failed to connect to Notion</p>
              <p className="text-xs text-muted-foreground">Check that NOTION_API_KEY is set on the server</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No tasks match your filters
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Task</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
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
                      const done = getCheckbox(p);
                      return (
                        <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${done ? 'bg-primary' : 'border-2 border-muted-foreground/30'}`}>
                              {done && (
                                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                                  <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 max-w-[260px]">
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1.5 group hover:underline ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                            >
                              <span className="truncate">{getTitle(p) || 'Untitled'}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </a>
                          </td>
                          <td className="px-3 py-2.5">
                            {status && (
                              <span className={`inline-flex items-center h-5 rounded px-1.5 text-xs whitespace-nowrap max-w-[160px] truncate ${colorClass(status.color)}`}>
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

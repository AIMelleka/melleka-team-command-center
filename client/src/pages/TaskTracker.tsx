import { useState, useMemo } from 'react';
import {
  useTasks,
  getTitle,
  getStatus,
  getClient,
  getTeammate,
  getPriority,
  getDue,
  getCheckbox,
  getStatusGroup,
  colorClass,
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
} from 'lucide-react';

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
  highlight?: 'green' | 'blue' | 'purple';
}) {
  const colors = {
    green: 'text-emerald-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
  };
  const iconColor = highlight ? colors[highlight] : 'text-muted-foreground';
  return (
    <div className="bg-card border rounded-lg p-4 space-y-2">
      <div className={`w-8 h-8 flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function TaskTracker() {
  const [statusGroup, setStatusGroup] = useState('All');
  const [client, setClient] = useState('');
  const [teammate, setTeammate] = useState('All');
  const [priority, setPriority] = useState('All');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, refetch, isRefetching } = useTasks({});

  const allTasks: NotionTask[] = data?.results ?? [];
  const hasMore = data?.has_more ?? false;

  // Derive filter options from fetched tasks
  const teammateOptions = useMemo(() => {
    const seen = new Set<string>();
    allTasks.forEach(t => {
      const tm = getTeammate(t.properties);
      if (tm) seen.add(tm.name);
    });
    return Array.from(seen).sort();
  }, [allTasks]);

  const priorityOptions = useMemo(() => {
    const seen = new Set<string>();
    allTasks.forEach(t => {
      const pr = getPriority(t.properties);
      if (pr) seen.add(pr.name);
    });
    return Array.from(seen).sort();
  }, [allTasks]);

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTasks.filter(t => {
      const p = t.properties;

      if (statusGroup !== 'All') {
        const st = getStatus(p);
        if (!st || getStatusGroup(st.name) !== statusGroup) return false;
      }
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
      const due = getDue(p);
      if (dateFrom && due && due < dateFrom) return false;
      if (dateTo && due && due > dateTo) return false;

      return true;
    });
  }, [allTasks, statusGroup, teammate, priority, client, search, dateFrom, dateTo]);

  // Stats from filtered tasks
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

  const hasFilters = dateFrom || dateTo || statusGroup !== 'All' || client || teammate !== 'All' || priority !== 'All' || search;

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatusGroup('All');
    setClient('');
    setTeammate('All');
    setPriority('All');
    setSearch('');
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Task Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track task completion from Notion
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={isLoading ? '—' : stats.total} icon={<ListTodo className="h-5 w-5" />} />
          <StatCard label="Completed" value={isLoading ? '—' : stats.complete} icon={<CheckCircle2 className="h-5 w-5" />} highlight="green" />
          <StatCard label="In Progress" value={isLoading ? '—' : stats.inProgress} icon={<Clock className="h-5 w-5" />} highlight="blue" />
          <StatCard
            label="Completion Rate"
            value={isLoading ? '—' : `${stats.rate}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            highlight="purple"
            sub={stats.total > 0 ? `${stats.complete} of ${stats.total} done` : undefined}
          />
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Due From</p>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Due To</p>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={statusGroup} onValueChange={setStatusGroup}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['All', 'To-do', 'In progress', 'Complete'].map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Client</p>
              <Input
                placeholder="Filter client..."
                value={client}
                onChange={e => setClient(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Teammate</p>
              <Select value={teammate} onValueChange={setTeammate}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {teammateOptions.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Priority</p>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {priorityOptions.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Task table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Tasks</span>
            <div className="flex items-center gap-2">
              {hasMore && (
                <span className="text-xs text-muted-foreground">Showing first 100</span>
              )}
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading tasks from Notion...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No tasks match your filters
            </div>
          ) : (
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
                  {filtered.map(task => {
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
          )}
        </div>
      </div>
    </div>
  );
}

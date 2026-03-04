import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Zap, CheckCircle, XCircle, TrendingDown, Target, AlertTriangle, Shuffle,
  Search, RefreshCw, Filter, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pause_keyword: { label: 'Pause Keyword', icon: TrendingDown, color: 'text-orange-500' },
  pause_ad: { label: 'Pause Ad', icon: XCircle, color: 'text-red-500' },
  pause_campaign: { label: 'Pause Campaign', icon: XCircle, color: 'text-red-600' },
  pause_ad_set: { label: 'Pause Ad Set', icon: XCircle, color: 'text-red-500' },
  adjust_bid: { label: 'Adjust Bid', icon: Target, color: 'text-blue-500' },
  add_negative_keyword: { label: 'Add Negative Keyword', icon: AlertTriangle, color: 'text-yellow-500' },
  change_match_type: { label: 'Change Match Type', icon: Zap, color: 'text-purple-500' },
  reallocate_budget: { label: 'Reallocate Budget', icon: Shuffle, color: 'text-green-500' },
};

const CHANGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Change Types' },
  { value: 'pause_keyword', label: 'Pause Keyword' },
  { value: 'pause_ad', label: 'Pause Ad' },
  { value: 'pause_campaign', label: 'Pause Campaign' },
  { value: 'pause_ad_set', label: 'Pause Ad Set' },
  { value: 'adjust_bid', label: 'Adjust Bid' },
  { value: 'add_negative_keyword', label: 'Add Negative Keyword' },
  { value: 'change_match_type', label: 'Change Match Type' },
  { value: 'reallocate_budget', label: 'Reallocate Budget' },
];

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

interface AuditEntry {
  id: string;
  client_name: string;
  platform: string;
  change_type: string;
  entity_type: string;
  entity_name: string;
  before_value: Record<string, any>;
  after_value: Record<string, any>;
  ai_rationale: string;
  confidence: string;
  expected_impact: string;
  executed_at: string;
  created_at: string;
  execution_error: string | null;
  session_id: string;
}

interface AuditEntryCardProps {
  entry: AuditEntry;
}

function AuditEntryCard({ entry }: AuditEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = CHANGE_TYPE_CONFIG[entry.change_type] || { label: entry.change_type, icon: Zap, color: 'text-primary' };
  const Icon = config.icon;
  const hasError = !!entry.execution_error;

  return (
    <Card className={cn(
      'border transition-all',
      hasError ? 'border-red-500/30 bg-red-500/5' : 'border-purple-500/20 bg-purple-500/5',
    )}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('mt-0.5 shrink-0', config.color)}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{config.label}</span>
                <Badge variant="outline" className={cn(
                  'text-[10px]',
                  entry.platform === 'google'
                    ? 'border-blue-500/30 text-blue-400'
                    : 'border-indigo-400/30 text-indigo-400'
                )}>
                  {entry.platform === 'google' ? '🔵 Google' : '🔷 Meta'}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 gap-1">
                  <Zap className="h-2.5 w-2.5" />
                  Auto-executed
                </Badge>
                {hasError && (
                  <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                    Failed
                  </Badge>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-foreground">{entry.client_name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {entry.executed_at
                    ? new Date(entry.executed_at).toLocaleString()
                    : new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Entity */}
            <p className="text-sm text-foreground font-medium truncate mb-2">{entry.entity_name}</p>
            {entry.entity_type && (
              <p className="text-xs text-muted-foreground capitalize mb-2">{entry.entity_type.replace('_', ' ')}</p>
            )}

            {/* Before / After */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-md bg-red-500/5 border border-red-500/10 p-2">
                <p className="text-[10px] text-red-400 font-semibold mb-1 uppercase tracking-wide">Before</p>
                {Object.entries(entry.before_value || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs gap-1">
                    <span className="text-muted-foreground capitalize">{k.replace('_', ' ')}</span>
                    <span className="font-medium text-foreground">{String(v)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-md bg-green-500/5 border border-green-500/10 p-2">
                <p className="text-[10px] text-green-400 font-semibold mb-1 uppercase tracking-wide">After</p>
                {Object.entries(entry.after_value || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs gap-1">
                    <span className="text-muted-foreground capitalize">{k.replace('_', ' ')}</span>
                    <span className="font-medium text-foreground">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expected impact */}
            {entry.expected_impact && (
              <p className="text-xs text-muted-foreground mb-2 italic">
                Expected: {entry.expected_impact}
              </p>
            )}

            {/* Error */}
            {hasError && (
              <div className="flex items-start gap-1.5 text-xs text-red-400 mb-2">
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Execution error: {entry.execution_error}</span>
              </div>
            )}

            {/* Expandable rationale */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide' : 'Show'} AI Rationale
            </button>

            {expanded && (
              <div className="mt-2 rounded-md bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">{entry.ai_rationale}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AutoModeAuditLogProps {
  clients: string[];
}

export function AutoModeAuditLog({ clients }: AutoModeAuditLogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClient, setFilterClient] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterChangeType, setFilterChangeType] = useState('all');
  const [filterDate, setFilterDate] = useState('30');
  const [search, setSearch] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all auto_approved changes that have been executed
      const { data, error } = await supabase
        .from('ppc_proposed_changes')
        .select('*')
        .eq('approval_status', 'auto_approved')
        .not('executed_at', 'is', null)
        .order('executed_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setEntries((data as any[]) || []);
    } catch (e) {
      console.error('Failed to load audit log:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Apply filters
  const filtered = entries.filter(e => {
    if (filterClient !== 'all' && e.client_name !== filterClient) return false;
    if (filterPlatform !== 'all' && e.platform !== filterPlatform) return false;
    if (filterChangeType !== 'all' && e.change_type !== filterChangeType) return false;
    if (filterDate !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(filterDate));
      const entryDate = new Date(e.executed_at || e.created_at);
      if (entryDate < cutoff) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !e.client_name.toLowerCase().includes(q) &&
        !e.entity_name?.toLowerCase().includes(q) &&
        !e.change_type.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const hasActiveFilters = filterClient !== 'all' || filterPlatform !== 'all' || filterChangeType !== 'all' || filterDate !== '30' || search.trim();

  const clearFilters = () => {
    setFilterClient('all');
    setFilterPlatform('all');
    setFilterChangeType('all');
    setFilterDate('30');
    setSearch('');
  };

  // Stats
  const totalExecuted = filtered.length;
  const failedCount = filtered.filter(e => e.execution_error).length;
  const clientsAffected = new Set(filtered.map(e => e.client_name)).size;
  const changeTypeCounts = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.change_type] = (acc[e.change_type] || 0) + 1;
    return acc;
  }, {});
  const topChangeType = Object.entries(changeTypeCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Auto-executed', value: totalExecuted, color: 'text-purple-400' },
          { label: 'Clients affected', value: clientsAffected, color: 'text-blue-400' },
          { label: 'Failed', value: failedCount, color: failedCount > 0 ? 'text-red-400' : 'text-muted-foreground' },
          { label: 'Top change', value: topChangeType ? CHANGE_TYPE_CONFIG[topChangeType[0]]?.label || topChangeType[0] : '—', color: 'text-green-400' },
        ].map(stat => (
          <Card key={stat.label} className="border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{stat.label}</p>
              <p className={cn('font-bold text-lg leading-none', stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search client, entity..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Client filter */}
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Clients</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Platform filter */}
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
                <SelectItem value="google" className="text-xs">🔵 Google</SelectItem>
                <SelectItem value="meta" className="text-xs">🔷 Meta</SelectItem>
              </SelectContent>
            </Select>

            {/* Change type filter */}
            <Select value={filterChangeType} onValueChange={setFilterChangeType}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="All Change Types" />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date filter */}
            <Select value={filterDate} onValueChange={setFilterDate}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" variant="ghost" onClick={loadEntries} className="h-8 w-8 p-0 shrink-0">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>

            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs gap-1 text-muted-foreground">
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-30" />
          <p className="text-sm">Loading audit log...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No auto-executed changes found</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more results.'
              : 'Enable Auto Mode for a client and run an analysis to start building your audit trail.'}
          </p>
          {hasActiveFilters && (
            <Button size="sm" variant="outline" onClick={clearFilters} className="mt-3 text-xs gap-1">
              <X className="h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span> auto-executed change{filtered.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </p>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">Chronological — newest first</span>
            </div>
          </div>
          <div className="space-y-3">
            {filtered.map(entry => (
              <AuditEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

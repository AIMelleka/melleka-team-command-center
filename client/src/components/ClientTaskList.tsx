import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Users, RefreshCw } from 'lucide-react';

interface ClientTaskCount {
  name: string;
  unfinishedTasks: number;
}

interface CachedData {
  clients: ClientTaskCount[];
  totalUnfinished: number;
  timestamp: number;
}

const CACHE_KEY = 'melleka_client_tasks_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const ClientTaskList = () => {
  const [clients, setClients] = useState<ClientTaskCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalUnfinished, setTotalUnfinished] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Load cached data from localStorage
  const loadFromCache = useCallback((): CachedData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        if (age < CACHE_DURATION_MS) {
          return data;
        }
      }
    } catch (err) {
      console.error('Error loading cache:', err);
    }
    return null;
  }, []);

  // Save data to cache
  const saveToCache = useCallback((clients: ClientTaskCount[], totalUnfinished: number) => {
    try {
      const data: CachedData = {
        clients,
        totalUnfinished,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving cache:', err);
    }
  }, []);

  // Fetch fresh data from Notion
  const fetchClientTasks = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setProgress({ current: 0, total: 1 });

    try {
      // Single request: discover all clients AND get counts in one pass
      const { data, error: fnError } = await supabase.functions.invoke('fetch-notion-tasks', {
        body: {
          discoverClients: true,
        },
      });

      setProgress({ current: 1, total: 1 });

      if (fnError) {
        throw fnError;
      }

      const clientCounts: ClientTaskCount[] = Array.isArray((data as any)?.clientCounts)
        ? (data as any).clientCounts
        : [];

      // Already sorted by count descending from the API
      const total = (data as any)?.totalUnfinished || clientCounts.reduce((sum, c) => sum + c.unfinishedTasks, 0);
      
      setClients(clientCounts);
      setTotalUnfinished(total);
      setLastUpdated(new Date());
      setProgress(null);
      
      // Save to cache
      saveToCache(clientCounts, total);
    } catch (err) {
      console.error('Error fetching client tasks:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        setError('Rate limited by Notion — please try again in a few minutes.');
      } else {
        setError('Failed to load client tasks');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setProgress(null);
    }
  }, [saveToCache]);

  // Initial load - try cache first
  useEffect(() => {
    const cached = loadFromCache();
    if (cached && cached.clients.length > 0) {
      // Use cached data immediately
      setClients(cached.clients);
      setTotalUnfinished(cached.totalUnfinished);
      setLastUpdated(new Date(cached.timestamp));
      setLoading(false);
    } else {
      // No valid cache, fetch fresh data
      fetchClientTasks(false);
    }
  }, [loadFromCache, fetchClientTasks]);

  const handleRefresh = () => {
    fetchClientTasks(true);
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mb-8">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading client tasks from Notion...</span>
          </div>
          {progress && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-genie-purple transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <span>{progress.current}/{progress.total}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    if (error) {
      return (
        <div className="w-full max-w-3xl mb-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
            <button 
              onClick={handleRefresh}
              className="ml-2 p-1 hover:bg-muted rounded"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-3xl mb-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Users className="w-5 h-5" />
          <span className="text-sm">No pending tasks found</span>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-2 p-1 hover:bg-muted rounded disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mb-8">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Users className="w-5 h-5 text-genie-purple" />
        <h2 className="text-lg font-semibold text-foreground">
          Unfinished Tasks
        </h2>
        <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-sm font-medium">
          {totalUnfinished}
        </span>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-2 p-1.5 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
          title="Refresh from Notion"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Last updated timestamp */}
      {lastUpdated && (
        <p className="text-center text-xs text-muted-foreground mb-3">
          Updated {formatLastUpdated(lastUpdated)}
          {refreshing && ' • Refreshing...'}
        </p>
      )}

      {/* Non-blocking error (keep showing cached results) */}
      {error && clients.length > 0 && (
        <p className="text-center text-xs text-destructive mb-2 flex items-center justify-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}

      {/* Progress bar when refreshing */}
      {refreshing && progress && (
        <div className="flex items-center justify-center gap-2 mb-3 text-xs text-muted-foreground">
          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-genie-purple transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <span>{progress.current}/{progress.total}</span>
        </div>
      )}
      
      <div className="flex flex-wrap justify-center gap-2">
        {clients.map((client) => (
          <div
            key={client.name}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-genie-purple/50 transition-colors cursor-pointer"
          >
            <span className="text-sm font-medium text-foreground">{client.name}</span>
            <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-bold min-w-[24px] text-center">
              {client.unfinishedTasks}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientTaskList;

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Users, AlertCircle, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ExternalLink, Zap, Clock, Settings2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';

// Use the Looker Directory sheet as the source of truth for clients
const CLIENT_DIRECTORY_SPREADSHEET_ID = '1t43DRbgSo7pOqKh2DIt7xSsKrN6JgLgLSWAJe92SDQI';

// Cache duration - re-scrape after 24 hours
const CACHE_HOURS = 24;

const normalizeClientKey = (name: string) => (name || '').toLowerCase().trim();

export interface ClientHealthStatus {
  name: string;
  sheetTab: string;
  lookerStatus: 'found' | 'missing' | 'error' | 'checking';
  lookerUrl?: string;
  siteAuditUrl?: string;
  siteErrors?: number | null;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'checking' | 'unknown';
  healthReason?: string;
  lastChecked?: Date;
  lastReviewDate?: Date;
  daysSinceReview?: number;
  // Freshness tracking
  lastScrapedAt?: Date;
  isStale?: boolean;
  // Config completeness
  domain?: string;
  ga4PropertyId?: string;
  configCompleteness?: number;
  missingConfigs?: string[];
  // Health trend
  previousHealthScore?: number;
  healthTrend?: 'up' | 'down' | 'stable';
}

interface ReviewHistoryRecord {
  client_name: string;
  review_date: string;
  platforms: any;
  insights: any;
  summary: string | null;
}

interface SheetRow {
  'Clients Name'?: string;
  'Client Name'?: string;
  'Client'?: string;
  'Name'?: string;
  'Looker Studio URL'?: string;
  'Looker Studio'?: string;
  'Dashboard URL'?: string;
  'SITE AUDIT'?: string;
  'Site Audit'?: string;
}

interface SiteAuditCache {
  client_name: string;
  site_audit_url: string;
  site_errors: number;
  site_warnings: number;
  site_notices: number;
  last_scraped_at: string;
}

interface ClientHealthSidebarProps {
  onSelectClient: (clientName: string, lookerUrl?: string) => void;
  selectedClient?: string;
  /** Optional filter (SEO Bot uses this to show only clients that have a Site Audit URL) */
  filterClients?: (clients: ClientHealthStatus[]) => ClientHealthStatus[];
}

export function ClientHealthSidebar({ onSelectClient, selectedClient, filterClients }: ClientHealthSidebarProps) {
  const [clients, setClients] = useState<ClientHealthStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMassUpdating, setIsMassUpdating] = useState(false);
  const [massUpdateProgress, setMassUpdateProgress] = useState({ current: 0, total: 0 });
  const [lookerDirectory, setLookerDirectory] = useState<Record<string, string>>({});

  // Load cached site errors from database
  const loadCachedSiteErrors = useCallback(async (): Promise<Map<string, { errors: number; warnings: number; lastScraped: Date }>> => {
    try {
      const { data, error } = await supabase
        .from('site_audit_cache')
        .select('client_name, site_errors, site_warnings, last_scraped_at');
      
      if (error) {
        console.error('Error loading cached site errors:', error);
        return new Map();
      }
      
      const cache = new Map<string, { errors: number; warnings: number; lastScraped: Date }>();
      for (const row of data || []) {
        // Store with lowercase key for matching, but keep actual values
        cache.set(normalizeClientKey(row.client_name), {
          errors: row.site_errors || 0,
          warnings: row.site_warnings || 0,
          lastScraped: new Date(row.last_scraped_at)
        });
      }
      console.log(`Loaded ${cache.size} cached site audits from database`);
      return cache;
    } catch (error) {
      console.error('Error loading site audit cache:', error);
      return new Map();
    }
  }, []);

  // Save site errors to cache
  const saveSiteErrorsToCache = useCallback(async (
    clientName: string,
    siteAuditUrl: string,
    errors: number,
    warnings: number = 0
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('site_audit_cache')
        .upsert({
          client_name: clientName,
          site_audit_url: siteAuditUrl,
          site_errors: errors,
          site_warnings: warnings,
          last_scraped_at: new Date().toISOString()
        }, {
          onConflict: 'client_name'
        });
      
      if (error) {
        console.error('Error saving to cache:', error);
      }
    } catch (error) {
      console.error('Error saving site audit cache:', error);
    }
  }, []);

  // Load clients and Looker URLs from the directory sheet
  const loadClientsFromDirectory = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-google-sheet', {
        body: { spreadsheetId: CLIENT_DIRECTORY_SPREADSHEET_ID, sheetName: 'Sheet1' },
      });
      if (error) throw error;

      const clientsMap: Map<string, { name: string; lookerUrl?: string; siteAuditUrl?: string; domain?: string; ga4PropertyId?: string; configCompleteness: number; missingConfigs: string[] }> = new Map();
      
      if (data?.rows?.length > 0) {
        for (const row of data.rows as SheetRow[]) {
          const name = row['Clients Name'] || row['Client Name'] || row['Client'] || row['Name'] || '';
          const url = row['Looker Studio URL'] || row['Looker Studio'] || row['Dashboard URL'] || '';
          const siteAudit = row['SITE AUDIT'] || row['Site Audit'] || '';
          const domainRaw = (row as any)['URL Domain'] || (row as any)['Domain'] || (row as any)['Website'] || '';
          const ga4Raw = (row as any)['GA4 Property ID'] || (row as any)['GA4 ID'] || (row as any)['GA4'] || '';
          
          if (name && name.trim()) {
            const cleanName = name.trim();
            const urlStr = (url || '').toString().trim();
            const siteAuditStr = (siteAudit || '').toString().trim();
            const hasLooker = urlStr.toLowerCase().includes('lookerstudio.google.com');
            const hasSiteAudit = siteAuditStr.toLowerCase().includes('myinsights.io');
            const domain = domainRaw ? domainRaw.toString().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim() : undefined;
            const ga4PropertyId = ga4Raw ? ga4Raw.toString().replace(/[^0-9]/g, '') : undefined;
            
            // Calculate config completeness
            const missingConfigs: string[] = [];
            if (!domain) missingConfigs.push('domain');
            if (!hasLooker) missingConfigs.push('looker_url');
            if (!hasSiteAudit) missingConfigs.push('site_audit_url');
            if (!ga4PropertyId) missingConfigs.push('ga4_property_id');
            const configCompleteness = Math.round(((4 - missingConfigs.length) / 4) * 100);
            
            clientsMap.set(normalizeClientKey(cleanName), {
              name: cleanName,
              lookerUrl: hasLooker ? urlStr : undefined,
              siteAuditUrl: hasSiteAudit ? siteAuditStr : undefined,
              domain,
              ga4PropertyId,
              configCompleteness,
              missingConfigs,
            });
          }
        }
      }
      
      return clientsMap;
    } catch (error) {
      console.error('Error loading client directory:', error);
      return new Map();
    }
  }, []);

  // Fetch review history from database
  const fetchReviewHistory = useCallback(async (): Promise<Map<string, ReviewHistoryRecord>> => {
    try {
      const { data, error } = await supabase
        .from('ad_review_history')
        .select('client_name, review_date, platforms, insights, summary')
        .order('review_date', { ascending: false });

      if (error) throw error;

      // Get the most recent review for each client
      const latestReviews = new Map<string, ReviewHistoryRecord>();
      for (const review of data || []) {
        const key = normalizeClientKey(review.client_name);
        if (!latestReviews.has(key)) {
          latestReviews.set(key, review);
        }
      }

      return latestReviews;
    } catch (error) {
      console.error('Error fetching review history:', error);
      return new Map();
    }
  }, []);

  // Determine health status based on review data
  const determineHealthStatus = (
    client: { name: string; lookerUrl?: string },
    review: ReviewHistoryRecord | undefined
  ): { status: ClientHealthStatus['healthStatus']; reason: string; daysSince?: number; lastReview?: Date } => {
    // No Looker dashboard = Unknown
    if (!client.lookerUrl) {
      return { status: 'unknown', reason: 'No dashboard linked' };
    }

    // No review history = Warning (needs first review)
    if (!review) {
      return { status: 'warning', reason: 'Never reviewed - needs initial analysis' };
    }

    const reviewDate = new Date(review.review_date);
    const daysSinceReview = differenceInDays(new Date(), reviewDate);

    // Check platform health from the review
    let platformIssues = 0;
    let totalPlatforms = 0;
    
    if (review.platforms && Array.isArray(review.platforms)) {
      for (const platform of review.platforms as any[]) {
        totalPlatforms++;
        if (platform.health === 'critical') {
          platformIssues += 2;
        } else if (platform.health === 'warning') {
          platformIssues += 1;
        }
      }
    }

    // Check insights for critical issues
    let criticalInsights = 0;
    let warningInsights = 0;
    
    if (review.insights && Array.isArray(review.insights)) {
      for (const insight of review.insights as any[]) {
        if (insight.type === 'warning' || insight.type === 'action') {
          if (insight.impact === 'high') {
            criticalInsights++;
          } else {
            warningInsights++;
          }
        }
      }
    }

    // Determine status based on multiple factors
    // Critical: 14+ days without review OR multiple critical platform issues
    if (daysSinceReview > 14) {
      return { 
        status: 'critical', 
        reason: `${daysSinceReview} days since last review`, 
        daysSince: daysSinceReview,
        lastReview: reviewDate 
      };
    }

    if (platformIssues >= 3 || criticalInsights >= 2) {
      return { 
        status: 'critical', 
        reason: 'Multiple performance issues detected', 
        daysSince: daysSinceReview,
        lastReview: reviewDate 
      };
    }

    // Warning: 7-14 days without review OR some issues
    if (daysSinceReview > 7) {
      return { 
        status: 'warning', 
        reason: `${daysSinceReview} days since last review`, 
        daysSince: daysSinceReview,
        lastReview: reviewDate 
      };
    }

    if (platformIssues >= 1 || warningInsights >= 2) {
      return { 
        status: 'warning', 
        reason: 'Minor issues need attention', 
        daysSince: daysSinceReview,
        lastReview: reviewDate 
      };
    }

    // Healthy: Recent review with no major issues
    return { 
      status: 'healthy', 
      reason: `Reviewed ${daysSinceReview === 0 ? 'today' : daysSinceReview === 1 ? 'yesterday' : `${daysSinceReview} days ago`}`, 
      daysSince: daysSinceReview,
      lastReview: reviewDate 
    };
  };

  // Fetch site errors from myinsights.io dashboard using AI vision analysis
  const fetchSiteErrors = useCallback(async (auditUrl: string, clientName?: string): Promise<{ errors: number; warnings: number; notices?: number } | null> => {
    try {
      // Use the new AI-powered site audit analyzer
      const { data, error } = await supabase.functions.invoke('analyze-site-audit', {
        body: { url: auditUrl, clientName },
      });
      
      if (error) {
        console.error('Site audit analysis failed:', error);
        return null;
      }
      
      if (data?.success) {
        console.log(`Site audit for ${clientName}: ${data.errors} errors, ${data.warnings} warnings, ${data.notices} notices (method: ${data.analysisMethod})`);
        return { 
          errors: data.errors || 0, 
          warnings: data.warnings || 0,
          notices: data.notices || 0
        };
      }
      
      console.log('Site audit analysis returned no data for:', auditUrl);
      return null;
    } catch (error) {
      console.error('Error fetching site errors:', error);
      return null;
    }
  }, []);

  // Load all clients and check their health
  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch directory, review history, and cached errors in parallel
      const [clientsMap, reviewHistory, cachedErrors] = await Promise.all([
        loadClientsFromDirectory(),
        fetchReviewHistory(),
        loadCachedSiteErrors()
      ]);
      
      // Build client list with health status and cached error data
      const clientList: ClientHealthStatus[] = Array.from(clientsMap.values()).map(client => {
        const reviewKey = normalizeClientKey(client.name);
        const review = reviewHistory.get(reviewKey);
        const healthResult = determineHealthStatus(client, review);
        const cached = cachedErrors.get(reviewKey);
        
        // Use just ERRORS (not warnings) from cache
        const siteErrorsOnly = cached ? cached.errors : null;
        
        // Calculate freshness
        const lastScrapedAt = cached?.lastScraped;
        const hoursSinceUpdate = lastScrapedAt 
          ? differenceInHours(new Date(), lastScrapedAt) 
          : undefined;
        const isStale = hoursSinceUpdate !== undefined && hoursSinceUpdate > CACHE_HOURS;
        
        if (cached) {
          console.log(`Loaded cached errors for ${client.name}: ${cached.errors} errors, last updated ${hoursSinceUpdate}h ago${isStale ? ' (STALE)' : ''}`);
        }

        return {
          name: client.name,
          sheetTab: client.name,
          lookerStatus: client.lookerUrl ? 'found' : 'missing',
          lookerUrl: client.lookerUrl,
          siteAuditUrl: client.siteAuditUrl,
          siteErrors: siteErrorsOnly,
          healthStatus: healthResult.status,
          healthReason: healthResult.reason,
          lastChecked: new Date(),
          lastReviewDate: healthResult.lastReview,
          daysSinceReview: healthResult.daysSince,
          // New fields
          lastScrapedAt,
          isStale,
          domain: client.domain,
          ga4PropertyId: client.ga4PropertyId,
          configCompleteness: client.configCompleteness,
          missingConfigs: client.missingConfigs,
        };
      });

      // Apply optional filter (SEO Bot wants ONLY clients that have a SITE AUDIT link)
      const filteredClientList = filterClients ? filterClients(clientList) : clientList;

      // Sort and set clients initially (with cached data)
      setClients(sortClientsByHealth(filteredClientList));
      
      // Build looker directory for reference
      const directory: Record<string, string> = {};
      clientsMap.forEach((client, key) => {
        if (client.lookerUrl) {
          directory[key] = client.lookerUrl;
        }
      });
      setLookerDirectory(directory);
      
      // Find clients that need fresh scraping (no cache or cache > 24 hours old)
      const clientsNeedingScrape = filteredClientList.filter(c => {
        if (!c.siteAuditUrl) return false;
        const cached = cachedErrors.get(normalizeClientKey(c.name));
        if (!cached) return true; // No cache, needs scrape
        const hoursSinceCache = differenceInHours(new Date(), cached.lastScraped);
        return hoursSinceCache >= CACHE_HOURS;
      });
      
      // Scrape stale clients in background (limit to 5 at a time)
      if (clientsNeedingScrape.length > 0) {
        console.log(`Scraping ${clientsNeedingScrape.length} clients with stale/missing cache...`);
        const batchSize = 5;
        for (let i = 0; i < clientsNeedingScrape.length; i += batchSize) {
          const batch = clientsNeedingScrape.slice(i, i + batchSize);
          const errorPromises = batch.map(async (client) => {
            if (!client.siteAuditUrl) return { name: client.name, errors: null, warnings: 0 };
            // The new analyze-site-audit function saves to cache automatically
            const result = await fetchSiteErrors(client.siteAuditUrl, client.name);
            
            return { 
              name: client.name, 
              errors: result ? result.errors : null 
            };
          });
          
          const results = await Promise.all(errorPromises);
          
          // Update clients with freshly scraped error counts
          setClients(prev => {
            const updated = prev.map(c => {
              const result = results.find(r => r.name === c.name);
              if (result && result.errors !== null) {
                return { ...c, siteErrors: result.errors };
              }
              return c;
            });
            return sortClientsByHealth(updated);
          });
        }
      }
      
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadClientsFromDirectory, fetchReviewHistory, loadCachedSiteErrors, fetchSiteErrors, saveSiteErrorsToCache, filterClients]);

  // Sort clients - most overdue ad review first, then by health status
  const sortClientsByHealth = (clientList: ClientHealthStatus[]): ClientHealthStatus[] => {
    return [...clientList].sort((a, b) => {
      // Clients with no review ever are most overdue — treat as Infinity
      const aDays = a.daysSinceReview ?? Infinity;
      const bDays = b.daysSinceReview ?? Infinity;
      if (aDays !== bDays) return bDays - aDays; // Higher days first (most overdue)

      // Then by health status
      const order: Record<string, number> = {
        'critical': 0,
        'warning': 1,
        'checking': 2,
        'unknown': 3,
        'healthy': 4,
      };
      const orderA = order[a.healthStatus] ?? 5;
      const orderB = order[b.healthStatus] ?? 5;
      if (orderA !== orderB) return orderA - orderB;

      return a.name.localeCompare(b.name);
    });
  };

  // Sequential quality check - go through each client one by one
  const handleRefresh = async () => {
    const clientsToCheck = clients.filter(c => c.siteAuditUrl && c.siteAuditUrl.trim() !== '');
    if (clientsToCheck.length === 0) {
      // Fall back to just reloading directory if no auditable clients
      setIsRefreshing(true);
      await loadClients();
      setIsRefreshing(false);
      return;
    }
    
    setIsRefreshing(true);
    setMassUpdateProgress({ current: 0, total: clientsToCheck.length });
    
    console.log(`Starting sequential quality check for ${clientsToCheck.length} clients...`);
    
    // Process clients ONE BY ONE for quality (not batched for speed)
    for (let i = 0; i < clientsToCheck.length; i++) {
      const client = clientsToCheck[i];
      
      // Update progress to show which client is being checked
      setMassUpdateProgress({ current: i, total: clientsToCheck.length });
      
      // Mark this client as "checking" in the UI
      setClients(prev => prev.map(c => 
        c.name === client.name ? { ...c, healthStatus: 'checking' as const } : c
      ));
      
      console.log(`[${i + 1}/${clientsToCheck.length}] Checking: ${client.name}`);
      
      if (client.siteAuditUrl) {
        const result = await fetchSiteErrors(client.siteAuditUrl, client.name);
        
        // Update this client with the result and restore health status
        setClients(prev => {
          const updated = prev.map(c => {
            if (c.name === client.name) {
              const newErrors = result ? result.errors : c.siteErrors;
              // Recalculate health based on errors
              let newHealth: ClientHealthStatus['healthStatus'] = c.healthStatus;
              if (c.healthStatus === 'checking') {
                // Restore based on days since review or error count
                if (c.daysSinceReview && c.daysSinceReview > 14) {
                  newHealth = 'critical';
                } else if (c.daysSinceReview && c.daysSinceReview > 7) {
                  newHealth = 'warning';
                } else if (newErrors != null && newErrors > 200) {
                  newHealth = 'critical';
                } else if (newErrors != null && newErrors > 50) {
                  newHealth = 'warning';
                } else if (c.lookerUrl) {
                  newHealth = c.daysSinceReview != null ? 'healthy' : 'warning';
                } else {
                  newHealth = 'unknown';
                }
              }
              return { ...c, siteErrors: newErrors, healthStatus: newHealth };
            }
            return c;
          });
          return sortClientsByHealth(updated);
        });
      }
      
      // Small delay between clients to avoid rate limiting and allow UI to update
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final progress update
    setMassUpdateProgress({ current: clientsToCheck.length, total: clientsToCheck.length });
    
    console.log('Sequential quality check complete!');
    setIsRefreshing(false);
    setMassUpdateProgress({ current: 0, total: 0 });
  };

  // Mass update - force scrape all clients (ignores cache)
  const handleMassUpdate = async () => {
    const clientsToScrape = clients.filter(c => c.siteAuditUrl && c.siteAuditUrl.trim() !== '');
    if (clientsToScrape.length === 0) return;
    
    setIsMassUpdating(true);
    setMassUpdateProgress({ current: 0, total: clientsToScrape.length });
    
    console.log(`Starting mass update for ${clientsToScrape.length} clients...`);
    
    // Collect all results
    const allResults: Array<{ name: string; errors: number | null }> = [];
    
    // Process all clients in batches of 3 (to avoid rate limiting)
    const batchSize = 3;
    for (let i = 0; i < clientsToScrape.length; i += batchSize) {
      const batch = clientsToScrape.slice(i, i + batchSize);
      
      const errorPromises = batch.map(async (client) => {
        if (!client.siteAuditUrl) return { name: client.name, errors: null };
        // The new analyze-site-audit function saves to cache automatically
        const result = await fetchSiteErrors(client.siteAuditUrl, client.name);
        
        return { 
          name: client.name, 
          errors: result ? result.errors : null 
        };
      });
      
      const batchResults = await Promise.all(errorPromises);
      allResults.push(...batchResults);
      
      // Update progress
      const completedCount = Math.min(i + batchSize, clientsToScrape.length);
      setMassUpdateProgress({ current: completedCount, total: clientsToScrape.length });
      
      // Update clients with scraped error counts and re-sort after each batch
      setClients(prev => {
        const updated = prev.map(c => {
          const result = batchResults.find(r => r.name === c.name);
          if (result && result.errors !== null) {
            return { ...c, siteErrors: result.errors };
          }
          return c;
        });
        // Sort the updated list
        return sortClientsByHealth(updated);
      });
    }
    
    // Final sort with all results
    setClients(prev => {
      const updated = prev.map(c => {
        const result = allResults.find(r => r.name === c.name);
        if (result && result.errors !== null) {
          return { ...c, siteErrors: result.errors };
        }
        return c;
      });
      console.log('Final sorting after mass update. Sample errors:', updated.slice(0, 5).map(c => ({ name: c.name, errors: c.siteErrors })));
      return sortClientsByHealth(updated);
    });
    
    setIsMassUpdating(false);
    setMassUpdateProgress({ current: 0, total: 0 });
    console.log('Mass update complete!');
  };

  // Load on mount
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Get badge for health status
  const getHealthBadge = (status: ClientHealthStatus['healthStatus']) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-medium px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30 text-[11px] font-medium px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Warning
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-destructive/20 text-destructive border border-destructive/30 text-[11px] font-medium px-2 py-0.5">
            <XCircle className="h-3 w-3 mr-1" />
            Critical
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0.5">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Checking
          </Badge>
        );
      case 'unknown':
        return (
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  // Count by status and errors
  const clientsWithAudit = clients.filter(c => c.siteAuditUrl);
  const highErrorCount = clientsWithAudit.filter(c => (c.siteErrors ?? 0) > 200).length;
  const mediumErrorCount = clientsWithAudit.filter(c => (c.siteErrors ?? 0) > 50 && (c.siteErrors ?? 0) <= 200).length;
  const lowErrorCount = clientsWithAudit.filter(c => (c.siteErrors ?? 0) <= 50 && c.siteErrors != null).length;

  return (
    <Card className="h-full min-h-[600px]">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5" />
            Clients
            <Badge variant="secondary" className="text-xs ml-1">
              {clients.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading || isMassUpdating}
              title="Quality check all clients"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Progress indicator during refresh */}
        {isRefreshing && massUpdateProgress.total > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Quality checking clients...</span>
              <span className="font-medium">{massUpdateProgress.current + 1}/{massUpdateProgress.total}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${((massUpdateProgress.current + 1) / massUpdateProgress.total) * 100}%` }}
              />
            </div>
            {clients.find(c => c.healthStatus === 'checking') && (
              <p className="text-xs text-primary font-medium truncate">
                Checking: {clients.find(c => c.healthStatus === 'checking')?.name}
              </p>
            )}
          </div>
        )}
        
        {/* Mass Update Button */}
        <Button 
          variant="default"
          size="sm"
          className="w-full mt-3"
          onClick={handleMassUpdate}
          disabled={isMassUpdating || isLoading || clientsWithAudit.length === 0}
        >
          {isMassUpdating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Updating {massUpdateProgress.current}/{massUpdateProgress.total}...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Mass Update All Errors ({clientsWithAudit.length})
            </>
          )}
        </Button>
        
      </CardHeader>
      
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin mb-3" />
            <p className="text-sm font-medium">Loading clients...</p>
            <p className="text-xs text-muted-foreground mt-1">Checking review history</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No clients found</p>
            <p className="text-xs mt-1">Check the connected spreadsheet</p>
          </div>
        ) : (
          <ScrollArea className="h-[520px]">
            <div className="p-3 space-y-2">
              {clients.map((client) => (
                <button
                  key={client.name}
                  onClick={() => onSelectClient(client.name, client.lookerUrl)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    selectedClient === client.name 
                      ? 'border-primary bg-primary/10 shadow-sm' 
                      : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Client Name & Health Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <p className="font-semibold text-base text-foreground leading-tight truncate">
                          {client.name}
                        </p>
                        {/* Health Trend Indicator */}
                        {client.healthTrend === 'up' && (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        {client.healthTrend === 'down' && (
                          <TrendingDown className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getHealthBadge(client.healthStatus)}
                        
                        {/* Freshness Badge */}
                        {client.lastScrapedAt && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] px-1.5 py-0 h-5 ${
                                    client.isStale 
                                      ? 'border-amber-500/50 text-amber-600' 
                                      : 'border-border text-muted-foreground'
                                  }`}
                                >
                                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                                  {formatDistanceToNow(client.lastScrapedAt, { addSuffix: false })}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{client.isStale ? '⚠️ Stale data - ' : 'Updated '}{formatDistanceToNow(client.lastScrapedAt, { addSuffix: true })}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {/* Config Completeness Warning */}
                        {client.configCompleteness !== undefined && client.configCompleteness < 100 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] px-1.5 py-0 h-5 border-amber-500/50 text-amber-600"
                                >
                                  <Settings2 className="h-2.5 w-2.5 mr-0.5" />
                                  {client.configCompleteness}%
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium mb-1">Missing Configuration:</p>
                                <ul className="text-xs space-y-0.5">
                                  {client.missingConfigs?.map(m => (
                                    <li key={m}>• {m === 'domain' ? 'Domain' : m === 'looker_url' ? 'Looker URL' : m === 'site_audit_url' ? 'Site Audit' : m === 'ga4_property_id' ? 'GA4 ID' : m}</li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>

                    {/* Days Since Ad Review - Main Metric */}
                    <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[56px] shrink-0 ${
                      client.daysSinceReview == null
                        ? 'bg-muted border border-border'
                        : client.daysSinceReview > 14
                          ? 'bg-destructive/15 border border-destructive/30'
                          : client.daysSinceReview > 7
                            ? 'bg-amber-500/15 border border-amber-500/30'
                            : 'bg-emerald-500/15 border border-emerald-500/30'
                    }`}>
                      <span className={`text-lg font-bold leading-none ${
                        client.daysSinceReview == null
                          ? 'text-muted-foreground'
                          : client.daysSinceReview > 14
                            ? 'text-destructive'
                            : client.daysSinceReview > 7
                              ? 'text-amber-600 dark:text-amber-500'
                              : 'text-emerald-600 dark:text-emerald-500'
                      }`}>
                        {client.daysSinceReview != null ? client.daysSinceReview : '—'}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">days ago</span>
                    </div>
                  </div>
                  
                  {/* Health Reason */}
                  {client.healthReason && (
                    <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                      {client.healthReason}
                    </p>
                  )}
                  
                  {/* Quick actions - Site Audit link */}
                  {client.siteAuditUrl && (
                    <div className="flex gap-3 mt-3 pt-2 border-t border-border/50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(client.siteAuditUrl, '_blank');
                        }}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Site Audit
                      </button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

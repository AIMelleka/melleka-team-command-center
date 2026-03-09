import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, Target, DollarSign, Calendar, RefreshCw, Settings2, ChevronDown, ChevronUp, Save, Database, CheckCircle2, Circle, AlertCircle, Search, History, Award, Zap, ExternalLink, Sparkles, Link2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { useAdReviewHistory } from '@/hooks/useAdReviewHistory';
import { AdReviewHistory } from '@/components/AdReviewHistory';
import { AdReviewBenchmarks } from '@/components/AdReviewBenchmarks';
import { AdReviewSeoInsights } from '@/components/AdReviewSeoInsights';
import { ClientHealthSidebar } from '@/components/ClientHealthSidebar';
import { AdReviewExecutiveSummary } from '@/components/AdReviewExecutiveSummary';
import { detectIndustry, getIndustryBenchmark, INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK, type IndustryBenchmark } from '@/data/industryBenchmarks';
import { findBestMatches, type MatchResult } from '@/lib/fuzzyMatch';

// Spreadsheet ID for ad updates (configurable via env var for multi-agency deployment)
const CONNECTED_SPREADSHEET_ID = import.meta.env.VITE_AD_UPDATES_SPREADSHEET_ID || '';

// Cache
let sheetTabsCache: string[] | null = null;
let lookerDirectoryCache: Record<string, string> | null = null;
let ga4DirectoryCache: Record<string, string> | null = null;
let domainDirectoryCache: Record<string, string> | null = null;

interface AdAnalysis {
  summary: string;
  platforms: {
    name: string;
    spend: string;
    impressions: string;
    clicks: string;
    conversions: string;
    leads?: string;
    cpc: string;
    ctr: string;
    roas: string;
    conversionRate?: string;
    costPerLead?: string;
    costPerConversion?: string;
    trend: 'up' | 'down' | 'stable';
    health: 'good' | 'warning' | 'critical';
    vsBenchmark?: 'above' | 'at' | 'below';
    cplVsBenchmark?: 'above' | 'at' | 'below';
    cpaVsBenchmark?: 'above' | 'at' | 'below';
  }[];
  insights: {
    type: 'positive' | 'warning' | 'action' | 'opportunity';
    title: string;
    description: string;
    impact?: 'high' | 'medium' | 'low';
  }[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    platform: string;
    effort?: 'quick-win' | 'medium' | 'strategic';
    timeline?: string;
  }[];
  weekOverWeek: {
    metric: string;
    change: number;
    direction: 'up' | 'down';
    isGood?: boolean;
  }[];
  crossPlatformSynergies?: {
    opportunity: string;
    platforms: string[];
    action: string;
  }[];
  benchmarkAnalysis?: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
  };
  historicalComparison?: {
    improved: string[];
    declined: string[];
    unchanged: string[];
  };
  cplCpaAnalysis?: {
    overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    googleCpl?: number;
    googleCpa?: number;
    metaCpl?: number;
    metaCpa?: number;
    googleCplVsBenchmark?: 'above' | 'at' | 'below';
    metaCplVsBenchmark?: 'above' | 'at' | 'below';
    googleCpaVsBenchmark?: 'above' | 'at' | 'below';
    metaCpaVsBenchmark?: 'above' | 'at' | 'below';
    primaryConcerns?: string[];
    quickWins?: string[];
  };
}

interface DataSourceStatus {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'success' | 'error' | 'not-found' | 'warning';
  message?: string;
  data?: string;
}

interface PaidAdData {
  domain: string;
  paidKeywords?: number;
  paidTraffic?: number;
  paidTrafficCost?: number;
  topPaidKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    cpc: number;
    trafficPercent: number;
  }>;
  paidCompetitors?: Array<{
    domain: string;
    commonKeywords: number;
    paidKeywords?: number;
    paidTraffic?: number;
  }>;
  adHistory?: {
    hasActiveAds: boolean;
    estimatedMonthlySpend?: number;
  };
}

interface GA4Data {
  propertyId: string;
  dateRange: { start: string; end: string };
  overview: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    engagementRate: number;
  };
  trafficSources: Array<{
    source: string;
    medium: string;
    sessions: number;
    conversions: number;
    revenue: number;
  }>;
  campaigns: Array<{
    campaign: string;
    source: string;
    medium: string;
    sessions: number;
    users: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }>;
  conversions: Array<{
    eventName: string;
    count: number;
    value: number;
  }>;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
}

const AdReview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Client input — pre-populated from ?client= URL param
  const [clientName, setClientName] = useState(() => searchParams.get('client') || '');
  const [clientDomain, setClientDomain] = useState('');
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  
  // Date range
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  
  // Custom aliases
  const [customAliases, setCustomAliases] = useState(() => {
    const saved = localStorage.getItem('ad-review-custom-aliases');
    return saved || '';
  });
  const [aliasesSaved, setAliasesSaved] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [analysis, setAnalysis] = useState<AdAnalysis | null>(null);
  const [lastSavedReviewId, setLastSavedReviewId] = useState<string | null>(null);
  
  // Data sources — Supermetrics is now first-class
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([
    { id: 'supermetrics', label: 'Supermetrics (Live Ad Data)', status: 'idle' },
    { id: 'google-sheets', label: 'Google Sheets (Ad Updates)', status: 'idle' },
    { id: 'looker-studio', label: 'Looker Studio', status: 'idle' },
    { id: 'semrush', label: 'Semrush Paid Ads Intelligence', status: 'idle' },
    { id: 'google-analytics', label: 'Google Analytics 4', status: 'idle' },
  ]);
  
  // Supermetrics live data
  const [supermetricsData, setSupermetricsData] = useState<Record<string, any> | null>(null);
  
  // Paid Ad Data, GA4 & Benchmarks
  const [paidAdData, setPaidAdData] = useState<PaidAdData | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);
  const [detectedIndustry, setDetectedIndustry] = useState<IndustryBenchmark>(DEFAULT_BENCHMARK);
  const [lookerUrl, setLookerUrl] = useState<string | null>(null);
  
  // Smart suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [allClientNames, setAllClientNames] = useState<string[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // History hook
  const { 
    history, 
    previousReview, 
    isLoading: isLoadingHistory,
    saveReview,
    updateNotes,
    recordChange,
    compareWithPrevious 
  } = useAdReviewHistory(clientName);

  // Load caches on mount and build client list from Client Directory (managed_clients)
  useEffect(() => {
    const initializeData = async () => {
      if (CONNECTED_SPREADSHEET_ID) await loadSheetTabs();
      await loadLookerDirectory();

      // Build client list from Client Directory (managed_clients) only
      const nameMap = new Map<string, string>();

      // Client Directory names are the source of truth
      const directoryNames = Object.keys(lookerDirectoryCache || {});
      const ga4Names = Object.keys(ga4DirectoryCache || {});
      const domainNames = Object.keys(domainDirectoryCache || {});

      for (const name of [...directoryNames, ...ga4Names, ...domainNames]) {
        const lowerName = name.toLowerCase().trim();
        if (lowerName.length > 1 && !nameMap.has(lowerName)) {
          nameMap.set(lowerName, name);
        }
      }

      setAllClientNames([...nameMap.values()]);
    };

    initializeData();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Update suggestions when client name changes
  useEffect(() => {
    if (clientName.length >= 2 && allClientNames.length > 0) {
      const matches = findBestMatches(
        clientName,
        allClientNames,
        {
          lookerUrls: lookerDirectoryCache || {},
          ga4Ids: ga4DirectoryCache || {},
          domains: domainDirectoryCache || {}
        },
        8
      );
      setClientSuggestions(matches);
      
      // Auto-select top match if confidence is high
      if (matches.length > 0 && matches[0].confidence === 'high') {
        setSelectedMatch(matches[0]);
      } else {
        setSelectedMatch(null);
      }
    } else {
      setClientSuggestions([]);
      setSelectedMatch(null);
    }
  }, [clientName, allClientNames]);

  const loadSheetTabs = async () => {
    if (!CONNECTED_SPREADSHEET_ID) return [];
    if (sheetTabsCache) return sheetTabsCache;
    try {
      const { data, error } = await supabase.functions.invoke('fetch-google-sheet', {
        body: { spreadsheetId: CONNECTED_SPREADSHEET_ID },
      });
      if (error) throw error;
      sheetTabsCache = data.sheetNames || [];
      return sheetTabsCache;
    } catch (error) {
      console.error('Error loading sheet tabs:', error);
      return [];
    }
  };

  const loadLookerDirectory = async () => {
    if (lookerDirectoryCache && ga4DirectoryCache && domainDirectoryCache) {
      return { looker: lookerDirectoryCache, ga4: ga4DirectoryCache, domain: domainDirectoryCache };
    }
    try {
      const { data, error } = await supabase
        .from('managed_clients')
        .select('client_name, looker_url, ga4_property_id, domain')
        .eq('is_active', true);
      if (error) throw error;

      const lookerDir: Record<string, string> = {};
      const ga4Dir: Record<string, string> = {};
      const domainDir: Record<string, string> = {};

      for (const mc of data || []) {
        const normalizedName = mc.client_name.toLowerCase().trim();
        const baseName = mc.client_name.split(' - ')[0].trim().toLowerCase();

        if ((mc as any).looker_url) {
          lookerDir[normalizedName] = (mc as any).looker_url;
          if (baseName !== normalizedName) lookerDir[baseName] = (mc as any).looker_url;
        }
        if (mc.ga4_property_id) {
          ga4Dir[normalizedName] = mc.ga4_property_id;
          if (baseName !== normalizedName) ga4Dir[baseName] = mc.ga4_property_id;
        }
        if (mc.domain) {
          domainDir[normalizedName] = mc.domain;
          if (baseName !== normalizedName) domainDir[baseName] = mc.domain;
        }
      }

      lookerDirectoryCache = lookerDir;
      ga4DirectoryCache = ga4Dir;
      domainDirectoryCache = domainDir;

      return { looker: lookerDir, ga4: ga4Dir, domain: domainDir };
    } catch (error) {
      console.error('Error loading directory:', error);
      return { looker: {}, ga4: {}, domain: {} };
    }
  };

  const generateClientAliases = (clientName: string): string[] => {
    const name = clientName.toLowerCase().trim();
    const aliases = new Set<string>();
    aliases.add(name);
    
    if (customAliases.trim()) {
      customAliases.split(/[,\n]+/).map(a => a.trim().toLowerCase()).filter(Boolean).forEach(alias => aliases.add(alias));
    }
    
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      aliases.add(words.map(w => w[0]).join(""));
      if (words.length >= 2) {
        aliases.add(words.slice(0, 2).join(" "));
        aliases.add(words.slice(0, 2).join(""));
      }
      aliases.add(words[0]);
      words.forEach(w => { if (w.length >= 3) aliases.add(w); });
    }
    
    aliases.add(name.replace(/\s+/g, "-"));
    aliases.add(name.replace(/\s+/g, "_"));
    aliases.add(name.replace(/\s+/g, ""));
    
    return [...aliases].filter(Boolean);
  };

  const handleAliasesChange = (value: string) => {
    setCustomAliases(value);
    setAliasesSaved(false);
  };

  const saveAliases = () => {
    localStorage.setItem('ad-review-custom-aliases', customAliases);
    setAliasesSaved(true);
    toast({ title: 'Aliases saved!', description: 'Your custom abbreviations have been saved.' });
  };

  const findBestSheetMatch = (clientName: string, tabs: string[]): string | null => {
    const aliases = generateClientAliases(clientName);
    for (const alias of aliases) {
      const exactMatch = tabs.find(tab => tab.toLowerCase().trim() === alias);
      if (exactMatch) return exactMatch;
    }
    for (const alias of aliases) {
      const partialMatch = tabs.find(tab => {
        const tabLower = tab.toLowerCase().trim();
        return tabLower.includes(alias) || alias.includes(tabLower);
      });
      if (partialMatch) return partialMatch;
    }
    return null;
  };

  const findLookerUrl = (clientName: string): string => {
    if (!lookerDirectoryCache) return '';
    const aliases = generateClientAliases(clientName);
    for (const alias of aliases) {
      if (lookerDirectoryCache[alias]) return lookerDirectoryCache[alias];
    }
    for (const alias of aliases) {
      for (const [key, url] of Object.entries(lookerDirectoryCache)) {
        if (key.includes(alias) || alias.includes(key)) return url;
      }
    }
    return '';
  };

  const findGA4PropertyId = (clientName: string): string => {
    if (!ga4DirectoryCache) return '';
    const aliases = generateClientAliases(clientName);
    for (const alias of aliases) {
      if (ga4DirectoryCache[alias]) return ga4DirectoryCache[alias];
    }
    for (const alias of aliases) {
      for (const [key, id] of Object.entries(ga4DirectoryCache)) {
        if (key.includes(alias) || alias.includes(key)) return id;
      }
    }
    return '';
  };

  const findClientDomain = (clientName: string): string => {
    if (!domainDirectoryCache) return '';
    const aliases = generateClientAliases(clientName);
    for (const alias of aliases) {
      if (domainDirectoryCache[alias]) return domainDirectoryCache[alias];
    }
    for (const alias of aliases) {
      for (const [key, domain] of Object.entries(domainDirectoryCache)) {
        if (key.includes(alias) || alias.includes(key)) return domain;
      }
    }
    return '';
  };

  const updateSourceStatus = (id: string, status: DataSourceStatus['status'], message?: string, data?: string) => {
    setDataSources(prev => prev.map(s => s.id === id ? { ...s, status, message, data: data ?? s.data } : s));
  };

  // Fetch live Supermetrics data using client_account_mappings
  const fetchSupermetricsData = async (clientName: string): Promise<Record<string, any> | null> => {
    updateSourceStatus('supermetrics', 'loading', 'Looking up linked ad accounts...');
    try {
      // Step 1: Get account mappings for this client
      const { data: mappings, error: mappingError } = await supabase
        .from('client_account_mappings')
        .select('platform, account_id, account_name')
        .eq('client_name', clientName);

      if (mappingError) throw mappingError;

      if (!mappings || mappings.length === 0) {
        updateSourceStatus('supermetrics', 'not-found', 'No linked ad accounts — map accounts in Client Health');
        return null;
      }

      // Build accounts map: { platform: [accountId, ...] }
      const accounts: Record<string, string[]> = {};
      for (const m of mappings) {
        if (!accounts[m.platform]) accounts[m.platform] = [];
        accounts[m.platform].push(m.account_id);
      }

      const platformNames = Object.keys(accounts).join(', ');
      updateSourceStatus('supermetrics', 'loading', `Fetching live data from ${platformNames}...`);

      // Step 2: Fetch Supermetrics data
      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', {
        body: {
          action: 'fetch-data',
          dataSources: Object.keys(accounts),
          accounts,
          dateStart: startDate,
          dateEnd: endDate,
        },
      });

      if (error) throw error;

      if (data?.success && data?.platforms) {
        const platformCount = Object.keys(data.platforms).length;
        let totalSpend = 0;
        for (const p of Object.values(data.platforms) as any[]) {
          totalSpend += p.summary?.spend || 0;
        }
        updateSourceStatus('supermetrics', 'success', 
          `${platformCount} platform(s) · $${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} total spend`
        );
        setSupermetricsData(data.platforms);
        return data.platforms;
      } else {
        updateSourceStatus('supermetrics', 'warning', 'No spend data returned from Supermetrics');
        return null;
      }
    } catch (error) {
      console.error('Error fetching Supermetrics data:', error);
      updateSourceStatus('supermetrics', 'error', 'Failed to fetch live ad data');
      return null;
    }
  };

  // Fetch Google Sheets (optional - only if VITE_AD_UPDATES_SPREADSHEET_ID is configured)
  const fetchGoogleSheets = async (clientName: string): Promise<string | null> => {
    if (!CONNECTED_SPREADSHEET_ID) {
      updateSourceStatus('google-sheets', 'not-found', 'No spreadsheet configured');
      return null;
    }
    updateSourceStatus('google-sheets', 'loading', 'Searching for client tab...');
    try {
      const tabs = await loadSheetTabs();
      const matchedTab = findBestSheetMatch(clientName, tabs);
      if (!matchedTab) {
        updateSourceStatus('google-sheets', 'not-found', 'No matching client tab found');
        return null;
      }
      updateSourceStatus('google-sheets', 'loading', `Loading "${matchedTab}"...`);
      
      const { data, error } = await supabase.functions.invoke('fetch-google-sheet', {
        body: { spreadsheetId: CONNECTED_SPREADSHEET_ID, sheetName: matchedTab },
      });
      if (error) throw error;

      let formattedData = `# ${matchedTab} - Google Ads Updates\nDate Range: ${startDate} to ${endDate}\n\n`;
      if (data.headers?.length > 0) formattedData += `## Columns: ${data.headers.join(', ')}\n\n`;
      if (data.rows?.length > 0) {
        const filteredRows = data.rows.filter((row: Record<string, string>) => {
          const dateField = row['Date'] || row['date'] || row['Timestamp'] || '';
          if (!dateField) return true;
          try {
            const rowDate = new Date(dateField);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return rowDate >= start && rowDate <= end;
          } catch { return true; }
        });
        formattedData += `## Data (${filteredRows.length} rows)\n\n`;
        filteredRows.forEach((row: Record<string, string>, index: number) => {
          formattedData += `### Row ${index + 1}\n`;
          Object.entries(row).forEach(([key, value]) => { if (value) formattedData += `- ${key}: ${value}\n`; });
          formattedData += '\n';
        });
      }
      updateSourceStatus('google-sheets', 'success', `Loaded from "${matchedTab}"`, formattedData);
      return formattedData;
    } catch (error) {
      console.error('Error fetching Google Sheets:', error);
      updateSourceStatus('google-sheets', 'error', 'Failed to load data');
      return null;
    }
  };

  // Detect if content is a login page (not actual dashboard data)
  const isLoginPage = (content: string): boolean => {
    const loginIndicators = [
      'sign in',
      'sign-in',
      'login',
      'email or phone',
      'forgot email',
      'create account',
      'continue to looker studio',
      'password',
      'authenticate'
    ];
    const lowerContent = content.toLowerCase();
    const matchCount = loginIndicators.filter(indicator => lowerContent.includes(indicator)).length;
    return matchCount >= 2; // If 2+ login indicators found, it's a login page
  };

  // Fetch Looker Studio with dedicated scraper - extracts ALL data (tables, metrics, text)
  // Includes browser automation to set date range for accurate data
  const fetchLookerStudio = async (clientName: string): Promise<{ 
    url: string; 
    screenshots?: string[]; 
    content?: string; 
    markdown?: string;
    extractedMetrics?: any;
    qa?: any;
    aiAnalysis?: any;
    isBlocked?: boolean 
  } | null> => {
    updateSourceStatus('looker-studio', 'loading', 'Searching for Looker Studio report...');
    try {
      await loadLookerDirectory();
      const foundUrl = findLookerUrl(clientName);
      if (!foundUrl) {
        updateSourceStatus('looker-studio', 'not-found', 'No Looker Studio report found');
        return null;
      }
      setLookerUrl(foundUrl);
      updateSourceStatus('looker-studio', 'loading', `Setting date range: ${startDate} to ${endDate}...`);
      
      // Use dedicated Looker scraper with date automation
      const { data, error } = await supabase.functions.invoke('scrape-looker', {
        body: { 
          url: foundUrl,
          startDate,  // Pass selected start date for browser automation
          endDate,    // Pass selected end date for browser automation
          minScreenshots: 10,
        },
      });

      // Check for blocked/login responses
      if (error || data?.isBlocked) {
        const reason = data?.reason || 'unknown';
        const errorMsg = data?.error || error?.message || 'Dashboard requires login';
        console.warn('Looker Studio blocked:', reason, errorMsg);
        updateSourceStatus('looker-studio', 'warning', `⚠️ ${errorMsg}`, `Looker Studio: ${foundUrl}`);
        toast({
          title: "Looker Screenshot Required",
          description: errorMsg,
          variant: "destructive",
        });
        return { url: foundUrl, isBlocked: true };
      }

      // Extract all data from response
      const screenshot = data?.screenshot;
      const screenshots = data?.screenshots || (screenshot ? [{ image: screenshot }] : []);
      const markdown = data?.markdown || '';
      const extractedMetrics = data?.extractedMetrics;
      const qa = data?.qa;
      const aiAnalysis = data?.aiAnalysis;
      
      console.log('=== LOOKER STUDIO EXTRACTION RESULTS ===');
      console.log('Screenshots captured:', screenshots.length);
      console.log('Markdown length:', markdown.length);
      console.log('Metrics found:', extractedMetrics?.metrics ? Object.keys(extractedMetrics.metrics).length : 0);
      console.log('Tables found:', extractedMetrics?.tables?.length || 0);
      console.log('Data quality:', qa?.dataQuality);
      console.log('Date range confirmed:', qa?.dateRangeConfirmed);
      console.log('QA:', qa);
      
      // Build status message based on extraction quality and date confirmation
      let statusMsg = '';
      const dateConfirmed = qa?.dateRangeConfirmed;
      const screenshotCount = screenshots.length || (screenshot ? 1 : 0);
      
      if (qa?.dataQuality === 'high') {
        const metricsCount = qa.metricsCount || 0;
        const tableCount = qa.tableCount || 0;
        statusMsg = `✓ ${screenshotCount} screenshots, ${metricsCount} metrics`;
        if (dateConfirmed) {
          statusMsg += ` • Dates verified ✓`;
        } else if (dateConfirmed === false) {
          statusMsg += ` • ⚠️ Date mismatch`;
        }
      } else if (qa?.dataQuality === 'medium') {
        statusMsg = `✓ ${screenshotCount} screenshots captured`;
        if (dateConfirmed === false) {
          statusMsg += ` • ⚠️ Check dates`;
        }
      } else if (screenshotCount > 0) {
        statusMsg = `✓ ${screenshotCount} screenshot(s) for analysis`;
      } else {
        updateSourceStatus('looker-studio', 'warning', '⚠️ Limited data - please upload screenshots', `Looker Studio: ${foundUrl}`);
        return { url: foundUrl, isBlocked: true };
      }
      
      // Show warning toast if dates don't match
      if (dateConfirmed === false) {
        toast({
          title: "⚠️ Date Range Warning",
          description: `The Looker dashboard may not be showing ${startDate} to ${endDate}. AI will verify the visible date range.`,
          variant: "destructive",
        });
      }
      
      updateSourceStatus('looker-studio', dateConfirmed === false ? 'warning' : 'success', statusMsg, `Looker Studio: ${foundUrl}`);
      
      return { 
        url: foundUrl, 
        screenshots: screenshots.map((s: any) => s.image || s), 
        content: markdown,
        markdown,
        extractedMetrics,
        qa,
        aiAnalysis
      };
      
    } catch (error) {
      console.error('Error fetching Looker Studio:', error);
      updateSourceStatus('looker-studio', 'error', 'Failed to capture dashboard - please upload screenshots');
      return null;
    }
  };

  // Fetch Semrush Paid Ad Data
  const fetchSemrushData = async (domain: string): Promise<PaidAdData | null> => {
    if (!domain.trim()) {
      updateSourceStatus('semrush', 'not-found', 'No domain provided');
      return null;
    }
    updateSourceStatus('semrush', 'loading', 'Fetching paid ad intelligence from Semrush...');
    try {
      const { data, error } = await supabase.functions.invoke('get-seo-data', {
        body: { domain },
      });
      if (error) throw error;
      if (data?.success && data?.data) {
        const adData = data.data;
        const spendDisplay = adData.paidTrafficCost 
          ? `$${adData.paidTrafficCost.toLocaleString()}` 
          : 'N/A';
        const keywordsDisplay = adData.paidKeywords?.toLocaleString() || 'N/A';
        updateSourceStatus('semrush', 'success', `Paid KWs: ${keywordsDisplay}, Est. Spend: ${spendDisplay}`);
        setPaidAdData(adData);
        return adData;
      } else {
        updateSourceStatus('semrush', 'not-found', 'No paid ad data available');
        return null;
      }
    } catch (error) {
      console.error('Error fetching Semrush data:', error);
      updateSourceStatus('semrush', 'error', 'Failed to fetch paid ad data');
      return null;
    }
  };

  // Fetch Google Analytics 4 Data
  const fetchGA4Data = async (propertyId: string): Promise<GA4Data | null> => {
    if (!propertyId.trim()) {
      updateSourceStatus('google-analytics', 'not-found', 'No GA4 Property ID provided');
      return null;
    }
    updateSourceStatus('google-analytics', 'loading', 'Fetching GA4 metrics...');
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ga4-data', {
        body: { 
          propertyId: propertyId.replace(/[^0-9]/g, ''), // Clean to just numbers
          startDate,
          endDate 
        },
      });
      if (error) throw error;
      if (data?.success && data?.data) {
        const gaData = data.data;
        const sessionsDisplay = gaData.overview?.sessions?.toLocaleString() || 'N/A';
        const conversionsDisplay = gaData.conversions?.reduce((acc: number, c: any) => acc + c.count, 0) || 0;
        const isMockLabel = data.isMock ? ' (mock)' : '';
        updateSourceStatus('google-analytics', 'success', `Sessions: ${sessionsDisplay}, Conversions: ${conversionsDisplay}${isMockLabel}`);
        setGa4Data(gaData);
        return gaData;
      } else {
        updateSourceStatus('google-analytics', 'not-found', 'No GA4 data available');
        return null;
      }
    } catch (error) {
      console.error('Error fetching GA4 data:', error);
      updateSourceStatus('google-analytics', 'error', 'Failed to fetch GA4 data');
      return null;
    }
  };


  const handleAnalyze = async () => {
    if (!clientName.trim()) {
      toast({ title: "Client name required", description: "Please enter a client name.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setIsFetchingData(true);
    setAnalysis(null);
    setShowSuggestions(false);
    setDataSources(prev => prev.map(s => ({ ...s, status: 'idle', message: undefined, data: undefined })));

    // Auto-populate fields if not already set
    let effectiveDomain = clientDomain;
    let effectiveGA4 = ga4PropertyId;
    
    if (!effectiveDomain) {
      const foundDomain = findClientDomain(clientName);
      if (foundDomain) {
        effectiveDomain = foundDomain;
        setClientDomain(foundDomain);
      }
    }
    
    if (!effectiveGA4) {
      const foundGA4 = findGA4PropertyId(clientName);
      if (foundGA4) {
        effectiveGA4 = foundGA4;
        setGa4PropertyId(foundGA4);
      }
    }

    try {
      // Fetch all data sources in parallel — Supermetrics is now primary
      const [fetchedSupermetrics, sheetsData, lookerData, fetchedSeoData, fetchedGa4Data] = await Promise.all([
        fetchSupermetricsData(clientName),
        fetchGoogleSheets(clientName),
        fetchLookerStudio(clientName),
        effectiveDomain ? fetchSemrushData(effectiveDomain) : Promise.resolve(null),
        effectiveGA4 ? fetchGA4Data(effectiveGA4) : Promise.resolve(null),
      ]);

      setIsFetchingData(false);

      // Collect Looker screenshots automatically captured by scraper
      let allScreenshots: string[] = [];
      if (lookerData?.screenshots?.length) {
        allScreenshots = [...lookerData.screenshots];
      }

      // Check for data — Supermetrics counts as valid data even without Looker
      if (!fetchedSupermetrics && !sheetsData && !lookerData?.url && allScreenshots.length === 0) {
        toast({ title: "No data found", description: `Could not find data for "${clientName}". Make sure ad accounts are linked in Client Health.`, variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }

      // Detect industry from any available content
      let industry = detectedIndustry;
      if (lookerData?.content) {
        industry = detectIndustry(lookerData.content);
        setDetectedIndustry(industry);
      }

      // Prepare structured Looker data for AI
      let lookerContent = '';
      let structuredLookerData = undefined;
      
      if (lookerData) {
        lookerContent = `Looker Studio Dashboard: ${lookerData.url}\n`;
        if (lookerData.content) lookerContent += `\nDashboard Content:\n${lookerData.content}\n`;
        
        if ((lookerData as any).extractedMetrics || (lookerData as any).markdown) {
          structuredLookerData = {
            markdown: (lookerData as any).markdown || lookerData.content,
            extractedMetrics: (lookerData as any).extractedMetrics,
            qa: (lookerData as any).qa
          };
        }
      }

      // Format Supermetrics data as a readable text block for AI context
      let supermetricsContext = '';
      if (fetchedSupermetrics) {
        supermetricsContext = `=== SUPERMETRICS LIVE AD DATA (PRIMARY SOURCE) ===\n`;
        supermetricsContext += `Date Range: ${startDate} to ${endDate}\n\n`;
        for (const [platform, platformData] of Object.entries(fetchedSupermetrics as Record<string, any>)) {
          const summary = platformData.summary || {};
          supermetricsContext += `## ${platformData.label || platform}\n`;
          supermetricsContext += `Account: ${platformData.accountName || 'N/A'}\n`;
          if (summary.spend > 0) supermetricsContext += `Spend: $${summary.spend?.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
          if (summary.impressions > 0) supermetricsContext += `Impressions: ${summary.impressions?.toLocaleString()}\n`;
          if (summary.clicks > 0) supermetricsContext += `Clicks: ${summary.clicks?.toLocaleString()}\n`;
          if (summary.conversions > 0) supermetricsContext += `Conversions: ${summary.conversions?.toLocaleString()}\n`;
          if (summary.calls > 0) supermetricsContext += `Calls: ${summary.calls?.toLocaleString()}\n`;
          if (summary.ctr > 0) supermetricsContext += `CTR: ${(summary.ctr * 100).toFixed(2)}%\n`;
          if (summary.cpc > 0) supermetricsContext += `CPC: $${summary.cpc?.toFixed(2)}\n`;
          if (summary.cpa > 0) supermetricsContext += `CPA: $${summary.cpa?.toFixed(2)}\n`;
          if (summary.roas > 0) supermetricsContext += `ROAS: ${summary.roas?.toFixed(2)}x\n`;

          // Campaign breakdown
          if (platformData.campaigns?.length > 0) {
            supermetricsContext += `\nTop Campaigns:\n`;
            for (const c of (platformData.campaigns as any[]).slice(0, 5)) {
              supermetricsContext += `  - ${c.name}: $${c.spend?.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend, ${c.conversions} conv, CPA $${c.cpa?.toFixed(2)}\n`;
            }
          }
          supermetricsContext += '\n';
        }
      }

      // Call AI with all context — Supermetrics is passed as primary sheetsData if available
      const { data, error } = await supabase.functions.invoke('ad-review', {
        body: {
          type: allScreenshots.length > 0 ? 'screenshots' : 'sheets',
          clientName,
          dateRange: { start: startDate, end: endDate },
          // Supermetrics data prepended to sheetsData so the AI system prompt sees it
          sheetsData: supermetricsContext ? (supermetricsContext + (sheetsData || '')) : (sheetsData || undefined),
          lookerUrl: lookerData?.url || undefined,
          lookerContent: lookerContent || undefined,
          lookerData: structuredLookerData,
          screenshots: allScreenshots.length > 0 ? allScreenshots : undefined,
          paidAdData: fetchedSeoData || undefined,
          ga4Data: fetchedGa4Data || undefined,
          benchmarkData: industry,
          previousReview: previousReview || undefined
        }
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast({ title: "Analysis Complete", description: `Ad review for ${clientName} is ready.` });

        // Save to history
        const reviewId = await saveReview({
          clientName,
          dateRangeStart: startDate,
          dateRangeEnd: endDate,
          platforms: data.analysis.platforms || [],
          summary: data.analysis.summary || '',
          insights: data.analysis.insights || [],
          recommendations: data.analysis.recommendations || [],
          weekOverWeek: data.analysis.weekOverWeek || [],
          industry: industry.industry,
          benchmarkComparison: data.analysis.benchmarkAnalysis || {},
          seoData: fetchedSeoData || {},
        });
        if (reviewId) setLastSavedReviewId(reviewId);
      } else {
        throw new Error(data?.error || 'Failed to analyze data');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({ title: "Analysis Failed", description: error instanceof Error ? error.message : "Failed to analyze data", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
      setIsFetchingData(false);
    }
  };

  const getStatusIcon = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'loading': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'not-found': return <Circle className="h-4 w-4 text-yellow-500" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
  };

  const getHealthBadge = (health: 'good' | 'warning' | 'critical') => {
    if (health === 'good') return <Badge className="bg-green-500/20 text-green-600">Healthy</Badge>;
    if (health === 'warning') return <Badge className="bg-yellow-500/20 text-yellow-600">Needs Attention</Badge>;
    return <Badge className="bg-red-500/20 text-red-600">Critical</Badge>;
  };

  const getInsightIcon = (type: 'positive' | 'warning' | 'action' | 'opportunity') => {
    if (type === 'positive') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (type === 'warning') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (type === 'opportunity') return <Zap className="h-5 w-5 text-purple-500" />;
    return <Target className="h-5 w-5 text-blue-500" />;
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return 'border-l-red-500';
    if (priority === 'medium') return 'border-l-yellow-500';
    return 'border-l-green-500';
  };

  // Extract metrics for benchmark comparison
  const extractMetricsForBenchmark = () => {
    if (!analysis?.platforms) return {};
    const metrics: any = {};
    for (const platform of analysis.platforms) {
      const name = platform.name.toLowerCase();
      const parseCtr = parseFloat(platform.ctr?.replace('%', '') || '0');
      const parseCpc = parseFloat(platform.cpc?.replace(/[^0-9.]/g, '') || '0');
      const parseConv = parseFloat(platform.conversionRate?.replace('%', '') || '0');
      
      if (name.includes('google')) {
        metrics.googleCtr = parseCtr;
        metrics.googleCpc = parseCpc;
        metrics.googleConversionRate = parseConv;
      } else if (name.includes('meta') || name.includes('facebook')) {
        metrics.metaCtr = parseCtr;
        metrics.metaCpc = parseCpc;
        metrics.metaConversionRate = parseConv;
      }
    }
    return metrics;
  };

  // Handle client selection from sidebar
  const handleSelectClient = async (name: string, lookerUrlFromSidebar?: string) => {
    setClientName(name);
    setShowSuggestions(false);
    if (lookerUrlFromSidebar) {
      setLookerUrl(lookerUrlFromSidebar);
    }
    
    // Auto-populate GA4 Property ID and Domain from directory
    await loadLookerDirectory(); // Ensure cache is loaded
    
    const foundGA4Id = findGA4PropertyId(name);
    if (foundGA4Id) {
      setGa4PropertyId(foundGA4Id);
    }
    
    const foundDomain = findClientDomain(name);
    if (foundDomain) {
      setClientDomain(foundDomain);
    }
    
    // Also check for Looker URL if not provided
    if (!lookerUrlFromSidebar) {
      const foundLooker = findLookerUrl(name);
      if (foundLooker) {
        setLookerUrl(foundLooker);
      }
    }
    
    // Auto-focus on the client name input for quick adjustments
    inputRef.current?.focus();
  };
  
  // Handle suggestion selection
  const handleSelectSuggestion = (match: MatchResult) => {
    setClientName(match.name);
    setShowSuggestions(false);
    setSelectedMatch(match);
    
    // Auto-populate all fields from the match
    if (match.domain) {
      setClientDomain(match.domain);
    }
    if (match.ga4PropertyId) {
      setGa4PropertyId(match.ga4PropertyId);
    }
    if (match.lookerUrl) {
      setLookerUrl(match.lookerUrl);
    }
    
    inputRef.current?.focus();
  };
  
  // Get confidence badge color
  const getConfidenceBadge = (confidence: MatchResult['confidence']) => {
    switch (confidence) {
      case 'high': return <Badge className="bg-green-500/20 text-green-600 text-[10px]">High Match</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">Partial</Badge>;
      case 'low': return <Badge className="bg-orange-500/20 text-orange-600 text-[10px]">Fuzzy</Badge>;
    }
  };
  
  // Get match type icon
  const getMatchTypeIcon = (matchType: MatchResult['matchType']) => {
    switch (matchType) {
      case 'exact': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'acronym': return <Sparkles className="h-3 w-3 text-purple-500" />;
      case 'partial': return <Search className="h-3 w-3 text-blue-500" />;
      default: return <Search className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Ad Review Bot
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Zero-Input
              </Badge>
            </h1>
            <p className="text-muted-foreground">Smart fuzzy matching • Auto-populated GA4, Semrush, Looker • 365-day memory</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Client List Sidebar */}
          <div className="lg:col-span-2">
            <ClientHealthSidebar 
              onSelectClient={handleSelectClient}
              selectedClient={clientName}
            />
          </div>

          {/* Input Section */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Client Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 relative" ref={suggestionsRef}>
                  <Label className="flex items-center gap-2">
                    Client Name
                    {selectedMatch && (
                      <span className="flex items-center gap-1">
                        {getMatchTypeIcon(selectedMatch.matchType)}
                        {getConfidenceBadge(selectedMatch.confidence)}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      placeholder="Start typing client name..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      onFocus={() => clientName.length >= 2 && setShowSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isAnalyzing) {
                          if (showSuggestions && clientSuggestions.length > 0) {
                            handleSelectSuggestion(clientSuggestions[0]);
                          } else {
                            handleAnalyze();
                          }
                        }
                        if (e.key === 'Escape') {
                          setShowSuggestions(false);
                        }
                      }}
                      className="pr-10"
                    />
                    {clientName && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {findLookerUrl(clientName) && (
                          <span title="Looker Found"><Link2 className="h-3 w-3 text-green-500" /></span>
                        )}
                        {findGA4PropertyId(clientName) && (
                          <span title="GA4 Found"><BarChart3 className="h-3 w-3 text-blue-500" /></span>
                        )}
                        {findClientDomain(clientName) && (
                          <span title="Domain Found"><Globe className="h-3 w-3 text-purple-500" /></span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Smart Suggestions Dropdown */}
                  {showSuggestions && clientSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
                      <div className="p-2 border-b bg-muted/50">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {clientSuggestions.length} matches found - Press Enter to select top match
                        </span>
                      </div>
                      {clientSuggestions.map((match, idx) => (
                        <button
                          key={match.name}
                          onClick={() => handleSelectSuggestion(match)}
                          className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-2 ${idx === 0 ? 'bg-accent/50' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getMatchTypeIcon(match.matchType)}
                            <span className="truncate font-medium">{match.name}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {match.lookerUrl && <Link2 className="h-3 w-3 text-green-500" />}
                            {match.ga4PropertyId && <BarChart3 className="h-3 w-3 text-blue-500" />}
                            {match.domain && <Globe className="h-3 w-3 text-purple-500" />}
                            {getConfidenceBadge(match.confidence)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Data Sources Preview - shows what will be auto-populated */}
                {selectedMatch && (selectedMatch.domain || selectedMatch.ga4PropertyId || selectedMatch.lookerUrl) && (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Auto-detected data sources:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedMatch.lookerUrl && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> Looker
                        </Badge>
                      )}
                      {selectedMatch.ga4PropertyId && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" /> GA4: {selectedMatch.ga4PropertyId}
                        </Badge>
                      )}
                      {selectedMatch.domain && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {selectedMatch.domain}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <Collapsible open={isSettingsExpanded} onOpenChange={setIsSettingsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                      <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Manual Overrides</span>
                      {isSettingsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Globe className="h-3 w-3" />
                        Client Domain (Semrush)
                        {clientDomain && domainDirectoryCache && findClientDomain(clientName) === clientDomain && (
                          <Badge variant="outline" className="text-[10px] font-normal">Auto</Badge>
                        )}
                      </Label>
                      <Input
                        placeholder="e.g., example.com"
                        value={clientDomain}
                        onChange={(e) => setClientDomain(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <BarChart3 className="h-3 w-3" />
                        GA4 Property ID
                        {ga4PropertyId && ga4DirectoryCache && findGA4PropertyId(clientName) === ga4PropertyId && (
                          <Badge variant="outline" className="text-[10px] font-normal">Auto</Badge>
                        )}
                      </Label>
                      <Input
                        placeholder="e.g., 123456789"
                        value={ga4PropertyId}
                        onChange={(e) => setGa4PropertyId(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" />Start</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" />End</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>

                <Collapsible open={isSettingsExpanded} onOpenChange={setIsSettingsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Client Aliases</span>
                      {isSettingsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <Textarea
                      placeholder="SDPF, SD, San Diego Parks..."
                      value={customAliases}
                      onChange={(e) => handleAliasesChange(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={saveAliases} disabled={aliasesSaved}>
                        <Save className="h-4 w-4 mr-2" />{aliasesSaved ? 'Saved' : 'Save'}
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Screenshot Upload - Prominent when Looker is blocked */}
                <Button onClick={handleAnalyze} disabled={isAnalyzing || !clientName.trim()} className="w-full" size="lg">
                  {isAnalyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isFetchingData ? 'Fetching Data...' : 'Deep Analysis...'}</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" />Run Deep Analysis</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Data Sources Status */}
            {(isAnalyzing || dataSources.some(s => s.status !== 'idle')) && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" />Data Sources</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {dataSources.map((source) => (
                    <div key={source.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      {getStatusIcon(source.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{source.label}</p>
                        {source.message && <p className="text-xs text-muted-foreground truncate">{source.message}</p>}
                      </div>
                    </div>
                  ))}
                  {lookerUrl && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.open(lookerUrl, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />View Looker Dashboard
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* History Panel */}
            <AdReviewHistory 
              history={history} 
              isLoading={isLoadingHistory} 
              onUpdateNotes={updateNotes}
              onRecordChange={recordChange}
            />
          </div>

          {/* Results Section */}
          <div className="lg:col-span-7 space-y-6">
            {!analysis && !isAnalyzing && (
              <Card className="flex items-center justify-center min-h-[400px]">
                <div className="text-center text-muted-foreground p-8">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Ready for Deep Analysis</h3>
                  <p className="text-sm">Select a client from the list or enter a name to analyze with Semrush, industry benchmarks, and historical comparison.</p>
                </div>
              </Card>
            )}

            {isAnalyzing && (
              <Card className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8">
                  <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary" />
                  <h3 className="text-lg font-medium mb-2">{isFetchingData ? 'Fetching Data' : 'Running Deep Analysis'}</h3>
                  <p className="text-sm text-muted-foreground">{isFetchingData ? 'Pulling from Google Sheets, Looker Studio, and Semrush...' : 'AI analyzing with Claude Sonnet 4.6 for comprehensive insights...'}</p>
                </div>
              </Card>
            )}

            {analysis && (
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="seo">Semrush</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Executive Summary with CPL/CPA Focus */}
                  <AdReviewExecutiveSummary
                    summary={analysis.summary}
                    platforms={analysis.platforms}
                    benchmark={detectedIndustry}
                    cplCpaAnalysis={analysis.cplCpaAnalysis}
                  />

                  {/* Platform Breakdown */}
                  {analysis.platforms?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Platform Breakdown</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {analysis.platforms.map((platform, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{platform.name}</h4>
                                {getTrendIcon(platform.trend)}
                                {platform.vsBenchmark && (
                                  <Badge variant="outline" className="text-xs">
                                    {platform.vsBenchmark === 'above' ? '↑' : platform.vsBenchmark === 'below' ? '↓' : '='} benchmark
                                  </Badge>
                                )}
                              </div>
                              {getHealthBadge(platform.health)}
                            </div>
                            <div className="grid grid-cols-4 gap-3 text-sm">
                              <div><p className="text-muted-foreground">Spend</p><p className="font-medium">{platform.spend}</p></div>
                              <div><p className="text-muted-foreground">CTR</p><p className="font-medium">{platform.ctr}</p></div>
                              <div><p className="text-muted-foreground">CPC</p><p className="font-medium">{platform.cpc}</p></div>
                              <div><p className="text-muted-foreground">ROAS</p><p className="font-medium">{platform.roas}</p></div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Week over Week */}
                  {analysis.weekOverWeek?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Week over Week Changes</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {analysis.weekOverWeek.map((item, index) => (
                            <div key={index} className="text-center p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">{item.metric}</p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                {item.direction === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                                <span className={`font-bold ${item.isGood !== false ? (item.direction === 'up' ? 'text-green-500' : 'text-red-500') : (item.direction === 'up' ? 'text-red-500' : 'text-green-500')}`}>
                                  {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Historical Comparison */}
                  {analysis.historicalComparison && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />vs Previous Review</CardTitle></CardHeader>
                      <CardContent className="grid md:grid-cols-3 gap-4">
                        {analysis.historicalComparison.improved?.length > 0 && (
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <p className="font-medium text-green-600 mb-2">Improved</p>
                            {analysis.historicalComparison.improved.map((item, i) => <p key={i} className="text-sm">✓ {item}</p>)}
                          </div>
                        )}
                        {analysis.historicalComparison.declined?.length > 0 && (
                          <div className="p-3 bg-red-500/10 rounded-lg">
                            <p className="font-medium text-red-600 mb-2">Declined</p>
                            {analysis.historicalComparison.declined.map((item, i) => <p key={i} className="text-sm">✗ {item}</p>)}
                          </div>
                        )}
                        {analysis.historicalComparison.unchanged?.length > 0 && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="font-medium mb-2">Unchanged</p>
                            {analysis.historicalComparison.unchanged.map((item, i) => <p key={i} className="text-sm">= {item}</p>)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="space-y-6">
                  {/* Key Insights */}
                  {analysis.insights?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Key Insights</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.insights.map((insight, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            {getInsightIcon(insight.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{insight.title}</h4>
                                {insight.impact && <Badge variant="outline" className="text-xs">{insight.impact} impact</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Action Items</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.recommendations.map((rec, index) => (
                          <div key={index} className={`border-l-4 ${getPriorityColor(rec.priority)} bg-muted/30 p-4 rounded-r-lg`}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">{rec.platform}</Badge>
                              <Badge variant="outline" className="text-xs capitalize">{rec.priority}</Badge>
                              {rec.effort && <Badge variant="outline" className="text-xs">{rec.effort}</Badge>}
                              {rec.timeline && <Badge variant="secondary" className="text-xs">{rec.timeline}</Badge>}
                            </div>
                            <h4 className="font-medium">{rec.action}</h4>
                            <p className="text-sm text-muted-foreground mt-1"><DollarSign className="h-3 w-3 inline" /> {rec.expectedImpact}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Cross-Platform Paid Synergies */}
                  {analysis.crossPlatformSynergies?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-purple-500" />Cross-Platform Paid Synergies</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.crossPlatformSynergies.map((synergy, index) => (
                          <div key={index} className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                            <h4 className="font-medium">{synergy.opportunity}</h4>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {synergy.platforms.map((platform, i) => <Badge key={i} variant="secondary" className="text-xs">{platform}</Badge>)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">→ {synergy.action}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="benchmarks" className="space-y-6">
                  <AdReviewBenchmarks
                    industry={detectedIndustry.industry}
                    benchmark={detectedIndustry}
                    currentMetrics={extractMetricsForBenchmark()}
                  />

                  {analysis.benchmarkAnalysis && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" />Benchmark Analysis</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-muted-foreground">{analysis.benchmarkAnalysis.summary}</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          {analysis.benchmarkAnalysis.strengths?.length > 0 && (
                            <div className="p-3 bg-green-500/10 rounded-lg">
                              <p className="font-medium text-green-600 mb-2">Strengths (Above Benchmark)</p>
                              {analysis.benchmarkAnalysis.strengths.map((s, i) => <p key={i} className="text-sm">✓ {s}</p>)}
                            </div>
                          )}
                          {analysis.benchmarkAnalysis.weaknesses?.length > 0 && (
                            <div className="p-3 bg-red-500/10 rounded-lg">
                              <p className="font-medium text-red-600 mb-2">Opportunities (Below Benchmark)</p>
                              {analysis.benchmarkAnalysis.weaknesses.map((w, i) => <p key={i} className="text-sm">→ {w}</p>)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="seo" className="space-y-6">
                  {paidAdData ? (
                    <AdReviewSeoInsights seoData={paidAdData} />
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">Enter a client domain to fetch Semrush paid ad intelligence.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdReview;

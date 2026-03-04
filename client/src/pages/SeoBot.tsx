import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Globe, BarChart3, Target, Zap, AlertTriangle, CheckCircle, ExternalLink, FileText, TrendingUp, TrendingDown, History, MessageSquare, ClipboardCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ClientHealthSidebar, type ClientHealthStatus } from '@/components/ClientHealthSidebar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Spreadsheet IDs
const LOOKER_DIRECTORY_SPREADSHEET_ID = '1t43DRbgSo7pOqKh2DIt7xSsKrN6JgLgLSWAJe92SDQI';

// Cache
let domainDirectoryCache: Record<string, string> | null = null;

interface SeoMetrics {
  domain: string;
  organicKeywords: number;
  organicTraffic: number;
  domainAuthority: number;
  backlinks: number;
  referringDomains: number;
  paidKeywords?: number;
  paidTraffic?: number;
  paidTrafficCost?: number;
  siteErrors?: number | null;
  siteWarnings?: number | null;
  siteHealthScore?: number | null;
  siteAuditUrl?: string | null;
}

interface KeywordData {
  keyword: string;
  position: number;
  volume: number;
  cpc: number;
  url: string;
  trafficPercent: number;
  difficulty?: number;
}

interface CompetitorData {
  domain: string;
  commonKeywords: number;
  organicKeywords: number;
  organicTraffic: number;
  paidKeywords?: number;
}

interface HistoricalDataPoint {
  analysis_date: string;
  organic_keywords: number;
  organic_traffic: number;
  domain_authority: number;
  backlinks: number;
  notion_tasks_completed: number;
}

interface NotionTask {
  title: string;
  status: string;
  lastEdited: string;
}

interface SlackHighlight {
  text: string;
  user: string;
  timestamp: string;
  channel: string;
}

interface SeoAnalysis {
  summary: string;
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  metrics: SeoMetrics;
  topKeywords: KeywordData[];
  competitors: CompetitorData[];
  insights: {
    type: 'positive' | 'warning' | 'action' | 'opportunity';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    effort: 'quick-win' | 'medium' | 'strategic';
  }[];
  keywordGaps: {
    keyword: string;
    competitorRanking: number;
    ourPosition: number | null;
    volume: number;
    opportunity: string;
  }[];
  technicalIssues?: {
    issue: string;
    severity: 'high' | 'medium' | 'low';
    fix: string;
  }[];
  contentOpportunities?: {
    topic: string;
    searchVolume: number;
    difficulty: number;
    rationale: string;
  }[];
  progressSummary?: string;
}

interface DataSourceStatus {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'success' | 'error' | 'not-found';
  message?: string;
}

const SeoBot = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Client selection from sidebar
  const [selectedClient, setSelectedClient] = useState('');
  const [clientDomain, setClientDomain] = useState('');
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Additional data
  const [notionTasks, setNotionTasks] = useState<{ completed: number; tasks: NotionTask[] }>({ completed: 0, tasks: [] });
  const [slackActivity, setSlackActivity] = useState<{ count: number; highlights: SlackHighlight[] }>({ count: 0, highlights: [] });
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  
  // Data sources
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([
    { id: 'semrush', label: 'Semrush SEO Data', status: 'idle' },
    { id: 'siteaudit', label: 'Site Audit Errors', status: 'idle' },
    { id: 'website', label: 'Website Analysis', status: 'idle' },
    { id: 'notion', label: 'Notion Tasks', status: 'idle' },
    { id: 'history', label: 'Historical Trends', status: 'idle' },
  ]);
  
  // Raw data
  const [semrushData, setSemrushData] = useState<any>(null);
  const [websiteData, setWebsiteData] = useState<any>(null);

  // SEO Bot ONLY: show/operate on clients that have a Site Audit link
  const filterSeoClients = useCallback(
    (clients: ClientHealthStatus[]) => clients.filter((c) => !!c.siteAuditUrl && c.siteAuditUrl.trim() !== ''),
    []
  );

  // Load domain directory on mount
  useEffect(() => {
    loadDomainDirectory();
  }, []);

  const loadDomainDirectory = async () => {
    if (domainDirectoryCache) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-google-sheet', {
        body: { spreadsheetId: LOOKER_DIRECTORY_SPREADSHEET_ID, sheetName: 'Sheet1' },
      });
      if (error) throw error;

      const domainDir: Record<string, string> = {};
      
      if (data.rows?.length > 0) {
        for (const row of data.rows) {
          const name = row['Clients Name'] || row['Client Name'] || row['Client'] || row['Name'] || '';
          const domain = row['URL Domain'] || row['Domain'] || row['Website'] || row['Client Domain'] || row['URL'] || '';
          
          if (name && domain) {
            const normalizedName = name.toLowerCase().trim();
            const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
            if (cleanDomain) {
              domainDir[normalizedName] = cleanDomain;
            }
          }
        }
      }
      
      domainDirectoryCache = domainDir;
    } catch (error) {
      console.error('Error loading domain directory:', error);
    }
  };

  const findClientDomain = (clientName: string): string => {
    if (!domainDirectoryCache) return '';
    const normalized = clientName.toLowerCase().trim();
    
    // Direct match
    if (domainDirectoryCache[normalized]) return domainDirectoryCache[normalized];
    
    // Partial match
    for (const [key, domain] of Object.entries(domainDirectoryCache)) {
      if (key.includes(normalized) || normalized.includes(key)) return domain;
    }
    
    return '';
  };

  const updateSourceStatus = (id: string, status: DataSourceStatus['status'], message?: string) => {
    setDataSources(prev => prev.map(ds => 
      ds.id === id ? { ...ds, status, message } : ds
    ));
  };

  // Handle client selection from sidebar
  const handleSelectClient = useCallback((clientName: string, lookerUrl?: string) => {
    setSelectedClient(clientName);
    setAnalysis(null);
    setNotionTasks({ completed: 0, tasks: [] });
    setSlackActivity({ count: 0, highlights: [] });
    setHistoricalData([]);
    
    // Auto-find domain
    const domain = findClientDomain(clientName);
    setClientDomain(domain);
    
    // Auto-trigger analysis if we have a domain
    if (domain) {
      setTimeout(() => {
        runAnalysis(clientName, domain);
      }, 300);
    } else {
      toast({
        title: "No domain found",
        description: `Could not find domain for ${clientName}. Please check the Looker Directory.`,
        variant: "destructive",
      });
    }
  }, []);

  const fetchSemrushData = async (domain: string) => {
    if (!domain.trim()) {
      updateSourceStatus('semrush', 'not-found', 'No domain provided');
      return null;
    }
    
    updateSourceStatus('semrush', 'loading', 'Fetching SEO metrics from Semrush...');
    
    try {
      const { data, error } = await supabase.functions.invoke('get-seo-data', {
        body: { domain },
      });
      
      if (error) throw error;
      
      if (data?.success && data?.data) {
        const metrics = data.data;
        const kwDisplay = metrics.organicKeywords?.toLocaleString() || '0';
        const trafficDisplay = metrics.organicTraffic?.toLocaleString() || '0';
        updateSourceStatus('semrush', 'success', `${kwDisplay} keywords, ${trafficDisplay} monthly traffic`);
        setSemrushData(metrics);
        return metrics;
      } else {
        updateSourceStatus('semrush', 'not-found', 'No SEO data available');
        return null;
      }
    } catch (error) {
      console.error('Error fetching Semrush data:', error);
      updateSourceStatus('semrush', 'error', 'Failed to fetch SEO data');
      return null;
    }
  };

  const fetchWebsiteData = async (domain: string) => {
    if (!domain.trim()) {
      updateSourceStatus('website', 'not-found', 'No domain provided');
      return null;
    }
    
    updateSourceStatus('website', 'loading', 'Analyzing website structure...');
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url: `https://${domain}` },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        updateSourceStatus('website', 'success', 'Website structure analyzed');
        setWebsiteData(data);
        return data;
      } else {
        updateSourceStatus('website', 'not-found', 'Could not analyze website');
        return null;
      }
    } catch (error) {
      console.error('Error fetching website data:', error);
      updateSourceStatus('website', 'error', 'Failed to analyze website');
      return null;
    }
  };

  const runAnalysis = async (clientName: string, domain: string) => {
    setIsAnalyzing(true);
    setAnalysis(null);
    
    // Reset data sources
    setDataSources(prev => prev.map(ds => ({ ...ds, status: 'idle', message: undefined })));
    
    // Show loading for additional sources
    updateSourceStatus('siteaudit', 'loading', 'Fetching site audit data...');
    updateSourceStatus('notion', 'loading', 'Fetching SEO tasks...');
    updateSourceStatus('history', 'loading', 'Loading trends...');

    try {
      // Fetch data in parallel
      const [seoData, siteData] = await Promise.all([
        fetchSemrushData(domain),
        fetchWebsiteData(domain),
      ]);

      // Generate AI analysis (includes Notion, Slack, History)
      const { data, error } = await supabase.functions.invoke('seo-bot-analyze', {
        body: {
          clientName,
          domain,
          semrushData: seoData,
          websiteData: siteData,
          saveToHistory: true
        },
      });

      if (error) throw error;

      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        
        // Update Site Audit status
        if (data.analysis?.metrics?.siteErrors != null) {
          const errors = data.analysis.metrics.siteErrors;
          updateSourceStatus('siteaudit', 'success', 
            `${errors} errors found`);
        } else if (data.analysis?.metrics?.siteAuditUrl) {
          updateSourceStatus('siteaudit', 'not-found', 'Could not parse error count');
        } else {
          updateSourceStatus('siteaudit', 'not-found', 'No audit URL configured');
        }
        
        // Update Notion status
        if (data.notionTasks) {
          setNotionTasks(data.notionTasks);
          updateSourceStatus('notion', data.notionTasks.completed > 0 ? 'success' : 'not-found', 
            data.notionTasks.completed > 0 ? `${data.notionTasks.completed} tasks completed` : 'No SEO tasks found');
        } else {
          updateSourceStatus('notion', 'not-found', 'No tasks data');
        }
        
        // Update History status
        if (data.historicalData && data.historicalData.length > 0) {
          setHistoricalData(data.historicalData);
          updateSourceStatus('history', 'success', `${data.historicalData.length} data points`);
        } else {
          updateSourceStatus('history', 'not-found', 'No historical data yet');
        }
        
        toast({
          title: "SEO Analysis Complete",
          description: `Generated comprehensive SEO report for ${clientName}`,
        });
      } else {
        throw new Error(data?.error || 'Failed to generate analysis');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze SEO data",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'good': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      case 'critical': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive': return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'action': return <Zap className="h-5 w-5 text-blue-600" />;
      case 'opportunity': return <Target className="h-5 w-5 text-purple-600" />;
      default: return <BarChart3 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const calculateTrend = (data: HistoricalDataPoint[], key: keyof HistoricalDataPoint): { value: number; direction: 'up' | 'down' | 'flat' } => {
    if (data.length < 2) return { value: 0, direction: 'flat' };
    const oldest = data[0][key] as number;
    const newest = data[data.length - 1][key] as number;
    const change = newest - oldest;
    const percentChange = oldest > 0 ? ((change / oldest) * 100) : 0;
    return {
      value: Math.abs(percentChange),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    };
  };

  // Prepare chart data
  const chartData = historicalData.map(d => ({
    date: new Date(d.analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    traffic: d.organic_traffic,
    keywords: d.organic_keywords,
    backlinks: d.backlinks,
    tasks: d.notion_tasks_completed
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                <Search className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">SEO Bot</h1>
                <p className="text-sm text-muted-foreground">Comprehensive SEO Analysis with Trends</p>
              </div>
            </div>
            {selectedClient && clientDomain && !isAnalyzing && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => runAnalysis(selectedClient, clientDomain)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-analyze
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Client Selection */}
          <div className="lg:col-span-1 space-y-4">
            <ClientHealthSidebar 
              onSelectClient={handleSelectClient}
              selectedClient={selectedClient}
              filterClients={filterSeoClients}
            />

            {/* Selected Client Info */}
            {selectedClient && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Selected Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Client</div>
                    <div className="font-medium">{selectedClient}</div>
                  </div>
                  {clientDomain && (
                    <div>
                      <div className="text-sm text-muted-foreground">Domain</div>
                      <div className="font-medium">{clientDomain}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Data Sources */}
            {(isAnalyzing || analysis) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Data Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dataSources.map((source) => (
                    <div key={source.id} className="flex items-center gap-2 text-sm">
                      {source.status === 'idle' && <div className="h-2 w-2 rounded-full bg-muted" />}
                      {source.status === 'loading' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                      {source.status === 'success' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                      {source.status === 'error' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      {source.status === 'not-found' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{source.label}</div>
                        {source.message && (
                          <div className="text-xs text-muted-foreground truncate">{source.message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Notion Tasks Summary */}
            {notionTasks.completed > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-purple-600" />
                    SEO Tasks Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 mb-2">{notionTasks.completed}</div>
                  <div className="text-xs text-muted-foreground mb-3">Last 90 days</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {notionTasks.tasks.slice(0, 5).map((task, idx) => (
                      <div key={idx} className="text-xs p-2 bg-muted/50 rounded truncate">
                        {task.title}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Slack Activity */}
            {slackActivity.count > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    Team Discussions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium mb-2">{slackActivity.count} messages found</div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {slackActivity.highlights.slice(0, 3).map((msg, idx) => (
                      <div key={idx} className="text-xs p-2 bg-muted/50 rounded">
                        <div className="truncate">{msg.text}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {!analysis && !isAnalyzing && !selectedClient && (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Select a client to analyze</p>
                  <p className="text-sm">Choose a client from the sidebar to generate an SEO report</p>
                </div>
              </Card>
            )}

            {!analysis && !isAnalyzing && selectedClient && !clientDomain && (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-40 text-amber-500" />
                  <p className="text-lg font-medium">No domain configured</p>
                  <p className="text-sm">Please add a domain for {selectedClient} in the Looker Directory</p>
                </div>
              </Card>
            )}

            {isAnalyzing && (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-emerald-500" />
                  <p className="text-lg font-medium">Analyzing SEO Data...</p>
                  <p className="text-sm text-muted-foreground">Gathering metrics, Notion tasks, Slack activity for {selectedClient}</p>
                </div>
              </Card>
            )}

            {analysis && (
              <div className="space-y-6">
                {/* Health Summary with Trends */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">SEO Health Summary</CardTitle>
                      <Badge className={getHealthColor(analysis.overallHealth)}>
                        {analysis.overallHealth.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{analysis.summary}</p>
                    
                    {/* Progress Summary */}
                    {analysis.progressSummary && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-4 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-sm font-medium">
                          <ClipboardCheck className="h-4 w-4" />
                          Work Progress
                        </div>
                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">{analysis.progressSummary}</p>
                      </div>
                    )}
                    
                    {/* Key Metrics with Trends */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-emerald-600">
                            {formatNumber(analysis.metrics?.organicKeywords)}
                          </div>
                          {historicalData.length > 1 && (() => {
                            const trend = calculateTrend(historicalData, 'organic_keywords');
                            return trend.direction !== 'flat' ? (
                              <div className={`flex items-center text-xs ${trend.direction === 'up' ? 'text-emerald-600' : 'text-destructive'}`}>
                                {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {trend.value.toFixed(0)}%
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Organic Keywords</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatNumber(analysis.metrics?.organicTraffic)}
                          </div>
                          {historicalData.length > 1 && (() => {
                            const trend = calculateTrend(historicalData, 'organic_traffic');
                            return trend.direction !== 'flat' ? (
                              <div className={`flex items-center text-xs ${trend.direction === 'up' ? 'text-emerald-600' : 'text-destructive'}`}>
                                {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {trend.value.toFixed(0)}%
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Monthly Traffic</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-purple-600">
                          {analysis.metrics?.domainAuthority || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Domain Authority</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-amber-600">
                            {formatNumber(analysis.metrics?.backlinks)}
                          </div>
                          {historicalData.length > 1 && (() => {
                            const trend = calculateTrend(historicalData, 'backlinks');
                            return trend.direction !== 'flat' ? (
                              <div className={`flex items-center text-xs ${trend.direction === 'up' ? 'text-emerald-600' : 'text-destructive'}`}>
                                {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {trend.value.toFixed(0)}%
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Backlinks</div>
                      </div>
                      {/* Site Errors - Critical Metric */}
                      <div className={`p-4 rounded-lg ${
                        analysis.metrics?.siteErrors != null 
                          ? analysis.metrics.siteErrors > 200 
                            ? 'bg-destructive/10 border border-destructive/30' 
                            : analysis.metrics.siteErrors > 50 
                              ? 'bg-amber-500/10 border border-amber-500/30' 
                              : 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-muted/50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className={`text-2xl font-bold ${
                            analysis.metrics?.siteErrors != null 
                              ? analysis.metrics.siteErrors > 200 
                                ? 'text-destructive' 
                                : analysis.metrics.siteErrors > 50 
                                  ? 'text-amber-600' 
                                  : 'text-emerald-600'
                              : 'text-muted-foreground'
                          }`}>
                            {analysis.metrics?.siteErrors != null ? analysis.metrics.siteErrors : 'N/A'}
                          </div>
                          {analysis.metrics?.siteAuditUrl && (
                            <a 
                              href={analysis.metrics.siteAuditUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">Site Errors</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="trends">
                      <History className="h-4 w-4 mr-1" />
                      Trends
                    </TabsTrigger>
                    <TabsTrigger value="keywords">Keywords</TabsTrigger>
                    <TabsTrigger value="competitors">Competitors</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>

                  {/* Trends Tab */}
                  <TabsContent value="trends" className="space-y-4">
                    {historicalData.length > 1 ? (
                      <>
                        {/* Traffic & Keywords Chart */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Traffic & Keywords Over Time
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                                  <Tooltip />
                                  <Legend />
                                  <Line yAxisId="left" type="monotone" dataKey="traffic" name="Traffic" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                                  <Line yAxisId="right" type="monotone" dataKey="keywords" name="Keywords" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Tasks & Backlinks Chart */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <ClipboardCheck className="h-4 w-4" />
                              SEO Tasks & Backlinks
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                                  <Tooltip />
                                  <Legend />
                                  <Line yAxisId="left" type="monotone" dataKey="tasks" name="Tasks Completed" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7' }} />
                                  <Line yAxisId="right" type="monotone" dataKey="backlinks" name="Backlinks" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Trend Summary */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Trend Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {['organic_traffic', 'organic_keywords', 'backlinks', 'notion_tasks_completed'].map((key) => {
                                const trend = calculateTrend(historicalData, key as keyof HistoricalDataPoint);
                                const labels: Record<string, string> = {
                                  organic_traffic: 'Traffic',
                                  organic_keywords: 'Keywords',
                                  backlinks: 'Backlinks',
                                  notion_tasks_completed: 'Tasks'
                                };
                                return (
                                  <div key={key} className="p-3 rounded-lg border text-center">
                                    <div className={`flex items-center justify-center gap-1 text-lg font-bold ${
                                      trend.direction === 'up' ? 'text-emerald-600' : 
                                      trend.direction === 'down' ? 'text-destructive' : 'text-muted-foreground'
                                    }`}>
                                      {trend.direction === 'up' && <TrendingUp className="h-5 w-5" />}
                                      {trend.direction === 'down' && <TrendingDown className="h-5 w-5" />}
                                      {trend.value > 0 ? `${trend.value.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{labels[key]}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <Card className="h-64 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No Historical Data Yet</p>
                          <p className="text-sm">Run analyses over time to see trends</p>
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="overview" className="space-y-4">
                    {/* Insights */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Key Insights</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.insights?.map((insight, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                            {getInsightIcon(insight.type)}
                            <div className="flex-1">
                              <div className="font-medium">{insight.title}</div>
                              <div className="text-sm text-muted-foreground">{insight.description}</div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {insight.impact}
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Content Opportunities */}
                    {analysis.contentOpportunities && analysis.contentOpportunities.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Content Opportunities
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysis.contentOpportunities.map((opp, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div>
                                  <div className="font-medium">{opp.topic}</div>
                                  <div className="text-sm text-muted-foreground">{opp.rationale}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">{formatNumber(opp.searchVolume)} vol</div>
                                  <div className="text-xs text-muted-foreground">Difficulty: {opp.difficulty}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="keywords" className="space-y-4">
                    {/* Top Keywords */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Top Ranking Keywords</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analysis.topKeywords?.slice(0, 10).map((kw, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                                  #{kw.position}
                                </div>
                                <div>
                                  <div className="font-medium">{kw.keyword}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[300px]">{kw.url}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{formatNumber(kw.volume)} vol</div>
                                <div className="text-xs text-muted-foreground">${kw.cpc?.toFixed(2) || '0.00'} CPC</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Keyword Gaps */}
                    {analysis.keywordGaps && analysis.keywordGaps.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Keyword Gap Opportunities
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysis.keywordGaps.map((gap, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div>
                                  <div className="font-medium">{gap.keyword}</div>
                                  <div className="text-sm text-muted-foreground">{gap.opportunity}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm">
                                    Competitor: #{gap.competitorRanking} | You: {gap.ourPosition ? `#${gap.ourPosition}` : 'Not ranking'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{formatNumber(gap.volume)} monthly searches</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="competitors" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Competitor Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analysis.competitors?.map((comp, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-muted/30">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{comp.domain}</span>
                                </div>
                                <a 
                                  href={`https://${comp.domain}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  Visit <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">Common Keywords</div>
                                  <div className="font-medium">{formatNumber(comp.commonKeywords)}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Organic Keywords</div>
                                  <div className="font-medium">{formatNumber(comp.organicKeywords)}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Organic Traffic</div>
                                  <div className="font-medium">{formatNumber(comp.organicTraffic)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="actions" className="space-y-4">
                    {/* Recommendations */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Recommended Actions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analysis.recommendations?.map((rec, idx) => (
                            <div key={idx} className="p-4 rounded-lg border">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                                  >
                                    {rec.priority}
                                  </Badge>
                                  <Badge variant="outline">{rec.effort}</Badge>
                                </div>
                              </div>
                              <div className="font-medium mb-1">{rec.action}</div>
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Expected Impact:</span> {rec.expectedImpact}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Technical Issues */}
                    {analysis.technicalIssues && analysis.technicalIssues.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Technical Issues
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysis.technicalIssues.map((issue, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{issue.issue}</span>
                                  <Badge 
                                    variant={issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'default' : 'secondary'}
                                  >
                                    {issue.severity}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">Fix:</span> {issue.fix}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SeoBot;

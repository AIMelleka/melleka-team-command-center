import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, FileText, MessageSquare, Mail, Loader2, Copy, Check, Sparkles, Database, CheckCircle2, Circle, AlertCircle, Settings2, ChevronDown, ChevronUp, Save, Calendar, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

type UpdateType = 'status-report' | 'task-update' | 'communication-draft';

/**
 * Extract database ID from a Notion URL or return the raw ID if already in UUID format.
 */
function extractDatabaseId(input: string): string {
  if (!input) return "";
  
  const trimmed = input.trim();
  
  // If it's already a UUID format (with or without dashes), return normalized
  const uuidPattern = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
  if (uuidPattern.test(trimmed)) {
    const clean = trimmed.replace(/-/g, "");
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  
  // Try to extract from Notion URL (last 32 hex characters before query params)
  const urlMatch = trimmed.match(/([a-f0-9]{32})(?:\?|$)/i);
  if (urlMatch) {
    const clean = urlMatch[1];
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  
  // Also try pattern with dashes already in URL
  const dashedMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (dashedMatch) {
    return dashedMatch[1];
  }
  
  return trimmed;
}

interface DataSourceStatus {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'success' | 'error' | 'not-found';
  message?: string;
  data?: string;
}

// Default master prompt
const DEFAULT_MASTER_PROMPT = `OBJECTIVE (NON-NEGOTIABLE)

Produce a COMPLETE, ACCURATE, ONE-TO-ONE list of all completed tasks for a single client within a specific date range.

Never summarize. Never merge. Never invent. Never omit.

If even one qualifying task is missing, the output is invalid.

FILTERING RULES (MANDATORY)
- Date field: Last edited time
- Date range: User-provided range
- Status: STATUS contains "Done"
- Hard exclusion: STATUS does NOT contain "NON-ESSENTIAL" or "NON ESSENTIAL"

CLIENT MATCHING (ERR ON INCLUSION)
Include a task if CLIENTS or Task name contains the client name, abbreviation, alias, shorthand, or common typo (case-insensitive). If unsure, include the task.

COMPLETION DEFINITION (STRICT)
A task is completed if STATUS contains "Done" or clearly implies completion. Ignore checkboxes entirely.

CATEGORIZATION (STRICT PLATFORM RULES)
Tasks must be categorized by the platform actually modified, not implied.

GOOGLE: Google Ads, Analytics/GA4, Tag Manager, Search Console, Business Profile, Sitelinks, conversions, ad groups
META: Facebook, Instagram, Meta Ads, Business Manager, Pixel
WEBSITE: Website banners, page edits, copy changes, UX/UI, videos added to site, link replacements
SEO: Keywords, metadata, rankings, on-page optimization, SEO-related structured snippets
EMAIL MARKETING: Campaigns, automations, templates, newsletters
CRM / AUTOMATIONS: HubSpot, Zapier, pipelines, integrations
CONTENT / CREATIVE: Copywriting, video creation, graphics, creative assets
REPORTING / ANALYTICS: Reports, dashboards, tracking verification

OUTPUT FORMAT (LOCKED)
- Bold platform headers
- Bullet list under each header
- 1 task = 1 bullet
- Past tense only
- Original task specificity preserved
- No summaries, no intro text, no client names, no interpretation
- NO URLs in task bullets (strip all links)

At the end, add:
Source
Database: IN HOUSE TO-DO
Client filter: [client name + aliases]
Date field: Last edited time
Date range: [exact range]
Status filter: STATUS contains "Done"
Hard exclusion: STATUS does NOT contain "NON-ESSENTIAL"

Reminder: Don't forget to include social media posts in the update.`;

// Default Notion database ID (IN HOUSE TO-DO)
// NOTE: Older builds used a legacy DB id that is not accessible; we auto-migrate it.
const LEGACY_NOTION_DATABASE_ID = 'bf762858-67b7-49ca-992d-fdfc8c43d7fa';
const DEFAULT_NOTION_DATABASE_ID = '9e7cd72f-e62c-4514-9456-5f51cbcfe981';

// Your connected Google Sheet for client data
const CONNECTED_SPREADSHEET_ID = '1nKskjFVwoaBS6DTnZx0xz5mze0L0auDH9HisDWZz_b0';


// Cache for sheet tabs and looker directory
let sheetTabsCache: string[] | null = null;
let lookerDirectoryCache: Record<string, string> | null = null;

const ClientUpdate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [clientName, setClientName] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  
  // Custom abbreviations/aliases for client matching
  const [customAliases, setCustomAliases] = useState(() => {
    const saved = localStorage.getItem('client-update-custom-aliases');
    return saved || '';
  });
  const [aliasesSaved, setAliasesSaved] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Master prompt state
  const [masterPrompt, setMasterPrompt] = useState(() => {
    const saved = localStorage.getItem('client-update-master-prompt');
    return saved || DEFAULT_MASTER_PROMPT;
  });
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [promptSaved, setPromptSaved] = useState(true);

  // Notion database ID state
  const [notionDatabaseId, setNotionDatabaseId] = useState(() => {
    const saved = localStorage.getItem('client-update-notion-db-id') || '';
    const normalized = extractDatabaseId(saved);

    // If user previously stored a full URL, normalize + persist it.
    if (saved && normalized && normalized !== saved) {
      localStorage.setItem('client-update-notion-db-id', normalized);
    }

    const candidate = normalized || DEFAULT_NOTION_DATABASE_ID;

    // Auto-migrate the legacy ID to the working DB.
    if (candidate === LEGACY_NOTION_DATABASE_ID) {
      localStorage.setItem('client-update-notion-db-id', DEFAULT_NOTION_DATABASE_ID);
      return DEFAULT_NOTION_DATABASE_ID;
    }

    return candidate;
  });

  // Date range state (default to last 7 days)
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  
  const [updateTypes, setUpdateTypes] = useState<Set<UpdateType>>(new Set(['status-report', 'task-update', 'communication-draft']));
  
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([
    { id: 'google-sheets', label: 'Google Sheets', status: 'idle' },
    { id: 'notion', label: 'Notion Tasks', status: 'idle' },
    { id: 'looker-studio', label: 'Looker Studio', status: 'idle' },
  ]);

  // Load caches on mount
  useEffect(() => {
    loadSheetTabs();
    loadLookerDirectory();
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Notion connection test state
  const [isTestingNotion, setIsTestingNotion] = useState(false);
  const [notionTestResult, setNotionTestResult] = useState<{
    success: boolean;
    message: string;
    databaseTitle?: string;
  } | null>(null);

  const loadSheetTabs = async () => {
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
    if (lookerDirectoryCache) return lookerDirectoryCache;

    try {
      const { data, error } = await supabase
        .from('managed_clients')
        .select('client_name, looker_url')
        .eq('is_active', true);
      if (error) throw error;

      const directory: Record<string, string> = {};
      for (const mc of data || []) {
        if ((mc as any).looker_url) {
          const normalizedName = mc.client_name.toLowerCase().trim();
          directory[normalizedName] = (mc as any).looker_url;
          const baseName = mc.client_name.split(' - ')[0].trim().toLowerCase();
          if (baseName !== normalizedName) directory[baseName] = (mc as any).looker_url;
        }
      }

      lookerDirectoryCache = directory;
      return directory;
    } catch (error) {
      console.error('Error loading Looker directory:', error);
      return {};
    }
  };

  /**
   * Generate comprehensive client aliases for fuzzy matching.
   * Handles abbreviations like "San Diego Parks Foundation" → ["sdpf", "sd", "san diego", etc.]
   * Also includes any custom aliases defined by the user.
   */
  const generateClientAliases = (clientName: string): string[] => {
    const name = clientName.toLowerCase().trim();
    const aliases = new Set<string>();
    
    aliases.add(name);
    
    // Add user-defined custom aliases first (highest priority)
    if (customAliases.trim()) {
      const customList = customAliases
        .split(/[,\n]+/)
        .map(a => a.trim().toLowerCase())
        .filter(Boolean);
      customList.forEach(alias => aliases.add(alias));
    }
    
    const words = name.split(/\s+/).filter(Boolean);
    
    if (words.length > 1) {
      // First letter acronym: "San Diego Parks Foundation" → "sdpf"
      aliases.add(words.map((w) => w[0]).join(""));
      
      // First two words: "san diego"
      if (words.length >= 2) {
        aliases.add(words.slice(0, 2).join(" "));
        aliases.add(words.slice(0, 2).join(""));
      }
      
      // First word only
      aliases.add(words[0]);
      
      // Each significant word (3+ chars)
      words.forEach((w) => {
        if (w.length >= 3) aliases.add(w);
      });
      
      // Two-letter abbreviations: "sd", "sdp"
      if (words.length >= 2) {
        aliases.add(words[0][0] + words[1][0]);
      }
      if (words.length >= 3) {
        aliases.add(words[0][0] + words[1][0] + words[2][0]);
      }
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
    localStorage.setItem('client-update-custom-aliases', customAliases);
    setAliasesSaved(true);
    toast({ title: 'Aliases saved!', description: 'Your custom abbreviations have been saved.' });
  };

  const findBestSheetMatch = (clientName: string, tabs: string[]): string | null => {
    const aliases = generateClientAliases(clientName);
    
    // Exact match first (any alias)
    for (const alias of aliases) {
      const exactMatch = tabs.find(tab => tab.toLowerCase().trim() === alias);
      if (exactMatch) return exactMatch;
    }
    
    // Partial match (tab contains alias or alias contains tab)
    for (const alias of aliases) {
      const partialMatch = tabs.find(tab => {
        const tabLower = tab.toLowerCase().trim();
        return tabLower.includes(alias) || alias.includes(tabLower);
      });
      if (partialMatch) return partialMatch;
    }
    
    // Word-based matching with any alias word
    const allWords = aliases.flatMap(a => a.split(/\s+/)).filter(w => w.length >= 2);
    const wordMatch = tabs.find(tab => {
      const tabLower = tab.toLowerCase();
      return allWords.some(word => tabLower.includes(word));
    });
    
    return wordMatch || null;
  };

  const findLookerUrl = (clientName: string): string => {
    if (!lookerDirectoryCache) return '';
    
    const aliases = generateClientAliases(clientName);
    
    // Check each alias against the directory
    for (const alias of aliases) {
      if (lookerDirectoryCache[alias]) {
        return lookerDirectoryCache[alias];
      }
    }
    
    // Fuzzy match: check if any directory key contains an alias or vice versa
    for (const alias of aliases) {
      for (const [key, url] of Object.entries(lookerDirectoryCache)) {
        if (key.includes(alias) || alias.includes(key)) {
          return url;
        }
      }
    }
    
    return '';
  };

  const updateSourceStatus = (id: string, status: DataSourceStatus['status'], message?: string, data?: string) => {
    setDataSources(prev => prev.map(s => 
      s.id === id ? { ...s, status, message, data: data ?? s.data } : s
    ));
  };

  // Fetch Google Sheets data
  const fetchGoogleSheets = async (clientName: string): Promise<string | null> => {
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
        body: { 
          spreadsheetId: CONNECTED_SPREADSHEET_ID,
          sheetName: matchedTab,
        },
      });

      if (error) throw error;

      let formattedData = `# ${matchedTab} - Google Sheets Data\n\n`;
      
      if (data.headers && data.headers.length > 0) {
        formattedData += `## Columns: ${data.headers.join(', ')}\n\n`;
      }

      if (data.rows && data.rows.length > 0) {
        formattedData += `## Data (${data.rows.length} rows)\n\n`;
        data.rows.forEach((row: Record<string, string>, index: number) => {
          formattedData += `### Row ${index + 1}\n`;
          Object.entries(row).forEach(([key, value]) => {
            if (value) {
              formattedData += `- ${key}: ${value}\n`;
            }
          });
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

  // Fetch Notion tasks
  const fetchNotionTasks = async (clientName: string): Promise<string | null> => {
    updateSourceStatus('notion', 'loading', 'Fetching tasks from Notion...');
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-notion-tasks', {
        body: { 
          clientName, 
          databaseId: notionDatabaseId,
          startDate,
          endDate,
        },
      });

      // For non-2xx responses, Supabase returns `error` and the JSON is available on error.context.json.
      if (error) {
        const errJson = (error as any)?.context?.json;
        const message = errJson?.help || errJson?.error || error.message || 'Failed to fetch tasks';
        updateSourceStatus('notion', 'error', message);
        return null;
      }

      if (data.error) {
        updateSourceStatus('notion', 'error', data.help || data.error);
        return null;
      }

      if (data.totalTasks === 0) {
        updateSourceStatus('notion', 'not-found', 'No tasks found for this client');
        return null;
      }

      updateSourceStatus('notion', 'success', `${data.activeTasks} active, ${data.completedTasks} completed`, data.formattedContent);
      return data.formattedContent;
    } catch (error) {
      console.error('Error fetching Notion tasks:', error);
      const errJson = (error as any)?.context?.json;
      updateSourceStatus('notion', 'error', errJson?.help || errJson?.error || 'Failed to fetch tasks');
      return null;
    }
  };


  // Fetch Looker Studio URL
  const fetchLookerStudio = async (clientName: string): Promise<string | null> => {
    updateSourceStatus('looker-studio', 'loading', 'Looking up dashboard...');
    
    try {
      await loadLookerDirectory();
      const url = findLookerUrl(clientName);
      
      if (url) {
        const content = `Looker Studio Dashboard: ${url}`;
        updateSourceStatus('looker-studio', 'success', 'Dashboard found', content);
        return content;
      } else {
        updateSourceStatus('looker-studio', 'not-found', 'No dashboard linked');
        return null;
      }
    } catch (error) {
      console.error('Error fetching Looker Studio:', error);
      updateSourceStatus('looker-studio', 'error', 'Failed to lookup dashboard');
      return null;
    }
  };

  // Main function: fetch all data and generate update
  const handleGetUpdate = async () => {
    if (!clientName.trim()) {
      toast({
        title: 'Client name required',
        description: 'Please enter the client name',
        variant: 'destructive',
      });
      return;
    }

    setGeneratedContent('');
    setIsFetchingData(true);
    
    // Reset all sources to loading state
    setDataSources(prev => prev.map(s => ({ ...s, status: 'idle', message: undefined, data: undefined })));

    try {
      // Fetch all data sources in parallel
      const [sheetsData, notionData, lookerData] = await Promise.all([
        fetchGoogleSheets(clientName),
        fetchNotionTasks(clientName),
        fetchLookerStudio(clientName),
      ]);

      setIsFetchingData(false);

      // Compile all available data
      const availableSources: { type: string; content: string }[] = [];
      
      if (sheetsData) {
        availableSources.push({ type: 'google-sheets', content: sheetsData });
      }
      if (notionData) {
        availableSources.push({ type: 'notion', content: notionData });
      }
      if (lookerData) {
        availableSources.push({ type: 'looker-studio', content: lookerData });
      }

      if (availableSources.length === 0) {
        const diagnostics = dataSources
          .map((s) => {
            const statusLabel =
              s.status === 'idle'
                ? 'not run'
                : s.status === 'loading'
                  ? 'loading'
                  : s.status === 'success'
                    ? 'success'
                    : s.status === 'not-found'
                      ? 'no results'
                      : 'error';
            const detail = s.message ? ` - ${s.message}` : '';
            return `- ${s.label}: ${statusLabel}${detail}`;
          })
          .join('\n');

        setGeneratedContent(
          [
            'Setup issues detected - no usable data was returned from any source.',
            '',
            `Client: ${clientName}`,
            `Date range: ${startDate} to ${endDate}`,
            '',
            'Source status:',
            diagnostics,
            '',
            'Next steps:',
            '- Notion: the database must be shared with your Notion integration (or the Database ID must be updated in Master Prompt settings).',
            '- Google Sheets / Looker: ensure the connected spreadsheets are shared with your service account.',
          ].join('\n')
        );

        toast({
          title: 'Setup required',
          description: 'No usable data returned yet - see details in the output panel.',
          variant: 'destructive',
        });
        return;
      }

      // Generate the update
      setIsGenerating(true);

      const { data, error } = await supabase.functions.invoke('client-update', {
        body: {
          clientName,
          updateTypes: Array.from(updateTypes),
          dataSources: availableSources,
          additionalContext,
          masterPrompt,
          dateRange: { startDate, endDate },
        },
      });

      if (error) throw error;

      setGeneratedContent(data.content || 'No content generated');
      toast({
        title: 'Update generated!',
        description: `Created from ${availableSources.length} data source${availableSources.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate update',
        variant: 'destructive',
      });
    } finally {
      setIsFetchingData(false);
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isFetchingData && !isGenerating) {
      handleGetUpdate();
    }
  };

  const toggleUpdateType = (type: UpdateType) => {
    const newTypes = new Set(updateTypes);
    if (newTypes.has(type)) {
      if (newTypes.size > 1) {
        newTypes.delete(type);
      }
    } else {
      newTypes.add(type);
    }
    setUpdateTypes(newTypes);
  };

  const handlePromptChange = (value: string) => {
    setMasterPrompt(value);
    setPromptSaved(false);
  };

  const savePrompt = () => {
    localStorage.setItem('client-update-master-prompt', masterPrompt);
    setPromptSaved(true);
    toast({ title: 'Master prompt saved!' });
  };

  const resetPrompt = () => {
    setMasterPrompt(DEFAULT_MASTER_PROMPT);
    localStorage.setItem('client-update-master-prompt', DEFAULT_MASTER_PROMPT);
    setPromptSaved(true);
    toast({ title: 'Master prompt reset to default' });
  };

  // Test Notion connection
  const testNotionConnection = async () => {
    setIsTestingNotion(true);
    setNotionTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-notion-tasks', {
        body: { 
          databaseId: notionDatabaseId,
          testConnection: true,
        },
      });

      if (error) throw error;

      if (data.success) {
        setNotionTestResult({
          success: true,
          message: data.message,
          databaseTitle: data.databaseTitle,
        });
        toast({
          title: 'Connection successful!',
          description: `Connected to "${data.databaseTitle}"`,
        });
      } else {
        setNotionTestResult({
          success: false,
          message: data.error || 'Connection failed',
        });
        toast({
          title: 'Connection failed',
          description: data.help || data.error,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorData = error?.context?.json || error;
      setNotionTestResult({
        success: false,
        message: errorData?.help || errorData?.error || 'Connection failed',
      });
      toast({
        title: 'Connection failed',
        description: errorData?.help || 'Could not connect to Notion database',
        variant: 'destructive',
      });
    } finally {
      setIsTestingNotion(false);
    }
  };

  const handleNotionDbChange = (value: string) => {
    // Auto-extract database ID from URL if pasted
    const extractedId = extractDatabaseId(value);
    setNotionDatabaseId(extractedId);
    localStorage.setItem('client-update-notion-db-id', extractedId);
    // Reset test result when ID changes
    setNotionTestResult(null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const updateTypeOptions = [
    { id: 'status-report' as UpdateType, label: 'Status Report', icon: FileText },
    { id: 'task-update' as UpdateType, label: 'Task Update', icon: MessageSquare },
    { id: 'communication-draft' as UpdateType, label: 'Communication', icon: Mail },
  ];

  const getStatusIcon = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'not-found':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/50" />;
    }
  };

  const isLoading = isFetchingData || isGenerating;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-genie-purple">
              <Users className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Client Update Bot</h1>
              <p className="text-muted-foreground">Type a client name to get a comprehensive update</p>
            </div>
          </div>
        </div>

        {/* Custom Abbreviations Section */}
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Client Abbreviations</CardTitle>
                {!aliasesSaved && (
                  <span className="text-xs text-primary">(unsaved)</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={saveAliases}
                disabled={aliasesSaved}
                className="h-7 text-xs"
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
            <CardDescription className="text-xs mt-1">
              Add abbreviations or aliases to help match your clients across all data sources (comma or line separated)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <Textarea
              value={customAliases}
              onChange={(e) => handleAliasesChange(e.target.value)}
              placeholder="SDPF, SD, San Diego, Parks Foundation&#10;ACME, Acme Corp, AC&#10;..."
              className="min-h-[80px] text-sm font-mono bg-background"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Example: For "San Diego Parks Foundation", add: <code className="bg-muted px-1 rounded">SDPF, SD, San Diego</code>
            </p>
          </CardContent>
        </Card>

        {/* Master Prompt Editor */}
        <Card className="mb-6 border-dashed">
          <CardHeader className="py-3 cursor-pointer" onClick={() => setIsPromptExpanded(!isPromptExpanded)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Master Prompt</CardTitle>
                {!promptSaved && (
                  <span className="text-xs text-primary">(unsaved changes)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isPromptExpanded && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetPrompt();
                      }}
                      className="h-7 text-xs"
                    >
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        savePrompt();
                      }}
                      disabled={promptSaved}
                      className="h-7 text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </>
                )}
                {isPromptExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
          {isPromptExpanded && (
            <CardContent className="pt-0 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">AI Instructions</Label>
                <Textarea
                  value={masterPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="Enter the master prompt for the AI..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notion Database ID or URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={notionDatabaseId}
                    onChange={(e) => handleNotionDbChange(e.target.value)}
                    placeholder="Paste Notion URL or Database ID..."
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      testNotionConnection();
                    }}
                    disabled={isTestingNotion || !notionDatabaseId}
                    className="h-9 px-3"
                  >
                    {isTestingNotion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Test</span>
                  </Button>
                </div>
                {notionTestResult && (
                  <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${notionTestResult.success ? 'text-primary' : 'text-destructive'}`}>
                    {notionTestResult.success ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    <span>{notionTestResult.message}</span>
                  </div>
                )}
                {!notionTestResult && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste a Notion database URL or ID. The database must be shared with your integration.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Settings are saved to your browser automatically.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Main Input Section */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Date Range */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="startDate" className="text-xs text-muted-foreground mb-1 block">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate" className="text-xs text-muted-foreground mb-1 block">
                    End Date
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Client Name Input */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="clientName" className="sr-only">Client Name</Label>
                  <Input
                    ref={inputRef}
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter client name (e.g., Acme Corporation)"
                    className="text-lg h-12"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={handleGetUpdate}
                  disabled={isLoading || !clientName.trim()}
                  size="lg"
                  className="h-12 px-6"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isFetchingData ? 'Fetching...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Get Update
                    </>
                  )}
                </Button>
              </div>

              {/* Update Type Pills */}
              <div className="flex flex-wrap gap-2">
                {updateTypeOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => toggleUpdateType(option.id)}
                    disabled={isLoading}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      updateTypes.has(option.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Data Sources Status */}
              {(isFetchingData || dataSources.some(s => s.status !== 'idle')) && (
                <div className="flex flex-wrap gap-3 pt-2 border-t">
                  {dataSources.map(source => (
                    <div 
                      key={source.id}
                      className={`flex items-center gap-2 text-sm ${
                        source.status === 'success' ? 'text-primary' :
                        source.status === 'error' ? 'text-destructive' :
                        source.status === 'not-found' ? 'text-muted-foreground' :
                        'text-foreground'
                      }`}
                    >
                      {getStatusIcon(source.status)}
                      <span className="font-medium">{source.label}</span>
                      {source.message && (
                        <span className="text-xs text-muted-foreground">({source.message})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Additional Context (Collapsible) */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  + Add context or notes (optional)
                </summary>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="e.g., Focus on Q1 campaign results, mention upcoming holiday promotion..."
                  rows={2}
                  className="mt-2"
                  disabled={isLoading}
                />
              </details>
            </div>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card className="min-h-[500px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Generated Update
              </CardTitle>
              {generatedContent && (
                <CardDescription>
                  {dataSources.filter(s => s.status === 'success').length} data sources used
                </CardDescription>
              )}
            </div>
            {generatedContent && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-80 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Generating comprehensive update...</p>
              </div>
            ) : isFetchingData ? (
              <div className="flex flex-col items-center justify-center h-80 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Gathering data from all sources...</p>
              </div>
            ) : generatedContent ? (
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {generatedContent}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center text-muted-foreground">
                <Users className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">Ready to generate client updates</p>
                <p className="text-sm max-w-md">
                  Enter a client name above and press Enter or click "Get Update" to automatically fetch data from Google Sheets, Notion, and Looker Studio.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientUpdate;

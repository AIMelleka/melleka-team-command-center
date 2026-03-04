import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Globe, Check, AlertCircle, Search, TrendingUp, FileText, Camera, Palette, Upload, X, CalendarIcon, Presentation, Clock, History, Zap, BarChart3, RefreshCw, Database, Activity, MessageSquare, Mail, Image, Trash2, ClipboardList, Instagram, Plus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import GenieLamp from '@/components/icons/GenieLamp';
import { apiService } from '@/lib/apiService';
import { similarityScore } from '@/lib/fuzzyMatch';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ScreenshotData {
  url: string;
  screenshot: string | null;
  title: string;
}

interface BrandingData {
  logo?: string | null;
  favicon?: string | null;
  ogImage?: string | null;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textPrimary?: string;
    textSecondary?: string;
  };
  fonts?: Array<{ family: string }>;
  colorScheme?: string;
  metadata?: {
    title?: string;
    description?: string;
  };
  screenshot?: string | null;
  screenshots?: ScreenshotData[];
  discoveredPages?: string[];
}

interface SeoData {
  domain: string;
  organicKeywords?: number;
  organicTraffic?: number;
  organicTrafficCost?: number;
  domainAuthority?: number;
  backlinks?: number;
  referringDomains?: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty?: number;
    cpc?: number;
    trafficPercent?: number;
  }>;
  competitors?: Array<{
    domain: string;
    commonKeywords: number;
    organicKeywords?: number;
    organicTraffic?: number;
  }>;
}

interface SeoDeckData {
  current: SeoData;
  previous?: {
    organicKeywords?: number;
    organicTraffic?: number;
    domainAuthority?: number;
    backlinks?: number;
    referringDomains?: number;
  };
  siteAudit?: {
    errors: number;
    warnings: number;
    notices: number;
    lastScraped: string;
  };
}


interface ClientInfo {
  name: string;
  lookerUrl?: string;
  ga4PropertyId?: string;
  domain?: string;
  logoUrl?: string;
  profileId?: string;
}

interface SupermetricsAccount {
  id: string;
  name: string;
}

interface TopCreative {
  adName: string;
  campaignName: string;
  imageUrl: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

interface SupermetricsPlatformData {
  label: string;
  accountName?: string;
  platformKey?: string;
  summary: Record<string, number>;
  rawData: { headers: string[]; rows: string[][] } | null;
  previousPeriod?: Record<string, number>;
  topContent?: TopCreative[];
}

interface RecentDeck {
  id: string;
  clientName: string;
  createdAt: string;
  brandColors?: { primary?: string; secondary?: string };
}

interface CampaignUpload {
  id: string;
  file: File;
  previewUrl: string;
  storagePath?: string;
  publicUrl?: string;
  uploading: boolean;
  type: 'screenshot' | 'data';
}

interface GenerationStage {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error' | 'warning';
  message?: string;
}

// Helper function to check if a color is light (for contrast)
const isLightColorCheck = (color: string): boolean => {
  if (!color) return false;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }
  return false;
};

const DeckBuilder = () => {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [isScraping, setIsScraping] = useState(false);
  const [isFetchingSeo, setIsFetchingSeo] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [websiteContent, setWebsiteContent] = useState<string>('');
  const [screenshotCount, setScreenshotCount] = useState(6);

  // Client selection from Google Sheet
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [recentDecks, setRecentDecks] = useState<RecentDeck[]>([]);

  const [formData, setFormData] = useState({
    clientName: '',
    websiteUrl: '',
    notes: '',
    deckPrimaryColor: '#9b87f5',
    deckBackgroundColor: '#1A1F2C',
    deckTextColor: '',
    deckTextMutedColor: '',
  });

  // Date range
  const [dateStart, setDateStart] = useState<Date>(startOfWeek(subDays(new Date(), 7)));
  const [dateEnd, setDateEnd] = useState<Date>(endOfWeek(subDays(new Date(), 7)));

  // Load saved social accounts when client is selected
  const handleLoadSocialAccounts = useCallback(async (clientNameToLoad: string) => {
    if (!clientNameToLoad) return;
    setIsFetchingSocialAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-social-media', {
        body: { action: 'get-accounts', clientName: clientNameToLoad }
      });
      if (error) throw error;
      if (data?.socialAccounts && data.socialAccounts.length > 0) {
        setSocialAccounts(data.socialAccounts);
        setSocialProfileId(data.profileId);
        toast.success(`Loaded ${data.socialAccounts.length} saved social accounts`);
      } else {
        setSocialAccounts([]);
        setSocialProfileId(data?.profileId || null);
      }
    } catch (err) {
      console.error('Error loading social accounts:', err);
    } finally {
      setIsFetchingSocialAccounts(false);
    }
  }, []);

  // Auto-load social accounts when client name changes (after entering step 2)
  useEffect(() => {
    if (formData.clientName && step === 2) {
      handleLoadSocialAccounts(formData.clientName);
    }
  }, [formData.clientName, step, handleLoadSocialAccounts]);

  const handleSaveSocialAccounts = async () => {
    if (!formData.clientName || socialAccounts.length === 0) return;
    try {
      const { data, error } = await supabase.functions.invoke('scrape-social-media', {
        body: { action: 'save-accounts', clientName: formData.clientName, socialAccounts }
      });
      if (error) throw error;
      if (data?.profileId) setSocialProfileId(data.profileId);
      toast.success('Social accounts saved for future decks!');
    } catch (err) {
      console.error('Error saving social accounts:', err);
      toast.error('Failed to save social accounts');
    }
  };

  const [socialScreenshotExtracting, setSocialScreenshotExtracting] = useState(false);
  const [scrapeAccountResults, setScrapeAccountResults] = useState<any[] | null>(null);

  const handleScrapeSocialPosts = async () => {
    if (socialAccounts.length === 0) {
      toast.error('Add at least one social media account first');
      return;
    }
    await handleSaveSocialAccounts();
    setIsScrapingSocial(true);
    setSocialPosts(null);
    setScrapeAccountResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-social-media', {
        body: {
          action: 'scrape-posts',
          clientName: formData.clientName,
          socialAccounts,
          clientProfileId: socialProfileId,
        }
      });
      if (error) throw error;
      if (data?.posts) {
        setSocialPosts(data.posts);
        const successCount = data.posts.filter((p: any) => p.contentType !== 'screenshot').length;
        if (successCount > 0) {
          toast.success(`Found ${successCount} social media posts!`);
        } else if (data.posts.length > 0) {
          toast.info('Screenshots captured but no post details extracted. Try uploading screenshots manually for better results.');
        }
      }
      if (data?.accountResults) {
        setScrapeAccountResults(data.accountResults);
      }
    } catch (err) {
      console.error('Error scraping social media:', err);
      toast.error('Failed to scrape social media posts — try uploading screenshots instead');
    } finally {
      setIsScrapingSocial(false);
    }
  };

  const handleSocialScreenshotUpload = async (files: FileList | null, platform: string, handle: string) => {
    if (!files || files.length === 0) return;
    setSocialScreenshotExtracting(true);
    const allNewPosts: any[] = [];
    for (const file of Array.from(files)) {
      // Upload to storage
      const ext = file.name.split('.').pop() || 'png';
      const path = `social_screenshots/${formData.clientName || 'unknown'}/${nanoid(8)}.${ext}`;
      try {
        const { error: uploadErr } = await supabase.storage.from('deck-campaign-assets').upload(path, file, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('deck-campaign-assets').getPublicUrl(path);
        
        // Extract posts via AI Vision
        const { data, error } = await supabase.functions.invoke('scrape-social-media', {
          body: { action: 'extract-from-screenshot', clientName: formData.clientName, screenshotUrl: urlData.publicUrl, platform, handle }
        });
        if (error) throw error;
        if (data?.posts?.length > 0) {
          allNewPosts.push(...data.posts);
        }
      } catch (err) {
        console.error('Screenshot extraction error:', err);
      }
    }
    if (allNewPosts.length > 0) {
      setSocialPosts(prev => [...(prev || []), ...allNewPosts]);
      toast.success(`Extracted ${allNewPosts.length} posts from screenshot(s)!`);
    } else {
      toast.error('Could not extract posts from the screenshot(s)');
    }
    setSocialScreenshotExtracting(false);
  };

  const addSocialAccount = () => {
    setSocialAccounts(prev => [...prev, { platform: 'instagram', handle: '', url: '' }]);
  };

  const removeSocialAccount = (index: number) => {
    setSocialAccounts(prev => prev.filter((_, i) => i !== index));
  };

  const updateSocialAccount = (index: number, field: string, value: string) => {
    setSocialAccounts(prev => prev.map((acc, i) => i === index ? { ...acc, [field]: value } : acc));
  };


  // Supermetrics state
  const [supermetricsAccounts, setSupermetricsAccounts] = useState<Record<string, SupermetricsAccount[]>>({});
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string[]>>({});
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);
  const [isFetchingAdData, setIsFetchingAdData] = useState(false);
  const [adData, setAdData] = useState<Record<string, SupermetricsPlatformData> | null>(null);
  const [seoDeckData, setSeoDeckData] = useState<SeoDeckData | null>(null);
  const [isFetchingSeoForDeck, setIsFetchingSeoForDeck] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountSearchFilters, setAccountSearchFilters] = useState<Record<string, string>>({});

  // Campaign result uploads (SMS & Email — split by sub-type)
  const [smsResultsUploads, setSmsResultsUploads] = useState<CampaignUpload[]>([]);
  const [smsCampaignUploads, setSmsCampaignUploads] = useState<CampaignUpload[]>([]);
  const [emailResultsUploads, setEmailResultsUploads] = useState<CampaignUpload[]>([]);
  const [emailDesignsUploads, setEmailDesignsUploads] = useState<CampaignUpload[]>([]);
  // New upload sections
  const [adCreativeUploads, setAdCreativeUploads] = useState<CampaignUpload[]>([]);
  const [nextEmailUploads, setNextEmailUploads] = useState<CampaignUpload[]>([]);
  const [nextSmsUploads, setNextSmsUploads] = useState<CampaignUpload[]>([]);
  const [blogPostUploads, setBlogPostUploads] = useState<CampaignUpload[]>([]);
  const [analyticsUploads, setAnalyticsUploads] = useState<CampaignUpload[]>([]);
  const [socialMediaUploads, setSocialMediaUploads] = useState<CampaignUpload[]>([]);

  // Task notes — raw text about completed work & client needs, categorized by AI into platform sections
  const [taskNotes, setTaskNotes] = useState('');

  // Social media accounts
  interface SocialAccountEntry { platform: string; handle: string; url: string; }
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountEntry[]>([]);
  const [socialProfileId, setSocialProfileId] = useState<string | null>(null);
  const [isFetchingSocialAccounts, setIsFetchingSocialAccounts] = useState(false);
  const [isScrapingSocial, setIsScrapingSocial] = useState(false);
  const [socialPosts, setSocialPosts] = useState<any[] | null>(null);

  const SOCIAL_PLATFORMS = [
    { value: 'instagram', label: 'Instagram', icon: '📸', placeholder: 'https://instagram.com/username' },
    { value: 'facebook', label: 'Facebook', icon: '📘', placeholder: 'https://facebook.com/pagename' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵', placeholder: 'https://tiktok.com/@username' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼', placeholder: 'https://linkedin.com/company/name' },
  ];

  type CampaignChannel = 'sms_results' | 'sms_campaign' | 'email_results' | 'email_designs' | 'ad_creatives' | 'next_email' | 'next_sms' | 'blog_posts' | 'analytics' | 'social_media';

  const campaignSetters: Record<CampaignChannel, React.Dispatch<React.SetStateAction<CampaignUpload[]>>> = {
    sms_results: setSmsResultsUploads,
    sms_campaign: setSmsCampaignUploads,
    email_results: setEmailResultsUploads,
    email_designs: setEmailDesignsUploads,
    ad_creatives: setAdCreativeUploads,
    next_email: setNextEmailUploads,
    next_sms: setNextSmsUploads,
    blog_posts: setBlogPostUploads,
    analytics: setAnalyticsUploads,
    social_media: setSocialMediaUploads,
  };

  const campaignUploadsMap: Record<CampaignChannel, CampaignUpload[]> = {
    sms_results: smsResultsUploads,
    sms_campaign: smsCampaignUploads,
    email_results: emailResultsUploads,
    email_designs: emailDesignsUploads,
    ad_creatives: adCreativeUploads,
    next_email: nextEmailUploads,
    next_sms: nextSmsUploads,
    blog_posts: blogPostUploads,
    analytics: analyticsUploads,
    social_media: socialMediaUploads,
  };

  const handleCampaignUpload = async (
    files: FileList | null,
    channel: CampaignChannel,
  ) => {
    if (!files || files.length === 0) return;
    const setter = campaignSetters[channel];
    const newUploads: CampaignUpload[] = Array.from(files).map(file => ({
      id: nanoid(8),
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      uploading: true,
      type: file.type.startsWith('image/') ? 'screenshot' as const : 'data' as const,
    }));
    setter(prev => [...prev, ...newUploads]);

    for (const upload of newUploads) {
      const ext = upload.file.name.split('.').pop() || 'bin';
      const path = `${channel}/${formData.clientName || 'unknown'}/${upload.id}.${ext}`;
      try {
        const { error } = await supabase.storage
          .from('deck-campaign-assets')
          .upload(path, upload.file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from('deck-campaign-assets')
          .getPublicUrl(path);
        setter(prev => prev.map(u =>
          u.id === upload.id
            ? { ...u, uploading: false, storagePath: path, publicUrl: urlData.publicUrl }
            : u
        ));
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Failed to upload ${upload.file.name}`);
        setter(prev => prev.map(u =>
          u.id === upload.id ? { ...u, uploading: false } : u
        ));
      }
    }
    toast.success(`${newUploads.length} file(s) uploaded`);
  };

  const handleRemoveCampaignUpload = async (channel: CampaignChannel, uploadId: string) => {
    const setter = campaignSetters[channel];
    const uploads = campaignUploadsMap[channel];
    const upload = uploads.find(u => u.id === uploadId);
    if (upload?.storagePath) {
      await supabase.storage.from('deck-campaign-assets').remove([upload.storagePath]);
    }
    if (upload?.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    setter(prev => prev.filter(u => u.id !== uploadId));
  };

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [deckJobId, setDeckJobId] = useState<string | null>(null);
  const [deckSlug, setDeckSlug] = useState<string | null>(null);
  const [generationStages, setGenerationStages] = useState<GenerationStage[]>([
    { id: 'input_qa', label: 'Input Validation', status: 'pending' },
    { id: 'branding', label: 'Brand Extraction', status: 'pending' },
    { id: 'screenshots', label: 'Screenshot Analysis', status: 'pending' },
    { id: 'tasks', label: 'Task Notes', status: 'pending' },
    { id: 'content_qa', label: 'Content Validation', status: 'pending' },
    { id: 'ai', label: 'AI Narrative Generation', status: 'pending' },
    { id: 'final_qa', label: 'Quality Assurance', status: 'pending' },
    { id: 'save', label: 'Saving Deck', status: 'pending' },
  ]);

  const circularProgress = useMemo(() => {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (generationProgress / 100) * circumference;
    return { circumference, offset };
  }, [generationProgress]);

  // Fetch recent decks
  useEffect(() => {
    const fetchRecentDecks = async () => {
      try {
        const { data, error } = await supabase
          .from('decks')
          .select('id, client_name, created_at, brand_colors')
          .order('created_at', { ascending: false })
          .limit(5);
        if (!error && data) {
          setRecentDecks(data.map(d => ({
            id: d.id,
            clientName: d.client_name,
            createdAt: d.created_at,
            brandColors: d.brand_colors as RecentDeck['brandColors'],
          })));
        }
      } catch (err) {
        console.error('Error fetching recent decks:', err);
      }
    };
    fetchRecentDecks();
  }, []);

  // Fetch clients from managed_clients + merge with client_profiles for logos
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data: mcData, error: mcError } = await supabase
          .from('managed_clients')
          .select('client_name, domain, ga4_property_id, looker_url')
          .eq('is_active', true);
        if (mcError) throw mcError;

        // Fetch client profiles for logos
        const { data: profiles } = await supabase
          .from('client_profiles')
          .select('id, client_name, logo_url, domain');

        const profileMap = new Map<string, { id: string; logoUrl?: string; domain?: string }>();
        profiles?.forEach(p => {
          profileMap.set(p.client_name.toLowerCase(), {
            id: p.id,
            logoUrl: p.logo_url || undefined,
            domain: p.domain || undefined
          });
        });

        const clientList: ClientInfo[] = (mcData || []).map(mc => {
          const profile = profileMap.get(mc.client_name.toLowerCase());
          return {
            name: mc.client_name,
            domain: mc.domain || '',
            ga4PropertyId: mc.ga4_property_id || '',
            lookerUrl: (mc as any).looker_url || '',
            logoUrl: profile?.logoUrl,
            profileId: profile?.id,
          };
        }).filter((c: ClientInfo) => c.name);
        setClients(clientList);
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(client => {
    if (!clientSearch) return true;
    const score = similarityScore(clientSearch, client.name);
    return score > 0.3 || client.name.toLowerCase().includes(clientSearch.toLowerCase());
  });

  const handleScrapeWebsite = async (maxScreenshots = 6) => {
    if (!formData.websiteUrl) {
      toast.error('Please enter a website URL');
      return;
    }
    setIsScraping(true);
    setScraped(false);
    setBranding(null);

    try {
      const { data, error, cached } = await apiService.scrapeWebsite(
        formData.websiteUrl,
        maxScreenshots,
        (attempt) => toast.info(`Retrying website scrape (attempt ${attempt + 1})...`)
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data returned');
      if (cached) toast.info('Using cached website data');

      if (data.success) {
        setBranding({
          logo: data.branding?.logo,
          favicon: data.branding?.favicon,
          ogImage: data.branding?.ogImage,
          colors: data.branding?.colors,
          fonts: data.branding?.fonts,
          colorScheme: data.branding?.colorScheme,
          metadata: data.metadata,
          screenshot: data.screenshot,
          screenshots: data.screenshots || [],
          discoveredPages: data.discoveredPages || [],
        });
        if (data.branding?.colors?.primary) {
          setFormData(prev => ({ ...prev, deckPrimaryColor: data.branding!.colors!.primary }));
        }
        if (data.branding?.colors?.background) {
          setFormData(prev => ({ ...prev, deckBackgroundColor: data.branding!.colors!.background }));
        }
        setWebsiteContent(data.content || '');
        setScraped(true);

        if (data.metadata?.title && !formData.clientName) {
          let cleanName = data.metadata.title
            .split('|')[0].split('-')[0].split('–')[0].split(':')[0]
            .replace(/Home|Official|Website|Site|Page/gi, '').trim();
          if (cleanName.length > 0) {
            setFormData(prev => ({ ...prev, clientName: cleanName }));
            toast.success(`Company detected: ${cleanName}`);
          }
        }
        toast.success('Website branding extracted successfully!');
        handleFetchSeoData();
      } else {
        throw new Error(data.error || 'Failed to scrape website');
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      toast.error('Failed to extract branding. You can still generate the deck.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleFetchSeoData = async () => {
    if (!formData.websiteUrl) return;
    setIsFetchingSeo(true);
    try {
      const { data, error, cached } = await apiService.getSeoData(
        formData.websiteUrl,
        (attempt) => toast.info(`Retrying SEO data fetch (attempt ${attempt + 1})...`)
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error('No SEO data returned');
      if (cached) toast.info('Using cached SEO data');
      if (data.success) {
        setSeoData({ ...data.data, domain: formData.websiteUrl } as SeoData);
        if (data.isMock) {
          toast.info('Using estimated SEO data (connect Semrush for real data)');
        } else if (!cached) {
          toast.success('Real SEO data fetched from Semrush!');
        }
      }
    } catch (error) {
      console.error('Error fetching SEO data:', error);
    } finally {
      setIsFetchingSeo(false);
    }
  };

  const handleFetchSupermetricsAccounts = useCallback(async () => {
    setIsFetchingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', {
        body: { action: 'list-accounts' }
      });
      if (error) throw error;
      if (data?.success && data?.accounts) {
        setSupermetricsAccounts(data.accounts);
        setAccountsLoaded(true);
        setSelectedAccounts({});
        toast.success('Connected ad accounts loaded!');
      }
    } catch (err) {
      console.error('Error fetching Supermetrics accounts:', err);
      toast.error('Failed to load ad accounts. Check your Supermetrics API key.');
    } finally {
      setIsFetchingAccounts(false);
    }
  }, []);

  const handleFetchAdData = async () => {
    const activeSources = Object.keys(selectedAccounts).filter(k => selectedAccounts[k] && selectedAccounts[k].length > 0);
    if (activeSources.length === 0) {
      toast.error('Please select at least one ad account');
      return;
    }
    setIsFetchingAdData(true);
    setAdData(null);
    try {
      // Calculate previous period for comparison
      const startMs = dateStart.getTime();
      const endMs = dateEnd.getTime();
      const periodLength = endMs - startMs;
      const compareStart = format(new Date(startMs - periodLength), 'yyyy-MM-dd');
      const compareEnd = format(new Date(startMs - 1), 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('fetch-supermetrics', {
        body: {
          action: 'fetch-data',
          dataSources: activeSources,
          accounts: selectedAccounts,
          dateStart: format(dateStart, 'yyyy-MM-dd'),
          dateEnd: format(dateEnd, 'yyyy-MM-dd'),
          compareStart,
          compareEnd,
        }
      });
      if (error) throw error;
      if (data?.success && data?.platforms) {
        setAdData(data.platforms);
        toast.success(`Ad data pulled from ${Object.keys(data.platforms).length} platform(s)!`);
      }
    } catch (err) {
      console.error('Error fetching ad data:', err);
      toast.error('Failed to pull ad data. Check your account selections.');
    } finally {
      setIsFetchingAdData(false);
    }
  };

  const handleFetchSeoDeckData = async () => {
    if (!seoData && !formData.websiteUrl) {
      toast.error('No SEO data available. Analyze the website in Step 1 first.');
      return;
    }
    setIsFetchingSeoForDeck(true);
    try {
      // Call get-seo-data with includePrevious to get both current + previous month from Semrush
      const cleanDomain = formData.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const { data: seoResponse, error: seoError } = await supabase.functions.invoke('get-seo-data', {
        body: { domain: cleanDomain, includePrevious: true },
      });

      if (seoError || !seoResponse?.success) {
        toast.error('Could not fetch SEO data from Semrush');
        setIsFetchingSeoForDeck(false);
        return;
      }

      const currentSeo = { ...seoResponse.data, domain: cleanDomain } as SeoData;
      setSeoData(currentSeo);

      // Build previous period from Semrush API response
      let previous: SeoDeckData['previous'] = undefined;
      if (seoResponse.previousData) {
        const prev = seoResponse.previousData;
        previous = {
          organicKeywords: prev.organicKeywords ?? undefined,
          organicTraffic: prev.organicTraffic ?? undefined,
          domainAuthority: undefined, // Backlinks API doesn't support display_date
          backlinks: undefined,
          referringDomains: undefined,
        };
      }

      setSeoDeckData({
        current: currentSeo,
        previous,
      });
      toast.success('SEO data loaded with month-over-month trends!');
    } catch (err) {
      console.error('Error fetching SEO deck data:', err);
      toast.error('Failed to load SEO data.');
    } finally {
      setIsFetchingSeoForDeck(false);
    }
  };

  const updateStage = (stageId: string, status: GenerationStage['status'], message?: string) => {
    setGenerationStages(prev =>
      prev.map(stage =>
        stage.id === stageId ? { ...stage, status, message } : stage
      )
    );
  };

  // Poll for deck status
  useEffect(() => {
    if (!deckJobId || !isGenerating) return;
    const pollInterval = setInterval(async () => {
      try {
        const { data: deck, error } = await supabase
          .from('decks')
          .select('status, content')
          .eq('id', deckJobId)
          .single();
        if (error) { console.error('Error polling deck status:', error); return; }

        const content = deck.content as Record<string, unknown> | null;
        const progress = (content?.progress as number) || 0;
        const message = (content?.progressMessage as string) || '';
        const deckError = content?.error as string | undefined;

        setGenerationProgress(progress);
        setProgressMessage(message);

        if (progress >= 10) updateStage('input_qa', 'complete', '✓ Input validation passed');
        if (progress >= 20) updateStage('branding', 'complete', '✓ Brand colors extracted');
        if (progress >= 40) updateStage('screenshots', 'loading', message || 'Analyzing screenshots...');
        if (progress >= 60) {
          updateStage('screenshots', 'complete', '✓ Screenshots analyzed');
          updateStage('tasks', 'complete', '✓ Task notes processed');
        }
        if (progress >= 75) updateStage('content_qa', 'complete', '✓ Content validation passed');
        if (progress >= 85) updateStage('ai', 'complete', '✓ AI insights generated');
        if (progress >= 95) updateStage('final_qa', 'loading', 'Running final checks...');

        if (deck.status === 'published' || deck.status === 'needs_review') {
          clearInterval(pollInterval);
          setIsGenerating(false);
          updateStage('final_qa', 'complete', '✓ Quality check passed');
          updateStage('save', 'complete', 'Deck saved successfully');
          toast.success(`Deck generated for ${formData.clientName}!`);
          if (deckSlug) navigate(`/deck/${deckSlug}`);
        } else if (deck.status === 'failed') {
          clearInterval(pollInterval);
          setIsGenerating(false);
          updateStage('final_qa', 'error', deckError || 'Generation failed');
          updateStage('save', 'error', 'Failed');
          toast.error(deckError || 'An error occurred while generating the deck.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [deckJobId, isGenerating, deckSlug, navigate, formData.clientName]);

  const handleGenerate = async () => {
    if (!formData.clientName) {
      toast.error('Please enter a client name');
      return;
    }
    if ((!adData || Object.keys(adData).length === 0) && !seoDeckData) {
      toast.error('Please pull ad performance data or SEO data first.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setProgressMessage('');
    setDeckJobId(null);
    setDeckSlug(null);
    setGenerationStages(prev => prev.map(s => ({ ...s, status: 'pending', message: undefined })));

    try {
      updateStage('input_qa', 'loading', 'Validating date range and client data...');
      const { data, error } = await supabase.functions.invoke('generate-deck-async', {
        body: {
          clientName: formData.clientName,
          dateRangeStart: format(dateStart, 'yyyy-MM-dd'),
          dateRangeEnd: format(dateEnd, 'yyyy-MM-dd'),
          domain: selectedClient?.domain || formData.websiteUrl,
          ga4PropertyId: selectedClient?.ga4PropertyId,
          screenshots: [],
          branding: branding ? {
            logo: branding.logo,
            colors: branding.colors,
            screenshot: branding.screenshot,
          } : undefined,
          deckColors: {
            primary: formData.deckPrimaryColor,
            background: formData.deckBackgroundColor,
            text: formData.deckTextColor || undefined,
            textMuted: formData.deckTextMutedColor || undefined,
          },
          seoData: seoData,
          seoDeckData: seoDeckData || undefined,
          supermetricsData: adData || undefined,
          taskNotes: taskNotes.trim() || undefined,
          socialMediaPosts: socialPosts || undefined,
          campaignAssets: {
            emailResults: emailResultsUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            emailDesigns: emailDesignsUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            smsResults: smsResultsUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            smsCampaign: smsCampaignUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            adCreativeApprovals: adCreativeUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            nextEmailCampaign: nextEmailUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            nextSmsCampaign: nextSmsUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            blogPosts: blogPostUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            analyticsScreenshots: analyticsUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
            socialMedia: socialMediaUploads.map(u => u.publicUrl || u.previewUrl).filter(Boolean),
          },
        }
      });
      if (error) throw error;
      if (data?.deckId && data?.slug) {
        setDeckJobId(data.deckId);
        setDeckSlug(data.slug);
        updateStage('input_qa', 'complete', '✓ Input validation passed');
        updateStage('branding', 'loading', `Extracting branding...`);
        toast.success('Deck generation started! This may take a few minutes.');
      } else {
        throw new Error(data?.error || 'Failed to start deck generation');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setIsGenerating(false);
      updateStage('input_qa', 'error', 'Failed to start');
      toast.error(err instanceof Error ? err.message : 'An error occurred.');
    }
  };

  const canProceedToStep2 = (scraped || formData.clientName) && formData.clientName;
  const canGenerate = formData.clientName && ((adData && Object.keys(adData).length > 0) || seoDeckData);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      {/* Header - Matches ProposalBuilder exactly */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile Layout */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <GenieLamp size={24} />
              <span className="font-display font-semibold text-sm">Deck Builder</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`w-2 h-2 rounded-full transition-colors ${
                    s === step ? 'bg-genie-purple' : s < step ? 'bg-genie-gold' : 'bg-border'
                  }`} />
                ))}
              </div>
              <Link to="/proposals" className="p-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors">
                <FileText className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-accent transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <GenieLamp size={28} />
              <h1 className="text-xl font-display font-semibold">Melleka Deck Builder</h1>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <Link to="/decks" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors text-sm font-medium">
                <FileText className="w-4 h-4" />
                View All Decks
              </Link>
              <div className="flex items-center gap-2">
                <StepIndicator step={1} currentStep={step} label="Website" />
                <div className="w-8 h-0.5 bg-border" />
                <StepIndicator step={2} currentStep={step} label="Date & Ad Data" />
                <div className="w-8 h-0.5 bg-border" />
                <StepIndicator step={3} currentStep={step} label="Generate" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Step 1: Website & Client Info - Exact match to ProposalBuilder */}
        {step === 1 && (
          <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">
                Let's Start With Their Website
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                We'll extract their branding, analyze their SEO, and personalize the deck.
              </p>
            </div>

            {/* Recent Clients Quick Access */}
            {recentDecks.length > 0 && !selectedClient && (
              <section className="genie-card p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium text-foreground">Recent Clients</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentDecks.map((deck) => (
                    <button
                      key={deck.id}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                      onClick={() => {
                        const client = clients.find(c => c.name === deck.clientName);
                        if (client) {
                          setSelectedClient(client);
                          setFormData(prev => ({ ...prev, clientName: client.name, websiteUrl: client.domain ? (client.domain.startsWith('http') ? client.domain : `https://${client.domain}`) : '' }));
                          if (client.logoUrl) {
                            setBranding(prev => prev ? { ...prev, logo: client.logoUrl } : { logo: client.logoUrl });
                          }
                        } else {
                          setFormData(prev => ({ ...prev, clientName: deck.clientName }));
                        }
                      }}
                    >
                      {deck.brandColors?.primary && (
                        <div className="w-3 h-3 rounded-full ring-1 ring-border" style={{ backgroundColor: deck.brandColors.primary }} />
                      )}
                      <span>{deck.clientName}</span>
                      <Zap className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Client Search */}
            <section className="genie-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Select Client</h3>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Search clients..."
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50"
                />
                {showClientDropdown && filteredClients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredClients.map((client, idx) => (
                      <button
                        key={idx}
                        className={cn(
                          "w-full px-4 py-2 text-left hover:bg-muted transition-colors",
                          selectedClient?.name === client.name && "bg-primary/10"
                        )}
                        onClick={() => {
                          setSelectedClient(client);
                          setClientSearch(client.name);
                          setShowClientDropdown(false);
                          setFormData(prev => ({ 
                            ...prev, 
                            clientName: client.name,
                            websiteUrl: client.domain ? (client.domain.startsWith('http') ? client.domain : `https://${client.domain}`) : prev.websiteUrl
                          }));
                          // Load saved logo into branding
                          if (client.logoUrl) {
                            setBranding(prev => prev ? { ...prev, logo: client.logoUrl } : { logo: client.logoUrl });
                          }
                        }}
                      >
                        <div className="font-medium">{client.name}</div>
                        {client.domain && <div className="text-xs text-muted-foreground">{client.domain}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedClient && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="font-medium text-primary">{selectedClient.name}</div>
                  {selectedClient.domain && <div className="text-sm text-muted-foreground">{selectedClient.domain}</div>}
                </div>
              )}
            </section>

            {/* Website URL */}
            <section className="genie-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Client Website</h3>
              </div>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, websiteUrl: e.target.value });
                    setScraped(false);
                    setSeoData(null);
                  }}
                  placeholder="https://example.com"
                  className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50"
                />
                <button
                  onClick={() => handleScrapeWebsite()}
                  disabled={isScraping || !formData.websiteUrl}
                  className="px-6 py-3 rounded-xl bg-genie-purple text-foreground font-medium flex items-center gap-2 disabled:opacity-50 hover:bg-genie-purple-light transition-colors"
                >
                  {isScraping ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
                  ) : scraped ? (
                    <><Check className="w-4 h-4" /> Scanned</>
                  ) : (
                    <><Search className="w-4 h-4" /> Analyze</>
                  )}
                </button>
              </div>

              {/* Branding & SEO Preview - Exact match */}
              {(branding || seoData) && (
                <div className="mt-6 space-y-4">
                  {branding && (
                    <div className="p-4 rounded-xl bg-background border border-border">
                      <h4 className="text-sm font-medium text-foreground mb-3">Extracted Branding:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Logo</p>
                          <div className="flex items-center gap-2">
                            {branding.logo ? (
                              <img src={branding.logo} alt="Logo" className="h-10 object-contain rounded p-1" style={{ background: 'transparent' }} />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Camera className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <label className="cursor-pointer p-1.5 rounded-lg bg-genie-purple/20 hover:bg-genie-purple/30 transition-colors" title="Upload different logo">
                              <Upload className="w-4 h-4 text-genie-purple-light" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
                                  if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
                                  
                                  try {
                                    // Upload to storage instead of base64
                                    const clientSlug = formData.clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                    const fileExt = file.name.split('.').pop();
                                    const fileName = `deck-logos/${clientSlug}/logo-${Date.now()}.${fileExt}`;
                                    
                                    const { error: uploadError } = await supabase.storage
                                      .from('proposal-assets')
                                      .upload(fileName, file, { cacheControl: '3600', upsert: true });
                                    
                                    if (uploadError) throw uploadError;
                                    
                                    const { data: urlData } = supabase.storage
                                      .from('proposal-assets')
                                      .getPublicUrl(fileName);
                                    
                                    const logoUrl = urlData.publicUrl;
                                    setBranding(prev => prev ? { ...prev, logo: logoUrl } : { logo: logoUrl });
                                    
                                    // Save to client_profiles for reuse
                                    if (formData.clientName) {
                                      const { data: existing } = await supabase
                                        .from('client_profiles')
                                        .select('id')
                                        .eq('client_name', formData.clientName)
                                        .maybeSingle();
                                      
                                      if (existing) {
                                        await supabase.from('client_profiles')
                                          .update({ logo_url: logoUrl })
                                          .eq('id', existing.id);
                                      } else {
                                        await supabase.from('client_profiles')
                                          .insert({ client_name: formData.clientName, logo_url: logoUrl, domain: formData.websiteUrl?.replace(/^https?:\/\//, '') || null });
                                      }
                                      // Update local client list
                                      setClients(prev => prev.map(c => c.name === formData.clientName ? { ...c, logoUrl: logoUrl } : c));
                                    }
                                    
                                    toast.success('Logo uploaded & saved!');
                                  } catch (err) {
                                    console.error('Logo upload error:', err);
                                    toast.error('Failed to upload logo');
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {branding.logo && (
                              <button onClick={() => setBranding(prev => prev ? { ...prev, logo: null } : null)} className="p-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 transition-colors" title="Remove logo">
                                <X className="w-4 h-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </div>
                        {branding.colors?.primary && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Primary Color</p>
                            <div className="w-10 h-10 rounded-lg border border-border" style={{ backgroundColor: branding.colors.primary }} />
                          </div>
                        )}
                        {branding.screenshots && branding.screenshots.length > 0 && (
                          <div className="space-y-2 col-span-2 md:col-span-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                Page Screenshots ({branding.screenshots.filter(s => s.screenshot).length} captured)
                              </p>
                              <div className="flex items-center gap-2">
                                <select value={screenshotCount} onChange={(e) => setScreenshotCount(Number(e.target.value))} className="text-xs px-2 py-1 rounded bg-card border border-border text-foreground">
                                  <option value={6}>6 pages</option>
                                  <option value={10}>10 pages</option>
                                  <option value={15}>15 pages</option>
                                  <option value={20}>20 pages</option>
                                </select>
                                <button onClick={() => handleScrapeWebsite(screenshotCount)} disabled={isScraping} className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-genie-purple/20 text-genie-purple-light hover:bg-genie-purple/30 transition-colors disabled:opacity-50">
                                  <Camera className="w-3 h-3" /> {isScraping ? 'Capturing...' : 'Retake'}
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {branding.screenshots.filter(s => s.screenshot).map((page, i) => (
                                <div key={i} className="group relative">
                                  <img src={page.screenshot!} alt={page.title} className="w-full h-24 object-cover object-top rounded-lg border border-border transition-transform group-hover:scale-105 cursor-pointer" onClick={() => window.open(page.url, '_blank')} />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-lg">
                                    <p className="text-xs text-white truncate">{page.title}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(!branding.screenshots || branding.screenshots.length === 0) && branding.screenshot && (
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs text-muted-foreground">Screenshot</p>
                            <img src={branding.screenshot} alt="Website" className="h-20 object-cover rounded-lg" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {seoData && (
                    <div className="p-4 rounded-xl bg-background border border-genie-gold/30">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-genie-gold" />
                        <h4 className="text-sm font-medium text-foreground">SEO Analysis</h4>
                        {isFetchingSeo && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.organicKeywords?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Organic Keywords</p>
                        </div>
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.organicTraffic?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Monthly Traffic</p>
                        </div>
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.domainAuthority}</p>
                          <p className="text-xs text-muted-foreground">Domain Authority</p>
                        </div>
                        <div className="text-center p-3 bg-card rounded-lg">
                          <p className="text-2xl font-bold text-genie-gold">{seoData.backlinks?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Backlinks</p>
                        </div>
                      </div>
                      {seoData.topKeywords && seoData.topKeywords.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs text-muted-foreground mb-2">Top Ranking Keywords:</p>
                          <div className="flex flex-wrap gap-2">
                            {seoData.topKeywords.slice(0, 5).map((kw, i) => (
                              <span key={i} className="px-2 py-1 bg-genie-purple/20 text-genie-purple-light rounded text-xs">
                                #{kw.position} {kw.keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Deck Colors - Matches ProposalBuilder's color section */}
            {scraped && (
              <section className="genie-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-genie-gold" />
                  <h3 className="text-lg font-semibold text-foreground">Deck Colors</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Customize the deck's color scheme. Colors are auto-detected from the client's website.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={formData.deckPrimaryColor} onChange={(e) => setFormData({ ...formData, deckPrimaryColor: e.target.value })} className="w-12 h-12 rounded-lg border border-border cursor-pointer" />
                      <input type="text" value={formData.deckPrimaryColor} onChange={(e) => setFormData({ ...formData, deckPrimaryColor: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono" placeholder="#9b87f5" />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for headings, buttons, and accents</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Background Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={formData.deckBackgroundColor} onChange={(e) => setFormData({ ...formData, deckBackgroundColor: e.target.value })} className="w-12 h-12 rounded-lg border border-border cursor-pointer" />
                      <input type="text" value={formData.deckBackgroundColor} onChange={(e) => setFormData({ ...formData, deckBackgroundColor: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono" placeholder="#1A1F2C" />
                    </div>
                    <p className="text-xs text-muted-foreground">Main background of the deck</p>
                  </div>
                </div>

                {/* Text Color Overrides */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Text Color Overrides</h4>
                      <p className="text-xs text-muted-foreground">Leave empty for auto-contrast detection, or set manually if needed</p>
                    </div>
                    {(formData.deckTextColor || formData.deckTextMutedColor) && (
                      <button onClick={() => setFormData({ ...formData, deckTextColor: '', deckTextMutedColor: '' })} className="text-xs text-genie-purple hover:underline">
                        Reset to Auto
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Main Text Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={formData.deckTextColor || (formData.deckBackgroundColor && isLightColorCheck(formData.deckBackgroundColor) ? '#1a1a2e' : '#f8fafc')} onChange={(e) => setFormData({ ...formData, deckTextColor: e.target.value })} className="w-12 h-12 rounded-lg border border-border cursor-pointer" />
                        <input type="text" value={formData.deckTextColor} onChange={(e) => setFormData({ ...formData, deckTextColor: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono" placeholder="Auto-detected" />
                      </div>
                      <p className="text-xs text-muted-foreground">Primary body and heading text</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Muted Text Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={formData.deckTextMutedColor || (formData.deckBackgroundColor && isLightColorCheck(formData.deckBackgroundColor) ? '#4a4a5e' : '#a0a0b0')} onChange={(e) => setFormData({ ...formData, deckTextMutedColor: e.target.value })} className="w-12 h-12 rounded-lg border border-border cursor-pointer" />
                        <input type="text" value={formData.deckTextMutedColor} onChange={(e) => setFormData({ ...formData, deckTextMutedColor: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-mono" placeholder="Auto-detected" />
                      </div>
                      <p className="text-xs text-muted-foreground">Secondary/subtitle text</p>
                    </div>
                  </div>
                </div>

                {/* Color Preview */}
                <div className="mt-6 p-4 rounded-xl border border-border" style={{ backgroundColor: formData.deckBackgroundColor }}>
                  <p className="text-sm font-medium mb-1" style={{ color: formData.deckPrimaryColor }}>Preview: Accent Color</p>
                  <p className="text-base font-semibold mb-1" style={{ color: formData.deckTextColor || (isLightColorCheck(formData.deckBackgroundColor) ? '#1a1a2e' : '#f8fafc') }}>
                    Main Text Preview
                  </p>
                  <p className="text-sm mb-3" style={{ color: formData.deckTextMutedColor || (isLightColorCheck(formData.deckBackgroundColor) ? 'rgba(26, 26, 46, 0.7)' : 'rgba(248, 250, 252, 0.7)') }}>
                    Muted text preview for subtitles and descriptions
                  </p>
                  <div className="flex gap-2">
                    <span className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: formData.deckPrimaryColor, color: formData.deckBackgroundColor }}>
                      Button Preview
                    </span>
                    <span className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: formData.deckPrimaryColor, color: formData.deckPrimaryColor }}>
                      Outline Button
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Client Name */}
            <section className="genie-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-foreground mb-4">Client Information</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Client/Company Name *</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="e.g., Acme Corporation"
                    className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Additional Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any specific goals, challenges, or notes about this client..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-genie-purple/50 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Next Step */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className="gold-button px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Date & Ad Data
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>

            {!scraped && formData.websiteUrl && !formData.clientName && (
              <p className="text-sm text-center text-genie-gold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Analyze the website first to continue
              </p>
            )}
          </div>
        )}

        {/* Step 2: Date Range & Screenshots (replaces Package Selection) */}
        {step === 2 && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">
                Date Range & Ad Data
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Select the reporting period and pull ad performance data for {formData.clientName}.
              </p>
            </div>

            {/* Date Range */}
            <section className="genie-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Date Range</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateStart && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateStart ? format(dateStart, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateStart} onSelect={(date) => date && setDateStart(date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateEnd && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateEnd ? format(dateEnd, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateEnd} onSelect={(date) => date && setDateEnd(date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </section>

            {/* Supermetrics Ad Data Pull */}
            <section className="genie-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-genie-gold" />
                  <h3 className="text-lg font-semibold text-foreground">Pull Ad Performance Data</h3>
                </div>
                {!accountsLoaded && (
                  <button
                    onClick={handleFetchSupermetricsAccounts}
                    disabled={isFetchingAccounts}
                    className="px-4 py-2 rounded-lg bg-genie-purple text-foreground text-sm font-medium flex items-center gap-2 hover:bg-genie-purple-light transition-colors disabled:opacity-50"
                  >
                    {isFetchingAccounts ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Loading Accounts...</>
                    ) : (
                      <><Database className="w-4 h-4" /> Connect Supermetrics</>
                    )}
                  </button>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Pull live ad data directly from Google Ads, Meta Ads, TikTok, and more via Supermetrics.
              </p>

              {accountsLoaded && (
                <div className="space-y-4">
                  {/* Platform Account Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(supermetricsAccounts).map(([platformKey, accounts]) => {
                      if (accounts.length === 0) return null;
                      const platformConfig: Record<string, { label: string; icon: string; color: string }> = {
                        google_ads: { label: 'Google Ads', icon: '🔍', color: 'border-blue-500/40' },
                        meta_ads: { label: 'Meta Ads', icon: '📘', color: 'border-blue-600/40' },
                        tiktok_ads: { label: 'TikTok Ads', icon: '🎵', color: 'border-pink-500/40' },
                        bing_ads: { label: 'Microsoft Ads', icon: '🪟', color: 'border-cyan-500/40' },
                        linkedin_ads: { label: 'LinkedIn Ads', icon: '💼', color: 'border-sky-500/40' },
                      };
                      const config = platformConfig[platformKey] || { label: platformKey, icon: '📊', color: 'border-border' };
                      const selected = selectedAccounts[platformKey] || [];
                      const isEnabled = platformKey in selectedAccounts;
                      return (
                        <div key={platformKey} className={cn(
                          "rounded-xl border-2 transition-all overflow-hidden",
                          isEnabled ? config.color + " bg-card shadow-sm" : "border-border/50 bg-muted/20 opacity-75"
                        )}>
                          {/* Platform Header */}
                          <button
                            className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => {
                              setSelectedAccounts(prev => {
                                if (isEnabled) {
                                  const next = { ...prev };
                                  delete next[platformKey];
                                  return next;
                                } else {
                                  // Enable platform but don't auto-select any account
                                  return { ...prev, [platformKey]: accounts.length === 1 ? [accounts[0].id] : [] };
                                }
                              });
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{config.icon}</span>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-foreground">{config.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {accounts.length} account{accounts.length > 1 ? 's' : ''} available
                                </p>
                              </div>
                            </div>
                            <div className={cn(
                              "w-10 h-6 rounded-full relative transition-colors",
                              isEnabled ? "bg-genie-purple" : "bg-muted"
                            )}>
                              <div className={cn(
                                "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                isEnabled ? "translate-x-5" : "translate-x-1"
                              )} />
                            </div>
                          </button>

                          {/* Account List */}
                          {isEnabled && (
                            <div className="px-4 pb-4 pt-0">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-muted-foreground">
                                  {selected.length === 0 
                                    ? '⚠️ Select accounts to include:' 
                                    : `${selected.length} of ${accounts.length} selected:`}
                                </p>
                                {accounts.length > 1 && (
                                  <button
                                    onClick={() => {
                                      setSelectedAccounts(prev => ({
                                        ...prev,
                                        [platformKey]: selected.length === accounts.length 
                                          ? [] 
                                          : accounts.map(a => a.id)
                                      }));
                                    }}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    {selected.length === accounts.length ? 'Deselect All' : 'Select All'}
                                  </button>
                                )}
                              </div>
                              {accounts.length > 10 && (
                                <div className="relative mb-2">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                  <input
                                    type="text"
                                    value={accountSearchFilters[platformKey] || ''}
                                    onChange={(e) => setAccountSearchFilters(prev => ({ ...prev, [platformKey]: e.target.value }))}
                                    placeholder={`Search ${config.label} accounts...`}
                                    className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-genie-purple/50"
                                  />
                                  {accountSearchFilters[platformKey] && (
                                    <button
                                      onClick={() => setAccountSearchFilters(prev => ({ ...prev, [platformKey]: '' }))}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                                {(() => {
                                  const searchTerm = (accountSearchFilters[platformKey] || '').toLowerCase();
                                  const filteredAccounts = searchTerm
                                    ? accounts.filter(acc => acc.name.toLowerCase().includes(searchTerm))
                                    : accounts;
                                  if (searchTerm && filteredAccounts.length === 0) {
                                    return (
                                      <p className="text-xs text-muted-foreground py-2">No accounts matching "{accountSearchFilters[platformKey]}"</p>
                                    );
                                  }
                                  return filteredAccounts.map(acc => {
                                  const isSelected = selected.includes(acc.id);
                                  return (
                                    <button
                                      key={acc.id}
                                      onClick={() => {
                                        setSelectedAccounts(prev => {
                                          const current = prev[platformKey] || [];
                                          if (isSelected) {
                                            const filtered = current.filter(id => id !== acc.id);
                                            return { ...prev, [platformKey]: filtered };
                                          } else {
                                            return { ...prev, [platformKey]: [...current, acc.id] };
                                          }
                                        });
                                      }}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                        isSelected
                                          ? "bg-genie-purple/20 border-genie-purple/50 text-foreground"
                                          : "bg-transparent border-border text-muted-foreground hover:border-genie-purple/30 hover:text-foreground"
                                      )}
                                    >
                                      {isSelected && <Check className="w-3 h-3 text-genie-purple" />}
                                      <span className="truncate max-w-[180px]">{acc.name}</span>
                                    </button>
                                  );
                                  });
                                })()}
                              </div>
                              {selected.length > 1 && (
                                <p className="text-xs text-genie-gold mt-2 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Data from {selected.length} accounts will be combined
                                </p>
                              )}
                            </div>
                          )}

                          {/* Single account - show name when enabled */}
                          {isEnabled && accounts.length === 1 && (
                            <div className="px-4 pb-3 pt-0">
                              <p className="text-xs text-muted-foreground">
                                Account: <span className="text-foreground font-medium">{accounts[0].name}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Fetch Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleFetchAdData}
                      disabled={isFetchingAdData || Object.keys(selectedAccounts).filter(k => selectedAccounts[k]?.length > 0).length === 0}
                      className="gold-button px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingAdData ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Pulling Data...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4" /> Pull Ad Data for {format(dateStart, 'MMM d')} — {format(dateEnd, 'MMM d')}</>
                      )}
                    </button>
                    {adData && (
                      <span className="text-sm text-emerald-500 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Data loaded
                      </span>
                    )}
                  </div>

                  {/* Data Preview */}
                  {adData && (
                    <div className="mt-4 space-y-3">
                      {Object.entries(adData).map(([key, platform]) => (
                        <div key={key} className="p-4 rounded-xl bg-background border border-border">
                          <h4 className="text-sm font-semibold text-foreground mb-3">{platform.label}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                              { label: 'Spend', value: platform.summary._cost, prefix: '$', decimals: 2 },
                              { label: 'Impressions', value: platform.summary._impressions, decimals: 0 },
                              { label: 'Clicks', value: platform.summary._clicks, decimals: 0 },
                              { label: 'CTR', value: platform.summary._ctr, suffix: '%', decimals: 2 },
                              { label: 'CPC', value: platform.summary._cpc, prefix: '$', decimals: 2 },
                              { label: 'Conversions', value: platform.summary._conversions, decimals: 0 },
                              { label: 'CPA', value: platform.summary._cpa, prefix: '$', decimals: 2 },
                              { label: 'Conv. Rate', value: platform.summary._conversion_rate, suffix: '%', decimals: 2 },
                            ].map((metric, i) => {
                              if (metric.value === undefined || isNaN(metric.value)) return null;
                              // Period-over-period comparison
                              let changePercent: number | null = null;
                              if (platform.previousPeriod) {
                                const prevKey = `_${metric.label.toLowerCase().replace(/[^a-z]/g, '_')}`;
                                const prevVal = platform.previousPeriod[prevKey as keyof typeof platform.previousPeriod];
                                if (prevVal && prevVal > 0) {
                                  changePercent = ((metric.value - prevVal) / prevVal) * 100;
                                }
                              }
                              return (
                                <div key={i} className="text-center p-2 bg-muted/30 rounded-lg">
                                  <p className="text-lg font-bold text-foreground">
                                    {metric.prefix || ''}{metric.value.toLocaleString(undefined, { maximumFractionDigits: metric.decimals })}{metric.suffix || ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                                  {changePercent !== null && (
                                    <p className={cn("text-xs font-medium", changePercent >= 0 ? "text-emerald-500" : "text-destructive")}>
                                      {changePercent >= 0 ? '↑' : '↓'} {Math.abs(changePercent).toFixed(1)}%
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Top 3 Performing Creatives */}
                          {(platform as SupermetricsPlatformData & { topContent?: TopCreative[] }).topContent && 
                           (platform as SupermetricsPlatformData & { topContent?: TopCreative[] }).topContent!.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                🏆 Top 3 Performing Creatives (by CTR)
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {(platform as SupermetricsPlatformData & { topContent?: TopCreative[] }).topContent!.map((creative, ci) => (
                                  <div key={ci} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                                    {creative.imageUrl ? (
                                      <div className="aspect-video bg-muted relative">
                                        <img 
                                          src={creative.imageUrl} 
                                          alt={creative.adName}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-xs font-bold px-2 py-1 rounded-md text-genie-gold">
                                          #{ci + 1}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="aspect-video bg-muted flex items-center justify-center relative">
                                        <span className="text-muted-foreground text-xs">No preview</span>
                                        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-xs font-bold px-2 py-1 rounded-md text-genie-gold">
                                          #{ci + 1}
                                        </div>
                                      </div>
                                    )}
                                    <div className="p-3 space-y-1">
                                      <p className="text-xs font-semibold text-foreground truncate" title={creative.adName}>{creative.adName}</p>
                                      <p className="text-xs text-muted-foreground truncate" title={creative.campaignName}>{creative.campaignName}</p>
                                      <div className="grid grid-cols-3 gap-1 mt-2">
                                        <div className="text-center">
                                          <p className="text-sm font-bold text-genie-gold">{creative.ctr.toFixed(2)}%</p>
                                          <p className="text-[10px] text-muted-foreground">CTR</p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-sm font-bold text-foreground">{creative.clicks.toLocaleString()}</p>
                                          <p className="text-[10px] text-muted-foreground">Clicks</p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-sm font-bold text-foreground">{creative.conversions}</p>
                                          <p className="text-[10px] text-muted-foreground">Conv.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* SEO Data for Deck */}
            <section className="genie-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-genie-gold" />
                  <h3 className="text-lg font-semibold text-foreground">SEO Performance Data</h3>
                </div>
                <button
                  onClick={handleFetchSeoDeckData}
                  disabled={isFetchingSeoForDeck || (!seoData && !formData.websiteUrl)}
                  className="px-4 py-2 rounded-lg bg-genie-purple text-foreground text-sm font-medium flex items-center gap-2 hover:bg-genie-purple-light transition-colors disabled:opacity-50"
                >
                  {isFetchingSeoForDeck ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                  ) : seoDeckData ? (
                    <><Check className="w-4 h-4" /> Loaded</>
                  ) : (
                    <><Activity className="w-4 h-4" /> Pull SEO Data</>
                  )}
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Pull organic SEO metrics from Semrush with period-over-period trends.
              </p>

              {seoDeckData && (
                <div className="space-y-4">
                  {/* SEO Metrics Grid */}
                  <div className="p-4 rounded-xl bg-background border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Organic SEO Overview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { label: 'Keywords', value: seoDeckData.current.organicKeywords, prev: seoDeckData.previous?.organicKeywords },
                        { label: 'Traffic', value: seoDeckData.current.organicTraffic, prev: seoDeckData.previous?.organicTraffic },
                        { label: 'Domain Auth.', value: seoDeckData.current.domainAuthority, prev: seoDeckData.previous?.domainAuthority },
                        { label: 'Backlinks', value: seoDeckData.current.backlinks, prev: seoDeckData.previous?.backlinks },
                        { label: 'Ref. Domains', value: seoDeckData.current.referringDomains, prev: seoDeckData.previous?.referringDomains },
                      ].map((metric, i) => {
                        const changePercent = metric.prev && metric.prev > 0 && metric.value
                          ? ((metric.value - metric.prev) / metric.prev) * 100
                          : null;
                        return (
                          <div key={i} className="text-center p-2 bg-muted/30 rounded-lg">
                            <p className="text-lg font-bold text-foreground">
                              {(metric.value ?? 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">{metric.label}</p>
                            <p className={cn("text-xs font-medium mt-0.5", changePercent !== null ? (changePercent >= 0 ? "text-emerald-500" : "text-destructive") : "text-muted-foreground")}>
                              {changePercent !== null
                                ? `${changePercent >= 0 ? '↑' : '↓'} ${Math.abs(changePercent).toFixed(1)}%`
                                : '— no prior data'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Keywords Preview */}
                  {seoDeckData.current.topKeywords && seoDeckData.current.topKeywords.length > 0 && (
                    <div className="p-4 rounded-xl bg-background border border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        🔑 Top Ranking Keywords
                      </h4>
                      <div className="space-y-1.5">
                        {seoDeckData.current.topKeywords.slice(0, 5).map((kw, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-sm">
                            <span className="font-medium text-foreground truncate flex-1">{kw.keyword}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Pos #{kw.position}</span>
                              <span>{kw.volume?.toLocaleString()} vol</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Email Uploads */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Email</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { channel: 'email_results' as CampaignChannel, label: 'Email Results', desc: 'Upload screenshots or data exports of email campaign performance (open rates, CTR, delivery stats).', uploads: emailResultsUploads, color: 'border-amber-500/40' },
                  { channel: 'email_designs' as CampaignChannel, label: 'Email Designs', desc: 'Upload screenshots or files of the actual email creative designs sent to subscribers.', uploads: emailDesignsUploads, color: 'border-orange-500/40' },
                ].map(({ channel, label, desc, uploads, color }) => (
                  <section key={channel} className={cn("genie-card p-5 rounded-2xl border-2", uploads.length > 0 ? color : "border-transparent")}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                      {uploads.length > 0 && (
                        <span className="text-xs bg-genie-purple/20 text-genie-purple-light px-2 py-0.5 rounded-full">
                          {uploads.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{desc}</p>
                    <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-genie-purple/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Drop files or <span className="text-genie-purple-light font-medium">browse</span></span>
                      <span className="text-[10px] text-muted-foreground">PNG, JPG, CSV, XLSX</span>
                      <input type="file" accept="image/*,.csv,.xlsx,.xls" multiple className="hidden" onChange={(e) => handleCampaignUpload(e.target.files, channel)} />
                    </label>
                    {uploads.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {uploads.map(upload => (
                          <div key={upload.id} className="relative group rounded-xl border border-border overflow-hidden bg-card">
                            {upload.type === 'screenshot' && upload.previewUrl ? (
                              <img src={upload.publicUrl || upload.previewUrl} alt={upload.file.name} className="w-full h-20 object-cover object-top" />
                            ) : (
                              <div className="w-full h-20 flex flex-col items-center justify-center gap-1 bg-muted/30">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground uppercase font-mono">{upload.file.name.split('.').pop()}</span>
                              </div>
                            )}
                            {upload.uploading && (
                              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-genie-purple" />
                              </div>
                            )}
                            <div className="p-1.5">
                              <p className="text-[10px] text-foreground truncate">{upload.file.name}</p>
                            </div>
                            <button onClick={() => handleRemoveCampaignUpload(channel, upload.id)} className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>

            {/* SMS Uploads */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">SMS</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { channel: 'sms_results' as CampaignChannel, label: 'SMS Results', desc: 'Upload screenshots or data exports of SMS performance (delivery rate, click rate, opt-outs).', uploads: smsResultsUploads, color: 'border-emerald-500/40' },
                  { channel: 'sms_campaign' as CampaignChannel, label: 'SMS Campaign', desc: 'Upload screenshots of the actual SMS messages or campaign creatives sent.', uploads: smsCampaignUploads, color: 'border-teal-500/40' },
                ].map(({ channel, label, desc, uploads, color }) => (
                  <section key={channel} className={cn("genie-card p-5 rounded-2xl border-2", uploads.length > 0 ? color : "border-transparent")}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                      {uploads.length > 0 && (
                        <span className="text-xs bg-genie-purple/20 text-genie-purple-light px-2 py-0.5 rounded-full">
                          {uploads.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{desc}</p>
                    <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-genie-purple/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Drop files or <span className="text-genie-purple-light font-medium">browse</span></span>
                      <span className="text-[10px] text-muted-foreground">PNG, JPG, CSV, XLSX</span>
                      <input type="file" accept="image/*,.csv,.xlsx,.xls" multiple className="hidden" onChange={(e) => handleCampaignUpload(e.target.files, channel)} />
                    </label>
                    {uploads.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {uploads.map(upload => (
                          <div key={upload.id} className="relative group rounded-xl border border-border overflow-hidden bg-card">
                            {upload.type === 'screenshot' && upload.previewUrl ? (
                              <img src={upload.publicUrl || upload.previewUrl} alt={upload.file.name} className="w-full h-20 object-cover object-top" />
                            ) : (
                              <div className="w-full h-20 flex flex-col items-center justify-center gap-1 bg-muted/30">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground uppercase font-mono">{upload.file.name.split('.').pop()}</span>
                              </div>
                            )}
                            {upload.uploading && (
                              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-genie-purple" />
                              </div>
                            )}
                            <div className="p-1.5">
                              <p className="text-[10px] text-foreground truncate">{upload.file.name}</p>
                            </div>
                            <button onClick={() => handleRemoveCampaignUpload(channel, upload.id)} className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>


            {/* Ad Creatives for Approval */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Ad Creatives for Approval</h3>
              </div>
              <div className="genie-card p-5 rounded-2xl">
                <p className="text-xs text-muted-foreground mb-3">Upload ad creatives that need client review and approval.</p>
                <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-genie-purple/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Drop files or <span className="text-genie-purple-light font-medium">browse</span></span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleCampaignUpload(e.target.files, 'ad_creatives')} />
                </label>
                {adCreativeUploads.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {adCreativeUploads.map(upload => (
                      <div key={upload.id} className="relative group rounded-xl border border-border overflow-hidden bg-card">
                        <img src={upload.publicUrl || upload.previewUrl} alt={upload.file.name} className="w-full h-20 object-cover" />
                        {upload.uploading && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                        <button onClick={() => handleRemoveCampaignUpload('ad_creatives', upload.id)} className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"><Trash2 className="w-3 h-3 text-destructive" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Next Campaigns for Review */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Next Campaigns for Review</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { channel: 'next_email' as CampaignChannel, label: 'Next Email Campaign', desc: 'Upload email drafts, subject lines, and designs for approval.', uploads: nextEmailUploads, color: 'border-purple-500/40' },
                  { channel: 'next_sms' as CampaignChannel, label: 'Next SMS Campaign', desc: 'Upload SMS message drafts and examples for approval.', uploads: nextSmsUploads, color: 'border-emerald-500/40' },
                ].map(({ channel, label, desc, uploads, color }) => (
                  <section key={channel} className={cn("genie-card p-5 rounded-2xl border-2", uploads.length > 0 ? color : "border-transparent")}>
                    <h4 className="text-sm font-semibold text-foreground mb-1">{label}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{desc}</p>
                    <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-genie-purple/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Drop files or <span className="text-genie-purple-light font-medium">browse</span></span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleCampaignUpload(e.target.files, channel)} />
                    </label>
                    {uploads.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {uploads.map(upload => (
                          <div key={upload.id} className="relative group rounded-xl border border-border overflow-hidden bg-card">
                            <img src={upload.publicUrl || upload.previewUrl} alt={upload.file.name} className="w-full h-20 object-cover object-top" />
                            {upload.uploading && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                            <button onClick={() => handleRemoveCampaignUpload(channel, upload.id)} className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"><Trash2 className="w-3 h-3 text-destructive" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>

            {/* Blog/SEO & Analytics */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Content & Analytics</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { channel: 'blog_posts' as CampaignChannel, label: 'Blog & SEO Pages', desc: 'Upload screenshots of new blog posts, landing pages, or SEO content.', uploads: blogPostUploads, color: 'border-cyan-500/40' },
                  { channel: 'analytics' as CampaignChannel, label: 'Analytics & Traffic', desc: 'Upload website traffic, sales, or analytics dashboard screenshots.', uploads: analyticsUploads, color: 'border-blue-500/40' },
                ].map(({ channel, label, desc, uploads, color }) => (
                  <section key={channel} className={cn("genie-card p-5 rounded-2xl border-2", uploads.length > 0 ? color : "border-transparent")}>
                    <h4 className="text-sm font-semibold text-foreground mb-1">{label}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{desc}</p>
                    <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-genie-purple/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Drop files or <span className="text-genie-purple-light font-medium">browse</span></span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleCampaignUpload(e.target.files, channel)} />
                    </label>
                    {uploads.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {uploads.map(upload => (
                          <div key={upload.id} className="relative group rounded-xl border border-border overflow-hidden bg-card">
                            <img src={upload.publicUrl || upload.previewUrl} alt={upload.file.name} className="w-full h-20 object-cover object-top" />
                            {upload.uploading && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                            <button onClick={() => handleRemoveCampaignUpload(channel, upload.id)} className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"><Trash2 className="w-3 h-3 text-destructive" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>

            {/* Social Media Accounts */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <Instagram className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Social Media</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { channel: 'social_media' as CampaignChannel, label: 'Social Media Screenshots', desc: 'Upload screenshots of Instagram, Facebook, TikTok, or LinkedIn posts and analytics.', uploads: socialMediaUploads, color: 'border-pink-500/40' },
                ].map(({ channel, label, desc, uploads, color }) => (
                  <section key={channel} className={cn("genie-card p-5 rounded-2xl border-2", uploads.length > 0 ? color : "border-transparent")}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                      {uploads.length > 0 && (
                        <span className="text-xs bg-genie-purple/20 text-genie-purple-light px-2 py-0.5 rounded-full">
                          {uploads.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{desc}</p>
                    <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-genie-purple/50 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Drop files or <span className="text-genie-purple-light font-medium">browse</span></span>
                      <span className="text-[10px] text-muted-foreground">PNG, JPG</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleCampaignUpload(e.target.files, channel)} />
                    </label>
                    {uploads.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {uploads.map(upload => (
                          <div key={upload.id} className="relative group rounded-xl border border-border overflow-hidden bg-card">
                            {upload.type === 'screenshot' && upload.previewUrl ? (
                              <img src={upload.publicUrl || upload.previewUrl} alt={upload.file.name} className="w-full h-20 object-cover object-top" />
                            ) : (
                              <div className="w-full h-20 flex flex-col items-center justify-center gap-1 bg-muted/30">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground uppercase font-mono">{upload.file.name.split('.').pop()}</span>
                              </div>
                            )}
                            {upload.uploading && (
                              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-genie-purple" />
                              </div>
                            )}
                            <div className="p-1.5">
                              <p className="text-[10px] text-foreground truncate">{upload.file.name}</p>
                            </div>
                            <button onClick={() => handleRemoveCampaignUpload(channel, upload.id)} className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>

            {/* Completed Tasks & Client Needs */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-5 h-5 text-genie-gold" />
                <h3 className="text-lg font-semibold text-foreground">Completed Tasks & Client Needs</h3>
              </div>
              <div className="genie-card p-5 rounded-2xl">
                <p className="text-sm text-muted-foreground mb-3">
                  Paste all completed tasks and things you need from the client below. The AI will automatically sort each item into the correct platform section (Google, Meta, SEO, Email, SMS, Website, CRM, etc.) in the generated deck.
                </p>
                <textarea
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder={`Example:\n- Launched new Google search campaign targeting "emergency plumber near me"\n- Updated Meta retargeting audiences with lookalikes\n- Fixed broken links on /services page\n- Need client to approve new email template designs\n- Sent 2 SMS blasts for holiday promo\n- Set up new CRM automation for lead follow-up`}
                  rows={8}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[120px]"
                />
                {taskNotes.trim() && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ {taskNotes.trim().split('\n').filter(l => l.trim()).length} line(s) will be categorized by platform in the deck
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-border text-foreground hover:bg-accent transition-colors">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!(adData && Object.keys(adData).length > 0) && !seoDeckData}
                className="gold-button px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Review & Generate
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Generate */}
        {step === 3 && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">
                Ready to Generate
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Review the details and generate your branded deck.
              </p>
            </div>

            {/* Summary Card */}
            <div className="genie-card p-8 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-semibold text-foreground">Deck Summary</h3>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary/20 text-primary">
                  Client Deck
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="text-lg font-semibold text-foreground">{formData.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Website</p>
                    <p className="text-foreground">{formData.websiteUrl || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date Range</p>
                    <p className="text-foreground">{format(dateStart, 'MMM d, yyyy')} — {format(dateEnd, 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Branding</p>
                    <p className="text-foreground">{scraped ? '✓ Extracted from website' : 'Not extracted'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">SEO Data</p>
                    <p className="text-foreground">{seoData ? '✓ Available' : 'Not available'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supermetrics Ad Data</p>
                    <p className="text-foreground">
                      {adData ? `✓ ${Object.keys(adData).length} platform(s) loaded` : 'Not pulled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">SEO Deck Data</p>
                    <p className="text-foreground">
                      {seoDeckData ? `✓ Organic metrics${seoDeckData.previous ? ' + PoP trends' : ''}${seoDeckData.siteAudit ? ' + Site audit' : ''}` : 'Not pulled'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Deck Colors:</p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: formData.deckPrimaryColor }} />
                    <span className="text-xs text-muted-foreground">Primary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: formData.deckBackgroundColor }} />
                    <span className="text-xs text-muted-foreground">Background</span>
                  </div>
                </div>
              </div>

              {/* SEO Data Preview */}
              {seoData && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">SEO Data (will be included in deck):</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.organicKeywords?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Keywords</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.organicTraffic?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Traffic</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.domainAuthority}</p>
                      <p className="text-xs text-muted-foreground">DA</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-genie-gold">{seoData.backlinks?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Backlinks</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generation Progress */}
            {isGenerating && (
              <div className="genie-card p-8 rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 via-card to-primary/5 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-primary transition-all duration-500" strokeDasharray={circularProgress.circumference} strokeDashoffset={circularProgress.offset} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold tabular-nums">{generationProgress}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-lg font-semibold">Generating Premium Deck...</span>
                      <p className="text-sm text-muted-foreground mt-0.5">{progressMessage || 'Initializing AI analysis...'}</p>
                    </div>
                  </div>

                  <Progress value={generationProgress} className="h-2 mb-6" />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {generationStages.map((stage) => (
                      <div key={stage.id} className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg transition-all",
                        stage.status === 'pending' && "bg-muted/30 opacity-50",
                        stage.status === 'loading' && "bg-primary/10 border border-primary/30",
                        stage.status === 'complete' && "bg-emerald-500/10 border border-emerald-500/20",
                        stage.status === 'warning' && "bg-amber-500/10 border border-amber-500/20",
                        stage.status === 'error' && "bg-destructive/10 border border-destructive/20"
                      )}>
                        <div className="flex-shrink-0">
                          {stage.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                          {stage.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          {stage.status === 'complete' && <Check className="h-4 w-4 text-emerald-500" />}
                          {stage.status === 'warning' && <AlertCircle className="h-4 w-4 text-amber-500" />}
                          {stage.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        </div>
                        <span className={cn(
                          "text-xs font-medium truncate",
                          stage.status === 'pending' && "text-muted-foreground",
                          stage.status === 'loading' && "text-primary",
                          stage.status === 'complete' && "text-emerald-500",
                          stage.status === 'warning' && "text-amber-500",
                          stage.status === 'error' && "text-destructive"
                        )}>
                          {stage.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Premium analysis takes 2-5 minutes for maximum quality
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl border border-border text-foreground hover:bg-accent transition-colors">
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className="gold-button px-10 py-4 rounded-xl text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Generating Deck...</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Generate Deck</>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const StepIndicator = ({ step, currentStep, label }: { step: number; currentStep: number; label: string }) => (
  <div className={`flex items-center gap-2 ${currentStep >= step ? 'text-foreground' : 'text-muted-foreground'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
      currentStep > step 
        ? 'bg-genie-gold text-genie-navy' 
        : currentStep === step 
          ? 'bg-genie-purple text-foreground' 
          : 'bg-muted text-muted-foreground'
    }`}>
      {currentStep > step ? <Check className="w-4 h-4" /> : step}
    </div>
    <span className="hidden sm:block text-sm font-medium">{label}</span>
  </div>
);

export default DeckBuilder;

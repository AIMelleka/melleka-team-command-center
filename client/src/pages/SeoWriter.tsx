import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Sparkles, 
  FileText, 
  Search, 
  Copy,
  Check,
  Loader2,
  Globe,
  Wand2,
  Target,
  TrendingUp,
  TrendingDown,
  Zap,
  MessageCircleQuestion,
  BarChart3,
  BookOpen,
  Tag,
  CheckCircle2,
  PenTool,
  Download,
  Crown,
  AlertTriangle,
  Calendar,
  Eye,
  Star,
  Award,
  Layers,
  ExternalLink,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import GenieLamp from '@/components/icons/GenieLamp';
import { useAuth } from '@/hooks/useAuth';

interface ContentScore {
  overall: number;
  keywordDensity: number;
  readability: number;
  wordCount: number;
  headingStructure: number;
  suggestions: string[];
}

interface SerpFeature {
  type: string;
  present: boolean;
  opportunity: string;
}

interface FullAnalysisOutput {
  domain: string;
  businessInfo: {
    businessName?: string;
    name?: string;
    industry: string;
    description: string;
    mainServices?: string[];
    services?: string[];
  };
  seoMetrics: {
    organicKeywords: number;
    monthlyTraffic: number;
    domainAuthority: number;
    backlinks: number;
    referringDomains?: number;
    trafficTrend?: number[];
    trafficChange?: number;
  };
  keywords: {
    quickWins?: { keyword: string; volume: number; difficulty: number; timeToRank?: string; cpc?: number; intent?: string; opportunityScore?: number }[];
    goldenKeywords?: { keyword: string; volume: number; difficulty: number; cpc?: number; intent?: string; score?: number }[];
    highOpportunity?: { keyword: string; volume: number; difficulty: number; intent?: string; cpc?: number; score?: number }[];
    longTail?: { keyword: string; volume: number; difficulty: number; intent?: string }[];
    questions?: { question: string; volume: number; difficulty?: number; featured?: boolean }[];
    keywordGaps?: { keyword: string; volume: number; difficulty: number; competitorDomain?: string }[];
    existingRankings?: { keyword: string; position: number; volume: number; difficulty: number }[];
  };
  blogTopics?: {
    title: string;
    targetKeyword: string;
    searchVolume: number;
    difficulty: number;
    outline: string[];
    estimatedTraffic?: string | number;
    contentType?: string;
    featuredSnippetOpportunity?: boolean;
  }[];
  metaTags?: {
    homepage?: { title: string; description: string };
    services?: { page?: string; title: string; description: string }[];
  };
  contentGaps?: {
    topic: string;
    competitorsCovering: number;
    opportunity: string;
    priority?: string;
  }[];
  recommendations?: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    impact: string;
    timeframe: string;
    category?: string;
  }[];
  contentCalendar?: {
    month: string;
    topics: string[];
    focus: string;
  }[];
  serpFeatures?: SerpFeature[];
  competitors?: {
    domain: string;
    traffic: number;
    keywords: number;
    commonKeywords?: number;
  }[];
  source?: 'semrush' | 'ai' | 'hybrid';
  websiteScraped?: boolean;
}

interface AIDetectionResult {
  score: number;
  risk: 'low' | 'medium' | 'high';
  flaggedSections: { text: string; reason: string; severity: 'low' | 'medium' | 'high' }[];
  suggestions: string[];
}

interface GeneratedContent {
  blogPosts: {
    title: string;
    targetKeyword: string;
    fullContent: string;
    wordCount: number;
    contentScore?: ContentScore;
    aiDetection?: AIDetectionResult;
  }[];
  metaTags: {
    page: string;
    title: string;
    description: string;
    charCount?: { title: number; description: number };
  }[];
  faqContent: {
    question: string;
    answer: string;
    wordCount?: number;
  }[];
  schemaMarkup?: {
    type: string;
    markup: string;
  }[];
}

const progressStages = [
  { stage: 1, message: "Connecting to Semrush API...", progress: 5 },
  { stage: 2, message: "Analyzing domain authority & backlinks...", progress: 15 },
  { stage: 3, message: "Fetching organic keyword rankings...", progress: 25 },
  { stage: 4, message: "Discovering quick win opportunities...", progress: 35 },
  { stage: 5, message: "Finding golden keywords (high value, medium difficulty)...", progress: 45 },
  { stage: 6, message: "Analyzing competitor keyword gaps...", progress: 55 },
  { stage: 7, message: "Identifying SERP feature opportunities...", progress: 65 },
  { stage: 8, message: "Generating blog topic ideas with AI...", progress: 75 },
  { stage: 9, message: "Creating content calendar & strategy...", progress: 85 },
  { stage: 10, message: "Compiling strategic recommendations...", progress: 95 },
  { stage: 11, message: "Analysis complete!", progress: 100 },
];

const contentGenerationStages = [
  { stage: 1, message: "Preparing your selections...", progress: 10 },
  { stage: 2, message: "Writing SEO-optimized blog content...", progress: 30 },
  { stage: 3, message: "Calculating content optimization scores...", progress: 50 },
  { stage: 4, message: "Generating meta tags & schema markup...", progress: 70 },
  { stage: 5, message: "Creating FAQ answers...", progress: 85 },
  { stage: 6, message: "Content ready!", progress: 100 },
];

const topicWriterStages = [
  { stage: 1, message: "Analyzing topic & search intent...", progress: 5 },
  { stage: 2, message: "Researching keywords via Semrush API...", progress: 15 },
  { stage: 3, message: "Analyzing SERP competition...", progress: 25 },
  { stage: 4, message: "Identifying content gaps...", progress: 35 },
  { stage: 5, message: "Determining optimal content structure...", progress: 45 },
  { stage: 6, message: "Generating comprehensive outline...", progress: 55 },
  { stage: 7, message: "Writing SEO-optimized content...", progress: 70 },
  { stage: 8, message: "Adding internal linking suggestions...", progress: 80 },
  { stage: 9, message: "Calculating content score...", progress: 90 },
  { stage: 10, message: "Article complete!", progress: 100 },
];

interface TopicWriterResult {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  competitorAnalysis: {
    avgWordCount: number;
    avgHeadings: number;
    commonTopics: string[];
    contentGaps: string[];
  };
  serpFeatures: string[];
  outline: string[];
  fullContent: string;
  wordCount: number;
  contentScore: ContentScore;
  metaTitle: string;
  metaDescription: string;
  internalLinkingSuggestions: string[];
  faqSchema: { question: string; answer: string }[];
}

type SeoWriterJobStatus = 'queued' | 'processing' | 'complete' | 'failed';
interface SeoWriterJobRow {
  id: string;
  status: SeoWriterJobStatus;
  progress: number;
  progress_message: string | null;
  result: any | null;
  error: string | null;
  updated_at: string;
}

const SeoWriter = () => {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [customSeeds, setCustomSeeds] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [contentStage, setContentStage] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [analysisOutput, setAnalysisOutput] = useState<FullAnalysisOutput | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [activeResultTab, setActiveResultTab] = useState('overview');

  // Topic Writer states
  const [topicInput, setTopicInput] = useState('');
  const [isWritingTopic, setIsWritingTopic] = useState(false);
  const [topicWriterStage, setTopicWriterStage] = useState(0);
  const [topicResult, setTopicResult] = useState<TopicWriterResult | null>(null);
  const [activeMode, setActiveMode] = useState<'domain' | 'topic'>('domain');
  
  // Keyword preview state (confirmation step before generation)
  const [showKeywordPreview, setShowKeywordPreview] = useState(false);
  const [previewPrimaryKeyword, setPreviewPrimaryKeyword] = useState('');
  const [editedPrimaryKeyword, setEditedPrimaryKeyword] = useState('');
  
  // Advanced topic writer options
  const [formatReferenceUrl, setFormatReferenceUrl] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(1500);
  const [writingPerson, setWritingPerson] = useState<'first' | 'third'>('third');
  const [targetAudience, setTargetAudience] = useState('');
  const [tonesOfVoice, setTonesOfVoice] = useState<Set<string>>(new Set(['professional']));
  const [brandName, setBrandName] = useState('');
  const [brandProduct, setBrandProduct] = useState('');
  const [backlinksUrls, setBacklinksUrls] = useState('');

  // Async job tracking (Realtime + polling fallback)
  const [jobProgress, setJobProgress] = useState(0);
  const [jobProgressMessage, setJobProgressMessage] = useState('');
  const seoRealtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seoPollingActiveRef = useRef(false);
  const seoLastSyncTimestampRef = useRef<string | null>(null);

  const cleanupSeoJobSync = useCallback(() => {
    seoPollingActiveRef.current = false;
    seoLastSyncTimestampRef.current = null;
    if (seoRealtimeChannelRef.current) {
      supabase.removeChannel(seoRealtimeChannelRef.current);
      seoRealtimeChannelRef.current = null;
    }
  }, []);

  const startSeoJobSync = useCallback((jobId: string): Promise<SeoWriterJobRow> => {
    return new Promise((resolve, reject) => {
      cleanupSeoJobSync();
      seoPollingActiveRef.current = true;
      let pollInterval = 2000;
      let pollTimeoutId: number | null = null;
      let resolved = false;

      const handleUpdate = (job: SeoWriterJobRow) => {
        if (seoLastSyncTimestampRef.current && new Date(job.updated_at) <= new Date(seoLastSyncTimestampRef.current)) {
          return;
        }
        seoLastSyncTimestampRef.current = job.updated_at;
        setJobProgress(job.progress ?? 0);
        setJobProgressMessage(job.progress_message || 'Processing...');
        pollInterval = 2000;

        if (job.status === 'complete' && !resolved) {
          resolved = true;
          cleanupSeoJobSync();
          resolve(job);
        }
        if (job.status === 'failed' && !resolved) {
          resolved = true;
          cleanupSeoJobSync();
          reject(new Error(job.error || 'Generation failed'));
        }
      };

      seoRealtimeChannelRef.current = supabase
        .channel(`seo-job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'seo_writer_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            handleUpdate(payload.new as SeoWriterJobRow);
          }
        )
        .subscribe();

      const poll = async () => {
        if (!seoPollingActiveRef.current || resolved) return;
        try {
          const { data, error } = await supabase
            .from('seo_writer_jobs')
            .select('id, status, progress, progress_message, result, error, updated_at')
            .eq('id', jobId)
            .single();

          if (!error && data) {
            handleUpdate(data as SeoWriterJobRow);
          }
        } catch (e) {
          console.error('[SEO Polling] Exception:', e);
        } finally {
          if (!resolved && seoPollingActiveRef.current) {
            pollInterval = Math.min(pollInterval * 1.5, 10000);
            pollTimeoutId = setTimeout(poll, pollInterval) as unknown as number;
          }
        }
      };

      poll();

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanupSeoJobSync();
          if (pollTimeoutId) clearTimeout(pollTimeoutId);
          reject(new Error('Generation timed out'));
        }
      }, 15 * 60 * 1000);

      // Ensure timeout cleared on resolve/reject
      const originalResolve = resolve;
      const originalReject = reject;
      resolve = ((value: SeoWriterJobRow) => {
        clearTimeout(timeoutId);
        originalResolve(value);
      }) as any;
      reject = ((err: Error) => {
        clearTimeout(timeoutId);
        originalReject(err);
      }) as any;
    });
  }, [cleanupSeoJobSync]);

  // Selection states
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [selectedBlogTopics, setSelectedBlogTopics] = useState<Set<number>>(new Set());
  const [selectedMetaPages, setSelectedMetaPages] = useState<Set<string>>(new Set(['homepage']));
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  
  // Blog expansion states
  const [targetWordCounts, setTargetWordCounts] = useState<Record<number, number>>({});
  const [expandingBlogIndex, setExpandingBlogIndex] = useState<number | null>(null);
  
  // Topic article expansion states
  const [topicExpandTarget, setTopicExpandTarget] = useState<number>(0);
  const [isExpandingTopicArticle, setIsExpandingTopicArticle] = useState(false);
  
  // AI Detection states
  const [analyzingDetectionIndex, setAnalyzingDetectionIndex] = useState<number | null>(null);
  const [humanizingIndex, setHumanizingIndex] = useState<number | null>(null);

  // Clean content for copy-paste (remove markdown, emojis, em dashes, etc.)
  const cleanContentForCopy = (text: string): string => {
    return text
      // Remove markdown headings (##, ###, etc.)
      .replace(/^#{1,6}\s*/gm, '')
      // Remove bold/italic markers (**, *, __, _)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove strikethrough (~~)
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove em dashes and replace with hyphens
      .replace(/—/g, '-')
      .replace(/–/g, '-')
      // Remove bullet points and list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove blockquotes
      .replace(/^>\s*/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove links but keep text [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove emojis
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
      .replace(/[\u{231A}-\u{231B}]/gu, '')
      .replace(/[\u{23E9}-\u{23F3}]/gu, '')
      .replace(/[\u{23F8}-\u{23FA}]/gu, '')
      .replace(/[\u{25AA}-\u{25AB}]/gu, '')
      .replace(/[\u{25B6}]/gu, '')
      .replace(/[\u{25C0}]/gu, '')
      .replace(/[\u{25FB}-\u{25FE}]/gu, '')
      .replace(/[\u{2614}-\u{2615}]/gu, '')
      .replace(/[\u{2648}-\u{2653}]/gu, '')
      .replace(/[\u{267F}]/gu, '')
      .replace(/[\u{2693}]/gu, '')
      .replace(/[\u{26A1}]/gu, '')
      .replace(/[\u{26AA}-\u{26AB}]/gu, '')
      .replace(/[\u{26BD}-\u{26BE}]/gu, '')
      .replace(/[\u{26C4}-\u{26C5}]/gu, '')
      .replace(/[\u{26CE}]/gu, '')
      .replace(/[\u{26D4}]/gu, '')
      .replace(/[\u{26EA}]/gu, '')
      .replace(/[\u{26F2}-\u{26F3}]/gu, '')
      .replace(/[\u{26F5}]/gu, '')
      .replace(/[\u{26FA}]/gu, '')
      .replace(/[\u{26FD}]/gu, '')
      // Remove special symbols
      .replace(/[★☆✓✔✕✖✗✘●○◆◇■□▲△▶▷◀◁♠♣♥♦]/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const copyToClipboard = async (text: string, field: string) => {
    const cleanText = cleanContentForCopy(text);
    await navigator.clipboard.writeText(cleanText);
    setCopiedField(field);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={(e) => { e.stopPropagation(); copyToClipboard(text, field); }}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyword)) newSet.delete(keyword);
      else newSet.add(keyword);
      return newSet;
    });
  };

  const toggleBlogTopic = (index: number) => {
    setSelectedBlogTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const toggleMetaPage = (page: string) => {
    setSelectedMetaPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(page)) newSet.delete(page);
      else newSet.add(page);
      return newSet;
    });
  };

  const toggleQuestion = (index: number) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const selectAllQuickWins = () => {
    if (!analysisOutput?.keywords?.quickWins) return;
    const allQuickWins = analysisOutput.keywords.quickWins.map(k => k.keyword);
    setSelectedKeywords(new Set(allQuickWins));
  };

  const selectAllBlogTopics = () => {
    if (!analysisOutput?.blogTopics) return;
    const allIndexes = analysisOutput.blogTopics.map((_, i) => i);
    setSelectedBlogTopics(new Set(allIndexes));
  };

  const selectAllQuestions = () => {
    if (!analysisOutput?.keywords?.questions) return;
    const allIndexes = analysisOutput.keywords.questions.map((_, i) => i);
    setSelectedQuestions(new Set(allIndexes));
  };

  const handleAnalyze = async () => {
    if (!domain.trim()) {
      toast.error('Please enter a domain');
      return;
    }

    let cleanDomain = domain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    setIsLoading(true);
    setCurrentStage(1);
    setAnalysisOutput(null);
    setGeneratedContent(null);
    setSelectedKeywords(new Set());
    setSelectedBlogTopics(new Set());
    setSelectedMetaPages(new Set(['homepage']));
    setSelectedQuestions(new Set());

    const progressInterval = setInterval(() => {
      setCurrentStage(prev => prev < 10 ? prev + 1 : prev);
    }, 2500);

    try {
      // Parse custom seed keywords (comma-separated)
      const seedKeywords = customSeeds
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0)
        .slice(0, 5); // Max 5 custom seeds

      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: { 
          type: 'full-analysis', 
          domain: cleanDomain,
          customSeeds: seedKeywords.length > 0 ? seedKeywords : undefined
        }
      });

      clearInterval(progressInterval);

      if (error) {
        console.error('Edge function error:', error);
        toast.error(error.message || 'Failed to analyze domain');
        return;
      }

      setCurrentStage(11);
      setAnalysisOutput(data);
      
      // Auto-select recommended items
      if (data?.keywords?.quickWins?.length > 0) {
        setSelectedKeywords(new Set(data.keywords.quickWins.slice(0, 5).map((k: any) => k.keyword)));
      } else if (data?.keywords?.goldenKeywords?.length > 0) {
        setSelectedKeywords(new Set(data.keywords.goldenKeywords.slice(0, 5).map((k: any) => k.keyword)));
      }
      if (data?.blogTopics?.length > 0) {
        setSelectedBlogTopics(new Set(data.blogTopics.slice(0, 3).map((_: any, i: number) => i)));
      }
      if (data?.keywords?.questions?.length > 0) {
        setSelectedQuestions(new Set(data.keywords.questions.slice(0, 5).map((_: any, i: number) => i)));
      }
      
      toast.success('Analysis complete! Select items and generate content.');
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => { setIsLoading(false); setCurrentStage(0); }, 1000);
    }
  };

  const handleGenerateContent = async () => {
    if (!analysisOutput) return;

    const blogTopics = analysisOutput.blogTopics || [];
    const questions = analysisOutput.keywords?.questions || [];
    
    const selectedBlogData = Array.from(selectedBlogTopics).map(i => blogTopics[i]).filter(Boolean);
    const selectedQuestionsData = Array.from(selectedQuestions).map(i => questions[i]).filter(Boolean);
    
    if (selectedBlogData.length === 0 && selectedMetaPages.size === 0 && selectedQuestionsData.length === 0) {
      toast.error('Please select at least one item to generate content for');
      return;
    }

    setIsGeneratingContent(true);
    setContentStage(1);
    setJobProgress(5);
    setJobProgressMessage('Starting background job...');

    try {
      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: { 
          type: 'generate-content',
          domain: analysisOutput.domain,
          businessInfo: analysisOutput.businessInfo,
          selections: {
            blogTopics: selectedBlogData,
            metaPages: Array.from(selectedMetaPages),
            metaTagsData: analysisOutput.metaTags,
            questions: selectedQuestionsData,
            keywords: Array.from(selectedKeywords)
          }
        }
      });

      if (error) {
        console.error('Content generation error:', error);
        toast.error(error.message || 'Failed to generate content');
        return;
      }

      // New async contract: { success, job_id, result? }
      if ((data as any)?.result) {
        setContentStage(6);
        setGeneratedContent((data as any).result as GeneratedContent);
        setActiveResultTab('content');
        toast.success('Content generated successfully!');
        return;
      }

      if ((data as any)?.job_id) {
        const jobId = (data as any).job_id as string;
        setJobProgress(10);
        setJobProgressMessage('Processing in background...');

        const completed = await startSeoJobSync(jobId);
        if (completed.result) {
          setGeneratedContent(completed.result as GeneratedContent);
          setActiveResultTab('content');
          setContentStage(6);
          toast.success('Content generated successfully!');
          return;
        }
        throw new Error('Generation completed but no result found');
      }

      throw new Error('Generation started but no job ID returned');
    } catch (err) {
      console.error('Content generation error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      cleanupSeoJobSync();
      setTimeout(() => { setIsGeneratingContent(false); setContentStage(0); }, 1000);
    }
  };

  // Topic Writer - Show keyword preview step
  const handleTopicWrite = async () => {
    if (!topicInput.trim()) {
      toast.error('Please enter a topic to write about');
      return;
    }

    // Show keyword preview modal for confirmation
    const primaryKeyword = topicInput.trim();
    setPreviewPrimaryKeyword(primaryKeyword);
    setEditedPrimaryKeyword(primaryKeyword);
    setShowKeywordPreview(true);
  };

  // Actually generate the article after user confirms keyword
  const handleConfirmKeywordAndGenerate = async () => {
    setShowKeywordPreview(false);
    
    const confirmedKeyword = editedPrimaryKeyword.trim() || topicInput.trim();
    
    setIsWritingTopic(true);
    setTopicWriterStage(1);
    setTopicResult(null);
    setJobProgress(5);
    setJobProgressMessage('Starting background job...');

    try {
      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: { 
          type: 'topic-writer',
          topic: confirmedKeyword, // Use the confirmed/edited keyword
          domain: domain.trim() || undefined,
          // Advanced options
          formatReferenceUrl: formatReferenceUrl.trim() || undefined,
          targetWordCount: targetWordCount,
          writingPerson: writingPerson,
          targetAudience: targetAudience.trim() || undefined,
          tonesOfVoice: Array.from(tonesOfVoice),
          brandName: brandName.trim() || undefined,
          brandProduct: brandProduct.trim() || undefined,
          backlinksUrls: backlinksUrls.trim() || undefined
        }
      });

      if (error) {
        console.error('Topic writer error:', error);
        toast.error(error.message || 'Failed to generate content');
        return;
      }

      if ((data as any)?.result) {
        setTopicWriterStage(10);
        setTopicResult((data as any).result as TopicWriterResult);
        toast.success('Article generated successfully!');
        return;
      }

      if ((data as any)?.job_id) {
        const jobId = (data as any).job_id as string;
        const completed = await startSeoJobSync(jobId);
        if (completed.result) {
          setTopicWriterStage(10);
          setTopicResult(completed.result as TopicWriterResult);
          toast.success('Article generated successfully!');
          return;
        }
        throw new Error('Generation completed but no result found');
      }

      throw new Error('Generation started but no job ID returned');
    } catch (err) {
      console.error('Topic writer error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      cleanupSeoJobSync();
      setTimeout(() => { setIsWritingTopic(false); setTopicWriterStage(0); }, 1000);
    }
  };

  // Handle expanding topic article when under word count
  const handleExpandTopicArticle = async () => {
    if (!topicResult || topicExpandTarget <= topicResult.wordCount) return;
    
    setIsExpandingTopicArticle(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: {
          type: 'expand-blog',
          existingContent: topicResult.fullContent,
          targetWordCount: topicExpandTarget,
          title: topicResult.topic,
          targetKeyword: topicResult.primaryKeyword,
          businessInfo: {
            name: brandName || undefined,
            industry: topicResult.searchIntent,
            description: topicResult.topic
          }
        }
      });
      
      if (error) {
        console.error('Expand topic error:', error);
        toast.error(error.message || 'Failed to expand article');
        return;
      }
      
      // Update the topic result with expanded content
      setTopicResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          fullContent: data.fullContent,
          wordCount: data.wordCount,
          contentScore: data.contentScore || prev.contentScore
        };
      });
      
      toast.success(`Article expanded from ${topicResult.wordCount} to ${data.wordCount} words!`);
    } catch (err) {
      console.error('Expand topic error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsExpandingTopicArticle(false);
    }
  };

  useEffect(() => {
    return () => cleanupSeoJobSync();
  }, [cleanupSeoJobSync]);

  // Handle blog expansion/regeneration
  const handleExpandBlog = async (index: number) => {
    if (!generatedContent || !analysisOutput) return;
    
    const post = generatedContent.blogPosts[index];
    const targetCount = targetWordCounts[index] || 3000;
    
    if (targetCount <= post.wordCount) {
      toast.error(`Target word count must be higher than current (${post.wordCount} words)`);
      return;
    }
    
    setExpandingBlogIndex(index);
    
    try {
      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: {
          type: 'expand-blog',
          existingContent: post.fullContent,
          targetWordCount: targetCount,
          title: post.title,
          targetKeyword: post.targetKeyword,
          businessInfo: analysisOutput.businessInfo
        }
      });
      
      if (error) {
        console.error('Expand error:', error);
        toast.error(error.message || 'Failed to expand blog post');
        return;
      }
      
      // Update the blog post in state
      setGeneratedContent(prev => {
        if (!prev) return prev;
        const updatedPosts = [...prev.blogPosts];
        updatedPosts[index] = {
          ...updatedPosts[index],
          fullContent: data.fullContent,
          wordCount: data.wordCount,
          contentScore: data.contentScore
        };
        return { ...prev, blogPosts: updatedPosts };
      });
      
      toast.success(`Blog expanded from ${post.wordCount} to ${data.wordCount} words!`);
    } catch (err) {
      console.error('Expand error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setExpandingBlogIndex(null);
    }
  };

  // Analyze AI Detection Score
  const handleAnalyzeDetection = async (index: number) => {
    if (!generatedContent) return;
    
    const post = generatedContent.blogPosts[index];
    setAnalyzingDetectionIndex(index);
    
    try {
      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: {
          type: 'analyze-detection',
          content: post.fullContent
        }
      });
      
      if (error) {
        console.error('Detection analysis error:', error);
        toast.error(error.message || 'Failed to analyze content');
        return;
      }
      
      // Update the blog post with detection data
      setGeneratedContent(prev => {
        if (!prev) return prev;
        const updatedPosts = [...prev.blogPosts];
        updatedPosts[index] = {
          ...updatedPosts[index],
          aiDetection: data
        };
        return { ...prev, blogPosts: updatedPosts };
      });
      
      const riskEmoji = data.risk === 'low' ? '✅' : data.risk === 'medium' ? '⚠️' : '🚨';
      toast.success(`${riskEmoji} AI Detection Score: ${data.score}/100 (${data.risk} risk)`);
    } catch (err) {
      console.error('Detection error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setAnalyzingDetectionIndex(null);
    }
  };

  // Humanize Content
  const handleHumanize = async (index: number) => {
    if (!generatedContent || !analysisOutput) return;
    
    const post = generatedContent.blogPosts[index];
    setHumanizingIndex(index);
    
    try {
      const { data, error } = await supabase.functions.invoke('seo-writer', {
        body: {
          type: 'humanize-content',
          content: post.fullContent,
          flaggedSections: post.aiDetection?.flaggedSections || [],
          targetKeyword: post.targetKeyword,
          businessInfo: analysisOutput.businessInfo
        }
      });
      
      if (error) {
        console.error('Humanize error:', error);
        toast.error(error.message || 'Failed to humanize content');
        return;
      }
      
      // Update the blog post with humanized content
      setGeneratedContent(prev => {
        if (!prev) return prev;
        const updatedPosts = [...prev.blogPosts];
        updatedPosts[index] = {
          ...updatedPosts[index],
          fullContent: data.fullContent,
          wordCount: data.wordCount,
          contentScore: data.contentScore,
          aiDetection: data.aiDetection
        };
        return { ...prev, blogPosts: updatedPosts };
      });
      
      const improvement = (post.aiDetection?.score || 50) - data.aiDetection.score;
      toast.success(`Content humanized! Detection score improved by ${improvement > 0 ? improvement : 0} points`);
    } catch (err) {
      console.error('Humanize error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setHumanizingIndex(null);
    }
  };

  const downloadTopicContent = () => {
    if (!topicResult) return;
    
    let content = `# ${topicResult.topic}\n\n`;
    content += `Primary Keyword: ${topicResult.primaryKeyword}\n`;
    content += `Secondary Keywords: ${topicResult.secondaryKeywords.join(', ')}\n`;
    content += `Search Intent: ${topicResult.searchIntent}\n`;
    content += `Word Count: ${topicResult.wordCount}\n`;
    content += `Content Score: ${topicResult.contentScore.overall}/100\n\n`;
    content += `---\n\n`;
    content += `## Meta Title\n${topicResult.metaTitle}\n\n`;
    content += `## Meta Description\n${topicResult.metaDescription}\n\n`;
    content += `---\n\n`;
    content += `# Article Content\n\n${topicResult.fullContent}\n\n`;
    content += `---\n\n`;
    
    if (topicResult.faqSchema.length > 0) {
      content += `# FAQ Schema\n\n`;
      topicResult.faqSchema.forEach((faq, i) => {
        content += `### ${i + 1}. ${faq.question}\n${faq.answer}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-article-${topicResult.primaryKeyword.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Content downloaded!');
  };

  const getTotalSelections = () => {
    return selectedBlogTopics.size + selectedQuestions.size + (selectedMetaPages.size > 0 ? 1 : 0);
  };

  const downloadContent = () => {
    if (!generatedContent) return;
    
    let content = `# SEO Content for ${analysisOutput?.domain}\n\n`;
    content += `Generated on ${new Date().toLocaleDateString()}\n\n`;
    content += `---\n\n`;

    if (generatedContent.blogPosts.length > 0) {
      content += `# BLOG POSTS\n\n`;
      generatedContent.blogPosts.forEach((post, i) => {
        content += `## ${i + 1}. ${post.title}\n`;
        content += `Target Keyword: ${post.targetKeyword}\n`;
        content += `Word Count: ${post.wordCount}\n`;
        if (post.contentScore) {
          content += `Content Score: ${post.contentScore.overall}/100\n`;
        }
        content += `\n${post.fullContent}\n\n---\n\n`;
      });
    }

    if (generatedContent.metaTags.length > 0) {
      content += `# META TAGS\n\n`;
      generatedContent.metaTags.forEach(meta => {
        content += `## ${meta.page}\n`;
        content += `**Title:** ${meta.title}\n`;
        content += `**Description:** ${meta.description}\n\n`;
      });
      content += `---\n\n`;
    }

    if (generatedContent.faqContent.length > 0) {
      content += `# FAQ CONTENT\n\n`;
      generatedContent.faqContent.forEach((faq, i) => {
        content += `### ${i + 1}. ${faq.question}\n`;
        content += `${faq.answer}\n\n`;
      });
    }

    if (generatedContent.schemaMarkup?.length) {
      content += `# SCHEMA MARKUP\n\n`;
      generatedContent.schemaMarkup.forEach(schema => {
        content += `## ${schema.type} Schema\n`;
        content += `\`\`\`json\n${schema.markup}\n\`\`\`\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-content-${analysisOutput?.domain?.replace(/\./g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Content downloaded!');
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 20) return 'text-green-500';
    if (difficulty <= 40) return 'text-green-600';
    if (difficulty <= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 20) return 'Very Easy';
    if (difficulty <= 35) return 'Easy';
    if (difficulty <= 50) return 'Medium';
    if (difficulty <= 70) return 'Hard';
    return 'Very Hard';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Context-aware header component
  const SeoWriterHeader = () => {
    const { isAdmin, user, signOut } = useAuth();
    
    const handleBack = () => {
      navigate(isAdmin ? '/' : '/user');
    };
    
    const handleSignOut = async () => {
      await signOut();
      navigate('/login');
    };
    
    return (
      <header className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-genie-purple to-genie-gold flex items-center justify-center">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-foreground">SEO Writer Pro</h1>
                <p className="text-sm text-muted-foreground">World-class SEO content generation</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden md:flex gap-1">
              <Zap className="h-3 w-3" />
              Powered by Semrush
            </Badge>
            {!isAdmin && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isAdmin && <GenieLamp size={32} className="opacity-50" />}
          </div>
        </div>
      </header>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background overflow-y-auto">
      {/* Keyword Preview Dialog */}
      <Dialog open={showKeywordPreview} onOpenChange={setShowKeywordPreview}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-genie-purple" />
              Confirm Primary Keyword
            </DialogTitle>
            <DialogDescription>
              This is the primary keyword your article will target. Make sure it's correct before generating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="primary-keyword" className="text-sm font-medium">
                Primary Keyword
              </Label>
              <Input
                id="primary-keyword"
                value={editedPrimaryKeyword}
                onChange={(e) => setEditedPrimaryKeyword(e.target.value)}
                className="text-lg font-semibold"
                placeholder="Enter your target keyword"
              />
              <p className="text-xs text-muted-foreground">
                This will be used as the main focus keyword throughout your article.
              </p>
            </div>
            
            {editedPrimaryKeyword !== previewPrimaryKeyword && editedPrimaryKeyword.trim() && (
              <div className="p-3 rounded-lg bg-genie-purple/10 border border-genie-purple/20">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-genie-purple" />
                  <span className="text-muted-foreground">
                    Changed from: <span className="line-through">{previewPrimaryKeyword}</span>
                  </span>
                </div>
              </div>
            )}
            
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> Use the exact phrase you want to rank for. For local SEO, include location (e.g., "tutoring in los angeles" not just "tutoring").
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowKeywordPreview(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmKeywordAndGenerate}
              disabled={!editedPrimaryKeyword.trim()}
              className="bg-gradient-to-r from-genie-gold to-genie-purple hover:opacity-90"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <SeoWriterHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Mode Selector Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/50">
            <button
              onClick={() => setActiveMode('domain')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeMode === 'domain' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-4 w-4 inline mr-2" />
              Domain Analysis
            </button>
            <button
              onClick={() => setActiveMode('topic')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeMode === 'topic' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PenTool className="h-4 w-4 inline mr-2" />
              Write About Topic
            </button>
          </div>
        </div>

        {/* Domain Analysis Section */}
        {activeMode === 'domain' && (
          <Card className="glass-card mb-8">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl flex items-center justify-center gap-3">
                <Globe className="h-7 w-7 text-genie-purple" />
                Analyze Your Domain
              </CardTitle>
              <CardDescription className="text-base max-w-2xl mx-auto">
                Deep SEO analysis using Semrush API data. We'll find quick wins, golden keywords, 
                SERP opportunities, and generate complete, optimized content for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl mx-auto space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="text-lg h-12"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    disabled={isLoading || isGeneratingContent}
                  />
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isLoading || isGeneratingContent}
                    className="h-12 px-8 bg-gradient-to-r from-genie-purple to-genie-gold hover:opacity-90"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Wand2 className="h-5 w-5 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Custom Seed Keywords Input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Custom Keywords (optional)</span>
                  </div>
                  <Input
                    placeholder="e.g. digital marketing, seo services, ppc advertising"
                    value={customSeeds}
                    onChange={(e) => setCustomSeeds(e.target.value)}
                    className="text-sm h-10"
                    disabled={isLoading || isGeneratingContent}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords to focus the research on your specific industry or services. 
                    Leave blank for auto-detection.
                  </p>
                </div>

                {/* Progress Section */}
                {isLoading && currentStage > 0 && (
                  <div className="space-y-3 pt-4">
                    <Progress 
                      value={progressStages[currentStage - 1]?.progress || 0} 
                      className="h-2"
                    />
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-genie-purple" />
                      <span className="text-muted-foreground animate-pulse">
                        {progressStages[currentStage - 1]?.message || 'Processing...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Topic Writer Section */}
        {activeMode === 'topic' && (
          <Card className="glass-card mb-8 border-genie-gold/30">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge className="bg-gradient-to-r from-genie-purple to-genie-gold text-white border-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
              </div>
              <CardTitle className="text-2xl flex items-center justify-center gap-3">
                <PenTool className="h-7 w-7 text-genie-gold" />
                Write About Any Topic
              </CardTitle>
              <CardDescription className="text-base max-w-2xl mx-auto">
                Enter any topic and we'll do <strong>everything</strong> for you: keyword research, 
                SERP analysis, competitor gap analysis, and write a complete, optimized article.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Input
                      placeholder="e.g. benefits of local SEO for dentists, how to choose a digital marketing agency..."
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      className="text-lg h-14 flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleTopicWrite()}
                      disabled={isWritingTopic}
                    />
                    <Button 
                      onClick={handleTopicWrite} 
                      disabled={isWritingTopic || !topicInput.trim()}
                      className="h-14 px-8 bg-gradient-to-r from-genie-gold to-genie-purple hover:opacity-90"
                      size="lg"
                    >
                      {isWritingTopic ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Write Article
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Optional Domain Context */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Optional context:</span>
                    <Input
                      placeholder="Your domain (for brand context)"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="h-9 max-w-xs"
                      disabled={isWritingTopic}
                    />
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <Wand2 className="h-4 w-4" />
                    Advanced Options
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Format Reference URL */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <ExternalLink className="h-3 w-3" />
                        Format Reference URL
                      </label>
                      <Input
                        placeholder="https://example.com/blog-post-to-mimic"
                        value={formatReferenceUrl}
                        onChange={(e) => setFormatReferenceUrl(e.target.value)}
                        className="h-9 text-sm"
                        disabled={isWritingTopic}
                      />
                      <p className="text-xs text-muted-foreground">
                        We'll analyze and mimic the formatting style of this page
                      </p>
                    </div>

                    {/* Target Audience */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-3 w-3" />
                        Target Audience / Demographic
                      </label>
                      <Input
                        placeholder="e.g. small business owners, marketing managers, homeowners 35-55"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        className="h-9 text-sm"
                        disabled={isWritingTopic}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Word Count */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          Target Word Count
                        </span>
                        <span className="text-genie-purple font-bold">{targetWordCount.toLocaleString()} words</span>
                      </label>
                      <Slider
                        value={[targetWordCount]}
                        onValueChange={(val) => setTargetWordCount(val[0])}
                        min={500}
                        max={6000}
                        step={250}
                        disabled={isWritingTopic}
                        className="py-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>500</span>
                        <span>6,000</span>
                      </div>
                    </div>

                    {/* Writing Person */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <PenTool className="h-3 w-3" />
                        Writing Perspective
                      </label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={writingPerson === 'first' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setWritingPerson('first')}
                          disabled={isWritingTopic}
                          className={writingPerson === 'first' ? 'bg-genie-purple hover:bg-genie-purple/90' : ''}
                        >
                          First Person (I/We)
                        </Button>
                        <Button
                          type="button"
                          variant={writingPerson === 'third' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setWritingPerson('third')}
                          disabled={isWritingTopic}
                          className={writingPerson === 'third' ? 'bg-genie-purple hover:bg-genie-purple/90' : ''}
                        >
                          Third Person (They/One)
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Tone of Voice - Multiple Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-3 w-3" />
                      Tone of Voice <span className="text-muted-foreground font-normal">(select multiple)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'professional', label: 'Professional' },
                        { value: 'conversational', label: 'Conversational' },
                        { value: 'authoritative', label: 'Authoritative' },
                        { value: 'friendly', label: 'Friendly' },
                      ].map((tone) => (
                        <Button
                          key={tone.value}
                          type="button"
                          variant={tonesOfVoice.has(tone.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setTonesOfVoice(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(tone.value)) {
                                // Don't allow deselecting if it's the last one
                                if (newSet.size > 1) newSet.delete(tone.value);
                              } else {
                                newSet.add(tone.value);
                              }
                              return newSet;
                            });
                          }}
                          disabled={isWritingTopic}
                          className={tonesOfVoice.has(tone.value) ? 'bg-genie-purple hover:bg-genie-purple/90' : ''}
                        >
                          {tone.label}
                          {tonesOfVoice.has(tone.value) && <Check className="h-3 w-3 ml-1" />}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sets the overall writing style and voice of the article
                    </p>
                  </div>

                  {/* CTA Brand & Product Section */}
                  <div className="border-t border-border pt-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Target className="h-4 w-4" />
                      Call-to-Action Settings (Optional)
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Brand Name</label>
                        <Input
                          placeholder="e.g. Melleka, Acme Corp"
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          className="h-9 text-sm"
                          disabled={isWritingTopic}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Product/Service</label>
                        <Input
                          placeholder="e.g. digital marketing services, SEO packages"
                          value={brandProduct}
                          onChange={(e) => setBrandProduct(e.target.value)}
                          className="h-9 text-sm"
                          disabled={isWritingTopic}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We'll include a natural CTA at the end of the article tying in your brand and product
                    </p>
                  </div>

                  {/* Backlinks Section */}
                  <div className="border-t border-border pt-4 space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      Internal Backlinks (Optional)
                    </label>
                    <Input
                      placeholder="Enter URLs to link to, separated by commas (e.g. /services, /about-us, /blog/other-post)"
                      value={backlinksUrls}
                      onChange={(e) => setBacklinksUrls(e.target.value)}
                      className="h-9 text-sm"
                      disabled={isWritingTopic}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll naturally incorporate these links throughout the article as internal backlinks
                    </p>
                  </div>
                </div>

                {/* What We'll Do */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                  {[
                    { icon: Search, label: 'Keyword Research', desc: 'Find best keywords' },
                    { icon: BarChart3, label: 'SERP Analysis', desc: 'Study top results' },
                    { icon: Layers, label: 'Content Gaps', desc: 'Find opportunities' },
                    { icon: FileText, label: 'Write Article', desc: `${targetWordCount.toLocaleString()}+ words` },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center p-3 rounded-lg bg-muted/30 text-center">
                      <item.icon className="h-5 w-5 text-genie-purple mb-1" />
                      <span className="text-xs font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Progress Section */}
                {isWritingTopic && topicWriterStage > 0 && (
                  <div className="space-y-3 pt-4">
                    <Progress 
                      value={topicWriterStages[topicWriterStage - 1]?.progress || 0} 
                      className="h-3"
                    />
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-genie-gold" />
                      <span className="text-muted-foreground animate-pulse">
                        {topicWriterStages[topicWriterStage - 1]?.message || 'Processing...'}
                      </span>
                    </div>
                    <div className="flex justify-center gap-1">
                      {topicWriterStages.map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i < topicWriterStage ? 'bg-genie-gold' : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Topic Writer Result */}
        {topicResult && activeMode === 'topic' && (
          <div className="space-y-6 mb-8">
            {/* Result Header */}
            <Card className="glass-card border-genie-gold/30">
              <CardContent className="py-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold mb-2">{topicResult.topic}</h2>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className="bg-genie-purple/10">
                        <Target className="h-3 w-3 mr-1" />
                        {topicResult.primaryKeyword}
                      </Badge>
                      <Badge variant="outline">
                        {topicResult.searchIntent} Intent
                      </Badge>
                      <Badge variant="outline">
                        {topicResult.wordCount} words
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {topicResult.secondaryKeywords.slice(0, 5).map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`text-3xl font-bold ${getScoreColor(topicResult.contentScore.overall)}`}>
                      {topicResult.contentScore.overall}/100
                    </div>
                    <span className="text-sm text-muted-foreground">Content Score</span>
                    <Button onClick={downloadTopicContent} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Word Count Warning - shows if article is significantly under target */}
            {topicResult.wordCount < targetWordCount * 0.9 && (
              <Card className="glass-card border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-full bg-yellow-500/20">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-semibold text-foreground">Article Under Target Word Count</h4>
                        <p className="text-sm text-muted-foreground">
                          Generated {topicResult.wordCount.toLocaleString()} words, but you requested {targetWordCount.toLocaleString()} words.
                          That's {Math.round((1 - topicResult.wordCount / targetWordCount) * 100)}% under target.
                        </p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex-1 w-full sm:max-w-xs">
                          <div className="flex justify-between text-xs text-muted-foreground mb-2">
                            <span>Expand to</span>
                            <span className="font-medium text-foreground">
                              {(topicExpandTarget || targetWordCount).toLocaleString()} words
                            </span>
                          </div>
                          <Slider
                            value={[topicExpandTarget || targetWordCount]}
                            onValueChange={(value) => setTopicExpandTarget(value[0])}
                            min={topicResult.wordCount + 200}
                            max={6000}
                            step={100}
                            className="w-full"
                            disabled={isExpandingTopicArticle}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{(topicResult.wordCount + 200).toLocaleString()}</span>
                            <span>6,000</span>
                          </div>
                        </div>
                        <Button
                          onClick={handleExpandTopicArticle}
                          disabled={isExpandingTopicArticle || (topicExpandTarget || targetWordCount) <= topicResult.wordCount}
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:opacity-90 text-white whitespace-nowrap"
                        >
                          {isExpandingTopicArticle ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Expanding...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Expand Article
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        We'll add more depth, examples, and expert insights to reach your target word count.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Research Insights */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-genie-purple" />
                    Competitor Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. Word Count</span>
                    <span className="font-medium">{topicResult.competitorAnalysis.avgWordCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. Headings</span>
                    <span className="font-medium">{topicResult.competitorAnalysis.avgHeadings}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-xs text-muted-foreground">Content Gaps Found:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topicResult.competitorAnalysis.contentGaps.slice(0, 3).map((gap, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-green-500/10 text-green-600">
                          {gap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4 text-genie-gold" />
                    SERP Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {topicResult.serpFeatures.map((feature, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Content Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Keyword Density</span>
                    <span className={getScoreColor(topicResult.contentScore.keywordDensity)}>{topicResult.contentScore.keywordDensity}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Readability</span>
                    <span className={getScoreColor(topicResult.contentScore.readability)}>{topicResult.contentScore.readability}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Structure</span>
                    <span className={getScoreColor(topicResult.contentScore.headingStructure)}>{topicResult.contentScore.headingStructure}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Meta Tags */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Optimized Meta Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Title ({topicResult.metaTitle.length} chars)</span>
                    <CopyButton text={topicResult.metaTitle} field="meta-title" />
                  </div>
                  <p className="text-sm font-medium text-blue-600">{topicResult.metaTitle}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Description ({topicResult.metaDescription.length} chars)</span>
                    <CopyButton text={topicResult.metaDescription} field="meta-desc" />
                  </div>
                  <p className="text-sm text-muted-foreground">{topicResult.metaDescription}</p>
                </div>
              </CardContent>
            </Card>

            {/* Full Article */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Full Article
                  </CardTitle>
                  <CopyButton text={topicResult.fullContent} field="full-article" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Parse and render content with per-section copy buttons */}
                  {topicResult.fullContent.split(/\n\n+/).map((section, idx) => {
                    const trimmedSection = section.trim();
                    if (!trimmedSection) return null;
                    
                    const isHeading = trimmedSection.startsWith('#');
                    const headingLevel = (trimmedSection.match(/^#+/) || [''])[0].length;
                    const headingText = trimmedSection.replace(/^#+\s*/, '');
                    
                    return (
                      <div 
                        key={idx} 
                        className={`group relative p-3 rounded-lg hover:bg-muted/30 transition-colors ${
                          isHeading ? 'bg-muted/20' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            {isHeading ? (
                              headingLevel === 1 ? (
                                <h1 className="text-xl font-bold text-foreground">{headingText}</h1>
                              ) : headingLevel === 2 ? (
                                <h2 className="text-lg font-semibold text-foreground">{headingText}</h2>
                              ) : (
                                <h3 className="text-base font-medium text-foreground">{headingText}</h3>
                              )
                            ) : (
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {trimmedSection}
                              </p>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <CopyButton 
                              text={isHeading ? headingText : trimmedSection} 
                              field={`section-${idx}`} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* FAQ Schema */}
            {topicResult.faqSchema.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageCircleQuestion className="h-4 w-4" />
                    FAQ Schema (Ready to Copy)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topicResult.faqSchema.map((faq, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm mb-1">{faq.question}</p>
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                        </div>
                        <CopyButton text={`Q: ${faq.question}\nA: ${faq.answer}`} field={`faq-${i}`} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Generate Content Floating Bar */}
        {analysisOutput && !generatedContent && (
          <div className="sticky top-20 z-40 mb-6">
            <Card className="glass-strong border-genie-purple/30 shadow-lg">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-genie-purple" />
                      <span className="font-medium">
                        {getTotalSelections()} items selected
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground hidden md:block">
                      <span>{selectedBlogTopics.size} blog posts</span>
                      <span className="mx-2">•</span>
                      <span>{selectedQuestions.size} FAQ answers</span>
                      <span className="mx-2">•</span>
                      <span>{selectedMetaPages.size} meta pages</span>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateContent}
                    disabled={isGeneratingContent || getTotalSelections() === 0}
                    className="bg-gradient-to-r from-genie-purple to-genie-gold hover:opacity-90"
                    size="lg"
                  >
                    {isGeneratingContent ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <PenTool className="h-5 w-5 mr-2" />
                        Generate Full Content
                      </>
                    )}
                  </Button>
                </div>

                {isGeneratingContent && contentStage > 0 && (
                  <div className="mt-4 space-y-2">
                    <Progress 
                      value={contentGenerationStages[contentStage - 1]?.progress || 0} 
                      className="h-2"
                    />
                    <p className="text-sm text-center text-muted-foreground animate-pulse">
                      {contentGenerationStages[contentStage - 1]?.message || 'Processing...'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        {analysisOutput && (
          <div className="space-y-6 animate-fade-in">
            {/* AI Fallback Warning Banner */}
            {analysisOutput.source === 'ai' && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">
                        AI-Generated Keyword Data
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Semrush returned no data for this domain (it may be new or have limited online presence). 
                        Keyword volumes and difficulty scores are AI estimates based on industry analysis. 
                        For the most accurate data, try analyzing a more established domain in your industry.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Business Overview with Enhanced Metrics */}
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Target className="h-5 w-5 text-genie-purple" />
                      {analysisOutput.businessInfo?.businessName || analysisOutput.businessInfo?.name || analysisOutput.domain}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {analysisOutput.businessInfo?.industry || 'Business'} • {analysisOutput.businessInfo?.description || 'No description available'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {analysisOutput.source === 'semrush' && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        <Globe className="h-3 w-3 mr-1" />
                        Semrush Data
                      </Badge>
                    )}
                    {analysisOutput.source === 'ai' && (
                      <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Generated
                      </Badge>
                    )}
                    {analysisOutput.source === 'hybrid' && (
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        <Zap className="h-3 w-3 mr-1" />
                        Semrush + AI
                      </Badge>
                    )}
                    {analysisOutput.websiteScraped && (
                      <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                        <FileText className="h-3 w-3 mr-1" />
                        Site Scraped
                      </Badge>
                    )}
                    {analysisOutput.seoMetrics.trafficChange !== undefined && analysisOutput.seoMetrics.trafficChange !== 0 && (
                      <Badge className={analysisOutput.seoMetrics.trafficChange >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}>
                        {analysisOutput.seoMetrics.trafficChange >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {analysisOutput.seoMetrics.trafficChange >= 0 ? '+' : ''}{analysisOutput.seoMetrics.trafficChange}%
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* SEO Metrics - Enhanced */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-genie-purple">{formatNumber(analysisOutput.seoMetrics.organicKeywords)}</p>
                    <p className="text-xs text-muted-foreground">Organic Keywords</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-genie-gold">{formatNumber(analysisOutput.seoMetrics.monthlyTraffic)}</p>
                    <p className="text-xs text-muted-foreground">Monthly Traffic</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{analysisOutput.seoMetrics.domainAuthority}</p>
                    <p className="text-xs text-muted-foreground">Authority Score</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{formatNumber(analysisOutput.seoMetrics.backlinks)}</p>
                    <p className="text-xs text-muted-foreground">Backlinks</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{formatNumber(analysisOutput.seoMetrics.referringDomains || 0)}</p>
                    <p className="text-xs text-muted-foreground">Referring Domains</p>
                  </div>
                </div>

                {/* Services */}
                {(analysisOutput.businessInfo?.mainServices?.length || analysisOutput.businessInfo?.services?.length) ? (
                  <div className="flex flex-wrap gap-2">
                    {(analysisOutput.businessInfo.mainServices || analysisOutput.businessInfo.services || []).map((service, i) => (
                      <Badge key={i} variant="outline">{service}</Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Tabbed Results - Enhanced */}
            <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 h-auto gap-2 bg-transparent p-0">
                <TabsTrigger value="overview" className="data-[state=active]:bg-genie-purple data-[state=active]:text-white py-2">
                  <Zap className="h-4 w-4 mr-1" />
                  Quick Wins
                </TabsTrigger>
                <TabsTrigger value="golden" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white py-2 bg-amber-500/10 text-amber-700">
                  <Crown className="h-4 w-4 mr-1" />
                  Golden
                </TabsTrigger>
                <TabsTrigger value="keywords" className="data-[state=active]:bg-genie-purple data-[state=active]:text-white py-2">
                  <Search className="h-4 w-4 mr-1" />
                  Keywords
                </TabsTrigger>
                <TabsTrigger value="blogs" className="data-[state=active]:bg-genie-purple data-[state=active]:text-white py-2">
                  <BookOpen className="h-4 w-4 mr-1" />
                  Blog Topics
                </TabsTrigger>
                <TabsTrigger value="serp" className="data-[state=active]:bg-genie-purple data-[state=active]:text-white py-2">
                  <Eye className="h-4 w-4 mr-1" />
                  SERP
                </TabsTrigger>
                <TabsTrigger value="strategy" className="data-[state=active]:bg-genie-purple data-[state=active]:text-white py-2">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Strategy
                </TabsTrigger>
                {generatedContent && (
                  <TabsTrigger value="content" className="data-[state=active]:bg-green-600 data-[state=active]:text-white py-2 bg-green-500/20 text-green-700">
                    <FileText className="h-4 w-4 mr-1" />
                    Content
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Quick Wins Tab */}
              <TabsContent value="overview" className="mt-6 space-y-6">
                <Card className="glass-card border-green-500/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-green-600">
                          <Zap className="h-5 w-5" />
                          Quick Wins - Easiest Keywords to Rank For
                        </CardTitle>
                        <CardDescription>
                          Low difficulty (≤30 KD), high volume. Select to include in your strategy.
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllQuickWins}>
                        Select All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(analysisOutput.keywords?.quickWins?.length || 0) > 0 ? (
                        analysisOutput.keywords.quickWins!.map((kw, i) => (
                          <div 
                            key={i} 
                            className={`p-4 rounded-lg border flex items-center gap-4 cursor-pointer transition-all ${
                              selectedKeywords.has(kw.keyword) 
                                ? 'bg-green-500/20 border-green-500/50' 
                                : 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                            }`}
                            onClick={() => toggleKeyword(kw.keyword)}
                          >
                            <Checkbox 
                              checked={selectedKeywords.has(kw.keyword)}
                              onCheckedChange={() => toggleKeyword(kw.keyword)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-green-700 dark:text-green-400">{kw.keyword}</p>
                                {kw.intent && <Badge variant="outline" className="text-xs">{kw.intent}</Badge>}
                              </div>
                              <div className="flex gap-4 text-xs mt-1 flex-wrap">
                                <span>Volume: <strong>{formatNumber(kw.volume)}</strong>/mo</span>
                                <span className={getDifficultyColor(kw.difficulty)}>
                                  KD: {kw.difficulty} ({getDifficultyLabel(kw.difficulty)})
                                </span>
                                {kw.cpc ? <span>CPC: ${kw.cpc.toFixed(2)}</span> : null}
                                {kw.timeToRank && (
                                  <Badge variant="outline" className="text-xs bg-green-500/10">
                                    {kw.timeToRank}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CopyButton text={kw.keyword} field={`qw-${i}`} />
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No quick win keywords found. Check the Golden Keywords tab.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Questions with Featured Snippet Badges */}
                {(analysisOutput.keywords?.questions?.length || 0) > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MessageCircleQuestion className="h-5 w-5 text-genie-purple" />
                            Questions People Ask
                          </CardTitle>
                          <CardDescription>Select questions for FAQ content. ⭐ = Featured snippet opportunity</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={selectAllQuestions}>
                          Select All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisOutput.keywords.questions!.map((q, i) => (
                          <div 
                            key={i} 
                            className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${
                              selectedQuestions.has(i)
                                ? 'bg-genie-purple/20 border border-genie-purple/50'
                                : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                            onClick={() => toggleQuestion(i)}
                          >
                            <Checkbox 
                              checked={selectedQuestions.has(i)}
                              onCheckedChange={() => toggleQuestion(i)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm">{q.question}</p>
                                {q.featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatNumber(q.volume)}/mo</span>
                            </div>
                            <CopyButton text={q.question} field={`q-${i}`} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Golden Keywords Tab - NEW */}
              <TabsContent value="golden" className="mt-6 space-y-6">
                <Card className="glass-card border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600">
                      <Crown className="h-5 w-5" />
                      Golden Keywords - High Value Opportunities
                    </CardTitle>
                    <CardDescription>
                      Commercial/transactional intent with rankable difficulty (20-45 KD). These drive revenue.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(analysisOutput.keywords?.goldenKeywords?.length || 0) > 0 ? (
                        analysisOutput.keywords.goldenKeywords!.map((kw, i) => (
                          <div 
                            key={i} 
                            className={`p-4 rounded-lg border flex items-center gap-4 cursor-pointer transition-all ${
                              selectedKeywords.has(kw.keyword) 
                                ? 'bg-amber-500/20 border-amber-500/50' 
                                : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                            }`}
                            onClick={() => toggleKeyword(kw.keyword)}
                          >
                            <Checkbox 
                              checked={selectedKeywords.has(kw.keyword)}
                              onCheckedChange={() => toggleKeyword(kw.keyword)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-amber-700 dark:text-amber-400">{kw.keyword}</p>
                                <Badge className="bg-amber-500/20 text-amber-600 text-xs">
                                  {kw.intent}
                                </Badge>
                                {(kw.score || 0) >= 80 && <Award className="h-4 w-4 text-amber-500" />}
                              </div>
                              <div className="flex gap-4 text-xs mt-1 flex-wrap">
                                <span>Volume: <strong>{formatNumber(kw.volume)}</strong>/mo</span>
                                <span className={getDifficultyColor(kw.difficulty)}>KD: {kw.difficulty}</span>
                                {kw.cpc ? <span className="text-green-600">CPC: ${kw.cpc.toFixed(2)}</span> : null}
                                <span>Score: <strong>{kw.score}</strong></span>
                              </div>
                            </div>
                            <CopyButton text={kw.keyword} field={`gold-${i}`} />
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No golden keywords found. Try analyzing a different domain.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Keyword Gaps */}
                {(analysisOutput.keywords?.keywordGaps?.length || 0) > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-genie-purple" />
                        Keyword Gaps - Competitor Opportunities
                      </CardTitle>
                      <CardDescription>Keywords your competitors rank for that you don't</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisOutput.keywords.keywordGaps!.map((gap, i) => (
                          <div 
                            key={i} 
                            className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${
                              selectedKeywords.has(gap.keyword)
                                ? 'bg-genie-purple/20 border border-genie-purple/50'
                                : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                            onClick={() => toggleKeyword(gap.keyword)}
                          >
                            <Checkbox 
                              checked={selectedKeywords.has(gap.keyword)}
                              onCheckedChange={() => toggleKeyword(gap.keyword)}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{gap.keyword}</p>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <span>Vol: {formatNumber(gap.volume)}</span>
                                <span className={getDifficultyColor(gap.difficulty)}>KD: {gap.difficulty}</span>
                                {gap.competitorDomain && <span className="text-red-500">→ {gap.competitorDomain}</span>}
                              </div>
                            </div>
                            <CopyButton text={gap.keyword} field={`gap-${i}`} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Keywords Tab */}
              <TabsContent value="keywords" className="mt-6 space-y-6">
                {/* Existing Rankings */}
                {(analysisOutput.keywords?.existingRankings?.length || 0) > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-genie-purple" />
                        Current Rankings
                      </CardTitle>
                      <CardDescription>Your top organic keyword positions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisOutput.keywords.existingRankings!.slice(0, 10).map((kw, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                kw.position <= 3 ? 'bg-green-500 text-white' : 
                                kw.position <= 10 ? 'bg-yellow-500 text-black' : 'bg-muted text-foreground'
                              }`}>
                                {kw.position}
                              </div>
                              <div>
                                <p className="font-medium">{kw.keyword}</p>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span>Vol: {formatNumber(kw.volume)}</span>
                                  <span className={getDifficultyColor(kw.difficulty)}>KD: {kw.difficulty}</span>
                                </div>
                              </div>
                            </div>
                            <CopyButton text={kw.keyword} field={`rank-${i}`} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* High Opportunity */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-genie-purple" />
                      High-Opportunity Keywords
                    </CardTitle>
                    <CardDescription>Sorted by opportunity score (volume × ease of ranking)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(analysisOutput.keywords?.highOpportunity?.length || 0) > 0 ? (
                        analysisOutput.keywords.highOpportunity!.map((kw, i) => (
                          <div 
                            key={i} 
                            className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${
                              selectedKeywords.has(kw.keyword)
                                ? 'bg-genie-purple/20 border border-genie-purple/50'
                                : 'bg-muted/50 hover:bg-muted/70'
                            }`}
                            onClick={() => toggleKeyword(kw.keyword)}
                          >
                            <Checkbox 
                              checked={selectedKeywords.has(kw.keyword)}
                              onCheckedChange={() => toggleKeyword(kw.keyword)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{kw.keyword}</p>
                                {kw.intent && <Badge variant="outline" className="text-xs">{kw.intent}</Badge>}
                              </div>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <span>Vol: {formatNumber(kw.volume)}</span>
                                <span className={getDifficultyColor(kw.difficulty)}>KD: {kw.difficulty}</span>
                                {kw.cpc ? <span>CPC: ${kw.cpc.toFixed(2)}</span> : null}
                              </div>
                            </div>
                            <CopyButton text={kw.keyword} field={`ho-${i}`} />
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No high-opportunity keywords found.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Long-tail */}
                {(analysisOutput.keywords?.longTail?.length || 0) > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Long-Tail Keywords</CardTitle>
                      <CardDescription>Specific phrases with lower competition</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisOutput.keywords.longTail!.map((kw, i) => (
                          <div 
                            key={i} 
                            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${
                              selectedKeywords.has(kw.keyword)
                                ? 'bg-genie-purple/20 border border-genie-purple/50'
                                : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                            onClick={() => toggleKeyword(kw.keyword)}
                          >
                            <Checkbox 
                              checked={selectedKeywords.has(kw.keyword)}
                              onCheckedChange={() => toggleKeyword(kw.keyword)}
                            />
                            <div className="flex-1">
                              <p className="text-sm">{kw.keyword}</p>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <span>Vol: {formatNumber(kw.volume)}</span>
                                <span className={getDifficultyColor(kw.difficulty)}>KD: {kw.difficulty}</span>
                              </div>
                            </div>
                            <CopyButton text={kw.keyword} field={`lt-${i}`} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Blog Topics Tab */}
              <TabsContent value="blogs" className="mt-6">
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-genie-purple" />
                          Blog Topics to Write
                        </CardTitle>
                        <CardDescription>
                          Select topics and we'll write complete, SEO-optimized blog posts (1,500+ words).
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllBlogTopics}>
                        Select All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(analysisOutput.blogTopics?.length || 0) > 0 ? (
                        analysisOutput.blogTopics!.map((topic, i) => (
                          <div 
                            key={i} 
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              selectedBlogTopics.has(i)
                                ? 'bg-genie-purple/20 border-genie-purple/50'
                                : 'bg-muted/50 border-border hover:bg-muted/70'
                            }`}
                            onClick={() => toggleBlogTopic(i)}
                          >
                            <div className="flex items-start gap-4">
                              <Checkbox 
                                checked={selectedBlogTopics.has(i)}
                                onCheckedChange={() => toggleBlogTopic(i)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-lg">{topic.title}</h4>
                                  {topic.featuredSnippetOpportunity && (
                                    <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">
                                      <Star className="h-3 w-3 mr-1" /> Snippet Opportunity
                                    </Badge>
                                  )}
                                  {topic.contentType && (
                                    <Badge variant="outline" className="text-xs capitalize">{topic.contentType}</Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                                  <span>Target: <strong className="text-foreground">{topic.targetKeyword}</strong></span>
                                  <span>Vol: <strong>{formatNumber(topic.searchVolume)}</strong>/mo</span>
                                  <span className={getDifficultyColor(topic.difficulty)}>KD: {topic.difficulty}</span>
                                  <span>Est. Traffic: {topic.estimatedTraffic}</span>
                                </div>
                                {topic.outline?.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs text-muted-foreground mb-1">Article outline:</p>
                                    <ul className="text-sm space-y-1">
                                      {topic.outline.map((item, j) => (
                                        <li key={j} className="flex items-start gap-2">
                                          <span className="text-genie-purple">H2</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              <CopyButton text={topic.title} field={`blog-${i}`} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No blog topics generated.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SERP Features Tab - NEW */}
              <TabsContent value="serp" className="mt-6 space-y-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-genie-purple" />
                      SERP Feature Opportunities
                    </CardTitle>
                    <CardDescription>Ways to capture more visibility in search results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(analysisOutput.serpFeatures?.length || 0) > 0 ? (
                        analysisOutput.serpFeatures!.map((feature, i) => (
                          <div key={i} className={`p-4 rounded-lg border ${feature.present ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30 border-border'}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${feature.present ? 'bg-green-500/20' : 'bg-muted'}`}>
                                {feature.type === 'Featured Snippet' && <Star className="h-5 w-5" />}
                                {feature.type === 'People Also Ask' && <MessageCircleQuestion className="h-5 w-5" />}
                                {feature.type === 'Local Pack' && <Globe className="h-5 w-5" />}
                                {feature.type === 'Image Pack' && <Layers className="h-5 w-5" />}
                                {feature.type === 'Video Carousel' && <FileText className="h-5 w-5" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{feature.type}</h4>
                                  {feature.present && <Badge className="bg-green-500/20 text-green-600 text-xs">Opportunity Detected</Badge>}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{feature.opportunity}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No SERP features analyzed yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Meta Tags */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5 text-genie-purple" />
                      Meta Tags to Generate
                    </CardTitle>
                    <CardDescription>Select pages to generate optimized meta tags</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Homepage */}
                    <div 
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedMetaPages.has('homepage')
                          ? 'bg-genie-purple/20 border border-genie-purple/50'
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => toggleMetaPage('homepage')}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={selectedMetaPages.has('homepage')}
                          onCheckedChange={() => toggleMetaPage('homepage')}
                        />
                        <h4 className="font-semibold">Homepage</h4>
                      </div>
                      {analysisOutput.metaTags?.homepage && (
                        <div className="ml-7 mt-3 space-y-2">
                          <div className="p-3 rounded-lg bg-background/50">
                            <p className="text-xs text-muted-foreground mb-1">Title ({analysisOutput.metaTags.homepage.title.length}/60)</p>
                            <p className="font-medium text-sm">{analysisOutput.metaTags.homepage.title}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background/50">
                            <p className="text-xs text-muted-foreground mb-1">Description ({analysisOutput.metaTags.homepage.description.length}/160)</p>
                            <p className="text-sm">{analysisOutput.metaTags.homepage.description}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Service Pages */}
                    {(analysisOutput.metaTags?.services?.length || 0) > 0 && (
                      <>
                        <h4 className="font-semibold mt-4">Service Pages</h4>
                        {analysisOutput.metaTags.services!.map((service, i) => (
                          <div 
                            key={i} 
                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                              selectedMetaPages.has(`service-${i}`)
                                ? 'bg-genie-purple/20 border border-genie-purple/50'
                                : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                            }`}
                            onClick={() => toggleMetaPage(`service-${i}`)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selectedMetaPages.has(`service-${i}`)}
                                onCheckedChange={() => toggleMetaPage(`service-${i}`)}
                              />
                              <div className="flex-1">
                                {service.page && <p className="text-xs text-muted-foreground">{service.page}</p>}
                                <p className="font-medium text-sm">{service.title}</p>
                                <p className="text-sm text-muted-foreground">{service.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Strategy Tab */}
              <TabsContent value="strategy" className="mt-6 space-y-6">
                {/* Content Calendar */}
                {(analysisOutput.contentCalendar?.length || 0) > 0 && (
                  <Card className="glass-card border-genie-purple/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-genie-purple" />
                        3-Month Content Calendar
                      </CardTitle>
                      <CardDescription>Recommended publishing schedule</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        {analysisOutput.contentCalendar!.map((month, i) => (
                          <div key={i} className="p-4 rounded-lg bg-muted/50 border">
                            <h4 className="font-semibold text-genie-purple">{month.month}</h4>
                            <p className="text-xs text-muted-foreground mb-3">Focus: {month.focus}</p>
                            <ul className="space-y-2">
                              {month.topics.map((topic, j) => (
                                <li key={j} className="text-sm flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  {topic}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-genie-purple" />
                      Strategic Recommendations
                    </CardTitle>
                    <CardDescription>Prioritized action items for SEO improvement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(analysisOutput.recommendations?.length || 0) > 0 ? (
                        analysisOutput.recommendations!.map((rec, i) => (
                          <div key={i} className={`p-4 rounded-lg border ${
                            rec.priority === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                            rec.priority === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                            rec.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                            'bg-muted/50 border-border'
                          }`}>
                            <div className="flex items-start gap-3">
                              <Badge className={getPriorityColor(rec.priority)}>
                                {rec.priority}
                              </Badge>
                              {rec.category && (
                                <Badge variant="outline" className="text-xs capitalize">{rec.category}</Badge>
                              )}
                              <div className="flex-1">
                                <p className="font-medium">{rec.action}</p>
                                <p className="text-sm text-muted-foreground mt-1">{rec.impact}</p>
                                <p className="text-xs text-muted-foreground mt-1">Timeline: {rec.timeframe}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No recommendations generated.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Content Gaps */}
                {(analysisOutput.contentGaps?.length || 0) > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Content Gaps
                      </CardTitle>
                      <CardDescription>Topics your competitors cover that you don't</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisOutput.contentGaps!.map((gap, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              {gap.priority && (
                                <Badge className={gap.priority === 'high' ? 'bg-red-500/20 text-red-600' : 'bg-yellow-500/20 text-yellow-600'}>
                                  {gap.priority}
                                </Badge>
                              )}
                              <div>
                                <p className="font-medium">{gap.topic}</p>
                                <p className="text-xs text-muted-foreground">
                                  {gap.competitorsCovering} competitors • {gap.opportunity}
                                </p>
                              </div>
                            </div>
                            <CopyButton text={gap.topic} field={`cgap-${i}`} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Competitors */}
                {(analysisOutput.competitors?.length || 0) > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Top Competitors</CardTitle>
                      <CardDescription>Your main organic search competitors</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisOutput.competitors!.map((comp, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-genie-purple/20 flex items-center justify-center text-sm font-bold">
                                {i + 1}
                              </div>
                              <div>
                                <p className="font-medium flex items-center gap-1">
                                  {comp.domain}
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </p>
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                  <span>Traffic: {formatNumber(comp.traffic)}/mo</span>
                                  <span>Keywords: {formatNumber(comp.keywords)}</span>
                                  {comp.commonKeywords && <span>Common: {comp.commonKeywords}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Generated Content Tab */}
              {generatedContent && (
                <TabsContent value="content" className="mt-6 space-y-6">
                  <div className="flex justify-end">
                    <Button onClick={downloadContent} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download All Content
                    </Button>
                  </div>

                  {/* Blog Posts with Content Scores */}
                  {generatedContent.blogPosts.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-green-500" />
                          Generated Blog Posts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {generatedContent.blogPosts.map((post, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h4 className="font-semibold text-lg">{post.title}</h4>
                                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                  <span>Target: {post.targetKeyword}</span>
                                  <span>{post.wordCount} words</span>
                                </div>
                              </div>
                              <CopyButton text={post.fullContent} field={`post-${i}`} />
                            </div>

                            {/* Content Score Card */}
                            {post.contentScore && (
                              <div className="mb-4 p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-4 mb-2">
                                  <span className="font-medium">Content Score:</span>
                                  <span className={`text-2xl font-bold ${getScoreColor(post.contentScore.overall)}`}>
                                    {post.contentScore.overall}/100
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <p className="text-muted-foreground">Keyword Density</p>
                                    <p className="font-medium">{post.contentScore.keywordDensity}/100</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Readability</p>
                                    <p className="font-medium">{post.contentScore.readability}/100</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Word Count</p>
                                    <p className="font-medium">{post.contentScore.wordCount}/100</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Structure</p>
                                    <p className="font-medium">{post.contentScore.headingStructure}/100</p>
                                  </div>
                                </div>
                                {post.contentScore.suggestions.length > 0 && (
                                  <div className="mt-2 pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">Suggestions:</p>
                                    <ul className="text-xs space-y-1">
                                      {post.contentScore.suggestions.map((s, j) => (
                                        <li key={j} className="flex items-start gap-1">
                                          <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5" />
                                          {s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Expand/Regenerate Section */}
                            <div className="mb-4 p-4 rounded-lg bg-muted/30 border border-dashed">
                              <div className="flex items-center gap-2 mb-3">
                                <Wand2 className="h-4 w-4 text-genie-purple" />
                                <span className="font-medium text-sm">Expand Blog Post</span>
                              </div>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex-1 w-full">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                    <span>Target Word Count</span>
                                    <span className="font-medium text-foreground">
                                      {targetWordCounts[i] || Math.max(3000, post.wordCount + 500)} words
                                    </span>
                                  </div>
                                  <Slider
                                    value={[targetWordCounts[i] || Math.max(3000, post.wordCount + 500)]}
                                    onValueChange={(value) => setTargetWordCounts(prev => ({ ...prev, [i]: value[0] }))}
                                    min={post.wordCount + 500}
                                    max={6000}
                                    step={100}
                                    className="w-full"
                                  />
                                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>{post.wordCount + 500}</span>
                                    <span>6,000</span>
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleExpandBlog(i)}
                                  disabled={expandingBlogIndex === i}
                                  className="bg-gradient-to-r from-genie-purple to-genie-gold hover:opacity-90 whitespace-nowrap"
                                >
                                  {expandingBlogIndex === i ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Expanding...
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="h-4 w-4 mr-2" />
                                      Regenerate & Expand
                                    </>
                                  )}
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Currently {post.wordCount} words. Expand to add more depth, examples, and expert insights.
                              </p>
                            </div>

                            {/* AI Detection Section */}
                            <div className="mb-4 p-4 rounded-lg bg-muted/30 border border-dashed">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-genie-purple" />
                                  <span className="font-medium text-sm">AI Detection Analysis</span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAnalyzeDetection(i)}
                                  disabled={analyzingDetectionIndex === i}
                                >
                                  {analyzingDetectionIndex === i ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Analyzing...
                                    </>
                                  ) : (
                                    <>
                                      <Search className="h-3 w-3 mr-1" />
                                      Analyze
                                    </>
                                  )}
                                </Button>
                              </div>

                              {post.aiDetection ? (
                                <div className="space-y-4">
                                  {/* Detection Score */}
                                  <div className="flex items-center gap-4">
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                                      post.aiDetection.risk === 'low' 
                                        ? 'bg-green-500/20 text-green-600' 
                                        : post.aiDetection.risk === 'medium'
                                        ? 'bg-yellow-500/20 text-yellow-600'
                                        : 'bg-red-500/20 text-red-600'
                                    }`}>
                                      {post.aiDetection.risk === 'low' ? (
                                        <ShieldCheck className="h-5 w-5" />
                                      ) : post.aiDetection.risk === 'medium' ? (
                                        <Shield className="h-5 w-5" />
                                      ) : (
                                        <ShieldAlert className="h-5 w-5" />
                                      )}
                                      <span className="text-2xl font-bold">{post.aiDetection.score}</span>
                                      <span className="text-sm">/100</span>
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-medium capitalize">{post.aiDetection.risk} Risk</p>
                                      <p className="text-xs text-muted-foreground">
                                        {post.aiDetection.risk === 'low' 
                                          ? 'Content appears human-written and should pass detection tools'
                                          : post.aiDetection.risk === 'medium'
                                          ? 'Some AI patterns detected - consider humanizing'
                                          : 'High AI signature detected - humanization recommended'
                                        }
                                      </p>
                                    </div>
                                    {post.aiDetection.risk !== 'low' && (
                                      <Button
                                        onClick={() => handleHumanize(i)}
                                        disabled={humanizingIndex === i}
                                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90"
                                      >
                                        {humanizingIndex === i ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Humanizing...
                                          </>
                                        ) : (
                                          <>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Humanize Content
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>

                                  {/* Flagged Sections */}
                                  {post.aiDetection.flaggedSections.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground">Flagged Patterns:</p>
                                      <div className="max-h-32 overflow-y-auto space-y-2">
                                        {post.aiDetection.flaggedSections.map((section, j) => (
                                          <div 
                                            key={j} 
                                            className={`p-2 rounded text-xs border-l-2 ${
                                              section.severity === 'high'
                                                ? 'bg-red-500/10 border-red-500'
                                                : section.severity === 'medium'
                                                ? 'bg-yellow-500/10 border-yellow-500'
                                                : 'bg-muted/50 border-muted-foreground/30'
                                            }`}
                                          >
                                            <p className="text-muted-foreground italic">"{section.text}"</p>
                                            <p className={`font-medium mt-1 ${
                                              section.severity === 'high'
                                                ? 'text-red-600'
                                                : section.severity === 'medium'
                                                ? 'text-yellow-600'
                                                : 'text-muted-foreground'
                                            }`}>
                                              {section.reason}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Suggestions */}
                                  {post.aiDetection.suggestions.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground">Manual Edit Suggestions:</p>
                                      <ul className="space-y-1">
                                        {post.aiDetection.suggestions.map((suggestion, j) => (
                                          <li key={j} className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-3 w-3 text-genie-purple mt-0.5 shrink-0" />
                                            <span>{suggestion}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  Click "Analyze" to check for AI-detectable patterns and get improvement suggestions.
                                </p>
                              )}
                            </div>

                            <div className="max-h-96 overflow-y-auto rounded-lg border">
                              <div className="bg-white text-black p-6 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                                {cleanContentForCopy(post.fullContent)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Meta Tags with Character Counts */}
                  {generatedContent.metaTags.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Tag className="h-5 w-5 text-green-500" />
                          Generated Meta Tags
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {generatedContent.metaTags.map((meta, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-3">{meta.page}</h4>
                            <div className="space-y-3">
                              <div className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-muted-foreground">
                                    Title ({meta.charCount?.title || meta.title.length}/60)
                                  </p>
                                  <CopyButton text={meta.title} field={`meta-title-${i}`} />
                                </div>
                                <p className="font-medium">{meta.title}</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-muted-foreground">
                                    Description ({meta.charCount?.description || meta.description.length}/160)
                                  </p>
                                  <CopyButton text={meta.description} field={`meta-desc-${i}`} />
                                </div>
                                <p className="text-sm">{meta.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* FAQ Content */}
                  {generatedContent.faqContent.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageCircleQuestion className="h-5 w-5 text-green-500" />
                          Generated FAQ Content
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {generatedContent.faqContent.map((faq, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <h4 className="font-semibold">{faq.question}</h4>
                              <CopyButton text={`${faq.question}\n\n${faq.answer}`} field={`faq-${i}`} />
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{faq.answer}</p>
                            {faq.wordCount && (
                              <p className="text-xs text-muted-foreground mt-2">{faq.wordCount} words</p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Schema Markup */}
                  {generatedContent.schemaMarkup && generatedContent.schemaMarkup.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-green-500" />
                          Generated Schema Markup
                        </CardTitle>
                        <CardDescription>Add this to your page's {"<head>"} for rich snippets</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {generatedContent.schemaMarkup.map((schema, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold">{schema.type} Schema</h4>
                              <CopyButton text={`<script type="application/ld+json">\n${schema.markup}\n</script>`} field={`schema-${i}`} />
                            </div>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48">
                              {schema.markup}
                            </pre>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {!analysisOutput && !isLoading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-genie-purple/20 to-genie-gold/20 flex items-center justify-center mx-auto mb-6">
              <Crown className="h-10 w-10 text-genie-purple" />
            </div>
            <h3 className="text-xl font-semibold mb-2">World-Class SEO Content Generation</h3>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Enter a domain above to analyze with Semrush data. We'll find quick wins, golden keywords, 
              SERP opportunities, and generate complete, optimized content for you.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Badge variant="outline"><Zap className="h-3 w-3 mr-1" /> Quick Win Keywords</Badge>
              <Badge variant="outline"><Crown className="h-3 w-3 mr-1" /> Golden Keywords</Badge>
              <Badge variant="outline"><Eye className="h-3 w-3 mr-1" /> SERP Features</Badge>
              <Badge variant="outline"><BookOpen className="h-3 w-3 mr-1" /> Full Blog Posts</Badge>
              <Badge variant="outline"><Star className="h-3 w-3 mr-1" /> Content Scoring</Badge>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SeoWriter;

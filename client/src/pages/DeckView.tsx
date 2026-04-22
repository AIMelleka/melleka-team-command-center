import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DeckEditProvider, useDeckEdit } from '@/components/deck/DeckEditContext';
import { InlineEdit, SectionToggle } from '@/components/deck/InlineEdit';
import { EditableImage } from '@/components/deck/EditableImage';
import { ResizableImage } from '@/components/deck/ResizableImage';
import { CustomSectionsRenderer } from '@/components/deck/CustomSectionsRenderer';
import { AddSectionModal } from '@/components/deck/AddSectionModal';
import { DiffPanel } from '@/components/deck/DiffPanel';
import { 
  Home, 
  BarChart3, 
  Search, 
  Megaphone, 
  MessageSquare, 
  Mail, 
  Zap, 
  CheckCircle, 
  Target,
  X,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Users,
  MousePointer,
  Eye,
  Phone,
  FileText,
  CreditCard,
  Star,
  CalendarCheck,
  Sparkles,
  Globe,
  PenTool,
  Settings,
  LayoutDashboard,
  Instagram,
  Camera,
  Upload,
  Loader2,
  Image as ImageIcon,
  Palette,
  BookOpen,
  LineChart,
  Trash2,
  Share2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Pencil,
  CheckCheck,
  SendHorizonal,
  Plus,
  CalendarDays,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AccountMappingModal from '@/components/AccountMappingModal';
import { AnimatedSection } from '@/components/AnimatedSection';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { CroppedScreenshotGallery } from '@/components/CroppedScreenshotGallery';
import { SeoPageScreenshots } from '@/components/SeoPageScreenshots';
import { 
  DeckHero,
  DeckExecutiveSummary,
  DeckMetricCard,
  DeckPlatformSection,
  DeckRecommendationCard,
  DeckPerformanceGrade,
  DeckSectionHeader,
  DeckFooter,
  DeckComparisonChart,
  DeckTrendChart,
  EnhancedPlatformSection,
  DeckSocialMediaSection,
} from '@/components/deck';
import type { EnhancedPlatformData } from '@/components/deck';
import { 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

interface CropRegion {
  description: string;
  importance: 'high' | 'medium' | 'low';
  bounds?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  type?: 'kpi_card' | 'chart' | 'table' | 'metric' | 'trend' | 'other';
}

interface DeckData {
  id: string;
  slug: string;
  client_name: string;
  date_range_start: string;
  date_range_end: string;
  content: {
    hero?: {
      totalSpend?: number;
      totalLeads?: number;
      roas?: number;
      totalImpressions?: number;
      totalClicks?: number;
      avgCTR?: number;
      avgCPC?: number;
      overviewScreenshot?: string;
      executiveSummary?: string;
      keyFindings?: string[];
      newContacts?: number;
      pipelineValue?: number;
    };
    adOverview?: {
      screenshot?: string;
      screenshots?: string[];
      metrics?: Record<string, any>;
    };
    googleAds?: {
      screenshot?: string;
      screenshots?: string[];
      spend?: number;
      impressions?: number;
      clicks?: number;
      conversions?: number;
      ctr?: number;
      cpc?: number;
      roas?: number;
      insights?: string[];
      cropRegions?: CropRegion[];
    };
    metaAds?: {
      screenshot?: string;
      screenshots?: string[];
      spend?: number;
      impressions?: number;
      clicks?: number;
      conversions?: number;
      ctr?: number;
      cpm?: number;
      frequency?: number;
      insights?: string[];
      cropRegions?: CropRegion[];
    };
    sms?: {
      messagesSent?: number;
      delivered?: number;
      deliveryRate?: number;
      responses?: number;
      responseRate?: number;
      highlights?: string[];
      screenshot?: string;
    };
    email?: {
      sent?: number;
      opened?: number;
      clicked?: number;
      openRate?: number;
      clickRate?: number;
      campaigns?: { name: string; opens: number; clicks: number }[];
    };
    workflows?: {
      activeCount?: number;
      newAutomations?: string[];
      executed?: number;
      totalExecuted?: number;
      workflows?: { name: string; status: string; enrolledCount?: number }[];
    };
    appointments?: {
      total?: number;
      booked?: number;
      confirmed?: number;
      showed?: number;
      noShow?: number;
      cancelled?: number;
      showRate?: number;
      upcoming?: { title: string; date: string; status: string; contactName?: string }[];
    };
    calls?: {
      total?: number;
      inbound?: number;
      outbound?: number;
      answered?: number;
      missed?: number;
      avgDuration?: number;
      answerRate?: number;
    };
    forms?: {
      total?: number;
      submissions?: number;
      conversionRate?: number;
      forms?: { name: string; submissions: number; views?: number }[];
    };
    payments?: {
      totalRevenue?: number;
      transactionCount?: number;
      avgTransactionValue?: number;
      successfulPayments?: number;
      failedPayments?: number;
      refunds?: number;
      refundAmount?: number;
    };
    reviews?: {
      total?: number;
      averageRating?: number;
      byRating?: Record<string, number>;
      newThisPeriod?: number;
      recentReviews?: { rating: number; content: string; date: string; source?: string }[];
    };
    services?: {
      tasks?: { category: string; items: string[] }[];
    };
    nextSteps?: {
      recommendations?: { title: string; priority: 'high' | 'medium' | 'low'; description?: string; impact?: string }[];
      focusAreas?: string[];
    };
    adPlatforms?: Array<{
      key: string;
      label: string;
      accountName?: string;
      platformKey: string;
      icon: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      cpa: number;
      cpm: number;
      conversionRate?: number;
      grade?: string;
      topContent?: Array<{ adName: string; campaignName: string; imageUrl: string; impressions: number; clicks: number; cost: number; conversions: number; ctr: number; cpc: number; cpa: number }>;
      campaigns?: Array<{ name: string; spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; cpa: number }>;
      dailyData?: Array<{ date: string; label: string; spend: number; clicks: number; impressions: number; conversions: number }>;
      keywords?: Array<{ keyword: string; campaignName: string; impressions: number; clicks: number; cost: number; conversions: number; ctr: number; cpc: number; cpa: number }>;
      gameplan?: { summary: string; budgetRecommendation: string; abTests: string[]; nextSteps: string[]; keyInsight: string };
      changes?: Record<string, number | null>;
    }>;
    pageScreenshots?: Array<{ hint: string; url: string; screenshot: string | null; title: string }>;
    socialMediaPosts?: Array<{ platform: string; handle?: string; postDate?: string; contentType?: string; caption?: string; imageUrl?: string; thumbnailUrl?: string; likes: number; comments: number; shares: number; saves: number; reach: number; impressions: number; engagementRate: number; videoViews: number; postUrl?: string }>;
    campaignAssets?: {
      emailResults?: string[];
      emailDesigns?: string[];
      smsResults?: string[];
      smsCampaign?: string[];
      adCreativeApprovals?: string[];
      nextEmailCampaign?: string[];
      nextSmsCampaign?: string[];
      blogPosts?: string[];
      websiteEditsScreenshots?: string[];
      analyticsScreenshots?: string[];
      otherScreenshots?: string[];
      socialMedia?: string[];
    };
    nextEmailDetails?: {
      subjectLines?: string[];
      previewTexts?: string[];
    };
    assetCaptions?: Record<string, Record<number, string>>;
    categorizedTasks?: Record<string, string[]> | Array<{ category: string; items: string[] }>;
  };
  screenshots: string[];
  brand_colors: {
    primary?: string;
    secondary?: string;
    background?: string;
    textPrimary?: string;
    textSecondary?: string;
    logo?: string;
  };
  status: string;
  created_at: string;
}

// ─── Executive Summary Section (with addable/removable bullets) ───────────────
const ExecSummarySection = ({
  deck,
  keyWins: aiKeyWins,
  challenges: aiChallenges,
  brandPrimary,
}: {
  deck: DeckData;
  keyWins: string[];
  challenges: string[];
  brandPrimary: string;
}) => {
  const { isEditMode, overrides, updateOverride, removeOverride } = useDeckEdit();

  const buildLiveList = (prefix: string, aiBase: string[]): string[] => {
    const overrideKeys = Object.keys(overrides).filter(k => k.startsWith(`${prefix}.`));
    const maxIdx = Math.max(
      aiBase.length - 1,
      ...overrideKeys.map(k => parseInt(k.split('.').pop() || '0', 10))
    );
    if (maxIdx < 0) return [];
    return Array.from({ length: maxIdx + 1 }, (_, i) => {
      const key = `${prefix}.${i}`;
      return overrides[key] ?? aiBase[i] ?? null;
    }).filter((v): v is string => v !== null);
  };

  const handleAdd = async (prefix: string, currentList: string[]) => {
    await updateOverride(`${prefix}.${currentList.length}`, 'New item — click to edit');
  };

  const handleRemove = async (prefix: string, idx: number, currentList: string[]) => {
    const next = currentList.filter((_, i) => i !== idx);
    const keysToRemove = Object.keys(overrides).filter(k => k.startsWith(`${prefix}.`));
    for (const k of keysToRemove) await removeOverride(k);
    for (let i = 0; i < next.length; i++) await updateOverride(`${prefix}.${i}`, next[i]);
  };

  const liveKeyWins = buildLiveList('hero.keyWins', aiKeyWins);
  const liveChallenges = buildLiveList('hero.challenges', aiChallenges);

  if (!isEditMode) {
    return (
      <SectionToggle
        sectionId="executive-summary"
        label="Executive Summary"
        deckId={deck.id}
        assetKey="executive-summary"
        aiContext={deck.content.hero?.executiveSummary || ''}
      >
        <section className="py-8">
          <DeckExecutiveSummary
            summary={deck.content.hero?.executiveSummary || ''}
            keyWins={liveKeyWins}
            challenges={liveChallenges}
            brandColor={brandPrimary}
          />
        </section>
      </SectionToggle>
    );
  }

  return (
    <SectionToggle
      sectionId="executive-summary"
      label="Executive Summary"
      deckId={deck.id}
      assetKey="executive-summary"
      aiContext={deck.content.hero?.executiveSummary || ''}
    >
      <section className="py-8">
        <div className="deck-ref-card space-y-6">
          <h2 className="text-2xl font-bold text-[#1a1a1a]" style={{ fontFamily: "'Outfit', sans-serif" }}>Executive Summary</h2>
          <InlineEdit
            value={deck.content.hero?.executiveSummary || ''}
            editKey="hero.executiveSummary"
            as="p"
            multiline
            className="text-[#374151] leading-relaxed text-lg"
          />
          <div className="grid md:grid-cols-2 gap-5 pt-2">
            {/* Key Wins */}
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Key Wins</h3>
              </div>
              <ul className="space-y-2">
                {liveKeyWins.map((win, i) => (
                  <li key={i} className="flex items-start gap-2 group/bullet">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <InlineEdit
                      value={win}
                      editKey={`hero.keyWins.${i}`}
                      as="span"
                      className="text-[#374151] text-sm flex-1"
                    />
                    <button
                      onClick={() => handleRemove('hero.keyWins', i, liveKeyWins)}
                      className="ml-1 p-0.5 rounded text-red-400/50 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/bullet:opacity-100 transition-all flex-shrink-0"
                      title="Remove bullet"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleAdd('hero.keyWins', liveKeyWins)}
                className="flex items-center gap-1.5 text-xs text-emerald-600/70 hover:text-emerald-700 hover:bg-emerald-100 px-2 py-1.5 rounded-lg border border-emerald-200 hover:border-emerald-300 transition-all w-full justify-center"
              >
                <Plus className="w-3 h-3" />
                Add Key Win
              </button>
            </div>

            {/* Areas of Focus */}
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wider">Areas of Focus</h3>
              </div>
              <ul className="space-y-2">
                {liveChallenges.map((challenge, i) => (
                  <li key={i} className="flex items-start gap-2 group/bullet">
                    <Target className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <InlineEdit
                      value={challenge}
                      editKey={`hero.challenges.${i}`}
                      as="span"
                      className="text-[#374151] text-sm flex-1"
                    />
                    <button
                      onClick={() => handleRemove('hero.challenges', i, liveChallenges)}
                      className="ml-1 p-0.5 rounded text-red-400/50 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/bullet:opacity-100 transition-all flex-shrink-0"
                      title="Remove bullet"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleAdd('hero.challenges', liveChallenges)}
                className="flex items-center gap-1.5 text-xs text-amber-600/70 hover:text-amber-700 hover:bg-amber-100 px-2 py-1.5 rounded-lg border border-amber-200 hover:border-amber-300 transition-all w-full justify-center"
              >
                <Plus className="w-3 h-3" />
                Add Challenge
              </button>
            </div>
          </div>
        </div>
      </section>
    </SectionToggle>
  );
};

// ─── Section Notes (editable in Edit Mode, visible when content exists) ──────
const SectionNotes = ({ editKey, borderColor = 'border-[#e5e5e0]' }: { editKey: string; borderColor?: string }) => {
  const { isEditMode, overrides } = useDeckEdit();
  const noteValue = overrides[editKey] || '';
  if (!isEditMode && !noteValue.trim()) return null;
  return (
    <div className="deck-ref-card p-6 mt-6">
      <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Pencil className="h-3.5 w-3.5" />
        Additional Notes
      </h3>
      <InlineEdit
        value={noteValue}
        editKey={editKey}
        as="p"
        multiline
        className="text-[#374151] leading-relaxed"
      />
    </div>
  );
};

// Map task category names to icons
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'google': Search,
  'google ads': Search,
  'meta': Megaphone,
  'meta ads': Megaphone,
  'seo': Globe,
  'website': LayoutDashboard,
  'email': Mail,
  'email marketing': Mail,
  'sms': MessageSquare,
  'texting': MessageSquare,
  'crm': Settings,
  'crm / automations': Settings,
  'automations': Zap,
  'content': PenTool,
  'content / creative': PenTool,
  'reporting': BarChart3,
  'reporting / analytics': BarChart3,
  'social media': Megaphone,
};

const getCategoryIcon = (category: string): LucideIcon => {
  const lower = category.toLowerCase().trim();
  return CATEGORY_ICON_MAP[lower] || CheckCircle;
};

const getCategorySectionId = (category: string): string => {
  return 'task-' + category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
};

const BASE_NAV_ITEMS = [
  
  { id: 'ad-overview', label: 'Ad Overview', icon: BarChart3 },
  // google-ads and meta-ads are now dynamic via adPlatforms
  { id: 'ad-creatives-approval', label: 'Ad Creatives', icon: Palette },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'next-sms-campaign', label: 'Next SMS Campaign', icon: MessageSquare },
  { id: 'social-media', label: 'Social Media', icon: Instagram },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'next-email-campaign', label: 'Next Email', icon: Mail },
  { id: 'workflows', label: 'Workflows', icon: Zap },
  { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
  { id: 'calls', label: 'Calls', icon: Phone },
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'blog-seo', label: 'Blog & SEO', icon: BookOpen },
  { id: 'website-edits', label: 'Website Edits', icon: PenTool },
  { id: 'analytics-traffic', label: 'Analytics & Traffic', icon: LineChart },
  { id: 'other', label: 'Other', icon: FileText },
];

const PLATFORM_ICON_MAP: Record<string, LucideIcon> = {
  'search': Search,
  'megaphone': Megaphone,
  'video': Eye,
  'briefcase': FileText,
  'bar-chart': BarChart3,
};

// Helper to check if color is light
const isLightColor = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

// Helper to get luminance value (0-1) for contrast checking
const getLuminance = (color: string): number => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// Check if two colors have sufficient contrast (threshold: 0.3 luminance difference)
const hasEnoughContrast = (color1: string, color2: string): boolean => {
  return Math.abs(getLuminance(color1) - getLuminance(color2)) > 0.3;
};

// HARD RULE: Never show GHL metrics with 0 value
const isNonZero = (value: number | undefined | null): boolean => {
  return value !== undefined && value !== null && value > 0;
};

// Check if a section has any non-zero data
const hasNonZeroData = (data: Record<string, any> | undefined): boolean => {
  if (!data) return false;
  return Object.values(data).some(value => {
    if (typeof value === 'number') return value > 0;
    if (Array.isArray(value)) return value.length > 0;
    return false;
  });
};

// ─── Save Changes Button (reads dirty state from DeckEditContext) ────────────
const SaveChangesButton = ({ brandPrimary }: { brandPrimary: string }) => {
  const { isDirty, dirtyCount, isSaving, publishChanges, discardChanges, isEditMode, undo, redo, canUndo, canRedo } = useDeckEdit();

  if (!isEditMode && !isDirty) return null;

  return (
    <>
      {isEditMode && (
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border shadow-sm transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed bg-white border-[#e5e5e0] text-[#6b7280]"
            title="Undo (Ctrl+Z)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border shadow-sm transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed bg-white border-[#e5e5e0] text-[#6b7280]"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
            Redo
          </button>
        </div>
      )}
      {isDirty && (
        <button
          onClick={discardChanges}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border shadow-sm transition-all hover:scale-105 bg-white border-[#e5e5e0] text-[#6b7280]"
          title="Discard unsaved changes"
        >
          <X className="w-3.5 h-3.5" />
          Discard
        </button>
      )}
      <button
        onClick={publishChanges}
        disabled={isSaving || !isDirty}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border shadow-md transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed ${isDirty ? 'ring-2 ring-emerald-300' : ''}`}
        style={{
          backgroundColor: isDirty ? '#059669' : '#d1fae5',
          borderColor: isDirty ? '#059669' : '#a7f3d0',
          color: isDirty ? '#ffffff' : '#6b7280',
        }}
        title={isDirty ? `Save ${dirtyCount} pending change(s) to database` : 'No unsaved changes'}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <CheckCheck className="w-4 h-4" />
            {isDirty ? `Save Changes (${dirtyCount})` : 'All Saved'}
          </>
        )}
      </button>
    </>
  );
};

const DeckView = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Present mode: /deck/:slug/present or ?mode=present
  const isPresentMode = location.pathname.endsWith('/present') || new URLSearchParams(location.search).get('mode') === 'present';
  const isAdminMode = !isPresentMode;
  
  const [deck, setDeck] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('hero');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
  const [logoOverride, setLogoOverride] = useState<string | null>(null);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [lastDataRefresh, setLastDataRefresh] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<number | null>(null);
  const [regenMessage, setRegenMessage] = useState<string>('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState('');
  const [editingCaption, setEditingCaption] = useState<{ key: string; idx: number } | null>(null);
  const [showFloatingAddSection, setShowFloatingAddSection] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAccountMapping, setShowAccountMapping] = useState(false);
  const [smAccounts, setSmAccounts] = useState<Record<string, { id: string; name: string }[]>>({});
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);
  const [isApprovingDeck, setIsApprovingDeck] = useState(false);
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [colorDraft, setColorDraft] = useState<{ primary: string; secondary: string; background: string }>({ primary: '', secondary: '', background: '' });
  const [isSavingColors, setIsSavingColors] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [pendingAssetType, setPendingAssetType] = useState<string | null>(null);
  const [showDateEditor, setShowDateEditor] = useState(false);
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();
  
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const fetchDeck = async () => {
      if (!slug) return;

      try {
        // Fetch via public server endpoint — no auth required so anyone with the link can view
        const apiBase = import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api';
        const resp = await fetch(`${apiBase}/public/decks/${encodeURIComponent(slug)}`);
        if (!resp.ok) throw new Error(`Failed to load deck: ${resp.status}`);
        const { deck: data } = await resp.json();

        const deckData = {
          ...data,
          content: typeof data.content === 'string' ? JSON.parse(data.content) : data.content,
          brand_colors: typeof data.brand_colors === 'string' ? JSON.parse(data.brand_colors) : data.brand_colors,
          screenshots: Array.isArray(data.screenshots) ? data.screenshots : [],
        } as unknown as DeckData;

        console.log('Deck content:', deckData.content);
        setDeck(deckData);
        setDateStart(new Date(deckData.date_range_start + 'T00:00:00'));
        setDateEnd(new Date(deckData.date_range_end + 'T00:00:00'));
      } catch (err) {
        console.error('Error fetching deck:', err);
        navigateRef.current('/');
      } finally {
        setLoading(false);
      }
    };

    fetchDeck();
  }, [slug]); // intentionally omit navigate/toast — stable refs used instead

  // Build dynamic nav items from ad platforms — group by platform type (all Meta together, all Google together, etc.)
  const rawAdPlatforms = deck?.content?.adPlatforms || [];
  const platformSortOrder: Record<string, number> = { google_ads: 0, meta_ads: 1, tiktok_ads: 2, bing_ads: 3, linkedin_ads: 4 };
  const adPlatforms = [...rawAdPlatforms].sort((a, b) => {
    const aOrder = platformSortOrder[a.platformKey] ?? 99;
    const bOrder = platformSortOrder[b.platformKey] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.label || '').localeCompare(b.label || '');
  });
  const adPlatformNavItems = adPlatforms
    .filter(p => isEditMode || p.spend > 0 || p.clicks > 0)
    .map(p => ({
      id: `platform-${p.key}`,
      label: p.label,
      icon: PLATFORM_ICON_MAP[p.icon] || BarChart3,
    }));

  // Build dynamic nav items from task categories
  const categoryLabelMap: Record<string, string> = {
    googleAdsTasks: 'Google Ads Tasks',
    metaAdsTasks: 'Meta Ads Tasks',
    websiteTasks: 'Website Tasks',
    seoTasks: 'SEO Tasks',
    emailTasks: 'Email Marketing Tasks',
    smsTasks: 'SMS Tasks',
    crmTasks: 'CRM & Automations Tasks',
    socialMediaTasks: 'Social Media Tasks',
    otherTasks: 'Other Tasks',
    clientNeeds: 'Client Needs',
  };
  const rawCategorizedTasks = deck?.content?.categorizedTasks || deck?.content?.services?.tasks || (() => {
    // Fallback: keyword-based categorization from taskNotes if categorizedTasks is missing
    const notes = (deck?.content as any)?.taskNotes;
    if (!notes || typeof notes !== 'string') return undefined;
    const result: Record<string, string[]> = {
      googleAdsTasks: [], metaAdsTasks: [], seoTasks: [], websiteTasks: [],
      emailTasks: [], smsTasks: [], crmTasks: [], socialMediaTasks: [], otherTasks: [], clientNeeds: [],
    };
    const sectionPattern = /^(GOOGLE|META|FACEBOOK|WEBSITE|WEB|SEO|EMAIL|SMS|TEXT|CRM|AUTOMATION|AUTOMATIONS|SOCIAL|SOCIAL MEDIA|PMAX|SEARCH|BING|TIKTOK|BLOG)[^\n]*/gim;
    const sections: Array<{ header: string; startIdx: number }> = [];
    let m;
    while ((m = sectionPattern.exec(notes)) !== null) {
      sections.push({ header: m[0].trim().toUpperCase(), startIdx: m.index });
    }
    if (sections.length === 0) return undefined;
    for (let i = 0; i < sections.length; i++) {
      const start = sections[i].startIdx + sections[i].header.length;
      const end = i + 1 < sections.length ? sections[i + 1].startIdx : notes.length;
      const block = notes.slice(start, end);
      const lines = block.split('\n').map((l: string) => l.replace(/^[\s•\-\*]+/, '').trim()).filter((l: string) => l.length > 3);
      if (lines.length === 0) continue;
      const h = sections[i].header;
      if (/GOOGLE|PMAX|SEARCH|BING/.test(h)) result.googleAdsTasks.push(...lines);
      else if (/META|FACEBOOK/.test(h)) result.metaAdsTasks.push(...lines);
      else if (/SEO|BLOG/.test(h)) result.seoTasks.push(...lines);
      else if (/WEBSITE|WEB/.test(h)) result.websiteTasks.push(...lines);
      else if (/EMAIL/.test(h)) result.emailTasks.push(...lines);
      else if (/SMS|TEXT/.test(h)) result.smsTasks.push(...lines);
      else if (/CRM|AUTOMATION/.test(h)) result.crmTasks.push(...lines);
      else if (/SOCIAL/.test(h)) result.socialMediaTasks.push(...lines);
      else result.otherTasks.push(...lines);
    }
    return result;
  })();
  const taskCategories: Array<{ category: string; items: string[] }> = (() => {
    if (Array.isArray(rawCategorizedTasks)) return rawCategorizedTasks;
    if (rawCategorizedTasks && typeof rawCategorizedTasks === 'object') {
      return Object.entries(rawCategorizedTasks as Record<string, string[]>)
        .filter(([_, items]) => Array.isArray(items) && items.length > 0)
        .map(([key, items]) => ({ category: categoryLabelMap[key] || key, items }));
    }
    return [];
  })();

  // Map task category keys to platform section IDs for inline injection
  const taskKeyToPlatformMap: Record<string, string> = {
    googleAdsTasks: 'google-ads',
    metaAdsTasks: 'meta-ads',
    seoTasks: 'blog-seo',
    websiteTasks: 'blog-seo',
    emailTasks: 'email',
    smsTasks: 'sms',
    crmTasks: 'workflows',
    socialMediaTasks: 'social-media',
  };

  // Get tasks for a specific platform/section
  const getTasksForSection = (sectionKey: string): string[] => {
    if (!rawCategorizedTasks || typeof rawCategorizedTasks !== 'object') return [];
    const tasks = rawCategorizedTasks as Record<string, string[]>;
    const result: string[] = [];
    for (const [taskKey, platformId] of Object.entries(taskKeyToPlatformMap)) {
      if (platformId === sectionKey && tasks[taskKey]?.length > 0) result.push(...tasks[taskKey]);
    }
    return result;
  };

  // Get tasks for a dynamic platform section (e.g. platform-google_ads_v1)
  const getTasksForPlatform = (platformKey: string): string[] => {
    if (!rawCategorizedTasks || typeof rawCategorizedTasks !== 'object') return [];
    const tasks = rawCategorizedTasks as Record<string, string[]>;
    if (platformKey.includes('google') && tasks.googleAdsTasks?.length > 0) return tasks.googleAdsTasks;
    if (platformKey.includes('meta') && tasks.metaAdsTasks?.length > 0) return tasks.metaAdsTasks;
    if (platformKey.includes('tiktok') && tasks.tiktokAdsTasks?.length > 0) return tasks.tiktokAdsTasks;
    if (platformKey.includes('bing') && tasks.bingAdsTasks?.length > 0) return tasks.bingAdsTasks;
    return [];
  };

  // Client needs — shown as a dedicated bottom section
  const clientNeeds: string[] = (() => {
    if (!rawCategorizedTasks || typeof rawCategorizedTasks !== 'object') return [];
    const tasks = rawCategorizedTasks as Record<string, string[]>;
    return tasks.clientNeeds || [];
  })();

  // "Other" tasks that don't map to any platform section
  const otherTasks: string[] = (() => {
    if (!rawCategorizedTasks || typeof rawCategorizedTasks !== 'object') return [];
    const tasks = rawCategorizedTasks as Record<string, string[]>;
    return tasks.otherTasks || [];
  })();

  // ALL completed tasks (excluding clientNeeds) grouped by category for the bottom summary
  const allCompletedTasksByCategory: Array<{ category: string; items: string[] }> = (() => {
    if (!rawCategorizedTasks || typeof rawCategorizedTasks !== 'object') return [];
    const tasks = rawCategorizedTasks as Record<string, string[]>;
    return Object.entries(tasks)
      .filter(([key, items]) => key !== 'clientNeeds' && Array.isArray(items) && items.length > 0)
      .map(([key, items]) => ({ category: categoryLabelMap[key] || key, items }));
  })();
  const hasCompletedTasks = allCompletedTasksByCategory.some(cat => cat.items.length > 0);

  // Only show standalone task sections for categories that DON'T map to a platform
  const standaloneTaskCategories = taskCategories.filter(cat => {
    const key = Object.entries(categoryLabelMap).find(([_, v]) => v === cat.category)?.[0];
    if (!key) return true; // unknown category — show standalone
    if (key === 'clientNeeds') return false; // handled separately
    if (key === 'otherTasks') return false; // hide — duplicates "Tasks Completed"
    return !taskKeyToPlatformMap[key]; // only standalone if not mapped to a platform
  });

  const standaloneTaskNavItems = standaloneTaskCategories.map(cat => ({
    id: getCategorySectionId(cat.category),
    label: cat.category,
    icon: getCategoryIcon(cat.category),
  }));

  // Fallback: if no adPlatforms array, use legacy hardcoded sections
  const legacyAdNavItems = adPlatformNavItems.length === 0 ? [
    { id: 'google-ads', label: 'Google Ads', icon: Search },
    { id: 'meta-ads', label: 'Meta Ads', icon: Megaphone },
  ] : [];

  const blogSeoLabel = (deck?.content?.campaignAssets?.blogPosts?.length || 0) > 0 ? 'Blog & SEO' : 'SEO & Website';
  
  const NAV_ITEMS = [
    ...BASE_NAV_ITEMS.slice(0, 2), // hero + ad-overview
    ...adPlatformNavItems,
    ...legacyAdNavItems,
    ...BASE_NAV_ITEMS.slice(2).map(item => item.id === 'blog-seo' ? { ...item, label: blogSeoLabel } : item),
    ...standaloneTaskNavItems,
    { id: 'tasks-completed', label: 'Tasks Completed', icon: CheckCircle as LucideIcon },
    { id: 'client-needs', label: 'What We Need From You', icon: AlertCircle as LucideIcon },
    { id: 'next-steps', label: 'Next Steps', icon: Target },
  ];

  // Scroll spy — use getBoundingClientRect for accuracy regardless of layout offset parents
  useEffect(() => {
    const handleScroll = () => {
      const viewportHeight = window.innerHeight;
      // Default to first nav item that has a rendered section, not the stale activeSection
      const firstRendered = NAV_ITEMS.find(i => sectionRefs.current[i.id]);
      let bestId = firstRendered?.id || 'hero';
      let bestScore = -Infinity;

      for (const item of NAV_ITEMS) {
        const section = sectionRefs.current[item.id];
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight <= 0) continue;

        // Score: how much of the viewport this section fills + bonus if top is near viewport top
        const viewportCoverage = visibleHeight / viewportHeight;
        const topProximityBonus = rect.top >= -50 && rect.top < viewportHeight * 0.4 ? 0.5 : 0;
        const score = viewportCoverage + topProximityBonus;

        if (score > bestScore) {
          bestScore = score;
          bestId = item.id;
        }
      }

      // Near bottom of page — activate last nav item
      if (window.scrollY + viewportHeight >= document.documentElement.scrollHeight - 100) {
        const lastVisible = [...NAV_ITEMS].reverse().find(i => sectionRefs.current[i.id]);
        if (lastVisible) bestId = lastVisible.id;
      }

      setActiveSection(bestId);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run once on mount / nav change
    return () => window.removeEventListener('scroll', handleScroll);
  }, [NAV_ITEMS]);

  const scrollToSection = (sectionId: string) => {
    const section = sectionRefs.current[sectionId];
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const brandPrimary = deck?.brand_colors?.primary || '#6366f1';
  const brandSecondary = deck?.brand_colors?.secondary || '#8b5cf6';
  
  // Consistent date range label used everywhere in the deck
  const dateRangeLabel = deck ? `${format(new Date(deck.date_range_start + 'T00:00:00'), 'MMMM d')} – ${format(new Date(deck.date_range_end + 'T00:00:00'), 'MMMM d, yyyy')}` : '';
  const dateRangeShort = deck ? `${format(new Date(deck.date_range_start + 'T00:00:00'), 'MMM d')} – ${format(new Date(deck.date_range_end + 'T00:00:00'), 'MMM d, yyyy')}` : '';
  // Use saved brand colors, falling back to dark premium defaults
  const brandBackground = deck?.brand_colors?.background || '#0a0a1a';
  const isLightBg = isLightColor(brandBackground);
  // Auto-contrast: if saved textPrimary lacks contrast against background, override it
  const savedTextPrimary = deck?.brand_colors?.textPrimary;
  const brandTextPrimary = (savedTextPrimary && hasEnoughContrast(savedTextPrimary, brandBackground))
    ? savedTextPrimary
    : (isLightBg ? '#1a1a2e' : '#ffffff');
  const savedTextSecondary = deck?.brand_colors?.textSecondary;
  const brandTextSecondary = (savedTextSecondary && hasEnoughContrast(savedTextSecondary, brandBackground))
    ? savedTextSecondary
    : (isLightBg ? '#4a4a5e' : '#a0a0b0');
  const clientLogo = logoOverride === '__deleted__' ? undefined : (logoOverride || deck?.brand_colors?.logo);

  const handleLogoUpload = async (file: File) => {
    if (!deck) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Please select an image file', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'Image must be less than 5MB', variant: 'destructive' }); return; }
    
    setIsUploadingLogo(true);
    try {
      const clientSlug = deck.client_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
      setLogoOverride(logoUrl);
      
      // Save to deck record
      const currentBrandColors = (deck.brand_colors || {}) as Record<string, unknown>;
      await supabase.from('decks')
        .update({ brand_colors: { ...currentBrandColors, logo: logoUrl } as any })
        .eq('id', deck.id);
      
      // Save to client_profiles for reuse across decks
      const { data: existing } = await supabase
        .from('client_profiles')
        .select('id')
        .eq('client_name', deck.client_name)
        .maybeSingle();
      
      if (existing) {
        await supabase.from('client_profiles')
          .update({ logo_url: logoUrl })
          .eq('id', existing.id);
      } else {
        await supabase.from('client_profiles')
          .insert({ client_name: deck.client_name, logo_url: logoUrl });
      }
      
      toast({ title: 'Logo uploaded & saved!' });
    } catch (err) {
      console.error('Logo upload error:', err);
      toast({ title: 'Failed to upload logo', variant: 'destructive' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!deck) return;
    try {
      setLogoOverride('__deleted__');
      // Clear logo from deck brand_colors
      const currentBrandColors = (deck.brand_colors || {}) as Record<string, unknown>;
      const { logo: _removed, ...rest } = currentBrandColors;
      await supabase.from('decks')
        .update({ brand_colors: rest as any })
        .eq('id', deck.id);

      toast({ title: 'Logo removed' });
    } catch (err) {
      console.error('Logo delete error:', err);
      toast({ title: 'Failed to remove logo', variant: 'destructive' });
    }
  };

  // Regenerate AI content for this deck in-place
  const handleRegenerate = () => {
    if (!deck || isRegenerating) return;
    setRegenInstructions('');
    setShowRegenModal(true);
  };

  const handleRegenConfirm = async () => {
    if (!deck) return;
    setShowRegenModal(false);
    setIsRegenerating(true);
    setRegenProgress(5);
    setRegenMessage('Starting regeneration...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-deck`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ deckId: deck.id, instructions: regenInstructions.trim() || undefined }),
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to start regeneration');

      toast({ title: 'Regenerating deck…', description: 'AI is rewriting content. This takes 1–2 minutes.' });

      // Poll for progress every 3 seconds
      const pollInterval = setInterval(async () => {
        const { data } = await supabase.from('decks').select('status, content').eq('id', deck.id).single();
        if (!data) return;
        const c = data.content as any;
        setRegenProgress(c?.progress ?? null);
        setRegenMessage(c?.progressMessage ?? '');

        if (data.status === 'draft' || data.status === 'published') {
          clearInterval(pollInterval);
          setIsRegenerating(false);
          setRegenProgress(null);
          // Reload the deck content
          const { data: fresh } = await supabase.from('decks').select('*').eq('id', deck.id).single();
          if (fresh) {
            setDeck({
              ...fresh,
              content: typeof fresh.content === 'string' ? JSON.parse(fresh.content) : fresh.content,
              brand_colors: typeof fresh.brand_colors === 'string' ? JSON.parse(fresh.brand_colors) : fresh.brand_colors,
              screenshots: Array.isArray(fresh.screenshots) ? fresh.screenshots : [],
            } as unknown as DeckData);
          }
          toast({ title: '✅ Deck regenerated!', description: 'AI content has been refreshed.' });
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setIsRegenerating(false);
          setRegenProgress(null);
          toast({ title: 'Regeneration failed', description: c?.error || 'Unknown error', variant: 'destructive' });
        }
      }, 3000);
    } catch (err) {
      console.error('Regeneration error:', err);
      setIsRegenerating(false);
      setRegenProgress(null);
      toast({ title: 'Failed to regenerate', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  // Approval workflow handlers
  const handleSubmitForReview = async () => {
    if (!deck) return;
    setIsSubmittingForReview(true);
    try {
      await supabase.from('decks').update({ status: 'review', updated_at: new Date().toISOString() }).eq('id', deck.id);
      setDeck(prev => prev ? { ...prev, status: 'review' } : prev);
      toast({ title: '📋 Sent for review', description: 'The deck has been marked as ready for approval.' });
    } catch {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally {
      setIsSubmittingForReview(false);
    }
  };

  const handleApproveDeck = async () => {
    if (!deck) return;
    setIsApprovingDeck(true);
    try {
      await supabase.from('decks').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', deck.id);
      setDeck(prev => prev ? { ...prev, status: 'published' } : prev);
      // Copy client link to clipboard
      const clientUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/deck/${slug}/present`;
      navigator.clipboard.writeText(clientUrl).catch(() => {});
      toast({ title: '✅ Deck approved & published!', description: 'Client link copied to clipboard.' });
    } catch {
      toast({ title: 'Failed to approve', variant: 'destructive' });
    } finally {
      setIsApprovingDeck(false);
    }
  };

  const handleUnpublish = async () => {
    if (!deck) return;
    try {
      await supabase.from('decks').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', deck.id);
      setDeck(prev => prev ? { ...prev, status: 'draft' } : prev);
      toast({ title: 'Deck moved back to draft' });
    } catch {
      toast({ title: 'Failed to unpublish', variant: 'destructive' });
    }
  };

// ─── Client Needs Section (with add/remove support via overrides) ────────────
const ClientNeedsSection = ({ clientNeeds, sectionRef }: { clientNeeds: string[]; sectionRef: (el: HTMLElement | null) => void }) => {
  const { isEditMode, overrides, updateOverride, removeOverride } = useDeckEdit();

  // Gather extra manually-added client needs from overrides
  const extraClientNeeds: string[] = [];
  let extraIdx = 0;
  while (overrides[`clientNeeds.extra.${extraIdx}`] !== undefined) {
    extraClientNeeds.push(overrides[`clientNeeds.extra.${extraIdx}`]);
    extraIdx++;
  }
  const allClientNeeds = [...clientNeeds, ...extraClientNeeds];
  const showSection = isEditMode || allClientNeeds.length > 0;

  if (!showSection) return null;

  return (
    <section ref={sectionRef} id="client-needs" className="py-8">
      <div className="max-w-6xl mx-auto">
        <DeckSectionHeader
          title="What We Need From You"
          subtitle="Action items that require your input or approval"
          icon={AlertCircle}
          brandColor="#f59e0b"
        />
        <div className="deck-ref-card p-6">
          <ul className="space-y-4">
            {clientNeeds.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-[#1a1a1a]">
                <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <InlineEdit value={item} editKey={`tasks.clientNeeds.${idx}`} as="span" className="text-[#1a1a1a]" />
              </li>
            ))}
            {extraClientNeeds.map((item, idx) => (
              <li key={`extra-${idx}`} className="flex items-start gap-3 text-[#1a1a1a]">
                <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <InlineEdit value={item} editKey={`clientNeeds.extra.${idx}`} as="span" className="text-[#1a1a1a]" />
                {isEditMode && (
                  <button
                    onClick={() => {
                      // Remove this extra item by shifting subsequent ones down
                      let i = idx;
                      while (overrides[`clientNeeds.extra.${i + 1}`] !== undefined) {
                        updateOverride(`clientNeeds.extra.${i}`, overrides[`clientNeeds.extra.${i + 1}`]);
                        i++;
                      }
                      removeOverride(`clientNeeds.extra.${i}`);
                    }}
                    className="deck-admin-control text-red-400/60 hover:text-red-400 flex-shrink-0 mt-0.5"
                    title="Remove item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isEditMode && (
            <button
              onClick={() => {
                updateOverride(`clientNeeds.extra.${extraClientNeeds.length}`, 'New action item — click to edit');
              }}
              className="deck-admin-control mt-4 flex items-center gap-2 text-amber-400/70 hover:text-amber-400 text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add item</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};


// ─── Tasks Completed Section (with manual add block support) ─────────────────
const TasksCompletedSection = ({ 
  allCompletedTasksByCategory, 
  dateRangeLabel, 
  brandPrimary, 
  sectionRef 
}: { 
  allCompletedTasksByCategory: Array<{ category: string; items: string[] }>; 
  dateRangeLabel: string; 
  brandPrimary: string; 
  sectionRef: (el: HTMLElement | null) => void;
}) => {
  const { isEditMode, overrides, updateOverride, removeOverride } = useDeckEdit();
  const [newBlockName, setNewBlockName] = useState('');
  const [showAddBlock, setShowAddBlock] = useState(false);

  const extraBlocks: Array<{ name: string; items: string[] }> = [];
  let blockIdx = 0;
  while (overrides[`extraTaskBlock.${blockIdx}.name`] !== undefined) {
    const name = overrides[`extraTaskBlock.${blockIdx}.name`];
    const items: string[] = [];
    let itemIdx = 0;
    while (overrides[`extraTaskBlock.${blockIdx}.item.${itemIdx}`] !== undefined) {
      items.push(overrides[`extraTaskBlock.${blockIdx}.item.${itemIdx}`]);
      itemIdx++;
    }
    extraBlocks.push({ name, items });
    blockIdx++;
  }

  const hasContent = allCompletedTasksByCategory.length > 0 || extraBlocks.length > 0;
  if (!isEditMode && !hasContent) return null;

  return (
    <section ref={sectionRef} id="tasks-completed" className="py-8">
      <div className="max-w-6xl mx-auto">
        <DeckSectionHeader
          title="Tasks Completed"
          subtitle={`Work completed during ${dateRangeLabel}`}
          icon={CheckCircle}
          brandColor={brandPrimary}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allCompletedTasksByCategory.map((cat, catIdx) => (
            <div key={catIdx} className="deck-ref-card p-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brandPrimary }} />
                {cat.category}
              </h3>
              <ul className="space-y-3">
                {cat.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-3 text-[#374151]">
                    <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <InlineEdit value={item} editKey={`tasks.summary.${cat.category}.${itemIdx}`} as="span" className="text-sm text-[#374151]" />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {extraBlocks.map((block, bIdx) => (
            <div key={`extra-${bIdx}`} className="deck-ref-card p-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brandPrimary }} />
                <InlineEdit value={block.name} editKey={`extraTaskBlock.${bIdx}.name`} as="span" className="text-lg font-semibold text-[#1a1a1a]" />
                {isEditMode && (
                  <button
                    onClick={() => {
                      const totalBlocks = extraBlocks.length;
                      for (let b = bIdx; b < totalBlocks - 1; b++) {
                        updateOverride(`extraTaskBlock.${b}.name`, overrides[`extraTaskBlock.${b + 1}.name`]);
                        let ii = 0;
                        while (overrides[`extraTaskBlock.${b + 1}.item.${ii}`] !== undefined) {
                          updateOverride(`extraTaskBlock.${b}.item.${ii}`, overrides[`extraTaskBlock.${b + 1}.item.${ii}`]);
                          ii++;
                        }
                        let leftover = ii;
                        while (overrides[`extraTaskBlock.${b}.item.${leftover}`] !== undefined) {
                          removeOverride(`extraTaskBlock.${b}.item.${leftover}`);
                          leftover++;
                        }
                      }
                      const last = totalBlocks - 1;
                      removeOverride(`extraTaskBlock.${last}.name`);
                      let li = 0;
                      while (overrides[`extraTaskBlock.${last}.item.${li}`] !== undefined) {
                        removeOverride(`extraTaskBlock.${last}.item.${li}`);
                        li++;
                      }
                    }}
                    className="deck-admin-control ml-auto text-red-400/60 hover:text-red-400"
                    title="Remove block"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </h3>
              <ul className="space-y-3">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-3 text-[#374151]">
                    <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <InlineEdit value={item} editKey={`extraTaskBlock.${bIdx}.item.${itemIdx}`} as="span" className="text-sm text-[#374151]" />
                    {isEditMode && (
                      <button
                        onClick={() => {
                          let i = itemIdx;
                          while (overrides[`extraTaskBlock.${bIdx}.item.${i + 1}`] !== undefined) {
                            updateOverride(`extraTaskBlock.${bIdx}.item.${i}`, overrides[`extraTaskBlock.${bIdx}.item.${i + 1}`]);
                            i++;
                          }
                          removeOverride(`extraTaskBlock.${bIdx}.item.${i}`);
                        }}
                        className="deck-admin-control text-red-400/60 hover:text-red-400 flex-shrink-0 mt-0.5"
                        title="Remove task"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {isEditMode && (
                <button
                  onClick={() => updateOverride(`extraTaskBlock.${bIdx}.item.${block.items.length}`, 'New task — click to edit')}
                  className="deck-admin-control mt-3 flex items-center gap-2 text-emerald-400/70 hover:text-emerald-400 text-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add task</span>
                </button>
              )}
            </div>
          ))}

          {isEditMode && (
            <div className="deck-ref-card p-6 border-2 border-dashed border-[#e5e5e0] flex flex-col items-center justify-center gap-3 min-h-[120px] deck-admin-control">
              {showAddBlock ? (
                <div className="flex flex-col gap-3 w-full">
                  <input
                    type="text"
                    value={newBlockName}
                    onChange={(e) => setNewBlockName(e.target.value)}
                    placeholder="Block name (e.g. Meta Ads Tasks)"
                    className="bg-[#f9fafb] border border-[#e5e5e0] rounded-lg px-3 py-2 text-[#1a1a1a] text-sm focus:outline-none focus:border-[#6C3FA0]/40 w-full"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBlockName.trim()) {
                        const idx = extraBlocks.length;
                        updateOverride(`extraTaskBlock.${idx}.name`, newBlockName.trim());
                        updateOverride(`extraTaskBlock.${idx}.item.0`, 'New task — click to edit');
                        setNewBlockName('');
                        setShowAddBlock(false);
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (newBlockName.trim()) {
                          const idx = extraBlocks.length;
                          updateOverride(`extraTaskBlock.${idx}.name`, newBlockName.trim());
                          updateOverride(`extraTaskBlock.${idx}.item.0`, 'New task — click to edit');
                          setNewBlockName('');
                          setShowAddBlock(false);
                        }
                      }}
                      className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-sm hover:bg-emerald-500/30 transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowAddBlock(false); setNewBlockName(''); }}
                      className="flex-1 bg-gray-50 text-[#6b7280] border border-[#e5e5e0] rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddBlock(true)}
                  className="flex items-center gap-2 text-[#9ca3af] hover:text-[#4b5563] transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Add Task Block</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};


// ─── Extra "What We Worked On" tasks (manual add per section) ────────────────
const ExtraWorkedOnTasks = ({ sectionKey }: { sectionKey: string }) => {
  const { isEditMode, overrides, updateOverride, removeOverride } = useDeckEdit();

  const extraItems: string[] = [];
  let idx = 0;
  while (overrides[`${sectionKey}.extraTask.${idx}`] !== undefined) {
    extraItems.push(overrides[`${sectionKey}.extraTask.${idx}`]);
    idx++;
  }

  if (!isEditMode && extraItems.length === 0) return null;

  return (
    <div className="deck-ref-card p-6 mt-4">
      {extraItems.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
          <ul className="space-y-3">
            {extraItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[#374151]">
                <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <InlineEdit value={item} editKey={`${sectionKey}.extraTask.${i}`} as="span" className="text-[#374151]" />
                {isEditMode && (
                  <button
                    onClick={() => {
                      let j = i;
                      while (overrides[`${sectionKey}.extraTask.${j + 1}`] !== undefined) {
                        updateOverride(`${sectionKey}.extraTask.${j}`, overrides[`${sectionKey}.extraTask.${j + 1}`]);
                        j++;
                      }
                      removeOverride(`${sectionKey}.extraTask.${j}`);
                    }}
                    className="deck-admin-control text-red-400/60 hover:text-red-400 flex-shrink-0 mt-0.5"
                    title="Remove task"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {isEditMode && (
        <button
          onClick={() => updateOverride(`${sectionKey}.extraTask.${extraItems.length}`, 'New task — click to edit')}
          className="deck-admin-control mt-3 flex items-center gap-2 text-emerald-400/70 hover:text-emerald-400 text-xs transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add task</span>
        </button>
      )}
    </div>
  );
};

  // ── Quick Data Refresh ───────────────────────────────────────────────────────
  const handleQuickDataRefresh = useCallback(async (customStart?: Date, customEnd?: Date) => {
    if (!deck || isRefreshingData) return;
    setIsRefreshingData(true);

    // If custom dates provided, update the deck's date range first
    const newStart = customStart || dateStart;
    const newEnd = customEnd || dateEnd;
    const startStr = newStart ? format(newStart, 'yyyy-MM-dd') : deck.date_range_start;
    const endStr = newEnd ? format(newEnd, 'yyyy-MM-dd') : deck.date_range_end;

    if (startStr !== deck.date_range_start || endStr !== deck.date_range_end) {
      const { error: dateErr } = await supabase
        .from('decks')
        .update({ date_range_start: startStr, date_range_end: endStr, updated_at: new Date().toISOString() })
        .eq('id', deck.id);
      if (dateErr) {
        console.error('Failed to update date range:', dateErr);
        toast({ title: 'Failed to update dates', variant: 'destructive' });
        setIsRefreshingData(false);
        return;
      }
      // Update local state
      setDeck(prev => prev ? { ...prev, date_range_start: startStr, date_range_end: endStr } : prev);
    }

    // Update local date state immediately so the button label reflects the new selection
    setDateStart(newStart);
    setDateEnd(newEnd);
    toast({ title: '⚡ Refreshing data…', description: `Fetching metrics for ${format(new Date(startStr + 'T00:00:00'), 'MMM d')} – ${format(new Date(endStr + 'T00:00:00'), 'MMM d, yyyy')}` });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('refresh-deck-data', {
        body: { deckId: deck.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (resp.error) throw resp.error;
      const result = resp.data as { success: boolean; refreshed?: string[]; note?: string };
      if (!result.success) throw new Error('Refresh failed');

      const refreshed = result.refreshed || [];
      setLastDataRefresh(new Date().toISOString());
      toast({
        title: refreshed.length > 0 ? `✅ Data refreshed` : '✅ Refresh complete',
        description: result.note || (refreshed.length > 0 ? `Updated: ${refreshed.join(', ')}` : 'No linked data sources found for this client.'),
      });

      // Reload deck from DB to pick up merged content
      const { data: fresh } = await supabase.from('decks').select('*').eq('id', deck.id).single();
      if (fresh) {
        setDeck(prev => prev ? {
          ...prev,
          content: fresh.content as any,
          date_range_start: fresh.date_range_start,
          date_range_end: fresh.date_range_end,
          updated_at: fresh.updated_at,
        } : prev);
        // Sync local date pickers with the DB values
        setDateStart(new Date(fresh.date_range_start + 'T00:00:00'));
        setDateEnd(new Date(fresh.date_range_end + 'T00:00:00'));
      }
    } catch (err) {
      console.error('[QuickDataRefresh]', err);
      toast({ title: 'Refresh failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsRefreshingData(false);
    }
  }, [deck, isRefreshingData, toast, dateStart, dateEnd]);

  // ── Fresh read-modify-write helper to avoid stale overwrites ──────────────
  const freshContentUpdate = useCallback(async (
    mutate: (content: Record<string, any>) => Record<string, any>
  ): Promise<Record<string, any> | null> => {
    if (!deck) return null;
    const { data, error } = await supabase
      .from('decks')
      .select('content')
      .eq('id', deck.id)
      .single();
    if (error) { console.error('Fresh read failed:', error); return null; }
    const fresh = (data?.content as Record<string, any>) || {};
    const updated = mutate(fresh);
    const { error: writeErr } = await supabase
      .from('decks')
      .update({ content: updated as any, updated_at: new Date().toISOString() })
      .eq('id', deck.id);
    if (writeErr) { console.error('Write failed:', writeErr); return null; }
    return updated;
  }, [deck]);

  const handleAssetUpload = async (files: FileList | null, assetKey: string) => {
    if (!files || files.length === 0 || !deck) return;
    setIsUploadingAsset(true);
    const clientSlug = deck.client_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newUrls: string[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const fileExt = file.name.split('.').pop();
      const fileName = `deck-assets/${clientSlug}/${assetKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      
      try {
        const { error: uploadError } = await supabase.storage
          .from('proposal-assets')
          .upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('proposal-assets')
          .getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      } catch (err) {
        console.error('Asset upload error:', err);
      }
    }
    
    if (newUrls.length > 0) {
      // Fresh read-modify-write to avoid overwriting published overrides
      const updated = await freshContentUpdate((content) => {
        const currentAssets = content.campaignAssets || {};
        const existingUrls = (currentAssets as any)[assetKey] || [];
        return { ...content, campaignAssets: { ...currentAssets, [assetKey]: [...existingUrls, ...newUrls] } };
      });
      
      if (updated) {
        setDeck(prev => prev ? { ...prev, content: updated as any } : prev);
        toast({ title: `${newUrls.length} file(s) uploaded!` });
      }
    }
    setIsUploadingAsset(false);
  };

  // Caption save handler — fresh read-modify-write
  const saveCaption = async (assetKey: string, idx: number, caption: string) => {
    if (!deck) return;
    const updated = await freshContentUpdate((content) => {
      const currentCaptions = content.assetCaptions || {};
      const keyCaptions = { ...(currentCaptions[assetKey] || {}), [idx]: caption };
      if (!caption.trim()) delete keyCaptions[idx];
      return { ...content, assetCaptions: { ...currentCaptions, [assetKey]: keyCaptions } };
    });

    if (updated) {
      setDeck(prev => prev ? { ...prev, content: updated as any } : prev);
    }
    setEditingCaption(null);
    setCaptionDraft('');
  };

  // Delete individual asset handler — fresh read-modify-write
  const deleteAsset = async (assetKey: string, idx: number) => {
    if (!deck) return;
    const updated = await freshContentUpdate((content) => {
      const currentAssets = content.campaignAssets || {};
      const existingUrls = [...((currentAssets as any)[assetKey] || [])];
      existingUrls.splice(idx, 1);

      // Also shift captions
      const currentCaptions = { ...(content.assetCaptions || {}) };
      const keyCaptions = { ...(currentCaptions[assetKey] || {}) } as Record<number, string>;
      delete keyCaptions[idx];
      const reindexed: Record<number, string> = {};
      Object.entries(keyCaptions).forEach(([k, v]) => {
        const num = Number(k);
        if (num > idx) reindexed[num - 1] = v;
        else reindexed[num] = v;
      });

      return {
        ...content,
        campaignAssets: { ...currentAssets, [assetKey]: existingUrls },
        assetCaptions: { ...currentCaptions, [assetKey]: reindexed },
      };
    });

    if (updated) {
      setDeck(prev => prev ? { ...prev, content: updated as any } : prev);
      toast({ title: 'Screenshot deleted' });
    }
  };
  
  // Filter nav items based on available data
  const hiddenSet = new Set((deck?.content as any)?.hiddenSections || []);
  // Helper: does deck have ANY ad spend/data across all platforms?
  const hasAnyAdData = (() => {
    if (adPlatforms.length > 0) return adPlatforms.some(p => p.spend > 0 || p.clicks > 0);
    return hasNonZeroData(deck?.content?.googleAds as any) || hasNonZeroData(deck?.content?.metaAds as any);
  })();

  const visibleNavItems = NAV_ITEMS.filter(item => {
    // In presentation mode, hide deleted/hidden sections from nav
    if (!isEditMode && hiddenSet.has(item.id)) return false;
    if (['hero', 'next-steps'].includes(item.id)) return true;
    // Ad overview only if there's actual ad data (always show in edit mode)
    if (item.id === 'ad-overview') return isEditMode || hasAnyAdData;
    if (item.id === 'client-needs') {
      const ov = (deck?.content as any)?.overrides || {};
      const hasExtraNeeds = ov['clientNeeds.extra.0'] !== undefined;
      return isEditMode || clientNeeds.length > 0 || hasExtraNeeds;
    }
    // Legacy google/meta ads: only if they have non-zero data (or in edit mode)
    if (item.id === 'google-ads') return isEditMode || hasNonZeroData(deck?.content?.googleAds as any);
    if (item.id === 'meta-ads') return isEditMode || hasNonZeroData(deck?.content?.metaAds as any);
    // Dynamic platforms: only show if they have data (or in edit mode)
    if (item.id.startsWith('platform-')) {
      if (isEditMode) return true;
      const platformKey = item.id.replace('platform-', '');
      const platform = adPlatforms.find(p => p.key === platformKey);
      return platform ? (platform.spend > 0 || platform.clicks > 0) : false;
    }
    if (item.id.startsWith('task-')) return true;
    if (item.id === 'tasks-completed') {
      const ov = (deck?.content as any)?.overrides || {};
      const hasExtraBlocks = ov['extraTaskBlock.0.name'] !== undefined;
      return isEditMode || hasCompletedTasks || hasExtraBlocks;
    }
    // Show email/sms/social if campaign assets exist OR inline tasks exist
    if (item.id === 'email' && ((deck?.content?.campaignAssets?.emailResults?.length || 0) > 0 || (deck?.content?.campaignAssets?.emailDesigns?.length || 0) > 0 || getTasksForSection('email').length > 0)) return true;
    if (item.id === 'workflows') {
      const wfImages: string[] = (() => { try { return JSON.parse((deck?.content as any)?.overrides?.['workflows.images'] || '[]'); } catch { return []; } })();
      return isNonZero(deck?.content?.workflows?.activeCount) || (deck?.content?.workflows?.newAutomations?.length || 0) > 0 || getTasksForSection('workflows').length > 0 || wfImages.length > 0;
    }
    if (item.id === 'sms') return ((deck?.content?.campaignAssets?.smsResults?.length || 0) > 0 || (deck?.content?.campaignAssets?.smsCampaign?.length || 0) > 0 || getTasksForSection('sms').length > 0 || (deck?.content?.sms?.messagesSent || 0) > 0 || (deck?.content?.sms?.delivered || 0) > 0);
    if (item.id === 'social-media' && ((deck?.content?.campaignAssets?.socialMedia?.length || 0) > 0 || (deck?.content?.socialMediaPosts?.length || 0) > 0 || getTasksForSection('social-media').length > 0)) return true;
    // Only show upload sections if they have content
    if (item.id === 'ad-creatives-approval' && (deck?.content?.campaignAssets?.adCreativeApprovals?.length || 0) === 0) return false;
    if (item.id === 'next-email-campaign' && (deck?.content?.campaignAssets?.nextEmailCampaign?.length || 0) === 0 && !(deck?.content as any)?.overrides?.['nextEmailCampaign.sectionNote']) return false;
    if (item.id === 'next-sms-campaign' && (deck?.content?.campaignAssets?.nextSmsCampaign?.length || 0) === 0 && !(deck?.content as any)?.overrides?.['nextSmsCampaign.sectionNote']) return false;
    if (item.id === 'blog-seo' && (deck?.content?.campaignAssets?.blogPosts?.length || 0) === 0 && getTasksForSection('blog-seo').length === 0 && !(deck?.content as any)?.seo?.current) return false;
    if (item.id === 'website-edits' && !isEditMode && ((deck?.content?.campaignAssets as any)?.websiteEditsScreenshots?.length || 0) === 0 && !(deck?.content as any)?.overrides?.['websiteEdits.sectionNote']) return false;
    if (item.id === 'analytics-traffic' && !isEditMode && (deck?.content?.campaignAssets?.analyticsScreenshots?.length || 0) === 0) return false;
    if (item.id === 'other' && !isEditMode && ((deck?.content?.campaignAssets as any)?.otherScreenshots?.length || 0) === 0 && !(deck?.content as any)?.otherSectionNotes && !(deck?.content as any)?.overrides?.['other.sectionNote']) return false;
    if (['ad-creatives-approval', 'next-email-campaign', 'next-sms-campaign', 'blog-seo', 'website-edits', 'analytics-traffic', 'other'].includes(item.id)) return true;
    const sectionData = deck?.content?.[item.id as keyof typeof deck.content];
    return hasNonZeroData(sectionData as Record<string, any> | undefined);
  });
  
  // After publish, reload deck from DB to keep React state in sync
  const handlePublished = useCallback(async () => {
    if (!deck) return;
    const { data: fresh } = await supabase.from('decks').select('*').eq('id', deck.id).single();
    if (fresh) {
      setDeck({
        ...fresh,
        content: typeof fresh.content === 'string' ? JSON.parse(fresh.content) : fresh.content,
        brand_colors: typeof fresh.brand_colors === 'string' ? JSON.parse(fresh.brand_colors) : fresh.brand_colors,
        screenshots: Array.isArray(fresh.screenshots) ? fresh.screenshots : [],
      } as unknown as DeckData);
    }
  }, [deck?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[#e5e5e0] border-t-[#6C3FA0] rounded-full animate-spin mx-auto" />
            <Sparkles className="h-6 w-6 text-[#6C3FA0] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div>
            <p className="text-lg font-medium text-[#1a1a1a]">Loading your deck...</p>
            <p className="text-sm text-[#6b7280]">Preparing your presentation</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="text-center text-[#1a1a1a]">
          <h1 className="text-2xl font-bold">Deck Not Found</h1>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Prepare hero stats — aggregate from adPlatforms if available, else use hero object
  const adPlatformTotals = adPlatforms.length > 0 ? {
    spend: adPlatforms.reduce((s, p) => s + (p.spend || 0), 0),
    leads: adPlatforms.reduce((s, p) => s + ((p as any).leads || p.conversions || 0), 0),
    impressions: adPlatforms.reduce((s, p) => s + (p.impressions || 0), 0),
    clicks: adPlatforms.reduce((s, p) => s + (p.clicks || 0), 0),
  } : null;
  const heroSpend = adPlatformTotals?.spend || deck.content.hero?.totalSpend || 0;
  const heroLeads = adPlatformTotals?.leads || deck.content.hero?.totalLeads || 0;
  const heroImpressions = adPlatformTotals?.impressions || deck.content.hero?.totalImpressions || 0;
  const hasAdSpend = heroSpend > 0;
  const totalTasks = deck.content.services?.tasks?.reduce((sum, cat) => sum + (cat.items?.length || 0), 0) || 0;
  
  const heroChanges = (deck.content.hero as any)?.changes || {};
  const heroStats = hasAdSpend 
    ? [
        { label: 'Total Spend', value: heroSpend, prefix: '$', trend: heroChanges.spend ?? 0, editKey: 'hero.stat.0.value' },
        { label: 'Total Leads', value: heroLeads, trend: heroChanges.conversions ?? 0, editKey: 'hero.stat.1.value' },
        { label: 'Impressions', value: heroImpressions, trend: heroChanges.impressions ?? 0, editKey: 'hero.stat.2.value' },
      ]
    : [
        { label: 'Tasks Completed', value: totalTasks, trend: 0, editKey: 'hero.stat.0.value' },
        { label: 'Categories', value: deck.content.services?.tasks?.length || 0, editKey: 'hero.stat.1.value' },
        { label: 'Action Items', value: deck.content.nextSteps?.recommendations?.length || 0, editKey: 'hero.stat.2.value' },
      ];

  // Prepare key wins and challenges for executive summary
  const keyWins = deck.content.hero?.keyFindings?.slice(0, 3) || [];
  const challenges: string[] = [];

  // Spend distribution for charts — use adPlatforms if available, fallback to legacy
  const platformColorMap: Record<string, string> = {
    google_ads: '#4285F4',
    meta_ads: '#1877F2',
    tiktok_ads: '#000000',
    bing_ads: '#00809D',
    linkedin_ads: '#0A66C2',
  };
  // Aggregate spend by channel type (e.g. combine multiple Google Ads accounts)
  const spendByChannel: Record<string, { name: string; value: number; color: string }> = {};
  if (adPlatforms.length > 0) {
    adPlatforms.filter(p => p.spend > 0).forEach(p => {
      const channelName = p.platformKey.includes('google') ? 'Google Ads'
        : p.platformKey.includes('meta') ? 'Meta Ads'
        : p.platformKey.includes('tiktok') ? 'TikTok Ads'
        : p.platformKey.includes('bing') ? 'Microsoft Ads'
        : p.platformKey.includes('linkedin') ? 'LinkedIn Ads'
        : p.label;
      if (spendByChannel[channelName]) {
        spendByChannel[channelName].value += p.spend;
      } else {
        spendByChannel[channelName] = { name: channelName, value: p.spend, color: platformColorMap[p.platformKey] || brandPrimary };
      }
    });
  } else {
    const gSpend = deck.content.googleAds?.spend || 0;
    const mSpend = deck.content.metaAds?.spend || 0;
    if (gSpend > 0) spendByChannel['Google Ads'] = { name: 'Google Ads', value: gSpend, color: '#4285F4' };
    if (mSpend > 0) spendByChannel['Meta Ads'] = { name: 'Meta Ads', value: mSpend, color: '#1877F2' };
  }
  const spendDistribution = Object.values(spendByChannel);

  // Google Ads metrics
  const googleMetrics = [
    { label: 'Spend', value: deck.content.googleAds?.spend || 0, prefix: '$', icon: DollarSign },
    { label: 'Clicks', value: deck.content.googleAds?.clicks || 0, icon: MousePointer },
    { label: 'Conversions', value: deck.content.googleAds?.conversions || 0, icon: Users },
    { label: 'ROAS', value: deck.content.googleAds?.roas || 0, suffix: 'x', decimals: 2, icon: TrendingUp },
  ];

  // Meta Ads metrics
  const metaMetrics = [
    { label: 'Spend', value: deck.content.metaAds?.spend || 0, prefix: '$', icon: DollarSign },
    { label: 'Clicks', value: deck.content.metaAds?.clicks || 0, icon: MousePointer },
    { label: 'Conversions', value: deck.content.metaAds?.conversions || 0, icon: Users },
    { label: 'CPM', value: deck.content.metaAds?.cpm || 0, prefix: '$', decimals: 2, icon: Eye },
  ];

  const deckContent = deck.content as any;
  const initialOverrides = (deckContent?.overrides as Record<string, string>) || {};
  const initialHiddenSections = (deckContent?.hiddenSections as string[]) || [];
  const initialSectionNotes = (deckContent?.sectionNotes as Record<string, 'GREEN' | 'YELLOW' | 'RED'>) || {};

  return (
    <DeckEditProvider
      deckId={deck.id}
      isEditMode={isEditMode}
      setIsEditMode={setIsEditMode}
      initialOverrides={initialOverrides}
      initialHiddenSections={initialHiddenSections}
      initialSectionNotes={initialSectionNotes}
      onPublished={handlePublished}
    >
    <div className={cn("min-h-screen deck-ref-page", !isAdminMode && "deck-present-mode")} style={{
      background: '#f5f5f0',
      '--deck-text': '#1a1a1a',
      '--deck-text-muted': '#6b7280',
      '--deck-bg': '#f5f5f0',
      '--deck-surface': '#f9fafb',
      '--deck-border': '#e5e5e0',
      color: '#1a1a1a',
    } as React.CSSProperties}>

      {/* Screenshot Lightbox */}
      {expandedScreenshot && (() => {
        const allImages: string[] = [];
        // Collect all visible images for navigation
        const ca = deck?.content?.campaignAssets;
        if (ca?.emailResults) allImages.push(...ca.emailResults);
        if (ca?.emailDesigns) allImages.push(...ca.emailDesigns);
        if (ca?.smsResults) allImages.push(...ca.smsResults);
        if (ca?.smsCampaign) allImages.push(...ca.smsCampaign);
        if (ca?.adCreativeApprovals) allImages.push(...ca.adCreativeApprovals);
        if (ca?.nextEmailCampaign) allImages.push(...ca.nextEmailCampaign);
        if (ca?.blogPosts) allImages.push(...ca.blogPosts);
        if ((ca as any)?.websiteEditsScreenshots) allImages.push(...(ca as any).websiteEditsScreenshots);
        if (ca?.analyticsScreenshots) allImages.push(...ca.analyticsScreenshots);
        if (ca?.otherScreenshots) allImages.push(...ca.otherScreenshots);
        // Platform screenshots from deck.screenshots
        const deckScreenshots = deck?.screenshots;
        if (Array.isArray(deckScreenshots)) allImages.push(...deckScreenshots.filter((s: any) => typeof s === 'string'));
        // Deduplicate
        const unique = [...new Set(allImages)];
        const currentIdx = unique.indexOf(expandedScreenshot);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < unique.length - 1 && currentIdx >= 0;
        const goPrev = () => { if (hasPrev) setExpandedScreenshot(unique[currentIdx - 1]); };
        const goNext = () => { if (hasNext) setExpandedScreenshot(unique[currentIdx + 1]); };

        return (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-xl"
            onClick={() => setExpandedScreenshot(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.stopPropagation(); goPrev(); }
              if (e.key === 'ArrowRight') { e.stopPropagation(); goNext(); }
              if (e.key === 'Escape') setExpandedScreenshot(null);
            }}
            tabIndex={0}
            ref={(el) => el?.focus()}
          >
            <img 
              src={expandedScreenshot} 
              alt="Expanded screenshot" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
            />
            {/* Navigation arrows */}
            {hasPrev && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#374151] hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            )}
            {hasNext && (
              <button
                className="absolute right-16 top-1/2 -translate-y-1/2 text-[#374151] hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
              >
                <ArrowLeft className="h-6 w-6 rotate-180" />
              </button>
            )}
            {/* Counter */}
            {unique.length > 1 && currentIdx >= 0 && (
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[#6b7280] text-sm bg-white/10 px-4 py-1.5 rounded-full backdrop-blur">
                {currentIdx + 1} / {unique.length}
              </span>
            )}
            <button 
              className="absolute top-6 right-6 text-[#374151] hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
              onClick={() => setExpandedScreenshot(null)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        );
      })()}

      {/* Sidebar nav hidden — reference design uses single scrollable page */}

      {/* Admin Toolbar — floating bar */}
      {isAdminMode && (
        <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide ${
              deck.status === 'published' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              deck.status === 'review' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
              'bg-gray-100 text-[#6b7280] border border-[#e5e5e0]'
            }`}>
              {deck.status === 'published' ? '✓ Published' : deck.status === 'review' ? '👀 In Review' : '✏️ Draft'}
            </span>
          </div>

          {/* Main toolbar row */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Regenerate progress pill */}
            {isRegenerating && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium backdrop-blur-xl border shadow-lg"
                style={{ backgroundColor: `${brandPrimary}20`, borderColor: `${brandPrimary}40`, color: brandTextPrimary }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{regenProgress !== null ? `${regenProgress}%` : ''} {regenMessage || 'Regenerating…'}</span>
              </div>
            )}

            {/* Date Range Editor + Quick Data Refresh — Edit Mode only */}
            {isEditMode && (
              <div className="flex items-center gap-2">
                {/* Date Range Editor */}
                <Popover open={showDateEditor} onOpenChange={setShowDateEditor}>
                  <PopoverTrigger asChild>
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white"
                      style={{
                        backgroundColor: 'rgba(139,92,246,0.2)',
                        borderColor: 'rgba(139,92,246,0.45)',
                        color: '#c4b5fd',
                      }}
                      title="Change reporting date range"
                    >
                      <CalendarDays className="w-4 h-4" />
                      {dateStart && dateEnd ? `${format(dateStart, 'MMM d')} – ${format(dateEnd, 'MMM d')}` : 'Set Dates'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 bg-zinc-900 border-zinc-700" align="end" sideOffset={8}>
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-white">Ad Reporting Date Range</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">Start Date</label>
                          <Calendar
                            mode="single"
                            selected={dateStart}
                            onSelect={(d) => d && setDateStart(d)}
                            disabled={(date) => date > new Date()}
                            className="p-2 pointer-events-auto bg-zinc-800 rounded-lg border border-zinc-700"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">End Date</label>
                          <Calendar
                            mode="single"
                            selected={dateEnd}
                            onSelect={(d) => d && setDateEnd(d)}
                            disabled={(date) => date > new Date() || (dateStart ? date < dateStart : false)}
                            className="p-2 pointer-events-auto bg-zinc-800 rounded-lg border border-zinc-700"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDateEditor(false)}
                          className="text-zinc-400 hover:text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!dateStart || !dateEnd || isRefreshingData}
                          onClick={() => {
                            setShowDateEditor(false);
                            handleQuickDataRefresh(dateStart, dateEnd);
                          }}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Update & Refresh
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Quick Refresh (uses current dates) */}
                <button
                  onClick={() => handleQuickDataRefresh()}
                  disabled={isRefreshingData}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white disabled:opacity-60 disabled:cursor-not-allowed`}
                  style={{
                    backgroundColor: 'rgba(6,182,212,0.2)',
                    borderColor: 'rgba(6,182,212,0.45)',
                    color: '#67e8f9',
                  }}
                  title={lastDataRefresh ? `Last refresh: ${new Date(lastDataRefresh).toLocaleTimeString()}` : 'Refresh GHL & ad data without overwriting overrides'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingData ? 'animate-spin' : ''}`} />
                  {isRefreshingData ? 'Refreshing…' : 'Quick Refresh'}
                </button>
              </div>
            )}

            {/* Edit / Present Mode toggle */}
            <div className="flex items-center rounded-xl border border-[#e5e5e0] overflow-hidden shadow-md bg-white">
              <button
                onClick={() => setIsEditMode(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-all ${isEditMode ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-[#6b7280] hover:bg-gray-50'}`}
                title="Edit mode"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => setIsEditMode(false)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-all ${!isEditMode ? 'bg-[#6C3FA0] text-white' : 'bg-white text-[#6b7280] hover:bg-gray-50'}`}
                title="Present mode"
              >
                <Eye className="w-3.5 h-3.5" />
                Present
              </button>
            </div>

            {/* Save Changes — bulletproof publish */}
            <SaveChangesButton brandPrimary={brandPrimary} />

            {/* Regenerate button */}
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: `${brandPrimary}15`, borderColor: `${brandPrimary}35`, color: brandTextPrimary }}
              title="Regenerate AI content"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Regenerating…' : 'Regenerate AI'}
            </button>

            {/* Approval workflow buttons */}
            {(deck.status === 'draft' || deck.status === 'failed') && !isRegenerating && (
              <>
                <button
                  onClick={handleSubmitForReview}
                  disabled={isSubmittingForReview}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(234,179,8,0.15)', borderColor: 'rgba(234,179,8,0.35)', color: '#fde047' }}
                  title="Mark as ready for review"
                >
                  <SendHorizonal className="w-4 h-4" />
                  {isSubmittingForReview ? 'Submitting…' : 'Submit for Review'}
                </button>
                <button
                  onClick={handleApproveDeck}
                  disabled={isApprovingDeck}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.4)', color: '#6ee7b7' }}
                  title="Publish deck directly to client"
                >
                  <CheckCheck className="w-4 h-4" />
                  {isApprovingDeck ? 'Publishing…' : 'Publish'}
                </button>
              </>
            )}
            {deck.status === 'review' && (
              <>
                <button
                  onClick={handleUnpublish}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)', color: brandTextSecondary }}
                >
                  Back to Draft
                </button>
                <button
                  onClick={handleApproveDeck}
                  disabled={isApprovingDeck}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.4)', color: '#6ee7b7' }}
                  title="Approve and publish to client"
                >
                  <CheckCheck className="w-4 h-4" />
                  {isApprovingDeck ? 'Publishing…' : 'Approve & Publish'}
                </button>
              </>
            )}
            {deck.status === 'published' && (
              <button
                onClick={handleUnpublish}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border shadow-md transition-all hover:scale-105 bg-white"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: brandTextSecondary }}
              >
                Unpublish
              </button>
            )}

            {/* Copy client link */}
            <button
              onClick={() => {
                const clientUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/deck/${slug}/present`;
                navigator.clipboard.writeText(clientUrl);
                toast({ title: 'Client link copied!', description: clientUrl });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white"
              style={{ backgroundColor: `${brandPrimary}20`, borderColor: `${brandPrimary}40`, color: brandTextPrimary }}
            >
              <Share2 className="w-4 h-4" />
              Copy Client Link
            </button>
            <button
              onClick={() => window.open(`/deck/${slug}/present`, '_blank')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border shadow-md transition-all hover:scale-105 bg-white"
              style={{ backgroundColor: `${brandPrimary}10`, borderColor: `${brandPrimary}30`, color: brandTextSecondary }}
              title="Preview as client"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Edit mode hint */}
          {isEditMode && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-yellow-400/70 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-yellow-400/20 max-w-xs text-right">
                ✏️ Click any text to edit · 🙈 Hide/show sections · 📤 Upload images · ✨ AI rewrite
              </div>
              <button
                onClick={() => {
                  setColorDraft({
                    primary: deck?.brand_colors?.primary || '#6366f1',
                    secondary: deck?.brand_colors?.secondary || '#8b5cf6',
                    background: deck?.brand_colors?.background || '#0a0a1a',
                  });
                  setShowColorEditor(v => !v);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur border transition-all hover:scale-105"
                style={{
                  backgroundColor: showColorEditor ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.08)',
                  borderColor: showColorEditor ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.15)',
                  color: showColorEditor ? '#fde047' : '#a0a0b0',
                }}
                title="Edit deck colors"
              >
                <Palette className="w-3.5 h-3.5" />
                Colors
              </button>
              {/* Logo management */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
              {clientLogo ? (
                <button
                  onClick={handleLogoDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur border transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.15)',
                    borderColor: 'rgba(239,68,68,0.35)',
                    color: '#fca5a5',
                  }}
                  title="Remove client logo from deck"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Logo
                </button>
              ) : (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur border transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: '#a0a0b0',
                  }}
                  title="Upload client logo"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Add Logo
                </button>
              )}
              <button
                onClick={async () => {
                  // Fetch SM accounts if not loaded yet
                  if (Object.keys(smAccounts).length === 0) {
                    const headers = {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                    };
                    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-supermetrics`;
                    try {
                      const [gRes, mRes] = await Promise.all([
                        fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'list-accounts', dataSource: 'google_ads' }) }).then(r => r.json()),
                        fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'list-accounts', dataSource: 'meta_ads' }) }).then(r => r.json()),
                      ]);
                      setSmAccounts({
                        google_ads: gRes?.accounts?.google_ads || [],
                        meta_ads: mRes?.accounts?.meta_ads || [],
                      });
                    } catch { /* ignore */ }
                  }
                  setShowAccountMapping(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur border transition-all hover:scale-105"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: '#a0a0b0',
                }}
                title="Connect ad accounts for this client"
              >
                <Plus className="w-3.5 h-3.5" />
                Ad Accounts
              </button>
            </div>
          )}

          {/* Color Editor Panel */}
          {isEditMode && showColorEditor && deck && (
            <div className="bg-black/80 backdrop-blur-xl border border-[#e5e5e0] rounded-xl p-4 shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[#1a1a1a] flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Deck Colors
                </h4>
                <button onClick={() => setShowColorEditor(false)} className="text-[#9ca3af] hover:text-[#374151] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Primary', key: 'primary' as const },
                  { label: 'Secondary', key: 'secondary' as const },
                  { label: 'Background', key: 'background' as const },
                ].map(({ label, key }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6b7280] font-medium">{label}</label>
                    <div className="relative">
                      <input
                        type="color"
                        value={colorDraft[key]}
                        onChange={e => setColorDraft(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-[#e5e5e0] cursor-pointer bg-transparent"
                        style={{ padding: '2px' }}
                      />
                      <input
                        type="text"
                        value={colorDraft[key]}
                        onChange={e => {
                          const val = e.target.value;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                            setColorDraft(prev => ({ ...prev, [key]: val }));
                          }
                        }}
                        className="mt-1 w-full text-xs text-center text-[#4b5563] bg-[#f9fafb] border border-[#e5e5e0] rounded px-1 py-0.5 font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={async () => {
                  if (!deck) return;
                  setIsSavingColors(true);
                  try {
                    const currentBrandColors = (deck.brand_colors || {}) as Record<string, unknown>;
                    const updatedColors = {
                      ...currentBrandColors,
                      primary: colorDraft.primary,
                      secondary: colorDraft.secondary,
                      background: colorDraft.background,
                    };
                    const { error } = await supabase.from('decks')
                      .update({ brand_colors: updatedColors as any, updated_at: new Date().toISOString() })
                      .eq('id', deck.id);
                    if (error) throw error;
                    setDeck({ ...deck, brand_colors: updatedColors as any });
                    toast({ title: 'Colors updated!', description: 'Deck colors saved successfully.' });
                    setShowColorEditor(false);
                  } catch (err) {
                    console.error('Failed to save colors:', err);
                    toast({ title: 'Failed to save colors', variant: 'destructive' });
                  } finally {
                    setIsSavingColors(false);
                  }
                }}
                disabled={isSavingColors}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{
                  backgroundColor: colorDraft.primary,
                  color: isLightColor(colorDraft.primary) ? '#1a1a2e' : '#ffffff',
                }}
              >
                {isSavingColors ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                {isSavingColors ? 'Saving…' : 'Apply Colors'}
              </button>
            </div>
          )}
        </div>
      )}


      {/* Main Content */}
      <main className="max-w-[960px] mx-auto px-4 sm:px-6 transition-all duration-300">
        {/* Hero Section — Purple Gradient */}
        <section className="pt-8 pb-4">
          <div className="deck-ref-hero relative" style={{ background: `linear-gradient(135deg, ${brandPrimary} 0%, ${brandPrimary}dd 50%, ${brandPrimary}aa 100%)` }}>
            {/* Animated radial overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.08) 0%, transparent 60%)' }} />

            <div className="relative z-10">
              {/* Top row: Logo + Performance Deck badge */}
              <div className="flex items-center justify-between mb-8">
                {(clientLogo || isEditMode) && (
                  <EditableImage
                    editKey="cover.logo"
                    src={clientLogo}
                    alt={deck.client_name}
                    className="h-10 md:h-14 object-contain drop-shadow-lg"
                    wrapperClassName="relative"
                    placeholderLabel="Upload Logo"
                    onDelete={handleLogoDelete}
                  />
                )}
                <span className="deck-ref-badge-gold">Performance Deck</span>
              </div>

              {/* Client Name */}
              <h1 className="text-3xl md:text-5xl font-bold text-[#1a1a1a] mb-2 tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <InlineEdit
                  value={deck.client_name}
                  editKey="cover.clientName"
                  as="span"
                  className="text-3xl md:text-5xl font-bold text-white tracking-tight"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
              </h1>

              {/* Subtitle */}
              <InlineEdit
                value="Weekly Review"
                editKey="cover.subtitle"
                as="p"
                className="text-lg md:text-xl text-[#374151] font-light mb-2"
              />

              {/* Date Range */}
              <p className="text-sm text-[#6b7280] mb-8">
                <InlineEdit value={dateRangeLabel} editKey="cover.dateRange" as="span" className="text-sm text-[#6b7280]" />
              </p>

              {/* Hero Stat Cards — 3-column grid */}
              {heroStats.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {heroStats.map((stat, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/15">
                      <div className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider mb-1">{stat.label}</div>
                      <div className="text-white text-2xl md:text-3xl font-bold font-mono tabular-nums">
                        {stat.prefix || ''}<AnimatedCounter value={typeof stat.value === 'number' ? (stat.value % 1 !== 0 ? stat.value.toFixed(2) : String(Math.round(stat.value))) : String(stat.value)} />
                      </div>
                      {stat.trend !== undefined && stat.trend !== 0 && (
                        <div className={cn('text-xs font-semibold mt-1', stat.trend > 0 ? 'text-emerald-300' : 'text-red-300')}>
                          {stat.trend > 0 ? '+' : ''}{stat.trend.toFixed(1)}% vs prev
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Executive Summary — always shown in edit mode, conditional otherwise */}
        {(deck.content.hero?.executiveSummary || isEditMode) && (
          <ExecSummarySection
            deck={deck}
            keyWins={keyWins}
            challenges={challenges}
            brandPrimary={brandPrimary}
          />
        )}

        {/* Ad Overview Section — hide in presentation mode when no ad data */}
        {(isEditMode || hasAnyAdData) && (
        <SectionToggle sectionId="ad-overview" label="Ad Overview" deckId={deck.id} assetKey="adOverview">
        <section 
          ref={(el) => sectionRefs.current['ad-overview'] = el}
          id="ad-overview"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            <DeckSectionHeader
              title="Ad Overview"
              subtitle={`Combined performance across all advertising platforms · ${dateRangeLabel}`}
              icon={BarChart3}
              brandColor={brandPrimary}
              editKeyPrefix="ad-overview"
            />
            
            {/* Spend Distribution Chart */}
            {spendDistribution.length > 0 && (
              <div className="deck-ref-card p-8 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-[#1a1a1a]">Spend Distribution</h3>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={spendDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {spendDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Spend']}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e5e0',
                          borderRadius: '12px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          color: '#1a1a1a',
                        }}
                        labelStyle={{ color: '#1a1a1a' }}
                        itemStyle={{ color: '#374151' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {/* Overview Screenshots */}
            {deck.content.adOverview?.screenshots && deck.content.adOverview.screenshots.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {deck.content.adOverview.screenshots.slice(0, 4).map((screenshot, idx) => {
                  const sizeKey = `adOverview.${idx}.widthPct`;
                  const alignKey = `adOverview.${idx}.alignment`;
                  const contentAny = deck.content as any;
                  const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                  const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                  return (
                  <div 
                    key={idx}
                    className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] cursor-zoom-in hover:border-[#6C3FA0]/30 transition-all group"
                  >
                    <ResizableImage
                      src={screenshot}
                      alt={`Dashboard ${idx + 1}`}
                      isEditMode={isEditMode}
                      widthPct={savedWidth}
                      alignment={savedAlign}
                      onResize={async (pct) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onAlign={async (a) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [alignKey]: a };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onClick={() => setExpandedScreenshot(screenshot)}
                    />
                  </div>
                  );
                })}
              </div>
            )}
            <SectionNotes editKey="adOverview.sectionNote" borderColor="border-blue-500/20" />
          </div>
        </section>
        </SectionToggle>
        )}


        {/* Dynamic Ad Platform Sections (V1, V2, etc.) */}
        {adPlatforms.length > 0 ? (
          adPlatforms.filter(p => isEditMode || p.spend > 0 || p.clicks > 0).map((platform) => {
            const sectionId = `platform-${platform.key}`;
            return (
              <SectionToggle key={sectionId} sectionId={sectionId} label={platform.label} deckId={deck.id} assetKey={platform.key} aiContext={platform.gameplan?.summary}>
              <section
                ref={(el) => sectionRefs.current[sectionId] = el}
                id={sectionId}
                className="py-8"
              >
              <EnhancedPlatformSection
                  platform={platform as EnhancedPlatformData}
                  onScreenshotClick={setExpandedScreenshot}
                  dateRange={dateRangeLabel}
                  editKeyPrefix={sectionId}
                />
                {/* Inline completed tasks for this platform */}
                {(() => {
                  const tasks = getTasksForPlatform(platform.key);
                  if (tasks.length === 0) return null;
                  return (
                    <div className="max-w-6xl mx-auto mt-8">
                      <div className="deck-ref-card p-6">
                        <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
                        <ul className="space-y-3">
                          {tasks.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-[#374151]">
                              <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <InlineEdit value={item} editKey={`tasks.${platform.key}.${i}`} as="span" className="text-[#374151]" />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
                <div className="max-w-6xl mx-auto">
                  <ExtraWorkedOnTasks sectionKey={sectionId} />
                  <SectionNotes editKey={`${sectionId}.sectionNote`} borderColor="border-blue-500/20" />
                </div>
              </section>
              </SectionToggle>
            );
          })
        ) : (
          <>
            {/* Legacy: Hardcoded Google Ads Section — hide in presentation mode when no data */}
            {(isEditMode || hasNonZeroData(deck.content.googleAds as any)) && (
            <SectionToggle sectionId="google-ads" label="Google Ads" deckId={deck.id} assetKey="googleAds">
            <section 
              ref={(el) => sectionRefs.current['google-ads'] = el}
              id="google-ads"
              className="py-8"
            >
              <DeckPlatformSection
                platform="google"
                title="Google Ads"
                icon={Search}
                metrics={googleMetrics}
                insights={deck.content.googleAds?.insights || []}
                screenshots={deck.content.googleAds?.screenshots || (deck.content.googleAds?.screenshot ? [deck.content.googleAds.screenshot] : [])}
                onScreenshotClick={setExpandedScreenshot}
                grade={deck.content.googleAds?.roas && deck.content.googleAds.roas >= 3 ? 'A' : 'B+'}
              />
              <ExtraWorkedOnTasks sectionKey="googleAds" />
              <SectionNotes editKey="googleAds.sectionNote" borderColor="border-blue-500/20" />
            </section>
            </SectionToggle>
            )}

            {/* Legacy: Hardcoded Meta Ads Section — hide in presentation mode when no data */}
            {(isEditMode || hasNonZeroData(deck.content.metaAds as any)) && (
            <SectionToggle sectionId="meta-ads" label="Meta Ads" deckId={deck.id} assetKey="metaAds">
            <section 
              ref={(el) => sectionRefs.current['meta-ads'] = el}
              id="meta-ads"
              className="py-8"
            >
              <DeckPlatformSection
                platform="meta"
                title="Meta Ads"
                icon={Megaphone}
                metrics={metaMetrics}
                insights={deck.content.metaAds?.insights || []}
                screenshots={deck.content.metaAds?.screenshots || (deck.content.metaAds?.screenshot ? [deck.content.metaAds.screenshot] : [])}
                onScreenshotClick={setExpandedScreenshot}
                grade={deck.content.metaAds?.conversions && deck.content.metaAds.conversions > 10 ? 'A-' : 'B'}
              />
              <ExtraWorkedOnTasks sectionKey="metaAds" />
              <SectionNotes editKey="metaAds.sectionNote" borderColor="border-blue-500/20" />
            </section>
            </SectionToggle>
            )}
          </>
        )}

        {/* SMS Section — only show if there are actual numeric metrics or campaign asset screenshots */}
        {((deck.content.sms?.messagesSent || 0) > 0 || (deck.content.sms?.delivered || 0) > 0 || getTasksForSection('sms').length > 0 || (deck.content.campaignAssets?.smsResults?.length || 0) > 0 || (deck.content.campaignAssets?.smsCampaign?.length || 0) > 0) && (
          <SectionToggle sectionId="sms" label="SMS Campaigns" deckId={deck.id} assetKey="smsResults">
          <section 
            ref={(el) => sectionRefs.current['sms'] = el}
            id="sms"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="SMS Campaigns"
                subtitle={`Text message engagement and delivery · ${dateRangeLabel}`}
                icon={MessageSquare}
                brandColor="#10b981"
                editKeyPrefix="sms"
              />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {isNonZero(deck.content.sms?.messagesSent) && (
                  <DeckMetricCard
                    label="Messages Sent"
                    value={deck.content.sms?.messagesSent || 0}
                    icon={MessageSquare}
                    color="#10b981"
                  />
                )}
                {isNonZero(deck.content.sms?.delivered) && (
                  <DeckMetricCard
                    label="Delivered"
                    value={deck.content.sms?.delivered || 0}
                    icon={CheckCircle}
                    color="#10b981"
                  />
                )}
                {isNonZero(deck.content.sms?.deliveryRate) && (
                  <DeckMetricCard
                    label="Delivery Rate"
                    value={(deck.content.sms?.deliveryRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={TrendingUp}
                    color="#10b981"
                  />
                )}
                {isNonZero(deck.content.sms?.responseRate) && (
                  <DeckMetricCard
                    label="Response Rate"
                    value={(deck.content.sms?.responseRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={Users}
                    color="#10b981"
                  />
                )}
              </div>

              {deck.content.sms?.highlights && deck.content.sms.highlights.length > 0 && (deck.content.sms?.messagesSent || 0) > 0 && (
                <div className="deck-ref-card p-6">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Highlights</h3>
                  <ul className="space-y-3">
                    {deck.content.sms.highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-[#374151]">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <InlineEdit value={highlight} editKey={`sms.highlights.${idx}`} as="span" className="text-[#374151]" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SMS Results Screenshots */}
              {deck.content.campaignAssets?.smsResults && deck.content.campaignAssets.smsResults.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">📊 SMS Campaign Results</h3>
                  <div className="grid grid-cols-1 gap-6">
                    {deck.content.campaignAssets.smsResults.map((url, idx) => {
                      const sizeKey = `smsResults.${idx}.widthPct`;
                      const alignKey = `smsResults.${idx}.alignment`;
                      const contentAny = deck.content as any;
                      const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                      const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                      return (
                      <div key={idx} className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] hover:border-emerald-500/40 transition-all group bg-black/30 relative">
                        <button
                          className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteAsset('smsResults', idx); }}
                          title="Delete screenshot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ResizableImage
                          src={url}
                          alt={`SMS Results ${idx + 1}`}
                          isEditMode={isEditMode}
                          widthPct={savedWidth}
                          alignment={savedAlign}
                          onResize={async (pct) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onAlign={async (a) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [alignKey]: a };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onClick={() => setExpandedScreenshot(url)}
                        />
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SMS Campaign Screenshots */}
              {deck.content.campaignAssets?.smsCampaign && deck.content.campaignAssets.smsCampaign.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">💬 SMS Campaigns</h3>
                  <div className="space-y-4">
                    {deck.content.campaignAssets.smsCampaign.map((url, idx) => {
                      const sizeKey = `smsCampaign.${idx}.widthPct`;
                      const alignKey = `smsCampaign.${idx}.alignment`;
                      const contentAny = deck.content as any;
                      const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 70;
                      const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                      return (
                        <div key={idx} className="relative group">
                          <button
                            className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); deleteAsset('smsCampaign', idx); }}
                            title="Delete screenshot"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ResizableImage
                            src={url}
                            alt={`SMS Campaign ${idx + 1}`}
                            isEditMode={isEditMode}
                            widthPct={savedWidth}
                            alignment={savedAlign}
                            onResize={async (pct) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onAlign={async (a) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [alignKey]: a };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onClick={() => setExpandedScreenshot(url)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Admin Notes for SMS */}
              <SectionNotes editKey="sms.sectionNote" borderColor="border-emerald-500/20" />
              {/* Inline completed tasks for SMS */}
              {getTasksForSection('sms').length > 0 && (
                <div className="deck-ref-card p-6 mt-8">
                  <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
                  <ul className="space-y-3">
                    {getTasksForSection('sms').map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[#374151]">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <InlineEdit value={item} editKey={`tasks.sms.${i}`} as="span" className="text-[#374151]" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          </SectionToggle>
        )}

        {/* ===== NEXT SMS CAMPAIGN ===== */}
        {(isEditMode || (deck.content.campaignAssets?.nextSmsCampaign?.length || 0) > 0 || !!(deck.content as any)?.overrides?.['nextSmsCampaign.sectionNote']) && (
          <SectionToggle sectionId="next-sms-campaign" label="Next SMS Campaign" deckId={deck.id} assetKey="nextSmsCampaign">
        <section
          ref={(el) => sectionRefs.current['next-sms-campaign'] = el}
          id="next-sms-campaign"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            <DeckSectionHeader
              title="Next SMS Campaign"
              subtitle="Upcoming text campaign for review and approval"
              icon={MessageSquare}
              brandColor="#10b981"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {(deck.content.campaignAssets?.nextSmsCampaign || []).map((url, idx) => {
                const sizeKey = `nextSmsCampaign.${idx}.widthPct`;
                const alignKey = `nextSmsCampaign.${idx}.alignment`;
                const contentAny = deck.content as any;
                const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 70;
                const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                return (
                  <div key={idx} className="relative group">
                    <button
                      className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteAsset('nextSmsCampaign', idx); }}
                      title="Delete screenshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ResizableImage
                      src={url}
                      alt={`Next SMS ${idx + 1}`}
                      isEditMode={isEditMode}
                      widthPct={savedWidth}
                      alignment={savedAlign}
                      onResize={async (pct) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onAlign={async (a) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [alignKey]: a };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onClick={() => setExpandedScreenshot(url)}
                    />
                  </div>
                );
              })}
            </div>
            <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-emerald-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
              <Upload className="h-5 w-5" />
              <span>{isUploadingAsset ? 'Uploading...' : 'Upload SMS Campaign Screenshots'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'nextSmsCampaign')} />
            </label>
            {/* Admin Notes for Next SMS Campaign */}
            <SectionNotes editKey="nextSmsCampaign.sectionNote" borderColor="border-emerald-500/20" />
          </div>
        </section>
          </SectionToggle>
        )}

        {/* Social Media Section */}
        {(isEditMode || (deck.content.socialMediaPosts && deck.content.socialMediaPosts.length > 0) || (deck.content.campaignAssets?.socialMedia?.length || 0) > 0 || getTasksForSection('social-media').length > 0) && (
          <SectionToggle sectionId="social-media" label="Social Media" deckId={deck.id} assetKey="socialMedia" suppressImages>
          <section
            ref={(el) => sectionRefs.current['social-media'] = el}
            id="social-media"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Social Media"
                subtitle={`Post performance across social platforms · ${dateRangeLabel}`}
                icon={Instagram}
                brandColor="#E1306C"
                editKeyPrefix="social-media"
              />
              {/* Uploaded screenshots gallery */}
              {(deck.content.campaignAssets?.socialMedia?.length || 0) > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {(deck.content.campaignAssets?.socialMedia || []).map((url, idx) => {
                    const sizeKey = `socialMedia.${idx}.widthPct`;
                    const alignKey = `socialMedia.${idx}.alignment`;
                    const contentAny = deck.content as any;
                    const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 80;
                    const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                    return (
                      <div key={idx} className="relative group">
                        <ResizableImage
                          src={url}
                          alt={`Social media ${idx + 1}`}
                          isEditMode={isEditMode}
                          widthPct={savedWidth}
                          alignment={savedAlign}
                          onResize={async (pct) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onAlign={async (a) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [alignKey]: a };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onClick={() => setExpandedScreenshot(url)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Structured posts (legacy) */}
              {deck.content.socialMediaPosts && deck.content.socialMediaPosts.length > 0 && (
                <DeckSocialMediaSection
                  posts={deck.content.socialMediaPosts}
                  brandColor={brandPrimary}
                  onScreenshotClick={setExpandedScreenshot}
                />
              )}
              {/* Inline completed tasks for social media */}
              {getTasksForSection('social-media').length > 0 && (
                <div className="deck-ref-card p-6 mt-8">
                  <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
                  <ul className="space-y-3">
                    {getTasksForSection('social-media').map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[#374151]">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <InlineEdit value={item} editKey={`tasks.social-media.${i}`} as="span" className="text-[#374151]" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            <SectionNotes editKey="socialMedia.sectionNote" borderColor="border-pink-500/20" />
            </div>
          </section>
          </SectionToggle>
        )}

        {/* Email Section */}
        {(isEditMode || hasNonZeroData(deck.content.email) || (deck.content.campaignAssets?.emailResults?.length || 0) > 0 || (deck.content.campaignAssets?.emailDesigns?.length || 0) > 0 || getTasksForSection('email').length > 0) && (
          <SectionToggle sectionId="email" label="Email Marketing" deckId={deck.id} assetKey="emailResults">
          <section 
            ref={(el) => sectionRefs.current['email'] = el}
            id="email"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Email Marketing"
                subtitle={`Email campaign performance and engagement · ${dateRangeLabel}`}
                icon={Mail}
                brandColor="#8b5cf6"
                editKeyPrefix="email"
              />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {isNonZero(deck.content.email?.sent) && (
                  <DeckMetricCard
                    label="Emails Sent"
                    value={deck.content.email?.sent || 0}
                    icon={Mail}
                    color="#8b5cf6"
                  />
                )}
                {isNonZero(deck.content.email?.opened) && (
                  <DeckMetricCard
                    label="Opened"
                    value={deck.content.email?.opened || 0}
                    icon={Eye}
                    color="#8b5cf6"
                  />
                )}
                {isNonZero(deck.content.email?.openRate) && (
                  <DeckMetricCard
                    label="Open Rate"
                    value={(deck.content.email?.openRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={TrendingUp}
                    color="#8b5cf6"
                  />
                )}
                {isNonZero(deck.content.email?.clickRate) && (
                  <DeckMetricCard
                    label="Click Rate"
                    value={(deck.content.email?.clickRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={MousePointer}
                    color="#8b5cf6"
                  />
                )}
              </div>

              {deck.content.email?.campaigns && deck.content.email.campaigns.length > 0 && (
                <div className="deck-ref-card p-6">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Top Campaigns</h3>
                  <div className="space-y-3">
                    {deck.content.email.campaigns.slice(0, 5).map((campaign, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#f9fafb] rounded-xl p-4">
                        <span className="text-[#1a1a1a] font-medium">{campaign.name}</span>
                        <div className="flex gap-4 text-sm">
                          <span className="text-purple-400">{campaign.opens} opens</span>
                          <span className="text-blue-400">{campaign.clicks} clicks</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Designs Screenshots */}
              {deck.content.campaignAssets?.emailDesigns && deck.content.campaignAssets.emailDesigns.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">🎨 Email Designs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deck.content.campaignAssets.emailDesigns.map((url, idx) => {
                      const caption = deck.content.assetCaptions?.emailDesigns?.[idx];
                      const sizeKey = `emailDesigns.${idx}.widthPct`;
                      const alignKey = `emailDesigns.${idx}.alignment`;
                      const contentAny = deck.content as any;
                      const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 70;
                      const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                      return (
                        <div key={idx} className="relative group">
                          <button
                            className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); deleteAsset('emailDesigns', idx); }}
                            title="Delete screenshot"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ResizableImage
                            src={url}
                            alt={caption || `Email Design ${idx + 1}`}
                            isEditMode={isEditMode}
                            widthPct={savedWidth}
                            alignment={savedAlign}
                            onResize={async (pct) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onAlign={async (a) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [alignKey]: a };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onClick={() => setExpandedScreenshot(url)}
                          />
                          {caption && (
                            <p className="text-[#6b7280] text-sm text-center mt-2">{caption}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Email Results Screenshots */}
              {deck.content.campaignAssets?.emailResults && deck.content.campaignAssets.emailResults.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">📊 Email Campaign Results</h3>
                  <div className="space-y-6">
                    {deck.content.campaignAssets.emailResults.map((url, idx) => {
                      const caption = deck.content.assetCaptions?.emailResults?.[idx];
                      const isEditing = editingCaption?.key === 'emailResults' && editingCaption?.idx === idx;
                      const sizeKey = `emailResults.${idx}.widthPct`;
                      const alignKey = `emailResults.${idx}.alignment`;
                      const contentAny = deck.content as any;
                      const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 60;
                      const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                      return (
                        <div key={idx} className="relative group">
                          <button
                            className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); deleteAsset('emailResults', idx); }}
                            title="Delete screenshot"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ResizableImage
                            src={url}
                            alt={caption || `Email Results ${idx + 1}`}
                            isEditMode={isEditMode}
                            widthPct={savedWidth}
                            alignment={savedAlign}
                            onResize={async (pct) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onAlign={async (a) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [alignKey]: a };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onClick={() => setExpandedScreenshot(url)}
                          />
                          {caption && (
                            <p className="text-[#6b7280] text-sm text-center mt-2">{caption}</p>
                          )}
                          {/* Optional note under each email result image */}
                          {(() => {
                            const noteKey = `emailResults.${idx}.note`;
                            const noteValue = (deck.content as any)?.overrides?.[noteKey] || '';
                            if (!isEditMode && !noteValue) return null;
                            return (
                              <div className="mt-2">
                                <InlineEdit
                                  value={noteValue || 'Add a note for this image…'}
                                  editKey={noteKey}
                                  as="p"
                                  className="text-[#6b7280] text-sm text-center italic"
                                  multiline
                                />
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Admin Notes for Email */}
              <SectionNotes editKey="email.sectionNote" borderColor="border-purple-500/20" />
              {/* Inline completed tasks for Email */}
              {getTasksForSection('email').length > 0 && (
                <div className="deck-ref-card p-6 mt-8">
                  <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
                  <ul className="space-y-3">
                    {getTasksForSection('email').map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[#374151]">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <InlineEdit value={item} editKey={`tasks.email.${i}`} as="span" className="text-[#374151]" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          </SectionToggle>
        )}

        {/* ===== NEXT EMAIL CAMPAIGN ===== */}
        {(isEditMode || (deck.content.campaignAssets?.nextEmailCampaign?.length || 0) > 0 || !!(deck.content as any)?.overrides?.['nextEmailCampaign.sectionNote']) && (
          <SectionToggle sectionId="next-email-campaign" label="Next Email Campaign" deckId={deck.id} assetKey="nextEmailCampaign">
        <section
          ref={(el) => sectionRefs.current['next-email-campaign'] = el}
          id="next-email-campaign"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            <DeckSectionHeader
              title="Next Email Campaign"
              subtitle="Upcoming email campaign for review and approval"
              icon={Mail}
              brandColor="#8b5cf6"
            />

            {/* Subject Line & Preview Text Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#f9fafb] rounded-2xl p-6 border border-[#e5e5e0]">
                <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">📧 Subject Line Options</h3>
                {isAdminMode ? (
                  <textarea
                    defaultValue={(deck.content.nextEmailDetails?.subjectLines || []).join('\n')}
                    placeholder="Enter subject line options (one per line)..."
                    className="w-full bg-[#f9fafb] border border-[#e5e5e0] rounded-xl p-3 text-[#374151] text-sm placeholder:text-[#9ca3af] focus:outline-none focus:border-purple-500/50 min-h-[120px] resize-none"
                    onBlur={async (e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      const updated = { ...deck.content, nextEmailDetails: { ...deck.content.nextEmailDetails, subjectLines: lines.length > 0 ? lines : undefined } };
                      const { error } = await supabase.from('decks').update({ content: updated as any }).eq('id', deck.id);
                      if (error) {
                        console.error('[SAVE] Subject lines failed:', error);
                        toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
                      } else {
                        setDeck(prev => prev ? { ...prev, content: updated } : prev);
                        if (lines.length > 0) toast({ title: 'Subject lines saved!' });
                      }
                    }}
                  />
                ) : (deck.content.nextEmailDetails?.subjectLines?.length || 0) > 0 ? (
                  <ul className="space-y-3">
                    {deck.content.nextEmailDetails!.subjectLines!.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                        <span className="text-[#1a1a1a] text-sm">{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="bg-[#f9fafb] rounded-2xl p-6 border border-[#e5e5e0]">
                <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">👁️ Preview Text Options</h3>
                {isAdminMode ? (
                  <textarea
                    defaultValue={(deck.content.nextEmailDetails?.previewTexts || []).join('\n')}
                    placeholder="Enter preview text options (one per line)..."
                    className="w-full bg-[#f9fafb] border border-[#e5e5e0] rounded-xl p-3 text-[#374151] text-sm placeholder:text-[#9ca3af] focus:outline-none focus:border-cyan-500/50 min-h-[120px] resize-none"
                    onBlur={async (e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      const updated = { ...deck.content, nextEmailDetails: { ...deck.content.nextEmailDetails, previewTexts: lines.length > 0 ? lines : undefined } };
                      const { error } = await supabase.from('decks').update({ content: updated as any }).eq('id', deck.id);
                      if (error) {
                        console.error('[SAVE] Preview texts failed:', error);
                        toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
                      } else {
                        setDeck(prev => prev ? { ...prev, content: updated } : prev);
                        if (lines.length > 0) toast({ title: 'Preview texts saved!' });
                      }
                    }}
                  />
                ) : (deck.content.nextEmailDetails?.previewTexts?.length || 0) > 0 ? (
                  <ul className="space-y-3">
                    {deck.content.nextEmailDetails!.previewTexts!.map((text, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                        <span className="text-[#4b5563] text-sm">{text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {(deck.content.campaignAssets?.nextEmailCampaign || []).map((url, idx) => {
                const sizeKey = `nextEmailCampaign.${idx}.widthPct`;
                const alignKey = `nextEmailCampaign.${idx}.alignment`;
                const contentAny = deck.content as any;
                const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 70;
                const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                return (
                  <div key={idx} className="relative group">
                    <button
                      className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteAsset('nextEmailCampaign', idx); }}
                      title="Delete screenshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ResizableImage
                      src={url}
                      alt={`Next Email ${idx + 1}`}
                      isEditMode={isEditMode}
                      widthPct={savedWidth}
                      alignment={savedAlign}
                      onResize={async (pct) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onAlign={async (a) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [alignKey]: a };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onClick={() => setExpandedScreenshot(url)}
                    />
                  </div>
                );
              })}
            </div>
            <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-purple-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
              <Upload className="h-5 w-5" />
              <span>{isUploadingAsset ? 'Uploading...' : 'Upload Email Campaign Screenshots'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'nextEmailCampaign')} />
            </label>
            {/* Admin Notes for Next Email Campaign */}
            <SectionNotes editKey="nextEmailCampaign.sectionNote" borderColor="border-purple-500/20" />
          </div>
        </section>
          </SectionToggle>
        )}

        {(() => {
          const workflowImages: string[] = (() => { try { return JSON.parse((deck.content as any)?.overrides?.['workflows.images'] || '[]'); } catch { return []; } })();
          return (isEditMode || isNonZero(deck.content.workflows?.activeCount) || (deck.content.workflows?.newAutomations?.length || 0) > 0 || getTasksForSection('workflows').length > 0 || workflowImages.length > 0) ? (
          <SectionToggle sectionId="workflows" label="Automations & Workflows" deckId={deck.id} assetKey="workflows" suppressImages>
          <section 
            ref={(el) => sectionRefs.current['workflows'] = el}
            id="workflows"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Automations & Workflows"
                subtitle={`Active automations driving your business · ${dateRangeLabel}`}
                icon={Zap}
                brandColor="#f59e0b"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {isNonZero(deck.content.workflows?.activeCount) && (
                  <div className="deck-ref-card p-8 text-center">
                    <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <div className="text-5xl font-bold text-[#1a1a1a] mb-2">
                      <AnimatedCounter value={String(deck.content.workflows?.activeCount || 0)} />
                    </div>
                    <div className="text-[#6b7280] text-xl">Active Workflows</div>
                  </div>
                )}
                
                {deck.content.workflows?.newAutomations && deck.content.workflows.newAutomations.length > 0 && (
                  <div className="deck-ref-card p-6">
                    <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">New Automations Added</h3>
                    <div className="space-y-3">
                      {deck.content.workflows.newAutomations.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-[#f9fafb] rounded-lg p-4">
                          <Zap className="h-5 w-5 text-yellow-500" />
                          <span className="text-[#1a1a1a]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              {/* Inline completed tasks for CRM/Workflows */}
              {getTasksForSection('workflows').length > 0 && (
                <div className="deck-ref-card p-6 mt-8">
                  <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
                  <ul className="space-y-3">
                    {getTasksForSection('workflows').map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[#374151]">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <InlineEdit value={item} editKey={`tasks.workflows.${i}`} as="span" className="text-[#374151]" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Uploaded workflow screenshots (from overrides) — 2-column grid */}
              {workflowImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 col-span-full">
                  {workflowImages.map((url: string, idx: number) => {
                    const noteKey = `workflows.img.${idx}.note`;
                    const sizeKey = `workflows.img.${idx}.widthPct`;
                    const alignKey = `workflows.img.${idx}.alignment`;
                    const contentAny = deck.content as any;
                    const savedNote = contentAny?.overrides?.[noteKey] || '';
                    const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                    const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="relative group deck-ref-card p-3 overflow-hidden">
                          <ResizableImage
                            src={url}
                            alt={`Workflow screenshot ${idx + 1}`}
                            isEditMode={isEditMode}
                            widthPct={savedWidth}
                            alignment={savedAlign}
                            onResize={async (pct) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onAlign={async (a) => {
                              const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                              const content = (data?.content as any) || {};
                              const overrides = { ...(content.overrides || {}), [alignKey]: a };
                              await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                            }}
                            onClick={() => setExpandedScreenshot(url)}
                          />
                        </div>
                        {/* Note under image */}
                        {(isEditMode || savedNote) && (
                          <InlineEdit
                            value={savedNote || 'Add a note…'}
                            editKey={noteKey}
                            as="p"
                            className={`text-sm ${savedNote ? 'text-[#4b5563]' : 'text-[#9ca3af] italic'}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
              <SectionNotes editKey="workflows.sectionNote" borderColor="border-indigo-500/20" />
            </div>
          </section>
          </SectionToggle>
          ) : null;
        })()}

        {/* Appointments Section */}
        {(isEditMode || hasNonZeroData(deck.content.appointments)) && (
          <SectionToggle sectionId="appointments" label="Appointments" deckId={deck.id} assetKey="appointments">
          <section 
            ref={(el) => sectionRefs.current['appointments'] = el}
            id="appointments"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Appointments"
                subtitle={`Booking and attendance metrics · ${dateRangeLabel}`}
                icon={CalendarCheck}
                brandColor="#3b82f6"
              />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {isNonZero(deck.content.appointments?.total) && (
                  <DeckMetricCard
                    label="Total Appointments"
                    value={deck.content.appointments?.total || 0}
                    icon={CalendarCheck}
                    color="#3b82f6"
                  />
                )}
                {isNonZero(deck.content.appointments?.showed) && (
                  <DeckMetricCard
                    label="Showed"
                    value={deck.content.appointments?.showed || 0}
                    icon={CheckCircle}
                    color="#22c55e"
                  />
                )}
                {isNonZero(deck.content.appointments?.noShow) && (
                  <DeckMetricCard
                    label="No-Shows"
                    value={deck.content.appointments?.noShow || 0}
                    icon={X}
                    color="#ef4444"
                  />
                )}
                {isNonZero(deck.content.appointments?.showRate) && (
                  <DeckMetricCard
                    label="Show Rate"
                    value={(deck.content.appointments?.showRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={TrendingUp}
                    color="#3b82f6"
                  />
                )}
              </div>
              <SectionNotes editKey="appointments.sectionNote" borderColor="border-blue-500/20" />
            </div>
          </section>
          </SectionToggle>
        )}

        {/* Calls Section */}
        {(isEditMode || hasNonZeroData(deck.content.calls)) && (
          <SectionToggle sectionId="calls" label="Call Tracking" deckId={deck.id} assetKey="calls">
          <section 
            ref={(el) => sectionRefs.current['calls'] = el}
            id="calls"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Call Tracking"
                subtitle={`Phone activity and performance · ${dateRangeLabel}`}
                icon={Phone}
                brandColor="#14b8a6"
              />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {isNonZero(deck.content.calls?.total) && (
                  <DeckMetricCard
                    label="Total Calls"
                    value={deck.content.calls?.total || 0}
                    icon={Phone}
                    color="#14b8a6"
                  />
                )}
                {isNonZero(deck.content.calls?.answered) && (
                  <DeckMetricCard
                    label="Answered"
                    value={deck.content.calls?.answered || 0}
                    icon={CheckCircle}
                    color="#22c55e"
                  />
                )}
                {isNonZero(deck.content.calls?.missed) && (
                  <DeckMetricCard
                    label="Missed"
                    value={deck.content.calls?.missed || 0}
                    icon={X}
                    color="#ef4444"
                  />
                )}
                {isNonZero(deck.content.calls?.answerRate) && (
                  <DeckMetricCard
                    label="Answer Rate"
                    value={(deck.content.calls?.answerRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={TrendingUp}
                    color="#14b8a6"
                  />
                )}
              </div>
              <SectionNotes editKey="calls.sectionNote" borderColor="border-red-500/20" />
            </div>
          </section>
          </SectionToggle>
        )}

        {/* Forms Section */}
        {(isEditMode || hasNonZeroData(deck.content.forms)) && (
          <SectionToggle sectionId="forms" label="Forms & Lead Capture" deckId={deck.id} assetKey="forms">
          <section 
            ref={(el) => sectionRefs.current['forms'] = el}
            id="forms"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Forms & Lead Capture"
                subtitle={`Form submissions and conversion metrics · ${dateRangeLabel}`}
                icon={FileText}
                brandColor="#6366f1"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {isNonZero(deck.content.forms?.total) && (
                  <DeckMetricCard
                    label="Active Forms"
                    value={deck.content.forms?.total || 0}
                    icon={FileText}
                    color="#6366f1"
                    size="lg"
                  />
                )}
                {isNonZero(deck.content.forms?.submissions) && (
                  <DeckMetricCard
                    label="Total Submissions"
                    value={deck.content.forms?.submissions || 0}
                    icon={Users}
                    color="#22c55e"
                    size="lg"
                  />
                )}
                {isNonZero(deck.content.forms?.conversionRate) && (
                  <DeckMetricCard
                    label="Conversion Rate"
                    value={(deck.content.forms?.conversionRate || 0) * 100}
                    suffix="%"
                    decimals={1}
                    icon={TrendingUp}
                    color="#3b82f6"
                    size="lg"
                  />
                )}
              </div>

              {deck.content.forms?.forms && deck.content.forms.forms.filter(f => f.submissions > 0).length > 0 && (
                <div className="deck-ref-card p-6">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Top Forms</h3>
                  <div className="space-y-3">
                    {deck.content.forms.forms.filter(f => f.submissions > 0).slice(0, 5).map((form, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#f9fafb] rounded-xl p-4">
                        <span className="text-[#1a1a1a] font-medium">{form.name}</span>
                        <span className="text-indigo-400 font-semibold">{form.submissions} submissions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SectionNotes editKey="forms.sectionNote" borderColor="border-indigo-500/20" />
            </div>
          </section>
          </SectionToggle>
        )}

        {/* Payments Section */}
        {(isEditMode || hasNonZeroData(deck.content.payments)) && (
          <SectionToggle sectionId="payments" label="Payments & Revenue" deckId={deck.id} assetKey="payments">
          <section 
            ref={(el) => sectionRefs.current['payments'] = el}
            id="payments"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Payments & Revenue"
                subtitle={`Transaction and revenue metrics · ${dateRangeLabel}`}
                icon={CreditCard}
                brandColor="#22c55e"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isNonZero(deck.content.payments?.totalRevenue) && (
                  <div className="deck-ref-card p-8 text-center bg-gradient-to-br from-emerald-500/20 to-transparent border-emerald-500/30">
                    <DollarSign className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                    <div className="text-5xl font-bold text-[#1a1a1a] mb-2">
                      ${(deck.content.payments?.totalRevenue || 0).toLocaleString()}
                    </div>
                    <div className="text-[#6b7280] text-lg">Total Revenue</div>
                  </div>
                )}
                {isNonZero(deck.content.payments?.transactionCount) && (
                  <DeckMetricCard
                    label="Transactions"
                    value={deck.content.payments?.transactionCount || 0}
                    icon={CreditCard}
                    color="#22c55e"
                    size="lg"
                  />
                )}
                {isNonZero(deck.content.payments?.avgTransactionValue) && (
                  <DeckMetricCard
                    label="Avg Transaction"
                    value={deck.content.payments?.avgTransactionValue || 0}
                    prefix="$"
                    icon={TrendingUp}
                    color="#22c55e"
                    size="lg"
                  />
                )}
              </div>
              <SectionNotes editKey="payments.sectionNote" borderColor="border-emerald-500/20" />
            </div>
          </section>
          </SectionToggle>
        )}

        {/* Reviews Section */}
        {(isEditMode || hasNonZeroData(deck.content.reviews)) && (
          <SectionToggle sectionId="reviews" label="Reviews & Reputation" deckId={deck.id} assetKey="reviews">
          <section 
            ref={(el) => sectionRefs.current['reviews'] = el}
            id="reviews"
            className="py-8"
          >
            <div className="max-w-6xl mx-auto">
              <DeckSectionHeader
                title="Reviews & Reputation"
                subtitle={`Customer feedback and ratings · ${dateRangeLabel}`}
                icon={Star}
                brandColor="#f59e0b"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {isNonZero(deck.content.reviews?.averageRating) && (
                  <div className="deck-ref-card p-8 text-center bg-gradient-to-br from-yellow-500/20 to-transparent border-yellow-500/30">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`h-8 w-8 ${star <= Math.round(deck.content.reviews?.averageRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#e5e5e0]'}`} 
                        />
                      ))}
                    </div>
                    <div className="text-5xl font-bold text-[#1a1a1a] mb-2">
                      {(deck.content.reviews?.averageRating || 0).toFixed(1)}
                    </div>
                    <div className="text-[#6b7280] text-lg">Average Rating</div>
                  </div>
                )}
                {isNonZero(deck.content.reviews?.total) && (
                  <DeckMetricCard label="Total Reviews" value={deck.content.reviews?.total || 0} icon={Star} color="#f59e0b" size="lg" />
                )}
                {isNonZero(deck.content.reviews?.newThisPeriod) && (
                  <DeckMetricCard label="New This Period" value={deck.content.reviews?.newThisPeriod || 0} icon={TrendingUp} color="#22c55e" size="lg" />
                )}
              </div>

              {deck.content.reviews?.recentReviews && deck.content.reviews.recentReviews.length > 0 && (
                <div className="deck-ref-card p-6">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Recent Reviews</h3>
                  <div className="space-y-4">
                    {deck.content.reviews.recentReviews.slice(0, 3).map((review, idx) => (
                      <div key={idx} className="bg-[#f9fafb] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#e5e5e0]'}`} />
                          ))}
                          {review.source && <span className="text-xs text-[#9ca3af] ml-2">{review.source}</span>}
                        </div>
                        <p className="text-[#374151] text-sm">{review.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SectionNotes editKey="reviews.sectionNote" borderColor="border-yellow-500/20" />
            </div>
          </section>
          </SectionToggle>
        )}

        {/* ===== AD CREATIVES FOR APPROVAL ===== */}
        {(isEditMode || (deck.content.campaignAssets?.adCreativeApprovals?.length || 0) > 0) && (
          <SectionToggle sectionId="ad-creatives-approval" label="Ad Creatives for Approval" deckId={deck.id} assetKey="adCreativeApprovals">
        <section
          ref={(el) => sectionRefs.current['ad-creatives-approval'] = el}
          id="ad-creatives-approval"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            <DeckSectionHeader
              title="Ad Creatives for Approval"
              subtitle={`Review and approve upcoming ad creatives · ${dateRangeLabel}`}
              icon={Palette}
              brandColor="#f97316"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {(deck.content.campaignAssets?.adCreativeApprovals || []).map((url, idx) => {
                const caption = deck.content.assetCaptions?.adCreativeApprovals?.[idx];
                const isEditing = editingCaption?.key === 'adCreativeApprovals' && editingCaption?.idx === idx;
                const sizeKey = `adCreativeApprovals.${idx}.widthPct`;
                const alignKey = `adCreativeApprovals.${idx}.alignment`;
                const contentAny = deck.content as any;
                const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                return (
                  <div key={idx} className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] hover:border-orange-500/40 transition-all group bg-black/30 relative">
                    <button
                      className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteAsset('adCreativeApprovals', idx); }}
                      title="Delete screenshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ResizableImage
                      src={url}
                      alt={caption || `Ad Creative ${idx + 1}`}
                      isEditMode={isEditMode}
                      widthPct={savedWidth}
                      alignment={savedAlign}
                      onResize={async (pct) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onAlign={async (a) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [alignKey]: a };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onClick={() => setExpandedScreenshot(url)}
                    />
                    {caption && (
                      <div className="p-3">
                        <p className="text-[#6b7280] text-sm text-center">{caption}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-orange-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
              <Upload className="h-5 w-5" />
              <span>{isUploadingAsset ? 'Uploading...' : 'Upload Ad Creatives'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'adCreativeApprovals')} />
            </label>
            <SectionNotes editKey="adCreativeApprovals.sectionNote" borderColor="border-orange-500/20" />
          </div>
        </section>
          </SectionToggle>
        )}

        {/* ===== BLOG & SEO PAGES ===== */}
        {(isEditMode || (deck.content.campaignAssets?.blogPosts?.length || 0) > 0 || getTasksForSection('blog-seo').length > 0 || (deck.content as any)?.seo?.current) && (
          <SectionToggle sectionId="blog-seo" label="Blog & SEO Pages" deckId={deck.id} assetKey="blogPosts">
        <section
          ref={(el) => sectionRefs.current['blog-seo'] = el}
          id="blog-seo"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            {(() => {
              const hasBlogPosts = (deck.content.campaignAssets?.blogPosts?.length || 0) > 0;
              const seoWebTitle = hasBlogPosts ? 'Blog & SEO Pages' : 'SEO & Website';
              const seoWebSubtitle = hasBlogPosts ? 'New blog posts, landing pages, and SEO content' : 'SEO optimizations and website improvements';
              return (
                <DeckSectionHeader
                  title={seoWebTitle}
                  subtitle={seoWebSubtitle}
                  icon={BookOpen}
                  brandColor="#06b6d4"
                />
              );
            })()}
            {(deck.content.campaignAssets?.blogPosts?.length || 0) > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {deck.content.campaignAssets!.blogPosts!.map((url, idx) => {
                const caption = deck.content.assetCaptions?.blogPosts?.[idx];
                const sizeKey = `blogPosts.${idx}.widthPct`;
                const alignKey = `blogPosts.${idx}.alignment`;
                const contentAny = deck.content as any;
                const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                return (
                  <div key={idx} className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] hover:border-cyan-500/40 transition-all group bg-black/30 relative">
                    <button
                      className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteAsset('blogPosts', idx); }}
                      title="Delete screenshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ResizableImage
                      src={url}
                      alt={caption || `Blog/SEO Page ${idx + 1}`}
                      isEditMode={isEditMode}
                      widthPct={savedWidth}
                      alignment={savedAlign}
                      onResize={async (pct) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onAlign={async (a) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [alignKey]: a };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onClick={() => setExpandedScreenshot(url)}
                    />
                    {caption && (
                      <div className="p-3">
                        <p className="text-[#6b7280] text-sm text-center">{caption}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
            <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-cyan-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
              <Upload className="h-5 w-5" />
              <span>{isUploadingAsset ? 'Uploading...' : 'Upload Blog/SEO Page Screenshots'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'blogPosts')} />
            </label>
            {/* SEO Metrics from Semrush */}
            {(() => {
              const seo = (deck.content as any)?.seo?.current;
              const prev = (deck.content as any)?.seo?.previous;
              if (!seo) return null;
              const metrics = [
                { label: 'Organic Keywords', value: seo.organicKeywords, prev: prev?.organicKeywords, icon: '🔑' },
                { label: 'Organic Traffic', value: seo.organicTraffic, prev: prev?.organicTraffic, icon: '📈' },
                { label: 'Domain Authority', value: seo.domainAuthority, icon: '🏆' },
                { label: 'Backlinks', value: seo.backlinks, icon: '🔗' },
                { label: 'Referring Domains', value: seo.referringDomains, icon: '🌐' },
              ].filter(m => m.value != null && m.value > 0);
              if (metrics.length === 0) return null;
              const paidMetrics = [
                { label: 'Paid Keywords', value: seo.paidKeywords },
                { label: 'Paid Traffic', value: seo.paidTraffic },
              ].filter(m => m.value != null && m.value > 0);
              const topKeywords = (seo.topKeywords || []).slice(0, 10);
              const competitors = (seo.competitors || []).slice(0, 5);
              return (
                <div className="mt-8 space-y-6">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] flex items-center gap-2">
                    <Globe className="h-5 w-5 text-cyan-400" /> SEO Performance — {seo.domain || ''}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {metrics.map((m, i) => {
                      const delta = m.prev != null && m.prev > 0 ? ((m.value - m.prev) / m.prev * 100) : null;
                      return (
                        <div key={i} className="deck-ref-card p-4 text-center">
                          <span className="text-2xl">{m.icon}</span>
                          <div className="text-2xl font-bold text-[#1a1a1a] mt-1">{(m.value ?? 0).toLocaleString()}</div>
                          <div className="text-xs text-[#6b7280] mt-1">{m.label}</div>
                          {delta !== null && (
                            <div className={`text-xs mt-1 font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% MoM
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {paidMetrics.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {paidMetrics.map((m, i) => (
                        <div key={i} className="deck-ref-card p-3 text-center">
                          <div className="text-lg font-bold text-[#1a1a1a]">{(m.value ?? 0).toLocaleString()}</div>
                          <div className="text-xs text-[#6b7280]">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {topKeywords.length > 0 && (
                    <div className="deck-ref-card p-5">
                      <h4 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Top Organic Keywords</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[#9ca3af] text-xs uppercase">
                              <th className="text-left py-2 pr-4">Keyword</th>
                              <th className="text-center py-2 px-2">Pos</th>
                              <th className="text-center py-2 px-2">Volume</th>
                              <th className="text-center py-2 px-2">CPC</th>
                              <th className="text-center py-2 px-2">Traffic %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topKeywords.map((kw: any, i: number) => (
                              <tr key={i} className="border-t border-[#e5e5e0]">
                                <td className="py-2 pr-4 text-[#374151] font-medium">{kw.keyword}</td>
                                <td className="py-2 px-2 text-center">
                                  <span className={`inline-block min-w-[28px] rounded px-1.5 py-0.5 text-xs font-bold ${kw.position <= 3 ? 'bg-emerald-500/20 text-emerald-400' : kw.position <= 10 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-100 text-[#6b7280]'}`}>
                                    #{kw.position}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center text-[#6b7280]">{(kw.volume ?? 0).toLocaleString()}</td>
                                <td className="py-2 px-2 text-center text-[#6b7280]">${(kw.cpc ?? 0).toFixed(2)}</td>
                                <td className="py-2 px-2 text-center text-[#6b7280]">{(kw.trafficPercent ?? 0).toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {competitors.length > 0 && (
                    <div className="deck-ref-card p-5">
                      <h4 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Organic Competitors</h4>
                      <div className="space-y-2">
                        {competitors.map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-[#e5e5e0] last:border-0">
                            <span className="text-[#374151] font-medium">{c.domain}</span>
                            <div className="flex gap-4 text-xs text-[#6b7280]">
                              <span>{(c.commonKeywords ?? 0).toLocaleString()} common</span>
                              <span>{(c.organicTraffic ?? 0).toLocaleString()} traffic</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {getTasksForSection('blog-seo').length > 0 && (
              <div className="deck-ref-card p-6 mt-8">
                <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-4">✅ What We Worked On</h3>
                <ul className="space-y-3">
                  {getTasksForSection('blog-seo').map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[#374151]">
                      <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <InlineEdit value={item} editKey={`tasks.blog-seo.${i}`} as="span" className="text-[#374151]" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SectionNotes editKey="blogSeo.sectionNote" borderColor="border-cyan-500/20" />
          </div>
        </section>
          </SectionToggle>
        )}

        {/* ===== WEBSITE EDITS ===== */}
        {(isEditMode || ((deck.content.campaignAssets as any)?.websiteEditsScreenshots?.length || 0) > 0 || !!(deck.content as any)?.overrides?.['websiteEdits.sectionNote']) && (
          <SectionToggle sectionId="website-edits" label="Website Edits" deckId={deck.id} assetKey="websiteEditsScreenshots">
            <section
              ref={(el) => sectionRefs.current['website-edits'] = el}
              id="website-edits"
              className="py-8"
            >
              <div className="max-w-6xl mx-auto">
                <DeckSectionHeader
                  title="Website Edits"
                  subtitle="Recent website updates, changes, and improvements"
                  icon={PenTool}
                  brandColor={brandPrimary}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  {((deck.content.campaignAssets as any)?.websiteEditsScreenshots || []).map((url: string, idx: number) => {
                    const caption = (deck.content.assetCaptions as any)?.websiteEditsScreenshots?.[idx];
                    const sizeKey = `websiteEditsScreenshots.${idx}.widthPct`;
                    const alignKey = `websiteEditsScreenshots.${idx}.alignment`;
                    const contentAny = deck.content as any;
                    const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                    const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';

                    return (
                      <div key={idx} className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] hover:border-purple-500/40 transition-all group bg-black/30 relative">
                        <button
                          className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteAsset('websiteEditsScreenshots', idx); }}
                          title="Delete screenshot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <ResizableImage
                          src={url}
                          alt={caption || `Website Edit ${idx + 1}`}
                          isEditMode={isEditMode}
                          widthPct={savedWidth}
                          alignment={savedAlign}
                          onResize={async (pct) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onAlign={async (a) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [alignKey]: a };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onClick={() => setExpandedScreenshot(url)}
                        />

                        {caption && (
                          <div className="p-3">
                            <p className="text-[#6b7280] text-sm text-center">{caption}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-purple-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
                  <Upload className="h-5 w-5" />
                  <span>{isUploadingAsset ? 'Uploading...' : 'Upload Website Edit Screenshots'}</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'websiteEditsScreenshots')} />
                </label>

                <SectionNotes editKey="websiteEdits.sectionNote" borderColor="border-purple-500/20" />
              </div>
            </section>
          </SectionToggle>
        )}

        {/* ===== ANALYTICS & TRAFFIC ===== */}
        {(isEditMode || (deck.content.campaignAssets?.analyticsScreenshots?.length || 0) > 0) && (
          <SectionToggle sectionId="analytics-traffic" label="Analytics & Traffic" deckId={deck.id} assetKey="analyticsScreenshots">
        <section
          ref={(el) => sectionRefs.current['analytics-traffic'] = el}
          id="analytics-traffic"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            <DeckSectionHeader
              title="Analytics & Traffic"
              subtitle="Website traffic, sales, and analytics data"
              icon={LineChart}
              brandColor="#3b82f6"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {(deck.content.campaignAssets?.analyticsScreenshots || []).map((url, idx) => {
                const caption = deck.content.assetCaptions?.analyticsScreenshots?.[idx];
                const sizeKey = `analyticsScreenshots.${idx}.widthPct`;
                const alignKey = `analyticsScreenshots.${idx}.alignment`;
                const contentAny = deck.content as any;
                const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';
                return (
                  <div key={idx} className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] hover:border-blue-500/40 transition-all group bg-black/30 relative">
                    <button
                      className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteAsset('analyticsScreenshots', idx); }}
                      title="Delete screenshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ResizableImage
                      src={url}
                      alt={caption || `Analytics ${idx + 1}`}
                      isEditMode={isEditMode}
                      widthPct={savedWidth}
                      alignment={savedAlign}
                      onResize={async (pct) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onAlign={async (a) => {
                        const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                        const content = (data?.content as any) || {};
                        const overrides = { ...(content.overrides || {}), [alignKey]: a };
                        await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                      }}
                      onClick={() => setExpandedScreenshot(url)}
                    />
                    {caption && (
                      <div className="p-3">
                        <p className="text-[#6b7280] text-sm text-center">{caption}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-blue-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
              <Upload className="h-5 w-5" />
              <span>{isUploadingAsset ? 'Uploading...' : 'Upload Analytics Screenshots'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'analyticsScreenshots')} />
            </label>
            <SectionNotes editKey="analytics.sectionNote" borderColor="border-blue-500/20" />
          </div>
        </section>
          </SectionToggle>
        )}

        {/* ===== OTHER ===== */}
        {(isEditMode || (deck.content.campaignAssets?.otherScreenshots?.length || 0) > 0 || !!(deck.content as any)?.overrides?.['other.sectionNote']) && (
          <SectionToggle sectionId="other" label="Other" deckId={deck.id} assetKey="otherScreenshots">
            <section
              ref={(el) => sectionRefs.current['other'] = el}
              id="other"
              className="py-8"
            >
              <div className="max-w-6xl mx-auto">
                <DeckSectionHeader
                  title="Other"
                  subtitle="Additional notes and supporting screenshots"
                  icon={FileText}
                  brandColor={brandPrimary}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  {(deck.content.campaignAssets?.otherScreenshots || []).map((url, idx) => {
                    const caption = deck.content.assetCaptions?.otherScreenshots?.[idx];
                    const sizeKey = `otherScreenshots.${idx}.widthPct`;
                    const alignKey = `otherScreenshots.${idx}.alignment`;
                    const contentAny = deck.content as any;
                    const savedWidth = contentAny?.overrides?.[sizeKey] ? Number(contentAny.overrides[sizeKey]) : 100;
                    const savedAlign = (contentAny?.overrides?.[alignKey] as 'left' | 'center' | 'right') || 'center';

                    return (
                      <div key={idx} className="rounded-2xl overflow-hidden shadow-xl border border-[#e5e5e0] hover:border-blue-500/40 transition-all group bg-black/30 relative">
                        <button
                          className="deck-admin-control absolute top-2 right-2 z-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteAsset('otherScreenshots', idx); }}
                          title="Delete screenshot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <ResizableImage
                          src={url}
                          alt={caption || `Other ${idx + 1}`}
                          isEditMode={isEditMode}
                          widthPct={savedWidth}
                          alignment={savedAlign}
                          onResize={async (pct) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [sizeKey]: String(pct) };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onAlign={async (a) => {
                            const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                            const content = (data?.content as any) || {};
                            const overrides = { ...(content.overrides || {}), [alignKey]: a };
                            await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                          }}
                          onClick={() => setExpandedScreenshot(url)}
                        />

                        {caption && (
                          <div className="p-3">
                            <p className="text-[#6b7280] text-sm text-center">{caption}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label className="deck-admin-control flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#e5e5e0] hover:border-blue-500/50 cursor-pointer transition-all text-[#6b7280] hover:text-[#1a1a1a]">
                  <Upload className="h-5 w-5" />
                  <span>{isUploadingAsset ? 'Uploading...' : 'Upload Other Screenshots'}</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAssetUpload(e.target.files, 'otherScreenshots')} />
                </label>

                <SectionNotes editKey="other.sectionNote" borderColor="border-blue-500/20" />
              </div>
            </section>
          </SectionToggle>
        )}

        {/* Standalone Task Sections (only categories not mapped to platform sections) */}
        {standaloneTaskCategories.map((category, idx) => {
          const sectionId = getCategorySectionId(category.category);
          const CategoryIcon = getCategoryIcon(category.category);
          return (
            <section 
              key={sectionId}
              ref={(el) => sectionRefs.current[sectionId] = el}
              id={sectionId}
              className="py-8"
            >
              <div className="max-w-6xl mx-auto">
                <DeckSectionHeader
                  title={category.category}
                  subtitle={`${category.items.length} task${category.items.length !== 1 ? 's' : ''} completed · ${dateRangeLabel}`}
                  icon={CategoryIcon}
                  brandColor={brandPrimary}
                />
                
                <div className="deck-ref-card p-6">
                  <ul className="space-y-3">
                    {category.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-start gap-3 text-[#374151]">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Show page screenshots for SEO and Website sections */}
                {(category.category.toLowerCase().includes('seo') || 
                  category.category.toLowerCase().includes('website')) && (
                  <SeoPageScreenshots
                    taskItems={category.items}
                    brandColor={brandPrimary}
                    onScreenshotClick={setExpandedScreenshot}
                    initialPages={(deck.content as any).pageScreenshots || []}
                  />
                )}
              </div>
            </section>
          );
        })}

        {/* ===== TASKS COMPLETED RECENTLY ===== */}
        <TasksCompletedSection
          allCompletedTasksByCategory={allCompletedTasksByCategory}
          dateRangeLabel={dateRangeLabel}
          brandPrimary={brandPrimary}
          sectionRef={(el) => sectionRefs.current['tasks-completed'] = el}
        />


        <ClientNeedsSection
          clientNeeds={clientNeeds}
          sectionRef={(el) => sectionRefs.current['client-needs'] = el}
        />

        {/* Next Steps Section */}
        <SectionToggle sectionId="next-steps" label="Next Steps & Recommendations" allowAddSection>
        <section 
          ref={(el) => sectionRefs.current['next-steps'] = el}
          id="next-steps"
          className="py-8"
        >
          <div className="max-w-6xl mx-auto">
            <DeckSectionHeader
              title="Next Steps & Recommendations"
              subtitle={`Prioritized action items for continued growth · ${dateRangeLabel}`}
              icon={Target}
              brandColor={brandPrimary}
              editKeyPrefix="next-steps"
            />
            
            {deck.content.nextSteps?.recommendations && deck.content.nextSteps.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deck.content.nextSteps.recommendations.map((rec, idx) => (
                  <DeckRecommendationCard
                    key={idx}
                    title={rec.title}
                    description={rec.description}
                    priority={rec.priority}
                    impact={rec.impact}
                    isQuickWin={idx === 0}
                    editKeyPrefix={`next-steps.rec.${idx}`}
                  />
                ))}
              </div>
            ) : (
              <div className="deck-ref-card p-12 text-center">
                <Target className="h-16 w-16 text-[#e5e5e0] mx-auto mb-4" />
                <p className="text-[#6b7280]">Action items will be generated based on your performance data.</p>
              </div>
            )}

            {deck.content.nextSteps?.focusAreas && deck.content.nextSteps.focusAreas.length > 0 && (
              <div className="mt-8 deck-ref-card p-6">
                <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Focus Areas</h3>
                <div className="flex flex-wrap gap-3">
                  {deck.content.nextSteps.focusAreas.map((area, idx) => (
                    <span 
                      key={idx}
                      className="px-4 py-2 rounded-full text-sm font-medium"
                      style={{ 
                        backgroundColor: `${brandPrimary}20`,
                        color: brandPrimary
                      }}
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Notes / Additional Text */}
            {(() => {
              const notesKey = 'next-steps.manualNotes';
              const contentAny = deck.content as any;
              const savedNotes = contentAny?.overrides?.[notesKey] || '';
              
              if (!isEditMode && !savedNotes) return null;
              
              return (
                <div className="mt-8">
                  {isEditMode ? (
                    <div className="deck-ref-card p-6">
                      <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider mb-3">✏️ Additional Notes</h3>
                      <textarea
                        className="w-full bg-[#f9fafb] border border-[#e5e5e0] rounded-xl p-4 text-[#1a1a1a] placeholder-[#9ca3af] focus:border-[#6C3FA0]/50 focus:outline-none focus:ring-1 focus:ring-[#6C3FA0]/30 resize-y min-h-[120px] text-sm leading-relaxed"
                        style={{ minHeight: 120 }}
                        placeholder="Add custom notes, action items, or recommendations here…"
                        defaultValue={savedNotes}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          const { data } = await supabase.from('decks').select('content').eq('id', deck.id).single();
                          const content = (data?.content as any) || {};
                          const overrides = { ...(content.overrides || {}), [notesKey]: val };
                          if (!val) delete overrides[notesKey];
                          await supabase.from('decks').update({ content: { ...content, overrides } as any, updated_at: new Date().toISOString() }).eq('id', deck.id);
                        }}
                      />
                      <p className="text-[#9ca3af] text-xs mt-2">Changes save automatically when you click away.</p>
                    </div>
                  ) : (
                    <div className="deck-ref-card p-6">
                      <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Additional Notes</h3>
                      <div className="text-[#374151] text-sm leading-relaxed whitespace-pre-wrap">{savedNotes}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>
        </SectionToggle>

        {/* ─── Custom Sections (inserted by admin in Edit Mode) ──────────── */}
        <CustomSectionsRenderer />

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        {!isEditMode && (
          <div className="deck-ref-footer">
            <p>Prepared by <strong>Melleka Marketing</strong></p>
          </div>
        )}

      </main>

      {/* ─── Floating Add Section button (Edit Mode only) ─────────────────── */}
      {isEditMode && (
        <>
          <button
            onClick={() => setShowFloatingAddSection(true)}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold shadow-2xl transition-all hover:scale-105 active:scale-95"
            title="Add a new section to this deck"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
          {showFloatingAddSection && (
            <AddSectionModal onClose={() => setShowFloatingAddSection(false)} />
          )}
        </>
      )}

      {/* Regenerate AI Modal */}
      {showRegenModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden"
            style={{ backgroundColor: brandBackground, borderColor: `${brandPrimary}30` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: `${brandPrimary}20` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandPrimary}20` }}>
                  <RefreshCw className="w-5 h-5" style={{ color: brandPrimary }} />
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: brandTextPrimary }}>Regenerate AI Content</h2>
                  <p className="text-xs opacity-60" style={{ color: brandTextPrimary }}>{deck?.client_name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegenModal(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: brandTextPrimary }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm opacity-70" style={{ color: brandTextPrimary }}>
                Describe what you'd like the AI to change or focus on. Leave blank to regenerate with the same data.
              </p>
              <textarea
                value={regenInstructions}
                onChange={e => setRegenInstructions(e.target.value)}
                placeholder={`e.g. "Rewrite the executive summary to focus on the increase in leads. Make the Google Ads section more critical of the lack of conversions."`}
                rows={5}
                className="w-full rounded-xl border px-4 py-3 text-sm resize-none outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: `${brandPrimary}08`,
                  borderColor: `${brandPrimary}25`,
                  color: brandTextPrimary,
                  // @ts-ignore
                  '--tw-ring-color': brandPrimary,
                }}
                autoFocus
              />
              <div className="flex items-center gap-2 text-xs opacity-50" style={{ color: brandTextPrimary }}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI will use the existing Supermetrics data and tasks — no new data is fetched.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: `${brandPrimary}20` }}>
              <button
                onClick={() => setShowRegenModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-opacity hover:opacity-70"
                style={{ borderColor: `${brandPrimary}30`, color: brandTextPrimary }}
              >
                Cancel
              </button>
              <button
                onClick={handleRegenConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: brandPrimary, color: '#ffffff' }}
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      {/* ─── Visual Diff Panel (Edit Mode only) ──────────────────────────── */}
      <DiffPanel deckContent={deckContent} />

      {/* ─── Account Mapping Modal ──────────────────────────── */}
      {showAccountMapping && deck && (
        <AccountMappingModal
          clientName={deck.client_name}
          smAccounts={smAccounts}
          onClose={() => setShowAccountMapping(false)}
          onSaved={() => setShowAccountMapping(false)}
        />
      )}
    </DeckEditProvider>
  );
};

export default DeckView;

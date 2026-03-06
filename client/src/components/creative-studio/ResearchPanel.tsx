import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Globe, Shield, Users, Search, ImageIcon, Plus, Loader2,
  Zap, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ResearchInsightCard from './ResearchInsightCard';
import type { ResearchSource, ResearchSourceType, ResearchContext } from './types';

interface ResearchPanelProps {
  onResearchUpdate: (context: ResearchContext) => void;
}

const SOURCE_TYPES: { type: ResearchSourceType; label: string; icon: typeof Globe; placeholder: string }[] = [
  { type: 'website', label: 'Website', icon: Globe, placeholder: 'Paste competitor URL (e.g., competitor.com)' },
  { type: 'ad-transparency', label: 'Ad Transparency', icon: Shield, placeholder: 'Google Ads Transparency URL or advertiser name' },
  { type: 'social-media', label: 'Social', icon: Users, placeholder: 'Social profile URL (Instagram, Facebook, LinkedIn)' },
  { type: 'seo', label: 'SEO', icon: Search, placeholder: 'Enter domain for SEO research (e.g., competitor.com)' },
  { type: 'ad-screenshot', label: 'Ad Screenshot', icon: ImageIcon, placeholder: 'Upload a competitor ad screenshot' },
];

function detectPlatform(url: string): string {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return 'unknown';
}

function extractHandle(url: string): string {
  try {
    const pathname = new URL(url.startsWith('http') ? url : `https://${url}`).pathname;
    return pathname.split('/').filter(Boolean)[0] || 'unknown';
  } catch { return url; }
}

function stripDomain(input: string): string {
  return input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

export default function ResearchPanel({ onResearchUpdate }: ResearchPanelProps) {
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [activeType, setActiveType] = useState<ResearchSourceType>('website');
  const [inputValue, setInputValue] = useState('');
  const [isResearchingAll, setIsResearchingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const compileAndUpdate = useCallback((currentSources: ResearchSource[]) => {
    const context: ResearchContext = {
      sources: currentSources,
      competitorWebsites: currentSources
        .filter(s => s.type === 'website' && s.status === 'success')
        .map(s => ({
          url: s.input,
          businessName: s.data?.businessName || s.data?.name || '',
          tagline: s.data?.tagline || '',
          colors: s.data?.colors || {},
          messaging: s.data?.messaging || [],
          logo: s.data?.logo || null,
          screenshots: s.data?.screenshots || [],
        })),
      competitorAds: currentSources
        .filter(s => s.type === 'ad-transparency' && s.status === 'success')
        .map(s => ({
          advertiserName: s.label,
          screenshot: s.data?.screenshot || null,
          content: (s.data?.content || s.data?.markdown || '').slice(0, 2000),
          url: s.input,
        })),
      socialIntelligence: currentSources
        .filter(s => s.type === 'social-media' && s.status === 'success')
        .map(s => {
          const posts = s.data?.posts || s.data?.results || [];
          return {
            platform: detectPlatform(s.input),
            handle: extractHandle(s.input),
            topPosts: posts.slice(0, 5).map((p: any) => ({
              caption: p.caption || p.text || '',
              likes: p.likes || p.reactions || 0,
              comments: p.comments || 0,
              contentType: p.type || p.contentType || 'post',
              engagementRate: p.engagementRate || 0,
            })),
            totalPosts: posts.length,
          };
        }),
      seoData: currentSources
        .filter(s => s.type === 'seo' && s.status === 'success')
        .map(s => ({
          domain: stripDomain(s.input),
          organicTraffic: s.data?.organicTraffic || s.data?.traffic || 0,
          topKeywords: (s.data?.topKeywords || s.data?.keywords || []).slice(0, 10).map((k: any) => ({
            keyword: k.keyword || k.phrase || '',
            volume: k.volume || k.searchVolume || 0,
            position: k.position || k.rank || 0,
          })),
          competitors: (s.data?.competitors || []).slice(0, 5).map((c: any) => ({
            domain: c.domain || c.name || '',
            commonKeywords: c.commonKeywords || c.common || 0,
          })),
          domainAuthority: s.data?.domainAuthority || s.data?.authority || 0,
        })),
      adAnalyses: currentSources
        .filter(s => s.type === 'ad-screenshot' && s.status === 'success')
        .map(s => ({
          imageUrl: s.input,
          competitorName: s.label,
          issues: s.data?.issues || [],
          ourSolution: s.data?.ourSolution || s.data?.solution || '',
          overallScore: s.data?.overallScore || s.data?.score || '0',
          quickWins: s.data?.quickWins || [],
        })),
    };
    onResearchUpdate(context);
  }, [onResearchUpdate]);

  const handleAddSource = useCallback(() => {
    const val = inputValue.trim();
    if (!val) return;
    let input = val;
    let label = val;

    switch (activeType) {
      case 'website': {
        if (!input.startsWith('http')) input = `https://${input}`;
        try { label = new URL(input).hostname; } catch { label = input; }
        break;
      }
      case 'ad-transparency': {
        if (input.startsWith('http')) {
          try { label = 'Ad: ' + new URL(input).hostname; } catch { label = 'Ad: ' + input; }
        } else {
          label = 'Ad: ' + input;
        }
        break;
      }
      case 'social-media': {
        const platform = detectPlatform(input);
        const handle = extractHandle(input);
        label = (platform !== 'unknown' ? platform : 'Social') + ' ' + handle;
        break;
      }
      case 'seo': {
        label = 'SEO: ' + stripDomain(input);
        break;
      }
      default: break;
    }

    setSources(prev => [...prev, {
      id: crypto.randomUUID(),
      type: activeType,
      input,
      label,
      status: 'idle',
      addedAt: Date.now(),
    }]);
    setInputValue('');
  }, [inputValue, activeType]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = crypto.randomUUID();
    fileMapRef.current.set(id, file);
    setSources(prev => [...prev, {
      id,
      type: 'ad-screenshot' as const,
      input: URL.createObjectURL(file),
      label: file.name,
      status: 'idle' as const,
      addedAt: Date.now(),
    }]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleRemoveSource = useCallback((id: string) => {
    fileMapRef.current.delete(id);
    setSources(prev => {
      const updated = prev.filter(s => s.id !== id);
      compileAndUpdate(updated);
      return updated;
    });
  }, [compileAndUpdate]);

  // Normalize edge function responses into a consistent shape per source type
  const normalizeResponse = useCallback((type: ResearchSourceType, raw: any): any => {
    switch (type) {
      case 'website':
        // scrape-website returns { branding: { logo, colors, ... }, metadata: { title, description }, screenshots, content }
        return {
          businessName: raw?.metadata?.title || raw?.branding?.ogImage || '',
          tagline: raw?.metadata?.description || '',
          colors: raw?.branding?.colors || {},
          logo: raw?.branding?.logo || raw?.branding?.favicon || null,
          screenshots: raw?.screenshots || [],
          messaging: [], // Not directly available; could parse from content
          content: raw?.content || '',
        };
      case 'seo':
        // get-seo-data returns { data: { topKeywords, organicTraffic, domainAuthority, competitors, ... } }
        return raw?.data || raw;
      case 'ad-screenshot':
        // analyze-ad returns { analysis: { issues, ourSolution, overallScore, quickWins } }
        return raw?.analysis || raw;
      case 'ad-transparency':
        // scrape-ad-transparency returns { screenshot, content, metadata, ... } - already flat
        return raw;
      case 'social-media':
        // scrape-social-media returns { posts, totalPosts, ... } - already flat
        return raw;
      default:
        return raw;
    }
  }, []);

  const handleResearchSingle = useCallback(async (source: ResearchSource) => {
    const sourceId = source.id;
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, status: 'loading' as const, error: undefined } : s
    ));

    try {
      let response: { data: any; error: any };

      switch (source.type) {
        case 'website':
          response = await supabase.functions.invoke('scrape-website', {
            body: { url: source.input, maxScreenshots: 4 },
          });
          break;
        case 'ad-transparency':
          response = source.input.startsWith('http')
            ? await supabase.functions.invoke('scrape-ad-transparency', { body: { url: source.input } })
            : await supabase.functions.invoke('scrape-ad-transparency', { body: { advertiserName: source.input } });
          break;
        case 'social-media': {
          const platform = detectPlatform(source.input);
          const handle = extractHandle(source.input);
          response = await supabase.functions.invoke('scrape-social-media', {
            body: {
              action: 'scrape-posts',
              clientName: handle,
              socialAccounts: [{ platform, handle, url: source.input }],
            },
          });
          break;
        }
        case 'seo':
          response = await supabase.functions.invoke('get-seo-data', {
            body: { domain: stripDomain(source.input) },
          });
          break;
        case 'ad-screenshot': {
          // analyze-ad requires an HTTP URL, not base64. Upload to Supabase storage first.
          const file = fileMapRef.current.get(sourceId);
          if (!file) throw new Error('File not found for this source');
          const fileName = `research-ads/${sourceId}-${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('creative-images')
            .upload(fileName, file, { upsert: true });
          if (uploadError) throw new Error('Failed to upload screenshot: ' + uploadError.message);
          const { data: urlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
          const publicUrl = urlData?.publicUrl;
          if (!publicUrl) throw new Error('Failed to get public URL for screenshot');
          response = await supabase.functions.invoke('analyze-ad', {
            body: { imageUrl: publicUrl, competitorName: 'Competitor', platform: 'unknown' },
          });
          break;
        }
        default:
          throw new Error(`Unknown source type: ${source.type}`);
      }

      if (response.error) throw new Error(response.error.message || 'Edge function failed');

      const normalized = normalizeResponse(source.type, response.data);

      setSources(prev => {
        const updated = prev.map(s =>
          s.id === sourceId ? { ...s, status: 'success' as const, data: normalized } : s
        );
        compileAndUpdate(updated);
        return updated;
      });
      toast.success(`Research complete: ${source.label}`);
    } catch (err: any) {
      const message = err?.message || 'Research failed';
      setSources(prev => {
        const updated = prev.map(s =>
          s.id === sourceId ? { ...s, status: 'error' as const, error: message } : s
        );
        compileAndUpdate(updated);
        return updated;
      });
      toast.error(`Research failed: ${source.label}`);
    }
  }, [compileAndUpdate, normalizeResponse]);

  const handleResearchAll = useCallback(async () => {
    const idleSources = sources.filter(s => s.status === 'idle' || s.status === 'error');
    if (idleSources.length === 0) return;
    setIsResearchingAll(true);
    for (let i = 0; i < idleSources.length; i += 3) {
      const batch = idleSources.slice(i, i + 3);
      await Promise.allSettled(batch.map(s => handleResearchSingle(s)));
    }
    setIsResearchingAll(false);
  }, [sources, handleResearchSingle]);

  return (
    <div className="space-y-4 pt-3">
      {/* Source Type Chips */}
      <div className="flex flex-wrap gap-1.5">
        {SOURCE_TYPES.map(st => (
          <button
            key={st.type}
            type="button"
            onClick={() => setActiveType(st.type)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              activeType === st.type
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            <st.icon className="h-3.5 w-3.5" />
            {st.label}
          </button>
        ))}
      </div>

      {/* Input Area */}
      {activeType === 'ad-screenshot' ? (
        <div>
          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Ad Screenshot
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={SOURCE_TYPES.find(s => s.type === activeType)?.placeholder}
            onKeyDown={e => e.key === 'Enter' && handleAddSource()}
            className="text-sm"
          />
          <Button size="sm" onClick={handleAddSource} disabled={!inputValue.trim()} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {/* Source List with Insight Cards */}
      {sources.length > 0 && (
        <div className="space-y-2">
          {sources.map(source => (
            <ResearchInsightCard
              key={source.id}
              source={source}
              onRemove={handleRemoveSource}
              onRetry={(id) => {
                const s = sources.find(src => src.id === id);
                if (s) handleResearchSingle(s);
              }}
            />
          ))}
        </div>
      )}

      {/* Research All Button */}
      {sources.filter(s => s.status === 'idle' || s.status === 'error').length > 0 && (
        <Button onClick={handleResearchAll} disabled={isResearchingAll} className="w-full gap-2" variant="outline">
          {isResearchingAll ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Researching {sources.filter(s => s.status === 'loading').length} of{' '}
              {sources.filter(s => s.status !== 'success').length}...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Research All ({sources.filter(s => s.status === 'idle' || s.status === 'error').length} sources)
            </>
          )}
        </Button>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AdminHeader from '@/components/AdminHeader';
import { toast } from 'sonner';
import {
  Brain, Wand2, Palette, Megaphone, Search,
  Image as ImageIcon, Video, Layers, Zap, Loader2, PenTool,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { SmartBrief } from '@/components/creative-studio/SmartBrief';
import { AdPanel } from '@/components/creative-studio/AdPanel';
import { ImagePanel } from '@/components/creative-studio/ImagePanel';
import { VideoPanel } from '@/components/creative-studio/VideoPanel';
import { CanvaPanel } from '@/components/creative-studio/CanvaPanel';
import { UnifiedGallery } from '@/components/creative-studio/UnifiedGallery';
import type {
  StudioMode, CreativeType, BriefAnalysis, GalleryItem,
  BrandContext, AdPrefill, ImagePrefill, VideoPrefill,
  ResearchContext,
} from '@/components/creative-studio/types';

const TABS: { id: CreativeType; label: string; icon: typeof Megaphone; desc: string }[] = [
  { id: 'ad', label: 'Ad Creative', icon: Megaphone, desc: 'Platform-specific ads' },
  { id: 'image', label: 'Image', icon: ImageIcon, desc: 'General images & graphics' },
  { id: 'video', label: 'Video', icon: Video, desc: 'Motion video clips' },
  { id: 'canva', label: 'Canva', icon: PenTool, desc: 'Canva designs & templates' },
];

export default function CreativeStudio() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode & panel
  const [mode, setMode] = useState<StudioMode>('smart');
  const [activePanel, setActivePanel] = useState<CreativeType>('ad');

  // Brand context (shared across panels)
  const [brandContext, setBrandContext] = useState<BrandContext>({
    brandName: '',
    primaryColor: '#6366f1',
    secondaryColor: '#ec4899',
    accentColor: '#f59e0b',
    productDescription: '',
    headline: '',
    cta: '',
    extractedLogo: null,
    extractedScreenshots: [],
  });

  // Prefill states (from Smart Brief)
  const [adPrefill, setAdPrefill] = useState<AdPrefill | undefined>();
  const [imagePrefill, setImagePrefill] = useState<ImagePrefill | undefined>();
  const [videoPrefill, setVideoPrefill] = useState<VideoPrefill | undefined>();

  // Gallery
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);

  // Direct generation state (for "Generate Now" from Smart Brief)
  const [isDirectGenerating, setIsDirectGenerating] = useState(false);

  // Research context (from ResearchPanel inside SmartBrief)
  const [researchContext, setResearchContext] = useState<ResearchContext | null>(null);

  // Read ?tab= query param on mount
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'ad' || tab === 'image' || tab === 'video' || tab === 'canva') {
      setActivePanel(tab);
      setMode('manual');
    }
  }, []);

  // Add item to gallery
  const handleGenerated = useCallback((item: GalleryItem) => {
    setGalleryItems(prev => [item, ...prev]);
  }, []);

  // Clear gallery
  const handleClearGallery = useCallback(() => {
    setGalleryItems([]);
  }, []);

  // Smart Brief: analysis complete
  const handleAnalysisComplete = useCallback((analysis: BriefAnalysis) => {
    // Just store analysis - user decides next action
  }, []);

  // Smart Brief: "Generate Now" - call the appropriate edge function directly
  const handleGenerateNow = useCallback(async (analysis: BriefAnalysis) => {
    setIsDirectGenerating(true);

    try {
      if (analysis.outputType === 'ad') {
        // Call generate-ad-image
        const dims = analysis.dimensions || { width: 1080, height: 1080 };
        const { data, error } = await supabase.functions.invoke('generate-ad-image', {
          body: {
            prompt: analysis.enhancedPrompt,
            width: dims.width,
            height: dims.height,
            brandName: brandContext.brandName || undefined,
            primaryColor: brandContext.primaryColor || undefined,
            secondaryColor: brandContext.secondaryColor || undefined,
            accentColor: brandContext.accentColor || undefined,
            productDescription: brandContext.productDescription || undefined,
            headline: analysis.suggestedHeadline || brandContext.headline || undefined,
            cta: analysis.suggestedCta || brandContext.cta || undefined,
            industry: analysis.industry || undefined,
            style: analysis.style || undefined,
            campaign: analysis.campaignType || undefined,
            referenceImage: brandContext.extractedLogo || undefined,
            websiteScreenshots: brandContext.extractedScreenshots.filter(s => s.screenshot).slice(0, 2).map(s => s.screenshot) || undefined,
          },
        });

        if (error) {
          const errJson = (error as any)?.context?.json;
          throw new Error(errJson?.error || error.message);
        }
        if (data?.imageUrl) {
          handleGenerated({
            id: crypto.randomUUID(),
            type: 'ad',
            url: data.imageUrl,
            prompt: analysis.enhancedPrompt,
            timestamp: Date.now(),
            metadata: {
              platform: analysis.platform,
              dimensions: dims,
              generator: data.generator,
              qa: data.qa,
              comparison: data.comparison,
            },
          });
          toast.success('Ad creative generated!');
        } else {
          throw new Error('No image returned');
        }
      } else if (analysis.outputType === 'image') {
        // Call image-generator
        const dims = analysis.dimensions || { width: 1024, height: 1024 };
        const { data, error } = await supabase.functions.invoke('image-generator', {
          body: {
            prompt: analysis.enhancedPrompt,
            mode: 'generate',
            width: dims.width,
            height: dims.height,
            style: analysis.style || 'none',
            numberOfImages: 1,
          },
        });

        if (error || !data?.success) {
          const errJson = (error as any)?.context?.json;
          throw new Error(errJson?.error || data?.error || error?.message || 'Generation failed');
        }

        for (const img of data.images) {
          handleGenerated({
            id: crypto.randomUUID(),
            type: 'image',
            url: img.imageUrl,
            prompt: analysis.enhancedPrompt,
            timestamp: Date.now(),
            metadata: {
              dimensions: dims,
              generator: img.generator,
              style: analysis.style,
              mode: 'generate',
            },
          });
        }

        // Save to DB
        if (user && data.images.length > 0) {
          const inserts = data.images.map((img: any) => ({
            created_by: user.id,
            prompt: analysis.enhancedPrompt,
            mode: 'generate',
            style: analysis.style !== 'none' ? analysis.style : null,
            width: dims.width,
            height: dims.height,
            image_url: img.imageUrl,
            generator: img.generator,
          }));
          await supabase.from('generated_images').insert(inserts);
        }

        toast.success('Image generated!');
      } else if (analysis.outputType === 'video') {
        // Call generate-video
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt: analysis.enhancedPrompt,
            aspectRatio: analysis.aspectRatio || '16:9',
            duration: analysis.videoDuration || 5,
            resolution: analysis.videoResolution || '1080p',
            cameraFixed: false,
          },
        });

        if (error) throw error;
        if (data?.videoUrl) {
          handleGenerated({
            id: crypto.randomUUID(),
            type: 'video',
            url: data.videoUrl,
            prompt: analysis.enhancedPrompt,
            timestamp: Date.now(),
            metadata: {
              generator: 'higgsfield',
              style: analysis.style,
              mode: 'text-to-video',
            },
          });
          toast.success('Video generated!');
        } else {
          throw new Error(data?.error || 'No video returned');
        }
      }
    } catch (err: any) {
      console.error('Direct generation error:', err);
      toast.error(err.message || 'Generation failed');
    } finally {
      setIsDirectGenerating(false);
    }
  }, [brandContext, handleGenerated, user]);

  // Brand context update (from research panel auto-populate)
  const handleBrandContextUpdate = useCallback((updates: Partial<BrandContext>) => {
    setBrandContext(prev => ({ ...prev, ...updates }));
  }, []);

  // Research context update
  const handleResearchUpdate = useCallback((ctx: ResearchContext) => {
    setResearchContext(ctx);
    // Auto-populate brand context from first website research if still at defaults
    if (ctx.competitorWebsites.length > 0) {
      const first = ctx.competitorWebsites[0];
      setBrandContext(prev => {
        const updates: Partial<BrandContext> = {};
        if (!prev.brandName && first.businessName) updates.brandName = first.businessName;
        if (prev.primaryColor === '#6366f1' && first.colors?.primary) updates.primaryColor = first.colors.primary;
        if (prev.secondaryColor === '#ec4899' && first.colors?.secondary) updates.secondaryColor = first.colors.secondary;
        if (!prev.extractedLogo && first.logo) updates.extractedLogo = first.logo;
        if (prev.extractedScreenshots.length === 0 && first.screenshots?.length > 0) updates.extractedScreenshots = first.screenshots;
        if (!prev.productDescription && first.tagline) updates.productDescription = first.tagline;
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, []);

  // Smart Brief: "Customize Manually" - switch to manual mode with prefill
  const handleCustomize = useCallback((analysis: BriefAnalysis) => {
    setMode('manual');
    setActivePanel(analysis.outputType);

    if (analysis.outputType === 'ad') {
      setAdPrefill({
        prompt: analysis.enhancedPrompt,
        platform: analysis.platform !== 'general' ? analysis.platform : undefined,
        industry: analysis.industry || undefined,
        style: analysis.style || undefined,
        campaignType: analysis.campaignType || undefined,
        headline: analysis.suggestedHeadline || undefined,
        cta: analysis.suggestedCta || undefined,
      });
    } else if (analysis.outputType === 'image') {
      setImagePrefill({
        prompt: analysis.enhancedPrompt,
        style: analysis.style || undefined,
        width: analysis.dimensions?.width,
        height: analysis.dimensions?.height,
      });
    } else if (analysis.outputType === 'video') {
      setVideoPrefill({
        prompt: analysis.enhancedPrompt,
        style: analysis.style || undefined,
        motionStyle: analysis.motionStyle || undefined,
        aspectRatio: analysis.aspectRatio || undefined,
        duration: analysis.videoDuration?.toString(),
        resolution: analysis.videoResolution || undefined,
      });
    }

    // Also update shared brand context from analysis
    if (analysis.suggestedHeadline) {
      setBrandContext(prev => ({ ...prev, headline: analysis.suggestedHeadline! }));
    }
    if (analysis.suggestedCta) {
      setBrandContext(prev => ({ ...prev, cta: analysis.suggestedCta! }));
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20">
              <Palette className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold">Creative Studio</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                AI-powered ad creatives, images, and videos
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              { icon: Brain, label: 'Smart AI Brief' },
              { icon: Search, label: 'Research-Powered' },
              { icon: Layers, label: 'Multi-Platform' },
              { icon: Zap, label: 'Instant Results' },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground text-xs"
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl border border-border p-1 bg-muted/30">
            <button
              onClick={() => setMode('smart')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'smart'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Brain className="h-4 w-4" />
              AI Smart Brief
            </button>
            <button
              onClick={() => setMode('manual')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'manual'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Wand2 className="h-4 w-4" />
              Manual Mode
            </button>
          </div>
        </div>

        {/* Smart Brief Mode */}
        {mode === 'smart' && (
          <div className="max-w-4xl mx-auto mb-10">
            <SmartBrief
              brandContext={brandContext}
              onAnalysisComplete={handleAnalysisComplete}
              onGenerateNow={handleGenerateNow}
              onCustomize={handleCustomize}
              onResearchUpdate={handleResearchUpdate}
            />

            {/* Direct generation loading overlay */}
            {isDirectGenerating && (
              <div className="mt-6 flex flex-col items-center gap-3 p-6 rounded-xl border border-primary/20 bg-primary/5">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-primary">Generating your creative...</p>
                <p className="text-xs text-muted-foreground">This may take a moment</p>
              </div>
            )}
          </div>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && (
          <div className="mb-10">
            {/* Panel Tabs */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-xl border border-border p-1 bg-muted/30 gap-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActivePanel(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        activePanel === tab.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Panel */}
            {activePanel === 'ad' && (
              <AdPanel
                brandContext={brandContext}
                onGenerated={handleGenerated}
                prefill={adPrefill}
              />
            )}
            {activePanel === 'image' && (
              <ImagePanel
                onGenerated={handleGenerated}
                prefill={imagePrefill}
              />
            )}
            {activePanel === 'video' && (
              <VideoPanel
                brandContext={brandContext}
                onGenerated={handleGenerated}
                prefill={videoPrefill}
              />
            )}
            {activePanel === 'canva' && (
              <CanvaPanel
                brandContext={brandContext}
                onGenerated={handleGenerated}
              />
            )}
          </div>
        )}

        {/* Unified Gallery */}
        <div className="mt-10">
          <UnifiedGallery items={galleryItems} onClear={handleClearGallery} />
        </div>
      </div>
    </div>
  );
}

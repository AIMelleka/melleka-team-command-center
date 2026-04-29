import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureFreshSession, extractEdgeFunctionError } from '@/lib/supabaseHelpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Brain, Sparkles, Loader2, Wand2, Image as ImageIcon, Video,
  Megaphone, ChevronDown, Target, Palette, Layers,
  Zap, PenLine, Search, Globe, Shield, Users,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ResearchPanel from './ResearchPanel';
import type { BriefAnalysis, CreativeType, BrandContext, ResearchContext, ResearchSourceType } from './types';

interface SmartBriefProps {
  brandContext: BrandContext;
  onAnalysisComplete: (analysis: BriefAnalysis) => void;
  onGenerateNow: (analysis: BriefAnalysis) => void;
  onCustomize: (analysis: BriefAnalysis) => void;
  onResearchUpdate?: (context: ResearchContext) => void;
}

const RESEARCH_THINKING_MESSAGES = [
  'Analyzing research data...',
  'Cross-referencing competitor strategies...',
  'Identifying competitive advantages...',
  'Synthesizing market intelligence...',
  'Crafting research-backed creative strategy...',
  'Optimizing based on competitive insights...',
];

const SOURCE_TYPE_ICONS: Record<ResearchSourceType, typeof Globe> = {
  'website': Globe,
  'ad-transparency': Shield,
  'social-media': Users,
  'seo': Search,
  'ad-screenshot': ImageIcon,
};

const QUICK_SUGGESTIONS = [
  { label: 'Facebook ad for a sale', brief: 'Create a Facebook feed ad for a 30% off summer sale with bold colors and urgency' },
  { label: 'Instagram story ad', brief: 'Design an Instagram story ad for a product launch with premium, luxury feel' },
  { label: 'Product hero image', brief: 'Create a stunning hero image for a tech product landing page, modern and sleek' },
  { label: 'TikTok promo video', brief: 'Generate a short TikTok-style video ad showcasing a product with dynamic energy' },
  { label: 'LinkedIn sponsored post', brief: 'Create a professional LinkedIn sponsored content image for B2B lead generation' },
  { label: 'Restaurant social media', brief: 'Design a mouthwatering Instagram post for a restaurant showcasing their signature dish' },
];

const THINKING_MESSAGES = [
  'Understanding your vision...',
  'Analyzing creative requirements...',
  'Selecting optimal platform & style...',
  'Crafting the perfect prompt...',
  'Finalizing recommendations...',
];

const TYPE_ICONS: Record<CreativeType, typeof Megaphone> = {
  ad: Megaphone,
  image: ImageIcon,
  video: Video,
  canva: PenLine,
};

const TYPE_LABELS: Record<CreativeType, string> = {
  ad: 'Ad Creative',
  image: 'Image',
  video: 'Video',
  canva: 'Canva Design',
};

export function SmartBrief({ brandContext, onAnalysisComplete, onGenerateNow, onCustomize, onResearchUpdate }: SmartBriefProps) {
  const [brief, setBrief] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BriefAnalysis | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [researchExpanded, setResearchExpanded] = useState(false);
  const [researchContext, setResearchContext] = useState<ResearchContext | null>(null);

  const hasResearch = researchContext && researchContext.sources.filter(s => s.status === 'success').length > 0;
  const activeThinkingMessages = hasResearch ? RESEARCH_THINKING_MESSAGES : THINKING_MESSAGES;

  // Rotate thinking messages during analysis
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setThinkingIndex(prev => (prev + 1) % activeThinkingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnalyzing, activeThinkingMessages]);

  const handleAnalyze = async () => {
    if (!brief.trim()) {
      toast.error('Please describe what you need');
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setThinkingIndex(0);

    try {
      const clientContext: Record<string, any> = {};
      if (brandContext.brandName) clientContext.brandName = brandContext.brandName;
      if (brandContext.primaryColor && brandContext.primaryColor !== '#6366f1') {
        clientContext.colors = {
          primary: brandContext.primaryColor,
          secondary: brandContext.secondaryColor,
        };
      }

      await ensureFreshSession();
      const { data, error } = await supabase.functions.invoke('analyze-creative-brief', {
        body: {
          brief: brief.trim(),
          clientContext: Object.keys(clientContext).length > 0 ? clientContext : undefined,
          researchContext: hasResearch ? researchContext : undefined,
        },
      });

      if (error) {
        throw new Error(await extractEdgeFunctionError(error, 'Analysis failed'));
      }

      if (!data?.success || !data?.analysis) {
        throw new Error(data?.error || 'No analysis returned');
      }

      setAnalysis(data.analysis);
      onAnalysisComplete(data.analysis);
      toast.success('Analysis complete!');
    } catch (err: any) {
      console.error('Brief analysis error:', err);
      toast.error(err.message || 'Failed to analyze brief');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setBrief(suggestion);
    setShowSuggestions(false);
    setAnalysis(null);
  };

  const TypeIcon = analysis ? TYPE_ICONS[analysis.outputType] : Brain;

  return (
    <div className="space-y-6">
      {/* Brief Input */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            Describe what you need
          </CardTitle>
          <CardDescription>
            Tell us what you want to create in plain language. AI will figure out the best tool, platform, style, and settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Research Sources - collapsible */}
          <div className="border border-dashed border-primary/30 rounded-xl overflow-hidden">
            <button
              onClick={() => setResearchExpanded(!researchExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Research Sources
                {researchContext && researchContext.sources.filter(s => s.status === 'success').length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {researchContext.sources.filter(s => s.status === 'success').length} researched
                  </Badge>
                )}
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', researchExpanded && 'rotate-180')} />
            </button>
            {researchExpanded && (
              <div className="px-4 pb-4 border-t border-border/50">
                <ResearchPanel
                  onResearchUpdate={(ctx) => {
                    setResearchContext(ctx);
                    onResearchUpdate?.(ctx);
                  }}
                />
              </div>
            )}
          </div>

          {/* Research summary badges when collapsed but has data */}
          {!researchExpanded && researchContext && researchContext.sources.filter(s => s.status === 'success').length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {researchContext.sources.filter(s => s.status === 'success').map(s => {
                const Icon = SOURCE_TYPE_ICONS[s.type];
                return (
                  <Badge key={s.id} variant="outline" className="text-xs gap-1">
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </Badge>
                );
              })}
            </div>
          )}

          <Textarea
            placeholder="e.g. I need a Facebook ad for my restaurant's 20% off lunch special with warm, appetizing food photography..."
            value={brief}
            onChange={(e) => {
              setBrief(e.target.value);
              if (analysis) setAnalysis(null);
            }}
            rows={4}
            className="resize-none text-base"
          />

          {/* Quick Suggestions */}
          {showSuggestions && !brief && (
            <div>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Quick suggestions
              </button>
              <div className="flex flex-wrap gap-2">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestionClick(s.brief)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !brief.trim()}
            className="w-full h-12 text-base font-semibold gap-2"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {activeThinkingMessages[thinkingIndex % activeThinkingMessages.length]}
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                Analyze & Recommend
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card className="border-primary/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              AI Recommendation
              <Badge variant="secondary" className="ml-auto">
                {analysis.confidence}% confident
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Reasoning */}
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              "{analysis.reasoning}"
            </p>

            {/* Config Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge className="gap-1.5 px-3 py-1.5 text-sm">
                <TypeIcon className="h-3.5 w-3.5" />
                {TYPE_LABELS[analysis.outputType]}
              </Badge>
              {analysis.platform && analysis.platform !== 'general' && (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                  <Target className="h-3.5 w-3.5" />
                  {analysis.platform.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              )}
              {analysis.dimensions && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  <Layers className="h-3.5 w-3.5" />
                  {analysis.dimensions.width}x{analysis.dimensions.height}
                </Badge>
              )}
              {analysis.aspectRatio && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  <Layers className="h-3.5 w-3.5" />
                  {analysis.aspectRatio}
                </Badge>
              )}
              {analysis.style && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  <Palette className="h-3.5 w-3.5" />
                  {analysis.style}
                </Badge>
              )}
              {analysis.industry && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  {analysis.industry}
                </Badge>
              )}
              {analysis.campaignType && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  {analysis.campaignType}
                </Badge>
              )}
              {analysis.motionStyle && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  {analysis.motionStyle}
                </Badge>
              )}
            </div>

            {/* Suggested headline & CTA */}
            {(analysis.suggestedHeadline || analysis.suggestedCta) && (
              <div className="flex flex-wrap gap-4 text-sm">
                {analysis.suggestedHeadline && (
                  <div>
                    <span className="text-muted-foreground">Headline: </span>
                    <span className="font-medium">"{analysis.suggestedHeadline}"</span>
                  </div>
                )}
                {analysis.suggestedCta && (
                  <div>
                    <span className="text-muted-foreground">CTA: </span>
                    <span className="font-medium">"{analysis.suggestedCta}"</span>
                  </div>
                )}
              </div>
            )}

            {/* Research-Powered Competitive Insights */}
            {analysis.competitiveInsights && (
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <label className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Competitive Insights</label>
                </div>
                <p className="text-sm leading-relaxed">{analysis.competitiveInsights}</p>
                {analysis.messagingStrategy && (
                  <div>
                    <label className="text-xs text-muted-foreground">Messaging Strategy:</label>
                    <p className="text-sm mt-0.5">{analysis.messagingStrategy}</p>
                  </div>
                )}
                {analysis.differentiators && analysis.differentiators.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground">Differentiators:</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {analysis.differentiators.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-blue-500/5">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.keywordsToInclude && analysis.keywordsToInclude.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground">Keywords to Include:</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {analysis.keywordsToInclude.map((k, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.avoidPatterns && analysis.avoidPatterns.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground">Avoid:</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {analysis.avoidPatterns.map((a, i) => (
                        <Badge key={i} variant="destructive" className="text-xs font-normal">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Prompt Preview */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Enhanced Prompt</label>
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                {analysis.enhancedPrompt}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onCustomize(analysis)}
                className="flex-1 gap-2"
              >
                <PenLine className="h-4 w-4" />
                Customize Manually
              </Button>
              <Button
                onClick={() => onGenerateNow(analysis)}
                className="flex-1 gap-2 font-semibold"
              >
                <Zap className="h-4 w-4" />
                Generate Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

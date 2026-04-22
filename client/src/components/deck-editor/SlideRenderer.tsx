import { Slide } from '@/types/deck';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { 
  TrendingUp, TrendingDown, CheckCircle, Target, 
  ArrowRight, Star, Sparkles, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideRendererProps {
  slide: Slide;
  brandPrimary?: string;
  brandSecondary?: string;
  clientLogo?: string;
  animate?: boolean;
  isPresenting?: boolean;
}

/**
 * Renders a single slide at 1920x1080 native resolution.
 * The parent container handles scaling via CSS transform.
 */
export function SlideRenderer({ slide, brandPrimary = '#6366f1', brandSecondary = '#8b5cf6', clientLogo, animate = false, isPresenting = false }: SlideRendererProps) {
  const bp = brandPrimary;
  const bs = brandSecondary;

  if (!slide) {
    return (
      <div className="w-full h-full bg-[#0a0a14] flex items-center justify-center">
        <p className="text-white/20 text-[28px]">No slide selected</p>
      </div>
    );
  }

  switch (slide.type) {
    case 'title':
      return <TitleSlide slide={slide} bp={bp} bs={bs} logo={clientLogo} />;
    case 'metrics':
      return <MetricsSlide slide={slide} bp={bp} animate={animate} />;
    case 'screenshot':
      return <ScreenshotSlide slide={slide} bp={bp} />;
    case 'platform':
      return <PlatformSlide slide={slide} bp={bp} animate={animate} />;
    case 'insights':
      return <InsightsSlide slide={slide} bp={bp} />;
    case 'action-items':
      return <ActionItemsSlide slide={slide} bp={bp} />;
    case 'section-header':
      return <SectionHeaderSlide slide={slide} bp={bp} />;
    default:
      return <BlankSlide slide={slide} bp={bp} />;
  }
}

// ─── TITLE SLIDE ───────────────────────────────────────────────────────
function TitleSlide({ slide, bp, bs, logo }: { slide: Slide; bp: string; bs: string; logo?: string }) {
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${bp} 0%, ${bs} 50%, ${bp} 100%)` }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-32">
        {logo && (
          <img src={logo} alt="Logo" className="h-24 mb-12 object-contain drop-shadow-2xl" crossOrigin="anonymous" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <h1 className="text-[80px] font-bold leading-tight text-center tracking-tight drop-shadow-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
          {slide.data.headline || slide.title}
        </h1>
        {slide.data.dateRange && (
          <p className="text-[32px] mt-8 opacity-80 font-light tracking-wide">
            {slide.data.dateRange}
          </p>
        )}
        {slide.subtitle && (
          <p className="text-[28px] mt-4 opacity-60 font-light">
            {slide.subtitle}
          </p>
        )}
      </div>
      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/20" />
    </div>
  );
}

// ─── METRICS SLIDE ─────────────────────────────────────────────────────
function MetricsSlide({ slide, bp, animate }: { slide: Slide; bp: string; animate: boolean }) {
  const metrics = slide.data.metrics || [];
  const cols = metrics.length <= 3 ? metrics.length : metrics.length <= 4 ? 2 : 3;
  
  return (
    <div className="w-full h-full bg-[#0a0a14] flex flex-col p-20">
      <h2 className="text-[56px] font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
        {slide.title}
      </h2>
      <div className="h-1.5 w-32 rounded-full mb-16" style={{ background: bp }} />
      
      <div className={`grid gap-10 flex-1 items-center`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {metrics.map((m, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:bg-white/8 transition-colors">
            <p className="text-white/50 text-[24px] mb-4 uppercase tracking-widest font-medium">{m.label}</p>
            <p className="text-[72px] font-bold text-white tabular-nums leading-none">
              {animate ? <AnimatedCounter value={`${m.prefix || ''}${m.decimals ? m.value.toFixed(m.decimals) : m.value.toLocaleString()}${m.suffix || ''}`} /> : <>{m.prefix}{m.decimals ? m.value.toFixed(m.decimals) : m.value.toLocaleString()}{m.suffix}</>}
            </p>
            {m.trend !== undefined && m.trend !== 0 && (
              <div className={cn(
                "flex items-center gap-2 mt-4 text-[20px] font-medium",
                m.trend > 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {m.trend > 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {m.trend > 0 ? '+' : ''}{m.trend}% vs last period
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCREENSHOT SLIDE ──────────────────────────────────────────────────
function ScreenshotSlide({ slide, bp }: { slide: Slide; bp: string }) {
  return (
    <div className="w-full h-full bg-[#0a0a14] flex flex-col p-16">
      <h2 className="text-[44px] font-bold text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
        {slide.title}
      </h2>
      {slide.data.screenshotCaption && (
        <p className="text-white/50 text-[22px] mb-8">{slide.data.screenshotCaption}</p>
      )}
      <div className="flex-1 flex items-center justify-center">
        {slide.data.screenshotUrl ? (
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-h-full">
            <img 
              src={slide.data.screenshotUrl} 
              alt={slide.title}
              className="w-full h-full object-contain max-h-[820px]"
            />
          </div>
        ) : (
          <div className="w-full h-full bg-white/5 rounded-2xl border border-dashed border-white/20 flex items-center justify-center">
            <p className="text-white/30 text-[28px]">No screenshot available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PLATFORM SLIDE ────────────────────────────────────────────────────
function PlatformSlide({ slide, bp, animate }: { slide: Slide; bp: string; animate: boolean }) {
  const platformColors: Record<string, string> = {
    google: '#4285F4',
    meta: '#1877F2',
    sms: '#10b981',
    email: '#8b5cf6',
    workflows: '#f59e0b',
    appointments: '#06b6d4',
    calls: '#6366f1',
    forms: '#ec4899',
    payments: '#22c55e',
    reviews: '#eab308',
  };
  const color = platformColors[slide.data.platform || 'google'] || bp;
  const metrics = slide.data.platformMetrics || [];
  const insights = slide.data.platformInsights || [];
  const screenshots = slide.data.platformScreenshots || [];

  return (
    <div className="w-full h-full bg-[#0a0a14] flex flex-col p-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${color}20` }}>
            <BarChart3 className="w-8 h-8" style={{ color }} />
          </div>
          <div>
            <h2 className="text-[48px] font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              {slide.title}
            </h2>
          </div>
        </div>
        {slide.data.grade && (
          <div className="text-[36px] font-bold px-8 py-3 rounded-2xl border" 
            style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
            {slide.data.grade}
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        {metrics.slice(0, 6).map((m, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-white/40 text-[18px] uppercase tracking-wider mb-2">{m.label}</p>
            <p className="text-[40px] font-bold text-white tabular-nums">
              {animate ? <AnimatedCounter value={`${m.prefix || ''}${m.decimals ? m.value.toFixed(m.decimals) : m.value.toLocaleString()}${m.suffix || ''}`} /> : <>{m.prefix}{m.decimals ? m.value.toFixed(m.decimals) : m.value.toLocaleString()}{m.suffix}</>}
            </p>
          </div>
        ))}
      </div>

      {/* Insights + Screenshot */}
      <div className="flex gap-8 flex-1 min-h-0">
        {insights.length > 0 && (
          <div className="flex-1 space-y-4">
            <h3 className="text-[24px] font-semibold text-white/80 mb-4">Key Insights</h3>
            {insights.slice(0, 4).map((insight, i) => (
              <div key={i} className="flex items-start gap-4 text-white/70 text-[20px]">
                <CheckCircle className="w-6 h-6 mt-1 flex-shrink-0" style={{ color }} />
                <span>{insight}</span>
              </div>
            ))}
          </div>
        )}
        {screenshots.length > 0 && (
          <div className="flex-1 rounded-2xl overflow-hidden border border-white/10">
            <img src={screenshots[0]} alt={slide.title} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INSIGHTS SLIDE ────────────────────────────────────────────────────
function InsightsSlide({ slide, bp }: { slide: Slide; bp: string }) {
  return (
    <div className="w-full h-full bg-[#0a0a14] flex flex-col p-20">
      <h2 className="text-[56px] font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
        {slide.title}
      </h2>
      <div className="h-1.5 w-32 rounded-full mb-12" style={{ background: bp }} />

      {slide.data.summary && (
        <p className="text-white/70 text-[26px] leading-relaxed mb-12 max-w-[1400px]">
          {slide.data.summary}
        </p>
      )}

      {slide.data.wins && slide.data.wins.length > 0 && (
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-6">
            {slide.data.wins.map((win, i) => (
              <div key={i} className="flex items-start gap-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-white/80 text-[22px] leading-relaxed">{win}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ACTION ITEMS SLIDE ────────────────────────────────────────────────
function ActionItemsSlide({ slide, bp }: { slide: Slide; bp: string }) {
  const items = slide.data.actionItems || [];
  const priorityColors = {
    high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
    low: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  };

  return (
    <div className="w-full h-full bg-[#0a0a14] flex flex-col p-20">
      <div className="flex items-center gap-6 mb-12">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${bp}20` }}>
          <Target className="w-8 h-8" style={{ color: bp }} />
        </div>
        <h2 className="text-[56px] font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
          {slide.title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1">
        {items.slice(0, 6).map((item) => {
          const colors = priorityColors[item.priority];
          return (
            <div key={item.id} className={cn("rounded-2xl p-8 border", colors.bg, colors.border)}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-3 h-3 rounded-full", colors.dot)} />
                <span className={cn("text-[18px] font-semibold uppercase tracking-wider", colors.text)}>
                  {item.priority}
                </span>
              </div>
              <h3 className="text-white text-[26px] font-semibold mb-2">{item.title}</h3>
              {item.description && (
                <p className="text-white/50 text-[20px] leading-relaxed">{item.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SECTION HEADER SLIDE ──────────────────────────────────────────────
function SectionHeaderSlide({ slide, bp }: { slide: Slide; bp: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #0a0a14 0%, ${bp}30 100%)` }}>
      <div className="text-center">
        <div className="w-24 h-24 rounded-3xl mx-auto mb-10 flex items-center justify-center" style={{ background: `${bp}20` }}>
          <Sparkles className="w-12 h-12" style={{ color: bp }} />
        </div>
        <h2 className="text-[72px] font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="text-[28px] text-white/50 mt-6">{slide.subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ─── BLANK SLIDE ───────────────────────────────────────────────────────
function BlankSlide({ slide, bp }: { slide: Slide; bp: string }) {
  return (
    <div className="w-full h-full bg-[#0a0a14] flex items-center justify-center">
      <p className="text-white/20 text-[28px]">{slide.title || 'Empty Slide'}</p>
    </div>
  );
}

export default SlideRenderer;

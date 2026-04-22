import { useRef, useEffect, useState, useContext } from 'react';
import { Calendar, ChevronDown, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { cn } from '@/lib/utils';
import { DeckEditContext } from './DeckEditContext';
import { InlineEdit } from './InlineEdit';

export interface HeroMetric {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: number;
  decimals?: number;
  editKey?: string;
}

export interface DeckHeroProps {
  clientName: string;
  clientLogo?: string;
  dateRange: string;
  headline?: string;
  stats: HeroMetric[];
  brandPrimary: string;
  brandSecondary: string;
  brandBackground?: string;
  brandTextPrimary?: string;
  brandTextSecondary?: string;
  overviewScreenshot?: string;
  onScreenshotClick?: (url: string) => void;
}

export const DeckHero = ({
  clientName,
  clientLogo,
  dateRange,
  headline,
  stats,
  brandPrimary,
  brandSecondary,
  brandBackground = '#0a0a0f',
  brandTextPrimary: textPrimaryProp = '#ffffff',
  brandTextSecondary: textSecondaryProp = '#a0a0b0',
  overviewScreenshot,
  onScreenshotClick,
}: DeckHeroProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const editCtx = useContext(DeckEditContext);
  const isEditMode = editCtx?.isEditMode ?? false;

  // Parallax mouse effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setMousePosition({ x: x * 20, y: y * 20 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const isLightColor = (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };

  const hasEnoughContrast = (c1: string, c2: string): boolean =>
    Math.abs(getLuminance(c1) - getLuminance(c2)) > 0.3;

  const bg = brandBackground;
  const isLightBg = isLightColor(bg);
  const textPrimary = (textPrimaryProp && hasEnoughContrast(textPrimaryProp, bg))
    ? textPrimaryProp : (isLightBg ? '#1a1a2e' : '#ffffff');
  const textSecondary = (textSecondaryProp && hasEnoughContrast(textSecondaryProp, bg))
    ? textSecondaryProp : (isLightBg ? '#4a4a5e' : '#a0a0b0');

  const scrollToNext = () => {
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  };

  const formatValue = (value: number, decimals?: number): string => {
    if (decimals !== undefined) {
      return value.toFixed(decimals);
    }
    return String(Math.round(value));
  };

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Animated Gradient Mesh Background */}
      <div className="absolute inset-0">
        {/* Primary gradient orb */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-30 blur-3xl animate-float"
          style={{ 
            background: `radial-gradient(circle, ${brandPrimary} 0%, transparent 70%)`,
            left: '10%',
            top: '10%',
            transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        {/* Secondary gradient orb */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{ 
            background: `radial-gradient(circle, ${brandSecondary} 0%, transparent 70%)`,
            right: '5%',
            bottom: '10%',
            transform: `translate(${-mousePosition.x * 0.5}px, ${-mousePosition.y * 0.5}px)`,
            transition: 'transform 0.3s ease-out',
            animationDelay: '-3s',
          }}
        />
        {/* Subtle grid overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(${brandPrimary}20 1px, transparent 1px), linear-gradient(90deg, ${brandPrimary}20 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-float opacity-30"
            style={{
              background: i % 2 === 0 ? brandPrimary : brandSecondary,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-6xl mx-auto">
        {/* Logo centered */}
        {clientLogo ? (
          <div 
            className="mb-10 flex justify-center"
            style={{
              filter: `drop-shadow(0 0 30px ${brandPrimary}60)`,
            }}
          >
            <img
              src={clientLogo}
              alt={clientName}
              className="h-24 md:h-36 lg:h-44 w-auto object-contain"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ) : (
          <h1 
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: textPrimary }}
          >
            {clientName}
          </h1>
        )}

        {/* Badge */}
        <div 
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium mb-8 backdrop-blur-xl border"
          style={{ 
            backgroundColor: `${brandPrimary}20`, 
            color: brandPrimary,
            borderColor: `${brandPrimary}30`,
          }}
        >
          <Sparkles className="h-4 w-4" />
          Performance Update
        </div>

        {/* Date Range Badge */}
        <div className="flex items-center justify-center gap-3 mb-16" style={{ color: textSecondary }}>
          <Calendar className="h-5 w-5" />
          <span className="text-lg">{dateRange}</span>
        </div>

        {/* Headline insight if provided */}
        {(headline || isEditMode) && (
          <div 
            className="mb-12 max-w-2xl mx-auto"
            style={{ color: brandPrimary }}
          >
            {isEditMode ? (
              <InlineEdit
                value={headline || ''}
                editKey="hero.headline"
                as="p"
                multiline
                className="text-xl md:text-2xl font-medium leading-relaxed"
                style={{ color: brandPrimary }}
              />
            ) : (
              <p className="text-xl md:text-2xl font-medium leading-relaxed">
                "{headline}"
              </p>
            )}
          </div>
        )}

        {/* Hero Metrics Grid */}
        <div className={cn(
          "grid gap-6 mb-16",
          stats.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" :
          stats.length === 3 ? "grid-cols-1 md:grid-cols-3" :
          "grid-cols-2 md:grid-cols-4"
        )}>
          {stats.map((metric, idx) => {
            const valueOverrideKey = metric.editKey || `hero.stat.${idx}.value`;
            const trendOverrideKey = `hero.stat.${idx}.trend`;
            const labelOverrideKey = `hero.stat.${idx}.label`;
            const overriddenValue = editCtx?.overrides?.[valueOverrideKey];
            const overriddenTrend = editCtx?.overrides?.[trendOverrideKey];
            const overriddenLabel = editCtx?.overrides?.[labelOverrideKey];
            const displayValue = overriddenValue !== undefined ? parseFloat(overriddenValue) || 0 : metric.value;
            const displayTrend = overriddenTrend !== undefined ? parseFloat(overriddenTrend) : metric.trend;
            const displayLabel = overriddenLabel ?? metric.label;

            return (
            <div 
              key={idx}
              className="group relative backdrop-blur-xl rounded-3xl p-8 transition-all duration-500 hover:transform hover:scale-[1.02]"
              style={{
                backgroundColor: `${textPrimary}0d`,
                border: `1px solid ${textPrimary}1a`,
                animationDelay: `${idx * 150}ms`,
              }}
            >
              {/* Glow effect on hover */}
              <div 
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
                style={{ 
                  boxShadow: `0 0 60px ${brandPrimary}30`,
                }}
              />
              
              {/* Label */}
              <div className="uppercase text-xs tracking-widest mb-3" style={{ color: textSecondary }}>
                {isEditMode ? (
                  <InlineEdit value={displayLabel} editKey={labelOverrideKey} as="span" className="uppercase text-xs tracking-widest" />
                ) : displayLabel}
              </div>
              
              {/* Value with animated counter or editable input */}
              {isEditMode ? (
                <div className="text-4xl md:text-5xl font-bold tabular-nums flex items-baseline gap-0" style={{ color: textPrimary }}>
                  {metric.prefix && <span>{metric.prefix}</span>}
                  <input
                    type="text"
                    defaultValue={formatValue(displayValue, metric.decimals)}
                    onBlur={(e) => {
                      const raw = e.target.value.replace(/[^0-9.\-]/g, '');
                      const num = parseFloat(raw);
                      if (!isNaN(num)) editCtx?.updateOverride(valueOverrideKey, String(num));
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="bg-transparent border-b border-dashed border-white/30 focus:border-white/60 outline-none text-center min-w-0 text-inherit"
                    style={{ color: textPrimary, width: `${Math.max(3, formatValue(displayValue, metric.decimals).length + 1)}ch` }}
                  />
                  {metric.suffix && <span>{metric.suffix}</span>}
                </div>
              ) : (
                <div className="text-4xl md:text-5xl font-bold tabular-nums" style={{ color: textPrimary }}>
                  {metric.prefix}
                  <AnimatedCounter value={formatValue(displayValue, metric.decimals)} />
                  {metric.suffix}
                </div>
              )}
              
              {/* Trend indicator */}
              {isEditMode ? (
                <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-white/10">
                  {(displayTrend ?? 0) > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <input
                    type="text"
                    defaultValue={displayTrend ? `${displayTrend > 0 ? '+' : ''}${displayTrend.toFixed(1)}%` : ''}
                    placeholder="empty = hidden"
                    onBlur={(e) => {
                      const raw = e.target.value.replace(/[^0-9.\-]/g, '');
                      if (!raw || raw === '0') {
                        editCtx?.updateOverride(trendOverrideKey, '0');
                      } else {
                        const num = parseFloat(raw);
                        if (!isNaN(num)) editCtx?.updateOverride(trendOverrideKey, String(num));
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="bg-transparent border-b border-dashed border-white/30 focus:border-white/60 outline-none w-24 text-inherit text-sm"
                    style={{ color: textPrimary }}
                  />
                </div>
              ) : (
                displayTrend != null && displayTrend !== 0 && (
                <div 
                  className={cn(
                    "mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                    displayTrend > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  )}
                >
                  {displayTrend > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {displayTrend > 0 ? '+' : ''}{displayTrend.toFixed(1)}%
                </div>
                )
              )}
            </div>
            );
          })}
        </div>

        {/* Overview Screenshot Preview */}
        {overviewScreenshot && (
          <div 
            className="mb-12 rounded-2xl overflow-hidden shadow-2xl border border-white/10 cursor-zoom-in transform hover:scale-[1.02] transition-transform max-w-4xl mx-auto"
            onClick={() => onScreenshotClick?.(overviewScreenshot)}
          >
            <img 
              src={overviewScreenshot} 
              alt="Dashboard Overview" 
              className="w-full"
            />
          </div>
        )}

        {/* Scroll indicator */}
        <button 
          onClick={scrollToNext}
          className="group inline-flex flex-col items-center gap-2 transition-colors"
          style={{ color: textSecondary }}
        >
          <span className="text-sm uppercase tracking-widest">Scroll to explore</span>
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </button>
      </div>
    </div>
  );
};

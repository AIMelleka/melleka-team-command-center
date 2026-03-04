import { AnimatedSection } from './AnimatedSection';
import { Search, TrendingUp, MapPin, Ban, Target, ArrowUpRight, ArrowDownRight, Minus, Sparkles, Crosshair, Zap, Star } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';
import { isLightColor } from './PlatformLogos';


interface KeywordStrategyProps {
  keywordStrategy: {
    primaryKeywords?: Array<{
      keyword: string;
      intent: string;
      priority: string;
      monthlySearches: string;
      difficulty?: string;
    }>;
    longTailKeywords?: Array<{
      keyword: string;
      intent: string;
      priority: string;
      monthlySearches: string;
    }>;
    localKeywords?: string[];
    negativeKeywords?: string[];
    keywordGaps?: string[];
  };
  liveSeoData?: {
    topKeywords?: Array<{
      keyword: string;
      position: number;
      volume: number;
      difficulty: number;
    }>;
    keywordGap?: Array<{
      keyword: string;
      competitorPosition: number;
      volume: number;
      difficulty: number;
      competitorDomain: string;
    }>;
    domain?: string;
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  clientName: string;
}

const getPriorityColor = (priority: string | undefined | null, primaryColor: string, secondaryColor: string) => {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'high') return { bg: `rgba(34, 197, 94, 0.15)`, text: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)' };
  if (p === 'medium') return { bg: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`, text: secondaryColor, glow: `color-mix(in srgb, ${secondaryColor} 30%, transparent)` };
  return { bg: `color-mix(in srgb, ${primaryColor} 15%, transparent)`, text: primaryColor, glow: `color-mix(in srgb, ${primaryColor} 30%, transparent)` };
};

const getIntentIcon = (intent: string | undefined | null, color: string) => {
  const i = (intent || 'navigational').toLowerCase();
  if (i === 'commercial' || i === 'transactional') return <TrendingUp className="w-4 h-4" style={{ color }} />;
  if (i === 'informational') return <Search className="w-4 h-4" style={{ color }} />;
  return <Target className="w-4 h-4" style={{ color }} />;
};

const getDifficultyIndicator = (difficulty?: string) => {
  const d = difficulty?.toLowerCase() || 'medium';
  if (d === 'low' || d === 'easy') return { icon: ArrowDownRight, color: '#22c55e', label: 'Easy', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)' };
  if (d === 'high' || d === 'hard') return { icon: ArrowUpRight, color: '#ef4444', label: 'Hard', gradient: 'linear-gradient(135deg, #ef4444, #f87171)' };
  return { icon: Minus, color: '#f59e0b', label: 'Medium', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' };
};

// Helper to convert live SEO keywords to the component's format
const convertLiveKeywords = (liveKeywords: KeywordStrategyProps['liveSeoData']['topKeywords']): KeywordStrategyProps['keywordStrategy']['primaryKeywords'] => {
  if (!liveKeywords || liveKeywords.length === 0) return undefined;
  return liveKeywords.map(kw => ({
    keyword: kw.keyword,
    intent: kw.position <= 3 ? 'Commercial' : kw.position <= 10 ? 'Transactional' : 'Informational',
    priority: kw.difficulty < 30 ? 'High' : kw.difficulty < 60 ? 'Medium' : 'Low',
    monthlySearches: kw.volume?.toLocaleString() || '0',
    difficulty: kw.difficulty < 30 ? 'Low' : kw.difficulty < 60 ? 'Medium' : 'High'
  }));
};

// Helper to convert live keyword gaps to simple string array
const convertLiveGaps = (liveGaps: KeywordStrategyProps['liveSeoData']['keywordGap']): string[] => {
  if (!liveGaps || liveGaps.length === 0) return [];
  return liveGaps.map(gap => gap.keyword);
};

export const KeywordStrategy = ({
  keywordStrategy,
  liveSeoData,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  clientName
}: KeywordStrategyProps) => {
  // Use live SEO data if available, otherwise fall back to static AI-generated data
  const hasLiveData = liveSeoData?.topKeywords && liveSeoData.topKeywords.length > 0;
  
  const displayKeywords = hasLiveData 
    ? convertLiveKeywords(liveSeoData?.topKeywords) 
    : keywordStrategy.primaryKeywords;
  
  const displayGaps = hasLiveData && liveSeoData?.keywordGap && liveSeoData.keywordGap.length > 0
    ? convertLiveGaps(liveSeoData?.keywordGap)
    : keywordStrategy.keywordGaps;
    
  // Calculate stats from displayed data
  const totalKeywords = (displayKeywords?.length || 0) + (keywordStrategy.longTailKeywords?.length || 0);
  const localCount = keywordStrategy.localKeywords?.length || 0;
  const gapCount = displayGaps?.length || 0;
  
  // For display purposes, show the searched domain if live data is active
  const displayClientName = hasLiveData && liveSeoData?.domain 
    ? liveSeoData.domain.replace(/^www\./, '').split('.')[0] 
    : clientName;

  return (
    <section id="keyword-strategy" className="py-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-20 right-20 w-80 h-80 rounded-full blur-[120px] opacity-15 animate-pulse"
          style={{ backgroundColor: primaryColor, animationDuration: '6s' }}
        />
        <div 
          className="absolute bottom-40 left-10 w-64 h-64 rounded-full blur-[100px] opacity-20 animate-pulse"
          style={{ backgroundColor: secondaryColor, animationDuration: '8s' }}
        />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Premium Header */}
        <AnimatedSection>
          <div className="text-center mb-10 sm:mb-16 px-2">
            <div 
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6"
              style={{ 
                background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`,
                border: `1px solid color-mix(in srgb, ${primaryColor} 30%, transparent)`
              }}
            >
              <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: primaryColor }} />
              <span className="text-xs sm:text-sm font-medium" style={{ color: primaryColor }}>SEO & PPC Intelligence</span>
            </div>
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6"
              style={{ color: textColor }}
            >
              Strategic <span style={{ color: primaryColor }}>Keyword Targeting</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg max-w-3xl mx-auto mb-6 sm:mb-8" style={{ color: textMutedColor }}>
              Data-driven keyword research tailored for {displayClientName}'s market dominance.
              {hasLiveData && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${primaryColor} 20%, transparent)`, color: primaryColor }}>🔴 LIVE DATA</span>}
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 8px 32px color-mix(in srgb, ${primaryColor} 10%, transparent)`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                  <AnimatedCounter value={`${totalKeywords}+`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Keywords Identified</p>
              </div>
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: secondaryColor }}>
                  <AnimatedCounter value={`${localCount}`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Local Terms</p>
              </div>
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: '#22c55e' }}>
                  <AnimatedCounter value={`${gapCount}`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Competitor Gaps</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Primary Keywords - Premium Table Design */}
        {displayKeywords && displayKeywords.length > 0 && (
          <AnimatedSection delay={100}>
            <div 
              className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl mb-6 sm:mb-10 relative overflow-hidden"
              style={{ 
                backgroundColor: cardBackground, 
                border: `1px solid ${borderColor}`,
                boxShadow: `0 16px 48px color-mix(in srgb, ${primaryColor} 10%, transparent)`
              }}
            >
              {/* Accent line */}
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}
              />

              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    boxShadow: `0 8px 24px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                  }}
                >
                  <Target className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold truncate" style={{ color: textColor }}>
                    Primary Keywords
                  </h3>
                  <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>High-priority terms for immediate targeting</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: textMutedColor }}>Keyword</th>
                      <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: textMutedColor }}>Intent</th>
                      <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: textMutedColor }}>Searches/mo</th>
                      <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: textMutedColor }}>Difficulty</th>
                      <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: textMutedColor }}>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayKeywords.map((kw, i) => {
                      const priorityStyle = getPriorityColor(kw.priority, primaryColor, secondaryColor);
                      const diffIndicator = getDifficultyIndicator(kw.difficulty);
                      const DiffIcon = diffIndicator.icon;
                      
                      return (
                        <tr 
                          key={i} 
                          className="transition-all duration-300 hover:scale-[1.01]"
                          style={{ 
                            borderBottom: `1px solid ${borderColor}`,
                            background: i === 0 ? `linear-gradient(90deg, color-mix(in srgb, ${primaryColor} 5%, transparent), transparent)` : 'transparent'
                          }}
                        >
                          <td className="py-5 px-4">
                            <div className="flex items-center gap-3">
                              {i === 0 && <Star className="w-4 h-4" style={{ color: secondaryColor }} />}
                              <span className="font-semibold" style={{ color: textColor }}>{kw.keyword}</span>
                            </div>
                          </td>
                          <td className="py-5 px-4">
                            <div 
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                              style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)` }}
                            >
                              {getIntentIcon(kw.intent, primaryColor)}
                              <span className="text-sm" style={{ color: textMutedColor }}>{kw.intent}</span>
                            </div>
                          </td>
                          <td className="py-5 px-4">
                            <span className="text-lg font-bold" style={{ color: secondaryColor }}>
                              {kw.monthlySearches}
                            </span>
                          </td>
                          <td className="py-5 px-4">
                            <div 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                              style={{ background: `${diffIndicator.color}15` }}
                            >
                              <DiffIcon className="w-4 h-4" style={{ color: diffIndicator.color }} />
                              <span className="text-sm font-medium" style={{ color: diffIndicator.color }}>
                                {diffIndicator.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-5 px-4">
                            <span 
                              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
                              style={{ 
                                backgroundColor: priorityStyle.bg, 
                                color: priorityStyle.text,
                                boxShadow: `0 2px 8px ${priorityStyle.glow}`
                              }}
                            >
                              {kw.priority}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Long-tail Keywords - Grid Cards */}
        {keywordStrategy.longTailKeywords && keywordStrategy.longTailKeywords.length > 0 && (
          <AnimatedSection delay={200}>
            <div 
              className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl mb-6 sm:mb-10 relative overflow-hidden"
              style={{ 
                backgroundColor: cardBackground, 
                border: `1px solid ${borderColor}`
              }}
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ 
                    background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`,
                    boxShadow: `0 8px 24px color-mix(in srgb, ${secondaryColor} 30%, transparent)`
                  }}
                >
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold truncate" style={{ color: textColor }}>
                    Long-Tail Keywords
                  </h3>
                  <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>Lower competition, higher conversion potential</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {keywordStrategy.longTailKeywords.map((kw, i) => {
                  const priorityStyle = getPriorityColor(kw.priority, primaryColor, secondaryColor);
                  
                  return (
                    <div 
                      key={i}
                      className="group p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
                      style={{ 
                        background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 8%, transparent), color-mix(in srgb, ${primaryColor} 4%, transparent))`,
                        border: `1px solid ${borderColor}`
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <span className="text-xs sm:text-sm font-semibold leading-tight line-clamp-2" style={{ color: textColor }}>
                          {kw.keyword}
                        </span>
                        <span 
                          className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.text }}
                        >
                          {kw.priority}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs" style={{ color: textMutedColor }}>
                        <span className="flex items-center gap-1">
                          {getIntentIcon(kw.intent, textMutedColor)}
                          <span className="truncate max-w-[80px] sm:max-w-none">{kw.intent}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="font-semibold" style={{ color: secondaryColor }}>{kw.monthlySearches}/mo</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Local & Negative Keywords Row */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Local Keywords */}
          {keywordStrategy.localKeywords && keywordStrategy.localKeywords.length > 0 && (
            <AnimatedSection delay={300}>
              <div 
                className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl h-full relative overflow-hidden"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, #3b82f6)`,
                      boxShadow: `0 6px 20px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                    }}
                  >
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-display font-bold truncate" style={{ color: textColor }}>
                      Local Keywords
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>Geo-targeted terms</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {keywordStrategy.localKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all hover:scale-105"
                      style={{ 
                        background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, transparent), color-mix(in srgb, #3b82f6 10%, transparent))`,
                        color: textColor,
                        border: `1px solid color-mix(in srgb, ${primaryColor} 25%, transparent)`
                      }}
                    >
                      📍 {kw}
                    </span>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Negative Keywords */}
          {keywordStrategy.negativeKeywords && keywordStrategy.negativeKeywords.length > 0 && (
            <AnimatedSection delay={400}>
              <div 
                className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl h-full relative overflow-hidden"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: 'linear-gradient(135deg, #ef4444, #f87171)',
                      boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    <Ban className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-display font-bold truncate" style={{ color: textColor }}>
                      Negative Keywords
                    </h3>
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                      Excluded from ads
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm mb-3 sm:mb-4" style={{ color: textMutedColor }}>
                  These terms will be blocked to prevent wasted ad spend:
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {keywordStrategy.negativeKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm line-through opacity-70"
                      style={{ 
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        color: textMutedColor
                      }}
                    >
                      🚫 {kw}
                    </span>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>

        {/* Keyword Gaps - Opportunity Section */}
        {displayGaps && displayGaps.length > 0 && (
          <AnimatedSection delay={500}>
            <div 
              className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl mt-6 sm:mt-10 relative overflow-hidden"
              style={{ 
                background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 10%, ${cardBackground}), color-mix(in srgb, ${secondaryColor} 8%, ${cardBackground}))`,
                border: `2px solid color-mix(in srgb, ${secondaryColor} 30%, transparent)`,
                boxShadow: `0 16px 48px color-mix(in srgb, ${secondaryColor} 15%, transparent)`
              }}
            >
              {/* Decorative elements */}
              <div 
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 hidden sm:block"
                style={{ backgroundColor: secondaryColor }}
              />
              
              <div className="relative">
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`,
                      boxShadow: `0 8px 24px color-mix(in srgb, ${secondaryColor} 40%, transparent)`
                    }}
                  >
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold truncate" style={{ color: textColor }}>
                      Competitor Keyword Gaps
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold"
                        style={{ background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`, color: 'white' }}
                      >
                        🎯 OPPORTUNITIES
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs sm:text-sm mb-4 sm:mb-6" style={{ color: textMutedColor }}>
                  Keywords your competitors rank for that {displayClientName} is missing. Untapped potential waiting to be captured:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {displayGaps.map((kw, i) => (
                    <div 
                      key={i}
                      className="group flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all duration-300 hover:scale-[1.03]"
                      style={{ 
                        background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 15%, transparent), color-mix(in srgb, ${primaryColor} 8%, transparent))`,
                        border: `1px solid color-mix(in srgb, ${secondaryColor} 25%, transparent)`
                      }}
                    >
                      <div 
                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${secondaryColor} 20%, transparent)` }}
                      >
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: secondaryColor }} />
                      </div>
                      <span className="text-xs sm:text-sm font-medium line-clamp-2" style={{ color: textColor }}>{kw}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </section>
  );
};
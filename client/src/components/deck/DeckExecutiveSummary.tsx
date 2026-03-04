import { useState, useEffect, useContext } from 'react';
import { 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Lightbulb,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeckEditContext } from './DeckEditContext';
import { InlineEdit } from './InlineEdit';

export interface DeckExecutiveSummaryProps {
  summary: string;
  keyWins?: string[];
  challenges?: string[];
  periodComparison?: {
    label: string;
    current: number;
    previous: number;
    unit?: string;
  }[];
  brandColor?: string;
  animateText?: boolean;
  /** Edit key prefix — if provided, all text fields become inline editable */
  editKeyPrefix?: string;
}

export const DeckExecutiveSummary = ({
  summary,
  keyWins = [],
  challenges = [],
  periodComparison = [],
  brandColor = '#6366f1',
  animateText = true,
  editKeyPrefix = 'hero',
}: DeckExecutiveSummaryProps) => {
  const editCtx = useContext(DeckEditContext);
  const isEditMode = editCtx?.isEditMode ?? false;
  const overrides = editCtx?.overrides ?? {};

  // Use override values when available
  const displaySummary = overrides[`${editKeyPrefix}.executiveSummary`] ?? summary;

  const [displayedText, setDisplayedText] = useState(animateText && !isEditMode ? '' : displaySummary);
  const [isAnimating, setIsAnimating] = useState(animateText && !isEditMode);

  // Typewriter effect for summary (skip in edit mode)
  useEffect(() => {
    if (!animateText || !displaySummary || isEditMode) {
      setDisplayedText(displaySummary);
      setIsAnimating(false);
      return;
    }
    
    let i = 0;
    setDisplayedText('');
    setIsAnimating(true);
    const interval = setInterval(() => {
      if (i < displaySummary.length) {
        setDisplayedText(displaySummary.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [displaySummary, animateText, isEditMode]);

  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="relative">
      {/* Gradient border wrapper */}
      <div className="neon-gradient-border rounded-3xl p-[1px]">
        <div className="bg-[#0a0a1a]/90 backdrop-blur-xl rounded-3xl p-8 md:p-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${brandColor}20` }}
            >
              <Sparkles className="h-6 w-6" style={{ color: brandColor }} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                The Story
              </h2>
              <p className="text-white/50 text-sm">Executive Summary</p>
            </div>
          </div>

          {/* Main Summary */}
          <div className="mb-10">
            {isEditMode ? (
              <InlineEdit
                value={summary}
                editKey={`${editKeyPrefix}.executiveSummary`}
                as="p"
                multiline
                className="text-xl md:text-2xl text-white/90 leading-relaxed font-light"
              />
            ) : (
              <p className="text-xl md:text-2xl text-white/90 leading-relaxed font-light">
                {displayedText}
                {isAnimating && (
                  <span 
                    className="inline-block w-0.5 h-6 ml-1 animate-pulse"
                    style={{ backgroundColor: brandColor }}
                  />
                )}
              </p>
            )}
          </div>

          {/* Period Comparison Pills */}
          {periodComparison.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-10">
              {periodComparison.map((item, idx) => {
                const change = calculateChange(item.current, item.previous);
                const isPositive = change >= 0;
                
                return (
                  <div 
                    key={idx}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                      isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>{item.label}:</span>
                    <span className="font-bold">
                      {isPositive ? '+' : ''}{change.toFixed(1)}%
                    </span>
                    <span className="text-white/40 text-xs">
                      vs prev period
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Key Wins & Challenges Grid */}
          {(keyWins.length > 0 || challenges.length > 0 || isEditMode) && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Key Wins */}
              {(keyWins.length > 0 || isEditMode) && (
                <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-lg font-semibold text-emerald-400">Key Wins</h3>
                  </div>
                  <ul className="space-y-3">
                    {keyWins.map((win, idx) => (
                      <li 
                        key={idx}
                        className="flex items-start gap-3 text-white/80"
                      >
                        <ArrowUpRight className="h-4 w-4 text-emerald-400 mt-1 flex-shrink-0" />
                        <InlineEdit
                          value={win}
                          editKey={`${editKeyPrefix}.keyWins.${idx}`}
                          as="span"
                          className="text-white/80"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Challenges */}
              {(challenges.length > 0 || isEditMode) && (
                <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-amber-400">Areas of Focus</h3>
                  </div>
                  <ul className="space-y-3">
                    {challenges.map((challenge, idx) => (
                      <li 
                        key={idx}
                        className="flex items-start gap-3 text-white/80"
                      >
                        <Lightbulb className="h-4 w-4 text-amber-400 mt-1 flex-shrink-0" />
                        <InlineEdit
                          value={challenge}
                          editKey={`${editKeyPrefix}.challenges.${idx}`}
                          as="span"
                          className="text-white/80"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Decorative glow */}
      <div 
        className="absolute -inset-4 -z-10 opacity-30 blur-3xl"
        style={{
          background: `linear-gradient(135deg, ${brandColor}20 0%, ${brandColor}10 100%)`,
        }}
      />
    </div>
  );
};

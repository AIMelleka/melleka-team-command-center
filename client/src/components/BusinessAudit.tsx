import { AnimatedSection } from './AnimatedSection';
import { CheckCircle2, AlertTriangle, Target, Zap, TrendingUp, ArrowRight } from 'lucide-react';

interface BusinessAuditProps {
  businessAudit: {
    currentStrengths?: string[];
    improvementOpportunities?: string[];
    competitiveGaps?: string[];
    quickWins?: string[];
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  clientName: string;
}

export const BusinessAudit = ({
  businessAudit,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  clientName
}: BusinessAuditProps) => {
  const { currentStrengths, improvementOpportunities, competitiveGaps, quickWins } = businessAudit;

  return (
    <section id="business-audit" className="py-16 sm:py-20 md:py-24 bg-card/30 overflow-hidden">
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-8 sm:mb-12 px-2">
            <p 
              className="font-medium uppercase tracking-widest text-xs sm:text-sm mb-3 sm:mb-4"
              style={{ color: secondaryColor }}
            >
              We've Done Our Homework
            </p>
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6"
              style={{ color: textColor }}
            >
              Business Audit
            </h2>
            <p className="text-sm sm:text-base md:text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
              Here's what we discovered analyzing {clientName}'s digital presence and competitive landscape.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Current Strengths */}
          {currentStrengths && currentStrengths.length > 0 && (
            <AnimatedSection delay={100}>
              <div 
                className="p-4 sm:p-6 rounded-xl sm:rounded-2xl h-full"
                style={{ backgroundColor: cardBackground, border: `1px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
                  >
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-semibold truncate" style={{ color: textColor }}>
                      Current Strengths
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>What's working well</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {currentStrengths.map((strength, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all hover:scale-[1.01]"
                      style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
                    >
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm" style={{ color: textColor }}>{strength}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Improvement Opportunities */}
          {improvementOpportunities && improvementOpportunities.length > 0 && (
            <AnimatedSection delay={200}>
              <div 
                className="p-4 sm:p-6 rounded-xl sm:rounded-2xl h-full"
                style={{ backgroundColor: cardBackground, border: `1px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}
                  >
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-semibold truncate" style={{ color: textColor }}>
                      Areas to Improve
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>Opportunities we identified</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {improvementOpportunities.map((opp, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all hover:scale-[1.01]"
                      style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
                    >
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm" style={{ color: textColor }}>{opp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Competitive Gaps */}
          {competitiveGaps && competitiveGaps.length > 0 && (
            <AnimatedSection delay={300}>
              <div 
                className="p-4 sm:p-6 rounded-xl sm:rounded-2xl h-full"
                style={{ backgroundColor: cardBackground, border: `1px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)` }}
                  >
                    <Target className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-semibold truncate" style={{ color: textColor }}>
                      Competitive Gaps
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>What competitors are missing</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {competitiveGaps.map((gap, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all hover:scale-[1.01]"
                      style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)` }}
                    >
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} />
                      <span className="text-xs sm:text-sm" style={{ color: textColor }}>{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Quick Wins */}
          {quickWins && quickWins.length > 0 && (
            <AnimatedSection delay={400}>
              <div 
                className="p-4 sm:p-6 rounded-xl sm:rounded-2xl h-full relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, ${cardBackground}), color-mix(in srgb, ${secondaryColor} 15%, ${cardBackground}))`,
                  border: `2px solid ${secondaryColor}` 
                }}
              >
                {/* Badge */}
                <div 
                  className="absolute top-0 right-0 px-3 sm:px-4 py-1 rounded-bl-lg sm:rounded-bl-xl text-[10px] sm:text-xs font-bold"
                  style={{ backgroundColor: secondaryColor, color: '#1a1a2e' }}
                >
                  QUICK WINS
                </div>

                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 mt-4 sm:mt-0">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 30%, transparent)` }}
                  >
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: secondaryColor }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-semibold truncate" style={{ color: textColor }}>
                      30-Day Quick Wins
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>Immediate impact actions</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {quickWins.map((win, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all hover:scale-[1.01]"
                      style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)` }}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: secondaryColor, color: '#1a1a2e' }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs sm:text-sm" style={{ color: textColor }}>{win}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: secondaryColor }} />
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </section>
  );
};

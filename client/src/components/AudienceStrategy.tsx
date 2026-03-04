import { AnimatedSection } from './AnimatedSection';
import { Users, Target, Heart, AlertCircle, Zap, Eye, ShoppingCart, Search, UserCheck, Sparkles, Brain, Crosshair, TrendingUp } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';
import { isLightColor } from './PlatformLogos';

interface AudienceStrategyProps {
  audienceStrategy: {
    primaryPersona?: {
      name?: string;
      demographics?: string;
      psychographics?: string;
      painPoints?: string[];
      triggers?: string[];
      objections?: string[];
    };
    secondaryPersona?: {
      name?: string;
      demographics?: string;
      psychographics?: string;
      painPoints?: string[];
      triggers?: string[];
      objections?: string[];
    };
    metaTargeting?: {
      interests?: string[];
      behaviors?: string[];
      customAudiences?: string[];
      lookalikeStrategy?: string;
    };
    googleAudiences?: {
      inMarket?: string[];
      affinity?: string[];
      customIntent?: string[];
    };
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  clientName: string;
}

export const AudienceStrategy = ({
  audienceStrategy,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  clientName
}: AudienceStrategyProps) => {
  const { primaryPersona, secondaryPersona, metaTargeting, googleAudiences } = audienceStrategy;

  // Calculate stats for the hero metrics
  const totalInterests = (metaTargeting?.interests?.length || 0) + (metaTargeting?.behaviors?.length || 0);
  const totalAudiences = (googleAudiences?.inMarket?.length || 0) + (googleAudiences?.affinity?.length || 0);
  const painPointCount = (primaryPersona?.painPoints?.length || 0) + (secondaryPersona?.painPoints?.length || 0);

  return (
    <section id="target-personas" className="py-24 relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-20 right-10 w-72 h-72 rounded-full blur-[100px] opacity-20 animate-pulse"
          style={{ backgroundColor: primaryColor, animationDuration: '5s' }}
        />
        <div 
          className="absolute bottom-20 left-10 w-64 h-64 rounded-full blur-[80px] opacity-15 animate-pulse"
          style={{ backgroundColor: secondaryColor, animationDuration: '7s' }}
        />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Premium Section Header */}
        <AnimatedSection>
          <div className="text-center mb-10 sm:mb-16 px-2">
            <div 
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6"
              style={{ 
                background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`,
                border: `1px solid color-mix(in srgb, ${primaryColor} 30%, transparent)`
              }}
            >
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: primaryColor }} />
              <span className="text-xs sm:text-sm font-medium" style={{ color: primaryColor }}>In-Depth Audience Analysis</span>
            </div>
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6"
              style={{ color: textColor }}
            >
              Know Your <span style={{ color: primaryColor }}>Ideal Customer</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg max-w-3xl mx-auto mb-6 sm:mb-8" style={{ color: textMutedColor }}>
              Deep psychographic profiling and precision targeting strategies designed specifically for {clientName}'s audience.
            </p>

            {/* Key Metrics Row */}
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
                  <AnimatedCounter value={`${totalInterests}+`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Interest Signals</p>
              </div>
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 8px 32px color-mix(in srgb, ${secondaryColor} 10%, transparent)`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: secondaryColor }}>
                  <AnimatedCounter value={`${totalAudiences}+`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Audience Segments</p>
              </div>
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                  <AnimatedCounter value={`${painPointCount}`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Pain Points Mapped</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Personas Row - 3D Card Effect */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12">
          {/* Primary Persona */}
          {primaryPersona && (
            <AnimatedSection delay={100}>
              <div 
                className="group p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl h-full relative overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `2px solid ${primaryColor}`,
                  boxShadow: `0 20px 60px color-mix(in srgb, ${primaryColor} 20%, transparent)`
                }}
              >
                {/* Animated Glow Effect */}
                <div 
                  className="absolute -inset-1 rounded-2xl sm:rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${secondaryColor}20)` }}
                />
                
                {/* Premium Badge */}
                <div 
                  className="absolute top-0 right-0 px-3 sm:px-5 py-1.5 sm:py-2 rounded-bl-xl sm:rounded-bl-2xl text-[10px] sm:text-xs font-bold tracking-wider"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 70%, ${secondaryColor}))`,
                    color: isLightColor(primaryColor) ? '#1a1a2e' : 'white',
                    boxShadow: `0 4px 12px color-mix(in srgb, ${primaryColor} 40%, transparent)`
                  }}
                >
                  PRIMARY TARGET
                </div>

                <div className="flex items-start gap-3 sm:gap-5 mb-6 sm:mb-8 mt-6 sm:mt-0">
                  <div 
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 relative"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 60%, ${secondaryColor}))`,
                      boxShadow: `0 8px 24px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                    }}
                  >
                    <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                    {/* Pulse ring */}
                    <div 
                      className="absolute inset-0 rounded-xl sm:rounded-2xl animate-ping opacity-20"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold mb-1 line-clamp-2" style={{ color: textColor }}>
                      {primaryPersona.name || 'Primary Customer'}
                    </h3>
                    <p className="text-xs sm:text-sm line-clamp-2" style={{ color: textMutedColor }}>
                      {primaryPersona.demographics}
                    </p>
                  </div>
                </div>

                {/* Psychographic Quote */}
                {primaryPersona.psychographics && (
                  <div 
                    className="mb-6 p-5 rounded-2xl relative overflow-hidden"
                    style={{ 
                      background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 10%, transparent), color-mix(in srgb, ${secondaryColor} 5%, transparent))`,
                      borderLeft: `4px solid ${primaryColor}`
                    }}
                  >
                    <Sparkles className="absolute top-3 right-3 w-5 h-5 opacity-40" style={{ color: primaryColor }} />
                    <p className="text-sm italic" style={{ color: textMutedColor }}>
                      "{primaryPersona.psychographics}"
                    </p>
                  </div>
                )}

                {/* Pain Points with Visual Enhancement */}
                {primaryPersona.painPoints && primaryPersona.painPoints.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
                      >
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMutedColor }}>
                        Pain Points We'll Solve
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {primaryPersona.painPoints.map((point, i) => (
                        <div 
                          key={i} 
                          className="flex items-start gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                        >
                          <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-red-400" />
                          <span className="text-sm" style={{ color: textColor }}>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Triggers with Pill Design */}
                {primaryPersona.triggers && primaryPersona.triggers.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)` }}
                      >
                        <Zap className="w-4 h-4" style={{ color: secondaryColor }} />
                      </div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMutedColor }}>
                        Purchase Triggers
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {primaryPersona.triggers.map((trigger, i) => (
                        <span
                          key={i}
                          className="px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                          style={{ 
                            background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 20%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`,
                            color: secondaryColor,
                            border: `1px solid color-mix(in srgb, ${secondaryColor} 30%, transparent)`
                          }}
                        >
                          ⚡ {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objections with Modern Design */}
                {primaryPersona.objections && primaryPersona.objections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 50%, transparent)` }}
                      >
                        <Crosshair className="w-4 h-4" style={{ color: textMutedColor }} />
                      </div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMutedColor }}>
                        Objections We'll Overcome
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {primaryPersona.objections.map((objection, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-3 p-3 rounded-xl text-sm"
                          style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 30%, transparent)` }}
                        >
                          <span className="text-lg">🎯</span>
                          <span style={{ color: textMutedColor }}>{objection}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AnimatedSection>
          )}

          {/* Secondary Persona */}
          {secondaryPersona && (
            <AnimatedSection delay={200}>
              <div 
                className="group p-8 rounded-3xl h-full relative overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`,
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.06)'
                }}
              >
                {/* Badge */}
                <div 
                  className="absolute top-0 right-0 px-5 py-2 rounded-bl-2xl text-xs font-bold tracking-wider"
                  style={{ backgroundColor: borderColor, color: textMutedColor }}
                >
                  SECONDARY AUDIENCE
                </div>

                <div className="flex items-start gap-5 mb-8">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`,
                      boxShadow: `0 8px 24px color-mix(in srgb, ${secondaryColor} 20%, transparent)`
                    }}
                  >
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold mb-1" style={{ color: textColor }}>
                      {secondaryPersona.name || 'Secondary Customer'}
                    </h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>
                      {secondaryPersona.demographics}
                    </p>
                  </div>
                </div>

                {secondaryPersona.psychographics && (
                  <div 
                    className="mb-6 p-5 rounded-2xl"
                    style={{ 
                      background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 8%, transparent), color-mix(in srgb, ${primaryColor} 4%, transparent))`,
                      borderLeft: `4px solid ${secondaryColor}`
                    }}
                  >
                    <p className="text-sm italic" style={{ color: textMutedColor }}>
                      "{secondaryPersona.psychographics}"
                    </p>
                  </div>
                )}

                {secondaryPersona.painPoints && secondaryPersona.painPoints.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
                      >
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMutedColor }}>
                        Pain Points
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {secondaryPersona.painPoints.map((point, i) => (
                        <div 
                          key={i} 
                          className="flex items-start gap-3 p-3 rounded-xl"
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                        >
                          <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-red-400" />
                          <span className="text-sm" style={{ color: textColor }}>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Triggers for Secondary Persona */}
                {secondaryPersona.triggers && secondaryPersona.triggers.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)` }}
                      >
                        <Zap className="w-4 h-4" style={{ color: secondaryColor }} />
                      </div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMutedColor }}>
                        Purchase Triggers
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {secondaryPersona.triggers.map((trigger, i) => (
                        <span
                          key={i}
                          className="px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                          style={{ 
                            background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 20%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`,
                            color: secondaryColor,
                            border: `1px solid color-mix(in srgb, ${secondaryColor} 30%, transparent)`
                          }}
                        >
                          ⚡ {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objections for Secondary Persona */}
                {secondaryPersona.objections && secondaryPersona.objections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 50%, transparent)` }}
                      >
                        <Crosshair className="w-4 h-4" style={{ color: textMutedColor }} />
                      </div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMutedColor }}>
                        Objections We'll Overcome
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {secondaryPersona.objections.map((objection, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-3 p-3 rounded-xl text-sm"
                          style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 30%, transparent)` }}
                        >
                          <span className="text-lg">🎯</span>
                          <span style={{ color: textMutedColor }}>{objection}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AnimatedSection>
          )}
        </div>

        {/* Platform Targeting Section */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Meta Targeting - Futuristic Card */}
          {metaTargeting && (
            <AnimatedSection delay={300}>
              <div 
                className="p-8 rounded-3xl relative overflow-hidden group"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`,
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Meta gradient accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: 'linear-gradient(90deg, #E1306C, #405DE6)' }}
                />
                
                <div className="flex items-center gap-4 mb-8">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                    style={{ background: 'linear-gradient(135deg, #E1306C, #405DE6)' }}
                  >
                    <Heart className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold" style={{ color: textColor }}>
                      Meta Targeting Matrix
                    </h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>Facebook & Instagram Precision</p>
                  </div>
                </div>

                {/* Interests with Visual Pills */}
                {metaTargeting.interests && metaTargeting.interests.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Eye className="w-5 h-5" style={{ color: '#E1306C' }} />
                      <h4 className="text-sm font-semibold" style={{ color: textMutedColor }}>Interest Targeting</h4>
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #E1306C20, #405DE620)', color: '#E1306C' }}
                      >
                        {metaTargeting.interests.length} signals
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {metaTargeting.interests.map((interest, i) => (
                        <span
                          key={i}
                          className="px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
                          style={{ 
                            background: `linear-gradient(135deg, #E1306C15, #405DE610)`,
                            color: textColor,
                            border: '1px solid #E1306C20'
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Behaviors */}
                {metaTargeting.behaviors && metaTargeting.behaviors.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart className="w-5 h-5" style={{ color: '#405DE6' }} />
                      <h4 className="text-sm font-semibold" style={{ color: textMutedColor }}>Behavioral Signals</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {metaTargeting.behaviors.map((behavior, i) => (
                        <span
                          key={i}
                          className="px-3 py-2 rounded-xl text-xs font-medium"
                          style={{ 
                            background: `linear-gradient(135deg, #405DE615, #E1306C10)`,
                            color: textColor,
                            border: '1px solid #405DE620'
                          }}
                        >
                          {behavior}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Audiences */}
                {metaTargeting.customAudiences && metaTargeting.customAudiences.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-4" style={{ color: textMutedColor }}>Custom Audiences</h4>
                    <div className="space-y-2">
                      {metaTargeting.customAudiences.map((audience, i) => (
                        <div 
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
                          style={{ background: `linear-gradient(135deg, #E1306C08, #405DE608)` }}
                        >
                          <Target className="w-5 h-5" style={{ color: '#E1306C' }} />
                          <span className="text-sm" style={{ color: textColor }}>{audience}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lookalike Strategy */}
                {metaTargeting.lookalikeStrategy && (
                  <div 
                    className="p-5 rounded-2xl"
                    style={{ 
                      background: 'linear-gradient(135deg, #E1306C15, #405DE615)',
                      border: '1px solid #E1306C30'
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5" style={{ color: '#405DE6' }} />
                      <h4 className="text-sm font-semibold" style={{ color: '#405DE6' }}>Lookalike Strategy</h4>
                    </div>
                    <p className="text-sm" style={{ color: textMutedColor }}>{metaTargeting.lookalikeStrategy}</p>
                  </div>
                )}
              </div>
            </AnimatedSection>
          )}

          {/* Google Audiences - Futuristic Card */}
          {googleAudiences && (
            <AnimatedSection delay={400}>
              <div 
                className="p-8 rounded-3xl relative overflow-hidden"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`,
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Google gradient accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${primaryColor}, #4285f4, #ea4335)` }}
                />
                
                <div className="flex items-center gap-4 mb-8">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, #4285f4)`,
                      boxShadow: `0 8px 24px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                    }}
                  >
                    <Search className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold" style={{ color: textColor }}>
                      Google Audience Stack
                    </h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>Search, Display & YouTube</p>
                  </div>
                </div>

                {/* In-Market Audiences */}
                {googleAudiences.inMarket && googleAudiences.inMarket.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart className="w-5 h-5 text-green-500" />
                      <h4 className="text-sm font-semibold" style={{ color: textMutedColor }}>In-Market Audiences</h4>
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                      >
                        🔥 High Intent
                      </span>
                    </div>
                    <div className="space-y-2">
                      {googleAudiences.inMarket.map((audience, i) => (
                        <div 
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm" style={{ color: textColor }}>{audience}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affinity Audiences */}
                {googleAudiences.affinity && googleAudiences.affinity.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Heart className="w-5 h-5" style={{ color: primaryColor }} />
                      <h4 className="text-sm font-semibold" style={{ color: textMutedColor }}>Affinity Audiences</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {googleAudiences.affinity.map((audience, i) => (
                        <span
                          key={i}
                          className="px-3 py-2 rounded-xl text-xs"
                          style={{ 
                            backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, transparent)`,
                            color: textColor,
                            border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`
                          }}
                        >
                          {audience}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Intent */}
                {googleAudiences.customIntent && googleAudiences.customIntent.length > 0 && (
                  <div 
                    className="p-5 rounded-2xl"
                    style={{ 
                      background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 12%, transparent), color-mix(in srgb, ${secondaryColor} 8%, transparent))`,
                      border: `1px solid color-mix(in srgb, ${primaryColor} 25%, transparent)`
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Crosshair className="w-5 h-5" style={{ color: secondaryColor }} />
                      <h4 className="text-sm font-semibold" style={{ color: secondaryColor }}>Custom Intent Keywords</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {googleAudiences.customIntent.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`,
                            color: secondaryColor
                          }}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </section>
  );
};
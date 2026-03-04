import { AnimatedSection } from './AnimatedSection';
import { Sparkles, Search, MessageSquare, MousePointer, Lightbulb, Copy, Check, Wand2, Target, Megaphone, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AnimatedCounter } from './AnimatedCounter';
import { isLightColor } from './PlatformLogos';

interface AdCopyRecommendationsProps {
  adCopyRecommendations: {
    googleAdsHeadlines?: string[];
    googleAdsDescriptions?: string[];
    metaAdPrimaryText?: string[];
    metaAdHeadlines?: string[];
    callToActions?: string[];
    hooks?: string[];
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  clientName: string;
}

export const AdCopyRecommendations = ({
  adCopyRecommendations,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  clientName
}: AdCopyRecommendationsProps) => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Calculate totals for stats
  const totalCopy = (adCopyRecommendations.googleAdsHeadlines?.length || 0) + 
                    (adCopyRecommendations.googleAdsDescriptions?.length || 0) +
                    (adCopyRecommendations.metaAdPrimaryText?.length || 0) +
                    (adCopyRecommendations.metaAdHeadlines?.length || 0);
  const totalHooks = adCopyRecommendations.hooks?.length || 0;
  const totalCTAs = adCopyRecommendations.callToActions?.length || 0;

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(text, id);
      }}
      className="opacity-0 group-hover:opacity-100 transition-all duration-300 p-2 rounded-lg hover:scale-110"
      style={{ 
        backgroundColor: copiedIndex === id ? `color-mix(in srgb, ${secondaryColor} 20%, transparent)` : 'transparent' 
      }}
      title="Copy to clipboard"
    >
      {copiedIndex === id ? (
        <Check className="w-4 h-4" style={{ color: secondaryColor }} />
      ) : (
        <Copy className="w-4 h-4" style={{ color: textMutedColor }} />
      )}
    </button>
  );

  return (
    <section id="ad-copy" className="py-24 relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-40 left-10 w-80 h-80 rounded-full blur-[120px] opacity-15 animate-pulse"
          style={{ backgroundColor: primaryColor, animationDuration: '6s' }}
        />
        <div 
          className="absolute bottom-20 right-20 w-72 h-72 rounded-full blur-[100px] opacity-20 animate-pulse"
          style={{ backgroundColor: secondaryColor, animationDuration: '8s' }}
        />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Premium Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ 
                background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))`,
                border: `1px solid color-mix(in srgb, ${primaryColor} 30%, transparent)`
              }}
            >
              <Wand2 className="w-4 h-4" style={{ color: primaryColor }} />
              <span className="text-sm font-medium" style={{ color: primaryColor }}>Custom Ad Copy</span>
            </div>
            <h2 
              className="text-4xl md:text-5xl font-display font-bold mb-6"
              style={{ color: textColor }}
            >
              Ready-to-Use <span style={{ color: primaryColor }}>Ad Copy</span>
            </h2>
            <p className="text-lg max-w-3xl mx-auto mb-8" style={{ color: textMutedColor }}>
              Personalized headlines, descriptions, and hooks crafted specifically for {clientName}. 
              Click any item to copy it instantly.
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap justify-center gap-6">
              <div 
                className="px-6 py-4 rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 8px 32px color-mix(in srgb, ${primaryColor} 10%, transparent)`
                }}
              >
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  <AnimatedCounter value={`${totalCopy}+`} />
                </p>
                <p className="text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Copy Variations</p>
              </div>
              <div 
                className="px-6 py-4 rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`
                }}
              >
                <p className="text-3xl font-bold" style={{ color: secondaryColor }}>
                  <AnimatedCounter value={`${totalHooks}`} />
                </p>
                <p className="text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Video Hooks</p>
              </div>
              <div 
                className="px-6 py-4 rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`
                }}
              >
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  <AnimatedCounter value={`${totalCTAs}`} />
                </p>
                <p className="text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Call-to-Actions</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Google Ads Section - Premium Card */}
          <AnimatedSection delay={100}>
            <div 
              className="p-8 rounded-3xl h-full relative overflow-hidden group transition-all duration-500 hover:-translate-y-2"
              style={{ 
                backgroundColor: cardBackground, 
                border: `1px solid ${borderColor}`,
                boxShadow: `0 12px 40px color-mix(in srgb, ${primaryColor} 10%, transparent)`
              }}
            >
              {/* Google accent bar */}
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, #4285f4, #ea4335, #fbbc04, #34a853)` }}
              />

              <div className="flex items-center gap-4 mb-8">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}, #4285f4)`,
                    boxShadow: `0 8px 24px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                  }}
                >
                  <Search className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold" style={{ color: textColor }}>
                    Google Ads Copy
                  </h3>
                  <p className="text-sm" style={{ color: textMutedColor }}>Headlines & Descriptions</p>
                </div>
              </div>

              {/* Headlines */}
              {adCopyRecommendations.googleAdsHeadlines && adCopyRecommendations.googleAdsHeadlines.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4" style={{ color: secondaryColor }} />
                    <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: secondaryColor }}>
                      Headlines
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 50%, transparent)`, color: textMutedColor }}>
                      30 char max
                    </span>
                  </div>
                  <div className="space-y-3">
                    {adCopyRecommendations.googleAdsHeadlines.map((headline, i) => (
                      <div 
                        key={i}
                        className="group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                        style={{ 
                          background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 8%, transparent), color-mix(in srgb, ${primaryColor} 4%, transparent))`,
                          border: `1px solid color-mix(in srgb, ${primaryColor} 15%, transparent)`
                        }}
                        onClick={() => copyToClipboard(headline, `gh-${i}`)}
                      >
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`, color: primaryColor }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium" style={{ color: textColor }}>
                            {headline}
                          </span>
                        </div>
                        <CopyButton text={headline} id={`gh-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Descriptions */}
              {adCopyRecommendations.googleAdsDescriptions && adCopyRecommendations.googleAdsDescriptions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone className="w-4 h-4" style={{ color: secondaryColor }} />
                    <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: secondaryColor }}>
                      Descriptions
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 50%, transparent)`, color: textMutedColor }}>
                      90 char max
                    </span>
                  </div>
                  <div className="space-y-3">
                    {adCopyRecommendations.googleAdsDescriptions.map((desc, i) => (
                      <div 
                        key={i}
                        className="group flex items-start justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.01]"
                        style={{ 
                          background: `color-mix(in srgb, ${borderColor} 30%, transparent)`,
                          border: `1px solid ${borderColor}`
                        }}
                        onClick={() => copyToClipboard(desc, `gd-${i}`)}
                      >
                        <span className="text-sm flex-1" style={{ color: textMutedColor }}>
                          {desc}
                        </span>
                        <CopyButton text={desc} id={`gd-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AnimatedSection>

          {/* Meta Ads Section - Premium Card */}
          <AnimatedSection delay={200}>
            <div 
              className="p-8 rounded-3xl h-full relative overflow-hidden group transition-all duration-500 hover:-translate-y-2"
              style={{ 
                backgroundColor: cardBackground, 
                border: `1px solid ${borderColor}`,
                boxShadow: '0 12px 40px rgba(225, 48, 108, 0.08)'
              }}
            >
              {/* Meta accent bar */}
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, #E1306C, #405DE6, #833AB4)' }}
              />

              <div className="flex items-center gap-4 mb-8">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, #E1306C, #405DE6)',
                    boxShadow: '0 8px 24px rgba(225, 48, 108, 0.3)'
                  }}
                >
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold" style={{ color: textColor }}>
                    Meta Ads Copy
                  </h3>
                  <p className="text-sm" style={{ color: textMutedColor }}>Facebook & Instagram</p>
                </div>
              </div>

              {/* Headlines */}
              {adCopyRecommendations.metaAdHeadlines && adCopyRecommendations.metaAdHeadlines.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4" style={{ color: '#E1306C' }} />
                    <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#E1306C' }}>
                      Headlines
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {adCopyRecommendations.metaAdHeadlines.map((headline, i) => (
                      <div 
                        key={i}
                        className="group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                        style={{ 
                          background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.08), rgba(64, 93, 230, 0.05))',
                          border: '1px solid rgba(225, 48, 108, 0.15)'
                        }}
                        onClick={() => copyToClipboard(headline, `mh-${i}`)}
                      >
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #E1306C, #405DE6)', color: 'white' }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium" style={{ color: textColor }}>
                            {headline}
                          </span>
                        </div>
                        <CopyButton text={headline} id={`mh-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Text */}
              {adCopyRecommendations.metaAdPrimaryText && adCopyRecommendations.metaAdPrimaryText.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone className="w-4 h-4" style={{ color: '#405DE6' }} />
                    <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#405DE6' }}>
                      Primary Text
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {adCopyRecommendations.metaAdPrimaryText.map((text, i) => (
                      <div 
                        key={i}
                        className="group flex items-start justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.01]"
                        style={{ 
                          background: `color-mix(in srgb, ${borderColor} 30%, transparent)`,
                          border: `1px solid ${borderColor}`
                        }}
                        onClick={() => copyToClipboard(text, `mp-${i}`)}
                      >
                        <span className="text-sm flex-1" style={{ color: textMutedColor }}>
                          {text}
                        </span>
                        <CopyButton text={text} id={`mp-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AnimatedSection>
        </div>

        {/* CTAs and Hooks Row */}
        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {/* Call to Actions - Interactive Buttons */}
          {adCopyRecommendations.callToActions && adCopyRecommendations.callToActions.length > 0 && (
            <AnimatedSection delay={300}>
              <div 
                className="p-8 rounded-3xl relative overflow-hidden"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 12px 40px color-mix(in srgb, ${primaryColor} 8%, transparent)`
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      boxShadow: `0 6px 20px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                    }}
                  >
                    <MousePointer className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold" style={{ color: textColor }}>
                      Call-to-Action Buttons
                    </h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>Click to copy any CTA</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {adCopyRecommendations.callToActions.map((cta, i) => (
                    <button
                      key={i}
                      onClick={() => copyToClipboard(cta, `cta-${i}`)}
                      className="group relative px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                      style={{ 
                        background: copiedIndex === `cta-${i}` 
                          ? `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 70%, ${primaryColor}))`
                          : `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 70%, ${secondaryColor}))`,
                        color: isLightColor(primaryColor) ? '#1a1a2e' : 'white',
                        boxShadow: `0 8px 20px color-mix(in srgb, ${primaryColor} 40%, transparent)`
                      }}
                    >
                      {cta}
                      {copiedIndex === `cta-${i}` && (
                        <Check className="inline-block w-4 h-4 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Video Hooks - Premium Design */}
          {adCopyRecommendations.hooks && adCopyRecommendations.hooks.length > 0 && (
            <AnimatedSection delay={400}>
              <div 
                className="p-8 rounded-3xl relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 8%, ${cardBackground}), color-mix(in srgb, ${primaryColor} 5%, ${cardBackground}))`,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 12px 40px color-mix(in srgb, ${secondaryColor} 10%, transparent)`
                }}
              >
                {/* Decorative glow */}
                <div 
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30"
                  style={{ backgroundColor: secondaryColor }}
                />
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`,
                        boxShadow: `0 6px 20px color-mix(in srgb, ${secondaryColor} 30%, transparent)`
                      }}
                    >
                      <Lightbulb className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold" style={{ color: textColor }}>
                        Video/Ad Hooks
                      </h3>
                      <p className="text-sm" style={{ color: textMutedColor }}>Stop-the-scroll openers</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {adCopyRecommendations.hooks.map((hook, i) => (
                      <div 
                        key={i}
                        className="group flex items-start justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                        style={{ 
                          background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 10%, transparent), color-mix(in srgb, ${primaryColor} 5%, transparent))`,
                          border: `1px solid color-mix(in srgb, ${secondaryColor} 20%, transparent)`
                        }}
                        onClick={() => copyToClipboard(hook, `hook-${i}`)}
                      >
                        <div className="flex items-start gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ 
                              background: `linear-gradient(135deg, ${secondaryColor}30, ${primaryColor}20)` 
                            }}
                          >
                            <Zap className="w-4 h-4" style={{ color: secondaryColor }} />
                          </div>
                          <span className="text-sm" style={{ color: textColor }}>
                            {hook}
                          </span>
                        </div>
                        <CopyButton text={hook} id={`hook-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </section>
  );
};
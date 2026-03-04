import { AnimatedSection } from './AnimatedSection';
import { FileText, Video, MessageSquare, Mail, Target, ArrowUpRight, Copy, Check, Sparkles, Play, Calendar, TrendingUp, Lightbulb, Image, Smartphone, Layers, Camera, Monitor } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AnimatedCounter } from './AnimatedCounter';
import { supabase } from '@/integrations/supabase/client';
import { isLightColor } from './PlatformLogos';


// Ad Creative Samples for the carousel
const AD_CREATIVE_SAMPLES: Array<{
  type: string;
  platform: string;
  format: string;
  performance: string;
  image?: string;
}> = [{
  type: 'Kopiko Coffee',
  platform: 'Meta',
  format: 'Social Ad',
  performance: '3.2x ROAS',
  image: ''
}, {
  type: 'Legaroo Travel',
  platform: 'Meta',
  format: 'Story Ad',
  performance: '2.8x ROAS',
  image: ''
}, {
  type: 'Equipment Rental',
  platform: 'Google',
  format: 'Display Ad',
  performance: '4.1% CTR',
  image: ''
}, {
  type: 'Travel Abroad',
  platform: 'Meta',
  format: 'Feed Ad',
  performance: '2.1x ROAS',
  image: ''
}, {
  type: 'Roamer Explorer',
  platform: 'TikTok',
  format: '9:16 Native',
  performance: '3.8x ROAS',
  image: ''
}, {
  type: 'Elite Travel',
  platform: 'Meta',
  format: 'Luxury Ad',
  performance: '5.2x ROAS',
  image: ''
}, {
  type: 'Brand Viral',
  platform: 'Meta',
  format: 'Awareness',
  performance: '1.2M Reach',
  image: ''
}, {
  type: 'F1 Lamborghini',
  platform: 'Meta',
  format: 'Automotive',
  performance: '4.5x ROAS',
  image: ''
}, {
  type: 'Pro Security',
  platform: 'Google',
  format: 'Service Ad',
  performance: '6.1% CVR',
  image: ''
}, {
  type: 'Diamond Mattress',
  platform: 'Meta',
  format: 'Carousel',
  performance: '3.9x ROAS',
  image: ''
}];

interface ContentStrategyProps {
  contentStrategy: {
    blogTopics?: Array<{ title: string; goal: string; priority: string }>;
    videoIdeas?: Array<{ title: string; platform: string; format: string }>;
    socialPosts?: string[];
    emailSubjectLines?: string[];
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  clientName: string;
}

const getPriorityStyle = (priority: string | undefined, primaryColor: string, secondaryColor: string) => {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'high') return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', icon: '🔥' };
  if (p === 'medium') return { bg: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`, text: secondaryColor, icon: '⚡' };
  return { bg: `color-mix(in srgb, ${primaryColor} 15%, transparent)`, text: primaryColor, icon: '📌' };
};

const getPlatformStyle = (platform: string | undefined | null) => {
  const p = (platform || 'social').toLowerCase();
  if (p.includes('tiktok')) return { gradient: 'linear-gradient(135deg, #000, #69c9d0)', icon: '🎵' };
  if (p.includes('youtube')) return { gradient: 'linear-gradient(135deg, #ff0000, #cc0000)', icon: '▶️' };
  if (p.includes('instagram') || p.includes('reels')) return { gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743)', icon: '📸' };
  if (p.includes('facebook')) return { gradient: 'linear-gradient(135deg, #1877f2, #0d65d9)', icon: '👍' };
  return { gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', icon: '📱' };
};

export const ContentStrategy = ({
  contentStrategy,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  clientName
}: ContentStrategyProps) => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Load portfolio images from storage
  useEffect(() => {
    const loadPortfolioImages = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('proposal-assets')
          .list('portfolio', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) throw error;

        const urls = (data || [])
          .filter(file => file.name !== '.emptyFolderPlaceholder')
          .map(file => supabase.storage.from('proposal-assets').getPublicUrl(`portfolio/${file.name}`).data.publicUrl);

        if (urls.length > 0) {
          setPortfolioImages(urls);
        }
      } catch (err) {
        console.error('Failed to load portfolio images:', err);
      }
    };

    loadPortfolioImages();
  }, []);

  // Handle image load errors - fall back to icon design for that specific image
  const handleImageError = (url: string) => {
    setFailedImages(prev => new Set(prev).add(url));
  };

  // Check if we should show images (have valid images that haven't all failed)
  const validImages = portfolioImages.filter(url => !failedImages.has(url));
  const showImages = validImages.length > 0;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const { blogTopics, videoIdeas, socialPosts, emailSubjectLines } = contentStrategy;

  // Stats
  const totalContent = (blogTopics?.length || 0) + (videoIdeas?.length || 0) + (socialPosts?.length || 0) + (emailSubjectLines?.length || 0);

  return (
    <section id="content-strategy" className="py-24 relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-20 left-20 w-80 h-80 rounded-full blur-[120px] opacity-15 animate-pulse"
          style={{ backgroundColor: secondaryColor, animationDuration: '6s' }}
        />
        <div 
          className="absolute bottom-40 right-10 w-72 h-72 rounded-full blur-[100px] opacity-20 animate-pulse"
          style={{ backgroundColor: primaryColor, animationDuration: '8s' }}
        />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Premium Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ 
                background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 15%, transparent), color-mix(in srgb, ${primaryColor} 10%, transparent))`,
                border: `1px solid color-mix(in srgb, ${secondaryColor} 30%, transparent)`
              }}
            >
              <Lightbulb className="w-4 h-4" style={{ color: secondaryColor }} />
              <span className="text-sm font-medium" style={{ color: secondaryColor }}>Strategic Content Plan</span>
            </div>
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6 px-2"
              style={{ color: textColor }}
            >
              Content <span style={{ color: secondaryColor }}>Strategy</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg max-w-3xl mx-auto mb-6 sm:mb-8 px-2" style={{ color: textMutedColor }}>
              Personalized content ideas designed to engage {clientName}'s audience across every channel.
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 8px 32px color-mix(in srgb, ${secondaryColor} 10%, transparent)`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: secondaryColor }}>
                  <AnimatedCounter value={`${totalContent}+`} />
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Content Ideas</p>
              </div>
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl backdrop-blur-sm"
                style={{ 
                  background: `color-mix(in srgb, ${cardBackground} 80%, transparent)`,
                  border: `1px solid ${borderColor}`
                }}
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>4</p>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: textMutedColor }}>Content Types</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Blog Topics - 3x3 Grid Layout */}
          {blogTopics && blogTopics.length > 0 && (
            <div className="md:col-span-2">
            <AnimatedSection delay={100}>
              <div 
                className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl relative overflow-hidden group transition-all duration-500 hover:-translate-y-1"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 12px 40px color-mix(in srgb, ${primaryColor} 8%, transparent)`
                }}
              >
                {/* Accent bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}
                />

                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 60%, ${secondaryColor}))`,
                      boxShadow: `0 8px 24px color-mix(in srgb, ${primaryColor} 30%, transparent)`
                    }}
                  >
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-bold truncate" style={{ color: textColor }}>
                      Blog Topics
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>SEO-driven content ideas</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {blogTopics.slice(0, 9).map((topic, i) => {
                    const priorityStyle = getPriorityStyle(topic.priority, primaryColor, secondaryColor);
                    return (
                      <div 
                        key={i}
                        className="group/item p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col"
                        style={{ 
                          background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 6%, transparent), transparent)`,
                          border: `1px solid ${borderColor}`
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                          <span 
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex-shrink-0 flex items-center gap-1"
                            style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.text }}
                          >
                            {priorityStyle.icon}
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs sm:text-sm leading-tight flex-1 mb-2 sm:mb-3 line-clamp-3" style={{ color: textColor }}>
                          {topic.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs mt-auto" style={{ color: textMutedColor }}>
                          <Target className="w-3 h-3 flex-shrink-0" style={{ color: secondaryColor }} />
                          <span className="line-clamp-1">{topic.goal}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AnimatedSection>
          </div>
        )}

          {/* Video Ideas - Premium Platform Cards */}
          {videoIdeas && videoIdeas.length > 0 && (
            <AnimatedSection delay={200}>
              <div 
                className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl h-full relative overflow-hidden group transition-all duration-500 hover:-translate-y-1"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`,
                  boxShadow: '0 12px 40px rgba(255, 0, 0, 0.06)'
                }}
              >
                {/* YouTube accent bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: 'linear-gradient(90deg, #ff0000, #cc0000, #ff0000)' }}
                />

                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: 'linear-gradient(135deg, #FF0000, #cc0000)',
                      boxShadow: '0 8px 24px rgba(255, 0, 0, 0.3)'
                    }}
                  >
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-bold truncate" style={{ color: textColor }}>
                      Video Ideas
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>Engaging video content</p>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {videoIdeas.map((video, i) => {
                    const platformStyle = getPlatformStyle(video.platform);
                    return (
                      <div 
                        key={i}
                        className="group/item p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                        style={{ 
                          background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 5%, transparent), transparent)`,
                          border: `1px solid ${borderColor}`
                        }}
                      >
                        <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2" style={{ color: textColor }}>
                          {video.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span 
                            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium text-white flex items-center gap-1 sm:gap-1.5"
                            style={{ background: platformStyle.gradient }}
                          >
                            {platformStyle.icon} {video.platform}
                          </span>
                          <span 
                            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs"
                            style={{ backgroundColor: `color-mix(in srgb, ${borderColor} 50%, transparent)`, color: textMutedColor }}
                          >
                            🎬 {video.format}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Social Posts - Copyable Items */}
          {socialPosts && socialPosts.length > 0 && (
            <AnimatedSection delay={300}>
              <div 
                className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl h-full relative overflow-hidden"
                style={{ 
                  backgroundColor: cardBackground, 
                  border: `1px solid ${borderColor}`
                }}
              >
                {/* Meta gradient accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: 'linear-gradient(90deg, #E1306C, #405DE6, #833AB4)' }}
                />

                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: 'linear-gradient(135deg, #E1306C, #405DE6)',
                      boxShadow: '0 8px 24px rgba(225, 48, 108, 0.3)'
                    }}
                  >
                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-bold truncate" style={{ color: textColor }}>
                      Social Post Ideas
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>Click to copy any idea</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {socialPosts.map((post, i) => (
                    <div 
                      key={i}
                      className="group flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.05), rgba(64, 93, 230, 0.03))',
                        border: '1px solid rgba(225, 48, 108, 0.1)'
                      }}
                      onClick={() => copyToClipboard(post, `social-${i}`)}
                    >
                      <div 
                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #E1306C20, #405DE620)' }}
                      >
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#E1306C' }} />
                      </div>
                      <span className="text-xs sm:text-sm flex-1 line-clamp-3" style={{ color: textColor }}>{post}</span>
                      <button className="opacity-0 group-hover:opacity-100 transition-all p-1.5 sm:p-2 rounded-lg hover:scale-110 flex-shrink-0">
                        {copiedIndex === `social-${i}` ? (
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: secondaryColor }} />
                        ) : (
                          <Copy className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: textMutedColor }} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Email Subject Lines - Premium Design */}
          {emailSubjectLines && emailSubjectLines.length > 0 && (
            <AnimatedSection delay={400}>
              <div 
                className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl h-full relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 5%, ${cardBackground}), ${cardBackground})`,
                  border: `1px solid ${borderColor}`
                }}
              >
                {/* Email accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})` }}
                />

                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`,
                      boxShadow: `0 8px 24px color-mix(in srgb, ${secondaryColor} 30%, transparent)`
                    }}
                  >
                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-bold truncate" style={{ color: textColor }}>
                      Email Subject Lines
                    </h3>
                    <p className="text-xs sm:text-sm truncate" style={{ color: textMutedColor }}>High-open-rate subjects</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {emailSubjectLines.map((subject, i) => (
                    <div 
                      key={i}
                      className="group flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                      style={{ 
                        background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 6%, transparent), color-mix(in srgb, ${secondaryColor} 4%, transparent))`,
                        border: `1px solid ${borderColor}`
                      }}
                      onClick={() => copyToClipboard(subject, `email-${i}`)}
                    >
                      <span 
                        className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0"
                        style={{ 
                          background: `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor}))`,
                          color: 'white'
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-medium flex-1 line-clamp-2" style={{ color: textColor }}>
                        {subject}
                      </span>
                      <button className="opacity-0 group-hover:opacity-100 transition-all p-1.5 sm:p-2 rounded-lg hover:scale-110 flex-shrink-0">
                        {copiedIndex === `email-${i}` ? (
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: secondaryColor }} />
                        ) : (
                          <Copy className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: textMutedColor }} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>

        {/* Creative Showcase - "A Picture is Worth a Thousand Words" - OUTSIDE the 2-col grid */}
        <AnimatedSection delay={300}>
          <div className="mt-12 sm:mt-16">
            <div className="text-center mb-8 sm:mb-12 px-2">
              <p className="font-medium uppercase tracking-widest text-xs sm:text-sm mb-3 sm:mb-4" style={{ color: secondaryColor }}>
                Creative Excellence
              </p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-3 sm:mb-4" style={{ color: textColor }}>
                A Picture is Worth a Thousand Words
              </h3>
              <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: textMutedColor }}>
                Our in-house creative team produces scroll-stopping ads that convert. 
                Here's a sample of the ad formats we'll create for {clientName}.
              </p>
            </div>

            {/* Infinite Scrolling Ad Creative Showcase - Full width contained */}
            <div className="relative mb-8 sm:mb-12 overflow-hidden">
              {/* First row - scrolling left */}
              <div className="flex animate-scroll-left mb-4 sm:mb-6">
                {showImages ? (
                  // Show uploaded portfolio images with premium styling
                  [...validImages, ...validImages, ...validImages].map((url, i) => (
                    <div 
                      key={`row1-img-${i}`} 
                      className="flex-shrink-0 w-44 sm:w-56 md:w-64 lg:w-72 mx-2 sm:mx-3 relative rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]" 
                      style={{ 
                        border: `1px solid ${borderColor}`,
                        background: `linear-gradient(145deg, ${cardBackground}, color-mix(in srgb, ${primaryColor} 5%, ${cardBackground}))`
                      }}
                    >
                      {/* Premium frame with aspect ratio container */}
                      <div className="relative aspect-square p-2 sm:p-3">
                        <div 
                          className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 3%, transparent)` }}
                        >
                          <img 
                            src={url} 
                            alt={`Portfolio ${(i % validImages.length) + 1}`}
                            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                            loading="lazy"
                            onError={() => handleImageError(url)}
                          />
                        </div>
                      </div>
                      {/* Hover overlay */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm" 
                        style={{ background: `linear-gradient(135deg, ${primaryColor}cc, ${secondaryColor}cc)` }}
                      >
                        <div className="text-center text-white p-4">
                          <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 drop-shadow-lg" />
                          <p className="text-sm sm:text-base font-semibold drop-shadow">Ad Creative Sample</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback to premium icon-based placeholders
                  [...AD_CREATIVE_SAMPLES, ...AD_CREATIVE_SAMPLES, ...AD_CREATIVE_SAMPLES].map((ad, i) => (
                    <div 
                      key={`row1-${i}`} 
                      className="flex-shrink-0 w-44 sm:w-56 md:w-64 lg:w-72 mx-2 sm:mx-3 relative rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]" 
                      style={{ 
                        background: `linear-gradient(145deg, ${cardBackground}, color-mix(in srgb, ${primaryColor} 8%, ${cardBackground}))`,
                        border: `1px solid ${borderColor}` 
                      }}
                    >
                      <div className="aspect-square flex flex-col items-center justify-center p-4 sm:p-6">
                        <div 
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4"
                          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 15%, transparent), color-mix(in srgb, ${secondaryColor} 10%, transparent))` }}
                        >
                          {ad.format.includes('9:16') ? (
                            <Smartphone className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color: primaryColor }} />
                          ) : ad.type.includes('Video') ? (
                            <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color: primaryColor }} />
                          ) : (
                            <Image className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color: primaryColor }} />
                          )}
                        </div>
                        <h4 className="font-display font-semibold text-xs sm:text-sm md:text-base text-center mb-1" style={{ color: textColor }}>
                          {ad.type}
                        </h4>
                        <p className="text-[10px] sm:text-xs text-center" style={{ color: textMutedColor }}>
                          {ad.platform} • {ad.format}
                        </p>
                        <div 
                          className="mt-3 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium"
                          style={{ 
                            background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 20%, transparent), color-mix(in srgb, ${primaryColor} 15%, transparent))`,
                            color: secondaryColor
                          }}
                        >
                          {ad.performance}
                        </div>
                      </div>
                      {/* Hover overlay */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm" 
                        style={{ background: `linear-gradient(135deg, ${primaryColor}dd, ${secondaryColor}dd)` }}
                      >
                        <div className="text-center text-white p-4">
                          <p className="text-xl sm:text-2xl font-bold mb-1 drop-shadow">{ad.performance}</p>
                          <p className="text-xs sm:text-sm opacity-90">Expected Performance</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Second row - scrolling right */}
              <div className="flex animate-scroll-right">
                {showImages ? (
                  // Show uploaded portfolio images (reversed) with premium styling
                  [...validImages.slice().reverse(), ...validImages.slice().reverse(), ...validImages.slice().reverse()].map((url, i) => (
                    <div 
                      key={`row2-img-${i}`} 
                      className="flex-shrink-0 w-44 sm:w-56 md:w-64 lg:w-72 mx-2 sm:mx-3 relative rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]" 
                      style={{ 
                        border: `1px solid ${borderColor}`,
                        background: `linear-gradient(145deg, ${cardBackground}, color-mix(in srgb, ${secondaryColor} 5%, ${cardBackground}))`
                      }}
                    >
                      {/* Premium frame with aspect ratio container */}
                      <div className="relative aspect-square p-2 sm:p-3">
                        <div 
                          className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 3%, transparent)` }}
                        >
                          <img 
                            src={url} 
                            alt={`Portfolio ${(i % validImages.length) + 1}`}
                            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                            loading="lazy"
                            onError={() => handleImageError(url)}
                          />
                        </div>
                      </div>
                      {/* Hover overlay */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm" 
                        style={{ background: `linear-gradient(135deg, ${secondaryColor}cc, ${primaryColor}cc)` }}
                      >
                        <div className="text-center text-white p-4">
                          <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 drop-shadow-lg" />
                          <p className="text-sm sm:text-base font-semibold drop-shadow">Ad Creative Sample</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback to premium icon-based placeholders
                  [...AD_CREATIVE_SAMPLES.slice().reverse(), ...AD_CREATIVE_SAMPLES.slice().reverse(), ...AD_CREATIVE_SAMPLES.slice().reverse()].map((ad, i) => (
                    <div 
                      key={`row2-${i}`} 
                      className="flex-shrink-0 w-44 sm:w-56 md:w-64 lg:w-72 mx-2 sm:mx-3 relative rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]" 
                      style={{ 
                        background: `linear-gradient(145deg, ${cardBackground}, color-mix(in srgb, ${secondaryColor} 8%, ${cardBackground}))`,
                        border: `1px solid ${borderColor}` 
                      }}
                    >
                      <div className="aspect-square flex flex-col items-center justify-center p-4 sm:p-6">
                        <div 
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4"
                          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 15%, transparent), color-mix(in srgb, ${primaryColor} 10%, transparent))` }}
                        >
                          {ad.format.includes('9:16') ? (
                            <Smartphone className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color: secondaryColor }} />
                          ) : ad.type.includes('Video') ? (
                            <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color: secondaryColor }} />
                          ) : (
                            <Image className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color: secondaryColor }} />
                          )}
                        </div>
                        <h4 className="font-display font-semibold text-xs sm:text-sm md:text-base text-center mb-1" style={{ color: textColor }}>
                          {ad.type}
                        </h4>
                        <p className="text-[10px] sm:text-xs text-center" style={{ color: textMutedColor }}>
                          {ad.platform} • {ad.format}
                        </p>
                        <div 
                          className="mt-3 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium"
                          style={{ 
                            background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 20%, transparent), color-mix(in srgb, ${secondaryColor} 15%, transparent))`,
                            color: primaryColor
                          }}
                        >
                          {ad.performance}
                        </div>
                      </div>
                      {/* Hover overlay */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm" 
                        style={{ background: `linear-gradient(135deg, ${secondaryColor}dd, ${primaryColor}dd)` }}
                      >
                        <div className="text-center text-white p-4">
                          <p className="text-xl sm:text-2xl font-bold mb-1 drop-shadow">{ad.performance}</p>
                          <p className="text-xs sm:text-sm opacity-90">Expected Performance</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ad Formats We Create */}
            <div className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
              <h4 className="text-base sm:text-lg md:text-xl font-display font-semibold mb-4 sm:mb-6 text-center" style={{ color: textColor }}>
                Ads Our Team Creates
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
                {[
                  { icon: Video, name: 'Video Ads' },
                  { icon: Image, name: 'Static Ads' },
                  { icon: Layers, name: 'Carousels' },
                  { icon: Smartphone, name: 'Stories/Reels' },
                  { icon: Camera, name: 'UGC Content' },
                  { icon: Monitor, name: 'Display Ads' }
                ].map((format, i) => {
                  const FormatIcon = format.icon;
                  return (
                    <div key={i} className="text-center p-2 sm:p-4">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 flex items-center justify-center" 
                        style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)` }}
                      >
                        <FormatIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: primaryColor }} />
                      </div>
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium truncate" style={{ color: textColor }}>{format.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};
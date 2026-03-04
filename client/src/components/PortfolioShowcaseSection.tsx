import { Monitor, Globe, ExternalLink } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';

interface PortfolioWebsite {
  url: string;
  title: string;
  description?: string;
  screenshot?: string;
}

interface PortfolioShowcaseSectionProps {
  portfolioWebsites?: PortfolioWebsite[];
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

export const PortfolioShowcaseSection = ({
  portfolioWebsites,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor,
}: PortfolioShowcaseSectionProps) => {
  // Default portfolio sites with real screenshots via thum.io
  const defaultPortfolio = [
    {
      url: 'https://melleka.com',
      title: 'Melleka Marketing',
      description: 'Full-service digital marketing agency',
      screenshot: 'https://image.thum.io/get/width/800/crop/500/viewportWidth/1280/noanimate/https://melleka.com'
    },
    {
      url: 'https://melleka.com/services',
      title: 'Marketing Services',
      description: 'Complete digital marketing solutions',
      screenshot: 'https://image.thum.io/get/width/800/crop/500/viewportWidth/1280/noanimate/https://melleka.com/services'
    },
    {
      url: 'https://melleka.com/ai-workflows-2',
      title: 'AI Workflows',
      description: 'Intelligent automation & AI solutions',
      screenshot: 'https://image.thum.io/get/width/800/crop/500/viewportWidth/1280/noanimate/https://melleka.com/ai-workflows-2'
    },
  ];

  // Use content.portfolioWebsites if available and has entries, otherwise use defaults
  const portfolioSites = (portfolioWebsites && portfolioWebsites.length > 0)
    ? portfolioWebsites.map(site => {
        // Clean and format URL for screenshot service
        let cleanUrl = site.url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = `https://${cleanUrl}`;
        }
        return {
          ...site,
          url: cleanUrl,
          // Generate a real screenshot URL using thum.io if not provided
          screenshot: site.screenshot || `https://image.thum.io/get/width/800/crop/500/viewportWidth/1280/noanimate/${cleanUrl}`
        };
      })
    : defaultPortfolio;

  return (
    <section id="portfolio" className="py-24 relative overflow-hidden" style={{ backgroundColor }}>
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" 
          style={{ background: `radial-gradient(circle, ${primaryColor}, transparent)` }} 
        />
        <div 
          className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-10 animate-pulse" 
          style={{ background: `radial-gradient(circle, ${secondaryColor}, transparent)`, animationDelay: '1.5s' }} 
        />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Our Work
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{ color: textColor }}>
              Similar Projects We've Built
            </h2>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
              Explore examples of websites we've created for businesses like yours. Click "View Full Site" to see them live.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolioSites.map((site, idx) => (
              <div 
                key={idx}
                className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{ 
                  backgroundColor: cardBackground,
                  border: `1px solid ${borderColor}`
                }}
              >
                {/* Browser chrome header */}
                <div 
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)`,
                    borderBottom: `1px solid ${borderColor}`
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f87171' }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#facc15' }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
                    </div>
                    <div 
                      className="px-3 py-1 rounded-lg text-xs flex items-center gap-2 max-w-[180px]"
                      style={{ backgroundColor: `color-mix(in srgb, ${textColor} 10%, transparent)` }}
                    >
                      <Globe className="w-3 h-3 flex-shrink-0" style={{ color: textMutedColor }} />
                      <span className="truncate" style={{ color: textMutedColor }}>{site.url.replace(/^https?:\/\//, '')}</span>
                    </div>
                  </div>
                </div>
                
                {/* Screenshot */}
                <div className="relative aspect-[16/10] overflow-hidden" style={{ backgroundColor: cardBackground }}>
                  <img 
                    src={site.screenshot} 
                    alt={site.title}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      // Fallback to placeholder if screenshot fails to load
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop';
                    }}
                  />
                  {/* Overlay on hover */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    <a
                      href={site.url.startsWith('http') ? site.url : `https://${site.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-transform hover:scale-105"
                      style={{ backgroundColor: primaryColor }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Full Site
                    </a>
                  </div>
                </div>
                
                {/* Site info footer */}
                <div 
                  className="px-4 py-3"
                  style={{ borderTop: `1px solid ${borderColor}` }}
                >
                  <p className="font-medium text-sm" style={{ color: textColor }}>{site.title}</p>
                  {site.description && (
                    <p className="text-xs mt-1" style={{ color: textMutedColor }}>{site.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

import { Globe, Palette, Layout, Code, Smartphone, Search, BarChart3, Zap, FileText, CheckCircle2, ArrowRight, Monitor, Shield, Clock, ExternalLink, MousePointer, Maximize2 } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { CalloutBadge } from './ProposalAnnotations';
import { useState } from 'react';
import { isLightColor } from './PlatformLogos';

interface PortfolioWebsite {
  url: string;
  title: string;
  description?: string;
}

interface ScrapedScreenshot {
  url: string;
  screenshot?: string | null;
  title: string;
}

interface WebsiteDesignContent {
  headline?: string;
  description?: string;
  designApproach?: {
    headline?: string;
    philosophy?: string;
    steps?: Array<{
      title: string;
      description: string;
    }>;
  };
  pages?: Array<{
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  features?: Array<{
    name: string;
    description: string;
    included: boolean;
  }>;
  techStack?: {
    platform?: string;
    technologies?: string[];
    integrations?: string[];
  };
  seoFeatures?: {
    included: boolean;
    features?: string[];
  };
  analyticsSetup?: {
    included: boolean;
    tools?: string[];
  };
  automations?: {
    included: boolean;
    workflows?: string[];
  };
  timeline?: {
    discovery?: string;
    design?: string;
    development?: string;
    launch?: string;
    total?: string;
  };
  deliverables?: string[];
  maintenanceSupport?: {
    period?: string;
    includes?: string[];
  };
  portfolioWebsites?: PortfolioWebsite[];
}

// Get comprehensive included features based on the package
const getIncludedFeatures = (selectedPackage?: {
  services?: {
    seo?: { included: boolean };
    googleAnalytics?: { included: boolean };
    metaPixel?: { included: boolean };
    automations?: { included: boolean };
    blogs?: { included: boolean; count?: number };
  };
}) => {
  const baseFeatures = [
    { name: 'Unlimited Revisions', description: "We iterate until you're completely satisfied with every detail", included: true },
    { name: 'Dedicated Project Manager', description: 'Your single point of contact throughout the entire project', included: true },
    { name: 'Mobile-First Design', description: 'Optimized for every device: phones, tablets, and desktops', included: true },
    { name: 'Speed Optimization', description: 'Fast-loading pages for better SEO rankings and user experience', included: true },
    { name: 'SSL Security', description: 'Secure HTTPS connection for customer trust and data protection', included: true },
    { name: 'Contact Forms', description: 'Smart lead capture forms with instant email notifications', included: true },
    { name: 'Social Media Integration', description: 'Seamlessly connect and display your social media profiles', included: true },
    { name: 'Custom Design', description: 'No generic templates. 100% custom-designed for your brand identity', included: true },
  ];

  // Add package-specific features
  if (selectedPackage?.services?.seo?.included) {
    baseFeatures.push({ name: 'SEO Optimization', description: 'On-page SEO for better rankings', included: true });
  }
  if (selectedPackage?.services?.googleAnalytics?.included) {
    baseFeatures.push({ name: 'Google Analytics 4', description: 'Full analytics setup and configuration', included: true });
  }
  if (selectedPackage?.services?.metaPixel?.included) {
    baseFeatures.push({ name: 'Meta Pixel', description: 'Retargeting and conversion tracking', included: true });
  }
  if (selectedPackage?.services?.automations?.included) {
    baseFeatures.push({ name: 'Marketing Automations', description: 'Automated workflows and email sequences', included: true });
  }
  if (selectedPackage?.services?.blogs?.included) {
    baseFeatures.push({ name: `${selectedPackage.services.blogs.count || 2} Blog Posts`, description: 'SEO-optimized blog content', included: true });
  }

  return baseFeatures;
};

interface WebsiteDesignSectionProps {
  content: WebsiteDesignContent;
  clientName: string;
  selectedPackage?: {
    name?: string;
    price?: number;
    pages?: string;
    services?: {
      seo?: { included: boolean };
      googleAnalytics?: { included: boolean };
      metaPixel?: { included: boolean };
      automations?: { included: boolean };
      blogs?: { included: boolean; count?: number };
    };
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  screenshots?: ScrapedScreenshot[];
}

export const WebsiteDesignSection = ({
  content,
  clientName,
  selectedPackage,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  screenshots,
}: WebsiteDesignSectionProps) => {
  // Get dynamic features based on selected package
  const includedFeatures = getIncludedFeatures(selectedPackage);
  
  return (
    <section id="website-design" className="py-24">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <AnimatedSection>
          <div className="text-center mb-8">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Professional Web Design
            </p>
            <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              >
                <Globe className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                {content.headline || `Custom Website for ${clientName}`}
              </h2>
            </div>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <CalloutBadge text={selectedPackage?.name || 'Professional Web Design'} variant="important" />
              <CalloutBadge text={selectedPackage?.pages || 'Custom Pages'} variant="highlight" />
              <CalloutBadge text={`$${selectedPackage?.price?.toLocaleString() || '2,900'}`} variant="highlight" />
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <p className="text-lg max-w-3xl mx-auto text-center mt-6" style={{ color: textMutedColor }}>
            {content.description || 
              `We'll create a stunning, high-converting website for ${clientName} that captures your brand essence and drives results. Every page is custom-designed to engage your visitors and turn them into customers.`}
          </p>
        </AnimatedSection>

        {/* Design Approach removed - now handled by DesignProcessSection */}

        {/* Pages Grid removed - now part of DesignProcessSection */}

        {/* Features Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          {/* Included Features */}
          <AnimatedSection delay={400}>
            <div 
              className="p-8 rounded-3xl h-full"
              style={{ 
                backgroundColor: cardBackground,
                border: `1px solid ${borderColor}`
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-6 h-6" style={{ color: secondaryColor }} />
                <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                  What's Included
                </h3>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-3">
                {(content.features || includedFeatures).filter(f => f.included).map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white/5"
                    style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 5%, transparent)` }}
                  >
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: secondaryColor }} />
                    <div>
                      <span className="font-medium text-sm" style={{ color: textColor }}>{feature.name}</span>
                      <p className="text-xs mt-0.5" style={{ color: textMutedColor }}>{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Tech Stack & Integrations */}
          <AnimatedSection delay={500}>
            <div 
              className="p-8 rounded-3xl h-full"
              style={{ 
                backgroundColor: cardBackground,
                border: `1px solid ${borderColor}`
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Code className="w-6 h-6" style={{ color: primaryColor }} />
                <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                  Technology & Integrations
                </h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3" style={{ color: textColor }}>Platform</h4>
                  <p className="text-sm" style={{ color: textMutedColor }}>
                    {content.techStack?.platform || 'Modern CMS tailored to your needs (WordPress, Webflow, or custom)'}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-3" style={{ color: textColor }}>Built With</h4>
                  <div className="flex flex-wrap gap-2">
                    {(content.techStack?.technologies || ['Responsive CSS', 'Modern JavaScript', 'SEO Structure', 'Fast Hosting']).map((tech, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{ 
                          backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
                          color: primaryColor
                        }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3" style={{ color: textColor }}>Integrations</h4>
                  <div className="flex flex-wrap gap-2">
                    {(content.techStack?.integrations || ['Email Marketing', 'CRM', 'Social Media', 'Payment Processing']).map((integration, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{ 
                          backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                          color: secondaryColor
                        }}
                      >
                        {integration}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* SEO, Analytics & Automations (if included) */}
        {(selectedPackage?.services?.seo?.included || 
          selectedPackage?.services?.googleAnalytics?.included || 
          selectedPackage?.services?.automations?.included) && (
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {/* SEO */}
            {selectedPackage?.services?.seo?.included && (
              <AnimatedSection delay={600}>
                <div 
                  className="p-6 rounded-2xl"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="w-5 h-5" style={{ color: primaryColor }} />
                    <h4 className="font-medium" style={{ color: textColor }}>SEO Optimization</h4>
                  </div>
                  <ul className="space-y-2">
                    {(content.seoFeatures?.features || [
                      'Meta titles & descriptions',
                      'Schema markup',
                      'Image optimization',
                      'XML sitemap',
                      'robots.txt setup',
                    ]).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" style={{ color: textMutedColor }}>
                        <CheckCircle2 className="w-3 h-3" style={{ color: secondaryColor }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedSection>
            )}

            {/* Analytics */}
            {selectedPackage?.services?.googleAnalytics?.included && (
              <AnimatedSection delay={700}>
                <div 
                  className="p-6 rounded-2xl"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5" style={{ color: primaryColor }} />
                    <h4 className="font-medium" style={{ color: textColor }}>Analytics Setup</h4>
                  </div>
                  <ul className="space-y-2">
                    {(content.analyticsSetup?.tools || [
                      'Google Analytics 4',
                      'Google Tag Manager',
                      'Conversion tracking',
                      'Event tracking',
                      selectedPackage?.services?.metaPixel?.included ? 'Meta Pixel' : null,
                    ]).filter(Boolean).map((tool, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" style={{ color: textMutedColor }}>
                        <CheckCircle2 className="w-3 h-3" style={{ color: secondaryColor }} />
                        {tool}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedSection>
            )}

            {/* Automations */}
            {selectedPackage?.services?.automations?.included && (
              <AnimatedSection delay={800}>
                <div 
                  className="p-6 rounded-2xl"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5" style={{ color: primaryColor }} />
                    <h4 className="font-medium" style={{ color: textColor }}>Automations</h4>
                  </div>
                  <ul className="space-y-2">
                    {(content.automations?.workflows || [
                      'Contact form notifications',
                      'Lead capture to CRM',
                      'Email confirmations',
                      'Appointment scheduling',
                    ]).map((workflow, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" style={{ color: textMutedColor }}>
                        <CheckCircle2 className="w-3 h-3" style={{ color: secondaryColor }} />
                        {workflow}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedSection>
            )}
          </div>
        )}

        {/* Blog Content (if included) */}
        {selectedPackage?.services?.blogs?.included && (
          <AnimatedSection delay={850}>
            <div 
              className="mt-8 p-6 rounded-2xl"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, ${cardBackground})`,
                border: `1px solid ${borderColor}`
              }}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" style={{ color: primaryColor }} />
                <div>
                  <h4 className="font-medium" style={{ color: textColor }}>
                    {selectedPackage.services.blogs.count || 2} Blog Posts Included
                  </h4>
                  <p className="text-sm" style={{ color: textMutedColor }}>
                    Professionally written, SEO-optimized blog content to boost your search rankings and establish authority in your industry.
                  </p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}
        {/* Timeline section removed - handled by dedicated WebsiteTimelineSection to avoid redundancy */}

        {/* Similar Projects We've Built - Portfolio Showcase */}
        {(() => {
          // Default portfolio sites (used when no custom portfolio is provided)
          const defaultPortfolio = [
            {
              url: 'https://melleka.com',
              title: 'Melleka Marketing',
              description: 'Full-service digital marketing agency',
              screenshot: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop'
            },
            {
              url: 'https://example-law.com',
              title: 'Elite Law Partners',
              description: 'Professional law firm website',
              screenshot: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=500&fit=crop'
            },
            {
              url: 'https://example-medical.com',
              title: 'Wellness Medical Center',
              description: 'Healthcare provider website',
              screenshot: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&h=500&fit=crop'
            },
          ];

          // Use content.portfolioWebsites if available and has entries, otherwise use defaults
          const portfolioSites = (content.portfolioWebsites && content.portfolioWebsites.length > 0)
            ? content.portfolioWebsites.map(site => ({
                ...site,
                // Generate a screenshot URL using a screenshot service if not provided
                screenshot: (site as any).screenshot || `https://image.thum.io/get/width/800/crop/500/${site.url}`
              }))
            : defaultPortfolio;

          return (
            <AnimatedSection delay={950}>
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <Monitor className="w-6 h-6" style={{ color: primaryColor }} />
                  <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                    Similar Projects We've Built
                  </h3>
                  <CalloutBadge text="OUR WORK" variant="highlight" />
                </div>
                <p className="mb-8" style={{ color: textMutedColor }}>
                  Explore examples of websites we've created for businesses like yours. Click "View Full Site" to see them live.
                </p>
                
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
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
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
                      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
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
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-transform hover:scale-105"
                            style={{ backgroundColor: primaryColor, color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }}
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
              </div>
            </AnimatedSection>
          );
        })()}

        {/* Deliverables */}
        <AnimatedSection delay={1000}>
          <div className="mt-12">
            <h3 className="text-xl font-display font-semibold mb-6" style={{ color: textColor }}>
              What You'll Receive
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(content.deliverables || [
                'Fully custom website',
                'Mobile-responsive design',
                'Admin access & training',
                'Source files & assets',
                '30-day post-launch support',
                'Documentation',
                'Performance report',
                'SEO audit report',
              ]).map((deliverable, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, transparent)` }}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: secondaryColor }} />
                  <span className="text-sm" style={{ color: textColor }}>{deliverable}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

// Portfolio Card Component - Opens in full page view
const PortfolioEmbed = ({
  site,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor
}: {
  site: PortfolioWebsite;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ensure URL has protocol
  const embedUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;

  return (
    <>
      {/* Preview Card - Clicking opens fullscreen */}
      <button
        onClick={() => setIsFullscreen(true)}
        className="group rounded-2xl overflow-hidden text-left w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
        style={{ 
          backgroundColor: cardBackground,
          border: `1px solid ${borderColor}`
        }}
      >
        {/* Card Header with browser chrome */}
        <div 
          className="px-4 py-3 flex items-center justify-between"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)`,
            borderBottom: `1px solid ${borderColor}`
          }}
        >
          <div className="flex items-center gap-3">
            {/* Browser dots */}
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div 
              className="px-3 py-1 rounded-lg text-xs flex items-center gap-2"
              style={{ backgroundColor: `color-mix(in srgb, ${textColor} 10%, transparent)` }}
            >
              <Globe className="w-3 h-3" style={{ color: textMutedColor }} />
              <span style={{ color: textMutedColor }}>{site.url.replace(/^https?:\/\//, '')}</span>
            </div>
          </div>
          
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all group-hover:scale-105"
            style={{ 
              backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
              color: primaryColor
            }}
          >
            <Maximize2 className="w-4 h-4" />
            <span className="text-xs font-medium">View Full Site</span>
          </div>
        </div>
        
        {/* Preview thumbnail area */}
        <div 
          className="relative aspect-[16/10] flex items-center justify-center overflow-hidden"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor}08, ${secondaryColor}08)`
          }}
        >
          {/* Website preview mockup */}
          <div className="relative w-[90%] h-[85%] rounded-lg shadow-2xl overflow-hidden transition-transform duration-500 group-hover:scale-105"
            style={{ 
              backgroundColor: '#ffffff',
              border: `1px solid ${borderColor}`
            }}
          >
            {/* Simulated browser header */}
            <div className="h-6 flex items-center gap-1.5 px-3" style={{ backgroundColor: '#f5f5f5' }}>
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            
            {/* Content preview placeholder */}
            <div className="p-4 space-y-3">
              <div className="h-3 rounded" style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 30%, #e5e5e5)`, width: '60%' }} />
              <div className="h-2 rounded bg-gray-200" style={{ width: '80%' }} />
              <div className="h-2 rounded bg-gray-200" style={{ width: '70%' }} />
              <div className="mt-4 flex gap-2">
                <div className="h-6 w-16 rounded" style={{ backgroundColor: primaryColor }} />
                <div className="h-6 w-16 rounded" style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 30%, #e5e5e5)` }} />
              </div>
            </div>
          </div>
          
          {/* Hover overlay with CTA */}
          <div 
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}20)`,
              backdropFilter: 'blur(2px)'
            }}
          >
            <div 
              className="px-6 py-3 rounded-full flex items-center gap-3 shadow-xl"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                color: isLightColor(primaryColor) ? '#1a1a2e' : 'white'
              }}
            >
              <Monitor className="w-5 h-5" />
              <span className="font-medium">Click to Explore</span>
              <ExternalLink className="w-4 h-4" />
            </div>
          </div>
        </div>
        
        {/* Footer info */}
        <div className="px-4 py-4" style={{ borderTop: `1px solid ${borderColor}` }}>
          <h4 className="font-semibold mb-1 text-lg" style={{ color: textColor }}>{site.title}</h4>
          {site.description && (
            <p className="text-sm" style={{ color: textMutedColor }}>{site.description}</p>
          )}
        </div>
      </button>

      {/* Fullscreen Overlay - True full page experience */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-[100] animate-fade-in"
          style={{ backgroundColor: '#0a0a0a' }}
        >
          {/* Minimal header bar */}
          <div 
            className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-10"
            style={{ 
              background: `linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)` 
            }}
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-white/80" />
              <span className="text-white font-medium">{site.title}</span>
              <span className="text-white/50 text-sm hidden sm:inline">• {site.url}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                style={{ 
                  backgroundColor: `color-mix(in srgb, ${primaryColor} 80%, transparent)`,
                  color: isLightColor(primaryColor) ? '#1a1a2e' : 'white'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Open in New Tab</span>
              </a>
              <button
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          
          {/* Full page iframe */}
          <iframe
            src={embedUrl}
            title={site.title}
            className="w-full h-full pt-14"
            style={{ border: 'none' }}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}
    </>
  );
};

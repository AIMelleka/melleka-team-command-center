import { CheckCircle2, Calendar, Palette, Zap, Search, BarChart3, Globe, Shield, Smartphone, Clock, DollarSign, Users, FileText, Mail, Sparkles, Star, Award, Layers, ArrowRight, Target, TrendingUp, Loader2, Layout, Code } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { PlatformBadge } from '@/components/PlatformLogos';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
interface WebsitePackageServices {
  revisions?: {
    included: boolean;
    details?: string;
  };
  dedicatedManager?: {
    included: boolean;
    details?: string;
  };
  uniqueDesign?: {
    included: boolean;
    details?: string;
  };
  pages?: {
    included: boolean;
    count?: string;
    details?: string;
  };
  googleAnalytics?: {
    included: boolean;
    details?: string;
  };
  metaPixel?: {
    included: boolean;
    details?: string;
  };
  seo?: {
    included: boolean;
    details?: string;
  };
  automations?: {
    included: boolean;
    details?: string;
  };
  blogs?: {
    included: boolean;
    count?: number;
    details?: string;
  };
  mobileOptimized?: {
    included: boolean;
    details?: string;
  };
  contactForms?: {
    included: boolean;
    details?: string;
  };
  socialIntegration?: {
    included: boolean;
    details?: string;
  };
  speedOptimization?: {
    included: boolean;
    details?: string;
  };
  securitySSL?: {
    included: boolean;
    details?: string;
  };
}
interface WebsitePackage {
  id?: string;
  name?: string;
  price?: number;
  pages?: string;
  tier?: number;
  services?: WebsitePackageServices;
}
interface SeoData {
  seoMetrics?: {
    keywords?: string;
    traffic?: string;
    domainAuthority?: string;
    backlinks?: string;
  };
  topKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty: number;
  }>;
  competitors?: Array<{
    domain: string;
    commonKeywords: number;
    relevance?: number;
    organicTraffic?: number;
  }>;
  keywordGap?: Array<{
    keyword: string;
    competitorPosition: number;
    volume: number;
    difficulty: number;
    competitorDomain: string;
  }>;
  lastUpdated?: string;
  domain?: string;
}
interface WebsiteSectionProps {
  websitePackage: WebsitePackage;
  clientName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

// AI-generated personalized content interfaces
interface PersonalizedPage {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}
interface PersonalizedWorkflow {
  name: string;
  trigger: string;
  actions: string[];
  benefit: string;
}
interface PersonalizedBlogTopic {
  title: string;
  category: string;
  targetKeyword: string;
  purpose: string;
}
interface PersonalizedMilestone {
  week: string;
  title: string;
  description: string;
  deliverables?: string[];
}
interface PersonalizedDesignStep {
  title: string;
  description: string;
}
interface PersonalizedAutomations {
  headline?: string;
  description?: string;
  workflows?: PersonalizedWorkflow[];
  integrations?: string[];
}
interface PersonalizedBlogContent {
  headline?: string;
  description?: string;
  topics?: PersonalizedBlogTopic[];
  contentCalendar?: {
    frequency?: string;
    themes?: string[];
  };
}
interface PersonalizedTimeline {
  duration?: string;
  milestones?: PersonalizedMilestone[];
}
interface PersonalizedDesignApproach {
  headline?: string;
  philosophy?: string;
  steps?: PersonalizedDesignStep[];
}
interface PersonalizedWebsiteDesign {
  headline?: string;
  description?: string;
  designApproach?: PersonalizedDesignApproach;
  pages?: PersonalizedPage[];
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
  timeline?: {
    discovery?: string;
    design?: string;
    development?: string;
    launch?: string;
    total?: string;
  };
  deliverables?: string[];
}
interface SeoAnalyticsSectionProps extends Omit<WebsiteSectionProps, 'websitePackage'> {
  websitePackage?: WebsitePackage;
  liveSeoData?: SeoData | null;
  isFetchingSeo?: boolean;
  seoSearchDomain?: string;
  onSeoSearchChange?: (domain: string) => void;
  onFetchSeo?: () => void;
  isLightBackground?: boolean;
}
interface DesignProcessSectionProps extends Omit<WebsiteSectionProps, 'websitePackage' | 'clientName'> {
  clientName?: string;
  designApproach?: PersonalizedDesignApproach;
  websitePackage?: WebsitePackage;
  websiteDescription?: string;
  pages?: PersonalizedPage[];
}
interface AutomationsSectionProps extends Omit<WebsiteSectionProps, 'websitePackage' | 'clientName'> {
  clientName?: string;
  automationWorkflows?: PersonalizedAutomations;
}
interface BlogContentSectionProps extends WebsiteSectionProps {
  blogContent?: PersonalizedBlogContent;
}
interface WebsiteTimelineSectionProps extends Omit<WebsiteSectionProps, 'websitePackage' | 'clientName'> {
  clientName?: string;
  timeline?: PersonalizedTimeline;
}
interface ProposedPagesSectionProps extends Omit<WebsiteSectionProps, 'websitePackage'> {
  websitePackage?: WebsitePackage;
  websiteDesign?: PersonalizedWebsiteDesign;
}

// Your Package Section - Shows what client gets
export const YourPackageSection = ({
  websitePackage,
  clientName,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: WebsiteSectionProps) => {
  const services = websitePackage?.services || {};
  const tier = websitePackage?.tier || 1;

  // Get package-specific features based on tier - descriptions are client-contextual
  const getPackageFeatures = () => {
    const baseFeatures = [{
      icon: Star,
      name: 'Unlimited Revisions',
      description: `We revise ${clientName}'s website until you're completely satisfied`,
      included: true
    }, {
      icon: Users,
      name: 'Dedicated Manager',
      description: `Your personal point of contact for ${clientName}'s project`,
      included: true
    }, {
      icon: Palette,
      name: tier === 3 ? 'Premium Design' : 'Unique Design',
      description: `Custom-designed to perfectly match ${clientName}'s brand`,
      included: true
    }, {
      icon: Layers,
      name: websitePackage?.pages || 'Up to 15 Pages',
      description: 'Every page fully designed and optimized for conversions',
      included: true
    }, {
      icon: Code,
      name: 'Built on Any Platform',
      description: 'WordPress, Shopify, Webflow, Wix, or custom. We build on your preferred platform',
      included: true
    }];

    // Premium & Ultra Premium features
    if (tier >= 2) {
      baseFeatures.push({
        icon: BarChart3,
        name: 'Google Analytics',
        description: `Full GA4 setup to track ${clientName}'s visitors and conversions`,
        included: services.googleAnalytics?.included || false
      }, {
        icon: Globe,
        name: 'Meta Pixel',
        description: `Retargeting-ready for ${clientName}'s social ad campaigns`,
        included: services.metaPixel?.included || false
      }, {
        icon: Search,
        name: 'SEO Optimized',
        description: `Built to rank for ${clientName}'s target keywords`,
        included: services.seo?.included || false
      });
    }

    // Ultra Premium only features
    if (tier >= 3) {
      baseFeatures.push({
        icon: Zap,
        name: 'Automations Included',
        description: `Automated email sequences & form workflows for ${clientName}`,
        included: services.automations?.included || false
      }, {
        icon: FileText,
        name: `${services.blogs?.count || 2} Blogs Included`,
        description: `SEO-optimized content about ${clientName}'s industry`,
        included: services.blogs?.included || false
      });
    }
    return baseFeatures.filter(f => f.included);
  };
  const features = getPackageFeatures();
  return <section id="your-package" className="py-24" style={{
    backgroundColor: 'transparent'
  }}>
      <div className="container max-w-6xl mx-auto px-4">

        <AnimatedSection delay={100}>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              What's Included
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{ color: textColor }}>
              Your Investment
            </h2>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
              Everything you get with this package
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => {
            const FeatureIcon = feature.icon;
            return <div key={i} className="p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02]" style={{
              backgroundColor: cardBackground,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
            }}>
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                  backgroundColor: primaryColor
                }}>
                      <FeatureIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1" style={{
                    color: textColor
                  }}>
                        {feature.name}
                      </h3>
                      <p className="text-xs leading-relaxed" style={{
                    color: textMutedColor
                  }}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>;
          })}
          </div>
        </AnimatedSection>

      </div>
    </section>;
};

// Design Process Section
export const DesignProcessSection = ({
  clientName,
  designApproach,
  websitePackage,
  websiteDescription,
  pages,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: DesignProcessSectionProps) => {
  // Use AI-generated steps if available, otherwise fall back to defaults
  const aiSteps = designApproach?.steps || [];
  const hasAiSteps = aiSteps.length >= 4;
  const defaultPhases = [{
    phase: 1,
    name: 'Discovery',
    icon: Search,
    description: `Discovery call with ${clientName || 'your team'}, competitor analysis, content gathering, and sitemap planning`
  }, {
    phase: 2,
    name: 'Design',
    icon: Palette,
    description: `Custom wireframe creation, UI/UX design for ${clientName || 'your brand'}, brand integration, and unlimited revisions`
  }, {
    phase: 3,
    name: 'Development',
    icon: Layers,
    description: `Responsive build for ${clientName || 'your site'}, CMS integration, speed optimization, and SEO foundations`
  }, {
    phase: 4,
    name: 'Launch',
    icon: Sparkles,
    description: `Quality testing, ${clientName || 'your'} domain setup, go live, and personalized training session`
  }];
  const phases = hasAiSteps ? aiSteps.map((step, i) => ({
    phase: i + 1,
    name: step.title,
    icon: i === 0 ? Search : i === 1 ? Palette : i === 2 ? Layers : Sparkles,
    description: step.description
  })) : defaultPhases;
  const philosophy = designApproach?.philosophy;
  return <section id="design-process" className="py-24" style={{
    backgroundColor: 'transparent'
  }}>
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section Header - Our Process */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{
            color: secondaryColor
          }}>
              Our Process
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor
          }}>
              {designApproach?.headline || 'From Concept to Launch'}
            </h2>
            <p className="text-lg max-w-3xl mx-auto" style={{
            color: textMutedColor
          }}>
              {philosophy || `Our proven 4-phase process ensures your website is built right: on time, on brand, and optimized for conversions.`}
            </p>
          </div>
        </AnimatedSection>

        {/* Process Phases */}
        <div className="grid md:grid-cols-4 gap-6">
          {phases.map((phase, i) => {
          const PhaseIcon = phase.icon;
          return <AnimatedSection key={i} delay={100 + i * 100}>
                <div className="relative p-6 rounded-2xl h-full" style={{
              backgroundColor: cardBackground,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
            }}>
                  {/* Phase badge */}
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold" style={{
                backgroundColor: primaryColor,
                color: 'white'
              }}>
                    PHASE {phase.phase}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                    backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                  }}>
                        <PhaseIcon className="w-5 h-5" style={{
                      color: primaryColor
                    }} />
                      </div>
                      <h3 className="font-display font-bold text-lg" style={{
                    color: textColor
                  }}>{phase.name}</h3>
                    </div>

                    <p className="text-sm" style={{
                  color: textMutedColor
                }}>
                      {phase.description}
                    </p>
                  </div>

                  {/* Arrow to next */}
                  {i < 3 && <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="w-6 h-6" style={{
                  color: borderColor
                }} />
                    </div>}
                </div>
              </AnimatedSection>;
        })}
        </div>

        {/* Proposed Website Pages */}
        {pages && pages.length > 0 && <AnimatedSection delay={200}>
            <div className="mt-16">
              <h3 className="text-xl font-display font-semibold mb-6" style={{
            color: textColor
          }}>
                Proposed Website Pages
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pages.map((page, i) => <div key={i} className="p-4 rounded-xl transition-all duration-300 hover:scale-[1.02]" style={{
              backgroundColor: cardBackground,
              border: `1px solid ${borderColor}`
            }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Layout className="w-4 h-4" style={{
                    color: primaryColor
                  }} />
                        <h4 className="font-medium" style={{
                    color: textColor
                  }}>{page.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs" style={{
                  backgroundColor: page.priority === 'high' ? `color-mix(in srgb, ${secondaryColor} 15%, transparent)` : `color-mix(in srgb, ${textColor} 10%, transparent)`,
                  color: page.priority === 'high' ? secondaryColor : textMutedColor
                }}>
                        {page.priority}
                      </span>
                    </div>
                    <p className="text-sm" style={{
                color: textMutedColor
              }}>{page.description}</p>
                  </div>)}
              </div>
            </div>
          </AnimatedSection>}
      </div>
    </section>;
};

// What's Included Section - detailed breakdown
export const WhatsIncludedSection = ({
  websitePackage,
  clientName,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: WebsiteSectionProps) => {
  const services = websitePackage?.services || {};
  const includedItems = [{
    category: 'Design & Development',
    items: [{
      name: 'Custom Homepage Design',
      included: true
    }, {
      name: `Up to ${services.pages?.count || '15'} Interior Pages`,
      included: true
    }, {
      name: 'Mobile Responsive Design',
      included: services.mobileOptimized?.included ?? true
    }, {
      name: 'Contact & Lead Forms',
      included: services.contactForms?.included ?? true
    }, {
      name: 'Social Media Integration',
      included: services.socialIntegration?.included ?? true
    }]
  }, {
    category: 'Performance & Security',
    items: [{
      name: 'Speed Optimization',
      included: services.speedOptimization?.included ?? true
    }, {
      name: 'SSL Certificate',
      included: services.securitySSL?.included ?? true
    }, {
      name: 'Browser Compatibility',
      included: true
    }, {
      name: 'Mobile Testing',
      included: true
    }]
  }, {
    category: 'Support & Training',
    items: [{
      name: 'Unlimited Revisions',
      included: services.revisions?.included ?? true
    }, {
      name: 'Dedicated Project Manager',
      included: services.dedicatedManager?.included ?? true
    }, {
      name: 'CMS Training Session',
      included: true
    }, {
      name: '30-Day Post-Launch Support',
      included: true
    }]
  }];
  return <section id="whats-included" className="py-24" style={{
    backgroundColor: 'transparent'
  }}>
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{
            color: secondaryColor
          }}>
              Full Breakdown
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor
          }}>
              What's Included
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{
            color: textMutedColor
          }}>
              Everything {clientName} gets with the {websitePackage?.name || 'website'} package.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {includedItems.map((category, i) => <AnimatedSection key={i} delay={i * 100}>
              <div className="p-6 rounded-2xl h-full" style={{
            backgroundColor: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
          }}>
                <h3 className="font-display font-semibold text-lg mb-6" style={{
              color: textColor
            }}>
                  {category.category}
                </h3>
                <ul className="space-y-4">
                  {category.items.filter(item => item.included).map((item, j) => <li key={j} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{
                  color: secondaryColor
                }} />
                      <span style={{
                  color: textMutedColor
                }}>{item.name}</span>
                    </li>)}
                </ul>
              </div>
            </AnimatedSection>)}
        </div>
      </div>
    </section>;
};

// SEO & Analytics Section - Enhanced with Live SEO Dashboard
export const SeoAnalyticsSection = ({
  websitePackage,
  clientName,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor,
  liveSeoData,
  isFetchingSeo,
  seoSearchDomain,
  onSeoSearchChange,
  onFetchSeo,
  isLightBackground
}: SeoAnalyticsSectionProps) => {
  const services = websitePackage?.services || {};
  const seoMetrics = liveSeoData?.seoMetrics;
  const topKeywords = liveSeoData?.topKeywords;
  const competitors = liveSeoData?.competitors;
  const accentColor = secondaryColor;
  const seoFeatures = [{
    name: 'On-Page SEO Optimization',
    description: 'Meta titles, descriptions, and header structure'
  }, {
    name: 'Image Optimization',
    description: 'Compressed images with proper alt tags'
  }, {
    name: 'URL Structure',
    description: 'SEO-friendly URL patterns'
  }, {
    name: 'Schema Markup',
    description: 'Structured data for rich search results'
  }];
  const analyticsFeatures = [{
    name: 'Google Analytics 4',
    description: 'Full GA4 setup with event tracking',
    included: services.googleAnalytics?.included
  }, {
    name: 'Meta Pixel',
    description: 'Facebook/Instagram retargeting ready',
    included: services.metaPixel?.included
  }, {
    name: 'Conversion Tracking',
    description: 'Track form submissions and calls',
    included: services.googleAnalytics?.included
  }, {
    name: 'Custom Reports',
    description: 'Monthly performance insights',
    included: services.googleAnalytics?.included
  }];
  return <section id="seo-analytics" className="py-24" style={{
    backgroundColor: 'transparent'
  }}>
      <div className="container max-w-6xl mx-auto px-4">
        {/* Hero Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{
            background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`
          }}>
              <BarChart3 className="w-4 h-4" style={{
              color: secondaryColor
            }} />
              <span className="text-sm font-medium" style={{
              color: secondaryColor
            }}>Live SEO Dashboard</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor
          }}>
              SEO Strategy for{' '}
              <span style={{
              color: primaryColor
            }}>{clientName}</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{
            color: textMutedColor
          }}>Real-time SEO analysis. See exactly where you stand and the opportunities waiting to be captured.</p>
          </div>
        </AnimatedSection>

        {/* Interactive Domain Search */}
        {onFetchSeo && <AnimatedSection delay={50}>
            <div className="relative p-8 rounded-3xl mb-12 overflow-hidden" style={{
          background: cardBackground,
          border: `1px solid ${borderColor}`,
          boxShadow: `0 20px 60px color-mix(in srgb, ${primaryColor} 10%, transparent)`
        }}>
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30" style={{
            background: primaryColor
          }} />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-3xl opacity-20" style={{
            background: secondaryColor
          }} />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
              }}>
                    <Search className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold" style={{
                  color: textColor
                }}>
                      Analyze Any Domain
                    </h3>
                    <p className="text-sm" style={{
                  color: textMutedColor
                }}>
                      Pre-filled with your website • Pull live Semrush data instantly
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{
                  color: primaryColor
                }} />
                    <input type="text" placeholder="Enter any domain to analyze..." value={seoSearchDomain || ''} onChange={e => onSeoSearchChange?.(e.target.value)} onKeyDown={e => e.key === 'Enter' && onFetchSeo?.()} className="w-full pl-12 pr-4 py-4 rounded-xl text-lg outline-none transition-all focus:ring-2" style={{
                  backgroundColor: isLightBackground ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.3)',
                  border: `2px solid ${borderColor}`,
                  color: textColor
                }} />
                  </div>
                  <button onClick={() => onFetchSeo?.()} disabled={isFetchingSeo || !seoSearchDomain?.trim()} className="flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100" style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                color: 'white',
                boxShadow: `0 10px 30px color-mix(in srgb, ${primaryColor} 40%, transparent)`
              }}>
                    {isFetchingSeo ? <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </> : <>
                        <Sparkles className="w-5 h-5" />
                        Get SEO Insights
                      </>}
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-6 pt-6" style={{
              borderTop: `1px solid ${borderColor}`
            }}>
                  <span className="text-sm" style={{
                color: textMutedColor
              }}>Data powered by:</span>
                  <PlatformBadge platform="semrush" />
                  <PlatformBadge platform="google" />
                </div>
              </div>
            </div>
          </AnimatedSection>}

        {/* Live SEO Data Dashboard */}
        {seoMetrics ? <>
            {/* Metrics Cards */}
            <AnimatedSection delay={100}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
                {[{
              label: 'Organic Keywords',
              value: seoMetrics.keywords,
              icon: Target,
              color: primaryColor
            }, {
              label: 'Monthly Traffic',
              value: seoMetrics.traffic,
              icon: TrendingUp,
              color: secondaryColor
            }, {
              label: 'Domain Authority',
              value: seoMetrics.domainAuthority,
              icon: Shield,
              color: accentColor
            }, {
              label: 'Backlinks',
              value: seoMetrics.backlinks,
              icon: Layers,
              color: primaryColor
            }].map((metric, i) => {
              const MetricIcon = metric.icon;
              return <div key={i} className="relative p-6 rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`,
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
              }}>
                      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" style={{
                  background: metric.color
                }} />
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{
                    background: `color-mix(in srgb, ${metric.color} 15%, transparent)`
                  }}>
                          <MetricIcon className="w-5 h-5" style={{
                      color: metric.color
                    }} />
                        </div>
                        <p className="text-3xl md:text-4xl font-display font-bold mb-1" style={{
                    color: metric.color
                  }}>
                          <AnimatedCounter value={metric.value || '0'} duration={2000} />
                        </p>
                        <p className="text-sm" style={{
                    color: textMutedColor
                  }}>{metric.label}</p>
                      </div>
                    </div>;
            })}
              </div>
            </AnimatedSection>

            {/* Top Keywords */}
            {topKeywords && topKeywords.length > 0 && <AnimatedSection delay={150}>
                <div className="p-8 rounded-3xl mb-12" style={{
            background: cardBackground,
            border: `1px solid ${borderColor}`
          }}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h3 className="text-2xl font-display font-bold mb-2" style={{
                  color: textColor
                }}>
                        Your Top Ranking Keywords
                      </h3>
                      <p className="text-sm" style={{
                  color: textMutedColor
                }}>
                        Live keyword rankings for {liveSeoData?.domain}
                      </p>
                    </div>
                    {liveSeoData?.lastUpdated && <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{
                background: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                color: secondaryColor
              }}>
                        <Clock className="w-3 h-3" />
                        Updated: {liveSeoData.lastUpdated}
                      </div>}
                  </div>
                  
                  <div className="grid gap-3">
                    {topKeywords.slice(0, 6).map((kw, i) => <div key={i} className="flex items-center justify-between p-4 rounded-xl transition-all hover:scale-[1.01]" style={{
                background: isLightBackground ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${borderColor}`
              }}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{
                    background: kw.position <= 3 ? `linear-gradient(135deg, ${secondaryColor}, color-mix(in srgb, ${secondaryColor} 70%, ${primaryColor}))` : kw.position <= 10 ? `color-mix(in srgb, ${primaryColor} 20%, transparent)` : cardBackground,
                    color: kw.position <= 3 ? 'white' : kw.position <= 10 ? primaryColor : textMutedColor,
                    border: kw.position > 10 ? `1px solid ${borderColor}` : 'none'
                  }}>
                            #{kw.position}
                          </div>
                          <div>
                            <p className="font-medium" style={{
                      color: textColor
                    }}>{kw.keyword}</p>
                            <p className="text-xs" style={{
                      color: textMutedColor
                    }}>
                              {kw.volume?.toLocaleString()} monthly searches
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs font-medium" style={{
                      color: textMutedColor
                    }}>Difficulty</p>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 rounded-full overflow-hidden" style={{
                        background: borderColor
                      }}>
                                <div className="h-full rounded-full transition-all" style={{
                          width: `${kw.difficulty}%`,
                          background: kw.difficulty < 30 ? '#22c55e' : kw.difficulty < 60 ? '#eab308' : '#ef4444'
                        }} />
                              </div>
                              <span className="text-xs font-medium" style={{
                        color: kw.difficulty < 30 ? '#22c55e' : kw.difficulty < 60 ? '#eab308' : '#ef4444'
                      }}>
                                {kw.difficulty}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>)}
                  </div>
                </div>
              </AnimatedSection>}

            {/* Competitor Landscape + Chart */}
            {competitors && competitors.length > 0 && <AnimatedSection delay={200}>
                <div className="grid md:grid-cols-2 gap-6 mb-12">
                  {/* Competitors List */}
                  <div className="p-8 rounded-3xl" style={{
              background: cardBackground,
              border: `1px solid ${borderColor}`
            }}>
                    <h3 className="text-xl font-display font-bold mb-6" style={{
                color: textColor
              }}>
                      Your SEO Competitors
                    </h3>
                    <div className="space-y-4">
                      {competitors.slice(0, 4).map((comp, i) => <div key={i} className="flex items-center justify-between p-4 rounded-xl" style={{
                  background: isLightBackground ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderColor}`
                }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{
                      background: `color-mix(in srgb, ${primaryColor} ${100 - i * 20}%, transparent)`,
                      color: i === 0 ? 'white' : primaryColor
                    }}>
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm" style={{
                        color: textColor
                      }}>{comp.domain}</p>
                              <p className="text-xs" style={{
                        color: textMutedColor
                      }}>
                                {comp.commonKeywords} shared keywords
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{
                      color: secondaryColor
                    }}>
                              {comp.organicTraffic?.toLocaleString() || '-'}
                            </p>
                            <p className="text-xs" style={{
                      color: textMutedColor
                    }}>traffic/mo</p>
                          </div>
                        </div>)}
                    </div>
                  </div>

                  {/* Traffic Comparison Chart */}
                  <div className="p-8 rounded-3xl" style={{
              background: cardBackground,
              border: `1px solid ${borderColor}`
            }}>
                    <h3 className="text-xl font-display font-bold mb-6" style={{
                color: textColor
              }}>
                      Traffic Comparison
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{
                    name: 'You',
                    traffic: parseInt(seoMetrics.traffic?.replace(/,/g, '') || '0'),
                    fill: primaryColor
                  }, ...competitors.slice(0, 3).map((comp, idx) => ({
                    name: comp.domain.split('.')[0].substring(0, 10),
                    traffic: comp.organicTraffic || 0,
                    fill: `color-mix(in srgb, ${secondaryColor} ${80 - idx * 20}%, transparent)`
                  }))]} layout="vertical" margin={{
                    top: 5,
                    right: 20,
                    left: 60,
                    bottom: 5
                  }}>
                          <XAxis type="number" tickFormatter={value => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()} stroke={textMutedColor} fontSize={11} />
                          <YAxis type="category" dataKey="name" stroke={textMutedColor} fontSize={11} width={55} />
                          <Tooltip contentStyle={{
                      backgroundColor: cardBackground,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }} labelStyle={{ color: textColor }} itemStyle={{ color: textMutedColor }} formatter={(value: number) => [value.toLocaleString() + ' visits/mo', 'Traffic']} />
                          <Bar dataKey="traffic" radius={[0, 8, 8, 0]}>
                            {[0, 1, 2, 3].map(index => <Cell key={`cell-${index}`} fill={index === 0 ? primaryColor : `color-mix(in srgb, ${secondaryColor} ${80 - index * 15}%, ${backgroundColor})`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </AnimatedSection>}

            {/* Keyword Gap - Opportunities */}
            {liveSeoData?.keywordGap && liveSeoData.keywordGap.length > 0 && <AnimatedSection delay={250}>
                <div className="p-8 rounded-3xl mb-12" style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 8%, ${cardBackground}), ${cardBackground})`,
            border: `1px solid ${borderColor}`
          }}>
                  <div className="flex items-start gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
                background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})`
              }}>
                      <Target className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-bold mb-2" style={{
                  color: textColor
                }}>
                        🎯 Keyword Opportunities for {clientName}
                      </h3>
                      <p style={{
                  color: textMutedColor
                }}>
                        These are keywords your competitors rank for that you're missing. Each represents untapped traffic potential.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {liveSeoData.keywordGap.slice(0, 6).map((gap, i) => {
                const priorityScore = gap.volume / 100 * (100 - gap.difficulty) / 100;
                const priority = priorityScore > 50 ? 'High' : priorityScore > 20 ? 'Medium' : 'Low';
                return <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl transition-all hover:scale-[1.01]" style={{
                  background: cardBackground,
                  border: priority === 'High' ? `2px solid color-mix(in srgb, ${secondaryColor} 50%, transparent)` : `1px solid ${borderColor}`,
                  boxShadow: priority === 'High' ? `0 4px 20px color-mix(in srgb, ${secondaryColor} 15%, transparent)` : 'none'
                }}>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold" style={{
                        color: textColor
                      }}>{gap.keyword}</p>
                              {priority === 'High' && <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1" style={{
                        background: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`,
                        color: secondaryColor
                      }}>
                                  <Sparkles className="w-3 h-3" />
                                  Quick Win
                                </span>}
                            </div>
                            <p className="text-xs" style={{
                      color: textMutedColor
                    }}>
                              Competitor "{gap.competitorDomain}" ranks #{gap.competitorPosition} for this keyword
                            </p>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-lg font-bold" style={{
                        color: primaryColor
                      }}>
                                {gap.volume?.toLocaleString()}
                              </p>
                              <p className="text-xs" style={{
                        color: textMutedColor
                      }}>searches/mo</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold" style={{
                        color: gap.difficulty < 30 ? '#22c55e' : gap.difficulty < 60 ? '#eab308' : '#ef4444'
                      }}>
                                {gap.difficulty}%
                              </p>
                              <p className="text-xs" style={{
                        color: textMutedColor
                      }}>difficulty</p>
                            </div>
                          </div>
                        </div>;
              })}
                  </div>

                  <div className="mt-6 p-4 rounded-xl flex items-start gap-3" style={{
              background: `color-mix(in srgb, ${primaryColor} 10%, transparent)`
            }}>
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" style={{
                color: primaryColor
              }} />
                    <p className="text-sm" style={{
                color: textColor
              }}>
                      <strong>Strategy Tip:</strong> Focus on "Quick Win" keywords first. These have high search volume and low difficulty, 
                      meaning you can rank faster and capture traffic within 3-6 months.
                    </p>
                  </div>
                </div>
              </AnimatedSection>}
          </> : (/* Loading/Empty State */
      <AnimatedSection delay={100}>
            <div className="p-12 rounded-3xl text-center mb-12" style={{
          background: cardBackground,
          border: `1px solid ${borderColor}`
        }}>
              {isFetchingSeo ? <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 animate-spin" style={{
              color: primaryColor
            }} />
                  <p className="text-lg font-medium" style={{
              color: textColor
            }}>
                    Analyzing SEO data...
                  </p>
                  <p className="text-sm" style={{
              color: textMutedColor
            }}>
                    Pulling live metrics from Semrush
                  </p>
                </div> : onFetchSeo ? <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
              background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
            }}>
                    <Search className="w-8 h-8" style={{
                color: primaryColor
              }} />
                  </div>
                  <p className="text-lg font-medium" style={{
              color: textColor
            }}>
                    Enter a domain above to see SEO insights
                  </p>
                  <p className="text-sm" style={{
              color: textMutedColor
            }}>
                    Get real-time keyword rankings, traffic data, and competitor analysis
                  </p>
                </div> : null}
            </div>
          </AnimatedSection>)}

        {/* SEO & Analytics Features Grid (always shown) */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* SEO Features */}
          <AnimatedSection delay={300}>
            <div className="p-8 rounded-2xl h-full" style={{
            backgroundColor: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
          }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                backgroundColor: primaryColor
              }}>
                  <Search className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold" style={{
                color: textColor
              }}>SEO Optimization</h3>
              </div>
              <ul className="space-y-4">
                {seoFeatures.map((feature, i) => <li key={i}>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{
                    color: secondaryColor
                  }} />
                      <div>
                        <p className="font-medium" style={{
                      color: textColor
                    }}>{feature.name}</p>
                        <p className="text-sm" style={{
                      color: textMutedColor
                    }}>{feature.description}</p>
                      </div>
                    </div>
                  </li>)}
              </ul>
            </div>
          </AnimatedSection>

          {/* Analytics Features */}
          <AnimatedSection delay={400}>
            <div className="p-8 rounded-2xl h-full" style={{
            backgroundColor: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
          }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                backgroundColor: primaryColor
              }}>
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold" style={{
                color: textColor
              }}>Analytics Setup</h3>
              </div>
              <ul className="space-y-4">
                {analyticsFeatures.filter(f => f.included).map((feature, i) => <li key={i}>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{
                    color: secondaryColor
                  }} />
                      <div>
                        <p className="font-medium" style={{
                      color: textColor
                    }}>{feature.name}</p>
                        <p className="text-sm" style={{
                      color: textMutedColor
                    }}>{feature.description}</p>
                      </div>
                    </div>
                  </li>)}
              </ul>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>;
};

// Automations Section - Only for Ultra Premium
export const AutomationsSection = ({
  clientName,
  automationWorkflows,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: AutomationsSectionProps) => {
  // Use AI-generated workflows if available
  const aiWorkflows = automationWorkflows?.workflows || [];
  const hasAiWorkflows = aiWorkflows.length > 0;
  const defaultAutomations = [{
    name: 'Contact Form Automation',
    description: 'Automatically route inquiries to the right team member',
    icon: Mail
  }, {
    name: 'Welcome Email Sequence',
    description: 'Nurture new leads with automated email follow-ups',
    icon: FileText
  }, {
    name: 'Appointment Booking',
    description: 'Let visitors schedule consultations directly',
    icon: Calendar
  }, {
    name: 'SMS Follow-Up',
    description: 'Send instant text confirmations and reminders to boost engagement',
    icon: Smartphone
  }, {
    name: 'CRM Integration',
    description: 'Sync leads to your existing CRM automatically',
    icon: Users
  }];
  const displayItems = hasAiWorkflows ? aiWorkflows.map((w, i) => ({
    name: w.name,
    description: `${w.trigger} → ${w.actions.slice(0, 2).join(', ')}`,
    benefit: w.benefit,
    icon: i === 0 ? Mail : i === 1 ? FileText : i === 2 ? Calendar : Users
  })) : defaultAutomations;
  return <section id="automations" className="py-24" style={{
    backgroundColor: 'transparent'
  }}>
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{
            backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`
          }}>
              <Sparkles className="w-4 h-4" style={{
              color: secondaryColor
            }} />
              <span className="text-sm font-medium" style={{
              color: secondaryColor
            }}>Ultra Premium Exclusive</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor
          }}>
              {automationWorkflows?.headline || 'Automations Included'}
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{
            color: textMutedColor
          }}>
              {automationWorkflows?.description || `Save time and never miss a lead with powerful automations built directly into your website.`}
            </p>
          </div>
        </AnimatedSection>

        <div className="flex flex-wrap justify-center gap-6">
          {displayItems.map((automation, i) => {
          const AutoIcon = automation.icon;
          return <AnimatedSection key={i} delay={i * 100}>
                <div className="p-6 rounded-2xl text-center h-full w-full max-w-[280px]" style={{
              backgroundColor: cardBackground,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
            }}>
                  <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{
                backgroundColor: primaryColor
              }}>
                    <AutoIcon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2" style={{
                color: textColor
              }}>{automation.name}</h3>
                  <p className="text-sm" style={{
                color: textMutedColor
              }}>{automation.description}</p>
                  {'benefit' in automation && (automation as {
                benefit?: string;
              }).benefit && <p className="text-xs mt-2 font-medium" style={{
                color: secondaryColor
              }}>{(automation as {
                  benefit?: string;
                }).benefit}</p>}
                </div>
              </AnimatedSection>;
        })}
        </div>
      </div>
    </section>;
};

// Blog Content Section - Only for Ultra Premium
export const BlogContentSection = ({
  websitePackage,
  clientName,
  blogContent,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: BlogContentSectionProps) => {
  const blogCount = websitePackage?.services?.blogs?.count || 2;
  const allTopics = blogContent?.topics || [];
  
  // Filter out generic/placeholder topics - only show topics that are custom to this client
  // A topic is considered custom if it doesn't contain placeholder brackets and has substantive content
  const isCustomTopic = (topic: PersonalizedBlogTopic): boolean => {
    const hasPlaceholders = 
      topic.title.includes('[') || 
      topic.title.includes(']') ||
      topic.category.includes('[') ||
      topic.targetKeyword.includes('[') ||
      topic.purpose.includes('[');
    
    const isGeneric = 
      topic.title.toLowerCase().includes('blog title') ||
      topic.title.toLowerCase().includes('example') ||
      topic.title.toLowerCase().includes('placeholder') ||
      topic.title.trim().length < 10;
    
    return !hasPlaceholders && !isGeneric && topic.title.trim().length > 0;
  };
  
  const topics = allTopics.filter(isCustomTopic);
  const hasTopics = topics.length > 0;
  return <section id="blog-content" className="py-24" style={{
    backgroundColor: 'transparent'
  }}>
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{
            backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`
          }}>
              <Award className="w-4 h-4" style={{
              color: secondaryColor
            }} />
              <span className="text-sm font-medium" style={{
              color: secondaryColor
            }}>Ultra Premium Exclusive</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor
          }}>
              {blogContent?.headline || `${blogCount} Blog Posts Included`}
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{
            color: textMutedColor
          }}>
              {blogContent?.description || `Professionally written, SEO-optimized blog content to boost your search rankings and establish ${clientName} as an industry authority.`}
            </p>
          </div>
        </AnimatedSection>

        {hasTopics ? <div className="grid md:grid-cols-2 gap-6">
            {topics.map((topic, i) => <AnimatedSection key={i} delay={i * 100}>
                <div className="p-6 rounded-2xl" style={{
            backgroundColor: cardBackground,
            border: `1px solid ${borderColor}`
          }}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                backgroundColor: primaryColor
              }}>
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                  backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                  color: secondaryColor
                }}>{topic.category}</span>
                      <h3 className="font-display font-bold text-lg mt-2 mb-1" style={{
                  color: textColor
                }}>{topic.title}</h3>
                      <p className="text-sm mb-2" style={{
                  color: textMutedColor
                }}>{topic.purpose}</p>
                      <p className="text-xs" style={{
                  color: secondaryColor
                }}>Target: {topic.targetKeyword}</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>)}
          </div> : <AnimatedSection delay={100}>
            <div className="p-8 rounded-2xl" style={{
          backgroundColor: cardBackground,
          border: `1px solid ${borderColor}`
        }}>
              <h3 className="text-xl font-display font-bold text-center mb-8" style={{
            color: textColor
          }}>Blog Topic Ideas</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4" style={{
                color: primaryColor
              }} />
                  <h4 className="font-semibold mb-2" style={{
                color: textColor
              }}>SEO-Optimized</h4>
                  <p className="text-sm" style={{
                color: textMutedColor
              }}>Keyword-rich content designed to rank</p>
                </div>
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-4" style={{
                color: primaryColor
              }} />
                  <h4 className="font-semibold mb-2" style={{
                color: textColor
              }}>Industry-Relevant</h4>
                  <p className="text-sm" style={{
                color: textMutedColor
              }}>Topics tailored to your audience</p>
                </div>
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4" style={{
                color: primaryColor
              }} />
                  <h4 className="font-semibold mb-2" style={{
                color: textColor
              }}>Professionally Written</h4>
                  <p className="text-sm" style={{
                color: textMutedColor
              }}>High-quality content in your brand voice</p>
                </div>
              </div>
            </div>
          </AnimatedSection>}
      </div>
    </section>;
};

// Website Timeline Section - Premium Futuristic Design with Unified Neon Styling
export const WebsiteTimelineSection = ({
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: Omit<WebsiteSectionProps, 'websitePackage' | 'clientName'>) => {
  const milestones = [{
    week: 'Week 1',
    title: 'Discovery & Strategy',
    description: "Kickoff call to align on goals, brand review, competitor analysis, content audit, and sitemap planning. You'll receive a detailed project brief for approval.",
    icon: '🚀',
    deliverables: ['Project Brief', 'Sitemap Draft', 'Content Checklist']
  }, {
    week: 'Week 2',
    title: 'Design Concepts',
    description: "Homepage wireframes and high-fidelity mockups presented. We'll refine typography, color palette, and visual direction based on your brand guidelines.",
    icon: '🎨',
    deliverables: ['Homepage Mockup', 'Style Guide', 'Mobile Preview']
  }, {
    week: 'Week 3',
    title: 'Design Refinement',
    description: 'Interior page designs completed with up to 2 revision rounds. All pages approved before moving to development phase.',
    icon: '✨',
    deliverables: ['All Page Designs', 'Revision Round 1', 'Final Approval']
  }, {
    week: 'Week 4',
    title: 'Development Build',
    description: 'Full website development with responsive design, CMS integration, contact forms, and third-party tool connections (analytics, CRM, etc.).',
    icon: '⚡',
    deliverables: ['Staging Site', 'CMS Setup', 'Form Integration']
  }, {
    week: 'Week 5',
    title: 'Testing & Optimization',
    description: 'Comprehensive QA across all devices and browsers. Performance optimization for speed scores, SEO meta setup, and accessibility checks.',
    icon: '🔍',
    deliverables: ['QA Report', 'Speed Optimization', 'SEO Setup']
  }, {
    week: 'Week 6',
    title: 'Launch & Training',
    description: 'Domain connection, SSL setup, and go-live! Includes a 1-hour training session on managing your new site plus 30 days of post-launch support.',
    icon: '🎉',
    deliverables: ['Live Website', 'Training Session', '30-Day Support']
  }];

  // Detect if background is dark for neon effects
  const isDarkBg = cardBackground.includes('rgba') && cardBackground.includes('0.') && parseFloat(cardBackground.match(/[\d.]+/g)?.[3] || '1') < 0.8;
  return <section id="timeline" className="py-24 relative overflow-hidden" style={{
    backgroundColor: 'transparent'
  }}>
      {/* Animated background elements with unified neon glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-10 w-80 h-80 rounded-full blur-3xl animate-pulse" style={{
        background: `radial-gradient(circle, ${primaryColor}, transparent)`,
        opacity: isDarkBg ? 0.2 : 0.1
      }} />
        <div className="absolute bottom-1/4 left-10 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{
        background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
        animationDelay: '1s',
        opacity: isDarkBg ? 0.15 : 0.08
      }} />
      </div>
      
      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        <AnimatedSection>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="px-4 py-2 rounded-full text-sm font-bold" style={{
              background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}20)`,
              color: primaryColor,
              border: `1px solid ${primaryColor}30`
            }}>
                4-6 WEEKS
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{
            color: textColor,
            textShadow: isDarkBg ? `0 0 30px ${primaryColor}20` : 'none'
          }}>
              Your Website Development Roadmap
            </h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{
            color: textMutedColor
          }}>
              A streamlined 6-week journey from concept to launch. Each phase includes client review 
              checkpoints, ensuring your vision comes to life exactly as you imagined.
            </p>
          </div>
        </AnimatedSection>

        <div className="relative">
          {/* Animated timeline line with gradient and neon glow */}
          <div className="absolute left-7 top-0 bottom-0 w-1 hidden md:block rounded-full" style={{
          background: `linear-gradient(180deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})`,
          opacity: isDarkBg ? 0.5 : 0.3,
          boxShadow: isDarkBg ? `0 0 15px ${primaryColor}40` : 'none'
        }} />
          {/* Glowing active portion of timeline */}
          <div className="absolute left-7 top-0 w-1 hidden md:block rounded-full animate-pulse" style={{
          background: `linear-gradient(180deg, ${primaryColor}, ${secondaryColor})`,
          height: '50%',
          boxShadow: isDarkBg ? `0 0 30px ${primaryColor}80, 0 0 50px ${primaryColor}40` : `0 0 20px ${primaryColor}60`
        }} />

          <div className="space-y-8">
            {milestones.map((milestone, i) => <AnimatedSection key={i} delay={i * 100}>
                <div className="relative flex gap-8 items-start group">
                  {/* Timeline dot with enhanced neon glow */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 z-10 text-2xl font-bold transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                boxShadow: isDarkBg ? `0 10px 30px -5px ${primaryColor}60, 0 0 40px ${primaryColor}30` : `0 10px 30px -5px ${primaryColor}40`
              }}>
                    {milestone.icon}
                  </div>

                  <div className="flex-1 p-8 rounded-3xl relative overflow-hidden transform transition-all duration-300 group-hover:scale-[1.01] group-hover:-translate-y-1" style={{
                background: isDarkBg ? `linear-gradient(145deg, rgba(20, 20, 50, 0.75), rgba(10, 10, 30, 0.55))` : `linear-gradient(145deg, color-mix(in srgb, ${cardBackground} 95%, ${primaryColor} 5%), ${cardBackground})`,
                border: isDarkBg ? `1px solid color-mix(in srgb, ${primaryColor} 30%, rgba(255,255,255,0.08))` : `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
                boxShadow: isDarkBg ? `0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px ${primaryColor}10, inset 0 1px 0 rgba(255,255,255,0.05)` : `0 20px 50px -15px ${primaryColor}15`,
                backdropFilter: isDarkBg ? 'blur(20px)' : 'none'
              }}>
                    {/* Top accent bar with neon glow */}
                    <div className="absolute top-0 left-0 right-0 h-1" style={{
                  background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: isDarkBg ? `0 0 15px ${primaryColor}60` : 'none'
                }} />
                    {/* Hover glow effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                  background: `radial-gradient(circle at 0% 50%, ${primaryColor}15, transparent 50%)`
                }} />
                    
                    <div className="relative flex flex-wrap items-center gap-4 mb-3">
                      <span className="px-4 py-1.5 rounded-xl text-sm font-bold" style={{
                    background: isDarkBg ? `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 25%, transparent), color-mix(in srgb, ${primaryColor} 20%, transparent))` : `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 20%, transparent), color-mix(in srgb, ${primaryColor} 15%, transparent))`,
                    color: secondaryColor,
                    border: `1px solid color-mix(in srgb, ${secondaryColor} 35%, transparent)`,
                    boxShadow: isDarkBg ? `0 0 15px ${secondaryColor}20` : 'none'
                  }}>
                        {milestone.week}
                      </span>
                      <h3 className="font-display font-bold text-xl" style={{
                    color: textColor,
                    textShadow: isDarkBg ? `0 0 15px ${textColor}10` : 'none'
                  }}>
                        {milestone.title}
                      </h3>
                      {/* Step number badge with neon */}
                      <div className="ml-auto w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    boxShadow: isDarkBg ? `0 4px 15px ${primaryColor}50` : 'none'
                  }}>
                        {i + 1}
                      </div>
                    </div>
                    <p className="text-base leading-relaxed relative mb-4" style={{
                  color: textMutedColor
                }}>{milestone.description}</p>
                    
                    {/* Deliverables */}
                    {milestone.deliverables && <div className="flex flex-wrap gap-2">
                        {milestone.deliverables.map((item, idx) => <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium" style={{
                    background: isDarkBg ? `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}10)` : `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}08)`,
                    color: primaryColor,
                    border: `1px solid ${primaryColor}20`
                  }}>
                            ✓ {item}
                          </span>)}
                      </div>}
                  </div>
                </div>
              </AnimatedSection>)}
          </div>
        </div>
        
        {/* Clean ending without redundant "6 weeks" messaging */}
      </div>
    </section>;
};
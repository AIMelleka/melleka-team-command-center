import { Mail, Clock, Users, Zap, TrendingUp, CheckCircle2, ArrowRight, Bell, Calendar, Target, Sparkles, MousePointer, Eye, ShoppingCart } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedCounter } from './AnimatedCounter';
import { CalloutBadge } from './ProposalAnnotations';
import { PlatformBadge } from './PlatformLogos';
interface EmailCampaign {
  type: 'welcome' | 'nurture' | 'promo' | 'cart';
  subject: string;
  preheader: string;
  headline?: string;
  bodyPreview?: string;
  ctaText?: string;
}

interface EmailCampaignsSectionProps {
  clientName: string;
  clientIndustry?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
  content?: {
    strategy?: string;
    campaigns?: EmailCampaign[] | string; // Can be array (new) or string (legacy)
    flows?: Array<{
      name: string;
      emails: number;
      purpose: string;
    }>;
    expectedResults?: {
      openRate?: string;
      ctr?: string;
      clickRate?: string; // Legacy field name
      revenue?: string;
    };
  };
}

// Ultra Premium Email Inbox Preview
const EmailInboxPreview = ({
  emails,
  clientName,
  primaryColor,
  secondaryColor
}: {
  emails: Array<{
    type: 'welcome' | 'nurture' | 'promo' | 'cart';
    subject: string;
    preheader: string;
    fromName: string;
    metric: {
      value: string;
      label: string;
    };
  }>;
  clientName: string;
  primaryColor: string;
  secondaryColor: string;
}) => {
  const typeConfig = {
    welcome: {
      color: '#22c55e',
      label: 'Welcome',
      bg: '#22c55e15'
    },
    nurture: {
      color: '#6366f1',
      label: 'Nurture',
      bg: '#6366f115'
    },
    promo: {
      color: '#f59e0b',
      label: 'Promo',
      bg: '#f59e0b15'
    },
    cart: {
      color: '#ef4444',
      label: 'Recovery',
      bg: '#ef444415'
    }
  };
  return <div className="rounded-2xl overflow-hidden shadow-2xl" style={{
    background: '#ffffff',
    boxShadow: '0 25px 80px -12px rgba(0,0,0,0.25)'
  }}>
      {/* macOS Window Chrome */}
      <div className="px-4 py-3 flex items-center gap-3" style={{
      background: 'linear-gradient(180deg, #f7f7f7 0%, #ebebeb 100%)',
      borderBottom: '1px solid #d1d1d1'
    }}>
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-inner" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e] shadow-inner" />
          <div className="w-3 h-3 rounded-full bg-[#28c840] shadow-inner" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-white border border-gray-200 shadow-sm">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-600 font-medium">Inbox</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-bold">{emails.length}</span>
          </div>
        </div>
        <div className="w-16" />
      </div>

      {/* Sidebar + Email List Layout */}
      <div className="flex">
        {/* Minimal Sidebar */}
        <div className="w-14 py-4 flex flex-col items-center gap-4 border-r" style={{
        background: '#fafafa',
        borderColor: '#e5e5e5'
      }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
        }}>
            <span className="text-white font-bold text-sm">{clientName.charAt(0)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
            <Mail className="w-4 h-4" />
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <Clock className="w-4 h-4" />
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1">
          {emails.map((email, i) => {
          const config = typeConfig[email.type];
          return <div key={i} className="px-5 py-4 flex items-start gap-4 transition-all duration-200 hover:bg-blue-50/50 cursor-pointer group" style={{
            borderBottom: i < emails.length - 1 ? '1px solid #f0f0f0' : 'none',
            background: i === 0 ? '#eff6ff' : 'transparent'
          }}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
            }}>
                  {clientName.charAt(0)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{email.fromName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                  background: config.bg,
                  color: config.color
                }}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">Just now</span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm truncate mb-0.5">{email.subject}</p>
                  <p className="text-xs text-gray-500 truncate">{email.preheader}</p>
                </div>

                {/* Metric Badge */}
                <div className="flex-shrink-0 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs font-bold px-2 py-1 rounded-md" style={{
                background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)`,
                color: primaryColor
              }}>
                    {email.metric.value} {email.metric.label}
                  </div>
                </div>
              </div>;
        })}
        </div>
      </div>
    </div>;
};

// Single Email Detail Preview - Premium Design
const EmailDetailPreview = ({
  subject,
  headline,
  bodyPreview,
  ctaText,
  fromName,
  clientName,
  primaryColor,
  secondaryColor,
  type,
  metric
}: {
  subject: string;
  headline: string;
  bodyPreview: string;
  ctaText: string;
  fromName: string;
  clientName: string;
  primaryColor: string;
  secondaryColor: string;
  type: 'welcome' | 'nurture' | 'promo' | 'cart';
  metric: {
    value: string;
    label: string;
  };
}) => {
  const typeConfig = {
    welcome: {
      color: '#22c55e',
      label: 'Welcome Series'
    },
    nurture: {
      color: '#6366f1',
      label: 'Lead Nurture'
    },
    promo: {
      color: '#f59e0b',
      label: 'Promotional'
    },
    cart: {
      color: '#ef4444',
      label: 'Cart Recovery'
    }
  };
  const config = typeConfig[type];
  return <div className="rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 group" style={{
    background: '#ffffff',
    boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)'
  }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
        }}>
            {clientName.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{fromName}</span>
              <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide" style={{
              background: `${config.color}15`,
              color: config.color
            }}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{subject}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <h4 className="font-bold text-gray-900 text-base mb-2">{headline}</h4>
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-4">{bodyPreview}</p>
        
        <button className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-all" style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
      }}>
          {ctaText} →
        </button>
      </div>

      {/* Metric Footer */}
      <div className="px-5 py-3 flex items-center justify-between" style={{
      background: '#f9fafb',
      borderTop: '1px solid #f0f0f0'
    }}>
        <span className="text-[10px] text-gray-400 font-medium">Expected Performance</span>
        <span className="text-xs font-bold" style={{
        color: primaryColor
      }}>
          {metric.value} {metric.label}
        </span>
      </div>
    </div>;
};
export const EmailCampaignsSection = ({
  clientName,
  clientIndustry = 'B2B SaaS',
  primaryColor,
  secondaryColor,
  accentColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor,
  content
}: EmailCampaignsSectionProps) => {
  // Check if we have AI-generated campaigns (array, not string)
  const aiCampaigns = content?.campaigns && Array.isArray(content.campaigns) ? content.campaigns : null;
  
  // Default fallback email examples - only used if AI didn't generate any
  const defaultEmailExamples = [{
    type: 'welcome' as const,
    subject: `Welcome to ${clientName} - Let's Get Started! 🚀`,
    preheader: "Your account is ready. Here's what to do first...",
    headline: `Welcome to ${clientName}!`,
    bodyPreview: `We're thrilled to have you on board! In the next few minutes, you'll discover how ${clientName} can transform the way you work.`,
    ctaText: 'Complete Your Setup',
    fromName: `${clientName} Team`,
    metric: { value: '72%', label: 'Open Rate' }
  }, {
    type: 'nurture' as const,
    subject: `5 Tips to Get the Most from ${clientName}`,
    preheader: 'See how industry leaders are getting results...',
    headline: 'Unlock Your Full Potential',
    bodyPreview: `Hey there! Here are 5 proven strategies our most successful customers use to get better results.`,
    ctaText: 'Read the Full Guide',
    fromName: `${clientName} Success`,
    metric: { value: '45%', label: 'CTR' }
  }, {
    type: 'promo' as const,
    subject: `⚡ Limited Time Offer from ${clientName}`,
    preheader: 'Ends soon - lock in your savings...',
    headline: 'Your Exclusive Discount',
    bodyPreview: `For a limited time, take advantage of this special offer. Save on your next purchase with us.`,
    ctaText: 'Claim My Discount',
    fromName: clientName,
    metric: { value: '8.2%', label: 'Conversion' }
  }, {
    type: 'cart' as const,
    subject: 'You left something behind...',
    preheader: 'Complete your inquiry - we\'re here to help',
    headline: 'Still Thinking It Over?',
    bodyPreview: `We noticed you were interested. No pressure, but we're here to answer any questions you might have!`,
    ctaText: 'Continue Where You Left Off',
    fromName: clientName,
    metric: { value: '12%', label: 'Recovery' }
  }];

  // Map AI campaigns to the format needed by the component, or use defaults
  const emailExamples = aiCampaigns 
    ? aiCampaigns.map((campaign, index) => ({
        type: campaign.type,
        subject: campaign.subject,
        preheader: campaign.preheader,
        headline: campaign.headline || defaultEmailExamples[index]?.headline || 'Your Email',
        bodyPreview: campaign.bodyPreview || defaultEmailExamples[index]?.bodyPreview || '',
        ctaText: campaign.ctaText || defaultEmailExamples[index]?.ctaText || 'Learn More',
        fromName: campaign.type === 'welcome' ? `${clientName} Team` : 
                  campaign.type === 'nurture' ? `${clientName} Success` : clientName,
        metric: defaultEmailExamples.find(d => d.type === campaign.type)?.metric || { value: '50%', label: 'Open Rate' }
      }))
    : defaultEmailExamples;

  // Automation flow data
  const emailFlows = content?.flows || [{
    name: 'Welcome Series',
    emails: 5,
    purpose: 'Onboard new signups and drive activation'
  }, {
    name: 'Lead Nurture',
    emails: 8,
    purpose: 'Educate prospects through the buying journey'
  }, {
    name: 'Re-engagement',
    emails: 4,
    purpose: 'Win back inactive subscribers'
  }, {
    name: 'Upsell Sequence',
    emails: 3,
    purpose: 'Convert free users to paid plans'
  }];
  return <section id="email" className="py-24 relative overflow-hidden" style={{
    background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${secondaryColor} 5%, ${backgroundColor}))`
  }}>
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full blur-3xl opacity-10 animate-pulse" style={{
        background: `radial-gradient(circle, ${primaryColor}, transparent)`
      }} />
        <div className="absolute bottom-40 right-20 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" style={{
        background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
        animationDelay: '1s'
      }} />
      </div>
      
      <div className="container max-w-7xl mx-auto px-4 relative z-10">
        {/* Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{
            color: secondaryColor
          }}>
              Automated Nurturing
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{
              color: textColor
            }}>
                Email Marketing Campaigns
              </h2>
              <CalloutBadge text="Revenue Driver" variant="highlight" />
            </div>
            <p className="text-lg max-w-3xl mx-auto leading-relaxed mb-8" style={{
            color: textMutedColor
          }}>
              {content?.strategy || `Strategic email sequences that nurture leads, onboard customers, and drive revenue for ${clientName}. Every email is designed, written, and optimized to convert.`}
            </p>
            
            {/* Platform Logos */}
            
          </div>
        </AnimatedSection>

        {/* Stats Bar */}
        <AnimatedSection delay={100}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
            {[{
            icon: Eye,
            value: content?.expectedResults?.openRate || '42%',
            label: 'Open Rate',
            sublabel: 'Industry: 21%'
          }, {
            icon: MousePointer,
            value: content?.expectedResults?.ctr || '8.5%',
            label: 'Click Rate',
            sublabel: 'Industry: 2.6%'
          }, {
            icon: TrendingUp,
            value: content?.expectedResults?.revenue || '$42',
            label: 'Revenue/Email',
            sublabel: 'Per subscriber'
          }, {
            icon: Users,
            value: '24/7',
            label: 'Automation',
            sublabel: 'Always working'
          }].map((stat, i) => <div key={i} className="p-6 rounded-2xl text-center relative overflow-hidden group transition-all duration-300 hover:scale-105" style={{
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 10px 30px -10px ${primaryColor}15`
          }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
              background: `radial-gradient(circle at 50% 100%, ${primaryColor}10, transparent 70%)`
            }} />
                <stat.icon className="w-6 h-6 mx-auto mb-2" style={{
              color: primaryColor
            }} />
                <p className="text-3xl md:text-4xl font-bold mb-1" style={{
              color: primaryColor
            }}>
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="font-medium" style={{
              color: textColor
            }}>{stat.label}</p>
                <p className="text-xs mt-1" style={{
              color: textMutedColor
            }}>{stat.sublabel}</p>
              </div>)}
          </div>
        </AnimatedSection>

        {/* Email Preview Gallery */}
        {/* Premium Inbox Preview */}
        <AnimatedSection delay={200}>
          <div className="mb-20">
            <div className="flex items-center gap-3 mb-8">
              <h3 className="text-2xl font-display font-bold" style={{
              color: textColor
            }}>
                Your Email Campaign Preview
              </h3>
              <CalloutBadge text="Designed & Written" variant="new" />
            </div>
            
            <EmailInboxPreview emails={emailExamples} clientName={clientName} primaryColor={primaryColor} secondaryColor={secondaryColor} />
          </div>
        </AnimatedSection>

        {/* Individual Email Cards - section placeholder */}

        {/* Automated Flows */}
        <AnimatedSection delay={300}>
          <div className="p-10 rounded-3xl relative overflow-hidden" style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 90%, ${primaryColor} 10%), ${cardBackground})`,
          border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
          boxShadow: `0 30px 60px -15px ${primaryColor}15`
        }}>
            <div className="absolute top-0 right-1/4 w-48 h-48 rounded-full blur-3xl opacity-10" style={{
            background: secondaryColor
          }} />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
              }}>
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold" style={{
                  color: textColor
                }}>
                    Automated Email Flows
                  </h3>
                  
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {emailFlows.map((flow, i) => <div key={i} className="p-6 rounded-2xl transition-all duration-300 hover:scale-105 relative overflow-hidden group" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`
              }}>
                    {/* Flow number */}
                    <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                }}>
                      {i + 1}
                    </div>
                    
                    {/* Hover glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                  background: `radial-gradient(circle at 50% 100%, ${primaryColor}15, transparent 70%)`
                }} />
                    
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center" style={{
                    background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                  }}>
                        <Mail className="w-6 h-6" style={{
                      color: primaryColor
                    }} />
                      </div>
                      <h4 className="font-bold text-lg mb-2" style={{
                    color: textColor
                  }}>{flow.name}</h4>
                      
                      <p className="text-sm leading-relaxed" style={{
                    color: textMutedColor
                  }}>{flow.purpose}</p>
                    </div>
                  </div>)}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* What's Included */}
        <AnimatedSection delay={400}>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[{
            icon: Sparkles,
            title: 'Custom Design',
            desc: 'Branded email templates matching your visual identity'
          }, {
            icon: Target,
            title: 'Segmentation',
            desc: 'Targeted messaging based on behavior and preferences'
          }, {
            icon: TrendingUp,
            title: 'A/B Testing',
            desc: 'Continuous optimization of subject lines and content'
          }].map((item, i) => <div key={i} className="p-6 rounded-2xl flex items-start gap-4" style={{
            background: `color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor})`,
            border: `1px solid ${borderColor}`
          }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
            }}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium mb-1" style={{
                color: textColor
              }}>{item.title}</p>
                  <p className="text-sm" style={{
                color: textMutedColor
              }}>{item.desc}</p>
                </div>
              </div>)}
          </div>
        </AnimatedSection>
      </div>
    </section>;
};
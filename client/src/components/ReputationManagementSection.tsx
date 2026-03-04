import { Star, MessageSquare, TrendingUp, Shield, Eye, ThumbsUp, AlertTriangle, CheckCircle2, Clock, BarChart3, Globe, Award, Zap } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedCounter } from './AnimatedCounter';
import { CalloutBadge } from './ProposalAnnotations';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { isLightColor } from './PlatformLogos';

interface ReputationPlatform {
  name: string;
  icon?: string;
  rating: number;
  reviews: number;
  color?: string;
  description: string;
}

interface ReputationService {
  icon?: any;
  title: string;
  description: string;
  stats: string;
  color?: string;
}

interface ReputationContent {
  headline?: string;
  description?: string;
  platforms?: ReputationPlatform[];
  services?: ReputationService[];
  sentimentData?: { name: string; value: number; color: string }[];
  monitoringThemes?: string[];
}

interface ReputationManagementSectionProps {
  clientName: string;
  clientIndustry?: string;
  content?: ReputationContent;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

// Industry-specific platform defaults
const getIndustryPlatforms = (industry: string, clientName: string): ReputationPlatform[] => {
  const industryMap: Record<string, ReputationPlatform[]> = {
    'Healthcare': [
      { name: 'Google Reviews', icon: '⭐', rating: 4.6, reviews: 89, color: '#4285F4', description: 'Primary patient reviews' },
      { name: 'Healthgrades', icon: '🏥', rating: 4.5, reviews: 45, color: '#00A651', description: 'Healthcare provider ratings' },
      { name: 'Zocdoc', icon: '📅', rating: 4.7, reviews: 67, color: '#FF7A59', description: 'Appointment booking reviews' },
      { name: 'Vitals', icon: '💊', rating: 4.4, reviews: 32, color: '#6B46C1', description: 'Doctor reviews & ratings' }
    ],
    'Medical': [
      { name: 'Google Reviews', icon: '⭐', rating: 4.6, reviews: 89, color: '#4285F4', description: 'Primary patient reviews' },
      { name: 'Healthgrades', icon: '🏥', rating: 4.5, reviews: 45, color: '#00A651', description: 'Healthcare provider ratings' },
      { name: 'RealSelf', icon: '✨', rating: 4.8, reviews: 120, color: '#E91E8C', description: 'Cosmetic procedure reviews' },
      { name: 'Yelp', icon: '🏆', rating: 4.4, reviews: 56, color: '#FF1A1A', description: 'Local business reviews' }
    ],
    'Restaurant': [
      { name: 'Google Reviews', icon: '⭐', rating: 4.5, reviews: 234, color: '#4285F4', description: 'Primary diner reviews' },
      { name: 'Yelp', icon: '🏆', rating: 4.3, reviews: 189, color: '#FF1A1A', description: 'Restaurant discovery platform' },
      { name: 'OpenTable', icon: '🍽️', rating: 4.6, reviews: 78, color: '#DA3743', description: 'Reservation reviews' },
      { name: 'TripAdvisor', icon: '✈️', rating: 4.4, reviews: 145, color: '#00AF87', description: 'Tourist & traveler reviews' }
    ],
    'Home Services': [
      { name: 'Google Reviews', icon: '⭐', rating: 4.7, reviews: 156, color: '#4285F4', description: 'Primary customer reviews' },
      { name: 'Yelp', icon: '🏆', rating: 4.5, reviews: 89, color: '#FF1A1A', description: 'Local service reviews' },
      { name: 'Angi', icon: '🔧', rating: 4.6, reviews: 67, color: '#FF6138', description: 'Home service platform' },
      { name: 'HomeAdvisor', icon: '🏠', rating: 4.4, reviews: 45, color: '#FF9900', description: 'Contractor reviews' }
    ],
    'Legal': [
      { name: 'Google Reviews', icon: '⭐', rating: 4.8, reviews: 67, color: '#4285F4', description: 'Client testimonials' },
      { name: 'Avvo', icon: '⚖️', rating: 4.9, reviews: 45, color: '#0077C8', description: 'Attorney ratings' },
      { name: 'Martindale-Hubbell', icon: '📜', rating: 4.7, reviews: 23, color: '#003366', description: 'Peer reviews' },
      { name: 'Lawyers.com', icon: '👨‍⚖️', rating: 4.5, reviews: 34, color: '#2E5090', description: 'Legal directory' }
    ],
    'B2B SaaS': [
      { name: 'G2', icon: '⭐', rating: 4.5, reviews: 127, color: '#FF492C', description: 'Enterprise software reviews' },
      { name: 'Capterra', icon: '🏆', rating: 4.6, reviews: 89, color: '#FF8C00', description: 'Business software directory' },
      { name: 'TrustRadius', icon: '✓', rating: 4.4, reviews: 56, color: '#00C853', description: 'B2B tech buyer insights' },
      { name: 'Gartner Peer Insights', icon: '📊', rating: 4.3, reviews: 34, color: '#6B46C1', description: 'Enterprise IT reviews' }
    ]
  };

  return industryMap[industry] || [
    { name: 'Google Reviews', icon: '⭐', rating: 4.6, reviews: 89, color: '#4285F4', description: `Primary ${clientName} reviews` },
    { name: 'Yelp', icon: '🏆', rating: 4.5, reviews: 67, color: '#FF1A1A', description: 'Local business reviews' },
    { name: 'Facebook', icon: '👍', rating: 4.4, reviews: 45, color: '#1877F2', description: 'Social recommendations' },
    { name: 'BBB', icon: '✓', rating: 4.7, reviews: 23, color: '#003087', description: 'Accredited business ratings' }
  ];
};

const getIndustryThemes = (industry: string, clientName: string): string[] => {
  const themeMap: Record<string, string[]> = {
    'Healthcare': ['Patient care quality', 'Wait times & scheduling', 'Staff friendliness', 'Treatment outcomes', 'Billing transparency', 'Facility cleanliness'],
    'Medical': ['Procedure results', 'Recovery experience', 'Consultation quality', 'Before/after satisfaction', 'Staff professionalism', 'Follow-up care'],
    'Restaurant': ['Food quality & taste', 'Service speed', 'Ambiance & cleanliness', 'Value for money', 'Menu variety', 'Staff friendliness'],
    'Home Services': ['Work quality', 'Punctuality & reliability', 'Pricing fairness', 'Communication', 'Cleanup after work', 'Warranty & follow-up'],
    'Legal': ['Case outcomes', 'Communication clarity', 'Response time', 'Fee transparency', 'Professionalism', 'Settlement success'],
    'B2B SaaS': ['Ease of implementation', 'Customer support quality', 'ROI & value delivered', 'Product reliability', 'Integration capabilities', 'Data security']
  };

  return themeMap[industry] || [
    `${clientName} service quality`,
    'Customer communication',
    'Pricing & value',
    'Response time',
    'Professionalism',
    'Overall experience'
  ];
};

export const ReputationManagementSection = ({
  clientName,
  clientIndustry = 'General',
  content,
  primaryColor,
  secondaryColor,
  accentColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: ReputationManagementSectionProps) => {

  // Use AI-generated content or industry-adaptive fallbacks
  const platforms = content?.platforms && content.platforms.length > 0 
    ? content.platforms 
    : getIndustryPlatforms(clientIndustry, clientName);

  const iconMap: Record<string, any> = { Eye, MessageSquare, TrendingUp, Shield };
  
  const services: ReputationService[] = content?.services && content.services.length > 0 
    ? content.services.map(s => ({ ...s, icon: iconMap[s.icon as string] || Eye, color: s.color || primaryColor }))
    : [
      {
        icon: Eye,
        title: '24/7 Review Monitoring',
        description: `Real-time alerts when ${clientName} is mentioned across ${platforms.map(p => p.name).slice(0, 3).join(', ')}, and 50+ platforms. Never miss a review again.`,
        stats: '50+ platforms',
        color: primaryColor
      },
      {
        icon: MessageSquare,
        title: 'Professional Response Management',
        description: `Expert responses within 24 hours that turn critics into advocates. We craft thoughtful, on-brand replies that demonstrate ${clientName}'s commitment to customer success.`,
        stats: '<24hr response',
        color: secondaryColor
      },
      {
        icon: TrendingUp,
        title: 'Review Generation Campaigns',
        description: `Automated post-success workflows that prompt happy ${clientName} customers to share their experience at the perfect moment.`,
        stats: '+40% review volume',
        color: accentColor
      },
      {
        icon: Shield,
        title: 'Crisis Management Protocol',
        description: `Rapid response playbook for negative PR. Escalation procedures, response templates, and executive communication plans ready for ${clientName}.`,
        stats: '2hr crisis response',
        color: primaryColor
      }
    ];

  const sentimentData = content?.sentimentData || [
    { name: 'Positive', value: 78, color: '#22C55E' },
    { name: 'Neutral', value: 15, color: '#F59E0B' },
    { name: 'Negative', value: 7, color: '#EF4444' }
  ];

  const monitoringThemes = content?.monitoringThemes && content.monitoringThemes.length > 0 
    ? content.monitoringThemes 
    : getIndustryThemes(clientIndustry, clientName);

  const sectionDescription = content?.description || 
    `Your reputation is everything. We'll monitor, manage, and grow ${clientName}'s online presence across ${platforms[0]?.name}, ${platforms[1]?.name}, and every platform where your customers leave reviews.`;

  return (
    <section id="reputation" className="py-24 relative overflow-hidden" style={{ backgroundColor }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl opacity-10 animate-pulse" style={{
          background: `radial-gradient(circle, ${primaryColor}, transparent)`
        }} />
        <div className="absolute bottom-20 right-20 w-64 h-64 rounded-full blur-3xl opacity-10 animate-pulse" style={{
          background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
          animationDelay: '1.5s'
        }} />
        <Star className="absolute top-1/4 right-16 w-12 h-12 opacity-5" style={{ color: primaryColor }} />
        <Star className="absolute bottom-1/4 left-16 w-10 h-10 opacity-5" style={{ color: secondaryColor }} />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Brand Protection & Growth
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                {content?.headline || 'Reputation Management'}
              </h2>
              <CalloutBadge text="5-Star Strategy" variant="important" />
            </div>
            <p className="text-lg max-w-3xl mx-auto leading-relaxed" style={{ color: textMutedColor }}>
              {sectionDescription}
            </p>
          </div>
        </AnimatedSection>

        {/* Platform Cards */}
        <AnimatedSection delay={100}>
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <h3 className="text-2xl font-display font-bold" style={{ color: textColor }}>
                Platforms We Monitor for {clientName}
              </h3>
              <CalloutBadge text="Industry Focus" variant="highlight" />
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {platforms.map((platform, i) => (
                <div key={i} className="p-6 rounded-2xl relative overflow-hidden group transition-all duration-300 hover:scale-105 hover:-translate-y-1" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 15px 40px -15px ${platform.color || primaryColor}20`
                }}>
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: platform.color || primaryColor }} />
                  
                  <div className="text-3xl mb-3">{platform.icon || '⭐'}</div>
                  <h4 className="text-lg font-bold mb-1" style={{ color: textColor }}>{platform.name}</h4>
                  <p className="text-xs mb-4" style={{ color: textMutedColor }}>{platform.description}</p>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`w-4 h-4 ${star <= Math.floor(platform.rating) ? 'fill-current' : ''}`} style={{ 
                          color: star <= Math.floor(platform.rating) ? (platform.color || primaryColor) : borderColor 
                        }} />
                      ))}
                    </div>
                    <span className="text-sm font-bold" style={{ color: textColor }}>{platform.rating}</span>
                  </div>
                  <p className="text-xs" style={{ color: textMutedColor }}>{platform.reviews} reviews to manage</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Services Grid */}
        <AnimatedSection delay={200}>
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {services.map((service, i) => (
              <div key={i} className="p-8 rounded-3xl relative overflow-hidden group transition-all duration-500 hover:scale-[1.02]" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 20px 50px -15px ${service.color}15`
              }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                  background: `radial-gradient(circle at 50% 0%, ${service.color}08, transparent 60%)`
                }} />
                
                <div className="relative flex items-start gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110" style={{
                    background: `linear-gradient(135deg, ${service.color}, color-mix(in srgb, ${service.color} 70%, ${secondaryColor}))`,
                    boxShadow: `0 10px 30px -5px ${service.color}40`
                  }}>
                    {service.icon && <service.icon className="w-7 h-7" style={{ color: isLightColor(service.color || primaryColor) ? '#1a1a2e' : 'white' }} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h4 className="text-xl font-bold" style={{ color: textColor }}>{service.title}</h4>
                      <span className="px-3 py-1 rounded-full text-xs font-medium" style={{
                        background: `${service.color}15`,
                        color: service.color
                      }}>
                        {service.stats}
                      </span>
                    </div>
                    <p className="leading-relaxed" style={{ color: textMutedColor }}>{service.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Dashboard Preview */}
        <AnimatedSection delay={300}>
          <div className="p-10 rounded-3xl relative overflow-hidden" style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 90%, ${primaryColor} 10%), ${cardBackground})`,
            border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
            boxShadow: `0 30px 60px -15px ${primaryColor}15`
          }}>
            <div className="absolute top-0 right-1/4 w-48 h-48 rounded-full blur-3xl opacity-10" style={{
              background: primaryColor
            }} />
            
            <div className="relative">
              <div className="flex flex-col md:flex-row items-start gap-8">
                {/* Left: Sentiment Chart */}
                <div className="md:w-1/3">
                  <h4 className="font-bold mb-4" style={{ color: textColor }}>Sentiment Overview</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {sentimentData.map((item, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                        <span className="text-xs" style={{ color: textMutedColor }}>{item.name} {item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Right: Monitoring Themes */}
                <div className="md:w-2/3">
                  <h4 className="font-bold mb-4" style={{ color: textColor }}>Key Themes We Track for {clientName}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {monitoringThemes.map((theme, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-105" style={{
                        background: `color-mix(in srgb, ${primaryColor} 5%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${borderColor} 50%, transparent)`
                      }}>
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />
                        <span className="text-sm" style={{ color: textColor }}>{theme}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-6" style={{ borderTop: `1px solid ${borderColor}` }}>
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                        <AnimatedCounter value={String(platforms.reduce((sum, p) => sum + p.reviews, 0))} />
                      </p>
                      <p className="text-xs" style={{ color: textMutedColor }}>Total Reviews</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: secondaryColor }}>
                        {(platforms.reduce((sum, p) => sum + p.rating, 0) / platforms.length).toFixed(1)}
                      </p>
                      <p className="text-xs" style={{ color: textMutedColor }}>Avg Rating</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: accentColor }}>+23%</p>
                      <p className="text-xs" style={{ color: textMutedColor }}>YoY Growth</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Response Examples */}
        <AnimatedSection delay={400}>
          <div className="mt-12 grid md:grid-cols-2 gap-8">
            {/* Positive Review Response */}
            <div className="p-6 rounded-2xl" style={{
              background: cardBackground,
              border: `1px solid ${borderColor}`
            }}>
              <div className="flex items-center gap-2 mb-4">
                <ThumbsUp className="w-5 h-5" style={{ color: '#22C55E' }} />
                <span className="font-medium" style={{ color: textColor }}>Positive Review Response</span>
              </div>
              <div className="p-4 rounded-xl mb-4" style={{ background: `color-mix(in srgb, #22C55E 10%, ${backgroundColor})` }}>
                <p className="text-sm italic" style={{ color: textMutedColor }}>
                  "Amazing experience with {clientName}! The team was professional and exceeded my expectations..."
                </p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: textMutedColor }}>
                <strong style={{ color: textColor }}>Our response:</strong> Thank you so much for sharing your wonderful experience! 
                We're thrilled that our team could exceed your expectations. Your feedback means everything to us at {clientName}...
              </p>
            </div>
            
            {/* Critical Review Response */}
            <div className="p-6 rounded-2xl" style={{
              background: cardBackground,
              border: `1px solid ${borderColor}`
            }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
                <span className="font-medium" style={{ color: textColor }}>Critical Review Response</span>
              </div>
              <div className="p-4 rounded-xl mb-4" style={{ background: `color-mix(in srgb, #F59E0B 10%, ${backgroundColor})` }}>
                <p className="text-sm italic" style={{ color: textMutedColor }}>
                  "Had some issues with scheduling and communication could have been better..."
                </p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: textMutedColor }}>
                <strong style={{ color: textColor }}>Our response:</strong> Thank you for this honest feedback. 
                We take scheduling and communication seriously at {clientName}. Our team would love to connect directly to understand 
                what went wrong and ensure we make this right...
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

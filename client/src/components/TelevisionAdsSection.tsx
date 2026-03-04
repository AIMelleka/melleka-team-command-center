import { Monitor, Play, Users, TrendingUp, CheckCircle2, Tv, Radio, Eye, BarChart3, Target, Zap, Clock, DollarSign } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedCounter } from './AnimatedCounter';
import { CalloutBadge } from './ProposalAnnotations';
import { isLightColor } from './PlatformLogos';

interface TVAdsStat {
  value: string;
  label: string;
  icon?: any;
}

interface TVAdsContent {
  headline?: string;
  description?: string;
  services?: string[];
  stats?: TVAdsStat[];
}

interface TelevisionAdsSectionProps {
  clientName: string;
  clientIndustry?: string;
  content?: TVAdsContent;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

// Industry-specific TV services
const getIndustryServices = (industry: string, clientName: string): string[] => {
  const serviceMap: Record<string, string[]> = {
    'Healthcare': [
      'Healthcare-compliant commercial production',
      'Strategic placement on health & wellness networks',
      'Connected TV targeting health-conscious viewers',
      'Geo-fenced campaigns around your facilities',
      'HIPAA-compliant analytics & attribution',
      'Patient testimonial ad creative'
    ],
    'Medical': [
      'Transformation story commercials (15s/30s/60s)',
      'Premium cable & streaming placement',
      'CTV targeting beauty & lifestyle audiences',
      'Geo-fencing around affluent demographics',
      'Before/after creative production',
      'Compliance-approved messaging'
    ],
    'Restaurant': [
      'Mouth-watering food commercial production',
      'Local TV & streaming ad placement',
      'Connected TV geo-targeting local diners',
      'Prime-time & sports event placements',
      'Menu highlight reels & specials',
      'Grand opening & event campaigns'
    ],
    'Home Services': [
      'Professional service showcase commercials',
      'Local cable & streaming placement',
      'CTV targeting homeowners in your area',
      'Weather-triggered ad campaigns',
      'Emergency service rapid-response ads',
      'Seasonal campaign production'
    ],
    'Legal': [
      'Trust-building attorney commercials',
      'Strategic placement on news networks',
      'Connected TV targeting case-specific demographics',
      'Geo-fenced campaigns in your practice areas',
      'Compliance-approved legal advertising',
      'Case result storytelling'
    ]
  };

  return serviceMap[industry] || [
    `${clientName} brand commercial production (15s/30s/60s)`,
    'Strategic media planning & buying',
    'Connected TV (CTV) & streaming placement',
    'Audience targeting & geo-fencing',
    'Performance analytics & attribution',
    'A/B creative testing'
  ];
};

const getIndustryDescription = (industry: string, clientName: string): string => {
  const descriptionMap: Record<string, string> = {
    'Healthcare': `Reach patients and families where they consume premium health content, from morning news to streaming health documentaries.`,
    'Medical': `Connect with your ideal aesthetic patients through premium lifestyle content on streaming platforms and cable networks.`,
    'Restaurant': `Make hungry viewers crave ${clientName}'s cuisine with mouth-watering commercials during prime-time and sporting events.`,
    'Home Services': `Reach homeowners when they're watching local news and home improvement content—right when they're thinking about their homes.`,
    'Legal': `Build trust with potential clients through professional commercials on news networks and streaming platforms.`
  };

  return descriptionMap[industry] || `Reach ${clientName}'s target audience where they consume premium content, from business news to streaming platforms.`;
};

export const TelevisionAdsSection = ({
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
}: TelevisionAdsSectionProps) => {

  const iconMap: Record<string, any> = { Users, TrendingUp, Clock, Tv, Monitor, DollarSign };

  const services = content?.services && content.services.length > 0 
    ? content.services 
    : getIndustryServices(clientIndustry, clientName);

  const stats: TVAdsStat[] = content?.stats && content.stats.length > 0 
    ? content.stats.map(s => ({ ...s, icon: iconMap[s.icon as string] || Users }))
    : [
      { value: '500K+', label: 'Household Reach', icon: Users },
      { value: '2-4x', label: 'Brand Recall', icon: TrendingUp },
      { value: '15-60s', label: 'Spot Lengths', icon: Clock },
      { value: 'CTV+', label: 'Streaming Included', icon: Tv }
    ];

  const sectionDescription = content?.description || getIndustryDescription(clientIndustry, clientName);

  return (
    <section id="tv-ads" className="py-24 relative overflow-hidden" style={{ backgroundColor }}>
      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Premium Brand Awareness
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                {content?.headline || 'Television & CTV Advertising'}
              </h2>
              <CalloutBadge text="Mass Reach" variant="important" />
            </div>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
              {sectionDescription}
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
              <Monitor className="w-12 h-12 mb-4" style={{ color: primaryColor }} />
              <h3 className="text-xl font-bold mb-4" style={{ color: textColor }}>What's Included for {clientName}</h3>
              <ul className="space-y-3">
                {services.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span style={{ color: textColor }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-3xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }}>
              <h3 className="text-xl font-bold mb-6">Expected Performance</h3>
              <div className="grid grid-cols-2 gap-6">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                    {stat.icon && <stat.icon className="w-6 h-6 mx-auto mb-2" />}
                    <p className="text-2xl font-bold"><AnimatedCounter value={stat.value} /></p>
                    <p className="text-xs opacity-80">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

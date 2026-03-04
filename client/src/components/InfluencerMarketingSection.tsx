import { Users, Video, Camera, Star, TrendingUp, Heart, Play, Eye, ThumbsUp, MessageSquare, Share2, Instagram, Youtube, Mic, CheckCircle2, ArrowRight, Sparkles, Award, Target, Zap } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedCounter } from './AnimatedCounter';
import { CalloutBadge } from './ProposalAnnotations';
import { isLightColor } from './PlatformLogos';

interface InfluencerTier {
  tier: string;
  icon?: any;
  followers: string;
  examples: string[];
  benefits: string[];
  engagement: string;
  cpm: string;
  color?: string;
  recommended?: boolean;
}

interface CampaignType {
  icon?: any;
  title: string;
  description: string;
  metrics: string;
}

interface SampleInfluencer {
  name: string;
  handle: string;
  platform: string;
  followers: string;
  focus: string;
  engagement: string;
}

interface InfluencerContent {
  headline?: string;
  description?: string;
  tiers?: InfluencerTier[];
  campaignTypes?: CampaignType[];
  sampleInfluencers?: SampleInfluencer[];
}

interface InfluencerMarketingSectionProps {
  clientName: string;
  clientIndustry?: string;
  content?: InfluencerContent;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

// Industry-specific influencer defaults
const getIndustryInfluencers = (industry: string, clientName: string, primaryColor: string, secondaryColor: string, accentColor: string): InfluencerTier[] => {
  const industryMap: Record<string, InfluencerTier[]> = {
    'Healthcare': [
      {
        tier: 'Medical Professionals',
        icon: Award,
        followers: '10K-100K',
        examples: ['Physician Influencers', 'Nurse Educators', 'Health Coaches'],
        benefits: ['Credibility with patients', 'Educational content authority', 'Trust-building testimonials'],
        engagement: '5.2%',
        cpm: '$30-60',
        color: primaryColor,
        recommended: true
      },
      {
        tier: 'Wellness Influencers',
        icon: Target,
        followers: '25K-250K',
        examples: ['Fitness Coaches', 'Nutritionists', 'Mental Health Advocates'],
        benefits: ['Lifestyle integration', 'Health-conscious audience', 'Authentic recommendations'],
        engagement: '4.8%',
        cpm: '$20-40',
        color: secondaryColor,
        recommended: false
      },
      {
        tier: 'Local Health Advocates',
        icon: Users,
        followers: '5K-50K',
        examples: ['Community Leaders', 'Patient Advocates', 'Local Fitness Trainers'],
        benefits: ['Community trust', 'Geographic targeting', 'Personal testimonials'],
        engagement: '7.5%',
        cpm: '$10-25',
        color: accentColor,
        recommended: false
      }
    ],
    'Medical': [
      {
        tier: 'Aesthetic Influencers',
        icon: Award,
        followers: '50K-500K',
        examples: ['Beauty Influencers', 'Lifestyle Creators', 'Before/After Specialists'],
        benefits: ['Visual transformation content', 'Authentic testimonials', 'Trust with target demographic'],
        engagement: '4.5%',
        cpm: '$35-75',
        color: primaryColor,
        recommended: true
      },
      {
        tier: 'Medical Experts',
        icon: Target,
        followers: '10K-100K',
        examples: ['Dermatologists', 'Aesthetic Nurses', 'Medical Educators'],
        benefits: ['Professional credibility', 'Educational authority', 'Procedure explanations'],
        engagement: '5.8%',
        cpm: '$40-80',
        color: secondaryColor,
        recommended: false
      },
      {
        tier: 'Micro-Influencers',
        icon: Users,
        followers: '5K-50K',
        examples: ['Local Beauty Bloggers', 'Real Patient Advocates', 'Wellness Creators'],
        benefits: ['Authentic reviews', 'High engagement', 'Cost-effective reach'],
        engagement: '8.2%',
        cpm: '$15-30',
        color: accentColor,
        recommended: false
      }
    ],
    'Restaurant': [
      {
        tier: 'Food Critics & Bloggers',
        icon: Award,
        followers: '25K-200K',
        examples: ['Food YouTubers', 'Restaurant Reviewers', 'Culinary Experts'],
        benefits: ['Credibility with foodies', 'In-depth reviews', 'Viral food content'],
        engagement: '5.5%',
        cpm: '$25-50',
        color: primaryColor,
        recommended: true
      },
      {
        tier: 'Local Food Influencers',
        icon: Target,
        followers: '10K-75K',
        examples: ['City Food Guides', 'Local Foodies', 'Restaurant Explorers'],
        benefits: ['Geographic reach', 'Local credibility', 'Community influence'],
        engagement: '6.8%',
        cpm: '$15-35',
        color: secondaryColor,
        recommended: false
      },
      {
        tier: 'Micro Food Creators',
        icon: Users,
        followers: '5K-25K',
        examples: ['TikTok Foodies', 'Instagram Food Photographers', 'Date Night Bloggers'],
        benefits: ['High engagement', 'Authentic content', 'Budget-friendly'],
        engagement: '9.2%',
        cpm: '$10-20',
        color: accentColor,
        recommended: false
      }
    ],
    'Home Services': [
      {
        tier: 'Home Improvement Experts',
        icon: Award,
        followers: '50K-500K',
        examples: ['DIY YouTubers', 'Home Renovation Shows', 'Contractor Educators'],
        benefits: ['Trust with homeowners', 'Before/after content', 'Expert recommendations'],
        engagement: '4.2%',
        cpm: '$20-45',
        color: primaryColor,
        recommended: true
      },
      {
        tier: 'Local Home Influencers',
        icon: Target,
        followers: '10K-100K',
        examples: ['Real Estate Agents', 'Interior Designers', 'Home Stagers'],
        benefits: ['Local authority', 'Referral network', 'Home buyer reach'],
        engagement: '5.5%',
        cpm: '$15-35',
        color: secondaryColor,
        recommended: false
      },
      {
        tier: 'Community Voices',
        icon: Users,
        followers: '5K-50K',
        examples: ['Neighborhood Bloggers', 'HOA Leaders', 'Local Moms Groups'],
        benefits: ['Community trust', 'Word-of-mouth power', 'Authentic reviews'],
        engagement: '8.0%',
        cpm: '$10-20',
        color: accentColor,
        recommended: false
      }
    ]
  };

  return industryMap[industry] || [
    {
      tier: 'Industry Thought Leaders',
      icon: Award,
      followers: '50K-500K',
      examples: ['Industry Experts', 'Podcast Hosts', 'Content Creators'],
      benefits: [`Credibility with ${clientName}'s target audience`, 'Long-form educational content', 'Access to engaged niche audiences'],
      engagement: '4.8%',
      cpm: '$25-50',
      color: primaryColor,
      recommended: true
    },
    {
      tier: 'Niche Specialists',
      icon: Target,
      followers: '10K-100K',
      examples: ['Industry Analysts', 'Vertical Experts', 'Professional Advisors'],
      benefits: ['Deep expertise authority', 'Influence on purchasing decisions', 'Speaking at industry events'],
      engagement: '6.2%',
      cpm: '$30-60',
      color: secondaryColor,
      recommended: false
    },
    {
      tier: 'Micro-Influencer Network',
      icon: Users,
      followers: '5K-50K',
      examples: ['Passionate Customers', 'Industry Practitioners', 'Local Advocates'],
      benefits: ['Authentic peer recommendations', 'Higher engagement rates', 'Cost-effective reach at scale'],
      engagement: '8.5%',
      cpm: '$10-25',
      color: accentColor,
      recommended: false
    }
  ];
};

const getIndustryCampaigns = (industry: string): CampaignType[] => {
  const campaignMap: Record<string, CampaignType[]> = {
    'Healthcare': [
      { icon: Video, title: 'Patient Testimonials', description: 'Real patient stories showcasing their healthcare journey and positive outcomes', metrics: '3x higher trust scores' },
      { icon: Mic, title: 'Health Podcast Features', description: 'Expert interviews and sponsored segments on health & wellness podcasts', metrics: '18min avg listen time' },
      { icon: MessageSquare, title: 'Educational Content', description: 'Health tips and procedure explanations by trusted medical influencers', metrics: '45% higher engagement' },
      { icon: Star, title: 'Provider Spotlights', description: 'Behind-the-scenes looks at your facility and staff', metrics: '2.5x lead quality' }
    ],
    'Medical': [
      { icon: Video, title: 'Transformation Stories', description: 'Before/after content and patient journey documentation', metrics: '4x higher engagement' },
      { icon: MessageSquare, title: 'Expert Q&A Sessions', description: 'Live sessions with aesthetic influencers answering follower questions', metrics: '3x more saves' },
      { icon: Star, title: 'Procedure Walkthroughs', description: 'Educational content demystifying treatments and setting expectations', metrics: '65% higher trust' },
      { icon: Mic, title: 'Beauty Podcast Sponsorships', description: 'Sponsored segments on popular beauty and wellness podcasts', metrics: '2x consultation bookings' }
    ],
    'Restaurant': [
      { icon: Video, title: 'Food Reviews & Tastings', description: 'In-depth menu explorations and honest food reviews', metrics: '5x higher shares' },
      { icon: Camera, title: 'Behind-the-Kitchen', description: 'Chef spotlights and kitchen content that builds authenticity', metrics: '3x engagement' },
      { icon: Star, title: 'Event Coverage', description: 'Special events, new menu launches, and exclusive tastings', metrics: '4x local reach' },
      { icon: MessageSquare, title: 'Date Night Features', description: 'Restaurant experience content for couples and special occasions', metrics: '2.5x weekend bookings' }
    ]
  };

  return campaignMap[industry] || [
    { icon: Mic, title: 'Podcast Sponsorships', description: 'Host-read ads and sponsored segments reaching your ideal customer', metrics: '15-20min avg listen time' },
    { icon: Video, title: 'Video Content Series', description: 'Thought leadership content featuring industry experts', metrics: '3x engagement vs static posts' },
    { icon: MessageSquare, title: 'Expert Reviews & Demos', description: 'In-depth product/service walkthroughs by respected voices', metrics: '45% higher trust scores' },
    { icon: Star, title: 'Case Study Collaborations', description: 'Co-created content showcasing real customer results', metrics: '2.5x lead quality' }
  ];
};

export const InfluencerMarketingSection = ({
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
}: InfluencerMarketingSectionProps) => {

  // Use AI-generated content or industry-adaptive fallbacks
  const iconMap: Record<string, any> = { Award, Target, Users, Mic, Video, MessageSquare, Star, Camera };
  
  const influencerTiers = content?.tiers && content.tiers.length > 0 
    ? content.tiers.map((t, i) => ({ 
        ...t, 
        icon: iconMap[t.icon as string] || [Award, Target, Users][i] || Award,
        color: t.color || [primaryColor, secondaryColor, accentColor][i] || primaryColor
      }))
    : getIndustryInfluencers(clientIndustry, clientName, primaryColor, secondaryColor, accentColor);

  const campaignTypes = content?.campaignTypes && content.campaignTypes.length > 0 
    ? content.campaignTypes.map(c => ({ ...c, icon: iconMap[c.icon as string] || Mic }))
    : getIndustryCampaigns(clientIndustry);

  const sampleInfluencers = content?.sampleInfluencers && content.sampleInfluencers.length > 0 
    ? content.sampleInfluencers
    : [
      { name: `${clientIndustry} Expert`, handle: '@industryexpert', platform: 'Instagram', followers: '125K', focus: `${clientIndustry} insights`, engagement: '5.2%' },
      { name: 'Trusted Voice', handle: '@trustedvoice', platform: 'YouTube', followers: '89K', focus: 'Educational Content', engagement: '4.8%' },
      { name: 'Local Advocate', handle: 'Podcast', platform: 'Apple/Spotify', followers: '45K', focus: 'Community Focus', engagement: '7.1%' }
    ];

  const sectionDescription = content?.description || 
    `Influencer marketing for ${clientName} isn't about follower counts. It's about reaching the right customers through voices they trust. We'll connect you with ${clientIndustry.toLowerCase()} thought leaders and creators who influence your target audience's decisions.`;

  return (
    <section id="influencer" className="py-24 relative overflow-hidden" style={{
      background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${secondaryColor} 5%, ${backgroundColor}))`
    }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl opacity-10 animate-pulse" style={{
          background: `radial-gradient(circle, ${primaryColor}, transparent)`
        }} />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" style={{
          background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
          animationDelay: '1.5s'
        }} />
        <Sparkles className="absolute top-1/4 left-10 w-12 h-12 opacity-5" style={{ color: primaryColor }} />
        <Star className="absolute bottom-1/3 right-10 w-10 h-10 opacity-5" style={{ color: secondaryColor }} />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Strategic Creator Partnerships
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                {content?.headline || 'Influencer Marketing'}
              </h2>
              <CalloutBadge text={`${clientIndustry} Focused`} variant="highlight" />
            </div>
            <p className="text-lg max-w-3xl mx-auto leading-relaxed" style={{ color: textMutedColor }}>
              {sectionDescription}
            </p>
          </div>
        </AnimatedSection>

        {/* Stats Bar */}
        <AnimatedSection delay={100}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { value: '11x', label: 'Higher ROI', sublabel: 'vs traditional ads' },
              { value: '92%', label: 'Trust Rate', sublabel: 'for peer recommendations' },
              { value: '67%', label: 'Buyers', sublabel: 'influenced by creators' },
              { value: '3.5x', label: 'Engagement', sublabel: 'vs brand content' }
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-2xl text-center transition-all duration-300 hover:scale-105" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 10px 30px -10px ${primaryColor}15`
              }}>
                <p className="text-3xl md:text-4xl font-bold mb-1" style={{ color: primaryColor }}>
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="font-medium" style={{ color: textColor }}>{stat.label}</p>
                <p className="text-xs mt-1" style={{ color: textMutedColor }}>{stat.sublabel}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Influencer Tiers */}
        <AnimatedSection delay={200}>
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <h3 className="text-2xl font-display font-bold" style={{ color: textColor }}>
                Influencer Strategy for {clientName}
              </h3>
              <CalloutBadge text="Curated Network" variant="new" />
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {influencerTiers.map((tier, i) => (
                <div key={i} className={`relative rounded-3xl overflow-hidden group transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 ${tier.recommended ? 'ring-2' : ''}`} style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 20px 50px -15px ${tier.color}20`,
                  ...(tier.recommended && { ringColor: tier.color })
                }}>
                  {tier.recommended && (
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium" style={{
                      background: tier.color,
                      color: isLightColor(tier.color || primaryColor) ? '#1a1a2e' : 'white'
                    }}>
                      Recommended
                    </div>
                  )}
                  
                  <div className="h-1.5" style={{ background: tier.color }} />
                  
                  <div className="p-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{
                      background: `linear-gradient(135deg, ${tier.color}, color-mix(in srgb, ${tier.color} 70%, ${secondaryColor}))`,
                      boxShadow: `0 10px 30px -5px ${tier.color}40`
                    }}>
                      {tier.icon && <tier.icon className="w-7 h-7" style={{ color: isLightColor(tier.color || primaryColor) ? '#1a1a2e' : 'white' }} />}
                    </div>
                    
                    <h4 className="text-xl font-bold mb-2" style={{ color: textColor }}>{tier.tier}</h4>
                    <p className="text-2xl font-bold mb-4" style={{ color: tier.color }}>{tier.followers} followers</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tier.examples.map((example, j) => (
                        <span key={j} className="px-3 py-1 rounded-full text-xs" style={{
                          background: `${tier.color}15`,
                          color: tier.color
                        }}>
                          {example}
                        </span>
                      ))}
                    </div>
                    
                    <ul className="space-y-2 mb-6">
                      {tier.benefits.map((benefit, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tier.color }} />
                          <span style={{ color: textMutedColor }}>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: `1px solid ${borderColor}` }}>
                      <div>
                        <p className="text-lg font-bold" style={{ color: textColor }}>{tier.engagement}</p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Avg Engagement</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: textColor }}>{tier.cpm}</p>
                        <p className="text-xs" style={{ color: textMutedColor }}>CPM Range</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Campaign Types */}
        <AnimatedSection delay={300}>
          <div className="p-10 rounded-3xl relative overflow-hidden mb-12" style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 90%, ${primaryColor} 10%), ${cardBackground})`,
            border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
            boxShadow: `0 30px 60px -15px ${primaryColor}15`
          }}>
            <div className="absolute top-0 right-1/4 w-48 h-48 rounded-full blur-3xl opacity-10" style={{
              background: primaryColor
            }} />
            
            <div className="relative">
              <h3 className="text-2xl font-bold mb-8" style={{ color: textColor }}>Campaign Formats for {clientName}</h3>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {campaignTypes.map((campaign, i) => (
                  <div key={i} className="p-6 rounded-2xl transition-all duration-300 hover:scale-105" style={{
                    background: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}>
                    <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center" style={{
                      background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                    }}>
                      {campaign.icon && <campaign.icon className="w-6 h-6" style={{ color: primaryColor }} />}
                    </div>
                    <h4 className="font-bold mb-2" style={{ color: textColor }}>{campaign.title}</h4>
                    <p className="text-sm mb-4" style={{ color: textMutedColor }}>{campaign.description}</p>
                    <p className="text-xs font-medium px-3 py-1 rounded-full inline-block" style={{
                      background: `${secondaryColor}15`,
                      color: secondaryColor
                    }}>
                      {campaign.metrics}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Sample Influencer Network */}
        <AnimatedSection delay={400}>
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-6" style={{ color: textColor }}>Sample Influencer Network for {clientName}</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              {sampleInfluencers.map((influencer, i) => (
                <div key={i} className="p-6 rounded-2xl flex items-center gap-4 transition-all duration-300 hover:scale-105" style={{
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                  }}>
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold truncate" style={{ color: textColor }}>{influencer.name}</h4>
                    <p className="text-sm truncate" style={{ color: textMutedColor }}>{influencer.handle}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        background: `${primaryColor}15`,
                        color: primaryColor
                      }}>
                        {influencer.followers}
                      </span>
                      <span className="text-xs" style={{ color: textMutedColor }}>
                        {influencer.engagement} eng
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Process Note */}
        <AnimatedSection delay={500}>
          <div className="p-6 rounded-2xl flex items-start gap-4" style={{
            background: `color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor})`,
            border: `1px solid ${borderColor}`
          }}>
            <Zap className="w-8 h-8 flex-shrink-0" style={{ color: primaryColor }} />
            <div>
              <p className="font-medium" style={{ color: textColor }}>Our Influencer Selection Process</p>
              <p className="text-sm" style={{ color: textMutedColor }}>
                We vet every creator for audience quality, engagement authenticity, and brand alignment. 
                No fake followers, no bot engagement. Only genuine reach to customers who can actually become {clientName} clients. 
                All partnerships include performance tracking and ROI measurement.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

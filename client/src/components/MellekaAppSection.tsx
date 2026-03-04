import { AnimatedSection } from "@/components/AnimatedSection";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Smartphone, MessageCircle, Mail, Bell, Clock, Shield, Zap, CheckCircle, ArrowRight, Calendar } from "lucide-react";
import { isLightColor } from './PlatformLogos';

interface SampleMessage {
  initials: string;
  name: string;
  channel: 'email' | 'instagram' | 'chat';
  message: string;
  time: string;
}

interface MellekaAppContent {
  sampleMessages?: SampleMessage[];
}

interface MellekaAppSectionProps {
  clientName: string;
  clientLogo?: string;
  clientIndustry?: string;
  content?: MellekaAppContent;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

// Industry-specific default messages
const getIndustryMessages = (industry: string, clientName: string): SampleMessage[] => {
  const messageMap: Record<string, SampleMessage[]> = {
    'Healthcare': [
      { initials: 'JM', name: 'Jennifer Martinez', channel: 'email', message: `Hi! I'd like to schedule a consultation for my upcoming procedure. Do you have availability next week?`, time: '3h' },
      { initials: 'RB', name: 'Robert Brown', channel: 'instagram', message: `Saw your amazing patient results on Instagram! How do I book an appointment?`, time: '4h' },
      { initials: 'LW', name: 'Lisa Wong', channel: 'chat', message: `What insurance plans do you accept? Looking for a new provider.`, time: '1d' }
    ],
    'Medical': [
      { initials: 'SM', name: 'Sarah Mitchell', channel: 'email', message: `I'm interested in learning more about your hair restoration options. Can we schedule a free consultation?`, time: '3h' },
      { initials: 'MJ', name: 'Michael Johnson', channel: 'instagram', message: `Your before/after photos are incredible! What's the recovery time like?`, time: '4h' },
      { initials: 'KP', name: 'Karen Peterson', channel: 'chat', message: `Do you offer financing options for your procedures?`, time: '1d' }
    ],
    'Restaurant': [
      { initials: 'DT', name: 'David Torres', channel: 'email', message: `We'd like to book a private dining room for a party of 20 next Saturday. Is that available?`, time: '3h' },
      { initials: 'AK', name: 'Amy Kim', channel: 'instagram', message: `That pasta dish looks amazing! Do you have vegetarian options?`, time: '4h' },
      { initials: 'JL', name: 'James Lee', channel: 'chat', message: `Can we make a reservation for tonight at 7pm for 4 people?`, time: '1d' }
    ],
    'Home Services': [
      { initials: 'TP', name: 'Tom Patterson', channel: 'email', message: `Our AC stopped working and it's getting hot! Can someone come out today for an emergency repair?`, time: '3h' },
      { initials: 'SG', name: 'Susan Garcia', channel: 'instagram', message: `Saw your work on a neighbor's house - looks great! Can you provide a free estimate?`, time: '4h' },
      { initials: 'BM', name: 'Brian Miller', channel: 'chat', message: `What's your availability for a roof inspection next week?`, time: '1d' }
    ]
  };

  return messageMap[industry] || [
    { initials: 'SM', name: 'Sarah Mitchell', channel: 'email', message: `Hi! I'd love to learn more about ${clientName}'s services. Do you have availability this week?`, time: '3h' },
    { initials: 'JT', name: 'James Thompson', channel: 'instagram', message: `Found you through a friend's recommendation! What's the best way to get started?`, time: '4h' },
    { initials: 'AR', name: 'Amanda Rodriguez', channel: 'chat', message: `Can I get a quote for your services?`, time: '1d' }
  ];
};

export const MellekaAppSection = ({
  clientName,
  clientLogo,
  clientIndustry = 'General',
  content,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor,
}: MellekaAppSectionProps) => {
  
  // Use AI-generated messages or industry-specific fallbacks
  const sampleMessages = content?.sampleMessages && content.sampleMessages.length > 0 
    ? content.sampleMessages 
    : getIndustryMessages(clientIndustry, clientName);

  const features = [
    {
      icon: MessageCircle,
      title: "Unified Inbox",
      description: `All ${clientName} customer texts and emails in one place. Never miss a lead again.`,
    },
    {
      icon: Bell,
      title: "Instant Notifications",
      description: "Get real-time push notifications the moment a customer reaches out.",
    },
    {
      icon: Clock,
      title: "Response Time Tracking",
      description: "Monitor your average response times and improve customer satisfaction.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Enterprise-grade security keeps all your customer communications safe.",
    },
  ];

  const benefits = [
    "Respond to texts directly from your phone",
    "Reply to customer emails on the go",
    "View full conversation history",
    "Assign conversations to team members",
    "Set auto-replies for after hours",
    "Track response metrics in real-time",
  ];

  return (
    <section id="melleka-app" className="py-24 relative overflow-hidden" style={{ backgroundColor }}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, ${primaryColor} 0%, transparent 50%), radial-gradient(circle at 80% 50%, ${secondaryColor} 0%, transparent 50%)`,
      }} />
      
      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Your Command Center
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{ color: textColor }}>
              The Melleka App
            </h2>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
              Every text and email response at your fingertips. Our dedicated mobile app puts you in complete control 
              of your customer communications, so you can respond instantly from anywhere.
            </p>
          </div>
        </AnimatedSection>

        {/* Stats Row */}
        <AnimatedSection delay={100}>
          <div className="grid grid-cols-3 gap-4 mb-16 max-w-2xl mx-auto">
            <div className="text-center p-4 rounded-2xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                <AnimatedCounter value="24" />/7
              </p>
              <p className="text-xs md:text-sm" style={{ color: textMutedColor }}>Access</p>
            </div>
            <div className="text-center p-4 rounded-2xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                &lt;<AnimatedCounter value="30" />s
              </p>
              <p className="text-xs md:text-sm" style={{ color: textMutedColor }}>Notification Speed</p>
            </div>
            <div className="text-center p-4 rounded-2xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                <AnimatedCounter value="100%" />
              </p>
              <p className="text-xs md:text-sm" style={{ color: textMutedColor }}>Secure</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phone Mockup - Larger to fill gap */}
          <AnimatedSection delay={200}>
            <div className="relative mx-auto" style={{ maxWidth: '380px' }}>
              {/* Glow effect */}
              <div 
                className="absolute inset-0 blur-3xl opacity-30 rounded-full"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              />
              
              {/* Phone Frame */}
              <div 
                className="relative rounded-[3rem] p-3 shadow-2xl"
                style={{ 
                  background: 'linear-gradient(145deg, #0a0a0a, #1a1a1a)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                {/* Dynamic Island */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20" />
                
                {/* Screen */}
                <div 
                  className="rounded-[2.5rem] overflow-hidden min-h-[620px]"
                  style={{ background: '#0d1117' }}
                >
                  {/* Status Bar */}
                  <div className="flex justify-between items-center px-8 pt-4 pb-2">
                    <span className="text-xs font-semibold text-white">12:28</span>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className="w-1 rounded-sm bg-white" style={{ height: `${4 + i * 2}px` }} />
                        ))}
                      </div>
                      <svg className="w-4 h-3 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                      </svg>
                      <div className="w-6 h-3 rounded-sm bg-white ml-1 relative">
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white rounded-r-sm -mr-0.5" />
                      </div>
                    </div>
                  </div>
                  
                  {/* App Header with Client Branding */}
                  <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Menu Icon */}
                        <div className="flex flex-col gap-1">
                          <div className="w-5 h-0.5 bg-white/60" />
                          <div className="w-5 h-0.5 bg-white/60" />
                          <div className="w-5 h-0.5 bg-white/60" />
                        </div>
                        {/* Client Name & Logo */}
                        <div className="flex items-center gap-2">
                          {clientLogo ? (
                            <img 
                              src={clientLogo} 
                              alt={clientName}
                              className="w-6 h-6 rounded object-contain"
                              style={{ filter: 'brightness(0) invert(1)' }}
                            />
                          ) : null}
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-white text-sm">{clientName}</span>
                              <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            <span className="text-[10px] text-white/50">Your Location</span>
                          </div>
                        </div>
                      </div>
                      {/* Edit Icon */}
                      <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  </div>

                  {/* Mobile App Banner */}
                  <div className="mx-4 mt-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}20` }}>
                        <Smartphone className="w-3 h-3" style={{ color: primaryColor }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium" style={{ color: primaryColor }}>Try the new Mobile Experience</p>
                        <p className="text-[10px] text-white/50 mt-0.5">
                          The new mobile app experience is now available.
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: primaryColor }}>Visible only to Agency Admins</p>
                      </div>
                      <button className="text-white/40 text-lg leading-none">×</button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex gap-2 px-4 py-3">
                    <div className="px-3 py-1.5 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ border: `1px solid ${primaryColor}40`, color: 'white' }}>
                      Location <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className="px-3 py-1.5 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ border: `1px solid ${primaryColor}40`, color: 'white' }}>
                      Type <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className="px-3 py-1.5 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ border: `1px solid ${primaryColor}40`, color: 'white' }}>
                      Status <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  
                  {/* Message List - Unified Inbox Style */}
                  <div className="px-3 space-y-1">
                    {sampleMessages.map((msg, i) => {
                      const ChannelIcon = msg.channel === 'email' ? Mail : msg.channel === 'instagram' ? MessageCircle : Zap;
                      const channelLabel = msg.channel === 'email' ? 'has sent an email' : msg.channel === 'instagram' ? 'sent a new message on instagram' : 'has sent you a new Live Chat message';
                      return (
                        <div key={i} className="p-3 rounded-xl">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: `${primaryColor}30`, color: primaryColor }}
                              >
                                {msg.initials}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0d1117' }}>
                                <ChannelIcon className="w-2.5 h-2.5" style={{ color: primaryColor }} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-white/90">
                                    <span style={{ color: primaryColor }}>{msg.name}</span> {channelLabel} : <span className="text-white/70">{msg.message}</span>
                                  </p>
                                  <p className="text-[10px] text-white/40 mt-1">Location : <span style={{ color: primaryColor }}>{clientName}</span></p>
                                </div>
                                <span className="text-[10px] text-white/40 flex-shrink-0">{msg.time}</span>
                              </div>
                              <button 
                                className="mt-2 px-4 py-1.5 rounded-full text-[10px] font-medium"
                                style={{ border: `1px solid ${primaryColor}`, color: primaryColor }}
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Floating Action Buttons */}
                  <div className="absolute right-6 bottom-20 flex flex-col gap-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <svg className="w-5 h-5" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Zap className="w-5 h-5" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                    </div>
                  </div>
                  
                  {/* Bottom Nav */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 flex justify-around py-4 px-6"
                    style={{ background: '#0d1117', borderTop: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="p-2 rounded-full" style={{ backgroundColor: `${primaryColor}20` }}>
                        <Bell className="w-5 h-5" style={{ color: primaryColor }} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <MessageCircle className="w-5 h-5 text-white/40" />
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center">
                      <Calendar className="w-5 h-5 text-white/40" />
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Features & Benefits */}
          <div className="space-y-8">
            <AnimatedSection delay={300}>
              <h3 className="text-2xl font-display font-bold mb-6" style={{ color: textColor }}>
                Stay Connected, Stay Responsive
              </h3>
              <p className="mb-8" style={{ color: textMutedColor }}>
                With the Melleka App, {clientName} will have complete control over every customer interaction. 
                Whether it's a text from a new lead or an email follow-up, you'll be able to respond 
                instantly from your smartphone.
              </p>
            </AnimatedSection>

            {/* Feature Cards */}
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, idx) => (
                <AnimatedSection key={idx} delay={400 + idx * 100}>
                  <div 
                    className="p-5 rounded-2xl h-full transition-all duration-300 hover:scale-[1.02]"
                    style={{ 
                      background: cardBackground, 
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}20)` }}
                    >
                      <feature.icon className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <h4 className="font-semibold mb-2" style={{ color: textColor }}>{feature.title}</h4>
                    <p className="text-sm" style={{ color: textMutedColor }}>{feature.description}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>

            {/* Benefits List */}
            <AnimatedSection delay={800}>
              <div 
                className="p-6 rounded-2xl"
                style={{ background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`, border: `1px solid ${borderColor}` }}
              >
                <h4 className="font-semibold mb-4 flex items-center gap-2" style={{ color: textColor }}>
                  <Smartphone className="w-5 h-5" style={{ color: primaryColor }} />
                  What You Can Do
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
                      <span className="text-sm" style={{ color: textMutedColor }}>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            {/* CTA Note */}
            <AnimatedSection delay={900}>
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: cardBackground, border: `1px solid ${borderColor}` }}>
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                  <ArrowRight className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: textColor }}>
                    Available on iOS & Android
                  </p>
                  <p className="text-xs" style={{ color: textMutedColor }}>
                    Download links will be provided upon campaign launch
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
};

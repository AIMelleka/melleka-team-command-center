import { Phone, MessageSquare, Clock, Users, Zap, TrendingUp, CheckCircle2, ArrowRight, Bell, Calendar, ShoppingCart, Heart, RefreshCw, Target, Wifi, Battery, Signal } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedCounter } from './AnimatedCounter';
import { CalloutBadge } from './ProposalAnnotations';
interface SMSCampaign {
  type: string;
  purpose: string;
  sampleMessage?: string;
  timing: string;
}

interface TextingCampaignsSectionProps {
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
    headline?: string;
    description?: string;
    campaigns?: SMSCampaign[];
    features?: string[];
    expectedResults?: {
      openRate?: string;
      responseRate?: string;
      conversionRate?: string;
    };
  };
}

// Realistic iPhone SMS Mockup Component
const PhoneSMSMockup = ({
  messages,
  clientName,
  primaryColor,
  time = "9:41"
}: {
  messages: Array<{
    text: string;
    isIncoming: boolean;
    time?: string;
  }>;
  clientName: string;
  primaryColor: string;
  time?: string;
}) => <div className="relative mx-auto" style={{
  maxWidth: '280px'
}}>
    {/* Phone Frame */}
    <div className="relative rounded-[2.5rem] p-2 shadow-2xl" style={{
    background: 'linear-gradient(145deg, #1a1a1a, #2d2d2d)',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
  }}>
      {/* Screen */}
      <div className="rounded-[2rem] overflow-hidden" style={{
      background: '#000'
    }}>
        {/* Status Bar */}
        <div className="flex items-center justify-between px-6 py-2" style={{
        background: 'linear-gradient(180deg, #1c1c1e, #000)'
      }}>
          <span className="text-white text-xs font-semibold">{time}</span>
          <div className="absolute left-1/2 -translate-x-1/2 w-24 h-6 rounded-b-2xl bg-black" />
          <div className="flex items-center gap-1">
            <Signal className="w-3.5 h-3.5 text-white" />
            <Wifi className="w-3.5 h-3.5 text-white" />
            <Battery className="w-4 h-3.5 text-white" />
          </div>
        </div>
        
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800" style={{
        background: 'rgba(28,28,30,0.95)'
      }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
        }}>
            {clientName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">{clientName}</p>
            <p className="text-gray-500 text-xs">Business SMS</p>
          </div>
        </div>
        
        {/* Messages */}
        <div className="p-4 space-y-3 min-h-[220px]" style={{
        background: 'linear-gradient(180deg, #000 0%, #0a0a0a 100%)'
      }}>
          {messages.map((msg, i) => <div key={i} className={`flex ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${msg.isIncoming ? 'rounded-bl-md' : 'rounded-br-md'}`} style={{
            background: msg.isIncoming ? 'linear-gradient(135deg, #3a3a3c, #2c2c2e)' : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
            boxShadow: msg.isIncoming ? 'none' : `0 4px 15px -3px ${primaryColor}40`
          }}>
                <p className="text-white text-sm leading-relaxed break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</p>
                {msg.time && <p className="text-right text-[10px] mt-1 opacity-60 text-white">{msg.time}</p>}
              </div>
            </div>)}
        </div>
        
        {/* Input Bar */}
        <div className="flex items-center gap-2 px-3 py-3 border-t border-gray-800" style={{
        background: 'rgba(28,28,30,0.95)'
      }}>
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-gray-400 text-lg">+</span>
          </div>
          <div className="flex-1 bg-gray-800 rounded-full px-4 py-2">
            <span className="text-gray-500 text-sm">iMessage</span>
          </div>
        </div>
      </div>
    </div>
    
    {/* Phone reflection */}
    <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none" style={{
    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)'
  }} />
  </div>;
export const TextingCampaignsSection = ({
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
}: TextingCampaignsSectionProps) => {
  // Helper to convert AI campaign to SMS conversation format
  const convertCampaignToConversation = (campaign: SMSCampaign, index: number) => {
    // If no sample message, create a generic one based on type and purpose
    const rawMessage = campaign.sampleMessage || 
      `Hi! This is ${clientName}. ${campaign.purpose} Reply for more info.`;
    
    // Extract customer name placeholder from message or use generic
    const sampleName = rawMessage.includes('[Name]') ? 
      ['Sarah', 'Mike', 'Lisa', 'Alex'][index % 4] : 
      ['Sarah', 'Mike', 'Lisa', 'Alex'][index % 4];
    
    // Replace [Name] with actual name and clean up [Link], [Time], etc.
    const cleanedMessage = rawMessage
      .replace(/\[Name\]/g, sampleName)
      .replace(/\[Link\]/g, `${clientName.toLowerCase().replace(/\s+/g, '')}.com/book`)
      .replace(/\[Time\]/g, '2:00 PM')
      .replace(/\[Location\]/g, 'our office');
    
    // Generate appropriate response based on campaign type
    const getResponseAndFollowup = (type: string) => {
      const typeNormalized = type.toLowerCase();
      if (typeNormalized.includes('appointment') || typeNormalized.includes('reminder')) {
        return {
          response: 'YES, confirmed!',
          followup: "Perfect! We look forward to seeing you. Reply if you have any questions before your appointment! 📅"
        };
      } else if (typeNormalized.includes('follow-up') || typeNormalized.includes('followup')) {
        return {
          response: 'Thanks! Looking into it now',
          followup: "Great! Take your time. If you have any questions about financing options, just reply here and we'll help! 💪"
        };
      } else if (typeNormalized.includes('re-engage') || typeNormalized.includes('reactivate')) {
        return {
          response: 'Yes, I\'d like to schedule',
          followup: "Wonderful! I'm checking availability now. Would mornings or afternoons work better for you? 🗓️"
        };
      } else {
        return {
          response: 'Interested! Tell me more',
          followup: `Great to hear from you! Let me get you more details. Is there a specific question I can answer about ${clientName}?`
        };
      }
    };

    const { response, followup } = getResponseAndFollowup(campaign.type);
    const times = ['9:15 AM', '10:32 AM', '2:15 PM', '4:30 PM'];
    const time = times[index % times.length];

    return {
      title: campaign.type,
      trigger: campaign.timing.split(' ').slice(0, 3).join(' '),
      metric: {
        value: content?.expectedResults?.responseRate || '35%',
        label: 'Response'
      },
      messages: [
        { text: cleanedMessage, isIncoming: true, time },
        { text: response, isIncoming: false, time: incrementTime(time, 3) },
        { text: followup, isIncoming: true, time: incrementTime(time, 4) }
      ],
      gradient: [
        `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
        `linear-gradient(135deg, ${secondaryColor}, ${accentColor})`,
        `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
        `linear-gradient(135deg, ${primaryColor}, ${accentColor})`
      ][index % 4]
    };
  };

  // Helper to increment time for conversation flow
  const incrementTime = (time: string, minutes: number) => {
    const [hourMin, period] = time.split(' ');
    const [hour, min] = hourMin.split(':').map(Number);
    const newMin = min + minutes;
    if (newMin >= 60) {
      return `${hour + 1}:${String(newMin - 60).padStart(2, '0')} ${period}`;
    }
    return `${hour}:${String(newMin).padStart(2, '0')} ${period}`;
  };

  // Check if we have AI-generated campaigns
  const aiCampaigns = content?.campaigns && Array.isArray(content.campaigns) ? content.campaigns : null;
  
  // Default fallback SMS examples - only used if AI didn't generate any
  const defaultSmsExamples = [{
    title: 'Appointment Reminder',
    trigger: '24hr Before',
    metric: { value: '85%', label: 'Show Rate' },
    messages: [
      { text: `Hi Sarah! Your ${clientName} appointment is tomorrow at 2:00 PM. Reply YES to confirm or RESCHEDULE to pick a new time.`, isIncoming: true, time: '10:32 AM' },
      { text: 'YES', isIncoming: false, time: '10:33 AM' },
      { text: "Great! You're all set. We look forward to seeing you tomorrow! 📅", isIncoming: true, time: '10:33 AM' }
    ],
    gradient: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
  }, {
    title: 'Follow-Up',
    trigger: 'Post-Visit',
    metric: { value: '45%', label: 'Response' },
    messages: [
      { text: `Hey Mike! Thanks for visiting ${clientName}. Do you have any questions we can help answer?`, isIncoming: true, time: '2:15 PM' },
      { text: 'Actually yes, one quick question', isIncoming: false, time: '2:18 PM' },
      { text: "Of course! What would you like to know? I'm here to help.", isIncoming: true, time: '2:18 PM' }
    ],
    gradient: `linear-gradient(135deg, ${secondaryColor}, ${accentColor})`
  }, {
    title: 'Special Offer',
    trigger: 'Promotion',
    metric: { value: '35%', label: 'Response' },
    messages: [
      { text: `Hey Lisa! We have a special offer for you at ${clientName}. Reply INFO to learn more. 💰`, isIncoming: true, time: '9:00 AM' },
      { text: 'INFO', isIncoming: false, time: '9:15 AM' },
      { text: "Great! I'm sending you the details now. This offer is available for a limited time. 🎉", isIncoming: true, time: '9:15 AM' }
    ],
    gradient: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`
  }, {
    title: 'Re-Engagement',
    trigger: '30+ Days',
    metric: { value: '28%', label: 'Reactivation' },
    messages: [
      { text: `Hi Alex! It's been a while since we connected. ${clientName} has some exciting updates - interested in learning more?`, isIncoming: true, time: '11:00 AM' },
      { text: 'Yes, tell me more!', isIncoming: false, time: '11:22 AM' },
      { text: "Wonderful! I'd love to share what's new. Would you prefer a quick call or should I send you some info?", isIncoming: true, time: '11:23 AM' }
    ],
    gradient: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`
  }];

  // Use AI-generated campaigns if available, otherwise use defaults
  const smsExamples = aiCampaigns 
    ? aiCampaigns.slice(0, 4).map((campaign, index) => convertCampaignToConversation(campaign, index))
    : defaultSmsExamples;

  // SMS automation workflows
  const automationFlows = [{
    name: 'Lead Qualification',
    steps: ['Form Submit', 'Instant SMS', 'Qualification Q\'s', 'Route to Sales'],
    description: 'Qualify inbound leads in under 60 seconds with automated SMS conversation'
  }, {
    name: 'Onboarding Drip',
    steps: ['Trial Start', 'Day 1 Welcome', 'Day 3 Check-in', 'Day 7 Value'],
    description: 'Guide new users through activation milestones with personalized texts'
  }, {
    name: 'Win-Back Sequence',
    steps: ['Dormant 30 Days', 'Win-back SMS', 'Offer', 'Sales Call'],
    description: 'Recover churned or inactive accounts with targeted outreach'
  }];
  return <section id="texting" className="py-24 relative overflow-hidden" style={{
    background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor}))`
  }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl opacity-10 animate-pulse" style={{
        background: `radial-gradient(circle, ${primaryColor}, transparent)`
      }} />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" style={{
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
              Direct Response Marketing
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{
              color: textColor
            }}>Texting Campaigns</h2>
              <CalloutBadge text="98% Open Rate" variant="highlight" />
            </div>
            <p className="text-lg max-w-3xl mx-auto leading-relaxed" style={{
            color: textMutedColor
          }}>
              While emails sit unopened, SMS delivers instant engagement. We'll build automated text campaigns 
              specifically for {clientName}'s sales cycle, from demo reminders to renewal nudges, with 
              personalized messaging that drives action.
            </p>
          </div>
        </AnimatedSection>

        {/* Stats Bar */}
        <AnimatedSection delay={100}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
            {[{
            value: '98%',
            label: 'Open Rate',
            sublabel: 'vs 20% email'
          }, {
            value: '45%',
            label: 'Response Rate',
            sublabel: 'vs 6% email'
          }, {
            value: '<3min',
            label: 'Avg Response',
            sublabel: 'real-time'
          }, {
            value: '6x',
            label: 'Higher CTR',
            sublabel: 'than email'
          }].map((stat, i) => <div key={i} className="p-6 rounded-2xl text-center relative overflow-hidden group transition-all duration-300 hover:scale-105" style={{
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 10px 30px -10px ${primaryColor}15`
          }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
              background: `radial-gradient(circle at 50% 100%, ${primaryColor}10, transparent 70%)`
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

        {/* Phone Mockup Examples */}
        <AnimatedSection delay={200}>
          <div className="mb-20">
            <div className="flex items-center gap-3 mb-12">
              <h3 className="text-2xl font-display font-bold" style={{
              color: textColor
            }}>
                Real Campaign Examples for {clientName}
              </h3>
              <CalloutBadge text="Interactive" variant="new" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {smsExamples.map((example, i) => <div key={i} className="relative group">
                  {/* Card container */}
                  <div className="p-6 rounded-3xl transition-all duration-500 group-hover:scale-[1.02] group-hover:-translate-y-2" style={{
                background: `linear-gradient(145deg, color-mix(in srgb, ${cardBackground} 95%, ${primaryColor} 5%), ${cardBackground})`,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 25px 50px -15px ${primaryColor}20`
              }}>
                    {/* Gradient accent bar */}
                    <div className="h-1 rounded-t-3xl -mx-6 -mt-6 mb-6" style={{
                  background: example.gradient
                }} />
                    
                    {/* Title & Metrics */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-bold" style={{
                      color: textColor
                    }}>{example.title}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: `${primaryColor}15`,
                      color: primaryColor
                    }}>
                          {example.trigger}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold" style={{
                      color: secondaryColor
                    }}>{example.metric.value}</p>
                        <p className="text-[10px]" style={{
                      color: textMutedColor
                    }}>{example.metric.label}</p>
                      </div>
                    </div>
                    
                    {/* Phone Mockup */}
                    <PhoneSMSMockup messages={example.messages} clientName={clientName} primaryColor={primaryColor} />
                  </div>
                </div>)}
            </div>
          </div>
        </AnimatedSection>

        {/* Automation Flows */}
        <AnimatedSection delay={300}>
          <div className="p-10 rounded-3xl relative overflow-hidden" style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${cardBackground} 90%, ${primaryColor} 10%), ${cardBackground})`,
          border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
          boxShadow: `0 30px 60px -15px ${primaryColor}15`
        }}>
            <div className="absolute top-0 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-10" style={{
            background: primaryColor
          }} />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
              }}>
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold" style={{
                  color: textColor
                }}>Automated SMS Workflows</h3>
                  <p className="text-sm" style={{
                  color: textMutedColor
                }}>Set it once, convert forever</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {automationFlows.map((flow, i) => <div key={i} className="p-6 rounded-2xl transition-all duration-300 hover:scale-105" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`
              }}>
                    <h4 className="font-bold mb-3" style={{
                  color: textColor
                }}>{flow.name}</h4>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {flow.steps.map((step, j) => <div key={j} className="flex items-center gap-1">
                          <span className="text-xs px-2 py-1 rounded-lg" style={{
                      background: `color-mix(in srgb, ${primaryColor} ${20 + j * 15}%, transparent)`,
                      color: primaryColor
                    }}>
                            {step}
                          </span>
                          {j < flow.steps.length - 1 && <ArrowRight className="w-3 h-3" style={{
                      color: textMutedColor
                    }} />}
                        </div>)}
                    </div>
                    
                    <p className="text-sm" style={{
                  color: textMutedColor
                }}>{flow.description}</p>
                  </div>)}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Compliance Note */}
        <AnimatedSection delay={400}>
          <div className="mt-12 p-6 rounded-2xl flex items-center gap-4" style={{
          background: `color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor})`,
          border: `1px solid ${borderColor}`
        }}>
            <CheckCircle2 className="w-8 h-8 flex-shrink-0" style={{
            color: primaryColor
          }} />
            <div>
              <p className="font-medium" style={{
              color: textColor
            }}>TCPA & 10DLC Compliant</p>
              <p className="text-sm" style={{
              color: textMutedColor
            }}>
                All campaigns include proper opt-in/opt-out, A2P 10DLC registration, and carrier compliance. 
                We handle the technical setup so you can focus on results.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>;
};
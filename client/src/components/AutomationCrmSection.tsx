import { Workflow, Database, Settings, Zap, ArrowRight, CheckCircle2, MessageSquare, Mail, Phone, Calendar, Users, Target, BarChart3, Layers, RefreshCw } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { CalloutBadge, FloatingAnnotation } from './ProposalAnnotations';
import { isLightColor } from './PlatformLogos';


interface AutomationContent {
  workflowAutomation?: {
    headline?: string;
    description?: string;
    workflows?: Array<{
      name: string;
      trigger: string;
      actions: string[];
      benefit: string;
    }>;
    integrations?: string[];
  };
  automatedSystems?: {
    headline?: string;
    description?: string;
    systems?: Array<{
      name: string;
      description: string;
      icon?: string;
    }>;
  };
}

interface CrmContent {
  headline?: string;
  description?: string;
  features?: string[];
  pipeline?: Array<{
    stage: string;
    actions: string[];
  }>;
  automations?: string[];
  reporting?: string[];
  aiCapabilities?: {
    description?: string;
    features?: string[];
  };
}

interface TextMarketingContent {
  headline?: string;
  description?: string;
  campaigns?: Array<{
    type: string;
    purpose: string;
    timing: string;
  }>;
  features?: string[];
  expectedResults?: {
    openRate?: string;
    responseRate?: string;
    conversionRate?: string;
  };
  complianceNote?: string;
}

interface AutomationCrmSectionProps {
  automationContent: AutomationContent;
  crmContent: CrmContent;
  textMarketingContent: TextMarketingContent;
  clientName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  showWorkflowAutomation?: boolean;
  showAutomatedSystems?: boolean;
  showCrm?: boolean;
  showTextMarketing?: boolean;
}

export const AutomationCrmSection = ({
  automationContent,
  crmContent,
  textMarketingContent,
  clientName,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  showWorkflowAutomation = true,
  showAutomatedSystems = true,
  showCrm = true,
  showTextMarketing = true
}: AutomationCrmSectionProps) => {
  const { workflowAutomation, automatedSystems } = automationContent;

  // Detect dark background for neon effects
  const isDarkBg = cardBackground.includes('rgba') && cardBackground.includes('0.') && parseFloat(cardBackground.match(/[\d.]+/g)?.[3] || '1') < 0.8;

  return (
    <section id="automation-crm" className="py-24 relative overflow-hidden" style={{ backgroundColor: `color-mix(in srgb, ${cardBackground} 50%, transparent)` }}>
      {/* Animated circuit-like background pattern - enhanced for dark mode */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: isDarkBg ? 0.08 : 0.05 }}>
        <svg className="absolute w-full h-full" viewBox="0 0 1000 800">
          <defs>
            <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} />
              <stop offset="100%" stopColor={secondaryColor} />
            </linearGradient>
          </defs>
          <path d="M100,100 L300,100 L300,200 L500,200 L500,100 L700,100 L700,300 L900,300" stroke="url(#circuitGrad)" strokeWidth="2" fill="none" />
          <path d="M100,400 L250,400 L250,500 L450,500 L450,400 L650,400 L650,600 L900,600" stroke="url(#circuitGrad)" strokeWidth="2" fill="none" />
          <circle cx="300" cy="100" r="6" fill={primaryColor} />
          <circle cx="500" cy="200" r="6" fill={secondaryColor} />
          <circle cx="700" cy="100" r="6" fill={primaryColor} />
          <circle cx="250" cy="400" r="6" fill={secondaryColor} />
          <circle cx="450" cy="500" r="6" fill={primaryColor} />
        </svg>
      </div>
      
      {/* Animated orbs with neon glow on dark backgrounds */}
      <div 
        className="absolute top-20 right-20 w-72 h-72 rounded-full blur-3xl animate-pulse" 
        style={{ 
          background: primaryColor,
          opacity: isDarkBg ? 0.15 : 0.1,
          boxShadow: isDarkBg ? `0 0 80px ${primaryColor}40` : 'none'
        }} 
      />
      <div 
        className="absolute bottom-20 left-20 w-64 h-64 rounded-full blur-3xl animate-pulse" 
        style={{ 
          background: secondaryColor, 
          animationDelay: '1.5s',
          opacity: isDarkBg ? 0.12 : 0.08,
          boxShadow: isDarkBg ? `0 0 60px ${secondaryColor}30` : 'none'
        }} 
      />
      
      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        
        {/* Workflow Automation */}
        {showWorkflowAutomation && (
          <>
            <AnimatedSection>
              <div className="flex items-center gap-4 mb-6">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    boxShadow: isDarkBg 
                      ? `0 15px 40px -10px ${primaryColor}60, 0 0 50px ${primaryColor}30`
                      : `0 15px 40px -10px ${primaryColor}40`
                  }}
                >
                  <Workflow className="w-8 h-8" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                  <div 
                    className="absolute inset-0 rounded-2xl animate-ping" 
                    style={{ 
                      background: primaryColor,
                      opacity: isDarkBg ? 0.25 : 0.2
                    }} 
                  />
                </div>
                <div>
                  <h2 
                    className="text-3xl md:text-4xl font-display font-bold" 
                    style={{ 
                      color: textColor,
                      textShadow: isDarkBg ? `0 0 30px ${primaryColor}20` : 'none'
                    }}
                  >
                    {workflowAutomation?.headline || "Workflow Automation"}
                  </h2>
                  <p className="text-lg" style={{ color: textMutedColor }}>
                    Automate repetitive tasks for {clientName}
                  </p>
                </div>
                <CalloutBadge text="TIME-SAVER" variant="highlight" />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={100}>
              <p className="text-lg mb-10 max-w-3xl leading-relaxed" style={{ color: textMutedColor }}>
                {workflowAutomation?.description || 
                  `We'll set up intelligent automations tailored to ${clientName}'s specific business processes, handling repetitive tasks, nurturing leads, and keeping operations running smoothly around the clock.`}
              </p>
            </AnimatedSection>

            {/* Premium Workflow Cards with 3D Effect - Uses AI-generated or client-contextual workflows */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {(workflowAutomation?.workflows && workflowAutomation.workflows.length > 0 
                ? workflowAutomation.workflows 
                : [
                  {
                    name: `${clientName} Lead Nurture`,
                    trigger: "New inquiry received",
                    actions: [`Send ${clientName} welcome sequence`, "Add to CRM pipeline", "Alert team member", "Schedule follow-up task"],
                    benefit: "Capture every opportunity"
                  },
                  {
                    name: "Appointment Automation",
                    trigger: "Booking confirmed",
                    actions: ["Send confirmation to client", "Add calendar reminder", "Prep service notes", "Send reminder 24hrs before"],
                    benefit: "Reduce no-shows by 60%"
                  },
                  {
                    name: "Re-Engagement Campaign",
                    trigger: `${clientName} customer inactive 7+ days`,
                    actions: ["Send personalized message", "Include tailored offer", "Track engagement", "Escalate if needed"],
                    benefit: "Win back inactive customers"
                  },
                  {
                    name: "Post-Service Follow-Up",
                    trigger: "Service completed",
                    actions: ["Send thank you message", "Request review", "Offer loyalty discount", "Add to retention list"],
                    benefit: "Build repeat business"
                  }
                ]
              ).map((workflow, i) => (
                <AnimatedSection key={i} delay={150 + i * 50}>
                  <div 
                    className="relative p-7 rounded-3xl h-full overflow-hidden group transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                    style={{ 
                      background: `linear-gradient(145deg, color-mix(in srgb, ${cardBackground} 95%, ${primaryColor} 5%), ${cardBackground})`,
                      border: `1px solid color-mix(in srgb, ${borderColor} 50%, ${primaryColor} 10%)`,
                      boxShadow: `0 20px 50px -15px ${primaryColor}15`
                    }}
                  >
                    {/* Top accent glow */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}
                    />
                    <div 
                      className="absolute top-0 left-0 right-0 h-20 opacity-10"
                      style={{ background: `linear-gradient(180deg, ${primaryColor}, transparent)` }}
                    />
                    
                    {/* Hover glow */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `radial-gradient(circle at 50% 0%, ${primaryColor}15, transparent 60%)` }}
                    />
                    
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-5">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                        >
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-lg" style={{ color: textColor }}>{workflow.name}</h3>
                      </div>
                      
                      <div className="mb-5 p-3 rounded-xl" style={{ background: `color-mix(in srgb, ${primaryColor} 8%, transparent)` }}>
                        <p className="text-xs uppercase tracking-wider mb-1 font-medium" style={{ color: primaryColor }}>⚡ Trigger</p>
                        <p className="font-semibold" style={{ color: textColor }}>{workflow.trigger}</p>
                      </div>

                      <div className="space-y-3 mb-5">
                        <p className="text-xs uppercase tracking-wider font-medium" style={{ color: textMutedColor }}>Then automatically:</p>
                        {workflow.actions.map((action, j) => (
                          <div key={j} className="flex items-center gap-3 group/action">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                              style={{ background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` }}
                            >
                              {j + 1}
                            </div>
                            <span className="text-sm" style={{ color: textColor }}>{action}</span>
                          </div>
                        ))}
                      </div>

                      <div 
                        className="px-4 py-3 rounded-xl text-center font-bold"
                        style={{ 
                          background: `linear-gradient(135deg, color-mix(in srgb, ${secondaryColor} 20%, transparent), color-mix(in srgb, ${primaryColor} 15%, transparent))`,
                          color: secondaryColor,
                          border: `1px solid color-mix(in srgb, ${secondaryColor} 30%, transparent)`
                        }}
                      >
                        ✨ {workflow.benefit}
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>

            {/* Integrations */}
            {workflowAutomation?.integrations && workflowAutomation.integrations.length > 0 && (
              <AnimatedSection delay={300}>
                <div 
                  className="p-6 rounded-2xl mb-16"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <h4 className="font-medium mb-4" style={{ color: textColor }}>
                    <Settings className="w-4 h-4 inline mr-2" style={{ color: primaryColor }} />
                    Connected Integrations
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {workflowAutomation.integrations.map((integration, i) => (
                      <span 
                        key={i}
                        className="px-4 py-2 rounded-full text-sm"
                        style={{ 
                          backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
                          color: textColor,
                          border: `1px solid ${borderColor}`
                        }}
                      >
                        {integration}
                      </span>
                    ))}
                  </div>
                </div>
              </AnimatedSection>
            )}
          </>
        )}

        {/* CRM Section */}
        {showCrm && (
          <>
            <AnimatedSection delay={showWorkflowAutomation ? 350 : 0}>
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` }}
                >
                  <Database className="w-6 h-6" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-display font-bold" style={{ color: textColor }}>
                    {crmContent?.headline || "CRM & Lead Management"}
                  </h2>
                  <p style={{ color: textMutedColor }}>
                    Your customer relationships, organized
                  </p>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={showWorkflowAutomation ? 400 : 50}>
              <p className="text-lg mb-8 max-w-3xl" style={{ color: textMutedColor }}>
                {crmContent?.description || 
                  `We'll set up and manage a CRM system that keeps track of every lead, customer interaction, and opportunity - so nothing falls through the cracks.`}
              </p>
            </AnimatedSection>

            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Pipeline Visualization */}
              <AnimatedSection delay={showWorkflowAutomation ? 450 : 100}>
                <div 
                  className="p-6 rounded-2xl h-full"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <h3 className="font-semibold mb-6" style={{ color: textColor }}>
                    <Layers className="w-5 h-5 inline mr-2" style={{ color: primaryColor }} />
                    Sales Pipeline
                  </h3>
                  <div className="space-y-4">
                    {(crmContent?.pipeline && crmContent.pipeline.length > 0 
                      ? crmContent.pipeline 
                      : [
                        { stage: "New Lead", actions: [`Auto-captured from ${clientName}'s forms, ads, and calls`] },
                        { stage: "Qualified", actions: ["AI-scored and assigned to team member"] },
                        { stage: "Proposal Sent", actions: ["Open tracking, automatic follow-ups"] },
                        { stage: "Negotiation", actions: ["Full history: notes, calls, meetings"] },
                        { stage: "Won/Closed", actions: ["Post-sale automation triggered for retention"] }
                      ]
                    ).map((stage, i, arr) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {i + 1}
                          </div>
                          {i < arr.length - 1 && (
                            <div 
                              className="w-0.5 h-8 mt-1"
                              style={{ backgroundColor: borderColor }}
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <h4 className="font-medium" style={{ color: textColor }}>{stage.stage}</h4>
                          <p className="text-sm" style={{ color: textMutedColor }}>
                            {stage.actions.join(' • ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimatedSection>

              {/* CRM Features */}
              <AnimatedSection delay={showWorkflowAutomation ? 500 : 150}>
                <div 
                  className="p-6 rounded-2xl h-full"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <h3 className="font-semibold mb-6" style={{ color: textColor }}>
                    <Target className="w-5 h-5 inline mr-2" style={{ color: secondaryColor }} />
                    CRM Features
                  </h3>
                  <div className="space-y-3">
                    {(crmContent?.features && crmContent.features.length > 0 
                      ? crmContent.features 
                      : [
                        `Automatic lead capture from all ${clientName} touchpoints`,
                        "Complete customer view with full interaction history",
                        "Task management & team member assignments",
                        "Pre-built email & SMS templates for your industry",
                        "Deal tracking with revenue forecasting",
                        `Custom fields tailored to ${clientName}'s workflow`,
                        "Mobile app for on-the-go access",
                        "Seamless integration with your existing tools"
                      ]
                    ).map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: secondaryColor }} />
                        <span className="text-sm" style={{ color: textColor }}>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* AI Capabilities */}
                  {crmContent?.aiCapabilities && (
                    <div 
                      className="mt-6 p-4 rounded-xl"
                      style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)` }}
                    >
                      <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: textColor }}>
                        <RefreshCw className="w-4 h-4" style={{ color: primaryColor }} />
                        Smart Automation Features
                      </h4>
                      <p className="text-sm mb-3" style={{ color: textMutedColor }}>
                        {crmContent.aiCapabilities.description || "Let AI handle the heavy lifting"}
                      </p>
                      <div className="space-y-2">
                        {(crmContent.aiCapabilities.features || [
                          "Lead scoring & prioritization",
                          "Next-best-action suggestions",
                          "Predictive analytics"
                        ]).map((feature, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Zap className="w-3 h-3" style={{ color: primaryColor }} />
                            <span className="text-xs" style={{ color: textColor }}>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AnimatedSection>
            </div>
          </>
        )}

        {/* Text/SMS Marketing */}
        {showTextMarketing && (
          <>
            <AnimatedSection delay={showCrm ? 550 : 0}>
              <div className="flex items-center gap-3 mb-4 mt-8">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                  <Phone className="w-6 h-6" style={{ color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }} />
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-display font-bold" style={{ color: textColor }}>
                    {textMarketingContent?.headline || "SMS & Text Marketing"}
                  </h2>
                  <p style={{ color: textMutedColor }}>
                    Direct connection to your customers
                  </p>
                </div>
                <CalloutBadge text="98% OPEN RATE" variant="highlight" />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={showCrm ? 600 : 50}>
              <p className="text-lg mb-8 max-w-3xl" style={{ color: textMutedColor }}>
                {textMarketingContent?.description || 
                  `Text messages have a 98% open rate vs. 20% for email. We'll create compliant SMS campaigns that drive action and keep ${clientName} top-of-mind.`}
              </p>
            </AnimatedSection>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Campaign Types */}
              <AnimatedSection delay={showCrm ? 650 : 100}>
                <div 
                  className="p-6 rounded-2xl"
                  style={{ 
                    backgroundColor: cardBackground,
                    border: `1px solid ${borderColor}`
                  }}
                >
                  <h3 className="font-semibold mb-6" style={{ color: textColor }}>
                    <MessageSquare className="w-5 h-5 inline mr-2" style={{ color: primaryColor }} />
                    Campaign Types
                  </h3>
                  <div className="space-y-4">
                    {(textMarketingContent?.campaigns && textMarketingContent.campaigns.length > 0 
                      ? textMarketingContent.campaigns 
                      : [
                        { type: `${clientName} Appointment Reminders`, purpose: "Reduce no-shows for your bookings", timing: "24h & 2h before" },
                        { type: "Flash Sales & Promos", purpose: `Drive immediate action for ${clientName}'s offers`, timing: "Strategic timing" },
                        { type: "Follow-Up Sequences", purpose: `Nurture ${clientName}'s leads automatically`, timing: "Automated triggers" },
                        { type: "Review Requests", purpose: `Build ${clientName}'s online reputation`, timing: "Post-service" },
                        { type: "Re-engagement", purpose: "Win back inactive customers", timing: "After 14+ days inactivity" }
                      ]
                    ).map((campaign, i) => (
                      <div 
                        key={i} 
                        className="p-4 rounded-xl"
                        style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 5%, transparent)` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium" style={{ color: textColor }}>{campaign.type}</h4>
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                              color: secondaryColor
                            }}
                          >
                            {campaign.timing}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: textMutedColor }}>{campaign.purpose}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimatedSection>

              {/* Results & Features */}
              <AnimatedSection delay={showCrm ? 700 : 150}>
                <div className="space-y-6">
                  {/* Expected Results */}
                  <div 
                    className="p-6 rounded-2xl"
                    style={{ 
                      backgroundColor: cardBackground,
                      border: `1px solid ${borderColor}`
                    }}
                  >
                    <h3 className="font-semibold mb-4" style={{ color: textColor }}>
                      <BarChart3 className="w-5 h-5 inline mr-2" style={{ color: secondaryColor }} />
                      Expected Results
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                          {textMarketingContent?.expectedResults?.openRate || "98%"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Open Rate</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                          {textMarketingContent?.expectedResults?.responseRate || "45%"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Response Rate</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                          {textMarketingContent?.expectedResults?.conversionRate || "12%"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Conv. Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div 
                    className="p-6 rounded-2xl"
                    style={{ 
                      backgroundColor: cardBackground,
                      border: `1px solid ${borderColor}`
                    }}
                  >
                    <h3 className="font-semibold mb-4" style={{ color: textColor }}>Features</h3>
                    <div className="space-y-2">
                      {(textMarketingContent?.features || [
                        "Two-way conversations",
                        "Personalized merge fields",
                        "Scheduled sends",
                        "Segmented lists",
                        "Auto-responses",
                        "Analytics & tracking"
                      ]).map((feature, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" style={{ color: secondaryColor }} />
                          <span className="text-sm" style={{ color: textColor }}>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Compliance Note */}
                  <div 
                    className="p-4 rounded-xl text-sm"
                    style={{ 
                      backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
                      color: textMutedColor
                    }}
                  >
                    {textMarketingContent?.complianceNote || 
                      "✓ All SMS campaigns are TCPA compliant with proper opt-in/opt-out management"}
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

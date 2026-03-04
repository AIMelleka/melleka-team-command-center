import { Bot, Mic, MessageSquare, Sparkles, Zap, Phone, Clock, Users, CheckCircle2, ArrowRight, PhoneCall, User } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { CalloutBadge } from './ProposalAnnotations';
import { useState } from 'react';
import { LiveChatbotDemo } from './LiveChatbotDemo';
import { isLightColor } from './PlatformLogos';


interface AiSolutionsContent {
  aiVoiceAgent?: {
    headline?: string;
    description?: string;
    features?: string[];
    useCases?: string[];
    availability?: string;
    expectedResults?: {
      callsHandled?: string;
      responseTime?: string;
      customerSatisfaction?: string;
    };
    sampleConversations?: Array<{
      scenario: string;
      conversation: Array<{
        speaker: 'caller' | 'agent';
        text: string;
      }>;
    }>;
  };
  aiChatbot?: {
    headline?: string;
    description?: string;
    features?: string[];
    platforms?: string[];
    responseExamples?: Array<{
      userMessage: string;
      botResponse: string;
    }>;
    expectedResults?: {
      conversationsHandled?: string;
      leadsCaptured?: string;
      responseTime?: string;
    };
    commonQuestions?: string[];
    leadCaptureFlow?: {
      trigger?: string;
      qualification?: string;
      valueOffer?: string;
      handoff?: string;
    };
  };
  aiToolsOnDemand?: {
    description?: string;
    tools?: string[];
    customizations?: string[];
  };
}

interface AiSolutionsSectionProps {
  content: AiSolutionsContent;
  clientName: string;
  clientBusinessContext?: string; // Business description for live chatbot
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  showVoiceAgent?: boolean;
  showChatbot?: boolean;
  showAiTools?: boolean;
}

// Sample Conversations Display Component
const SampleConversationsDisplay = ({
  conversations,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground
}: {
  conversations: Array<{
    scenario: string;
    conversation: Array<{ speaker: 'caller' | 'agent'; text: string }>;
  }>;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
}) => {
  const [activeScenario, setActiveScenario] = useState(0);
  const activeConvo = conversations[activeScenario];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <PhoneCall className="w-5 h-5" style={{ color: primaryColor }} />
        <h4 className="font-medium" style={{ color: textColor }}>
          Sample Phone Scripts
        </h4>
      </div>

      {/* Scenario Tabs */}
      {conversations.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {conversations.map((convo, idx) => (
            <button
              key={idx}
              onClick={() => setActiveScenario(idx)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: activeScenario === idx 
                  ? `color-mix(in srgb, ${primaryColor} 20%, transparent)` 
                  : `color-mix(in srgb, ${textColor} 5%, transparent)`,
                color: activeScenario === idx ? primaryColor : textMutedColor,
                border: activeScenario === idx ? `1px solid ${primaryColor}` : '1px solid transparent'
              }}
            >
              {convo.scenario}
            </button>
          ))}
        </div>
      )}

      {/* Phone Conversation UI */}
      <div 
        className="rounded-xl overflow-hidden"
        style={{ 
          backgroundColor: `color-mix(in srgb, ${primaryColor} 5%, ${cardBackground})`,
          border: `1px solid color-mix(in srgb, ${primaryColor} 20%, transparent)`
        }}
      >
        {/* Phone Header */}
        <div 
          className="px-4 py-3 flex items-center justify-between"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` 
          }}
        >
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">
              {activeConvo?.scenario || "Incoming Call"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80 text-xs">Live</span>
          </div>
        </div>

        {/* Conversation Messages */}
        <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {activeConvo?.conversation.map((msg, idx) => (
            <div 
              key={idx}
              className={`flex items-start gap-3 ${msg.speaker === 'agent' ? 'flex-row-reverse' : ''}`}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ 
                  backgroundColor: msg.speaker === 'agent' 
                    ? `color-mix(in srgb, ${secondaryColor} 20%, transparent)` 
                    : `color-mix(in srgb, ${textColor} 10%, transparent)` 
                }}
              >
                {msg.speaker === 'agent' ? (
                  <Bot className="w-4 h-4" style={{ color: secondaryColor }} />
                ) : (
                  <User className="w-4 h-4" style={{ color: textMutedColor }} />
                )}
              </div>
              <div 
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                  msg.speaker === 'agent' ? 'rounded-tr-sm' : 'rounded-tl-sm'
                }`}
                style={{ 
                  backgroundColor: msg.speaker === 'agent' 
                    ? `color-mix(in srgb, ${secondaryColor} 15%, transparent)` 
                    : `color-mix(in srgb, ${textColor} 8%, transparent)`,
                  color: textColor
                }}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div 
          className="px-4 py-2 flex items-center justify-between text-xs"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, transparent)`,
            borderTop: `1px solid color-mix(in srgb, ${primaryColor} 15%, transparent)`,
            color: textMutedColor
          }}
        >
          <span>AI Voice Agent powered by Melleka Marketing</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            24/7 Availability
          </span>
        </div>
      </div>
    </div>
  );
};

// Chatbot Conversations Display Component
const ChatbotConversationsDisplay = ({
  responseExamples,
  leadCaptureFlow,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  clientName
}: {
  responseExamples: Array<{ userMessage: string; botResponse: string }>;
  leadCaptureFlow?: {
    trigger?: string;
    qualification?: string;
    valueOffer?: string;
    handoff?: string;
  };
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  clientName: string;
}) => {
  const [activeExample, setActiveExample] = useState(0);

  if (!responseExamples || responseExamples.length === 0) {
    return null;
  }

  const exampleLabels = [
    "Service Inquiry",
    "Pricing Question", 
    "Booking Request",
    "FAQ",
    "Recommendations",
    "Urgent Need"
  ];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5" style={{ color: secondaryColor }} />
        <h4 className="font-medium" style={{ color: textColor }}>
          Sample Conversations
        </h4>
      </div>

      {/* Example Tabs */}
      {responseExamples.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {responseExamples.slice(0, 6).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveExample(idx)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: activeExample === idx 
                  ? `color-mix(in srgb, ${secondaryColor} 20%, transparent)` 
                  : `color-mix(in srgb, ${textColor} 5%, transparent)`,
                color: activeExample === idx ? secondaryColor : textMutedColor,
                border: activeExample === idx ? `1px solid ${secondaryColor}` : '1px solid transparent'
              }}
            >
              {exampleLabels[idx] || `Example ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Chat Interface */}
      <div 
        className="rounded-xl overflow-hidden"
        style={{ 
          backgroundColor: `color-mix(in srgb, ${secondaryColor} 5%, ${cardBackground})`,
          border: `1px solid color-mix(in srgb, ${secondaryColor} 20%, transparent)`
        }}
      >
        {/* Chat Header */}
        <div 
          className="px-4 py-3 flex items-center justify-between"
          style={{ 
            background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` 
          }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">
              {clientName} Chat Support
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80 text-xs">Online</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="p-4 space-y-3">
          {responseExamples[activeExample] && (
            <>
              {/* User Message */}
              <div className="flex items-start gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${textColor} 10%, transparent)` }}
                >
                  <User className="w-4 h-4" style={{ color: textMutedColor }} />
                </div>
                <div 
                  className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm"
                  style={{ 
                    backgroundColor: `color-mix(in srgb, ${textColor} 8%, transparent)`,
                    color: textColor
                  }}
                >
                  <p className="text-sm leading-relaxed">{responseExamples[activeExample].userMessage}</p>
                </div>
              </div>

              {/* Bot Response */}
              <div className="flex items-start gap-3 flex-row-reverse">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 20%, transparent)` }}
                >
                  <Bot className="w-4 h-4" style={{ color: secondaryColor }} />
                </div>
                <div 
                  className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm"
                  style={{ 
                    backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                    color: textColor
                  }}
                >
                  <p className="text-sm leading-relaxed">{responseExamples[activeExample].botResponse}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with typing indicator */}
        <div 
          className="px-4 py-2 flex items-center justify-between text-xs"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${secondaryColor} 8%, transparent)`,
            borderTop: `1px solid color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
            color: textMutedColor
          }}
        >
          <span>AI Chat powered by Melleka Marketing</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Instant Responses
          </span>
        </div>
      </div>

      {/* Lead Capture Flow - New section */}
      {leadCaptureFlow && (
        <div 
          className="mt-4 p-4 rounded-xl"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${primaryColor} 15%, transparent)`
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4" style={{ color: primaryColor }} />
            <h5 className="text-sm font-medium" style={{ color: textColor }}>Lead Capture Workflow</h5>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {leadCaptureFlow.trigger && (
              <div className="text-center">
                <div 
                  className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: primaryColor, color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }}
                >1</div>
                <p className="text-xs font-medium" style={{ color: textColor }}>Trigger</p>
                <p className="text-xs mt-0.5" style={{ color: textMutedColor }}>{leadCaptureFlow.trigger}</p>
              </div>
            )}
            {leadCaptureFlow.qualification && (
              <div className="text-center">
                <div 
                  className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: primaryColor, color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }}
                >2</div>
                <p className="text-xs font-medium" style={{ color: textColor }}>Qualify</p>
                <p className="text-xs mt-0.5" style={{ color: textMutedColor }}>{leadCaptureFlow.qualification}</p>
              </div>
            )}
            {leadCaptureFlow.valueOffer && (
              <div className="text-center">
                <div 
                  className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: primaryColor, color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }}
                >3</div>
                <p className="text-xs font-medium" style={{ color: textColor }}>Value Offer</p>
                <p className="text-xs mt-0.5" style={{ color: textMutedColor }}>{leadCaptureFlow.valueOffer}</p>
              </div>
            )}
            {leadCaptureFlow.handoff && (
              <div className="text-center">
                <div 
                  className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: primaryColor, color: isLightColor(primaryColor) ? '#1a1a2e' : 'white' }}
                >4</div>
                <p className="text-xs font-medium" style={{ color: textColor }}>Handoff</p>
                <p className="text-xs mt-0.5" style={{ color: textMutedColor }}>{leadCaptureFlow.handoff}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AiSolutionsSection = ({
  content,
  clientName,
  clientBusinessContext,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  showVoiceAgent = true,
  showChatbot = true,
  showAiTools = false
}: AiSolutionsSectionProps) => {
  const { aiVoiceAgent, aiChatbot, aiToolsOnDemand } = content;

  return (
    <section id="ai-solutions" className="py-24">
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            >
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold" style={{ color: textColor }}>
                AI-Powered Solutions
              </h2>
              <p style={{ color: textMutedColor }}>
                24/7 intelligent automation for {clientName}
              </p>
            </div>
            <CalloutBadge text="INCLUDED" variant="highlight" />
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          {/* AI Voice Agent */}
          {showVoiceAgent && (
            <AnimatedSection delay={100}>
              <div 
                className="p-8 rounded-3xl h-full"
                style={{ 
                  backgroundColor: cardBackground,
                  border: `1px solid ${borderColor}`
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)` }}
                  >
                    <Mic className="w-7 h-7" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                      {aiVoiceAgent?.headline || "AI Voice Agent"}
                    </h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>
                      Never miss a call again
                    </p>
                  </div>
                </div>

                <p className="mb-6" style={{ color: textMutedColor }}>
                  {aiVoiceAgent?.description || 
                    `Our AI Voice Agent handles calls 24/7 for ${clientName}, booking appointments, answering customer questions, and qualifying leads. It speaks naturally and represents your brand professionally, ensuring no opportunity is ever missed.`}
                </p>

                {/* Features - Uses AI-generated or client-contextual features */}
                <div className="space-y-3 mb-6">
                  {(aiVoiceAgent?.features && aiVoiceAgent.features.length > 0 
                    ? aiVoiceAgent.features 
                    : [
                      `24/7 call handling for ${clientName}, never miss a lead`,
                      "Natural conversation flow customized to your brand voice",
                      "Appointment scheduling synced with your calendar",
                      `FAQ responses trained on ${clientName}'s services and offerings`,
                      "Lead qualification with instant CRM integration",
                      "Full call recording & AI transcription for follow-up"
                    ]
                  ).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: secondaryColor }} />
                      <span className="text-sm" style={{ color: textColor }}>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Use Cases */}
                {aiVoiceAgent?.useCases && aiVoiceAgent.useCases.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3" style={{ color: textColor }}>
                      Perfect for:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {aiVoiceAgent.useCases.map((useCase, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 rounded-full text-xs"
                          style={{ 
                            backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
                            color: secondaryColor
                          }}
                        >
                          {useCase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Conversations - Phone Scripts */}
                {aiVoiceAgent?.sampleConversations && aiVoiceAgent.sampleConversations.length > 0 && (
                  <SampleConversationsDisplay 
                    conversations={aiVoiceAgent.sampleConversations}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    textColor={textColor}
                    textMutedColor={textMutedColor}
                    cardBackground={cardBackground}
                  />
                )}

                {/* Expected Results */}
                {aiVoiceAgent?.expectedResults && (
                  <div 
                    className="p-4 rounded-xl mt-4"
                    style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)` }}
                  >
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                          {aiVoiceAgent.expectedResults.callsHandled || "100%"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Calls Handled</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                          {aiVoiceAgent.expectedResults.responseTime || "<3s"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Response Time</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                          {aiVoiceAgent.expectedResults.customerSatisfaction || "95%+"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Satisfaction</p>
                      </div>
                    </div>
                  </div>
                )}

                <div 
                  className="flex items-center gap-2 mt-6 text-sm font-medium"
                  style={{ color: secondaryColor }}
                >
                  <Clock className="w-4 h-4" />
                  <span>{aiVoiceAgent?.availability || "Available 24/7/365"}</span>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* AI Chatbot */}
          {showChatbot && (
            <AnimatedSection delay={200}>
              <div 
                className="p-8 rounded-3xl h-full"
                style={{ 
                  backgroundColor: cardBackground,
                  border: `1px solid ${borderColor}`
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)` }}
                  >
                    <MessageSquare className="w-7 h-7" style={{ color: secondaryColor }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                      {aiChatbot?.headline || "AI Chatbot"}
                    </h3>
                    <p className="text-sm" style={{ color: textMutedColor }}>
                      Instant website support
                    </p>
                  </div>
                </div>

                <p className="mb-6" style={{ color: textMutedColor }}>
                  {aiChatbot?.description || 
                    `Our AI Chatbot engages visitors the moment they land on ${clientName}'s website, answering questions about your products and services, capturing leads, and guiding them toward conversion, all while you focus on running your business.`}
                </p>

                {/* Features - Uses AI-generated or client-contextual features */}
                <div className="space-y-3 mb-6">
                  {(aiChatbot?.features && aiChatbot.features.length > 0 
                    ? aiChatbot.features 
                    : [
                      `Instant responses about ${clientName}'s services and offerings`,
                      "Smart lead capture with qualification questions",
                      "Appointment booking synced with your calendar",
                      `Personalized recommendations based on ${clientName}'s inventory`,
                      "Seamless handoff to human support when needed",
                      "Multi-language support for broader reach"
                    ]
                  ).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
                      <span className="text-sm" style={{ color: textColor }}>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Platforms */}
                {aiChatbot?.platforms && aiChatbot.platforms.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3" style={{ color: textColor }}>
                      Works on:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {aiChatbot.platforms.map((platform, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 rounded-full text-xs"
                          style={{ 
                            backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
                            color: primaryColor
                          }}
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Chatbot Conversations - Now with multiple examples */}
                <ChatbotConversationsDisplay 
                  responseExamples={aiChatbot?.responseExamples || []}
                  leadCaptureFlow={aiChatbot?.leadCaptureFlow}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  textColor={textColor}
                  textMutedColor={textMutedColor}
                  cardBackground={cardBackground}
                  clientName={clientName}
                />

                {/* Expected Results */}
                {aiChatbot?.expectedResults && (
                  <div 
                    className="p-4 rounded-xl mt-4"
                    style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 10%, transparent)` }}
                  >
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: secondaryColor }}>
                          {aiChatbot.expectedResults.conversationsHandled || "500+"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Chats/Month</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{ color: secondaryColor }}>
                          {aiChatbot.expectedResults.leadsCaptured || "30%"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Lead Capture</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{ color: secondaryColor }}>
                          {aiChatbot.expectedResults.responseTime || "<1s"}
                        </p>
                        <p className="text-xs" style={{ color: textMutedColor }}>Response Time</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AnimatedSection>
          )}
        </div>

        {/* Live Chatbot Demo - Full Width */}
        {showChatbot && (
          <AnimatedSection delay={300}>
            <div className="mt-12">
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                    Try It Live
                  </h3>
                  <p className="text-sm" style={{ color: textMutedColor }}>
                    Experience how your AI chatbot will work
                  </p>
                </div>
                <CalloutBadge text="INTERACTIVE DEMO" variant="highlight" />
              </div>
              
              <div className="max-w-2xl mx-auto">
                <LiveChatbotDemo
                  clientName={clientName}
                  clientServices={aiVoiceAgent?.useCases?.slice(0, 5) || aiChatbot?.platforms || []}
                  clientDescription={clientBusinessContext || aiChatbot?.description || ''}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  textColor={textColor}
                  textMutedColor={textMutedColor}
                  cardBackground={cardBackground}
                />
              </div>
              
              <p className="text-center text-sm mt-4 opacity-70" style={{ color: textMutedColor }}>
                💡 This is a real AI: go ahead, ask it anything about {clientName}!
              </p>
            </div>
          </AnimatedSection>
        )}

        {/* AI Tools On Demand */}
        {showAiTools && aiToolsOnDemand && (
          <AnimatedSection delay={300}>
            <div 
              className="p-8 rounded-3xl mt-8"
              style={{ 
                backgroundColor: cardBackground,
                border: `1px solid ${borderColor}`
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6" style={{ color: primaryColor }} />
                <h3 className="text-xl font-display font-semibold" style={{ color: textColor }}>
                  AI Tools On Demand
                </h3>
              </div>
              <p className="mb-6" style={{ color: textMutedColor }}>
                {aiToolsOnDemand.description || 
                  `Access to custom AI tools built specifically for ${clientName}'s needs - from content generation to data analysis.`}
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {(aiToolsOnDemand.tools || []).map((tool, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: secondaryColor }} />
                    <span className="text-sm" style={{ color: textColor }}>{tool}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </section>
  );
};

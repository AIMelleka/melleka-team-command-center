import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert base64 data URL to storage URL
async function persistDataUrlToStorage(
  dataUrl: string,
  supabase: any,
  pathPrefix: string
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  try {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;

    const [, contentType, base64Data] = matches;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.length > 5 * 1024 * 1024) return null;

    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const filename = `${pathPrefix}/logo-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('proposal-assets')
      .upload(filename, bytes.buffer, { contentType, cacheControl: '3600', upsert: true });

    if (error) return null;

    const { data: urlData } = supabase.storage.from('proposal-assets').getPublicUrl(filename);
    console.log(`Logo persisted: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch {
    return null;
  }
}

// Industry benchmarks (2025 WordStream data)
const INDUSTRY_BENCHMARKS: Record<string, any> = {
  "Technology": { facebook: { ctr: 1.04, cpc: 1.27, conversionRate: 2.31, cpa: 55.21 }, meta: { avgCpm: 13.21, avgEngagementRate: 0.9 }, google: { searchCtr: 6.09, searchCpc: 3.80, conversionRate: 2.92 }, seo: { expectedTrafficIncrease: 200 }, email: { openRate: 22.5, clickRate: 2.8, conversionRate: 2.0 }, keywords: ["technology", "tech", "software", "app", "digital", "cloud", "ai", "saas"] },
  "Healthcare & Medical": { facebook: { ctr: 0.83, cpc: 1.32, conversionRate: 11.00, cpa: 12.31 }, meta: { avgCpm: 10.96, avgEngagementRate: 0.8 }, google: { searchCtr: 6.11, searchCpc: 2.62, conversionRate: 3.36 }, seo: { expectedTrafficIncrease: 150 }, email: { openRate: 21.2, clickRate: 2.5, conversionRate: 1.9 }, keywords: ["healthcare", "medical", "doctor", "hospital", "clinic", "health", "patient", "dental", "dentist", "therapy", "wellness"] },
  "Real Estate": { facebook: { ctr: 0.99, cpc: 1.81, conversionRate: 10.68, cpa: 16.92 }, meta: { avgCpm: 17.91, avgEngagementRate: 1.1 }, google: { searchCtr: 7.75, searchCpc: 2.37, conversionRate: 2.47 }, seo: { expectedTrafficIncrease: 170 }, email: { openRate: 20.1, clickRate: 2.2, conversionRate: 1.6 }, keywords: ["real estate", "property", "home", "house", "apartment", "realtor", "mortgage", "buying", "selling"] },
  "Ecommerce & Retail": { facebook: { ctr: 1.59, cpc: 0.70, conversionRate: 9.21, cpa: 7.60 }, meta: { avgCpm: 11.13, avgEngagementRate: 1.5 }, google: { searchCtr: 5.50, searchCpc: 1.16, conversionRate: 2.81 }, seo: { expectedTrafficIncrease: 220 }, email: { openRate: 18.8, clickRate: 2.5, conversionRate: 2.3 }, keywords: ["ecommerce", "shop", "store", "retail", "buy", "product", "online store", "shopping"] },
  "B2B / Business Services": { facebook: { ctr: 0.78, cpc: 2.52, conversionRate: 10.63, cpa: 23.77 }, meta: { avgCpm: 19.66, avgEngagementRate: 0.7 }, google: { searchCtr: 5.17, searchCpc: 3.33, conversionRate: 3.04 }, seo: { expectedTrafficIncrease: 150 }, email: { openRate: 21.8, clickRate: 2.8, conversionRate: 2.1 }, keywords: ["b2b", "business", "enterprise", "corporate", "consulting", "saas", "professional services"] },
  "Legal Services": { facebook: { ctr: 1.61, cpc: 1.32, conversionRate: 5.60, cpa: 28.70 }, meta: { avgCpm: 21.25, avgEngagementRate: 0.6 }, google: { searchCtr: 4.76, searchCpc: 6.75, conversionRate: 6.98 }, seo: { expectedTrafficIncrease: 120 }, email: { openRate: 19.1, clickRate: 2.0, conversionRate: 1.4 }, keywords: ["law", "legal", "attorney", "lawyer", "law firm", "litigation", "defense"] },
  "Finance & Insurance": { facebook: { ctr: 0.56, cpc: 3.77, conversionRate: 9.09, cpa: 41.43 }, meta: { avgCpm: 21.11, avgEngagementRate: 0.5 }, google: { searchCtr: 6.18, searchCpc: 3.44, conversionRate: 5.10 }, seo: { expectedTrafficIncrease: 130 }, email: { openRate: 21.5, clickRate: 2.4, conversionRate: 1.7 }, keywords: ["finance", "insurance", "bank", "loan", "investment", "financial advisor", "accounting"] },
  "Home Services": { facebook: { ctr: 0.70, cpc: 2.93, conversionRate: 10.22, cpa: 28.64 }, meta: { avgCpm: 20.50, avgEngagementRate: 0.9 }, google: { searchCtr: 5.30, searchCpc: 6.55, conversionRate: 10.22 }, seo: { expectedTrafficIncrease: 180 }, email: { openRate: 19.8, clickRate: 2.3, conversionRate: 1.8 }, keywords: ["plumber", "plumbing", "hvac", "electrician", "roofing", "contractor", "home repair", "handyman", "landscaping", "cleaning"] },
  "Restaurants & Food": { facebook: { ctr: 1.20, cpc: 1.20, conversionRate: 5.00, cpa: 24.00 }, meta: { avgCpm: 12.00, avgEngagementRate: 1.8 }, google: { searchCtr: 7.60, searchCpc: 1.95, conversionRate: 4.74 }, seo: { expectedTrafficIncrease: 150 }, email: { openRate: 20.5, clickRate: 2.1, conversionRate: 1.5 }, keywords: ["restaurant", "food", "dining", "catering", "cafe", "bar", "bakery", "delivery"] },
  "Automotive": { facebook: { ctr: 0.80, cpc: 2.24, conversionRate: 5.11, cpa: 43.84 }, meta: { avgCpm: 17.92, avgEngagementRate: 0.7 }, google: { searchCtr: 7.93, searchCpc: 2.46, conversionRate: 6.03 }, seo: { expectedTrafficIncrease: 140 }, email: { openRate: 18.9, clickRate: 2.0, conversionRate: 1.4 }, keywords: ["auto", "car", "automotive", "dealership", "repair", "mechanic", "tires", "detailing"] },
};

const DEFAULT_BENCHMARK = { facebook: { ctr: 0.90, cpc: 1.72, conversionRate: 9.21, cpa: 18.68 }, meta: { avgCpm: 14.40, avgEngagementRate: 1.2 }, google: { searchCtr: 6.11, searchCpc: 2.69, conversionRate: 3.75 }, seo: { expectedTrafficIncrease: 160 }, email: { openRate: 20.5, clickRate: 2.4, conversionRate: 1.8 } };

function detectIndustry(content: string): { industry: string; benchmark: typeof DEFAULT_BENCHMARK } {
  if (!content) return { industry: "General", benchmark: DEFAULT_BENCHMARK };
  const lowerContent = content.toLowerCase();
  let bestMatch = { industry: "General", score: 0, benchmark: DEFAULT_BENCHMARK };
  
  for (const [industry, data] of Object.entries(INDUSTRY_BENCHMARKS)) {
    let score = 0;
    for (const keyword of data.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) score += matches.length * 2;
    }
    if (score > bestMatch.score) {
      bestMatch = { industry, score, benchmark: data };
    }
  }
  return bestMatch.score >= 4 ? bestMatch : { industry: "General", benchmark: DEFAULT_BENCHMARK };
}

// Comprehensive system prompt with anti-generic rules for high-quality personalized output
function buildComprehensiveSystemPrompt(
  clientName: string, 
  industry: string, 
  isWebsiteOnly: boolean, 
  benchmark: any, 
  packageInfo: any, 
  websitePackage: string | null,
  websiteUrl: string | null,
  seoData: any
): string {
  const benchmarkContext = `
INDUSTRY BENCHMARKS (${industry} - 2025 WordStream Data):
- Facebook Ads: CTR ${benchmark.facebook.ctr}%, CPC $${benchmark.facebook.cpc}, Conversion Rate ${benchmark.facebook.conversionRate}%, CPA $${benchmark.facebook.cpa}
- Meta/Instagram: CPM $${benchmark.meta.avgCpm}, Engagement Rate ${benchmark.meta.avgEngagementRate}%
- Google Ads: Search CTR ${benchmark.google.searchCtr}%, Search CPC $${benchmark.google.searchCpc}, Conversion Rate ${benchmark.google.conversionRate}%
- SEO: Expected Traffic Increase +${benchmark.seo.expectedTrafficIncrease}% over 12 months
- Email Marketing: Open Rate ${benchmark.email.openRate}%, Click Rate ${benchmark.email.clickRate}%, Conversion ${benchmark.email.conversionRate}%`;

  const seoContext = seoData ? `
CURRENT SEO METRICS:
- Organic Keywords: ${seoData.organicKeywords || 0}
- Monthly Organic Traffic: ${seoData.organicTraffic || 0}
- Domain Authority: ${seoData.domainAuthority || 0}
- Backlinks: ${seoData.backlinks || 0}
- Top Keywords: ${(seoData.topKeywords || []).slice(0, 5).map((k: any) => k.keyword || k).join(', ')}
- Competitors: ${(seoData.competitors || []).slice(0, 3).join(', ')}` : '';

  const antiGenericRules = `
=== ANTI-GENERIC CONTENT RULES (CRITICAL) ===
You MUST follow these rules to ensure a deeply personalized, professional proposal:

1. NEVER use placeholder text like "[Service Name]", "[City]", or "[Industry]" - use ACTUAL names from the website content
2. NEVER use generic phrases like "grow your business", "increase conversions", "quality service" without specifics
3. EVERY ad headline and description MUST reference specific services, products, or locations from the website
4. ALL keyword recommendations must be REAL, searchable keywords with realistic monthly search volumes
5. Content strategy topics MUST be specific to THIS client's actual offerings
6. AI voice agent scripts MUST reference THIS client's actual FAQs, services, and booking processes
7. Automation workflows MUST be tailored to THIS client's customer journey
8. ALL projections must use the industry benchmarks provided, not made-up numbers
9. CTA sections must use the actual client name and specific next steps
10. NEVER use em dashes (—) anywhere in the content. Use commas, colons, periods, or hyphens instead.

QUALITY REQUIREMENTS:
- Google Ads headlines: Max 30 characters, include specific service names, location keywords
- Google Ads descriptions: Max 90 characters, include value propositions from their website
- Meta ad copy: Write as if you're their marketing director - authentic, benefit-focused, scroll-stopping
- Keywords: Include "[service] in [city]", "[service] near me", competitor brand + service combos
- Blog topics: Must be topics this specific business could write about authentically
- Voice agent scripts: Include real objection handling based on their industry and services

EXAMPLES OF BAD (GENERIC) vs GOOD (PERSONALIZED):
❌ "Quality [Service] You Can Trust" → ✅ "24/7 Emergency Plumbing Los Angeles"
❌ "Get More Leads Today" → ✅ "Free Roof Inspection - Same Day Estimate"
❌ "[Company] Services" → ✅ "Smile Dental Family Dentistry"
❌ "Increase your conversions" → ✅ "3x more booked consultations with AI follow-up"
`;

  if (isWebsiteOnly) {
    return `You are a senior web strategist and UX designer at Melleka Marketing, creating a premium website design proposal for ${clientName}.

${antiGenericRules}

${benchmarkContext}
${seoContext}

WEBSITE PACKAGE: ${websitePackage === 'website-basic' ? 'Starter ($2,900) - 15 custom pages' : websitePackage === 'website-premium' ? 'Premium ($3,999) - 20 custom pages with advanced features' : 'Ultra ($5,999) - 25+ pages, custom integrations, advanced functionality'}
WEBSITE URL: ${websiteUrl || 'New website'}

OUTPUT REQUIREMENTS:
Generate a comprehensive JSON proposal with these deeply personalized sections:

{
  "title": "Custom website title for ${clientName}",
  "hero": {
    "headline": "Compelling headline specific to their business transformation",
    "subheadline": "Benefit-focused subheadline mentioning their industry",
    "stats": [{"value": "...", "label": "..."}], // 3 relevant stats
    "clientLogo": "" // Will be populated from branding
  },
  "websiteDesign": {
    "headline": "Section headline",
    "description": "Why they need this website, referencing their specific situation",
    "designApproach": {
      "philosophy": "Design philosophy tailored to their brand and audience",
      "steps": [{"title": "...", "description": "..."}] // 4 detailed steps
    },
    "pages": [{"name": "...", "description": "...", "priority": "high|medium"}], // 6-8 specific pages for THIS business
    "features": [{"name": "...", "description": "...", "included": true}], // 8-10 features
    "techStack": ["Technologies that make sense for their needs"],
    "timeline": {"discovery": "...", "design": "...", "development": "...", "launch": "...", "total": "..."},
    "deliverables": ["Specific deliverables"]
  },
  "seoStrategy": {
    "headline": "SEO Strategy for ${clientName}",
    "onPageSeo": ["Title tag optimization for [their specific service pages]", "Meta descriptions with [their service + city]", "Header hierarchy using [their actual service names]", "Image alt tags for [their products/services]"],
    "targetKeywords": [
      {"keyword": "SPECIFIC keyword from their business like 'commercial roof repair dallas'", "volume": "realistic monthly searches like 880", "difficulty": "Low|Medium|High"}
    ], // 8-10 REAL keywords based on their ACTUAL services and location - NO generic placeholders
    "technicalSeo": ["Site speed optimization", "Mobile responsiveness", "Schema markup for [their business type]", "XML sitemap", "Core Web Vitals"]
  },
  "automationWorkflows": {
    "headline": "Automation section headline",
    "description": "Why automation matters for their business type",
    "workflows": [{"name": "...", "trigger": "...", "actions": [...], "benefit": "..."}] // 3-4 workflows
  },
  "blogContent": {
    "headline": "Content section headline",
    "description": "Content strategy rationale",
    "topics": [{"title": "...", "category": "...", "targetKeyword": "...", "purpose": "..."}] // 4-6 specific topics
  },
  "timeline": {
    "duration": "Total project duration",
    "milestones": [{"phase": "...", "duration": "...", "deliverables": [...]}]
  },
  "whyMelleka": {
    "headline": "Why choose us",
    "points": [{"title": "...", "description": "..."}] // 4 compelling reasons
  },
  "cta": {
    "headline": "Action headline with ${clientName}",
    "subheadline": "Benefit statement - NO mention of contracts/agreements (we are month-to-month)",
    "nextSteps": ["Book a discovery call", "Select your package", "Get started"]
  },
  "brandStyles": {} // Will be populated from branding data
}`;
  }

  // Marketing proposal prompt
  const monthlyBudget = packageInfo?.monthlyPrice || 4000;
  
  return `You are a senior digital marketing strategist and CMO-level consultant at Melleka Marketing. You are creating a comprehensive, data-driven marketing proposal for ${clientName}.

${antiGenericRules}

${benchmarkContext}
${seoContext}

PACKAGE: ${packageInfo?.name || 'Custom'} - $${monthlyBudget.toLocaleString()}/month
- Channels: ${packageInfo?.channels || '4'}
- Task Turnaround: ${packageInfo?.turnaround || '2-3 days'}
- Included Services: ${packageInfo?.includedServices?.join(', ') || 'Full-service marketing'}
WEBSITE URL: ${websiteUrl || 'N/A'}

AD BUDGET STRATEGY (CRITICAL):
- Start at $5/day per ad or ad set
- Scale 20-30% every 3-4 days ONLY after proving conversions
- Never recommend large upfront ad budgets without proven performance

OUTPUT REQUIREMENTS:
Generate a comprehensive JSON proposal. Every section MUST be deeply personalized to ${clientName}:

{
  "title": "Strategic proposal title for ${clientName}",
  "hero": {
    "headline": "Compelling, specific headline for their business",
    "subheadline": "Benefit-focused subheadline with industry context",
    "stats": [{"value": "...", "label": "..."}], // 3-4 stats relevant to proposal
    "clientLogo": ""
  },
  "businessAudit": {
    "currentStrengths": ["3-5 specific strengths from their website"],
    "improvementOpportunities": ["4-6 specific issues found on their site"],
    "competitiveGaps": ["3-4 gaps vs competitors in their market"],
    "quickWins": ["3-5 immediate actions that would help them"]
  },
  "executiveSummary": {
    "intro": "Opening paragraph about their specific situation",
    "objectives": ["3-4 measurable objectives"],
    "approach": "Our strategic approach for their business",
    "expectedOutcomes": "Specific outcomes with benchmark data",
    "investmentOverview": "Investment summary with ROI context"
  },
  "adCopyRecommendations": {
    "googleAdsHeadlines": ["5 headlines, max 30 chars each, using THEIR services"],
    "googleAdsDescriptions": ["3 descriptions, max 90 chars, with their value props"],
    "metaAdPrimaryText": ["3 scroll-stopping primary texts for Meta ads"],
    "metaAdHeadlines": ["5 Meta ad headlines that reference their offerings"],
    "callToActions": ["5 CTAs specific to their conversion goals"],
    "hooks": ["5 attention hooks for social ads based on their audience pain points"]
  },
  "keywordStrategy": {
    "primaryKeywords": [
      {"keyword": "EXACT service keyword from their website (e.g., 'commercial HVAC repair' not 'HVAC')", "intent": "Commercial|Transactional|Informational", "priority": "High|Medium", "monthlySearches": "realistic number like 1,200"}
    ], // 5 PRIMARY keywords - MUST be specific to THIS client's actual services, not generic industry terms
    "longTailKeywords": [
      {"keyword": "4-6 word specific phrase like 'emergency plumber near me open now'", "intent": "Transactional", "priority": "High", "monthlySearches": "realistic number"}
    ], // 5 LONG-TAIL keywords - highly specific, lower competition phrases
    "localKeywords": [
      "${clientName} + location keywords: '[specific service] in [their actual city]', '[service] near [neighborhood]' - use REAL location from their website"
    ], // 8-10 local keywords with ACTUAL city/region names
    "negativeKeywords": ["jobs", "careers", "salary", "DIY", "free", "cheap", "training", "certification", "course", "how to become", "near me hiring", "internship", "resume", "interview"], // 15+ negative keywords to exclude job seekers and irrelevant traffic
    "keywordGaps": [
      "5 competitor gap opportunities: 'best [their service] companies', '[service] vs [competitor service]', 'top rated [service] [city]', '[service] cost calculator', 'affordable [secondary service]'"
    ] // Keywords competitors rank for that THIS client should target
  },
  "audienceStrategy": {
    "primaryPersona": {
      "name": "Vivid persona name based on their ideal customer (e.g., 'Stressed Homeowner Sarah', 'Busy Professional Dad Mike')",
      "demographics": "Specific age range, income bracket, location type, family status, job title/industry",
      "psychographics": "Their mindset, values, lifestyle, what they care about most - write as a 1-2 sentence quote from their perspective",
      "painPoints": ["4-5 SPECIFIC pain points this persona experiences related to this business's services - be detailed and emotional"],
      "triggers": ["4-5 specific events or situations that trigger them to search for this service (e.g., 'AC breaks down during heatwave', 'Noticed competitor's new website')"],
      "objections": ["4-5 specific objections they have before purchasing - what makes them hesitate?"]
    },
    "secondaryPersona": {
      "name": "Secondary persona name (different demographic than primary)",
      "demographics": "Different age/income/situation than primary",
      "psychographics": "Their unique perspective and values",
      "painPoints": ["3-4 pain points specific to this persona"],
      "triggers": ["3-4 specific events that trigger this persona to seek these services - different from primary persona"],
      "objections": ["3-4 specific objections this persona has - may differ from primary based on their circumstances"]
    },
    "metaTargeting": {
      "interests": ["8-12 specific Facebook/Instagram interests for targeting - be specific like 'Home Depot' not just 'home improvement'"],
      "behaviors": ["6-8 specific behaviors like 'Recent homebuyers', 'Engaged shoppers', 'Small business owners'"],
      "customAudiences": ["4-5 custom audience ideas: 'Website visitors last 30 days', 'Email list', 'Video viewers 50%+'"],
      "lookalikeStrategy": "Detailed strategy for lookalike audiences - which source, what percentage, how to layer"
    },
    "googleAudiences": {
      "inMarket": ["6-8 specific Google in-market audiences relevant to this business"],
      "affinity": ["6-8 Google affinity audiences that match the target personas"],
      "customIntent": ["8-10 custom intent keywords for Google display/YouTube targeting"]
    }
  },
  "contentStrategy": {
    "headline": "Content strategy headline",
    "themes": ["3-4 content themes aligned to their brand"],
    "blogTopics": [{"title": "...", "category": "...", "targetKeyword": "...", "purpose": "..."}] // 6 topics
  },
  "servicesOverview": {
    "headline": "Services overview headline",
    "services": [{"name": "...", "description": "...", "icon": "..."}] // 4-6 core services we'll provide
  },
  "phasedApproach": {
    "phases": [
      {"name": "Phase name", "duration": "Timeline", "activities": ["Specific activities"], "deliverables": ["Deliverables"]},
      // 4 phases total
    ]
  },
  "googleAds": {
    "headline": "Google Ads section headline",
    "campaignTypes": ["Campaign types with explanations"],
    "budgetStrategy": {
      "startingBudget": "$5/day per ad, scaling after conversions",
      "scalingApproach": "Detailed scaling methodology",
      "expectedResults": {"ctr": "X%", "cpc": "$X.XX", "conversionRate": "X%", "monthlyLeads": "XX-XX"}
    },
    "keywordTargeting": "Keyword strategy summary",
    "adExtensions": ["Extensions to use"]
  },
  "metaAds": {
    "headline": "Meta Ads section headline",
    "campaignTypes": ["Awareness", "Consideration", "Conversion with explanations"],
    "creativeApproach": "Creative strategy for their audience",
    "audienceStrategy": "Targeting approach",
    "budgetStrategy": {
      "startingBudget": "$5/day per ad set",
      "scalingApproach": "How we scale winners",
      "expectedResults": {"ctr": "X%", "cpm": "$XX", "conversionRate": "X%"}
    }
  },
  "expectedResults": {
    "metrics": [{"name": "Metric", "value": "Value", "description": "Context"}], // 6 key metrics
    "monthlyBreakdown": [
      {"month": 1, "focus": "Focus area", "expectedLeads": "XX-XX", "activities": ["Activities"]},
      {"month": 3, "focus": "Focus area", "expectedLeads": "XX-XX", "activities": ["Activities"]},
      {"month": 6, "focus": "Focus area", "expectedLeads": "XX-XX", "activities": ["Activities"]}
    ],
    "quarterlyGoals": [{"quarter": "Q1", "goals": ["Goal 1", "Goal 2"]}]
  },
  "aiSolutions": {
    "voiceAgent": {
      "headline": "AI Voice Agent headline",
      "description": "How it helps THIS specific business",
      "features": ["4-6 features relevant to their operations"],
      "scripts": [
        {"scenario": "Inbound Inquiry", "sample": "Full script with their services"},
        {"scenario": "Support Call", "sample": "Script handling their common questions"},
        {"scenario": "Appointment Rescheduling", "sample": "Script for their booking process"},
        {"scenario": "Pricing Questions", "sample": "Script with their actual price handling"},
        {"scenario": "After-Hours Follow-up", "sample": "After-hours script"}
      ]
    },
    "aiChatbot": {
      "headline": "AI Chatbot headline",
      "description": "Chatbot purpose for their website",
      "features": ["6 chatbot features"],
      "scenarios": [
        {"name": "Welcome Flow", "description": "How chatbot greets their visitors"},
        {"name": "Service Inquiry", "description": "Handling service questions"},
        {"name": "Lead Qualification", "description": "Qualifying leads for their sales"},
        {"name": "Booking", "description": "Appointment booking flow"},
        {"name": "FAQ", "description": "Answering their common questions"},
        {"name": "Handoff", "description": "Escalation to human"}
      ]
    },
    "leadCaptureWorkflow": {
      "steps": [
        {"step": "Trigger", "description": "What initiates the flow"},
        {"step": "Qualify", "description": "How leads are qualified"},
        {"step": "Offer", "description": "What offer is presented"},
        {"step": "Handoff", "description": "How leads are routed"}
      ]
    }
  },
  "automationWorkflows": {
    "headline": "Automation section headline",
    "description": "Why automation matters for them",
    "workflows": [
      {"name": "Workflow name", "trigger": "Trigger event", "actions": ["Action 1", "Action 2", "Action 3"], "benefit": "Specific benefit"},
      // 4 workflows total
    ],
    "integrations": ["Relevant integrations"]
  },
  "crmManagement": {
    "headline": "CRM headline",
    "description": "CRM value for their business",
    "features": ["6 CRM features"],
    "pipeline": [
      {"stage": "Stage name", "actions": ["Automated actions"]},
      // 4-5 pipeline stages
    ]
  },
  "textMarketing": {
    "headline": "SMS Marketing headline",
    "description": "SMS strategy for their customer type",
    "campaigns": [
      {"type": "Appointment Reminder", "purpose": "Reduce no-shows", "timing": "24h before appointment", "sampleMessage": "Personalized reminder text"},
      {"type": "Follow-Up", "purpose": "Post-visit engagement", "timing": "1-2 days after service", "sampleMessage": "Thank you and feedback request"},
      {"type": "Special Offer", "purpose": "Drive promotions", "timing": "Strategic timing", "sampleMessage": "Limited time offer text"},
      {"type": "Re-engagement", "purpose": "Win back inactive customers", "timing": "30+ days inactive", "sampleMessage": "We miss you text"}
    ],
    "features": ["SMS features"],
    "expectedResults": {"openRate": "98%", "responseRate": "XX%", "conversionRate": "XX%"}
  },
  "email": {
    "strategy": "Email marketing strategy description specific to their business model and customer journey",
    "campaigns": [
      {
        "type": "welcome",
        "subject": "Subject line specific to their service - include emoji if appropriate",
        "preheader": "Preview text that teases the email content",
        "headline": "Email headline inside the email",
        "bodyPreview": "2-3 sentence email body preview about their specific service/product",
        "ctaText": "CTA button text specific to their conversion goal"
      },
      {
        "type": "nurture",
        "subject": "Educational subject line about their industry topic",
        "preheader": "Preview text highlighting value",
        "headline": "Educational content headline",
        "bodyPreview": "Preview of educational content specific to their industry",
        "ctaText": "CTA for continued engagement"
      },
      {
        "type": "promo",
        "subject": "Promotional subject line with their actual service/product",
        "preheader": "Urgency-focused preview text",
        "headline": "Promotional offer headline",
        "bodyPreview": "Promo details specific to their offerings",
        "ctaText": "Promotional CTA"
      },
      {
        "type": "cart",
        "subject": "Recovery subject line for their specific service type",
        "preheader": "Reminder preview text",
        "headline": "Recovery headline",
        "bodyPreview": "Personalized recovery message for their business type",
        "ctaText": "Recovery CTA"
      }
    ],
    "flows": [
      {"name": "Welcome Series", "emails": 5, "purpose": "Onboard new ${clientName} subscribers and introduce your core offerings"},
      {"name": "Lead Nurture Sequence", "emails": 8, "purpose": "Educate prospects about your services and build trust through valuable content"},
      {"name": "Re-engagement Campaign", "emails": 4, "purpose": "Win back inactive contacts with special offers and updates"},
      {"name": "Upsell & Cross-sell", "emails": 3, "purpose": "Introduce complementary services to existing customers"}
    ],
    "expectedResults": {"openRate": "XX%", "ctr": "XX%", "revenue": "XX% of total"}
  },
  "reputationManagement": {
    "headline": "Reputation Management for ${clientName}",
    "description": "Why reputation matters for their specific industry",
    "platforms": [
      {"name": "Platform name relevant to their industry", "rating": 4.5, "reviews": 50, "description": "Platform purpose"}
    ],
    "services": [
      {"title": "Service name", "description": "How this service helps their specific business", "stats": "Metric"}
    ],
    "sentimentData": [
      {"name": "Positive", "value": 75, "color": "#22C55E"},
      {"name": "Neutral", "value": 18, "color": "#F59E0B"},
      {"name": "Negative", "value": 7, "color": "#EF4444"}
    ],
    "monitoringThemes": ["5-6 themes specific to their industry - what customers review about"]
  },
  "influencerMarketing": {
    "headline": "Influencer Strategy for ${clientName}",
    "description": "Why influencer marketing works for their industry and audience",
    "tiers": [
      {
        "tier": "Tier name relevant to their industry",
        "followers": "Follower range",
        "examples": ["3 specific influencer types for their niche"],
        "benefits": ["3 benefits specific to their goals"],
        "engagement": "X.X%",
        "cpm": "$XX-XX",
        "recommended": true
      }
    ],
    "campaignTypes": [
      {"title": "Campaign type", "description": "Description for their industry", "metrics": "Expected metric"}
    ],
    "sampleInfluencers": [
      {"name": "Influencer type name", "handle": "@handle", "platform": "Platform", "followers": "XX K", "focus": "Their niche focus", "engagement": "X.X%"}
    ]
  },
  "tvAds": {
    "headline": "Television & CTV Advertising",
    "description": "How TV/CTV helps reach their specific target audience",
    "services": ["6 TV ad services relevant to their business goals"],
    "stats": [
      {"value": "500K+", "label": "Household Reach"},
      {"value": "2-4x", "label": "Brand Recall"},
      {"value": "15-60s", "label": "Spot Lengths"},
      {"value": "CTV+", "label": "Streaming Included"}
    ]
  },
  "mellekaApp": {
    "sampleMessages": [
      {"initials": "XX", "name": "Sample customer name", "channel": "email", "message": "Realistic inquiry about their specific services", "time": "3h"},
      {"initials": "XX", "name": "Another customer", "channel": "instagram", "message": "Instagram message about their offerings", "time": "4h"},
      {"initials": "XX", "name": "Third customer", "channel": "chat", "message": "Live chat message asking about their specific service", "time": "1d"}
    ]
  },
  "websiteDesign": {
    "headline": "Website section headline",
    "description": "Website needs assessment",
    "pages": [{"name": "Page", "description": "Purpose"}],
    "features": [{"name": "Feature", "description": "Why it matters", "included": true}],
    "timeline": {"total": "Timeline"}
  },
  "budget": {
    "total": "Annual investment",
    "breakdown": [{"category": "Category", "amount": "$X,XXX", "percentage": XX}],
    "roiProjections": {"expectedRevenue": "$XXX,XXX", "roas": "X.Xx"}
  },
  "timeline": {
    "duration": "Total engagement period",
    "phases": [{"name": "Phase", "duration": "Duration", "milestones": ["Milestone"]}],
    "keyDates": ["Date: What happens"]
  },
  "whyMelleka": {
    "headline": "Why Melleka for ${clientName}",
    "points": [{"title": "Point", "description": "Explanation"}] // 4-5 points
  },
  "cta": {
    "headline": "CTA headline with ${clientName}",
    "subheadline": "Benefit statement - NO mention of contracts/agreements (we are month-to-month)",
    "nextSteps": ["Book a discovery call", "Select your package", "Begin onboarding & launch in 2-3 days"],
    "contact": {"name": "Melleka Marketing", "email": "hello@melleka.com", "phone": "(818) 599-2696", "website": "melleka.com"}
  },
  "brandStyles": {} // Populated from branding data
}

CRITICAL: Take your time. Think deeply about THIS specific business. Every section should read as if you've been their marketing consultant for months and intimately understand their business, customers, and competitive landscape. Quality over speed.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin authentication
  const authResult = await requireAdminAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { 
      clientName, projectDescription, selectedPackage, selectedWebsitePackage,
      isWebsiteOnlyProposal, budgetRange, timeline, websiteUrl, branding, 
      websiteContent, seoData, portfolioWebsites, screenshots, services
    } = await req.json();
    
    // AI generation uses the shared Claude helper (ANTHROPIC_API_KEY checked inside callClaude)

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

    // Persist logo
    let persistedLogoUrl = branding?.logo || null;
    if (branding?.logo?.startsWith('data:') && supabase) {
      const domain = websiteUrl ? new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '').replace(/[^a-z0-9]/gi, '-') : 'upload';
      persistedLogoUrl = await persistDataUrlToStorage(branding.logo, supabase, `logos/${domain}`) || persistedLogoUrl;
    }

    const processedBranding = branding ? { ...branding, logo: persistedLogoUrl } : null;
    
    // Detect industry with enhanced content analysis
    const fullContent = [websiteContent, projectDescription, clientName].filter(Boolean).join(' ');
    const { industry: detectedIndustry, benchmark } = detectIndustry(fullContent);
    
    console.log(`Generating QUALITY proposal for: ${clientName}, Industry: ${detectedIndustry}, Package: ${selectedPackage?.name || selectedWebsitePackage}`);

    const monthlyBudget = selectedPackage?.monthlyPrice || 4000;
    const annualBudget = monthlyBudget * 12;

    // Build comprehensive prompt with full context (2500+ chars for quality)
    const systemPrompt = buildComprehensiveSystemPrompt(
      clientName, 
      detectedIndustry, 
      isWebsiteOnlyProposal, 
      benchmark, 
      selectedPackage, 
      selectedWebsitePackage,
      websiteUrl,
      seoData
    );
    
    // Provide generous context - more context = better personalization
    const trimmedContent = websiteContent ? websiteContent.substring(0, 3000) : "";
    
    const userPrompt = `Create a comprehensive, deeply personalized proposal for ${clientName}.

=== CLIENT INFORMATION ===
Business Name: ${clientName}
Website URL: ${websiteUrl || "New website / Not provided"}
Project Description: ${projectDescription || "General marketing services needed"}

=== WEBSITE CONTENT (Use this to personalize EVERYTHING) ===
${trimmedContent || "No website content available - use the project description and business name to infer services and create plausible personalized content."}

=== CURRENT SEO PERFORMANCE ===
${seoData ? `
- Organic Keywords Ranking: ${seoData.organicKeywords || 0}
- Monthly Organic Traffic: ${seoData.organicTraffic || 0}
- Domain Authority Score: ${seoData.domainAuthority || 0}
- Backlink Profile: ${seoData.backlinks || 0} backlinks
- Top Performing Keywords: ${(seoData.topKeywords || []).slice(0, 8).map((k: any) => typeof k === 'string' ? k : k.keyword).join(', ')}
- Main Competitors: ${(seoData.competitors || []).slice(0, 5).join(', ')}
` : "No SEO data available - recommend baseline audit."}

=== BRANDING ===
${processedBranding?.colors?.primary ? `Primary Brand Color: ${processedBranding.colors.primary}` : "No brand colors detected - suggest professional palette"}
${processedBranding?.colors?.secondary ? `Secondary Color: ${processedBranding.colors.secondary}` : ""}

=== PORTFOLIO/REFERENCE WEBSITES ===
${portfolioWebsites?.length > 0 ? `Client likes these website styles: ${portfolioWebsites.join(', ')}` : "No reference websites provided"}

=== INSTRUCTIONS ===
1. Read ALL the website content carefully to understand their ACTUAL services, products, and value propositions
2. Generate ad copy that uses their REAL service names and locations
3. Create keyword strategies with REALISTIC search volumes for their market
4. Write AI voice agent scripts that reference their ACTUAL FAQs and booking process
5. Design automation workflows specific to their CUSTOMER JOURNEY
6. Use the industry benchmarks provided for ALL projections - don't make up numbers

Output ONLY valid JSON matching the schema in your instructions. No markdown, no explanations - just the JSON object.`;

    // Use Claude Sonnet 4.6 for highest quality reasoning and personalization
    try {
      console.log("Calling Claude Sonnet 4.6 for maximum quality proposal generation...");

      const content = await callClaude(userPrompt, {
        system: systemPrompt,
        maxTokens: 16384,
        temperature: 0.7,
      });

      if (!content) {
        throw new Error("AI returned empty response");
      }

      console.log("AI response received, parsing JSON...");

      // Robust JSON parsing with multiple fallback strategies
      let proposalContent;
      try {
        let jsonString = content;
        
        // Remove markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1];
        }
        
        // Clean up the string
        jsonString = jsonString.trim();
        
        // Find the JSON object boundaries
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
        
        // Fix common JSON issues
        jsonString = jsonString
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
          .replace(/\n\s*\n/g, '\n'); // Remove excessive newlines
        
        proposalContent = JSON.parse(jsonString);
        console.log("JSON parsed successfully");
        
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.log("Raw content preview:", content.substring(0, 500));
        
        // Try one more time with aggressive cleaning
        try {
          let cleaned = content
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .replace(/^[^{]*/, '')
            .replace(/[^}]*$/, '')
            .trim();
          
          // Attempt to fix truncated JSON by closing brackets
          let openBraces = (cleaned.match(/{/g) || []).length;
          let closeBraces = (cleaned.match(/}/g) || []).length;
          let openBrackets = (cleaned.match(/\[/g) || []).length;
          let closeBrackets = (cleaned.match(/]/g) || []).length;
          
          while (closeBrackets < openBrackets) {
            cleaned += ']';
            closeBrackets++;
          }
          while (closeBraces < openBraces) {
            cleaned += '}';
            closeBraces++;
          }
          
          proposalContent = JSON.parse(cleaned);
          console.log("JSON parsed with aggressive cleaning");
        } catch (e) {
          console.error("All parsing attempts failed");
          proposalContent = { parseError: true, rawContent: content.substring(0, 2000) };
        }
      }

      // Apply intelligent defaults for any missing sections
      applyDefaults(proposalContent, clientName, detectedIndustry, benchmark, selectedPackage, processedBranding, persistedLogoUrl, monthlyBudget, annualBudget, timeline, isWebsiteOnlyProposal, services);

      // Add metadata and context
      if (seoData) {
        proposalContent.currentState = {
          seoMetrics: { 
            keywords: seoData.organicKeywords?.toLocaleString() || "0", 
            traffic: seoData.organicTraffic?.toLocaleString() || "0", 
            domainAuthority: seoData.domainAuthority?.toString() || "0", 
            backlinks: seoData.backlinks?.toLocaleString() || "0" 
          },
          topKeywords: seoData.topKeywords || [],
          competitors: seoData.competitors || [],
          domain: seoData.domain,
        };
      }
      
      if (websiteUrl) proposalContent.websiteUrl = websiteUrl;
      if (screenshots?.length > 0) proposalContent.screenshots = screenshots;
      
      proposalContent.detectedIndustry = detectedIndustry;
      proposalContent.industryBenchmarks = {
        industry: detectedIndustry,
        facebook: { 
          expectedCtr: `${benchmark.facebook.ctr}%`, 
          expectedCpc: `$${benchmark.facebook.cpc.toFixed(2)}`, 
          expectedConversionRate: `${benchmark.facebook.conversionRate}%`, 
          expectedCpa: `$${benchmark.facebook.cpa.toFixed(2)}` 
        },
        meta: { 
          expectedCpm: `$${benchmark.meta.avgCpm.toFixed(2)}`, 
          expectedEngagement: `${benchmark.meta.avgEngagementRate}%` 
        },
        google: { 
          expectedSearchCtr: `${benchmark.google.searchCtr}%`, 
          expectedSearchCpc: `$${benchmark.google.searchCpc.toFixed(2)}`, 
          expectedConversionRate: `${benchmark.google.conversionRate}%` 
        },
        seo: { 
          expectedTrafficIncrease: `+${benchmark.seo.expectedTrafficIncrease}%` 
        },
        email: { 
          expectedOpenRate: `${benchmark.email.openRate}%`, 
          expectedClickRate: `${benchmark.email.clickRate}%`, 
          expectedConversionRate: `${benchmark.email.conversionRate}%` 
        },
      };

      console.log("Proposal generated successfully with quality model");
      return new Response(JSON.stringify({ proposal: proposalContent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (fetchError) {
      throw fetchError;
    }

  } catch (error) {
    console.error("Generate proposal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Apply intelligent defaults for missing sections
function applyDefaults(content: any, clientName: string, industry: string, benchmark: any, pkg: any, branding: any, logoUrl: string, monthlyBudget: number, annualBudget: number, timeline: string, isWebsiteOnly: boolean, clientServices?: string[]) {
  if (!content.title) content.title = `Custom Growth Blueprint: ${clientName}`;
  
  if (!content.hero?.headline) {
    content.hero = {
      headline: `Strategic Digital Growth Plan for ${clientName}`,
      subheadline: `A comprehensive ${industry} marketing strategy designed to maximize your ROI`,
      stats: [
        { value: `$${monthlyBudget.toLocaleString()}`, label: "Monthly Investment" },
        { value: pkg?.channels || "4", label: "Marketing Channels" },
        { value: pkg?.turnaround || "2-3 Days", label: "Task Turnaround" }
      ],
      clientLogo: logoUrl || ""
    };
  }

  if (!content.businessAudit?.currentStrengths) {
    content.businessAudit = {
      currentStrengths: ["Established online presence", "Clear product/service offerings", "Accessible contact information"],
      improvementOpportunities: ["Optimize website for mobile conversions", "Implement structured data markup", "Enhance page load speed", "Develop stronger calls-to-action"],
      competitiveGaps: ["Underutilized long-tail keywords", "Limited social proof elements", "Video content opportunity"],
      quickWins: ["Add clear CTAs above the fold", "Implement GA4 tracking", "Set up conversion tracking pixels"]
    };
  }

  if (!content.adCopyRecommendations?.googleAdsHeadlines) {
    content.adCopyRecommendations = {
      googleAdsHeadlines: [`${clientName} - ${industry}`, "Quality You Can Trust", "Get Started Today", "Expert Solutions", "Limited Time Offer"],
      googleAdsDescriptions: [`Discover why customers choose ${clientName}. Quality service, competitive prices.`, "Get a free consultation today.", "Trusted by thousands."],
      metaAdPrimaryText: [`Looking for ${industry.toLowerCase()} solutions? ${clientName} can help.`],
      metaAdHeadlines: ["Transform Your Experience", "Results You Can See", "Join Happy Customers"],
      callToActions: ["Get Started", "Learn More", "Contact Us", "Get Quote", "Book Now"],
      hooks: ["Stop scrolling if you need...", "Here's what nobody tells you...", "3 reasons smart buyers choose..."]
    };
  }

  // Extract primary service from client services if available for accurate keyword gaps
  const primaryService = (clientServices && clientServices.length > 0) 
    ? clientServices[0].toLowerCase() 
    : industry.toLowerCase();
  const secondaryService = (clientServices && clientServices.length > 1) 
    ? clientServices[1].toLowerCase() 
    : primaryService;

  if (!content.keywordStrategy?.primaryKeywords || content.keywordStrategy.primaryKeywords.length < 3) {
    content.keywordStrategy = {
      primaryKeywords: [
        { keyword: `${primaryService} services`, intent: "Commercial", priority: "High", monthlySearches: "1,200" },
        { keyword: `${primaryService} company`, intent: "Commercial", priority: "High", monthlySearches: "880" },
        { keyword: `professional ${primaryService}`, intent: "Commercial", priority: "Medium", monthlySearches: "720" },
        { keyword: `${secondaryService} services`, intent: "Commercial", priority: "Medium", monthlySearches: "590" },
        { keyword: `${primaryService} experts`, intent: "Transactional", priority: "Medium", monthlySearches: "320" }
      ],
      longTailKeywords: [
        { keyword: `best ${primaryService} near me`, intent: "Transactional", priority: "High", monthlySearches: "480" },
        { keyword: `affordable ${primaryService} services`, intent: "Commercial", priority: "High", monthlySearches: "320" },
        { keyword: `${primaryService} for small business`, intent: "Commercial", priority: "Medium", monthlySearches: "260" },
        { keyword: `how to choose a ${primaryService}`, intent: "Informational", priority: "Low", monthlySearches: "210" },
        { keyword: `${primaryService} cost calculator`, intent: "Commercial", priority: "Medium", monthlySearches: "180" }
      ],
      localKeywords: [
        `${primaryService} near me`, 
        `local ${primaryService}`, 
        `${primaryService} in my area`,
        `best ${primaryService} nearby`,
        `${secondaryService} near me`,
        `top ${primaryService} companies near me`,
        `${primaryService} services local`,
        `find ${primaryService} near me`
      ],
      negativeKeywords: ["free", "cheap", "DIY", "jobs", "careers", "salary", "training", "course", "certification", "how to become", "internship", "resume", "template", "software"],
      keywordGaps: [
        `best ${primaryService} companies`,
        `${primaryService} vs ${secondaryService}`,
        `top rated ${primaryService} providers`,
        `${primaryService} cost comparison`,
        `affordable ${secondaryService} services`
      ]
    };
  }
  
  // Ensure keywordGaps exists and uses client-specific services
  if (content.keywordStrategy && (!content.keywordStrategy.keywordGaps || content.keywordStrategy.keywordGaps.length === 0)) {
    content.keywordStrategy.keywordGaps = [
      `best ${primaryService} companies`,
      `${primaryService} vs ${secondaryService}`,
      `top rated ${primaryService} providers`,
      `${primaryService} cost comparison`,
      `affordable ${secondaryService} services`
    ];
  }

  if (!content.audienceStrategy?.primaryPersona || !content.audienceStrategy?.metaTargeting) {
    const existingAudience = content.audienceStrategy || {};
    content.audienceStrategy = {
      primaryPersona: existingAudience.primaryPersona || { 
        name: `Ideal ${industry} Customer`, 
        demographics: "25-55, decision-makers with purchasing authority", 
        psychographics: `"I need a reliable ${industry.toLowerCase()} provider I can trust. I've been burned before and don't have time for mistakes."`,
        painPoints: [
          `Difficulty finding trustworthy ${industry.toLowerCase()} providers`,
          "Wasting time with unresponsive or unreliable service",
          "Uncertainty about fair pricing in the market",
          "Fear of making the wrong choice"
        ],
        triggers: [
          "Urgent need arises unexpectedly",
          "Dissatisfaction with current provider",
          "Recommendation from friend or family",
          "Online research after problem occurs"
        ],
        objections: [
          "Is this company really trustworthy?",
          "Am I getting a fair price?",
          "Will they actually deliver on promises?",
          "What if something goes wrong?"
        ]
      },
      secondaryPersona: existingAudience.secondaryPersona || {
        name: "Budget-Conscious Buyer",
        demographics: "35-65, value-seekers comparing options",
        psychographics: `"I want quality but I need to make sure I'm not overpaying. Let me see what others are charging."`,
        painPoints: [
          "Limited budget constraints",
          "Overwhelmed by too many options",
          "Difficulty comparing apples to apples"
        ],
        triggers: [
          "Found a competitor offering lower prices",
          "Major life change requiring this service",
          "Seasonal promotion or discount opportunity",
          "Friend's recommendation with price comparison"
        ],
        objections: [
          "Is this really worth the premium price?",
          "Can I find this cheaper elsewhere?",
          "What hidden costs might I encounter?",
          "Will I regret not shopping around more?"
        ]
      },
      metaTargeting: existingAudience.metaTargeting || {
        interests: [
          `${industry} services`,
          "Home improvement",
          "Small business owners",
          "Local services",
          "DIY projects",
          "Professional services",
          "Quality products",
          "Customer reviews"
        ],
        behaviors: [
          "Engaged shoppers",
          "Recent homebuyers",
          "Small business owners",
          "Online purchasers",
          "Mobile users",
          "Research-focused buyers"
        ],
        customAudiences: [
          "Website visitors - Last 30 days",
          "Email subscriber list",
          "Video viewers - 50%+ watched",
          "Lead form abandoners",
          "Past customers - 12 months"
        ],
        lookalikeStrategy: `Create 1% lookalike from past customers for highest quality, 3-5% from website visitors for scale. Layer with ${industry.toLowerCase()} interest targeting for precision.`
      },
      googleAudiences: existingAudience.googleAudiences || {
        inMarket: [
          `${industry} services`,
          "Home services",
          "Business services",
          "Professional services",
          "Local services",
          "Repair services"
        ],
        affinity: [
          "Home & Garden Enthusiasts",
          "Do-It-Yourselfers",
          "Value Shoppers",
          "Technophiles",
          "Business Professionals",
          "Home Improvement Enthusiasts"
        ],
        customIntent: [
          `${industry.toLowerCase()} near me`,
          `best ${industry.toLowerCase()}`,
          `${industry.toLowerCase()} reviews`,
          `${industry.toLowerCase()} cost`,
          `affordable ${industry.toLowerCase()}`,
          `trusted ${industry.toLowerCase()}`,
          `${industry.toLowerCase()} companies`,
          `local ${industry.toLowerCase()}`
        ]
      }
    };
  }

  if (!content.executiveSummary?.intro) {
    content.executiveSummary = {
      intro: `This proposal outlines a comprehensive digital marketing strategy for ${clientName}.`,
      objectives: ["Increase qualified leads", "Improve brand awareness", "Drive revenue growth"],
      approach: "Data-driven, multi-channel marketing with continuous optimization",
      expectedOutcomes: `Based on ${industry} benchmarks: ${benchmark.facebook.ctr}% CTR, $${benchmark.facebook.cpc} CPC`,
      investmentOverview: `$${monthlyBudget.toLocaleString()}/month for full-service marketing`
    };
  }

  if (!content.contentStrategy?.headline) {
    content.contentStrategy = {
      headline: `Content Strategy for ${clientName}`,
      themes: ["Industry expertise", "Customer success", "Thought leadership"],
      blogTopics: [
        { title: `Top ${industry} Trends`, category: "Industry", targetKeyword: `${industry.toLowerCase()} trends` },
        { title: `How to Choose the Right ${industry} Provider`, category: "Guide", targetKeyword: `best ${industry.toLowerCase()}` }
      ]
    };
  }

  if (!content.servicesOverview?.services) {
    content.servicesOverview = {
      headline: "Our Services",
      services: [
        { name: "Paid Search", description: "Google Ads management", icon: "search" },
        { name: "Social Media", description: "Meta & TikTok advertising", icon: "share" },
        { name: "SEO", description: "Organic search optimization", icon: "trending-up" },
        { name: "Content", description: "Blog & creative content", icon: "file-text" }
      ]
    };
  }

  if (!content.phasedApproach?.phases) {
    content.phasedApproach = {
      phases: [
        { name: "Discovery", duration: "Week 1-2", activities: ["Audit", "Strategy", "Setup"] },
        { name: "Launch", duration: "Week 3-4", activities: ["Campaign launch", "Tracking setup"] },
        { name: "Optimize", duration: "Month 2-3", activities: ["A/B testing", "Refinement"] },
        { name: "Scale", duration: "Month 4+", activities: ["Budget scaling", "New channels"] }
      ]
    };
  }

  if (!content.googleAds?.headline) {
    content.googleAds = {
      headline: `Google Ads Strategy for ${clientName}`,
      campaignTypes: ["Search", "Display", "Remarketing"],
      budgetStrategy: {
        startingBudget: "$5/day per ad",
        scalingApproach: "Increase 20-30% every 3-4 days after proving conversions",
        expectedResults: { ctr: `${benchmark.google.searchCtr}%`, cpc: `$${benchmark.google.searchCpc}`, conversionRate: `${benchmark.google.conversionRate}%` }
      }
    };
  }

  if (!content.metaAds?.headline) {
    content.metaAds = {
      headline: `Meta Ads Strategy for ${clientName}`,
      campaignTypes: ["Awareness", "Consideration", "Conversion"],
      creativeApproach: "Video-first with UGC style content",
      budgetStrategy: {
        startingBudget: "$5/day per ad set",
        scalingApproach: "Scale winners, cut losers after 3-day learning",
        expectedResults: { ctr: `${benchmark.facebook.ctr}%`, cpm: `$${benchmark.meta.avgCpm}`, conversionRate: `${benchmark.facebook.conversionRate}%` }
      }
    };
  }

  if (!content.expectedResults?.metrics) {
    content.expectedResults = {
      metrics: [
        { name: "Expected CTR", value: `${benchmark.facebook.ctr}%`, description: `${industry} average` },
        { name: "Expected CPC", value: `$${benchmark.facebook.cpc}`, description: "Cost per click" },
        { name: "Conversion Rate", value: `${benchmark.facebook.conversionRate}%`, description: "Lead to customer" }
      ],
      monthlyBreakdown: [
        { month: 1, focus: "Foundation", expectedLeads: "10-20" },
        { month: 3, focus: "Optimization", expectedLeads: "30-50" },
        { month: 6, focus: "Scale", expectedLeads: "50-100" }
      ],
      quarterlyGoals: [
        { quarter: "Q1", goal: "Establish baseline metrics" },
        { quarter: "Q2", goal: "Optimize for conversions" },
        { quarter: "Q3-Q4", goal: "Scale profitable campaigns" }
      ]
    };
  }

  if (!content.aiSolutions?.voiceAgent) {
    content.aiSolutions = {
      voiceAgent: {
        headline: `AI Voice Agent for ${clientName}`,
        description: "24/7 phone answering with natural conversation",
        features: ["Appointment booking", "FAQ handling", "Lead qualification", "Call routing"],
        scripts: [{ scenario: "Inbound Call", sample: "Thank you for calling. How can I help you today?" }]
      },
      aiChatbot: {
        headline: `AI Chatbot for ${clientName}`,
        description: "Website chat that converts visitors to leads",
        features: ["Instant responses", "Lead capture", "Appointment booking"],
        platforms: ["Website", "Facebook Messenger"]
      }
    };
  }

  if (!content.automationWorkflows?.workflows) {
    content.automationWorkflows = {
      headline: `Workflow Automation for ${clientName}`,
      description: "Automated lead nurturing and follow-up",
      workflows: [
        { name: "New Lead Nurture", trigger: "Form submission", actions: ["Welcome email", "Add to CRM", "Notify team"], benefit: "Never lose a lead" },
        { name: "Appointment Reminder", trigger: "24h before", actions: ["SMS reminder", "Email confirmation"], benefit: "Reduce no-shows 60%" },
        { name: "Post-Purchase", trigger: "After service", actions: ["Thank you email", "Review request"], benefit: "Build reputation" }
      ],
      integrations: ["Google Calendar", "CRM", "Email", "SMS"]
    };
  }

  if (!content.crmManagement?.features) {
    content.crmManagement = {
      headline: "CRM & Lead Management",
      description: "Centralized customer relationship management",
      features: ["Automatic lead capture", "360° customer view", "Task management", "Email & SMS templates"],
      pipeline: [
        { stage: "New Lead", actions: ["Auto-captured"] },
        { stage: "Qualified", actions: ["Scored by AI"] },
        { stage: "Proposal", actions: ["Tracked"] },
        { stage: "Won/Lost", actions: ["Automation triggered"] }
      ]
    };
  }

  if (!content.textMarketing?.campaigns || content.textMarketing.campaigns.length < 4) {
    const existingCampaigns = content.textMarketing?.campaigns || [];
    const defaultCampaigns = [
      { type: "Appointment Reminders", purpose: "Reduce no-shows", timing: "24h before", sampleMessage: `Hi [Name]! Your ${clientName} appointment is tomorrow at [Time]. Reply YES to confirm or RESCHEDULE to pick a new time.` },
      { type: "Follow-Up", purpose: "Post-visit engagement", timing: "1-2 days after", sampleMessage: `Hey [Name]! Thanks for visiting ${clientName}. Do you have any questions we can help answer?` },
      { type: "Special Offer", purpose: "Drive promotions", timing: "Strategic", sampleMessage: `Hey [Name]! We have a special offer for you at ${clientName}. Reply INFO to learn more. 💰` },
      { type: "Re-engagement", purpose: "Win back inactive", timing: "30+ days", sampleMessage: `Hi [Name]! It's been a while since we connected. ${clientName} has some exciting updates - interested in learning more?` }
    ];
    // Pad existing campaigns to 4
    const finalCampaigns = [...existingCampaigns];
    for (let i = finalCampaigns.length; i < 4; i++) {
      finalCampaigns.push(defaultCampaigns[i]);
    }
    content.textMarketing = {
      headline: content.textMarketing?.headline || "SMS & Text Marketing",
      description: content.textMarketing?.description || "98% open rate text campaigns",
      campaigns: finalCampaigns,
      features: content.textMarketing?.features || ["Two-way conversations", "Personalization", "Scheduling"],
      expectedResults: content.textMarketing?.expectedResults || { openRate: "98%", responseRate: "45%", conversionRate: "12%" }
    };
  }

  if (!content.websiteDesign?.headline) {
    content.websiteDesign = {
      headline: `Custom Website for ${clientName}`,
      description: "Professional website designed to convert visitors",
      designApproach: {
        headline: "Our Process",
        philosophy: "Custom design, no templates",
        steps: [
          { title: "Discovery", description: "Learn your brand" },
          { title: "Design", description: "Custom mockups" },
          { title: "Development", description: "Build & test" },
          { title: "Launch", description: "Go live" }
        ]
      },
      pages: [
        { name: "Homepage", description: "First impression", priority: "high" },
        { name: "About", description: "Your story", priority: "high" },
        { name: "Services", description: "What you offer", priority: "high" },
        { name: "Contact", description: "Get in touch", priority: "high" }
      ],
      features: [
        { name: "Mobile-First", description: "Perfect on all devices", included: true },
        { name: "Fast Loading", description: "Optimized performance", included: true },
        { name: "SEO Ready", description: "Built for search", included: true }
      ],
      timeline: { discovery: "Week 1", design: "Week 2-3", development: "Week 3-5", launch: "Week 6", total: "4-6 weeks" }
    };
  }

  if (!content.budget?.total) {
    content.budget = {
      total: `$${annualBudget.toLocaleString()}/year`,
      breakdown: [
        { category: "Paid Search", amount: `$${Math.round(annualBudget * 0.25).toLocaleString()}`, percentage: 25 },
        { category: "Paid Social", amount: `$${Math.round(annualBudget * 0.25).toLocaleString()}`, percentage: 25 },
        { category: "SEO", amount: `$${Math.round(annualBudget * 0.20).toLocaleString()}`, percentage: 20 },
        { category: "Content", amount: `$${Math.round(annualBudget * 0.15).toLocaleString()}`, percentage: 15 },
        { category: "Tools", amount: `$${Math.round(annualBudget * 0.15).toLocaleString()}`, percentage: 15 }
      ],
      roiProjections: { expectedRevenue: `$${Math.round(annualBudget * 4).toLocaleString()}+`, roas: "4-6x" }
    };
  }

  if (!content.timeline?.duration) {
    content.timeline = {
      duration: timeline || "12 months",
      phases: [
        { name: "Foundation", duration: "Months 1-3", milestones: ["Setup", "Launch", "Initial data"] },
        { name: "Optimization", duration: "Months 4-6", milestones: ["A/B testing", "Scaling"] },
        { name: "Growth", duration: "Months 7-12", milestones: ["Full scale", "New channels"] }
      ],
      keyDates: ["Week 1: Kickoff", "Week 4: Campaigns live", "Month 3: First review"]
    };
  }

  if (!content.whyMelleka?.points) {
    content.whyMelleka = {
      headline: `Why Melleka for ${clientName}`,
      points: [
        { title: "Industry Expertise", description: `Deep ${industry} experience` },
        { title: "Dedicated Team", description: "Your own specialists" },
        { title: "Proven Results", description: "Track record of growth" },
        { title: "Full Transparency", description: "Real-time dashboards" }
      ]
    };
  }

  if (!content.cta?.headline) {
    content.cta = {
      headline: `Let's Grow ${clientName} Together`,
      subheadline: "This proposal outlines the path to market leadership. Let's take the first step together.",
      nextSteps: ["Book a discovery call", "Select your package", "Begin onboarding & launch in 2-3 days"],
      contact: { name: "Melleka Marketing", email: "hello@melleka.com", phone: "(818) 599-2696", website: "melleka.com" }
    };
  }

  if (!content.brandStyles) {
    content.brandStyles = {
      primaryColor: branding?.colors?.primary || "#6366f1",
      secondaryColor: branding?.colors?.secondary || branding?.colors?.primary || "#6366f1",
      logo: logoUrl || "",
      ogImage: branding?.ogImage || "",
      favicon: branding?.favicon || "",
      screenshot: branding?.screenshot || ""
    };
  } else if (logoUrl) {
    content.brandStyles.logo = logoUrl;
  }

  // SEO Strategy section - ALWAYS required for marketing proposals
  if (!content.seo && !isWebsiteOnly) {
    content.seo = {
      strategy: `Comprehensive SEO strategy to increase organic visibility for ${clientName} in the ${industry} market.`,
      technical: [
        "Site speed optimization and Core Web Vitals improvements",
        "Mobile-first indexing optimization",
        "Schema markup implementation for rich snippets",
        "XML sitemap and robots.txt optimization",
        "HTTPS and security best practices"
      ],
      onPage: [
        "Keyword-optimized title tags and meta descriptions",
        "Header hierarchy optimization (H1-H6)",
        "Content gap analysis and optimization",
        "Internal linking strategy",
        "Image alt text and optimization"
      ],
      offPage: [
        "Quality backlink acquisition strategy",
        "Local citation building",
        "Industry directory submissions",
        "Digital PR and content outreach",
        "Competitor backlink analysis"
      ],
      keywords: [
        { keyword: `${industry.toLowerCase()} services`, volume: "1,000+", difficulty: "Medium", priority: "High" },
        { keyword: `best ${industry.toLowerCase()} near me`, volume: "500+", difficulty: "Low", priority: "High" },
        { keyword: `${industry.toLowerCase()} companies`, volume: "800+", difficulty: "Medium", priority: "Medium" },
        { keyword: `affordable ${industry.toLowerCase()}`, volume: "300+", difficulty: "Low", priority: "Medium" }
      ],
      contentStrategy: `Create authoritative content that positions ${clientName} as a thought leader in ${industry}, targeting high-value informational and transactional keywords.`,
      expectedResults: {
        organicTraffic: "+150-300%",
        rankings: "Top 10 for 20+ keywords",
        domainAuthority: "+10-15 points"
      }
    };
  }

  // Analytics & Tracking section - ALWAYS required for marketing proposals
  if (!content.analytics && !isWebsiteOnly) {
    content.analytics = {
      strategy: `Implement comprehensive analytics and tracking to measure every touchpoint in ${clientName}'s customer journey, enabling data-driven optimization.`,
      trackingPoints: [
        "Form submissions and lead captures",
        "Phone call tracking with dynamic number insertion",
        "E-commerce transactions (if applicable)",
        "Scroll depth and engagement metrics",
        "Video play tracking",
        "Button click and CTA engagement"
      ],
      dashboards: [
        "Executive KPI Dashboard",
        "Campaign Performance Dashboard",
        "SEO & Organic Traffic Dashboard",
        "Conversion Funnel Dashboard"
      ],
      reportingCadence: "Weekly performance reports with monthly deep-dive analysis",
      stack: [
        "Google Analytics 4 (GA4)",
        "Google Tag Manager",
        "Google Search Console",
        "Looker Studio Dashboards",
        "Meta Pixel & Conversions API",
        "Call Tracking Software"
      ],
      kpiFramework: [
        { category: "Acquisition", metrics: ["Traffic by source", "New users", "Cost per visit", "Channel ROI"] },
        { category: "Engagement", metrics: ["Time on site", "Pages per session", "Bounce rate", "Scroll depth"] },
        { category: "Conversion", metrics: ["Lead conversion rate", "Cost per lead", "Form completions", "Call volume"] },
        { category: "Revenue", metrics: ["ROAS", "Customer acquisition cost", "Lifetime value", "Revenue by channel"] }
      ]
    };
  }

  // Social Media section - required for marketing proposals
  if (!content.socialMedia && !isWebsiteOnly) {
    content.socialMedia = {
      strategy: `Build ${clientName}'s social presence as a trusted authority in ${industry} through strategic content that educates and engages target audiences.`,
      platforms: [
        {
          name: "LinkedIn",
          approach: `Primary B2B platform for reaching decision-makers with educational content on ${industry.toLowerCase()} trends.`,
          postingFrequency: "5x per week",
          contentTypes: ["Industry insights", "Case studies", "Product updates", "Thought leadership", "Team spotlights"]
        },
        {
          name: "Facebook",
          approach: "Community building and brand awareness with engaging, shareable content.",
          postingFrequency: "3x per week",
          contentTypes: ["Behind-the-scenes", "Customer stories", "Tips & tricks", "Promotions"]
        },
        {
          name: "Instagram",
          approach: "Visual storytelling to humanize the brand and showcase company culture.",
          postingFrequency: "4x per week",
          contentTypes: ["Reels", "Stories", "Carousels", "User-generated content"]
        }
      ],
      communityManagement: "Active engagement with comments, mentions, and industry conversations. 2-hour response time during business hours.",
      brandVoice: "Expert, approachable, and solution-focused. Speaking as trusted advisors who understand customer challenges."
    };
  }

  // Email Marketing section - required for marketing proposals
  if (!content.email && !isWebsiteOnly) {
    content.email = {
      strategy: `Nurture leads through the customer journey with targeted content that addresses ${industry.toLowerCase()} pain points at each buying stage.`,
      campaigns: [
        {
          type: "welcome",
          subject: `Welcome to ${clientName} - Your Journey Starts Here! 🎉`,
          preheader: `Discover what makes ${clientName} the right choice for you...`,
          headline: `Welcome to the ${clientName} Family!`,
          bodyPreview: `Thank you for choosing ${clientName}! We're excited to help you achieve your goals. Here's everything you need to get started.`,
          ctaText: "Get Started Now"
        },
        {
          type: "nurture",
          subject: `${industry} Tips: What Our Most Successful Clients Know`,
          preheader: `Insider strategies that drive real results in ${industry.toLowerCase()}...`,
          headline: "Expert Insights Just for You",
          bodyPreview: `We've helped hundreds of clients succeed in ${industry.toLowerCase()}. Here are the proven strategies that deliver the best results.`,
          ctaText: "Read the Full Guide"
        },
        {
          type: "promo",
          subject: `⚡ Special Offer: Save on ${clientName} Services`,
          preheader: `Limited time - lock in your savings on ${industry.toLowerCase()} solutions...`,
          headline: "Your Exclusive Savings Await",
          bodyPreview: `For a limited time, take advantage of special pricing on our most popular ${industry.toLowerCase()} services. Don't miss out!`,
          ctaText: "Claim Your Savings"
        },
        {
          type: "cart",
          subject: `Still interested in ${clientName}? Let's talk.`,
          preheader: `We noticed you were exploring our ${industry.toLowerCase()} solutions...`,
          headline: "We're Here to Help",
          bodyPreview: `We noticed you were interested in our services. Have questions? Our team is ready to help you find the perfect solution.`,
          ctaText: "Schedule a Call"
        }
      ],
      flows: [
        { name: "Welcome Series", emails: 5, purpose: "Introduce value proposition and build trust" },
        { name: "Lead Nurture", emails: 6, purpose: "Educational content for consideration stage" },
        { name: "Post-Purchase", emails: 4, purpose: "Onboarding and cross-sell opportunities" },
        { name: "Re-engagement", emails: 3, purpose: "Win back inactive subscribers" }
      ],
      segmentation: ["By purchase history", "By engagement level", "By interests", "By lifecycle stage"],
      expectedResults: {
        openRate: "25-35%",
        ctr: "3-5%",
        revenue: "15-25% of total revenue"
      }
    };
  }
}

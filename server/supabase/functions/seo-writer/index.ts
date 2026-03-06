import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { callClaude } from "../_shared/claude.ts";

// Declare EdgeRuntime for Deno edge environment
declare const EdgeRuntime:
  | {
      waitUntil: (promise: Promise<unknown>) => void;
    }
  | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  competition?: number;
  intent?: string;
  score?: number;
  position?: number;
  cpc?: number;
  trend?: number[];
}

interface SerpFeature {
  type: string;
  present: boolean;
  opportunity: string;
}

interface ContentScore {
  overall: number;
  keywordDensity: number;
  readability: number;
  wordCount: number;
  headingStructure: number;
  suggestions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEO COPYWRITING GUIDELINES DATABASE
// Research-backed techniques for predictable, high-quality content
// ═══════════════════════════════════════════════════════════════════════════════

const SEO_COPYWRITING_GUIDELINES = {
  // ─────────────────────────────────────────────────────────────────────────────
  // ARTICLE FRAMEWORKS - Choose one per article type
  // ─────────────────────────────────────────────────────────────────────────────
  frameworks: {
    // APP Framework (Agree, Promise, Preview) - Great for guides
    APP: {
      name: "APP Framework",
      description: "Hook readers by agreeing with their problem, promising a solution, then previewing what they'll learn",
      structure: [
        "AGREE: Acknowledge the reader's pain point or challenge in the first sentence",
        "PROMISE: State clearly what they'll achieve by reading this article",
        "PREVIEW: Give a roadmap of what's coming (without spoiling everything)"
      ],
      example: "Finding reliable [topic] advice feels impossible. By the end of this guide, you'll have a clear action plan. We'll cover the fundamentals, common pitfalls, and exactly what to do next."
    },
    
    // PAS Framework (Problem, Agitate, Solution) - Great for commercial content
    PAS: {
      name: "PAS Framework",
      description: "Problem-Agitate-Solution - Makes readers feel the urgency before offering relief",
      structure: [
        "PROBLEM: State the reader's problem clearly and specifically",
        "AGITATE: Dig deeper into why this problem hurts (consequences, frustrations)",
        "SOLUTION: Present your content as the answer they've been looking for"
      ],
      example: "Most [topic] strategies fail. Worse, they waste months of effort and leave you further behind competitors. Here's the approach that actually works."
    },
    
    // Inverted Pyramid - Great for informational/how-to content
    invertedPyramid: {
      name: "Inverted Pyramid",
      description: "Lead with the most important information, then add supporting details",
      structure: [
        "LEAD: The most critical information/answer in the first paragraph",
        "BODY: Supporting details, evidence, and context",
        "TAIL: Background information, related topics, nice-to-haves"
      ],
      bestFor: ["How-to guides", "News-style content", "Quick answers"]
    },
    
    // AIDA - Great for sales/conversion content
    AIDA: {
      name: "AIDA Framework",
      description: "Attention-Interest-Desire-Action funnel for conversion-focused content",
      structure: [
        "ATTENTION: Hook with a surprising stat, bold claim, or relatable scenario",
        "INTEREST: Build curiosity with benefits and 'what if' possibilities",
        "DESIRE: Create want through proof, examples, and transformation stories",
        "ACTION: Clear next step the reader should take"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BUCKET BRIGADES - Transition phrases that keep readers scrolling
  // ─────────────────────────────────────────────────────────────────────────────
  bucketBrigades: {
    description: "Short phrases that create a 'grease slide' effect, pulling readers through content",
    categories: {
      curiosity: [
        "Here's the thing:",
        "But here's the kicker:",
        "Here's why that matters:",
        "The truth is:",
        "What most people miss:",
        "Here's what changed everything:",
        "This is where it gets interesting:"
      ],
      continuation: [
        "And that's not all.",
        "But wait, there's more.",
        "It gets better.",
        "And here's the best part:",
        "Now for the good news:",
        "But that's just the start."
      ],
      proof: [
        "Case in point:",
        "Here's proof:",
        "The data shows:",
        "For example:",
        "Consider this:",
        "Look at it this way:"
      ],
      transition: [
        "Now, let's talk about...",
        "Moving on to...",
        "With that foundation...",
        "Building on that...",
        "Next up:",
        "Which brings us to:"
      ],
      emphasis: [
        "Bottom line?",
        "The takeaway:",
        "In other words:",
        "Put simply:",
        "Here's what this means for you:",
        "Translation:"
      ],
      objectionHandling: [
        "I know what you're thinking:",
        "You might be wondering:",
        "But what about...?",
        "The obvious question:",
        "Fair point. But consider this:"
      ]
    },
    usage: "Insert bucket brigades every 150-300 words to maintain engagement. Use them especially before key points, after complex explanations, and at section transitions."
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // E-E-A-T SIGNALS - Experience, Expertise, Authoritativeness, Trustworthiness
  // ─────────────────────────────────────────────────────────────────────────────
  eeatSignals: {
    experience: {
      description: "Show first-hand experience with the topic",
      techniques: [
        "Share personal anecdotes: 'When I first tried X...'",
        "Reference specific scenarios: 'In my experience with 50+ clients...'",
        "Include lessons learned: 'What I wish I knew earlier...'",
        "Mention real outcomes: 'This approach helped us achieve X'"
      ]
    },
    expertise: {
      description: "Demonstrate deep knowledge and competence",
      techniques: [
        "Use industry-specific terminology (but explain it)",
        "Reference current trends and developments",
        "Provide nuanced insights competitors miss",
        "Acknowledge complexity and trade-offs",
        "Cite specific studies, data points, or research"
      ]
    },
    authoritativeness: {
      description: "Establish credibility in the field",
      techniques: [
        "Reference authoritative sources and studies",
        "Link to reputable external resources",
        "Acknowledge other experts in the field",
        "Share credentials when relevant (without bragging)"
      ]
    },
    trustworthiness: {
      description: "Build reader confidence in your content",
      techniques: [
        "Be transparent about limitations",
        "Acknowledge when something is opinion vs fact",
        "Include specific, verifiable details",
        "Avoid exaggerated claims",
        "Update content to reflect current information"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // WRITING RULES - Core principles for cohesive, engaging content
  // ─────────────────────────────────────────────────────────────────────────────
  writingRules: {
    sentenceStructure: [
      "Vary sentence length: Short. Then longer with more detail. Then short again.",
      "Start 10-15% of sentences with 'And' or 'But' for natural flow",
      "Use the occasional one-word sentence for emphasis. Seriously.",
      "Front-load sentences with the key information",
      "Break complex ideas into multiple short sentences"
    ],
    paragraphStructure: [
      "Keep paragraphs to 2-4 sentences maximum",
      "One idea per paragraph",
      "Use single-sentence paragraphs for emphasis",
      "Never start consecutive paragraphs the same way"
    ],
    transitions: {
      betweenSentences: [
        "This means...",
        "As a result...",
        "In practice...",
        "For instance...",
        "Similarly...",
        "On the flip side..."
      ],
      betweenParagraphs: [
        "With that in mind...",
        "Building on that foundation...",
        "Now that we've covered X...",
        "This brings us to...",
        "Here's where it gets practical..."
      ],
      betweenSections: [
        "Now let's shift to...",
        "The next piece of the puzzle is...",
        "Armed with that knowledge...",
        "Taking this a step further...",
        "Which leads to an important question:"
      ]
    },
    readabilityTips: [
      "Write at 8th-9th grade reading level for broad audiences",
      "Replace jargon with plain language (or explain it)",
      "Use active voice 80%+ of the time",
      "Avoid double negatives",
      "Read sentences aloud - if you run out of breath, it's too long"
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HOOKS & OPENINGS - Patterns for compelling introductions
  // ─────────────────────────────────────────────────────────────────────────────
  hooks: {
    types: {
      statisticHook: {
        description: "Lead with a surprising or specific statistic",
        example: "73% of [topic] efforts fail within the first 6 months. Here's why - and how to be in the other 27%.",
        tip: "Use specific numbers (73%, not 'around 70%') for credibility"
      },
      contrarian: {
        description: "Challenge conventional wisdom",
        example: "Most [topic] advice is wrong. Or at least, incomplete.",
        tip: "Only use if you can back up the contrarian claim"
      },
      storyHook: {
        description: "Open with a micro-story or scenario",
        example: "Picture this: You've spent weeks on [task], only to realize [problem].",
        tip: "Keep stories to 2-3 sentences max in intros"
      },
      questionHook: {
        description: "Ask a question the reader is already wondering",
        example: "Why do some [things] succeed while others fail? The answer isn't what you'd expect.",
        tip: "Avoid obvious questions - ask ones that make readers think"
      },
      directHook: {
        description: "Get straight to the point",
        example: "Here's exactly how to [achieve result] in [timeframe].",
        tip: "Best for how-to and tutorial content"
      }
    },
    antiPatterns: [
      "❌ 'In today's fast-paced world...' (generic, AI-sounding)",
      "❌ 'Have you ever wondered...?' (overused)",
      "❌ 'Let's dive in!' (cliché)",
      "❌ 'When it comes to [topic]...' (weak opener)",
      "❌ Starting with a dictionary definition (lazy)"
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CONCLUSIONS - Patterns for strong endings
  // ─────────────────────────────────────────────────────────────────────────────
  conclusions: {
    elements: [
      "SUMMARY: Restate the key takeaway (not a recap of every section)",
      "TRANSFORMATION: Remind them what's now possible",
      "NEXT STEP: One clear action they should take immediately"
    ],
    patterns: {
      actionEnding: "Now it's your turn. Pick one strategy from this guide and implement it today.",
      futureEnding: "Six months from now, you could be [desired outcome]. It starts with [first step].",
      callbackEnding: "Remember that [problem] we mentioned at the start? With these strategies, it becomes [solution]."
    },
    antiPatterns: [
      "❌ 'In conclusion...' (unnecessary)",
      "❌ Introducing new information",
      "❌ Repeating the intro word-for-word",
      "❌ Ending with a question (unless it's rhetorical and powerful)"
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SEO-SPECIFIC TECHNIQUES
  // ─────────────────────────────────────────────────────────────────────────────
  seoTechniques: {
    keywordPlacement: [
      "Primary keyword in title (preferably near the start)",
      "Primary keyword in first 100 words",
      "Primary keyword in at least one H2",
      "Primary keyword in conclusion",
      "Natural keyword density: 0.5-1.5% (2-4 mentions per 1000 words)",
      "Secondary keywords in H2s and body text where natural"
    ],
    contentSignals: [
      "Comprehensive coverage (address related questions)",
      "Original insights (not just aggregated info)",
      "Updated/current information",
      "Proper heading hierarchy (H1 > H2 > H3)",
      "Lists and tables for scannable content"
    ],
    featuredSnippetOptimization: [
      "For 'what is' queries: Provide 40-60 word definition early",
      "For 'how to' queries: Use numbered steps with clear actions",
      "For 'best' queries: Use a bulleted list format",
      "For comparison queries: Use tables with clear columns"
    ],
    userExperienceSignals: [
      "Get to the answer quickly (don't bury the lede)",
      "Break up text with visuals, lists, subheadings",
      "Use descriptive subheadings (not clever ones)",
      "Internal links to related content",
      "External links to authoritative sources"
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ANTI-AI DETECTION - Write like a human
  // ─────────────────────────────────────────────────────────────────────────────
  antiAIPatterns: {
    bannedPhrases: [
      "In today's [adjective] world/era/landscape",
      "It's important to note that",
      "It's worth mentioning",
      "When it comes to",
      "Let's dive in/deeper",
      "Without further ado",
      "In this article, we will",
      "Firstly... Secondly... Thirdly...",
      "Game-changer",
      "Revolutionary/revolutionize",
      "Unlock your potential",
      "Leverage/utilize (use 'use' instead)",
      "Seamlessly integrate",
      "At the end of the day",
      "It goes without saying",
      "Needless to say",
      "Navigate the complex landscape",
      "Embark on a journey",
      "Delve into/deeper",
      "Holistic approach"
    ],
    humanTouches: [
      "Use contractions (don't, won't, it's, that's)",
      "Start some sentences with And, But, So",
      "Use parenthetical asides (like this one)",
      "Include occasional mild opinions",
      "Use specific numbers: 73% not 'around 70%'",
      "Reference real examples when possible",
      "Vary sentence lengths dramatically",
      "Use fragments strategically. Like this.",
      "Add occasional first-person perspective"
    ]
  }
};

// Helper to get random bucket brigades for article generation
function getRandomBucketBrigades(count: number = 5): string[] {
  const allBrigades = Object.values(SEO_COPYWRITING_GUIDELINES.bucketBrigades.categories).flat();
  const shuffled = allBrigades.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper to select framework based on article type
function getFrameworkForArticleType(articleType: string) {
  const typeToFramework: Record<string, keyof typeof SEO_COPYWRITING_GUIDELINES.frameworks> = {
    guide: 'APP',
    tutorial: 'invertedPyramid',
    listicle: 'invertedPyramid',
    comparison: 'PAS',
    'case-study': 'AIDA'
  };
  const frameworkKey = typeToFramework[articleType] || 'APP';
  return SEO_COPYWRITING_GUIDELINES.frameworks[frameworkKey];
}

// Generate writing guidelines section for prompts
function generateWritingGuidelines(articleType: string, targetWords: number): string {
  const framework = getFrameworkForArticleType(articleType);
  const bucketBrigades = getRandomBucketBrigades(8);
  
  return `
═══════════════════════════════════════════════════════════════
PROFESSIONAL COPYWRITING FRAMEWORK: ${framework.name}
═══════════════════════════════════════════════════════════════
${framework.structure.join('\n')}

BUCKET BRIGADES (use 3-5 throughout to maintain engagement):
${bucketBrigades.map(b => `• "${b}"`).join('\n')}

SENTENCE RHYTHM:
${SEO_COPYWRITING_GUIDELINES.writingRules.sentenceStructure.slice(0, 3).join('\n')}

TRANSITIONS BETWEEN SECTIONS (pick from these):
${SEO_COPYWRITING_GUIDELINES.writingRules.transitions.betweenSections.join('\n')}

HOOK STYLE: ${articleType === 'guide' ? 'Use a statistic or contrarian hook' : 'Use a direct or question hook'}

E-E-A-T SIGNALS TO INCLUDE:
- Show EXPERIENCE: Include 1-2 "in my experience" or "what I've found" statements
- Show EXPERTISE: Use specific data points and industry insights
- Build TRUST: Acknowledge trade-offs and limitations honestly

BANNED PHRASES (DO NOT USE):
${SEO_COPYWRITING_GUIDELINES.antiAIPatterns.bannedPhrases.slice(0, 10).join(', ')}

HUMAN WRITING PATTERNS (DO USE):
${SEO_COPYWRITING_GUIDELINES.antiAIPatterns.humanTouches.slice(0, 5).join('\n')}
═══════════════════════════════════════════════════════════════
`;
}

// CRITICAL: Strip standalone em dashes and bold formatting, but preserve hyphenated compound words
function cleanGeneratedContent(content: string): string {
  return content
    // Remove bold markdown formatting first
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Replace standalone em dashes (with spaces around them) with regular dash
    .replace(/ — /g, ' - ')
    .replace(/ – /g, ' - ')
    // Replace em dashes at start/end of sentences
    .replace(/^—\s/gm, '- ')
    .replace(/\s—$/gm, ' -')
    // Replace em dashes used as separators (not in hyphenated words like "back-to-school")
    .replace(/(\w)—(\s)/g, '$1 -$2')
    .replace(/(\s)—(\w)/g, '$1- $2')
    // Clean up double spaces
    .replace(/  +/g, ' ')
    .trim();
}

// Parse Semrush CSV response
function parseSemrushCSV(text: string, includeIntent = false): KeywordData[] {
  const results: KeywordData[] = [];
  if (!text || text.includes("ERROR")) return results;
  
  const lines = text.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length >= 3) {
      const keyword = values[0];
      const volume = parseInt(values[1]) || 0;
      const difficulty = parseInt(values[2]) || 0;
      const competition = parseFloat(values[3]) || 0;
      const cpc = parseFloat(values[4]) || 0;
      
      // Determine intent with enhanced detection
      let intent = "Informational";
      const kw = keyword.toLowerCase();
      if (kw.includes("buy") || kw.includes("price") || kw.includes("cost") || kw.includes("deal") || kw.includes("order") || kw.includes("purchase") || kw.includes("cheap") || kw.includes("affordable")) {
        intent = "Transactional";
      } else if (kw.includes("best") || kw.includes("top") || kw.includes("review") || kw.includes("vs") || kw.includes("compare") || kw.includes("alternative")) {
        intent = "Commercial";
      } else if (kw.includes("near me") || kw.includes("login") || kw.includes("location") || kw.includes("hours") || kw.includes("directions")) {
        intent = "Navigational";
      } else if (kw.includes("how to") || kw.includes("what is") || kw.includes("guide") || kw.includes("tutorial")) {
        intent = "Informational";
      }
      
      // Enhanced opportunity score: high volume + low difficulty + commercial intent boost
      const intentBoost = intent === "Transactional" ? 1.5 : intent === "Commercial" ? 1.3 : 1.0;
      const score = Math.round((volume / 100) * ((100 - difficulty) / 10) * intentBoost);
      
      results.push({
        keyword,
        volume,
        difficulty,
        competition,
        cpc,
        intent: includeIntent ? intent : undefined,
        score
      });
    }
  }
  return results;
}

// Parse trending keywords with historical data
function parseTrendingKeywords(text: string): KeywordData[] {
  const results: KeywordData[] = [];
  if (!text || text.includes("ERROR")) return results;
  
  const lines = text.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length >= 3) {
      const keyword = values[0];
      const volume = parseInt(values[1]) || 0;
      const difficulty = parseInt(values[2]) || 0;
      // Parse trend data (monthly volumes for last 12 months)
      const trend = values.slice(3, 15).map(v => parseInt(v) || 0);
      
      results.push({
        keyword,
        volume,
        difficulty,
        trend: trend.length > 0 ? trend : undefined,
        score: Math.round((volume / 100) * ((100 - difficulty) / 10))
      });
    }
  }
  return results;
}

// Analyze SERP features opportunity
function analyzeSerpFeatures(keywords: KeywordData[], domain: string): SerpFeature[] {
  const features: SerpFeature[] = [];
  
  // Featured Snippet opportunity - question keywords
  const questionKeywords = keywords.filter(k => 
    k.keyword.toLowerCase().includes("what") ||
    k.keyword.toLowerCase().includes("how") ||
    k.keyword.toLowerCase().includes("why") ||
    k.keyword.toLowerCase().includes("when")
  );
  
  features.push({
    type: "Featured Snippet",
    present: questionKeywords.length > 3,
    opportunity: questionKeywords.length > 0 
      ? `${questionKeywords.length} question-based keywords detected. Create concise, direct answers (40-60 words) in your content to capture featured snippets.`
      : "Add question-based content with clear, concise answers to target featured snippets."
  });
  
  // People Also Ask opportunity
  features.push({
    type: "People Also Ask",
    present: questionKeywords.length > 2,
    opportunity: "Structure FAQ sections with clear Q&A format. Use schema markup for FAQ pages to increase PAA visibility."
  });
  
  // Local Pack opportunity
  const localKeywords = keywords.filter(k => 
    k.keyword.toLowerCase().includes("near me") ||
    k.keyword.toLowerCase().includes("local") ||
    k.keyword.toLowerCase().includes("in [city]")
  );
  
  features.push({
    type: "Local Pack",
    present: localKeywords.length > 0,
    opportunity: localKeywords.length > 0
      ? `${localKeywords.length} local-intent keywords found. Optimize Google Business Profile and add location pages.`
      : "Consider adding location-based landing pages if you serve specific areas."
  });
  
  // Image Pack opportunity
  const visualKeywords = keywords.filter(k => 
    k.keyword.toLowerCase().includes("example") ||
    k.keyword.toLowerCase().includes("template") ||
    k.keyword.toLowerCase().includes("design") ||
    k.keyword.toLowerCase().includes("infographic")
  );
  
  features.push({
    type: "Image Pack",
    present: visualKeywords.length > 0,
    opportunity: "Add optimized images with descriptive alt text and file names for visual keywords. Consider infographics."
  });
  
  // Video opportunity
  const videoKeywords = keywords.filter(k => 
    k.keyword.toLowerCase().includes("tutorial") ||
    k.keyword.toLowerCase().includes("how to") ||
    k.keyword.toLowerCase().includes("demo") ||
    k.keyword.toLowerCase().includes("review")
  );
  
  features.push({
    type: "Video Carousel",
    present: videoKeywords.length > 0,
    opportunity: videoKeywords.length > 0
      ? `${videoKeywords.length} video-friendly keywords. Create YouTube content and embed videos on relevant pages.`
      : "Consider video content for tutorial and how-to keywords."
  });
  
  return features;
}

// Calculate content optimization score
function calculateContentScore(content: string, targetKeyword: string): ContentScore {
  const wordCount = content.split(/\s+/).length;
  const keywordCount = (content.toLowerCase().match(new RegExp(targetKeyword.toLowerCase(), 'g')) || []).length;
  const keywordDensity = (keywordCount / wordCount) * 100;
  
  // Heading structure check
  const h2Count = (content.match(/##\s/g) || []).length;
  const h3Count = (content.match(/###\s/g) || []).length;
  const hasProperHeadings = h2Count >= 3 && h3Count >= 2;
  
  // Readability (simplified Flesch-Kincaid approximation)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const avgWordsPerSentence = wordCount / Math.max(sentences, 1);
  const readabilityScore = Math.max(0, Math.min(100, 206.835 - (1.015 * avgWordsPerSentence)));
  
  // Calculate scores
  const densityScore = keywordDensity >= 0.5 && keywordDensity <= 2.5 ? 90 : keywordDensity < 0.5 ? 50 : 60;
  const wordCountScore = wordCount >= 1500 ? 100 : wordCount >= 1000 ? 85 : wordCount >= 500 ? 70 : 50;
  const headingScore = hasProperHeadings ? 90 : h2Count >= 2 ? 70 : 50;
  
  const overallScore = Math.round((densityScore + wordCountScore + headingScore + readabilityScore) / 4);
  
  const suggestions: string[] = [];
  if (keywordDensity < 0.5) suggestions.push(`Increase keyword "${targetKeyword}" usage (currently ${keywordDensity.toFixed(1)}%)`);
  if (keywordDensity > 2.5) suggestions.push(`Reduce keyword stuffing (currently ${keywordDensity.toFixed(1)}%)`);
  if (wordCount < 1000) suggestions.push(`Expand content to at least 1,500 words (currently ${wordCount})`);
  if (!hasProperHeadings) suggestions.push("Add more H2 and H3 headings for better structure");
  if (avgWordsPerSentence > 25) suggestions.push("Break up long sentences for better readability");
  
  return {
    overall: overallScore,
    keywordDensity: Math.round(densityScore),
    readability: Math.round(readabilityScore),
    wordCount: wordCountScore,
    headingStructure: headingScore,
    suggestions
  };
}

// AI Detection scoring - analyzes content for AI-typical patterns
interface AIDetectionResult {
  score: number; // 0-100, lower is more human-like
  risk: 'low' | 'medium' | 'high';
  flaggedSections: { text: string; reason: string; severity: 'low' | 'medium' | 'high' }[];
  suggestions: string[];
}

function analyzeAIDetection(content: string): AIDetectionResult {
  const flaggedSections: { text: string; reason: string; severity: 'low' | 'medium' | 'high' }[] = [];
  const suggestions: string[] = [];
  let penaltyScore = 0;

  // AI-typical phrase patterns (heavily penalized)
  const highRiskPhrases = [
    { pattern: /in today's (?:fast-paced|digital|modern|ever-changing) (?:world|landscape|era)/gi, reason: "Classic AI opener", penalty: 15 },
    { pattern: /it's important to note that/gi, reason: "AI filler phrase", penalty: 10 },
    { pattern: /when it comes to/gi, reason: "AI transition phrase", penalty: 8 },
    { pattern: /in conclusion/gi, reason: "Formulaic conclusion", penalty: 8 },
    { pattern: /let's dive (?:in|into|deeper)/gi, reason: "AI engagement phrase", penalty: 10 },
    { pattern: /game[\s-]?changer/gi, reason: "Overused buzzword", penalty: 5 },
    { pattern: /cutting[\s-]?edge/gi, reason: "Overused buzzword", penalty: 5 },
    { pattern: /leverage\s+(?:the|your|our)/gi, reason: "Corporate AI-speak", penalty: 6 },
    { pattern: /unlock\s+(?:the|your|new)/gi, reason: "AI marketing phrase", penalty: 6 },
    { pattern: /seamlessly?\s+(?:integrate|blend|combine)/gi, reason: "AI smoothness phrase", penalty: 5 },
    { pattern: /whether you're a .+ or a/gi, reason: "AI audience addressing", penalty: 7 },
    { pattern: /at the end of the day/gi, reason: "Cliché phrase", penalty: 4 },
    { pattern: /it goes without saying/gi, reason: "AI filler", penalty: 5 },
    { pattern: /needless to say/gi, reason: "AI filler", penalty: 5 },
    { pattern: /the (?:bottom|top) line is/gi, reason: "Cliché phrase", penalty: 4 },
    { pattern: /\bin a nutshell\b/gi, reason: "Overused summary phrase", penalty: 3 },
    { pattern: /\bat its core\b/gi, reason: "AI structure phrase", penalty: 4 },
    { pattern: /\bfirst and foremost\b/gi, reason: "Formulaic opener", penalty: 4 },
    { pattern: /\blast but not least\b/gi, reason: "Formulaic list ender", penalty: 4 },
    { pattern: /\bwithout further ado\b/gi, reason: "AI transition", penalty: 5 },
    { pattern: /\bby the same token\b/gi, reason: "AI connector", penalty: 3 },
    { pattern: /\bto be fair\b/gi, reason: "AI hedging", penalty: 2 },
    { pattern: /\bnavigating the (?:complex|ever)/gi, reason: "AI complexity phrase", penalty: 6 },
    { pattern: /\bembark on (?:a|this|your) journey/gi, reason: "AI journey metaphor", penalty: 7 },
    { pattern: /\bdelve (?:into|deeper)/gi, reason: "AI exploration verb", penalty: 8 },
    { pattern: /\btap into (?:the|your)/gi, reason: "AI potential phrase", penalty: 4 },
    { pattern: /\bcrucial (?:to|for|that)/gi, reason: "AI emphasis", penalty: 3 },
    { pattern: /\brobust (?:solution|approach|strategy)/gi, reason: "AI tech-speak", penalty: 5 },
    { pattern: /\bholistic (?:approach|view|perspective)/gi, reason: "AI consulting-speak", penalty: 5 },
  ];

  // Medium risk patterns
  const mediumRiskPhrases = [
    { pattern: /\bmoreover\b/gi, reason: "Formal AI connector", penalty: 2 },
    { pattern: /\bfurthermore\b/gi, reason: "Formal AI connector", penalty: 2 },
    { pattern: /\badditionally\b/gi, reason: "AI list connector", penalty: 2 },
    { pattern: /\bconsequently\b/gi, reason: "Formal connector", penalty: 2 },
    { pattern: /\bnevertheless\b/gi, reason: "Formal connector", penalty: 2 },
    { pattern: /\bnonetheless\b/gi, reason: "Formal connector", penalty: 2 },
    { pattern: /\bthus\b/gi, reason: "Formal connector", penalty: 1 },
    { pattern: /\bhence\b/gi, reason: "Formal connector", penalty: 1 },
  ];

  // Check high-risk phrases
  for (const { pattern, reason, penalty } of highRiskPhrases) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Find context around the match
        const index = content.toLowerCase().indexOf(match.toLowerCase());
        const start = Math.max(0, index - 30);
        const end = Math.min(content.length, index + match.length + 30);
        const context = content.substring(start, end);
        
        flaggedSections.push({
          text: context,
          reason,
          severity: penalty >= 8 ? 'high' : penalty >= 5 ? 'medium' : 'low'
        });
        penaltyScore += penalty;
      }
    }
  }

  // Check medium-risk phrases (only flag if excessive)
  for (const { pattern, reason, penalty } of mediumRiskPhrases) {
    const matches = content.match(pattern) || [];
    if (matches.length > 3) { // Only flag if overused
      penaltyScore += penalty * (matches.length - 3);
      flaggedSections.push({
        text: `"${matches[0]}" used ${matches.length} times`,
        reason: `${reason} - overused`,
        severity: 'low'
      });
    }
  }

  // Sentence structure analysis
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  
  // Check for uniform sentence length (AI pattern)
  if (sentenceLengths.length > 5) {
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev < 4) { // Very uniform sentence lengths
      penaltyScore += 15;
      suggestions.push("Vary your sentence lengths more - mix short punchy sentences with longer complex ones");
    } else if (stdDev < 6) {
      penaltyScore += 8;
      suggestions.push("Consider more variation in sentence structure");
    }
  }

  // Check for lack of contractions (AI tends to be formal)
  const contractionPatterns = /\b(don't|won't|can't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|wouldn't|couldn't|shouldn't|it's|that's|there's|here's|what's|who's|how's|let's|I'm|you're|we're|they're|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|we'd|they'd)\b/gi;
  const contractions = content.match(contractionPatterns) || [];
  const contractionRate = contractions.length / (sentences.length || 1);
  
  if (contractionRate < 0.1) {
    penaltyScore += 10;
    suggestions.push("Use more contractions (don't, won't, it's) for a natural, conversational tone");
  }

  // Check for paragraph starting patterns
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);
  const startersUsed: Record<string, number> = {};
  
  for (const para of paragraphs) {
    const firstWord = para.trim().split(/\s+/)[0]?.toLowerCase() || "";
    startersUsed[firstWord] = (startersUsed[firstWord] || 0) + 1;
  }
  
  // Check for repetitive starters
  for (const [word, count] of Object.entries(startersUsed)) {
    if (count >= 3 && paragraphs.length >= 5) {
      penaltyScore += 5;
      suggestions.push(`Vary paragraph openers - "${word}" starts ${count} paragraphs`);
    }
  }

  // Check for round numbers (AI tends to use round figures)
  const roundNumbers = content.match(/\b(10|20|30|40|50|60|70|80|90|100|1000|10000)\s*%/g) || [];
  const specificNumbers = content.match(/\b([1-9][0-9]?|[1-9][1-9][0-9])\s*%/g) || [];
  
  if (roundNumbers.length > 2 && specificNumbers.length < roundNumbers.length) {
    penaltyScore += 5;
    suggestions.push("Use specific numbers (73% instead of 70%) for authenticity");
  }

  // Cap penalty score at 100
  const finalScore = Math.min(100, penaltyScore);
  
  // Determine risk level
  let risk: 'low' | 'medium' | 'high';
  if (finalScore <= 20) risk = 'low';
  else if (finalScore <= 50) risk = 'medium';
  else risk = 'high';

  // Add general suggestions based on score
  if (finalScore > 30 && !suggestions.some(s => s.includes("parenthetical"))) {
    suggestions.push("Add parenthetical asides (like this one) for a human touch");
  }
  if (finalScore > 40 && !suggestions.some(s => s.includes("opinion"))) {
    suggestions.push("Include a mildly controversial or opinionated stance");
  }
  if (finalScore > 50) {
    suggestions.push("Start some sentences with 'And' or 'But' for natural flow");
  }

  return {
    score: finalScore,
    risk,
    flaggedSections: flaggedSections.slice(0, 10), // Limit to top 10 issues
    suggestions: suggestions.slice(0, 5) // Limit to top 5 suggestions
  };
}

// Scrape website using Firecrawl for rich context
async function scrapeWebsiteWithFirecrawl(domain: string): Promise<{
  success: boolean;
  content?: string;
  title?: string;
  description?: string;
  services?: string[];
  industry?: string;
}> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) {
    console.log("Firecrawl not configured, skipping website scrape");
    return { success: false };
  }

  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    console.log("Scraping website with Firecrawl:", url);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.log("Firecrawl error:", response.status);
      return { success: false };
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const metadata = data.data?.metadata || data.metadata || {};

    // Extract services and industry from content
    const contentLower = markdown.toLowerCase();
    const detectedServices: string[] = [];
    const servicePatterns = [
      { pattern: /\b(seo|search engine optimization)\b/i, service: "SEO" },
      { pattern: /\b(ppc|pay[- ]per[- ]click|google ads)\b/i, service: "PPC Advertising" },
      { pattern: /\b(social media marketing|smm)\b/i, service: "Social Media Marketing" },
      { pattern: /\b(content marketing|blog|copywriting)\b/i, service: "Content Marketing" },
      { pattern: /\b(web design|website design|web development)\b/i, service: "Web Design" },
      { pattern: /\b(email marketing|email campaigns)\b/i, service: "Email Marketing" },
      { pattern: /\b(branding|brand strategy)\b/i, service: "Branding" },
      { pattern: /\b(video production|video marketing)\b/i, service: "Video Production" },
      { pattern: /\b(reputation management|online reviews)\b/i, service: "Reputation Management" },
      { pattern: /\b(local seo|google business|gmb)\b/i, service: "Local SEO" },
      { pattern: /\b(ecommerce|e-commerce|online store)\b/i, service: "E-Commerce" },
      { pattern: /\b(marketing automation|crm)\b/i, service: "Marketing Automation" },
      { pattern: /\b(influencer marketing)\b/i, service: "Influencer Marketing" },
      { pattern: /\b(affiliate marketing)\b/i, service: "Affiliate Marketing" },
      { pattern: /\b(consulting|strategy)\b/i, service: "Marketing Consulting" },
    ];

    for (const { pattern, service } of servicePatterns) {
      if (pattern.test(contentLower) && !detectedServices.includes(service)) {
        detectedServices.push(service);
      }
    }

    // Detect industry
    let industry = "Business Services";
    const industryPatterns = [
      { pattern: /\b(digital marketing|marketing agency|advertising agency)\b/i, industry: "Digital Marketing Agency" },
      { pattern: /\b(law firm|attorney|lawyer|legal)\b/i, industry: "Legal Services" },
      { pattern: /\b(dental|dentist|orthodont)\b/i, industry: "Dental Practice" },
      { pattern: /\b(real estate|realtor|property)\b/i, industry: "Real Estate" },
      { pattern: /\b(healthcare|medical|clinic|hospital)\b/i, industry: "Healthcare" },
      { pattern: /\b(restaurant|food|dining|catering)\b/i, industry: "Restaurant & Food Service" },
      { pattern: /\b(fitness|gym|personal training)\b/i, industry: "Fitness & Wellness" },
      { pattern: /\b(ecommerce|online store|retail)\b/i, industry: "E-Commerce & Retail" },
      { pattern: /\b(saas|software|technology|tech)\b/i, industry: "Technology & SaaS" },
      { pattern: /\b(construction|contractor|building)\b/i, industry: "Construction" },
      { pattern: /\b(financial|accounting|tax|insurance)\b/i, industry: "Financial Services" },
      { pattern: /\b(education|school|training|course)\b/i, industry: "Education" },
      { pattern: /\b(automotive|car dealer|auto repair)\b/i, industry: "Automotive" },
      { pattern: /\b(beauty|salon|spa|cosmetic)\b/i, industry: "Beauty & Wellness" },
      { pattern: /\b(travel|tourism|hotel|vacation)\b/i, industry: "Travel & Hospitality" },
    ];

    for (const { pattern, industry: ind } of industryPatterns) {
      if (pattern.test(contentLower)) {
        industry = ind;
        break;
      }
    }

    console.log("Firecrawl scrape successful:", {
      contentLength: markdown.length,
      servicesDetected: detectedServices.length,
      industry,
    });

    return {
      success: true,
      content: markdown.substring(0, 15000), // Limit for AI context
      title: metadata.title || "",
      description: metadata.description || "",
      services: detectedServices,
      industry,
    };
  } catch (e) {
    console.error("Firecrawl scrape error:", e);
    return { success: false };
  }
}

// Generate AI-based keywords when Semrush returns no data
async function generateAIKeywords(
  domain: string,
  websiteContent: string,
  services: string[],
  industry: string
): Promise<{
  quickWins: any[];
  goldenKeywords: any[];
  highOpportunity: any[];
  longTail: any[];
  questions: any[];
}> {
  console.log("Generating AI-based keywords as fallback...");

  const prompt = `You are an expert SEO strategist. Based on the following website information, generate realistic keyword opportunities.

DOMAIN: ${domain}
INDUSTRY: ${industry}
SERVICES: ${services.join(", ") || "General business services"}

WEBSITE CONTENT EXCERPT:
${websiteContent.substring(0, 5000)}

Generate keyword opportunities in this EXACT JSON format. Use realistic search volumes and difficulty scores based on industry norms:

{
  "quickWins": [
    { "keyword": "specific keyword phrase", "volume": 500, "difficulty": 25, "cpc": 2.50, "intent": "Commercial", "timeToRank": "1-2 months", "opportunityScore": 85 }
  ],
  "goldenKeywords": [
    { "keyword": "high-value keyword", "volume": 1200, "difficulty": 35, "cpc": 5.00, "intent": "Transactional", "score": 90 }
  ],
  "highOpportunity": [
    { "keyword": "opportunity keyword", "volume": 800, "difficulty": 40, "intent": "Commercial", "cpc": 3.00, "score": 75 }
  ],
  "longTail": [
    { "keyword": "long tail keyword phrase with 4+ words", "volume": 200, "difficulty": 20, "intent": "Informational" }
  ],
  "questions": [
    { "question": "what is [topic] and how does it work", "volume": 400, "difficulty": 25, "featured": true }
  ]
}

Requirements:
- Generate 8-10 quickWins (KD ≤ 30, volume ≥ 100)
- Generate 6-8 goldenKeywords (KD 20-45, volume ≥ 500, Commercial/Transactional intent)
- Generate 8-10 highOpportunity (KD ≤ 50, volume ≥ 200)
- Generate 10-12 longTail (4+ words, KD ≤ 45)
- Generate 8-10 questions (include "${domain}" relevant questions)
- Use REALISTIC volumes based on industry (don't inflate)
- Include local variations if applicable (e.g., "[service] in [city]")
- Focus on the actual services offered by this business

Return ONLY valid JSON, no markdown.`;

  try {
    const content = await callClaude(prompt, {
      system: `You are a senior SEO strategist with 20+ years of experience at Fortune 500 companies. You provide data-driven keyword research that reflects real-world search patterns.

CRITICAL: Return ONLY valid JSON with realistic, industry-accurate keyword data. Base your estimates on actual search behavior patterns for this industry.`,
      temperature: 0.6,
    });

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const keywords = JSON.parse(jsonStr);

    console.log("AI keywords generated:", {
      quickWins: keywords.quickWins?.length || 0,
      goldenKeywords: keywords.goldenKeywords?.length || 0,
      highOpportunity: keywords.highOpportunity?.length || 0,
      longTail: keywords.longTail?.length || 0,
      questions: keywords.questions?.length || 0,
    });

    return {
      quickWins: keywords.quickWins || [],
      goldenKeywords: keywords.goldenKeywords || [],
      highOpportunity: keywords.highOpportunity || [],
      longTail: keywords.longTail || [],
      questions: keywords.questions || [],
    };
  } catch (e) {
    console.error("AI keyword parsing error:", e);
    return { quickWins: [], goldenKeywords: [], highOpportunity: [], longTail: [], questions: [] };
  }
}

// Full domain analysis using enhanced Semrush API + Firecrawl
async function performFullDomainAnalysis(domain: string, semrushKey: string, customSeeds?: string[]) {
  console.log(`Starting ENHANCED full domain analysis for: ${domain}`);
  if (customSeeds?.length) {
    console.log(`Using CUSTOM SEED KEYWORDS: ${customSeeds.join(', ')}`);
  }
  
  const encodedDomain = encodeURIComponent(domain);
  
  // Phase 0: Scrape website with Firecrawl for rich context (parallel with Semrush)
  console.log("Phase 0: Scraping website with Firecrawl...");
  const firecrawlPromise = scrapeWebsiteWithFirecrawl(domain);
  
  // Phase 1: Comprehensive domain data fetch (parallel requests)
  console.log("Phase 1: Fetching comprehensive domain data from Semrush...");
  
  const [
    domainOverviewRes,
    organicKeywordsRes,
    competitorsRes,
    backlinksRes,
    trafficHistoryRes
  ] = await Promise.all([
    fetch(`https://api.semrush.com/?type=domain_rank&key=${semrushKey}&domain=${encodedDomain}&database=us&export_columns=Dn,Rk,Or,Ot,Oc,Ad,At,Ac`),
    fetch(`https://api.semrush.com/?type=domain_organic&key=${semrushKey}&domain=${encodedDomain}&database=us&export_columns=Ph,Po,Nq,Kd,Ur,Tr,Co,Cp&display_limit=100&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=domain_organic_organic&key=${semrushKey}&domain=${encodedDomain}&database=us&export_columns=Dn,Np,Or,Ot,Oc,Ad&display_limit=15`),
    fetch(`https://api.semrush.com/analytics/v1/?key=${semrushKey}&type=backlinks_overview&target=${encodedDomain}&target_type=root_domain&export_columns=total,domains_num,ascore,urls_num,ips_num`).catch(() => null),
    fetch(`https://api.semrush.com/?type=domain_rank_history&key=${semrushKey}&domain=${encodedDomain}&database=us&export_columns=Dt,Rk,Or,Ot&display_limit=12`).catch(() => null)
  ]);

  const [domainOverviewText, organicKeywordsText, competitorsText] = await Promise.all([
    domainOverviewRes.text(),
    organicKeywordsRes.text(),
    competitorsRes.text()
  ]);
  
  // Parse backlinks if available
  let backlinksData = { total: 0, domains: 0, ascore: 0 };
  if (backlinksRes) {
    try {
      const backlinksText = await backlinksRes.text();
      if (backlinksText && !backlinksText.includes("ERROR")) {
        const lines = backlinksText.trim().split('\n');
        if (lines.length > 1) {
          const values = lines[1].split(';');
          backlinksData = {
            total: parseInt(values[0]) || 0,
            domains: parseInt(values[1]) || 0,
            ascore: parseInt(values[2]) || 0
          };
        }
      }
    } catch (e) {
      console.log("Backlinks parse error:", e);
    }
  }
  
  // Parse traffic history for trend analysis
  let trafficTrend: number[] = [];
  if (trafficHistoryRes) {
    try {
      const historyText = await trafficHistoryRes.text();
      if (historyText && !historyText.includes("ERROR")) {
        const lines = historyText.trim().split('\n');
        for (let i = 1; i < Math.min(lines.length, 13); i++) {
          const values = lines[i].split(';');
          trafficTrend.push(parseInt(values[3]) || 0);
        }
      }
    } catch (e) {
      console.log("Traffic history parse error:", e);
    }
  }

  console.log("Domain overview:", domainOverviewText.substring(0, 300));
  console.log("Organic keywords sample:", organicKeywordsText.substring(0, 400));

  // Parse domain metrics
  let seoMetrics = { 
    organicKeywords: 0, 
    monthlyTraffic: 0, 
    domainAuthority: backlinksData.ascore || 0, 
    backlinks: backlinksData.total || 0,
    referringDomains: backlinksData.domains || 0,
    trafficTrend,
    trafficChange: 0
  };
  
  if (domainOverviewText && !domainOverviewText.includes("ERROR")) {
    const lines = domainOverviewText.trim().split('\n');
    if (lines.length > 1) {
      const values = lines[1].split(';');
      seoMetrics.organicKeywords = parseInt(values[2]) || 0;
      seoMetrics.monthlyTraffic = parseInt(values[3]) || 0;
      if (!seoMetrics.domainAuthority) {
        seoMetrics.domainAuthority = Math.min(100, Math.round((parseInt(values[1]) || 1000000) / 10000));
      }
    }
  }
  
  // Calculate traffic change percentage
  if (trafficTrend.length >= 2) {
    const recent = trafficTrend[0] || 1;
    const previous = trafficTrend[trafficTrend.length - 1] || 1;
    seoMetrics.trafficChange = Math.round(((recent - previous) / previous) * 100);
  }

  // Parse competitors with enhanced data
  const competitors: { domain: string; traffic: number; keywords: number; commonKeywords: number }[] = [];
  const genericDomains = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'wikipedia.org', 'amazon.com', 'google.com', 'yelp.com'];
  
  if (competitorsText && !competitorsText.includes("ERROR")) {
    const lines = competitorsText.trim().split('\n');
    for (let i = 1; i < Math.min(lines.length, 11); i++) {
      const values = lines[i].split(';');
      if (values.length >= 4) {
        const compDomain = values[0];
        if (!genericDomains.some(gd => compDomain.includes(gd))) {
          competitors.push({
            domain: compDomain,
            commonKeywords: parseInt(values[1]) || 0,
            keywords: parseInt(values[2]) || 0,
            traffic: parseInt(values[3]) || 0
          });
        }
      }
    }
  }

  // Parse existing organic keywords with enhanced data
  const existingKeywords: KeywordData[] = [];
  if (organicKeywordsText && !organicKeywordsText.includes("ERROR")) {
    const lines = organicKeywordsText.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      if (values.length >= 4) {
        existingKeywords.push({
          keyword: values[0],
          position: parseInt(values[1]) || 0,
          volume: parseInt(values[2]) || 0,
          difficulty: parseInt(values[3]) || 50,
          cpc: parseFloat(values[7]) || 0,
          score: 0
        });
      }
    }
  }

  // Phase 2: Deep keyword research with INDUSTRY-RELEVANT queries
  console.log("Phase 2: Deep keyword opportunity research...");
  
  // CRITICAL FIX: Extract INDUSTRY-RELEVANT seed phrases, not just first keywords
  // Filter out branded terms, login keywords, and single-word generic terms
  const domainName = domain.replace(/\.(com|net|org|io|co|biz|agency)$/i, '').replace(/[.-]/g, '').toLowerCase();
  const brandedTerms = [domainName, 'login', 'sign in', 'portal', 'app', 'suite', 'dashboard'];
  
  // Find SERVICE-FOCUSED keywords (multi-word, describe what the business does)
  const serviceKeywords = existingKeywords.filter(k => {
    const kw = k.keyword.toLowerCase();
    // Exclude branded, login, or single-word keywords
    if (brandedTerms.some(term => kw.includes(term))) return false;
    if (k.keyword.split(' ').length < 2) return false;
    // Prefer keywords that indicate services
    return true;
  }).sort((a, b) => b.volume - a.volume);
  
  console.log("Service keywords identified:", serviceKeywords.slice(0, 5).map(k => k.keyword).join(', '));
  
  // Extract the CORE SERVICE from best keywords (e.g., "los angeles digital marketing" -> "digital marketing")
  const extractServicePhrase = (keyword: string): string => {
    // Remove location prefixes/suffixes
    const locationPatterns = /\b(los angeles|new york|san francisco|chicago|houston|miami|dallas|seattle|boston|atlanta|denver|phoenix|in \w+|near me|\w+ county)\b/gi;
    let cleaned = keyword.replace(locationPatterns, '').trim();
    // Remove common modifiers
    cleaned = cleaned.replace(/\b(best|top|professional|affordable|cheap|local|online|services?|agency|company|companies|firm|consultant|consulting)\b/gi, '').trim();
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned || keyword;
  };
  
  // Get unique service phrases
  const servicePhrases = new Set<string>();
  serviceKeywords.forEach(k => {
    const phrase = extractServicePhrase(k.keyword);
    if (phrase.length > 3 && phrase.split(' ').length >= 1) {
      servicePhrases.add(phrase.toLowerCase());
    }
  });
  
  // Also extract full service phrases for broader searches
  const fullServicePhrases = serviceKeywords.slice(0, 5).map(k => k.keyword);
  
  // Primary seed: USE CUSTOM SEEDS if provided, otherwise use detected service keywords
  const serviceArray = Array.from(servicePhrases);
  let primarySeed = '';
  let secondarySeed = '';
  let tertiarySeed = '';
  
  // PRIORITY 1: Use custom seeds if provided by user
  if (customSeeds && customSeeds.length > 0) {
    primarySeed = customSeeds[0];
    secondarySeed = customSeeds[1] || '';
    tertiarySeed = customSeeds[2] || '';
    console.log("Using USER-PROVIDED custom seeds");
  } 
  // PRIORITY 2: Use auto-detected service keywords
  else if (serviceArray.length > 0) {
    primarySeed = serviceArray[0];
    secondarySeed = serviceArray[1] || '';
    tertiarySeed = serviceArray[2] || '';
    console.log("Using AUTO-DETECTED service keywords");
  }
  // PRIORITY 3: Fallback - infer industry from existing keywords
  else {
    const allText = existingKeywords.map(k => k.keyword).join(' ').toLowerCase();
    if (allText.includes('marketing') || allText.includes('seo') || allText.includes('ppc') || allText.includes('advertising')) {
      primarySeed = 'digital marketing';
      secondarySeed = 'seo services';
      tertiarySeed = 'ppc advertising';
    } else if (allText.includes('law') || allText.includes('attorney') || allText.includes('lawyer')) {
      primarySeed = 'lawyer services';
      secondarySeed = 'attorney consultation';
    } else if (allText.includes('dental') || allText.includes('dentist')) {
      primarySeed = 'dental services';
      secondarySeed = 'dentist office';
    } else if (allText.includes('real estate') || allText.includes('realtor') || allText.includes('homes')) {
      primarySeed = 'real estate agent';
      secondarySeed = 'homes for sale';
    } else if (allText.includes('software') || allText.includes('saas') || allText.includes('tech')) {
      primarySeed = 'software solutions';
      secondarySeed = 'saas platform';
    } else {
      // Last resort: use the best multi-word keyword as-is
      primarySeed = fullServicePhrases[0] || domainName;
      secondarySeed = fullServicePhrases[1] || '';
    }
    console.log("Using FALLBACK industry inference");
  }
  
  console.log("Research seeds selected - Primary:", primarySeed, "| Secondary:", secondarySeed, "| Tertiary:", tertiarySeed);
  
  const encodedPrimary = encodeURIComponent(primarySeed);
  const encodedSecondary = secondarySeed ? encodeURIComponent(secondarySeed) : encodedPrimary;
  const encodedTertiary = tertiarySeed ? encodeURIComponent(tertiarySeed) : encodedPrimary;
  
  // Run parallel keyword research with INDUSTRY-FOCUSED seeds
  const [
    phraseMatchRes,
    relatedRes,
    questionsRes,
    lowKdRes,
    secondaryMatchRes,
    tertiaryMatchRes
  ] = await Promise.all([
    fetch(`https://api.semrush.com/?type=phrase_fullsearch&key=${semrushKey}&phrase=${encodedPrimary}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=60&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=phrase_related&key=${semrushKey}&phrase=${encodedPrimary}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=60&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=phrase_questions&key=${semrushKey}&phrase=${encodedPrimary}&database=us&export_columns=Ph,Nq,Kd&display_limit=30&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=phrase_fullsearch&key=${semrushKey}&phrase=${encodedPrimary}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=40&display_sort=kd_asc`),
    fetch(`https://api.semrush.com/?type=phrase_fullsearch&key=${semrushKey}&phrase=${encodedSecondary}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=40&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=phrase_fullsearch&key=${semrushKey}&phrase=${encodedTertiary}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=30&display_sort=nq_desc`).catch(() => null)
  ]);

  const [phraseMatchText, relatedText, questionsText, lowKdText, secondaryMatchText] = await Promise.all([
    phraseMatchRes.text(),
    relatedRes.text(),
    questionsRes.text(),
    lowKdRes.text(),
    secondaryMatchRes.text()
  ]);
  
  let tertiaryMatchText = '';
  if (tertiaryMatchRes) {
    try {
      tertiaryMatchText = await tertiaryMatchRes.text();
    } catch (e) {
      console.log("Tertiary seed parse error:", e);
    }
  }
  
  console.log("Phrase match sample:", phraseMatchText.substring(0, 300));
  console.log("Questions sample:", questionsText.substring(0, 300));

  // Parse all keyword data from industry-relevant searches
  const allKeywords = [
    ...parseSemrushCSV(phraseMatchText, true),
    ...parseSemrushCSV(relatedText, true),
    ...parseSemrushCSV(lowKdText, true),
    ...parseSemrushCSV(secondaryMatchText, true),
    ...(tertiaryMatchText ? parseSemrushCSV(tertiaryMatchText, true) : [])
  ];

  // Deduplicate and score
  const seenKeywords = new Set<string>();
  const uniqueKeywords = allKeywords.filter(kw => {
    if (seenKeywords.has(kw.keyword.toLowerCase())) return false;
    seenKeywords.add(kw.keyword.toLowerCase());
    return true;
  });

  // Enhanced Quick wins: KD <= 30, volume >= 100, with CPC data
  const quickWins = uniqueKeywords
    .filter(kw => kw.difficulty <= 30 && kw.volume >= 100)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 15)
    .map(kw => ({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      cpc: kw.cpc || 0,
      intent: kw.intent || "Informational",
      timeToRank: kw.difficulty <= 10 ? "2-4 weeks" : kw.difficulty <= 20 ? "1-2 months" : "2-3 months",
      opportunityScore: kw.score || 0
    }));

  // Golden Keywords: High volume + Medium difficulty + Commercial intent
  const goldenKeywords = uniqueKeywords
    .filter(kw => kw.difficulty >= 20 && kw.difficulty <= 45 && kw.volume >= 500 && (kw.intent === "Commercial" || kw.intent === "Transactional"))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .map(kw => ({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      cpc: kw.cpc || 0,
      intent: kw.intent || "Commercial",
      score: kw.score || 0
    }));

  // High opportunity: KD <= 50, volume >= 200
  const highOpportunity = uniqueKeywords
    .filter(kw => kw.difficulty <= 50 && kw.volume >= 200)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 15)
    .map(kw => ({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      intent: kw.intent || "Informational",
      cpc: kw.cpc || 0,
      score: kw.score || 0
    }));

  // Long-tail with intent: 4+ words, KD <= 45
  const longTail = uniqueKeywords
    .filter(kw => kw.keyword.split(' ').length >= 4 && kw.difficulty <= 45 && kw.volume >= 50)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 20)
    .map(kw => ({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      intent: kw.intent || "Informational"
    }));

  // Parse questions with enhanced data
  const questions: { question: string; volume: number; difficulty?: number; featured?: boolean }[] = [];
  if (questionsText && !questionsText.includes("ERROR")) {
    const lines = questionsText.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      if (values.length >= 2) {
        const question = values[0];
        const volume = parseInt(values[1]) || 0;
        const difficulty = parseInt(values[2]) || 30;
        questions.push({
          question,
          volume,
          difficulty,
          featured: difficulty <= 25 && volume >= 100 // Likely to have featured snippet opportunity
        });
      }
    }
  }
  
  // Analyze SERP features opportunities
  const serpFeatures = analyzeSerpFeatures(uniqueKeywords, domain);

  // Phase 3: Competitor keyword gap analysis
  console.log("Phase 3: Competitor gap analysis...");
  
  let keywordGaps: { keyword: string; volume: number; difficulty: number; competitorDomain: string }[] = [];
  if (competitors.length > 0) {
    const topCompetitor = competitors[0].domain;
    try {
      const gapRes = await fetch(`https://api.semrush.com/?type=domain_domains&key=${semrushKey}&export_columns=Ph,Nq,Kd&domains=${encodedDomain}|or|${topCompetitor}|or&database=us&display_limit=20&display_filter=%2B|P0|Eq|0&display_sort=nq_desc`);
      const gapText = await gapRes.text();
      
      if (gapText && !gapText.includes("ERROR")) {
        const lines = gapText.trim().split('\n');
        for (let i = 1; i < lines.length && keywordGaps.length < 15; i++) {
          const values = lines[i].split(';');
          if (values.length >= 3) {
            keywordGaps.push({
              keyword: values[0],
              volume: parseInt(values[1]) || 0,
              difficulty: parseInt(values[2]) || 0,
              competitorDomain: topCompetitor
            });
          }
        }
      }
    } catch (e) {
      console.log("Keyword gap error:", e);
    }
  }

  // Phase 4: AI-powered content strategy
  console.log("Phase 4: Generating AI-powered content strategy...");

  const keywordContext = `
DOMAIN ANALYSIS FOR: ${domain}

CURRENT RANKINGS:
${existingKeywords.slice(0, 10).map(k => `- "${k.keyword}" (Position: ${k.position}, Vol: ${k.volume}, KD: ${k.difficulty})`).join('\n')}

QUICK WIN OPPORTUNITIES (Low KD, High Volume):
${quickWins.slice(0, 8).map(k => `- "${k.keyword}" (Vol: ${k.volume}, KD: ${k.difficulty}, CPC: $${k.cpc}, Intent: ${k.intent})`).join('\n')}

GOLDEN KEYWORDS (Commercial Intent + Rankable):
${goldenKeywords.slice(0, 5).map(k => `- "${k.keyword}" (Vol: ${k.volume}, KD: ${k.difficulty}, Intent: ${k.intent})`).join('\n')}

QUESTIONS PEOPLE ASK:
${questions.slice(0, 10).map(q => `- "${q.question}" (Vol: ${q.volume}${q.featured ? ' ⭐ Featured Snippet Opportunity' : ''})`).join('\n')}

TOP COMPETITORS:
${competitors.slice(0, 5).map(c => `- ${c.domain} (Traffic: ${c.traffic}, Keywords: ${c.keywords})`).join('\n')}

KEYWORD GAPS (Competitor ranks, you don't):
${keywordGaps.slice(0, 8).map(g => `- "${g.keyword}" (Vol: ${g.volume}, KD: ${g.difficulty})`).join('\n')}

SERP FEATURES OPPORTUNITIES:
${serpFeatures.map(f => `- ${f.type}: ${f.opportunity}`).join('\n')}
`;

  const aiPrompt = `You are a world-class SEO strategist analyzing "${domain}". Based on this REAL Semrush data, create a comprehensive content strategy:

${keywordContext}

SEO METRICS:
- Organic Keywords: ${seoMetrics.organicKeywords}
- Monthly Traffic: ${seoMetrics.monthlyTraffic} (${seoMetrics.trafficChange > 0 ? '+' : ''}${seoMetrics.trafficChange}% trend)
- Domain Authority: ${seoMetrics.domainAuthority}
- Backlinks: ${seoMetrics.backlinks}

Generate a COMPLETE SEO strategy JSON with:

1. businessInfo: { name, industry, description, services (array) } - Infer from the keywords and domain

2. blogTopics: EXACTLY 8 blog post ideas targeting the ACTUAL keywords above. Each must have:
   - title: Compelling, SEO-optimized title (include target keyword naturally)
   - targetKeyword: EXACT keyword from the data above
   - searchVolume: Use ACTUAL volume from data
   - difficulty: Use ACTUAL KD from data
   - outline: Array of 5-6 H2 headings
   - estimatedTraffic: Realistic estimate if ranking top 3
   - contentType: "guide" | "listicle" | "comparison" | "tutorial" | "case-study"
   - featuredSnippetOpportunity: boolean

3. metaTags: {
   homepage: { title (max 60 chars), description (max 155 chars) },
   services: Array of 4 service page meta tags based on inferred services
}

4. contentGaps: 5 topics from the keyword gap data with:
   - topic, competitorsCovering (1-5), opportunity (explanation), priority ("high" | "medium")

5. recommendations: 8 prioritized SEO actions:
   - priority: "critical" | "high" | "medium" | "low"
   - action: Specific action
   - impact: Expected result with metrics
   - timeframe: Realistic timeline
   - category: "technical" | "content" | "backlinks" | "local"

6. contentCalendar: Monthly publishing schedule for next 3 months:
   - month: "Month 1" | "Month 2" | "Month 3"
   - topics: Array of 2-3 blog titles from blogTopics
   - focus: Main theme for the month

Return ONLY valid JSON. Use ACTUAL keyword data, not invented numbers.`;

  let aiData;
  try {
    const aiContent = await callClaude(aiPrompt, {
      system: `You are a world-class SEO strategist who has led organic growth campaigns for major brands. You create data-driven, actionable SEO strategies using real keyword data.

CRITICAL RULES:
- Use the EXACT keyword data provided - never fabricate or round numbers
- Generate genuinely useful blog topics that would rank and convert
- Create meta tags that drive clicks while being SEO-optimized
- Provide strategic recommendations based on the actual competitive landscape`,
      temperature: 0.6,
    });

    console.log("AI response length:", aiContent.length);

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiContent.trim();
    aiData = JSON.parse(jsonStr);
  } catch (e) {
    console.error("AI parse error:", e);
    // Fallback data
    aiData = {
      businessInfo: {
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        industry: "Business Services",
        description: "Professional services company",
        services: existingKeywords.slice(0, 4).map(k => k.keyword)
      },
      blogTopics: quickWins.slice(0, 8).map(kw => ({
        title: `Complete Guide to ${kw.keyword.charAt(0).toUpperCase() + kw.keyword.slice(1)}`,
        targetKeyword: kw.keyword,
        searchVolume: kw.volume,
        difficulty: kw.difficulty,
        outline: ["Introduction", "Key Benefits", "How It Works", "Best Practices", "Common Mistakes", "Conclusion"],
        estimatedTraffic: `${Math.round(kw.volume * 0.25)}-${Math.round(kw.volume * 0.4)}/mo`,
        contentType: "guide",
        featuredSnippetOpportunity: kw.difficulty <= 25
      })),
      metaTags: {
        homepage: { title: `${domain} - Professional Solutions`, description: `Discover premium services from ${domain}. Expert solutions tailored to your needs.` },
        services: []
      },
      contentGaps: keywordGaps.slice(0, 5).map(g => ({
        topic: g.keyword,
        competitorsCovering: Math.floor(Math.random() * 3) + 2,
        opportunity: `Competitor ${g.competitorDomain} ranks for this. Create better content to capture ${g.volume}/mo searches.`,
        priority: g.volume > 500 ? "high" : "medium"
      })),
      recommendations: [
        { priority: "critical", action: "Target quick win keywords immediately", impact: "Rank for 5-10 keywords within 2-3 months", timeframe: "1-3 months", category: "content" },
        { priority: "high", action: "Create FAQ schema for question keywords", impact: "Capture featured snippets and PAA boxes", timeframe: "1-2 months", category: "technical" },
        { priority: "high", action: "Fill content gaps from competitor analysis", impact: "Capture competitor traffic", timeframe: "2-4 months", category: "content" }
      ],
      contentCalendar: [
        { month: "Month 1", topics: quickWins.slice(0, 2).map(k => k.keyword), focus: "Quick Wins" },
        { month: "Month 2", topics: goldenKeywords.slice(0, 2).map(k => k.keyword), focus: "Commercial Keywords" },
        { month: "Month 3", topics: keywordGaps.slice(0, 2).map(k => k.keyword), focus: "Competitor Gaps" }
      ]
    };
  }

  // Await Firecrawl result
  const firecrawlData = await firecrawlPromise;
  console.log("Firecrawl result:", firecrawlData.success ? "success" : "failed");

  // Check if Semrush returned no useful keyword data - use AI fallback
  const semrushHasNoData = quickWins.length === 0 && goldenKeywords.length === 0 && highOpportunity.length === 0;
  let finalQuickWins = quickWins;
  let finalGoldenKeywords = goldenKeywords;
  let finalHighOpportunity = highOpportunity;
  let finalLongTail = longTail;
  let finalQuestions = questions;
  let dataSource: "semrush" | "ai" | "hybrid" = "semrush";

  if (semrushHasNoData && firecrawlData.success) {
    console.log("Semrush returned no keyword data - falling back to AI generation with Firecrawl context");
    
    const aiKeywords = await generateAIKeywords(
      domain,
      firecrawlData.content || "",
      firecrawlData.services || [],
      firecrawlData.industry || "Business Services"
    );

    finalQuickWins = aiKeywords.quickWins;
    finalGoldenKeywords = aiKeywords.goldenKeywords;
    finalHighOpportunity = aiKeywords.highOpportunity;
    finalLongTail = aiKeywords.longTail;
    finalQuestions = aiKeywords.questions.map(q => ({
      question: q.question,
      volume: q.volume,
      difficulty: q.difficulty || 30,
      featured: q.featured || false
    }));
    dataSource = "ai";
  } else if (semrushHasNoData) {
    // Semrush failed and no Firecrawl - still try AI with minimal context
    console.log("Both Semrush and Firecrawl failed - generating AI keywords with minimal context");
    
    const aiKeywords = await generateAIKeywords(
      domain,
      `Website for ${domain}`,
      [],
      "Business Services"
    );

    finalQuickWins = aiKeywords.quickWins;
    finalGoldenKeywords = aiKeywords.goldenKeywords;
    finalHighOpportunity = aiKeywords.highOpportunity;
    finalLongTail = aiKeywords.longTail;
    finalQuestions = aiKeywords.questions.map(q => ({
      question: q.question,
      volume: q.volume,
      difficulty: q.difficulty || 30,
      featured: q.featured || false
    }));
    dataSource = "ai";
  } else if (firecrawlData.success) {
    // Both sources have data - hybrid mode
    dataSource = "hybrid";
  }

  // Enhance business info with Firecrawl data if available
  let enhancedBusinessInfo = aiData.businessInfo || { name: domain, industry: "General", description: "", services: [] };
  if (firecrawlData.success) {
    enhancedBusinessInfo = {
      ...enhancedBusinessInfo,
      name: enhancedBusinessInfo.name || firecrawlData.title?.split('|')[0]?.trim() || domain.split('.')[0],
      industry: firecrawlData.industry || enhancedBusinessInfo.industry,
      services: (firecrawlData.services?.length || 0) > 0 ? firecrawlData.services : enhancedBusinessInfo.services,
      description: enhancedBusinessInfo.description || firecrawlData.description || "",
    };
  }

  // Return comprehensive analysis
  return {
    domain,
    businessInfo: enhancedBusinessInfo,
    seoMetrics,
    keywords: {
      quickWins: finalQuickWins,
      goldenKeywords: finalGoldenKeywords,
      highOpportunity: finalHighOpportunity,
      longTail: finalLongTail,
      questions: finalQuestions.slice(0, 15),
      keywordGaps: keywordGaps.slice(0, 10),
      existingRankings: existingKeywords.slice(0, 20).map(k => ({
        keyword: k.keyword,
        position: k.position,
        volume: k.volume,
        difficulty: k.difficulty
      }))
    },
    blogTopics: aiData.blogTopics || [],
    metaTags: aiData.metaTags || { homepage: { title: domain, description: "" }, services: [] },
    contentGaps: aiData.contentGaps || [],
    recommendations: aiData.recommendations || [],
    contentCalendar: aiData.contentCalendar || [],
    serpFeatures,
    competitors,
    source: dataSource,
    websiteScraped: firecrawlData.success
  };
}

// Generate optimized content with scoring
async function generateFullContent(
  domain: string,
  businessInfo: any,
  selections: {
    blogTopics: any[];
    metaPages: string[];
    metaTagsData: any;
    questions: any[];
    keywords: string[];
  },
  onProgress?: (progress: number, message: string) => void | Promise<void>
) {
  console.log(`Generating premium content for ${domain}`);
  console.log(`Blog topics: ${selections.blogTopics.length}, Questions: ${selections.questions.length}`);

  await onProgress?.(10, "Preparing your selections...");

  const results: {
    blogPosts: { title: string; targetKeyword: string; fullContent: string; wordCount: number; contentScore: ContentScore }[];
    metaTags: { page: string; title: string; description: string; charCount: { title: number; description: number } }[];
    faqContent: { question: string; answer: string; wordCount: number }[];
    schemaMarkup: { type: string; markup: string }[];
  } = {
    blogPosts: [],
    metaTags: [],
    faqContent: [],
    schemaMarkup: []
  };

  // Generate blog posts with enhanced prompts
  if (selections.blogTopics && selections.blogTopics.length > 0) {
    console.log("Generating SEO-optimized blog posts...");
    console.log(`Blog topics received: ${JSON.stringify(selections.blogTopics.map((t: any) => ({ title: t?.title, keyword: t?.targetKeyword })))}`);
    
    const validTopics = selections.blogTopics.filter((t: any) => t && t.title && t.targetKeyword);
    console.log(`Valid topics to process: ${validTopics.length}`);
    
    const totalBlogs = validTopics.length;
    for (let i = 0; i < validTopics.length; i++) {
      const topic = validTopics[i];
      const pct = totalBlogs > 0 ? i / totalBlogs : 0;
      const progress = Math.min(65, 20 + Math.round(pct * 45));
      await onProgress?.(
        progress,
        `Writing SEO-optimized blog content (${i + 1}/${totalBlogs})...`
      );

      // Calculate appropriate length based on content type
      const blogTargetWords = topic.contentType === 'listicle' ? 1200 : topic.contentType === 'comparison' ? 1500 : 1800;
      const blogSectionCount = Math.min(6, Math.max(3, Math.ceil(blogTargetWords / 300)));
      
      const blogPrompt = `Write a focused, cohesive ${topic.contentType || 'guide'} for "${businessInfo.name || domain}".

TOPIC: ${topic.title}
KEYWORD: ${topic.targetKeyword}
WORD COUNT: ${blogTargetWords} words (strict - no more, no less)

###############################################
# COHESION RULES - CRITICAL                   #
###############################################
1. ONE PURPOSE: This is a ${topic.contentType || 'guide'}. Not a manifesto or encyclopedia.
2. NARRATIVE FLOW: Every section connects to the previous one with transitions.
3. SHORT HEADINGS: H2 headings must be 3-6 words max.
4. NO STITCHED SECTIONS: Read as ONE piece, not multiple mini-articles.

OUTLINE (${blogSectionCount} sections max):
${(topic.outline || []).slice(0, blogSectionCount).join(', ')}

STRUCTURE FOR ${blogTargetWords} WORDS:
- Introduction: 100-150 words (hook + what they'll learn)
- Body: ${blogSectionCount} sections, ~${Math.round((blogTargetWords * 0.7) / blogSectionCount)} words each
- Conclusion: 100-150 words (key takeaway)

TRANSITIONS TO USE:
- "Building on that..." / "With that foundation..."
- "Now that we've covered X, let's look at Y..."
- "This leads us to..."

COMPANY RULE: Only mention "${businessInfo.name || domain}" - no invented company names.

WRITING STYLE:
- Simple, clear language
- Short paragraphs (2-3 sentences)
- ONE bullet list per section (3-5 bullets)
- No em dashes (—), no bold (**), no emojis
- Use contractions naturally

SEO: Include "${topic.targetKeyword}" 2-4 times naturally.

AVOID: "In today's world", "It's important to note", "When it comes to", "Let's dive in"

OUTPUT: Only the article. Ready to publish.`;

      try {
        console.log(`Generating blog for: ${topic.title}`);

        const rawContent = await callClaude(blogPrompt, {
          system: `You are a focused content writer who respects word counts and writes cohesive articles.

CRITICAL RULES:
1. WORD COUNT: Write exactly ${blogTargetWords} words. Not more.
2. COHESION: The article flows as ONE piece with clear transitions.
3. SHORT HEADINGS: 3-6 words max per H2.
4. NO HALLUCINATED COMPANIES: Only mention "${businessInfo.name || domain}".

For ${blogTargetWords} words: ${blogSectionCount} H2 sections, ~${Math.round(blogTargetWords / (blogSectionCount + 2))} words each.

OUTPUT: Only the article. No explanations.`,
          temperature: 0.75,
          maxTokens: Math.ceil(blogTargetWords * 1.8),
        });

        if (!rawContent) {
          console.error(`No content in response for "${topic.title}"`);
          continue;
        }

        // CRITICAL: Clean em dashes and formatting from generated content
        const content = cleanGeneratedContent(rawContent);

        const wordCount = content.split(/\s+/).length;
        const contentScore = calculateContentScore(content, topic.targetKeyword);

        console.log(`Blog generated: ${topic.title}, ${wordCount} words`);

        results.blogPosts.push({
          title: topic.title,
          targetKeyword: topic.targetKeyword,
          fullContent: content,
          wordCount,
          contentScore
        });

        const pctAfter = totalBlogs > 0 ? (i + 1) / totalBlogs : 1;
        const progressAfter = Math.min(70, 20 + Math.round(pctAfter * 50));
        await onProgress?.(
          progressAfter,
          `Finished blog ${i + 1}/${totalBlogs}. Calculating content score...`
        );
      } catch (e) {
        console.error(`Blog generation error for "${topic.title}":`, e instanceof Error ? e.message : String(e));
      }
    }
  }

  await onProgress?.(75, "Generating meta tags & schema markup...");

  // Generate optimized meta tags
  if (selections.metaPages.length > 0) {
    console.log("Generating meta tags...");
    
    const metaPrompt = `Generate SEO-optimized meta tags for "${businessInfo.name || domain}" (${businessInfo.industry || 'business'}).

Pages to optimize:
${selections.metaPages.map(page => {
  if (page === 'homepage') {
    return `- Homepage: Current - "${selections.metaTagsData?.homepage?.title || 'Homepage'}"`;
  }
  const idx = parseInt(page.replace('service-', ''));
  const service = selections.metaTagsData?.services?.[idx];
  return `- Service Page ${idx + 1}: ${service?.title || 'Service'}`;
}).join('\n')}

For each page provide:
1. Title tag: 50-60 characters, primary keyword near start, brand at end
2. Meta description: 145-155 characters, include keyword, compelling CTA, unique selling point

Return ONLY valid JSON array:
[{"page": "Homepage", "title": "...", "description": "..."}]`;

    try {
      const content = await callClaude(metaPrompt, {
        system: "You are a senior digital marketing strategist specializing in conversion optimization. Create meta tags that drive qualified clicks while maintaining SEO best practices. Return only valid JSON array.",
        temperature: 0.5,
      });

      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      const metaTags = JSON.parse(jsonStr);

      if (Array.isArray(metaTags)) {
        results.metaTags = metaTags.map(tag => ({
          ...tag,
          charCount: {
            title: tag.title?.length || 0,
            description: tag.description?.length || 0
          }
        }));
      }
    } catch (e) {
      console.error("Meta tags error:", e);
    }
  }

  // Generate FAQ content with schema
  if (selections.questions.length > 0) {
    console.log("Generating FAQ content...");

    await onProgress?.(88, "Creating FAQ answers...");
    
    const faqPrompt = `You are a subject matter expert writing FAQ answers for "${businessInfo.name || domain}" (${businessInfo.industry || 'business'}).

Questions to answer:
${selections.questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}

WRITING STANDARDS:
1. Write comprehensive answers (200-300 words each)
2. Start with a direct, authoritative answer (first 1-2 sentences)
3. Expand with practical details, specific examples, and nuanced considerations
4. Write like a trusted industry expert speaking to a peer
5. Include the occasional "that said" or "however" to show balanced thinking
6. Use specific numbers and data points where relevant
7. AVOID: "It's important to note", "When it comes to", generic corporate speak

The answers should sound like they were written by a senior professional with decades of experience, not a content mill.

Return ONLY valid JSON:
[{"question": "...", "answer": "..."}]`;

    try {
      const content = await callClaude(faqPrompt, {
        system: "You are an experienced industry professional providing helpful, accurate FAQ answers. Your answers are thorough yet accessible, authoritative yet personable. They should read like advice from a trusted colleague, not corporate boilerplate. Return only valid JSON.",
        temperature: 0.7,
      });

      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      const faqContent = JSON.parse(jsonStr);

      if (Array.isArray(faqContent)) {
        results.faqContent = faqContent.map(faq => ({
          ...faq,
          wordCount: faq.answer?.split(/\s+/).length || 0
        }));

        // Generate FAQ schema markup
        const faqSchema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqContent.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          }))
        };

        results.schemaMarkup.push({
          type: "FAQ",
          markup: JSON.stringify(faqSchema, null, 2)
        });
      }
    } catch (e) {
      console.error("FAQ generation error:", e);
    }
  }

  console.log(`Content complete: ${results.blogPosts.length} blogs, ${results.metaTags.length} meta tags, ${results.faqContent.length} FAQs`);
  await onProgress?.(95, "Finalizing content...");
  return results;
}

// Advanced options for topic writer
interface TopicWriterOptions {
  formatReferenceUrl?: string;
  targetWordCount: number;
  writingPerson: 'first' | 'third';
  targetAudience?: string;
  tonesOfVoice?: string[];
  brandName?: string;
  brandProduct?: string;
  backlinksUrls?: string;
}

// TOPIC WRITER - Deep research + automatic article generation
async function generateTopicArticle(
  topic: string,
  domain: string | undefined,
  semrushKey: string,
  onProgress?: (progress: number, message: string) => void | Promise<void>,
  options?: TopicWriterOptions
) {
  console.log(`Topic Writer starting for: "${topic}"`);
  console.log(`Options:`, JSON.stringify(options || {}));
  await onProgress?.(5, "Analyzing topic & search intent...");
  
  // Step 1: Extract primary keyword from topic and research via Semrush
  const topicWords = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const encodedTopic = encodeURIComponent(topicWords);
  
  console.log("Step 1: Researching keywords for topic...");
  await onProgress?.(15, "Researching keywords via Semrush API...");
  
  // Parallel keyword research
  const [
    phraseMatchRes,
    relatedRes,
    questionsRes
  ] = await Promise.all([
    fetch(`https://api.semrush.com/?type=phrase_fullsearch&key=${semrushKey}&phrase=${encodedTopic}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=30&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=phrase_related&key=${semrushKey}&phrase=${encodedTopic}&database=us&export_columns=Ph,Nq,Kd,Co,Cp&display_limit=20&display_sort=nq_desc`),
    fetch(`https://api.semrush.com/?type=phrase_questions&key=${semrushKey}&phrase=${encodedTopic}&database=us&export_columns=Ph,Nq,Kd&display_limit=15&display_sort=nq_desc`)
  ]);
  
  const [phraseMatchText, relatedText, questionsText] = await Promise.all([
    phraseMatchRes.text(),
    relatedRes.text(),
    questionsRes.text()
  ]);
  
  // Parse keywords
  const allKeywords = [
    ...parseSemrushCSV(phraseMatchText, true),
    ...parseSemrushCSV(relatedText, true)
  ];
  
  // Deduplicate
  const seenKw = new Set<string>();
  const uniqueKeywords = allKeywords.filter(k => {
    if (seenKw.has(k.keyword.toLowerCase())) return false;
    seenKw.add(k.keyword.toLowerCase());
    return true;
  });
  
  // CRITICAL: Always use the user's EXACT topic as the primary keyword
  // Semrush often returns typos, partial matches, or irrelevant variations
  // The user knows their topic best - trust their input
  const primaryKeyword = topic.trim();
  
  // Filter Semrush keywords to ensure they're valid (no typos, no partial words)
  // A valid keyword should be at least 3 characters and not truncated
  const validKeywords = uniqueKeywords.filter(k => {
    const kw = k.keyword.toLowerCase();
    // Skip if too short (likely truncated)
    if (kw.length < 4) return false;
    // Skip if it looks like a truncated version of the topic
    const topicLower = topic.toLowerCase();
    if (topicLower.includes(kw) && kw.length < topicLower.length * 0.7) return false;
    // Skip if it's a truncated word that doesn't exist in English
    // Common truncation patterns: ends abruptly, missing common suffixes
    const suspiciousTruncations = ['tutoria', 'tutori', 'tutor ', 'angele', 'angel '];
    if (suspiciousTruncations.some(t => kw.includes(t))) return false;
    return true;
  });
  
  const secondaryKeywords = validKeywords
    .filter(k => k.keyword.toLowerCase() !== primaryKeyword.toLowerCase())
    .slice(0, 8)
    .map(k => k.keyword);
  
  // Parse questions
  const questions: string[] = [];
  if (questionsText && !questionsText.includes("ERROR")) {
    const lines = questionsText.trim().split('\n');
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const values = lines[i].split(';');
      if (values[0]) questions.push(values[0]);
    }
  }
  
  console.log(`Using primary keyword: "${primaryKeyword}" (user's exact topic), ${secondaryKeywords.length} secondary, ${questions.length} questions`);
  await onProgress?.(25, "Analyzing SERP competition...");
  
  // Step 2: Determine search intent
  const intentKeywords = {
    transactional: ['buy', 'price', 'cost', 'deal', 'discount', 'order', 'purchase', 'hire', 'service'],
    commercial: ['best', 'top', 'review', 'vs', 'compare', 'comparison', 'alternative'],
    informational: ['what', 'how', 'why', 'when', 'guide', 'tutorial', 'tips', 'learn'],
    navigational: ['login', 'website', 'near me', 'location', 'contact']
  };
  
  let searchIntent = 'Informational';
  const topicLower = topic.toLowerCase();
  if (intentKeywords.transactional.some(k => topicLower.includes(k))) searchIntent = 'Transactional';
  else if (intentKeywords.commercial.some(k => topicLower.includes(k))) searchIntent = 'Commercial Investigation';
  else if (intentKeywords.navigational.some(k => topicLower.includes(k))) searchIntent = 'Navigational';
  
  // Step 3: Analyze competition (simulated based on keyword data)
  const avgDifficulty = uniqueKeywords.length > 0 
    ? Math.round(uniqueKeywords.reduce((sum, k) => sum + k.difficulty, 0) / uniqueKeywords.length)
    : 50;
  
  const competitorAnalysis = {
    avgWordCount: avgDifficulty > 60 ? 2500 : avgDifficulty > 40 ? 1800 : 1200,
    avgHeadings: avgDifficulty > 60 ? 12 : avgDifficulty > 40 ? 8 : 6,
    commonTopics: secondaryKeywords.slice(0, 5),
    contentGaps: [] as string[]
  };
  
  // Step 4: Identify content gaps using AI
  console.log("Step 2: Identifying content gaps and SERP features...");
  await onProgress?.(35, "Identifying content gaps...");
  
  const gapAnalysisPrompt = `Analyze this topic for SEO content opportunities:

TOPIC: ${topic}
PRIMARY KEYWORD: ${primaryKeyword}
RELATED KEYWORDS: ${secondaryKeywords.join(', ')}
QUESTIONS PEOPLE ASK: ${questions.slice(0, 5).join('; ')}
SEARCH INTENT: ${searchIntent}

Identify:
1. 5 content gaps that competitors likely miss
2. SERP features this content could target (Featured Snippet, PAA, Video, etc.)
3. Unique angles to differentiate this content

Return JSON: { "contentGaps": ["gap1", ...], "serpFeatures": ["feature1", ...], "uniqueAngles": ["angle1", ...] }`;

  let contentGaps: string[] = [];
  let serpFeatures: string[] = [];
  let uniqueAngles: string[] = [];
  
  try {
    const content = await callClaude(gapAnalysisPrompt, {
      system: "You are a senior SEO strategist analyzing content opportunities. Provide deep, actionable insights based on competitive analysis. Return only valid JSON.",
      temperature: 0.6,
    });

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const parsed = JSON.parse(jsonMatch[1]?.trim() || content.trim());
    contentGaps = parsed.contentGaps || [];
    serpFeatures = parsed.serpFeatures || [];
    uniqueAngles = parsed.uniqueAngles || [];
  } catch (e) {
    console.error("Gap analysis error:", e);
    contentGaps = ["In-depth case studies", "Step-by-step tutorials", "Expert interviews", "Data-driven insights", "Common mistakes to avoid"];
    serpFeatures = ["Featured Snippet", "People Also Ask"];
  }
  
  competitorAnalysis.contentGaps = contentGaps;
  
  // Step 5: Generate outline - SCALED TO WORD COUNT
  console.log("Step 3: Generating optimized outline...");
  await onProgress?.(55, "Generating comprehensive outline...");
  
  // Calculate appropriate section count based on word count
  const outlineWordTarget = options?.targetWordCount || competitorAnalysis.avgWordCount + 500;
  const sectionCount = outlineWordTarget <= 600 ? 3 : outlineWordTarget <= 1000 ? 4 : outlineWordTarget <= 1500 ? 5 : outlineWordTarget <= 2500 ? 6 : 8;
  
  const outlinePrompt = `Create a focused blog post outline for:

TOPIC: ${topic}
PRIMARY KEYWORD: ${primaryKeyword}
TARGET WORD COUNT: ${outlineWordTarget} words
SEARCH INTENT: ${searchIntent}

CRITICAL CONSTRAINTS:
- For ${outlineWordTarget} words, you MUST create EXACTLY ${sectionCount} H2 sections (no more, no less)
- This article should have ONE clear purpose (guide OR listicle OR comparison - pick one)
- Each section should be ~${Math.round(outlineWordTarget / (sectionCount + 2))} words
- Headings must be SHORT (3-6 words max), not dense mini-paragraphs

Create an outline with:
- Compelling H1 title (include primary keyword, under 10 words)
- Exactly ${sectionCount} H2 sections with brief 5-word descriptions
- NO FAQ section (unless explicitly requested)

Return JSON: { "title": "Short H1 title", "articleType": "guide|listicle|comparison|tutorial", "outline": ["H2: Short Title - 5 word desc", ...], "metaTitle": "SEO title under 60 chars", "metaDescription": "Description under 155 chars" }`;

  let outline: string[] = [];
  let articleTitle = topic;
  let metaTitle = '';
  let metaDescription = '';
  let articleType = 'guide';
  
  try {
    const content = await callClaude(outlinePrompt, {
      system: `You are a content strategist who creates focused, lean outlines. You never over-scope an article. You match section count to word count. Return only valid JSON.`,
      temperature: 0.5,
    });

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const parsed = JSON.parse(jsonMatch[1]?.trim() || content.trim());
    outline = (parsed.outline || []).slice(0, sectionCount); // Enforce section limit
    articleTitle = parsed.title || topic;
    articleType = parsed.articleType || 'guide';
    metaTitle = parsed.metaTitle || articleTitle.substring(0, 60);
    metaDescription = parsed.metaDescription || '';
  } catch (e) {
    console.error("Outline error:", e);
    // Fallback with correct section count
    const fallbackSections = [
      `What Is ${primaryKeyword}`,
      `Key Benefits`,
      `How to Get Started`,
      `Best Practices`,
      `Common Mistakes`,
      `Expert Tips`,
      `Final Thoughts`
    ];
    outline = fallbackSections.slice(0, sectionCount);
  }
  
  // Step 6: Write full article with PREMIUM anti-AI-detection standards
  console.log("Step 4: Writing premium article with Claude Sonnet 4.6...");
  await onProgress?.(70, "Writing SEO-optimized content...");
  
  // Scrape format reference URL if provided
  let formatReference = '';
  if (options?.formatReferenceUrl) {
    console.log("Scraping format reference URL:", options.formatReferenceUrl);
    await onProgress?.(68, "Analyzing format reference page...");
    const scraped = await scrapeWebsiteWithFirecrawl(options.formatReferenceUrl.replace(/^https?:\/\//, '').split('/')[0]);
    if (scraped.success && scraped.content) {
      formatReference = scraped.content.substring(0, 3000);
    }
  }
  
  // Determine word count target
  const targetWords = options?.targetWordCount || competitorAnalysis.avgWordCount + 500;
  
  // Determine writing person
  const personInstructions = options?.writingPerson === 'first' 
    ? `WRITING PERSPECTIVE: First person (I/We). Write as if you are directly sharing your experience and expertise. Use "I recommend", "We've found", "In my experience".`
    : `WRITING PERSPECTIVE: Third person. Write objectively using "businesses should", "companies find that", "professionals recommend".`;
  
  // Target audience context - CRITICAL for proper targeting
  const audienceContext = options?.targetAudience 
    ? `###############################################
# TARGET AUDIENCE (CRITICAL - READ CAREFULLY) #
###############################################
PRIMARY READER: ${options.targetAudience}

You are writing EXCLUSIVELY for "${options.targetAudience}". This is NOT optional guidance - it's your primary directive.

AUDIENCE REQUIREMENTS:
- Write directly TO this audience, not about them or for someone else
- Use language, examples, and scenarios that resonate with "${options.targetAudience}"
- Address THEIR specific pain points, goals, and concerns
- Match the reading level and terminology THEY would use
- Frame benefits from THEIR perspective
- If they are parents, write for parents - NOT teachers, administrators, or students
- If they are business owners, write for business owners - NOT employees or consultants

WRONG: Writing for a different audience and hoping it applies
RIGHT: Every sentence should feel like it was written specifically for "${options.targetAudience}"`
    : '';
  
  // Tone of voice instructions - now supports multiple tones
  const toneInstructions: Record<string, string> = {
    professional: 'Professional and polished - use industry terminology appropriately, maintain a business-appropriate register, convey expertise through confident, measured language.',
    conversational: 'Conversational and laid-back - write as if chatting with a friend over coffee, use casual language, occasional humor, and relatable examples.',
    authoritative: 'Authoritative and commanding - write with confidence and conviction, take strong positions, back them with evidence, establish yourself as the definitive expert.',
    friendly: 'Friendly and warm - be encouraging and supportive, use positive language, celebrate wins, make the reader feel comfortable and motivated.'
  };
  
  // Build combined tone context from multiple selections
  const selectedTones = options?.tonesOfVoice || ['professional'];
  const toneDescriptions = selectedTones
    .filter((t: string) => toneInstructions[t])
    .map((t: string) => toneInstructions[t]);
  
  const toneContext = toneDescriptions.length > 0 
    ? `TONE OF VOICE (blend these qualities naturally):\n${toneDescriptions.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}`
    : 'TONE: Professional and polished. Use industry terminology appropriately, maintain a business-appropriate register.';
  
  // CTA Brand context
  const ctaInstructions = (options?.brandName || options?.brandProduct) 
    ? `
CTA REQUIREMENT (CRITICAL):
At the end of the article, include a natural, compelling call-to-action that:
- Ties in ${options?.brandName ? `the brand "${options.brandName}"` : 'the business'}${options?.brandProduct ? ` and their ${options.brandProduct}` : ''}
- Feels organic and not salesy - it should flow naturally from the conclusion
- Encourages the reader to take the next step (contact, learn more, get started)
- Example format: "If you're ready to [achieve the benefit discussed], [Brand Name] can help. [Brief value prop about the product/service]. [Soft CTA like 'Reach out today' or 'Learn more about how we can help']."
`
    : '';
  
  // Internal backlinks context
  const backlinksContext = options?.backlinksUrls 
    ? `
INTERNAL LINKING REQUIREMENT:
Naturally incorporate links to these pages throughout the article where contextually relevant:
${options.backlinksUrls.split(',').map(url => `- ${url.trim()}`).join('\n')}

For each link:
- Use descriptive anchor text (not "click here")
- Only link where it makes sense contextually
- Format as markdown: [anchor text](${options.backlinksUrls.includes('http') ? '' : 'https://yoursite.com'}URL)
- Aim to include 2-4 internal links spread throughout the content
`
    : '';
  
  // Calculate strict word count bounds
  const minWords = Math.round(targetWords * 0.95);
  const maxWords = Math.round(targetWords * 1.05);
  
  // CRITICAL: Extract brand/company focus for entity constraint
  const brandFocus = options?.brandName || (domain ? domain.split('.')[0] : '');
  
  // Generate dynamic copywriting guidelines based on article type
  const copywritingGuidelines = generateWritingGuidelines(articleType || 'guide', targetWords);
  const bucketBrigadesToUse = getRandomBucketBrigades(6);
  
  const articlePrompt = `You are a PROFESSIONAL COPYWRITER creating content that reads like it was written by an experienced human writer.

#############################################
# WORD COUNT: EXACTLY ${targetWords} WORDS   #
#############################################
- Your article MUST be between ${minWords} and ${maxWords} words
- ${targetWords <= 600 ? 'This is a SHORT article. Be concise. No fluff.' : targetWords <= 1200 ? 'This is a MEDIUM article. Be focused but thorough.' : 'This is a LONG article. Go deep but stay cohesive.'}
- Count as you write. Stop when you hit the target.

ARTICLE TYPE: ${articleType || 'guide'}
TITLE: ${articleTitle}
PRIMARY KEYWORD: ${primaryKeyword}

${copywritingGuidelines}

###############################################
# ARTICLE FLOW STRUCTURE                      #
###############################################

INTRODUCTION (${targetWords <= 600 ? '50-75' : targetWords <= 1200 ? '100-150' : '150-200'} words):
1. HOOK: Start with a specific statistic, bold claim, or relatable scenario (NOT "In today's world...")
2. PROBLEM: Acknowledge the reader's challenge in 1-2 sentences
3. PROMISE: State what they'll learn/achieve by the end
4. PREVIEW: Brief roadmap (optional for short articles)

Example opener patterns:
- "${SEO_COPYWRITING_GUIDELINES.hooks.types.statisticHook.example}"
- "${SEO_COPYWRITING_GUIDELINES.hooks.types.contrarian.example}"

BODY SECTIONS (${outline.length} sections, ~${Math.round((targetWords * 0.7) / outline.length)} words each):
${outline.map((h, i) => `${i + 1}. ${h}`).join('\n')}

For EACH section:
- Start with a transition from the previous section
- Lead with the key point (inverted pyramid)
- Include ONE supporting example or data point
- End with a bridge to the next section
- Use a bucket brigade mid-section to maintain engagement

BUCKET BRIGADES TO SPRINKLE THROUGHOUT:
${bucketBrigadesToUse.map(b => `• ${b}`).join('\n')}

CONCLUSION (${targetWords <= 600 ? '50-75' : '100-150'} words):
1. SUMMARY: One sentence restating the key insight (not a recap of every point)
2. TRANSFORMATION: What's now possible for the reader
3. NEXT STEP: One clear, specific action they should take

###############################################
# HEADING RULES                               #
###############################################
- H2 headings: 3-6 words MAX
- H3 headings: Use sparingly for subsections
- No questions as headings (unless FAQ)
- No clickbait: "The Secret" / "What You Need to Know"

###############################################
# WRITING RHYTHM & FLOW                       #
###############################################
SENTENCE STRUCTURE:
- Vary lengths: Short. Then longer with detail. Then punchy again.
- Start 10% of sentences with "And" or "But"
- Use fragments for emphasis. Like this.
- Front-load key information in sentences

PARAGRAPH STRUCTURE:
- 2-4 sentences per paragraph
- One idea per paragraph
- Never start consecutive paragraphs the same way
- Use single-sentence paragraphs sparingly for impact

NATURAL VOICE:
- Use contractions: don't, won't, it's, that's, we're
- Include parenthetical asides (like this one)
- Add occasional mild opinions: "This is often overlooked"
- Reference specifics: "73% of marketers" not "most marketers"

###############################################
# E-E-A-T SIGNALS TO INCLUDE                  #
###############################################
- EXPERIENCE: Include 1-2 "in my experience" or "what I've seen" statements
- EXPERTISE: Cite specific data, trends, or industry insights
- AUTHORITY: Reference reputable sources where relevant
- TRUST: Acknowledge trade-offs and limitations honestly

${domain ? `BRAND: ${domain}` : ''}
${brandFocus ? `ONLY COMPANY TO MENTION: "${brandFocus}" - do NOT invent other company names or products` : 'Do NOT mention any specific company names'}

${personInstructions}
${toneContext}
${audienceContext}

${formatReference ? `STYLE REFERENCE:\n${formatReference}\n---` : ''}
${ctaInstructions}
${backlinksContext}

###############################################
# ABSOLUTELY BANNED PHRASES                   #
###############################################
NEVER USE (these are AI red flags):
${SEO_COPYWRITING_GUIDELINES.antiAIPatterns.bannedPhrases.slice(0, 15).map(p => `❌ ${p}`).join('\n')}

###############################################
# SEO (SUBTLE, NOT FORCED)                    #
###############################################
- Primary keyword "${primaryKeyword}" appears 2-4 times naturally
- Include in: first 100 words, one H2, conclusion
- Secondary keywords where relevant: ${secondaryKeywords.slice(0, 3).join(', ')}
- Answer the search intent: ${searchIntent}

###############################################
# FORMATTING                                  #
###############################################
- No em dashes (—), use hyphens or commas instead
- No bold (**text**) formatting
- No emojis
- ONE bullet list per section (3-5 actionable bullets)

OUTPUT: Only the article. No meta-commentary. Ready to publish.`;

  const systemPrompt = `You are a professional copywriter with 15+ years of experience writing content that ranks AND converts. You write like a human - with personality, rhythm, and purpose.

CORE IDENTITY:
- You've written for major publications and understand what makes content engaging
- You respect word counts precisely - never over or under by more than 5%
- You create cohesive articles that flow, not stitched-together sections
- You sound human: contractions, varied rhythm, occasional opinions, specific details

WORD COUNT ENFORCEMENT (CRITICAL):
- Target: ${targetWords} words
- Acceptable range: ${minWords}-${maxWords} words
- For SHORT articles (≤600): 3-4 H2 sections, ~100-150 words each, very lean
- For MEDIUM articles (≤1200): 4-5 H2 sections, ~150-200 words each
- For LONG articles (>1200): 5-8 H2 sections, ~200-300 words each

QUALITY MARKERS:
1. Transitions connect every section (building on, this leads to, with that foundation)
2. Bucket brigades maintain engagement every 150-250 words
3. Sentence lengths vary dramatically (5 words to 25 words)
4. Paragraphs are short (2-4 sentences max)
5. Specific data points > vague claims

ENTITY CONSTRAINT:
Only mention "${brandFocus || 'no specific company'}" if any company name is needed. Do NOT hallucinate other company names, product names, or service providers.

OUTPUT: Only the article content. No explanations, no meta-commentary.`;

  let fullContent = '';
  
  try {
    const rawContent = await callClaude(articlePrompt, {
      system: systemPrompt,
      temperature: 0.75,
      maxTokens: Math.max(2000, Math.min(16000, Math.ceil(targetWords * 1.8))),
    });
    // CRITICAL: Clean em dashes and formatting from generated content
    fullContent = cleanGeneratedContent(rawContent);
  } catch (e) {
    console.error("Article generation error:", e);
    fullContent = `# ${articleTitle}\n\nContent generation failed. Please try again.`;
  }
  
  const wordCount = fullContent.split(/\s+/).length;
  const contentScore = calculateContentScore(fullContent, primaryKeyword);
  await onProgress?.(85, "Calculating content score...");
  
  // Step 7: Generate FAQ schema
  console.log("Step 5: Generating FAQ schema...");
  await onProgress?.(90, "Generating FAQ schema...");
  
  const faqSchema: { question: string; answer: string }[] = [];
  
  if (questions.length > 0) {
    const faqPrompt = `You are an industry expert answering common questions about ${topic}.

Answer these FAQs in a natural, helpful way (60-100 words each):
${questions.slice(0, 5).map((q, i) => `${i + 1}. ${q}`).join('\n')}

WRITING STYLE:
- Start with a direct answer, then expand with useful context
- Write like you're explaining to a smart colleague
- Include specific details and practical tips
- Use natural language, not corporate-speak
- Avoid: "It's important to note", "When it comes to"

Return JSON array: [{ "question": "...", "answer": "..." }, ...]`;

    try {
      const content = await callClaude(faqPrompt, {
        system: "You are an experienced professional providing helpful, authentic FAQ answers. Your answers sound like advice from a trusted colleague, not generic content. Return only valid JSON array.",
        temperature: 0.7,
      });

      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const parsed = JSON.parse(jsonMatch[1]?.trim() || content.trim());
      if (Array.isArray(parsed)) {
        // CRITICAL: Clean em dashes from FAQ answers
        faqSchema.push(...parsed.map(faq => ({
          question: cleanGeneratedContent(faq.question || ''),
          answer: cleanGeneratedContent(faq.answer || '')
        })));
      }
    } catch (e) {
      console.error("FAQ schema error:", e);
    }
  }
  
  // Extract internal linking suggestions from content
  const linkMatches = fullContent.match(/\[([^\]]+)\]/g) || [];
  const internalLinkingSuggestions = linkMatches.map(m => m.replace(/[\[\]]/g, ''));
  
  console.log(`Topic Writer complete: ${wordCount} words, score ${contentScore.overall}/100`);
  await onProgress?.(95, "Finalizing article...");
  
  return {
    topic,
    primaryKeyword,
    secondaryKeywords,
    searchIntent,
    competitorAnalysis,
    serpFeatures,
    outline,
    fullContent,
    wordCount,
    contentScore,
    metaTitle: metaTitle || articleTitle.substring(0, 60),
    metaDescription: metaDescription || `Learn about ${primaryKeyword}. Comprehensive guide with expert tips, best practices, and actionable strategies.`,
    internalLinkingSuggestions,
    faqSchema
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'seo-writer');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const body = await req.json();
    const { type } = body;
    const SEMRUSH_API_KEY = Deno.env.get("SEMRUSH_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (type === "full-analysis") {
      const { domain, customSeeds } = body;
      if (!domain) throw new Error("Domain is required");
      if (!SEMRUSH_API_KEY) throw new Error("SEMRUSH_API_KEY is not configured");

      console.log(`Starting enhanced analysis for: ${domain}`);
      const result = await performFullDomainAnalysis(domain, SEMRUSH_API_KEY, customSeeds);
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "generate-content") {
      const { domain, businessInfo, selections } = body;
      if (!domain || !selections) throw new Error("Domain and selections are required");

      if (!authResult.userId) throw new Error("Missing user context");
      if (!supabaseUrl || !supabaseServiceKey) throw new Error("Backend is not configured");

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const inputParams = { type, domain, businessInfo, selections };

      const { data: job, error: jobError } = await supabase
        .from("seo_writer_jobs")
        .insert({
          user_id: authResult.userId,
          job_type: "generate-content",
          status: "processing",
          progress: 5,
          progress_message: "Preparing your selections...",
          input_params: inputParams,
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to create job: ${jobError?.message || "unknown"}`);
      }

      const updateProgress = async (progress: number, message: string) => {
        try {
          await supabase
            .from("seo_writer_jobs")
            .update({
              progress,
              progress_message: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (e) {
          console.error("Progress update failed:", e);
        }
      };

      const markFailed = async (errorMessage: string) => {
        console.error(`Job ${job.id} failed:`, errorMessage);
        try {
          await supabase
            .from("seo_writer_jobs")
            .update({
              status: "failed",
              error: errorMessage,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (e) {
          console.error("Failed to mark job as failed:", e);
        }
      };

      const markComplete = async (result: unknown) => {
        try {
          await supabase
            .from("seo_writer_jobs")
            .update({
              status: "complete",
              progress: 100,
              progress_message: "Content ready!",
              result,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (e) {
          console.error("Failed to mark job as complete:", e);
        }
      };

      const process = async () => {
        try {
          console.log(`Starting async content generation job: ${job.id}`);
          await updateProgress(10, "Preparing your selections...");
          const result = await generateFullContent(
            domain,
            businessInfo,
            selections,
            updateProgress
          );
          await markComplete(result);
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await markFailed(msg);
          throw e;
        }
      };

      if (EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(process());
        return new Response(JSON.stringify({ success: true, job_id: job.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback (no background runtime): run synchronously but still return a job id.
      const result = await process();
      return new Response(JSON.stringify({ success: true, job_id: job.id, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "topic-writer") {
      const { topic, domain, formatReferenceUrl, targetWordCount, writingPerson, targetAudience, tonesOfVoice, brandName, brandProduct, backlinksUrls } = body;
      if (!topic) throw new Error("Topic is required");
      if (!SEMRUSH_API_KEY) throw new Error("SEMRUSH_API_KEY is not configured");

      if (!authResult.userId) throw new Error("Missing user context");
      if (!supabaseUrl || !supabaseServiceKey) throw new Error("Backend is not configured");

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const inputParams = { type, topic, domain, formatReferenceUrl, targetWordCount, writingPerson, targetAudience, tonesOfVoice, brandName, brandProduct, backlinksUrls };

      const { data: job, error: jobError } = await supabase
        .from("seo_writer_jobs")
        .insert({
          user_id: authResult.userId,
          job_type: "topic-writer",
          status: "processing",
          progress: 5,
          progress_message: "Analyzing topic & search intent...",
          input_params: inputParams,
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to create job: ${jobError?.message || "unknown"}`);
      }

      const updateProgress = async (progress: number, message: string) => {
        try {
          await supabase
            .from("seo_writer_jobs")
            .update({
              progress,
              progress_message: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (e) {
          console.error("Progress update failed:", e);
        }
      };

      const markFailed = async (errorMessage: string) => {
        console.error(`Job ${job.id} failed:`, errorMessage);
        try {
          await supabase
            .from("seo_writer_jobs")
            .update({
              status: "failed",
              error: errorMessage,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (e) {
          console.error("Failed to mark job as failed:", e);
        }
      };

      const markComplete = async (result: unknown) => {
        try {
          await supabase
            .from("seo_writer_jobs")
            .update({
              status: "complete",
              progress: 100,
              progress_message: "Article complete!",
              result,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } catch (e) {
          console.error("Failed to mark job as complete:", e);
        }
      };

      const process = async () => {
        try {
          console.log(`Starting async topic writer job: ${job.id}`);
          const result = await generateTopicArticle(
            topic,
            domain,
            SEMRUSH_API_KEY,
            updateProgress,
            {
              formatReferenceUrl,
              targetWordCount: targetWordCount || 1500,
              writingPerson: writingPerson || 'third',
              targetAudience,
              tonesOfVoice: tonesOfVoice || ['professional'],
              brandName,
              brandProduct,
              backlinksUrls
            }
          );
          await markComplete(result);
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await markFailed(msg);
          throw e;
        }
      };

      if (EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(process());
        return new Response(JSON.stringify({ success: true, job_id: job.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await process();
      return new Response(JSON.stringify({ success: true, job_id: job.id, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "expand-blog") {
      const { existingContent, targetWordCount, title, targetKeyword, businessInfo } = body;
      if (!existingContent || !targetWordCount) throw new Error("Existing content and target word count are required");

      console.log(`Expanding blog post to ${targetWordCount} words`);
      
      const currentWordCount = existingContent.split(/\s+/).length;
      const expansionRatio = targetWordCount / currentWordCount;
      
      const expandPrompt = `You are a veteran content strategist expanding an existing premium article.

CURRENT ARTICLE:
Title: ${title || "Blog Post"}
Target Keyword: ${targetKeyword || ""}
Current Word Count: ${currentWordCount}
Target Word Count: ${targetWordCount}
Business: ${businessInfo?.name || ""} (${businessInfo?.industry || "business"})

EXISTING CONTENT:
${existingContent}

EXPANSION REQUIREMENTS:
1. EXPAND this article to ${targetWordCount} words (currently ${currentWordCount})
2. MAINTAIN the existing structure and flow - add depth, not new topics
3. For each existing section:
   - Add more specific examples and case studies
   - Include additional data points and statistics
   - Expand on nuances and edge cases
   - Add practical tips and implementation details
   - Include expert perspectives and industry insights
4. ADD new H3 subsections under existing H2s where appropriate
5. ENHANCE the introduction with a more compelling hook
6. EXPAND the conclusion with actionable next steps

QUALITY STANDARDS (White-Glove):
- Write like an experienced industry professional with decades of expertise
- Include specific numbers (73% not "around 70%")
- Add personal observations and "insider" perspectives
- Use varied sentence structure - mix short punchy with longer complex
- Include rhetorical questions and parenthetical asides
- Reference real methodologies and frameworks by name
- Add occasionally imperfect transitions that humans would make

ANTI-DETECTION (Critical):
- NEVER use: "In today's fast-paced world", "It's important to note", "Let's dive in", "Game-changer", "Cutting-edge", "Seamlessly", "Leverage", "Unlock"
- Start sentences with "And" or "But" occasionally
- Include mild opinions and controversial takes
- Use specific time references ("over the past 18 months")

Return the COMPLETE expanded article in markdown format with all existing content enhanced and new content seamlessly integrated.`;

      try {
        const rawContent = await callClaude(expandPrompt, {
          system: `You are a celebrated content strategist known for transforming good articles into exceptional, publication-worthy pieces. Your expansions are seamless - readers can't tell where the original ends and your additions begin. You add substantive depth, not filler.

Your signature approach:
- Every added paragraph must provide genuine value
- You expand with expertise, not repetition
- Your additions sound like they came from the same expert voice
- You find opportunities to add nuance, examples, and practical insights that the original missed
- Your expanded content passes AI detection because it reads like authentic human expertise

The expanded article must feel like a cohesive whole, not a patchwork.`,
          temperature: 0.85,
          maxTokens: 12000,
        });

        // CRITICAL: Clean em dashes and formatting
        const expandedContent = cleanGeneratedContent(rawContent);
        const newWordCount = expandedContent.split(/\s+/).length;
        const contentScore = calculateContentScore(expandedContent, targetKeyword || "");

        return new Response(JSON.stringify({
          title,
          targetKeyword,
          fullContent: expandedContent,
          wordCount: newWordCount,
          contentScore,
          expanded: true,
          previousWordCount: currentWordCount
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Blog expansion error:", e);
        throw new Error("Failed to expand blog post");
      }
    }

    if (type === "analyze-detection") {
      const { content } = body;
      if (!content) throw new Error("Content is required");

      console.log("Analyzing AI detection score...");
      const detectionResult = analyzeAIDetection(content);

      return new Response(JSON.stringify(detectionResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "humanize-content") {
      const { content, flaggedSections, targetKeyword, businessInfo } = body;
      if (!content) throw new Error("Content is required");

      console.log("Humanizing content...");

      const flaggedContext = flaggedSections?.length > 0 
        ? `\n\nSPECIFICALLY FLAGGED SECTIONS TO REWRITE:\n${flaggedSections.map((f: any, i: number) => `${i + 1}. "${f.text}" - Reason: ${f.reason}`).join('\n')}`
        : '';

      const humanizePrompt = `You are an expert editor who specializes in making AI-generated content indistinguishable from human writing.

ORIGINAL CONTENT:
${content}
${flaggedContext}

HUMANIZATION REQUIREMENTS:

1. REWRITE FLAGGED SECTIONS COMPLETELY:
   - Replace every flagged phrase with natural alternatives
   - Remove all AI-typical patterns
   - Make transitions feel organic and imperfect

2. ADD HUMAN SIGNATURES:
   - Insert parenthetical asides (like this, for example)
   - Start 2-3 sentences with "And" or "But"
   - Add one rhetorical question
   - Include a mild opinion or slightly controversial take
   - Use specific numbers (73%, not 70%)
   - Reference time specifically ("over the past 18 months", not "recently")
   - Add an imperfect analogy a human would make

3. VARY SENTENCE STRUCTURE:
   - Mix very short sentences (5-8 words) with longer complex ones (25-35 words)
   - Use sentence fragments occasionally for emphasis
   - Break up any uniform patterns

4. USE NATURAL LANGUAGE:
   - Replace formal connectors (Moreover, Furthermore, Additionally) with casual ones (Plus, Also, On top of that, Here's the thing)
   - Add contractions everywhere natural (don't, won't, it's, that's)
   - Include filler words sparingly (honestly, basically, look, here's the thing)
   - Use colloquialisms appropriate for a professional audience

5. PHRASES TO ABSOLUTELY AVOID:
   - "In today's fast-paced world" → Delete entirely or use specific context
   - "It's important to note" → Just state the point directly
   - "When it comes to" → Use simpler phrasing
   - "Let's dive in" → Remove or use "Here's what's actually happening"
   - "Game-changer", "Cutting-edge", "Leverage", "Unlock", "Seamlessly" → Replace with specific descriptions
   - "Delve into" → Use "look at", "explore", "dig into"
   - "Navigate the complex" → Just describe what you're doing

6. MAINTAIN:
   - All factual information
   - Overall structure and flow
   - SEO optimization for "${targetKeyword || 'target keyword'}"
   - Professional quality and expertise

Return the COMPLETE humanized article. Every section must be reviewed and improved for natural human voice.`;

      try {
        const rawContent = await callClaude(humanizePrompt, {
          system: `You are an elite editor known for transforming robotic content into vibrant, authentic human writing. Your edits are invisible - no one can tell the content was ever touched by AI.

Your signature style:
- You find and eliminate every trace of AI patterns
- You inject personality without being unprofessional
- You make writing feel like a conversation with a smart colleague
- Your humanized content consistently passes AI detection tools
- You preserve expertise while adding warmth and authenticity

CRITICAL: The output must pass Originality.ai, GPTZero, and other detection tools. Every AI pattern must be eliminated.`,
          temperature: 0.9,
          maxTokens: 10000,
        });

        // CRITICAL: Clean em dashes and formatting
        const humanizedContent = cleanGeneratedContent(rawContent);
        const wordCount = humanizedContent.split(/\s+/).length;
        
        // Re-analyze the humanized content
        const newDetectionResult = analyzeAIDetection(humanizedContent);
        const contentScore = calculateContentScore(humanizedContent, targetKeyword || "");

        return new Response(JSON.stringify({
          fullContent: humanizedContent,
          wordCount,
          contentScore,
          aiDetection: newDetectionResult,
          humanized: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Humanization error:", e);
        throw new Error("Failed to humanize content");
      }
    }

    throw new Error(`Unknown type: ${type}`);

  } catch (error) {
    console.error("SEO Writer error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

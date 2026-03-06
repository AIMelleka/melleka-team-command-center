import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS_CONTEXT = `
Available internal tools the team can use:
- Proposal Builder (/proposal-builder): Build client proposals, pitches, RFPs
- Ad Generator (/ad-generator): Create ad creatives, banners for Google/Meta/Facebook
- Image Studio (/image-generator): Generate and edit images, graphics, visual content
- QA Bot (/qa-bot): Quality check and proofread content before publishing
- Email Writer (/email-writer): Write email campaigns, newsletters, drip sequences
- Video Generator (/video-generator): Create video scripts and generate video content
- Client Update (/client-update): Generate client status updates from Notion/Sheets/Looker
- Client Health (/client-health): Monitor client account health scores and ad performance
- Command Center (/client-health): Overview dashboard of all client health
- PPC Optimizer (/ppc-optimizer): AI-powered Google & Meta Ads optimization, bid management
- Ad Review (/ad-review): Analyze ad performance with benchmarks and recommendations
- Proposal QA (/proposal-qa): Quality check proposals before sending to clients
- Decks (/decks): Build client update presentation decks with metrics
`;

async function fetchInternalContext(supabaseAdmin: any, userMessage: string): Promise<string> {
  const msg = userMessage.toLowerCase();
  const sections: string[] = [];

  // Always fetch client list for context
  try {
    const { data: clients } = await supabaseAdmin
      .from('managed_clients')
      .select('client_name, domain, industry, tier, is_active, primary_conversion_goal, ga4_property_id')
      .eq('is_active', true)
      .limit(100);
    if (clients?.length) {
      sections.push(`## Active Clients (${clients.length} total)\n${clients.map((c: any) => 
        `- **${c.client_name}** | Domain: ${c.domain || 'N/A'} | Industry: ${c.industry || 'N/A'} | Tier: ${c.tier} | Goal: ${c.primary_conversion_goal}`
      ).join('\n')}`);
    }
  } catch (e) { console.error('Error fetching clients:', e); }

  // Detect if asking about a specific client
  let targetClient: string | null = null;
  try {
    const { data: allClients } = await supabaseAdmin
      .from('managed_clients')
      .select('client_name')
      .eq('is_active', true);
    if (allClients) {
      let bestScore = 0;
      for (const c of allClients) {
        const fullName = c.client_name;
        const fullLower = fullName.toLowerCase();
        
        // Split on " - " to get base name and abbreviation
        const parts = fullName.split(' - ');
        const baseName = parts[0].trim().toLowerCase();
        const abbreviation = parts.length > 1 ? parts[parts.length - 1].trim().toLowerCase() : '';
        
        let score = 0;
        
        // Exact full match
        if (msg.includes(fullLower)) {
          score = 1.0;
        }
        // Base name match (e.g., "st joseph" found in message)
        else if (msg.includes(baseName)) {
          score = 0.95;
        }
        // Abbreviation match (e.g., "stj" or "lapp" found in message)
        else if (abbreviation && msg.split(/\s+/).some(w => w === abbreviation)) {
          score = 0.9;
        }
        // Message contains abbreviation as substring (less strict)
        else if (abbreviation && abbreviation.length >= 3 && msg.includes(abbreviation)) {
          score = 0.85;
        }
        // Check if base name starts with a word sequence from the message
        else {
          const msgWords = msg.split(/\s+/).filter((w: string) => w.length > 2);
          const baseWords = baseName.split(/\s+/);
          // Count overlapping words
          let matched = 0;
          for (const mw of msgWords) {
            if (baseWords.some((bw: string) => bw.includes(mw) || mw.includes(bw))) {
              matched++;
            }
          }
          if (matched >= 2) {
            score = 0.7 + (0.1 * (matched / baseWords.length));
          } else if (matched === 1 && msgWords.length <= 3) {
            score = 0.5;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          targetClient = fullName;
        }
      }
      if (bestScore < 0.5) {
        targetClient = null;
      }
    }
  } catch (e) { /* ignore */ }

  // If asking about a specific client or about PPC/ads/performance, fetch PPC data
  const wantsPPC = targetClient || /ppc|ads?[\s,.]|campaign|spend|budget|conversion|cpa|cost|google ads|meta ads|performance|optimiz/i.test(msg);
  if (wantsPPC) {
    try {
      let query = supabaseAdmin
        .from('ppc_optimization_sessions')
        .select('client_name, platform, status, ai_summary, ai_reasoning, date_range_start, date_range_end, created_at, auto_mode')
        .order('created_at', { ascending: false })
        .limit(targetClient ? 10 : 5);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: sessions } = await query;
      if (sessions?.length) {
        sections.push(`## Recent PPC Optimization Sessions\n${sessions.map((s: any) =>
          `- **${s.client_name}** (${s.platform}) | ${s.date_range_start} to ${s.date_range_end} | Status: ${s.status} | Auto: ${s.auto_mode}\n  Summary: ${(s.ai_summary || 'N/A').slice(0, 300)}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching PPC sessions:', e); }

    // Fetch proposed changes
    try {
      let query = supabaseAdmin
        .from('ppc_proposed_changes')
        .select('client_name, platform, change_type, entity_name, entity_type, confidence, priority, approval_status, ai_rationale, expected_impact, execution_error')
        .order('created_at', { ascending: false })
        .limit(targetClient ? 20 : 10);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: changes } = await query;
      if (changes?.length) {
        sections.push(`## Recent PPC Proposed Changes\n${changes.map((c: any) =>
          `- **${c.client_name}** (${c.platform}): ${c.change_type} on ${c.entity_type} "${c.entity_name}" | Confidence: ${c.confidence} | Priority: ${c.priority} | Status: ${c.approval_status}${c.execution_error ? ' | ERROR: ' + c.execution_error : ''}\n  Rationale: ${(c.ai_rationale || 'N/A').slice(0, 200)}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching PPC changes:', e); }

    // Fetch daily snapshots
    try {
      let query = supabaseAdmin
        .from('ppc_daily_snapshots')
        .select('client_name, platform, snapshot_date, spend, conversions, clicks, impressions, cost_per_conversion, calls, leads')
        .order('snapshot_date', { ascending: false })
        .limit(targetClient ? 30 : 15);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: snapshots } = await query;
      if (snapshots?.length) {
        sections.push(`## Recent PPC Daily Snapshots\n${snapshots.map((s: any) =>
          `- **${s.client_name}** (${s.platform}) ${s.snapshot_date}: Spend=$${s.spend} | Conv=${s.conversions} | CPA=$${s.cost_per_conversion} | Clicks=${s.clicks} | Impr=${s.impressions} | Calls=${s.calls} | Leads=${s.leads}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching snapshots:', e); }
  }

  // Ad review history
  const wantsAdReview = targetClient || /ad review|review|benchmark|insight|recommendation/i.test(msg);
  if (wantsAdReview) {
    try {
      let query = supabaseAdmin
        .from('ad_review_history')
        .select('client_name, review_date, summary, industry, date_range_start, date_range_end, notes')
        .order('review_date', { ascending: false })
        .limit(targetClient ? 5 : 3);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: reviews } = await query;
      if (reviews?.length) {
        sections.push(`## Recent Ad Reviews\n${reviews.map((r: any) =>
          `- **${r.client_name}** (${r.review_date}): ${(r.summary || 'No summary').slice(0, 300)}${r.notes ? '\n  Notes: ' + r.notes.slice(0, 150) : ''}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching ad reviews:', e); }
  }

  // Client health (NO SEO fields)
  const wantsHealth = targetClient || /health|score|status|overview|how.*doing|what.*going on|attention|missing|config/i.test(msg);
  if (wantsHealth) {
    try {
      let query = supabaseAdmin
        .from('client_health_history')
        .select('client_name, recorded_date, health_score, ad_health, days_since_ad_review, config_completeness, missing_configs')
        .order('recorded_date', { ascending: false })
        .limit(targetClient ? 10 : 20);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: health } = await query;
      if (health?.length) {
        sections.push(`## Client Health Scores\n${health.map((h: any) =>
          `- **${h.client_name}** (${h.recorded_date}): Score=${h.health_score}/100 | Ads: ${h.ad_health || 'N/A'} | Days Since Review: ${h.days_since_ad_review ?? 'N/A'} | Config: ${h.config_completeness}%${h.missing_configs?.length ? ' | Missing: ' + h.missing_configs.join(', ') : ''}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching health:', e); }
  }

  // Proposals
  const wantsProposals = targetClient || /proposal|pitch|rfp/i.test(msg);
  if (wantsProposals) {
    try {
      let query = supabaseAdmin
        .from('proposals')
        .select('title, client_name, status, services, budget_range, timeline, created_at')
        .order('created_at', { ascending: false })
        .limit(targetClient ? 5 : 3);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: proposals } = await query;
      if (proposals?.length) {
        sections.push(`## Proposals\n${proposals.map((p: any) =>
          `- **${p.title}** for ${p.client_name} | Status: ${p.status} | Budget: ${p.budget_range || 'N/A'} | Timeline: ${p.timeline || 'N/A'} | Services: ${p.services?.join(', ') || 'N/A'}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching proposals:', e); }
  }

  // Decks
  const wantsDecks = targetClient || /deck|presentation|slide/i.test(msg);
  if (wantsDecks) {
    try {
      let query = supabaseAdmin
        .from('decks')
        .select('client_name, slug, status, date_range_start, date_range_end, created_at')
        .order('created_at', { ascending: false })
        .limit(targetClient ? 5 : 3);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: decks } = await query;
      if (decks?.length) {
        sections.push(`## Recent Decks\n${decks.map((d: any) =>
          `- **${d.client_name}** (${d.date_range_start} to ${d.date_range_end}) | Status: ${d.status} | Slug: ${d.slug}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching decks:', e); }
  }

  // Account mappings
  if (targetClient || /mapping|account|supermetrics/i.test(msg)) {
    try {
      let query = supabaseAdmin
        .from('client_account_mappings')
        .select('client_name, platform, account_id, account_name')
        .limit(targetClient ? 20 : 10);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: mappings } = await query;
      if (mappings?.length) {
        sections.push(`## Account Mappings\n${mappings.map((m: any) =>
          `- **${m.client_name}**: ${m.platform} → ${m.account_name || m.account_id}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching mappings:', e); }
  }

  // PPC client settings
  if (targetClient || /auto.?mode|strategist|setting/i.test(msg)) {
    try {
      let query = supabaseAdmin
        .from('ppc_client_settings')
        .select('client_name, auto_mode_enabled, auto_mode_platform, auto_mode_schedule, confidence_threshold, max_changes_per_run, google_account_id, meta_account_id')
        .limit(targetClient ? 5 : 10);
      if (targetClient) query = query.eq('client_name', targetClient);
      const { data: settings } = await query;
      if (settings?.length) {
        sections.push(`## PPC Client Settings\n${settings.map((s: any) =>
          `- **${s.client_name}**: Auto=${s.auto_mode_enabled} | Platform: ${s.auto_mode_platform} | Schedule: ${s.auto_mode_schedule} | Threshold: ${s.confidence_threshold} | Max Changes: ${s.max_changes_per_run} | Google: ${s.google_account_id || 'N/A'} | Meta: ${s.meta_account_id || 'N/A'}`
        ).join('\n')}`);
      }
    } catch (e) { console.error('Error fetching PPC settings:', e); }
  }

  if (sections.length === 0) return '';
  return `\n\n---\n# INTERNAL DATA (from our platform database — use this to answer the team's questions with REAL data)\n\n${sections.join('\n\n')}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    // Create Supabase admin client to query internal data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest user message to determine what data to fetch
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
    
    // Fetch relevant internal data
    const internalContext = await fetchInternalContext(supabaseAdmin, lastUserMessage);

    const systemPrompt = `You are "The Team Pit" — the central AI assistant for Melleka Marketing's internal team. You are their most advanced, knowledgeable teammate with FULL ACCESS to the agency's internal data.

Your capabilities:
1. Answer ANY question the team has — marketing strategy, client work, industry knowledge, creative ideas, technical help, copywriting, analytics interpretation, campaign planning, etc.
2. You have LIVE ACCESS to the agency's internal database. When data is provided below, use it to give SPECIFIC, data-driven answers. Never say "I don't have access" — if the data is below, USE IT.
3. When relevant, recommend which internal tool to use and include the route path so the UI can link to it.
4. Be conversational, smart, and actionable. Give real answers, not generic ones.
5. Format responses with markdown for readability (bold, lists, headers when appropriate).
6. If a question maps to one of our tools, mention it naturally in your answer.

${TOOLS_CONTEXT}

IMPORTANT RULES:
- You are the team's go-to for EVERYTHING. Answer fully and helpfully.
- When you have internal data available, ALWAYS reference specific numbers, dates, and client names. Be precise.
- When recommending a tool, format it as: **[Tool Name](/route)** so the frontend can parse links.
- Keep answers thorough but scannable. Use bullet points and headers for complex answers.
- You have deep marketing agency expertise — act like a senior strategist + creative director + analyst combined.
- Be direct and confident. No hedging or excessive caveats.
- If someone asks about a client, give them EVERYTHING you know: health scores, PPC performance, ad reviews, proposals, decks, account mappings — the full picture.
- When discussing PPC data, calculate trends if you have multiple snapshots (e.g., "spend is up 15% week-over-week").
- Flag concerning metrics proactively (e.g., "CPA is $45 which is above the $30 industry benchmark").
- If data seems incomplete or missing, say what you DO have and suggest which tool to use to get the rest.
- NEVER mention SEO metrics, organic keywords, domain authority, backlinks, or site audit data. These are not part of our reporting. Do not reference SEO in any form.
${internalContext}`;

    const aiResponse = await callClaude('', {
      system: systemPrompt,
      messages: messages,
    });

    return new Response(JSON.stringify({ reply: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("team-pit-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

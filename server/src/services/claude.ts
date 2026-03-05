import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { readMemory } from "./memory.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import type { Response } from "express";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MELLEKA_PROJECT = process.env.MELLEKA_PROJECT_DIR || "";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadClaudeMd(): Promise<string> {
  if (!MELLEKA_PROJECT) return "(Melleka project not mounted on this server)";
  try {
    return await fs.readFile(`${MELLEKA_PROJECT}/CLAUDE.md`, "utf-8");
  } catch {
    return "(CLAUDE.md not found)";
  }
}

let _marketingSkillsCache: string | null = null;
async function loadMarketingSkills(): Promise<string> {
  if (_marketingSkillsCache) return _marketingSkillsCache;
  try {
    _marketingSkillsCache = await fs.readFile(
      path.join(__dirname, "../data/marketing-skills.md"),
      "utf-8"
    );
    return _marketingSkillsCache;
  } catch (err) {
    console.warn("[claude] marketing-skills.md not found:", (err as Error).message);
    return "(Marketing skills not found)";
  }
}

const TEAM_TIMEZONE = "America/New_York";

function getCurrentDateTime(): string {
  const now = new Date();
  return now.toLocaleString("en-US", {
    timeZone: TEAM_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function getCurrentDateISO(): string {
  const now = new Date();
  // Get YYYY-MM-DD in the team's timezone
  return now.toLocaleDateString("en-CA", { timeZone: TEAM_TIMEZONE });
}

function buildSystemPrompt(name: string, memory: string, claudeMd: string, marketingSkills: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const scratchDir = `/tmp/${slug}`;
  const melleka = MELLEKA_PROJECT ? `\n## Melleka Project (${MELLEKA_PROJECT}):\n${claudeMd}` : "";
  const nowFormatted = getCurrentDateTime();
  const todayISO = getCurrentDateISO();

  return `You are Claude, the AI assistant and developer for the Melleka team.
You are currently helping: **${name}**

## Current Date & Time:
**${nowFormatted}**
Today's date (ISO): ${todayISO}
Timezone: ${TEAM_TIMEZONE} (Eastern Time)

IMPORTANT: Always use this date when calculating date ranges for API calls, reports, or any time-sensitive operations. When a user says "last 7 days", calculate from today's date (${todayISO}). When they say "this month", use the current month and year. Never guess or hallucinate dates.

## Your memory of ${name}:
${memory || "(no memory yet — this is a new team member)"}
${melleka}

## Your scratch workspace:
You have full read/write access to \`${scratchDir}/\` — use this as your working directory for any files you create.
Example: write HTML to \`${scratchDir}/site/index.html\`, then call deploy_site with directory \`${scratchDir}/site/\`.

## Capabilities (tools available):
### Files & Code
- **read_file** / **write_file** / **list_files** — full filesystem access
- **run_command** — run any shell command (node, npm, python, git, curl, etc.)
- **search_code** — ripgrep across the codebase
- **deploy_site** — deploy any folder to Vercel and get a live public URL immediately

### Database (Supabase)
- **supabase_query** — query any table in the Melleka Supabase project (all command center + team tables in one DB)
- **supabase_insert** — insert rows into any Supabase table
- **supabase_update** — update rows in any Supabase table (requires filters)

### Marketing & Ads
- **google_ads_query** — query any client's Google Ads account with GAQL (read-only)
- **google_ads_mutate** — create, update, or remove Google Ads resources (campaigns, budgets, ad groups, ads, keywords, negative keywords)
- **list_google_ads_accounts** — list all accessible Google Ads client accounts
- **meta_ads_manage** — read or write Meta/Facebook/Instagram Ads via Graph API (list campaigns, get insights, pause/enable, update budgets, create campaigns/ad sets/ads)
- **supermetrics_query** — pull marketing data from GA4, Google Ads, Meta Ads, Instagram, LinkedIn, Search Console, etc.
- **supermetrics_accounts** — list available accounts for any Supermetrics data source
- **semrush_query** — SEO data: domain overview, organic keywords, backlinks, keyword research, competitor analysis

### Client Accounts
- **get_client_accounts** — look up a client's linked ad accounts (Google Ads, Meta Ads, etc.), GA4 property, domain, and metadata. Call with no args to see ALL active clients.

### Analytics
- **ga4_query** — query Google Analytics 4 data (sessions, users, conversions, traffic sources, pages, etc.) using the GA4 Data API

### Communication
- **send_email** — send an email to anyone (via Resend)
- **slack_post** — post a message to any Slack channel
- **slack_history** — read message history from a Slack channel
- **slack_list_channels** — list all Slack channels and their IDs
- **http_request** — make any HTTP/API call (Meta Ads, Stripe, any REST API)

### Google Sheets
- **google_sheets_read** — read data from any Google Sheets spreadsheet
- **google_sheets_write** — write or append data to any Google Sheets spreadsheet

### Scheduling & Memory
- **create_cron_job** — schedule a recurring task (daily reports, weekly summaries, etc.)
- **list_cron_jobs** / **delete_cron_job** — manage scheduled tasks
- **save_memory** / **append_memory** — persist notes about this person across sessions
- **create_agent** — queue background tasks
- **get_current_date** — get the exact current date/time (always call this before building date ranges)

## Melleka Turbo AI Platform (turbo.melleka.com):
The main client-facing SaaS product. Key facts for the team:
- **Stack**: React 18 + TypeScript + Vite (frontend), Supabase Edge Functions (backend), Supabase Postgres (DB)
- **Supabase project**: nhebotmrnxixvcvtspet (prod) — app.melleka.com / turbo.melleka.com
- **Plans**: Self-Managed AI ($499), Team-Managed AI ($1,999), Full AI Suite ($2,999)
- **Stripe product IDs**: self-managed=prod_U452A2SLFdtmL0, team-managed=prod_U452QHJQiL3kd2, full-suite=prod_U4527flDgRuu96

### Client-Facing AI Agents (turbo.melleka.com/agents):
Each agent has a dedicated category with tools and system prompt tuning:
- **google-ads** — Google Ads API v23 via GAQL + mutations (campaigns, keywords, budgets, negatives)
- **meta-ads** — Meta Graph API v21.0 (campaigns, ad sets, insights, budgets)
- **seo**, **content**, **social**, **sales-emails**, **proposals**, **workflows** — LLM-only agents

### OAuth Architecture (how clients connect their ad accounts):
Clients connect their own Google Ads / Meta Ads accounts via OAuth 2.0. Melleka's developer token acts as the API identity; the client's OAuth token grants account access.

**Google Ads OAuth flow:**
1. Client clicks "Connect" in the agent page or Settings → Integrations
2. Frontend calls edge function \`google-ads-oauth\` → generates Google OAuth URL (scope: adwords)
3. Client approves → redirected back to \`turbo.melleka.com/settings?code=...&state=...\`
4. Settings.tsx detects the callback → calls \`google-ads-callback\` edge function
5. Edge function exchanges code for access_token + refresh_token → stores in \`oauth_connections\` table
6. Agent page re-checks connection → shows ChatInterface instead of setup screen

**Meta Ads OAuth flow (same pattern):**
1. \`meta-ads-oauth\` → generates Facebook OAuth URL (scope: ads_management, ads_read, business_management)
2. Callback hits \`meta-ads-callback\` → exchanges code for short-lived token → exchanges for 60-day long-lived token
3. Tokens stored in \`oauth_connections\`. **Meta has no refresh tokens** — expires after ~60 days, user must reconnect.

### Key DB Tables (Supabase):
- **oauth_connections** — (user_id, provider [google_ads|meta_ads], access_token, refresh_token, token_expires_at, customer_id, ad_account_id, account_name)
- **agent_memory** — (user_id, category, key, value) — per-agent persistent memory for each client
- **conversations** + **messages** — chat history per user/category
- **ai_usage** — token/cost tracking per user
- **client_profiles** — onboarding data (business_name, industry, goals, brand_voice, etc.)

### Edge Functions (supabase/functions/):
| Function | Purpose |
|---|---|
| ai-chat | Agentic loop: Claude tool_use → Google/Meta API → stream SSE response |
| google-ads-oauth | Generates Google OAuth URL with returnTo state |
| google-ads-callback | Exchanges code, stores tokens in oauth_connections |
| meta-ads-oauth | Generates Meta/Facebook OAuth URL |
| meta-ads-callback | Exchanges code for long-lived token, stores in oauth_connections |
| disconnect-integration | Deletes oauth_connections row for a provider |
| check-subscription | Verifies Stripe subscription status |
| create-checkout | Creates Stripe checkout session |
| admin-manage-users | Admin CRUD on users |
| admin-impersonate | Issues session token for user impersonation |

### Google Ads API Notes:
- API version: v23 — endpoint: \`https://googleads.googleapis.com/v23/customers/{id}/googleAds:search\`
- GAQL queries use snake_case field names (\`metrics.cost_micros\`, \`campaign.advertising_channel_type\`)
- **BUT JSON responses use camelCase** (\`r.metrics.costMicros\`, \`r.campaign.advertisingChannelType\`)
- Mutations endpoint: \`https://googleads.googleapis.com/v23/customers/{id}/{resource}:mutate\`
- Budget updates require fetching \`campaign.campaign_budget\` first (a separate resource), then mutating \`campaignBudgets\`
- Requires both: Developer Token header (\`developer-token\`) + client's OAuth Bearer token
- Access level: **Basic** — works with real client accounts (not just test accounts)

### Meta Ads API Notes:
- Graph API version: v21.0 — endpoint: \`https://graph.facebook.com/v21.0/{id}/insights\`
- Budgets are in cents (100 = $1.00), unlike Google's micros (1,000,000 = $1.00)
- Long-lived tokens expire ~60 days. No refresh_token mechanism. Must reconnect via OAuth.
- App requires review for \`ads_management\` + \`business_management\` scopes in production
- Meta ad account IDs are prefixed: \`act_123456789\`

## Google Ads Guidelines:
- ALWAYS call get_current_date first before building any date ranges
- To find a client's customer ID, call get_client_accounts (NOT list_google_ads_accounts) — it returns their linked account instantly
- Only use list_google_ads_accounts if you need to discover NEW accounts that aren't linked yet
- For performance reports use: SELECT campaign.name, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'
- GAQL uses snake_case in queries; JSON responses use camelCase (e.g., cost_micros in query → r.metrics.costMicros in result)
- cost_micros is in micros (divide by 1,000,000 to get dollars)
- Valid GAQL date literals: LAST_7_DAYS, LAST_14_DAYS, LAST_30_DAYS, LAST_90_DAYS (not arbitrary numbers)
- Format reports clearly: show campaign names, spend ($), clicks, impressions, CTR, conversions

### Google Ads Mutations (google_ads_mutate):
- **Pause a campaign**: resource='campaigns', operations=[{update:{resourceName:'customers/{cid}/campaigns/{id}', status:'PAUSED'}, updateMask:'status'}]
- **Enable a campaign**: same as above but status:'ENABLED'
- **Update budget**: First query to get the budget resource name: SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = {id}. Then: resource='campaignBudgets', operations=[{update:{resourceName:'customers/{cid}/campaignBudgets/{bid}', amountMicros:'{amount_in_micros}'}, updateMask:'amount_micros'}]
- **$50/day budget** = amountMicros: '50000000' (multiply dollars by 1,000,000)
- **Add negative keyword to campaign**: resource='campaignCriteria', operations=[{create:{campaign:'customers/{cid}/campaigns/{id}', negative:true, keyword:{text:'free',matchType:'BROAD'}}}]
- **Create a campaign**: First create a budget (resource='campaignBudgets', create with amountMicros + deliveryMethod:'STANDARD'). Then create the campaign with the returned budget resource name.
- **Create ad group**: resource='adGroups', create with campaign resource name, name, and cpcBidMicros
- **Create responsive search ad**: resource='adGroupAds', create with adGroup resource name and ad object containing responsiveSearchAd with headlines and descriptions
- **Add keywords to ad group**: resource='adGroupCriteria', create with adGroup resource name, keyword text, and matchType (EXACT, PHRASE, BROAD)
- ALWAYS confirm mutation details with the user before executing (campaign name, budget amount, etc.)

## Meta Ads Guidelines (meta_ads_manage):
- Use **meta_ads_manage** tool for ALL Meta/Facebook/Instagram ad operations — it handles auth automatically
- Budgets are in CENTS (not micros): $50/day = "5000", $100/day = "10000"
- Ad account IDs MUST be prefixed with \`act_\` (e.g. \`act_123456789\`)
- Tokens come from oauth_connections table (clients connect via OAuth with META_APP_ID + META_APP_SECRET)
- If no access_token is passed, the tool auto-queries oauth_connections for the most recent meta_ads token
- For a specific client, query oauth_connections by user_id first, then pass their access_token

### Meta Ads Read Operations:
- **List campaigns**: endpoint='/act_{id}/campaigns', params={fields:'id,name,status,objective,daily_budget,lifetime_budget,created_time'}
- **Get account insights**: endpoint='/act_{id}/insights', params={fields:'impressions,clicks,spend,cpm,ctr,cpc,actions', date_preset:'last_30d'}
- **Get campaign insights**: endpoint='/{campaign_id}/insights', params={fields:'impressions,clicks,spend,cpm,ctr,cpc,actions', date_preset:'last_30d'}
- **List ad sets**: endpoint='/{campaign_id}/adsets', params={fields:'id,name,status,daily_budget,targeting,optimization_goal'}
- **List ads**: endpoint='/{ad_set_id}/ads', params={fields:'id,name,status,creative'}

### Meta Ads Write Operations:
- **Pause campaign**: method='POST', endpoint='/{campaign_id}', params={status:'PAUSED'}
- **Enable campaign**: method='POST', endpoint='/{campaign_id}', params={status:'ACTIVE'}
- **Update daily budget**: method='POST', endpoint='/{campaign_id}', params={daily_budget:'5000'} (cents)
- **Create campaign**: method='POST', endpoint='/act_{id}/campaigns', params={name:'...', objective:'OUTCOME_LEADS', status:'PAUSED', special_ad_categories:'[]'}
- **Create ad set**: method='POST', endpoint='/{campaign_id}/adsets', params={name:'...', daily_budget:'5000', billing_event:'IMPRESSIONS', optimization_goal:'LEAD_GENERATION', targeting:'{"geo_locations":{"countries":["US"]},"age_min":25,"age_max":55}', start_time:'2026-03-10T00:00:00-0500'}
- **Delete campaign**: method='DELETE', endpoint='/{campaign_id}'
- ALWAYS confirm mutation details with the user before executing changes
- Common objectives: OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_APP_PROMOTION

## Client Account Auto-Lookup (CRITICAL — read this carefully):
- **@Mention Context**: If the user message starts with \`[Client Context — auto-resolved from @mentions]\`, that block contains pre-fetched client data (domain, ga4, ad account IDs by platform). USE THIS DATA DIRECTLY — do NOT call get_client_accounts again. The data is already verified and complete.
- If NO @mention context is present, BEFORE any Google Ads, Meta Ads, Supermetrics, or GA4 operation, call **get_client_accounts** to look up the client's linked ad accounts
- NEVER ask the user for a customer_id, ad_account_id, GA4 property ID, or ds_accounts value — look it up yourself
- If the client has a linked account, confirm briefly: "Using Google Ads account 123-456-7890 (Acme Search) for Acme Corp." then proceed immediately
- If NO account is linked for the requested platform, tell the user: "No [platform] account is linked to [client]. You can link one in Client Health → Account Mapping."
- For **Supermetrics queries**: use the account_id from client_account_mappings as the ds_accounts parameter (google_ads → AW, meta_ads → FA, bing_ads → BI)
- For **GA4 queries**: use the ga4_property_id from managed_clients with the ga4_query tool
- For **Google Ads**: use the google_ads account_id as customer_id
- For **Meta Ads**: use the meta_ads account_id (already prefixed with act_) as the ad account ID in endpoints
- If the user says a client name, ALWAYS call get_client_accounts with that name — never guess or ask for IDs
- If you don't know which client the user is referring to, call get_client_accounts with no args to list all active clients, then ask which one

## Supermetrics Guidelines:
- ALWAYS call get_current_date first before building any date ranges
- If you don't know which accounts are available, call supermetrics_accounts with the data source ID first
- Common data source IDs: GA4 (Google Analytics 4), AW (Google Ads), FA (Facebook Ads), IG (Instagram), LI (LinkedIn Ads), SC (Search Console), BI (Bing/Microsoft Ads), MA (Mailchimp)
- For custom date ranges use date_range_type "custom" with start_date and end_date in YYYY-MM-DD format
- For quick ranges use: "last_7_days", "last_30_days", "last_month", "this_month_inc", "this_year_inc"
- Use ds_accounts "list.all_accounts" to query across all connected accounts
- To find account IDs for a client, call get_client_accounts — it returns all linked accounts instantly
- Format reports clearly with proper labels, dollar formatting, and percentages

## Supabase Guidelines:
- All tables (team + command center) live in one Supabase project — use default project (no project param needed)
- 'turbo' project available for Melleka Turbo AI (profiles, conversations, messages, oauth_connections, agent_memory, ai_usage)
- Use filters to narrow results: [{column: "member_name", op: "eq", value: "anthony"}]
- Use order: "created_at.desc" for newest-first results
- Always use at least one filter with supabase_update to avoid accidental full-table updates

## Command Center Database:
All command center tables live in the default Supabase project. You have full read/write access.

### Client Management
- **managed_clients** — Master client list: client_name, domain, ga4_property_id, industry, is_active, tier (premium/advanced/basic), primary_conversion_goal, tracked_conversion_types[], multi_account_enabled, site_audit_url
- **client_profiles** — Branding: client_name, domain, logo_url, brand_colors (JSON), social_accounts (JSON)
- **client_account_mappings** — Links clients to ad accounts: client_name, platform (google_ads/meta_ads/bing_ads/tiktok_ads/linkedin_ads), account_id, account_name
- **client_health_history** — Historical health scores: client_name, health_score, config_completeness, ad_health, seo_health, seo_errors, days_since_ad_review, score_breakdown (JSON), missing_configs[]
- **client_ai_memory** — AI learnings per client: client_name, content, memory_type (recommendation/observation/win/concern/metric_snapshot/strategy_note/benchmark), source, relevance_score, expires_at

### PPC / Strategist Data
- **ppc_daily_snapshots** — Daily PPC metrics: client_name, platform, snapshot_date, spend, clicks, impressions, conversions, cost_per_conversion, leads, purchases, calls, forms
- **ppc_optimization_sessions** — Strategist sessions: client_name, platform, date_range_start/end, ai_summary, ai_reasoning, auto_mode, supermetrics_data (JSON), status
- **ppc_proposed_changes** — Proposed PPC changes: session_id, client_name, platform, change_type, entity_type/name/id, before_value, after_value (JSON), ai_rationale, confidence, priority, approval_status, executed_at
- **ppc_change_results** — Change outcomes: change_id, session_id, outcome, metrics_before/after (JSON), delta (JSON), ai_assessment
- **ppc_client_settings** — Per-client PPC config: client_name, auto_mode_enabled, auto_mode_platform, confidence_threshold, max_changes_per_run, google_account_id, meta_account_id

### Ad Reviews
- **ad_review_history** — Saved reviews: client_name, review_date, date_range_start/end, summary, platforms (JSON), insights (JSON), recommendations (JSON), action_items (JSON), changes_made (JSON), week_over_week (JSON), benchmark_comparison (JSON), seo_data (JSON), industry

### SEO Data
- **seo_history** — SEO snapshots: client_name, domain, organic_keywords, organic_traffic, domain_authority, backlinks, referring_domains, paid_keywords, paid_traffic, top_keywords (JSON), competitors (JSON), recommendations (JSON), overall_health, summary
- **site_audit_cache** — Site health: client_name, site_audit_url, site_health_score, site_errors, site_warnings, site_notices, last_scraped_at

### Proposals & Decks
- **proposals** — Marketing proposals: client_name, title, slug, content (JSON), html_content, services[], budget_range, timeline, status
- **decks** — Performance report decks: client_name, slug, content (JSON), brand_colors (JSON), date_range_start/end, status
- **package_definitions** — Service packages: name, category, channels, monthly_price, services (JSON), tier

### Fleet & Config
- **fleet_run_jobs** — Fleet run tracking: status, progress, total_clients, current_client, results (JSON)
- **strategist_config** — AI config: config_key, config_value (e.g. custom_instructions, memory_cap_per_client)
- **strategist_knowledge_docs** — Knowledge base: file_name, file_url, parsed_content, summary, category, tags[]

## AI Strategist Role:
You ARE the AI Strategist. You replace the previous edge-function-based strategist. Your job:
1. **Daily Data Refresh**: Pull fresh PPC data (Supermetrics), SEO data (SEMrush), and update the command center tables
2. **PPC Analysis**: For each active client, analyze ad performance, identify issues (high CPA, low CTR, wasted spend, missing negatives)
3. **Propose Changes**: Write recommendations to ppc_proposed_changes with rationale and confidence level
4. **Execute Approved Changes**: Use google_ads_mutate and meta_ads_manage to implement approved changes
5. **Track Results**: After changes, compare before/after metrics and record in ppc_change_results
6. **Build Memory**: Store learnings in client_ai_memory (what works, what doesn't, patterns, benchmarks)
7. **Health Scoring**: Update client_health_history with overall health, ad health, SEO health scores

### Daily Routine (when triggered by cron):
1. Get all active clients: supabase_query on managed_clients WHERE is_active=true
2. For each client, get their ad account mappings from client_account_mappings
3. Pull last 7 days of ad data via supermetrics_query (Google Ads + Meta Ads)
4. Insert daily snapshot into ppc_daily_snapshots
5. Pull SEO data via semrush_query for each client's domain
6. Update seo_history with latest metrics
7. Analyze performance: compare to previous periods, identify trends, flag issues
8. Update client_health_history with current health scores
9. Send summary email with insights, flags, and action items

## Slack Guidelines:
- Use slack_list_channels first to find channel IDs if you don't know them
- Channel IDs look like 'C01234ABCDE' — use these with slack_history and slack_post
- After finding channel IDs, save them with append_memory so you remember them
- Slack mrkdwn formatting: *bold*, _italic_, ~strikethrough~, backtick for code, triple backtick for code block, <url|text>

## Google Sheets Guidelines:
- The spreadsheet must be shared with the service account email (found in GOOGLE_SERVICE_ACCOUNT_JSON → client_email)
- Spreadsheet ID is the long string in the URL between /d/ and /edit
- Range uses A1 notation: 'Sheet1!A1:D10', 'Sheet1', or just 'A1:D10' for first sheet
- Use append: true to add rows at the bottom instead of overwriting
- For reading, omit range to get the entire first sheet

## SEMrush Guidelines:
- ALWAYS call get_current_date first to know today's date for context
- Common report types: domain_organic (organic keywords for a domain), domain_overview (summary stats), phrase_organic (keyword difficulty/volume), backlinks_overview
- For domain reports, pass the domain without protocol: 'melleka.com' not 'https://melleka.com'
- Export columns vary by report type. Key columns: Ph (keyword), Po (position), Nq (search volume), Cp (CPC), Ur (URL), Tr (traffic %), Co (competition)
- Default database is 'us' — change for international SEO (uk, ca, au, etc.)
- Format results clearly: keyword, position, volume, traffic estimate, URL

## Marketing Expertise:
${marketingSkills}

## Guidelines:
- Greet the team member by name at the start of new conversations
- When someone asks to build a website: write the files to \`${scratchDir}/site/\`, then call \`deploy_site\` with that directory — give them the live URL
- When someone asks to send an email: use the send_email tool directly — just do it
- When someone asks for Google Ads data or any ad platform data: ALWAYS use supermetrics_query first (it's the most reliable data source). Only fall back to google_ads_query if supermetrics_query doesn't have what you need.
- When someone asks for analytics, cross-platform reports, or data from GA4/Meta/Instagram/LinkedIn/Search Console: use supermetrics_query
- When someone asks to hit an API or pull a report: use http_request to fetch the data
- When someone asks about the database, users, subscriptions, or any table: use supabase_query (specify project if not team)
- When someone asks to post in Slack or check Slack messages: use slack_post / slack_history
- When someone asks about spreadsheets or Google Sheets: use google_sheets_read / google_sheets_write
- When someone asks about SEO, keywords, rankings, backlinks, or competitor analysis: use semrush_query
- When someone asks to schedule something: use create_cron_job with a cron expression
- After learning something important about a person, call append_memory to remember it
- Be proactive — read files, run commands, get things done
- For multi-step tasks, show your plan then execute step by step
- Always explain what tool calls you're making and why
- When asked about marketing tasks, apply the marketing expertise above — use frameworks, pull real data with tools, and execute
- For ad campaigns: pull current performance data first, analyze what's working, then recommend/implement changes
- For content creation: research the topic (SEMrush, competitor analysis), apply copywriting frameworks, then create
- For SEO work: use semrush_query for keyword data, audit the page, provide specific recommendations
- For analytics: use supermetrics_query to pull cross-platform data, format reports clearly with insights
- For social media: apply platform-specific strategies, create content calendars, write posts with strong hooks
- For email campaigns: design full sequences with subject lines, preview text, body copy, and CTAs
- When building landing pages or sites: write the code, deploy with deploy_site, and give the live URL
- Always back recommendations with data — pull actual performance numbers before suggesting changes`;
}

/** SSE writer function type — null = background (no streaming) */
type SseWriter = ((event: Record<string, unknown>) => void) | null;

/** Safe writer that catches errors when client disconnects */
function safeWrite(write: SseWriter): SseWriter {
  if (!write) return null;
  return (event) => {
    try { write(event); } catch { /* client disconnected, continue processing */ }
  };
}

/** Core agentic loop. Pass a writer for SSE streaming, or null for background runs. */
async function runChat(
  memberName: string,
  messages: Anthropic.MessageParam[],
  write: SseWriter
): Promise<string> {
  const [memory, claudeMd, marketingSkills] = await Promise.all([
    readMemory(memberName),
    loadClaudeMd(),
    loadMarketingSkills(),
  ]);
  const systemPrompt = buildSystemPrompt(memberName, memory, claudeMd, marketingSkills);
  console.log(`[runChat] ${memberName} | system prompt length=${systemPrompt.length}, history=${messages.length} messages`);
  let fullResponse = "";
  const currentMessages = [...messages];

  // Rough token estimation: 1 token ≈ 4 chars
  const estimateTokens = (msgs: Anthropic.MessageParam[]): number => {
    let chars = 0;
    for (const m of msgs) {
      if (typeof m.content === "string") {
        chars += m.content.length;
      } else if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if ("text" in block && typeof block.text === "string") chars += block.text.length;
          else if ("content" in block && typeof block.content === "string") chars += block.content.length;
          else chars += JSON.stringify(block).length;
        }
      }
    }
    return Math.ceil(chars / 4);
  };

  // Compress old tool results to free up context space
  const compressOldMessages = (msgs: Anthropic.MessageParam[], keepRecent: number): void => {
    // Find tool_result messages older than the last N pairs and shrink them
    let toolResultCount = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === "user" && Array.isArray(m.content)) {
        const hasToolResult = m.content.some((b: any) => b.type === "tool_result");
        if (hasToolResult) {
          toolResultCount++;
          if (toolResultCount > keepRecent) {
            // Compress this tool result to a short summary
            msgs[i] = {
              role: "user",
              content: (m.content as any[]).map((b: any) => {
                if (b.type === "tool_result" && typeof b.content === "string" && b.content.length > 200) {
                  return { ...b, content: b.content.slice(0, 200) + "\n[...compressed — old result]" };
                }
                return b;
              }),
            };
          }
        }
      }
      // Also compress old assistant text blocks (keep tool_use blocks intact for API validity)
      if (m.role === "assistant" && Array.isArray(m.content) && toolResultCount > keepRecent) {
        msgs[i] = {
          role: "assistant",
          content: (m.content as any[]).map((b: any) => {
            if (b.type === "text" && typeof b.text === "string" && b.text.length > 300) {
              return { ...b, text: b.text.slice(0, 300) + "..." };
            }
            return b;
          }),
        };
      }
    }
  };

  const MAX_ITERATIONS = 30;
  const CONTEXT_TOKEN_LIMIT = 150000; // Leave room for system prompt + tools + response

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Compress older messages if context is getting large
      const estimatedTokens = estimateTokens(currentMessages);
      console.log(`[runChat] ${memberName} | iteration ${iteration}, messages=${currentMessages.length}, ~${estimatedTokens} tokens`);

      if (estimatedTokens > CONTEXT_TOKEN_LIMIT) {
        compressOldMessages(currentMessages, 4); // Keep last 4 tool exchanges in full detail
        const afterTokens = estimateTokens(currentMessages);
        console.log(`[runChat] ${memberName} | compressed context: ${estimatedTokens} → ${afterTokens} tokens`);
      }

      let stream;
      try {
        stream = await client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 16384,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS,
          messages: currentMessages,
        });
      } catch (err: any) {
        // If context too large, try aggressive compression and retry once
        if (err.status === 400 && err.message?.includes("too long")) {
          compressOldMessages(currentMessages, 2);
          console.log(`[runChat] ${memberName} | context too long, compressed aggressively and retrying`);
          try {
            stream = await client.messages.stream({
              model: "claude-opus-4-6",
              max_tokens: 16384,
              system: systemPrompt,
              tools: TOOL_DEFINITIONS,
              messages: currentMessages,
            });
          } catch (retryErr: any) {
            const errMsg = `\n\n[Error: Failed to connect to Claude API — ${retryErr.message}]`;
            fullResponse += errMsg;
            write?.({ type: "text", delta: errMsg });
            break;
          }
        } else {
          const errMsg = `\n\n[Error: Failed to connect to Claude API — ${err.message}]`;
          fullResponse += errMsg;
          write?.({ type: "text", delta: errMsg });
          break;
        }
      }

      let currentToolUseId: string | null = null;
      // Track raw JSON input per tool_use ID so parallel tool calls don't clobber each other
      const toolInputBuffers = new Map<string, string>();
      const assistantBlocks: Anthropic.ContentBlock[] = [];
      let stopReason: string | null = null;

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolUseId = event.content_block.id;
            toolInputBuffers.set(currentToolUseId, "");
            assistantBlocks.push({
              type: "tool_use",
              id: currentToolUseId,
              name: event.content_block.name,
              input: {},
            } as Anthropic.ToolUseBlock);
            write?.({ type: "tool_start", name: event.content_block.name });
          } else if (event.content_block.type === "text") {
            assistantBlocks.push({ type: "text", text: "", citations: [] } as Anthropic.TextBlock);
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const delta = event.delta.text;
            fullResponse += delta;
            const lastBlock = assistantBlocks[assistantBlocks.length - 1];
            if (lastBlock?.type === "text") lastBlock.text += delta;
            write?.({ type: "text", delta });
          } else if (event.delta.type === "input_json_delta" && currentToolUseId) {
            const buf = (toolInputBuffers.get(currentToolUseId) ?? "") + event.delta.partial_json;
            toolInputBuffers.set(currentToolUseId, buf);
            const toolBlock = assistantBlocks.find(
              (b) => b.type === "tool_use" && (b as Anthropic.ToolUseBlock).id === currentToolUseId
            ) as Anthropic.ToolUseBlock | undefined;
            if (toolBlock) {
              try { toolBlock.input = JSON.parse(buf); } catch { /* partial JSON, will complete */ }
            }
          }
        } else if (event.type === "message_delta") {
          stopReason = event.delta.stop_reason ?? null;
        }
      }

      currentMessages.push({ role: "assistant", content: assistantBlocks });

      // Check if there are tool_use blocks to execute
      const toolBlocks = assistantBlocks.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];

      if (stopReason === "max_tokens" && toolBlocks.length > 0) {
        // Hit token limit mid-tool-call — the last tool_use likely has truncated input
        // Remove the incomplete tool_use (last one) and tell Claude to retry with smaller output
        const incompleteBlock = toolBlocks[toolBlocks.length - 1];
        write?.({ type: "text", delta: "\n\n(Output was too large — retrying with chunked approach...)\n" });
        fullResponse += "\n\n(Output was too large — retrying with chunked approach...)\n";
        currentMessages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: incompleteBlock.id,
            content: "ERROR: Your response was cut off because it exceeded the token limit. The file content was too large for a single tool call. Please break it into smaller chunks: write the file in multiple parts using write_file, or use run_command with heredoc/echo to write sections. Try again with a shorter approach.",
            is_error: true,
          }],
        });
        continue;
      }

      if (stopReason !== "tool_use") break;

      const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolBlocks) {
        // Use the fully parsed input from the per-tool buffer (not the shared variable)
        const rawBuf = toolInputBuffers.get(block.id) ?? "";
        let parsedInput: Record<string, unknown>;
        try {
          parsedInput = rawBuf ? JSON.parse(rawBuf) : (block.input as Record<string, unknown>);
        } catch {
          parsedInput = block.input as Record<string, unknown>;
        }

        const result = await executeTool(block.name, parsedInput, memberName);
        write?.({ type: "tool_result", name: block.name, output: result.slice(0, 500) });

        // Cap tool results to prevent context bloat — tighter limit on mutation confirmations
        const maxLen = result.startsWith("Mutation successful") ? 2000 : 6000;
        const trimmedResult = result.length > maxLen
          ? result.slice(0, maxLen) + "\n[...truncated — full result was " + result.length + " chars]"
          : result;

        toolResultContent.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: trimmedResult,
        });
      }

      currentMessages.push({ role: "user", content: toolResultContent });
    }
  } catch (err: any) {
    // Preserve partial response on any error in the agentic loop
    console.error("[runChat] Error in agentic loop:", err.message);
    const errMsg = `\n\n[Response interrupted: ${err.message}]`;
    fullResponse += errMsg;
    write?.({ type: "text", delta: errMsg });
  }

  return fullResponse;
}

/** Stream chat to an Express SSE response */
export async function streamChat(
  memberName: string,
  messages: Anthropic.MessageParam[],
  res: Response
): Promise<string> {
  const write: SseWriter = safeWrite((event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
  return runChat(memberName, messages, write);
}

/** Run chat in the background (no SSE, just returns the full response) */
export async function runChatBackground(
  memberName: string,
  messages: Anthropic.MessageParam[]
): Promise<string> {
  return runChat(memberName, messages, null);
}

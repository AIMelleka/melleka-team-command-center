import { useState } from 'react';
import AdminHeader from '@/components/AdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot, FileCode, Rocket, Brain, Globe, Mail, Clock, BarChart3,
  Database, MessageSquare, Table2, Search, Eye, Palette, Wrench,
  Zap, Shield, Megaphone, PenLine, Target, MousePointerClick,
  TrendingUp, MailOpen, Share2, LineChart, FlaskConical,
  HeartHandshake, DollarSign, Code2, ShoppingCart, BookOpen,
  FileSpreadsheet, Presentation, Image, Video, Lightbulb,
  Monitor, FolderOpen, Lock, Users, Plug, Workflow, Mic,
} from 'lucide-react';

// ─── Marketing Skills (from marketing-skills.md) ────────────────────────────

interface Skill {
  label: string;
  icon: typeof Bot;
  color: string;
  description: string;
  highlights: string[];
}

const MARKETING_SKILLS: Skill[] = [
  {
    label: 'Paid Advertising',
    icon: Megaphone,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400',
    description: 'Google Ads, Meta, LinkedIn, TikTok campaign strategy and optimization.',
    highlights: [
      'Platform selection by objective',
      'Campaign structure and naming conventions',
      'Ad copy frameworks (PAS, BAB, Social Proof)',
      'Optimization levers (CPA, CTR, CPM)',
      'Retargeting strategy (hot/warm/cold)',
      'Budget scaling (20-30% increments)',
    ],
  },
  {
    label: 'Ad Creative Generation',
    icon: Palette,
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    description: 'Generate ad copy that fits platform limits and converts.',
    highlights: [
      'Platform character limits (Google RSA, Meta, LinkedIn, TikTok)',
      '7 creative angle categories',
      'Specificity over vagueness in copy',
      'Iteration loop: data > patterns > variations > test > retire',
    ],
  },
  {
    label: 'Copywriting',
    icon: PenLine,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    description: 'Landing pages, headlines, CTAs, and page structure.',
    highlights: [
      'Clarity over cleverness, benefits over features',
      'Headline formulas and CTA copy patterns',
      'Above-the-fold structure',
      'Core page sections (social proof, problem, solution, how it works, objections, final CTA)',
    ],
  },
  {
    label: 'SEO Audit & Optimization',
    icon: Search,
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
    description: 'Technical SEO, on-page optimization, and content quality (E-E-A-T).',
    highlights: [
      'Audit priority: crawlability > technical > on-page > content > authority',
      'Technical SEO checklist (Core Web Vitals, sitemap, HTTPS)',
      'On-page SEO (title tags, meta descriptions, H1 hierarchy)',
      'Common issues by site type (SaaS, e-commerce, blog, local)',
    ],
  },
  {
    label: 'AI SEO (AEO/GEO/LLMO)',
    icon: Brain,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    description: 'Optimize for AI Overviews and LLM citations.',
    highlights: [
      'Three pillars: Structure, Authority, Presence',
      'Content types that get cited most (comparisons, guides, research)',
      'Schema markup for AI (Article, HowTo, FAQPage)',
      'AI Overviews in ~45% of Google searches',
    ],
  },
  {
    label: 'Content Strategy',
    icon: BookOpen,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    description: 'Searchable vs shareable content, keyword research by buyer stage.',
    highlights: [
      'Content types: use-case, hub & spoke, templates, thought leadership, case studies',
      'Keyword research by buyer stage (awareness > consideration > decision)',
      'Content prioritization matrix (impact, fit, search potential, resources)',
    ],
  },
  {
    label: 'Programmatic SEO',
    icon: Code2,
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    description: '12 playbooks for scalable, template-driven SEO pages.',
    highlights: [
      'Templates, comparisons, locations, personas, integrations',
      'Glossary, alternatives playbooks',
      'Quality over quantity: 100 great pages > 10,000 thin pages',
    ],
  },
  {
    label: 'Page CRO',
    icon: MousePointerClick,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    description: 'Conversion rate optimization for landing pages, homepages, and pricing.',
    highlights: [
      'Analysis framework: value prop > headline > CTA > hierarchy > trust > objections > friction',
      'Page-specific CRO (homepage, landing, pricing, feature)',
    ],
  },
  {
    label: 'Marketing Psychology',
    icon: Target,
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    description: '70+ mental models for pricing, persuasion, and behavior.',
    highlights: [
      'Pricing psychology (anchoring, decoy, charm pricing, rule of 100)',
      'Persuasion (reciprocity, social proof, scarcity, loss aversion)',
      'Behavior models (BJ Fogg, endowment effect, goal-gradient)',
    ],
  },
  {
    label: 'Email Marketing',
    icon: MailOpen,
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    description: 'Sequences, copy rules, and subject line formulas.',
    highlights: [
      'Sequence types: welcome, lead nurture, re-engagement, onboarding',
      'One email, one job, one CTA',
      'Subject line patterns (question, how-to, number, direct, story)',
    ],
  },
  {
    label: 'Social Media Content',
    icon: Share2,
    color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    description: 'Platform strategy, content pillars, hooks, and repurposing.',
    highlights: [
      'Platform strategy (LinkedIn, X, Instagram, TikTok)',
      'Content pillar mix (30% insights, 25% BTS, 25% educational, 15% personal, 5% promo)',
      'Hook formulas and repurposing system',
    ],
  },
  {
    label: 'Analytics & Tracking',
    icon: LineChart,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    description: 'Event tracking, UTM strategy, and attribution.',
    highlights: [
      'Essential events (CTA clicks, form submits, signups, purchases)',
      'UTM parameter strategy',
      'Attribution: blended CAC, platform vs GA4 comparison',
    ],
  },
  {
    label: 'A/B Testing',
    icon: FlaskConical,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    description: 'Sample sizes, run duration, and testing hierarchy.',
    highlights: [
      'Minimum 1,000 visitors per variation, 2-week minimum',
      'Testing hierarchy: concept > hook > visual > body > CTA',
    ],
  },
  {
    label: 'Churn Prevention',
    icon: HeartHandshake,
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    description: 'Dunning emails, cancel flow optimization.',
    highlights: [
      'Dunning: 3-4 emails over 7-14 days, escalating urgency',
      'Cancel flow: ask why, offer save, confirm gracefully',
    ],
  },
  {
    label: 'Pricing Strategy',
    icon: DollarSign,
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    description: 'Tier structure, pricing page optimization.',
    highlights: [
      'Good-Better-Best (3 tiers max)',
      'Anchor with highest tier, highlight recommended plan',
      'Address "which plan?" anxiety, FAQ below pricing',
    ],
  },
  {
    label: 'Schema & Sales Enablement',
    icon: ShoppingCart,
    color: 'bg-stone-500/10 text-stone-600 dark:text-stone-400',
    description: 'Structured data markup and sales collateral.',
    highlights: [
      'Priority schemas: Article, HowTo, FAQ, Product, LocalBusiness',
      'Key assets: one-pagers, ROI calculators, case studies, battle cards',
    ],
  },
];

// ─── API Tools (from tools.ts TOOL_DEFINITIONS) ─────────────────────────────

interface ToolInfo {
  name: string;
  description: string;
}

interface ToolCategory {
  label: string;
  icon: typeof Bot;
  color: string;
  tools: ToolInfo[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    label: 'Files & Code',
    icon: FileCode,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    tools: [
      { name: 'read_file', description: 'Read file contents from the server filesystem' },
      { name: 'write_file', description: 'Write content to a file on the server' },
      { name: 'run_command', description: 'Execute shell commands with safety checks (2 min timeout)' },
      { name: 'list_files', description: 'List directory contents with file/folder indicators' },
      { name: 'search_code', description: 'Search code patterns using ripgrep' },
    ],
  },
  {
    label: 'Site Deployment',
    icon: Rocket,
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
    tools: [
      { name: 'deploy_site', description: 'Deploy websites to Vercel with custom melleka.app domains' },
    ],
  },
  {
    label: 'Memory',
    icon: Brain,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    tools: [
      { name: 'save_memory', description: 'Save persistent memory for future conversations' },
      { name: 'append_memory', description: 'Append notes to existing memory' },
    ],
  },
  {
    label: 'Agents',
    icon: Bot,
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    tools: [
      { name: 'create_agent', description: 'Create background sub-agents for async tasks' },
    ],
  },
  {
    label: 'HTTP',
    icon: Globe,
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    tools: [
      { name: 'http_request', description: 'Make HTTP requests (GET, POST, etc.) with 10-min timeout' },
    ],
  },
  {
    label: 'Email',
    icon: Mail,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400',
    tools: [
      { name: 'send_email', description: 'Send emails via Resend API' },
    ],
  },
  {
    label: 'Cron Jobs',
    icon: Clock,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    tools: [
      { name: 'create_cron_job', description: 'Schedule recurring tasks with cron expressions' },
      { name: 'list_cron_jobs', description: 'View all scheduled cron jobs' },
      { name: 'delete_cron_job', description: 'Remove a scheduled cron job' },
    ],
  },
  {
    label: 'Google Ads',
    icon: BarChart3,
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    tools: [
      { name: 'google_ads_query', description: 'Query Google Ads data via GAQL (campaigns, keywords, metrics)' },
      { name: 'list_google_ads_accounts', description: 'List all accessible Google Ads accounts' },
      { name: 'google_ads_mutate', description: 'Create, update, or delete Google Ads resources' },
    ],
  },
  {
    label: 'Meta Ads',
    icon: Eye,
    color: 'bg-blue-600/10 text-blue-700 dark:text-blue-300',
    tools: [
      { name: 'meta_ads_manage', description: 'Read/write Meta (Facebook/Instagram) Ads via Graph API v21.0' },
    ],
  },
  {
    label: 'Supermetrics',
    icon: Zap,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    tools: [
      { name: 'supermetrics_query', description: 'Query cross-platform marketing data (Google, Meta, LinkedIn, etc.)' },
      { name: 'supermetrics_accounts', description: 'List connected data source accounts' },
    ],
  },
  {
    label: 'Database',
    icon: Database,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    tools: [
      { name: 'supabase_query', description: 'Query Supabase tables with filters, ordering, and limits' },
      { name: 'supabase_insert', description: 'Insert rows into Supabase tables' },
      { name: 'supabase_update', description: 'Update rows in Supabase tables with filters' },
    ],
  },
  {
    label: 'Slack',
    icon: MessageSquare,
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    tools: [
      { name: 'slack_post', description: 'Post messages to Slack channels' },
      { name: 'slack_history', description: 'Get message history from Slack channels' },
      { name: 'slack_list_channels', description: 'List available Slack channels' },
    ],
  },
  {
    label: 'Google Sheets',
    icon: Table2,
    color: 'bg-green-600/10 text-green-700 dark:text-green-300',
    tools: [
      { name: 'google_sheets_read', description: 'Read data from Google Sheets spreadsheets' },
      { name: 'google_sheets_write', description: 'Write data to Google Sheets spreadsheets' },
    ],
  },
  {
    label: 'SEMrush',
    icon: Search,
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    tools: [
      { name: 'semrush_query', description: 'Query SEMrush for SEO and competitive intelligence data' },
    ],
  },
  {
    label: 'Google Analytics',
    icon: BarChart3,
    color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    tools: [
      { name: 'ga4_query', description: 'Query GA4 data (sessions, conversions, bounce rate, traffic sources)' },
    ],
  },
  {
    label: 'Notion',
    icon: Shield,
    color: 'bg-stone-500/10 text-stone-600 dark:text-stone-400',
    tools: [
      { name: 'notion_query_tasks', description: 'Query Notion task database with client name fuzzy matching' },
    ],
  },
  {
    label: 'Canva',
    icon: Palette,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    tools: [
      { name: 'canva_create_design', description: 'Create new Canva designs (presets or custom dimensions)' },
      { name: 'canva_list_designs', description: 'List existing Canva designs with thumbnails' },
      { name: 'canva_get_design', description: 'Get design metadata, URLs, and page count' },
      { name: 'canva_export_design', description: 'Export designs to PDF, PNG, JPG, GIF, PPTX, or MP4' },
      { name: 'canva_upload_asset', description: 'Upload images/videos to Canva from a URL' },
      { name: 'canva_list_brand_templates', description: 'List Canva brand templates for autofill' },
      { name: 'canva_autofill_design', description: 'Auto-fill brand templates with custom text and images' },
    ],
  },
  {
    label: 'Automations (Zapier)',
    icon: Workflow,
    color: 'bg-orange-600/10 text-orange-700 dark:text-orange-300',
    tools: [
      { name: 'automations (list)', description: 'List all available Zapier automations and their parameters' },
      { name: 'automations (search)', description: 'Search for specific automations by name or keyword' },
      { name: 'automations (execute)', description: 'Execute a Zapier action (send email, post to Slack, create CRM record, etc.)' },
    ],
  },
  {
    label: 'Voice & Audio (ElevenLabs)',
    icon: Mic,
    color: 'bg-violet-600/10 text-violet-700 dark:text-violet-300',
    tools: [
      { name: 'voice (speak)', description: 'Generate voiceovers with 100+ voices, adjustable style, 70+ languages' },
      { name: 'voice (voices)', description: 'Browse and search available voices by name, accent, or style' },
      { name: 'voice (sound_effect)', description: 'Generate sound effects from text descriptions (up to 30s)' },
      { name: 'voice (isolate)', description: 'Remove background noise from audio files' },
      { name: 'voice (clone)', description: 'Clone a voice from an audio sample (1-2 min of speech)' },
      { name: 'voice (dub)', description: 'Translate and dub audio to 32+ languages preserving speaker voice' },
    ],
  },
  {
    label: 'Utilities',
    icon: Wrench,
    color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    tools: [
      { name: 'get_current_date', description: 'Get the current date and time' },
      { name: 'get_client_accounts', description: 'Look up client ad accounts, GA4 property, domain, and metadata' },
    ],
  },
];

// ─── Community Skills (from awesome-claude-skills) ───────────────────────────

interface CommunitySkill {
  name: string;
  description: string;
}

interface CommunityCategory {
  label: string;
  icon: typeof Bot;
  color: string;
  skills: CommunitySkill[];
}

const COMMUNITY_SKILLS: CommunityCategory[] = [
  {
    label: 'Document Processing',
    icon: FileSpreadsheet,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    skills: [
      { name: 'docx', description: 'Create, edit, and analyze Word documents with tracked changes and comments' },
      { name: 'pdf', description: 'Extract text, tables, metadata; merge and annotate PDFs' },
      { name: 'pptx', description: 'Read, generate, and adjust presentation slides and layouts' },
      { name: 'xlsx', description: 'Spreadsheet manipulation with formulas, charts, and data transformations' },
      { name: 'Markdown to EPUB Converter', description: 'Convert markdown documents into professional EPUB ebook files' },
    ],
  },
  {
    label: 'Development & Code',
    icon: Code2,
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    skills: [
      { name: 'artifacts-builder', description: 'Create multi-component HTML artifacts using React and Tailwind CSS' },
      { name: 'aws-skills', description: 'AWS development with CDK patterns and serverless architecture' },
      { name: 'Changelog Generator', description: 'Transform git commits into customer-friendly release notes' },
      { name: 'D3.js Visualization', description: 'Produce D3 charts and interactive data visualizations' },
      { name: 'MCP Builder', description: 'Create high-quality MCP servers for API integration' },
      { name: 'Playwright Browser Automation', description: 'Model-invoked Playwright automation for web testing' },
      { name: 'prompt-engineering', description: 'Well-known prompt engineering techniques and patterns' },
      { name: 'software-architecture', description: 'Design patterns and SOLID principles implementation' },
      { name: 'subagent-driven-development', description: 'Dispatch independent subagents with code review checkpoints' },
      { name: 'test-driven-development', description: 'TDD methodology for feature implementation' },
      { name: 'Skill Creator', description: 'Guidance for creating effective Claude Skills' },
      { name: 'Skill Seekers', description: 'Convert documentation websites into Claude skills' },
      { name: 'Webapp Testing', description: 'Test local web applications using Playwright' },
      { name: 'using-git-worktrees', description: 'Create isolated git worktrees safely' },
      { name: 'finishing-a-development-branch', description: 'Guide completion of development workflows' },
      { name: 'iOS Simulator', description: 'Interact with iOS Simulator for testing applications' },
    ],
  },
  {
    label: 'Data & Analysis',
    icon: LineChart,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    skills: [
      { name: 'CSV Data Summarizer', description: 'Analyze CSV files and generate insights with visualizations' },
      { name: 'deep-research', description: 'Execute autonomous multi-step research with web sources' },
      { name: 'postgres', description: 'Execute read-only SQL queries against PostgreSQL databases' },
      { name: 'root-cause-tracing', description: 'Trace errors back to their original triggers' },
    ],
  },
  {
    label: 'Business & Marketing',
    icon: Megaphone,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400',
    skills: [
      { name: 'Brand Guidelines', description: 'Apply brand colors, typography, and visual identity consistently' },
      { name: 'Competitive Ads Extractor', description: 'Extract and analyze competitors\' ads for insights' },
      { name: 'Domain Name Brainstormer', description: 'Generate domain name ideas and check availability' },
      { name: 'Internal Comms', description: 'Write internal communications using company-specific formats' },
      { name: 'Lead Research Assistant', description: 'Identify and qualify high-quality leads from multiple sources' },
    ],
  },
  {
    label: 'Communication & Writing',
    icon: PenLine,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    skills: [
      { name: 'article-extractor', description: 'Extract full article text and metadata from web pages' },
      { name: 'brainstorming', description: 'Transform rough ideas into fully-formed designs' },
      { name: 'Content Research Writer', description: 'Conduct research, add citations, and improve content quality' },
      { name: 'Meeting Insights Analyzer', description: 'Analyze meeting transcripts for behavioral patterns' },
      { name: 'Twitter Algorithm Optimizer', description: 'Optimize tweets using Twitter\'s algorithm insights' },
    ],
  },
  {
    label: 'Creative & Media',
    icon: Image,
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    skills: [
      { name: 'Canvas Design', description: 'Create visual art in PNG and PDF using design philosophy' },
      { name: 'Image Enhancer', description: 'Improve image quality and resolution' },
      { name: 'Slack GIF Creator', description: 'Create optimized animated GIFs for Slack' },
      { name: 'Theme Factory', description: 'Apply professional themes to artifacts and documents' },
      { name: 'Video Downloader', description: 'Download videos from YouTube and other platforms' },
      { name: 'youtube-transcript', description: 'Fetch and process transcripts from YouTube videos' },
    ],
  },
  {
    label: 'Productivity & Organization',
    icon: FolderOpen,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    skills: [
      { name: 'File Organizer', description: 'Intelligently organize files and folders by type and project' },
      { name: 'Invoice Organizer', description: 'Automatically organize and categorize invoices and receipts' },
      { name: 'kaizen', description: 'Apply continuous improvement methodology to processes' },
      { name: 'n8n-skills', description: 'Understand and operate n8n automation workflows' },
      { name: 'Tailored Resume Generator', description: 'Generate tailored resumes for job applications' },
      { name: 'tapestry', description: 'Interlink and summarize related documents' },
    ],
  },
  {
    label: 'Collaboration & DevOps',
    icon: Users,
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    skills: [
      { name: 'git-pushing', description: 'Automate git operations and repository interactions' },
      { name: 'google-workspace-skills', description: 'Google Workspace integrations (Gmail, Sheets, Slides, Docs)' },
      { name: 'outline', description: 'Search, read, create, and manage documents in Outline wiki' },
      { name: 'review-implementing', description: 'Evaluate code implementation plans for quality' },
      { name: 'test-fixing', description: 'Detect failing tests and propose targeted fixes' },
    ],
  },
  {
    label: 'Security & Forensics',
    icon: Lock,
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    skills: [
      { name: 'computer-forensics', description: 'Digital forensics analysis and investigation' },
      { name: 'file-deletion', description: 'Secure file deletion and data sanitization' },
      { name: 'metadata-extraction', description: 'Extract and analyze file metadata for insights' },
      { name: 'threat-hunting-with-sigma-rules', description: 'Hunt for threats using Sigma detection rules' },
      { name: 'FFUF Web Fuzzing', description: 'Web fuzzer integration for vulnerability analysis' },
    ],
  },
  {
    label: 'SaaS Integrations (Composio)',
    icon: Plug,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    skills: [
      { name: 'CRM & Sales', description: 'Close, HubSpot, Pipedrive, Salesforce, Zoho CRM' },
      { name: 'Project Management', description: 'Asana, Basecamp, ClickUp, Jira, Linear, Monday, Notion, Todoist, Trello, Wrike' },
      { name: 'Communication', description: 'Discord, Intercom, Microsoft Teams, Slack, Telegram, WhatsApp' },
      { name: 'Email Providers', description: 'Gmail, Outlook, Postmark, SendGrid' },
      { name: 'Code & DevOps', description: 'Bitbucket, CircleCI, Datadog, GitHub, GitLab, PagerDuty, Render, Sentry, Supabase, Vercel' },
      { name: 'Storage & Files', description: 'Box, Dropbox, Google Drive, OneDrive' },
      { name: 'Spreadsheets & Databases', description: 'Airtable, Coda, Google Sheets' },
      { name: 'Calendar & Scheduling', description: 'Cal.com, Calendly, Google Calendar, Outlook Calendar' },
      { name: 'Social Media', description: 'Instagram, LinkedIn, Reddit, TikTok, Twitter, YouTube' },
      { name: 'Marketing & Email', description: 'ActiveCampaign, Brevo, ConvertKit, Klaviyo, Mailchimp' },
      { name: 'Support & Helpdesk', description: 'Freshdesk, Freshservice, Help Scout, Zendesk' },
      { name: 'E-commerce & Payments', description: 'Shopify, Square, Stripe' },
      { name: 'Design & Collaboration', description: 'Canva, Confluence, DocuSign, Figma, Miro, Webflow' },
      { name: 'Analytics & Data', description: 'Amplitude, Google Analytics, Mixpanel, PostHog, Segment' },
      { name: 'HR & Meetings', description: 'BambooHR, Zoom, Make' },
    ],
  },
];

const totalCommunitySkills = COMMUNITY_SKILLS.reduce((sum, cat) => sum + cat.skills.length, 0);

const totalTools = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);

export default function SuperAgentSettings() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Super Agent Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {MARKETING_SKILLS.length} marketing skills, {totalTools} API tools, and {totalCommunitySkills} community skills powering the Super Agent.
          </p>
        </div>

        <Tabs defaultValue="skills">
          <TabsList>
            <TabsTrigger value="skills">Marketing Skills ({MARKETING_SKILLS.length})</TabsTrigger>
            <TabsTrigger value="tools">API Tools ({totalTools})</TabsTrigger>
            <TabsTrigger value="community">Community Skills ({totalCommunitySkills})</TabsTrigger>
          </TabsList>

          {/* ── Skills Tab ── */}
          <TabsContent value="skills" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {MARKETING_SKILLS.map((skill) => {
                const Icon = skill.icon;
                return (
                  <Card key={skill.label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${skill.color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {skill.label}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{skill.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="space-y-1">
                        {skill.highlights.map((h, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary mt-0.5 shrink-0">-</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Tools Tab ── */}
          <TabsContent value="tools" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {TOOL_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <Card key={category.label}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${category.color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {category.label}
                        <Badge variant="outline" className="ml-auto text-xs">
                          {category.tools.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2.5">
                        {category.tools.map((tool) => (
                          <div key={tool.name} className="flex items-start gap-2">
                            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                              {tool.name}
                            </code>
                            <span className="text-xs text-muted-foreground leading-relaxed">
                              {tool.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Community Skills Tab ── */}
          <TabsContent value="community" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Open-source skills from the Claude community. Source: awesome-claude-skills on GitHub.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {COMMUNITY_SKILLS.map((category) => {
                const Icon = category.icon;
                return (
                  <Card key={category.label}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${category.color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {category.label}
                        <Badge variant="outline" className="ml-auto text-xs">
                          {category.skills.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2.5">
                        {category.skills.map((skill) => (
                          <div key={skill.name} className="flex items-start gap-2">
                            <span className="text-xs font-medium text-foreground shrink-0 mt-0.5">
                              {skill.name}
                            </span>
                            <span className="text-xs text-muted-foreground leading-relaxed">
                              {skill.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

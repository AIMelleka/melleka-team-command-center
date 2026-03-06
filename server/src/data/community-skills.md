# Community Skills — Extended Knowledge Base

These skills come from the open-source Claude community (awesome-claude-skills). Apply them proactively when team members ask for help in these areas.

---

## Competitive Ads Extraction

When asked to analyze competitor ads:

1. Scrape ads from Facebook Ad Library, Google Ads Transparency Center, or LinkedIn
2. Capture screenshots of every ad found
3. Analyze messaging patterns — problems highlighted, value props, CTAs
4. Categorize by theme, audience, and format
5. Identify what's working and why

Output format:
- Overview: Total ads, primary themes (%), ad formats (%), CTA patterns
- Key Problems They're Highlighting: Each problem with ad count, copy examples, analysis
- Successful Creative Patterns: Pattern name, description, usage count, why it works
- Copy That's Working: Best headlines, best body copy structures
- Audience Targeting Insights: Segments with unique messaging angles
- Recommendations: Actionable items based on competitor patterns

Workflows:
- Ad Campaign Planning: Extract → Identify patterns → Find gaps → Brainstorm angles → Draft variations
- Positioning Research: Get ads from 5+ competitors → Map positioning → Find underserved angles
- Trend Tracking: Compare Q1 vs Q2 ads to see messaging evolution

---

## Content Research & Writing Partnership

When helping write content:

1. Understand the Project: Topic, audience, length, goal (educate/persuade/entertain), writing style
2. Collaborative Outline: Hook → Intro → Main Sections → Conclusion → Research To-Do
3. Research: Find credible sources, extract key facts/quotes/data, add citations
4. Improve Hooks: Analyze current hook, provide 3 alternatives (bold statement, personal story, surprising data)
5. Section-by-Section Feedback: Review for clarity, flow, evidence, style
6. Preserve Writer's Voice: Suggest don't replace, match tone, enhance don't override
7. Citation Management: Inline, numbered, or footnote style based on preference
8. Final Review: Structure, content quality, readability, pre-publish checklist

Workflows:
- Blog Post: Outline → Research → Write intro + feedback → Body sections + feedback → Conclusion → Polish
- Newsletter: Hook ideas → Quick outline → Draft → Review → Polish
- Thought Leadership: Brainstorm angle → Research perspectives → Develop thesis → Strong POV → Evidence → Conclusion

---

## Lead Research & Qualification

When asked to find or qualify leads:

1. Understand the product/service (analyze codebase if available)
2. Define ICP: Target industries, company size, geography, pain points, tech requirements
3. Research leads: Match criteria, look for signals (job postings, tech stack, news, funding)
4. Score leads 1-10 based on: ICP alignment, immediate need signals, budget availability, timing

For each lead provide:
- Company name + website
- Why they're a good fit (specific reasons)
- Priority score (1-10) with explanation
- Decision maker role to target
- Personalized value proposition
- Conversation starters for outreach
- Contact strategy

---

## Domain Name Brainstorming

When asked to help find domain names:

Good domain qualities: Short (<15 chars), memorable, pronounceable, descriptive, brandable, no hyphens

TLD Guide:
- .com: Universal, trusted | .io: Tech startups | .dev: Developer tools | .ai: AI/ML products
- .app: Applications | .co: .com alternative | .design: Creative agencies | .tech: Technology

Steps:
1. Understand the project/brand
2. Generate 10-15 creative domain options
3. Check availability using whois/DNS lookup
4. Suggest alternatives for taken domains
5. Provide branding rationale for top picks

Pricing context: Standard ~$10-15/yr, Premium TLDs (.io, .ai) ~$30-50/yr

---

## Meeting Transcript Analysis

When given meeting transcripts to analyze:

Pattern categories to detect:
- Conflict Avoidance: Hedging language, indirect phrasing, changing subject under tension
- Speaking Ratios: % time speaking, interruptions, turn length, question vs statement ratio
- Filler Words: "um", "uh", "like", "you know" — frequency per minute
- Active Listening: References to others' points, paraphrasing, building on contributions
- Facilitation: Decision-making approach, inclusion of quiet participants, agenda control

For each pattern found, provide:
- One-sentence finding
- Frequency (X times across Y meetings)
- 2-3 specific timestamped examples with actual quotes
- Why it matters
- Better approach suggestion

Synthesize into: Key Patterns → Communication Strengths → Growth Opportunities → Speaking Statistics → Next Steps

---

## Twitter/X Algorithm Optimization

Core Ranking Models:
- Real-graph: Predicts follower interaction likelihood
- SimClusters: Community detection — resonance within niche groups
- TwHIN: Knowledge graph — content-user topic fit
- Tweepcred: User reputation/authority scoring

Engagement Signals (weighted):
- Explicit: Likes, replies, retweets, quote tweets
- Implicit: Profile visits, clicks, time spent, bookmarks
- Negative: Block/report (heavy penalty), mute/unfollow, quick scroll-past

Optimization steps for any tweet:
1. Identify core message — what's the single takeaway?
2. Map to algorithm — which follower segment? which community? does it fit your identity?
3. Optimize signals — trigger replies (questions), retweets (useful/entertaining), likes (novel/validating)
4. Check negatives — any block/report risk? off-brand? engagement bait?

Trigger formulas:
- For replies: Ask direct questions, create debate, request opinions
- For retweets: Useful info, representational value, entertainment
- For bookmarks: Tutorials, data/stats, reference material
- For likes: Novel insights, validation, strong opinions with evidence

Best practices: Quality > virality, community first, authenticity, timing (first hour critical), build threads, reply quickly

---

## Document Processing

### Word Documents (DOCX)
- Read: Use pandoc for markdown conversion, or unpack OOXML for raw XML
- Create: Use docx library (npm: docx) for creating new documents programmatically
- Edit: Unpack .docx (it's a ZIP), edit XML files, repack
- Tracked changes: Use OOXML redlining workflow for collaborative edits

### PDF Files
- Extract text: pypdf or pdfplumber for text/tables, pdftotext CLI for bulk
- Extract tables: pdfplumber.extract_tables() returns list of lists
- Create: reportlab (Python) or pdf-lib (JavaScript)
- Merge/split: pypdf PdfMerger, qpdf CLI
- OCR scanned PDFs: pytesseract + pdf2image
- Watermark/annotate: pypdf overlay pages

### Spreadsheets (XLSX)
- Read/write: openpyxl (Python) or xlsx (npm)
- Financial model rules: Blue=inputs, Black=formulas, Green=links, Red=hardcoded overrides
- Number formatting: Currency with $, Percentages with %, Multiples with x
- Formula rules: Always cell references, never hardcoded values
- Recalculate: LibreOffice headless mode for formula recalculation

### Presentations (PPTX)
- Read: markitdown for markdown extraction, or raw XML
- Create from scratch: HTML-to-PPTX workflow using pptxgenjs + playwright
- Create from template: Slide inventory → Rearrange → Replace text/images
- Color palettes: 18 pre-built palettes available
- Charts: PptxGenJS — BAR, LINE, PIE, SCATTER (no # prefix on hex colors!)
- Visual validation: Generate thumbnail grid for QA

---

## Creative & Media Skills

### Image Enhancement
- Upscale images using sharp (npm) or ImageMagick
- Use lanczos3 for best quality upscaling
- Sharpen after upscaling: sharp({ sigma: 0.5 })
- Format conversion: PNG for quality, WebP for web, JPEG for photos

### Animated GIF Creation (for Slack)
- Use ffmpeg for video-to-GIF conversion
- Optimize: 256 colors max, 15fps, 480px width for Slack
- Keep under 1MB for inline display in Slack

### Video Downloading
- Use yt-dlp for YouTube and 1000+ sites
- Extract audio: yt-dlp -x --audio-format mp3
- Best quality: yt-dlp -f "bestvideo+bestaudio"

### YouTube Transcripts
- Use yt-dlp --write-auto-subs --sub-format vtt
- Or use youtube-transcript-api (Python) for clean text
- Auto-generated captions available for most videos

---

## Productivity Skills

### File Organization
When asked to organize files:
1. Scan directory for all files
2. Analyze: file types, dates, naming patterns, content
3. Create logical folder structure by category
4. Move/rename files following consistent naming: YYYY-MM-DD_description.ext
5. Generate summary report of changes made

### Invoice Organization
1. Scan for invoices (PDF, images, emails)
2. Extract: vendor name, date, amount, invoice number
3. Create folder structure: Year/Month/Vendor/
4. Rename: YYYY-MM-DD_VendorName_$Amount.pdf
5. Generate CSV summary for bookkeeping
6. Flag duplicates and items needing manual review

### Resume Tailoring
When asked to create/tailor a resume:
1. Analyze job description: Extract must-haves, key skills, soft skills, keywords
2. Map candidate experience to requirements
3. Structure: Summary (3-4 lines) → Skills → Experience → Education
4. Quantify achievements with numbers/percentages
5. Optimize for ATS: Standard headings, exact keywords, no complex formatting
6. Provide gap analysis and interview prep tips

---

## Composio SaaS Integration (1000+ Apps)

When asked to take actions in external apps (send emails, create issues, post messages, update CRMs, etc.):

The Composio integration connects to 1000+ SaaS apps including:
- Email: Gmail, Outlook, SendGrid
- Chat: Slack, Discord, Teams, Telegram
- Dev: GitHub, GitLab, Jira, Linear
- Docs: Notion, Google Docs, Confluence
- Data: Sheets, Airtable, PostgreSQL
- CRM: HubSpot, Salesforce, Pipedrive
- Storage: Drive, Dropbox, S3
- Social: Twitter, LinkedIn, Reddit
- Marketing: ActiveCampaign, Mailchimp, Klaviyo, ConvertKit
- Support: Zendesk, Freshdesk, Help Scout
- E-commerce: Shopify, Stripe, Square
- Design: Canva, Figma, Miro, Webflow
- Analytics: Amplitude, Mixpanel, PostHog, Segment

Use the composio_action tool to:
1. Search for available actions for a specific app
2. Check if the app connection is authenticated
3. Execute the action with the required parameters

If an app isn't connected yet, the tool will return an OAuth URL for the user to authorize.

---

## Web Application Testing (Playwright)

When testing web applications:

Decision tree:
- Static HTML? → Read HTML directly, write Playwright script with selectors
- Dynamic webapp? → Start server → Navigate → Wait for networkidle → Screenshot/inspect → Execute actions

Pattern: Reconnaissance-then-action
1. Navigate and wait for networkidle (CRITICAL — do this before any DOM inspection)
2. Take screenshot or inspect DOM
3. Identify selectors from rendered state
4. Execute actions with discovered selectors

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    # ... automation logic
    browser.close()
```

Best practices: Always headless=True, always wait for networkidle, use descriptive selectors (text=, role=, CSS, IDs), close browser when done.

---

## Zapier Automations (8000+ App Connections)

When asked to automate workflows, connect apps, or take actions in external services:

The `automations` tool connects to Zapier's MCP server, giving access to 8,000+ apps and 30,000+ actions. You can do ANYTHING that Zapier supports. If an action isn't connected yet, guide the user through setup.

Available app categories (all accessible through automations tool):

Email & Communication:
- Gmail: Send/read emails, create drafts, add labels
- Outlook: Send emails, manage calendar, create events
- SendGrid: Send transactional emails, manage contacts
- Mailchimp: Add subscribers, send campaigns, manage lists
- Twilio: Send SMS, make calls, send WhatsApp messages

Chat & Messaging:
- Slack: Send messages, create channels, manage users, upload files
- Discord: Send messages, manage servers, create channels
- Microsoft Teams: Post messages, create meetings, manage channels
- Telegram: Send messages, manage groups

CRM & Sales:
- HubSpot: Create/update contacts, deals, companies, tickets, send emails
- Salesforce: Manage leads, contacts, opportunities, accounts, cases
- Pipedrive: Create deals, contacts, activities, organizations
- Zoho CRM: Manage leads, contacts, deals, tasks
- Close: Create leads, log calls, send emails

Project Management:
- Asana: Create tasks, projects, sections, assign work
- Trello: Create cards, move lists, add comments, manage boards
- Monday.com: Create items, update columns, manage boards
- ClickUp: Create tasks, spaces, folders, time tracking
- Linear: Create issues, projects, cycles
- Jira: Create issues, update status, manage sprints
- Notion: Create pages, databases, update properties
- Basecamp: Create to-dos, messages, schedule events

Spreadsheets & Data:
- Google Sheets: Read/write cells, create spreadsheets, add rows
- Airtable: Create/update records, manage bases
- Excel Online: Read/write cells, manage workbooks
- Smartsheet: Create/update rows, manage sheets

Calendar & Scheduling:
- Google Calendar: Create/update events, manage attendees
- Outlook Calendar: Create events, manage schedules
- Calendly: Get events, manage bookings

Documents & Storage:
- Google Docs: Create documents, update content
- Google Drive: Upload files, create folders, share files
- Dropbox: Upload/download files, manage folders
- OneDrive: Manage files, create folders
- Box: Upload files, manage folders, share content

Social Media:
- Twitter/X: Post tweets, send DMs, manage lists
- LinkedIn: Share posts, send messages, manage company pages
- Facebook: Post to pages, manage ads, send messages
- Instagram: Post content, manage comments
- Buffer: Schedule posts, manage social accounts
- Hootsuite: Schedule content, manage social presence

E-commerce & Payments:
- Shopify: Create orders, manage products, update inventory
- Stripe: Create charges, manage subscriptions, send invoices
- Square: Process payments, manage catalog
- WooCommerce: Create orders, manage products
- PayPal: Send payments, create invoices
- QuickBooks: Create invoices, manage expenses, track payments

Marketing & Analytics:
- ActiveCampaign: Manage contacts, automations, campaigns
- Klaviyo: Add profiles, trigger flows, manage lists
- ConvertKit: Add subscribers, manage sequences
- Google Analytics: Track events, get reports
- Facebook Ads: Create campaigns, manage audiences
- Google Ads: Manage campaigns, keywords, ads
- Segment: Track events, identify users

Developer & DevOps:
- GitHub: Create issues, PRs, manage repos, trigger workflows
- GitLab: Create issues, merge requests, manage repos
- Bitbucket: Manage repos, create PRs
- AWS: Manage S3, Lambda, SES, SNS
- Vercel: Trigger deployments, manage projects
- Netlify: Trigger builds, manage sites
- PagerDuty: Create incidents, manage escalations

Support & Help Desk:
- Zendesk: Create/update tickets, manage users
- Freshdesk: Create tickets, manage contacts
- Intercom: Create conversations, manage users, send messages
- Help Scout: Create conversations, manage customers
- Crisp: Send messages, manage conversations

Forms & Surveys:
- Typeform: Get responses, create forms
- Google Forms: Get responses, manage forms
- JotForm: Get submissions, manage forms
- SurveyMonkey: Get responses, manage surveys

HR & Recruiting:
- BambooHR: Manage employees, time off, onboarding
- Greenhouse: Manage candidates, jobs, scorecards
- Lever: Manage candidates, opportunities

Automation & Integration:
- Webhooks: Trigger any URL, receive data
- Code by Zapier: Run JavaScript/Python
- Formatter by Zapier: Transform text, dates, numbers
- Filter by Zapier: Conditional logic
- Delay by Zapier: Wait before next step
- Paths by Zapier: Branching logic

Workflow:
1. ALWAYS call `automations` with action='list' first to discover what's currently connected
2. If the action the user needs IS available: execute it with the right params
3. If the action is NOT available: tell the user exactly what to do (see setup guide below)
4. After the user confirms setup, call action='list' again to verify, then execute

When an action is NOT yet connected (CRITICAL - follow this exactly):
1. Tell the user: "The [App Name] - [Action] automation isn't connected yet. Here's how to set it up:"
2. Provide these steps:
   a. Go to mcp.zapier.com
   b. Click "Add Action" or "+"
   c. Search for "[App Name]"
   d. Select the specific action (e.g., "Send Email" for Gmail)
   e. Connect/authorize your [App Name] account when prompted
   f. Click "Enable" to make it available
3. Say: "Let me know once you've connected it and I'll use it right away."
4. When the user confirms, call action='list' again to pick up the new action, then execute it

Best practices:
- Always list before executing (available actions depend on what's been connected)
- When a user asks to do something in an external app, ALWAYS try the automations tool first
- Pass all required parameters as shown in the schema from the list output
- For multi-step workflows, execute actions sequentially and verify each step
- Combine with cron jobs (create_cron_job) for recurring automated workflows
- Use action='search' with a keyword to quickly find relevant actions in large lists
- If the MCP URL is not configured at all, tell the admin to add ZAPIER_MCP_URL to team_secrets

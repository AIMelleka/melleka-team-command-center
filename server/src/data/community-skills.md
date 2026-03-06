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

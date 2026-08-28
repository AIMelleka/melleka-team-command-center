// ── Sales Guide Data ──
// All content for the native Sales Guide page (mellekaguide.com rebuilt inside team.melleka.com)

export const OPENING_SCRIPT = `Hi [Name], this is [Your Name] from Melleka Marketing. How are you doing today?

[Wait for response]

Great! The reason I'm calling is — I saw [something specific: your website / your Google listing / your ad] and I noticed there might be some opportunity to help you get more leads and grow your business. I work with a lot of [industry] businesses in the [location] area, and I'd love to learn a little more about what you're working with.

Do you have just a few minutes to chat?

[If yes] Perfect. So first I want to understand your business a bit. Can you tell me — are you currently running any paid advertising, like Google Ads or Facebook Ads?

[If no/not interested] No problem at all. Would it be okay if I sent you a quick overview of what we do, in case it's helpful down the road?`;

export const DISCOVERY_QUESTIONS = [
  "Are you currently running any Google Ads or paid advertising?",
  "What's your monthly ad budget, or what have you been spending?",
  "Are you generating leads online, or mostly word-of-mouth and referrals right now?",
  "What does a new customer typically mean to you in revenue — like a rough average job size?",
  "Are you looking to grow the business, or is it more about maintaining what you have?",
  "What's your biggest marketing challenge right now?",
  "Have you worked with a marketing agency before? How did that go?",
  "What's your main service or what do you consider your best-performing service?",
  "Do you have a target area or do you serve all of [city/region]?",
  "Do you have a website? Is it getting traffic or does it mostly just sit there?",
  "What does your close rate look like — if you talk to 10 people, how many turn into customers?",
  "Is seasonality a factor for you, or is demand pretty steady year-round?",
];

export const TRANSITION_SCRIPT = `That's really helpful — thank you. Based on what you're telling me, I think we can definitely help.

Here's what we do at Melleka: we specialize in performance marketing for [industry] businesses. That means we run highly-targeted Google Ads campaigns that put you in front of people who are actively searching for exactly what you offer, right when they're ready to buy.

We're not a full-service agency that does a little bit of everything. We go deep on paid search and paid social — and we're obsessed with one number: your cost per lead. Everything we do is aimed at getting you more leads at a lower cost.

Can I tell you a little bit more about how we work?`;

export const PITCH_LINES = [
  {
    headline: "We specialize in your industry.",
    detail: "We're not generalists. We've run campaigns for dozens of [industry] businesses and we know what works and what wastes money.",
  },
  {
    headline: "You own everything.",
    detail: "Your ad account, your data, your leads. If you ever leave, you take it all with you. We have nothing to hide.",
  },
  {
    headline: "Transparent reporting, every week.",
    detail: "You'll get a weekly report that shows exactly where your money went, how many clicks, how many leads, and what we're doing next.",
  },
  {
    headline: "No long-term contracts.",
    detail: "We earn your business every month. You're not locked in. If we're not delivering, you can cancel anytime.",
  },
];

export const OBJECTIONS: { label: string; response: string }[] = [
  {
    label: "I'm not interested.",
    response: "I completely understand — you probably get a lot of these calls. Can I ask, is it that you're not interested in marketing help in general, or just that right now isn't a great time? Either is totally fine.",
  },
  {
    label: "I already have a marketing company.",
    response: "Good — that means you understand the value of it. Are you happy with the results you're getting? A lot of clients come to us after being frustrated with their current agency. No pressure, but I'd love to hear what's working and what isn't.",
  },
  {
    label: "I tried Google Ads before and it didn't work.",
    response: "That's really common, and honestly it's usually not the platform — it's the setup. Most businesses that tried Ads and failed were either targeting too broadly, using the wrong keywords, or sending traffic to a weak landing page. We'd do a free audit of what was running before and show you exactly what went wrong.",
  },
  {
    label: "It's too expensive.",
    response: "I get that. Can I ask what your thinking is on budget? A lot of people assume they need a huge ad spend to get results, but we work with businesses spending as little as $1,000 a month on ads. The question isn't really the cost — it's whether the return makes sense. If we're generating $5 in revenue for every $1 you spend, does that feel expensive?",
  },
  {
    label: "I get all my business from referrals.",
    response: "That's great — referrals are the best kind of lead. But what happens when the referrals slow down? We've worked with a lot of businesses that relied on referrals and then had a slow quarter. Paid ads give you a predictable, controllable way to fill in the gaps and grow on your terms.",
  },
  {
    label: "I don't have time for this right now.",
    response: "That's completely fair. The reason most owners work with us is exactly because they don't have time — we handle everything end to end. You spend about 15 minutes a month reviewing results with us. That's it. Can I send you a quick overview to look at when you do have a few minutes?",
  },
  {
    label: "Send me something in an email.",
    response: "Absolutely, I'm happy to do that. I just want to make sure what I send is actually relevant to you. Can I ask real quick — what's your monthly ad budget currently, or what kind of budget have you been thinking about?",
  },
  {
    label: "How much does it cost?",
    response: "Great question. Our management fee depends on what you need — it starts at $999/month for Google Ads only, and goes up based on the number of platforms and complexity. But before I talk numbers, I want to make sure I understand your situation well enough to quote you the right thing. Can I ask a couple of questions?",
  },
  {
    label: "I can do it myself.",
    response: "You absolutely can. Google Ads isn't rocket science. The question is — how much is your time worth? And are you getting the results you want right now? Most business owners find that managing ads themselves costs them more in wasted spend than just hiring a specialist would.",
  },
  {
    label: "I need to talk to my partner/spouse.",
    response: "Of course — that makes total sense for a business decision. When do you two typically connect? I'd love to schedule a quick call where all three of us can talk through it, so your partner can ask any questions directly.",
  },
  {
    label: "What's your contract length?",
    response: "We don't lock you in. It's month-to-month after a short initial onboarding period. You can cancel anytime. We believe in earning your business every single month.",
  },
  {
    label: "How do I know you'll get results?",
    response: "Honestly, I can't promise specific numbers before we've seen your account and your market. What I can promise is transparency — you'll see every dollar spent and every lead generated. And I can show you case studies from similar businesses we've worked with. Would that help?",
  },
  {
    label: "I've been burned by agencies before.",
    response: "I hear that a lot, and I'm sorry that happened. Most agencies over-promise and under-deliver. What specifically went wrong? I want to understand what you're trying to avoid, so I can tell you honestly whether we'd be a better fit or not.",
  },
  {
    label: "I don't want to be locked into a long contract.",
    response: "You won't be. We're month-to-month. The only thing we ask for is a 30-day notice to cancel so we can wrap things up cleanly. That's it.",
  },
  {
    label: "I'm not sure I need more leads.",
    response: "That's actually a good problem to have. Are you at capacity right now? Because if you are, we might talk about how to raise your prices or improve your close rate instead of just generating volume. Marketing isn't just about more leads — it's about better leads.",
  },
  {
    label: "Do you guarantee results?",
    response: "We don't guarantee specific lead numbers — no ethical agency does, because the market, your offer, and your close rate all play a role. What we guarantee is that we'll manage your account like it's our own money, report transparently, and optimize continuously. If we're not improving your results month over month, we'll be the first to tell you.",
  },
  {
    label: "Can I see a proposal first?",
    response: "Absolutely. I'll put one together based on what you've told me. It'll include a recommended strategy, what we'd do in the first 30 days, and our recommended budget. Can I send it over to [email] by [timeframe]?",
  },
  {
    label: "I already rank on Google organically.",
    response: "That's great — SEO traffic is powerful. But organic rankings take time to build and can be unpredictable. Paid ads let you appear at the very top of Google instantly, for high-intent searches, and you control exactly when your ads show. A lot of businesses use both — they're complementary.",
  },
  {
    label: "I'm not sure my industry works with Google Ads.",
    response: "What's your business? [Listen.] We've run successful campaigns for a huge range of industries. As long as people are searching for what you offer — and they almost always are — Google Ads can work. The key is knowing which keywords to target and which to exclude.",
  },
  {
    label: "What makes you different from other agencies?",
    response: "A few things. We specialize in paid search and paid social — we don't try to do everything. We're transparent: you own your account and see all the data. We're month-to-month. And we have deep experience in [industry]. But honestly, the best way to see the difference is to work with us. A lot of our clients came from other agencies and say the communication and reporting alone was a night-and-day difference.",
  },
  {
    label: "I don't have a big budget.",
    response: "That's okay — we work with businesses at all stages. Can I ask what you're thinking? Even $500-$1,000 a month in ad spend, paired with smart targeting, can generate solid results for local businesses. Our fee starts at $999/month for Google Ads management. What's your ballpark?",
  },
  {
    label: "I heard Google Ads is too competitive in my industry.",
    response: "It can be competitive, yes. But competitive also means there's a lot of demand. The key is finding the angles that aren't as competitive — longer-tail keywords, specific services, geographic targeting — and focusing your budget there. We've done this successfully in very competitive industries.",
  },
  {
    label: "How long until I see results?",
    response: "Most clients start seeing leads within the first 2-4 weeks. The first month is learning — we're gathering data, optimizing, finding what works. Month 2 is usually where things start clicking. Month 3 and beyond is where we really optimize and scale what's working.",
  },
  {
    label: "I have a small team — can I handle the leads?",
    response: "That's actually a great problem to solve for. We'd rather send you 20 qualified leads than 200 unqualified ones. We can dial in targeting so precisely that the leads coming in are exactly the type of job you want — right size, right area, right service. What does your ideal customer look like?",
  },
  {
    label: "What if I want to pause?",
    response: "You can pause anytime. Just let us know — we'll pause the campaigns and hold your account. Your data and history stay intact. Most clients who pause come back because they realize how much quieter things get without ads running.",
  },
];

export interface PricingPlan {
  name: string;
  price: string;
  priceNote?: string;
  adBudget: string;
  highlight?: boolean;
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Google Ads Only",
    price: "$999/mo",
    adBudget: "Up to $3,000 ad spend",
    features: [
      "Google Search Ads management",
      "Keyword research + negative keywords",
      "Weekly performance reports",
      "Conversion tracking setup",
      "Monthly strategy call",
    ],
  },
  {
    name: "Google Ads + Meta",
    price: "$1,499/mo",
    adBudget: "Up to $5,000 ad spend",
    highlight: true,
    features: [
      "Everything in Google Ads Only",
      "Facebook + Instagram Ads",
      "Audience building + retargeting",
      "Cross-platform reporting",
      "Bi-weekly strategy calls",
    ],
  },
  {
    name: "Growth Bundle",
    price: "$1,999/mo",
    adBudget: "Up to $8,000 ad spend",
    features: [
      "Google + Meta + GMB optimization",
      "Landing page recommendations",
      "A/B testing",
      "Lead tracking dashboard",
      "Dedicated account manager",
    ],
  },
  {
    name: "Scale",
    price: "$2,499/mo",
    adBudget: "Up to $15,000 ad spend",
    features: [
      "Everything in Growth Bundle",
      "YouTube Ads",
      "Display / Remarketing",
      "Weekly calls",
      "Priority support",
    ],
  },
  {
    name: "Agency White-Label",
    price: "$1,799/mo",
    adBudget: "Varies",
    features: [
      "White-label Google + Meta management",
      "Unbranded reports",
      "Slack access to our team",
      "Volume pricing available",
      "Dedicated account manager",
    ],
  },
  {
    name: "Local Domination",
    price: "$3,499/mo",
    adBudget: "Up to $25,000 ad spend",
    features: [
      "Full-funnel paid strategy",
      "Google + Meta + YouTube + Display",
      "SEO support",
      "CRO consultation",
      "Weekly calls + Slack access",
    ],
  },
  {
    name: "SEO Add-On",
    price: "$799/mo",
    adBudget: "Add-on to any plan",
    features: [
      "On-page SEO optimization",
      "Monthly blog content (2 posts)",
      "GMB management",
      "Citation building",
      "Monthly ranking report",
    ],
  },
  {
    name: "Enterprise",
    price: "15% of ad spend",
    priceNote: "min $3,000/mo",
    adBudget: "$20,000+ ad spend",
    features: [
      "Full dedicated team",
      "Custom reporting dashboard",
      "Multi-location campaigns",
      "Quarterly business reviews",
      "All channels + custom strategy",
    ],
  },
];

export interface PlanFeatureRow {
  feature: string;
  tiers: Record<string, boolean | string>;
}

export const PLAN_FEATURE_ROWS: PlanFeatureRow[] = [
  {
    feature: "Google Search Ads",
    tiers: { "Google Only": true, "Google + Meta": true, "Growth Bundle": true, "Scale": true, "Enterprise": true },
  },
  {
    feature: "Facebook / Instagram Ads",
    tiers: { "Google Only": false, "Google + Meta": true, "Growth Bundle": true, "Scale": true, "Enterprise": true },
  },
  {
    feature: "YouTube Ads",
    tiers: { "Google Only": false, "Google + Meta": false, "Growth Bundle": false, "Scale": true, "Enterprise": true },
  },
  {
    feature: "Weekly Reporting",
    tiers: { "Google Only": true, "Google + Meta": true, "Growth Bundle": true, "Scale": true, "Enterprise": true },
  },
  {
    feature: "Dedicated Account Manager",
    tiers: { "Google Only": false, "Google + Meta": false, "Growth Bundle": true, "Scale": true, "Enterprise": true },
  },
  {
    feature: "Landing Page Recommendations",
    tiers: { "Google Only": false, "Google + Meta": false, "Growth Bundle": true, "Scale": true, "Enterprise": true },
  },
  {
    feature: "Slack Access",
    tiers: { "Google Only": false, "Google + Meta": false, "Growth Bundle": false, "Scale": true, "Enterprise": true },
  },
  {
    feature: "Custom Dashboard",
    tiers: { "Google Only": false, "Google + Meta": false, "Growth Bundle": false, "Scale": false, "Enterprise": true },
  },
];

export const CLOSING_SCRIPT = `Awesome. Based on everything you've shared, here's what I'd recommend as a next step:

I'll put together a quick proposal — it'll show you exactly what we'd do in the first 30 days, what the budget breakdown looks like, and what results you might expect based on similar businesses in your area.

I can usually have that to you within 24 hours. What's the best email for that?

[Get email]

And just so I can make it as relevant as possible — what's your main goal right now: more leads in general, or a specific service or job type you want to grow?

[Listen and note]

Perfect. I'll get that over to you. And let's set a quick 20-minute call to walk through it together — I find that's way more useful than just reading a PDF. Does [day/time] work for you?`;

export const PRICE_SCRIPT = `When it comes to pricing, I want to be straightforward with you.

Our management fee starts at $999/month. That's separate from your ad spend — the ad spend goes directly to Google or Meta, not to us.

So if you're spending $2,000 a month on Google Ads and paying us $999 to manage it, your total monthly investment is $2,999.

Now, here's how to think about ROI: if one new customer is worth $3,000 to you, and we get you even one customer per month, that's already positive. Most of our clients see 5-15 leads per month within the first 90 days.

Does that math make sense for your business?`;

export interface RetentionRisk {
  risk: string;
  warning_sign: string;
  prevention: string;
}

export const WHY_CLIENTS_LEAVE: RetentionRisk[] = [
  {
    risk: "Not seeing results fast enough",
    warning_sign: "Client asks 'how are things going?' more than once without us bringing it up",
    prevention: "Set realistic expectations upfront. Show momentum, not just conversions. Celebrate early wins (impressions, CTR improvements, first leads). Send a proactive update in week 2, don't wait.",
  },
  {
    risk: "Poor communication",
    warning_sign: "They feel surprised by something that happened — spend changes, a poor week, anything",
    prevention: "Never let a client be surprised. If something isn't working, tell them before they ask. Be the one who brings bad news first — it builds trust. Weekly reports, proactive Slack/email check-ins.",
  },
  {
    risk: "Sticker shock on the bill",
    warning_sign: "They ask to 'pause' or say 'business is slow' right before the billing date",
    prevention: "Be transparent about every dollar. Make sure they always know what they're spending on ads vs. management. Flag if ad spend is running higher than expected. Build perceived value constantly.",
  },
  {
    risk: "Competition offering a lower price",
    warning_sign: "They mention 'another agency reached out' or 'I got a cheaper quote'",
    prevention: "Compete on value, not price. Make sure they deeply understand what they're getting and would lose. Remind them of the results, the relationship, the data you've built. Document wins and reference them often.",
  },
];

export const PREVENTION_PLAYBOOK = `Proactive Retention Strategies:

1. Week 1 — Send a 'campaign is live' update with screenshots
2. Week 2 — First optimization note: 'here's what we found and adjusted'
3. Month 1 end — Full review call. Celebrate any wins. Set Month 2 goals.
4. Ongoing — Send weekly reports every Monday without being asked
5. Quarterly — Send a 'what we've accomplished' recap email showing cumulative results
6. Any bad week — Reach out FIRST before they see the report. Explain what happened and what we're doing.
7. Renewal time — Frame it as a business review, not a contract renewal. Focus on growth.`;

// Melleka Marketing Master Operating Manual & SOP — structured data for rendering

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'policy'; text: string }                           // "Current Company Policy" badge
  | { type: 'future'; text: string }                          // "Recommended Future-State" badge
  | { type: 'warning'; text: string }                         // red callout
  | { type: 'note'; text: string }                            // gray info callout
  | { type: 'checklist'; items: string[] }                    // interactive checkboxes
  | { type: 'numbered'; items: string[] }                     // numbered list
  | { type: 'bullets'; items: string[] }                      // bullet list
  | { type: 'table'; headers: string[]; rows: string[][] }   // data table
  | { type: 'h3'; text: string }                              // subsection heading

export interface SopSubsection {
  id: string;
  title: string;
  blocks: Block[];
}

export interface SopTab {
  id: string;
  label: string;
  icon: string;
  subsections: SopSubsection[];
}

export const SOP_TABS: SopTab[] = [
  // ──────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: '🏢',
    subsections: [
      {
        id: 'mission',
        title: 'Mission & Purpose',
        blocks: [
          {
            type: 'policy',
            text: 'Melleka Marketing exists to help businesses succeed through honest, intelligent, motivated digital marketing. The company rejects the dishonesty and empty promises common in the industry and aims to reduce the number of businesses that fail by applying real expertise, effort, communication, and integrity.',
          },
          { type: 'h3', text: 'Cultural Pillars' },
          {
            type: 'table',
            headers: ['Pillar', 'Expected Behavior', 'Unacceptable Signal'],
            rows: [
              ['Integrity', 'Tell the truth; own errors immediately; protect clients; make only supportable claims.', 'Lying, concealing mistakes, manipulating data, or taking company/client property.'],
              ['Chillness', 'Be calm, respectful, real, collaborative, and enjoyable to work with.', 'Rudeness, hostility, drama, fakery, or standoffish behavior.'],
              ['Hard Work', 'Move with urgency, take ownership, help outside narrow role boundaries, and finish.', '"That is not my job," chronic idleness, or avoidable missed commitments.'],
              ['Knowledge', 'Know the craft, keep learning, test work, and use sound judgment.', 'Pretending to know, failing to verify, or repeating preventable errors.'],
            ],
          },
          { type: 'h3', text: 'Non-Negotiable Operating Principles' },
          {
            type: 'bullets',
            items: [
              'Clients receive honest work, fast communication, proactive thought, and accountable delivery.',
              'Work is owned by a named person but the company succeeds as one team.',
              'A mistake must be disclosed, contained, corrected, and learned from; repeated preventable mistakes become a performance issue.',
              'No employee may refuse an authorized assignment merely because it falls outside a narrow job description.',
              'AI and automation create leverage; humans remain accountable for judgment, verification, security, and the final result.',
            ],
          },
        ],
      },
      {
        id: 'governance',
        title: 'Leadership & Chain of Command',
        blocks: [
          { type: 'policy', text: 'Employees route day-to-day questions to Lexie or Bryan by subject; David handles systems/AI/CRM. Lexie, Bryan, or David decides when Anthony must be contacted.' },
          {
            type: 'table',
            headers: ['Role', 'Primary Accountability', 'Decision Boundary'],
            rows: [
              ['Anthony Melleka — CEO/Owner', 'Enterprise strategy; leadership development; major client relationships; financial management; final hiring/firing.', 'Final authority for material company strategy, hiring/firing, exceptional refunds, company goal changes, and spend over $500.'],
              ['Lexie — COO', 'Operate the company day to day; manage employees and third parties; prioritize work; client updates; onboarding; client health.', 'May make operational decisions and inform Anthony afterward. Primary employee escalation path.'],
              ['Bryan — CMO', 'Marketing strategy, paid media and performance; reporting accuracy; data leadership; account oversight.', 'Final marketing-strategy trigger; leads paid-media decisions and budget-risk response.'],
              ['David — CSO', 'Internal strategy, systems, CRM, AI, automation, meetings, and technical continuity.', 'Owns system architecture and operational automation within leadership authority.'],
              ['Emely', 'Melleka app/GoHighLevel operations; email, SMS, workflows, blogs; Slack monitoring; onboarding/task support.', 'May communicate/launch in approved department; escalates unhappy clients to leadership.'],
              ['Gavin', 'Developing contributor, primarily AI/CRM/automation as assigned.', 'Work remains under training and QA until Lexie releases independence.'],
              ['John', 'Sales lead owner from receipt through collected payment; manages Zarina.', 'Cannot independently discount, change price, or promise added scope.'],
              ['Zarina', 'Cold calling/prospecting; identifies legitimate opportunities and hands them to John.', 'Does not own pricing or closing authority.'],
            ],
          },
          { type: 'h3', text: 'RACI Authority Matrix' },
          {
            type: 'table',
            headers: ['Decision / Work', 'Accountable (A)', 'Responsible (R)', 'Consulted / Informed'],
            rows: [
              ['Daily operations', 'Lexie', 'Lexie / assigned team', 'Anthony informed as needed'],
              ['Company marketing strategy', 'Bryan', 'Bryan / delivery team', 'Anthony, Lexie, David'],
              ['Systems, AI, CRM', 'David', 'David / assigned team', 'Lexie, Bryan'],
              ['Major company strategy/goal change', 'Anthony', 'Leadership', 'Lexie, Bryan, David'],
              ['Hire or terminate', 'Anthony', 'Lexie (process owner)', 'Bryan, David as needed'],
              ['Spend $0–$99', 'Lexie/Bryan/David', 'Approving leader', 'Anthony audits'],
              ['Spend $100–$500', 'Lexie/Bryan/David', 'Approving leader', 'Anthony informed'],
              ['Spend >$500', 'Anthony', 'Designated purchaser', 'Relevant leader'],
              ['Client paid-media budget change', 'Authorized client + Bryan oversight', 'Authorized operator', 'Lexie; Anthony if material'],
              ['Unhappy / escalated client', 'Anthony or Lexie', 'Assigned leader', 'Bryan as performance owner'],
              ['Weekly client updates', 'Lexie', 'Each client contributor', 'Leadership'],
              ['Reporting accuracy', 'Bryan', 'Assigned analyst', 'Lexie, David'],
            ],
          },
          { type: 'h3', text: 'When to Contact Anthony Directly' },
          {
            type: 'bullets',
            items: [
              'Major strategic changes or company goal changes',
              'Major client relationships',
              'Exceptional refund decisions',
              'Hiring or firing decisions',
              'Material financial issues or spend over $500',
              'Suspected account compromise — at any hour',
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'daily-ops',
    label: 'Daily Ops',
    icon: '📅',
    subsections: [
      {
        id: 'workday',
        title: 'Workday & Office Standards',
        blocks: [
          {
            type: 'table',
            headers: ['Standard', 'Requirement'],
            rows: [
              ['Schedule', 'Monday–Friday, 9:00 a.m.–5:00 p.m. Pacific Time, in the Los Angeles office. No standing remote/hybrid unless leadership specifically approves.'],
              ['Attendance', 'Notify Lexie of lateness or absence as early as possible; the day before when foreseeable.'],
              ['Meal/rest periods', 'Employees manage their time and take required breaks; lunch should occur before the fifth work hour.'],
              ['Phone use', 'Reasonable personal use is permitted; sustained personal use that interferes with work is not.'],
              ['Headphones/music', 'Reasonable, but collaboration, awareness, and work come first.'],
              ['Office culture', 'Talking, joking, and community are encouraged when performance and client service remain strong.'],
              ['No-work queue', 'If the Notion queue is empty, immediately ask Lexie, Bryan, David, Emely, or Anthony for work.'],
              ['Client calls', 'Use the office phone as the standard business calling method. Document material outcomes in the client system.'],
            ],
          },
          { type: 'h3', text: 'Wi-Fi Continuity' },
          { type: 'policy', text: 'If office Wi-Fi becomes unavailable, employees use an approved secure phone/mobile hotspot and continue priority work. Never switch to unsecured public Wi-Fi. Notify David or Lexie if the outage affects systems, capacity, or the client-response SLA.' },
        ],
      },
      {
        id: 'task-system',
        title: 'Task Operating System (Whiteboard + Notion)',
        blocks: [
          { type: 'policy', text: 'A client becomes operationally active when placed on the whiteboard. Notion is the complete system of record; whiteboard/post-it notes surface the most important current work. A whiteboard note never replaces a Notion task.' },
          { type: 'h3', text: 'Required Task Fields' },
          {
            type: 'table',
            headers: ['Field', 'Standard'],
            rows: [
              ['Client / project', 'Correct client name and identifiable workstream.'],
              ['Outcome / description', 'Specific result required, not a vague activity.'],
              ['Owner', 'One accountable person.'],
              ['Manager / approver', 'Person responsible for direction and acceptance.'],
              ['Priority', 'Urgency and business/client impact.'],
              ['Due date', 'Required for client deadlines and time-sensitive work; otherwise use urgency and agreed sequencing.'],
              ['Dependencies / access', 'Inputs, approval, assets, credentials, or upstream work needed.'],
              ['QA reviewer', 'Independent knowledgeable reviewer when QA is required.'],
              ['Evidence / links', 'Working file, screenshot, URL, report, change record, or deliverable.'],
              ['Status', 'Backlog, ready, in progress, blocked, QA, client approval, complete, or canceled.'],
            ],
          },
          { type: 'h3', text: 'Daily & Monthly Output Standard' },
          { type: 'policy', text: 'Each employee should complete no fewer than 5 meaningful tasks per workday and maintain a target of at least 100 completed meaningful tasks per month. This is a performance floor — not a substitute for quality, complexity, judgment, client results, or teamwork.' },
          {
            type: 'bullets',
            items: [
              'A meaningful task produces a discrete business or client outcome, advances a defined deliverable, resolves a documented issue, or completes an approved operational control.',
              'Do not split one outcome into artificial micro-tasks, close incomplete work, duplicate tasks, or count routine messages as separate completed tasks.',
              'A task counts as complete only after definition-of-done requirements and required QA/approval are satisfied.',
              'Rework caused by avoidable defects can remove or reverse completion credit.',
            ],
          },
          { type: 'h3', text: 'Definition of Done' },
          {
            type: 'checklist',
            items: [
              'Requested outcome is fully delivered and matches scope/instructions.',
              'Names, client, dates, links, numbers, budgets, destinations, permissions, and settings are correct.',
              'Required self-check and independent QA are complete and evidenced.',
              'Work is launched, delivered, scheduled, or stored in the correct place — not merely drafted.',
              'Stakeholders are notified; material decisions and client approvals are documented.',
              'Task record contains final links/evidence, notes, and an accurate completion status.',
              'Follow-up/monitoring task is created when the result cannot be verified immediately.',
            ],
          },
          { type: 'h3', text: 'Blocked Work & Deadlines' },
          {
            type: 'numbered',
            items: [
              'Identify the blocker precisely and record it in Notion.',
              'Attempt reasonable resolution within role authority.',
              'Notify Lexie immediately when a deadline may be missed; notify the client only through an authorized communicator.',
              'Ask for the missing input, access, decision, or reassignment.',
              'Continue other priority work while waiting.',
              'Update the task when unblocked and verify the revised commitment.',
            ],
          },
        ],
      },
      {
        id: 'meetings',
        title: 'Meetings, Planning & Accountability',
        blocks: [
          {
            type: 'table',
            headers: ['Cadence', 'Purpose', 'Owner / Output'],
            rows: [
              ['Monday', 'Launch the week; client health; priorities; assignments; client updates.', 'Lexie leads operations; David may facilitate. Notion updated.'],
              ['Monday & Wednesday health review', 'Review Blue/Green/Orange/Red status, risk, results, and recovery actions.', 'Leadership; health/status recorded.'],
              ['Wednesday or Thursday', 'Midweek recap, decisions, blockers, capacity, accountability.', 'David runs the meeting flow; Lexie owns operational follow-through.'],
              ['Ad hoc leadership', 'Major client, finance, people, security, or strategy decision.', 'Decision owner records outcome and tasks.'],
            ],
          },
          {
            type: 'bullets',
            items: [
              'Meetings start with decisions and exceptions — not lengthy status narration available in Notion.',
              'Every action has one owner and a next date/status.',
              'David keeps meetings moving; Lexie ensures operational execution.',
              'Meetings may change based on workload, but required client communication and risk review do not disappear.',
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'sales',
    label: 'Sales',
    icon: '💼',
    subsections: [
      {
        id: 'lead-workflow',
        title: 'Lead-to-Payment Workflow',
        blocks: [
          {
            type: 'numbered',
            items: [
              'Lead enters the Melleka app/GoHighLevel and receives a named owner — currently John.',
              'John calls within five minutes whenever practicable and performs initial qualification.',
              'If qualified, John ensures the prospect schedules the appropriate discovery/Calendly step.',
              'Use discovery to learn the business, goals, decision-maker, budget, timing, team, fit, and constraints.',
              'Generate a tailored proposal using the approved Melleka Genie proposal process and review it before sending.',
              'Send the proposal email with the Zoom-calendar link and continue follow-up.',
              'Leadership conducts the Zoom proposal/closing call (Anthony, John, Bryan, David, and/or Lexie as appropriate).',
              'John owns the lead until payment is successfully collected. A verbal yes is not closed revenue.',
              'After payment, trigger onboarding and observe the three-day legitimacy/refund-risk window while work begins.',
            ],
          },
          { type: 'h3', text: 'Qualification Standard' },
          {
            type: 'bullets',
            items: [
              'Prospect can fund at least three continuous months and is not obviously financially distressed.',
              'Usually has more than two or three employees or demonstrates sufficient operating substance.',
              'Decision-maker is involved and has expressed real interest.',
              'Business, service need, and economics fit Melleka Marketing capabilities.',
              'Prospect is honest, respectful, and culturally compatible. The company does not work with bad people or unsuitable industries.',
              'Real estate and construction paid-ad engagements require particular caution.',
            ],
          },
        ],
      },
      {
        id: 'pricing-authority',
        title: 'Pricing, Discounts & Claims Authority',
        blocks: [
          {
            type: 'table',
            headers: ['Topic', 'Rule'],
            rows: [
              ['Published pricing', 'Use current approved website pricing; range approximately $1,000–$15,500/month. Verify live pricing before quoting.'],
              ['Discounts', 'Anthony, Lexie, Bryan, or David may approve. John cannot independently negotiate price.'],
              ['Added services', 'John and non-leadership staff may not promise extras without leadership approval.'],
              ['Performance promises', 'Do not guarantee leads, revenue, or ROAS. Any supportable performance statement must be accurate, contextual, and approved.'],
              ['Close definition', 'Payment received successfully. A proposal, Zoom, verbal yes, or payment-pending state is not closed revenue.'],
              ['Contracts', 'No initial service contract; contemplated: six-month agreement after three months, one-year after next six months.'],
            ],
          },
          { type: 'h3', text: 'CRM Discipline' },
          {
            type: 'bullets',
            items: [
              '99% of viable open leads should have a documented next action and follow-up date.',
              'John controls follow-up judgment; persistence is encouraged without misleading or abusive behavior.',
              'Disqualified/dead leads have a recorded reason.',
              "Zarina's cold-call handoff includes identity, source, needs, interest, fit observations, and next action.",
              'Avoid duplicate pursuit; one active lead has one owner.',
            ],
          },
          { type: 'h3', text: 'Sales KPIs' },
          {
            type: 'table',
            headers: ['Role', 'Minimum / Target', 'Quality Guardrail'],
            rows: [
              ['John', '3 collected sales per month minimum.', 'Fit, correct scope, collected payment, honest expectations, smooth onboarding, refund/churn quality.'],
              ['Zarina', 'Activity and qualified opportunities as assigned.', 'Useful information, compliant outreach, professional representation, clean handoff.'],
              ['Sales system', 'Fast response, next actions, stage hygiene, source attribution.', 'No inflated pipeline; payment-pending is not revenue.'],
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'clients',
    label: 'Clients',
    icon: '🤝',
    subsections: [
      {
        id: 'onboarding',
        title: 'Client Onboarding & First 30 Days',
        blocks: [
          {
            type: 'numbered',
            items: [
              'Payment succeeds through Stripe or another approved method.',
              'Automatic welcome email directs client to schedule the Zoom kickoff.',
              'Immediately create client record, whiteboard entry, Slack channel, Notion workspace/tasks, and initial research tasks.',
              'Lexie and Emely create onboarding tasks from the approved sheet; assign by department.',
              'Confirm package/scope. Clients above $4,300/month may receive broader flexibility; lower tiers follow defined package boundaries.',
              'Prepare business, market, competitor, offer, funnel, access, measurement, and risk research before kickoff.',
              'Conduct kickoff with the right leadership and functional owners.',
              'Bryan, Lexie, Anthony, and David establish initial strategy.',
              'Complete access, tracking, baseline, launch plan, QA, and initial delivery; communicate momentum throughout Week 1.',
            ],
          },
          { type: 'h3', text: 'Kickoff Agenda Checklist' },
          {
            type: 'checklist',
            items: [
              'Introductions, roles, primary/backup client contacts.',
              'Business model, offers, margins, locations, sales process, seasonality.',
              'Primary outcomes and client-specific KPIs.',
              'Current channels, history, wins, failures, agencies, and constraints.',
              'Scope, exclusions, deliverables, and approval flow.',
              'Budgets and exact authority for changing client spend.',
              'Access inventory: ads, analytics, website, domain, CRM, email/SMS, social, creative, reporting.',
              'Communication: Slack, one-hour business-hours SLA, weekly Monday/Tuesday update, office-phone calling standard.',
              'Timeline, dependencies, client-owned actions, risks, and next meeting.',
            ],
          },
          { type: 'h3', text: 'First-Month Success Standard' },
          {
            type: 'bullets',
            items: [
              'Day 1: clear next steps, kickoff scheduling, communication access, visible onboarding.',
              'Week 1: access and research progress, strategy, tasks, initial work, tracking/reporting momentum.',
              'Month 1: the client feels understood, sees urgency, receives proactive ideas, has visible reporting, and experiences premium communication.',
            ],
          },
        ],
      },
      {
        id: 'communication',
        title: 'Client Communication & Experience',
        blocks: [
          { type: 'policy', text: 'During Monday–Friday, 9:00 a.m.–5:00 p.m. Pacific Time, client messages should receive a useful response within one hour. If the answer is not ready, acknowledge receipt, state ownership, and give the next update time.' },
          { type: 'h3', text: 'Authorized Communicators' },
          {
            type: 'bullets',
            items: [
              'Primary: Lexie. Also authorized: Anthony, Bryan, David, and Emely within training/department boundaries.',
              'Gavin and developing employees communicate directly only when leadership approves readiness.',
              'Emely monitors Slack and Respond Watcher alerts so no client is ignored.',
              'Unhappy or escalated clients are handled by Anthony or Lexie, and sometimes David.',
            ],
          },
          { type: 'h3', text: 'Weekly Client Update — Monday (Tuesday absolute latest)' },
          {
            type: 'checklist',
            items: [
              'Work completed during the prior week.',
              'Performance against client-specific KPIs and meaningful interpretation.',
              'Active priorities and what happens next.',
              'Open issues, risks, blockers, or changes.',
              'What the team needs from the client, with owner/date.',
              'Relevant report/dashboard links.',
              'No vanity-data dump; explain what the numbers mean and what action follows.',
            ],
          },
          { type: 'h3', text: 'Client Health System' },
          {
            type: 'table',
            headers: ['Color', 'Definition', 'Required Response'],
            rows: [
              ['🔵 Blue', 'Onboarding; material setup remains.', 'Drive access, research, strategy, early wins, communication, and momentum.'],
              ['🟢 Green', 'Happy; results/relationship strong.', 'Maintain standards, keep improving, do not become complacent.'],
              ['🟠 Orange', 'Concerned/unhappy or results need improvement.', 'Leadership-owned recovery plan, increased work/communication, root cause, and next milestones.'],
              ['🔴 Red', 'Likely to leave / severe risk.', 'Immediate leadership attention; work fully through the end; prepare honest communication and orderly exit if requested.'],
            ],
          },
          { type: 'h3', text: 'Health Warning Signs' },
          {
            type: 'bullets',
            items: [
              'Results decline or prolonged underperformance.',
              'Frequent or increasingly forceful complaints.',
              'Budget stress or invoice questioning.',
              'Client stops responding.',
              'Leadership/contact change.',
              'Reduced trust, sudden access removal, scope disputes, or cancellation language.',
            ],
          },
          { type: 'h3', text: 'Unhappy-Client Recovery Procedure' },
          {
            type: 'numbered',
            items: [
              'Acknowledge concern within the SLA; do not argue or minimize.',
              'Notify Lexie and relevant leader; involve Bryan for performance/paid media and David for systems.',
              'Verify facts, scope, metrics, communications, changes, and client expectations.',
              'Classify health Orange or Red as appropriate and create one owned recovery plan.',
              'Communicate what happened, what is controllable, immediate correction, timeline, and next update.',
              'Leadership may add service at its discretion. No credits or free months are offered.',
              'Continue work with full effort until the engagement actually ends.',
            ],
          },
        ],
      },
      {
        id: 'offboarding',
        title: 'Client Offboarding & Churn Learning',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Confirm effective end date, final deliverables, billing treatment, campaigns, access, and communication plan.',
              'Pause/stop spend and automations at the authorized time.',
              'Return or transfer all client-owned assets and work product.',
              'Provide an access inventory; remove Melleka users when transfer is verified.',
              'Export/report final performance and status.',
              'Remove client data from active systems according to approved retention requirements.',
              'Record churn reason and facts, not blame.',
              'Post-mortem: sale/fit, expectation, onboarding, delivery, performance, communication, billing, controllable causes, lessons, owner, and preventive action.',
            ],
          },
          { type: 'h3', text: 'Cancellation Procedure' },
          {
            type: 'numbered',
            items: [
              'Receive the cancellation request professionally; ask whether the client wants immediate cancellation or service through the paid period.',
              'Ask what could have been improved, but do not pressure the client into staying.',
              'Notify the team and open the offboarding workflow.',
              'Determine service end date and calculate refund/proration.',
              'Exceptional refund decisions remain with Anthony; document the calculation and approval.',
              'No credits or free months are offered.',
              'Continue full-quality work through the actual end date.',
            ],
          },
          {
            type: 'note',
            text: 'Proration formula: Refund = amount paid for the service period × unused service days ÷ total service days in the billing period. Record dates and rounding.',
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'quality',
    label: 'Quality (QA)',
    icon: '✅',
    subsections: [
      {
        id: 'qa-roles',
        title: 'QA Roles & Release Authority',
        blocks: [
          { type: 'policy', text: 'Every material deliverable has a creator and an independent knowledgeable reviewer. The creator self-checks first. The reviewer independently validates the work. A rubber-stamp review is not QA.' },
          {
            type: 'table',
            headers: ['Role', 'Responsibility'],
            rows: [
              ['Creator', 'Build, self-test, compare to requirements, attach evidence, disclose uncertainty.'],
              ['Independent reviewer', 'Reperform critical checks without relying on creator assumptions; document pass/fail/corrections.'],
              ['Release authority', 'Lexie, Bryan, David, Anthony, or Emely within her approved department. New employees do not launch independently.'],
              ['Manager', 'Select reviewer with relevant knowledge; scale QA to risk; monitor defects/rework.'],
            ],
          },
        ],
      },
      {
        id: 'qa-universal',
        title: 'Universal Preflight Checklist',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Correct client, brand, account, property, workspace, list, domain, location, and time zone.',
              'Correct approved request, scope, audience, offer, dates, budget, destinations, and exclusions.',
              'Spelling, grammar, factual claims, pricing, contact data, and legal/compliance elements checked.',
              'Links, forms, calls, events, tracking, notifications, and fallback path tested.',
              'Desktop/mobile and relevant browser/device presentation checked.',
              'Permissions are least-necessary; secrets and client data are not exposed.',
              'No placeholder text, test recipients, draft assets, personal email, wrong-client data, or stale versions.',
              'Rollback/containment path is known for high-risk changes.',
              'Independent reviewer recorded; release authority gives final approval.',
              'Post-launch verification and monitoring owner/time are set.',
            ],
          },
        ],
      },
      {
        id: 'qa-google-ads',
        title: 'QA: Google Ads',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Account, billing profile, conversion actions, attribution settings, and linked analytics are correct.',
              'Campaign goal/type, networks, locations and location options, language, schedule, devices, and audience settings match strategy.',
              'Budget, shared budget, bidding, portfolio strategy, caps, and experiment allocation match client authorization.',
              'Keywords/search themes, match types, negatives, exclusions, brand safety, and query intent reviewed.',
              'Ads, assets/extensions, URLs, tracking templates, UTMs, phone numbers, offers, and policy claims verified.',
              'Landing page loads, matches intent, works on mobile, and submits/calls successfully.',
              'Conversion events deduplicate and record the intended primary/secondary status.',
              'No accidental broad geography, display expansion, auto-applied setting, paused item, or draft left unresolved.',
              'Post-launch: eligible/approved status, impressions/spend/pacing, search terms, conversions, and disapprovals monitored.',
            ],
          },
        ],
      },
      {
        id: 'qa-meta',
        title: 'QA: Meta Ads',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Correct business, ad account, page, Instagram identity, pixel/dataset, catalog, and domain.',
              'Campaign objective, buying type, budget type, dates, schedule, and attribution setting approved.',
              'Audience location/age/language, inclusions, exclusions, customer lists, and expansion settings verified.',
              'Placements intentional; creative safe zones, cropping, captions, thumbnails, music/rights, and accessibility reviewed.',
              'Copy, headline, CTA, offer, URLs, UTMs, forms, and privacy link are accurate.',
              'Pixel/CAPI events fire once with correct parameters; event priority and optimization event match strategy.',
              'Lead form fields, consent language, CRM routing, notifications, and test-lead removal verified.',
              'Post-launch delivery, spend, comments, rejections, broken destinations, and event quality monitored.',
            ],
          },
        ],
      },
      {
        id: 'qa-seo',
        title: 'QA: SEO & Content',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Search intent, audience, approved keyword/topic, and differentiation align with strategy.',
              'Claims, statistics, quotes, names, dates, and links are fact-checked; AI-generated facts are verified.',
              'Title, meta description, H1/H2 structure, URL, canonical, indexability, schema, and internal linking reviewed.',
              'No keyword stuffing, copied content, hidden text, or conflicting canonical/noindex directives.',
              'Images compressed, rights cleared, alt text meaningful, mobile layout, and page speed reasonable.',
              'Forms/CTAs work; analytics and conversion events fire; sitemap and crawl implications considered.',
              'Proofreading, brand voice, client approval, and publish date are recorded.',
            ],
          },
        ],
      },
      {
        id: 'qa-website',
        title: 'QA: Website / Landing Page',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Correct domain/environment; backup/version/rollback exists before material change.',
              'Navigation, copy, pricing, phone, address, hours, legal links, and brand assets are correct.',
              'Responsive checks at common desktop/tablet/mobile sizes; no clipping, overlap, or unreadable text.',
              'Forms validate, submit, route to correct CRM/user, and trigger correct confirmation/notifications.',
              'Phone, email, calendar, maps, checkout, and external links tested.',
              'SSL, redirects, canonical, robots/noindex, sitemap, favicon, and social share metadata reviewed.',
              'Analytics, pixels, consent mode/banner, and events tested without duplicates.',
              'Accessibility basics: keyboard path, labels, contrast, alt text, focus, headings.',
              'Performance: large assets, caching, and critical error checks.',
              'Post-deploy smoke test and uptime/lead-flow verification complete.',
            ],
          },
        ],
      },
      {
        id: 'qa-crm',
        title: 'QA: CRM / GoHighLevel',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Correct subaccount/location, pipeline, stage, owner, permissions, and source attribution.',
              'Fields, forms, tags, lists, deduplication, and required-value rules map correctly.',
              'Test contact uses safe test data and is removed/clearly tagged afterward.',
              'Lead routing, task creation, assignment, notifications, and follow-up dates work.',
              'Email/SMS sender, reply path, opt-in/opt-out, quiet hours, and suppression logic verified.',
              'No live-client workflow triggered by test; bulk action scope and filters independently checked.',
              'Reporting counts/stages reconcile to source records and timezone.',
              'Rollback/export or change log preserved for material changes.',
            ],
          },
        ],
      },
      {
        id: 'qa-email-sms',
        title: 'QA: Email & SMS',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Correct account, sender identity, audience, inclusions/exclusions, suppression list, and consent basis.',
              'Subject/from/preheader, copy, personalization tokens, fallback values, and segmentation correct.',
              'All links, UTMs, phone numbers, coupons, dates, prices, and legal footer accurate.',
              'Desktop/mobile rendering, dark mode, image alt text, and plain-text version reviewed.',
              'Unsubscribe/STOP and preference handling works; physical/contact data included where required.',
              'Schedule, timezone, throttling, frequency, and duplicate-send protection verified.',
              'Test message sent to internal reviewers; live count and final audience snapshot approved.',
              'Post-send delivery, bounces, complaints, replies, and conversion tracking monitored.',
            ],
          },
        ],
      },
      {
        id: 'qa-automation',
        title: 'QA: Automation / AI',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Trigger, inputs, filters, branches, delays, retries, stop conditions, and exception path diagrammed.',
              'Correct workspace/client, credentials, API scopes, models, prompt/version, and environment.',
              'Test happy path, missing input, duplicate event, malformed data, timeout, partial failure, and retry/idempotency.',
              'Outputs are verified for factuality, tone, formatting, privacy, wrong-client leakage, and unsafe actions.',
              'Human approval exists before external publication or material account change when risk requires it.',
              'Rate limits, cost, logging, alerts, data retention, and secret exposure checked.',
              'Disable/rollback/manual fallback documented; owner knows how to intervene.',
              'Production smoke test uses controlled data; downstream records and notifications verified.',
            ],
          },
        ],
      },
      {
        id: 'qa-analytics',
        title: 'QA: Analytics, Data & Reporting',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Source systems, account/property/view, date range, timezone, currency, and attribution model are correct.',
              'Definitions for lead, sale, revenue, spend, conversion, and KPI match client agreement.',
              'Filters, blends, calculated fields, joins, deduplication, and sampling reviewed.',
              'Totals reconcile against source platforms for representative periods.',
              'Outliers, zeros, sudden shifts, and missing data are investigated — not hidden.',
              'Dashboard access and row/client isolation prevent cross-client exposure.',
              'Labels and narrative distinguish actuals, estimates, attribution limits, and lag.',
              'Reviewer reproduces critical numbers; report links and refresh schedule tested.',
            ],
          },
        ],
      },
      {
        id: 'qa-creative',
        title: 'QA: Creative, Design, Video & Social',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Correct brand, dimensions, placement, safe area, resolution, file type, and version.',
              'Copy, logo, colors, fonts, product/people names, prices, dates, and CTA verified.',
              'Image/video/music/talent rights and client permissions confirmed.',
              'No misleading before/after, unsupported claim, sensitive data, or unintended background detail.',
              'Captions/subtitles, audio levels, thumbnails, accessibility, and mobile readability checked.',
              'Platform previews reviewed; links/tags/handles/collaborators/schedule correct.',
              'Client approval obtained where required; final exported asset matches approved proof.',
            ],
          },
        ],
      },
      {
        id: 'qa-budget',
        title: 'QA: Budget, Billing & Financial Changes',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Authorized request and approver identity confirmed.',
              'Client budget vs. Melleka company expense clearly distinguished.',
              'Amount, frequency, tax, currency, start/end, proration, and account/payment method verified.',
              'Duplicate charge/subscription/invoice risk checked.',
              'Second reviewer validates material client spend or refund calculation.',
              'Receipt, approval, and calculation stored; post-change balance/pacing verified.',
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'finance',
    label: 'Finance',
    icon: '💰',
    subsections: [
      {
        id: 'spend-controls',
        title: 'Company Spending Controls',
        blocks: [
          {
            type: 'table',
            headers: ['Amount / Type', 'Authority', 'Control'],
            rows: [
              ['Regular employee spend', 'None without leadership approval', 'No purchasing or commitment of company funds.'],
              ['$0–$99 subscription / company benefit', 'Lexie, Bryan, or David', 'Must benefit company; use company card; record owner/purpose.'],
              ['$100–$500', 'Lexie, Bryan, or David', 'Approval required; tell Anthony afterward when appropriate.'],
              ['Over $500', 'Anthony', 'Advance approval required.'],
              ['Company cards', 'C-level leadership only', 'No sharing outside authorized use; preserve receipts.'],
              ['Subscription audit', 'Anthony', 'Team flags unused/duplicative tools; Anthony audits/cancels.'],
            ],
          },
          { type: 'h3', text: 'Financial Ownership' },
          { type: 'policy', text: 'Anthony manages bookkeeping, accounting, payroll, raises, financial reporting, and financial decisions from A to Z, supported by Michael Farag as third-party accountant. Financial data is restricted to those with a legitimate need.' },
        ],
      },
      {
        id: 'payments-billing',
        title: 'Payments & Failed Charges',
        blocks: [
          {
            type: 'bullets',
            items: [
              'Primary client payment is through Stripe using available approved methods.',
              'Anthony monitors failed payments and outstanding invoices until responsibility is formally delegated.',
              'Contact a client the same day a payment fails and request updated payment.',
              'A trusted long-term client may receive a few days discretion; a new client receives immediate attention and service may be contained/canceled quickly.',
              'Do not represent uncollected amounts as closed revenue.',
            ],
          },
        ],
      },
      {
        id: 'strategy-budgets',
        title: 'Strategy, Performance & Client Budgets',
        blocks: [
          { type: 'policy', text: 'Obtain clear authorization from an authorized client contact before changing client spend. Slack, email, text, and recorded verbal authorization may be acceptable; written confirmation is preferred.' },
          {
            type: 'checklist',
            items: [
              'Confirm exact account/campaign, amount, period, start date, end date, and whether the amount is total or incremental.',
              'Record evidence in the task/client record.',
              'Use a creator plus independent reviewer for material budget edits.',
              'After launch, verify the platform setting, effective pacing, and absence of unintended inherited/shared-budget effects.',
              'Monitor and report material variance.',
            ],
          },
          {
            type: 'warning',
            text: 'NEVER INFER BUDGET AUTHORITY — A client discussing a goal is not automatically authorizing spend. If wording is ambiguous, stop and obtain clarification.',
          },
          { type: 'h3', text: 'Monitoring Standards' },
          {
            type: 'bullets',
            items: [
              'Marketing accounts are checked daily using human review and approved tools including Melleka Genie.',
              'Bryan reviews paid-media clients two to three times per day.',
              'Flag poor performance immediately to the relevant department and leadership; surface high-priority recovery work on the whiteboard and in Notion.',
              'Weekly reports and live dashboards may use Melleka Genie, Looker Studio, and approved sources. Bryan owns reporting accuracy.',
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'people',
    label: 'People',
    icon: '👥',
    subsections: [
      {
        id: 'hiring',
        title: 'Hiring Authority & Process',
        blocks: [
          { type: 'policy', text: 'Anthony determines when a hire is approved; Lexie, Bryan, and David may recommend. Lexie runs recruiting and interviews through the final stage. Anthony usually conducts a final personality/culture interview.' },
          { type: 'h3', text: 'What to Assess' },
          {
            type: 'bullets',
            items: [
              'Integrity, chillness, hard work, knowledge, proven experience, learning ability, and role judgment.',
              'Legitimate professional/social presence such as LinkedIn.',
              'Reject: lying, fabricated experience, rude/standoffish conduct, obvious impairment, or material culture misfit.',
              'Prefer highly experienced candidates for current growth needs while preserving the ability to train strong people.',
            ],
          },
        ],
      },
      {
        id: 'day-one',
        title: 'Day-One Readiness Checklist',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Company email, Slack, Notion, and role tools provisioned before arrival.',
              'Use only @mellekamarketing.com company email for client/company work.',
              'Pair employee with Lexie, Bryan, David, or Emely based on department.',
              'Review this manual, role card, schedule, client communication, task system, security, QA, incident reporting, and AI accountability.',
              'Apply least necessary access; test login and 2FA.',
              'Assign first-week learning and supervised work.',
            ],
          },
        ],
      },
      {
        id: 'training',
        title: '90-Day Training Model',
        blocks: [
          {
            type: 'table',
            headers: ['Phase', 'Focus', 'Release Criteria'],
            rows: [
              ['Days 1–7', 'Tools, services, culture, security, task standards, shadowing.', 'Can navigate systems and explain rules; no independent launch.'],
              ['Days 8–30', 'Observed practice, self-checking, controlled deliverables.', 'Accurate work with close review; improves from feedback.'],
              ['Days 31–60', 'Broader task ownership, client context, modular QA.', 'Consistent quality, urgency, documentation, and judgment.'],
              ['Days 61–90', 'Role-level output with declining supervision.', 'Demonstrates hard work, knowledge, integrity, reliability, and safe independent execution.'],
              ['90-day review', 'Fit, pay, role, task performance, quality, culture, development.', 'Lexie decides readiness/continued controls; Anthony handles material employment decisions.'],
            ],
          },
          { type: 'h3', text: 'Performance Scorecard' },
          {
            type: 'table',
            headers: ['Dimension', 'Evidence'],
            rows: [
              ['Output', '≥5 meaningful completed tasks/workday and ≥100/month target, contextualized for complexity.'],
              ['Quality', 'QA pass rate, avoidable errors, rework, accuracy, client impact.'],
              ['Timeliness', 'Urgency, commitments met, early escalation of blockers.'],
              ['Client service', 'Communication SLA, ownership, professionalism, health/results contribution.'],
              ['Culture', 'Integrity, chillness, hard work, knowledge, teamwork, attitude.'],
              ['Initiative', 'Creates useful work when queue is empty; improves systems; learns.'],
              ['Security/compliance', 'Uses company email, 2FA, secure networks, protects data, reports incidents.'],
              ['Role outcomes', 'Department-specific KPIs, including John minimum 3 collected sales/month.'],
            ],
          },
        ],
      },
      {
        id: 'employee-offboarding',
        title: 'Employee Offboarding & Access Revocation',
        blocks: [
          { type: 'policy', text: 'For termination or elevated risk, leadership may lock access immediately before or during the meeting. Lexie, David, Bryan, and Anthony coordinate; do not alert the employee prematurely when doing so could create risk.' },
          { type: 'h3', text: 'Pre-Separation Plan' },
          {
            type: 'checklist',
            items: [
              'Confirm decision, effective time, meeting owner, and applicable HR/legal requirements.',
              'Inventory company and client accounts, devices, cards, keys, files, automations, API tokens, forwarding rules, and shared credentials.',
              'Identify work handoff, client communications, final pay/benefits, and property return requirements.',
              'Prepare synchronized lockout sequence and evidence/backup preservation.',
            ],
          },
          { type: 'h3', text: 'Access Revocation Checklist' },
          {
            type: 'checklist',
            items: [
              'Disable company email; revoke sessions; review forwarding/delegation/recovery methods.',
              'Remove Slack, Notion, Google Workspace, CRM/GoHighLevel, ad platforms, analytics, websites/domains, social, file storage, AI tools, code/automation, finance, and vendor access.',
              'Rotate shared passwords, API keys, and client credentials the person knew; verify 2FA recovery ownership.',
              'Remove device management/VPN/wireless access and retrieve company cards/keys/devices.',
              'Transfer file/task/automation ownership; disable scheduled workflows owned by personal tokens only after safe transfer.',
              'Confirm client-side removal and document each completed action, time, and executor.',
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'security',
    label: 'Security & AI',
    icon: '🔒',
    subsections: [
      {
        id: 'security-controls',
        title: 'Security Controls',
        blocks: [
          {
            type: 'table',
            headers: ['Control', 'Current Rule'],
            rows: [
              ['Company email', 'Never use personal Gmail/email for client or company work; use @mellekamarketing.com.'],
              ['2FA', 'Mandatory on supported company and client systems.'],
              ['Network', 'Never use unsecured public Wi-Fi. Use office network or approved secure mobile hotspot.'],
              ['Devices', 'Personal computers/phones may access company accounts if approved and securely configured.'],
              ['Links/phishing', 'Verify links, senders, domains, and requests before signing in or sharing data.'],
              ['Passwords', 'Do not expose or reuse weak credentials. Use protected/limited sharing; remove exposure when possible.'],
              ['Portfolios', 'Never publish client work in a personal portfolio without permission.'],
              ['Confidentiality', 'Client/company strategies, data, credentials, assets, finances, SOPs, and internal communications are confidential.'],
              ['Outside work', 'May work another non-marketing job if it does not compete, conflict, misuse time/data, or violate agreements.'],
            ],
          },
          { type: 'h3', text: 'Sensitive-Data Handling' },
          {
            type: 'bullets',
            items: [
              'Access only data necessary for the task.',
              'Confirm client/account before uploading, emailing, sharing, exporting, or using AI.',
              'Do not place credentials, payment data, or unnecessary personal information into documents, screenshots, or public tools.',
              'Use approved recipient permissions; test shared links in a non-owner view.',
              'Do not copy client data into another client workspace or reusable template.',
              'Report accidental disclosure immediately; do not attempt quiet cleanup without leadership awareness.',
            ],
          },
        ],
      },
      {
        id: 'ai-policy',
        title: 'AI-Forward Operating Policy',
        blocks: [
          { type: 'policy', text: 'Employees are encouraged to use premium AI tools extensively to accelerate research, strategy, copy, design, analysis, automation, and internal work. AI use is never a transfer of accountability.' },
          {
            type: 'bullets',
            items: [
              'Use the best approved tool for the task and understand its data-handling implications.',
              'Provide only information necessary for the task; verify client identity and avoid unintended cross-client context.',
              'Test outputs before use. Check facts, calculations, citations, links, brand voice, bias, safety, privacy, and technical behavior.',
              'A human owns every final deliverable and account action. "The AI did it" is not an acceptable explanation.',
              'Do not let AI autonomously publish, spend client money, change permissions, send bulk communications, or make irreversible changes without appropriate controls.',
              'Disclose uncertainty; preserve prompts/configuration when needed to reproduce important work.',
              'If an AI workflow fails, use the documented manual fallback and reconcile missed work after recovery.',
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'emergency',
    label: 'Emergency',
    icon: '🚨',
    subsections: [
      {
        id: 'compromise',
        title: 'A1. Suspected Account Compromise',
        blocks: [
          { type: 'warning', text: 'CALL ANTHONY IMMEDIATELY — ANY HOUR. Speed and honesty are mandatory.' },
          {
            type: 'checklist',
            items: [
              'Stop suspicious activity; do not click further or destroy evidence.',
              'From a known-safe device, notify Anthony and relevant leadership (David/Lexie/Bryan).',
              'Identify account, device, time, symptoms, links/actions, and exposed data.',
              'Leadership locks out/revokes sessions, resets credentials, enforces 2FA, and rotates affected keys.',
              'Preserve screenshots, messages, logs, and timeline.',
              'Assess client/company exposure and contain connected automations/accounts.',
              'Leadership communicates with affected clients/parties promptly and honestly.',
              'Restore from a trusted state, verify integrations, monitor, and complete an incident review.',
            ],
          },
        ],
      },
      {
        id: 'overspend',
        title: 'A2. Client Overspend or Wrong Budget',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Notify Bryan or Lexie immediately.',
              'Verify authorized amount, actual spend, pacing, and affected campaign/account.',
              'Contain additional exposure within authorized judgment; do not make random changes.',
              'Preserve client authorization and platform evidence.',
              'Leadership communicates impact/correction; monitor until stable.',
            ],
          },
        ],
      },
      {
        id: 'wrong-data',
        title: 'A3. Wrong-Client / Confidential Information Sent',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Stop and notify Lexie/Anthony immediately.',
              'Do not rely solely on message deletion or recall.',
              'Identify exactly what was sent, to whom, access status, and whether it was opened/downloaded.',
              'Revoke link access and credentials if relevant; preserve facts.',
              'Leadership contacts the recipient/client, owns the mistake, and determines legal/security response.',
              'Review all related permissions and process failure.',
            ],
          },
        ],
      },
      {
        id: 'wifi-outage',
        title: 'A4. Office Wi-Fi Outage',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Use approved secure phone/mobile hotspot.',
              'Never use unsecured public Wi-Fi.',
              'Notify David/Lexie if material.',
              'Prioritize client messages, launches, and time-sensitive monitoring.',
              'Backfill any offline notes/decisions after restoration.',
            ],
          },
        ],
      },
      {
        id: 'cancellation',
        title: 'A5. Client Wants to Cancel',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Respond professionally; ask immediate end vs. finish paid period.',
              'Do not pressure a save; ask what could have improved.',
              'Notify team; open offboarding.',
              'Calculate approved refund/proration; no credit/free month.',
              'Continue quality work through effective end; transfer assets; record churn/post-mortem.',
            ],
          },
        ],
      },
      {
        id: 'business-continuity',
        title: 'Business Continuity & Incident Response',
        blocks: [
          {
            type: 'table',
            headers: ['Event', 'Immediate Fallback', 'Owner / Escalation'],
            rows: [
              ['Office Wi-Fi down', 'Use approved secure mobile hotspots; no public Wi-Fi; prioritize client SLA and active launches.', 'David / Lexie'],
              ['Slack down', 'Use approved alternate channel/office phone; preserve decisions; backfill Notion/Slack after restoration.', 'Lexie / David'],
              ['Google Workspace down', 'Verify platform vs. company issue; use approved alternatives; avoid risky configuration churn.', 'David'],
              ['Melleka Genie down', 'Manual account/client monitoring, reporting checks, and task creation; reconcile afterward.', 'Bryan / David'],
              ['Respond Watcher down', 'Emely/team manually monitor all client communication.', 'Emely / Lexie'],
              ['Ad platform/CRM/site outage', 'Verify impact, protect spend/leads, notify client, use fallback, test restoration.', 'Relevant owner'],
              ['Security compromise', 'Call Anthony immediately; contain, preserve evidence, revoke/rotate, communicate.', 'Anthony / leadership'],
            ],
          },
          { type: 'h3', text: 'Incident Severity Levels' },
          {
            type: 'table',
            headers: ['Level', 'Examples', 'Response'],
            rows: [
              ['Critical', 'Suspected compromise; broad data disclosure; uncontrolled spend; revenue-critical site/checkout failure.', 'Immediate call to leadership; containment now; continuous ownership until stable.'],
              ['High', 'Client campaign materially broken; CRM lead loss; major missed communication; serious deadline risk.', 'Escalate immediately during work hours; owned recovery and frequent updates.'],
              ['Moderate', 'Limited defect with contained impact; tool outage with working fallback.', 'Record, correct promptly, monitor, and review pattern.'],
              ['Low', 'Minor internal issue without client impact.', 'Resolve through normal task process.'],
            ],
          },
          { type: 'h3', text: 'Universal Incident Cycle' },
          {
            type: 'numbered',
            items: [
              'Detect and verify.',
              'Protect people, data, client funds, live traffic, and business continuity.',
              'Escalate to the correct authority.',
              'Contain without destroying evidence.',
              'Communicate verified facts and next update time.',
              'Recover and independently test.',
              'Monitor for recurrence.',
              'Complete post-incident review and preventive action.',
            ],
          },
        ],
      },
      {
        id: 'ceo-absence',
        title: '30-Day CEO Absence Plan',
        blocks: [
          { type: 'policy', text: 'If Anthony Melleka is unavailable for 30 days, Lexie takes operational command. Bryan continues marketing/performance authority; David continues systems/AI/CRM authority. The team keeps executing what Anthony trained them to do.' },
          {
            type: 'table',
            headers: ['Area', 'Temporary Owner', 'Rule'],
            rows: [
              ['Daily company operations', 'Lexie', 'Full operational command; preserve culture, service, cash, and staffing continuity.'],
              ['Marketing/performance', 'Bryan', 'Maintain client results, paid-media oversight, reporting, and strategy.'],
              ['Systems/AI/CRM', 'David', 'Maintain systems, automations, meetings, access, and incident response.'],
              ['Client escalations', 'Lexie with Bryan/David', 'Own issues promptly; protect major relationships.'],
              ['Finance/accounting', 'Lexie coordinates with Michael Farag', 'Pay valid obligations, preserve records/cash, avoid extraordinary commitments without leadership consensus.'],
              ['Family support', 'Lexie / Michael Farag', 'Continue established payments/support to Kathy and make sure she is financially supported.'],
              ['Hiring/termination', 'Lexie with leadership', 'Only when necessary; document rationale and preserve company stability.'],
              ['Extraordinary decisions', 'Lexie + Bryan + David', "Use Anthony's established intent, integrity, cash preservation, and client protection; document decision."],
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  {
    id: 'roles',
    label: 'Roles & KPIs',
    icon: '📊',
    subsections: [
      {
        id: 'role-cards',
        title: 'Department Role Cards',
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'Wins When', 'Core KPIs / Evidence'],
            rows: [
              ['Anthony — CEO', 'Leadership grows, company makes money/grows, major relationships/strategy are strong, he is out of routine work.', 'Profit/cash health, growth, leadership capacity, major-client retention, sales-closing delegation.'],
              ['Lexie — COO', 'Everyone in the building performs, company operates without Anthony, clients/tasks/onboarding are controlled.', 'SLA, weekly updates, task throughput/quality, health recovery, staffing/capacity, onboarding speed.'],
              ['Bryan — CMO', 'Client marketing produces the right outcomes and reporting is accurate.', 'Client-specific KPIs, paid-media pacing, QA, monitoring, reporting accuracy, strategy actions.'],
              ['David — CSO', 'Systems, AI, CRM, and meetings increase reliability and leverage.', 'Automation reliability, CRM data/routing, incident recovery, system adoption, meeting follow-through.'],
              ['Emely', 'CRM communications/workflows and Slack monitoring run accurately.', 'SLA coverage, workflow QA, email/SMS performance, task/onboarding completion.'],
              ['Gavin', 'Develops safe, knowledgeable AI/CRM/automation output.', 'Training milestones, QA pass rate, meaningful tasks, decreasing rework.'],
              ['John', 'Qualified opportunities become collected, well-fit clients.', '≥3 collected sales/month, five-minute lead response, next-action hygiene, close quality.'],
              ['Zarina', 'Professional outreach creates qualified possibilities for John.', 'Approved activity, qualified handoffs, CRM accuracy, compliance/brand quality.'],
            ],
          },
        ],
      },
      {
        id: 'templates',
        title: 'Operational Templates',
        blocks: [
          { type: 'h3', text: 'B1. Weekly Client Update' },
          {
            type: 'table',
            headers: ['Field', 'Entry'],
            rows: [
              ['Client / week', ''],
              ['Health color + reason', ''],
              ['Completed last week', ''],
              ['Performance and interpretation', ''],
              ['Next priorities', ''],
              ['Risks / blockers', ''],
              ['Need from client + due date', ''],
              ['Dashboard/report link', ''],
              ['Owner / next update', ''],
            ],
          },
          { type: 'h3', text: 'B2. Incident Record' },
          {
            type: 'table',
            headers: ['Field', 'Entry'],
            rows: [
              ['Incident / severity', ''],
              ['Detected by / time', ''],
              ['Systems/clients affected', ''],
              ['Known facts', ''],
              ['Containment actions', ''],
              ['Leader notified / time', ''],
              ['Client communication', ''],
              ['Recovery verification', ''],
              ['Root cause', ''],
              ['Preventive action / owner / due', ''],
            ],
          },
          { type: 'h3', text: 'B3. QA Sign-Off' },
          {
            type: 'table',
            headers: ['Field', 'Entry'],
            rows: [
              ['Client / deliverable', ''],
              ['Source request / scope', ''],
              ['Creator / self-check time', ''],
              ['Independent reviewer', ''],
              ['Checklist module(s)', ''],
              ['Defects corrected', ''],
              ['Client/budget approval evidence', ''],
              ['Release authority / time', ''],
              ['Post-launch check / owner', ''],
            ],
          },
          { type: 'h3', text: 'B4. Client Cancellation / Post-Mortem' },
          {
            type: 'table',
            headers: ['Field', 'Entry'],
            rows: [
              ['Client / health at notice', ''],
              ['Notice / effective end', ''],
              ['Immediate vs. through period', ''],
              ['Refund/proration calculation', ''],
              ['Stated churn reason', ''],
              ['Underlying controllable causes', ''],
              ['Sales/onboarding/delivery lessons', ''],
              ['Assets/access transferred', ''],
              ['Preventive action / owner / due', ''],
            ],
          },
        ],
      },
    ],
  },
];

// Full plain-text SOP for search indexing across all sections
export function getSopSearchIndex(): { tabId: string; subsectionId: string; tabLabel: string; subsectionTitle: string; text: string }[] {
  const index: { tabId: string; subsectionId: string; tabLabel: string; subsectionTitle: string; text: string }[] = [];
  for (const tab of SOP_TABS) {
    for (const sub of tab.subsections) {
      const texts: string[] = [sub.title];
      for (const block of sub.blocks) {
        if (block.type === 'paragraph' || block.type === 'policy' || block.type === 'future' || block.type === 'warning' || block.type === 'note' || block.type === 'h3') {
          texts.push(block.text);
        } else if (block.type === 'checklist' || block.type === 'numbered' || block.type === 'bullets') {
          texts.push(...block.items);
        } else if (block.type === 'table') {
          texts.push(...block.headers);
          for (const row of block.rows) texts.push(...row);
        }
      }
      index.push({ tabId: tab.id, subsectionId: sub.id, tabLabel: tab.label, subsectionTitle: sub.title, text: texts.join(' ') });
    }
  }
  return index;
}

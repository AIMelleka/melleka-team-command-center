import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  DollarSign,
  Phone,
  Wrench,
  Search,
  Users,
  TrendingUp,
  HeartHandshake,
  Zap,
  Sparkles,
  FileText,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminHeader from '@/components/AdminHeader';
import LiveScript from '@/components/sales/LiveScript';
import PlanCompare from '@/components/sales/PlanCompare';
import CalendarModal from '@/components/sales/CalendarModal';
import IndustriesModal from '@/components/sales/IndustriesModal';
import ValueProviderModal from '@/components/sales/ValueProviderModal';

const menuItems = [
  { id: 'script', label: 'Live Script', icon: Phone },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'services', label: 'Services', icon: Zap },
  { id: 'pre-call', label: 'Pre-Call', icon: Search },
  { id: 'competitor', label: 'Competitor Audit', icon: TrendingUp },
  { id: 'who-we-are', label: 'Who We Are', icon: Users },
  { id: 'tools', label: 'Tool Stack', icon: Wrench },
  { id: 'retention', label: 'Retention', icon: HeartHandshake },
]

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const SalesGuide = () => {
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('script');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-110px 0px -60% 0px', threshold: 0 }
    )
    for (const item of menuItems) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!menuRef.current) return
    const activeBtn = menuRef.current.querySelector(`[data-section="${activeSection}"]`)
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeSection])

  return (
    <>
      <CalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <ValueProviderModal open={valueOpen} onClose={() => setValueOpen(false)} />
      <IndustriesModal open={industriesOpen} onClose={() => setIndustriesOpen(false)} />

      <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
        <AdminHeader />

        {/* Hero Header */}
        <section className="bg-primary text-white py-10 px-6 shrink-0">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-white/70 hover:text-white hover:bg-white/10 mb-2 -ml-2 min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-white">
                Sales &amp; Closing
              </h1>
              <p className="text-white/60 text-sm">
                Scripts, pricing, objection handling, and everything you need to close.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <button
                onClick={() => navigate('/proposal-builder')}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                Proposal
              </button>
              <button
                onClick={() => setValueOpen(true)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm min-h-[44px]"
              >
                <Sparkles className="w-4 h-4" />
                Value
              </button>
              <button
                onClick={() => setIndustriesOpen(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm min-h-[44px]"
              >
                <Building2 className="w-4 h-4" />
                Industries
              </button>
              <button
                onClick={() => setCalendarOpen(true)}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm min-h-[44px]"
              >
                <CalendarDays className="w-4 h-4" />
                Calendar
              </button>
            </div>
          </div>
        </section>

        {/* Sticky Section Nav */}
        <div className="sticky top-12 sm:top-14 z-40 bg-background border-b border-border shadow-sm shrink-0">
          <div
            ref={menuRef}
            className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  data-section={item.id}
                  onClick={() => scrollToId(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 min-h-[36px] ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-12 w-full">

          {/* ==================== LIVE SCRIPT ==================== */}
          <section id="script" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Live Sales Script
            </h2>
            <LiveScript />
          </section>

          {/* ==================== PRICING ==================== */}
          <section id="pricing" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Pricing
            </h2>

            <div className="space-y-6">
              {/* Starter Plans */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Starter Plans</div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Google Ads Only</div>
                    <div className="text-2xl font-bold text-foreground">$999<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">Google Ads &middot; 5-7 Day Turnaround</div>
                  </div>
                  <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Meta Ads Only</div>
                    <div className="text-2xl font-bold text-foreground">$1,499<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">Meta Ads &middot; 5-7 Day Turnaround</div>
                  </div>
                  <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Google + Meta</div>
                    <div className="text-2xl font-bold text-foreground">$2,499<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">2 Channels &middot; 4-5 Day Turnaround</div>
                  </div>
                </div>
              </div>

              {/* Full-Service Plans */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Full-Service Plans</div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-card rounded-xl p-5 border border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Advanced Silver</div>
                    <div className="text-2xl font-bold text-foreground">$4,299<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">4 Channels &middot; 4-5 Day Turnaround</div>
                  </div>
                  <div className="bg-card rounded-xl p-5 border border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Premium Silver</div>
                    <div className="text-2xl font-bold text-foreground">$7,499<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">5 Channels &middot; 3-4 Day Turnaround</div>
                  </div>
                  <div className="bg-card rounded-xl p-5 border border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Premium Gold</div>
                    <div className="text-2xl font-bold text-foreground">$9,499<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">Omni Channel &middot; 1-2 Day &middot; Up to 3 locations</div>
                  </div>
                  <div className="bg-primary/5 rounded-xl p-5 border-2 border-primary relative">
                    <div className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Top Tier</div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Premium Platinum</div>
                    <div className="text-2xl font-bold text-foreground">$14,999<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground mt-2">Omni Channel &middot; 1-2 Day &middot; Up to 15 locations</div>
                  </div>
                  <div className="bg-primary rounded-xl p-5 text-white">
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Enterprise</div>
                    <div className="text-2xl font-bold text-white">15%<span className="text-base font-normal text-white/50"> of ad spend</span></div>
                    <div className="text-xs text-white/50 mt-2">$500K/mo min. ad spend &middot; Omni Channel &middot; Same Day</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">Advanced Silver &amp; Above Includes</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-700 dark:text-blue-400">
                  <span>&bull; Month-to-month (no contracts)</span>
                  <span>&bull; Dedicated Slack channel</span>
                  <span>&bull; Analytics &amp; live dashboard</span>
                  <span>&bull; Landing pages &amp; funnels</span>
                  <span>&bull; Email &amp; SMS campaigns</span>
                  <span>&bull; Social media management</span>
                  <span>&bull; Online listing placement</span>
                </div>
              </div>

              {/* Feature Comparison Table */}
              <div>
                <h4 className="font-semibold text-foreground mb-3 text-sm">Feature Comparison</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs min-w-[110px]">Feature</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">$999</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">$1,499</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">$2,499</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">$4,299</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">$7,499</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">$9,499</th>
                        <th className="text-center py-2 px-1 font-medium text-primary text-xs">$14,999</th>
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground text-xs">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Channels', 'Google', 'Meta', 'G+M', '4 Ch', '5 Ch', 'Omni', 'Omni', 'Omni'],
                        ['Turnaround', '5-7d', '5-7d', '4-5d', '4-5d', '3-4d', '1-2d', '1-2d', 'Same Day'],
                        ['Locations', '—', '—', '—', '—', '—', 'Up to 3', 'Up to 15', 'Unlimited'],
                        ['Meetings', '—', '—', '30m/mo', '30m/2wk', '30m/wk', '1hr/wk', '1.5hr/wk', '2hr/wk'],
                        ['Extra Task Hours', '—', '—', '—', '—', '3 hrs', '5 hrs', '5 hrs', '10 hrs'],
                        ['Setup & Management', 'Basic', 'Basic', 'Basic', 'Basic', 'Adv', 'Adv', 'Adv', 'Adv'],
                        ['Optimization', 'Monthly', 'Monthly', 'Bi-Wkly', 'Bi-Wkly', 'Weekly', 'Daily', 'Daily', 'Daily'],
                        ['A/B Testing', '—', '—', '—', '—', '✓', '✓', '✓', '✓'],
                        ['SEO/SEAO', '—', '—', '—', 'Basic', 'Adv', 'Adv', 'Adv', 'Adv'],
                        ['On-Demand Reporting', '—', '—', '—', '—', '✓', '✓', '✓', '✓'],
                        ['Website Updates', '—', '—', '—', 'Basic', 'Adv', 'Adv', 'Adv', 'Adv'],
                        ['Reputation Mgmt', '—', '—', '—', '—', '✓', '✓', '✓', '✓'],
                        ['UGC Content', '—', '—', '—', '—', '2 pcs', '3 pcs', '5 pcs', '10 pcs'],
                        ['Influencer Marketing', '—', '—', '—', '—', '—', '✓', '✓', '✓'],
                        ['Television Ads', '—', '—', '—', '—', '—', '✓', '✓', '✓'],
                        ['In-Person Content', '—', '—', '—', '—', '—', '—', '✓', '✓'],
                        ['AI Chatbot', '—', '—', '—', '—', '✓', '✓', '✓', '✓'],
                        ['AI Voice Agent', '—', '—', '—', '—', '✓', '✓', '✓', '✓'],
                        ['Automated CRM', '—', '—', '—', '—', '—', 'Auto', 'AI-Mgd', 'AI-Mgd'],
                        ['AI Tools on Demand', '—', '—', '—', '—', '—', '✓', '✓', '✓'],
                      ].map(([feature, ...tiers]) => (
                        <tr key={feature as string} className="border-b border-border">
                          <td className="py-2 pr-4 text-foreground text-xs">{feature as string}</td>
                          {tiers.map((val, i) => (
                            <td key={i} className="text-center py-2 px-1">
                              {val === '✓' ? <span className="text-green-600 text-xs">&#10003;</span> :
                               val === '—' ? <span className="text-muted-foreground/40 text-xs">—</span> :
                               <span className="text-xs font-medium text-foreground">{val as string}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">Sales Tips</p>
                <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                  <li>&bull; Custom proposals only — use the proprietary proposal generator.</li>
                  <li>&bull; Never offer discounts — position premium.</li>
                  <li>&bull; Trial month: Position as a "dating" phase — start with one plan to prove value, then upgrade.</li>
                  <li>&bull; All plans are month-to-month. This is our competitive edge — zero risk for the client.</li>
                </ul>
              </div>

              {/* Plan Compare Tool */}
              <div>
                <h4 className="font-semibold text-foreground mb-3 text-sm">Compare Plans Side-by-Side</h4>
                <PlanCompare />
              </div>
            </div>
          </section>

          {/* ==================== SERVICES ==================== */}
          <section id="services" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Services We Offer
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  'Google Ads', 'Meta Ads (FB & IG)', 'TikTok Ads', 'LinkedIn Ads',
                  'Bing Ads', 'Reddit Ads', 'ChatGPT Ads', 'Website Design & Dev',
                  'SEO (Technical + Local)', 'Social Media Management', 'GoHighLevel CRM',
                  'Content Creation', 'Email & SMS Marketing', 'Business Listings (75+)',
                  'AI Chatbots & Voice Agents', 'Analytics & Tracking', 'Video Production',
                  'Influencer Marketing',
                ].map((service) => (
                  <div key={service} className="bg-card rounded-lg px-3 py-2 text-sm text-foreground text-center border border-border">
                    {service}
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm">How to Sell It</h4>
                <p className="text-sm text-blue-800 dark:text-blue-400">"We're not a Google Ads agency or an SEO agency — we're your entire marketing department. All these services, one team, one office. No juggling five vendors. One point of contact, full accountability."</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2 text-sm">Service Delivery Flow</h4>
                <div className="flex flex-col md:flex-row gap-2">
                  {[
                    { step: '1', label: 'Brand Awareness', desc: 'Top-of-funnel Meta/display' },
                    { step: '2', label: 'Lead Generation', desc: 'High-intent Google + retargeting' },
                    { step: '3', label: 'CRM Integration', desc: 'GHL automation + AI follow-up' },
                    { step: '4', label: 'Website Build', desc: '2-week turnaround' },
                    { step: '5', label: 'Review Collection', desc: 'Automated SMS/email' },
                  ].map((s) => (
                    <div key={s.step} className="flex-1 bg-card rounded-lg p-3 border border-border text-center">
                      <div className="text-xs text-primary font-bold mb-1">Step {s.step}</div>
                      <div className="text-sm font-medium text-foreground">{s.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ==================== PRE-CALL RESEARCH ==================== */}
          <section id="pre-call" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Pre-Call Research
            </h2>

            <div className="space-y-3">
              {[
                { tool: 'SEMrush', what: 'Domain audit, keywords, traffic, competitor analysis. Know their numbers before the call.' },
                { tool: 'Google Ads Transparency', what: 'Check if the prospect (and competitors) are running ads. Use this data on the call.' },
                { tool: 'Facebook Ad Library', what: 'Review competitor creative styles. Shows what messaging the market is using.' },
                { tool: 'Google Maps / Reviews', what: 'Check review count, ratings, and gaps vs competitors. Low reviews = easy win to pitch.' },
                { tool: 'HubSpot', what: "Check prior interactions, notes, and contact history. Don't ask questions you already have answers to." },
                { tool: 'Build Your Narrative', what: "Combine findings into a 30-second opening story. Show them you've done your homework." },
              ].map((item, i) => (
                <div key={item.tool} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <div>
                    <span className="font-medium text-foreground text-sm">{item.tool}</span>
                    <span className="text-sm text-muted-foreground"> — {item.what}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ==================== COMPETITOR AUDIT ==================== */}
          <section id="competitor" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Live Competitor Audit (On-Call Demo)
            </h2>

            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-sm text-purple-800 dark:text-purple-300">
                <strong>Key principle:</strong> Screen share in real-time. Visual evidence creates urgency. Show, don't tell.
              </div>
              <div className="space-y-3">
                {[
                  { step: 'Pull SEMrush', desc: 'Show their organic traffic gap vs competitors. Let the numbers speak.' },
                  { step: 'Google Ads Transparency', desc: "Reveal what competitors are spending on ads. \"See this? They're taking your customers right now.\"" },
                  { step: 'Google Maps', desc: 'Highlight review count disparity. "Your competitor has 340 reviews. You have 47."' },
                  { step: 'Identify Quick Win', desc: 'Recommend one immediate action — search ads, review campaign, landing page rebuild. Give them a taste.' },
                ].map((item, i) => (
                  <div key={item.step} className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                    <div>
                      <span className="font-medium text-foreground text-sm">{item.step}</span>
                      <span className="text-sm text-muted-foreground"> — {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ==================== WHO WE ARE ==================== */}
          <section id="who-we-are" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Who We Are (Know This)
            </h2>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl p-5 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">The Pitch</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    "The entire marketing team is in one office in LA. We're not freelancers, we're not overseas, we're not a call center. We're one team, one office, fully embedded in your business."
                  </p>
                </div>
                <div className="bg-card rounded-xl p-5 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Differentiators</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>&bull; Month-to-month (no contracts)</li>
                    <li>&bull; Entire team in one LA office</li>
                    <li>&bull; Same-day responses</li>
                    <li>&bull; Daily communication</li>
                    <li>&bull; Proactive, not reactive</li>
                    <li>&bull; Full-stack: ads, SEO, web, AI, CRM</li>
                  </ul>
                </div>
              </div>
              <div className="bg-primary rounded-xl p-5 text-white">
                <h4 className="font-semibold mb-2 text-white">The One-Liner</h4>
                <p className="text-white/70 text-sm italic">"We're the Cadillac of marketing — premium service, premium results, zero contracts."</p>
              </div>
            </div>
          </section>

          {/* ==================== TOOL STACK ==================== */}
          <section id="tools" className="scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Tool Stack
            </h2>

            <div className="grid md:grid-cols-2 gap-3">
              {[
                { tool: 'HubSpot', use: 'CRM, email sequences, pipeline tracking' },
                { tool: 'SEMrush', use: 'Keyword & competitor research' },
                { tool: 'Google Ads Transparency', use: 'Live ad visibility research' },
                { tool: 'Facebook Ad Library', use: 'Meta ad research & competitor creative' },
                { tool: 'Melleka Proposal Generator', use: 'Custom proposal creation' },
                { tool: 'Microsoft Clarity', use: 'Session replays & heatmaps' },
                { tool: 'PostHog', use: 'Behavioral analytics & product data' },
                { tool: 'GoHighLevel', use: 'Client CRM, automations, AI agents' },
              ].map((item) => (
                <div key={item.tool} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground">{item.tool}</span>
                    <span className="text-sm text-muted-foreground"> — {item.use}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ==================== RETENTION ==================== */}
          <section id="retention" className="scroll-mt-28 pb-10">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-primary" />
              Client Retention &amp; Expectations
            </h2>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2 text-sm">Set Realistic Timelines</h4>
                <div className="flex flex-col md:flex-row gap-2">
                  {[
                    { month: 'Month 1', desc: 'Build & test — audits, setup, launch campaigns', color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300' },
                    { month: 'Month 2-3', desc: 'Optimize — A/B testing, refine targeting, improve', color: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300' },
                    { month: 'Month 4+', desc: 'Scale — increase budget, expand channels, compound', color: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300' },
                  ].map((m) => (
                    <div key={m.month} className={`flex-1 rounded-lg p-4 border text-center ${m.color}`}>
                      <div className="font-bold text-sm">{m.month}</div>
                      <div className="text-xs mt-1">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2 text-sm">Why Clients Leave</h4>
                <div className="grid md:grid-cols-2 gap-2 text-sm text-red-800 dark:text-red-400">
                  <div>&bull; Results variability — manage expectations upfront</div>
                  <div>&bull; Budget pressure — show ROI consistently</div>
                  <div>&bull; Expectation mismatch — be honest about timelines</div>
                  <div>&bull; Communication gaps — overcommunicate weekly</div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2 text-sm">Prevention Playbook</h4>
                <ul className="text-sm text-green-800 dark:text-green-400 space-y-1">
                  <li>&bull; Overcommunicate — weekly minimum, even during slow periods</li>
                  <li>&bull; Show your work — dashboards, reports, screen shares</li>
                  <li>&bull; Be transparent about what isn't working</li>
                  <li>&bull; Honesty builds more trust than a perfect track record</li>
                  <li>&bull; Week 1: Send a "campaign is live" update with screenshots</li>
                  <li>&bull; Week 2: First optimization note — "here's what we found and adjusted"</li>
                  <li>&bull; Month 1 end: Full review call. Celebrate wins. Set Month 2 goals.</li>
                  <li>&bull; Any bad week: Reach out FIRST before they see the report</li>
                </ul>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  );
};

export default SalesGuide;

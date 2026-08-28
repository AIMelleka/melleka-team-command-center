import { useState, useRef } from 'react'
import { X, ChevronDown, ChevronUp, Send, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api'

/* ------------------------------------------------------------------ */
/*  OBJECTION DATA                                                      */
/* ------------------------------------------------------------------ */

const objections: Record<string, string> = {
  // Opening / early call
  'Not interested': "No problem at all — I appreciate your time. If anything ever changes or you need marketing help down the road, don't hesitate to reach out. Wishing you nothing but success. Have a great day!",
  'Just send me info': "Absolutely — what's the best email to send it to? I'll put together some info on what we do and how we work. No pressure at all.",
  'How long is this?': "Totally respect your time. This is really just a quick conversation — 10-15 minutes max. I just want to learn about your business, and if there's a fit, I'll put together a custom plan for you. No pressure at all.",
  'Who is Melleka?': "We're a full-service marketing agency — the entire team is in one office in LA. We basically become your marketing department. Everything from ads to SEO to website to AI — one team, one office, full transparency. And it's all month-to-month.",

  // Discovery
  'Have a marketer': "Great — we complement in-house teams. Full team of specialists across every channel: ads, SEO, design, dev, analytics, AI. Your person focuses on their strength, we handle the rest. Force multiplier.",
  'My industry?': "Our systems work across industries — legal, healthcare, construction, home services, e-commerce, and more. Marketing fundamentals are universal. We learn your industry fast.",
  "We're doing fine": "That's great to hear. Most of our best clients came to us when things were going well — they wanted to scale, not just survive. The question is: could you be doing even better with a full team behind you?",
  'No budget right now': "I completely understand — no worries at all. If anything changes or you ever have questions, please don't hesitate to reach out. And hey — regardless of budget or pricing, I'd love to give you a free consultation right now based on your industry and what we've seen work. No strings attached, just some advice you can use today.",

  // Transition / pitch
  'Been burned': "I hear that a lot — and that's exactly why we do month-to-month. No contracts. One team, one office, daily communication. You get a Slack channel with direct access. If we don't deliver, you leave. We also send you a full marketing plan upfront so you know exactly what you're getting.",
  'What makes you different?': "One team, one office in LA. Not freelancers, not outsourced. You get a dedicated Slack channel, daily communication, a live dashboard, and it's all month-to-month. We become your marketing department — not just another vendor.",
  'Do you outsource?': "Never. The entire team is in one office in LA. Your ads person, your SEO person, your designer, your developer — they're all sitting next to each other. That's how we move fast and stay accountable.",
  'What if no results': "Month-to-month. No contracts. No results = you leave. We take that risk. Month 1 = build & test. Months 2-3 = optimize. Month 4+ = scale. We set clear expectations from day one.",

  // Price
  'Too expensive': "You're not paying for ads — you're paying for an entire marketing department. The entire team is in one office in LA. One in-house marketer costs $5K-7K/month salary alone. You're getting an entire team for less. And it's month-to-month — zero risk.",
  'Want discount': "We don't discount — that would mean cutting corners. But here's what we CAN do: start on a lower tier and upgrade as ROI comes in. And we'll build you a custom marketing plan either way — that's yours to keep whether you work with us or not.",
  'Plan differences': "$999 = Google Ads only, monthly optimization. $1,499 = Meta Ads only. $2,499 = Google + Meta. $4,299 = 4 channels, bi-weekly, full suite. $7,499 = 5 channels, weekly, AI tools, A/B testing. $9,499 = omni-channel, daily, influencer, TV, 3 locations. $14,999 = AI CRM, in-person content, 15 locations. Enterprise = unlimited.",
  'Locations extra?': "Silver plans = single location. Gold = up to 3. Platinum = up to 15. Enterprise = unlimited. All under one plan, one price.",
  'Ad spend extra?': "Yes — the plan price covers our team, strategy, and management. Ad spend is separate and goes directly to the platforms. It's about $5 per campaign per day, and we usually A/B test multiple campaigns to start — so anywhere from $20-50 a day depending on your budget. Then we scale up according to results. You control the spend, we optimize it.",
  "What's included?": "Every plan includes: dedicated Slack channel, analytics & live dashboard, landing pages & funnels, email & SMS campaigns, social media management, and online listing placement. The tier determines how many channels, turnaround speed, and advanced features like AI tools and A/B testing.",
  'Cheaper option?': "We actually have starter plans from $999/mo — Google Ads only, Meta Ads only, or Google + Meta at $2,499. These are focused, single-channel entries. For the full suite with landing pages, social, email, SEO, and the AI stack, Advanced Silver at $4,299 is where everything opens up. All month-to-month.",

  // Justify / upgrade
  'Upgrade later?': "Absolutely. Month-to-month — move up or down anytime. Most clients upgrade in 2-3 months once they see results. We earn your business every month.",
  'Why no contracts?': "Because we don't need them. If we're doing good work, you'll stay. Contracts protect bad agencies. We'd rather earn your business every single month. That keeps us accountable.",
  'Can I start small?': "Absolutely. We have starter plans at $999 for Google Ads only or $1,499 for Meta Ads only — a great way to test the water. Or $2,499 for both Google and Meta. From there you upgrade when you're ready. All month-to-month, no commitment.",

  // Trust / thinking
  'Need to think': "Totally. No pressure at all. What I'd suggest — let me put together a custom marketing plan for you. It's yours whether you go with us or not. You'll see exactly what we'd do, how we'd do it, and what results to expect. Then you can decide on your own time.",
  'Show results first': "Totally fair. What we'll do is put together a full marketing plan customized for your business — it's yours to keep no matter what. That way you can see exactly what we'd do. Then if you want to move forward, we schedule a Zoom to walk through it together.",
  'How long for results?': "Month 1 is build and setup — audits, campaigns, landing pages. Months 2-3 we optimize — A/B testing, refining targeting. Month 4+ is when we scale. We set clear expectations from day one so there are no surprises.",
  "What's the catch?": "No catch. Month-to-month, no contracts, no hidden fees. If we don't deliver, you leave. We actually lose money if a client leaves before 3 months — that's how invested we are in your success from day one.",

  // Close / next steps
  'Send me info': "For sure. I'll put together a custom marketing plan and proposal tailored to your business. It's yours to keep whether you go with us or not. Let me get a Zoom on the calendar so I can walk you through it — what day works best?",
  'Talk to my partner': "Makes total sense. What I'd love to do is put together the marketing plan so you can show them exactly what we'd do. Even better — let's schedule a Zoom and they can join. That way they can ask questions directly. What day works?",
  'Call me back later': "Absolutely. When's a good time? And in the meantime, I'll put together a custom marketing plan for your business so we have something concrete to talk about. It's yours to keep no matter what.",
  'Not the right time': "Totally understand. Timing is everything. Let me build you a marketing plan anyway — it's free, it's yours. When the time is right, you'll have a full roadmap ready to go. No pressure, no follow-up unless you want it.",
}

/* ------------------------------------------------------------------ */
/*  FREE CONSULTATION TOOL                                              */
/* ------------------------------------------------------------------ */

function FreeConsultation() {
  const [industry, setIndustry] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const generate = async () => {
    if (!industry.trim() || loading) return
    setLoading(true)
    setResult('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE}/guide/industry-advice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ industry: industry.trim(), notes: notes.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setResult('Something went wrong. Try again.')
      } else {
        setResult(data.advice)
      }
    } catch {
      setResult('Connection error. Try again.')
    } finally {
      setLoading(false)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }

  return (
    <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">Free Consultation — Give Them Value</span>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') generate() }}
          placeholder="Type their industry (e.g. plumbing, dental, law firm...)"
          className="w-full px-3 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:border-purple-400 bg-white text-gray-800"
        />
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') generate() }}
          placeholder="Optional: notes from the call (goals, challenges, location...)"
          className="w-full px-3 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:border-purple-400 bg-white text-gray-500"
        />
        <button
          onClick={generate}
          disabled={loading || !industry.trim()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-40 cursor-pointer"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating recommendations...</>
          ) : (
            <><Send className="w-4 h-4" /> Get Industry Recommendations</>
          )}
        </button>
      </div>
      {result && (
        <div ref={resultRef} className="bg-white border border-purple-200 rounded-lg px-4 py-3">
          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-2">Read this to them:</div>
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result}</div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  INLINE OBJECTION PILL                                               */
/* ------------------------------------------------------------------ */

function ObjectionPill({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) {
  const response = objections[label]
  const hasConsultation = label === 'No budget right now'
  return (
    <div>
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
          isOpen
            ? 'bg-red-500 text-white'
            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
        }`}
      >
        {isOpen ? <X className="w-2.5 h-2.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
        {label}
      </button>
      {isOpen && response && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 leading-relaxed">
          {response}
          {hasConsultation && <FreeConsultation />}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export default function LiveScript() {
  const [openObjection, setOpenObjection] = useState<string | null>(null)
  const [nextStepsOpen, setNextStepsOpen] = useState(false)

  const toggle = (label: string) => setOpenObjection(openObjection === label ? null : label)
  const allLabels = Object.keys(objections)

  return (
    <div className="space-y-6">

      {/* ===== THE SCRIPT ===== */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* Opening */}
        <div className="bg-primary px-5 py-4">
          <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2">Opening — Say This First</div>
          <p className="text-sm leading-relaxed text-white/85 italic">
            "Hi [Name], my name is [Your Name] with Melleka Marketing — thanks for taking the time. Before I get into anything, I'd love to hear about your business — what do you do, and what does a great month look like for you?"
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Not interested" isOpen={openObjection === 'Not interested'} onToggle={() => toggle('Not interested')} />
            <ObjectionPill label="Just send me info" isOpen={openObjection === 'Just send me info'} onToggle={() => toggle('Just send me info')} />
            <ObjectionPill label="How long is this?" isOpen={openObjection === 'How long is this?'} onToggle={() => toggle('How long is this?')} />
            <ObjectionPill label="Who is Melleka?" isOpen={openObjection === 'Who is Melleka?'} onToggle={() => toggle('Who is Melleka?')} />
          </div>
        </div>

        {/* Discovery */}
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Discovery — Let Them Talk, Ask These</div>
          <div className="space-y-2.5">
            {[
              '"What have you tried marketing-wise? What worked, what didn\'t?"',
              '"Do you have anyone handling your marketing now, or is that something you\'re looking to bring on?"',
              '"What channels are you on right now — Google, social media, SEO?"',
              '"How many locations do you have? Looking to expand?"',
              '"What\'s the biggest challenge in your business right now?"',
            ].map((q, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-sm text-foreground italic">{q}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Have a marketer" isOpen={openObjection === 'Have a marketer'} onToggle={() => toggle('Have a marketer')} />
            <ObjectionPill label="My industry?" isOpen={openObjection === 'My industry?'} onToggle={() => toggle('My industry?')} />
            <ObjectionPill label="We're doing fine" isOpen={openObjection === "We're doing fine"} onToggle={() => toggle("We're doing fine")} />
            <ObjectionPill label="No budget right now" isOpen={openObjection === 'No budget right now'} onToggle={() => toggle('No budget right now')} />
          </div>
        </div>

        {/* Transition to Pitch */}
        <div className="px-5 py-4 border-b border-border bg-blue-50/50 dark:bg-blue-950/20">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Transition — Bridge to What We Do</div>
          <p className="text-sm text-foreground italic leading-relaxed">
            "Got it. So based on what you're telling me — [repeat their problem back]. That's exactly what we help with. We basically become your entire marketing department. Let me tell you a little about how we work."
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Been burned" isOpen={openObjection === 'Been burned'} onToggle={() => toggle('Been burned')} />
            <ObjectionPill label="What makes you different?" isOpen={openObjection === 'What makes you different?'} onToggle={() => toggle('What makes you different?')} />
            <ObjectionPill label="Do you outsource?" isOpen={openObjection === 'Do you outsource?'} onToggle={() => toggle('Do you outsource?')} />
          </div>
        </div>

        {/* The Pitch */}
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">The Pitch — Keep It Conversational</div>
          <div className="space-y-3 text-sm text-foreground italic leading-relaxed">
            <p>"We're a full marketing team, all in one office in LA. Not freelancers, not outsourced — one team under one roof. We handle everything: Google Ads, Meta, SEO, website, email, social media, AI automation, content — all of it."</p>
            <p>"You'd get a dedicated Slack channel so you can reach us anytime. We communicate daily. Plus a live dashboard so you can see everything in real-time. Full transparency."</p>
            <p>"And it's all month-to-month. No contracts, no lock-ins. If we don't deliver, you leave. We take on that risk."</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="What if no results" isOpen={openObjection === 'What if no results'} onToggle={() => toggle('What if no results')} />
            <ObjectionPill label="What makes you different?" isOpen={openObjection === 'What makes you different?'} onToggle={() => toggle('What makes you different?')} />
            <ObjectionPill label="Do you outsource?" isOpen={openObjection === 'Do you outsource?'} onToggle={() => toggle('Do you outsource?')} />
            <ObjectionPill label="My industry?" isOpen={openObjection === 'My industry?'} onToggle={() => toggle('My industry?')} />
          </div>
        </div>

        {/* Price Range */}
        <div className="px-5 py-4 border-b border-border bg-amber-50/50 dark:bg-amber-950/20">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">When They Ask About Price</div>
          <p className="text-sm text-foreground italic leading-relaxed mb-3">
            "Our plans start at $999 a month for single-channel and go up from there. That doesn't include ad spend — just our team, strategy, and management."
          </p>
          <div className="bg-card rounded-lg border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Starter</div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Google Ads Only</span><span className="font-bold text-primary">$999/mo</span></div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Meta Ads Only</span><span className="font-bold text-primary">$1,499/mo</span></div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Google + Meta</span><span className="font-bold text-primary">$2,499/mo</span></div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-2 mb-1">Full-Service</div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Advanced Silver</span><span className="font-bold text-primary">$4,299/mo</span></div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Premium Silver</span><span className="font-bold text-primary">$7,499/mo</span></div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Premium Gold</span><span className="font-bold text-primary">$9,499/mo</span></div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Premium Platinum</span><span className="font-bold text-primary">$14,999/mo</span></div>
            <div className="flex justify-between"><span className="font-semibold text-foreground">Enterprise</span><span className="font-bold text-primary">15% of ad spend</span></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Too expensive" isOpen={openObjection === 'Too expensive'} onToggle={() => toggle('Too expensive')} />
            <ObjectionPill label="Want discount" isOpen={openObjection === 'Want discount'} onToggle={() => toggle('Want discount')} />
            <ObjectionPill label="Plan differences" isOpen={openObjection === 'Plan differences'} onToggle={() => toggle('Plan differences')} />
            <ObjectionPill label="Locations extra?" isOpen={openObjection === 'Locations extra?'} onToggle={() => toggle('Locations extra?')} />
            <ObjectionPill label="Ad spend extra?" isOpen={openObjection === 'Ad spend extra?'} onToggle={() => toggle('Ad spend extra?')} />
            <ObjectionPill label="What's included?" isOpen={openObjection === "What's included?"} onToggle={() => toggle("What's included?")} />
            <ObjectionPill label="Cheaper option?" isOpen={openObjection === 'Cheaper option?'} onToggle={() => toggle('Cheaper option?')} />
          </div>
        </div>

        {/* Justify the Cost */}
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">If They Question the Price</div>
          <p className="text-sm text-foreground italic leading-relaxed">
            "I totally get it. But think about it — one in-house marketer is $5,000-7,000 a month in salary alone. With us, you get an entire team — ads, SEO, design, development, content, social, analytics, AI — for less than one hire. And again, it's month-to-month."
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Upgrade later?" isOpen={openObjection === 'Upgrade later?'} onToggle={() => toggle('Upgrade later?')} />
            <ObjectionPill label="Can I start small?" isOpen={openObjection === 'Can I start small?'} onToggle={() => toggle('Can I start small?')} />
            <ObjectionPill label="Why no contracts?" isOpen={openObjection === 'Why no contracts?'} onToggle={() => toggle('Why no contracts?')} />
          </div>
        </div>

        {/* The 3-Month Truth */}
        <div className="px-5 py-4 border-b border-border bg-blue-50/50 dark:bg-blue-950/20">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Build Trust — Be Honest</div>
          <p className="text-sm text-foreground italic leading-relaxed">
            "I'll be straight with you — if a client doesn't stick with us for at least 3 months, we actually lose money. Month one is all build and setup. That's why we don't chase or pressure anyone. We'd rather you be 100% sure. The results will speak for themselves."
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Need to think" isOpen={openObjection === 'Need to think'} onToggle={() => toggle('Need to think')} />
            <ObjectionPill label="Show results first" isOpen={openObjection === 'Show results first'} onToggle={() => toggle('Show results first')} />
            <ObjectionPill label="How long for results?" isOpen={openObjection === 'How long for results?'} onToggle={() => toggle('How long for results?')} />
            <ObjectionPill label="What's the catch?" isOpen={openObjection === "What's the catch?"} onToggle={() => toggle("What's the catch?")} />
          </div>
        </div>

        {/* Next Steps */}
        <div className="px-5 py-4 bg-green-50 dark:bg-green-950/20">
          <div className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-widest mb-2">Next Steps — No Pressure</div>
          <p className="text-sm text-green-800 dark:text-green-300 italic leading-relaxed font-medium">
            "Here's what I'd love to do — let me put together a custom marketing plan and proposal for your business. It's yours to keep whether you go with us or not. There's a ton of value in it. Then we'll hop on a quick Zoom so I can walk you through everything. What day works best for you?"
          </p>
          <div className="mt-3 bg-white dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 p-3">
            <div className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-1.5 uppercase">Remember:</div>
            <ul className="text-xs text-green-800 dark:text-green-300 space-y-1">
              <li>&bull; We never close on the first call — schedule the Zoom</li>
              <li>&bull; The custom marketing plan is the value-add (theirs to keep no matter what)</li>
              <li>&bull; No chasing, no pressure — let the plan sell itself</li>
              <li>&bull; If they're qualified, book the Zoom and send the proposal</li>
            </ul>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ObjectionPill label="Send me info" isOpen={openObjection === 'Send me info'} onToggle={() => toggle('Send me info')} />
            <ObjectionPill label="Talk to my partner" isOpen={openObjection === 'Talk to my partner'} onToggle={() => toggle('Talk to my partner')} />
            <ObjectionPill label="Call me back later" isOpen={openObjection === 'Call me back later'} onToggle={() => toggle('Call me back later')} />
            <ObjectionPill label="Not the right time" isOpen={openObjection === 'Not the right time'} onToggle={() => toggle('Not the right time')} />
          </div>
          <button
            onClick={() => setNextStepsOpen(!nextStepsOpen)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 hover:text-green-900 cursor-pointer"
          >
            {nextStepsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {nextStepsOpen ? 'Hide' : 'More'} ways to wrap up
          </button>
          {nextStepsOpen && (
            <div className="mt-3 space-y-3">
              {[
                { name: "If They're Excited", line: '"Awesome — let me get that Zoom booked. I\'ll have the full marketing plan ready. What day works for you this week?"' },
                { name: "If They're Hesitant", line: '"No worries at all. Let me build the plan anyway — it\'s free, it\'s yours. If nothing else, you\'ll have a solid roadmap. Sound good?"' },
                { name: 'If They Want to Think', line: '"Totally understand. I\'ll send over some info, and when you\'re ready, we can hop on a Zoom. No rush, no pressure."' },
                { name: "If They're Not a Fit", line: '"Honestly, it sounds like you might not need us right now — and that\'s fine. If things change, we\'re here. I wish you nothing but success."' },
              ].map(c => (
                <div key={c.name} className="bg-white dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 p-3">
                  <div className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-1">{c.name}</div>
                  <p className="text-sm text-green-800 dark:text-green-300 italic">{c.line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== ALL OBJECTIONS — QUICK ACCESS ===== */}
      <div className="bg-card border-2 border-red-100 dark:border-red-900/30 rounded-2xl overflow-hidden">
        <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">All Objections — Tap Any:</span>
          {openObjection !== null && (
            <button onClick={() => setOpenObjection(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="px-3 py-3 flex flex-wrap gap-1.5">
          {allLabels.map((label) => (
            <button
              key={label}
              onClick={() => toggle(label)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                openObjection === label
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {openObjection !== null && objections[openObjection] && (
          <div className="px-4 py-3 border-t border-border bg-card">
            <p className="text-sm text-foreground leading-relaxed">{objections[openObjection]}</p>
          </div>
        )}
      </div>

    </div>
  )
}

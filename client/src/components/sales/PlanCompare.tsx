import { useState } from 'react'
import { GitCompareArrows } from 'lucide-react'

const plans = [
  { key: 'google-only', name: 'Google Ads Only', price: '$999/mo', channels: 'Google Ads', turnaround: '5-7 Days' },
  { key: 'meta-only', name: 'Meta Ads Only', price: '$1,499/mo', channels: 'Meta Ads', turnaround: '5-7 Days' },
  { key: 'google-meta', name: 'Google + Meta', price: '$2,499/mo', channels: 'Google + Meta', turnaround: '4-5 Days' },
  { key: 'advanced-silver', name: 'Advanced Silver', price: '$4,299/mo', channels: '4 Channels', turnaround: '4-5 Days' },
  { key: 'premium-silver', name: 'Premium Silver', price: '$7,499/mo', channels: '5 Channels', turnaround: '3-4 Days' },
  { key: 'premium-gold', name: 'Premium Gold', price: '$9,499/mo', channels: 'Omni Channel', turnaround: '1-2 Days' },
  { key: 'premium-platinum', name: 'Premium Platinum', price: '$14,999/mo', channels: 'Omni Channel', turnaround: '1-2 Days' },
  { key: 'enterprise', name: 'Enterprise', price: '15% of ad spend', channels: 'Omni Channel', turnaround: 'Same Day' },
]

type PlanKey = typeof plans[number]['key']

type FeatureRow = {
  label: string
  category: string
  values: Record<PlanKey, string>
}

const features: FeatureRow[] = [
  // Plan Details
  { label: 'Monthly Ad Budget', category: 'Plan Details', values: { 'google-only': 'Under $2K', 'meta-only': 'Under $2K', 'google-meta': 'Under $5K', 'advanced-silver': 'Under $10K', 'premium-silver': 'Under $20K', 'premium-gold': 'Under $30K', 'premium-platinum': 'Under $75K', 'enterprise': '$75K+' } },
  { label: 'Channels', category: 'Plan Details', values: { 'google-only': 'Google Ads', 'meta-only': 'Meta Ads', 'google-meta': 'Google + Meta', 'advanced-silver': '4 Channels', 'premium-silver': '5 Channels', 'premium-gold': 'Omni Channel', 'premium-platinum': 'Omni Channel', 'enterprise': 'Omni Channel' } },
  { label: 'Task Turnaround', category: 'Plan Details', values: { 'google-only': '5-7 Days', 'meta-only': '5-7 Days', 'google-meta': '4-5 Days', 'advanced-silver': '4-5 Days', 'premium-silver': '3-4 Days', 'premium-gold': '1-2 Days', 'premium-platinum': '1-2 Days', 'enterprise': 'Same Day' } },
  { label: 'Franchise Locations', category: 'Plan Details', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '—', 'premium-gold': 'Up to 3', 'premium-platinum': 'Up to 15', 'enterprise': 'Unlimited' } },

  // Support & Meetings
  { label: 'Meetings', category: 'Support & Meetings', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '30-min monthly', 'advanced-silver': '30-min bi-weekly', 'premium-silver': '30-min weekly', 'premium-gold': '1-hour weekly', 'premium-platinum': '1.5-hour weekly', 'enterprise': '2-hour weekly' } },
  { label: 'Dedicated Slack Channel', category: 'Support & Meetings', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '✓', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Monthly Extra Task Hours', category: 'Support & Meetings', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '3 hours', 'premium-gold': '5 hours', 'premium-platinum': '5 hours', 'enterprise': '10 hours' } },

  // Ads & Optimization
  { label: 'Setup & Management', category: 'Ads & Optimization', values: { 'google-only': 'Basic', 'meta-only': 'Basic', 'google-meta': 'Basic', 'advanced-silver': 'Basic', 'premium-silver': 'Advanced', 'premium-gold': 'Advanced', 'premium-platinum': 'Advanced', 'enterprise': 'Advanced' } },
  { label: 'Optimization Frequency', category: 'Ads & Optimization', values: { 'google-only': 'Monthly', 'meta-only': 'Monthly', 'google-meta': 'Bi-Weekly', 'advanced-silver': 'Bi-Weekly', 'premium-silver': 'Weekly', 'premium-gold': 'Daily', 'premium-platinum': 'Daily', 'enterprise': 'Daily' } },
  { label: 'Ad Copy & Content', category: 'Ads & Optimization', values: { 'google-only': 'Basic', 'meta-only': 'Basic', 'google-meta': 'Basic', 'advanced-silver': 'Basic', 'premium-silver': 'Advanced', 'premium-gold': 'Advanced', 'premium-platinum': 'Advanced', 'enterprise': 'Advanced' } },
  { label: 'A/B Testing', category: 'Ads & Optimization', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },

  // SEO & Analytics
  { label: 'SEO/SEAO', category: 'SEO & Analytics', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': 'Basic', 'premium-silver': 'Advanced', 'premium-gold': 'Advanced', 'premium-platinum': 'Advanced', 'enterprise': 'Advanced' } },
  { label: 'Analytics & Conversions', category: 'SEO & Analytics', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Live Dashboard', category: 'SEO & Analytics', values: { 'google-only': '✓', 'meta-only': '✓', 'google-meta': '✓', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'On-Demand Reporting', category: 'SEO & Analytics', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Online Listing Placement', category: 'SEO & Analytics', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },

  // Website & Funnels
  { label: 'Website Updates', category: 'Website & Funnels', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': 'Basic', 'premium-silver': 'Advanced', 'premium-gold': 'Advanced', 'premium-platinum': 'Advanced', 'enterprise': 'Advanced' } },
  { label: 'Landing Pages & Funnels', category: 'Website & Funnels', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },

  // Outreach & Social
  { label: 'Email & SMS Campaigns', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Social Media Management', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '✓', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Reputation Management', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'UGC Content', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '2 pieces', 'premium-gold': '3 pieces', 'premium-platinum': '5 pieces', 'enterprise': '10 pieces' } },
  { label: 'Influencer Marketing', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '—', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Television Ads (TV)', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '—', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'In-Person Content', category: 'Outreach & Social', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '—', 'premium-gold': '—', 'premium-platinum': '✓', 'enterprise': '✓' } },

  // AI & Automation
  { label: 'Workflow Automation', category: 'AI & Automation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': 'Basic', 'premium-silver': 'Advanced', 'premium-gold': 'Full', 'premium-platinum': 'Full', 'enterprise': 'Full' } },
  { label: 'AI Chatbot', category: 'AI & Automation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'AI Voice Agent', category: 'AI & Automation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Automated CRM', category: 'AI & Automation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '—', 'premium-gold': 'Automated', 'premium-platinum': 'AI-Managed', 'enterprise': 'AI-Managed' } },
  { label: 'AI Tools on Demand', category: 'AI & Automation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '—', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },

  // Consultation
  { label: 'Sales & Marketing Consultation', category: 'Consultation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
  { label: 'Experience Consultation', category: 'Consultation', values: { 'google-only': '—', 'meta-only': '—', 'google-meta': '—', 'advanced-silver': '—', 'premium-silver': '✓', 'premium-gold': '✓', 'premium-platinum': '✓', 'enterprise': '✓' } },
]

function CellValue({ val }: { val: string }) {
  if (val === '✓') return <span className="text-green-600 font-bold">&#10003;</span>
  if (val === '—') return <span className="text-muted-foreground/40">—</span>
  return <span className="font-medium text-foreground">{val}</span>
}

function DiffIndicator({ valA, valB }: { valA: string; valB: string }) {
  if (valA === valB) return null
  if (valA === '—' && valB !== '—') return <span className="text-[10px] text-green-600 font-medium ml-1">+upgrade</span>
  if (valA !== '—' && valB === '—') return null
  return <span className="text-[10px] text-blue-600 font-medium ml-1">differs</span>
}

export default function PlanCompare() {
  const [planA, setPlanA] = useState<PlanKey>('advanced-silver')
  const [planB, setPlanB] = useState<PlanKey>('premium-silver')
  const [showDiffsOnly, setShowDiffsOnly] = useState(false)

  const planAData = plans.find(p => p.key === planA)!
  const planBData = plans.find(p => p.key === planB)!

  const filteredFeatures = showDiffsOnly
    ? features.filter(f => f.values[planA] !== f.values[planB])
    : features

  const filteredCategories = [...new Set(filteredFeatures.map(f => f.category))]

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <select
          value={planA}
          onChange={e => setPlanA(e.target.value as PlanKey)}
          className="flex-1 w-full px-4 py-2.5 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:border-primary cursor-pointer"
        >
          {plans.map(p => (
            <option key={p.key} value={p.key}>{p.name} — {p.price}</option>
          ))}
        </select>
        <GitCompareArrows className="w-5 h-5 text-muted-foreground shrink-0" />
        <select
          value={planB}
          onChange={e => setPlanB(e.target.value as PlanKey)}
          className="flex-1 w-full px-4 py-2.5 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:border-primary cursor-pointer"
        >
          {plans.map(p => (
            <option key={p.key} value={p.key}>{p.name} — {p.price}</option>
          ))}
        </select>
      </div>

      {/* Filter toggle */}
      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={showDiffsOnly}
          onChange={e => setShowDiffsOnly(e.target.checked)}
          className="rounded border-border"
        />
        Show differences only
      </label>

      {/* Header cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <div className="font-semibold text-foreground text-sm">{planAData.name}</div>
          <div className="text-xl font-bold text-primary">{planAData.price}</div>
          <div className="text-xs text-muted-foreground">{planAData.channels} &middot; {planAData.turnaround}</div>
        </div>
        <div className="bg-primary/5 rounded-xl p-4 border-2 border-primary text-center">
          <div className="font-semibold text-foreground text-sm">{planBData.name}</div>
          <div className="text-xl font-bold text-primary">{planBData.price}</div>
          <div className="text-xs text-muted-foreground">{planBData.channels} &middot; {planBData.turnaround}</div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="border border-border rounded-xl overflow-hidden">
        {filteredCategories.map(cat => {
          const catFeatures = filteredFeatures.filter(f => f.category === cat)
          if (catFeatures.length === 0) return null

          return (
            <div key={cat}>
              <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {cat}
              </div>
              {catFeatures.map(f => {
                const isDiff = f.values[planA] !== f.values[planB]
                return (
                  <div
                    key={f.label}
                    className={`grid grid-cols-[1.2fr_1fr_1fr] px-4 py-2.5 border-b border-border text-sm ${isDiff ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}
                  >
                    <div className="text-foreground text-xs">{f.label}</div>
                    <div className="text-center text-xs"><CellValue val={f.values[planA]} /></div>
                    <div className="text-center text-xs">
                      <CellValue val={f.values[planB]} />
                      <DiffIndicator valA={f.values[planA]} valB={f.values[planB]} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {showDiffsOnly && filteredFeatures.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">These plans are identical — select different plans to compare.</div>
      )}
    </div>
  )
}

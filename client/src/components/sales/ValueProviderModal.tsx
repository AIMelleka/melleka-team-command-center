import { useState, useRef } from 'react'
import { X, Send, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ValueProviderModal({ open, onClose }: Props) {
  const [industry, setIndustry] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  if (!open) return null

  const generate = async () => {
    if (!industry.trim() || loading) return
    setLoading(true)
    setResult('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE}/guide/value-provider`, {
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
        setResult(data.recommendation ?? '')
      }
    } catch {
      setResult('Connection error. Try again.')
    } finally {
      setLoading(false)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }

  const reset = () => {
    setIndustry('')
    setNotes('')
    setResult('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-purple-600 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-200" />
            <div>
              <div className="text-white font-semibold text-sm">Value Provider</div>
              <div className="text-purple-200 text-[10px]">Free consultation — give them value on the call</div>
            </div>
          </div>
          <button onClick={onClose} className="text-purple-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-2.5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Their Industry</label>
              <input
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') generate() }}
                placeholder="e.g. plumbing, dental, law firm, restaurant..."
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-purple-400 bg-background text-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Notes from the call <span className="font-normal normal-case">(optional)</span></label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') generate() }}
                placeholder="Goals, challenges, location, current marketing..."
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-purple-400 bg-background text-muted-foreground"
              />
            </div>
            <button
              onClick={generate}
              disabled={loading || !industry.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Send className="w-4 h-4" /> Get Value Pitch</>
              )}
            </button>
          </div>

          {result && (
            <div ref={resultRef} className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Read this to them:</div>
                <button onClick={reset} className="text-[10px] font-medium text-purple-400 hover:text-purple-600 cursor-pointer">New consultation</button>
              </div>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

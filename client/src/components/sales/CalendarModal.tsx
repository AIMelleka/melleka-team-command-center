import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface CalendarModalProps {
  open: boolean
  onClose: () => void
}

export default function CalendarModal({ open, onClose }: CalendarModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      const existingScript = document.querySelector('script[src="https://link.msgsndr.com/js/form_embed.js"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://link.msgsndr.com/js/form_embed.js'
        script.type = 'text/javascript'
        document.body.appendChild(script)
      }
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-lg">Book a Call</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ height: '70vh' }}>
          <iframe
            src="https://api.leadconnectorhq.com/widget/booking/m0S02xzNYZaI6o9XkbgY"
            style={{ width: '100%', height: '100%', border: 'none' }}
            scrolling="no"
            id="m0S02xzNYZaI6o9XkbgY_calendar"
          />
        </div>
      </div>
    </div>
  )
}

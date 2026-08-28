import { useEffect, useRef, useState } from 'react'
import { X, Search, Building2 } from 'lucide-react'

interface Client {
  company: string
  contact: string
  note: string
}

interface Industry {
  name: string
  clients: Client[]
}

const industries: Industry[] = [
  {
    name: 'Medical / Health',
    clients: [
      { company: 'St. Joseph', contact: 'Gayana Mkhitaryan', note: 'Medical / Health' },
      { company: 'Mobile Wound Care', contact: 'Walif Farooqi', note: 'Medical / Health' },
      { company: 'Concord Hair', contact: 'Ben Mousavi', note: 'Hair Transplant' },
      { company: 'Maximum Wellness', contact: 'Max Paul', note: 'Chiropractor' },
      { company: 'Strike PT', contact: 'Levan Akopov', note: 'Physical Therapy' },
      { company: 'Purpose Recovery', contact: 'Mark R Rizkallah', note: 'Rehab' },
      { company: 'John VIP', contact: 'John A Villanueva MD', note: 'Pain Doctor' },
      { company: 'Therapist', contact: 'Selena Matthews', note: 'Therapist' },
      { company: 'WBMF', contact: 'Babak Kateb', note: 'Non-Profit / Health Events' },
    ],
  },
  {
    name: 'Medical Supplies',
    clients: [
      { company: 'Sin City', contact: 'Daniel Quaranto', note: 'Medical Supplies' },
      { company: 'Test Strip Buyers', contact: 'MidWest', note: 'Medical Supplies' },
    ],
  },
  {
    name: 'Construction',
    clients: [
      { company: 'Nash DW', contact: 'Hormoz Najarian', note: 'Doors & Windows' },
      { company: 'Premium Legacy Roofing', contact: 'Premium Legacy', note: 'Roofing' },
      { company: 'JAC Roofing', contact: 'Frank J Kogan', note: 'Roofing' },
      { company: 'Bathtub Refinishers', contact: 'Serge Garcia', note: 'Bathtub Remodel' },
      { company: 'Haul Away', contact: 'Jose Arreaga', note: 'Hauling' },
      { company: 'ANB Tree', contact: 'Brian Ordelheide', note: 'Tree Trimming' },
      { company: 'Door Doctor', contact: 'Shai Hadar', note: 'Door Repair' },
      { company: 'The Sewer Bros', contact: 'Pedro P Pusse', note: 'Plumbing' },
      { company: 'AB Plumbing', contact: 'AB Companies', note: 'Plumbing' },
      { company: 'AB Contracting', contact: 'AB Companies', note: 'General Contractor' },
      { company: 'Lioness Tile', contact: 'Manpreet Singh', note: 'Tiles' },
      { company: 'Ava Homes Inc', contact: 'Ava Homes', note: 'Home Builder' },
      { company: 'AB Sign Works', contact: 'AB Companies', note: 'Signs / B2B' },
      { company: 'AB Traffic Solutions', contact: 'AB Companies', note: 'Traffic Solutions' },
    ],
  },
  {
    name: 'Security',
    clients: [
      { company: 'Trusted Guard', contact: 'Trusted Guard Services', note: 'Security' },
      { company: 'Pro Security Guard', contact: 'Door Nomair', note: 'Security' },
      { company: 'Tajala Aziz Security', contact: 'Tajala Aziz', note: 'Security' },
    ],
  },
  {
    name: 'Spa / Beauty',
    clients: [
      { company: 'Awaken + Le Reve', contact: 'Andrew Francis', note: 'Spa / Beauty' },
      { company: 'Bel Air CS', contact: 'Armen Kagramanian', note: 'Beauty / Spa' },
      { company: 'On The Glow', contact: 'Laurel Wiig', note: 'Spa / Beauty' },
      { company: 'Chats HN', contact: 'Keyani McNeil', note: 'Spa / Beauty' },
      { company: 'Vegamour', contact: 'Vegamour', note: 'DTC Beauty Brand (Enterprise)' },
    ],
  },
  {
    name: 'Insurance',
    clients: [
      { company: 'GGIS', contact: 'Wassem Alkhaldi', note: 'Insurance' },
      { company: 'Compass Health Insurance', contact: 'Brett Henry', note: 'Health Insurance' },
      { company: 'Insureserv', contact: 'Insuraserv', note: 'Insurance' },
      { company: 'Mitra Insurance', contact: 'Satyajeet Mitra', note: 'Insurance' },
      { company: 'Coto Insurance', contact: 'Victoria Gunvalson', note: 'Insurance' },
    ],
  },
  {
    name: 'Non-Profit',
    clients: [
      { company: 'Partners in Promise', contact: 'Michelle Norman', note: 'Military' },
      { company: 'The Rosie Network', contact: 'The Rosie Network', note: 'Military' },
      { company: 'SD Parks Foundation', contact: 'Leona Sublett', note: 'Government' },
      { company: 'Heaven Works', contact: 'Michael Harriton', note: 'Religion' },
      { company: 'The Deep Blue', contact: 'Iram Parvez', note: 'Non-Profit' },
    ],
  },
  {
    name: 'Real Estate',
    clients: [
      { company: 'Realtor', contact: 'Danielle N Hardcastle', note: 'Realtor' },
      { company: 'Paul Real Estate', contact: 'Paul Argueta', note: 'Realtor / Brokerage' },
      { company: 'BDOHAV', contact: 'Adam M Leach', note: 'Realtor / Brokerage' },
      { company: 'GoldStar', contact: 'GoldStar', note: 'Brokerage / Real Estate' },
    ],
  },
  {
    name: 'SaaS / Tech',
    clients: [
      { company: 'Messari', contact: 'Maria Victoria Amorelli', note: 'Stocks & Crypto SaaS' },
      { company: 'Elite Picks', contact: 'Michael Zakkour', note: 'Sports Betting App' },
      { company: 'Teledial', contact: 'Teledial', note: 'Cold Calling Platform' },
    ],
  },
  {
    name: 'Virtual Assistant',
    clients: [
      { company: 'Dream Wealth', contact: 'Colin St Pierre', note: 'Virtual Assistant' },
      { company: 'Spartan Approach', contact: 'Cory Lloyd', note: 'Virtual Assistant' },
      { company: 'Unleash VA', contact: 'Unleash VA', note: 'Virtual Assistant' },
      { company: 'Global Staffing Partners', contact: 'Fernando Serrano', note: 'Staffing' },
    ],
  },
  {
    name: 'Entertainment / Events',
    clients: [
      { company: 'The Alex', contact: 'Miles Williams', note: 'Theatre / Events' },
      { company: 'Blair SC', contact: 'Donald I Tannenbaum', note: 'Events' },
      { company: 'H Duncan Arts', contact: 'Allen H Duncan', note: 'Arts & Entertainment' },
      { company: 'Shay Book', contact: 'Shay Morad', note: 'Book & Entertainment' },
      { company: 'X17', contact: 'Francois Navarre', note: 'YouTube / Entertainment' },
      { company: 'Psychic Garden', contact: 'George Adams', note: 'Entertainment' },
      { company: 'LAPP', contact: 'David Miller', note: 'Photo Company / Photo Booth' },
    ],
  },
  {
    name: 'Legal',
    clients: [
      { company: 'Lawyer', contact: 'Shant Goorjian', note: 'Attorney' },
      { company: 'Tim Wright Law', contact: 'Tim Wright Law', note: 'Attorney' },
    ],
  },
  {
    name: 'Telecom',
    clients: [
      { company: 'Fiber Sales', contact: 'James Bruckner', note: 'Telecommunications' },
      { company: 'Prime Tech', contact: 'Umar Jalil Malik', note: 'Telecommunications' },
    ],
  },
  {
    name: 'Gambling / Gaming Apps',
    clients: [
      { company: 'NG Slots', contact: 'Ng Slot', note: 'Gambling App' },
      { company: 'Raja Slots', contact: 'Raja Slots', note: 'Gambling App' },
    ],
  },
  {
    name: 'Food & Beverage',
    clients: [
      { company: "Coco's Lip Smacking", contact: 'Nicole Green', note: 'Brick & Mortar' },
    ],
  },
  {
    name: 'Rental & Auto',
    clients: [
      { company: 'Go Rentals', contact: 'Fady Soliman', note: 'Car Rentals (Enterprise)' },
      { company: 'Motorcycle 1', contact: 'Darin McManaway', note: 'Rentals / Entertainment' },
    ],
  },
  {
    name: 'Solar',
    clients: [
      { company: 'Sunuso', contact: 'Zepyor Parseghian', note: 'Solar Energy' },
    ],
  },
  {
    name: 'Home / Furniture',
    clients: [
      { company: 'Mattress By Apt', contact: 'Sepehr Tourani', note: 'Home / Furniture' },
    ],
  },
  {
    name: 'Jewelry',
    clients: [
      { company: 'Pandora Diamond', contact: 'Jason Bral', note: 'Jewelry' },
    ],
  },
  {
    name: 'Marketing Agency',
    clients: [
      { company: 'The AIM Agency', contact: 'Jeff Symon', note: 'White Label Marketing' },
    ],
  },
  {
    name: 'Education / Tutoring',
    clients: [
      { company: 'TeacherTainment', contact: 'Jake Perlman', note: 'Tutoring / Teaching' },
      { company: 'Dave Music', contact: 'Dave Music', note: 'Music / Tutoring' },
    ],
  },
  {
    name: 'Lending & Finance',
    clients: [
      { company: 'Bay Street Lending', contact: 'Bay Street Lending', note: 'Lending & Financing' },
    ],
  },
  {
    name: 'Enterprise / Government',
    clients: [
      { company: 'TMI', contact: 'AP', note: 'Government (Enterprise)' },
    ],
  },
  {
    name: 'Adult',
    clients: [
      { company: 'Byborg AI', contact: 'Renata Longera', note: 'Adult Content AI (Enterprise)' },
      { company: 'Sensual Extensions', contact: 'Sensual Extensions', note: 'Adult Store' },
    ],
  },
]

const totalClients = industries.reduce((acc, ind) => acc + ind.clients.length, 0)

interface IndustriesModalProps {
  open: boolean
  onClose: () => void
}

export default function IndustriesModal({ open, onClose }: IndustriesModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setSearch('')
      setActiveIndustry(null)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const q = search.toLowerCase().trim()

  const filtered = industries
    .map((ind) => {
      const industryMatch = ind.name.toLowerCase().includes(q)
      const matchedClients = ind.clients.filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.contact.toLowerCase().includes(q) ||
          c.note.toLowerCase().includes(q) ||
          industryMatch
      )
      return { ...ind, clients: matchedClients }
    })
    .filter((ind) => ind.clients.length > 0)
    .filter((ind) => !activeIndustry || ind.name === activeIndustry)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-background rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground text-lg">Industries We've Served</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              {totalClients} clients &middot; {industries.length} industries
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveIndustry(null) }}
              placeholder="Search by industry, company, or contact..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary bg-background text-foreground"
              autoFocus
            />
          </div>
        </div>

        {/* Industry filter pills */}
        {!search && (
          <div className="px-6 py-2.5 flex gap-1.5 flex-wrap border-b border-border shrink-0">
            <button
              onClick={() => setActiveIndustry(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                !activeIndustry
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              All
            </button>
            {industries.map((ind) => (
              <button
                key={ind.name}
                onClick={() => setActiveIndustry(activeIndustry === ind.name ? null : ind.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeIndustry === ind.name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {ind.name}
                <span className="ml-1 opacity-60">{ind.clients.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Client list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">No results for "{search}"</p>
          )}
          {filtered.map((ind) => (
            <div key={ind.name}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                {ind.name}
                <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/40">
                  {ind.clients.length} {ind.clients.length === 1 ? 'client' : 'clients'}
                </span>
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {ind.clients.map((client) => (
                  <div
                    key={`${client.company}-${client.contact}`}
                    className="flex items-start gap-3 bg-muted/30 rounded-lg px-3.5 py-3 border border-border"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary font-bold text-xs">
                        {client.company.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground leading-tight truncate">
                        {client.company}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{client.contact}</div>
                      <div className="text-[11px] text-primary/80 font-medium mt-0.5">{client.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

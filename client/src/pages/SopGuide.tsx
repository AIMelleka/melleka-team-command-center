import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, X, MessageCircle, Send, Loader2,
  CheckSquare, Square, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AdminHeader from '@/components/AdminHeader';
import { supabase } from '@/integrations/supabase/client';
import { SOP_TABS, getSopSearchIndex, type Block, type SopSubsection, type SopTab } from '@/data/sopData';

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Block renderers ──────────────────────────────────────────────────────────

function PolicyBadge({ text }: { text: string }) {
  return (
    <div className="border border-primary/40 bg-primary/5 rounded-xl p-4 my-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 bg-primary/10 rounded-full">
          Current Company Policy
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function FutureBadge({ text }: { text: string }) {
  return (
    <div className="border border-muted bg-muted/30 rounded-xl p-4 my-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
          Recommended Future-State
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function WarningBadge({ text }: { text: string }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-4 my-3">
      <p className="text-sm font-semibold text-destructive leading-relaxed">{text}</p>
    </div>
  );
}

function NoteBadge({ text }: { text: string }) {
  return (
    <div className="border border-border bg-muted/20 rounded-xl p-4 my-3">
      <p className="text-sm text-muted-foreground leading-relaxed italic">{text}</p>
    </div>
  );
}

function InteractiveChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  return (
    <ul className="space-y-2 my-3">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 cursor-pointer group"
          onClick={() => toggle(i)}
        >
          {checked.has(i)
            ? <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
          }
          <span className={`text-sm leading-relaxed ${checked.has(i) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SopTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  // Template tables (all empty cells) are just shown as a minimal list
  const isTemplate = rows.every((r) => r.slice(1).every((c) => c === ''));

  if (isTemplate) {
    return (
      <ul className="my-3 space-y-1 border border-border rounded-lg p-4 bg-muted/10">
        {rows.map((row, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{row[0]}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2.5 text-sm leading-relaxed align-top ${ci === 0 ? 'font-medium text-foreground whitespace-nowrap' : 'text-muted-foreground'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-sm text-muted-foreground leading-relaxed my-2">{block.text}</p>;
    case 'policy':
      return <PolicyBadge text={block.text} />;
    case 'future':
      return <FutureBadge text={block.text} />;
    case 'warning':
      return <WarningBadge text={block.text} />;
    case 'note':
      return <NoteBadge text={block.text} />;
    case 'h3':
      return <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">{block.text}</h3>;
    case 'checklist':
      return <InteractiveChecklist items={block.items} />;
    case 'numbered':
      return (
        <ol className="space-y-2 my-3 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-semibold shrink-0 w-5 text-right text-sm">{i + 1}.</span>
              <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'bullets':
      return (
        <ul className="space-y-2 my-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-primary shrink-0 mt-1.5 h-1 w-1 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'table':
      return <SopTable headers={block.headers} rows={block.rows} />;
    default:
      return null;
  }
}

// ── Collapsible Subsection ────────────────────────────────────────────────────

function SubsectionCard({ sub, defaultOpen }: { sub: SopSubsection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl mb-3 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/10 transition-colors min-h-[44px]"
      >
        <span className="font-semibold text-sm text-foreground">{sub.title}</span>
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border/50">
          {sub.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Search Results ────────────────────────────────────────────────────────────

interface SearchHit {
  tabId: string;
  subsectionId: string;
  tabLabel: string;
  subsectionTitle: string;
}

function useSearch(query: string) {
  const index = useRef(getSopSearchIndex());
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return index.current
    .filter((item) => item.text.toLowerCase().includes(q))
    .slice(0, 12) as SearchHit[];
}

// ── AI Chat Panel ─────────────────────────────────────────────────────────────

interface ChatMsg { role: 'user' | 'assistant'; content: string }

function SopChatPanel({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const newHistory = [...history, { role: 'user' as const, content: q }];
    setHistory(newHistory);
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/guide/sop-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: q, history: history.slice(-6) }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setHistory([...newHistory, { role: 'assistant', content: data.answer ?? 'No answer returned.' }]);
    } catch {
      setHistory([...newHistory, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="fixed bottom-0 right-0 left-0 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[420px] z-50 flex flex-col bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
      style={{ maxHeight: '70vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Ask the SOP</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">AI</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {history.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <div className="text-3xl">📋</div>
            <p className="text-sm text-muted-foreground">Ask any question about Melleka Marketing policies, procedures, or roles.</p>
            <div className="space-y-2">
              {[
                'Who can approve discounts?',
                'What is the client one-hour SLA?',
                'What are the QA steps for Google Ads?',
                'How do I handle a cancellation?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 px-3 py-2 rounded-lg border border-border transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about any SOP policy or procedure..."
            rows={1}
            className="resize-none text-sm min-h-[44px] flex-1"
          />
          <Button
            onClick={send}
            disabled={!input.trim() || loading}
            size="icon"
            className="shrink-0 h-11 w-11"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Answers are AI-generated based on the Melleka SOP document.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SopGuide = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(SOP_TABS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const activeTabData: SopTab | undefined = SOP_TABS.find((t) => t.id === activeTab);
  const searchResults = useSearch(searchQuery);

  const goToSection = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setSearchQuery('');
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
      <AdminHeader />

      {/* Top bar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="min-h-[44px]">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="font-semibold text-sm">Master Operating Manual & SOP</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">v1.0 — Aug 13, 2026</span>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border shrink-0 bg-background">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search policies, procedures, roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* Search results dropdown */}
        {searchQuery.trim() && (
          <div className="absolute z-20 mt-1 w-full max-w-lg bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-3">No results found.</p>
            ) : (
              <ul>
                {searchResults.map((hit, i) => (
                  <li key={i}>
                    <button
                      onClick={() => goToSection(hit.tabId)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 min-h-[44px]"
                    >
                      <p className="text-sm font-medium text-foreground">{hit.subsectionTitle}</p>
                      <p className="text-xs text-muted-foreground">{hit.tabLabel}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border overflow-x-auto shrink-0">
        <div className="flex min-w-max px-4">
          {SOP_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
              className={`px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap min-h-[44px] border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {activeTabData && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <span className="text-3xl">{activeTabData.icon}</span>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{activeTabData.label}</h1>
                  <p className="text-sm text-muted-foreground">{activeTabData.subsections.length} section{activeTabData.subsections.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div>
                {activeTabData.subsections.map((sub, i) => (
                  <SubsectionCard key={sub.id} sub={sub} defaultOpen={i === 0} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Floating AI chat button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:opacity-90 transition-all min-h-[44px] font-medium text-sm"
        >
          <MessageCircle className="h-4 w-4" />
          Ask SOP AI
        </button>
      )}

      {/* AI Chat Panel */}
      {chatOpen && <SopChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  );
};

export default SopGuide;

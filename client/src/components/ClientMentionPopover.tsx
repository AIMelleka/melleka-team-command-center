import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface ManagedClient {
  client_name: string;
  domain: string | null;
  tier: string | null;
  industry: string | null;
}

interface ClientMentionPopoverProps {
  visible: boolean;
  query: string;
  onSelect: (clientName: string) => void;
  onClose: () => void;
  /** Position from bottom of viewport (above textarea) */
  anchorRect?: { bottom: number; left: number };
}

export function ClientMentionPopover({ visible, query, onSelect, onClose, anchorRect }: ClientMentionPopoverProps) {
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [filtered, setFiltered] = useState<ManagedClient[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Load clients once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('managed_clients')
        .select('client_name, domain, tier, industry')
        .eq('is_active', true)
        .order('client_name');
      if (data) setClients(data as ManagedClient[]);
    })();
  }, []);

  // Filter by query
  useEffect(() => {
    if (!query) {
      setFiltered(clients);
    } else {
      const q = query.toLowerCase();
      setFiltered(clients.filter(c =>
        c.client_name.toLowerCase().includes(q) ||
        (c.domain && c.domain.toLowerCase().includes(q))
      ));
    }
    setSelectedIndex(0);
  }, [query, clients]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].client_name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [visible, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  const tierColor: Record<string, string> = {
    premium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    advanced: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    basic: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  };

  return (
    <div
      className="absolute z-50 w-80 max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
      style={{
        bottom: anchorRect ? `calc(100% + 8px)` : undefined,
        left: anchorRect?.left ?? 16,
      }}
      ref={listRef}
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs text-muted-foreground font-medium">Mention a client</p>
      </div>
      {filtered.map((client, i) => (
        <button
          key={client.client_name}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            onSelect(client.client_name);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{client.client_name}</p>
            {client.domain && (
              <p className="text-xs text-muted-foreground truncate">{client.domain}</p>
            )}
          </div>
          {client.tier && (
            <Badge variant="outline" className={`text-[10px] shrink-0 ${tierColor[client.tier] || ''}`}>
              {client.tier}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}

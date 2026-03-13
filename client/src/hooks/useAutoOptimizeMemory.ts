import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MemoryEntry {
  id: string;
  clientName: string;
  memoryType: string;
  content: string;
  source: string;
  context: Record<string, unknown>;
  createdAt: string;
}

export function useAutoOptimizeMemory() {
  const [memories, setMemories] = useState<Map<string, MemoryEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('client_ai_memory')
        .select('id, client_name, memory_type, content, source, context, created_at')
        .in('memory_type', ['change_outcome', 'strategist_learning', 'win', 'concern'])
        .order('created_at', { ascending: false })
        .limit(200);

      const map = new Map<string, MemoryEntry[]>();
      for (const row of data || []) {
        const entry: MemoryEntry = {
          id: row.id,
          clientName: row.client_name,
          memoryType: row.memory_type,
          content: row.content,
          source: row.source || '',
          context: (row.context as Record<string, unknown>) || {},
          createdAt: row.created_at,
        };
        const existing = map.get(row.client_name) || [];
        existing.push(entry);
        map.set(row.client_name, existing);
      }
      setMemories(map);
    } catch (err) {
      console.error('[useAutoOptimizeMemory] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { memories, isLoadingMemories: isLoading };
}

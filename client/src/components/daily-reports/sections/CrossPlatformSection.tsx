import { Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { CrossPlatformSynergy } from '@/types/dailyReports';

interface Props {
  synergies: CrossPlatformSynergy[];
}

export function CrossPlatformSection({ synergies }: Props) {
  if (!synergies || synergies.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Cross-Platform Synergies" icon={<Layers className="h-4 w-4" />} />
      <div className="space-y-3">
        {synergies.map((s, i) => (
          <div key={i} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
            <p className="text-sm font-medium text-foreground mb-2">{s.opportunity}</p>
            <div className="flex items-center gap-2 mb-2">
              {s.platforms?.map((p, pi) => (
                <Badge key={pi} variant="secondary" className="text-[10px]">{p}</Badge>
              ))}
            </div>
            {s.action && (
              <p className="text-xs text-muted-foreground">
                Action: {s.action}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

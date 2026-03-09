import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { CompetitorInsight } from '@/types/dailyReports';

interface Props {
  competitorInsights: CompetitorInsight[];
}

export function CompetitorSection({ competitorInsights }: Props) {
  if (!competitorInsights || competitorInsights.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Competitor Intelligence" icon={<Users className="h-4 w-4" />} />
      <div className="space-y-3">
        {competitorInsights.map((c, i) => (
          <div key={i} className="rounded-lg border p-4 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-foreground">{c.competitor}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{c.insight}</p>
            {c.opportunity && (
              <p className="text-sm text-foreground mb-2">
                Opportunity: {c.opportunity}
              </p>
            )}
            {c.keywords && c.keywords.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Keywords:</span>
                {c.keywords.map((kw, ki) => (
                  <Badge key={ki} variant="outline" className="text-[10px]">{kw}</Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

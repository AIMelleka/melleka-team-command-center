import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { Recommendation } from '@/types/dailyReports';

interface Props {
  recommendations: Recommendation[];
  actionItems?: any[];
}

const priorityConfig: Record<string, { color: string; bgColor: string }> = {
  high: { color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/30' },
  medium: { color: 'text-amber-500', bgColor: 'bg-amber-500/10 border-amber-500/30' },
  low: { color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/30' },
};

const effortConfig: Record<string, string> = {
  'quick-win': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  strategic: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
};

export function RecommendationsSection({ recommendations, actionItems }: Props) {
  // Merge recommendations and action items
  const allRecs: Recommendation[] = [...(recommendations || [])];

  // Convert action items to recommendation format if they exist
  if (actionItems && actionItems.length > 0) {
    for (const item of actionItems) {
      if (typeof item === 'string') {
        allRecs.push({ priority: 'medium', action: item, expectedImpact: '', platform: '' });
      } else if (item.action) {
        allRecs.push({
          priority: item.priority || 'medium',
          action: item.action,
          expectedImpact: item.expectedImpact || item.expected_impact || '',
          platform: item.platform || '',
          effort: item.effort,
          timeline: item.timeline,
        });
      }
    }
  }

  if (allRecs.length === 0) return null;

  // Group by priority
  const groups: Record<string, Recommendation[]> = { high: [], medium: [], low: [] };
  for (const rec of allRecs) {
    const key = rec.priority || 'medium';
    if (!groups[key]) groups[key] = [];
    groups[key].push(rec);
  }

  return (
    <div>
      <SectionHeader title="Recommendations and Action Items" icon={<ClipboardList className="h-4 w-4" />} />
      <div className="space-y-4">
        {(['high', 'medium', 'low'] as const).map(priority => {
          const recs = groups[priority];
          if (!recs || recs.length === 0) return null;
          const cfg = priorityConfig[priority] || priorityConfig.medium;

          return (
            <div key={priority}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-[10px] uppercase ${cfg.bgColor}`}>
                  {priority} Priority
                </Badge>
                <span className="text-xs text-muted-foreground">{recs.length} item{recs.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {recs.map((rec, i) => (
                  <div key={i} className="rounded-lg border p-4 bg-card">
                    <p className="text-sm font-medium text-foreground mb-1">{rec.action}</p>
                    {rec.expectedImpact && (
                      <p className="text-xs text-muted-foreground mb-2">Expected: {rec.expectedImpact}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {rec.platform && (
                        <Badge variant="secondary" className="text-[10px]">{rec.platform}</Badge>
                      )}
                      {rec.effort && (
                        <Badge variant="outline" className={`text-[10px] ${effortConfig[rec.effort] || ''}`}>
                          {rec.effort === 'quick-win' ? 'Quick Win' : rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)}
                        </Badge>
                      )}
                      {rec.timeline && (
                        <Badge variant="outline" className="text-[10px]">{rec.timeline}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

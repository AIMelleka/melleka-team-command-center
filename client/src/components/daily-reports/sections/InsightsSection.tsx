import { Lightbulb, CheckCircle, AlertTriangle, Zap, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { Insight } from '@/types/dailyReports';

interface Props {
  insights: Insight[];
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; borderColor: string }> = {
  positive: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-emerald-500',
    borderColor: 'border-l-emerald-500',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-amber-500',
    borderColor: 'border-l-amber-500',
  },
  action: {
    icon: <Zap className="h-4 w-4" />,
    color: 'text-red-500',
    borderColor: 'border-l-red-500',
  },
  opportunity: {
    icon: <Target className="h-4 w-4" />,
    color: 'text-blue-500',
    borderColor: 'border-l-blue-500',
  },
};

const impactColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500 border-red-500/30',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

export function InsightsSection({ insights }: Props) {
  if (!insights || insights.length === 0) return null;

  // Sort by impact: high first
  const sorted = [...insights].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.impact || 'low'] || 2) - (order[b.impact || 'low'] || 2);
  });

  return (
    <div>
      <SectionHeader title="AI Insights" icon={<Lightbulb className="h-4 w-4" />} />
      <div className="space-y-3">
        {sorted.map((ins, i) => {
          // Handle string-only insights (older format)
          if (typeof ins === 'string') {
            return (
              <div key={i} className="rounded-lg border border-l-4 border-l-blue-500 p-4">
                <p className="text-sm text-foreground">{ins}</p>
              </div>
            );
          }

          const cfg = typeConfig[ins.type] || typeConfig.opportunity;
          return (
            <div key={i} className={`rounded-lg border border-l-4 ${cfg.borderColor} p-4`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">{ins.title}</span>
                    {ins.impact && (
                      <Badge variant="outline" className={`text-[10px] ${impactColors[ins.impact] || impactColors.low}`}>
                        {ins.impact.charAt(0).toUpperCase() + ins.impact.slice(1)} Impact
                      </Badge>
                    )}
                  </div>
                  {ins.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{ins.description}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

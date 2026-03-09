import { Sparkles, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { KeyMetrics } from '@/types/dailyReports';

interface Props {
  keyMetrics: KeyMetrics | null;
}

export function CreativeAnalysisSection({ keyMetrics }: Props) {
  const headlines = keyMetrics?.headlineEffectiveness;
  if (!headlines || headlines.length === 0) return null;

  const verdictConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
    strong: {
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-emerald-500',
      bgColor: 'border-emerald-500/20 bg-emerald-500/5',
      label: 'Strong',
    },
    average: {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-amber-500',
      bgColor: 'border-amber-500/20 bg-amber-500/5',
      label: 'Average',
    },
    needs_rewrite: {
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-500',
      bgColor: 'border-red-500/20 bg-red-500/5',
      label: 'Needs Rewrite',
    },
  };

  return (
    <div>
      <SectionHeader title="Creative / Headline Effectiveness" icon={<Sparkles className="h-4 w-4" />} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {headlines.map((h, i) => {
          const cfg = verdictConfig[h.verdict] || verdictConfig.average;
          return (
            <div key={i} className={`rounded-lg border p-4 ${cfg.bgColor}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={cfg.color}>{cfg.icon}</span>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.color}`}>
                  {cfg.label}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground leading-snug mb-2">"{h.headline}"</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">CTR:</span>
                <span className={`text-sm font-bold ${cfg.color}`}>{(h.ctr ?? 0).toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

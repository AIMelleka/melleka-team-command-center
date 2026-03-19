import { Activity } from 'lucide-react';
import { SectionHeader } from '../shared';
import { ScoreRing } from '../ScoreRing';
import type { ReportScore } from '../scoring';
import { tierColors, type HealthTier } from '../scoring';

interface Props {
  scoreData: ReportScore;
  summary: string | null;
}

const signalLabels: Record<string, string> = {
  platformHealth: 'Platform Health',
  cplCpaHealth: 'CPL / CPA Health',
  insightSentiment: 'Insight Sentiment',
  recommendationLoad: 'Recommendation Load',
};

const signalWeights: Record<string, string> = {
  platformHealth: '35%',
  cplCpaHealth: '25%',
  insightSentiment: '20%',
  recommendationLoad: '20%',
};

function barColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-blue-500';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

const tierLabels: Record<HealthTier, string> = {
  excellent: 'Excellent — performing above expectations',
  good: 'Good — solid performance with minor opportunities',
  warning: 'Needs Attention — action items should be addressed',
  critical: 'Critical — immediate intervention recommended',
};

export function ScoreCardSection({ scoreData, summary }: Props) {
  const { score, tier, signals } = scoreData;

  return (
    <div>
      <SectionHeader title="Performance Score" icon={<Activity className="h-4 w-4" />} />

      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Large score ring */}
          <ScoreRing score={score} size={96} strokeWidth={6} />

          <div className="flex-1 space-y-4 w-full">
            {/* Tier label */}
            <p className="text-sm font-medium" style={{ color: tierColors[tier] }}>
              {tierLabels[tier]}
            </p>

            {/* Summary */}
            {summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
            )}

            {/* Signal breakdown bars */}
            <div className="space-y-2.5">
              {(Object.entries(signals) as [string, number][]).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{signalLabels[key]}</span>
                    <span className="text-xs font-medium text-foreground">
                      {value >= 0 ? value : 'N/A'}
                      <span className="text-muted-foreground ml-1">({signalWeights[key]})</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    {value >= 0 && (
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(value)}`}
                        style={{ width: `${value}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

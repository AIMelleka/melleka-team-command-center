import { Target, CheckCircle, XCircle } from 'lucide-react';
import { SectionHeader } from '../shared';
import type { BenchmarkAnalysis } from '@/types/dailyReports';

interface Props {
  benchmarkAnalysis: BenchmarkAnalysis | null;
}

export function BenchmarkComparisonSection({ benchmarkAnalysis }: Props) {
  if (!benchmarkAnalysis) return null;
  const { summary, strengths, weaknesses } = benchmarkAnalysis;
  if (!summary && (!strengths || strengths.length === 0) && (!weaknesses || weaknesses.length === 0)) return null;

  return (
    <div>
      <SectionHeader title="Industry Benchmark Comparison" icon={<Target className="h-4 w-4" />} />

      {/* Summary */}
      {summary && (
        <div className="rounded-lg bg-muted/30 border border-border/50 p-4 mb-4">
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        </div>
      )}

      {/* Strengths + Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {strengths && strengths.length > 0 && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Strengths</span>
            </div>
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {weaknesses && weaknesses.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">Weaknesses</span>
            </div>
            <ul className="space-y-2">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 shrink-0">-</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

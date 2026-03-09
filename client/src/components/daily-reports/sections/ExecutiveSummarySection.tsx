import { DollarSign, Target, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClientDailyReport } from '@/types/dailyReports';
import { computeGrade, getReportHealth, parseCurrency, fmtCurrency, fmtNumber } from '../shared';

interface Props {
  report: ClientDailyReport;
}

export function ExecutiveSummarySection({ report }: Props) {
  const health = getReportHealth(report.cplCpaAnalysis, report.platforms);
  const grade = computeGrade(health);

  // Aggregate KPIs from platforms
  let totalSpend = 0, totalConv = 0, totalLeads = 0;
  for (const p of report.platforms) {
    totalSpend += parseCurrency(p.spend);
    totalConv += parseCurrency(p.conversions);
    totalLeads += parseCurrency(p.leads);
  }
  const avgCpa = totalConv > 0 ? totalSpend / totalConv : 0;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const cpl = report.cplCpaAnalysis;
  const concerns = cpl?.primaryConcerns || [];
  const quickWins = cpl?.quickWins || [];

  return (
    <div className="space-y-4">
      {/* Grade + KPIs row */}
      <div className="grid grid-cols-5 gap-3">
        {/* Grade */}
        <div className={`rounded-xl border p-4 flex flex-col items-center justify-center ${grade.bgColor}`}>
          <span className={`text-4xl font-black ${grade.color}`}>{grade.letter}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            {health !== 'unknown' ? health : 'N/A'}
          </span>
        </div>

        {/* Total Spend */}
        <Card className="border-border/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-xs">Total Spend</span>
            </div>
            <span className="text-2xl font-bold">{fmtCurrency(totalSpend)}</span>
          </CardContent>
        </Card>

        {/* Avg CPA */}
        <Card className="border-border/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" />
              <span className="text-xs">Avg CPA</span>
            </div>
            <span className="text-2xl font-bold">{avgCpa > 0 ? fmtCurrency(avgCpa) : '—'}</span>
          </CardContent>
        </Card>

        {/* Avg CPL */}
        <Card className="border-border/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-xs">Avg CPL</span>
            </div>
            <span className="text-2xl font-bold">{avgCpl > 0 ? fmtCurrency(avgCpl) : '—'}</span>
          </CardContent>
        </Card>

        {/* Conversions */}
        <Card className="border-border/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs">Conversions</span>
            </div>
            <span className="text-2xl font-bold">{fmtNumber(totalConv)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Executive summary text */}
      {report.summary && (
        <div className="rounded-lg bg-muted/30 border border-border/50 p-4">
          <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>
        </div>
      )}

      {/* Primary Concerns + Quick Wins */}
      {(concerns.length > 0 || quickWins.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {concerns.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-500">Primary Concerns</span>
              </div>
              <ul className="space-y-1.5">
                {concerns.map((c, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-red-400 mt-1 shrink-0">-</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {quickWins.length > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Quick Wins</span>
              </div>
              <ul className="space-y-1.5">
                {quickWins.map((w, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-emerald-400 mt-1 shrink-0">-</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

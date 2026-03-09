import { Search, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SectionHeader, fmtCurrency } from '../shared';
import type { KeyMetrics } from '@/types/dailyReports';

interface Props {
  keyMetrics: KeyMetrics | null;
}

export function KeywordAnalysisSection({ keyMetrics }: Props) {
  if (!keyMetrics) return null;
  const { topKeywords, bottomKeywords } = keyMetrics;
  const hasTop = topKeywords && topKeywords.length > 0;
  const hasBottom = bottomKeywords && bottomKeywords.length > 0;
  if (!hasTop && !hasBottom) return null;

  return (
    <div>
      <SectionHeader title="Keyword Analysis" icon={<Search className="h-4 w-4" />} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Performers */}
        {hasTop && (
          <div className="rounded-lg border border-emerald-500/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-emerald-500/5 border-b border-emerald-500/20">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Top Performers</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Keyword</TableHead>
                  <TableHead className="text-xs text-right">Spend</TableHead>
                  <TableHead className="text-xs text-right">Conv</TableHead>
                  <TableHead className="text-xs text-right">CPA</TableHead>
                  <TableHead className="text-xs text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topKeywords!.map((kw, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">{kw.keyword}</TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(kw.spend)}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-emerald-500">{kw.conversions}</TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(kw.cpa)}</TableCell>
                    <TableCell className="text-sm text-right">{(kw.ctr ?? 0).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Wasted Spend */}
        {hasBottom && (
          <div className="rounded-lg border border-red-500/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-red-500/5 border-b border-red-500/20 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">Wasted Spend</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Keyword</TableHead>
                  <TableHead className="text-xs text-right">Spend</TableHead>
                  <TableHead className="text-xs text-right">Conv</TableHead>
                  <TableHead className="text-xs text-right">Wasted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottomKeywords!.map((kw, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">{kw.keyword}</TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(kw.spend)}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">{kw.conversions}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-red-500">{fmtCurrency(kw.wastedSpend)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* CTR by Platform */}
      {keyMetrics.ctrByPlatform && Object.keys(keyMetrics.ctrByPlatform).length > 0 && (
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-muted-foreground">CTR by Platform:</span>
          {Object.entries(keyMetrics.ctrByPlatform).map(([platform, ctr]) => (
            <Badge key={platform} variant="outline" className="text-[10px]">
              {platform}: {typeof ctr === 'number' ? ctr.toFixed(2) : ctr}%
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

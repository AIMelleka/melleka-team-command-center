import { useState } from 'react';
import { BarChart3, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionHeader, parseCurrency, fmtCurrency } from '../shared';
import type { Platform } from '@/types/dailyReports';

interface CampaignRow {
  name: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

interface Props {
  platforms: Platform[];
}

type SortKey = 'spend' | 'conversions' | 'cpa' | 'ctr' | 'clicks';

export function CampaignPerformanceTable({ platforms }: Props) {
  // Extract campaign data from platforms if available (stored in platform objects by some reviews)
  const campaigns: CampaignRow[] = [];
  for (const p of platforms) {
    const pAny = p as any;
    if (Array.isArray(pAny.campaigns)) {
      for (const c of pAny.campaigns) {
        campaigns.push({
          name: c.name || c.campaign || 'Unknown',
          platform: p.name,
          spend: typeof c.spend === 'number' ? c.spend : parseCurrency(c.spend),
          impressions: typeof c.impressions === 'number' ? c.impressions : parseCurrency(c.impressions),
          clicks: typeof c.clicks === 'number' ? c.clicks : parseCurrency(c.clicks),
          conversions: typeof c.conversions === 'number' ? c.conversions : parseCurrency(c.conversions),
          ctr: typeof c.ctr === 'number' ? c.ctr : parseCurrency(c.ctr),
          cpc: typeof c.cpc === 'number' ? c.cpc : parseCurrency(c.cpc),
          cpa: typeof c.cpa === 'number' ? c.cpa : parseCurrency(c.cpa),
        });
      }
    }
  }

  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortAsc, setSortAsc] = useState(false);

  if (campaigns.length === 0) return null;

  const sorted = [...campaigns].sort((a, b) => {
    const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortableHead = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="text-xs cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </TableHead>
  );

  return (
    <div>
      <SectionHeader title="Campaign Performance" icon={<BarChart3 className="h-4 w-4" />} />
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Campaign</TableHead>
              <TableHead className="text-xs">Platform</TableHead>
              <SortableHead label="Spend" field="spend" />
              <SortableHead label="Clicks" field="clicks" />
              <SortableHead label="Conv" field="conversions" />
              <SortableHead label="CPA" field="cpa" />
              <SortableHead label="CTR" field="ctr" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c, i) => {
              const isTop = i < 5 && sorted.length > 5;
              const isBottom = i >= sorted.length - 5 && sorted.length > 10 && sortKey === 'spend';
              return (
                <TableRow
                  key={`${c.platform}-${c.name}-${i}`}
                  className={isTop ? 'bg-emerald-500/5' : isBottom ? 'bg-red-500/5' : ''}
                >
                  <TableCell className="text-sm font-medium max-w-[250px] truncate">{c.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.platform}</TableCell>
                  <TableCell className="text-sm font-medium">{fmtCurrency(c.spend)}</TableCell>
                  <TableCell className="text-sm">{Number(c.clicks || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm font-medium">{Number(c.conversions || 0)}</TableCell>
                  <TableCell className="text-sm">{Number(c.cpa || 0) > 0 ? fmtCurrency(c.cpa) : '—'}</TableCell>
                  <TableCell className="text-sm">{Number(c.ctr || 0) > 0 ? `${Number(c.ctr).toFixed(2)}%` : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

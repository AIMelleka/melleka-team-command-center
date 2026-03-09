import { useState, useEffect, useRef } from 'react';
import type { ClientDailyReport } from '@/types/dailyReports';
import { StatusDot, getReportHealth, slugify } from './shared';

interface Props {
  reports: ClientDailyReport[];
}

export function ReportTableOfContents({ reports }: Props) {
  const [activeClient, setActiveClient] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Set up IntersectionObserver to track which client is visible
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            const clientName = reports.find(r => `report-${slugify(r.clientName)}` === id)?.clientName;
            if (clientName) setActiveClient(clientName);
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    );

    // Observe all report sections
    for (const report of reports) {
      const el = document.getElementById(`report-${slugify(report.clientName)}`);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [reports]);

  const scrollTo = (clientName: string) => {
    const el = document.getElementById(`report-${slugify(clientName)}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (reports.length === 0) return null;

  return (
    <nav className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-2">
        Clients ({reports.length})
      </p>
      {reports.map((report) => {
        const health = getReportHealth(report.cplCpaAnalysis, report.platforms);
        const isActive = activeClient === report.clientName;
        return (
          <button
            key={report.id}
            onClick={() => scrollTo(report.clientName)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
              isActive
                ? 'bg-primary/10 text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <StatusDot status={health} />
            <span className="truncate">{report.clientName}</span>
          </button>
        );
      })}
    </nav>
  );
}

import { Skeleton } from '@/components/ui/skeleton';

// Proposal Card Skeleton for Dashboard
export const ProposalCardSkeleton = () => (
  <div className="p-4 border border-border rounded-xl bg-card">
    <div className="flex items-start justify-between mb-3">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-2/3 mb-4" />
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-8" />
    </div>
  </div>
);

// Proposal Table Row Skeleton
export const ProposalRowSkeleton = () => (
  <tr className="border-b border-border">
    <td className="p-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </td>
    <td className="p-4">
      <Skeleton className="h-6 w-20 rounded-full" />
    </td>
    <td className="p-4">
      <Skeleton className="h-4 w-24" />
    </td>
    <td className="p-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </td>
  </tr>
);

// Proposal Dashboard Skeleton
export const ProposalDashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 border border-border rounded-xl bg-card">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
    
    {/* Table/Cards */}
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <ProposalCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Proposal View Hero Skeleton
export const ProposalHeroSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center p-8">
    <div className="max-w-4xl w-full space-y-8 text-center">
      <Skeleton className="h-16 w-16 rounded-full mx-auto" />
      <Skeleton className="h-12 w-3/4 mx-auto" />
      <Skeleton className="h-6 w-1/2 mx-auto" />
      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Section Loading Skeleton
export const SectionSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-6 p-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="grid gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-border">
          <Skeleton className="h-5 w-1/3 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3 mt-1" />
        </div>
      ))}
    </div>
  </div>
);

// Chart/Analytics Skeleton
export const ChartSkeleton = () => (
  <div className="p-6 border border-border rounded-xl bg-card">
    <div className="flex items-center justify-between mb-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-24" />
    </div>
    <div className="h-64 flex items-end justify-around gap-2">
      {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
        <Skeleton key={i} className="w-8 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
    <div className="flex justify-around mt-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Skeleton key={i} className="h-4 w-8" />
      ))}
    </div>
  </div>
);

// Chatbot Loading Skeleton
export const ChatbotSkeleton = () => (
  <div className="rounded-2xl border border-border overflow-hidden bg-card">
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
    <div className="p-4 space-y-4 min-h-[200px]">
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
      </div>
      <div className="flex gap-3 justify-end">
        <Skeleton className="h-12 w-1/2 rounded-2xl" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
    <div className="p-4 border-t border-border">
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  </div>
);

// Generic Card Skeleton
export const CardSkeleton = ({ className = '' }: { className?: string }) => (
  <div className={`p-6 border border-border rounded-xl bg-card ${className}`}>
    <Skeleton className="h-6 w-1/3 mb-4" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  </div>
);

// SEO Metrics Skeleton
export const SeoMetricsSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="p-4 rounded-xl border border-border bg-card text-center">
        <Skeleton className="h-4 w-20 mx-auto mb-2" />
        <Skeleton className="h-8 w-16 mx-auto" />
      </div>
    ))}
  </div>
);

// Full Page Loading Skeleton
export const FullPageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <ProposalHeroSkeleton />
    </div>
  </div>
);

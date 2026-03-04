import { useState } from 'react';
import { ChevronDown, TrendingUp, DollarSign, Target, MousePointer, BarChart3, ExternalLink } from 'lucide-react';
import { INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK, IndustryBenchmark } from '@/data/industryBenchmarks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface IndustryBenchmarkBadgeProps {
  detectedIndustry?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  textMutedColor?: string;
  glassBackground?: string;
  borderColor?: string;
}

export function IndustryBenchmarkBadge({
  detectedIndustry,
  primaryColor = '#8b5cf6',
  secondaryColor = '#06b6d4',
  textColor = '#ffffff',
  textMutedColor = '#94a3b8',
  glassBackground = 'rgba(255,255,255,0.05)',
  borderColor = 'rgba(255,255,255,0.1)',
}: IndustryBenchmarkBadgeProps) {
  const allIndustries = [...INDUSTRY_BENCHMARKS, DEFAULT_BENCHMARK];
  
  const initialIndustry = detectedIndustry 
    ? allIndustries.find(b => b.industry.toLowerCase() === (detectedIndustry || '').toLowerCase()) || DEFAULT_BENCHMARK
    : DEFAULT_BENCHMARK;
  
  const [selectedBenchmark, setSelectedBenchmark] = useState<IndustryBenchmark>(initialIndustry);
  const [isExpanded, setIsExpanded] = useState(false);

  const benchmarkStats = [
    {
      label: 'Meta CTR',
      value: `${selectedBenchmark.facebook.ctr}%`,
      icon: MousePointer,
      category: 'meta',
    },
    {
      label: 'Meta CPC',
      value: `$${selectedBenchmark.facebook.cpc.toFixed(2)}`,
      icon: DollarSign,
      category: 'meta',
    },
    {
      label: 'Meta CVR',
      value: `${selectedBenchmark.facebook.conversionRate}%`,
      icon: Target,
      category: 'meta',
    },
    {
      label: 'Google CTR',
      value: `${selectedBenchmark.google.searchCtr}%`,
      icon: MousePointer,
      category: 'google',
    },
    {
      label: 'Google CPC',
      value: `$${selectedBenchmark.google.searchCpc.toFixed(2)}`,
      icon: DollarSign,
      category: 'google',
    },
    {
      label: 'Google CVR',
      value: `${selectedBenchmark.google.conversionRate}%`,
      icon: Target,
      category: 'google',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-0">
      {/* Industry Badge Header */}
      <div 
        className="rounded-xl sm:rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300"
        style={{ 
          background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 10%, ${glassBackground}), ${glassBackground})`,
          border: `1px solid ${borderColor}`,
        }}
      >
        {/* Header Row */}
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            >
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-medium" style={{ color: textMutedColor }}>
                Industry Benchmarks
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity">
                  <span className="font-display font-semibold text-base sm:text-lg truncate max-w-[180px] sm:max-w-none" style={{ color: textColor }}>
                    {selectedBenchmark.industry}
                  </span>
                  <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" style={{ color: primaryColor }} />
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="max-h-[300px] overflow-y-auto w-56 sm:w-64 z-50"
                  style={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                >
                  {allIndustries.map((benchmark) => (
                    <DropdownMenuItem
                      key={benchmark.industry}
                      onClick={() => setSelectedBenchmark(benchmark)}
                      className="cursor-pointer text-sm hover:bg-accent"
                      style={{ 
                        color: selectedBenchmark.industry === benchmark.industry ? primaryColor : 'hsl(var(--foreground))',
                        backgroundColor: selectedBenchmark.industry === benchmark.industry ? `color-mix(in srgb, ${primaryColor} 15%, hsl(var(--background)))` : undefined
                      }}
                    >
                      <span className="truncate">{benchmark.industry}</span>
                      {(detectedIndustry || '').toLowerCase() === benchmark.industry.toLowerCase() && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: secondaryColor, color: '#fff' }}>
                          Detected
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            <a 
              href="https://www.wordstream.com/blog/facebook-ads-benchmarks-2025"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] sm:text-xs flex items-center gap-1 hover:underline"
              style={{ color: textMutedColor }}
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">WordStream 2025</span>
              <span className="sm:hidden">Source</span>
            </a>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`,
                color: primaryColor,
              }}
            >
              {isExpanded ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>

        {/* Quick Stats Row - Always visible */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
          {benchmarkStats.map((stat, i) => (
            <div 
              key={i}
              className="p-2 sm:p-3 rounded-lg sm:rounded-xl text-center transition-all duration-200 hover:scale-105"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${stat.category === 'meta' ? primaryColor : secondaryColor} 10%, transparent)`,
                border: `1px solid ${stat.category === 'meta' ? primaryColor : secondaryColor}30`,
              }}
            >
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                <stat.icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: stat.category === 'meta' ? primaryColor : secondaryColor }} />
                <span className="text-[8px] sm:text-[10px] uppercase tracking-wide truncate" style={{ color: textMutedColor }}>{stat.label}</span>
              </div>
              <p className="font-bold text-sm sm:text-lg" style={{ color: textColor }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {isExpanded && (
          <div 
            className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t"
            style={{ borderColor: borderColor }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-4">
              {/* Meta/Facebook Section */}
              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, transparent)` }}
              >
                <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#1877F2] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">f</div>
                  Meta Ads
                </h4>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CTR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.facebook.ctr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CPC</span>
                    <span style={{ color: textColor }}>${selectedBenchmark.facebook.cpc.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CVR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.facebook.conversionRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CPA</span>
                    <span style={{ color: textColor }}>${selectedBenchmark.facebook.cpa.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CPM</span>
                    <span style={{ color: textColor }}>${selectedBenchmark.meta.avgCpm.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Google Ads Section */}
              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 8%, transparent)` }}
              >
                <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2" style={{ color: secondaryColor }}>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-white flex items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-bold" style={{ color: '#4285F4' }}>G</span>
                  </div>
                  Google Ads
                </h4>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Search CTR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.google.searchCtr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Search CPC</span>
                    <span style={{ color: textColor }}>${selectedBenchmark.google.searchCpc.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Display CTR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.google.displayCtr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CVR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.google.conversionRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CPA</span>
                    <span style={{ color: textColor }}>${selectedBenchmark.google.cpa.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SEO Section */}
              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, #10b981 8%, transparent)` }}
              >
                <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2" style={{ color: '#10b981' }}>
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  SEO
                </h4>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Organic CTR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.seo.avgOrganicCtr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Keyword Growth</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.seo.targetKeywordGrowth}%/qtr</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Traffic Increase</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.seo.expectedTrafficIncrease}%/yr</span>
                  </div>
                </div>
              </div>

              {/* Email Section */}
              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 8%, transparent)` }}
              >
                <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2" style={{ color: secondaryColor }}>
                  <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                  Email Marketing
                </h4>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Open Rate</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.email.openRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>Click Rate</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.email.clickRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMutedColor }}>CVR</span>
                    <span style={{ color: textColor }}>{selectedBenchmark.email.conversionRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

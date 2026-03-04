import { cn } from '@/lib/utils';
import { DeckMetricCard } from './DeckMetricCard';
import { DeckPerformanceGrade } from './DeckPerformanceGrade';
import { Lightbulb, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface PlatformMetric {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: LucideIcon;
  trend?: number;
}

export interface DeckPlatformSectionProps {
  platform: 'google' | 'meta' | 'sms' | 'email' | string;
  title: string;
  icon: LucideIcon;
  metrics: PlatformMetric[];
  screenshots?: string[];
  insights?: string[];
  grade?: string;
  onScreenshotClick?: (url: string) => void;
}

// Platform-specific color configs
const platformColors: Record<string, string> = {
  google: '#4285F4',
  meta: '#1877F2',
  sms: '#10b981',
  email: '#8b5cf6',
};

export const DeckPlatformSection = ({
  platform,
  title,
  icon: IconComponent,
  metrics,
  screenshots = [],
  insights = [],
  grade,
  onScreenshotClick,
}: DeckPlatformSectionProps) => {
  const platformColor = platformColors[platform] || '#6366f1';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-8 md:mb-12">
        <div className="flex items-center gap-4">
          {/* Platform icon with branded glow */}
          <div 
            className="relative p-4 rounded-2xl"
            style={{ 
              background: `linear-gradient(135deg, ${platformColor}30, ${platformColor}10)`,
              boxShadow: `0 0 40px ${platformColor}20`,
            }}
          >
            <IconComponent className="h-8 w-8" style={{ color: platformColor }} />
            {/* Pulse ring */}
            <div 
              className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ backgroundColor: platformColor }}
            />
          </div>
          
          <div>
            <h2 
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {title}
            </h2>
            <div 
              className="h-1 w-24 mt-2 rounded-full"
              style={{ 
                background: `linear-gradient(90deg, ${platformColor}, ${platformColor}80)`,
              }}
            />
          </div>
        </div>

      </div>

      {/* Two-column layout on desktop */}
      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left: Metrics (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Primary metrics grid */}
          <div className="grid grid-cols-2 gap-4">
            {metrics.slice(0, 4).map((metric, idx) => (
              <DeckMetricCard
                key={idx}
                label={metric.label}
                value={metric.value}
                prefix={metric.prefix}
                suffix={metric.suffix}
                decimals={metric.decimals}
                icon={metric.icon}
                color={platformColor}
                trend={metric.trend}
                size="md"
              />
            ))}
          </div>

          {/* Secondary metrics (if more than 4) */}
          {metrics.length > 4 && (
            <div className="grid grid-cols-3 gap-3">
              {metrics.slice(4).map((metric, idx) => (
                <DeckMetricCard
                  key={idx}
                  label={metric.label}
                  value={metric.value}
                  prefix={metric.prefix}
                  suffix={metric.suffix}
                  decimals={metric.decimals}
                  color={platformColor}
                  size="sm"
                />
              ))}
            </div>
          )}

          {/* Key Insight Callout */}
          {insights.length > 0 && (
            <div 
              className="relative rounded-2xl p-6 border overflow-hidden"
              style={{ 
                borderColor: `${platformColor}30`,
                background: `linear-gradient(135deg, ${platformColor}10, transparent)`,
              }}
            >
              <div className="flex items-start gap-4">
                <div 
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: `${platformColor}20` }}
                >
                  <Lightbulb className="h-5 w-5" style={{ color: platformColor }} />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Key Insights</h4>
                  <ul className="space-y-2">
                    {insights.slice(0, 3).map((insight, idx) => (
                      <li 
                        key={idx}
                        className="flex items-start gap-2 text-white/80"
                      >
                        <ChevronRight 
                          className="h-4 w-4 mt-0.5 flex-shrink-0" 
                          style={{ color: platformColor }} 
                        />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* Decorative gradient blur */}
              <div 
                className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: platformColor }}
              />
            </div>
          )}
        </div>

        {/* Right: Screenshots (2 cols) */}
        <div className="lg:col-span-2">
          {screenshots.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-white/60 uppercase text-xs tracking-widest font-medium mb-4">
                Dashboard Screenshots
              </h3>
              <div className="grid gap-4">
                {screenshots.slice(0, 4).map((screenshot, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "relative group rounded-xl overflow-hidden border border-white/10",
                      "cursor-zoom-in hover:border-white/30 transition-all duration-300",
                      "hover:shadow-lg hover:transform hover:scale-[1.02]"
                    )}
                    onClick={() => onScreenshotClick?.(screenshot)}
                    style={{
                      boxShadow: `0 4px 20px ${platformColor}10`,
                    }}
                  >
                    <img 
                      src={screenshot} 
                      alt={`${title} screenshot ${idx + 1}`}
                      className="w-full h-40 object-cover"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium">Click to expand</span>
                    </div>
                    {/* Index badge */}
                    <div 
                      className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium"
                      style={{ 
                        backgroundColor: `${platformColor}cc`,
                        color: 'white',
                      }}
                    >
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* More screenshots indicator */}
              {screenshots.length > 4 && (
                <div className="text-center text-white/40 text-sm">
                  +{screenshots.length - 4} more screenshots
                </div>
              )}
            </div>
          ) : (
            <div 
              className="h-full min-h-[300px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10"
            >
              <ImageIcon className="h-12 w-12 text-white/20 mb-4" />
              <p className="text-white/40 text-center">
                No screenshots available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonDataPoint {
  name: string;
  current: number;
  previous: number;
  prefix?: string;
  suffix?: string;
}

interface DeckComparisonChartProps {
  title: string;
  data: ComparisonDataPoint[];
  brandPrimary: string;
  brandSecondary: string;
  currentLabel?: string;
  previousLabel?: string;
  animate?: boolean;
}

export const DeckComparisonChart = ({
  title,
  data,
  brandPrimary,
  brandSecondary,
  currentLabel = 'This Period',
  previousLabel = 'Previous Period',
  animate = true,
}: DeckComparisonChartProps) => {
  const [isVisible, setIsVisible] = useState(!animate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for scroll-triggered animation
  useEffect(() => {
    if (!animate) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [animate]);

  // Calculate changes for each data point
  const dataWithChanges = data.map(item => {
    const change = item.previous === 0 
      ? (item.current > 0 ? 100 : 0)
      : ((item.current - item.previous) / item.previous) * 100;
    
    return { ...item, change };
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const item = payload[0].payload;
    const isPositive = item.change >= 0;
    
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 shadow-xl">
        <p className="text-white font-semibold mb-2">{item.name}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-white/60 text-sm">{currentLabel}:</span>
            <span className="text-white font-medium">
              {item.prefix}{item.current.toLocaleString()}{item.suffix}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-white/60 text-sm">{previousLabel}:</span>
            <span className="text-white/80">
              {item.prefix}{item.previous.toLocaleString()}{item.suffix}
            </span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className={cn(
              "flex items-center gap-1 font-medium",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? '+' : ''}{item.change.toFixed(1)}% change
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: brandPrimary }}
            />
            <span className="text-white/60">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full opacity-40"
              style={{ backgroundColor: brandPrimary }}
            />
            <span className="text-white/60">{previousLabel}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dataWithChanges}
            layout="vertical"
            barCategoryGap="20%"
            margin={{ top: 0, right: 80, left: 80, bottom: 0 }}
          >
            <XAxis 
              type="number" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
            />
            <YAxis 
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 13 }}
              width={70}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            
            {/* Previous period bars (background) */}
            <Bar 
              dataKey="previous"
              fill={brandPrimary}
              opacity={0.3}
              radius={[0, 4, 4, 0]}
              animationDuration={isVisible ? 1000 : 0}
              animationBegin={0}
            />
            
            {/* Current period bars (foreground) */}
            <Bar 
              dataKey="current"
              fill={brandPrimary}
              radius={[0, 6, 6, 0]}
              animationDuration={isVisible ? 1200 : 0}
              animationBegin={200}
            >
              <LabelList
                dataKey="change"
                position="right"
                formatter={(value: number) => (
                  `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`
                )}
                fill={data[0]?.current >= (data[0]?.previous || 0) ? '#34d399' : '#f87171'}
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
        {dataWithChanges.slice(0, 3).map((item, idx) => {
          const isPositive = item.change >= 0;
          const isNeutral = Math.abs(item.change) < 1;
          
          return (
            <div 
              key={idx}
              className="text-center"
            >
              <div className={cn(
                "inline-flex items-center gap-1 mb-1 text-sm font-medium",
                isNeutral ? "text-white/60" :
                isPositive ? "text-emerald-400" : "text-red-400"
              )}>
                {isNeutral ? (
                  <Minus className="h-3 w-3" />
                ) : isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {isPositive ? '+' : ''}{item.change.toFixed(1)}%
              </div>
              <div className="text-white/50 text-xs">{item.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

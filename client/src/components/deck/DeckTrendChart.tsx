import { useEffect, useState, useRef } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface DeckTrendChartProps {
  title: string;
  data: TrendDataPoint[];
  color: string;
  valuePrefix?: string;
  valueSuffix?: string;
  showAverage?: boolean;
  height?: number;
  animate?: boolean;
}

export const DeckTrendChart = ({
  title,
  data,
  color,
  valuePrefix = '',
  valueSuffix = '',
  showAverage = true,
  height = 200,
  animate = true,
}: DeckTrendChartProps) => {
  const [isVisible, setIsVisible] = useState(!animate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for animation
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

  // Calculate average
  const average = data.length > 0 
    ? data.reduce((sum, d) => sum + d.value, 0) / data.length 
    : 0;

  // Calculate trend direction
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / (secondHalf.length || 1);
  const trend = secondAvg > firstAvg ? 'up' : secondAvg < firstAvg ? 'down' : 'stable';

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-white/60 text-xs mb-1">{label}</p>
        <p className="text-white font-semibold">
          {valuePrefix}{payload[0].value.toLocaleString()}{valueSuffix}
        </p>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        
        {/* Trend badge */}
        <div 
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
            trend === 'down' ? 'bg-red-500/20 text-red-400' :
            'bg-white/10 text-white/60'
          }`}
        >
          {trend === 'up' ? '↑ Trending Up' : trend === 'down' ? '↓ Trending Down' : '→ Stable'}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <XAxis 
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              width={50}
              tickFormatter={(value) => `${valuePrefix}${value.toLocaleString()}`}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Average reference line */}
            {showAverage && (
              <ReferenceLine 
                y={average} 
                stroke="rgba(255,255,255,0.3)" 
                strokeDasharray="4 4"
                label={{
                  value: `Avg: ${valuePrefix}${Math.round(average).toLocaleString()}${valueSuffix}`,
                  position: 'right',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 10,
                }}
              />
            )}
            
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
              animationDuration={isVisible ? 1500 : 0}
              animationEasing="ease-out"
              dot={false}
              activeDot={{
                r: 6,
                fill: color,
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="text-white/50 text-xs mb-1">Min</div>
          <div className="text-white font-medium text-sm">
            {valuePrefix}{Math.min(...data.map(d => d.value)).toLocaleString()}{valueSuffix}
          </div>
        </div>
        <div className="text-center">
          <div className="text-white/50 text-xs mb-1">Average</div>
          <div className="text-white font-medium text-sm">
            {valuePrefix}{Math.round(average).toLocaleString()}{valueSuffix}
          </div>
        </div>
        <div className="text-center">
          <div className="text-white/50 text-xs mb-1">Max</div>
          <div className="text-white font-medium text-sm">
            {valuePrefix}{Math.max(...data.map(d => d.value)).toLocaleString()}{valueSuffix}
          </div>
        </div>
      </div>
    </div>
  );
};

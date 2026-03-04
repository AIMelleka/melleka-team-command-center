import React, { useRef } from 'react';

// Stable counter for unique gradient IDs (no useId dependency)
let _sparklineCounter = 0;

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({ data, width = 64, height = 28, className = '' }) => {
  const gradIdRef = useRef(`sg-${++_sparklineCounter}`);
  const gradId = gradIdRef.current;

  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const innerH = height - padding * 2;
  const stepX = (width - padding * 2) / (data.length - 1);

  const pointsArr = data.map((v, i) => ({
    x: padding + i * stepX,
    y: padding + innerH - ((v - min) / range) * innerH,
  }));

  const polylinePoints = pointsArr.map(p => `${p.x},${p.y}`).join(' ');

  // Area fill: line points + bottom-right + bottom-left corners
  const areaPoints = [
    ...pointsArr.map(p => `${p.x},${p.y}`),
    `${pointsArr[pointsArr.length - 1].x},${height - padding}`,
    `${pointsArr[0].x},${height - padding}`,
  ].join(' ');

  // Color based on trend (last vs first)
  const trend = data[data.length - 1] - data[0];
  const strokeColor = trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : '#fbbf24';

  const lastPt = pointsArr[pointsArr.length - 1];

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Gradient area fill */}
      <polygon points={areaPoints} fill={`url(#${gradId})`} stroke="none" />
      {/* Sparkline */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on last point (current value indicator) */}
      <circle cx={lastPt.x} cy={lastPt.y} r={2} fill={strokeColor} />
    </svg>
  );
};

export default MiniSparkline;

import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export const DotGrid: React.FC<{
  fadeIn?: number;
  opacity?: number;
  color?: string;
}> = ({ fadeIn = 30, opacity: maxOpacity = 0.2, color = '#818cf8' }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fadeIn], [0, maxOpacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const dots = useMemo(() => {
    const result: { x: number; y: number; delay: number }[] = [];
    const spacing = 70;
    const cols = Math.ceil(1080 / spacing);
    const rows = Math.ceil(1920 / spacing);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * spacing + spacing / 2;
        const y = r * spacing + spacing / 2;
        const dist = Math.sqrt((x - 540) ** 2 + (y - 960) ** 2);
        result.push({ x, y, delay: dist * 0.003 });
      }
    }
    return result;
  }, []);

  return (
    <svg
      width={1080}
      height={1920}
      style={{ position: 'absolute', top: 0, left: 0, opacity }}
    >
      {dots.map((d, i) => {
        const pulse = Math.sin(frame * 0.04 + d.delay * 8) * 0.5 + 0.5;
        return (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={1.2 + pulse * 0.6}
            fill={color}
            opacity={0.15 + pulse * 0.15}
          />
        );
      })}
    </svg>
  );
};

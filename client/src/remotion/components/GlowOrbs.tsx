import React from 'react';
import { useCurrentFrame } from 'remotion';

interface OrbConfig {
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  phase: number;
}

const defaultOrbs: OrbConfig[] = [
  { x: 150, y: 300, size: 450, color: 'rgba(99, 102, 241, 0.08)', speed: 0.006, phase: 0 },
  { x: 900, y: 700, size: 400, color: 'rgba(245, 158, 11, 0.06)', speed: 0.005, phase: 2 },
  { x: 400, y: 1500, size: 500, color: 'rgba(99, 102, 241, 0.07)', speed: 0.008, phase: 4 },
  { x: 750, y: 1100, size: 350, color: 'rgba(6, 182, 212, 0.06)', speed: 0.007, phase: 1 },
];

export const GlowOrbs: React.FC<{ opacity?: number; orbs?: OrbConfig[] }> = ({ opacity = 0.8, orbs = defaultOrbs }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity,
        pointerEvents: 'none',
      }}
    >
      {orbs.map((orb, i) => {
        const dx = Math.sin(frame * orb.speed + orb.phase) * 50;
        const dy = Math.cos(frame * orb.speed * 0.6 + orb.phase) * 40;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: orb.x + dx - orb.size / 2,
              top: orb.y + dy - orb.size / 2,
              width: orb.size,
              height: orb.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 65%)`,
              filter: 'blur(50px)',
            }}
          />
        );
      })}
    </div>
  );
};

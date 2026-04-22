import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

/** Floating particles burst from center */
export const ParticleBurst: React.FC<{
  startFrame: number;
  count?: number;
  primaryColor?: string;
  accentColor?: string;
}> = ({ startFrame, count = 20, primaryColor = '#6366f1', accentColor = '#d97706' }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  if (elapsed < 0 || elapsed > 40) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const speed = 3 + (i % 5) * 2;
        const x = 540 + Math.cos(angle) * elapsed * speed;
        const y = 960 + Math.sin(angle) * elapsed * speed;
        const opacity = interpolate(elapsed, [0, 30, 40], [1, 0.5, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const size = 4 + (i % 3) * 3;
        const color = i % 2 === 0 ? primaryColor : accentColor;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity,
              boxShadow: `0 0 8px ${color}40`,
            }}
          />
        );
      })}
    </div>
  );
};

/** Shimmer sweep overlay */
export const ShimmerEffect: React.FC<{
  startFrame: number;
  duration?: number;
  color?: string;
}> = ({ startFrame, duration = 25, color = 'rgba(245, 158, 11, 0.2)' }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [-0.3, 1.3],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 4, startFrame + duration - 4, startFrame + duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (frame < startFrame || frame > startFrame + duration) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        background: `linear-gradient(105deg, transparent ${(progress - 0.12) * 100}%, ${color} ${progress * 100}%, transparent ${(progress + 0.12) * 100}%)`,
        pointerEvents: 'none',
      }}
    />
  );
};

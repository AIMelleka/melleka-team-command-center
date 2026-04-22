import React from 'react';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export const GlowButton: React.FC<{
  text: string;
  startFrame: number;
  large?: boolean;
  theme?: CommercialTheme;
}> = ({ text, startFrame, large = false, theme = defaultTheme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { mass: 0.5, damping: 12, stiffness: 200 },
  });

  const pulse = Math.sin((frame - startFrame) * 0.1) * 0.4 + 0.6;
  const glowSize = 40 + pulse * 30;

  return (
    <div
      style={{
        opacity: enter,
        transform: `scale(${0.85 + enter * 0.15}) translateY(${(1 - enter) * 20}px)`,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: theme.gradients.primaryToAccent,
          borderRadius: theme.radius.full,
          padding: large ? '24px 72px' : '18px 52px',
          boxShadow: `0 0 ${glowSize}px ${theme.colors.primaryGlow}, 0 0 ${glowSize * 2}px ${theme.colors.primaryGlow}`,
        }}
      >
        <span
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: large ? 32 : 26,
            fontWeight: 700,
            color: theme.colors.white,
            letterSpacing: '0.5px',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface TextOnlySceneProps {
  headline: string;
  subtext?: string;
  accentColor?: string;
  theme?: CommercialTheme;
}

export const TextOnlyScene: React.FC<TextOnlySceneProps> = ({
  headline,
  subtext,
  accentColor,
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = headline.split(' ');

  return (
    <SceneWrapper orbOpacity={0.5} theme={theme}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 80px', gap: 30,
      }}>
        {/* Word-by-word animated headline */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: '0 20px',
        }}>
          {words.map((word, i) => {
            const delay = 5 + i * 3;
            const progress = spring({ frame: frame - delay, fps, config: { mass: 0.4, damping: 12, stiffness: 220 } });
            return (
              <span key={i} style={{
                fontFamily: theme.fonts.heading, fontSize: 64, fontWeight: 800,
                color: accentColor || theme.colors.textPrimary,
                letterSpacing: '-1px', lineHeight: 1.15,
                opacity: progress, transform: `translateY(${(1 - progress) * 30}px)`,
                display: 'inline-block',
              }}>
                {word}
              </span>
            );
          })}
        </div>

        {/* Subtext */}
        {subtext && (() => {
          const subEnter = spring({ frame: frame - 5 - words.length * 3 - 10, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
          return (
            <div style={{ opacity: subEnter, transform: `translateY(${(1 - subEnter) * 20}px)` }}>
              <span style={{
                fontFamily: theme.fonts.body, fontSize: 28, fontWeight: 500,
                color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 1.5,
              }}>
                {subtext}
              </span>
            </div>
          );
        })()}
      </div>
    </SceneWrapper>
  );
};

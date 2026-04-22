import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface BadgesSceneProps {
  title: string;
  subtitle: string;
  subtitleHighlight?: string;
  screenshot: string;
  badges: string[];
  theme?: CommercialTheme;
}

export const BadgesScene: React.FC<BadgesSceneProps> = ({
  title,
  subtitle,
  subtitleHighlight,
  screenshot,
  badges,
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEnter = spring({ frame: frame - 5, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const subEnter = spring({ frame: frame - 14, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const screenEnter = spring({ frame: frame - 18, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const shimmerX = interpolate(frame, [50, 80], [-200, 1200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const subParts = subtitleHighlight && subtitle.includes(subtitleHighlight)
    ? subtitle.split(subtitleHighlight) : null;

  return (
    <SceneWrapper orbOpacity={0.4} theme={theme}>
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center',
        opacity: titleEnter, transform: `translateY(${(1 - titleEnter) * 20}px)`,
      }}>
        <span style={{
          fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: 600,
          color: theme.colors.textMuted, letterSpacing: '3px', textTransform: 'uppercase',
        }}>
          {title}
        </span>
      </div>

      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0, textAlign: 'center',
        opacity: subEnter, transform: `translateY(${(1 - subEnter) * 15}px)`,
      }}>
        <span style={{
          fontFamily: theme.fonts.heading, fontSize: 34, fontWeight: 700, color: theme.colors.textPrimary,
        }}>
          {subParts ? (
            <>{subParts[0]}<span style={{ color: theme.colors.accent }}>{subtitleHighlight}</span>{subParts[1]}</>
          ) : subtitle}
        </span>
      </div>

      <div style={{
        position: 'absolute', top: 170, left: 25, right: 25,
        opacity: screenEnter,
        transform: `perspective(1200px) rotateX(${(1 - screenEnter) * 10}deg) scale(${0.88 + screenEnter * 0.12})`,
      }}>
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.1), 0 0 30px ${theme.colors.primaryGlow}`,
          border: `1px solid ${theme.colors.cardBorder}`, position: 'relative',
        }}>
          <Img src={screenshot} style={{ width: '100%', display: 'block' }} />
          {frame > 50 && frame < 85 && (
            <div style={{
              position: 'absolute', top: 0, left: shimmerX, width: 200, height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              transform: 'skewX(-15deg)', pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 80, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', padding: '0 60px', zIndex: 10,
      }}>
        {badges.map((name, i) => {
          const badgeEnter = spring({ frame: frame - 75 - i * 4, fps, config: { mass: 0.3, damping: 12, stiffness: 300 } });
          return (
            <div key={name} style={{
              opacity: badgeEnter,
              transform: `scale(${0.7 + badgeEnter * 0.3}) translateY(${(1 - badgeEnter) * 15}px)`,
              padding: '10px 22px', borderRadius: theme.radius.full,
              background: theme.colors.surfaceElevated,
              border: `1px solid ${theme.colors.borderAccent}`,
              boxShadow: theme.shadows.glowAccent,
              fontFamily: theme.fonts.mono, fontSize: 15, color: theme.colors.accent, fontWeight: 700,
            }}>
              {name}
            </div>
          );
        })}
      </div>
    </SceneWrapper>
  );
};

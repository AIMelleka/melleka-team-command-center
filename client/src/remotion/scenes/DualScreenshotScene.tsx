import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface DualScreenshotSceneProps {
  title: string;
  badgeText?: string;
  badgeIcon?: string;
  screenshot1: string;
  screenshot2: string;
  bottomBadge?: string;
  bottomBadgeIcon?: string;
  theme?: CommercialTheme;
}

export const DualScreenshotScene: React.FC<DualScreenshotSceneProps> = ({
  title,
  badgeText,
  badgeIcon = '\u{1F558}',
  screenshot1,
  screenshot2,
  bottomBadge,
  bottomBadgeIcon = '\u{1F9E0}',
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEnter = spring({ frame: frame - 5, fps, config: { mass: 0.4, damping: 12, stiffness: 220 } });
  const badgeEnter = spring({ frame: frame - 15, fps, config: { mass: 0.5, damping: 12, stiffness: 200 } });
  const screen1Enter = spring({ frame: frame - 18, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const screen2Enter = spring({ frame: frame - 85, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const bottomEnter = spring({ frame: frame - 120, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const notifPulse = Math.sin(frame * 0.15) * 0.3 + 0.7;

  return (
    <SceneWrapper orbOpacity={0.35} theme={theme}>
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

      {badgeText && (
        <div style={{
          position: 'absolute', top: 108, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          opacity: badgeEnter, transform: `scale(${0.8 + badgeEnter * 0.2})`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 32px', borderRadius: theme.radius.full,
            background: `${theme.colors.accent}12`, border: `1px solid ${theme.colors.borderAccent}`,
            boxShadow: theme.shadows.glowAccent,
          }}>
            <span style={{ fontSize: 22 }}>{badgeIcon}</span>
            <span style={{ fontFamily: theme.fonts.heading, fontSize: 24, fontWeight: 700, color: theme.colors.accent }}>
              {badgeText}
            </span>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: theme.colors.green,
              boxShadow: `0 0 ${8 + notifPulse * 12}px ${theme.colors.greenGlow}`,
              opacity: notifPulse,
            }} />
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: badgeText ? 185 : 120, left: 25, right: 25,
        opacity: screen1Enter,
        transform: `translateY(${(1 - screen1Enter) * 60}px) scale(${0.92 + screen1Enter * 0.08})`,
      }}>
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.1), 0 0 30px ${theme.colors.primaryGlow}`,
          border: `1px solid ${theme.colors.cardBorder}`,
        }}>
          <Img src={screenshot1} style={{ width: '100%', display: 'block' }} />
        </div>
      </div>

      {frame > 80 && (
        <div style={{
          position: 'absolute', top: 850, left: 20, right: 20, bottom: 0,
          opacity: screen2Enter, transform: `translateY(${(1 - screen2Enter) * 120}px)`,
          zIndex: 3, overflow: 'hidden',
        }}>
          <div style={{
            borderRadius: '20px 20px 0 0', overflow: 'hidden',
            boxShadow: `0 -10px 60px rgba(0,0,0,0.12), 0 0 40px ${theme.colors.primaryGlow}`,
            border: `1px solid ${theme.colors.cardBorder}`, borderBottom: 'none',
          }}>
            <Img src={screenshot2} style={{ width: '100%', display: 'block' }} />
          </div>
        </div>
      )}

      {bottomBadge && (
        <div style={{
          position: 'absolute', bottom: 70, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          opacity: bottomEnter, transform: `translateY(${(1 - bottomEnter) * 20}px)`, zIndex: 10,
        }}>
          <div style={{
            padding: '14px 32px', borderRadius: theme.radius.full,
            background: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.borderBright}`,
            boxShadow: theme.shadows.glowStrong,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{bottomBadgeIcon}</span>
            <span style={{ fontFamily: theme.fonts.heading, fontSize: 20, fontWeight: 700, color: theme.colors.primary }}>
              {bottomBadge}
            </span>
          </div>
        </div>
      )}
    </SceneWrapper>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import { ShimmerEffect } from '../components/Transitions';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

interface FeatureItem {
  icon: string;
  title: string;
  subtitle: string;
  color?: string;
}

interface StatItem {
  value: string;
  label: string;
  color?: string;
}

export interface StatsSceneProps {
  title: string;
  titleHighlight?: string;
  features: FeatureItem[];
  stats: StatItem[];
  backgroundImage?: string;
  theme?: CommercialTheme;
}

export const StatsScene: React.FC<StatsSceneProps> = ({
  title,
  titleHighlight,
  features,
  stats,
  backgroundImage,
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgEnter = interpolate(frame, [0, 20], [0, 0.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleEnter = spring({ frame: frame - 5, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });

  const titleParts = titleHighlight && title.includes(titleHighlight) ? title.split(titleHighlight) : null;

  return (
    <SceneWrapper orbOpacity={0.4} dotGrid={false} theme={theme}>
      {backgroundImage && (
        <div style={{ position: 'absolute', inset: 0, opacity: bgEnter }}>
          <Img src={backgroundImage} style={{ width: 1080, height: 1920, objectFit: 'cover', filter: 'blur(30px) saturate(0.4)' }} />
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.85)' }} />

      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0, textAlign: 'center',
        opacity: titleEnter, transform: `translateY(${(1 - titleEnter) * 25}px)`,
      }}>
        <span style={{
          fontFamily: theme.fonts.heading, fontSize: 48, fontWeight: 800,
          color: theme.colors.textPrimary, lineHeight: 1.2,
        }}>
          {titleParts ? (
            <>{titleParts[0]}<span style={{ color: theme.colors.primary }}>{titleHighlight}</span>{titleParts[1]}</>
          ) : title}
        </span>
      </div>

      {/* Feature cards */}
      <div style={{
        position: 'absolute', top: 220, left: 50, right: 50,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {features.map((feat, i) => {
          const direction = i % 2 === 0 ? 'left' : 'right';
          const delay = 15 + i * 12;
          const enter = spring({ frame: frame - delay, fps, config: { mass: 0.5, damping: 11, stiffness: 200 } });
          if (frame < delay) return null;
          const slideX = direction === 'left' ? -80 : 80;
          const accentColor = feat.color || (i % 4 === 0 ? theme.colors.primary : i % 4 === 1 ? theme.colors.cyan : i % 4 === 2 ? theme.colors.green : theme.colors.accent);

          return (
            <div key={i} style={{
              opacity: enter,
              transform: `translateX(${(1 - enter) * slideX}px) scale(${0.9 + enter * 0.1})`,
              background: theme.colors.surfaceElevated,
              border: `1px solid ${accentColor}30`,
              borderRadius: theme.radius.xl, padding: '28px 28px',
              display: 'flex', alignItems: 'center', gap: 20, width: '100%',
              boxShadow: `0 4px 24px ${accentColor}12`,
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: theme.radius.lg,
                background: `${accentColor}10`, border: `1px solid ${accentColor}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, flexShrink: 0,
              }}>
                {feat.icon}
              </div>
              <div>
                <div style={{
                  fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: 700,
                  color: accentColor, marginBottom: 4, lineHeight: 1.2,
                }}>
                  {feat.title}
                </div>
                <div style={{
                  fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.textSecondary, lineHeight: 1.4,
                }}>
                  {feat.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div style={{
        position: 'absolute', bottom: 140, left: 50, right: 50,
        display: 'flex', gap: 16, justifyContent: 'center',
      }}>
        {stats.map((stat, i) => {
          const statEnter = spring({ frame: frame - 100 - i * 8, fps, config: { mass: 0.5, damping: 11, stiffness: 220 } });
          const statColor = stat.color || (i === 0 ? theme.colors.primary : i === 1 ? theme.colors.green : theme.colors.accent);
          return (
            <div key={i} style={{
              opacity: statEnter,
              transform: `translateY(${(1 - statEnter) * 40}px) scale(${0.85 + statEnter * 0.15})`,
              flex: 1, textAlign: 'center', padding: '28px 16px',
              background: theme.colors.surfaceElevated, borderRadius: theme.radius.xl,
              border: `1px solid ${statColor}30`, boxShadow: `0 4px 24px ${statColor}15`,
            }}>
              <div style={{
                fontFamily: theme.fonts.heading, fontSize: 42, fontWeight: 800,
                color: statColor, lineHeight: 1, marginBottom: 6,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontFamily: theme.fonts.body, fontSize: 15, fontWeight: 600, color: theme.colors.textSecondary,
              }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      <ShimmerEffect startFrame={120} duration={25} />
    </SceneWrapper>
  );
};

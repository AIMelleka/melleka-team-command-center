import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, Img } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface FeatureShowcaseSceneProps {
  title: string;
  subtitle: string;
  subtitleHighlight?: string;
  screenshot1: string;
  screenshot2?: string;
  screenshot3?: string;
  capabilities?: string[];
  bottomTagline?: string;
  theme?: CommercialTheme;
}

export const FeatureShowcaseScene: React.FC<FeatureShowcaseSceneProps> = ({
  title,
  subtitle,
  subtitleHighlight,
  screenshot1,
  screenshot2,
  screenshot3,
  capabilities = [],
  bottomTagline,
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerEnter = spring({ frame: frame - 5, fps, config: { mass: 0.4, damping: 12, stiffness: 240 } });
  const subEnter = spring({ frame: frame - 18, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const screen1Enter = spring({ frame: frame - 12, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const screen2Enter = spring({ frame: frame - 85, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const screen3Enter = spring({ frame: frame - 130, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const taglineEnter = spring({ frame: frame - 160, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const glowPulse = Math.sin(frame * 0.04) * 0.15 + 0.85;

  // Parse subtitle highlight
  const subParts = subtitleHighlight && subtitle.includes(subtitleHighlight)
    ? subtitle.split(subtitleHighlight) : null;

  return (
    <SceneWrapper orbOpacity={0.5} theme={theme}>
      {/* Header badge */}
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: headerEnter,
        transform: `translateY(${(1 - headerEnter) * -30}px) scale(${0.9 + headerEnter * 0.1})`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 36px', borderRadius: theme.radius.full,
          background: theme.colors.primarySubtle,
          border: `1px solid ${theme.colors.borderBright}`,
          boxShadow: theme.shadows.glow,
        }}>
          <span style={{ fontSize: 28 }}>&#9889;</span>
          <span style={{
            fontFamily: theme.fonts.heading, fontSize: 32, fontWeight: 800,
            color: theme.colors.primary,
          }}>
            {title}
          </span>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: theme.colors.green, boxShadow: `0 0 8px ${theme.colors.greenGlow}`,
          }} />
        </div>
      </div>

      {/* Subtitle */}
      <div style={{
        position: 'absolute', top: 135, left: 0, right: 0, textAlign: 'center',
        opacity: subEnter, transform: `translateY(${(1 - subEnter) * 15}px)`,
      }}>
        <span style={{
          fontFamily: theme.fonts.heading, fontSize: 26, fontWeight: 600,
          color: theme.colors.textSecondary,
        }}>
          {subParts ? (
            <>{subParts[0]}<span style={{ color: theme.colors.primary, fontWeight: 800 }}>{subtitleHighlight}</span>{subParts[1]}</>
          ) : subtitle}
        </span>
      </div>

      {/* Capability chips */}
      {capabilities.length > 0 && (
        <div style={{
          position: 'absolute', top: 185, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', padding: '0 60px',
        }}>
          {capabilities.map((cap, i) => {
            const chipEnter = spring({ frame: frame - 22 - i * 3, fps, config: { mass: 0.3, damping: 10, stiffness: 300 } });
            return (
              <div key={cap} style={{
                opacity: chipEnter,
                transform: `scale(${0.7 + chipEnter * 0.3}) translateY(${(1 - chipEnter) * 10}px)`,
                padding: '8px 18px', borderRadius: theme.radius.full,
                background: i % 2 === 0 ? `${theme.colors.primary}0d` : `${theme.colors.accent}12`,
                border: `1px solid ${i % 2 === 0 ? theme.colors.borderBright : theme.colors.borderAccent}`,
                fontFamily: theme.fonts.body, fontSize: 15, fontWeight: 600,
                color: i % 2 === 0 ? theme.colors.primary : theme.colors.accent,
              }}>
                {cap}
              </div>
            );
          })}
        </div>
      )}

      {/* Glow */}
      <div style={{
        position: 'absolute', top: 750, left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${theme.colors.primaryGlow} 0%, transparent 60%)`,
        filter: 'blur(40px)', opacity: glowPulse * 0.6,
      }} />

      {/* Screenshot 1 */}
      <div style={{
        position: 'absolute', top: capabilities.length > 0 ? 260 : 200, left: 30, right: 30,
        opacity: screen1Enter,
        transform: `perspective(1200px) rotateX(${(1 - screen1Enter) * 12}deg) rotateY(${(1 - screen1Enter) * -5}deg) scale(${0.85 + screen1Enter * 0.15})`,
      }}>
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.12), 0 0 40px ${theme.colors.primaryGlow}`,
          border: `1px solid ${theme.colors.cardBorder}`,
        }}>
          <Img src={screenshot1} style={{ width: '100%', display: 'block' }} />
        </div>
      </div>

      {/* Screenshot 2 */}
      {screenshot2 && frame > 80 && (
        <div style={{
          position: 'absolute', top: 600, right: -40, width: 800,
          opacity: screen2Enter,
          transform: `translateX(${(1 - screen2Enter) * 200}px) rotate(${(1 - screen2Enter) * 3}deg)`,
          zIndex: 2,
        }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            boxShadow: `0 20px 60px rgba(0,0,0,0.15), 0 0 40px ${theme.colors.primaryGlow}`,
            border: `1px solid ${theme.colors.cardBorder}`,
          }}>
            <Img src={screenshot2} style={{ width: '100%', display: 'block' }} />
          </div>
        </div>
      )}

      {/* Screenshot 3 */}
      {screenshot3 && frame > 125 && (
        <div style={{
          position: 'absolute', top: 1000, left: -40, width: 750,
          opacity: screen3Enter,
          transform: `translateX(${(1 - screen3Enter) * -200}px) rotate(${(1 - screen3Enter) * -3}deg)`,
          zIndex: 3,
        }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            boxShadow: `0 20px 60px rgba(0,0,0,0.15), 0 0 40px ${theme.colors.primaryGlow}`,
            border: `1px solid ${theme.colors.cardBorder}`,
          }}>
            <Img src={screenshot3} style={{ width: '100%', display: 'block' }} />
          </div>
        </div>
      )}

      {/* Bottom tagline */}
      {bottomTagline && (
        <div style={{
          position: 'absolute', bottom: 70, left: 0, right: 0, textAlign: 'center',
          opacity: taglineEnter, transform: `translateY(${(1 - taglineEnter) * 20}px)`, zIndex: 10,
        }}>
          <div style={{
            display: 'inline-block', padding: '14px 36px', borderRadius: theme.radius.full,
            background: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.borderBright}`,
            boxShadow: theme.shadows.glowStrong,
          }}>
            <span style={{
              fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: 700,
              color: theme.colors.primary, letterSpacing: '1px',
            }}>
              {bottomTagline}
            </span>
          </div>
        </div>
      )}
    </SceneWrapper>
  );
};

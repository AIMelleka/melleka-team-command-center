import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import { LightningBolt } from '../components/Logo';
import { GlowButton } from '../components/GlowButton';
import { ParticleBurst } from '../components/Transitions';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface CTASceneProps {
  brandName: string;
  brandHighlight?: string;
  headline: string;
  headlineHighlight?: string;
  checkmarks?: string[];
  confidenceText?: string;
  buttonText: string;
  url: string;
  tagline?: string;
  theme?: CommercialTheme;
}

export const CTAScene: React.FC<CTASceneProps> = ({
  brandName,
  brandHighlight,
  headline,
  headlineHighlight,
  checkmarks = [],
  confidenceText,
  buttonText,
  url,
  tagline,
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoEnter = spring({ frame: frame - 5, fps, config: { mass: 0.4, damping: 11, stiffness: 220 } });
  const headlineEnter = spring({ frame: frame - 20, fps, config: { mass: 0.5, damping: 13, stiffness: 200 } });
  const urlEnter = spring({ frame: frame - 100, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const tagEnter = spring({ frame: frame - 115, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const ringPulse = Math.sin(frame * 0.06) * 0.3 + 0.7;
  const haloRotation = frame * 0.8;

  // Parse highlights
  const brandParts = brandHighlight && brandName.includes(brandHighlight) ? brandName.split(brandHighlight) : null;
  const headlineParts = headlineHighlight && headline.includes(headlineHighlight) ? headline.split(headlineHighlight) : null;

  return (
    <SceneWrapper orbOpacity={0.6} dotGrid={false} theme={theme}>
      <ParticleBurst startFrame={8} count={20} primaryColor={theme.colors.primary} accentColor={theme.colors.accent} />

      {/* Rotating halo */}
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        transform: `translate(-50%, -50%) rotate(${haloRotation}deg)`,
        width: 500, height: 500, borderRadius: '50%',
        background: `conic-gradient(from 0deg, ${theme.colors.primaryGlow}, transparent, ${theme.colors.accentGlow}, transparent, ${theme.colors.primaryGlow})`,
        filter: 'blur(60px)', opacity: 0.35 * logoEnter,
      }} />

      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${theme.colors.primaryGlow} 0%, transparent 55%)`,
        filter: 'blur(60px)', opacity: 0.3,
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
      }}>
        {/* Logo */}
        <div style={{
          opacity: logoEnter, transform: `scale(${0.5 + logoEnter * 0.5})`,
          marginBottom: 10, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: -30, borderRadius: '50%',
            border: `2px solid ${theme.colors.primary}`,
            opacity: ringPulse * 0.4,
            boxShadow: `0 0 ${20 + ringPulse * 30}px ${theme.colors.primaryGlow}`,
          }} />
          <LightningBolt size={140} theme={theme} />
        </div>

        {/* Brand name */}
        <div style={{ opacity: logoEnter, transform: `translateY(${(1 - logoEnter) * 15}px)` }}>
          <span style={{
            fontFamily: theme.fonts.heading, fontSize: 52, fontWeight: 800,
            color: theme.colors.textPrimary, letterSpacing: '-1px',
          }}>
            {brandParts ? (
              <>{brandParts[0]}<span style={{ color: theme.colors.primary }}>{brandHighlight}</span>{brandParts[1]}</>
            ) : brandName}
          </span>
        </div>

        {/* Headline */}
        <div style={{
          opacity: headlineEnter,
          transform: `translateY(${(1 - headlineEnter) * 30}px) scale(${0.9 + headlineEnter * 0.1})`,
        }}>
          <span style={{
            fontFamily: theme.fonts.heading, fontSize: 58, fontWeight: 800,
            color: theme.colors.textPrimary, letterSpacing: '-1px',
          }}>
            {headlineParts ? (
              <>{headlineParts[0]}<span style={{ color: theme.colors.accent }}>{headlineHighlight}</span>{headlineParts[1]}</>
            ) : headline}
          </span>
        </div>

        {/* Checkmarks */}
        {checkmarks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {checkmarks.map((text, i) => {
              const chkEnter = spring({ frame: frame - 35 - i * 15, fps, config: { mass: 0.5, damping: 13, stiffness: 200 } });
              return (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div style={{
                      opacity: chkEnter, width: 6, height: 6, borderRadius: '50%',
                      background: theme.colors.textMuted,
                    }} />
                  )}
                  <div style={{
                    opacity: chkEnter,
                    transform: `translateX(${(1 - chkEnter) * (i === 0 ? -30 : 30)}px)`,
                  }}>
                    <span style={{
                      fontFamily: theme.fonts.heading, fontSize: 26, fontWeight: 600,
                      color: theme.colors.green,
                    }}>
                      &#10003; {text}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Confidence text */}
        {confidenceText && frame > 60 && (() => {
          const confEnter = spring({ frame: frame - 60, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
          return (
            <div style={{ opacity: confEnter, transform: `translateY(${(1 - confEnter) * 15}px)`, marginTop: 4, marginBottom: 4 }}>
              <span style={{
                fontFamily: theme.fonts.body, fontSize: 24, fontWeight: 500,
                color: theme.colors.textSecondary, fontStyle: 'italic',
              }}>
                {confidenceText}
              </span>
            </div>
          );
        })()}

        <GlowButton text={buttonText} startFrame={75} large theme={theme} />

        {/* URL */}
        <div style={{ opacity: urlEnter, transform: `translateY(${(1 - urlEnter) * 15}px)`, marginTop: 10 }}>
          <span style={{
            fontFamily: theme.fonts.mono, fontSize: 32, color: theme.colors.primary,
            fontWeight: 700, letterSpacing: '1px',
          }}>
            {url}
          </span>
        </div>

        {/* Tagline */}
        {tagline && (
          <div style={{ opacity: tagEnter, transform: `translateY(${(1 - tagEnter) * 10}px)` }}>
            <span style={{
              fontFamily: theme.fonts.body, fontSize: 20, color: theme.colors.textMuted,
              letterSpacing: '2px', textTransform: 'uppercase',
            }}>
              {tagline}
            </span>
          </div>
        )}
      </div>
    </SceneWrapper>
  );
};

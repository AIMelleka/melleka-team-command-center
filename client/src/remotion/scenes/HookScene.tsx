import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import { LightningBolt } from '../components/Logo';
import { ParticleBurst } from '../components/Transitions';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface HookSceneProps {
  brandName: string;
  brandHighlight?: string;
  tagline: string;
  taglineHighlight: string;
  backgroundImage?: string;
  theme?: CommercialTheme;
}

export const HookScene: React.FC<HookSceneProps> = ({
  brandName,
  brandHighlight,
  tagline,
  taglineHighlight,
  backgroundImage,
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const boltEnter = spring({ frame: frame - 5, fps, config: { mass: 0.3, damping: 8, stiffness: 300 } });
  const flash = interpolate(frame, [10, 14, 22], [0, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wordEnter = spring({ frame: frame - 20, fps, config: { mass: 0.5, damping: 10, stiffness: 220 } });
  const tagEnter = spring({ frame: frame - 38, fps, config: { mass: 0.6, damping: 14, stiffness: 160 } });
  const bgEnter = interpolate(frame, [0, 30], [0, 0.15], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Split brandName by highlight
  const parts = brandHighlight && brandName.includes(brandHighlight)
    ? brandName.split(brandHighlight)
    : null;

  return (
    <SceneWrapper orbOpacity={0.8} dotGrid={false} theme={theme}>
      {backgroundImage && (
        <div style={{ position: 'absolute', inset: 0, opacity: bgEnter }}>
          <Img
            src={backgroundImage}
            style={{ width: 1080, height: 1920, objectFit: 'cover', filter: 'blur(20px) saturate(0.5)' }}
          />
        </div>
      )}

      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)',
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${theme.colors.primaryGlow} 0%, transparent 60%)`,
        filter: 'blur(30px)', opacity: boltEnter,
      }} />

      <ParticleBurst startFrame={12} count={24} primaryColor={theme.colors.primary} accentColor={theme.colors.accent} />

      <div style={{
        position: 'absolute', top: 700, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: boltEnter,
        transform: `scale(${0.2 + boltEnter * 0.8}) translateY(${(1 - boltEnter) * -200}px) rotate(${(1 - boltEnter) * -30}deg)`,
      }}>
        <LightningBolt size={200} theme={theme} />
      </div>

      <div style={{
        position: 'absolute', inset: 0, backgroundColor: '#ffffff', opacity: flash, pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute', top: 920, left: 0, right: 0, textAlign: 'center',
        opacity: wordEnter,
        transform: `translateY(${(1 - wordEnter) * 50}px) scale(${0.85 + wordEnter * 0.15})`,
      }}>
        <span style={{
          fontFamily: theme.fonts.heading, fontSize: 82, fontWeight: 800,
          color: theme.colors.textPrimary, letterSpacing: '-2px',
        }}>
          {parts ? (
            <>{parts[0]}<span style={{ color: theme.colors.primary }}>{brandHighlight}</span>{parts[1]}</>
          ) : brandName}
        </span>
      </div>

      <div style={{
        position: 'absolute', top: 1035, left: 0, right: 0, textAlign: 'center',
        opacity: tagEnter, transform: `translateY(${(1 - tagEnter) * 25}px)`,
      }}>
        <span style={{
          fontFamily: theme.fonts.body, fontSize: 28, fontWeight: 500,
          color: theme.colors.textSecondary, letterSpacing: '4px', textTransform: 'uppercase',
        }}>
          {tagline}
        </span>
        <br />
        <span style={{
          fontFamily: theme.fonts.body, fontSize: 36, fontWeight: 700,
          color: theme.colors.accent, letterSpacing: '4px', textTransform: 'uppercase',
        }}>
          {taglineHighlight}
        </span>
      </div>
    </SceneWrapper>
  );
};

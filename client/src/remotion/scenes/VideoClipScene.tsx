import React from 'react';
import { OffthreadVideo, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface VideoClipSceneProps {
  videoUrl: string;
  title?: string;
  subtitle?: string;
  startFrom?: number;
  endAt?: number;
  volume?: number;
  overlayPosition?: 'top' | 'center' | 'bottom';
  theme?: CommercialTheme;
}

export const VideoClipScene: React.FC<VideoClipSceneProps> = ({
  videoUrl,
  title,
  subtitle,
  startFrom = 0,
  endAt,
  volume = 0,
  overlayPosition = 'bottom',
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEnter = spring({
    frame: frame - 8,
    fps,
    config: { mass: 0.5, damping: 14, stiffness: 180 },
  });

  const subtitleEnter = spring({
    frame: frame - 18,
    fps,
    config: { mass: 0.5, damping: 14, stiffness: 180 },
  });

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: 0, justifyContent: 'flex-start', paddingTop: 120 },
    center: { top: 0, bottom: 0, justifyContent: 'center' },
    bottom: { bottom: 0, justifyContent: 'flex-end', paddingBottom: 120 },
  };

  const gradientMap: Record<string, string> = {
    top: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
    center: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.5) 70%, transparent 100%)',
    bottom: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
  };

  const hasOverlay = title || subtitle;

  return (
    <div style={{ width: 1080, height: 1920, position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>
      <OffthreadVideo
        src={videoUrl}
        startFrom={startFrom}
        endAt={endAt}
        volume={volume}
        style={{
          width: 1080,
          height: 1920,
          objectFit: 'cover',
        }}
      />

      {hasOverlay && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 60px',
            gap: 16,
            background: gradientMap[overlayPosition],
            minHeight: 400,
            ...positionStyles[overlayPosition],
          }}
        >
          {title && (
            <div style={{
              opacity: titleEnter,
              transform: `translateY(${(1 - titleEnter) * 40}px)`,
            }}>
              <span style={{
                fontFamily: theme.fonts.heading,
                fontSize: 56,
                fontWeight: 800,
                color: '#ffffff',
                textAlign: 'center',
                lineHeight: 1.2,
                letterSpacing: '-1px',
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              }}>
                {title}
              </span>
            </div>
          )}

          {subtitle && (
            <div style={{
              opacity: subtitleEnter,
              transform: `translateY(${(1 - subtitleEnter) * 30}px)`,
            }}>
              <span style={{
                fontFamily: theme.fonts.body,
                fontSize: 28,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                textAlign: 'center',
                lineHeight: 1.5,
                textShadow: '0 1px 10px rgba(0,0,0,0.4)',
              }}>
                {subtitle}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

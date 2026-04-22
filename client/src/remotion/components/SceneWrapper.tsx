import React from 'react';
import { DotGrid } from './DotGrid';
import { GlowOrbs } from './GlowOrbs';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export const SceneWrapper: React.FC<{
  children: React.ReactNode;
  theme?: CommercialTheme;
  dotGrid?: boolean;
  orbOpacity?: number;
}> = ({ children, theme = defaultTheme, dotGrid = true, orbOpacity = 0.8 }) => (
  <div
    style={{
      width: 1080,
      height: 1920,
      backgroundColor: theme.colors.bg,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: theme.gradients.subtlePrimary,
        pointerEvents: 'none',
      }}
    />
    {dotGrid && <DotGrid color={theme.colors.primaryLight} />}
    <GlowOrbs opacity={orbOpacity} />
    {children}
  </div>
);

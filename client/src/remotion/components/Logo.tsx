import React from 'react';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export const LightningBolt: React.FC<{
  size?: number;
  theme?: CommercialTheme;
}> = ({ size = 80, theme = defaultTheme }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
    <defs>
      <filter id="bolt-glow-main">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feFlood floodColor={theme.colors.primaryGlow} floodOpacity="1" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={theme.colors.primaryLight} />
        <stop offset="100%" stopColor={theme.colors.primary} />
      </linearGradient>
    </defs>
    <path
      d="M45 8L18 44h16L28 72l30-38H42L45 8z"
      fill="url(#bolt-grad)"
      filter="url(#bolt-glow-main)"
    />
  </svg>
);

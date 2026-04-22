export interface CommercialTheme {
  colors: {
    bg: string;
    bgLight: string;
    bgCard: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    primaryGlow: string;
    primarySubtle: string;
    accent: string;
    accentLight: string;
    accentGlow: string;
    white: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    green: string;
    greenGlow: string;
    red: string;
    cyan: string;
    cyanGlow: string;
    border: string;
    borderBright: string;
    borderAccent: string;
    cardBorder: string;
    cardShadow: string;
    surfaceElevated: string;
  };
  gradients: {
    primaryToAccent: string;
    primaryToCyan: string;
    heroGlow: string;
    accentShimmer: string;
    subtlePrimary: string;
  };
  shadows: {
    glow: string;
    glowStrong: string;
    glowAccent: string;
    card: string;
    cardGlow: string;
    button: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
}

export const defaultTheme: CommercialTheme = {
  colors: {
    bg: '#ffffff',
    bgLight: '#f8fafc',
    bgCard: '#ffffff',
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    primaryGlow: 'rgba(99, 102, 241, 0.25)',
    primarySubtle: 'rgba(99, 102, 241, 0.06)',
    accent: '#d97706',
    accentLight: '#f59e0b',
    accentGlow: 'rgba(217, 119, 6, 0.2)',
    white: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    green: '#16a34a',
    greenGlow: 'rgba(22, 163, 74, 0.2)',
    red: '#dc2626',
    cyan: '#0891b2',
    cyanGlow: 'rgba(8, 145, 178, 0.2)',
    border: 'rgba(99, 102, 241, 0.15)',
    borderBright: 'rgba(99, 102, 241, 0.25)',
    borderAccent: 'rgba(217, 119, 6, 0.2)',
    cardBorder: '#e2e8f0',
    cardShadow: 'rgba(0, 0, 0, 0.06)',
    surfaceElevated: '#ffffff',
  },
  gradients: {
    primaryToAccent: 'linear-gradient(135deg, #6366f1 0%, #f59e0b 100%)',
    primaryToCyan: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
    heroGlow: 'radial-gradient(600px circle at 50% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
    accentShimmer: 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.15) 50%, transparent 100%)',
    subtlePrimary: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
  },
  shadows: {
    glow: '0 0 40px rgba(99, 102, 241, 0.15)',
    glowStrong: '0 0 60px rgba(99, 102, 241, 0.2), 0 4px 20px rgba(0, 0, 0, 0.06)',
    glowAccent: '0 0 40px rgba(217, 119, 6, 0.15)',
    card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.04)',
    cardGlow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.04), 0 0 30px rgba(99, 102, 241, 0.08)',
    button: '0 4px 20px rgba(99, 102, 241, 0.3), 0 0 60px rgba(99, 102, 241, 0.15)',
  },
  fonts: {
    heading: 'Inter, system-ui, -apple-system, sans-serif',
    body: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'SF Mono, Menlo, monospace',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};

/** Create a custom theme by overriding specific colors */
export function createTheme(overrides: {
  primary?: string;
  accent?: string;
  background?: string;
}): CommercialTheme {
  const t = { ...defaultTheme, colors: { ...defaultTheme.colors }, gradients: { ...defaultTheme.gradients }, shadows: { ...defaultTheme.shadows } };
  if (overrides.primary) {
    t.colors.primary = overrides.primary;
    t.colors.primaryGlow = `${overrides.primary}40`;
    t.colors.primarySubtle = `${overrides.primary}0f`;
    t.colors.border = `${overrides.primary}26`;
    t.colors.borderBright = `${overrides.primary}40`;
  }
  if (overrides.accent) {
    t.colors.accent = overrides.accent;
    t.colors.accentGlow = `${overrides.accent}33`;
    t.colors.borderAccent = `${overrides.accent}33`;
  }
  if (overrides.background) {
    t.colors.bg = overrides.background;
  }
  return t;
}

export const DarkColors = {
  background: '#0A0A0F',
  surface: '#13131A',
  surface2: '#1C1C26',
  surfaceHigh: '#232333',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',

  accent: '#00C896',
  accentEnd: '#0EA5E9',
  accentGlow: 'rgba(0, 200, 150, 0.25)',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#5A5A7A',

  glass: {
    background: 'rgba(255,255,255,0.06)',
    backgroundStrong: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,255,255,0.10)',
  },

  severity: {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#EAB308',
    low: '#22C55E',
  },

  status: {
    submitted: '#A0A0B0',
    assigned: '#0EA5E9',
    in_progress: '#F97316',
    resolved: '#22C55E',
    closed: '#5A5A7A',
  },

  error: '#EF4444',
  success: '#22C55E',
  warning: '#EAB308',
};

export const LightColors = {
  background: '#F4F4F9',
  surface: '#FFFFFF',
  surface2: '#ECEBF5',
  surfaceHigh: '#E3E2F0',

  border: 'rgba(0,0,0,0.07)',
  borderStrong: 'rgba(0,0,0,0.13)',

  accent: '#00A87A',
  accentEnd: '#0284C7',
  accentGlow: 'rgba(0,168,122,0.20)',

  textPrimary: '#0A0A0F',
  textSecondary: '#3A3A58',
  textMuted: '#8888A4',

  glass: {
    background: 'rgba(0,0,0,0.04)',
    backgroundStrong: 'rgba(0,0,0,0.07)',
    border: 'rgba(0,0,0,0.08)',
  },

  severity: {
    critical: '#DC2626',
    high: '#EA6C0A',
    medium: '#CA8A04',
    low: '#16A34A',
  },

  status: {
    submitted: '#8888A4',
    assigned: '#0284C7',
    in_progress: '#EA6C0A',
    resolved: '#16A34A',
    closed: '#8888A4',
  },

  error: '#DC2626',
  success: '#16A34A',
  warning: '#CA8A04',
};

export type ThemeColors = typeof DarkColors;

// Default export keeps dark as the fallback for static imports
export const Colors = DarkColors;

export const Fonts = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const Typography = {
  h1: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 36, color: Colors.textPrimary },
  h2: { fontFamily: 'Poppins_600SemiBold', fontSize: 22, lineHeight: 30, color: Colors.textPrimary },
  h3: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, lineHeight: 26, color: Colors.textPrimary },
  h4: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, lineHeight: 22, color: Colors.textPrimary },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 15, lineHeight: 24, color: Colors.textPrimary },
  bodySmall: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  label: { fontFamily: 'Poppins_500Medium', fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  caption: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 16, color: Colors.textMuted },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

export const Shadow = {
  glow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const GradientColors: [string, string] = [Colors.accent, Colors.accentEnd];
export const GradientStart = { x: 0, y: 0 };
export const GradientEnd = { x: 1, y: 0 };

export const colors = {
  background: '#0d0d14',
  surface: '#111118',
  surfaceLight: '#16161e',
  border: '#1e1e28',
  borderLight: '#2a2a34',
  text: '#cccccc',
  textSecondary: '#999999',
  textMuted: '#666666',
  textDim: '#444444',
  accent: '#cccccc',
  record: '#cc3333',
  recordGlow: 'rgba(204,51,51,0.4)',
  recordBg: '#1e1218',
  warning: '#ff9900',
  danger: '#cc3333',
  success: '#4a9968',
  successBg: '#2a5533',

  // Legacy aliases for components not yet restyled
  primary: '#cccccc',
  error: '#cc3333',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  // VT323 pixel font styles (set fontFamily after font loads)
  osd: { fontSize: 11, color: '#cccccc', letterSpacing: 0.5 },
  label: { fontSize: 9, textTransform: 'uppercase' as const, color: '#666666', letterSpacing: 2 },
  title: { fontSize: 18, color: '#cccccc' },

  // System font styles
  value: { fontSize: 11, color: '#cccccc' },
  body: { fontSize: 14, color: '#cccccc' },
  caption: { fontSize: 12, color: '#999999' },

  // Legacy aliases
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: '#cccccc' },
};

// Text glow effect — use with textShadowColor + textShadowRadius
export const glowStyle = {
  textShadowColor: 'rgba(200,200,200,0.3)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 0 },
};

// Record glow effect — use with shadowColor etc.
export const recordGlowStyle = {
  shadowColor: '#cc3333',
  shadowRadius: 8,
  shadowOpacity: 0.4,
  shadowOffset: { width: 0, height: 0 },
};

// VT323 font family name (set after loading)
export const PIXEL_FONT = 'VT323_400Regular';

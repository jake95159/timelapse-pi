export const colors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceLight: '#334155',
  primary: '#60a5fa',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  label: { fontSize: 11, textTransform: 'uppercase' as const, color: colors.textMuted, letterSpacing: 1 },
};

import { Platform } from 'react-native';

const systemSans = Platform.select({
  android: 'Roboto',
  ios: 'System',
  web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  default: 'System',
});

const systemMono = Platform.select({
  android: 'monospace',
  ios: 'Menlo',
  web: '"SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
  default: 'monospace',
});

const blockSans = Platform.select({
  android: 'Roboto',
  ios: 'System',
  web: 'Impact, "Arial Black", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

const lightColors = {
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  primary: '#1D4ED8',
  primaryVariant: '#1E40AF',
  secondary: '#475569',
  secondaryVariant: '#334155',
  accent: '#2563EB',
  accentVariant: '#1D4ED8',
  success: '#047857',
  warning: '#B45309',
  error: '#DC2626',
  info: '#0369A1',
  border: '#CBD5E1',
  divider: '#E2E8F0',
  hover: '#EEF2FF',
  pressed: '#DBEAFE',
  shadow: '#000000',
  icon: '#475569',
};

const darkColors = {
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textInverse: '#0F172A',
  background: '#09090B',
  surface: '#111113',
  surfaceVariant: '#18181B',
  primary: '#60A5FA',
  primaryVariant: '#93C5FD',
  secondary: '#94A3B8',
  secondaryVariant: '#CBD5E1',
  accent: '#60A5FA',
  accentVariant: '#93C5FD',
  success: '#34D399',
  warning: '#F59E0B',
  error: '#F87171',
  info: '#38BDF8',
  border: '#334155',
  divider: '#1E293B',
  hover: '#111827',
  pressed: '#1E293B',
  shadow: '#000000',
  icon: '#CBD5E1',
};

export const Colors = {
  ...lightColors,
  dark: darkColors,
  light: lightColors,
};

export const Fonts = {
  block: blockSans,
  body: systemSans,
  caption: systemSans,
  display: systemSans,
  heading: systemSans,
  mono: systemMono,
  subheading: systemSans,
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  containerPadding: 16,
  elementGap: 8,
  sectionGap: 24,
};

export const Radius = {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 8,
  pill: 8,
};

export const Elevation = {
  level1: 'none',
  level2: 'none',
  level3: 'none',
  level4: 'none',
};

export const Transition = {
  fast: '110ms cubic-bezier(0.32, 0.72, 0, 1)',
  normal: '150ms cubic-bezier(0.32, 0.72, 0, 1)',
  slow: '220ms cubic-bezier(0.32, 0.72, 0, 1)',
};

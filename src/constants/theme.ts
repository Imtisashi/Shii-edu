/**
 * LUXURY EDUCATION THEME - Bold, refined, and unforgettable
 * Inspired by elite academic institutions and modern luxury brands
 * Dramatic typography, unexpected spatial composition, and micro-interactions
 */

import { Platform } from 'react-native';

const lightColors = {
  textPrimary: '#1A1F2E',
  textSecondary: '#4A5568',
  textMuted: '#718096',
  textInverse: '#FFFFFF',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceVariant: '#EDF2F7',
  primary: '#1A1F2E',
  primaryVariant: '#2D3748',
  secondary: '#E63946',
  secondaryVariant: '#C53030',
  accent: '#F1C40F',
  accentVariant: '#D4AF37',
  success: '#38A169',
  warning: '#D69E2E',
  error: '#E53E3E',
  info: '#3182CE',
  border: '#CBD5E0',
  divider: '#E2E8F0',
  hover: '#EBF4FF',
  pressed: '#DCE8F7',
  shadow: 'rgba(0, 0, 0, 0.08)',
  icon: '#4A5568',
};

const darkColors = {
  textPrimary: '#FFFFFF',
  textSecondary: '#A0AEC0',
  textMuted: '#718096',
  textInverse: '#1A1F2E',
  background: '#0D1117',
  surface: '#161B22',
  surfaceVariant: '#1F2937',
  primary: '#FFFFFF',
  primaryVariant: '#E2E8F0',
  secondary: '#FF6B6B',
  secondaryVariant: '#FF9292',
  accent: '#FFD93D',
  accentVariant: '#FFED4A',
  success: '#48BB78',
  warning: '#ED8936',
  error: '#F56565',
  info: '#63B3ED',
  border: '#2D3748',
  divider: '#4A5568',
  hover: 'rgba(255, 255, 255, 0.04)',
  pressed: 'rgba(255, 255, 255, 0.08)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  icon: '#A0AEC0',
};

export const Colors = {
  ...lightColors,
  light: lightColors,
  dark: darkColors,
};

// EXCEPTIONAL TYPOGRAPHY SYSTEM - Unexpected, characterful font pairings
export const Fonts = Platform.select({
  ios: {
    // Bold pairing: Playfair Display (luxury serif) + Inter (refined sans)
    display: '"Playfair Display", "Cormorant Garamond", "Georgia", serif',
    heading: '"Playfair Display", "Cormorant Garamond", "Georgia", serif',
    subheading: '"Cormorant Garamond", "Playfair Display", "Georgia", serif',
    body: '"Inter", "San Francisco", "system-ui", sans-serif',
    caption: '"Inter", "San Francisco", "system-ui", sans-serif',
    mono: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
  },
  android: {
    display: '"Playfair Display", "Cormorant Garamond", serif',
    heading: '"Playfair Display", "Cormorant Garamond", serif',
    subheading: '"Cormorant Garamond", "Playfair Display", serif',
    body: '"Inter", sans-serif',
    caption: '"Inter", sans-serif',
    mono: '"SF Mono", "Menlo", "Courier New", monospace',
  },
  default: {
    display: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    heading: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    subheading: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
    body: '"Inter", system-ui, sans-serif',
    caption: '"Inter", system-ui, sans-serif',
    mono: '"SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
  },
  web: {
    display: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    heading: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    subheading: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
    body: '"Inter", "San Francisco", "Helvetica Neue", "Arial", sans-serif',
    caption: '"Inter", "San Francisco", "Helvetica Neue", "Arial", sans-serif',
    mono: '"SF Mono", "Menlo", "Monaco", "Consolas", "Courier New", monospace',
  },
});

// SPACING SYSTEM - Generous negative space controlled density
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  // Layout-specific spacing
  containerPadding: 24,
  sectionGap: 40,
  elementGap: 12,
};

// BORDER RADIUS SYSTEM - Refined corners
export const Radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

// ELEVATION SYSTEM - Sophisticated shadows
export const Elevation = {
  level1: '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 1px 2px rgba(0, 0, 0, 0.1)',
  level2: '0px 4px 6px rgba(0, 0, 0, 0.05), 0px 1px 3px rgba(0, 0, 0, 0.1)',
  level3: '0px 8px 16px rgba(0, 0, 0, 0.08), 0px 4px 8px rgba(0, 0, 0, 0.1)',
  level4: '0px 16px 32px rgba(0, 0, 0, 0.1), 0px 8px 16px rgba(0, 0, 0, 0.15)',
};

// TRANSITION SYSTEM - Orchestrated motions
export const Transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  bouncy: '300ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

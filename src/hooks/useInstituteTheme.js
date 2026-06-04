import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useRootLayout } from '../contexts/RootLayoutContext';

const PRIMARY_COLORS = new Set([
  '#2563eb',
  '#3b82f6',
  '#4a90e2',
  '#8b5cf6',
]);

const PRIMARY_SOFT_COLORS = new Set([
  'rgba(37,99,235,0.2)',
  'rgba(59,130,246,0.12)',
  'rgba(59,130,246,0.16)',
  'rgba(59,130,246,0.18)',
  'rgba(74,144,226,0.12)',
  'rgba(74,144,226,0.16)',
  'rgba(139,92,246,0.12)',
  'rgba(139,92,246,0.14)',
  'rgba(139,92,246,0.16)',
  'rgba(139,92,246,0.18)',
]);

const TEXT_COLORS = new Set([
  '#e2e8f0',
  '#f8fafc',
]);

const TEXT_SOFT_COLORS = new Set([
  '#b9c6dd',
]);

const MUTED_COLORS = new Set([
  '#64748b',
  '#8ea4c8',
  '#94a3b8',
]);

const PAGE_COLORS = new Set([
  '#02030a',
  '#020617',
  '#0f172a',
  '#f8f9fa',
]);

const COLOR_STYLE_KEYS = new Set([
  'backgroundColor',
  'borderBottomColor',
  'borderColor',
  'borderLeftColor',
  'borderRightColor',
  'borderTopColor',
  'color',
  'overlayColor',
  'shadowColor',
  'textDecorationColor',
  'tintColor',
]);

const normalizeColor = (value) => value.replace(/\s+/g, '').toLowerCase();

const shouldKeepWhiteText = (styleName) => (
  /(active|allocate|button|btn|confirm|danger|primary|save|submit).*text/i.test(styleName)
  || /text.*(active|button|btn|primary)/i.test(styleName)
);

const rgbaMatches = (normalized, prefix) => normalized.startsWith(`rgba(${prefix},`);

const remapLegacyColor = (value, key, styleName, { brand, colors }) => {
  if (typeof value !== 'string') return value;

  const normalized = normalizeColor(value);
  const isBackground = key === 'backgroundColor';
  const isBorder = key.startsWith('border');
  const isText = key === 'color';

  if (PAGE_COLORS.has(normalized) && isBackground) return colors.page;

  if (normalized === '#ffffff' && isBackground) return colors.cardStrong;
  if (normalized === '#edf2f7' && isBackground) return colors.card;

  if (normalized === '#1a1f2e') {
    if (isText) return colors.text;
    if (isBackground || isBorder) return colors.deepBlue;
  }

  if (normalized === '#4a5568' && isText) return colors.textSoft;
  if (normalized === '#718096' && isText) return colors.muted;
  if ((normalized === '#cbd5e0' || normalized === '#e2e8f0') && isBorder) return colors.hairline;

  if (TEXT_COLORS.has(normalized) && isText) {
    return shouldKeepWhiteText(styleName) ? '#FFFFFF' : colors.text;
  }

  if (TEXT_SOFT_COLORS.has(normalized) && isText) return colors.textSoft;
  if (MUTED_COLORS.has(normalized) && isText) return colors.muted;

  if (PRIMARY_COLORS.has(normalized)) {
    if (isText || isBackground || isBorder) return colors.deepBlue;
  }

  if (PRIMARY_SOFT_COLORS.has(normalized) && isBackground) return colors.deepBlueSoft;

  if (normalized === '#334155' && (isBackground || isBorder)) return colors.hairline;

  if (rgbaMatches(normalized, '15,23,42')) {
    if (isBorder) return colors.hairline;
    if (isBackground) {
      if (
        normalized.endsWith(',0.96)') ||
        normalized.endsWith(',0.9)') ||
        normalized.endsWith(',0.88)')
      ) {
        return colors.cardStrong;
      }
      return colors.card;
    }
  }

  if (rgbaMatches(normalized, '2,3,10') || rgbaMatches(normalized, '2,6,23')) {
    if (isBackground) {
      return colors.pageElevated;
    }
  }

  if (rgbaMatches(normalized, '255,255,255')) {
    if (isBorder) return colors.hairline;
    if (isBackground) {
      return colors.pageElevated;
    }
  }

  if (normalized === 'rgba(16,185,129,0.12)' && isBackground) return colors.emeraldSoft;
  if (normalized === 'rgba(16,185,129,0.16)' && isBackground) return colors.emeraldSoft;
  if (rgbaMatches(normalized, '16,185,129') || rgbaMatches(normalized, '52,211,153')) {
    if (isBackground) return colors.emeraldSoft;
    if (isBorder) return colors.emerald;
  }

  if (rgbaMatches(normalized, '239,68,68') || rgbaMatches(normalized, '248,113,113')) {
    if (isBackground) return brand.mode === 'light' ? '#FEF2F2' : '#3B1216';
    if (isBorder) return brand.mode === 'light' ? '#FCA5A5' : '#7F1D1D';
  }

  if (rgbaMatches(normalized, '247,201,72') || rgbaMatches(normalized, '245,158,11')) {
    if (isBackground) return colors.warningSoft;
    if (isBorder) return colors.warning;
  }

  if (rgbaMatches(normalized, '37,99,235') || rgbaMatches(normalized, '59,130,246')) {
    if (isBackground) return colors.deepBlueSoft;
    if (isBorder) return colors.deepBlue;
  }

  if (rgbaMatches(normalized, '139,92,246') || rgbaMatches(normalized, '167,139,250')) {
    if (isBackground) return colors.violetSoft;
    if (isBorder) return colors.violet;
  }

  if (key === 'shadowColor' && (normalized === '#000' || normalized === '#000000' || normalized === '#0f172a')) {
    return brand.mode === 'light' ? '#0F172A' : colors.page;
  }

  return value;
};

const remapStyle = (styleName, style, rootTheme) => {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return style;

  return Object.fromEntries(
    Object.entries(flattened).map(([key, value]) => {
      if (!COLOR_STYLE_KEYS.has(key)) return [key, value];
      return [key, remapLegacyColor(value, key, styleName, rootTheme)];
    })
  );
};

export function useInstituteTheme(baseStyles) {
  const rootTheme = useRootLayout();
  const { brand, colors } = rootTheme;

  const styles = useMemo(
    () => Object.fromEntries(
      Object.entries(baseStyles).map(([styleName, style]) => [
        styleName,
        remapStyle(styleName, style, { brand, colors }),
      ])
    ),
    [baseStyles, brand, colors]
  );

  return {
    ...rootTheme,
    styles,
  };
}

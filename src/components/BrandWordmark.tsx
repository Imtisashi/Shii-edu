import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { Fonts } from '../constants/theme';
import { useRootLayout } from '../contexts/RootLayoutContext';

type BrandWordmarkSize = 'sm' | 'md' | 'lg' | 'xl';

type BrandWordmarkProps = {
  color?: string;
  size?: BrandWordmarkSize;
  style?: StyleProp<TextStyle>;
};

const WORDMARK_SIZES: Record<BrandWordmarkSize, { lead: number; rest: number; lineHeight: number }> = {
  sm: { lead: 21, lineHeight: 27, rest: 18 },
  md: { lead: 29, lineHeight: 36, rest: 24 },
  lg: { lead: 42, lineHeight: 49, rest: 32 },
  xl: { lead: 54, lineHeight: 62, rest: 41 },
};

export default function BrandWordmark({
  color,
  size = 'md',
  style,
}: BrandWordmarkProps) {
  const { colors, typography } = useRootLayout();
  const metrics = WORDMARK_SIZES[size] || WORDMARK_SIZES.md;
  const resolvedColor = color || colors.text;
  const blockFamily = typography.block || Fonts.block;

  return (
    <Text
      accessibilityLabel="Shii-Edu"
      style={[
        styles.root,
        {
          color: resolvedColor,
          fontFamily: blockFamily,
          lineHeight: metrics.lineHeight,
        },
        style,
      ]}
    >
      <Text style={[styles.lead, { fontSize: metrics.lead, lineHeight: metrics.lineHeight }]}>S</Text>
      <Text style={[styles.rest, { fontSize: metrics.rest, lineHeight: metrics.lineHeight }]}>HII-</Text>
      <Text style={[styles.lead, { fontSize: metrics.lead, lineHeight: metrics.lineHeight }]}>E</Text>
      <Text style={[styles.rest, { fontSize: metrics.rest, lineHeight: metrics.lineHeight }]}>DU</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  rest: {
    fontWeight: '800',
    letterSpacing: 0,
  },
  root: {
    fontFamily: Fonts.block,
    fontWeight: '900',
    includeFontPadding: false,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRootLayout } from '../../contexts/RootLayoutContext';

export function EnterprisePanel({ children, style }) {
  const { colors, radii } = useRootLayout();

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.cardStrong,
          borderColor: colors.hairline,
          borderRadius: radii.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ScreenIntro({ accentColor, eyebrow, subtitle, title, trailing }) {
  const { colors, typography } = useRootLayout();

  return (
    <View style={styles.intro}>
      <View style={styles.introText}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.muted }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: colors.text, fontFamily: typography.title }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSoft }]}>{subtitle}</Text> : null}
      </View>
      {trailing ? (
        <View style={[styles.trailingBox, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
          {trailing}
        </View>
      ) : null}
    </View>
  );
}

export default function StudentScreenScaffold({
  children,
  scroll = true,
  style,
}) {
  const { colors, insets, isDesktop, maxContentWidth, spacing } = useRootLayout();
  const topPadding = Math.max(insets.top, 12) + 18;
  const bottomPadding = Math.max(insets.bottom, 10) + 88;
  const contentStyle = [
    styles.content,
    {
      maxWidth: isDesktop ? maxContentWidth : undefined,
      paddingBottom: bottomPadding,
      paddingHorizontal: spacing.pageX,
      paddingTop: topPadding,
    },
    style,
  ];

  if (!scroll) {
    return (
      <View style={[styles.container, { backgroundColor: colors.page }]}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <ScrollView
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  intro: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  introText: {
    flex: 1,
    minWidth: 0,
  },
  panel: {
    borderWidth: 1,
    padding: 14,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 680,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 2,
  },
  trailingBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
});

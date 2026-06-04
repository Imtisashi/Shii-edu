import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import DynamicHeader from '../DynamicHeader';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { Radius, Spacing } from '../../constants/theme';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';

export default function InstitutionalLayout({
  userData,
  title,
  subtitle,
  children,
  actions = null,
  rightPanel = null,
  scroll = true,
  showBack = true,
}) {
  const layout = useResponsiveLayout();
  const institution = useInstitution();
  const { colors } = useRootLayout();
  const profile = userData ? institution.profile : institution.profile;
  const workflow = institution.workflow;
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
      showsVerticalScrollIndicator: false,
      contentContainerStyle: [
        styles.content,
        { paddingHorizontal: layout.horizontalPadding },
        layout.isDesktop && styles.contentDesktop,
        layout.isDesktop && { maxWidth: layout.maxContentWidth },
      ],
    }
    : {
      style: [
        styles.contentNoScroll,
        { paddingHorizontal: layout.horizontalPadding },
        layout.isDesktop && styles.contentDesktop,
        layout.isDesktop && { maxWidth: layout.maxContentWidth },
      ],
    };

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <DynamicHeader title={title} showBack={showBack} />
      <Body {...bodyProps}>
        <View style={[styles.hero, layout.isMobile && styles.heroMobile, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
          <View style={styles.heroTextBlock}>
            <Text style={[styles.modeLabel, { color: colors.accent }]}>{profile.institutionType}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textSoft }]}>{subtitle}</Text> : null}
            <View style={styles.scopeRow}>
              <View style={[styles.scopePill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
                <Text style={[styles.scopeLabel, { color: colors.muted }]}>{profile.academicRootLabel}</Text>
                <Text style={[styles.scopeValue, { color: colors.text }]}>{profile.primaryValue || 'All'}</Text>
              </View>
              <View style={[styles.scopePill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
                <Text style={[styles.scopeLabel, { color: colors.muted }]}>{profile.academicChildLabel}</Text>
                <Text style={[styles.scopeValue, { color: colors.text }]}>{profile.secondaryValue || 'All'}</Text>
              </View>
              <View style={[styles.scopePill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
                <Text style={[styles.scopeLabel, { color: colors.muted }]}>Assessment</Text>
                <Text style={[styles.scopeValue, { color: colors.text }]}>{profile.gradingLabel}</Text>
              </View>
              <View style={[styles.scopePill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
                <Text style={[styles.scopeLabel, { color: colors.muted }]}>{profile.isCollege ? 'GPA Scale' : 'Attendance'}</Text>
                <Text style={[styles.scopeValue, { color: colors.text }]}>
                  {profile.isCollege ? `${workflow.gpa.scale}-point` : 'Daily required'}
                </Text>
              </View>
            </View>
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>

        {rightPanel ? (
          <View style={[styles.split, layout.isDesktop && styles.splitDesktop]}>
            <View style={styles.mainPanel}>{children}</View>
            <View style={styles.sidePanel}>{rightPanel}</View>
          </View>
        ) : children}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: Spacing.lg, paddingBottom: 96 },
  contentNoScroll: { flex: 1, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  contentDesktop: { width: '100%', alignSelf: 'center' },
  hero: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  heroMobile: {
    padding: Spacing.lg,
    flexDirection: 'column',
  },
  heroTextBlock: { flex: 1 },
  modeLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.xs,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  scopePill: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  scopeLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scopeValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  actions: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  split: { gap: Spacing.lg },
  splitDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  mainPanel: { flex: 1.6, minWidth: 0 },
  sidePanel: { flex: 1, minWidth: 0 },
});

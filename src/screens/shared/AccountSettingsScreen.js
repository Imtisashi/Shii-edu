import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';

function SettingPanel({ body, icon, title }) {
  const { colors, radii } = useRootLayout();

  return (
    <View style={[styles.panel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
      <View style={[styles.iconFrame, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.panelCopy}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.panelBody, { color: colors.textSoft }]}>{body}</Text>
      </View>
    </View>
  );
}

export default function AccountSettingsScreen() {
  const { logout, userData } = useAuth();
  const { brand, colors, insets, isDesktop, maxContentWidth, radii, spacing, typography } = useRootLayout();
  const role = String(userData?.role || 'workspace').trim().toLowerCase() || 'workspace';

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Settings" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: isDesktop ? maxContentWidth : undefined,
            paddingBottom: Math.max(insets.bottom, 10) + spacing.xxl,
            paddingHorizontal: spacing.pageX,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>Workspace settings</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: typography.block }]}>{brand.name}</Text>
          <Text style={[styles.subtitle, { color: colors.textSoft }]}>
            {role.charAt(0).toUpperCase() + role.slice(1)} access is scoped to this institute.
          </Text>
        </View>

        <SettingPanel
          icon="shield-checkmark-outline"
          title="Session security"
          body="Role, institute, and credential checks are applied before workspace data is shown."
        />
        <SettingPanel
          icon="color-palette-outline"
          title="Institute branding"
          body="Logo, palette, and workspace identity are controlled by the institute administrator."
        />
        <SettingPanel
          icon="notifications-outline"
          title="Notifications"
          body="Broadcasts and alerts follow your assigned institute role."
        />

        <TouchableOpacity
          accessibilityLabel="Sign out"
          onPress={logout}
          style={[styles.signOutButton, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.button }]}
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    paddingTop: 18,
    width: '100%',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerBlock: {
    marginBottom: 14,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  panel: {
    alignItems: 'flex-start',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 15,
  },
  panelBody: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  panelCopy: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  screen: {
    flex: 1,
  },
  signOutButton: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 50,
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 36,
    marginTop: 5,
    textTransform: 'uppercase',
  },
});

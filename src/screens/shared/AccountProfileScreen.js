import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import EditableProfileAvatar from '../../components/profile/EditableProfileAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const getField = (...values) => values.find((value) => typeof value === 'string' && value.trim()) || 'Not set';

function DetailRow({ icon, label, value }) {
  const { colors } = useRootLayout();

  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.hairline }]}>
      <View style={[styles.detailIcon, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text>
        <Text numberOfLines={2} style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function AccountProfileScreen() {
  const { currentUser, logout, userData } = useAuth();
  const { brand, colors, insets, isDesktop, maxContentWidth, radii, spacing, typography } = useRootLayout();
  const displayName = getField(userData?.name, userData?.displayName, currentUser?.displayName, 'Workspace user');
  const role = getField(userData?.role, 'Institute user');
  const email = getField(userData?.email, currentUser?.email);
  const userId = getField(userData?.loginId, userData?.uniqueId, userData?.studentId, userData?.teacherCode, userData?.uid, currentUser?.uid);

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Profile" />
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
        <View style={[styles.profileCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <EditableProfileAvatar size={78} />
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text, fontFamily: typography.title }]}>{displayName}</Text>
            <Text style={[styles.role, { color: colors.textSoft }]}>{role}</Text>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Account</Text>
          <DetailRow icon="mail-outline" label="Email" value={email} />
          <DetailRow icon="id-card-outline" label="User ID" value={userId} />
          <DetailRow icon="shield-checkmark-outline" label="Role" value={role} />
          <DetailRow icon="business-outline" label="Institute" value={brand.name} />
        </View>

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
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  detailRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 2,
  },
  name: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
  },
  panel: {
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  profileCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  role: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'capitalize',
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
    marginTop: 14,
    minHeight: 50,
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '900',
  },
});

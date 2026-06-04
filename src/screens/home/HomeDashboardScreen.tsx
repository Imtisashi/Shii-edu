/* eslint-disable react-hooks/immutability */
import React, { memo } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import EdgeDrawerButton from '../../components/navigation/EdgeDrawerButton';
import EditableProfileAvatar from '../../components/profile/EditableProfileAvatar';
import { useRootLayout } from '../../contexts/RootLayoutContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type HomeDashboardAction = {
  accessibilityLabel?: string;
  color: string;
  icon: IoniconName;
  key: string;
  onPress: () => void;
  softColor: string;
  subtitle: string;
  title: string;
};

export type HomeDashboardNotice = {
  id: string;
  meta: string;
  onPress?: () => void;
  title: string;
};

type HomeDashboardScreenProps = {
  displayName: string;
  greetingLabel?: string;
  instituteName: string;
  notices?: HomeDashboardNotice[];
  onLogout?: () => void;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  primaryActions: HomeDashboardAction[];
  profileMeta?: string[];
  secondaryActions?: HomeDashboardAction[];
  title?: string;
  unreadCount?: number;
};

const pressTiming = {
  duration: 110,
  easing: Easing.bezier(0.32, 0.72, 0, 1),
};

const getInitials = (value: string) => value
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word.charAt(0).toUpperCase())
  .join('') || 'IN';

function NotificationButton({
  count,
  onPress,
}: {
  count: number;
  onPress?: () => void;
}) {
  const { brand, colors, radii } = useRootLayout();
  const pressed = useSharedValue(0);

  const animatedButton = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pressed.value, [0, 1], [1, 0.98]),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={count > 0 ? `${count} unread notifications` : 'Open notifications'}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, pressTiming);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, pressTiming);
      }}
      style={styles.headerIconPressable}
    >
      <Animated.View
        style={[
          styles.notificationShell,
          {
            backgroundColor: colors.cardStrong,
            borderColor: colors.hairline,
            borderRadius: radii.control,
          },
          animatedButton,
        ]}
      >
        <Ionicons name="notifications-outline" size={21} color={colors.text} />
        {count > 0 ? (
          <View style={[styles.notificationBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.notificationBadgeText, { color: brand.mode === 'light' ? '#FFFFFF' : '#020617' }]}>
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const DashboardCard = memo(function DashboardCard({
  action,
  singleColumn,
}: {
  action: HomeDashboardAction;
  singleColumn: boolean;
}) {
  const { colors, isCompact, radii } = useRootLayout();
  const pressed = useSharedValue(0);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pressed.value, [0, 1], [1, 0.985]),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel || `Open ${action.title}`}
      accessibilityRole="button"
      onPress={action.onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, pressTiming);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, pressTiming);
      }}
      style={[styles.cardPressable, singleColumn && styles.cardPressableSingle]}
    >
      <Animated.View
        style={[
          styles.dashboardCard,
          {
            backgroundColor: colors.cardStrong,
            borderColor: colors.hairline,
            borderRadius: radii.card,
          },
          animatedCard,
        ]}
      >
        <View style={[styles.iconCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
          <Ionicons name={action.icon} size={isCompact ? 22 : 24} color={action.color} />
        </View>
        <View style={styles.cardTextBlock}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.text }]}>
            {action.title}
          </Text>
          <Text numberOfLines={2} style={[styles.cardSubtitle, { color: colors.textSoft }]}>
            {action.subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Animated.View>
    </Pressable>
  );
});

const SecondaryActionButton = memo(function SecondaryActionButton({
  action,
}: {
  action: HomeDashboardAction;
}) {
  const { colors, radii } = useRootLayout();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pressed.value, [0, 1], [1, 0.985]),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel || `Open ${action.title}`}
      accessibilityRole="button"
      onPress={action.onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, pressTiming);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, pressTiming);
      }}
      style={styles.secondaryPressable}
    >
      <Animated.View
        style={[
          styles.secondaryAction,
          {
            backgroundColor: colors.cardStrong,
            borderColor: colors.hairline,
            borderRadius: radii.control,
          },
          animatedStyle,
        ]}
      >
        <View style={[styles.secondaryIcon, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
          <Ionicons name={action.icon} size={17} color={action.color} />
        </View>
        <Text numberOfLines={1} style={[styles.secondaryLabel, { color: colors.text }]}>
          {action.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export default function HomeDashboardScreen({
  displayName,
  greetingLabel = 'Welcome back',
  instituteName,
  notices = [],
  onLogout,
  onOpenMenu,
  onOpenNotifications,
  primaryActions,
  profileMeta = [],
  secondaryActions = [],
  title = 'Home',
  unreadCount = 0,
}: HomeDashboardScreenProps) {
  const { brand, colors, insets, isCompact, isDesktop, maxContentWidth, radii, spacing, typography, viewport } = useRootLayout();
  const dashboardActions = primaryActions.slice(0, 4);
  const safeProfileMeta = profileMeta.filter(Boolean).slice(0, 3);
  const safeNotices = notices.slice(0, 3);
  const singleColumn = viewport.width < 520;
  const instituteInitials = getInitials(instituteName);
  const headerTop = Math.max(insets.top, Platform.OS === 'web' ? 8 : 10);
  const headerHeight = headerTop + 60;
  const tabSafeBottom = Math.max(insets.bottom, 10) + 78;
  const desktopFrameStyle = isDesktop
    ? { maxWidth: Math.min(maxContentWidth, viewport.width - spacing.pageX * 2), width: '100%' as const }
    : { width: '100%' as const };

  const renderNotice = ({ item, index }: { item: HomeDashboardNotice; index: number }) => (
    <Pressable
      accessibilityLabel={`Open notice ${item.title}`}
      accessibilityRole="button"
      onPress={item.onPress}
      style={[
        styles.noticeRow,
        {
          borderBottomColor: colors.hairline,
          borderBottomWidth: index === safeNotices.length - 1 ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.noticeIcon, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
        <Ionicons name="megaphone-outline" size={16} color={colors.accent} />
      </View>
      <View style={styles.noticeTextBlock}>
        <Text numberOfLines={1} style={[styles.noticeTitle, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.noticeMeta, { color: colors.muted }]}>
          {item.meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar barStyle={brand.mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor={colors.page} />

      <View
        style={[
          styles.edgeHeader,
          {
            backgroundColor: colors.header,
            borderBottomColor: colors.hairline,
            height: headerHeight,
            paddingHorizontal: spacing.pageX,
            paddingTop: headerTop,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {onOpenMenu ? <EdgeDrawerButton onPress={onOpenMenu} size={isCompact ? 38 : 42} /> : null}
        </View>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text, fontFamily: typography.title }]}>
          {title}
        </Text>
        <View style={styles.headerRight}>
          <NotificationButton count={unreadCount} onPress={onOpenNotifications} />
        </View>
      </View>

      <ScrollView
        alwaysBounceVertical={false}
        bounces
        contentContainerStyle={[
          styles.scrollContent,
          {
            alignItems: 'center',
            paddingBottom: tabSafeBottom,
            paddingHorizontal: spacing.pageX,
            paddingTop: headerHeight + 14,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={[styles.contentFrame, desktopFrameStyle]}>
          <View
            style={[
              styles.profilePanel,
              {
                backgroundColor: colors.cardStrong,
                borderColor: colors.hairline,
                borderRadius: radii.hero,
              },
              singleColumn && styles.profilePanelPhone,
            ]}
          >
            <View style={styles.heroTopRow}>
              <EditableProfileAvatar size={isCompact ? 56 : 64} />
              <View style={styles.heroTextBlock}>
                <Text numberOfLines={1} style={[styles.greeting, { color: colors.textSoft, fontFamily: typography.caption }]}>
                  {greetingLabel}
                </Text>
                <Text numberOfLines={1} style={[styles.displayName, singleColumn && styles.displayNamePhone, { color: colors.text, fontFamily: typography.display }]}>
                  {displayName}
                </Text>
              </View>
            </View>

            <View style={[styles.institutionStrip, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <View style={[styles.institutionMark, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
                {brand.logoUrl ? (
                  <Image
                    accessibilityLabel={`${instituteName} logo`}
                    resizeMode="contain"
                    source={{ uri: brand.logoUrl }}
                    style={styles.institutionLogo}
                  />
                ) : (
                  <Text style={[styles.institutionInitials, { color: colors.accent, fontFamily: typography.title }]}>
                    {instituteInitials}
                  </Text>
                )}
              </View>
              <View style={styles.institutionCopy}>
                <Text numberOfLines={1} style={[styles.institutionLabel, { color: colors.muted }]}>
                  Workspace
                </Text>
                <Text numberOfLines={2} style={[styles.instituteName, { color: colors.text, fontFamily: typography.title }]}>
                  {instituteName}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              {safeProfileMeta.map((meta) => (
                <View key={meta} style={[styles.metaPill, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                  <Text numberOfLines={1} style={[styles.metaText, { color: colors.textSoft }]}>
                    {meta}
                  </Text>
                </View>
              ))}
              <View style={[styles.livePill, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                <Text numberOfLines={1} style={[styles.liveText, { color: colors.text }]}>
                  Active workspace
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: typography.title }]}>
              Dashboard
            </Text>
          </View>

          <View style={[styles.dashboardGrid, singleColumn && styles.dashboardGridPhone]}>
            {dashboardActions.map((action) => (
              <DashboardCard action={action} key={action.key} singleColumn={singleColumn} />
            ))}
          </View>

          {secondaryActions.length > 0 ? (
            <>
              <Text style={[styles.compactSectionTitle, { color: colors.text }]}>Quick access</Text>
              <View style={styles.secondaryGrid}>
                {secondaryActions.map((action) => (
                  <SecondaryActionButton action={action} key={action.key} />
                ))}
              </View>
            </>
          ) : null}

          <View
            style={[
              styles.noticePanel,
              {
                backgroundColor: colors.cardStrong,
                borderColor: colors.hairline,
                borderRadius: radii.card,
              },
            ]}
          >
            <View style={styles.noticeHeader}>
              <Text style={[styles.compactSectionTitle, { color: colors.text }]}>Recent broadcasts</Text>
              {unreadCount > 0 ? (
                <View style={[styles.unreadPill, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                  <Text style={[styles.unreadText, { color: colors.text }]}>{unreadCount} new</Text>
                </View>
              ) : null}
            </View>

            {safeNotices.length === 0 ? (
              <View style={styles.emptyNotice}>
                <Ionicons name="information-circle-outline" size={22} color={colors.muted} />
                <Text style={[styles.emptyNoticeText, { color: colors.muted }]}>No recent announcements.</Text>
              </View>
            ) : (
              <FlatList
                data={safeNotices}
                keyExtractor={(item) => item.id}
                renderItem={renderNotice}
                scrollEnabled={false}
              />
            )}
          </View>

          {onLogout ? (
            <Pressable
              accessibilityLabel="Secure sign out"
              accessibilityRole="button"
              onPress={onLogout}
              style={[
                styles.logoutButton,
                {
                  backgroundColor: colors.cardStrong,
                  borderColor: colors.hairline,
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.logoutText}>Sign out</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    flexBasis: '48.5%',
    maxWidth: '48.5%',
    minWidth: 0,
  },
  cardPressableSingle: {
    flexBasis: '100%',
    maxWidth: '100%',
    width: '100%',
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  cardTextBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  compactSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  contentFrame: {
    alignSelf: 'center',
  },
  dashboardCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dashboardGridPhone: {
    gap: 10,
    marginBottom: 18,
  },
  displayName: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 31,
  },
  displayNamePhone: {
    fontSize: 23,
    lineHeight: 29,
  },
  edgeHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  emptyNotice: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 82,
  },
  emptyNoticeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
  },
  headerIconPressable: {
    height: 42,
    width: 42,
  },
  headerLeft: {
    alignItems: 'flex-start',
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    minWidth: 0,
  },
  iconCell: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  instituteName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 22,
  },
  institutionCopy: {
    flex: 1,
    minWidth: 0,
  },
  institutionInitials: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  institutionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 2,
  },
  institutionLogo: {
    height: 38,
    width: 38,
  },
  institutionMark: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  institutionStrip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  liveDot: {
    borderRadius: 8,
    height: 7,
    width: 7,
  },
  livePill: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  logoutButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 18,
    padding: 14,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  metaPill: {
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  noticeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noticeIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  noticeMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  noticePanel: {
    borderWidth: 1,
    marginTop: 2,
    padding: 16,
  },
  noticeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingVertical: 10,
  },
  noticeTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  notificationBadge: {
    alignItems: 'center',
    borderRadius: 8,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  notificationShell: {
    alignItems: 'center',
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  profilePanel: {
    borderWidth: 1,
    marginBottom: 20,
    padding: 18,
  },
  profilePanelPhone: {
    marginBottom: 18,
    padding: 16,
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    minHeight: '100%',
  },
  secondaryAction: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  secondaryIcon: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  secondaryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 0,
  },
  secondaryPressable: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 104,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  unreadPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

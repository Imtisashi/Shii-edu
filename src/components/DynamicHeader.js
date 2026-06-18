import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { OptimizedImage } from '../OptimizedImage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { useRootLayout } from '../contexts/RootLayoutContext';
import EdgeDrawerButton from './navigation/EdgeDrawerButton';
import { openNearestDrawer } from '../navigation/openNearestDrawer';

export default function DynamicHeader({ title, showBack = false }) {
  const { userData } = useAuth();
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const { brand, colors, controls, insets, spacing, typography } = useRootLayout();

  const handleBellPress = () => {
    const role = userData?.role?.trim().toLowerCase();
    try {
      if (role === 'student') {
        navigation.navigate('Notifications');
        return;
      }
      if (role === 'teacher') {
        navigation.navigate('TeacherNotifs');
        return;
      }
      if (role === 'admin') {
        navigation.navigate('MainTabs', { screen: 'Broadcasts' });
        return;
      }
      if (role === 'parent') {
        navigation.navigate('Notifications');
        return;
      }
    } catch (error) {
      console.warn('Notification navigation failed', error);
    }

    Alert.alert('Notifications', 'No notification center is configured for this role yet.');
  };

  const returnToRoleHome = () => {
    const role = userData?.role?.trim().toLowerCase();

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (role === 'teacher') {
      navigation.navigate('TeacherHome');
      return;
    }

    if (role === 'student') {
      navigation.navigate('Home');
      return;
    }

    if (role === 'admin') {
      navigation.navigate('MainTabs');
      return;
    }

    if (role === 'parent') {
      navigation.navigate('ParentHome');
      return;
    }

    if (role === 'driver') {
      navigation.navigate('DriverFleet');
      return;
    }

    if (role === 'superadmin') {
      navigation.navigate('SuperAdminHome');
    }
  };

  const instituteName = brand.name;
  const logoUrl = brand.logoUrl;
  const logoSize = layout.isCompact ? 34 : 40;
  const hasDrawer = Boolean(navigation.openDrawer || navigation.getParent?.()?.openDrawer || navigation.getParent?.()?.getParent?.()?.openDrawer);
  const monogram = instituteName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'EH';
  const topPadding = Platform.OS === 'web'
    ? Math.max(insets.top, layout.isMobile ? 10 : 14)
    : Math.max(insets.top, 20) + 6;
  const openMenu = () => {
    openNearestDrawer(navigation);
  };

  return (
    <View
      style={[
        styles.headerContainer,
        layout.isMobile && styles.headerContainerMobile,
        layout.isWeb && layout.isMobile && styles.headerContainerMobileWeb,
        layout.isDesktop && styles.headerContainerDesktop,
        {
          backgroundColor: colors.header,
          borderBottomColor: colors.hairline,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.pageX,
          paddingTop: topPadding,
        },
      ]}
    >
      <View style={[styles.headerContent, layout.isDesktop && { maxWidth: layout.maxContentWidth }]}>
        <View style={styles.leftSection}>
          {showBack ? (
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={returnToRoleHome}
              style={[
                styles.backButton,
                {
                  backgroundColor: colors.cardStrong,
                  borderColor: colors.hairline,
                  minHeight: controls.touchTarget,
                  minWidth: controls.touchTarget,
                },
              ]}
            >
              <Ionicons name="arrow-back" size={layout.isCompact ? 20 : 22} color={colors.textSoft} />
            </Pressable>
          ) : hasDrawer ? (
            <View style={styles.menuButtonWrap}>
              <EdgeDrawerButton onPress={openMenu} size={layout.isCompact ? 38 : 42} />
            </View>
          ) : null}

          {logoUrl ? (
            <OptimizedImage
              source={{ uri: logoUrl }}
              style={[
                styles.logo,
                layout.isCompact && styles.logoCompact,
                { height: logoSize, width: logoSize },
              ]}
              contentFit="contain"
            />
          ) : (
            <View
              style={[
                styles.placeholderLogo,
                layout.isCompact && styles.placeholderLogoCompact,
                {
                  backgroundColor: colors.cardStrong,
                  borderColor: colors.hairline,
                  height: logoSize,
                  width: logoSize,
                },
              ]}
            >
              <Text
                style={[
                  styles.monogramText,
                  layout.isCompact && styles.monogramTextCompact,
                  { color: colors.accent, fontFamily: typography.title },
                ]}
              >
                {monogram}
              </Text>
            </View>
          )}

          <View style={styles.textContainer}>
            <Text style={[styles.instituteName, layout.isCompact && styles.instituteNameCompact, { color: colors.text, fontFamily: typography.block }]} numberOfLines={1}>
              {instituteName}
            </Text>
            {title ? <Text style={[styles.pageTitle, layout.isCompact && styles.pageTitleCompact, { color: colors.text, fontFamily: typography.title }]} numberOfLines={1}>{title}</Text> : null}
          </View>
        </View>

        <View style={styles.rightActions}>
          {showBack && hasDrawer ? (
            <EdgeDrawerButton onPress={openMenu} size={layout.isCompact ? 38 : 42} />
          ) : null}
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            onPress={handleBellPress}
            style={[
              styles.notificationButton,
              layout.isCompact && styles.notificationButtonCompact,
              {
                backgroundColor: colors.cardStrong,
                borderColor: colors.hairline,
                minHeight: controls.touchTarget,
                minWidth: controls.touchTarget,
              },
            ]}
          >
            <Ionicons name="notifications-outline" size={layout.isCompact ? 20 : 22} color={colors.textSoft} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  headerContainer: {
    alignItems: 'center',
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  headerContainerDesktop: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 22,
  },
  headerContainerMobile: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  headerContainerMobileWeb: {
    paddingTop: 14,
  },
  headerContent: {
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  instituteName: {
    color: '#64748B',
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  instituteNameCompact: {
    fontSize: 12,
  },
  leftSection: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  logo: {
    borderRadius: Radius.md,
    marginRight: Spacing.md,
  },
  logoCompact: {
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
  },
  monogramText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  monogramTextCompact: {
    fontSize: 12,
  },
  notificationButton: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  notificationButtonCompact: {
    borderRadius: Radius.sm,
  },
  pageTitle: {
    color: '#F8FAFC',
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  pageTitleCompact: {
    fontSize: 16,
  },
  placeholderLogo: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  placeholderLogoCompact: {
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
  },
  menuButtonWrap: {
    marginRight: Spacing.md,
  },
  rightActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
});

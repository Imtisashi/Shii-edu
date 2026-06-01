import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import BrandLogo from './BrandLogo';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function DynamicHeader({ title, showBack = false }) {
  const { userData } = useAuth();
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-12)).current;
  const bellScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Luxury staggered entrance with enhanced easing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 50,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // Subtle pulse for luxury feel
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [fadeAnim, pulseAnim, slideAnim]);

  const handleBellPress = () => {
    Haptics.selectionAsync();
    // Luxury bell animation with overshoot
    Animated.sequence([
      Animated.spring(bellScale, { toValue: 0.85, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(bellScale, { toValue: 1.1, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(bellScale, { toValue: 0.95, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(bellScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

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

    if (role === 'superadmin') {
      navigation.navigate('SuperAdminHome');
    }
  };

  // Fallback to placeholders if the institute hasn't configured them yet
  const instituteData = userData?.instituteData;
  const instituteName = instituteData?.name || "Shii Edu";
  const logoUrl = instituteData?.logoUrl || null;
  const logoSize = layout.isCompact ? 36 : 44; // Slightly larger for luxury feel

  return (
    <Animated.View
      style={[
        styles.luxuryHeaderContainer,
        layout.isMobile && styles.luxuryHeaderContainerMobile,
        layout.isWeb && layout.isMobile && styles.luxuryHeaderContainerMobileWeb,
        layout.isDesktop && styles.luxuryHeaderContainerDesktop,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.luxuryHeaderContent, layout.isDesktop && { maxWidth: layout.maxContentWidth }]}>
        <View style={styles.luxuryLeftSection}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                returnToRoleHome();
              }}
              style={[styles.luxuryBackButton, { minWidth: layout.touchTarget, minHeight: layout.touchTarget }]}
            >
              <Ionicons name="arrow-back" size={layout.isCompact ? 22 : 26} color={Colors.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {/* Dynamic Logo with luxury enhancement */}
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={[styles.luxuryLogo, layout.isCompact && styles.luxuryLogoCompact]} resizeMode="contain" />
          ) : (
            <View style={[styles.luxuryPlaceholderLogo, layout.isCompact && styles.luxuryPlaceholderLogoCompact]}>
              <BrandLogo size={logoSize} />
            </View>
          )}

          {/* Dynamic Name or Page Title with luxury typography */}
          <View style={styles.luxuryTextContainer}>
            <Text style={[styles.luxuryInstituteName, layout.isCompact && styles.luxuryInstituteNameCompact]} numberOfLines={1}>
              {instituteName}
            </Text>
            {title && <Text style={[styles.luxuryPageTitle, layout.isCompact && styles.luxuryPageTitleCompact]} numberOfLines={1}>{title}</Text>}
          </View>
        </View>

        {/* Notification Bell (Global feature for all 3 UIs) with luxury enhancement */}
        <TouchableOpacity
          style={[
            styles.luxuryNotificationButton,
            layout.isCompact && styles.luxuryNotificationButtonCompact,
            { minWidth: layout.touchTarget, minHeight: layout.touchTarget },
          ]}
          onPress={handleBellPress}
          accessibilityLabel="Open notifications"
        >
          <Animated.View style={{ transform: [{ scale: bellScale }, { scale: pulseAnim }] }}>
            <Ionicons name="notifications-outline" size={layout.isCompact ? 22 : 26} color={Colors.textSecondary} />
          </Animated.View>
          {/* Optional: Add a red dot badge here if unread notifications exist */}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  luxuryHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.select({
      ios: 60, // Accounts for iOS status bar safely with luxury spacing
      android: 50,
      web: 30,
      default: 50,
    }),
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  luxuryHeaderContainerDesktop: {
    paddingTop: 30,
    paddingHorizontal: Spacing.xxl,
  },
  luxuryHeaderContainerMobile: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  luxuryHeaderContainerMobileWeb: {
    paddingTop: 20,
  },
  luxuryHeaderContent: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  luxuryLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  luxuryBackButton: {
    marginRight: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hover,
  },
  luxuryLogo: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    marginRight: Spacing.lg,
  },
  luxuryLogoCompact: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    marginRight: Spacing.md,
  },
  luxuryPlaceholderLogo: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    backgroundColor: Colors.surfaceVariant,
  },
  luxuryPlaceholderLogoCompact: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    backgroundColor: Colors.surfaceVariant,
  },
  luxuryTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  luxuryInstituteName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.25,
    fontFamily: Fonts.heading,
  },
  luxuryInstituteNameCompact: {
    fontSize: 14,
  },
  luxuryPageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontFamily: Fonts.heading,
  },
  luxuryPageTitleCompact: {
    fontSize: 18,
  },
  luxuryNotificationButton: {
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  luxuryNotificationButtonCompact: {
    padding: Spacing.xs,
  },
});

import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import BrandLogo from './BrandLogo';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function DynamicHeader({ title, showBack = false }) {
  const { userData } = useAuth();
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-12)).current;
  const bellScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleBellPress = () => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.spring(bellScale, { toValue: 0.9, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(bellScale, { toValue: 1, friction: 5, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    const role = userData?.role?.trim().toLowerCase();
    try {
      if (role === 'student') {
        navigation.navigate('MainTabs', { screen: 'Notices' });
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

  // Fallback to placeholders if the institute hasn't configured them yet
  const instituteData = userData?.instituteData;
  const instituteName = instituteData?.name || "Shii Edu";
  const logoUrl = instituteData?.logoUrl || null; 
  const logoSize = layout.isCompact ? 34 : 40;

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        layout.isMobile && styles.headerContainerMobile,
        layout.isWeb && layout.isMobile && styles.headerContainerMobileWeb,
        layout.isDesktop && styles.headerContainerDesktop,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.headerContent, layout.isDesktop && { maxWidth: layout.maxContentWidth }]}>
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }}
              style={[styles.backButton, { minWidth: layout.touchTarget, minHeight: layout.touchTarget }]}
            >
              <Ionicons name="arrow-back" size={layout.isCompact ? 21 : 24} color="#2D3748" />
            </TouchableOpacity>
          ) : null}

          {/* Dynamic Logo */}
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={[styles.logo, layout.isCompact && styles.logoCompact]} resizeMode="contain" />
          ) : (
            <View style={[styles.placeholderLogo, layout.isCompact && styles.placeholderLogoCompact]}>
              <BrandLogo size={logoSize} />
            </View>
          )}

          {/* Dynamic Name or Page Title */}
          <View style={styles.textContainer}>
            <Text style={[styles.instituteName, layout.isCompact && styles.instituteNameCompact]} numberOfLines={1}>
              {instituteName}
            </Text>
            {title && <Text style={[styles.pageTitle, layout.isCompact && styles.pageTitleCompact]} numberOfLines={1}>{title}</Text>}
          </View>
        </View>

        {/* Notification Bell (Global feature for all 3 UIs) */}
        <TouchableOpacity
          style={[
            styles.notificationButton,
            layout.isCompact && styles.notificationButtonCompact,
            { minWidth: layout.touchTarget, minHeight: layout.touchTarget },
          ]}
          onPress={handleBellPress}
          accessibilityLabel="Open notifications"
        >
          <Animated.View style={{ transform: [{ scale: bellScale }] }}>
            <Ionicons name="notifications-outline" size={layout.isCompact ? 21 : 24} color="#2D3748" />
          </Animated.View>
          {/* Optional: Add a red dot badge here if unread notifications exist */}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50, // Accounts for iOS/Android status bar safely
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerContainerDesktop: {
    paddingTop: 22,
    paddingHorizontal: 32,
  },
  headerContainerMobile: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  headerContainerMobileWeb: {
    paddingTop: 16,
  },
  headerContent: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  logoCompact: {
    width: 34,
    height: 34,
    borderRadius: 7,
    marginRight: 9,
  },
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderLogoCompact: {
    width: 34,
    height: 34,
    borderRadius: 7,
    marginRight: 9,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  instituteName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  instituteNameCompact: {
    fontSize: 12,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  pageTitleCompact: {
    fontSize: 16,
  },
  notificationButton: {
    padding: 8,
    backgroundColor: '#F7FAFC',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButtonCompact: {
    padding: 6,
  },
});

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function DynamicHeader({ title, showBack = false }) {
  const { userData } = useAuth();
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-12)).current;
  const bellScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const pulseBell = () => {
    Animated.sequence([
      Animated.spring(bellScale, { toValue: 0.9, useNativeDriver: true }),
      Animated.spring(bellScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  // Fallback to placeholders if the institute hasn't configured them yet
  const instituteData = userData?.instituteData;
  const instituteName = instituteData?.name || "Institute Portal";
  const logoUrl = instituteData?.logoUrl || null; 

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2D3748" />
          </TouchableOpacity>
        ) : null}

        {/* Dynamic Logo */}
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.placeholderLogo}>
            <Ionicons name="school" size={20} color="#fff" />
          </View>
        )}
        
        {/* Dynamic Name or Page Title */}
        <View style={styles.textContainer}>
          <Text style={styles.instituteName} numberOfLines={1}>
            {instituteName}
          </Text>
          {title && <Text style={styles.pageTitle}>{title}</Text>}
        </View>
      </View>

      {/* Notification Bell (Global feature for all 3 UIs) */}
      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={pulseBell}
      >
        <Animated.View style={{ transform: [{ scale: bellScale }] }}>
          <Ionicons name="notifications-outline" size={24} color="#2D3748" />
        </Animated.View>
        {/* Optional: Add a red dot badge here if unread notifications exist */}
      </TouchableOpacity>
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
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4A90E2', // Default theme color
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  pageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  notificationButton: {
    padding: 8,
    backgroundColor: '#F7FAFC',
    borderRadius: 50,
  },
});

import React, { useRef, useEffect } from 'react';
import { Animated, Platform, TouchableWithoutFeedback, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ENABLE_MOTION = Platform.OS !== 'web';

const getCardWidth = (columns) => {
  if (columns >= 4) return '23.5%';
  if (columns === 3) return '31.8%';
  return '48%';
};

const triggerImpact = (style) => {
  Haptics.impactAsync(style).catch(() => {});
};

export default function PremiumActionCard({ title, icon, color, bgColor, delay, onPress, columns = 2, compact = false, style }) {
  const scaleAnim = useRef(new Animated.Value(ENABLE_MOTION ? 0.8 : 1)).current;
  const fadeAnim = useRef(new Animated.Value(ENABLE_MOTION ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(ENABLE_MOTION ? 40 : 0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ENABLE_MOTION) return;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: delay, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, delay: delay, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, delay: delay, useNativeDriver: USE_NATIVE_DRIVER })
    ]).start();
  }, [delay, fadeAnim, scaleAnim, slideAnim]);

  const handlePressIn = () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    if (!ENABLE_MOTION) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(tiltAnim, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER })
    ]).start();
  };

  const handlePressOut = () => {
    if (!ENABLE_MOTION) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(tiltAnim, { toValue: 0, friction: 5, tension: 50, useNativeDriver: USE_NATIVE_DRIVER })
    ]).start();
  };

  const handlePress = () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) onPress();
  };

  const tilt = tiltAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '2deg']
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Animated.View style={[
        styles.cardBody, 
        compact && styles.compactCard,
        { 
          width: getCardWidth(columns),
          backgroundColor: bgColor, 
          opacity: fadeAnim, 
          transform: [{ scale: scaleAnim }, { translateY: slideAnim }, { rotateZ: tilt }] 
        },
        style,
      ]}>
        <View style={styles.glowOverlay} />
        <View style={styles.cornerAccent} />
        <View style={[styles.iconCage, compact && styles.compactIconCage, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={compact ? 22 : 28} color={color} />
        </View>
        <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={2}>{title}</Text>
        <View style={[styles.bottomAccent, { backgroundColor: color }]} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 154,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  compactCard: {
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 12,
    minHeight: 126,
    borderRadius: 17,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
    opacity: 0.45,
  },
  cornerAccent: {
    position: 'absolute',
    top: -22,
    right: -22,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  iconCage: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  compactIconCage: {
    width: 50,
    height: 50,
    borderRadius: 16,
    marginBottom: 10,
  },
  title: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  bottomAccent: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 10,
    height: 3,
    borderRadius: 999,
    opacity: 0.18,
  },
});

import React, { useRef, useEffect } from 'react';
import { Animated, Easing, Platform, TouchableWithoutFeedback, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ENABLE_MOTION = Platform.OS !== 'web';

const getCardWidth = (columns) => {
  if (columns >= 4) return '22%';
  if (columns === 3) return '30%';
  return '46%';
};

const triggerImpact = (style) => {
  Haptics.impactAsync(style).catch(() => {});
};

export default function PremiumActionCard({ title, icon, color, bgColor, delay, onPress, columns = 2, compact = false, style }) {
  const scaleAnim = useRef(new Animated.Value(ENABLE_MOTION ? 0.85 : 1)).current;
  const fadeAnim = useRef(new Animated.Value(ENABLE_MOTION ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(ENABLE_MOTION ? 30 : 0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ENABLE_MOTION) return;

    // Luxury staggered entrance animation
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 50, delay: delay * 0.5, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, delay: delay * 0.5, useNativeDriver: USE_NATIVE_DRIVER })
      ])
    ]).start();

    // Subtle pulse animation for luxury feel
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [delay, fadeAnim, pulseAnim, scaleAnim, slideAnim]);

  const handlePressIn = () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    if (!ENABLE_MOTION) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.95, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(tiltAnim, { toValue: 1.5, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 100, useNativeDriver: USE_NATIVE_DRIVER })
    ]).start();
  };

  const handlePressOut = () => {
    if (!ENABLE_MOTION) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(tiltAnim, { toValue: 0, friction: 4, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: USE_NATIVE_DRIVER })
    ]).start();
  };

  const handlePress = () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) onPress();
  };

  const tilt = tiltAnim.interpolate({
    inputRange: [0, 1.5],
    outputRange: ['0deg', '3deg']
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
        styles.luxuryCardBody,
        compact && styles.luxuryCompactCard,
        {
          width: getCardWidth(columns),
          backgroundColor: bgColor,
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
            { rotateZ: tilt }
          ],
        },
        style,
      ]}>
        {/* Luxury glow overlay */}
        <View style={[styles.luxuryGlowOverlay, { backgroundColor: color + '33' }]} />
        {/* Corner accent with luxury touch */}
        <View style={[styles.luxuryCornerAccent, { backgroundColor: color + '22' }]} />
        {/* Enhanced icon cage */}
        <View style={[styles.luxuryIconCage, compact && styles.luxuryCompactIconCage, {
          backgroundColor: color + '0A',
          borderWidth: 1,
          borderColor: color + '33'
        }]}>
          <Ionicons name={icon} size={compact ? 24 : 30} color={color} />
        </View>
        {/* Title with luxury typography */}
        <Text style={[styles.luxuryTitle, compact && styles.luxuryCompactTitle]} numberOfLines={2}>{title}</Text>
        {/* Bottom accent with animation */}
        <Animated.View style={[
          styles.luxuryBottomAccent,
          {
            backgroundColor: color,
            opacity: fadeAnim,
            transform: [{ scaleX: pulseAnim }]
          }
        ]} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  luxuryCardBody: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 170,
    overflow: 'hidden',
    borderWidth: 1.5,
    // Luxury shadow
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    // Enhanced border for luxury feel
    borderColor: Platform.select({
      web: 'rgba(255,255,255,0.15)',
      default: 'rgba(255,255,255,0.12)'
    }),
    backgroundColor: Platform.select({
      web: 'rgba(255,255,255,0.02)',
      default: '#FFFFFF'
    }),
  },
  luxuryCompactCard: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    marginBottom: 16,
    minHeight: 140,
    borderRadius: 20,
  },
  luxuryGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.6,
  },
  luxuryCornerAccent: {
    position: 'absolute',
    top: -28,
    right: -28,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  luxuryIconCage: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
  },
  luxuryCompactIconCage: {
    width: 56,
    height: 56,
    borderRadius: 18,
    marginBottom: 12,
  },
  luxuryTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0,
    textAlign: 'center',
    // Luxury typography
    fontFamily: Fonts.heading,
    marginTop: 4,
  },
  luxuryCompactTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  luxuryBottomAccent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
});

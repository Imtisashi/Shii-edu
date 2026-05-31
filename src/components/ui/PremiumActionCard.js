import React, { useRef, useEffect } from 'react';
import { Animated, TouchableWithoutFeedback, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const getCardWidth = (columns) => {
  if (columns >= 4) return '23.5%';
  if (columns === 3) return '31.8%';
  return '48%';
};

export default function PremiumActionCard({ title, icon, color, bgColor, delay, onPress, columns = 2, compact = false, style }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, delay: delay, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, delay: delay, useNativeDriver: true })
    ]).start();
  }, [delay, fadeAnim, scaleAnim, slideAnim]);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }),
      Animated.spring(tiltAnim, { toValue: 1, useNativeDriver: true })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
      Animated.spring(tiltAnim, { toValue: 0, friction: 5, tension: 50, useNativeDriver: true })
    ]).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) onPress();
  };

  const tilt = tiltAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '2deg']
  });

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress}>
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
          <Ionicons name={icon} size={compact ? 24 : 28} color={color} />
        </View>
        <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={2}>{title}</Text>
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
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 14,
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
    width: 56,
    height: 56,
    borderRadius: 18,
    marginBottom: 12,
  },
  title: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: 14,
  },
});

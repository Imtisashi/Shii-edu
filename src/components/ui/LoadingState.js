import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts } from '../../constants/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const resolveSpinnerSize = (size) => {
  if (size === 'small') return 20;
  if (size === 'large') return 50;
  return Number(size) || 36;
};

export function LuxurySpinner({ size = 36, color = Colors.primary, trackColor, stroke = 3, style }) {
  const spin = useRef(new Animated.Value(0)).current;
  const resolvedSize = resolveSpinnerSize(size);
  const resolvedTrackColor = trackColor ||
    (String(color).toLowerCase() === '#fff' || String(color).toLowerCase() === '#ffffff'
      ? 'rgba(255,255,255,0.1)'
      : 'rgba(30, 41, 59, 0.15)'); // Dark slate with opacity
  const radius = (resolvedSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Two-layer animation for luxury feel
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(spin, {
          toValue: 0.75,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(300),
        Animated.timing(spin, {
          toValue: 1.75,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1.75],
    outputRange: ['0deg', '630deg'], // Slightly more than full rotation for luxury feel
  });

  // Container for the spinner with subtle pulse
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[
        {
          width: resolvedSize,
          height: resolvedSize,
          transform: [{ rotate }],
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: resolvedSize,
            height: resolvedSize,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        <Svg width={resolvedSize} height={resolvedSize} viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}>
          {/* Background track */}
          <Circle
            cx={resolvedSize / 2}
            cy={resolvedSize / 2}
            r={radius}
            stroke={resolvedTrackColor}
            strokeWidth={stroke}
            fill="none"
          />
          {/* Luxury spinner with gradient-like effect */}
          <Circle
            cx={resolvedSize / 2}
            cy={resolvedSize / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`} // More gap for luxury feel
            strokeDashoffset={spin.interpolate({
              inputRange: [0, 1.75],
              outputRange: [0, circumference],
            })}
          />
          {/* Center luxury dot */}
          <Circle
            cx={resolvedSize / 2}
            cy={resolvedSize / 2}
            r={radius * 0.15}
            fill={color}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

export const SmoothSpinner = LuxurySpinner;

export default function LoadingState({ label = 'Preparing Shii Edu...', color, full = true, style }) {
  const colorScheme = useColorScheme();
  const spinnerColor = color || (colorScheme === 'dark' ? Colors.accent : Colors.primary);

  return (
    <View style={[full ? styles.luxuryFull : styles.luxuryInline, style]}>
      <LuxurySpinner size={full ? 48 : 32} color={spinnerColor} />
      {label ? <Text style={[
        styles.luxuryLabel,
        { color: Colors.textPrimary }
      ]}>{label}</Text> : null}
    </View>
  );
}

// Enhanced styles matching luxury theme
const styles = StyleSheet.create({
  luxuryFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  luxuryInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  luxuryLabel: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    // Typography from our luxury system
    fontFamily: Fonts.heading,
  },
});

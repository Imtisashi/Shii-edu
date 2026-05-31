import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const resolveSpinnerSize = (size) => {
  if (size === 'small') return 22;
  if (size === 'large') return 44;
  return Number(size) || 34;
};

export function SmoothSpinner({ size = 34, color = '#2563EB', trackColor, stroke = 4, style }) {
  const spin = useRef(new Animated.Value(0)).current;
  const resolvedSize = resolveSpinnerSize(size);
  const resolvedTrackColor = trackColor || (String(color).toLowerCase() === '#fff' || String(color).toLowerCase() === '#ffffff'
    ? 'rgba(255,255,255,0.28)'
    : '#DBEAFE');
  const radius = (resolvedSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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
      <Svg width={resolvedSize} height={resolvedSize} viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}>
        <Circle
          cx={resolvedSize / 2}
          cy={resolvedSize / 2}
          r={radius}
          stroke={resolvedTrackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={resolvedSize / 2}
          cy={resolvedSize / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * 0.74} ${circumference}`}
        />
      </Svg>
    </Animated.View>
  );
}

export default function LoadingState({ label = 'Loading...', color = '#2563EB', full = true, style }) {
  return (
    <View style={[full ? styles.full : styles.inline, style]}>
      <SmoothSpinner color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  label: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '700',
  },
});

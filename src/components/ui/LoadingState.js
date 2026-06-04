import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts } from '../../constants/theme';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const resolveSpinnerSize = (size) => {
  if (size === 'small') return 20;
  if (size === 'large') return 42;
  return Number(size) || 32;
};

export function EnterpriseSpinner({ size = 32, color = Colors.primary, trackColor, stroke = 3, style }) {
  const spin = useRef(new Animated.Value(0)).current;
  const resolvedSize = resolveSpinnerSize(size);
  const resolvedTrackColor = trackColor ||
    (String(color).toLowerCase() === '#fff' || String(color).toLowerCase() === '#ffffff'
      ? '#CBD5E1'
      : '#334155');
  const radius = (resolvedSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        duration: 240,
        easing: Easing.linear,
        toValue: 1,
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
          height: resolvedSize,
          transform: [{ rotate }],
          width: resolvedSize,
        },
        style,
      ]}
    >
      <Svg width={resolvedSize} height={resolvedSize} viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}>
        <Circle
          cx={resolvedSize / 2}
          cy={resolvedSize / 2}
          fill="none"
          r={radius}
          stroke={resolvedTrackColor}
          strokeWidth={stroke}
        />
        <Circle
          cx={resolvedSize / 2}
          cy={resolvedSize / 2}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </Svg>
    </Animated.View>
  );
}

export const SmoothSpinner = EnterpriseSpinner;

export default function LoadingState({ label = 'Loading...', color, full = true, style }) {
  const { colors } = useRootLayout();
  const spinnerColor = color || colors.accent;

  return (
    <View style={[full ? styles.full : styles.inline, full && { backgroundColor: colors.page }, style]}>
      <EnterpriseSpinner size={full ? 38 : 28} color={spinnerColor} />
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: full ? colors.text : colors.textSoft,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    alignItems: 'center',
    backgroundColor: '#020617',
    flex: 1,
    justifyContent: 'center',
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 14,
    textAlign: 'center',
  },
});

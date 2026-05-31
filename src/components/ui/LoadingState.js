import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function SmoothSpinner({ size = 34, color = '#2563EB', trackColor = '#DBEAFE', stroke = 4, style }) {
  const spin = useRef(new Animated.Value(0)).current;

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
        styles.spinner,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: trackColor,
          borderTopColor: color,
          transform: [{ rotate }],
        },
        style,
      ]}
    />
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
  spinner: {
    borderRightColor: 'transparent',
  },
  label: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '700',
  },
});

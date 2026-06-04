/* eslint-disable react-hooks/immutability */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRootLayout } from '../../contexts/RootLayoutContext';

type EdgeDrawerButtonProps = {
  accessibilityLabel?: string;
  onPress: () => void;
  size?: number;
};

const timing = {
  duration: 110,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
};

export default function EdgeDrawerButton({
  accessibilityLabel = 'Open menu',
  onPress,
  size = 42,
}: EdgeDrawerButtonProps) {
  const { colors, radii } = useRootLayout();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pressed.value, [0, 1], [1, 0.98]),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, timing);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, timing);
      }}
      style={{ height: size, width: size }}
    >
      <Animated.View
        style={[
          styles.shell,
          {
            backgroundColor: colors.cardStrong,
            borderColor: colors.hairline,
            borderRadius: radii.control,
            height: size,
            width: size,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.lineStack}>
          <View style={[styles.line, styles.lineWide, { backgroundColor: colors.text }]} />
          <View style={[styles.line, styles.lineMiddle, { backgroundColor: colors.text }]} />
          <View style={[styles.line, styles.lineShort, { backgroundColor: colors.text }]} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    borderRadius: 8,
    height: 2,
  },
  lineMiddle: {
    opacity: 0.74,
    width: 16,
  },
  lineShort: {
    opacity: 0.58,
    width: 11,
  },
  lineStack: {
    alignItems: 'flex-start',
    gap: 4,
  },
  lineWide: {
    width: 19,
  },
  shell: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

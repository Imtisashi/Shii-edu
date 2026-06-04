import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Fonts } from '../../constants/theme';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const getCardWidth = (columns) => {
  if (columns >= 4) return '23.5%';
  if (columns === 3) return '31.5%';
  return '48.5%';
};

const timing = {
  duration: 120,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
};

export default function PremiumActionCard({
  title,
  icon,
  color = '#2563EB',
  onPress,
  columns = 2,
  compact = false,
  style,
}) {
  const { colors, radii } = useRootLayout();
  const pressed = useSharedValue(0);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, 0.98]) },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        pressed.set(withTiming(1, timing));
      }}
      onPressOut={() => {
        pressed.set(withTiming(0, timing));
      }}
      style={[{ width: getCardWidth(columns) }, style]}
    >
      <Animated.View
        style={[
          styles.card,
          compact && styles.compactCard,
          {
            backgroundColor: colors.cardStrong,
            borderColor: colors.hairline,
            borderRadius: radii.card,
          },
          cardAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.iconBox,
            compact && styles.compactIconBox,
            {
              backgroundColor: colors.pageElevated,
              borderColor: color,
            },
          ]}
        >
          <Ionicons name={icon} size={compact ? 21 : 24} color={color} />
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.title, compact && styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.microLabel, { color: colors.muted }]} numberOfLines={1}>
            Open
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color, background-color',
        transitionDuration: '120ms',
      },
      default: {},
    }),
  },
  compactCard: {
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  compactIconBox: {
    height: 40,
    width: 40,
  },
  compactTitle: {
    fontSize: 13,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  microLabel: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
});

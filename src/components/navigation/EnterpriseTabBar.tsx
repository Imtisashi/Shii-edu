import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const webNoOutlineStyle = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle)
  : undefined;

const timing = {
  duration: 130,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
};

export default function EnterpriseTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const { colors, insets, isCompact, isDesktop, maxContentWidth, spacing, viewport } = useRootLayout();
  const activeIndex = useSharedValue(state.index);
  const maxWidth = isDesktop ? Math.min(maxContentWidth, 760) : viewport.width;
  const tabCount = Math.max(state.routes.length, 1);
  const tabWidth = maxWidth / tabCount;

  useEffect(() => {
    activeIndex.value = withTiming(state.index, timing);
  }, [activeIndex, state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: activeIndex.value * tabWidth,
      },
    ],
  }));

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.hairline,
          paddingBottom: Math.max(insets.bottom, 0),
          paddingHorizontal: isDesktop ? spacing.pageX : 0,
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            maxWidth,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: colors.accent,
              width: tabWidth,
            },
            indicatorStyle,
          ]}
        />

        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const focused = state.index === index;
          const label = typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title || route.name;
          const color = focused ? colors.text : colors.muted;

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              key={route.key}
              onPress={onPress}
              style={[
                styles.item,
                {
                  backgroundColor: focused ? colors.pageElevated : colors.tabBar,
                  minHeight: isCompact ? 54 : 60,
                  width: tabWidth,
                },
                webNoOutlineStyle,
              ]}
            >
              {options.tabBarIcon?.({
                color,
                focused,
                size: isCompact ? 20 : 22,
              })}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color,
                    fontSize: isCompact ? 10 : 11,
                    fontWeight: focused ? '800' : '600',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  indicator: {
    height: 2,
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 3,
  },
  item: {
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    letterSpacing: 0,
    maxWidth: '100%',
  },
  wrapper: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 40,
  },
});

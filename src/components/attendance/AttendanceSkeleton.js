import React, { useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const SKELETON_COLORS = {
  background: '#F8FAFC',
  block: '#E2E8F0',
  border: '#D7E0EC',
  shimmer: '#FFFFFF',
  surface: '#FFFFFF',
};

function SkeletonBlock({ height, shimmerTranslate, style }) {
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  return (
    <View style={[styles.skeletonBlock, { height }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.shimmer, shimmerStyle]}
      />
    </View>
  );
}

export default function AttendanceSkeleton({
  accent = 'emerald',
  label = 'Preparing attendance...',
  rowCount = 4,
  showChart = true,
}) {
  const {
    colors,
    insets,
    isDesktop,
    maxContentWidth,
    radii,
    scale,
    spacing,
  } = useRootLayout();
  const accentColor = colors[accent] || colors.emerald;
  const rows = useMemo(
    () => Array.from({ length: Math.max(1, rowCount) }, (_, index) => index),
    [rowCount]
  );
  const shimmerTranslate = useSharedValue(-180);

  useEffect(() => {
    shimmerTranslate.value = withRepeat(
      withTiming(420, {
        duration: 1180,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      shimmerTranslate.value = -180;
    };
  }, [shimmerTranslate]);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={[styles.root, { backgroundColor: SKELETON_COLORS.background }]}
    >
      <View
        style={[
          styles.content,
          {
            maxWidth: isDesktop ? maxContentWidth : undefined,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl,
            paddingHorizontal: spacing.pageX,
            paddingTop: Math.max(insets.top, spacing.md) + spacing.lg,
          },
        ]}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: SKELETON_COLORS.surface,
              borderColor: SKELETON_COLORS.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <SkeletonBlock height={scale(11, { min: 10, max: 13 })} shimmerTranslate={shimmerTranslate} style={styles.heroKicker} />
          <SkeletonBlock height={scale(25, { min: 23, max: 29 })} shimmerTranslate={shimmerTranslate} style={styles.heroTitle} />
          <SkeletonBlock height={scale(12, { min: 11, max: 14 })} shimmerTranslate={shimmerTranslate} style={styles.heroCopy} />
          {showChart ? (
            <View style={styles.summaryRow}>
              <SkeletonBlock height={scale(70, { min: 64, max: 80 })} shimmerTranslate={shimmerTranslate} style={styles.summaryBlock} />
              <SkeletonBlock height={scale(70, { min: 64, max: 80 })} shimmerTranslate={shimmerTranslate} style={styles.summaryBlock} />
              <SkeletonBlock height={scale(70, { min: 64, max: 80 })} shimmerTranslate={shimmerTranslate} style={styles.summaryBlock} />
            </View>
          ) : null}
        </View>

        <View style={styles.rows}>
          {rows.map((row) => (
            <View
              key={row}
              style={[
                styles.row,
                {
                  backgroundColor: SKELETON_COLORS.surface,
                  borderColor: SKELETON_COLORS.border,
                  borderRadius: radii.control,
                },
              ]}
            >
              <SkeletonBlock height={38} shimmerTranslate={shimmerTranslate} style={styles.avatar} />
              <View style={styles.rowText}>
                <SkeletonBlock height={13} shimmerTranslate={shimmerTranslate} style={styles.rowTitle} />
                <SkeletonBlock height={10} shimmerTranslate={shimmerTranslate} style={styles.rowMeta} />
              </View>
              <SkeletonBlock height={30} shimmerTranslate={shimmerTranslate} style={styles.rowAction} />
            </View>
          ))}
        </View>

        <View style={[styles.statusLine, { backgroundColor: accentColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 6,
    flexShrink: 0,
    width: 38,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 620,
    width: '100%',
  },
  hero: {
    borderWidth: 1,
    padding: 18,
  },
  heroCopy: {
    marginTop: 10,
    width: '68%',
  },
  heroKicker: {
    width: '26%',
  },
  heroTitle: {
    marginTop: 10,
    width: '52%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  root: {
    flex: 1,
    minHeight: '100%',
  },
  row: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
    padding: 12,
  },
  rowAction: {
    borderRadius: 6,
    flexShrink: 0,
    width: 78,
  },
  rowMeta: {
    marginTop: 7,
    width: '52%',
  },
  rows: {
    gap: 8,
    marginTop: 14,
  },
  rowText: {
    flex: 1,
    marginHorizontal: 12,
    minWidth: 0,
  },
  rowTitle: {
    width: '72%',
  },
  shimmer: {
    backgroundColor: SKELETON_COLORS.shimmer,
    bottom: 0,
    opacity: 0.78,
    position: 'absolute',
    top: 0,
    width: 90,
  },
  skeletonBlock: {
    backgroundColor: SKELETON_COLORS.block,
    overflow: 'hidden',
  },
  statusLine: {
    borderRadius: 8,
    height: 3,
    marginTop: 16,
    width: 46,
  },
  summaryBlock: {
    borderRadius: 6,
    flex: 1,
    minWidth: 64,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
});

import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const SHIMMER_TIMING = {
  duration: 1180,
  easing: Easing.linear,
};

const SKELETON_COLORS = {
  accent: '#635BFF',
  accentSoft: '#F2F0FF',
  background: '#F8FAFC',
  border: '#CBD5E1',
  block: '#E2E8F0',
  shimmer: '#FBFCFF',
  surface: '#FFFFFF',
};

const resolveLoaderSize = (size) => {
  if (size === 'small') return 18;
  if (size === 'large') return 42;
  return Number(size) || 30;
};

/**
 * @param {{ height?: number, radius?: number, style?: any, width?: number | string }} props
 */
export function SkeletonBlock({
  height = 12,
  radius = 6,
  style = undefined,
  width = '100%',
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, SHIMMER_TIMING), -1, false);
    return () => {
      progress.value = 0;
    };
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.78,
    transform: [{ translateX: -110 + progress.value * 340 }],
  }));

  return (
    <View
      style={[
        styles.skeletonBlock,
        {
          backgroundColor: SKELETON_COLORS.block,
          borderRadius: radius,
          height,
          width,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerBand,
          { backgroundColor: SKELETON_COLORS.shimmer },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

/**
 * @param {{ color?: string, size?: number | string, style?: any, stroke?: number, trackColor?: string }} props
 */
export function EnterpriseSpinner({
  color = undefined,
  size = undefined,
  style = undefined,
  stroke = undefined,
  trackColor = undefined,
}) {
  void color;
  void stroke;
  void trackColor;

  const resolvedSize = resolveLoaderSize(size || 30);
  const barHeight = Math.max(3, Math.round(resolvedSize * 0.16));
  const width = Math.max(22, Math.round(resolvedSize * 1.18));

  return (
    <View
      accessibilityRole="progressbar"
      style={[
        styles.inlineLoader,
        {
          minHeight: Math.max(16, Math.round(resolvedSize * 0.72)),
          width,
        },
        style,
      ]}
    >
      <SkeletonBlock height={barHeight} radius={6} width="100%" />
      <SkeletonBlock height={barHeight} radius={6} width="72%" />
      <SkeletonBlock height={barHeight} radius={6} width="46%" />
    </View>
  );
}

export const SmoothSpinner = EnterpriseSpinner;

export function RosterSkeleton({
  rowCount = 6,
  showFilters = true,
  style,
}) {
  const { insets, isDesktop, maxContentWidth, radii, spacing } = useRootLayout();
  const rows = useMemo(
    () => Array.from({ length: Math.max(1, rowCount) }, (_, index) => index),
    [rowCount]
  );

  return (
    <View
      accessibilityLabel="Preparing roster"
      accessibilityRole="progressbar"
      style={[
        styles.rosterRoot,
        {
          backgroundColor: SKELETON_COLORS.background,
          minHeight: Platform.OS === 'web' ? '100dvh' : '100%',
        },
        style,
      ]}
    >
      <View
        style={[
          styles.rosterContent,
          {
            maxWidth: isDesktop ? maxContentWidth : undefined,
            paddingBottom: Math.max(insets.bottom, 10) + spacing.xl,
            paddingHorizontal: spacing.pageX,
            paddingTop: spacing.lg,
          },
        ]}
      >
        <View style={styles.loaderHeader}>
          <View style={styles.loaderHeaderLeft}>
            <SkeletonBlock height={38} radius={8} width={38} />
            <View style={styles.loaderHeaderCopy}>
              <SkeletonBlock height={11} width="44%" />
              <SkeletonBlock height={18} style={styles.skeletonGapSmall} width="72%" />
            </View>
          </View>
          <View style={styles.loaderHeaderActions}>
            <SkeletonBlock height={34} radius={8} width={34} />
            <SkeletonBlock height={34} radius={8} width={34} />
          </View>
        </View>

        <View
          style={[
            styles.rosterSummary,
            {
              backgroundColor: SKELETON_COLORS.surface,
              borderColor: SKELETON_COLORS.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <View style={styles.rosterSummaryCopy}>
            <SkeletonBlock height={11} width="34%" />
            <SkeletonBlock height={24} style={styles.skeletonGap} width="62%" />
          </View>
          <SkeletonBlock height={36} radius={8} width={112} />
        </View>

        {showFilters ? (
          <View
            style={[
              styles.filterShell,
              {
                backgroundColor: SKELETON_COLORS.surface,
                borderColor: SKELETON_COLORS.border,
                borderRadius: radii.control,
              },
            ]}
          >
            <SkeletonBlock height={38} radius={8} width="49%" />
            <SkeletonBlock height={38} radius={8} width="49%" />
          </View>
        ) : null}

        <View style={styles.rosterRows}>
          <View
            style={[
              styles.rosterTableHeader,
              {
                backgroundColor: SKELETON_COLORS.accentSoft,
                borderColor: SKELETON_COLORS.border,
                borderRadius: radii.control,
              },
            ]}
          >
            <SkeletonBlock height={12} width="28%" />
            <SkeletonBlock height={12} width="18%" />
            <SkeletonBlock height={12} width="22%" />
          </View>
          {rows.map((row) => (
            <View
              key={row}
              style={[
                styles.rosterRow,
                {
                  backgroundColor: SKELETON_COLORS.surface,
                  borderColor: SKELETON_COLORS.border,
                  borderRadius: radii.card,
                },
              ]}
            >
              <SkeletonBlock height={46} radius={8} width={46} />
              <View style={styles.rosterRowCopy}>
                <SkeletonBlock height={16} width={row % 2 === 0 ? '62%' : '48%'} />
                <SkeletonBlock height={11} style={styles.skeletonGapSmall} width={row % 2 === 0 ? '44%' : '57%'} />
                <View style={styles.rosterBadgeRow}>
                  <SkeletonBlock height={24} radius={8} width={92} />
                  <SkeletonBlock height={24} radius={8} width={74} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function DashboardSkeleton({
  rowCount = 4,
  style,
}) {
  const { insets, isDesktop, maxContentWidth, radii, spacing } = useRootLayout();
  const rows = useMemo(
    () => Array.from({ length: Math.max(1, rowCount) }, (_, index) => index),
    [rowCount]
  );

  return (
    <View
      accessibilityLabel="Preparing workspace"
      accessibilityRole="progressbar"
      style={[
        styles.dashboardRoot,
        {
          backgroundColor: SKELETON_COLORS.background,
          minHeight: Platform.OS === 'web' ? '100dvh' : '100%',
        },
        style,
      ]}
    >
      <View
        style={[
          styles.dashboardContent,
          {
            maxWidth: isDesktop ? maxContentWidth : undefined,
            paddingBottom: Math.max(insets.bottom, 10) + spacing.xl,
            paddingHorizontal: spacing.pageX,
            paddingTop: Math.max(insets.top, 10) + spacing.xl,
          },
        ]}
      >
        <View style={styles.loaderHeader}>
          <View style={styles.loaderHeaderLeft}>
            <SkeletonBlock height={38} radius={8} width={38} />
            <View style={styles.loaderHeaderCopy}>
              <SkeletonBlock height={11} width="42%" />
              <SkeletonBlock height={18} style={styles.skeletonGapSmall} width="68%" />
            </View>
          </View>
          <View style={styles.loaderHeaderActions}>
            <SkeletonBlock height={34} radius={8} width={34} />
            <SkeletonBlock height={34} radius={8} width={34} />
          </View>
        </View>

        <View
          style={[
            styles.dashboardHero,
            {
              backgroundColor: SKELETON_COLORS.surface,
              borderColor: SKELETON_COLORS.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <View style={styles.dashboardHeroTop}>
            <SkeletonBlock height={58} radius={8} width={58} />
            <View style={styles.dashboardHeroCopy}>
              <SkeletonBlock height={13} width="38%" />
              <SkeletonBlock height={27} style={styles.skeletonGap} width="70%" />
            </View>
          </View>
          <SkeletonBlock height={56} radius={8} width="100%" />
        </View>

        <View style={styles.dashboardMetricRow}>
          <SkeletonBlock height={38} radius={8} width="32%" />
          <SkeletonBlock height={38} radius={8} width="32%" />
          <SkeletonBlock height={38} radius={8} width="32%" />
        </View>

        <View style={styles.dashboardGrid}>
          {rows.map((row) => (
            <View
              key={row}
              style={[
                styles.dashboardTile,
                {
                  backgroundColor: SKELETON_COLORS.surface,
                  borderColor: SKELETON_COLORS.border,
                  borderRadius: radii.card,
                },
              ]}
            >
              <SkeletonBlock height={42} radius={8} width={42} />
              <View style={styles.dashboardTileCopy}>
                <SkeletonBlock height={15} width={row % 2 === 0 ? '66%' : '52%'} />
                <SkeletonBlock height={10} style={styles.skeletonGapSmall} width="86%" />
              </View>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.noticeSkeleton,
            {
              backgroundColor: SKELETON_COLORS.surface,
              borderColor: SKELETON_COLORS.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <SkeletonBlock height={18} width="42%" />
          <SkeletonBlock height={48} radius={8} style={styles.skeletonGap} width="100%" />
          <SkeletonBlock height={48} radius={8} style={styles.skeletonGapSmall} width="100%" />
        </View>
      </View>
    </View>
  );
}

export default function LoadingState({ full = true, style, variant = 'dashboard' }) {
  if (variant === 'roster' || !full) {
    return <RosterSkeleton rowCount={full ? 6 : 3} style={style} />;
  }

  return <DashboardSkeleton style={style} />;
}

const styles = StyleSheet.create({
  dashboardContent: {
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 620,
    width: '100%',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  dashboardHero: {
    borderWidth: 1,
    padding: 18,
  },
  dashboardHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  dashboardHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  dashboardRoot: {
    flex: 1,
    minHeight: '100%',
  },
  dashboardTile: {
    alignItems: 'center',
    borderWidth: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    padding: 13,
  },
  dashboardTileCopy: {
    flex: 1,
    minWidth: 0,
  },
  filterShell: {
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 4,
  },
  inlineLoader: {
    alignItems: 'flex-start',
    gap: 3,
    justifyContent: 'center',
  },
  dashboardMetricRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  loaderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    minHeight: 44,
  },
  loaderHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loaderHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  loaderHeaderLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  noticeSkeleton: {
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  rosterBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  rosterContent: {
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 620,
    width: '100%',
  },
  rosterRoot: {
    flex: 1,
    minHeight: '100%',
  },
  rosterRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 82,
    padding: 13,
  },
  rosterRowCopy: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  rosterRows: {
    gap: 10,
    marginTop: 12,
  },
  rosterSummary: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  rosterSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  rosterTableHeader: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  shimmerBand: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 86,
  },
  skeletonBlock: {
    overflow: 'hidden',
  },
  skeletonGap: {
    marginTop: 9,
  },
  skeletonGapSmall: {
    marginTop: 7,
  },
});

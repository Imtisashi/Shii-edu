import { Platform, useWindowDimensions } from 'react-native';

const MAX_CONTENT_WIDTH = 1120;
const WIDE_CONTENT_WIDTH = 1280;

export default function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;
  const isTablet = !isDesktop && width >= 768;
  const isMobile = !isDesktop && !isTablet;
  const isCompact = width < 380;
  const deviceType = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';

  const horizontalPadding = isDesktop ? 32 : isTablet ? 24 : 16;
  const maxContentWidth = width >= 1360 ? WIDE_CONTENT_WIDTH : MAX_CONTENT_WIDTH;
  const dashboardColumns = isDesktop ? 3 : isTablet ? 3 : 2;
  const listColumns = isDesktop ? 2 : 1;
  const galleryColumns = isDesktop ? 5 : isTablet ? 4 : isCompact ? 2 : 3;
  const heroHeight = isDesktop ? 360 : isCompact ? 290 : 320;
  const touchTarget = isDesktop ? 44 : 48;

  const availableWidth = Math.min(width - horizontalPadding * 2, maxContentWidth);
  const chartWidth = (maxWidth = 520) => Math.max(
    280,
    Math.min(availableWidth - (isDesktop ? 48 : 0), maxWidth)
  );

  return {
    width,
    height,
    fontScale,
    shortestSide,
    isWeb,
    isDesktop,
    isTablet,
    isMobile,
    isCompact,
    deviceType,
    horizontalPadding,
    maxContentWidth,
    availableWidth,
    dashboardColumns,
    listColumns,
    galleryColumns,
    heroHeight,
    touchTarget,
    chartWidth,
  };
}

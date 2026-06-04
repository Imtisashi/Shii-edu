import { PixelRatio, Platform, useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

export type DeviceClass = 'desktop' | 'mobile' | 'tablet';
export type LayoutOrientation = 'landscape' | 'portrait';

type ScaleOptions = {
  max?: number;
  min?: number;
};

export type AspectRatioLayout = {
  aspectRatio: number;
  availableWidth: number;
  buttonHeight: number;
  contentWidth: number;
  dashboardColumns: number;
  deviceClass: DeviceClass;
  fontScale: number;
  galleryColumns: number;
  height: number;
  horizontalPadding: number;
  iconButtonSize: number;
  inputHeight: number;
  isCompact: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isMobile: boolean;
  isNarrowPhone: boolean;
  isTablet: boolean;
  isTall: boolean;
  isWeb: boolean;
  isWide: boolean;
  layoutScale: number;
  listColumns: number;
  longestSide: number;
  maxContentWidth: number;
  orientation: LayoutOrientation;
  scale: (value: number, options?: ScaleOptions) => number;
  scaleFont: (value: number, options?: ScaleOptions) => number;
  scaleHeight: (value: number, options?: ScaleOptions) => number;
  scaleWidth: (value: number, options?: ScaleOptions) => number;
  shortestSide: number;
  space: (value: number, options?: ScaleOptions) => number;
  touchTarget: number;
  width: number;
};

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;
const DESKTOP_BREAKPOINT = 1024;
const TABLET_SHORTEST_SIDE = 600;
const MAX_CONTENT_WIDTH = 1120;
const WIDE_CONTENT_WIDTH = 1280;
const MIN_TOUCH_TARGET = 44;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round = (value: number) => PixelRatio.roundToNearestPixel(value);

const createScaler = (
  factor: number,
  defaultMinFactor: number,
  defaultMaxFactor: number
) => (value: number, options: ScaleOptions = {}) => {
  const min = options.min ?? value * defaultMinFactor;
  const max = options.max ?? value * defaultMaxFactor;
  return round(clamp(value * factor, min, max));
};

export function useAspectRatioLayout(): AspectRatioLayout {
  const { fontScale, height: rawHeight, width: rawWidth } = useWindowDimensions();

  return useMemo(() => {
    const width = Math.max(rawWidth, 1);
    const height = Math.max(rawHeight, 1);
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    const aspectRatio = width / height;
    const orientation: LayoutOrientation = width > height ? 'landscape' : 'portrait';
    const isLandscape = orientation === 'landscape';
    const isWeb = Platform.OS === 'web';
    const isDesktop = isWeb && width >= DESKTOP_BREAKPOINT;
    const isTablet = !isDesktop && shortestSide >= TABLET_SHORTEST_SIDE;
    const isMobile = !isDesktop && !isTablet;
    const isCompact = isMobile && width < 380;
    const isNarrowPhone = isMobile && width < 430;
    const isTall = !isLandscape && height / width >= 1.9;
    const isWide = isLandscape && aspectRatio >= 1.6;
    const deviceClass: DeviceClass = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';

    const widthScale = clamp(width / BASE_WIDTH, 0.86, isDesktop ? 1.38 : 1.2);
    const heightScale = clamp(height / BASE_HEIGHT, 0.82, isDesktop ? 1.18 : 1.1);
    const layoutScale = clamp(Math.sqrt(widthScale * heightScale), 0.86, isDesktop ? 1.28 : 1.16);
    const fontLayoutScale = clamp(layoutScale, 0.94, isDesktop ? 1.18 : 1.1);

    const scale = createScaler(layoutScale, 0.84, 1.3);
    const scaleWidth = createScaler(widthScale, 0.82, 1.4);
    const scaleHeight = createScaler(heightScale, 0.82, 1.24);
    const scaleFont = createScaler(fontLayoutScale, 0.92, 1.18);
    const space = createScaler(clamp(widthScale, 0.88, isDesktop ? 1.28 : 1.14), 0.86, 1.3);

    const horizontalPaddingBase = isDesktop ? 32 : isTablet ? 24 : isCompact ? 12 : 16;
    const horizontalPadding = space(horizontalPaddingBase, {
      min: isCompact ? 12 : 14,
      max: isDesktop ? 40 : 28,
    });
    const maxContentWidth = width >= 1360 ? WIDE_CONTENT_WIDTH : MAX_CONTENT_WIDTH;
    const contentWidth = Math.max(0, Math.min(width - horizontalPadding * 2, maxContentWidth));
    const touchTarget = Math.max(MIN_TOUCH_TARGET, scale(48, { min: MIN_TOUCH_TARGET, max: 56 }));
    const buttonHeight = Math.max(touchTarget, scaleHeight(54, { min: 48, max: 62 }));
    const inputHeight = Math.max(touchTarget, scaleHeight(52, { min: 48, max: 60 }));
    const iconButtonSize = Math.max(touchTarget, scale(46, { min: MIN_TOUCH_TARGET, max: 54 }));

    const dashboardColumns = isDesktop ? 3 : isTablet ? (isLandscape ? 3 : 2) : width >= 520 ? 2 : 1;
    const listColumns = isDesktop ? 2 : 1;
    const galleryColumns = isDesktop ? 5 : isTablet ? (isLandscape ? 4 : 3) : isCompact ? 2 : 3;

    return {
      aspectRatio,
      availableWidth: contentWidth,
      buttonHeight,
      contentWidth,
      dashboardColumns,
      deviceClass,
      fontScale,
      galleryColumns,
      height,
      horizontalPadding,
      iconButtonSize,
      inputHeight,
      isCompact,
      isDesktop,
      isLandscape,
      isMobile,
      isNarrowPhone,
      isTablet,
      isTall,
      isWeb,
      isWide,
      layoutScale,
      listColumns,
      longestSide,
      maxContentWidth,
      orientation,
      scale,
      scaleFont,
      scaleHeight,
      scaleWidth,
      shortestSide,
      space,
      touchTarget,
      width,
    };
  }, [fontScale, rawHeight, rawWidth]);
}

export default useAspectRatioLayout;

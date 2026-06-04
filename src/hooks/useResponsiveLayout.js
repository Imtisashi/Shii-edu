import { useAspectRatioLayout } from './useAspectRatioLayout';

export default function useResponsiveLayout() {
  const layout = useAspectRatioLayout();
  const heroHeight = layout.scaleHeight(
    layout.isDesktop ? 360 : layout.isCompact ? 252 : layout.isNarrowPhone ? 280 : 310,
    { min: layout.isDesktop ? 320 : 238, max: layout.isDesktop ? 420 : 340 }
  );
  const chartWidth = (maxWidth = 520) => Math.max(
    280,
    Math.min(layout.availableWidth - (layout.isDesktop ? layout.space(48) : 0), maxWidth)
  );

  return {
    ...layout,
    deviceType: layout.deviceClass,
    heroHeight,
    chartWidth,
  };
}

import React from 'react';
import { Image as ExpoImage, ImageProps, ImageSource, ImageContentFit, ImageContentPosition } from 'expo-image';
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps , Platform } from 'react-native';

/**
 * Optimized Image component using expo-image for better performance and caching
 * Features:
 * - Automatic caching
 * - Better memory management
 * - Cross-platform consistency
 * - Placeholder support
 * - Priority loading for important images
 */
export const OptimizedImage = ({
  source,
  style,
  contentFit = 'cover' as ImageContentFit,
  placeholder,
  placeholderContentFit,
  placeholderContentPosition,
  contentAlign = 'center',
  contentValign = 'center',
  transition = 300,
  // Additional props for fine-tuning
  ...props
}: ImageProps & ViewProps & {
  placeholder?: ImageSource | null | undefined;
  placeholderContentFit?: ImageContentFit;
  placeholderContentPosition?: ImageContentPosition;
  contentAlign?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  contentValign?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}) => {
  // Map contentAlign/contentValign to proper flex values for overlay positioning
  const alignItemMap: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
    top: 'flex-start',
    bottom: 'flex-end',
    left: 'flex-start',
    right: 'flex-end',
    center: 'center',
  };

  const justifyContentMap: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
    top: 'flex-start',
    bottom: 'flex-end',
    left: 'flex-start',
    right: 'flex-end',
    center: 'center',
  };

  return (
    <View style={[styles.container, style]}>
      <ExpoImage
        source={source}
        contentFit={contentFit}
        placeholder={placeholder}
        placeholderContentFit={placeholderContentFit}
        transition={transition}
        {...props}
        style={StyleSheet.absoluteFill}
      />
      {/* Optional: Show placeholder overlay if needed */}
      {placeholder && (
        <View style={[
          styles.overlay,
          {
            alignItems: alignItemMap[contentAlign] || 'center',
            justifyContent: justifyContentMap[contentValign] || 'center',
          }
        ]}>
          {/* Render a simple placeholder - could be enhanced with actual placeholder rendering */}
          <View style={styles.placeholderOverlay} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Allow the image to size itself based on parent or explicit dimensions
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  placeholderOverlay: {
    // Simple placeholder styling - can be customized
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});

/**
 * Convenience component for circular images (avatars, profile pictures)
 */
export const CircularOptimizedImage = ({
  source,
  size,
  borderWidth = 1,
  borderColor = '#4A90E2',
  ...props
}: {
  source: ImageSource;
  size: number;
  borderWidth?: number;
  borderColor?: string;
} & ImageProps & ViewProps) => {
  return (
    <OptimizedImage
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor,
        ...(props.style || {})
      }}
      contentFit="cover"
      {...props}
    />
  );
};

export default OptimizedImage;

import React from 'react';
import { Platform, View } from 'react-native';
import { OptimizedImage } from '../OptimizedImage';

const logoSource = require('../../assets/images/icon.png');

export default function BrandLogo({ size = 48, variant = 'default', style }) {
  const isLight = variant === 'light';
  const iconSize = Number(size) || 48;
  const radius = iconSize * 0.24;
  const webImageStyle = Platform.OS === 'web'
    ? {
        backgroundImage: 'url(/icon.png)',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }
    : undefined;

  return (
    <View
      style={[
        {
          width: iconSize,
          height: iconSize,
          borderRadius: radius,
          overflow: 'hidden',
          opacity: isLight ? 0.96 : 1,
        },
        webImageStyle,
        style,
      ]}
    >
      {Platform.OS === 'web' ? null : (
        <OptimizedImage
          source={logoSource}
          contentFit="cover"
          style={{
            width: iconSize,
            height: iconSize,
            opacity: isLight ? 0.96 : 1,
          }}
        />
      )}
    </View>
  );
}
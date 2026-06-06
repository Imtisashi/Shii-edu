import React from 'react';
import { Image, Platform, View } from 'react-native';

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
        <Image
          source={logoSource}
          resizeMode="cover"
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

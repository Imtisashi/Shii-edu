import React from 'react';
import { Image, View } from 'react-native';

const logoSource = require('../../assets/images/icon.png');

export default function BrandLogo({ size = 48, variant = 'default', style }) {
  const isLight = variant === 'light';
  const iconSize = Number(size) || 48;
  const radius = iconSize * 0.24;

  return (
    <View
      style={[
        {
          width: iconSize,
          height: iconSize,
          borderRadius: radius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Image
        source={logoSource}
        resizeMode="cover"
        style={{
          width: iconSize,
          height: iconSize,
          opacity: isLight ? 0.96 : 1,
        }}
      />
    </View>
  );
}

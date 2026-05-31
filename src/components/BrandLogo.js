import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export default function BrandLogo({ size = 48, variant = 'default', style }) {
  const isLight = variant === 'light';
  const iconSize = Number(size) || 48;
  const radius = iconSize * 0.24;
  const gradientKey = React.useId().replace(/:/g, '');
  const bgGradientId = `eduLogoBg${gradientKey}`;
  const bookGradientId = `eduLogoBook${gradientKey}`;

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
      <Svg width={iconSize} height={iconSize} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={bgGradientId} x1="10" y1="8" x2="86" y2="90">
            <Stop offset="0" stopColor={isLight ? '#60A5FA' : '#2563EB'} />
            <Stop offset="0.52" stopColor={isLight ? '#7C3AED' : '#4F46E5'} />
            <Stop offset="1" stopColor={isLight ? '#06B6D4' : '#0F766E'} />
          </LinearGradient>
          <LinearGradient id={bookGradientId} x1="24" y1="28" x2="74" y2="70">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#DDEBFF" />
          </LinearGradient>
        </Defs>

        <Rect width="96" height="96" rx="24" fill={`url(#${bgGradientId})`} />
        <Circle cx="78" cy="18" r="18" fill="#FFFFFF" opacity="0.13" />
        <Circle cx="16" cy="82" r="22" fill="#FFFFFF" opacity="0.1" />
        <Path d="M22 31C30 28 39 29 48 36C57 29 66 28 74 31V68C66 64 57 64 48 71C39 64 30 64 22 68V31Z" fill={`url(#${bookGradientId})`} />
        <Path d="M48 36V71" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        <Path d="M31 42C36 41 40 43 44 46" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <Path d="M65 42C60 41 56 43 52 46" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <Path d="M32 56H40" stroke="#0F766E" strokeWidth="5" strokeLinecap="round" />
        <Path d="M48 56H56" stroke="#0F766E" strokeWidth="5" strokeLinecap="round" />
        <Path d="M64 56V49" stroke="#0F766E" strokeWidth="5" strokeLinecap="round" />
        <Path d="M24 74H72" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.86" />
      </Svg>
    </View>
  );
}

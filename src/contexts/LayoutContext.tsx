import React, { createContext, useContext, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { useAspectRatioLayout } from '../hooks/useAspectRatioLayout';
import { useRootLayout } from './RootLayoutContext';

interface LayoutContextType {
  width: number;
  height: number;
  fontScale: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait';
  insets: { top: number; right: number; bottom: number; left: number };
  colorScheme: 'light' | 'dark';
  theme: typeof Colors.light | typeof Colors.dark;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export const LayoutContextProvider = ({ children }: { children: React.ReactNode }) => {
  const responsive = useAspectRatioLayout();
  const insets = useSafeAreaInsets();
  const { brand, colors } = useRootLayout();
  const colorScheme = brand.mode;
  const theme = useMemo<LayoutContextType['theme']>(() => ({
    ...(colorScheme === 'light' ? Colors.light : Colors.dark),
    accent: colors.accent,
    background: colors.page,
    border: colors.hairline,
    divider: colors.hairline,
    icon: colors.muted,
    info: colors.deepBlue,
    primary: colors.accent,
    primaryVariant: colors.deepBlue,
    surface: colors.cardStrong,
    surfaceVariant: colors.card,
    textMuted: colors.muted,
    textPrimary: colors.text,
    textSecondary: colors.textSoft,
  }), [colorScheme, colors]);

  const layout = useMemo<LayoutContextType>(() => ({
    aspectRatio: responsive.aspectRatio,
    colorScheme,
    fontScale: responsive.fontScale,
    height: responsive.height,
    insets,
    orientation: responsive.orientation,
    theme,
    width: responsive.width,
  }), [
    colorScheme,
    insets,
    responsive.aspectRatio,
    responsive.fontScale,
    responsive.height,
    responsive.orientation,
    responsive.width,
    theme,
  ]);

  return (
    <LayoutContext.Provider value={layout}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = () => {
  const context = useContext(LayoutContext);
  if (context === null) {
    throw new Error('useLayoutContext must be used within LayoutContextProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWindowDimensions, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

interface LayoutContextType {
  width: number;
  height: number;
  fontScale: number;
  insets: { top: number; right: number; bottom: number; left: number };
  colorScheme: 'light' | 'dark';
  theme: typeof Colors.light | typeof Colors.dark;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export const LayoutContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [layout, setLayout] = useState<LayoutContextType>({
    width,
    height,
    fontScale,
    insets,
    colorScheme,
    theme,
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: NativeSyntheticEvent<NativeScrollEvent>) => {
      setLayout(prev => ({
        ...prev,
        width: window.width,
        height: window.height,
        fontScale: window.fontScale,
      }));
    });

    const colorSchemeSubscription = /*@ts-expect-error*/ Appearance?.addChangeListener?.(({ colorScheme }) => {
      // Note: Appearance is not available in all React Native versions, but we can use useColorScheme hook which already handles it.
      // We don't need to subscribe separately because useColorScheme will re-run the hook on change.
    }, []);

    // We don't need to do anything for colorScheme because useColorScheme hook will cause a re-render when it changes.
    // However, we do need to update the theme when colorScheme changes.
    // Since we are using useColorScheme, the component will re-render when the scheme changes, and we will recalculate the theme.

    return () => {
      Dimensions.removeEventListener('subscription', subscription);
      // colorSchemeSubscription?.remove?.();
    };
  }, []);

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
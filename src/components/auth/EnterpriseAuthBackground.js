import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRootLayout } from '../../contexts/RootLayoutContext';

/**
 * @param {{ backgroundColor?: string, children: React.ReactNode }} props
 */
export default function EnterpriseAuthBackground({ backgroundColor = undefined, children }) {
  const { colors } = useRootLayout();
  const resolvedBackground = backgroundColor || colors.page;

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;
    const previousRootBackground = root.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousEdgeBackground = root.style.getPropertyValue('--shii-edge-background');

    root.style.backgroundColor = resolvedBackground;
    body.style.backgroundColor = resolvedBackground;
    root.style.setProperty('--shii-edge-background', resolvedBackground);

    return () => {
      root.style.backgroundColor = previousRootBackground;
      body.style.backgroundColor = previousBodyBackground;
      if (previousEdgeBackground) {
        root.style.setProperty('--shii-edge-background', previousEdgeBackground);
      } else {
        root.style.removeProperty('--shii-edge-background');
      }
    };
  }, [resolvedBackground]);

  return (
    <View style={[styles.root, { backgroundColor: resolvedBackground }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

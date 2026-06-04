import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useRootLayout } from '../contexts/RootLayoutContext';

export default function RootLayout({ children }) {
  const { brand, colors, viewport, webCssVariables } = useRootLayout();

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const documentRoot = document.documentElement;
    const documentBody = document.body;
    const previousRootBackground = documentRoot.style.backgroundColor;
    const previousBodyBackground = documentBody.style.backgroundColor;
    const previousColorScheme = documentRoot.style.colorScheme;
    const previousVariables = Object.fromEntries(
      Object.keys(webCssVariables).map((key) => [key, documentRoot.style.getPropertyValue(key)])
    );

    documentRoot.style.backgroundColor = colors.page;
    documentRoot.style.colorScheme = brand.mode;
    documentBody.style.backgroundColor = colors.page;
    Object.entries(webCssVariables).forEach(([key, value]) => {
      documentRoot.style.setProperty(key, value);
    });

    return () => {
      documentRoot.style.backgroundColor = previousRootBackground;
      documentRoot.style.colorScheme = previousColorScheme;
      documentBody.style.backgroundColor = previousBodyBackground;
      Object.entries(previousVariables).forEach(([key, value]) => {
        if (value) {
          documentRoot.style.setProperty(key, value);
        } else {
          documentRoot.style.removeProperty(key);
        }
      });
    };
  }, [brand.mode, colors.page, webCssVariables]);

  return (
    <View style={[styles.root, { backgroundColor: colors.page, minHeight: viewport.height }]}>
      <StatusBar
        backgroundColor={colors.header}
        barStyle={brand.mode === 'light' ? 'dark-content' : 'light-content'}
      />
      <View style={[styles.appFrame, { backgroundColor: colors.page }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'visible',
    width: '100%',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    overflow: 'visible',
  },
});

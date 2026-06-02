import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLayoutContext } from '../contexts/LayoutContext';

export default function RootLayout({ children }) {
  const { width, height, theme } = useLayoutContext();

  return (
    <View style={[styles.root, { width, height, backgroundColor: theme.background }]}>
      <View style={[styles.appFrame, { width, height, backgroundColor: theme.background }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100vh',
    overflow: 'visible',
  },
  appFrame: {
    flex: 1,
    minHeight: '100vh',
    width: '100%',
    overflow: 'visible',
  },
});

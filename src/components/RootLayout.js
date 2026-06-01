import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/theme';

export default function RootLayout({ children }) {
  return (
    <View style={styles.root}>
      <View style={styles.appFrame}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
    backgroundColor: Colors.background,
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
  },
  appFrame: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
    width: '100%',
    backgroundColor: Colors.background,
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
  },
});

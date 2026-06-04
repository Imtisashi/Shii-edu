import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRootLayout } from '../../contexts/RootLayoutContext';

export default function EnterpriseAuthBackground({ children }) {
  const { colors } = useRootLayout();

  return (
    <View style={[styles.root, { backgroundColor: colors.page }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRootLayout } from '../../contexts/RootLayoutContext';

/**
 * @param {{ backgroundColor?: string, children: React.ReactNode }} props
 */
export default function EnterpriseAuthBackground({ backgroundColor = undefined, children }) {
  const { colors } = useRootLayout();

  return (
    <View style={[styles.root, { backgroundColor: backgroundColor || colors.page }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { installWebPerformanceTuning } from './src/utils/webPerformanceTuning';
import { installWebScrollFix } from './src/utils/webScrollFix';

const linking = {
  enabled: true,
  prefixes: [],
};

const documentTitle = {
  formatter: (options) => {
    const routeTitle = options?.title;
    return routeTitle && routeTitle !== 'Login' ? `${routeTitle} | Shii Edu` : 'Shii Edu';
  },
};

export default function App() {
  const [iconsReady, setIconsReady] = React.useState(false);

  React.useEffect(() => {
    installWebPerformanceTuning();
    installWebScrollFix();

    let mounted = true;
    Font.loadAsync(Ionicons.font)
      .catch((error) => {
        console.warn('Failed to load app icons', error);
      })
      .finally(() => {
        if (mounted) setIconsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!iconsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContainer linking={linking} documentTitle={documentTitle}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

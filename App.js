import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { InstitutionProvider } from './src/contexts/InstitutionContext';
import { LayoutContextProvider } from './src/contexts/LayoutContext';
import { EDGE_BACKGROUND, RootLayoutProvider } from './src/contexts/RootLayoutContext';
import AppNavigator from './src/navigation/AppNavigator';
import RootLayout from './src/components/RootLayout';
import GlobalErrorBoundary from './src/components/errors/GlobalErrorBoundary';
import { installWebPerformanceTuning } from './src/utils/webPerformanceTuning';
import { installWebScrollFix } from './src/utils/webScrollFix';
import { installFirestoreOfflinePersistence } from './src/services/offlinePersistence';

const linking = {
  enabled: true,
  prefixes: [],
};

const documentTitle = {
  formatter: (options) => {
    const routeTitle = options?.title;
    return routeTitle && routeTitle !== 'Login' ? `${routeTitle} | Shii-Edu` : 'Shii-Edu';
  },
};

export default function App() {
  const [iconsReady, setIconsReady] = React.useState(false);

  React.useEffect(() => {
    installWebPerformanceTuning();
    installWebScrollFix();
    installFirestoreOfflinePersistence();

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

  if (!iconsReady) {
    return <GestureHandlerRootView style={{ flex: 1, backgroundColor: EDGE_BACKGROUND }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: EDGE_BACKGROUND }}>
      <SafeAreaProvider>
        <GlobalErrorBoundary appName="Shii-Edu">
          <AuthProvider appMode="institute">
            <InstitutionProvider>
            <RootLayoutProvider>
              <LayoutContextProvider>
                <NavigationContainer linking={linking} documentTitle={documentTitle}>
                  <RootLayout>
                    <AppNavigator />
                  </RootLayout>
                </NavigationContainer>
              </LayoutContextProvider>
            </RootLayoutProvider>
            </InstitutionProvider>
          </AuthProvider>
        </GlobalErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

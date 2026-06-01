import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { InstitutionProvider } from './src/contexts/InstitutionContext';
import AppNavigator from './src/navigation/AppNavigator';
import RootLayout from './src/components/RootLayout';
import { installWebPerformanceTuning } from './src/utils/webPerformanceTuning';
import { installWebScrollFix } from './src/utils/webScrollFix';
import { installFirestoreOfflinePersistence } from './src/services/offlinePersistence';
import { Colors } from './src/constants/theme';

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

  if (!iconsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <AuthProvider>
        <InstitutionProvider>
          <NavigationContainer linking={linking} documentTitle={documentTitle}>
            <RootLayout>
              <AppNavigator />
            </RootLayout>
          </NavigationContainer>
        </InstitutionProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

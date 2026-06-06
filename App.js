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
import { installWebFeedbackBridge } from './src/utils/userFeedback';
import { installFirestoreOfflinePersistence } from './src/services/offlinePersistence';
import { getAuthRoleByAppPath, getAuthRoleOption } from './src/constants/authRoles';

const linking = {
  enabled: true,
  prefixes: [],
  config: {
    screens: {
      RoleSelection: 'roles',
      Login: 'login',
      InstituteAuth: 'auth/institute',
      ParentsAuth: 'auth/parents',
      DriverAuth: 'auth/driver',
    },
  },
};

const formatDefaultDocumentTitle = (options) => {
  const routeTitle = options?.title;
  return routeTitle && routeTitle !== 'Login' ? `${routeTitle} | Shii-Edu` : 'Shii-Edu';
};

const getLockedRoleFromLocation = () => {
  if (typeof window === 'undefined') return null;
  return getAuthRoleByAppPath(window.location.pathname);
};

export default function App() {
  const [iconsReady, setIconsReady] = React.useState(false);
  const [lockedRole, setLockedRole] = React.useState(getLockedRoleFromLocation);

  React.useEffect(() => {
    installWebFeedbackBridge();
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

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncLockedRole = () => setLockedRole(getLockedRoleFromLocation());
    window.addEventListener('popstate', syncLockedRole);
    return () => {
      window.removeEventListener('popstate', syncLockedRole);
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!lockedRole) {
      document.title = 'Shii-Edu';
      return;
    }
    const lockedRoleOption = getAuthRoleOption(lockedRole);
    document.title = `Shii-Edu ${lockedRoleOption.shortName}`;
  }, [lockedRole]);

  const navigationDocumentTitle = React.useMemo(
    () => ({
      formatter: (options) => {
        if (!lockedRole) return formatDefaultDocumentTitle(options);
        const lockedRoleOption = getAuthRoleOption(lockedRole);
        return `Shii-Edu ${lockedRoleOption.shortName}`;
      },
    }),
    [lockedRole]
  );

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
                <NavigationContainer linking={lockedRole ? undefined : linking} documentTitle={navigationDocumentTitle}>
                  <RootLayout>
                    <AppNavigator lockedRole={lockedRole} />
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

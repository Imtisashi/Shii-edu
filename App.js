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
import { useAuth } from './src/contexts/AuthContext';
import AppNavigator, { ProfileIssueState } from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import SuperAdminNavigator from './src/navigation/SuperAdminNavigator';
import InstituteSyncSplash from './src/components/auth/InstituteSyncSplash';
import RootLayout from './src/components/RootLayout';
import GlobalErrorBoundary from './src/components/errors/GlobalErrorBoundary';
import { installWebPerformanceTuning } from './src/utils/webPerformanceTuning';
import { installWebScrollFix } from './src/utils/webScrollFix';
import { installWebFeedbackBridge } from './src/utils/userFeedback';
import { installFirestoreOfflinePersistence } from './src/services/offlinePersistence';
import { getAuthRoleByPath, getAuthRoleOption, normalizeAuthRole } from './src/constants/authRoles';

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
      Register: 'register',
    },
  },
};

const formatDefaultDocumentTitle = (options) => {
  const routeTitle = options?.title;
  return routeTitle && routeTitle !== 'Login' ? `${routeTitle} | Shii-Edu` : 'Shii-Edu';
};

const SUPERADMIN_ROLE = 'superadmin';

const normalizeProfileRole = (role) =>
  String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const getLockedRoleOption = (lockedRole) => {
  if (lockedRole === SUPERADMIN_ROLE) {
    return {
      label: 'Superadmin',
      shortName: 'Superadmin',
    };
  }

  return getAuthRoleOption(lockedRole);
};

const getLockedRoleFromLocation = () => {
  const envRole = process.env.EXPO_PUBLIC_LOCKED_ROLE;
  if (envRole && normalizeProfileRole(envRole) === SUPERADMIN_ROLE) return SUPERADMIN_ROLE;
  if (envRole) return normalizeAuthRole(envRole);
  if (typeof window === 'undefined') return null;
  const normalizedPath = String(window.location.pathname || '').replace(/\/$/, '').toLowerCase();
  if (normalizedPath === '/app/superadmin' || normalizedPath.startsWith('/app/superadmin/')) {
    return SUPERADMIN_ROLE;
  }
  return getAuthRoleByPath(window.location.pathname);
};

function SuperadminGate() {
  const { currentUser, userData, loading, logout, profileError } = useAuth();

  if (loading) {
    return <InstituteSyncSplash />;
  }

  if (!currentUser) {
    return <AuthNavigator />;
  }

  if (!userData) {
    return (
      <ProfileIssueState
        hint="Ask the platform owner to grant this Firebase account superadmin access, then sign in again."
        message={profileError || 'Your account is authenticated, but no superadmin profile or claim could be loaded.'}
        onPress={logout}
        title="Superadmin Profile Required"
      />
    );
  }

  if (normalizeProfileRole(userData.role) !== SUPERADMIN_ROLE) {
    return (
      <ProfileIssueState
        message="This application is only for Shii-Edu superadmin accounts."
        onPress={logout}
        title="Internal Access Only"
      />
    );
  }

  return <SuperAdminNavigator />;
}

export default function App() {
  const [iconsReady, setIconsReady] = React.useState(false);
  const [lockedRole, setLockedRole] = React.useState(getLockedRoleFromLocation);
  const isSuperadminShell = lockedRole === SUPERADMIN_ROLE;

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
    if (typeof document === 'undefined') return undefined;
    if (!lockedRole) {
      document.title = 'Shii-Edu';
    } else {
      const lockedRoleOption = getLockedRoleOption(lockedRole);
      document.title = `Shii-Edu ${lockedRoleOption.shortName}`;
    }

    if (typeof window === 'undefined') return undefined;

    const syncDocumentHeight = () => window.__shiiEduSyncDocumentHeight?.();
    syncDocumentHeight();
    const frameId = window.requestAnimationFrame(syncDocumentHeight);
    const timeoutId = window.setTimeout(syncDocumentHeight, 350);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [lockedRole]);

  const navigationDocumentTitle = React.useMemo(
    () => ({
      formatter: (options) => {
        if (!lockedRole) return formatDefaultDocumentTitle(options);
        const lockedRoleOption = getLockedRoleOption(lockedRole);
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
          <AuthProvider appMode={isSuperadminShell ? 'combined' : 'institute'}>
            <InstitutionProvider>
            <RootLayoutProvider>
              <LayoutContextProvider>
                <NavigationContainer linking={lockedRole ? undefined : linking} documentTitle={navigationDocumentTitle}>
                  <RootLayout>
                    {isSuperadminShell ? <SuperadminGate /> : <AppNavigator lockedRole={lockedRole} />}
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

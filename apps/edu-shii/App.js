import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { InstitutionProvider } from '../../src/contexts/InstitutionContext';
import { LayoutContextProvider } from '../../src/contexts/LayoutContext';
import { EDGE_BACKGROUND, RootLayoutProvider, useRootLayout } from '../../src/contexts/RootLayoutContext';
import AdminNavigator from '../../src/navigation/AdminNavigator';
import StudentNavigator from '../../src/navigation/StudentNavigator';
import TeacherNavigator from '../../src/navigation/TeacherNavigator';
import ParentNavigator from '../../src/navigation/ParentNavigator';
import DriverNavigator from '../../src/navigation/DriverNavigator';
import RootLayout from '../../src/components/RootLayout';
import GlobalErrorBoundary from '../../src/components/errors/GlobalErrorBoundary';
import InstituteSyncSplash from '../../src/components/auth/InstituteSyncSplash';
import { installWebPerformanceTuning } from '../../src/utils/webPerformanceTuning';
import { installWebScrollFix } from '../../src/utils/webScrollFix';
import { installFirestoreOfflinePersistence } from '../../src/services/offlinePersistence';
import { getAuthRoleByAppPath, getAuthRoleOption } from '../../src/constants/authRoles';
import InstituteAuthNavigator from './src/navigation/InstituteAuthNavigator';

const linking = Object.freeze({
  enabled: true,
  prefixes: [],
  config: {
    screens: {
      RoleSelection: 'roles',
      InstituteAuth: 'auth/institute',
      ParentsAuth: 'auth/parents',
      DriverAuth: 'auth/driver',
    },
  },
});

const formatDefaultDocumentTitle = (options) => {
  const routeTitle = options?.title;
  return routeTitle ? `${routeTitle} | Shii-Edu` : 'Shii-Edu';
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const getLockedRoleFromLocation = () => {
  if (typeof window === 'undefined') return null;
  return getAuthRoleByAppPath(window.location.pathname);
};

const roleCanOpenLockedApp = (lockedRole, userRole) => {
  if (!lockedRole) return true;
  if (lockedRole === 'parent') return userRole === 'parent';
  if (lockedRole === 'driver') return userRole === 'driver';
  return !['driver', 'parent', 'superadmin'].includes(userRole);
};

function AccessState({ title, message, onSignOut }) {
  const { colors } = useRootLayout();

  return (
    <View style={[styles.stateContainer, { backgroundColor: colors.page }]}>
      <View style={[styles.stateCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
        <View style={[styles.stateIcon, { backgroundColor: colors.deepBlueSoft, borderColor: colors.hairline }]}>
          <Ionicons name="shield-outline" size={30} color={colors.accent} />
        </View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.stateMessage, { color: colors.textSoft }]}>{message}</Text>
        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.deepBlue }]} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InstituteAppNavigator({ lockedRole }) {
  const { currentUser, userData, loading, logout, profileError } = useAuth();
  const lockedRoleOption = lockedRole ? getAuthRoleOption(lockedRole) : null;

  if (loading) {
    return <InstituteSyncSplash />;
  }

  if (!currentUser) {
    return <InstituteAuthNavigator lockedRole={lockedRole} />;
  }

  if (!userData) {
    return (
      <AccessState
        title="Institute Profile Required"
        message={profileError || 'This account is authenticated, but its verified institute profile could not be loaded.'}
        onSignOut={logout}
      />
    );
  }

  const userRole = normalizeRole(userData.role);

  if (!roleCanOpenLockedApp(lockedRole, userRole)) {
    return (
      <AccessState
        title={`${lockedRoleOption.shortName} App Only`}
        message={`This installed app is locked to ${lockedRoleOption.label} access. Sign out and open the correct Shii-Edu app for this account.`}
        onSignOut={logout}
      />
    );
  }

  if (userRole === 'superadmin') {
    return (
      <AccessState
        title="Institute App Only"
        message="Superadmin accounts must use the separate Shii-Edu Superadmin application."
        onSignOut={logout}
      />
    );
  }

  if (userRole === 'admin') {
    return <AdminNavigator />;
  }

  if (userRole === 'teacher') {
    return <TeacherNavigator />;
  }

  if (userRole === 'student') {
    return <StudentNavigator />;
  }

  if (userRole === 'parent') {
    return <ParentNavigator />;
  }

  if (userRole === 'driver') {
    return <DriverNavigator />;
  }

  return (
      <AccessState
        title="Unsupported Institute Role"
        message="This account role is not enabled in the installed Shii-Edu application."
        onSignOut={logout}
      />
  );
}

function InstituteNavigationContainer({ children, lockedRole }) {
  const { brand, colors } = useRootLayout();
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
  const navigationTheme = React.useMemo(() => {
    const baseTheme = brand.mode === 'light' ? DefaultTheme : DarkTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.page,
        border: colors.hairline,
        card: colors.header,
        notification: colors.accent,
        primary: colors.accent,
        text: colors.text,
      },
    };
  }, [brand.mode, colors]);

  return (
    <NavigationContainer
      documentTitle={navigationDocumentTitle}
      linking={lockedRole ? undefined : linking}
      theme={navigationTheme}
    >
      {children}
    </NavigationContainer>
  );
}

export default function App() {
  const [iconsReady, setIconsReady] = React.useState(false);
  const [lockedRole, setLockedRole] = React.useState(getLockedRoleFromLocation);

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

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncLockedRole = () => setLockedRole(getLockedRoleFromLocation());
    window.addEventListener('popstate', syncLockedRole);
    return () => {
      window.removeEventListener('popstate', syncLockedRole);
    };
  }, []);

  if (!iconsReady) {
    return <GestureHandlerRootView style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <GlobalErrorBoundary appName="Shii-Edu">
          <AuthProvider appMode="institute">
            <InstitutionProvider>
              <RootLayoutProvider>
                <LayoutContextProvider>
                  <InstituteNavigationContainer lockedRole={lockedRole}>
                    <RootLayout>
                      <InstituteAppNavigator lockedRole={lockedRole} />
                    </RootLayout>
                  </InstituteNavigationContainer>
                </LayoutContextProvider>
              </RootLayoutProvider>
            </InstitutionProvider>
          </AuthProvider>
        </GlobalErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: EDGE_BACKGROUND,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EDGE_BACKGROUND,
    padding: 20,
  },
  stateCard: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
    marginBottom: 16,
  },
  stateTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateMessage: {
    color: '#B9C6DD',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  signOutButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
});

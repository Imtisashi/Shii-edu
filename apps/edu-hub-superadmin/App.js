import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { InstitutionProvider } from '../../src/contexts/InstitutionContext';
import { LayoutContextProvider } from '../../src/contexts/LayoutContext';
import { EDGE_BACKGROUND, RootLayoutProvider } from '../../src/contexts/RootLayoutContext';
import AuthNavigator from '../../src/navigation/AuthNavigator';
import SuperAdminNavigator from '../../src/navigation/SuperAdminNavigator';
import RootLayout from '../../src/components/RootLayout';
import GlobalErrorBoundary from '../../src/components/errors/GlobalErrorBoundary';
import LoadingState from '../../src/components/ui/LoadingState';
import { installWebPerformanceTuning } from '../../src/utils/webPerformanceTuning';
import { installWebScrollFix } from '../../src/utils/webScrollFix';
import { installFirestoreOfflinePersistence } from '../../src/services/offlinePersistence';

const linking = {
  enabled: true,
  prefixes: [],
};

const documentTitle = {
  formatter: (options) => {
    const routeTitle = options?.title;
    return routeTitle ? `${routeTitle} | Edu-Hub Superadmin` : 'Edu-Hub Superadmin';
  },
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

function AccessState({ title, message, onSignOut }) {
  return (
    <View style={styles.stateContainer}>
      <View style={styles.stateCard}>
        <View style={styles.stateIcon}>
          <Ionicons name="shield-outline" size={30} color="#2563EB" />
        </View>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateMessage}>{message}</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SuperadminAppNavigator() {
  const { currentUser, userData, loading, logout, profileError } = useAuth();

  if (loading) {
    return <LoadingState label="Preparing Edu-Hub Superadmin..." color="#38BDF8" />;
  }

  if (!currentUser) {
    return <AuthNavigator />;
  }

  if (!userData) {
    return (
      <AccessState
        title="Superadmin Profile Required"
        message={profileError || 'This account is authenticated, but its verified platform profile could not be loaded.'}
        onSignOut={logout}
      />
    );
  }

  if (normalizeRole(userData.role) !== 'superadmin') {
    return (
      <AccessState
        title="Internal Access Only"
        message="This application is restricted to verified Edu-Hub superadmin accounts."
        onSignOut={logout}
      />
    );
  }

  return <SuperAdminNavigator />;
}

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
    return <GestureHandlerRootView style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <GlobalErrorBoundary appName="Edu-Hub Superadmin">
          <AuthProvider>
            <InstitutionProvider>
            <RootLayoutProvider>
              <LayoutContextProvider>
                <NavigationContainer linking={linking} documentTitle={documentTitle}>
                  <RootLayout>
                    <SuperadminAppNavigator />
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
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

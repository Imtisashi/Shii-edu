import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import RoleDrawerContent from '../components/navigation/RoleDrawerContent';
import { useInstitution } from '../contexts/InstitutionContext';
import { useRootLayout } from '../contexts/RootLayoutContext';
import { isFeatureEnabled } from '../constants/featureEntitlements';
import DriverFleetScreen from '../screens/driver/DriverFleetScreen';
import CommunicationHub from '../screens/shared/CommunicationHub';
import AccountProfileScreen from '../screens/shared/AccountProfileScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const driverDrawerLinks = [
  { featureKey: 'transport', icon: 'bus-outline', label: 'Driver Console', routeName: 'DriverDashboard', params: { screen: 'DriverFleet' } },
  { featureKey: 'messages', icon: 'chatbubbles-outline', label: 'Messages', routeName: 'DriverDashboard', params: { screen: 'CommunicationHub' } },
];

function DriverStackNavigator() {
  const { colors } = useRootLayout();
  const { instituteData } = useInstitution();
  const hasTransport = isFeatureEnabled(instituteData, 'transport');
  const hasMessages = isFeatureEnabled(instituteData, 'messages');

  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedStackScreenOptions,
        cardStyle: { backgroundColor: colors.page },
        headerShown: false,
      }}
    >
      {hasTransport ? <Stack.Screen component={DriverFleetScreen} name="DriverFleet" /> : null}
      {hasMessages ? <Stack.Screen component={CommunicationHub} name="CommunicationHub" /> : null}
      {!hasTransport && !hasMessages ? <Stack.Screen component={AccountProfileScreen} name="DriverFallbackProfile" /> : null}
    </Stack.Navigator>
  );
}

export default function DriverNavigator() {
  const { colors } = useRootLayout();
  const { instituteData } = useInstitution();
  const dashboardParams = isFeatureEnabled(instituteData, 'transport')
    ? { screen: 'DriverFleet' }
    : isFeatureEnabled(instituteData, 'messages')
      ? { screen: 'CommunicationHub' }
      : { screen: 'DriverFallbackProfile' };

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <RoleDrawerContent
          {...props}
          dashboardParams={dashboardParams}
          dashboardRoute="DriverDashboard"
          profileRoute="DriverProfile"
          settingsRoute="DriverSettings"
          workspaceLinks={driverDrawerLinks}
        />
      )}
      screenOptions={{
        ...sharedStackScreenOptions,
        drawerActiveBackgroundColor: colors.accentSoft,
        drawerActiveTintColor: colors.text,
        drawerInactiveTintColor: colors.muted,
        drawerLabelStyle: { fontWeight: '900' },
        drawerStyle: { backgroundColor: colors.page, width: 292 },
        drawerType: 'front',
        headerShown: false,
        overlayColor: colors.overlay,
        sceneContainerStyle: { backgroundColor: colors.page },
      }}
    >
      <Drawer.Screen name="DriverDashboard" component={DriverStackNavigator} />
      <Drawer.Screen name="DriverProfile" component={AccountProfileScreen} />
      <Drawer.Screen name="DriverSettings" component={AccountSettingsScreen} />
    </Drawer.Navigator>
  );
}

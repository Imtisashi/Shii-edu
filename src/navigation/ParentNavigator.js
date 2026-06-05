import React from 'react';
import { View } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import EdgeDrawerButton from '../components/navigation/EdgeDrawerButton';
import RoleDrawerContent from '../components/navigation/RoleDrawerContent';
import { useInstitution } from '../contexts/InstitutionContext';
import { useRootLayout } from '../contexts/RootLayoutContext';
import { isFeatureEnabled } from '../constants/featureEntitlements';
import ParentHome from '../screens/parent/ParentHome';
import FeePayment from '../screens/student/FeePayment';
import StudentNotifications from '../screens/student/StudentNotifications';
import CommunicationHub from '../screens/shared/CommunicationHub';
import FleetTrackingScreen from '../screens/shared/FleetTrackingScreen';
import AccountProfileScreen from '../screens/shared/AccountProfileScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';

const Drawer = createDrawerNavigator();

const parentDrawerLinks = [
  { featureKey: 'finance', icon: 'wallet-outline', label: 'Fee Payment', routeName: 'Fee Payment' },
  { featureKey: 'transport', icon: 'bus-outline', label: 'Live Fleet', routeName: 'Live Fleet' },
  { featureKey: 'messages', icon: 'chatbubbles-outline', label: 'Messages', routeName: 'CommunicationHub' },
  { featureKey: 'notices', icon: 'notifications-outline', label: 'Notifications', routeName: 'Notifications' },
];

export default function ParentNavigator() {
  const { colors } = useRootLayout();
  const { instituteData } = useInstitution();

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <RoleDrawerContent
          {...props}
          dashboardRoute="ParentHome"
          profileRoute="ParentProfile"
          settingsRoute="ParentSettings"
          workspaceLinks={parentDrawerLinks}
        />
      )}
      screenOptions={({ navigation }) => ({
        ...sharedStackScreenOptions,
        drawerActiveBackgroundColor: colors.accentSoft,
        drawerActiveTintColor: colors.text,
        drawerInactiveTintColor: colors.muted,
        drawerLabelStyle: { fontWeight: '800' },
        drawerStyle: { backgroundColor: colors.page, width: 280 },
        headerLeft: () => (
          <View style={{ marginLeft: 14 }}>
            <EdgeDrawerButton onPress={() => navigation.openDrawer()} size={42} />
          </View>
        ),
        headerStyle: {
          backgroundColor: colors.header,
          borderBottomColor: colors.hairline,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '900' },
        overlayColor: colors.overlay,
        sceneContainerStyle: { backgroundColor: colors.page },
      })}
    >
      <Drawer.Screen
        component={ParentHome}
        name="ParentHome"
        options={{
          drawerLabel: 'Home',
          headerShown: false,
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={24} />,
        }}
      />
      {isFeatureEnabled(instituteData, 'finance') ? <Drawer.Screen
        component={FeePayment}
        name="Fee Payment"
        options={{
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'wallet' : 'wallet-outline'} size={24} />,
        }}
      /> : null}
      {isFeatureEnabled(instituteData, 'transport') ? <Drawer.Screen
        component={FleetTrackingScreen}
        name="Live Fleet"
        options={{
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'bus' : 'bus-outline'} size={24} />,
        }}
      /> : null}
      {isFeatureEnabled(instituteData, 'messages') ? <Drawer.Screen
        component={CommunicationHub}
        name="CommunicationHub"
        options={{
          drawerLabel: 'Messages',
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} />,
        }}
      /> : null}
      {isFeatureEnabled(instituteData, 'notices') ? <Drawer.Screen
        component={StudentNotifications}
        name="Notifications"
        options={{
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'notifications' : 'notifications-outline'} size={24} />,
        }}
      /> : null}
      <Drawer.Screen
        component={AccountProfileScreen}
        name="ParentProfile"
        options={{ drawerLabel: 'Profile', title: 'Profile' }}
      />
      <Drawer.Screen
        component={AccountSettingsScreen}
        name="ParentSettings"
        options={{ drawerLabel: 'Settings', title: 'Settings' }}
      />
    </Drawer.Navigator>
  );
}

import React from 'react';
import { View } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import EdgeDrawerButton from '../components/navigation/EdgeDrawerButton';
import { useRootLayout } from '../contexts/RootLayoutContext';
import ParentHome from '../screens/parent/ParentHome';
import FeePayment from '../screens/student/FeePayment';
import StudentNotifications from '../screens/student/StudentNotifications';
import CommunicationHub from '../screens/shared/CommunicationHub';
import FleetTrackingScreen from '../screens/shared/FleetTrackingScreen';

const Drawer = createDrawerNavigator();

export default function ParentNavigator() {
  const { colors } = useRootLayout();

  return (
    <Drawer.Navigator
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
      <Drawer.Screen
        component={FeePayment}
        name="Fee Payment"
        options={{
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'wallet' : 'wallet-outline'} size={24} />,
        }}
      />
      <Drawer.Screen
        component={FleetTrackingScreen}
        name="Live Fleet"
        options={{
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'bus' : 'bus-outline'} size={24} />,
        }}
      />
      <Drawer.Screen
        component={CommunicationHub}
        name="CommunicationHub"
        options={{
          drawerLabel: 'Messages',
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} />,
        }}
      />
      <Drawer.Screen
        component={StudentNotifications}
        name="Notifications"
        options={{
          drawerIcon: ({ focused, color }) => <Ionicons color={color} name={focused ? 'notifications' : 'notifications-outline'} size={24} />,
        }}
      />
    </Drawer.Navigator>
  );
}

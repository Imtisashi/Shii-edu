import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import SuperadminMasterDashboard from '../screens/superAdmin/SuperadminMasterDashboard';
import ManageAdminUsers from '../screens/superAdmin/ManageAdminUsers';
import ManageInstitutes from '../screens/superAdmin/ManageInstitutes';
import PasswordResetRequests from '../screens/admin/PasswordResetRequests';
import { EDGE_BACKGROUND } from '../contexts/RootLayoutContext';

const Stack = createStackNavigator();

export default function SuperAdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedStackScreenOptions,
        headerShown: true,
        cardStyle: {
          backgroundColor: EDGE_BACKGROUND,
        },
        headerStyle: {
          backgroundColor: EDGE_BACKGROUND,
          borderBottomColor: '#334155',
          borderBottomWidth: 1,
        },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: {
          fontWeight: '900',
          color: '#F8FAFC',
        },
        headerTitleAlign: 'center',
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="SuperAdminHome" component={SuperadminMasterDashboard} options={{ title: 'Superadmin Master' }} />
      <Stack.Screen name="ManageAdminUsers" component={ManageAdminUsers} options={{ title: 'Administrators' }} />
      <Stack.Screen name="ManageInstitutes" component={ManageInstitutes} options={{ title: 'Institutes' }} />
      <Stack.Screen name="PasswordResetRequests" component={PasswordResetRequests} options={{ title: 'Password Resets' }} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import SuperAdminHome from '../screens/superAdmin/SuperAdminHome';
import ManageAdminUsers from '../screens/superAdmin/ManageAdminUsers';
import ManageInstitutes from '../screens/superAdmin/ManageInstitutes';

const Stack = createStackNavigator();

export default function SuperAdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedStackScreenOptions,
        headerShown: true,
        headerStyle: {
          backgroundColor: '#0F172A',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '900',
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="SuperAdminHome" component={SuperAdminHome} options={{ title: 'Super Admin' }} />
      <Stack.Screen name="ManageAdminUsers" component={ManageAdminUsers} options={{ title: 'Administrators' }} />
      <Stack.Screen name="ManageInstitutes" component={ManageInstitutes} options={{ title: 'Institutes' }} />
    </Stack.Navigator>
  );
}

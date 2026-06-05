import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import InstituteLoginScreen from '../screens/auth/InstituteLoginScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';

const Stack = createStackNavigator();

export default function InstituteAuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="RoleSelection"
      screenOptions={{
        ...sharedStackScreenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen
        name="Login"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'institute' }}
      />
      <Stack.Screen
        name="InstituteAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'institute' }}
      />
      <Stack.Screen
        name="ParentsAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'parent' }}
      />
      <Stack.Screen
        name="DriverAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'driver' }}
      />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import { sharedStackScreenOptions } from '../../../../src/navigation/animatedScreenOptions';
import InstituteLoginScreen from '../../../../src/screens/auth/InstituteLoginScreen';
import RoleSelectionScreen from '../../../../src/screens/auth/RoleSelectionScreen';

const Stack = createStackNavigator();

export default function InstituteAuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="RoleSelection"
      screenOptions={{
        ...(sharedStackScreenOptions as StackNavigationOptions),
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="RoleSelection"
        component={RoleSelectionScreen}
        options={{ title: 'Choose role' }}
      />
      <Stack.Screen
        name="InstituteAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'institute' }}
        options={{ title: 'Sign in' }}
      />
      <Stack.Screen
        name="ParentsAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'parent' }}
        options={{ title: 'Parent sign in' }}
      />
      <Stack.Screen
        name="DriverAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'driver' }}
        options={{ title: 'Driver sign in' }}
      />
    </Stack.Navigator>
  );
}

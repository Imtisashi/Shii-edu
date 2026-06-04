import React from 'react';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import { sharedStackScreenOptions } from '../../../../src/navigation/animatedScreenOptions';
import InstituteLoginScreen from '../../../../src/screens/auth/InstituteLoginScreen';

const Stack = createStackNavigator();

export default function InstituteAuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="InstituteLogin"
      screenOptions={{
        ...(sharedStackScreenOptions as StackNavigationOptions),
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="InstituteLogin"
        component={InstituteLoginScreen}
        options={{ title: 'Sign in' }}
      />
    </Stack.Navigator>
  );
}

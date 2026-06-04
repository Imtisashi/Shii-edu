import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';

import LoginScreen from '../screens/auth/LoginScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        ...sharedStackScreenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

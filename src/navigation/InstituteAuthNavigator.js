import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import InstituteLoginScreen from '../screens/auth/InstituteLoginScreen';

const Stack = createStackNavigator();

export default function InstituteAuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        ...sharedStackScreenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={InstituteLoginScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import { getAuthRoleOption } from '../constants/authRoles';
import InstituteLoginScreen from '../screens/auth/InstituteLoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';

const Stack = createStackNavigator();

export default function InstituteAuthNavigator({ lockedRole = null }) {
  const lockedParams = lockedRole ? { lockedRole } : undefined;
  const initialRouteName = lockedRole ? getAuthRoleOption(lockedRole).routeName : 'RoleSelection';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        ...sharedStackScreenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} initialParams={lockedParams} />
      <Stack.Screen
        name="Login"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'institute', ...lockedParams }}
      />
      <Stack.Screen
        name="InstituteAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'institute', ...lockedParams }}
      />
      <Stack.Screen
        name="ParentsAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'parent', ...lockedParams }}
      />
      <Stack.Screen
        name="DriverAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'driver', ...lockedParams }}
      />
      <Stack.Screen name="Register" component={RegisterScreen} initialParams={lockedParams} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import { sharedStackScreenOptions } from '../../../../src/navigation/animatedScreenOptions';
import { getAuthRoleOption, type AuthRoleId } from '../../../../src/constants/authRoles';
import InstituteLoginScreen from '../../../../src/screens/auth/InstituteLoginScreen';
import RoleSelectionScreen from '../../../../src/screens/auth/RoleSelectionScreen';

const Stack = createStackNavigator();

type InstituteAuthNavigatorProps = {
  lockedRole?: AuthRoleId | null;
};

export default function InstituteAuthNavigator({ lockedRole = null }: InstituteAuthNavigatorProps) {
  const lockedParams = lockedRole ? { lockedRole } : undefined;
  const initialRouteName = lockedRole ? getAuthRoleOption(lockedRole).routeName : 'RoleSelection';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        ...(sharedStackScreenOptions as StackNavigationOptions),
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="RoleSelection"
        component={RoleSelectionScreen}
        initialParams={lockedParams}
        options={{ title: 'Choose role' }}
      />
      <Stack.Screen
        name="InstituteAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'institute', ...lockedParams }}
        options={{ title: 'Sign in' }}
      />
      <Stack.Screen
        name="ParentsAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'parent', ...lockedParams }}
        options={{ title: 'Parent sign in' }}
      />
      <Stack.Screen
        name="DriverAuth"
        component={InstituteLoginScreen}
        initialParams={{ initialRole: 'driver', ...lockedParams }}
        options={{ title: 'Driver sign in' }}
      />
    </Stack.Navigator>
  );
}

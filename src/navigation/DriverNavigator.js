import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import { useRootLayout } from '../contexts/RootLayoutContext';
import DriverFleetScreen from '../screens/driver/DriverFleetScreen';
import CommunicationHub from '../screens/shared/CommunicationHub';

const Stack = createStackNavigator();

export default function DriverNavigator() {
  const { colors } = useRootLayout();

  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedStackScreenOptions,
        cardStyle: { backgroundColor: colors.page },
        headerShown: false,
      }}
    >
      <Stack.Screen component={DriverFleetScreen} name="DriverFleet" />
      <Stack.Screen component={CommunicationHub} name="CommunicationHub" />
    </Stack.Navigator>
  );
}

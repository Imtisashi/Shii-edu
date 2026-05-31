import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions, sharedTabScreenOptions } from './animatedScreenOptions';

// Import Admin Screens
import AdminHome from '../screens/admin/AdminHome';
import ManageUsers from '../screens/admin/ManageUsers';
import FeeTracking from '../screens/admin/FeeTracking';
import ManageNotices from '../screens/admin/ManageNotices';
import ManageTeachers from '../screens/admin/ManageTeachers';
import ManageRoutines from '../screens/admin/ManageRoutines';
import ManageHolidays from '../screens/admin/ManageHolidays';
import UploadGallery from '../screens/admin/UploadGallery';
import AddUser from '../screens/admin/AddUser';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// --- THE ADMIN BOTTOM BAR ---
function AdminBottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...sharedTabScreenOptions,
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Users') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Ledger') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'Broadcasts') iconName = focused ? 'megaphone' : 'megaphone-outline';
          
          return <Ionicons name={iconName} size={focused ? 28 : 24} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6', // Admin Theme Color (Blue)
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 10,
        },
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 11 }
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminHome} />
      <Tab.Screen name="Users" component={ManageUsers} />
      <Tab.Screen name="Ledger" component={FeeTracking} />
      <Tab.Screen name="Broadcasts" component={ManageNotices} />
    </Tab.Navigator>
  );
}

// --- THE MASTER STACK ---
export default function AdminNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        ...sharedStackScreenOptions,
        headerStyle: { backgroundColor: '#fff', elevation: 0, shadowOpacity: 0 }, 
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {/* 1. Load the Bottom Tabs First */}
      <Stack.Screen name="MainTabs" component={AdminBottomTabs} options={{ headerShown: false }} />
      
      {/* 2. Hidden Pop-up Screens */}
      <Stack.Screen name="ManageTeachers" component={ManageTeachers} options={{ title: 'Faculty Roster' }} />
      <Stack.Screen name="ManageRoutines" component={ManageRoutines} options={{ title: 'Master Schedule' }} />
      <Stack.Screen name="ManageHolidays" component={ManageHolidays} options={{ title: 'Campus Calendar' }} />
      <Stack.Screen name="UploadGallery" component={UploadGallery} options={{ title: 'Event Gallery' }} />
      <Stack.Screen name="AddUser" component={AddUser} options={{ title: 'Add Users' }} />
    </Stack.Navigator>
  );
}

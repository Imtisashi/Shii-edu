import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions, sharedTabScreenOptions } from './animatedScreenOptions';
import useResponsiveLayout from '../hooks/useResponsiveLayout';

// Import all Student Screens
import StudentHome from '../screens/student/StudentHome';
import FeePayment from '../screens/student/FeePayment';
import GalleryView from '../screens/student/GalleryView';
import TeachersProfile from '../screens/student/TeachersProfile';
import PYQView from '../screens/student/PYQView';
import Assignments from '../screens/student/Assignments';
import AttendanceView from '../screens/student/AttendanceView';
import Grades from '../screens/student/Grades';
import Notices from '../screens/student/Notices';
import Routine from '../screens/student/Routine';
import StudentNotifications from '../screens/student/StudentNotifications';

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

// --- THE BOTTOM TAB NAVIGATOR (for quick access) ---
function BottomTabNavigator() {
  const layout = useResponsiveLayout();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...sharedTabScreenOptions,
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Notices') iconName = focused ? 'megaphone' : 'megaphone-outline';
          else if (route.name === 'Faculty') iconName = focused ? 'people' : 'people-outline';

          const iconSize = layout.isMobile ? (focused ? 23 : 21) : (focused ? 28 : 24);
          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: layout.isMobile ? 62 : 65,
          paddingBottom: layout.isMobile ? 7 : 10,
          paddingTop: layout.isMobile ? 7 : 10,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarItemStyle: layout.isMobile ? { paddingHorizontal: 0 } : undefined,
        tabBarLabelStyle: {
          fontWeight: 'bold',
          fontSize: layout.isMobile ? 10 : 11,
        }
      })}
    >
      <Tab.Screen name="Home" component={StudentHome} />
      <Tab.Screen name="Tasks" component={Assignments} />
      <Tab.Screen name="Notices" component={Notices} />
      <Tab.Screen name="Faculty" component={TeachersProfile} />
    </Tab.Navigator>
  );
}

// --- THE MAIN DRAWER NAVIGATOR ---
export default function StudentNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        ...sharedStackScreenOptions,
        headerStyle: { backgroundColor: '#fff', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: 'bold' },
        drawerActiveTintColor: '#4A90E2',
        drawerInactiveTintColor: '#94A3B8',
        drawerStyle: { width: 280 },
      }}
    >
      {/* Home screen is the bottom tab navigator */}
      <Drawer.Screen name="Home" component={BottomTabNavigator} options={{
        drawerLabel: 'Home',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
        )
      }} />

      {/* Other screens accessible from the drawer */}
      <Drawer.Screen name="Gallery" component={GalleryView} options={{
        drawerLabel: 'Gallery',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'images' : 'images-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="Attendance" component={AttendanceView} options={{
        drawerLabel: 'Attendance',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="Grades" component={Grades} options={{
        drawerLabel: 'Grades',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'school' : 'school-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="Routine" component={Routine} options={{
        drawerLabel: 'Routine',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="PYQs" component={PYQView} options={{
        drawerLabel: 'PYQs',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="Fee Payment" component={FeePayment} options={{
        drawerLabel: 'Fee Payment',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={24} color={color} />
        )
      }} />

      {/* We can add more screens as needed */}
      <Drawer.Screen name="Notifications" component={StudentNotifications} options={{
        drawerLabel: 'Notifications',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={24} color={color} />
        )
      }} />
    </Drawer.Navigator>
  );
}

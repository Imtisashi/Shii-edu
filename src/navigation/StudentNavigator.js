import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// --- THE NEW BOTTOM BAR ---
function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Notices') iconName = focused ? 'megaphone' : 'megaphone-outline';
          else if (route.name === 'Faculty') iconName = focused ? 'people' : 'people-outline';
          
          // Make the active icon slightly larger for a premium feel
          return <Ionicons name={iconName} size={focused ? 28 : 24} color={color} />;
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontWeight: 'bold',
          fontSize: 11,
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

// --- THE MAIN STACK ---
export default function StudentNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerStyle: { backgroundColor: '#fff', elevation: 0, shadowOpacity: 0 }, 
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {/* 1. Load the Bottom Tabs First */}
      <Stack.Screen 
        name="MainTabs" 
        component={BottomTabNavigator} 
        options={{ headerShown: false }} 
      />
      
      {/* 2. Load the Pop-up Screens */}
      <Stack.Screen name="FeePayment" component={FeePayment} options={{ title: 'Fee Payment' }} />
      <Stack.Screen name="GalleryView" component={GalleryView} options={{ title: 'Campus Gallery' }} />
      <Stack.Screen name="PYQView" component={PYQView} options={{ title: 'Past Year Papers' }} />
      <Stack.Screen name="AttendanceView" component={AttendanceView} options={{ title: 'Attendance Stats' }} />
      <Stack.Screen name="Grades" component={Grades} options={{ title: 'Academic Grades' }} />
      <Stack.Screen name="Routine" component={Routine} options={{ title: 'Class Routine' }} />
      
    </Stack.Navigator>
  );
}
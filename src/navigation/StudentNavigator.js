import React from 'react';
import { View } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions, sharedTabScreenOptions } from './animatedScreenOptions';
import EdgeDrawerButton from '../components/navigation/EdgeDrawerButton';
import EnterpriseTabBar from '../components/navigation/EnterpriseTabBar';
import { useRootLayout } from '../contexts/RootLayoutContext';

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
import CoursePlayerScreen from '../screens/student/CoursePlayerScreen';
import CommunicationHub from '../screens/shared/CommunicationHub';
import FleetTrackingScreen from '../screens/shared/FleetTrackingScreen';
import SyllabusTutor from '../screens/shared/SyllabusTutor';

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

// --- THE BOTTOM TAB NAVIGATOR (for quick access) ---
function BottomTabNavigator() {
  const { colors } = useRootLayout();

  return (
    <Tab.Navigator
      tabBar={(props) => <EnterpriseTabBar {...props} />}
      screenOptions={({ route }) => ({
        ...sharedTabScreenOptions,
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Notices') iconName = focused ? 'megaphone' : 'megaphone-outline';
          else if (route.name === 'Faculty') iconName = focused ? 'people' : 'people-outline';

          return <Ionicons name={iconName} size={focused ? size + 1 : size} color={color} />;
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
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
  const { colors } = useRootLayout();

  return (
    <Drawer.Navigator
      screenOptions={({ navigation }) => ({
        ...sharedStackScreenOptions,
        drawerActiveBackgroundColor: colors.accentSoft,
        drawerActiveTintColor: colors.text,
        drawerInactiveTintColor: colors.muted,
        drawerLabelStyle: { fontWeight: '800' },
        drawerStyle: { backgroundColor: colors.page, width: 280 },
        drawerType: 'front',
        headerLeft: () => (
          <View style={{ marginLeft: 14 }}>
            <EdgeDrawerButton onPress={() => navigation.openDrawer()} size={42} />
          </View>
        ),
        headerStyle: {
          backgroundColor: colors.header,
          borderBottomColor: colors.hairline,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '900' },
        overlayColor: colors.overlay,
        sceneContainerStyle: { backgroundColor: colors.page },
      })}
    >
      {/* Home screen is the bottom tab navigator */}
      <Drawer.Screen name="Home" component={BottomTabNavigator} options={{
        drawerLabel: 'Home',
        headerShown: false,
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

      <Drawer.Screen name="Courses" component={CoursePlayerScreen} options={{
        drawerLabel: 'Courses',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'play-circle' : 'play-circle-outline'} size={24} color={color} />
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

      <Drawer.Screen name="CommunicationHub" component={CommunicationHub} options={{
        drawerLabel: 'Messages',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="Live Fleet" component={FleetTrackingScreen} options={{
        drawerLabel: 'Live Fleet',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'bus' : 'bus-outline'} size={24} color={color} />
        )
      }} />

      <Drawer.Screen name="SyllabusTutor" component={SyllabusTutor} options={{
        drawerLabel: 'Syllabus Tutor',
        drawerIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={color} />
        )
      }} />
    </Drawer.Navigator>
  );
}

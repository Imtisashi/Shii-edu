import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions, sharedTabScreenOptions } from './animatedScreenOptions';
import EnterpriseTabBar from '../components/navigation/EnterpriseTabBar';
import RoleDrawerContent from '../components/navigation/RoleDrawerContent';
import { useRootLayout } from '../contexts/RootLayoutContext';

// Import Admin Screens
import AdminHome from '../screens/admin/AdminHome';
import ManageUsers from '../screens/admin/ManageUsers';
import FeeTracking from '../screens/admin/FeeTracking';
import ManageNotices from '../screens/admin/ManageNotices';
import ManageTeachers from '../screens/admin/ManageTeachers';
import ManageRoutines from '../screens/admin/ManageRoutines';
import ManageHolidays from '../screens/admin/ManageHolidays';
import UploadGallery from '../screens/admin/UploadGallery';
import UploadPYQ from '../screens/admin/UploadPYQ';
import AddUser from '../screens/admin/AddUser';
import BrandingSettings from '../screens/admin/BrandingSettings';
import CourseManager from '../screens/teacher/CourseManager';
import ReportsCenter from '../screens/shared/ReportsCenter';
import CommunicationHub from '../screens/shared/CommunicationHub';
import FleetTrackingScreen from '../screens/shared/FleetTrackingScreen';
import SyllabusTutor from '../screens/shared/SyllabusTutor';
import AICommandCenter from '../screens/admin/AICommandCenter';
import AccountProfileScreen from '../screens/shared/AccountProfileScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// --- THE ADMIN BOTTOM BAR ---
function AdminBottomTabs() {
  const { colors } = useRootLayout();

  return (
    <Tab.Navigator
      tabBar={(props) => <EnterpriseTabBar {...props} />}
      screenOptions={({ route }) => ({
        ...sharedTabScreenOptions,
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Users') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Ledger') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'Broadcasts') iconName = focused ? 'megaphone' : 'megaphone-outline';
          
          return <Ionicons name={iconName} size={focused ? size + 1 : size} color={color} />;
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
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
function AdminStackNavigator() {
  const { colors } = useRootLayout();

  return (
    <Stack.Navigator 
      screenOptions={{ 
        ...sharedStackScreenOptions,
        cardStyle: { backgroundColor: colors.page },
        headerStyle: {
          backgroundColor: colors.header,
          borderBottomColor: colors.hairline,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '900' },
      }}
    >
      {/* 1. Load the Bottom Tabs First */}
      <Stack.Screen name="MainTabs" component={AdminBottomTabs} options={{ headerShown: false }} />
      
      {/* 2. Hidden Pop-up Screens */}
      <Stack.Screen name="ManageTeachers" component={ManageTeachers} options={{ title: 'Faculty Roster' }} />
      <Stack.Screen name="ManageRoutines" component={ManageRoutines} options={{ title: 'Master Schedule' }} />
      <Stack.Screen name="ManageHolidays" component={ManageHolidays} options={{ title: 'Campus Calendar' }} />
      <Stack.Screen name="UploadGallery" component={UploadGallery} options={{ title: 'Event Gallery' }} />
      <Stack.Screen name="UploadPYQ" component={UploadPYQ} options={{ title: 'PYQ PDF Uploads' }} />
      <Stack.Screen name="AddUser" component={AddUser} options={{ title: 'Add Users' }} />
      <Stack.Screen name="BrandingSettings" component={BrandingSettings} options={{ title: 'Brand Studio' }} />
      <Stack.Screen name="Courses" component={CourseManager} options={{ title: 'Course Uploader' }} />
      <Stack.Screen name="ReportsCenter" component={ReportsCenter} options={{ title: 'Reports Center' }} />
      <Stack.Screen name="CommunicationHub" component={CommunicationHub} options={{ title: 'Communication Hub' }} />
      <Stack.Screen name="FleetTracking" component={FleetTrackingScreen} options={{ title: 'Live Fleet' }} />
      <Stack.Screen name="SyllabusTutor" component={SyllabusTutor} options={{ title: 'Syllabus Tutor' }} />
      <Stack.Screen name="AICommandCenter" component={AICommandCenter} options={{ title: 'AI Command Center' }} />
    </Stack.Navigator>
  );
}

export default function AdminNavigator() {
  const { colors } = useRootLayout();

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <RoleDrawerContent
          {...props}
          dashboardRoute="AdminDashboard"
          profileRoute="AdminProfile"
          settingsRoute="AdminSettings"
        />
      )}
      screenOptions={{
        ...sharedStackScreenOptions,
        drawerActiveBackgroundColor: colors.accentSoft,
        drawerActiveTintColor: colors.text,
        drawerInactiveTintColor: colors.muted,
        drawerLabelStyle: { fontWeight: '900' },
        drawerStyle: { backgroundColor: colors.page, width: 292 },
        drawerType: 'front',
        headerShown: false,
        overlayColor: colors.overlay,
        sceneContainerStyle: { backgroundColor: colors.page },
      }}
    >
      <Drawer.Screen name="AdminDashboard" component={AdminStackNavigator} />
      <Drawer.Screen name="AdminProfile" component={AccountProfileScreen} />
      <Drawer.Screen name="AdminSettings" component={AccountSettingsScreen} />
    </Drawer.Navigator>
  );
}

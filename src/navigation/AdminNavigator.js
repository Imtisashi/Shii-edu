import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { sharedStackScreenOptions, sharedTabScreenOptions } from './animatedScreenOptions';
import EnterpriseTabBar from '../components/navigation/EnterpriseTabBar';
import RoleDrawerContent from '../components/navigation/RoleDrawerContent';
import { useInstitution } from '../contexts/InstitutionContext';
import { useRootLayout } from '../contexts/RootLayoutContext';
import { isFeatureEnabled } from '../constants/featureEntitlements';

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
import PasswordResetRequests from '../screens/admin/PasswordResetRequests';
import CourseManager from '../screens/teacher/CourseManager';
import ReportsCenter from '../screens/shared/ReportsCenter';
import CommunicationHub from '../screens/shared/CommunicationHub';
import FleetTrackingScreen from '../screens/shared/FleetTrackingScreen';
import SyllabusTutor from '../screens/shared/SyllabusTutor';
import AICommandCenter from '../screens/admin/AICommandCenter';
import AdminAgentScreen from '../screens/admin/AdminAgentScreen';
import ParentSupportDesk from '../screens/admin/ParentSupportDesk';
import TeacherPayrollMonitor from '../screens/admin/TeacherPayrollMonitor';
import TransportControlCenter from '../screens/admin/TransportControlCenter';
import AccountProfileScreen from '../screens/shared/AccountProfileScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const adminDrawerLinks = [
  { featureKey: 'people', icon: 'people-outline', label: 'Users', routeName: 'AdminDashboard', params: { screen: 'MainTabs', params: { screen: 'Users' } } },
  { featureKey: 'finance', icon: 'wallet-outline', label: 'Student fees', routeName: 'AdminDashboard', params: { screen: 'MainTabs', params: { screen: 'Ledger' } } },
  { featureKey: 'finance', icon: 'cash-outline', label: 'Teacher payroll', routeName: 'AdminDashboard', params: { screen: 'TeacherPayroll' } },
  { featureKey: 'notices', icon: 'megaphone-outline', label: 'Broadcasts', routeName: 'AdminDashboard', params: { screen: 'MainTabs', params: { screen: 'Broadcasts' } } },
  { featureKey: 'people', icon: 'briefcase-outline', label: 'Faculty', routeName: 'AdminDashboard', params: { screen: 'ManageTeachers' } },
  { featureKey: 'people', icon: 'key-outline', label: 'Password resets', routeName: 'AdminDashboard', params: { screen: 'PasswordResetRequests' } },
  { featureKey: 'routines', icon: 'calendar-outline', label: 'Master schedule', routeName: 'AdminDashboard', params: { screen: 'ManageRoutines' } },
  { featureKey: 'routines', icon: 'calendar-number-outline', label: 'Calendar', routeName: 'AdminDashboard', params: { screen: 'ManageHolidays' } },
  { featureKey: 'people', icon: 'person-add-outline', label: 'Add users', routeName: 'AdminDashboard', params: { screen: 'AddUser' } },
  { featureKey: 'branding', icon: 'color-palette-outline', label: 'Brand studio', routeName: 'AdminDashboard', params: { screen: 'BrandingSettings' } },
  { featureKey: 'courses', icon: 'play-circle-outline', label: 'Courses', routeName: 'AdminDashboard', params: { screen: 'Courses' } },
  { featureKey: 'media', icon: 'images-outline', label: 'Gallery', routeName: 'AdminDashboard', params: { screen: 'UploadGallery' } },
  { featureKey: 'pyq', icon: 'document-attach-outline', label: 'PYQ PDFs', routeName: 'AdminDashboard', params: { screen: 'UploadPYQ' } },
  { featureKey: 'reports', icon: 'print-outline', label: 'Reports', routeName: 'AdminDashboard', params: { screen: 'ReportsCenter' } },
  { featureKey: 'messages', icon: 'chatbubbles-outline', label: 'Messages', routeName: 'AdminDashboard', params: { screen: 'CommunicationHub' } },
  { featureKey: 'parent_support', icon: 'help-buoy-outline', label: 'Parent support', routeName: 'AdminDashboard', params: { screen: 'ParentSupportDesk' } },
  { featureKey: 'transport', icon: 'navigate-outline', label: 'Route control', routeName: 'AdminDashboard', params: { screen: 'TransportControl' } },
  { featureKey: 'transport', icon: 'bus-outline', label: 'Live fleet', routeName: 'AdminDashboard', params: { screen: 'FleetTracking' } },
  { featureKey: 'ai', icon: 'sparkles-outline', label: 'AI command', routeName: 'AdminDashboard', params: { screen: 'AICommandCenter' } },
  { featureKey: 'ai_agent', icon: 'analytics-outline', label: 'Max AI agent', routeName: 'AdminDashboard', params: { screen: 'AdminAgent' } },
];

// --- THE ADMIN BOTTOM BAR ---
function AdminBottomTabs() {
  const { colors } = useRootLayout();
  const { instituteData } = useInstitution();

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
      {isFeatureEnabled(instituteData, 'people') ? <Tab.Screen name="Users" component={ManageUsers} /> : null}
      {isFeatureEnabled(instituteData, 'finance') ? <Tab.Screen name="Ledger" component={FeeTracking} /> : null}
      {isFeatureEnabled(instituteData, 'notices') ? <Tab.Screen name="Broadcasts" component={ManageNotices} /> : null}
    </Tab.Navigator>
  );
}

// --- THE MASTER STACK ---
function AdminStackNavigator() {
  const { colors } = useRootLayout();
  const { instituteData } = useInstitution();

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
      {isFeatureEnabled(instituteData, 'people') ? <Stack.Screen name="ManageTeachers" component={ManageTeachers} options={{ title: 'Faculty Roster' }} /> : null}
      {isFeatureEnabled(instituteData, 'people') ? <Stack.Screen name="PasswordResetRequests" component={PasswordResetRequests} options={{ title: 'Password Resets' }} /> : null}
      {isFeatureEnabled(instituteData, 'routines') ? <Stack.Screen name="ManageRoutines" component={ManageRoutines} options={{ title: 'Master Schedule' }} /> : null}
      {isFeatureEnabled(instituteData, 'routines') ? <Stack.Screen name="ManageHolidays" component={ManageHolidays} options={{ title: 'Campus Calendar' }} /> : null}
      {isFeatureEnabled(instituteData, 'media') ? <Stack.Screen name="UploadGallery" component={UploadGallery} options={{ title: 'Event Gallery' }} /> : null}
      {isFeatureEnabled(instituteData, 'pyq') ? <Stack.Screen name="UploadPYQ" component={UploadPYQ} options={{ title: 'PYQ PDF Uploads' }} /> : null}
      {isFeatureEnabled(instituteData, 'people') ? <Stack.Screen name="AddUser" component={AddUser} options={{ title: 'Add Users' }} /> : null}
      {isFeatureEnabled(instituteData, 'branding') ? <Stack.Screen name="BrandingSettings" component={BrandingSettings} options={{ title: 'Brand Studio' }} /> : null}
      {isFeatureEnabled(instituteData, 'courses') ? <Stack.Screen name="Courses" component={CourseManager} options={{ title: 'Course Uploader' }} /> : null}
      {isFeatureEnabled(instituteData, 'reports') ? <Stack.Screen name="ReportsCenter" component={ReportsCenter} options={{ title: 'Reports Center' }} /> : null}
      {isFeatureEnabled(instituteData, 'messages') ? <Stack.Screen name="CommunicationHub" component={CommunicationHub} options={{ title: 'Communication Hub' }} /> : null}
      {isFeatureEnabled(instituteData, 'finance') ? <Stack.Screen name="TeacherPayroll" component={TeacherPayrollMonitor} options={{ title: 'Teacher Payroll' }} /> : null}
      {isFeatureEnabled(instituteData, 'transport') ? <Stack.Screen name="TransportControl" component={TransportControlCenter} options={{ title: 'Transport Control' }} /> : null}
      {isFeatureEnabled(instituteData, 'transport') ? <Stack.Screen name="FleetTracking" component={FleetTrackingScreen} options={{ title: 'Live Fleet' }} /> : null}
      {isFeatureEnabled(instituteData, 'ai') ? <Stack.Screen name="SyllabusTutor" component={SyllabusTutor} options={{ title: 'Syllabus Tutor' }} /> : null}
      {isFeatureEnabled(instituteData, 'ai') ? <Stack.Screen name="AICommandCenter" component={AICommandCenter} options={{ title: 'AI Command Center' }} /> : null}
      {isFeatureEnabled(instituteData, 'parent_support') ? <Stack.Screen name="ParentSupportDesk" component={ParentSupportDesk} options={{ title: 'Parent Support' }} /> : null}
      {isFeatureEnabled(instituteData, 'ai_agent') ? <Stack.Screen name="AdminAgent" component={AdminAgentScreen} options={{ title: 'Max AI Agent' }} /> : null}
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
          dashboardParams={{ screen: 'MainTabs', params: { screen: 'Dashboard' } }}
          dashboardRoute="AdminDashboard"
          profileRoute="AdminProfile"
          settingsRoute="AdminSettings"
          workspaceLinks={adminDrawerLinks}
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

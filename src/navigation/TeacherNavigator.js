import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import RoleDrawerContent from '../components/navigation/RoleDrawerContent';
import { useInstitution } from '../contexts/InstitutionContext';
import { useRootLayout } from '../contexts/RootLayoutContext';
import { isFeatureEnabled } from '../constants/featureEntitlements';

// ==========================================
// 1. IMPORT ALL 10 TEACHER SCREENS
// ==========================================
import TeacherHome from '../screens/teacher/TeacherHome';
import TeacherAttendance from '../screens/teacher/TeacherAttendance'; 
import TakeAttendance from '../screens/teacher/TakeAttendance'; 
import TeacherNotifs from '../screens/teacher/TeacherNotifs';
import Students from '../screens/teacher/StudentList'; 
import TeacherRoutine from '../screens/teacher/TeacherRoutine';
import TeacherAssignments from '../screens/teacher/TeacherAssignments';
import UploadAssignment from '../screens/teacher/UploadAssignment';
import UploadGrades from '../screens/teacher/UploadGrades';
import TeacherProfileSettings from '../screens/teacher/TeacherProfileSettings';
import CourseManager from '../screens/teacher/CourseManager';
import UploadPYQ from '../screens/admin/UploadPYQ';
import ReportsCenter from '../screens/shared/ReportsCenter';
import CommunicationHub from '../screens/shared/CommunicationHub';
import SyllabusTutor from '../screens/shared/SyllabusTutor';
import AccountProfileScreen from '../screens/shared/AccountProfileScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';

// Import GalleryView from student folder (since the Teacher Grid uses it)
import GalleryView from '../screens/student/GalleryView';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const teacherDrawerLinks = [
  { featureKey: 'attendance', icon: 'checkmark-done-circle-outline', label: 'Attendance', routeName: 'TeacherDashboard', params: { screen: 'Attendance' } },
  { featureKey: 'attendance', icon: 'create-outline', label: 'Take attendance', routeName: 'TeacherDashboard', params: { screen: 'TakeAttendance' } },
  { featureKey: 'people', icon: 'people-outline', label: 'Student directory', routeName: 'TeacherDashboard', params: { screen: 'Students' } },
  { featureKey: 'routines', icon: 'calendar-outline', label: 'Routine', routeName: 'TeacherDashboard', params: { screen: 'Routine' } },
  { featureKey: 'assignments', icon: 'document-text-outline', label: 'Assignments', routeName: 'TeacherDashboard', params: { screen: 'Assignments' } },
  { featureKey: 'assignments', icon: 'cloud-upload-outline', label: 'Upload assignment', routeName: 'TeacherDashboard', params: { screen: 'UploadAssignment' } },
  { featureKey: 'grades', icon: 'stats-chart-outline', label: 'Upload grades', routeName: 'TeacherDashboard', params: { screen: 'UploadGrades' } },
  { featureKey: 'notices', icon: 'megaphone-outline', label: 'Broadcasts', routeName: 'TeacherDashboard', params: { screen: 'TeacherNotifs' } },
  { featureKey: 'courses', icon: 'play-circle-outline', label: 'Courses', routeName: 'TeacherDashboard', params: { screen: 'Courses' } },
  { featureKey: 'pyq', icon: 'document-attach-outline', label: 'PYQ PDFs', routeName: 'TeacherDashboard', params: { screen: 'UploadPYQ' } },
  { featureKey: 'media', icon: 'images-outline', label: 'Gallery', routeName: 'TeacherDashboard', params: { screen: 'GalleryView' } },
  { featureKey: 'reports', icon: 'print-outline', label: 'Reports', routeName: 'TeacherDashboard', params: { screen: 'ReportsCenter' } },
  { featureKey: 'messages', icon: 'chatbubbles-outline', label: 'Messages', routeName: 'TeacherDashboard', params: { screen: 'CommunicationHub' } },
  { featureKey: 'ai', icon: 'library-outline', label: 'Syllabus AI', routeName: 'TeacherDashboard', params: { screen: 'SyllabusTutor' } },
];

function TeacherStackNavigator() {
  const { colors } = useRootLayout();
  const { instituteData } = useInstitution();

  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedStackScreenOptions,
        cardStyle: { backgroundColor: colors.page },
        headerShown: false,
      }}
    >
      
      {/* THE MAIN DASHBOARD */}
      <Stack.Screen name="TeacherHome" component={TeacherHome} />
      
      {/* GRID BUTTON SCREENS */}
      {isFeatureEnabled(instituteData, 'attendance') ? <Stack.Screen name="Attendance" component={TeacherAttendance} /> : null}
      {isFeatureEnabled(instituteData, 'notices') ? <Stack.Screen name="TeacherNotifs" component={TeacherNotifs} /> : null}
      {isFeatureEnabled(instituteData, 'people') ? <Stack.Screen name="Students" component={Students} /> : null}
      {isFeatureEnabled(instituteData, 'routines') ? <Stack.Screen name="Routine" component={TeacherRoutine} /> : null}
      {isFeatureEnabled(instituteData, 'assignments') ? <Stack.Screen name="Assignments" component={TeacherAssignments} /> : null}
      {isFeatureEnabled(instituteData, 'courses') ? <Stack.Screen name="Courses" component={CourseManager} /> : null}
      {isFeatureEnabled(instituteData, 'pyq') ? <Stack.Screen name="UploadPYQ" component={UploadPYQ} /> : null}
      {isFeatureEnabled(instituteData, 'media') ? <Stack.Screen name="GalleryView" component={GalleryView} /> : null}

      {/* EXTRA TEACHER SCREENS (For deeper navigation later) */}
      {isFeatureEnabled(instituteData, 'attendance') ? <Stack.Screen name="TakeAttendance" component={TakeAttendance} /> : null}
      {isFeatureEnabled(instituteData, 'assignments') ? <Stack.Screen name="UploadAssignment" component={UploadAssignment} /> : null}
      {isFeatureEnabled(instituteData, 'grades') ? <Stack.Screen name="UploadGrades" component={UploadGrades} /> : null}
      <Stack.Screen name="TeacherProfile" component={TeacherProfileSettings} />
      {isFeatureEnabled(instituteData, 'reports') ? <Stack.Screen name="ReportsCenter" component={ReportsCenter} /> : null}
      {isFeatureEnabled(instituteData, 'messages') ? <Stack.Screen name="CommunicationHub" component={CommunicationHub} /> : null}
      {isFeatureEnabled(instituteData, 'ai') ? <Stack.Screen name="SyllabusTutor" component={SyllabusTutor} /> : null}

    </Stack.Navigator>
  );
}

export default function TeacherNavigator() {
  const { colors } = useRootLayout();

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <RoleDrawerContent
          {...props}
          dashboardParams={{ screen: 'TeacherHome' }}
          dashboardRoute="TeacherDashboard"
          profileRoute="TeacherProfileScreen"
          settingsRoute="TeacherSettings"
          workspaceLinks={teacherDrawerLinks}
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
      <Drawer.Screen name="TeacherDashboard" component={TeacherStackNavigator} />
      <Drawer.Screen name="TeacherProfileScreen" component={AccountProfileScreen} />
      <Drawer.Screen name="TeacherSettings" component={AccountSettingsScreen} />
    </Drawer.Navigator>
  );
}

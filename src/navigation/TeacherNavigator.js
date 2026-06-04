import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { sharedStackScreenOptions } from './animatedScreenOptions';
import RoleDrawerContent from '../components/navigation/RoleDrawerContent';
import { useRootLayout } from '../contexts/RootLayoutContext';

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

function TeacherStackNavigator() {
  const { colors } = useRootLayout();

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
      <Stack.Screen name="Attendance" component={TeacherAttendance} />
      <Stack.Screen name="TeacherNotifs" component={TeacherNotifs} />
      <Stack.Screen name="Students" component={Students} />
      <Stack.Screen name="Routine" component={TeacherRoutine} />
      <Stack.Screen name="Assignments" component={TeacherAssignments} />
      <Stack.Screen name="Courses" component={CourseManager} />
      <Stack.Screen name="UploadPYQ" component={UploadPYQ} />
      <Stack.Screen name="GalleryView" component={GalleryView} />

      {/* EXTRA TEACHER SCREENS (For deeper navigation later) */}
      <Stack.Screen name="TakeAttendance" component={TakeAttendance} />
      <Stack.Screen name="UploadAssignment" component={UploadAssignment} />
      <Stack.Screen name="UploadGrades" component={UploadGrades} />
      <Stack.Screen name="TeacherProfile" component={TeacherProfileSettings} />
      <Stack.Screen name="ReportsCenter" component={ReportsCenter} />
      <Stack.Screen name="CommunicationHub" component={CommunicationHub} />
      <Stack.Screen name="SyllabusTutor" component={SyllabusTutor} />

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
          dashboardRoute="TeacherDashboard"
          profileRoute="TeacherProfileScreen"
          settingsRoute="TeacherSettings"
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

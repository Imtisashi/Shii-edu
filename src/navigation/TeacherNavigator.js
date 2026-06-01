import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { sharedStackScreenOptions } from './animatedScreenOptions';

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

// Import GalleryView from student folder (since the Teacher Grid uses it)
import GalleryView from '../screens/student/GalleryView';

const Stack = createStackNavigator();

export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ ...sharedStackScreenOptions, headerShown: false }}>
      
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

    </Stack.Navigator>
  );
}

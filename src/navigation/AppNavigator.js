import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// Import all navigators
import AuthNavigator from './AuthNavigator';
import StudentNavigator from './StudentNavigator';
import TeacherNavigator from './TeacherNavigator';
import AdminNavigator from './AdminNavigator';
import SuperAdminNavigator from './SuperAdminNavigator';

export default function AppNavigator() {
  const { currentUser, userData, loading } = useAuth();

  // 1. Show loading while checking auth state or during the registration gap
  if (loading || (currentUser && !userData)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  // 2. Not logged in? Go to Login/Register
  if (!currentUser) {
    return <AuthNavigator />;
  }

  // 3. Multi-Tenant Role Logic - Using case-insensitive, whitespace-tolerant comparison
  const userRole = userData?.role?.trim().toLowerCase() || '';

  if (userRole === 'superadmin') {
    return <SuperAdminNavigator />;
  }

  if (userRole === 'admin') {
    return <AdminNavigator />;
  }

  if (userRole === 'teacher') {
    return <TeacherNavigator />;
  }

  // 4. Default to Student for everyone else
  return <StudentNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
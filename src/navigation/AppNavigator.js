import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import InstituteSyncSplash from '../components/auth/InstituteSyncSplash';

// Import all institute navigators
import InstituteAuthNavigator from './InstituteAuthNavigator';
import StudentNavigator from './StudentNavigator';
import TeacherNavigator from './TeacherNavigator';
import AdminNavigator from './AdminNavigator';
import ParentNavigator from './ParentNavigator';
import DriverNavigator from './DriverNavigator';

export default function AppNavigator() {
  const { currentUser, userData, loading, logout, profileError } = useAuth();

  // 1. Show loading while checking auth state or during the registration gap
  if (loading) {
    return <InstituteSyncSplash />;
  }

  // 2. Not logged in? Use the institute-scoped login.
  if (!currentUser) {
    return <InstituteAuthNavigator />;
  }

  if (!userData) {
    return (
      <View style={styles.profileIssueContainer}>
        <View style={styles.profileIssueCard}>
          <View style={styles.profileIssueIcon}>
            <Ionicons name="shield-outline" size={30} color="#635BFF" />
          </View>
          <Text style={styles.profileIssueTitle}>Account Profile Required</Text>
          <Text style={styles.profileIssueText}>
            {profileError || 'Your account is authenticated, but the platform profile could not be loaded.'}
          </Text>
          <Text style={styles.profileIssueHint}>
            Ask the platform owner to create or repair your Firestore user profile, then sign in again.
          </Text>
          <TouchableOpacity style={styles.profileIssueButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.profileIssueButtonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. Institute role logic - using case-insensitive, whitespace-tolerant comparison.
  const userRole = userData?.role?.trim().toLowerCase().replace(/[\s_-]+/g, '') || '';

  if (userRole === 'superadmin') {
    return (
      <View style={styles.profileIssueContainer}>
        <View style={styles.profileIssueCard}>
          <View style={styles.profileIssueIcon}>
            <Ionicons name="shield-outline" size={30} color="#635BFF" />
          </View>
          <Text style={styles.profileIssueTitle}>Institute App Only</Text>
          <Text style={styles.profileIssueText}>
            Superadmin accounts must use the separate Shii-Edu Superadmin application.
          </Text>
          <TouchableOpacity style={styles.profileIssueButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.profileIssueButtonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (userRole === 'admin') {
    return <AdminNavigator />;
  }

  if (userRole === 'teacher') {
    return <TeacherNavigator />;
  }

  if (userRole === 'student') {
    return <StudentNavigator />;
  }

  if (userRole === 'parent') {
    return <ParentNavigator />;
  }

  if (userRole === 'driver') {
    return <DriverNavigator />;
  }

  return (
    <View style={styles.profileIssueContainer}>
      <View style={styles.profileIssueCard}>
        <View style={styles.profileIssueIcon}>
          <Ionicons name="shield-outline" size={30} color="#635BFF" />
        </View>
        <Text style={styles.profileIssueTitle}>Unsupported Institute Role</Text>
        <Text style={styles.profileIssueText}>
          This account role is not enabled in the Shii-Edu application.
        </Text>
        <TouchableOpacity style={styles.profileIssueButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.profileIssueButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileIssueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  profileIssueCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D8E8',
  },
  profileIssueIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F7F6FF',
    borderWidth: 1,
    borderColor: '#D9D7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileIssueTitle: {
    color: '#010110',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileIssueText: {
    color: '#4B4B5F',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  profileIssueHint: {
    color: '#737383',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  profileIssueButton: {
    marginTop: 18,
    backgroundColor: '#010110',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIssueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
});

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/ui/LoadingState';
import { Ionicons } from '@expo/vector-icons';

// Import all navigators
import AuthNavigator from './AuthNavigator';
import StudentNavigator from './StudentNavigator';
import TeacherNavigator from './TeacherNavigator';
import AdminNavigator from './AdminNavigator';
import SuperAdminNavigator from './SuperAdminNavigator';

export default function AppNavigator() {
  const { currentUser, userData, loading, logout, profileError } = useAuth();

  // 1. Show loading while checking auth state or during the registration gap
  if (loading) {
    return <LoadingState label="Preparing Shii Edu..." color="#4A90E2" />;
  }

  // 2. Not logged in? Go to Login/Register
  if (!currentUser) {
    return <AuthNavigator />;
  }

  if (!userData) {
    return (
      <View style={styles.profileIssueContainer}>
        <View style={styles.profileIssueCard}>
          <View style={styles.profileIssueIcon}>
            <Ionicons name="shield-outline" size={30} color="#2563EB" />
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

  // 3. Multi-Tenant Role Logic - Using case-insensitive, whitespace-tolerant comparison
  const userRole = userData?.role?.trim().toLowerCase().replace(/[\s_-]+/g, '') || '';

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
  profileIssueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  profileIssueCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
  },
  profileIssueIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileIssueTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileIssueText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  profileIssueHint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  profileIssueButton: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    borderRadius: 14,
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

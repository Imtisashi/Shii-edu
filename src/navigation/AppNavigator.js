import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import InstituteSyncSplash from '../components/auth/InstituteSyncSplash';
import { getAuthRoleOption } from '../constants/authRoles';

// Import all institute navigators
import InstituteAuthNavigator from './InstituteAuthNavigator';
import StudentNavigator from './StudentNavigator';
import TeacherNavigator from './TeacherNavigator';
import AdminNavigator from './AdminNavigator';
import ParentNavigator from './ParentNavigator';
import DriverNavigator from './DriverNavigator';

const roleCanOpenLockedApp = (lockedRole, userRole) => {
  if (!lockedRole) return true;
  if (lockedRole === 'parent') return userRole === 'parent';
  if (lockedRole === 'driver') return userRole === 'driver';
  return !['driver', 'parent', 'superadmin'].includes(userRole);
};

export function ProfileIssueState({
  buttonLabel = 'Sign out',
  hint,
  message,
  onPress,
  title,
}) {
  return (
    <View style={styles.profileIssueContainer}>
      <View style={styles.profileIssueCard}>
        <View style={styles.profileIssueIcon}>
          <Ionicons name="shield-outline" size={30} color="#635BFF" />
        </View>
        <Text style={styles.profileIssueTitle}>{title}</Text>
        <Text style={styles.profileIssueText}>{message}</Text>
        {hint ? <Text style={styles.profileIssueHint}>{hint}</Text> : null}
        <TouchableOpacity style={styles.profileIssueButton} onPress={onPress}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.profileIssueButtonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AppNavigator({ lockedRole = null }) {
  const { currentUser, userData, loading, logout, profileError } = useAuth();
  const lockedRoleOption = lockedRole ? getAuthRoleOption(lockedRole) : null;

  // 1. Show loading while checking auth state or during the registration gap
  if (loading) {
    return <InstituteSyncSplash />;
  }

  // 2. Not logged in? Use the institute-scoped login.
  if (!currentUser) {
    return <InstituteAuthNavigator lockedRole={lockedRole} />;
  }

  if (!userData) {
    return (
      <ProfileIssueState
        hint="Ask the platform owner to create or repair your Firestore user profile, then sign in again."
        message={profileError || 'Your account is authenticated, but the platform profile could not be loaded.'}
        onPress={logout}
        title="Account Profile Required"
      />
    );
  }

  // 3. Institute role logic - using case-insensitive, whitespace-tolerant comparison.
  const userRole = userData?.role?.trim().toLowerCase().replace(/[\s_-]+/g, '') || '';

  if (!roleCanOpenLockedApp(lockedRole, userRole)) {
    return (
      <ProfileIssueState
        message={`This app is for ${lockedRoleOption.label} accounts. Sign out, then open the Shii-Edu app for your account.`}
        onPress={logout}
        title={`${lockedRoleOption.shortName} App`}
      />
    );
  }

  if (userRole === 'superadmin') {
    return (
      <ProfileIssueState
        message="Superadmin accounts must use the separate Shii-Edu Superadmin application."
        onPress={logout}
        title="Institute App Only"
      />
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
    <ProfileIssueState
      message="This account role is not enabled in the Shii-Edu application."
      onPress={logout}
      title="Unsupported Institute Role"
    />
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
    borderRadius: 8,
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

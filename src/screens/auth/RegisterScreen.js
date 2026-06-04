import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import BrandLogo from '../../components/BrandLogo';
import EnterpriseAuthBackground from '../../components/auth/EnterpriseAuthBackground';

export default function RegisterScreen({ navigation, route }) {
  const layout = useResponsiveLayout();
  const { instituteId, role, uniqueId, email: inviteEmail } = route.params || {};
  const navigateToLogin = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Login');
  }, [navigation]);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState(inviteEmail || ''); // Pre-fill if invited

  const [loading, setLoading] = useState(false);
  const [instituteData, setInstituteData] = useState(null);
  const [invitationError, setInvitationError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Validate invitation parameters
  useEffect(() => {
    if (instituteId && role) {
      const validateInstitute = async () => {
        try {
          const instRef = doc(db, "institutes", instituteId);
          const instSnap = await getDoc(instRef);
          if (instSnap.exists()) {
            setInstituteData(instSnap.data());
          } else {
            setInvitationError('Invalid institute invitation. Please contact your administrator.');
          }
        } catch (e) {
          console.error(e);
          setInvitationError('Failed to validate invitation. Please try the invite link again.');
        }
      };

      validateInstitute();
    } else {
      setInvitationError('Invalid invitation link. Please contact your administrator for a fresh invite.');
    }
  }, [instituteId, role, navigateToLogin]);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      return Alert.alert("Error", "Please fill in all fields.");
    }

    if (password !== confirmPassword) {
      return Alert.alert("Error", "Passwords do not match.");
    }

    if (password.length < 6) {
      return Alert.alert("Error", "Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      const profileData = {
        uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role,
        instituteId: instituteId,
        createdAt: new Date().toISOString()
      };

      // Add uniqueId if provided (for teacher and student)
      if (uniqueId && role !== 'instituteAdmin') {
        profileData.uniqueId = uniqueId;
      }

      // For institute admin, we don't set uniqueId (they manage via email)
      if (role === 'instituteAdmin') {
        profileData.uniqueId = null;
      }

      await setDoc(doc(db, "users", uid), profileData);
      setLoading(false);

      // Show success modal and navigate to login after dismissal
      setShowSuccessModal(true);
    } catch (error) {
      setLoading(false);
      console.error("Registration error:", error);
      Alert.alert("Error", error.message);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigation.navigate('Login');
  };

  return (
    <EnterpriseAuthBackground>
      <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.container,
            layout.isMobile && styles.containerMobile,
            layout.isCompact && styles.containerCompact,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, layout.isMobile && styles.cardMobile, layout.isCompact && styles.cardCompact]}>
            <View style={styles.brandHeader}>
              <View style={styles.logoCage}>
                <BrandLogo size={48} />
              </View>
              <Text style={styles.eyebrow}>Secure Campus Invitation</Text>
              <Text style={styles.title}>{invitationError ? 'Invite Required' : 'Create Your Account'}</Text>
              <Text style={styles.subtitle}>
                {invitationError
                  ? 'This registration route only works with a valid invitation.'
                  : 'Your access will be linked to the inviting institute.'}
              </Text>
            </View>

            {invitationError ? (
              <View style={styles.invalidInviteCard}>
                <View style={styles.invalidInviteIcon}>
                  <Ionicons name="alert-circle-outline" size={30} color="#FCA5A5" />
                </View>
                <Text style={styles.invalidInviteText}>{invitationError}</Text>
                <TouchableOpacity style={styles.btn} onPress={navigateToLogin}>
                  <Text style={styles.btnText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {instituteData && (
                  <View style={styles.instituteHeader}>
                    <View style={styles.instituteIcon}>
                      <Ionicons name="school-outline" size={20} color="#67E8F9" />
                    </View>
                    <View style={styles.instituteCopy}>
                      <Text style={styles.instituteName} numberOfLines={1}>{instituteData.name}</Text>
                      <Text style={styles.instituteRole}>
                        Registering as {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#CBD5E1" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your full name"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#CBD5E1" style={styles.icon} />
                  <TextInput
                    style={[styles.input, inviteEmail && styles.inputReadOnly]}
                    placeholder="your@email.com"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={inviteEmail ? undefined : setEmail}
                    editable={!inviteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#CBD5E1" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#CBD5E1" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Repeat your password"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    returnKeyType="go"
                    onSubmitEditing={handleRegister}
                  />
                </View>

                {instituteData && (
                  <View style={styles.accessGrid}>
                    <View style={styles.readOnlySection}>
                      <Text style={styles.readOnlyLabel}>Role</Text>
                      <Text style={styles.readOnlyValue}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </View>

                    {uniqueId && role !== 'instituteAdmin' ? (
                      <View style={styles.readOnlySection}>
                        <Text style={styles.readOnlyLabel}>Campus ID</Text>
                        <Text style={styles.readOnlyValue}>{uniqueId}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btn, (!instituteData || loading) && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={!instituteData || loading}
                >
                  {loading ? <SmoothSpinner color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={navigateToLogin} disabled={loading}>
                  <Ionicons name="arrow-back-outline" size={16} color="#C4B5FD" />
                  <Text style={styles.backLink}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        <Modal
          animationType="fade"
          transparent
          visible={showSuccessModal}
          onRequestClose={handleSuccessModalClose}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle-outline" size={30} color="#A7F3D0" />
                </View>
                <Text style={styles.modalTitle}>Account Created</Text>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalMessage}>
                  Your account is ready. You can now sign in with your campus credentials.
                </Text>
                <TouchableOpacity style={styles.modalBtn} onPress={handleSuccessModalClose}>
                  <Text style={styles.modalBtnText}>Go to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </EnterpriseAuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  containerMobile: { padding: 18 },
  containerCompact: { padding: 14 },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 28,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardMobile: { padding: 20, borderRadius: 8 },
  cardCompact: { padding: 16, borderRadius: 8 },
  brandHeader: { alignItems: 'center', marginBottom: 24 },
  logoCage: {
    backgroundColor: '#111827',
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eyebrow: { color: '#C4B5FD', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', color: '#F8FAFC', marginTop: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#CBD5E1', marginTop: 7, lineHeight: 21, textAlign: 'center' },
  invalidInviteCard: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    alignItems: 'center',
  },
  invalidInviteIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#450A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invalidInviteText: { fontSize: 15, color: '#FECACA', textAlign: 'center', marginTop: 14, lineHeight: 22 },
  instituteHeader: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#082F49',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#075985',
    flexDirection: 'row',
    alignItems: 'center',
  },
  instituteIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#082F49',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instituteCopy: { flex: 1, minWidth: 0 },
  instituteName: { fontSize: 17, fontWeight: '900', color: '#F8FAFC' },
  instituteRole: { fontSize: 13, color: '#93C5FD', marginTop: 3, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '900', color: '#E2E8F0', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.7 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    marginBottom: 16,
  },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, minWidth: 0, paddingVertical: 15, fontSize: 16, color: '#F8FAFC', outlineStyle: 'none' },
  inputReadOnly: { color: '#A5B4FC' },
  accessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  readOnlySection: {
    flexGrow: 1,
    minWidth: 140,
    padding: 12,
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6D28D9',
  },
  readOnlyLabel: { fontSize: 11, color: '#A5B4FC', marginBottom: 4, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  readOnlyValue: { fontSize: 15, fontWeight: '800', color: '#F8FAFC' },
  btn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.52 },
  btnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 4 },
  backLink: { color: '#C4B5FD', fontWeight: '800', marginLeft: 6 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', padding: 20 },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#052E2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 21, fontWeight: '900', color: '#F8FAFC' },
  modalMessage: { fontSize: 15, color: '#CBD5E1', textAlign: 'center', marginVertical: 18, lineHeight: 22 },
  modalBtn: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  modalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});

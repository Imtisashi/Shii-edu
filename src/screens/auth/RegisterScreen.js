import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Modal, Linking } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import BrandLogo from '../../components/BrandLogo';
import EnterpriseAuthBackground from '../../components/auth/EnterpriseAuthBackground';
import { getAuthRoleOption, normalizeAuthRole } from '../../constants/authRoles';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';

const ONBOARDING_MAILTO = 'mailto:sashimiofficials@gmail.com?subject=Shii-Edu%20registration%20support';

export default function RegisterScreen({ navigation, route }) {
  const layout = useResponsiveLayout();
  const { instituteId, role, uniqueId, email: inviteEmail } = route.params || {};
  const authRole = normalizeAuthRole(role);
  const authRoleOption = getAuthRoleOption(authRole);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const previousTitle = document.title;
    let manifestLink = document.querySelector('link[rel="manifest"]');
    const previousManifest = manifestLink?.getAttribute('href') || null;
    const createdManifest = !manifestLink;

    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      document.head.appendChild(manifestLink);
    }

    const pageTitle = `Shii-Edu ${authRoleOption.shortName} Registration`;
    const applyMetadata = () => {
      manifestLink?.setAttribute('href', authRoleOption.manifestHref);
      document.title = pageTitle;
    };
    let syncCount = 0;
    applyMetadata();
    const metadataSync = window.setInterval(() => {
      applyMetadata();
      syncCount += 1;
      if (syncCount >= 8) window.clearInterval(metadataSync);
    }, 250);

    return () => {
      window.clearInterval(metadataSync);
      document.title = previousTitle;
      if (createdManifest) {
        manifestLink?.remove();
      } else if (previousManifest) {
        manifestLink?.setAttribute('href', previousManifest);
      }
    };
  }, [authRoleOption.manifestHref, authRoleOption.shortName]);

  const navigateToLogin = React.useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(authRoleOption.authPath);
      return;
    }

    navigation.navigate(authRoleOption.routeName, { initialRole: authRoleOption.id });
  }, [authRoleOption.authPath, authRoleOption.id, authRoleOption.routeName, navigation]);
  const contactRegistration = React.useCallback(() => {
    Linking.openURL(ONBOARDING_MAILTO).catch((error) => {
      showNativeError(
        'Could Not Open Email',
        error,
        'Email sashimiofficials@gmail.com for registration support.'
      );
    });
  }, []);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState(inviteEmail || ''); // Pre-fill if invited

  const [loading, setLoading] = useState(false);
  const [instituteData, setInstituteData] = useState(null);
  const [invitationError, setInvitationError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
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
    setSubmissionError('');

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setSubmissionError('Full name, email, password, and confirmation are required.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmissionError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setSubmissionError('Password must be at least 6 characters.');
      return;
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
      showNativeMessage('Account Created', 'Your account is ready. You can now sign in.');
      setShowSuccessModal(true);
    } catch (error) {
      setLoading(false);
      console.error("Registration error:", error);
      const message = error instanceof Error ? error.message : 'Account creation failed.';
      setSubmissionError(message);
      showNativeError('Account Creation Failed', error, message);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigateToLogin();
  };

  return (
    <EnterpriseAuthBackground backgroundColor="#FFFFFF">
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
            <View style={styles.topBar}>
              <View style={[styles.roleBadge, { backgroundColor: authRoleOption.soft, borderColor: authRoleOption.border }]}>
                <Ionicons name={authRoleOption.icon} size={15} color={authRoleOption.accent} />
                <Text style={[styles.roleBadgeText, { color: authRoleOption.accent }]}>
                  {authRoleOption.shortName} invite
                </Text>
              </View>
              <TouchableOpacity accessibilityLabel="Back to login" accessibilityRole="button" onPress={navigateToLogin} style={styles.loginReturnButton}>
                <Ionicons name="log-in-outline" size={15} color="#343548" />
                <Text style={styles.loginReturnText}>Login</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.brandHeader}>
              <View style={styles.logoCage}>
                <BrandLogo size={48} />
              </View>
              <Text style={styles.title}>{invitationError ? 'Invite Required' : 'Create Your Account'}</Text>
              <Text style={styles.subtitle}>
                {invitationError
                  ? 'Account creation starts from an institute invitation link.'
                  : `Your ${authRoleOption.shortName} access will be linked to the inviting institute.`}
              </Text>
            </View>

            {invitationError ? (
              <View style={styles.invalidInviteCard}>
                <View style={styles.invalidInviteIcon}>
                  <Ionicons name="alert-circle-outline" size={30} color="#B91C1C" />
                </View>
                <Text style={styles.invalidInviteText}>{invitationError}</Text>
                <Text style={styles.invalidInviteHint}>
                  Ask your institute administrator to send a fresh invite, or contact onboarding if your institute is not registered.
                </Text>
                <View style={styles.invalidInviteActions}>
                  <TouchableOpacity accessibilityLabel="Back to login" accessibilityRole="button" style={[styles.btn, styles.invalidPrimaryButton]} onPress={navigateToLogin}>
                    <Text style={styles.btnText}>Back to Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Contact registration support" accessibilityRole="link" style={styles.invalidSecondaryButton} onPress={contactRegistration}>
                    <Ionicons name="mail-outline" size={17} color="#991B1B" />
                    <Text style={styles.invalidSecondaryText}>Contact Registration</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {instituteData && (
                  <View style={styles.instituteHeader}>
                    <View style={styles.instituteIcon}>
                      <Ionicons name="school-outline" size={20} color={authRoleOption.accent} />
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
                    accessibilityLabel="Full name"
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
                    accessibilityLabel="Email address"
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
                    accessibilityLabel="Password"
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
                    accessibilityLabel="Confirm password"
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

                {submissionError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={17} color="#DC2626" />
                    <Text style={styles.errorText}>{submissionError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  accessibilityLabel="Create account"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !instituteData || loading }}
                  style={[styles.btn, (!instituteData || loading) && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={!instituteData || loading}
                >
                  <Text style={styles.btnText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel="Back to login"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading }}
                  style={styles.backButton}
                  onPress={navigateToLogin}
                  disabled={loading}
                >
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
                <TouchableOpacity accessibilityLabel="Go to login" accessibilityRole="button" style={styles.modalBtn} onPress={handleSuccessModalClose}>
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
  keyboardRoot: { backgroundColor: '#FFFFFF', flex: 1, minHeight: '100%' },
  scrollView: { backgroundColor: '#FFFFFF', flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  containerMobile: { padding: 18 },
  containerCompact: { padding: 14 },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 28,
    borderWidth: 1,
    borderColor: '#D9D8E8',
  },
  cardMobile: { padding: 20, borderRadius: 8 },
  cardCompact: { padding: 16, borderRadius: 8 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roleBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  loginReturnButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  loginReturnText: {
    color: '#343548',
    fontSize: 12,
    fontWeight: '900',
  },
  brandHeader: { alignItems: 'center', marginBottom: 24 },
  logoCage: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D9D8E8',
  },
  title: { fontSize: 26, fontWeight: '900', color: '#010110', marginTop: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#4B4B5F', marginTop: 7, lineHeight: 21, textAlign: 'center' },
  invalidInviteCard: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  invalidInviteIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invalidInviteText: { fontSize: 15, color: '#991B1B', fontWeight: '800', textAlign: 'center', marginTop: 14, lineHeight: 22 },
  invalidInviteHint: { color: '#7F1D1D', fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 8, textAlign: 'center' },
  invalidInviteActions: {
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  invalidPrimaryButton: {
    marginTop: 0,
  },
  invalidSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  invalidSecondaryText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '900',
  },
  instituteHeader: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D8E8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  instituteIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instituteCopy: { flex: 1, minWidth: 0 },
  instituteName: { fontSize: 17, fontWeight: '900', color: '#010110' },
  instituteRole: { fontSize: 13, color: '#4B4B5F', marginTop: 3, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '900', color: '#353548', marginBottom: 7 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9D8E8',
    borderRadius: 8,
    marginBottom: 16,
  },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, minWidth: 0, paddingVertical: 15, fontSize: 16, color: '#010110', outlineStyle: 'none' },
  inputReadOnly: { color: '#4B4B5F' },
  accessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  readOnlySection: {
    flexGrow: 1,
    minWidth: 140,
    padding: 12,
    backgroundColor: '#F7F6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D7FF',
  },
  readOnlyLabel: { fontSize: 11, color: '#4B4B5F', marginBottom: 4, fontWeight: '900' },
  readOnlyValue: { fontSize: 15, fontWeight: '800', color: '#010110' },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  errorText: {
    color: '#991B1B',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  btn: {
    backgroundColor: '#010110',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.52 },
  btnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 4 },
  backLink: { color: '#635BFF', fontWeight: '800', marginLeft: 6 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.42)', padding: 20 },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#D9D8E8',
  },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#B6E3D8',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 21, fontWeight: '900', color: '#010110' },
  modalMessage: { fontSize: 15, color: '#4B4B5F', textAlign: 'center', marginVertical: 18, lineHeight: 22 },
  modalBtn: { backgroundColor: '#010110', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  modalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});

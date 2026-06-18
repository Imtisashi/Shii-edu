import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal, Alert, Animated, ScrollView, Linking } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { auth } from '../../../firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import BrandLogo from '../../components/BrandLogo';
import BrandWordmark from '../../components/BrandWordmark';
import EnterpriseAuthBackground from '../../components/auth/EnterpriseAuthBackground';
import { DURATION, EASING } from '../../utils/animations';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ONBOARDING_MAILTO = 'mailto:sashimiofficials@gmail.com?subject=Shii-Edu%20registration%20support';

const showLoginAlert = (message) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert(message);
  }
};

export default function Login() {
  const layout = useResponsiveLayout();
  const introAnim = useRef(new Animated.Value(0)).current;
  const mobileCardWidth = layout.isMobile
    ? Math.max(280, layout.width - (layout.isCompact ? 28 : 40))
    : undefined;
  const [identifier, setIdentifier] = useState(''); // Can be Email OR Student ID
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetMessageType, setResetMessageType] = useState(''); // 'success' or 'error'

  // Load saved credentials on startup
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedId = await AsyncStorage.getItem('savedIdentifier');
        if (savedId) {
          setIdentifier(savedId);
          setRememberMe(true);
        }
      } catch (e) {
        console.error("Failed to load saved credentials", e);
      }
    };
    loadSavedCredentials();
  }, []);

  useEffect(() => {
    Animated.timing(introAnim, {
      toValue: 1,
      duration: DURATION.standard,
      easing: EASING.strongEaseOut,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [introAnim]);

  const introStyle = {
    opacity: introAnim,
    transform: [
      {
        translateY: introAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: introAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      showLoginAlert('Please enter your ID/Email and Password.');
      return;
    }

    setLoading(true);
    try {
      // THE FIREBASE ID TRICK
      // If there is no '@', we assume it's a School User ID and append our invisible ghost domain
      let loginEmail = identifier.trim().toLowerCase();
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@eduhub.local`;
      }

      // Handle Remember Me Storage
      if (rememberMe) {
        await AsyncStorage.setItem('savedIdentifier', identifier.trim());
      } else {
        await AsyncStorage.removeItem('savedIdentifier');
      }

      // Authenticate
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (error) {
      console.error(error);
      const msg = "Invalid ID/Email or Password. Please try again.";
      showLoginAlert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!resetEmail) {
      setResetMessage('Please enter your email address.');
      setResetMessageType('error');
      return;
    }

    setResetLoading(true);
    setResetMessage('');
    setResetMessageType('');

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Password reset link sent! Please check your email.');
      setResetMessageType('success');
      setResetEmail('');
    } catch (error) {
      console.error(error);
      setResetMessage('Failed to send reset link. Please check your email and try again.');
      setResetMessageType('error');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetModalClose = () => {
    setShowResetModal(false);
    setResetEmail('');
    setResetMessage('');
    setResetMessageType('');
  };

  const contactRegistration = () => {
    Linking.openURL(ONBOARDING_MAILTO).catch(() => {
      showLoginAlert('Email sashimiofficials@gmail.com for registration support.');
    });
  };

  return (
    <EnterpriseAuthBackground>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.container,
            layout.isMobile && styles.containerMobile,
            layout.isDesktop && styles.containerDesktop,
            layout.isCompact && styles.containerCompact,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {layout.isDesktop ? (
            <Animated.View style={[styles.desktopBrandPanel, introStyle]}>
              <BrandLogo size={68} variant="light" style={styles.brandIcon} />
              <Text style={styles.brandEyebrow}>Institute Access Control</Text>
              <BrandWordmark color="#F8FAFC" size="lg" style={styles.brandTitle} />
              <Text style={styles.brandCopy}>
                A structured education workspace for superadmins, administrators, teachers, students, and parents.
              </Text>
              <View style={styles.brandFeatureRow}>
                <Ionicons name="shield-checkmark" size={18} color="#C4B5FD" />
                <Text style={styles.brandFeatureText}>Role-based secure access</Text>
              </View>
              <View style={styles.brandFeatureRow}>
                <Ionicons name="business" size={18} color="#C4B5FD" />
                <Text style={styles.brandFeatureText}>School and college workflows shaped for each campus</Text>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.card, layout.isMobile && styles.cardMobile, layout.isMobile && { width: mobileCardWidth }, layout.isDesktop && styles.cardDesktop, layout.isCompact && styles.cardCompact, introStyle]}>
            <View style={[styles.header, layout.isMobile && styles.headerMobile]}>
              <View style={[styles.logoCage, layout.isMobile && styles.logoCageMobile]}>
                <BrandLogo size={58} />
              </View>
              <BrandWordmark color="#F8FAFC" size={layout.isMobile ? 'sm' : 'md'} style={[styles.title, layout.isMobile && styles.titleMobile]} />
              <Text style={styles.subtitle}>Sign in to your institute workspace</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>User ID or Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#CBD5E1" style={styles.icon} />
                <TextInput
                  accessibilityLabel="User ID or email"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  importantForAutofill="yes"
                  inputMode="text"
                  onChangeText={setIdentifier}
                  style={styles.input}
                  placeholder={layout.isMobile ? 'ID or email' : 'e.g. STU-1024 or ADM-260603'}
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  textContentType="username"
                  value={identifier}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#CBD5E1" style={styles.icon} />
                <TextInput
                  accessibilityLabel="Password"
                  autoComplete="current-password"
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="go"
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  value={password}
                />
                <TouchableOpacity
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#CBD5E1" />
                </TouchableOpacity>
              </View>

              {/* REMEMBER ME & FORGOT PASSWORD ROW */}
              <View style={[styles.optionsRow, layout.isMobile && styles.optionsRowMobile, layout.isCompact && styles.optionsRowCompact]}>
                <TouchableOpacity
                  accessibilityLabel="Remember me"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  style={styles.rememberRow}
                  onPress={() => {
                    setRememberMe(!rememberMe);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]} >
                    {rememberMe && <Ionicons name="checkmark" size={14} color="#020617" />}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel="Forgot password"
                  accessibilityRole="button"
                  onPress={() => {
                    setShowResetModal(true);
                  }}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                accessibilityLabel="Secure login"
                accessibilityRole="button"
                style={styles.loginBtn}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? <SmoothSpinner color="#fff" /> : <Text style={styles.loginBtnText}>Secure Login</Text>}
              </TouchableOpacity>
            </View>

            {/* REGISTRATION IS GONE. REPLACED WITH ADMIN NOTICE */}
            <View style={styles.footer}>
              <Ionicons name="shield-checkmark" size={16} color="#CBD5E1" />
              <Text style={styles.footerText}>
                Access is managed by your campus administrator.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Contact for Registration"
              accessibilityRole="link"
              onPress={contactRegistration}
              style={styles.registrationContactButton}
            >
              <Ionicons name="mail-outline" size={16} color="#C4B5FD" />
              <Text style={styles.registrationContactText}>Contact for Registration</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Password Reset Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showResetModal}
          onRequestClose={handleResetModalClose}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, layout.isDesktop && styles.modalContentDesktop]}>
              <View style={styles.modalHeader}>
                <Ionicons name="mail-outline" size={28} color="#C4B5FD" />
                <Text style={styles.modalTitle}>Reset Password</Text>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>
                  Enter your email address to receive a password reset link.
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#CBD5E1" style={styles.icon} />
                  <TextInput
                    accessibilityLabel="Password reset email"
                    autoCapitalize="none"
                    autoComplete="email"
                    inputMode="email"
                    keyboardType="email-address"
                    onChangeText={setResetEmail}
                    placeholder="your@email.com"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    value={resetEmail}
                  />
                </View>
                {resetMessage && (
                  <View style={{ marginVertical: 12 }}>
                    <Text
                      style={[
                        styles.modalMessage,
                        resetMessageType === 'success' && styles.modalMessageSuccess,
                        resetMessageType === 'error' && styles.modalMessageError
                      ]}
                    >
                      {resetMessage}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  accessibilityLabel="Send password reset link"
                  accessibilityRole="button"
                  style={[styles.modalBtn, resetLoading && styles.modalBtnLoading]}
                  onPress={handleSendResetLink}
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <SmoothSpinner color="#fff" size={20} />
                  ) : (
                    <Text style={styles.modalBtnText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Cancel password reset"
                  accessibilityRole="button"
                  style={styles.modalCancelBtn}
                  onPress={handleResetModalClose}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
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
  container: { flexGrow: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', padding: 20 },
  containerMobile: { alignItems: 'stretch' },
  containerDesktop: { flexDirection: 'row', padding: 40, gap: 28 },
  containerCompact: { padding: 14 },
  desktopBrandPanel: {
    flex: 1,
    maxWidth: 520,
    alignSelf: 'stretch',
    justifyContent: 'center',
    padding: 34,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  brandIcon: { marginBottom: 22 },
  brandEyebrow: { color: '#A5B4FC', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 },
  brandTitle: { color: '#F8FAFC', fontSize: 42, fontWeight: '900', letterSpacing: 0 },
  brandCopy: { color: '#DDE7F5', fontSize: 17, lineHeight: 26, marginTop: 12, marginBottom: 26, maxWidth: 430 },
  brandFeatureRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  brandFeatureText: { color: '#EEF2FF', marginLeft: 10, fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: '#0F172A',
    width: '100%',
    maxWidth: 450,
    borderRadius: 8,
    padding: 30,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardDesktop: { maxWidth: 440 },
  cardMobile: { alignSelf: 'center', maxWidth: '100%', borderRadius: 8, padding: 20 },
  cardCompact: { padding: 18, borderRadius: 8 },
  header: { alignItems: 'center', marginBottom: 35 },
  headerMobile: { marginBottom: 26 },
  logoCage: { backgroundColor: '#111827', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  logoCageMobile: { padding: 8, borderRadius: 8, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', marginBottom: 5 },
  titleMobile: { fontSize: 26 },
  subtitle: { fontSize: 14, color: '#CBD5E1', textAlign: 'center' },

  form: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 8, textTransform: 'uppercase' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, marginBottom: 20 },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, minWidth: 0, paddingVertical: 16, fontSize: 16, color: '#F8FAFC', outlineStyle: 'none' },
  eyeIcon: { paddingHorizontal: 10, paddingVertical: 12 },

  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  optionsRowMobile: { justifyContent: 'flex-start', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  optionsRowCompact: { flexWrap: 'wrap', gap: 12 },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  checkboxActive: { backgroundColor: '#C4B5FD', borderColor: '#C4B5FD' },
  rememberText: { fontSize: 14, color: '#E2E8F0', fontWeight: '500' },
  forgotText: { fontSize: 14, color: '#C4B5FD', fontWeight: '700' },

  loginBtn: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  loginBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#334155' },
  footerText: { flex: 1, fontSize: 12, color: '#CBD5E1', marginLeft: 6, fontWeight: '500' },
  registrationContactButton: { alignItems: 'center', borderColor: '#334155', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14, minHeight: 44, paddingHorizontal: 12 },
  registrationContactText: { color: '#C4B5FD', fontSize: 13, fontWeight: '900' },
  modalContainer: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 430, backgroundColor: '#0F172A', borderRadius: 8, padding: 24, borderWidth: 1, borderColor: '#334155' },
  modalContentDesktop: { maxWidth: 460 },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalTitle: { marginTop: 10, fontSize: 22, fontWeight: '900', color: '#F8FAFC' },
  modalBody: { width: '100%' },
  modalSubtitle: { color: '#CBD5E1', textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  modalMessage: { textAlign: 'center', fontWeight: '700' },
  modalMessageSuccess: { color: '#34D399' },
  modalMessageError: { color: '#FCA5A5' },
  modalBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  modalBtnLoading: { opacity: 0.75 },
  modalBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 14 },
  modalCancelBtnText: { color: '#CBD5E1', fontWeight: '800' },
});

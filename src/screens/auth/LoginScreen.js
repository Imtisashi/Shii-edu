import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert
} from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import BrandLogo from '../../components/BrandLogo';

const showLoginAlert = (message) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert(message);
  }
};

export default function Login() {
  const layout = useResponsiveLayout();
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
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);

      // Fetch Role to determine routing
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Role-based access control - Super Admin check happens here via Firestore role
        // No hardcoded emails or secrets in client-side code
        if (userData.role === 'superAdmin') {
          // Super Admin access granted based solely on Firestore role
          // Navigation handled automatically by App.js
        }
        // For all other roles (admin, teacher, student), access is granted normally
        // Navigation handled automatically by App.js based on role
      } else {
        auth.signOut();
        showLoginAlert('Account data not found in database.');
      }
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, layout.isDesktop && styles.containerDesktop, layout.isCompact && styles.containerCompact]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {layout.isDesktop ? (
        <View style={styles.desktopBrandPanel}>
          <BrandLogo size={68} variant="light" style={styles.brandIcon} />
          <Text style={styles.brandTitle}>Edu-Hub</Text>
          <Text style={styles.brandCopy}>
            A responsive campus command center for superadmins, admins, teachers, and students.
          </Text>
          <View style={styles.brandFeatureRow}>
            <Ionicons name="shield-checkmark" size={18} color="#C4B5FD" />
            <Text style={styles.brandFeatureText}>Role-based secure access</Text>
          </View>
          <View style={styles.brandFeatureRow}>
            <Ionicons name="pie-chart" size={18} color="#C4B5FD" />
            <Text style={styles.brandFeatureText}>Desktop analytics and mobile workflows</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, layout.isDesktop && styles.cardDesktop, layout.isCompact && styles.cardCompact]}>
        <View style={styles.header}>
          <View style={styles.logoCage}>
            <BrandLogo size={58} />
          </View>
          <Text style={styles.title}>Edu-Hub</Text>
          <Text style={styles.subtitle}>Enter your Campus ID or Email to continue</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>User ID or Email</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. STU-1024 or admin@college.edu"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#94A3B8"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* REMEMBER ME & FORGOT PASSWORD ROW */}
          <View style={[styles.optionsRow, layout.isCompact && styles.optionsRowCompact]}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]} >
                {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowResetModal(true)}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Secure Login</Text>}
          </TouchableOpacity>
        </View>

        {/* REGISTRATION IS GONE. REPLACED WITH ADMIN NOTICE */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={16} color="#94A3B8" />
          <Text style={styles.footerText}>
            Access is managed by your campus administrator.
          </Text>
        </View>
      </View>

      {/* Password Reset Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showResetModal}
        onRequestClose={handleResetModalClose}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, layout.isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Ionicons name="mail-outline" size={28} color="#4A90E2" />
              <Text style={styles.modalTitle}>Reset Password</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Enter your email address to receive a password reset link.
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor="#94A3B8"
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
                style={[styles.modalBtn, resetLoading && styles.modalBtnLoading]}
                onPress={handleSendResetLink}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#fff" size={20} />
                ) : (
                  <Text style={styles.modalBtnText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
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
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 20 },
  containerDesktop: { flexDirection: 'row', padding: 40, gap: 28 },
  containerCompact: { padding: 14 },
  desktopBrandPanel: {
    flex: 1,
    maxWidth: 520,
    alignSelf: 'stretch',
    justifyContent: 'center',
    padding: 34,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.22)',
  },
  brandIcon: { marginBottom: 22 },
  brandTitle: { color: '#FFFFFF', fontSize: 42, fontWeight: '900', letterSpacing: 0 },
  brandCopy: { color: '#CBD5E1', fontSize: 17, lineHeight: 26, marginTop: 12, marginBottom: 26, maxWidth: 430 },
  brandFeatureRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  brandFeatureText: { color: '#EDE9FE', marginLeft: 10, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#ffffff', width: '100%', maxWidth: 450, borderRadius: 30, padding: 30, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  cardDesktop: { maxWidth: 440 },
  cardCompact: { padding: 22, borderRadius: 24 },
  header: { alignItems: 'center', marginBottom: 35 },
  logoCage: { backgroundColor: '#F5F3FF', padding: 10, borderRadius: 22, marginBottom: 15 },
  title: { fontSize: 28, fontWeight: '900', color: '#1E293B', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center' },

  form: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, marginBottom: 20 },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#1E293B', outlineStyle: 'none' },
  eyeIcon: { paddingHorizontal: 15 },

  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  optionsRowCompact: { flexWrap: 'wrap', gap: 12 },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  checkboxActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  rememberText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  forgotText: { fontSize: 14, color: '#8B5CF6', fontWeight: '600' },

  loginBtn: { backgroundColor: '#8B5CF6', paddingVertical: 18, borderRadius: 16, alignItems: 'center', elevation: 3 },
  loginBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerText: { fontSize: 12, color: '#94A3B8', marginLeft: 6, fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 430, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 8 },
  modalContentDesktop: { maxWidth: 460 },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalTitle: { marginTop: 10, fontSize: 22, fontWeight: '900', color: '#0F172A' },
  modalBody: { width: '100%' },
  modalSubtitle: { color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  modalMessage: { textAlign: 'center', fontWeight: '700' },
  modalMessageSuccess: { color: '#059669' },
  modalMessageError: { color: '#DC2626' },
  modalBtn: { backgroundColor: '#4A90E2', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  modalBtnLoading: { opacity: 0.75 },
  modalBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 14 },
  modalCancelBtnText: { color: '#64748B', fontWeight: '800' },
});

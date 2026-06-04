import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import BrandWordmark from '../../components/BrandWordmark';
import EnterpriseAuthBackground from '../../components/auth/EnterpriseAuthBackground';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import {
  assertLoginInstituteId,
  assertLoginUserId,
} from '../../utils/instituteLoginIdentifiers';

type InstituteLoginInput = {
  enableBiometrics?: boolean;
  instituteId: string;
  userId: string;
  password: string;
};

type CachedInstituteIdentity = {
  biometricEnabled: boolean;
  instituteId: string;
  instituteName: string;
  logoUrl: string | null;
  uid: string;
  updatedAt: string;
  userId: string;
};

type BiometricCapability = {
  available: boolean;
  label: 'Biometrics' | 'Face ID' | 'Fingerprint';
  reason: string | null;
};

type InstituteAuthValue = {
  authStage: string;
  authError: string | null;
  biometricCapability: BiometricCapability;
  cachedInstituteIdentity: CachedInstituteIdentity | null;
  clearAuthError: () => void;
  loginWithInstitute: (input: InstituteLoginInput) => Promise<unknown>;
  unlockWithBiometrics: () => Promise<unknown>;
};

export default function InstituteLoginScreen() {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const {
    authError,
    authStage,
    biometricCapability,
    cachedInstituteIdentity,
    clearAuthError,
    loginWithInstitute,
    unlockWithBiometrics,
  } = useAuth() as InstituteAuthValue;
  const [instituteId, setInstituteId] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [enableBiometrics, setEnableBiometrics] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [biometricSubmitting, setBiometricSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const mobilePanelWidth = layout.isMobile
    ? Math.max(280, Math.min(450, layout.width - 32))
    : undefined;

  useEffect(() => {
    if (!cachedInstituteIdentity) return;
    setInstituteId(cachedInstituteIdentity.instituteId);
    setUserId(cachedInstituteIdentity.userId);
    setEnableBiometrics(cachedInstituteIdentity.biometricEnabled);
  }, [cachedInstituteIdentity]);

  const clearErrors = () => {
    if (formError) setFormError('');
    if (authError) clearAuthError();
  };

  const handleInstituteIdChange = (value: string) => {
    clearErrors();
    setInstituteId(value);
  };

  const handleUserIdChange = (value: string) => {
    clearErrors();
    setUserId(value);
  };

  const handlePasswordChange = (value: string) => {
    clearErrors();
    setPassword(value);
  };

  const handleLogin = async () => {
    clearErrors();

    const cleanedInstituteId = instituteId.trim();
    const cleanedUserId = userId.trim();

    if (!cleanedInstituteId || !cleanedUserId || !password) {
      setFormError('Institute ID, User ID, and password are required.');
      return;
    }

    try {
      assertLoginInstituteId(cleanedInstituteId);
      assertLoginUserId(cleanedUserId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Institute ID or User ID is invalid.');
      return;
    }

    setSubmitting(true);

    try {
      await loginWithInstitute({
        enableBiometrics: biometricCapability.available && enableBiometrics,
        instituteId: cleanedInstituteId,
        userId: cleanedUserId,
        password,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      setFormError(message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (biometricSubmitting || submitting) return;
    clearErrors();
    setBiometricSubmitting(true);

    try {
      await unlockWithBiometrics();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Biometric sign-in failed.';
      setFormError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBiometricSubmitting(false);
    }
  };

  const visibleError = formError || authError;
  const biometricReturnAvailable = Boolean(
    cachedInstituteIdentity?.biometricEnabled &&
    biometricCapability.available
  );
  const biometricLabel = biometricCapability.label;
  const returningInstituteName = cachedInstituteIdentity?.instituteName || 'Shii-Edu';
  const returningLogoUrl = cachedInstituteIdentity?.logoUrl || null;
  const hasReturningInstitute = Boolean(cachedInstituteIdentity?.instituteName);

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
            {
              paddingTop: Math.max(insets.top, layout.isMobile ? 12 : 20),
              paddingBottom: Math.max(insets.bottom, layout.isMobile ? 12 : 20),
            },
            layout.isMobile && styles.containerMobile,
            layout.isDesktop && styles.containerDesktop,
            layout.isCompact && styles.containerCompact,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authSector}>
          <View
            style={[
              styles.card,
              layout.isMobile && styles.cardMobile,
              layout.isMobile && { width: mobilePanelWidth },
              layout.isDesktop && styles.cardDesktop,
              layout.isCompact && styles.cardCompact,
            ]}
          >
            <View style={[styles.header, layout.isMobile && styles.headerMobile]}>
              <View style={[styles.logoCage, layout.isMobile && styles.logoCageMobile]}>
                {returningLogoUrl ? (
                  <Image
                    accessibilityLabel={`${returningInstituteName} logo`}
                    resizeMode="contain"
                    source={{ uri: returningLogoUrl }}
                    style={styles.formLogoImage}
                  />
              ) : (
                <BrandLogo size={58} style={undefined} />
              )}
              </View>
              <BrandWordmark color="#0F172A" size={layout.isMobile ? 'sm' : 'md'} style={styles.formWordmark} />
              <Text style={[styles.title, layout.isMobile && styles.titleMobile]}>
                {hasReturningInstitute ? returningInstituteName : 'Secure institute login'}
              </Text>
              <Text style={styles.subtitle}>
                {hasReturningInstitute
                  ? 'Sign in to your institute workspace.'
                  : 'Enter your Institute ID, User ID, and password.'}
              </Text>
            </View>

            <View style={styles.form}>
              {biometricReturnAvailable ? (
                <TouchableOpacity
                  accessibilityLabel={`Sign in with ${biometricLabel}`}
                  activeOpacity={0.84}
                  disabled={biometricSubmitting || submitting}
                  onPress={handleBiometricUnlock}
                  style={[styles.biometricButton, biometricSubmitting && styles.loginBtnDisabled]}
                >
                  {biometricSubmitting ? (
                    <SmoothSpinner color="#2563EB" size={22} trackColor="#BFDBFE" style={undefined} />
                  ) : (
                    <Ionicons name="finger-print-outline" size={24} color="#2563EB" />
                  )}
                  <View style={styles.biometricButtonCopy}>
                    <Text style={styles.biometricButtonTitle}>
                      {biometricSubmitting ? `Verifying ${biometricLabel}...` : `Continue with ${biometricLabel}`}
                    </Text>
                    <Text numberOfLines={1} style={styles.biometricButtonSubtitle}>
                      {cachedInstituteIdentity?.instituteName || 'Your institute'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>
              ) : null}

              {biometricReturnAvailable ? (
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or use your password</Text>
                  <View style={styles.orLine} />
                </View>
              ) : null}

              <Text style={styles.label}>Institute ID</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Institute ID"
                  value={instituteId}
                  onChangeText={handleInstituteIdChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#64748B"
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.label}>User ID</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="id-card-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Student, teacher, or admin ID"
                  value={userId}
                  onChangeText={handleUserIdChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#64748B"
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#64748B"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.eyeIcon}
                  accessibilityLabel="Toggle password visibility"
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {visibleError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{visibleError}</Text>
                </View>
              ) : null}

              <View style={styles.optionsRow}>
                {biometricCapability.available ? (
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => {
                      setEnableBiometrics((current) => !current);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, enableBiometrics && styles.checkboxActive]}>
                      {enableBiometrics ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={styles.rememberText}>Use {biometricLabel} on this device next time</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.secureCacheRow}>
                    <Ionicons name="key-outline" size={16} color="#2563EB" />
                    <Text style={styles.secureCacheText}>Institute ID and User ID are cached securely after sign-in</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, (submitting || biometricSubmitting) && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={submitting || biometricSubmitting}
                activeOpacity={0.84}
              >
                {submitting ? (
                  <SmoothSpinner color="#FFFFFF" size={22} trackColor="#CBD5E1" style={undefined} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={19} color="#FFFFFF" />
                    <Text style={styles.loginBtnText}>Verify & Sign In</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Ionicons name="lock-closed-outline" size={15} color="#2563EB" />
              <Text style={styles.footerText}>Every session opens only your institute workspace</Text>
            </View>
            {authStage === 'biometric-required' ? (
              <Text style={styles.supportText}>Your password remains available if biometric access is unavailable.</Text>
            ) : null}
            <Text style={styles.supportText}>Contact your institute administrator if your password needs to be reset.</Text>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </EnterpriseAuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { backgroundColor: '#F8FAFC', flex: 1 },
  scrollView: { backgroundColor: '#F8FAFC', flex: 1 },
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  containerMobile: { paddingHorizontal: 16 },
  containerDesktop: { paddingHorizontal: 40 },
  containerCompact: { paddingHorizontal: 14 },
  authSector: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
  },
  biometricButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    minHeight: 62,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  biometricButtonCopy: {
    flex: 1,
    marginHorizontal: 11,
    minWidth: 0,
  },
  biometricButtonSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  biometricButtonTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderColor: '#D7E0EC',
    borderWidth: 1,
    padding: 26,
  },
  cardDesktop: { maxWidth: 480, padding: 30 },
  cardMobile: { alignSelf: 'center', maxWidth: '100%', borderRadius: 8, padding: 18 },
  cardCompact: { padding: 16, borderRadius: 8 },
  header: { alignItems: 'center', marginBottom: 30 },
  headerMobile: { marginBottom: 18 },
  logoCage: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#D7E0EC' },
  logoCageMobile: { padding: 8, borderRadius: 8, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginBottom: 5 },
  titleMobile: { fontSize: 24 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center' },
  form: { marginBottom: 14 },
  formWordmark: { marginBottom: 4 },
  formLogoImage: { borderRadius: 8, height: 58, width: 58 },
  label: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, marginBottom: 13 },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 16, color: '#0F172A' },
  eyeIcon: { paddingHorizontal: 12, paddingVertical: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, color: '#991B1B', fontSize: 13, lineHeight: 19, fontWeight: '700', marginLeft: 8 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  orLine: {
    backgroundColor: '#D7E0EC',
    flex: 1,
    height: 1,
  },
  orRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18,
  },
  orText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  checkboxActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  rememberText: { flexShrink: 1, fontSize: 13, color: '#334155', fontWeight: '700' },
  secureCacheRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
  },
  secureCacheText: {
    color: '#475569',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 7,
  },
  loginBtn: { minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 8 },
  loginBtnDisabled: { opacity: 0.66 },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  footerText: { flexShrink: 1, fontSize: 12, color: '#334155', marginLeft: 6, fontWeight: '700', textAlign: 'center' },
  supportText: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 10, textAlign: 'center' },
});

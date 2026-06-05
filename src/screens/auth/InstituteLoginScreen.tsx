import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Linking,
  Modal,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import BrandWordmark from '../../components/BrandWordmark';
import DownloadAppAction from '../../components/auth/DownloadAppAction';
import EnterpriseAuthBackground from '../../components/auth/EnterpriseAuthBackground';
import PwaNotificationPrompt from '../../components/auth/PwaNotificationPrompt';
import { useAuth } from '../../contexts/AuthContext';
import {
  AUTH_ROLE_OPTIONS,
  getAuthRoleOption,
  normalizeAuthRole,
  type AuthRoleId,
} from '../../constants/authRoles';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import {
  assertLoginInstituteId,
  assertLoginUserId,
} from '../../utils/instituteLoginIdentifiers';
import {
  fetchPasswordResetStatus,
  submitPasswordResetRequest,
  type PasswordResetStatusResult,
  type PasswordResetTicket,
} from '../../services/passwordResetService';
import { showPwaNotification } from '../../services/pwaNotificationService';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';

type InstituteLoginInput = {
  enableBiometrics?: boolean;
  expectedRole?: AuthRoleId;
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

const WRONG_PASSWORD_MESSAGE = 'Wrong password. Something is wrong.';
const PASSWORD_RESET_STORAGE_PREFIX = 'shii-edu-password-reset';

const goToWebPath = (path: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  }
};

const getResetTicketStorageKey = (role: AuthRoleId, instituteId: string, userId: string) => (
  `${PASSWORD_RESET_STORAGE_PREFIX}:${role}:${instituteId.trim().toLowerCase()}:${userId.trim().toLowerCase()}`
);

const readSavedResetTicket = (role: AuthRoleId, instituteId: string, userId: string): PasswordResetTicket | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !instituteId || !userId) return null;

  try {
    const raw = window.localStorage.getItem(getResetTicketStorageKey(role, instituteId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PasswordResetTicket>;
    if (!parsed.requestId || !parsed.token) return null;
    return {
      requestId: parsed.requestId,
      status: parsed.status || 'pending',
      token: parsed.token,
    };
  } catch (_error) {
    return null;
  }
};

const writeSavedResetTicket = (
  role: AuthRoleId,
  instituteId: string,
  userId: string,
  ticket: PasswordResetTicket
) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.localStorage.setItem(
    getResetTicketStorageKey(role, instituteId, userId),
    JSON.stringify(ticket)
  );
};

export default function InstituteLoginScreen() {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
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
  const [activeRole, setActiveRole] = useState<AuthRoleId>(
    normalizeAuthRole(route?.params?.initialRole)
  );
  const [fieldWarnings, setFieldWarnings] = useState({
    instituteId: false,
    password: false,
    userId: false,
  });
  const [resetApprovalNotified, setResetApprovalNotified] = useState(false);
  const [resetChecking, setResetChecking] = useState(false);
  const [resetContact, setResetContact] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetInstituteId, setResetInstituteId] = useState('');
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetNote, setResetNote] = useState('');
  const [resetStatus, setResetStatus] = useState<PasswordResetStatusResult | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetTicket, setResetTicket] = useState<PasswordResetTicket | null>(null);
  const [resetUserId, setResetUserId] = useState('');

  const mobilePanelWidth = layout.isMobile
    ? Math.max(280, Math.min(450, layout.width - 32))
    : undefined;

  useEffect(() => {
    if (!cachedInstituteIdentity) return;
    setInstituteId(cachedInstituteIdentity.instituteId);
    setUserId(cachedInstituteIdentity.userId);
    setEnableBiometrics(cachedInstituteIdentity.biometricEnabled);
  }, [cachedInstituteIdentity]);

  useEffect(() => {
    setActiveRole(normalizeAuthRole(route?.params?.initialRole));
  }, [route?.params?.initialRole]);

  useEffect(() => {
    const roleOption = getAuthRoleOption(activeRole);
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const existing = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const link = existing || document.createElement('link');
    link.rel = 'manifest';
    link.href = roleOption.manifestHref;
    if (!existing) document.head.appendChild(link);
    document.title = `Shii-Edu ${roleOption.shortName}`;
  }, [activeRole]);

  const clearErrors = () => {
    if (formError) setFormError('');
    if (authError) clearAuthError();
    if (fieldWarnings.instituteId || fieldWarnings.password || fieldWarnings.userId) {
      setFieldWarnings({ instituteId: false, password: false, userId: false });
    }
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

  const activeRoleConfig = getAuthRoleOption(activeRole);

  const openPasswordReset = () => {
    const nextInstituteId = instituteId.trim();
    const nextUserId = userId.trim();
    const savedTicket = readSavedResetTicket(activeRole, nextInstituteId, nextUserId);

    setResetInstituteId(nextInstituteId);
    setResetUserId(nextUserId);
    setResetContact('');
    setResetNote('');
    setResetError('');
    setResetApprovalNotified(false);
    setResetTicket(savedTicket);
    setResetStatus(savedTicket ? { status: savedTicket.status || 'pending' } : null);
    setResetModalVisible(true);
  };

  const handleCheckResetStatus = useCallback(async ({ silent = false } = {}) => {
    if (!resetTicket) return;

    setResetChecking(true);
    if (!silent) setResetError('');

    try {
      const nextStatus = await fetchPasswordResetStatus(resetTicket);
      setResetStatus(nextStatus);
      setResetTicket((current) => current ? { ...current, status: nextStatus.status } : current);

      if (nextStatus.status === 'approved' && nextStatus.resetLink && !resetApprovalNotified) {
        setResetApprovalNotified(true);
        showNativeMessage('Reset Approved', 'Your administrator approved the reset. Open the secure reset link to continue.');
        await showPwaNotification({
          body: 'Open Shii-Edu to finish resetting your password.',
          tag: `password-reset-approved-${resetTicket.requestId}`,
          title: 'Password reset approved',
          url: activeRoleConfig.authPath,
        }).catch(() => false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check reset status.';
      setResetError(message);
      if (!silent) showNativeError('Status Check Failed', error, message);
    } finally {
      setResetChecking(false);
    }
  }, [activeRoleConfig.authPath, resetApprovalNotified, resetTicket]);

  useEffect(() => {
    if (!resetModalVisible || !resetTicket || resetStatus?.status === 'approved' || resetStatus?.status === 'rejected') {
      return undefined;
    }

    const intervalId = setInterval(() => {
      handleCheckResetStatus({ silent: true });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [handleCheckResetStatus, resetModalVisible, resetStatus?.status, resetTicket]);

  const handleSubmitPasswordReset = async () => {
    const cleanedInstituteId = resetInstituteId.trim();
    const cleanedUserId = resetUserId.trim();
    setResetError('');

    if (!cleanedInstituteId || !cleanedUserId) {
      setResetError('Institute ID and User ID are required for password reset.');
      return;
    }

    try {
      assertLoginInstituteId(cleanedInstituteId);
      assertLoginUserId(cleanedUserId);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Institute ID or User ID is invalid.');
      return;
    }

    setResetSubmitting(true);
    try {
      const ticket = await submitPasswordResetRequest({
        contact: resetContact,
        instituteId: cleanedInstituteId,
        note: resetNote,
        role: activeRole,
        userId: cleanedUserId,
      });
      writeSavedResetTicket(activeRole, cleanedInstituteId, cleanedUserId, ticket);
      setResetTicket(ticket);
      setResetStatus({ status: ticket.status });
      showNativeMessage('Request Sent', 'Your institute administrator has been notified for approval.');
      await showPwaNotification({
        body: 'We will alert you here when an administrator approves the request.',
        tag: `password-reset-requested-${ticket.requestId}`,
        title: 'Password reset request sent',
        url: activeRoleConfig.authPath,
      }).catch(() => false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset request failed.';
      setResetError(message);
      showNativeError('Reset Request Failed', error, message);
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleOpenResetLink = async () => {
    if (!resetStatus?.resetLink) return;
    await Linking.openURL(resetStatus.resetLink);
  };

  const handleLogin = async () => {
    clearErrors();

    const cleanedInstituteId = instituteId.trim();
    const cleanedUserId = userId.trim();

    if (!cleanedInstituteId || !cleanedUserId || !password) {
      setFormError('Institute ID, User ID, and password are required.');
      setFieldWarnings({
        instituteId: !cleanedInstituteId,
        userId: !cleanedUserId,
        password: !password,
      });
      return;
    }

    try {
      assertLoginInstituteId(cleanedInstituteId);
      assertLoginUserId(cleanedUserId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Institute ID or User ID is invalid.');
      setFieldWarnings({
        instituteId: true,
        password: false,
        userId: true,
      });
      return;
    }

    setSubmitting(true);

    try {
      await loginWithInstitute({
        enableBiometrics: biometricCapability.available && enableBiometrics,
        expectedRole: activeRole,
        instituteId: cleanedInstituteId,
        userId: cleanedUserId,
        password,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      const errorCode = String((error as { code?: string })?.code || '');
      const isCredentialError = message === WRONG_PASSWORD_MESSAGE ||
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/sign-in-failed';
      setFormError(message === 'Invalid Institute ID, User ID, or password.' ? WRONG_PASSWORD_MESSAGE : message);
      setFieldWarnings({
        instituteId: isCredentialError,
        password: true,
        userId: isCredentialError,
      });
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
  const credentialFieldsAlert = visibleError === WRONG_PASSWORD_MESSAGE;
  const fieldAlert = {
    instituteId: fieldWarnings.instituteId || credentialFieldsAlert,
    password: fieldWarnings.password || credentialFieldsAlert,
    userId: fieldWarnings.userId || credentialFieldsAlert,
  };
  const biometricReturnAvailable = Boolean(
    cachedInstituteIdentity?.biometricEnabled &&
    biometricCapability.available
  );
  const biometricLabel = biometricCapability.label;
  const returningInstituteName = cachedInstituteIdentity?.instituteName || 'Shii-Edu';
  const returningLogoUrl = cachedInstituteIdentity?.logoUrl || null;
  const hasReturningInstitute = Boolean(cachedInstituteIdentity?.instituteName);

  return (
    <EnterpriseAuthBackground backgroundColor="#FFFFFF">
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
              <BrandWordmark color="#010110" size={layout.isMobile ? 'sm' : 'md'} style={styles.formWordmark} />
              <Text style={[styles.title, layout.isMobile && styles.titleMobile]}>
                {hasReturningInstitute ? returningInstituteName : activeRoleConfig.title}
              </Text>
              <Text style={styles.subtitle}>
                {hasReturningInstitute
                  ? 'Sign in to your institute workspace.'
                  : 'Enter your Institute ID, User ID, and password.'}
              </Text>
            </View>

            <View style={styles.roleTabs}>
              {AUTH_ROLE_OPTIONS.map((tab) => {
                const selected = activeRole === tab.id;
                return (
                  <TouchableOpacity
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    activeOpacity={0.84}
                    key={tab.id}
                    onPress={() => {
                      clearErrors();
                      setActiveRole(tab.id);
                      goToWebPath(tab.authPath);
                      navigation.navigate(tab.routeName, { initialRole: tab.id });
                    }}
                    style={[
                      styles.roleTab,
                      {
                        borderColor: selected ? tab.border : '#D9D8E8',
                        backgroundColor: selected ? tab.soft : '#FFFFFF',
                      },
                    ]}
                  >
                    <Ionicons color={selected ? tab.accent : '#737383'} name={tab.icon} size={17} />
                    <Text style={[styles.roleTabText, { color: selected ? '#010110' : '#4B4B5F' }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.rolePanel, { backgroundColor: activeRoleConfig.soft, borderColor: activeRoleConfig.border }]}>
              <View style={[styles.roleIcon, { backgroundColor: '#FFFFFF', borderColor: activeRoleConfig.border }]}>
                <Ionicons color={activeRoleConfig.accent} name={activeRoleConfig.icon} size={20} />
              </View>
              <View style={styles.rolePanelCopy}>
                <Text style={styles.rolePanelTitle}>{activeRoleConfig.title}</Text>
                <Text style={[styles.rolePanelText, { color: activeRoleConfig.accent }]}>
                  {activeRoleConfig.copy}
                </Text>
              </View>
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
                    <View style={[styles.inlineProgress, { borderColor: activeRoleConfig.border }]}>
                      <View style={[styles.inlineProgressFill, { backgroundColor: activeRoleConfig.accent }]} />
                    </View>
                  ) : (
                    <Ionicons name="finger-print-outline" size={24} color="#635BFF" />
                  )}
                  <View style={styles.biometricButtonCopy}>
                    <Text style={styles.biometricButtonTitle}>
                      {biometricSubmitting ? `Verifying ${biometricLabel}...` : `Continue with ${biometricLabel}`}
                    </Text>
                    <Text numberOfLines={1} style={styles.biometricButtonSubtitle}>
                      {cachedInstituteIdentity?.instituteName || 'Your institute'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#737383" />
                </TouchableOpacity>
              ) : null}

              {biometricReturnAvailable ? (
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or use your password</Text>
                  <View style={styles.orLine} />
                </View>
              ) : null}

              <Text style={[styles.label, styles.criticalLabel, fieldAlert.instituteId && styles.labelError]}>Institute ID</Text>
              <View style={[styles.inputContainer, styles.criticalInput, fieldAlert.instituteId && styles.inputContainerError]}>
                <Ionicons name="business-outline" size={20} color={fieldAlert.instituteId ? '#DC2626' : '#B91C1C'} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Institute ID"
                  value={instituteId}
                  onChangeText={handleInstituteIdChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#737383"
                  returnKeyType="next"
                />
              </View>

              <Text style={[styles.label, styles.criticalLabel, fieldAlert.userId && styles.labelError]}>User ID</Text>
              <View style={[styles.inputContainer, styles.criticalInput, fieldAlert.userId && styles.inputContainerError]}>
                <Ionicons name="id-card-outline" size={20} color={fieldAlert.userId ? '#DC2626' : '#B91C1C'} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder={activeRoleConfig.placeholder}
                  value={userId}
                  onChangeText={handleUserIdChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#737383"
                  returnKeyType="next"
                />
              </View>

              <Text style={[styles.label, styles.criticalLabel, fieldAlert.password && styles.labelError]}>Password</Text>
              <View style={[styles.inputContainer, styles.criticalInput, fieldAlert.password && styles.inputContainerError]}>
                <Ionicons name="lock-closed-outline" size={20} color={fieldAlert.password ? '#DC2626' : '#B91C1C'} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#737383"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.eyeIcon}
                  accessibilityLabel="Toggle password visibility"
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#737383" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                accessibilityLabel="Request password reset"
                activeOpacity={0.82}
                onPress={openPasswordReset}
                style={styles.forgotPasswordButton}
              >
                <Ionicons color={activeRoleConfig.accent} name="key-outline" size={15} />
                <Text style={[styles.forgotPasswordText, { color: activeRoleConfig.accent }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

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
                    <Ionicons name="key-outline" size={16} color="#635BFF" />
                    <Text style={styles.secureCacheText}>Institute ID and User ID are cached securely after sign-in</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.loginBtn,
                  { backgroundColor: activeRoleConfig.accent },
                  (submitting || biometricSubmitting) && styles.loginBtnDisabled,
                ]}
                onPress={handleLogin}
                disabled={submitting || biometricSubmitting}
                activeOpacity={0.84}
              >
                {submitting ? (
                  <View style={styles.buttonProgressWrap}>
                    <Text style={styles.loginBtnText}>Verifying access...</Text>
                    <View style={styles.buttonProgressTrack}>
                      <View style={styles.buttonProgressFill} />
                    </View>
                  </View>
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={19} color="#FFFFFF" />
                    <Text style={styles.loginBtnText}>Verify & Sign In</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.roleHelper}>{activeRoleConfig.helper}</Text>
              <DownloadAppAction
                accentColor={activeRoleConfig.accent}
                appName={`Shii-Edu ${activeRoleConfig.shortName}`}
                borderColor={activeRoleConfig.border}
                manifestHref={activeRoleConfig.manifestHref}
                softColor={activeRoleConfig.soft}
                startUrl={activeRoleConfig.authPath}
                style={styles.downloadAction}
              />
              <PwaNotificationPrompt
                accentColor={activeRoleConfig.accent}
                borderColor={activeRoleConfig.border}
                roleLabel={activeRoleConfig.shortName}
                softColor={activeRoleConfig.soft}
                style={styles.notificationPrompt}
              />
            </View>

            <View style={styles.footer}>
              <Ionicons name="lock-closed-outline" size={15} color="#635BFF" />
              <Text style={styles.footerText}>Every session opens only your institute workspace</Text>
            </View>
            {authStage === 'biometric-required' ? (
              <Text style={styles.supportText}>Your password remains available if biometric access is unavailable.</Text>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                goToWebPath('/roles');
                navigation.navigate('RoleSelection');
              }}
              style={styles.roleSelectionLink}
            >
              <Ionicons name="grid-outline" size={15} color="#635BFF" />
              <Text style={styles.roleSelectionLinkText}>Choose a different role</Text>
            </TouchableOpacity>
            <Text style={styles.supportText}>Contact your institute administrator if your password needs to be reset.</Text>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
        transparent
        visible={resetModalVisible}
      >
        <View style={styles.resetOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.resetKeyboard}
          >
            <ScrollView
              contentContainerStyle={styles.resetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.resetCard}>
                <View style={styles.resetHeader}>
                  <View style={[styles.resetIcon, { borderColor: activeRoleConfig.border, backgroundColor: activeRoleConfig.soft }]}>
                    <Ionicons color={activeRoleConfig.accent} name="key-outline" size={22} />
                  </View>
                  <View style={styles.resetHeaderCopy}>
                    <Text style={styles.resetTitle}>Password reset approval</Text>
                    <Text style={styles.resetSubtitle}>
                      {activeRoleConfig.shortName} reset requests are reviewed by your institute administrator.
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Close password reset"
                    onPress={() => setResetModalVisible(false)}
                    style={styles.resetCloseButton}
                  >
                    <Ionicons color="#4B4B5F" name="close" size={19} />
                  </TouchableOpacity>
                </View>

                {resetTicket ? (
                  <View style={styles.resetStatusPanel}>
                    <View style={[styles.resetStatusBadge, { borderColor: activeRoleConfig.border, backgroundColor: activeRoleConfig.soft }]}>
                      <View
                        style={[
                          styles.resetStatusDot,
                          {
                            backgroundColor: resetStatus?.status === 'approved'
                              ? '#047857'
                              : resetStatus?.status === 'rejected'
                                ? '#DC2626'
                                : '#B45309',
                          },
                        ]}
                      />
                      <Text style={styles.resetStatusText}>
                        {resetStatus?.status === 'approved'
                          ? 'Approved'
                          : resetStatus?.status === 'rejected'
                            ? 'Rejected'
                            : 'Waiting for admin'}
                      </Text>
                    </View>
                    <Text style={styles.resetStatusBody}>
                      {resetStatus?.status === 'approved'
                        ? 'Your administrator approved this request. Open the secure reset link below.'
                        : resetStatus?.status === 'rejected'
                          ? (resetStatus.rejectedReason || 'Your administrator rejected this reset request.')
                          : 'Keep this login page open, or return later with the same Institute ID and User ID to check status.'}
                    </Text>
                    {resetStatus?.status === 'approved' && resetStatus.resetLink ? (
                      <TouchableOpacity
                        activeOpacity={0.84}
                        onPress={handleOpenResetLink}
                        style={[styles.resetPrimaryButton, { backgroundColor: activeRoleConfig.accent }]}
                      >
                        <Ionicons color="#FFFFFF" name="open-outline" size={18} />
                        <Text style={styles.resetPrimaryButtonText}>Open secure reset link</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.84}
                        disabled={resetChecking}
                        onPress={() => handleCheckResetStatus()}
                        style={[
                          styles.resetSecondaryButton,
                          { borderColor: activeRoleConfig.border },
                          resetChecking && styles.loginBtnDisabled,
                        ]}
                      >
                        <Ionicons color={activeRoleConfig.accent} name="refresh-outline" size={18} />
                        <Text style={[styles.resetSecondaryButtonText, { color: activeRoleConfig.accent }]}>
                          {resetChecking ? 'Checking status...' : 'Check approval status'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <>
                    <Text style={styles.resetLabel}>Institute ID</Text>
                    <View style={styles.resetInputShell}>
                      <Ionicons name="business-outline" size={18} color="#B91C1C" style={styles.resetInputIcon} />
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={setResetInstituteId}
                        placeholder="Institute ID"
                        placeholderTextColor="#737383"
                        style={styles.resetInput}
                        value={resetInstituteId}
                      />
                    </View>

                    <Text style={styles.resetLabel}>User ID</Text>
                    <View style={styles.resetInputShell}>
                      <Ionicons name="id-card-outline" size={18} color="#B91C1C" style={styles.resetInputIcon} />
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={setResetUserId}
                        placeholder={activeRoleConfig.placeholder}
                        placeholderTextColor="#737383"
                        style={styles.resetInput}
                        value={resetUserId}
                      />
                    </View>

                    <Text style={styles.resetLabel}>Contact detail for admin</Text>
                    <View style={styles.resetInputShell}>
                      <Ionicons name="mail-outline" size={18} color="#737383" style={styles.resetInputIcon} />
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={setResetContact}
                        placeholder="Email or phone, optional"
                        placeholderTextColor="#737383"
                        style={styles.resetInput}
                        value={resetContact}
                      />
                    </View>

                    <Text style={styles.resetLabel}>Note</Text>
                    <TextInput
                      multiline
                      onChangeText={setResetNote}
                      placeholder="Add context for the administrator, optional"
                      placeholderTextColor="#737383"
                      style={[styles.resetInput, styles.resetTextArea]}
                      textAlignVertical="top"
                      value={resetNote}
                    />

                    <TouchableOpacity
                      activeOpacity={0.84}
                      disabled={resetSubmitting}
                      onPress={handleSubmitPasswordReset}
                      style={[
                        styles.resetPrimaryButton,
                        { backgroundColor: activeRoleConfig.accent },
                        resetSubmitting && styles.loginBtnDisabled,
                      ]}
                    >
                      <Ionicons color="#FFFFFF" name="send-outline" size={18} />
                      <Text style={styles.resetPrimaryButtonText}>
                        {resetSubmitting ? 'Sending request...' : 'Notify admin for approval'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {resetError ? (
                  <View style={styles.resetErrorBox}>
                    <Ionicons color="#DC2626" name="alert-circle-outline" size={17} />
                    <Text style={styles.resetErrorText}>{resetError}</Text>
                  </View>
                ) : null}

                <Text style={styles.resetFootnote}>
                  Admin approval is required before a reset link is shown on this device.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </EnterpriseAuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { backgroundColor: '#FFFFFF', flex: 1 },
  scrollView: { backgroundColor: '#FFFFFF', flex: 1 },
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
    backgroundColor: '#F7F6FF',
    borderColor: '#D9D7FF',
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
    color: '#737383',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  biometricButtonTitle: {
    color: '#010110',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderColor: '#D9D8E8',
    borderWidth: 1,
    padding: 26,
  },
  cardDesktop: { maxWidth: 480, padding: 30 },
  cardMobile: { alignSelf: 'center', maxWidth: '100%', borderRadius: 8, padding: 18 },
  cardCompact: { padding: 16, borderRadius: 8 },
  header: { alignItems: 'center', marginBottom: 30 },
  headerMobile: { marginBottom: 18 },
  logoCage: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#D9D8E8' },
  logoCageMobile: { padding: 8, borderRadius: 8, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#010110', marginBottom: 5 },
  titleMobile: { fontSize: 24 },
  subtitle: { fontSize: 14, color: '#4B4B5F', textAlign: 'center' },
  form: { marginBottom: 14 },
  formWordmark: { marginBottom: 4 },
  formLogoImage: { borderRadius: 8, height: 58, width: 58 },
  forgotPasswordButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 13,
    marginTop: -4,
    minHeight: 30,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '900',
  },
  label: { fontSize: 12, fontWeight: '800', color: '#353548', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9D8E8', borderRadius: 8, marginBottom: 13 },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 16, color: '#010110' },
  criticalInput: {
    backgroundColor: '#FFFBFB',
    borderColor: '#FCA5A5',
  },
  criticalLabel: {
    color: '#B91C1C',
  },
  eyeIcon: { paddingHorizontal: 12, paddingVertical: 12 },
  inputContainerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  inlineProgress: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
    width: 24,
  },
  inlineProgressFill: {
    borderRadius: 999,
    height: 10,
    width: 12,
  },
  labelError: {
    color: '#DC2626',
  },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, color: '#991B1B', fontSize: 13, lineHeight: 19, fontWeight: '700', marginLeft: 8 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  orLine: {
    backgroundColor: '#D9D8E8',
    flex: 1,
    height: 1,
  },
  orRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18,
  },
  orText: {
    color: '#737383',
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#A7A4CF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  checkboxActive: { backgroundColor: '#635BFF', borderColor: '#635BFF' },
  buttonProgressFill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 4,
    width: '56%',
  },
  buttonProgressTrack: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    height: 4,
    marginTop: 7,
    overflow: 'hidden',
    width: 132,
  },
  buttonProgressWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: { flexShrink: 1, fontSize: 13, color: '#353548', fontWeight: '700' },
  secureCacheRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
  },
  secureCacheText: {
    color: '#4B4B5F',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 7,
  },
  loginBtn: { minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#010110', paddingVertical: 14, borderRadius: 8 },
  loginBtnDisabled: { opacity: 0.66 },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  downloadAction: { marginTop: 12 },
  notificationPrompt: { marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E7E6F1' },
  footerText: { flexShrink: 1, fontSize: 12, color: '#353548', marginLeft: 6, fontWeight: '700', textAlign: 'center' },
  roleHelper: { color: '#4B4B5F', fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 10, textAlign: 'center' },
  roleIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  rolePanel: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 18, padding: 12 },
  rolePanelCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  rolePanelText: { fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 3 },
  rolePanelTitle: { color: '#010110', fontSize: 14, fontWeight: '900' },
  roleTab: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 42, paddingHorizontal: 7 },
  roleTabText: { fontSize: 12, fontWeight: '900', marginLeft: 6 },
  roleTabs: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  roleSelectionLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    minHeight: 34,
    paddingHorizontal: 8,
  },
  roleSelectionLinkText: {
    color: '#635BFF',
    fontSize: 12,
    fontWeight: '900',
  },
  resetCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 500,
    padding: 18,
    width: '100%',
  },
  resetCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  resetErrorBox: {
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 11,
  },
  resetErrorText: {
    color: '#991B1B',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  resetFootnote: {
    color: '#737383',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  resetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  resetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  resetIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  resetInput: {
    color: '#010110',
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  resetInputIcon: {
    paddingLeft: 12,
  },
  resetInputShell: {
    alignItems: 'center',
    backgroundColor: '#FFFBFB',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
  },
  resetKeyboard: {
    maxWidth: 540,
    width: '100%',
  },
  resetLabel: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  resetOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  resetPrimaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  resetPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  resetScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  resetSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  resetSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  resetStatusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resetStatusBody: {
    color: '#353548',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 14,
  },
  resetStatusDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 7,
    width: 8,
  },
  resetStatusPanel: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 2,
    padding: 14,
  },
  resetStatusText: {
    color: '#010110',
    fontSize: 12,
    fontWeight: '900',
  },
  resetSubtitle: {
    color: '#4B4B5F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  resetTextArea: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    flex: undefined,
    height: 86,
    marginBottom: 14,
    paddingTop: 12,
  },
  resetTitle: {
    color: '#010110',
    fontSize: 18,
    fontWeight: '900',
  },
  supportText: { color: '#737383', fontSize: 11, lineHeight: 16, marginTop: 10, textAlign: 'center' },
});

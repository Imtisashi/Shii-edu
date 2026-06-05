import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EASING, DURATION } from '../../utils/animations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import LoadingState, { SmoothSpinner } from '../../components/ui/LoadingState';
import { createInstituteAndAdmin } from '../../services/firebaseAdminService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const INSTITUTION_TYPES = Object.freeze({
  SCHOOL: {
    value: 'SCHOOL',
    title: 'School',
    subtitle: 'Academic years, standards, class sections',
    icon: 'school-outline',
  },
  COLLEGE: {
    value: 'COLLEGE',
    title: 'College',
    subtitle: 'Departments, semesters, credits, GPA',
    icon: 'library-outline',
  },
});

const initialForm = {
  instituteName: '',
  adminName: '',
  adminUserId: '',
  adminPassword: '',
  institutionType: 'SCHOOL',
};

const normalizeUserId = (value) => String(value || '').trim();

const validateForm = (form) => {
  const errors = {};
  const cleanAdminUserId = normalizeUserId(form.adminUserId);

  if (!form.instituteName.trim()) errors.instituteName = 'Institute name is required.';
  if (!form.adminName.trim()) errors.adminName = 'Administrator name is required.';
  if (!cleanAdminUserId) errors.adminUserId = 'Administrator User ID is required.';
  else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(cleanAdminUserId)) {
    errors.adminUserId = 'Use only letters, numbers, dots, underscores, or hyphens.';
  }
  if (!form.adminPassword) errors.adminPassword = 'A temporary password is required.';
  else if (form.adminPassword.length < 8) errors.adminPassword = 'Use at least 8 characters.';
  if (!INSTITUTION_TYPES[form.institutionType]) errors.institutionType = 'Choose School or College.';

  return errors;
};

const showToast = (message) => {
  if (Platform.OS === 'web') {
    window.alert(message);
    return;
  }

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

function InstitutionTypeToggle({ value, onChange, disabled }) {
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(value === 'COLLEGE' ? 1 : 0)).current;
  const indicatorWidth = width > 8 ? (width - 8) / 2 : 0;

  useEffect(() => {
    Animated.timing(position, {
      toValue: value === 'COLLEGE' ? 1 : 0,
      duration: DURATION.standard,
      easing: EASING.strongEaseOut,
      useNativeDriver: true,
    }).start();
  }, [position, value]);

  const select = (nextValue) => {
    if (disabled || nextValue === value) return;
    onChange(nextValue);
  };

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth],
  });

  return (
    <View
      style={styles.toggleShell}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {indicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toggleIndicator,
            { width: indicatorWidth, transform: [{ translateX }] },
            value === 'COLLEGE' && styles.toggleIndicatorCollege,
          ]}
        />
      ) : null}

      {Object.values(INSTITUTION_TYPES).map((option) => {
        const selected = value === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            style={styles.toggleOption}
            activeOpacity={0.78}
            onPress={() => select(option.value)}
            disabled={disabled}
          >
            <Ionicons
              name={option.icon}
              size={20}
              color={selected ? '#FFFFFF' : '#94A3B8'}
            />
            <Text style={[styles.toggleTitle, selected && styles.toggleTitleSelected]}>{option.title}</Text>
            <Text style={[styles.toggleSubtitle, selected && styles.toggleSubtitleSelected]} numberOfLines={2}>
              {option.subtitle}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SuperadminMasterDashboard() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { currentUser, logout } = useAuth();
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createdInstitute, setCreatedInstitute] = useState(null);
  const [copied, setCopied] = useState(false);
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introY = useRef(new Animated.Value(18)).current;
  const copyResetTimer = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: DURATION.deliberate,
        easing: EASING.strongEaseOut,
        useNativeDriver: true,
      }),
      Animated.timing(introY, {
        toValue: 0,
        duration: DURATION.quick,
        easing: EASING.strongEaseOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [introOpacity, introY]);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  const loadInstitutes = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'institutes'));
      const rows = snapshot.docs.map((document) => {
        const data = document.data();
        const institutionType = String(data.institutionType || data.type || 'SCHOOL').toUpperCase();

        return {
          id: document.id,
          ...data,
          instituteId: data.instituteId || document.id,
          institutionType: institutionType === 'COLLEGE' ? 'COLLEGE' : 'SCHOOL',
        };
      });

      rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInstitutes(rows);
    } catch (error) {
      setServerError(error.message || 'Failed to load institutes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInstitutes();
  }, [loadInstitutes]);

  const stats = useMemo(() => {
    const schoolCount = institutes.filter((item) => item.institutionType === 'SCHOOL').length;
    const collegeCount = institutes.filter((item) => item.institutionType === 'COLLEGE').length;

    return {
      total: institutes.length,
      schoolCount,
      collegeCount,
    };
  }, [institutes]);

  const errors = useMemo(() => validateForm(form), [form]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (serverError) setServerError('');
    if (successMessage) setSuccessMessage('');
  };

  const copyInstituteId = async () => {
    if (!createdInstitute?.instituteId) return;

    await Clipboard.setStringAsync(createdInstitute.instituteId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);

    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopied(false), 2200);
  };

  const submit = async () => {
    const allTouched = {
      instituteName: true,
      adminName: true,
      adminUserId: true,
      adminPassword: true,
      institutionType: true,
    };
    setTouched(allTouched);

    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0 || submitting) return;

    setSubmitting(true);
    setServerError('');
    setSuccessMessage('');

    try {
      const result = await createInstituteAndAdmin({
        instituteName: form.instituteName.trim(),
        adminName: form.adminName.trim(),
        adminUserId: normalizeUserId(form.adminUserId),
        adminPassword: form.adminPassword,
        institutionType: form.institutionType,
      }, currentUser);

      if (!result.success) {
        setServerError(result.error || 'Failed to create institute.');
        return;
      }

      const createdType = result.institute?.institutionType || form.institutionType;
      const handoff = {
        adminUserId: result.institute?.adminUserId || normalizeUserId(form.adminUserId),
        instituteId: result.instituteId || result.institute?.instituteId,
        institutionType: createdType,
        name: result.institute?.name || form.instituteName.trim(),
      };
      setCreatedInstitute(handoff);
      setCopied(false);
      setSuccessMessage(`${handoff.name} created as ${createdType}.`);
      setForm(initialForm);
      setTouched({});
      setShowPassword(false);
      await loadInstitutes({ showLoader: false });
      showToast('Institute created successfully.');
    } catch (error) {
      setServerError(error.message || 'Failed to create institute.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderError = (field) => (
    touched[field] && errors[field] ? <Text style={styles.fieldError}>{errors[field]}</Text> : null
  );

  const renderInstitute = ({ item }) => {
    const isCollege = item.institutionType === 'COLLEGE';

    return (
      <View style={styles.instituteCard}>
        <View style={[styles.instituteIcon, isCollege && styles.instituteIconCollege]}>
          <Ionicons name={isCollege ? 'library' : 'school'} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.instituteCopy}>
          <Text style={styles.instituteName} numberOfLines={1}>{item.name || 'Unnamed Institute'}</Text>
          <Text style={styles.instituteMeta} numberOfLines={1}>ID: {item.instituteId}</Text>
          <Text style={styles.instituteMode}>{item.institutionType}</Text>
        </View>
      </View>
    );
  };

  const header = (
    <Animated.View
      style={[
        styles.headerStack,
        { opacity: introOpacity, transform: [{ translateY: introY }] },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.eyebrow}>Shii-Edu / Superadmin</Text>
          <Text style={[styles.heroTitle, layout.isMobile && styles.heroTitleMobile]}>
            Platform Master Dashboard
          </Text>
          <Text style={styles.heroSubtitle}>
            Create and govern institute systems without forcing the superadmin account into School or College mode.
          </Text>

          <View style={styles.statRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Institutes</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{stats.schoolCount}</Text>
              <Text style={styles.statLabel}>Schools</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{stats.collegeCount}</Text>
              <Text style={styles.statLabel}>Colleges</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <View style={styles.formHeaderCopy}>
            <Text style={styles.formTitle}>Create Institute</Text>
            <Text style={styles.formSubtitle}>Select the operating model before Firestore writes the institute schema.</Text>
          </View>
          <View style={styles.formBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#A7F3D0" />
            <Text style={styles.formBadgeText}>Strict schema</Text>
          </View>
        </View>

        <Text style={styles.label}>Institution Type</Text>
        <InstitutionTypeToggle
          value={form.institutionType}
          onChange={(value) => setField('institutionType', value)}
          disabled={submitting}
        />
        {renderError('institutionType')}

        <View style={styles.inputGrid}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Institute Name</Text>
            <View style={[styles.inputShell, touched.instituteName && errors.instituteName && styles.inputShellError]}>
              <Ionicons name="business-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder={form.institutionType === 'SCHOOL' ? 'e.g. Shii Public School' : 'e.g. Shii Institute of Technology'}
                placeholderTextColor="#64748B"
                value={form.instituteName}
                onChangeText={(value) => setField('instituteName', value)}
                onBlur={() => setTouched((current) => ({ ...current, instituteName: true }))}
                editable={!submitting}
                autoCapitalize="words"
              />
            </View>
            {renderError('instituteName')}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Admin Full Name</Text>
            <View style={[styles.inputShell, touched.adminName && errors.adminName && styles.inputShellError]}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="Institute administrator"
                placeholderTextColor="#64748B"
                value={form.adminName}
                onChangeText={(value) => setField('adminName', value)}
                onBlur={() => setTouched((current) => ({ ...current, adminName: true }))}
                editable={!submitting}
                autoCapitalize="words"
              />
            </View>
            {renderError('adminName')}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Admin User ID</Text>
            <View style={[styles.inputShell, touched.adminUserId && errors.adminUserId && styles.inputShellError]}>
              <Ionicons name="id-card-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="e.g. ADMIN-001"
                placeholderTextColor="#64748B"
                value={form.adminUserId}
                onChangeText={(value) => setField('adminUserId', value)}
                onBlur={() => setTouched((current) => ({ ...current, adminUserId: true }))}
                editable={!submitting}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {renderError('adminUserId')}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Temporary Password</Text>
            <View style={[styles.inputShell, touched.adminPassword && errors.adminPassword && styles.inputShellError]}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#64748B"
                value={form.adminPassword}
                onChangeText={(value) => setField('adminPassword', value)}
                onBlur={() => setTouched((current) => ({ ...current, adminPassword: true }))}
                editable={!submitting}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((current) => !current)}
                disabled={submitting}
                accessibilityLabel="Toggle password visibility"
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            {renderError('adminPassword')}
          </View>
        </View>

        {serverError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
            <Text style={styles.errorText}>{serverError}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#A7F3D0" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {createdInstitute?.instituteId ? (
          <View style={styles.handoffCard}>
            <View style={styles.handoffHeader}>
              <View style={styles.handoffIcon}>
                <Ionicons name="key-outline" size={20} color="#67E8F9" />
              </View>
              <View style={styles.handoffHeaderCopy}>
                <Text style={styles.handoffEyebrow}>Client Handoff</Text>
                <Text style={styles.handoffTitle}>Official Institute ID</Text>
              </View>
            </View>

            <Text selectable style={styles.instituteIdValue}>{createdInstitute.instituteId}</Text>
            <Text style={styles.handoffHelp}>
              Share this Institute ID with the client. Their users must enter it with their assigned User ID when signing in.
            </Text>

            <View style={styles.handoffMetaRow}>
              <View style={styles.handoffMetaPill}>
                <Text style={styles.handoffMetaLabel}>Mode</Text>
                <Text style={styles.handoffMetaValue}>{createdInstitute.institutionType}</Text>
              </View>
              <View style={styles.handoffMetaPill}>
                <Text style={styles.handoffMetaLabel}>Admin User ID</Text>
                <Text selectable style={styles.handoffMetaValue}>{createdInstitute.adminUserId}</Text>
              </View>
            </View>

            <TouchableOpacity
              accessibilityLabel="Copy Institute ID"
              activeOpacity={0.82}
              onPress={copyInstituteId}
              style={[styles.copyButton, copied && styles.copyButtonCopied]}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy Institute ID'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.84}
        >
          {submitting ? (
            <SmoothSpinner color="#FFFFFF" size={22} />
          ) : (
            <>
              <Ionicons name="sparkles" size={19} color="#FFFFFF" />
              <Text style={styles.submitText}>Create {form.institutionType === 'SCHOOL' ? 'School' : 'College'} Institute</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Institute Registry</Text>
          <Text style={styles.sectionSubtitle}>Live Firestore institutes with enforced operating modes.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('ManageInstitutes')}
          >
            <Text style={styles.secondaryButtonText}>Manage</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => {
              logout();
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#FCA5A5" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={institutes}
        keyExtractor={(item) => item.id}
        renderItem={renderInstitute}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="planet-outline" size={46} color="#38BDF8" />
            <Text style={styles.emptyTitle}>No institutes yet</Text>
            <Text style={styles.emptyText}>Create a School or College above to initialize the first institute schema.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInstitutes({ showLoader: false });
            }}
            tintColor="#38BDF8"
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Math.max(insets.top, 12) + 10,
            paddingBottom: Math.max(insets.bottom, 20) + 40,
            paddingHorizontal: layout.horizontalPadding,
          },
          layout.isDesktop && styles.listContentDesktop,
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050816',
  },
  listContent: {
    flexGrow: 1,
  },
  listContentDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1180,
  },
  headerStack: {
    width: '100%',
  },
  hero: {
    backgroundColor: '#0B1026',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 24,
  },
  heroContent: {
    position: 'relative',
  },
  eyebrow: {
    color: '#67E8F9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 10,
  },
  heroTitleMobile: {
    fontSize: 29,
    lineHeight: 34,
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 680,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },
  statPill: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 112,
    padding: 14,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  formCard: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  formHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  formHeaderCopy: {
    flex: 1,
    flexBasis: 240,
    minWidth: 0,
  },
  formTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
  },
  formSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 620,
  },
  formBadge: {
    alignItems: 'center',
    backgroundColor: '#052E2B',
    borderColor: '#047857',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formBadgeText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  label: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  toggleShell: {
    backgroundColor: '#020617',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    minHeight: 104,
    overflow: 'hidden',
    padding: 4,
  },
  toggleIndicator: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    bottom: 4,
    left: 4,
    position: 'absolute',
    top: 4,
  },
  toggleIndicatorCollege: {
    backgroundColor: '#7C3AED',
  },
  toggleOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  toggleTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  toggleTitleSelected: {
    color: '#FFFFFF',
  },
  toggleSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 3,
    textAlign: 'center',
  },
  toggleSubtitleSelected: {
    color: '#DBEAFE',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  inputGroup: {
    flexBasis: 260,
    flexGrow: 1,
    minWidth: 0,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#020617',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  inputShellError: {
    borderColor: '#F87171',
  },
  input: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 0,
    outlineStyle: 'none',
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 8,
  },
  fieldError: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    padding: 12,
  },
  errorText: {
    color: '#FECACA',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 8,
  },
  successBox: {
    alignItems: 'center',
    backgroundColor: '#052E2B',
    borderColor: '#047857',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    padding: 12,
  },
  successText: {
    color: '#D1FAE5',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 8,
  },
  handoffCard: {
    backgroundColor: '#082F49',
    borderColor: '#075985',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  handoffHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  handoffIcon: {
    alignItems: 'center',
    backgroundColor: '#082F49',
    borderColor: '#075985',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  handoffHeaderCopy: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  handoffEyebrow: {
    color: '#67E8F9',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  handoffTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  instituteIdValue: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 16,
  },
  handoffHelp: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
  },
  handoffMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  handoffMetaPill: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 132,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  handoffMetaLabel: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  handoffMetaValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },
  copyButton: {
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  copyButtonCopied: {
    backgroundColor: '#059669',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
    textAlign: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '900',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  instituteCard: {
    alignItems: 'center',
    backgroundColor: '#0B1026',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
  },
  instituteIcon: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  instituteIconCollege: {
    backgroundColor: '#7C3AED',
  },
  instituteCopy: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  instituteName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  instituteMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  instituteMode: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 5,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#0B1026',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    padding: 28,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});

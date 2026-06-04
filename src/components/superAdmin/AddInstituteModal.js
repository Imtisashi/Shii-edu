import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { createInstituteAndAdmin } from '../../services/firebaseAdminService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { SmoothSpinner } from '../ui/LoadingState';

const initialForm = {
  instituteName: '',
  adminName: '',
  adminUserId: '',
  adminPassword: '',
};

const validateForm = ({ instituteName, adminName, adminUserId, adminPassword }) => {
  const errors = {};
  const cleanedAdminUserId = adminUserId.trim();

  if (!instituteName.trim()) errors.instituteName = 'Institute name is required.';
  if (!adminName.trim()) errors.adminName = 'Admin name is required.';
  if (!cleanedAdminUserId) errors.adminUserId = 'Admin User ID is required.';
  else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(cleanedAdminUserId)) {
    errors.adminUserId = 'Use only letters, numbers, dots, underscores, or hyphens.';
  }
  if (!adminPassword) errors.adminPassword = 'Admin password is required.';
  else if (adminPassword.length < 8) errors.adminPassword = 'Use at least 8 characters.';

  return errors;
};

const getCreateInstituteError = (result) => {
  if (result?.code === 'FIREBASE_ADMIN_CONFIG_MISSING') {
    return 'Firebase Admin is not configured on Vercel yet. Add FIREBASE_SERVICE_ACCOUNT_JSON, redeploy, and this button will create institutes normally.';
  }

  if (result?.code?.startsWith('FIREBASE_ADMIN_CONFIG_')) {
    return 'Firebase Admin credentials on Vercel are incomplete or malformed. Recheck the service account JSON and redeploy.';
  }

  return result?.error || 'Failed to create institute.';
};

export default function AddInstituteModal({ visible, currentUser, onClose, onCreated }) {
  const layout = useResponsiveLayout();
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const errors = useMemo(() => validateForm(form), [form]);
  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (serverError) setServerError('');
  };

  const closeSheet = () => {
    if (submitting) return;
    setForm(initialForm);
    setTouched({});
    setServerError('');
    setShowPassword(false);
    onClose?.();
  };

  const submit = async () => {
    const nextTouched = {
      instituteName: true,
      adminName: true,
      adminUserId: true,
      adminPassword: true,
    };
    setTouched(nextTouched);

    if (!canSubmit) return;

    setSubmitting(true);
    setServerError('');
    try {
      const result = await createInstituteAndAdmin({
        instituteName: form.instituteName.trim(),
        adminUserId: form.adminUserId.trim(),
        adminPassword: form.adminPassword,
        adminName: form.adminName.trim(),
      }, currentUser);

      if (!result.success) {
        setServerError(getCreateInstituteError(result));
        return;
      }

      setForm(initialForm);
      setTouched({});
      setShowPassword(false);
      onCreated?.(result);
      onClose?.();
    } catch (error) {
      setServerError(error.message || 'Failed to create institute.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderError = (field) => (
    touched[field] && errors[field] ? <Text style={styles.fieldError}>{errors[field]}</Text> : null
  );

  const sheet = (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeSheet} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            layout.isMobile && styles.scrollContentMobile,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, layout.isMobile && styles.cardMobile]}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.modalIcon}>
                <Ionicons name="school" size={27} color="#2563EB" />
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeSheet}
                disabled={submitting}
                accessibilityLabel="Close add institute form"
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Add New Institute</Text>
            <Text style={styles.subtitle}>Create the campus profile and its first administrator in one safe step.</Text>

            {serverError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{serverError}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Institute Name</Text>
              <View style={[styles.inputContainer, touched.instituteName && errors.instituteName && styles.inputError]}>
                <Ionicons name="business-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Shii Public School"
                  placeholderTextColor="#94A3B8"
                  value={form.instituteName}
                  onChangeText={(value) => setField('instituteName', value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, instituteName: true }))}
                  autoCapitalize="words"
                  returnKeyType="next"
                  editable={!submitting}
                />
              </View>
              {renderError('instituteName')}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Full Name</Text>
              <View style={[styles.inputContainer, touched.adminName && errors.adminName && styles.inputError]}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Campus owner name"
                  placeholderTextColor="#94A3B8"
                  value={form.adminName}
                  onChangeText={(value) => setField('adminName', value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, adminName: true }))}
                  autoCapitalize="words"
                  returnKeyType="next"
                  editable={!submitting}
                />
              </View>
              {renderError('adminName')}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin User ID</Text>
              <View style={[styles.inputContainer, touched.adminUserId && errors.adminUserId && styles.inputError]}>
                <Ionicons name="id-card-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ADMIN-001"
                  placeholderTextColor="#94A3B8"
                  value={form.adminUserId}
                  onChangeText={(value) => setField('adminUserId', value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, adminUserId: true }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!submitting}
                />
              </View>
              {renderError('adminUserId')}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Password</Text>
              <View style={[styles.inputContainer, touched.adminPassword && errors.adminPassword && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="#94A3B8"
                  value={form.adminPassword}
                  onChangeText={(value) => setField('adminPassword', value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, adminPassword: true }))}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  editable={!submitting}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((value) => !value)}
                  disabled={submitting}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              {renderError('adminPassword')}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (!canSubmit || submitting) && styles.disabledButton]}
              onPress={submit}
              disabled={submitting}
              accessibilityLabel="Create institute"
            >
              {submitting ? (
                <View style={styles.submitLoading}>
                  <SmoothSpinner size={18} stroke={3} color="#FFFFFF" trackColor="#CBD5E1" />
                  <Text style={styles.submitText}>Creating...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitText}>Create Institute</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={closeSheet} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );

  if (!visible) return null;

  if (Platform.OS === 'web') return sheet;

  return (
    <Modal animationType={layout.isMobile ? 'slide' : 'fade'} transparent visible={visible} onRequestClose={closeSheet}>
      {sheet}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  keyboardRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContentMobile: {
    justifyContent: 'flex-end',
    padding: 0,
    paddingTop: 28,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
  },
  cardMobile: {
    maxWidth: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    paddingBottom: 22,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 8,
    backgroundColor: '#CBD5E1',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 18,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: '#991B1B',
    fontWeight: '700',
    lineHeight: 19,
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  inputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  icon: {
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#0F172A',
    fontSize: 15,
    paddingVertical: 15,
    paddingRight: 12,
    outlineStyle: 'none',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.62,
  },
  submitLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '900',
  },
});

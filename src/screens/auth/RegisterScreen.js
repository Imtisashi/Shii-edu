import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen({ navigation, route }) {
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {invitationError ? (
          <View style={styles.invalidInviteCard}>
            <Ionicons name="alert-circle-outline" size={34} color="#EF4444" />
            <Text style={styles.invalidInviteTitle}>Invite Required</Text>
            <Text style={styles.invalidInviteText}>{invitationError}</Text>
            <TouchableOpacity style={styles.btn} onPress={navigateToLogin}>
              <Text style={styles.btnText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
        {instituteData && (
          <View style={styles.instituteHeader}>
            <Text style={styles.instituteName}>{instituteData.name}</Text>
            <Text style={styles.instituteRole}>
              Registering as: {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>
          </View>
        )}

        <Text style={styles.title}>Create Your Account</Text>

        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Email Input (read-only if invited) */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.icon} />
          <TextInput
            style={[styles.input, inviteEmail && styles.inputReadOnly]}
            placeholder="Email Address"
            value={email}
            onChangeText={inviteEmail ? undefined : setEmail} // Only allow edit if not invited
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        {/* Password Inputs */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />
        </View>

        {/* Role and Unique ID (read-only display) */}
        {instituteData && (
          <View style={styles.readOnlySection}>
            <Text style={styles.readOnlyLabel}>Your Role:</Text>
            <Text style={styles.readOnlyValue}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>
          </View>
        )}

        {uniqueId && role !== 'instituteAdmin' && instituteData && (
          <View style={styles.readOnlySection}>
            <Text style={styles.readOnlyLabel}>Your ID:</Text>
            <Text style={styles.readOnlyValue}>
              {uniqueId}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !instituteData || loading && { backgroundColor: '#A0AEC0' }]}
          onPress={handleRegister}
          disabled={!instituteData || loading}
        >
          {loading ? <SmoothSpinner color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <View style={styles.optionsRow}>
          <TouchableOpacity onPress={navigateToLogin} disabled={loading}>
            <Text style={styles.backLink}>{"< Back to Login"}</Text>
          </TouchableOpacity>
        </View>
          </>
        )}
      </ScrollView>

      {/* Success Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showSuccessModal}
        onRequestClose={handleSuccessModalClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#10B981" />
              <Text style={styles.modalTitle}>Account Created</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>
                Your account has been created successfully! You can now log in.
              </Text>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={handleSuccessModalClose}
              >
                <Text style={styles.modalBtnText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 25, justifyContent: 'flex-start', backgroundColor: '#fff' },
  invalidInviteCard: { marginTop: 80, padding: 24, borderRadius: 24, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center' },
  invalidInviteTitle: { fontSize: 22, fontWeight: 'bold', color: '#991B1B', marginTop: 12 },
  invalidInviteText: { fontSize: 15, color: '#7F1D1D', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  instituteHeader: { marginBottom: 20, padding: 15, backgroundColor: '#F0F9FF', borderRadius: 12 },
  instituteName: { fontSize: 20, fontWeight: 'bold', color: '#1E40AF', textAlign: 'center' },
  instituteRole: { fontSize: 16, color: '#3B82F6', textAlign: 'center', marginTop: 5 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, marginBottom: 12 },
  icon: { paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#1E293B', outlineStyle: 'none' },
  inputReadOnly: { backgroundColor: '#F1F5F9', color: '#64748B' },
  btn: { backgroundColor: '#8B5CF6', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25 },
  backLink: { color: '#64748B', fontWeight: '500' },
  readOnlySection: { marginVertical: 10, padding: 12, backgroundColor: '#F0F9FF', borderRadius: 10 },
  readOnlyLabel: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  readOnlyValue: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '85%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10 },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  modalMessage: { fontSize: 16, color: '#64748B', textAlign: 'center', marginVertical: 20 },
  modalBtn: { backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  modalBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});

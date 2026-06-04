import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import EditableProfileAvatar from '../../components/profile/EditableProfileAvatar';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { updateSupabaseOwnProfile } from '../../services/supabaseTenantDataService';

export default function TeacherProfileSettings({ navigation }) {
  const { currentUser, userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const returnToTeacherHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('TeacherHome');
  };
  
  const [name, setName] = useState(userData?.name || '');
  const [degree, setDegree] = useState(userData?.degree || '');
  const [experience, setExperience] = useState(userData?.experience || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileUpdate = {
        name: name.trim(),
        degree: degree.trim(),
        experience: experience.trim(),
      };

      await Promise.all([
        updateSupabaseOwnProfile(currentUser, profileUpdate),
        updateDoc(doc(db, "users", userData.uid), profileUpdate),
      ]);
      
      const msg = "Profile updated successfully!";
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert("Success", msg);
      }
      returnToTeacherHome();
    } catch (_error) {
      const err = "Failed to update profile.";
      if (Platform.OS === 'web') {
        window.alert(err);
      } else {
        Alert.alert("Error", err);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DynamicHeader title="Edit Profile" showBack={true} />
      
      <View style={styles.formContainer}>
        <View style={styles.avatarCage}>
          <EditableProfileAvatar size={104} />
          <Text style={styles.hint}>Tap your avatar to update your Supabase profile image.</Text>
        </View>

        <Text style={styles.label}>Full Name</Text>
        <TextInput 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          placeholder="e.g. Prof. Alan Turing" 
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Highest Qualification / Degree</Text>
        <TextInput 
          style={styles.input} 
          value={degree} 
          onChangeText={setDegree} 
          placeholder="e.g. Ph.D. in Computer Science" 
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Years of Experience</Text>
        <TextInput 
          style={styles.input} 
          value={experience} 
          onChangeText={setExperience} 
          placeholder="e.g. 12" 
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <SmoothSpinner color="#fff" /> : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  formContainer: { padding: 20 },
  avatarCage: { alignItems: 'center', marginBottom: 30 },
  hint: { fontSize: 12, color: '#B9C6DD', marginTop: 12, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#B9C6DD', marginBottom: 8 },
  input: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 20, color: '#F8FAFC', outlineStyle: 'none' },
  saveBtn: { backgroundColor: '#8E24AA', borderColor: '#334155', borderWidth: 1, padding: 18, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10},
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginLeft: 8 }
});

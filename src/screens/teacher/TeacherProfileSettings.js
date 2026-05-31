import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';

export default function TeacherProfileSettings({ navigation }) {
  const { userData } = useAuth();
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
      await updateDoc(doc(db, "users", userData.uid), {
        name: name.trim(),
        degree: degree.trim(),
        experience: experience.trim(),
      });
      
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
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{name ? name.charAt(0).toUpperCase() : 'T'}</Text>
          </View>
          <Text style={styles.hint}>Avatar changes via Cloudinary coming soon.</Text>
        </View>

        <Text style={styles.label}>Full Name</Text>
        <TextInput 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          placeholder="e.g. Prof. Alan Turing" 
        />

        <Text style={styles.label}>Highest Qualification / Degree</Text>
        <TextInput 
          style={styles.input} 
          value={degree} 
          onChangeText={setDegree} 
          placeholder="e.g. Ph.D. in Computer Science" 
        />

        <Text style={styles.label}>Years of Experience</Text>
        <TextInput 
          style={styles.input} 
          value={experience} 
          onChangeText={setExperience} 
          placeholder="e.g. 12" 
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  formContainer: { padding: 20 },
  avatarCage: { alignItems: 'center', marginBottom: 30 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E1BEE7', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#8E24AA' },
  avatarInitials: { fontSize: 40, fontWeight: 'bold', color: '#8E24AA' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 10, fontStyle: 'italic' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20, color: '#1E293B' },
  saveBtn: { backgroundColor: '#8E24AA', padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 3 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginLeft: 8 }
});

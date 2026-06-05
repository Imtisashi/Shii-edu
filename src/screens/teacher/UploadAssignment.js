import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { createSupabaseAssignment } from '../../services/supabaseTenantDataService';

export default function UploadAssignment() {
  const { currentUser, userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const [course, setCourse] = useState('');
  const [question, setQuestion] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!currentUser?.uid || !userData?.instituteId) {
      if (Platform.OS === 'web') {
        window.alert("Your profile is not linked to an institute.");
      } else {
        Alert.alert('Missing Institute', 'Your profile is not linked to an institute.');
      }
      return;
    }

    if (!course.trim() || !question.trim()) {
      if (Platform.OS === 'web') {
        window.alert("Fill all fields");
      } else {
        Alert.alert('Incomplete', 'Please fill in the course and instructions.');
      }
      return;
    }

    setUploading(true);
    try {
      const assignmentRef = doc(collection(db, "assignments"));
      const assignmentPayload = {
        description: question.trim(),
        dueDate: dueDate.trim() || 'TBD',
        id: assignmentRef.id,
        instituteId: userData.instituteId,
        legacyFirestoreId: assignmentRef.id,
        subject: course.trim(),
        teacherId: userData.uid,
        teacherName: userData.name,
        title: course.trim(),
      };

      let saved = false;
      let lastError = null;

      try {
        await createSupabaseAssignment(currentUser, assignmentPayload);
        saved = true;
      } catch (supabaseError) {
        lastError = supabaseError;
        console.warn('Supabase assignment post failed, using Firestore fallback:', supabaseError);
      }

      try {
        await setDoc(assignmentRef, {
          ...assignmentPayload,
          createdAt: serverTimestamp(),
          dataSource: saved ? 'supabase+firebase' : 'firebase',
        });
        saved = true;
      } catch (firebaseError) {
        lastError = firebaseError;
        console.warn('Firestore assignment mirror failed:', firebaseError);
      }

      if (!saved) throw lastError || new Error('Assignment upload failed.');
      
      if (Platform.OS === 'web') {
        window.alert("Assignment Posted!");
      } else {
        Alert.alert('Success', 'Assignment posted successfully!');
      }
      setCourse(''); setQuestion(''); setDueDate('');
    } catch (_error) {
      if (Platform.OS === 'web') {
        window.alert("Failed to upload");
      } else {
        Alert.alert('Error', 'Could not post assignment.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <DynamicHeader title="Post Assignment" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Course / Subject Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Physics 101" placeholderTextColor={colors.muted} value={course} onChangeText={setCourse} />

          <Text style={styles.label}>Due Date (Optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. Next Friday" placeholderTextColor={colors.muted} value={dueDate} onChangeText={setDueDate} />

          <Text style={styles.label}>Instructions</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Write the assignment details..." placeholderTextColor={colors.muted} value={question} onChangeText={setQuestion} multiline numberOfLines={5} textAlignVertical="top" />
        </View>

        <TouchableOpacity
          accessibilityLabel="Post assignment"
          accessibilityRole="button"
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? <SmoothSpinner color="#FFFFFF" /> : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Post Assignment</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 16, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '800', color: '#B9C6DD', marginBottom: 8 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, fontSize: 16, color: '#F8FAFC', marginBottom: 16, outlineStyle: 'none' },
  textArea: { minHeight: 120 },
  submitBtn: { flexDirection: 'row', backgroundColor: '#8E24AA', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingVertical: 16, justifyContent: 'center', alignItems: 'center'},
  submitBtnDisabled: { opacity: 0.72 },
  submitBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});

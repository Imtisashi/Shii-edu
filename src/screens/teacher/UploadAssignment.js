import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';

export default function UploadAssignment() {
  const { userData } = useAuth();
  const [course, setCourse] = useState('');
  const [question, setQuestion] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!course || !question) {
      if (Platform.OS === 'web') {
        window.alert("Fill all fields");
      } else {
        Alert.alert('Incomplete', 'Please fill in the course and instructions.');
      }
      return;
    }

    setUploading(true);
    try {
      await addDoc(collection(db, "assignments"), {
        title: course.trim(),
        subject: course.trim(),
        description: question.trim(),
        dueDate: dueDate.trim() || 'TBD',
        instituteId: userData.instituteId,
        teacherId: userData.uid,
        teacherName: userData.name,
        createdAt: serverTimestamp(),
      });
      
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.label}>Course / Subject Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Physics 101" value={course} onChangeText={setCourse} />

          <Text style={styles.label}>Due Date (Optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. Next Friday" value={dueDate} onChangeText={setDueDate} />

          <Text style={styles.label}>Instructions</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Write the assignment details..." value={question} onChangeText={setQuestion} multiline numberOfLines={5} textAlignVertical="top" />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleUpload} disabled={uploading}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#4A5568', marginBottom: 8 },
  input: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 16, color: '#2D3748', marginBottom: 16 },
  textArea: { minHeight: 120 },
  submitBtn: { flexDirection: 'row', backgroundColor: '#8E24AA', borderRadius: 12, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  submitBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});

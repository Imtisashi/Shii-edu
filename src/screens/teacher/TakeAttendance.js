import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { createUnifiedNotification } from '../../services/unifiedNotificationService';

const resolveStudentUid = (student) => student.uid || student.authUid || student.id;

export default function TakeAttendance({ navigation }) {
  const { userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');

  const instType = userData?.instituteData?.type || 'school';
  const returnToTeacherHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('TeacherHome');
  };

  useEffect(() => {
    const fetchStudents = async () => {
      if (!userData?.instituteId) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "users"),
          where("instituteId", "==", userData.instituteId),
          where("role", "==", "student")
        );
        const snap = await getDocs(q);
        const list = [];
        const status = {};
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
          status[doc.id] = true;
        });
        setStudents(list);
        setAttendance(status);
        setLoading(false);
      } catch (_err) {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [userData?.instituteId]);

  const submitAttendance = async () => {
    if (instType === 'college' && !selectedSubject) {
      return Alert.alert("Required", "Please select a subject.");
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      students.forEach((student) => {
        const isPresent = Boolean(attendance[student.id]);
        const studentUid = resolveStudentUid(student);
        batch.set(doc(collection(db, "attendance")), {
          date: new Date().toISOString().split('T')[0],
          timestamp: serverTimestamp(),
          teacherId: userData.uid,
          teacherName: userData.name || '',
          studentId: studentUid,
          studentUid,
          studentDocId: student.id,
          studentUniqueId: student.uniqueId || null,
          studentEmail: student.email || '',
          studentName: student.name || '',
          instituteId: userData.instituteId,
          status: isPresent ? 'present' : 'absent',
          isPresent,
          type: instType,
          subject: selectedSubject || 'General'
        });
      });
      await batch.commit();
      // Create notification for students
      try {
        await createUnifiedNotification({
          title: "Attendance Updated",
          message: `Attendance for ${new Date().toLocaleDateString()} has been marked.`,
          type: "info",
          targetRoles: ["student"],
          instituteId: userData.instituteId,
          author: {
            name: userData.name || "Teacher",
            role: userData.role || "teacher"
          },
          relatedId: new Date().toISOString().split('T')[0],
          relatedType: "attendance"
        });
      } catch (notificationError) {
        console.warn("Failed to send attendance notification:", notificationError);
      }
      Alert.alert("Success", "Attendance recorded.");
      returnToTeacherHome();
    } catch (_err) {
      Alert.alert("Error", "Failed to save.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <SmoothSpinner style={{marginTop: 50}} />;

  return (
    <View style={styles.container}>
      {instType === 'college' && (
        <View style={styles.collegeHeader}>
          <Text style={styles.label}>Select Subject:</Text>
          <View style={styles.subjectRow}>
            {['Painting', 'Sculpture', 'History'].map(sub => (
              <TouchableOpacity 
                key={sub} 
                style={[styles.chip, selectedSubject === sub && styles.activeChip]}
                onPress={() => setSelectedSubject(sub)}
              >
                <Text style={selectedSubject === sub ? {color: '#fff'} : {}}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, !attendance[item.id] && styles.absent]} 
            onPress={() => setAttendance({...attendance, [item.id]: !attendance[item.id]})}
          >
            <Text>{item.name}</Text>
            <Ionicons name={attendance[item.id] ? "checkmark-circle" : "close-circle"} size={24} color={attendance[item.id] ? "green" : "red"} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.submitBtn} onPress={submitAttendance} disabled={isSubmitting}>
        <Text style={styles.submitText}>{isSubmitting ? "Saving..." : "Submit Attendance"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 15 },
  collegeHeader: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15 },
  label: { fontWeight: 'bold', marginBottom: 10 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, marginRight: 10, marginBottom: 10 },
  activeChip: { backgroundColor: '#8E24AA', borderColor: '#8E24AA' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  absent: { backgroundColor: '#FFEBEE' },
  submitBtn: { backgroundColor: '#8E24AA', padding: 18, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: 'bold' }
});

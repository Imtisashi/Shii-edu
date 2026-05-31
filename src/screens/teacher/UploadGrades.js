import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  FlatList, ActivityIndicator, Alert, ScrollView 
} from 'react-native';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';

export default function UploadGrades({ navigation }) {
  const { userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Grade Form State
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState(''); // e.g., Mid-Term, Final, Unit Test
  const [marks, setMarks] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const instType = userData?.instituteData?.type || 'school';

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("instituteId", "==", userData.instituteId),
          where("role", "==", "student")
        );
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setStudents(list);
        setLoading(false);
      } catch (_err) {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [userData.instituteId]);

  const handleUpload = async () => {
    if (!selectedStudent || !subject || !marks || !totalMarks) {
      return Alert.alert("Error", "Please complete all fields.");
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "grades"), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        teacherId: userData.uid,
        teacherName: userData.name,
        instituteId: userData.instituteId,
        subject: subject.trim(),
        examType: examType.trim() || 'General Assessment',
        marks: parseFloat(marks),
        totalMarks: parseFloat(totalMarks),
        percentage: (parseFloat(marks) / parseFloat(totalMarks)) * 100,
        type: instType,
        timestamp: serverTimestamp(),
      });

      Alert.alert("Success", `Grades uploaded for ${selectedStudent.name}`);
      navigation.goBack();
    } catch (_err) {
      Alert.alert("Error", "Failed to upload grades.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} color="#8E24AA" />;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>1. Select Student:</Text>
      <View style={styles.listContainer}>
        <FlatList
          data={students}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.studentChip, selectedStudent?.id === item.id && styles.activeChip]}
              onPress={() => setSelectedStudent(item)}
            >
              <Text style={[styles.chipText, selectedStudent?.id === item.id && styles.activeText]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <ScrollView style={styles.form}>
        <Text style={styles.label}>2. Exam Details:</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder={instType === 'college' ? "Subject (e.g. Art History)" : "Subject (e.g. Mathematics)"}
          value={subject}
          onChangeText={setSubject}
        />
        
        <TextInput 
          style={styles.input} 
          placeholder="Exam Type (e.g. Unit Test 1)"
          value={examType}
          onChangeText={setExamType}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.miniLabel}>Marks Obtained</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 85" 
              keyboardType="numeric"
              value={marks}
              onChangeText={setMarks}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Total Marks</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 100" 
              keyboardType="numeric"
              value={totalMarks}
              onChangeText={setTotalMarks}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleUpload}
          disabled={isSubmitting}
        >
          <Text style={styles.submitText}>{isSubmitting ? "Uploading..." : "Publish Grade"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
  miniLabel: { fontSize: 12, color: '#718096', marginBottom: 5 },
  listContainer: { marginBottom: 20 },
  studentChip: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  activeChip: { backgroundColor: '#8E24AA', borderColor: '#8E24AA' },
  chipText: { color: '#4A5568', fontWeight: '600' },
  activeText: { color: '#fff' },
  form: { flex: 1 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  submitBtn: { backgroundColor: '#8E24AA', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
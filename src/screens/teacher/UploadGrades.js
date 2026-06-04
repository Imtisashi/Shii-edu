import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ScrollView } from 'react-native';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import { collection, query, where, getDocs, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { createSupabaseGrade, listSupabaseUsers } from '../../services/supabaseTenantDataService';

export default function UploadGrades({ navigation }) {
  const { currentUser, userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Grade Form State
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState(''); // e.g., Mid-Term, Final, Unit Test
  const [marks, setMarks] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const instType = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase().includes('college') ? 'college' : 'school';
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
        if (currentUser) {
          const supabaseResult = await listSupabaseUsers(currentUser);
          const supabaseStudents = (Array.isArray(supabaseResult?.users) ? supabaseResult.users : [])
            .filter((profile) => String(profile?.role || '').toLowerCase() === 'student')
            .map((profile) => ({
              ...profile,
              id: profile.id || profile.uid || profile.supabaseId,
              name: profile.name || profile.fullName || 'Unnamed Student',
            }));

          if (supabaseStudents.length > 0) {
            setStudents(supabaseStudents);
            setLoading(false);
            return;
          }
        }
      } catch (supabaseError) {
        console.warn('Supabase students unavailable for grade upload, using Firestore fallback:', supabaseError);
      }

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
  }, [currentUser, userData?.instituteId]);

  const handleUpload = async () => {
    if (!selectedStudent || !subject || !marks || !totalMarks) {
      return Alert.alert("Error", "Please complete all fields.");
    }

    const numericMarks = Number(marks);
    const numericTotalMarks = Number(totalMarks);
    if (!Number.isFinite(numericMarks) || !Number.isFinite(numericTotalMarks) || numericTotalMarks <= 0) {
      return Alert.alert("Error", "Please enter valid marks and total marks.");
    }

    setIsSubmitting(true);
    try {
      const gradeRef = doc(collection(db, "grades"));
      const studentUid = selectedStudent.uid || selectedStudent.id || selectedStudent.supabaseId;
      const studentName = selectedStudent.name || selectedStudent.fullName || 'Unnamed Student';
      const gradePayload = {
        legacyFirestoreId: gradeRef.id,
        studentId: studentUid,
        studentSupabaseId: selectedStudent.supabaseId || null,
        studentUid,
        studentUniqueId: selectedStudent.loginId || selectedStudent.uniqueId || null,
        studentName,
        teacherId: userData.uid,
        teacherName: userData.name,
        instituteId: userData.instituteId,
        subject: subject.trim(),
        examType: examType.trim() || 'General Assessment',
        marks: numericMarks,
        totalMarks: numericTotalMarks,
        percentage: (numericMarks / numericTotalMarks) * 100,
        type: instType,
      };

      let saved = false;
      let lastError = null;

      try {
        await createSupabaseGrade(currentUser, gradePayload);
        saved = true;
      } catch (supabaseError) {
        lastError = supabaseError;
        console.warn('Supabase grade publish failed, mirroring to Firestore fallback:', supabaseError);
      }

      try {
        await setDoc(gradeRef, {
          ...gradePayload,
          id: gradeRef.id,
          dataSource: saved ? 'supabase+firebase' : 'firebase',
          timestamp: serverTimestamp(),
        });
        saved = true;
      } catch (firebaseError) {
        lastError = firebaseError;
        console.warn('Firestore grade mirror failed:', firebaseError);
      }

      if (!saved) throw lastError || new Error('Grade upload failed.');

      Alert.alert("Success", `Grades uploaded for ${studentName}`);
      returnToTeacherHome();
    } catch (_err) {
      Alert.alert("Error", "Failed to upload grades.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <RosterSkeleton rowCount={6} showFilters />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroPanel}>
        <Text style={styles.heroEyebrow}>Assessment ledger</Text>
        <Text style={styles.heroTitle}>Upload Grades</Text>
        <Text style={styles.heroCopy}>Select a student, add marks, and publish the result to Firestore.</Text>
      </View>
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
          placeholderTextColor={colors.muted}
          value={subject}
          onChangeText={setSubject}
        />
        
        <TextInput 
          style={styles.input} 
          placeholder="Exam Type (e.g. Unit Test 1)"
          placeholderTextColor={colors.muted}
          value={examType}
          onChangeText={setExamType}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.miniLabel}>Marks Obtained</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 85" 
              placeholderTextColor={colors.muted}
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
              placeholderTextColor={colors.muted}
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

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden', padding: 20 },
  loadingContainer: { flex: 1, alignItems: 'center', backgroundColor: '#02030A', justifyContent: 'center' },
  loadingText: { color: '#B9C6DD', fontWeight: '800', marginTop: 12 },
  heroPanel: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginBottom: 20, padding: 18 },
  heroEyebrow: { color: '#8EA4C8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '900', marginTop: 4 },
  heroCopy: { color: '#B9C6DD', fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 6 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10 },
  miniLabel: { fontSize: 12, color: '#B9C6DD', marginBottom: 5, fontWeight: '800' },
  listContainer: { marginBottom: 20 },
  studentChip: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#334155' },
  activeChip: { backgroundColor: '#8E24AA', borderColor: '#8E24AA' },
  chipText: { color: '#B9C6DD', fontWeight: '800' },
  activeText: { color: '#fff' },
  form: { flex: 1 },
  input: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, color: '#F8FAFC', padding: 15, marginBottom: 15, outlineStyle: 'none' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  submitBtn: { backgroundColor: '#8E24AA', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 18, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

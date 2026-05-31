import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView 
} from 'react-native';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';

export default function ManageRoutines() {
  const { userData } = useAuth();
  const instType = userData?.instituteData?.type || 'school';

  const [teachers, setTeachers] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [day, setDay] = useState('Monday');
  const [time, setTime] = useState('');
  const [subject, setSubject] = useState('');
  const [primaryTag, setPrimaryTag] = useState(''); // Class or Dept
  const [secondaryTag, setSecondaryTag] = useState(''); // Section or Sem

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // 1. Fetch Teachers & Routines
  useEffect(() => {
    if (!userData?.instituteId) return;

    // Fetch Teachers
    const tQ = query(collection(db, "users"), where("instituteId", "==", userData.instituteId), where("role", "==", "teacher"));
    const unsubT = onSnapshot(tQ, (snap) => setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Fetch Routines
    const rQ = query(collection(db, "routines"), where("instituteId", "==", userData.instituteId));
    const unsubR = onSnapshot(rQ, (snap) => {
      setRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubT(); unsubR(); };
  }, [userData]);

  // 2. Save Routine to Database
  const handleAssignRoutine = async () => {
    if (!selectedTeacher || !time || !subject || !primaryTag) {
      if (Platform.OS === 'web') {
        window.alert("Please fill all required fields.");
      } else {
        Alert.alert("Incomplete", "Fill all required fields.");
      }
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, "routines"), {
        instituteId: userData.instituteId,
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name,
        day: day,
        time: time.trim(),
        subject: subject.trim(),
        targetPrimary: primaryTag.trim(), // Class or Dept
        targetSecondary: secondaryTag.trim() || (instType === 'school' ? 'A' : '1'), // Sec or Sem
        createdAt: serverTimestamp()
      });

      setTime(''); setSubject(''); setPrimaryTag(''); setSecondaryTag('');
      if (Platform.OS === 'web') {
        window.alert("Routine assigned!");
      } else {
        Alert.alert("Success", "Routine assigned!");
      }
    } catch (error) {
      console.error(error);
      if (Platform.OS === 'web') {
        window.alert("Failed to save.");
      } else {
        Alert.alert("Error", "Failed to save.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (routineId) => {
    try {
      await deleteDoc(doc(db, "routines", routineId));
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DynamicHeader title="Master Schedule" showBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ASSIGNMENT FORM */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assign New Class</Text>
          
          <Text style={styles.label}>Select Teacher</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {teachers.map(t => (
              <TouchableOpacity 
                key={t.id} 
                style={[styles.chip, selectedTeacher?.id === t.id && styles.activeChip]}
                onPress={() => setSelectedTeacher(t)}
              >
                <Text style={[styles.chipText, selectedTeacher?.id === t.id && styles.activeChipText]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Select Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {daysOfWeek.map(d => (
              <TouchableOpacity 
                key={d} 
                style={[styles.chip, day === d && styles.activeChip]}
                onPress={() => setDay(d)}
              >
                <Text style={[styles.chipText, day === d && styles.activeChipText]}>{d.substring(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={styles.label}>TimeSlot</Text>
              <TextInput style={styles.input} placeholder="e.g. 10:00 AM" value={time} onChangeText={setTime} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Subject</Text>
              <TextInput style={styles.input} placeholder="e.g. Physics" value={subject} onChangeText={setSubject} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={styles.label}>{instType === 'school' ? 'Target Class' : 'Target Dept'}</Text>
              <TextInput style={styles.input} placeholder={instType === 'school' ? 'e.g. 10' : 'e.g. CSE'} value={primaryTag} onChangeText={setPrimaryTag} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>{instType === 'school' ? 'Section' : 'Semester'}</Text>
              <TextInput style={styles.input} placeholder={instType === 'school' ? 'e.g. A' : 'e.g. 3'} value={secondaryTag} onChangeText={setSecondaryTag} />
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleAssignRoutine} disabled={isSaving || !selectedTeacher}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save to Master Schedule</Text>}
          </TouchableOpacity>
        </View>

        {/* ACTIVE ROUTINES VIEWER */}
        <Text style={styles.sectionTitle}>Active Master Schedule</Text>
        {loading ? <ActivityIndicator color="#3B82F6" /> : routines.length === 0 ? (
          <Text style={styles.emptyText}>No routines assigned yet.</Text>
        ) : (
          routines.map(r => (
            <View key={r.id} style={styles.routineCard}>
              <View style={styles.routineHeader}>
                <View style={styles.dayBadge}><Text style={styles.dayText}>{r.day}</Text></View>
                <TouchableOpacity onPress={() => handleDelete(r.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.routineTeacher}>{r.teacherName}</Text>
              <Text style={styles.routineDetails}>{r.subject} - {r.time}</Text>
              <Text style={styles.routineTarget}>
                {instType === 'school' ? `Class ${r.targetPrimary} - Sec ${r.targetSecondary}` : `${r.targetPrimary} - Sem ${r.targetSecondary}`}
              </Text>
            </View>
          ))
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 3, marginBottom: 25 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', marginBottom: 20 },
  chip: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  activeChip: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  chipText: { color: '#64748B', fontWeight: '600' },
  activeChipText: { color: '#fff' },
  row: { flexDirection: 'row' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15 },
  submitBtn: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 15, marginLeft: 5 },
  emptyText: { color: '#94A3B8', fontStyle: 'italic', marginLeft: 5 },
  routineCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  routineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  dayText: { color: '#2563EB', fontWeight: 'bold', fontSize: 12 },
  routineTeacher: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  routineDetails: { fontSize: 14, color: '#475569', marginTop: 4 },
  routineTarget: { fontSize: 12, color: '#10B981', fontWeight: 'bold', marginTop: 8 }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
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
  const [bulkText, setBulkText] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

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
      const primary = primaryTag.trim();
      const secondary = secondaryTag.trim() || (instType === 'school' ? 'A' : '1');
      const scopeFields = instType === 'school'
        ? { class: primary, section: secondary }
        : { dept: primary, sem: secondary };

      await addDoc(collection(db, "routines"), {
        instituteId: userData.instituteId,
        teacherId: selectedTeacher.id,
        teacherUid: selectedTeacher.uid || selectedTeacher.id,
        teacherName: selectedTeacher.name,
        day: day,
        time: time.trim(),
        subject: subject.trim(),
        targetPrimary: primary,
        targetSecondary: secondary,
        ...scopeFields,
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

  const resolveTeacher = (row) => {
    const teacherNeedle = String(row.teacherEmail || row.TeacherEmail || row.email || row.teacher || row.Teacher || row.teacherName || row.TeacherName || row.teacherCode || row.TeacherCode || '').trim().toLowerCase();
    if (!teacherNeedle) return null;

    return teachers.find((teacher) => {
      const candidates = [
        teacher.email,
        teacher.name,
        teacher.teacherCode,
        teacher.uniqueId,
        teacher.id,
      ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
      return candidates.includes(teacherNeedle);
    }) || null;
  };

  const handleBulkUpload = async () => {
    if (!bulkText.trim()) {
      if (Platform.OS === 'web') {
        window.alert("Paste CSV routine rows first.");
      } else {
        Alert.alert("No CSV", "Paste CSV routine rows first.");
      }
      return;
    }

    const parsed = Papa.parse(bulkText.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      const message = parsed.errors[0]?.message || 'CSV could not be parsed.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert("CSV Error", message);
      }
      return;
    }

    const rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value || '').trim()));
    if (rows.length === 0) {
      if (Platform.OS === 'web') {
        window.alert("No usable rows found.");
      } else {
        Alert.alert("CSV Empty", "No usable rows found.");
      }
      return;
    }

    setIsBulkSaving(true);
    let uploaded = 0;
    let skipped = 0;

    try {
      const batch = writeBatch(db);
      rows.forEach((row) => {
        const teacher = resolveTeacher(row);
        const rowDay = String(row.day || row.Day || '').trim();
        const rowTime = String(row.time || row.Time || '').trim();
        const rowSubject = String(row.subject || row.Subject || row.course || row.Course || '').trim();
        const primary = String(
          instType === 'school'
            ? (row.class || row.Class || row.standard || row.Standard || '')
            : (row.dept || row.Dept || row.department || row.Department || '')
        ).trim();
        const secondary = String(
          instType === 'school'
            ? (row.section || row.Section || '')
            : (row.sem || row.Sem || row.semester || row.Semester || '')
        ).trim() || (instType === 'school' ? 'A' : '1');

        if (!teacher || !rowDay || !rowTime || !rowSubject || !primary) {
          skipped += 1;
          return;
        }

        const scopeFields = instType === 'school'
          ? { class: primary, section: secondary }
          : { dept: primary, sem: secondary };

        batch.set(doc(collection(db, 'routines')), {
          instituteId: userData.instituteId,
          teacherId: teacher.id,
          teacherUid: teacher.uid || teacher.id,
          teacherName: teacher.name || '',
          day: rowDay,
          time: rowTime,
          subject: rowSubject,
          targetPrimary: primary,
          targetSecondary: secondary,
          ...scopeFields,
          source: 'bulk_csv',
          createdAt: serverTimestamp(),
        });
        uploaded += 1;
      });

      if (uploaded > 0) {
        await batch.commit();
      }

      setBulkText('');
      const message = `Routine upload complete. ${uploaded} row${uploaded === 1 ? '' : 's'} uploaded, ${skipped} skipped.`;
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert("Upload Complete", message);
      }
    } catch (error) {
      console.error('Bulk routine upload failed:', error);
      if (Platform.OS === 'web') {
        window.alert("Bulk upload failed.");
      } else {
        Alert.alert("Error", "Bulk upload failed.");
      }
    } finally {
      setIsBulkSaving(false);
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
            {isSaving ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Save to Master Schedule</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Automatic Routine Uploader</Text>
          <Text style={styles.helperText}>
            Paste CSV rows and upload the master schedule in one shot. Headers: day,time,subject,teacherEmail,{instType === 'school' ? 'class,section' : 'dept,sem'}.
          </Text>
          <TextInput
            style={[styles.input, styles.bulkInput]}
            value={bulkText}
            onChangeText={setBulkText}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            placeholder={instType === 'school'
              ? "day,time,subject,teacherEmail,class,section\nMonday,10:00 AM,Physics,teacher@school.edu,10,A"
              : "day,time,subject,teacherEmail,dept,sem\nMonday,10:00 AM,Data Structures,prof@college.edu,CSE,3"}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleBulkUpload} disabled={isBulkSaving}>
            {isBulkSaving ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Upload CSV Routine</Text>}
          </TouchableOpacity>
        </View>

        {/* ACTIVE ROUTINES VIEWER */}
        <Text style={styles.sectionTitle}>Active Master Schedule</Text>
        {loading ? <SmoothSpinner color="#3B82F6" /> : routines.length === 0 ? (
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
  helperText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: -12, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', marginBottom: 20 },
  chip: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  activeChip: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  chipText: { color: '#64748B', fontWeight: '600' },
  activeChipText: { color: '#fff' },
  row: { flexDirection: 'row' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15 },
  bulkInput: { minHeight: 150, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
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

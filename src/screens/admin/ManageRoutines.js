import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { createSupabaseRoutine, deleteSupabaseRoutine, listSupabaseRoutines, listSupabaseUsers } from '../../services/supabaseTenantDataService';

export default function ManageRoutines() {
  const { currentUser, userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const instType = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();

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
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    let didCancel = false;
    let supabaseRoutines = [];
    let firestoreRoutines = [];
    const publishRoutines = () => {
      if (didCancel) return;
      const byId = new Map();
      [...supabaseRoutines, ...firestoreRoutines].forEach((routine) => {
        if (!routine) return;
        byId.set(String(routine.supabaseId || routine.id), routine);
      });
      setRoutines(Array.from(byId.values()));
      setLoading(false);
    };

    if (currentUser) {
      listSupabaseUsers(currentUser)
        .then((result) => {
          const teacherList = (Array.isArray(result?.users) ? result.users : [])
            .filter((profile) => String(profile?.role || '').toLowerCase() === 'teacher')
            .map((profile) => ({
              ...profile,
              id: profile.id || profile.uid || profile.supabaseId,
              name: profile.name || profile.fullName || 'Unnamed Teacher',
            }));
          if (!didCancel && teacherList.length > 0) setTeachers(teacherList);
        })
        .catch((error) => console.warn('Supabase teacher roster unavailable, using Firestore fallback:', error));

      listSupabaseRoutines(currentUser)
        .then((result) => {
          supabaseRoutines = Array.isArray(result?.routines) ? result.routines : [];
          publishRoutines();
        })
        .catch((error) => {
          console.warn('Supabase routines unavailable, using Firestore fallback:', error);
          publishRoutines();
        });
    }

    // Fetch Teachers
    const tQ = query(collection(db, "users"), where("instituteId", "==", userData.instituteId), where("role", "==", "teacher"));
    const unsubT = onSnapshot(tQ, (snap) => {
      if (!didCancel) {
        setTeachers((previous) => previous.length ? previous : snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, (error) => {
      console.warn('Teacher list for routine fallback failed:', error);
      setTeachers([]);
    });

    // Fetch Routines
    const rQ = query(collection(db, "routines"), where("instituteId", "==", userData.instituteId));
    const unsubR = onSnapshot(rQ, (snap) => {
      firestoreRoutines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishRoutines();
    }, (error) => {
      console.warn('Routine Firestore fallback failed:', error);
      firestoreRoutines = [];
      publishRoutines();
    });

    return () => {
      didCancel = true;
      unsubT();
      unsubR();
    };
  }, [currentUser, userData?.instituteId]);

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

      const routineRef = doc(collection(db, "routines"));
      const routinePayload = {
        id: routineRef.id,
        legacyFirestoreId: routineRef.id,
        instituteId: userData.instituteId,
        teacherId: selectedTeacher.id,
        teacherSupabaseId: selectedTeacher.supabaseId || null,
        teacherUid: selectedTeacher.uid || selectedTeacher.id,
        teacherName: selectedTeacher.name,
        day: day,
        time: time.trim(),
        subject: subject.trim(),
        targetPrimary: primary,
        targetSecondary: secondary,
        ...scopeFields,
      };

      let saved = false;
      let lastError = null;

      try {
        await createSupabaseRoutine(currentUser, routinePayload);
        saved = true;
      } catch (supabaseError) {
        lastError = supabaseError;
        console.warn('Supabase routine save failed, using Firestore fallback:', supabaseError);
      }

      try {
        await setDoc(routineRef, {
          ...routinePayload,
          dataSource: saved ? 'supabase+firebase' : 'firebase',
        createdAt: serverTimestamp()
      });
        saved = true;
      } catch (firebaseError) {
        lastError = firebaseError;
        console.warn('Firestore routine mirror failed:', firebaseError);
      }

      if (!saved) throw lastError || new Error('Routine save failed.');

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
      await deleteSupabaseRoutine(currentUser, routineId).catch((error) => {
        console.warn('Supabase routine delete failed, removing Firestore fallback only:', error);
      });
      await deleteDoc(doc(db, "routines", routineId));
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const resolveTeacher = (row) => {
    const teacherNeedle = String(
      row.teacherId ||
      row.TeacherId ||
      row.teacherID ||
      row.TeacherID ||
      row.teacherCode ||
      row.TeacherCode ||
      row.teacher ||
      row.Teacher ||
      ''
    ).trim().toLowerCase();
    if (!teacherNeedle) return null;

    return teachers.find((teacher) => {
      const candidates = [
        teacher.loginId,
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
              <TextInput style={styles.input} placeholder="e.g. 10:00 AM" placeholderTextColor={colors.muted} value={time} onChangeText={setTime} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Subject</Text>
              <TextInput style={styles.input} placeholder="e.g. Physics" placeholderTextColor={colors.muted} value={subject} onChangeText={setSubject} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={styles.label}>{instType === 'school' ? 'Target Class' : 'Target Dept'}</Text>
              <TextInput style={styles.input} placeholder={instType === 'school' ? 'e.g. 10' : 'e.g. CSE'} placeholderTextColor={colors.muted} value={primaryTag} onChangeText={setPrimaryTag} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>{instType === 'school' ? 'Section' : 'Semester'}</Text>
              <TextInput style={styles.input} placeholder={instType === 'school' ? 'e.g. A' : 'e.g. 3'} placeholderTextColor={colors.muted} value={secondaryTag} onChangeText={setSecondaryTag} />
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleAssignRoutine} disabled={isSaving || !selectedTeacher}>
            {isSaving ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Save to Master Schedule</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Automatic Routine Uploader</Text>
          <Text style={styles.helperText}>
            Paste CSV rows and upload the master schedule in one shot. Headers: day,time,subject,teacherId,{instType === 'school' ? 'class,section' : 'dept,sem'}.
          </Text>
          <TextInput
            style={[styles.input, styles.bulkInput]}
            value={bulkText}
            onChangeText={setBulkText}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            placeholder={instType === 'school'
              ? "day,time,subject,teacherId,class,section\nMonday,10:00 AM,Physics,TCH-001,10,A"
              : "day,time,subject,teacherId,dept,sem\nMonday,10:00 AM,Data Structures,FAC-CSE-01,CSE,3"}
            placeholderTextColor={colors.muted}
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

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  scrollContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 20, marginBottom: 25 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', marginBottom: 20 },
  helperText: { color: '#B9C6DD', fontSize: 13, lineHeight: 19, marginTop: -12, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#8EA4C8', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', marginBottom: 20 },
  chip: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#334155' },
  activeChip: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  chipText: { color: '#B9C6DD', fontWeight: '800' },
  activeChipText: { color: '#fff' },
  row: { flexDirection: 'row' },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, color: '#F8FAFC', padding: 12, fontSize: 15, marginBottom: 15, outlineStyle: 'none' },
  bulkInput: { minHeight: 150, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  submitBtn: { backgroundColor: '#3B82F6', borderColor: '#334155', borderWidth: 1, paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 5},
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#F8FAFC', marginBottom: 15, marginLeft: 5 },
  emptyText: { color: '#B9C6DD', fontWeight: '800', marginLeft: 5 },
  routineCard: { backgroundColor: '#0F172A', borderColor: '#3B82F6', borderRadius: 8, borderWidth: 1, padding: 16, marginBottom: 12 },
  routineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayBadge: { backgroundColor: '#082F49', borderColor: '#075985', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  dayText: { color: '#67E8F9', fontWeight: 'bold', fontSize: 12 },
  routineTeacher: { fontSize: 16, fontWeight: '900', color: '#F8FAFC' },
  routineDetails: { fontSize: 14, color: '#B9C6DD', marginTop: 4 },
  routineTarget: { fontSize: 12, color: '#10B981', fontWeight: 'bold', marginTop: 8 }
});

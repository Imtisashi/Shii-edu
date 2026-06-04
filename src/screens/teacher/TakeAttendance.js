import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import AttendanceSkeleton from '../../components/attendance/AttendanceSkeleton';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { Ionicons } from '@expo/vector-icons';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';
import { createUnifiedNotification } from '../../services/unifiedNotificationService';
import ScreenErrorBoundary from '../../components/errors/ScreenErrorBoundary';
import { createSupabaseAttendanceRecords, listSupabaseUsers } from '../../services/supabaseTenantDataService';

const resolveStudentUid = (student = {}) => student.uid || student.authUid || student.id;
const toDisplayText = (value, fallback = '') => (
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
);
const createAttendanceDocId = (instituteId, studentUid, date, subject = 'general') =>
  `${instituteId}_${studentUid}_${date}_${subject}`.replace(/[^a-zA-Z0-9_-]/g, '_');
const SUBJECTS = ['Painting', 'Sculpture', 'History'];

const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }

  Alert.alert(title, message);
};

function TakeAttendanceContent({ navigation }) {
  const { currentUser, userData } = useAuth();
  const { insets, styles } = useInstituteTheme(baseStyles);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attendance, setAttendance] = useState({});
  const [selectedSubject, setSelectedSubject] = useState('');

  const instType = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase().includes('college') ? 'college' : 'school';
  const safeStudents = Array.isArray(students) ? students : [];
  const safeAttendance = attendance && typeof attendance === 'object' ? attendance : {};
  const returnToTeacherHome = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation?.navigate?.('TeacherHome');
  }, [navigation]);

  useEffect(() => {
    let didCancel = false;
    const fetchStudents = async () => {
      if (!userData?.instituteId) {
        setStudents([]);
        setAttendance({});
        setLoading(false);
        return;
      }

      setLoading(true);
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
            const status = {};
            supabaseStudents.forEach((student) => {
              const studentKey = String(student.id || resolveStudentUid(student) || '');
              if (studentKey) status[studentKey] = true;
            });
            supabaseStudents.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            if (!didCancel) {
              setStudents(supabaseStudents);
              setAttendance(status);
              setErrorMessage('');
            }
            return;
          }
        }
      } catch (supabaseError) {
        console.warn('Supabase roster unavailable for attendance, using Firestore fallback:', supabaseError);
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
        (snap?.docs || []).forEach((studentDoc) => {
          const student = { id: studentDoc.id, ...studentDoc.data() };
          const studentKey = String(student.id || resolveStudentUid(student) || '');
          list.push(student);
          if (studentKey) status[studentKey] = true;
        });
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        if (!didCancel) {
          setStudents(list);
          setAttendance(status);
          setErrorMessage('');
        }
      } catch (error) {
        console.error('TakeAttendance student fetch failed:', error);
        if (!didCancel) setErrorMessage('Could not load the attendance roster.');
      } finally {
        if (!didCancel) setLoading(false);
      }
    };
    fetchStudents();

    return () => {
      didCancel = true;
    };
  }, [currentUser, userData?.instituteId]);

  const submitAttendance = async () => {
    if (instType === 'college' && !selectedSubject) {
      showMessage("Required", "Please select a subject.");
      return false;
    }

    if (!userData?.instituteId || safeStudents.length === 0) return false;

    try {
      const today = new Date().toISOString().split('T')[0];
      const subject = selectedSubject || 'General';
      const attendanceRows = safeStudents.map((student) => {
        const studentUid = toDisplayText(resolveStudentUid(student));
        const studentKey = String(student.id || studentUid);
        const isPresent = Boolean(safeAttendance[studentKey]);
        const legacyFirestoreId = createAttendanceDocId(userData.instituteId, studentUid, today, subject);
        return {
          class: student.class || userData?.assignedClass || null,
          date: today,
          dept: student.dept || userData?.assignedDept || null,
          id: legacyFirestoreId,
          isPresent,
          legacyFirestoreId,
          loginId: student.loginId || student.uniqueId || null,
          section: student.section || userData?.assignedSection || null,
          sem: student.sem || userData?.assignedSem || null,
          status: isPresent ? 'present' : 'absent',
          studentDocId: toDisplayText(student?.id),
          studentId: studentUid,
          studentName: toDisplayText(student?.name, 'Unnamed Student'),
          studentSupabaseId: student.supabaseId || null,
          studentUid,
          studentUniqueId: student.uniqueId || student.loginId || null,
          subject,
          targetPrimary: toDisplayText(instType === 'school' ? (student?.class || userData?.assignedClass) : (student?.dept || userData?.assignedDept)),
          targetSecondary: toDisplayText(instType === 'school' ? (student?.section || userData?.assignedSection) : (student?.sem || userData?.assignedSem)),
        };
      }).filter((row) => row.studentUid);

      let saved = false;
      let lastError = null;

      try {
        await createSupabaseAttendanceRecords(currentUser, attendanceRows, {
          attendanceType: instType === 'college' ? 'subject' : 'daily',
          date: today,
          subject,
        });
        saved = true;
      } catch (supabaseError) {
        lastError = supabaseError;
        console.warn('Supabase attendance submit failed, using Firestore fallback:', supabaseError);
      }

      try {
        const batch = writeBatch(db);
        attendanceRows.forEach((row) => {
          const attendanceRef = doc(db, "attendance", row.legacyFirestoreId);
          batch.set(attendanceRef, {
            date: row.date,
            dataSource: saved ? 'supabase+firebase' : 'firebase',
            instituteId: userData.instituteId,
            isPresent: row.isPresent,
            status: row.status,
            studentDocId: row.studentDocId,
            studentId: row.studentId,
            studentName: row.studentName,
            studentUid: row.studentUid,
            studentUniqueId: row.studentUniqueId,
            subject: row.subject,
            teacherId: toDisplayText(userData?.uid || userData?.id),
            teacherName: toDisplayText(userData?.name, 'Teacher'),
            timestamp: serverTimestamp(),
            type: instType,
          }, { merge: true });
        });
        await batch.commit();
        saved = true;
      } catch (firebaseError) {
        lastError = firebaseError;
        console.warn('Firestore attendance mirror failed:', firebaseError);
      }

      if (!saved) throw lastError || new Error('Attendance save failed.');

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showMessage("Success", "Attendance recorded.");
      returnToTeacherHome();
      return true;
    } catch (error) {
      console.error('TakeAttendance submit failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showMessage("Error", "Failed to save.");
      return false;
    }
  };
  const {
    isPending: isSubmitting,
    run: handleSubmitAttendance,
  } = useSingleFlightAction(submitAttendance, {
    cooldownMs: 900,
    disabled: safeStudents.length === 0 || !userData?.instituteId,
    haptic: 'none',
  });

  if (loading) {
    return <AttendanceSkeleton accent="violet" label="Preparing attendance roster..." rowCount={5} />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 12) + 12,
          paddingTop: Math.max(insets.top, 12) + 12,
        },
      ]}
    >
      <View style={styles.heroPanel}>
        <Text style={styles.heroEyebrow}>Attendance session</Text>
        <Text style={styles.heroTitle}>Take Attendance</Text>
        <Text style={styles.heroCopy}>Tap a student row to toggle present or absent, then submit the session.</Text>
      </View>
      {errorMessage ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>{errorMessage}</Text>
        </View>
      ) : null}

      {instType === 'college' && (
        <View style={styles.collegeHeader}>
          <Text style={styles.label}>Select Subject:</Text>
          <View style={styles.subjectRow}>
            {SUBJECTS.map((sub) => (
              <TouchableOpacity 
                accessibilityLabel={`Select ${sub} subject`}
                accessibilityRole="button"
                key={sub} 
                style={[styles.chip, selectedSubject === sub && styles.activeChip]}
                onPress={() => {
                  setSelectedSubject(sub);
                }}
                disabled={isSubmitting}
              >
                <Text style={[styles.chipText, selectedSubject === sub && styles.activeChipText]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={safeStudents}
        keyExtractor={(item, index) => String(item?.id || resolveStudentUid(item) || index)}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No students found</Text>
            <Text style={styles.emptyText}>Student profiles will appear here when they are added to this institute.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const studentKey = String(item?.id || resolveStudentUid(item) || '');
          const isPresent = Boolean(safeAttendance[studentKey]);

          return (
            <TouchableOpacity
              accessibilityLabel={`Mark ${toDisplayText(item?.name, 'student')} ${isPresent ? 'absent' : 'present'}`}
              accessibilityRole="button"
              style={[styles.card, !isPresent && styles.absent]}
              onPress={() => {
                if (!studentKey) return;
                setAttendance((previous) => ({ ...previous, [studentKey]: !previous?.[studentKey] }));
              }}
              disabled={isSubmitting}
            >
              <Text numberOfLines={1} style={styles.studentName}>{toDisplayText(item?.name, 'Unnamed Student')}</Text>
              <Ionicons name={isPresent ? "checkmark-circle" : "close-circle"} size={24} color={isPresent ? "#34D399" : "#F87171"} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        removeClippedSubviews={Platform.OS !== 'web'}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />

      <TouchableOpacity
        accessibilityLabel="Submit attendance"
        accessibilityRole="button"
        style={[styles.submitBtn, (isSubmitting || safeStudents.length === 0) && styles.submitBtnDisabled]}
        onPress={handleSubmitAttendance}
        disabled={isSubmitting || safeStudents.length === 0}
      >
        {isSubmitting ? <SmoothSpinner color="#FFFFFF" size={24} /> : <Text style={styles.submitText}>Submit Attendance</Text>}
      </TouchableOpacity>
    </View>
  );
}

export default function TakeAttendance(props) {
  return (
    <ScreenErrorBoundary
      screenName="TakeAttendance"
      title="Attendance is recovering"
      message="The attendance form hit a rendering problem. Retry after the roster refreshes."
    >
      <TakeAttendanceContent {...props} />
    </ScreenErrorBoundary>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 16 },
  heroPanel: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginBottom: 12, padding: 16 },
  heroEyebrow: { color: '#8EA4C8', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', marginTop: 3 },
  heroCopy: { color: '#B9C6DD', fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 5 },
  warningCard: { backgroundColor: '#422006', borderWidth: 1, borderColor: '#A16207', borderRadius: 8, padding: 12, marginBottom: 12 },
  warningText: { color: '#F7C948', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  collegeHeader: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 14, marginBottom: 12 },
  label: { color: '#F8FAFC', fontWeight: '700', marginBottom: 10 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#334155', borderRadius: 8, marginRight: 8, marginBottom: 8, backgroundColor: '#0F172A' },
  activeChip: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#B9C6DD', fontWeight: '700' },
  activeChipText: { color: '#fff' },
  card: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  absent: { backgroundColor: '#450A0A', borderColor: '#7F1D1D' },
  listContent: { paddingBottom: 14 },
  studentName: { color: '#F8FAFC', flex: 1, fontSize: 14, fontWeight: '700', marginRight: 12, minWidth: 0 },
  emptyState: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 18 },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#B9C6DD', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  submitBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB', borderRadius: 8, borderWidth: 1, padding: 15, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontWeight: '800' }
});

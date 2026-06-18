import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { PieChart } from 'react-native-chart-kit';
import { db } from '../../../firebaseConfig';
import AttendanceSkeleton from '../../components/attendance/AttendanceSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import DynamicHeader from '../../components/DynamicHeader';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';
import ScreenErrorBoundary from '../../components/errors/ScreenErrorBoundary';
import { createSupabaseAttendanceRecords, listSupabaseUsers } from '../../services/supabaseTenantDataService';
import {
  filterStudentsForAttendanceAssignment,
  getAttendanceAssignment,
} from '../../utils/attendanceAssignment';

const resolveStudentUid = (student = {}) => student.uid || student.authUid || student.id;
const toDisplayText = (value, fallback = '') => (
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
);
const createAttendanceDocId = (instituteId, studentUid, date, subject = 'daily') =>
  `${instituteId}_${studentUid}_${date}_${subject}`.replace(/[^a-zA-Z0-9_-]/g, '_');

function TeacherAttendanceContent() {
  const { currentUser, userData } = useAuth();
  const layout = useResponsiveLayout();
  const { colors, insets, styles } = useInstituteTheme(baseStyles);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attendanceRecord, setAttendanceRecord] = useState({});

  const institutionType = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = !institutionType.includes('college');
  const attendanceAssignment = useMemo(
    () => getAttendanceAssignment(userData, isSchool),
    [isSchool, userData]
  );
  const safeStudents = Array.isArray(students) ? students : [];
  const safeAttendanceRecord = attendanceRecord && typeof attendanceRecord === 'object' ? attendanceRecord : {};
  const presentCount = safeStudents.filter((student) => {
    const studentKey = String(student?.id || resolveStudentUid(student) || '');
    return studentKey ? Boolean(safeAttendanceRecord[studentKey]) : false;
  }).length;
  const absentCount = Math.max(safeStudents.length - presentCount, 0);
  const chartWidth = Math.max(220, Math.min(layout.width - 72, 440));
  const chartData = [
    {
      name: 'Present',
      population: presentCount,
      color: '#10B981',
      legendFontColor: colors.textSoft,
      legendFontSize: 12,
    },
    {
      name: 'Absent',
      population: absentCount,
      color: '#EF4444',
      legendFontColor: colors.textSoft,
      legendFontSize: 12,
    },
  ];
  const visibleChartData = safeStudents.length
    ? chartData
    : [
        {
          name: 'No Students',
          population: 1,
          color: '#334155',
          legendFontColor: colors.muted,
          legendFontSize: 12,
        },
      ];

  useEffect(() => {
    if (!userData?.instituteId) {
      setStudents([]);
      setAttendanceRecord({});
      setLoading(false);
      return;
    }

    let didCancel = false;
    const fetchStudents = async () => {
      setLoading(true);
      try {
        let allStudents = [];
        if (currentUser) {
          try {
            const supabaseResult = await listSupabaseUsers(currentUser);
            allStudents = (Array.isArray(supabaseResult?.users) ? supabaseResult.users : [])
              .filter((profile) => String(profile?.role || '').toLowerCase() === 'student')
              .map((profile) => ({
                ...profile,
                id: profile.id || profile.uid || profile.supabaseId,
                name: profile.name || profile.fullName || 'Unnamed Student',
              }));
          } catch (supabaseError) {
            console.warn('Supabase roster unavailable for teacher attendance, using Firestore fallback:', supabaseError);
          }
        }

        if (allStudents.length === 0) {
        const q = query(
          collection(db, "users"),
          where("instituteId", "==", userData.instituteId),
          where("role", "==", "student")
        );
        const snapshot = await getDocs(q);
          allStudents = (snapshot?.docs || []).map((studentDoc) => ({
          id: studentDoc.id,
          ...studentDoc.data(),
        }));
        }

        if (didCancel) return;

        if (!attendanceAssignment.assigned) {
          setErrorMessage(attendanceAssignment.message);
          setStudents([]);
          setAttendanceRecord({});
          return;
        }

        const studentList = filterStudentsForAttendanceAssignment(allStudents, attendanceAssignment, isSchool);

        setErrorMessage(studentList.length === 0
          ? `No students found for assigned ${isSchool ? 'Class' : 'Department'} ${attendanceAssignment.primary} - ${isSchool ? 'Section' : 'Semester'} ${attendanceAssignment.secondary}.`
          : '');
        
        studentList.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
        
        const initialRecord = {};
        studentList.forEach((student) => {
          const studentId = String(student?.id || resolveStudentUid(student) || '');
          if (studentId) initialRecord[studentId] = true;
        });

        if (!didCancel) {
          setStudents(studentList);
          setAttendanceRecord(initialRecord);
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        const err = "Could not load students for attendance.";
        if (!didCancel) {
          setErrorMessage(err);
          if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(err);
          else Alert.alert("Error", err);
        }
      } finally {
        if (!didCancel) setLoading(false);
      }
    };

    fetchStudents();

    return () => {
      didCancel = true;
    };
  }, [
    isSchool,
    attendanceAssignment,
    currentUser,
    userData?.instituteId,
  ]);

  const toggleAttendance = (studentId) => {
    if (!studentId) return;

    setAttendanceRecord((previous) => ({
      ...previous,
      [studentId]: !previous?.[studentId]
    }));
  };

  const submitAttendance = async () => {
    if (safeStudents.length === 0 || !userData?.instituteId) return false;
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceRows = safeStudents.map((student) => {
        const studentUid = toDisplayText(resolveStudentUid(student));
        const studentKey = String(student.id || studentUid);
        const isPresent = Boolean(safeAttendanceRecord[studentKey]);
        const legacyFirestoreId = createAttendanceDocId(userData.instituteId, studentUid, today);
        return {
          class: student?.class || userData?.assignedClass || null,
          date: today,
          dept: student?.dept || userData?.assignedDept || null,
          id: legacyFirestoreId,
          isPresent,
          legacyFirestoreId,
          loginId: student.loginId || student.uniqueId || null,
          section: student?.section || userData?.assignedSection || null,
          sem: student?.sem || userData?.assignedSem || null,
          status: isPresent ? 'present' : 'absent',
          studentDocId: toDisplayText(student?.id),
          studentId: studentUid,
          studentName: toDisplayText(student?.name, 'Unnamed Student'),
          studentSupabaseId: student.supabaseId || null,
          studentUid,
          studentUniqueId: student.uniqueId || student.loginId || null,
          targetPrimary: toDisplayText(
            isSchool ? (student?.class || userData?.assignedClass) : (student?.dept || userData?.assignedDept)
          ),
          targetSecondary: toDisplayText(
            isSchool ? (student?.section || userData?.assignedSection) : (student?.sem || userData?.assignedSem)
          ),
        };
      }).filter((row) => row.studentUid);

      let saved = false;
      let lastError = null;

      try {
        await createSupabaseAttendanceRecords(currentUser, attendanceRows, {
          attendanceType: isSchool ? 'daily' : 'subject',
          date: today,
          subject: isSchool ? 'Daily Attendance' : 'General',
        });
        saved = true;
      } catch (supabaseError) {
        lastError = supabaseError;
        console.warn('Supabase teacher attendance submit failed, using Firestore fallback:', supabaseError);
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
            targetPrimary: row.targetPrimary,
            targetSecondary: row.targetSecondary,
            teacherId: toDisplayText(userData?.uid || userData?.id),
            teacherName: toDisplayText(userData?.name, 'Teacher'),
            timestamp: serverTimestamp(),
          }, { merge: true });
        });
        await batch.commit();
        saved = true;
      } catch (firebaseError) {
        lastError = firebaseError;
        console.warn('Firestore teacher attendance mirror failed:', firebaseError);
      }

      if (!saved) throw lastError || new Error('Attendance save failed.');

      const msg = "Attendance securely logged for today.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert("Success", msg);
      }
      return true;
    } catch (error) {
      console.error(error);
      const err = "Failed to submit attendance.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(err);
      } else {
        Alert.alert("Error", err);
      }
      return false;
    }
  };
  const {
    isPending: submitting,
    run: handleSubmitAttendance,
  } = useSingleFlightAction(submitAttendance, {
    cooldownMs: 900,
    disabled: safeStudents.length === 0 || !userData?.instituteId,
    haptic: 'none',
  });

  const renderStudent = ({ item }) => {
    if (!item) return null;

    const studentId = String(item.id || resolveStudentUid(item) || '');
    const isPresent = Boolean(safeAttendanceRecord[studentId]);
    
    return (
      <View style={[styles.studentCard, layout.isCompact && styles.studentCardCompact]}>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{String(item.name || 'S').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.studentName} numberOfLines={1}>{String(item.name || 'Unnamed Student')}</Text>
          <Text style={styles.studentId} numberOfLines={1}>{String(item.uniqueId || item.id || 'No ID')}</Text>
        </View>
        
        <TouchableOpacity 
          accessibilityLabel={`Mark ${String(item.name || 'student')} ${isPresent ? 'absent' : 'present'}`}
          accessibilityRole="button"
          style={[styles.toggleBtn, layout.isCompact && styles.toggleBtnCompact, isPresent ? styles.presentBtn : styles.absentBtn]}
          onPress={() => toggleAttendance(studentId)}
          disabled={submitting}
        >
          <Ionicons name={isPresent ? 'checkbox' : 'square-outline'} size={17} color={isPresent ? '#047857' : '#DC2626'} />
          <Text style={[styles.toggleText, isPresent ? styles.presentText : styles.absentText]}>
            {isPresent ? 'Present' : 'Absent'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DynamicHeader title="Daily Attendance" showBack={true} />
      
      {loading ? (
        <AttendanceSkeleton
          accent="emerald"
          rowCount={5}
        />
      ) : (
        <>
          <View style={styles.summaryBox}>
            {errorMessage ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.summaryTitle}>
              {attendanceAssignment.assigned
                ? isSchool
                  ? `Class ${attendanceAssignment.primary} - Sec ${attendanceAssignment.secondary}`
                  : `${attendanceAssignment.primary} - Sem ${attendanceAssignment.secondary}`
                : 'Attendance assignment required'}
            </Text>
            <Text style={styles.summarySub}>Mark absentees, then submit to the server.</Text>

            <View style={styles.pieWrap}>
              <PieChart
                data={visibleChartData}
                width={chartWidth}
                height={150}
                chartConfig={{ color: () => '#F8FAFC' }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="6"
                center={[6, 0]}
                absolute
              />
            </View>

            <View style={styles.counterRow}>
              <View style={styles.counterPill}>
                <Text style={styles.counterValue}>{presentCount}</Text>
                <Text style={styles.counterLabel}>Present</Text>
              </View>
              <View style={[styles.counterPill, styles.absentPill]}>
                <Text style={[styles.counterValue, styles.absentCounter]}>{absentCount}</Text>
                <Text style={styles.counterLabel}>Absent</Text>
              </View>
            </View>
          </View>

          <FlatList
            data={safeStudents}
            keyExtractor={(item, index) => String(item?.id || resolveStudentUid(item) || index)}
            renderItem={renderStudent}
            contentContainerStyle={styles.listContent}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            removeClippedSubviews={Platform.OS !== 'web'}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No students available</Text>
                <Text style={styles.emptyText}>There are no student profiles ready for attendance in this institute yet.</Text>
              </View>
            }
            windowSize={7}
          />

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity
              accessibilityLabel="Submit attendance to server"
              accessibilityRole="button"
              style={[styles.submitBtn, (submitting || safeStudents.length === 0) && styles.submitBtnDisabled]}
              onPress={handleSubmitAttendance}
              disabled={submitting || safeStudents.length === 0}
            >
              {submitting ? <SmoothSpinner color="#fff" /> : (
                <Text style={styles.submitBtnText}>Submit to Server</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

export default function TeacherAttendance() {
  return (
    <ScreenErrorBoundary
      screenName="TeacherAttendance"
      title="Attendance is recovering"
      message="The attendance roster hit a rendering problem. The rest of Shii-Edu is still safe."
    >
      <TeacherAttendanceContent />
    </ScreenErrorBoundary>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#B9C6DD', fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 24 },
  skeletonRow: { width: '92%', maxWidth: 520, height: 68, borderRadius: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  skeletonRowShort: { width: '68%' },
  
  summaryBox: { backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#334155', borderColor: '#334155', borderRadius: 8, borderWidth: 1, margin: 14, padding: 16 },
  warningCard: { backgroundColor: '#422006', borderWidth: 1, borderColor: '#A16207', borderRadius: 8, padding: 12, marginBottom: 14 },
  warningText: { color: '#F7C948', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: '#F8FAFC' },
  summarySub: { fontSize: 13, color: '#B9C6DD', marginTop: 4 },
  pieWrap: { alignItems: 'center', marginTop: 12, overflow: 'hidden' },
  counterRow: { flexDirection: 'row', marginTop: 10 },
  counterPill: { flex: 1, backgroundColor: '#052E2B', borderRadius: 8, padding: 12, marginRight: 8, borderWidth: 1, borderColor: '#047857' },
  absentPill: { marginRight: 0, marginLeft: 8, backgroundColor: '#450A0A', borderColor: '#7F1D1D' },
  counterValue: { fontSize: 21, fontWeight: '800', color: '#10B981' },
  absentCounter: { color: '#EF4444' },
  counterLabel: { fontSize: 12, color: '#B9C6DD', fontWeight: '700', marginTop: 2 },
  
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  studentCardCompact: { alignItems: 'flex-start', flexWrap: 'wrap' },
  avatarFallback: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#052E2B', borderColor: '#047857', borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#34D399' },
  infoBox: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  studentId: { fontSize: 12, color: '#B9C6DD', marginTop: 2 },
  emptyState: { paddingVertical: 50, paddingHorizontal: 18, alignItems: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#B9C6DD', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  
  toggleBtn: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 104, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  toggleBtnCompact: { width: '100%', alignItems: 'center', marginTop: 12 },
  presentBtn: { backgroundColor: '#052E2B', borderColor: '#10B981' },
  absentBtn: { backgroundColor: '#450A0A', borderColor: '#EF4444' },
  presentText: { color: '#047857', fontWeight: '800', fontSize: 13 },
  absentText: { color: '#DC2626', fontWeight: '800', fontSize: 13 },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#020617', padding: 16, borderTopWidth: 1, borderTopColor: '#334155' },
  submitBtn: { backgroundColor: '#047857', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' }
});

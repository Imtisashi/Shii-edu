import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { PieChart } from 'react-native-chart-kit';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const resolveStudentUid = (student) => student.uid || student.authUid || student.id;
const normalizeValue = (value) => String(value || '').trim().toLowerCase();
const createAttendanceDocId = (instituteId, studentUid, date, subject = 'daily') =>
  `${instituteId}_${studentUid}_${date}_${subject}`.replace(/[^a-zA-Z0-9_-]/g, '_');

export default function TeacherAttendance() {
  const { userData } = useAuth();
  const layout = useResponsiveLayout();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // This object will track who is present (true) and absent (false)
  const [attendanceRecord, setAttendanceRecord] = useState({});

  const isSchool = (userData?.instituteData?.type || 'school').toLowerCase().includes('school');
  const presentCount = students.filter((student) => attendanceRecord[student.id]).length;
  const absentCount = Math.max(students.length - presentCount, 0);
  const chartData = [
    {
      name: 'Present',
      population: presentCount,
      color: '#10B981',
      legendFontColor: '#334155',
      legendFontSize: 12,
    },
    {
      name: 'Absent',
      population: absentCount,
      color: '#EF4444',
      legendFontColor: '#334155',
      legendFontSize: 12,
    },
  ];
  const visibleChartData = students.length
    ? chartData
    : [
        {
          name: 'No Students',
          population: 1,
          color: '#CBD5E1',
          legendFontColor: '#64748B',
          legendFontSize: 12,
        },
      ];

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return;
    }

    const fetchStudents = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("instituteId", "==", userData.instituteId),
          where("role", "==", "student")
        );
        const snapshot = await getDocs(q);
        const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const studentList = userData?.isClassTeacher
          ? allStudents.filter((student) => {
            if (isSchool) {
              return normalizeValue(student.class) === normalizeValue(userData.assignedClass) &&
                normalizeValue(student.section) === normalizeValue(userData.assignedSection);
            }

            return normalizeValue(student.dept) === normalizeValue(userData.assignedDept) &&
              normalizeValue(student.sem) === normalizeValue(userData.assignedSem);
          })
          : allStudents;
        
        studentList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        
        const initialRecord = {};
        studentList.forEach(s => initialRecord[s.id] = true);

        setStudents(studentList);
        setAttendanceRecord(initialRecord);
      } catch (error) {
        console.error("Error fetching students:", error);
        const err = "Could not load students for attendance.";
        if (Platform.OS === 'web') window.alert(err);
        else Alert.alert("Error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [userData, isSchool]);

  const toggleAttendance = (studentId) => {
    setAttendanceRecord(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleSubmitAttendance = async () => {
    if (students.length === 0) return;
    setSubmitting(true);

    try {
      const batch = writeBatch(db);
      const today = new Date().toISOString().split('T')[0];
      students.forEach((student) => {
        const isPresent = Boolean(attendanceRecord[student.id]);
        const studentUid = resolveStudentUid(student);
        const attendanceRef = doc(db, "attendance", createAttendanceDocId(userData.instituteId, studentUid, today));
        batch.set(attendanceRef, {
          instituteId: userData.instituteId,
          teacherId: userData.uid,
          teacherName: userData.name,
          studentId: studentUid,
          studentUid,
          studentDocId: student.id,
          studentUniqueId: student.uniqueId || null,
          studentEmail: student.email || '',
          studentName: student.name || '',
          targetPrimary: isSchool ? (student.class || userData.assignedClass || '') : (student.dept || userData.assignedDept || ''),
          targetSecondary: isSchool ? (student.section || userData.assignedSection || '') : (student.sem || userData.assignedSem || ''),
          status: isPresent ? 'present' : 'absent',
          isPresent,
          date: today,
          timestamp: serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();

      const msg = "Attendance securely logged for today.";
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert("Success", msg);
      }
    } catch (error) {
      console.error(error);
      const err = "Failed to submit attendance.";
      if (Platform.OS === 'web') {
        window.alert(err);
      } else {
        Alert.alert("Error", err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderStudent = ({ item }) => {
    const isPresent = attendanceRecord[item.id];
    
    return (
      <View style={[styles.studentCard, layout.isCompact && styles.studentCardCompact]}>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{(item.name || 'S').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.studentId} numberOfLines={1}>{item.email || item.uniqueId || item.id}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.toggleBtn, layout.isCompact && styles.toggleBtnCompact, isPresent ? styles.presentBtn : styles.absentBtn]}
          onPress={() => toggleAttendance(item.id)}
        >
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
        <SmoothSpinner size="large" color="#10B981" style={{ marginTop: 50 }} />
      ) : (
        <>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>
              {!userData?.isClassTeacher
                ? 'All Students'
                : isSchool
                ? `Class ${userData.assignedClass} - Sec ${userData.assignedSection}`
                : `${userData.assignedDept} - Sem ${userData.assignedSem}`
              }
            </Text>
            <Text style={styles.summarySub}>Mark absentees, then submit to the server.</Text>

            <View style={styles.pieWrap}>
              <PieChart
                data={visibleChartData}
                width={layout.chartWidth(440)}
                height={150}
                chartConfig={{ color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})` }}
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
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={renderStudent}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAttendance} disabled={submitting}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  summaryBox: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  summarySub: { fontSize: 13, color: '#64748B', marginTop: 4 },
  pieWrap: { alignItems: 'center', marginTop: 12, overflow: 'hidden' },
  counterRow: { flexDirection: 'row', marginTop: 10 },
  counterPill: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, marginRight: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  absentPill: { marginRight: 0, marginLeft: 8, backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  counterValue: { fontSize: 22, fontWeight: '900', color: '#10B981' },
  absentCounter: { color: '#EF4444' },
  counterLabel: { fontSize: 12, color: '#64748B', fontWeight: '700', marginTop: 2 },
  
  listContent: { padding: 16, paddingBottom: 100 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, elevation: 1 },
  studentCardCompact: { alignItems: 'flex-start', flexWrap: 'wrap' },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#64748B' },
  infoBox: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  studentId: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  toggleBtnCompact: { width: '100%', alignItems: 'center', marginTop: 12 },
  presentBtn: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  absentBtn: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  presentText: { color: '#10B981', fontWeight: 'bold', fontSize: 13 },
  absentText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', elevation: 10 },
  submitBtn: { backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

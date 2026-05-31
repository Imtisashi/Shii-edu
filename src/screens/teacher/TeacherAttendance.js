import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, Dimensions } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { PieChart } from 'react-native-chart-kit';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';

const screenWidth = Dimensions.get('window').width;

export default function TeacherAttendance() {
  const { userData } = useAuth();
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
    // SECURITY GATE: Only Class Teachers can load this data
    if (!userData?.isClassTeacher) {
      setLoading(false);
      return;
    }

    const fetchStudents = async () => {
      try {
        let q;
        if (isSchool) {
          q = query(
            collection(db, "users"),
            where("instituteId", "==", userData.instituteId),
            where("role", "==", "student"),
            where("class", "==", userData.assignedClass),
            where("section", "==", userData.assignedSection)
          );
        } else {
          q = query(
            collection(db, "users"),
            where("instituteId", "==", userData.instituteId),
            where("role", "==", "student"),
            where("dept", "==", userData.assignedDept),
            where("sem", "==", userData.assignedSem)
          );
        }

        const snapshot = await getDocs(q);
        const studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort alphabetically
        studentList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        
        // Default everyone to Present (true)
        const initialRecord = {};
        studentList.forEach(s => initialRecord[s.id] = true);

        setStudents(studentList);
        setAttendanceRecord(initialRecord);
      } catch (error) {
        console.error("Error fetching students:", error);
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
      students.forEach((student) => {
        const isPresent = Boolean(attendanceRecord[student.id]);
        batch.set(doc(collection(db, "attendance")), {
          instituteId: userData.instituteId,
          teacherId: userData.uid,
          teacherName: userData.name,
          studentId: student.id,
          studentName: student.name || '',
          targetPrimary: isSchool ? userData.assignedClass : userData.assignedDept,
          targetSecondary: isSchool ? userData.assignedSection : userData.assignedSem,
          status: isPresent ? 'present' : 'absent',
          isPresent,
          date: serverTimestamp()
        });
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
      <View style={styles.studentCard}>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{(item.name || 'S').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>{item.email}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.toggleBtn, isPresent ? styles.presentBtn : styles.absentBtn]}
          onPress={() => toggleAttendance(item.id)}
        >
          <Text style={[styles.toggleText, isPresent ? styles.presentText : styles.absentText]}>
            {isPresent ? 'Present' : 'Absent'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // If the user is NOT a class teacher, show the lock screen
  if (!loading && !userData?.isClassTeacher) {
    return (
      <View style={styles.container}>
        <DynamicHeader title="Attendance" showBack={true} />
        <View style={styles.lockContainer}>
          <Ionicons name="lock-closed" size={80} color="#CBD5E0" />
          <Text style={styles.lockTitle}>Access Denied</Text>
          <Text style={styles.lockSub}>
            Only assigned Class Advisors have the privileges to record daily attendance.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DynamicHeader title="Daily Attendance" showBack={true} />
      
      {loading ? (
        <SmoothSpinner size="large" color="#10B981" style={{ marginTop: 50 }} />
      ) : (
        <>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>
              {isSchool 
                ? `Class ${userData.assignedClass} - Sec ${userData.assignedSection}`
                : `${userData.assignedDept} - Sem ${userData.assignedSem}`
              }
            </Text>
            <Text style={styles.summarySub}>Mark absentees, then submit to the server.</Text>

            <View style={styles.pieWrap}>
              <PieChart
                data={visibleChartData}
                width={Math.min(screenWidth - 32, 440)}
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
  lockContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  lockTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginTop: 20 },
  lockSub: { fontSize: 15, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  
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
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#64748B' },
  infoBox: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  studentId: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  presentBtn: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  absentBtn: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  presentText: { color: '#10B981', fontWeight: 'bold', fontSize: 13 },
  absentText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', elevation: 10 },
  submitBtn: { backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

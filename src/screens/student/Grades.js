import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function Grades() {
  const { userData } = useAuth();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ average: 0, totalExams: 0 });

  useEffect(() => {
    if (!userData?.uid) return;

    // Listen for grades belonging ONLY to this student
    const q = query(
      collection(db, "grades"),
      where("studentId", "==", userData.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gradeList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate simple stats
      if (gradeList.length > 0) {
        const sum = gradeList.reduce((acc, curr) => acc + curr.percentage, 0);
        setStats({
          average: (sum / gradeList.length).toFixed(1),
          totalExams: gradeList.length
        });
      }

      setGrades(gradeList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  const renderGradeItem = ({ item }) => (
    <View style={styles.gradeCard}>
      <View style={styles.cardLeft}>
        <Text style={styles.subjectText}>{item.subject}</Text>
        <Text style={styles.examTypeText}>{item.examType}</Text>
        <Text style={styles.dateText}>
          {item.timestamp?.toDate().toLocaleDateString()} - {item.teacherName}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.scoreText}>{item.marks}/{item.totalMarks}</Text>
        <View style={[
          styles.percentBadge, 
          { backgroundColor: item.percentage >= 40 ? '#E8F5E9' : '#FFEBEE' }
        ]}>
          <Text style={[
            styles.percentText, 
            { color: item.percentage >= 40 ? '#2E7D32' : '#C62828' }
          ]}>
            {item.percentage.toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <SmoothSpinner size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Performance Summary Header */}
      <View style={styles.summaryHeader}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Average Score</Text>
          <Text style={styles.statValue}>{stats.average}%</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Exams Recorded</Text>
          <Text style={styles.statValue}>{stats.totalExams}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Academic History</Text>
      
      <FlatList
        data={grades}
        keyExtractor={(item) => item.id}
        renderItem={renderGradeItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={50} color="#CBD5E0" />
            <Text style={styles.emptyText}>No grades have been published yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryHeader: { 
    backgroundColor: '#1E293B', 
    padding: 20, 
    borderRadius: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-around',
    marginBottom: 25,
    elevation: 4
  },
  statBox: { alignItems: 'center' },
  statLabel: { color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', marginBottom: 5 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  divider: { width: 1, height: '100%', backgroundColor: '#334155' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  gradeCard: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 15, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardLeft: { flex: 1 },
  subjectText: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  examTypeText: { fontSize: 13, color: '#64748B', marginVertical: 2 },
  dateText: { fontSize: 11, color: '#94A3B8' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center' },
  scoreText: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 5 },
  percentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  percentText: { fontWeight: 'bold', fontSize: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', marginTop: 10, fontSize: 14 }
});

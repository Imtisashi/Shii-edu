import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function Assignments() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId) return;
    
    // Grabs ALL assignments posted for this campus
    const q = query(
      collection(db, "assignments"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nextTasks = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
      setTasks(nextTasks);
      setLoading(false);
    }, (error) => {
      console.error('Assignments query failed:', error);
      setTasks([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  if (loading) return <SmoothSpinner style={{marginTop: 50}} color="#EF6C00" />;

  return (
    <View style={styles.container}>
      <DynamicHeader title="My Tasks" showBack={true} />
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconBox}>
                <Ionicons name="book" size={20} color="#EF6C00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.teacherName}>By: {item.teacherName}</Text>
              </View>
              <View style={styles.dueBadge}>
                <Text style={styles.dueText}>Due: {item.dueDate}</Text>
              </View>
            </View>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <Ionicons name="checkmark-done-circle-outline" size={50} color="#CBD5E0" />
            <Text style={styles.empty}>You have no pending tasks. Good job!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBox: { backgroundColor: '#FFF3E0', padding: 10, borderRadius: 10, marginRight: 15 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  teacherName: { fontSize: 12, color: '#64748B', marginTop: 2 },
  dueBadge: { backgroundColor: '#FFEDD5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dueText: { fontSize: 10, color: '#C2410C', fontWeight: 'bold' },
  description: { fontSize: 14, color: '#475569', lineHeight: 22, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8 },
  empty: { textAlign: 'center', marginTop: 10, color: '#94A3B8' }
});

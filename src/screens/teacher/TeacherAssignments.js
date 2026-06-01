import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';

export default function TeacherAssignments({ navigation }) {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const assignmentQuery = query(
      collection(db, 'assignments'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(assignmentQuery, (snapshot) => {
      const nextAssignments = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((assignment) => !assignment.teacherId || assignment.teacherId === userData.uid)
        .sort((a, b) => String(b.createdAt?.seconds || '').localeCompare(String(a.createdAt?.seconds || '')));
      setAssignments(nextAssignments);
      setLoading(false);
    }, (error) => {
      console.error('Teacher assignments failed:', error);
      setAssignments([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.instituteId, userData?.uid]);

  return (
    <View style={styles.container}>
      <DynamicHeader title="Assignments" showBack />

      <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('UploadAssignment')}>
        <Ionicons name="add-circle" size={22} color="#FFFFFF" />
        <Text style={styles.createBtnText}>Create Assignment</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <SmoothSpinner color="#F59E0B" />
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="document-text" size={22} color="#F59E0B" />
              </View>
              <View style={styles.info}>
                <Text style={styles.title}>{item.title || item.course || 'Untitled assignment'}</Text>
                <Text style={styles.meta}>Due: {item.dueDate || 'No due date'}</Text>
                <Text style={styles.description}>{item.description || item.question || 'No details provided.'}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={52} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No assignments yet</Text>
              <Text style={styles.emptyText}>Create one and it will appear for students immediately.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 15, margin: 16, marginBottom: 4 },
  createBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, marginLeft: 8 },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1, minWidth: 0 },
  title: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  meta: { color: '#C2410C', fontSize: 12, fontWeight: '900', marginTop: 4 },
  description: { color: '#64748B', marginTop: 6, lineHeight: 20 },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 28 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 14 },
  emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 21, marginTop: 6 },
});

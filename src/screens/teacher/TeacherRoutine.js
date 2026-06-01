import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';
import { getInstitutionProfile } from '../../services/institutionalProfile';

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const sortRoutine = (a, b) => {
  const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return String(a.time || '').localeCompare(String(b.time || ''), undefined, { numeric: true, sensitivity: 'base' });
};

export default function TeacherRoutine() {
  const { userData } = useAuth();
  const profile = getInstitutionProfile(userData);
  const [routine, setRoutine] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId || !userData?.uid) {
      setLoading(false);
      return undefined;
    }

    const routineQuery = query(
      collection(db, 'routines'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(routineQuery, (snapshot) => {
      const teacherRoutine = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((item) => item.teacherId === userData.uid || item.teacherUid === userData.uid)
        .sort(sortRoutine);
      setRoutine(teacherRoutine);
      setLoading(false);
    }, (error) => {
      console.error('Teacher routine query failed:', error);
      setRoutine([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.instituteId, userData?.uid]);

  const groupedRoutine = useMemo(() => routine, [routine]);

  return (
    <View style={styles.container}>
      <DynamicHeader title="My Routine" showBack />

      {loading ? (
        <View style={styles.center}>
          <SmoothSpinner color="#E11D48" />
          <Text style={styles.loadingText}>Loading routine...</Text>
        </View>
      ) : (
        <FlatList
          data={groupedRoutine}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayText}>{item.day || 'Day'}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.subject}>{item.subject || 'Untitled class'}</Text>
                <Text style={styles.time}>{item.time || 'Time not set'}</Text>
                <Text style={styles.target}>
                  {profile.isCollege
                    ? `${item.dept || item.targetPrimary || 'Department'} - Sem ${item.sem || item.targetSecondary || 'N/A'}`
                    : `Class ${item.class || item.targetPrimary || 'N/A'} - Sec ${item.section || item.targetSecondary || 'N/A'}`}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={52} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No routine assigned yet</Text>
              <Text style={styles.emptyText}>When admin uploads the master routine, your classes will appear here automatically.</Text>
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
  loadingText: { color: '#64748B', fontWeight: '800', marginTop: 10 },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  dayBadge: { backgroundColor: '#FFE4E6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start', marginRight: 14 },
  dayText: { color: '#BE123C', fontWeight: '900', fontSize: 12 },
  info: { flex: 1, minWidth: 0 },
  subject: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  time: { color: '#475569', marginTop: 4, fontWeight: '700' },
  target: { color: '#10B981', marginTop: 6, fontSize: 12, fontWeight: '900' },
  emptyState: { alignItems: 'center', marginTop: 90, paddingHorizontal: 28 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 14 },
  emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 21, marginTop: 6 },
});

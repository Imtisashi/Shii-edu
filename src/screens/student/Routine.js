import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';

const sortByTime = (a, b) => String(a.time || '').localeCompare(String(b.time || ''), undefined, {
  numeric: true,
  sensitivity: 'base',
});

export default function Routine() {
  const { userData } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  const userClass = String(userData?.class || 'Not Set');
  const userSection = String(userData?.section || 'Not Set');
  const userDept = String(userData?.dept || 'Not Set');
  const userSem = String(userData?.sem || 'Not Set');
  const isSchool = userData?.instituteData?.type === 'school';

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const routinesRef = collection(db, 'routines');
    const routineQuery = query(
      routinesRef,
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(routineQuery, (snapshot) => {
      const docs = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((item) => {
          if (isSchool) {
            return String(item.class || item.targetPrimary || '') === userClass &&
              String(item.section || item.targetSecondary || '') === userSection;
          }

          return String(item.dept || item.targetPrimary || '') === userDept &&
            String(item.sem || item.targetSecondary || '') === userSem;
        })
        .sort(sortByTime);
      setSchedule(docs);
      setLoading(false);
    }, (error) => {
      console.error('Routine Query Error:', error);
      setSchedule([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSchool, userData?.instituteId, userClass, userSection, userDept, userSem]);

  if (loading) {
    return <SmoothSpinner style={{ marginTop: 50 }} color="#4A90E2" size="large" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={schedule}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.timeBox}>
              <Text style={styles.time}>{item.time || 'TBA'}</Text>
            </View>
            <View style={styles.detailsBox}>
              <Text style={styles.subject}>{item.subject || 'Untitled class'}</Text>
              <Text style={styles.room}>Room: {item.room || 'TBA'}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={50} color="#CBD5E0" />
            <Text style={styles.empty}>No routine matches your profile.</Text>
            <Text style={styles.emptySub}>
              Ensure your admin uploaded data for {isSchool ? `Class ${userClass}` : userDept}.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  listContent: { padding: 15, paddingBottom: 80 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  timeBox: { width: 85, borderRightWidth: 1, borderRightColor: '#EDF2F7', marginRight: 15 },
  time: { fontWeight: 'bold', color: '#4A90E2' },
  detailsBox: { flex: 1 },
  subject: { fontSize: 16, fontWeight: 'bold' },
  room: { fontSize: 12, color: '#64748B', marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  empty: { textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: 'bold', color: '#64748B' },
  emptySub: { color: '#94A3B8', textAlign: 'center', marginTop: 5 },
});

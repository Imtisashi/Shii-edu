import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function Routine() {
  const { userData } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Debug variables to see what's being sent to Firebase
  const userClass = String(userData?.class || "Not Set");
  const userSection = String(userData?.section || "Not Set");
  const userDept = String(userData?.dept || "Not Set");
  const userSem = String(userData?.sem || "Not Set");

  useEffect(() => {
    if (!userData?.instituteId) return;

    const routinesRef = collection(db, "routines");
    let q;

    try {
      if (userData.instituteData?.type === 'school') {
        // Query for Shii HSS Students
        q = query(
          routinesRef,
          where("instituteId", "==", userData.instituteId),
          where("class", "==", userClass),
          where("section", "==", userSection),
          orderBy("time", "asc")
        );
      } else {
        // Query for AzuAk College Students
        q = query(
          routinesRef,
          where("instituteId", "==", userData.instituteId),
          where("dept", "==", userDept),
          where("sem", "==", userSem),
          orderBy("time", "asc")
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSchedule(docs);
        setLoading(false);
      }, (error) => {
        console.error("Routine Query Error:", error);
        // CRITICAL: If you see this Alert, check your Browser Console for the Index Link
        if (error.code === 'failed-precondition') {
          Alert.alert("Index Required", "Firestore needs an index for this query. Check your Browser Console and click the provided link.");
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Effect Error:", err);
      setLoading(false);
    }
  }, [userData, userClass, userSection, userDept, userSem]);

  if (loading) return <SmoothSpinner style={{marginTop: 50}} color="#4A90E2" size="large" />;

  return (
    <View style={styles.container}>
      {/* DEBUG HEADER - Helpful for testing Shii HSS or AzuAk */}
      <View style={styles.debugBanner}>
        <Text style={styles.debugText}>
          🔍 Searching: {userData?.instituteData?.type === 'school' 
            ? `Class ${userClass} | Sec ${userSection}` 
            : `${userDept} | Sem ${userSem}`}
        </Text>
      </View>

      <FlatList
        data={schedule}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.timeBox}>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <View style={styles.detailsBox}>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.room}>Room: {item.room}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={50} color="#CBD5E0" />
            <Text style={styles.empty}>No routine matches your profile.</Text>
            <Text style={styles.emptySub}>Ensure your Admin uploaded data for {userData?.instituteData?.type === 'school' ? `Class ${userClass}` : userDept}.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  debugBanner: { backgroundColor: '#E2E8F0', padding: 10, alignItems: 'center' },
  debugText: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  timeBox: { width: 85, borderRightWidth: 1, borderRightColor: '#EDF2F7', marginRight: 15 },
  time: { fontWeight: 'bold', color: '#4A90E2' },
  detailsBox: { flex: 1 },
  subject: { fontSize: 16, fontWeight: 'bold' },
  room: { fontSize: 12, color: '#64748B', marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  empty: { textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: 'bold', color: '#64748B' },
  emptySub: { color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40, marginTop: 5 }
});
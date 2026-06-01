import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';

export default function TeachersProfile() {
  const { userData } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId) return;

    // Fetch actual teachers from this specific campus
    const q = query(
      collection(db, "users"),
      where("instituteId", "==", userData.instituteId),
      where("role", "==", "teacher")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const renderTeacherCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons name="briefcase-outline" size={12} color="#3182CE" style={{marginRight: 4}} />
            <Text style={styles.badgeText}>Faculty</Text>
          </View>
          <View style={[styles.badge, styles.codeBadge]}>
            <Text style={[styles.badgeText, styles.codeBadgeText]}>Code: {item.teacherCode}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <DynamicHeader title="Our Faculty" showBack={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <SmoothSpinner size="large" color="#4A90E2" />
        </View>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id}
          renderItem={renderTeacherCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="people-outline" size={50} color="#CBD5E0" />
              <Text style={{ color: '#718096', marginTop: 10 }}>No faculty registered yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#4A90E2', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  infoContainer: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', marginBottom: 4 },
  email: { fontSize: 13, color: '#718096', marginBottom: 8 },
  badgeRow: { flexDirection: 'row' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF4FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 },
  badgeText: { fontSize: 11, color: '#3182CE', fontWeight: '600' },
  codeBadge: { backgroundColor: '#EDF2F7' },
  codeBadgeText: { color: '#4A5568' }
});

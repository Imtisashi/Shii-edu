import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export default function Notices() {
  const { userData } = useAuth();
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    if (!userData?.instituteId) return;
    const q = query(
      collection(db, "notices"),
      where("instituteId", "==", userData.instituteId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userData]);

  const renderItem = ({ item }) => (
    <View style={styles.noticeCard}>
      <Text style={styles.noticeTitle}>{item.title}</Text>
      <Text style={styles.noticeBody}>{item.content}</Text>
      <View style={styles.footer}>
        <Text style={styles.metaText}>{item.author}</Text>
        <Text style={styles.metaText}>{item.createdAt?.toDate().toLocaleDateString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No notices at the moment.</Text>}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  noticeCard: { backgroundColor: '#fff', padding: 18, borderRadius: 15, marginBottom: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#4A90E2' },
  noticeTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
  noticeBody: { color: '#4A5568', marginVertical: 10, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 10 },
  metaText: { fontSize: 12, color: '#A0AEC0', fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#A0AEC0', marginTop: 50 }
});
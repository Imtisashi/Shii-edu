import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function PYQView() {
  const { userData } = useAuth();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "pyqs"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPapers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  if (loading) return <ActivityIndicator style={{marginTop: 50}} color="#43A047" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={papers}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)}
          >
            <Ionicons name="document-text" size={30} color="#43A047" style={{marginRight: 15}} />
            <View style={{flex: 1}}>
              <Text style={styles.title}>{item.subject} - {item.year}</Text>
              <Text style={styles.desc}>Tap to download PDF</Text>
            </View>
            <Ionicons name="download-outline" size={24} color="#64748B" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No past papers uploaded.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: '#E8F5E9' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  desc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 50, color: '#94A3B8' }
});
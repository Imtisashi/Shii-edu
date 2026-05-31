import React, { useState, useEffect } from 'react';
import { View, FlatList, Image, StyleSheet, Dimensions, Text, ActivityIndicator } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; // FIXED PATH
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function GalleryView() {
  const { userData } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "gallery"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} color="#4A90E2" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No campus photos uploaded yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: width / 3 - 2, height: width / 3 - 2, margin: 1 },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8' }
});
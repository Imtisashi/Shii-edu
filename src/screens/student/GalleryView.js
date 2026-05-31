import React, { useState, useEffect } from 'react';
import { View, FlatList, Image, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; // FIXED PATH
import { useAuth } from '../../contexts/AuthContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

export default function GalleryView() {
  const { userData } = useAuth();
  const layout = useResponsiveLayout();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const gridGap = layout.isDesktop ? 8 : 2;
  const imageSize = Math.floor((layout.availableWidth - gridGap * (layout.galleryColumns - 1)) / layout.galleryColumns);

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
        key={String(layout.galleryColumns)}
        data={photos}
        numColumns={layout.galleryColumns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image source={{ uri: item.imageUrl }} style={[styles.image, { width: imageSize, height: imageSize }]} />
        )}
        contentContainerStyle={[
          styles.galleryContent,
          { paddingHorizontal: layout.horizontalPadding, gap: gridGap },
          layout.isDesktop && styles.galleryContentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        columnWrapperStyle={layout.galleryColumns > 1 ? { gap: gridGap } : undefined}
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
  galleryContent: { paddingVertical: 16 },
  galleryContentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  image: { borderRadius: 8, backgroundColor: '#E2E8F0' },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8' }
});

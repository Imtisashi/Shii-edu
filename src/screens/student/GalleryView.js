import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { listSupabaseGallery } from '../../services/supabaseTenantDataService';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

function LoadingState() {
  return <RosterSkeleton rowCount={6} showFilters={false} />;
}

function GalleryTile({ imageSize, item }) {
  const { colors } = useRootLayout();
  const imageUrl = item.imageUrl || item.photoURL || item.url;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          height: imageSize,
          width: imageSize,
        },
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.missingImage}>
          <Ionicons name="image-outline" size={26} color={colors.muted} />
        </View>
      )}
    </View>
  );
}

function EmptyState() {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: '#500724', borderColor: colors.hairline }]}>
        <Ionicons name="images-outline" size={34} color="#F472B6" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No campus photos yet</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>Your institute gallery will appear after admins upload media.</Text>
    </View>
  );
}

export default function GalleryView() {
  const { currentUser, userData } = useAuth();
  const { colors } = useRootLayout();
  const layout = useResponsiveLayout();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const gridGap = layout.isDesktop ? 10 : 6;
  const imageSize = Math.floor((layout.availableWidth - gridGap * (layout.galleryColumns - 1)) / layout.galleryColumns);

  const visiblePhotos = useMemo(
    () => [...photos].sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt)),
    [photos]
  );

  useEffect(() => {
    if (!userData?.instituteId) {
      setPhotos([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let cancelled = false;
    let unsubscribeFirestore = null;

    const startFirestoreFallback = () => {
      const galleryQuery = query(
        collection(db, 'gallery'),
        where('instituteId', '==', userData.instituteId)
      );

      unsubscribeFirestore = onSnapshot(galleryQuery, (snapshot) => {
        if (cancelled) return;
        setPhotos(snapshot.docs.map((document) => ({ id: document.id, ...document.data(), dataSource: 'firestore' })));
        setLoading(false);
      }, (error) => {
        if (cancelled) return;
        console.error('Gallery query failed:', error);
        setPhotos([]);
        setLoading(false);
      });
    };

    listSupabaseGallery(currentUser)
      .then(({ images: supabaseImages }) => {
        if (cancelled) return;
        setPhotos(Array.isArray(supabaseImages) ? supabaseImages : []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Supabase gallery student bridge failed, falling back to Firestore:', error);
        startFirestoreFallback();
      });

    return () => {
      cancelled = true;
      if (typeof unsubscribeFirestore === 'function') unsubscribeFirestore();
    };
  }, [currentUser, userData?.instituteId]);

  if (loading) return <LoadingState />;

  return (
    <StudentScreenScaffold accentVariant="blue" scroll={false} style={styles.scaffoldContent}>
      <ScreenIntro
        accentColor="#F472B6"
        eyebrow="Campus gallery"
        subtitle="Moments, events, and institute media uploaded by your campus team."
        title="Gallery"
        trailing={<Ionicons name="images" size={27} color="#F472B6" />}
      />
      <EnterprisePanel style={styles.summaryPanel}>
        <Ionicons name="albums-outline" size={20} color="#F472B6" />
        <Text style={[styles.summaryText, { color: colors.text }]}>
          {visiblePhotos.length} photo{visiblePhotos.length === 1 ? '' : 's'} published
        </Text>
      </EnterprisePanel>
      <FlatList
        key={String(layout.galleryColumns)}
        data={visiblePhotos}
        numColumns={layout.galleryColumns}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState />}
        columnWrapperStyle={layout.galleryColumns > 1 ? { gap: gridGap } : undefined}
        contentContainerStyle={[styles.galleryContent, { gap: gridGap }]}
        renderItem={({ item }) => <GalleryTile imageSize={imageSize} item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </StudentScreenScaffold>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 16,
    width: 72,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  galleryContent: {
    paddingBottom: 8,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  missingImage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  scaffoldContent: {
    flex: 1,
  },
  summaryPanel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    padding: 14,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '900',
  },
  tile: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
});

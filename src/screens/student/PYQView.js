import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function PYQView() {
  const { userData } = useAuth();
  const layout = useResponsiveLayout();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  const visiblePapers = useMemo(
    () => [...papers].sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt)),
    [papers]
  );

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, "pyqs"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPapers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error loading PYQs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  return (
    <View style={styles.container}>
      <DynamicHeader title="Previous Papers" showBack />
      <FlatList
        data={visiblePapers}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.horizontalPadding },
          layout.isDesktop && styles.contentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.hero, layout.isMobile && styles.heroMobile]}>
            <View style={styles.heroIcon}>
              <Ionicons name="library" size={27} color="#2563EB" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, layout.isMobile && styles.heroTitleMobile]}>PYQ Vault</Text>
              <Text style={styles.heroText}>Download verified previous-year question papers uploaded by your institute.</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)}
          >
            <View style={styles.fileIcon}>
              <Ionicons name="document-text" size={25} color="#DC2626" />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.title} numberOfLines={1}>{item.title || `${item.subject} - ${item.year}`}</Text>
              <Text style={styles.desc} numberOfLines={1}>{item.subject || 'Subject'} - {item.year || 'Year'} - PDF</Text>
              <Text style={styles.uploadedBy} numberOfLines={1}>Uploaded by {item.uploadedBy || 'Faculty'}</Text>
            </View>
            <View style={styles.downloadButton}>
              <Ionicons name="download-outline" size={22} color="#2563EB" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <SmoothSpinner color="#2563EB" />
              <Text style={styles.emptyText}>Loading papers...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-attach-outline" size={46} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No PYQs yet</Text>
              <Text style={styles.emptyText}>Your institute has not uploaded previous-year papers yet.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: 16, paddingBottom: 110 },
  contentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  hero: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMobile: { alignItems: 'flex-start' },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  heroTitleMobile: { fontSize: 22 },
  heroText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginTop: 5 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  desc: { fontSize: 13, color: '#64748B', fontWeight: '700', marginTop: 3 },
  uploadedBy: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  downloadButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#FFFFFF', borderRadius: 20 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 12 },
  emptyText: { textAlign: 'center', marginTop: 8, color: '#94A3B8', lineHeight: 20 }
});

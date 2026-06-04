import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { listSupabasePyqs } from '../../services/supabaseTenantDataService';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

function LoadingState() {
  return <RosterSkeleton rowCount={5} showFilters={false} />;
}

function PaperCard({ item }) {
  const { colors, radii } = useRootLayout();
  const title = item.title || `${item.subject || 'Subject'} - ${item.year || 'Year'}`;

  return (
    <TouchableOpacity
      accessibilityLabel={`Open ${title}`}
      accessibilityRole="button"
      disabled={!item.fileUrl}
      onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.card,
          opacity: item.fileUrl ? 1 : 0.72,
        },
      ]}
    >
      <View style={[styles.fileIcon, { backgroundColor: '#450A0A', borderColor: colors.hairline }]}>
        <Ionicons name="document-text" size={23} color="#F87171" />
      </View>
      <View style={styles.cardCopy}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.desc, { color: colors.textSoft }]}>
          {item.subject || 'Subject'} - {item.year || 'Year'} - PDF
        </Text>
        <Text numberOfLines={1} style={[styles.uploadedBy, { color: colors.muted }]}>
          Uploaded by {item.uploadedBy || 'Faculty'}
        </Text>
      </View>
      <View style={[styles.downloadButton, { backgroundColor: colors.deepBlueSoft, borderColor: colors.hairline }]}>
        <Ionicons name="download-outline" size={21} color={colors.deepBlue} />
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: '#450A0A', borderColor: colors.hairline }]}>
        <Ionicons name="document-attach-outline" size={34} color="#F87171" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No PYQs yet</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>Your institute has not uploaded previous-year papers yet.</Text>
    </View>
  );
}

export default function PYQView() {
  const { currentUser, userData } = useAuth();
  const { colors } = useRootLayout();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  const visiblePapers = useMemo(
    () => [...papers].sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt)),
    [papers]
  );

  useEffect(() => {
    if (!userData?.instituteId) {
      setPapers([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let cancelled = false;
    let unsubscribeFirestore = null;

    const startFirestoreFallback = () => {
      const papersQuery = query(
        collection(db, 'pyqs'),
        where('instituteId', '==', userData.instituteId)
      );

      unsubscribeFirestore = onSnapshot(papersQuery, (snapshot) => {
        if (cancelled) return;
        setPapers(snapshot.docs.map((document) => ({ id: document.id, ...document.data(), dataSource: 'firestore' })));
        setLoading(false);
      }, (error) => {
        if (cancelled) return;
        console.error('Error loading PYQs:', error);
        setPapers([]);
        setLoading(false);
      });
    };

    listSupabasePyqs(currentUser)
      .then(({ papers: supabasePapers }) => {
        if (cancelled) return;
        setPapers(Array.isArray(supabasePapers) ? supabasePapers : []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Supabase PYQ student bridge failed, falling back to Firestore:', error);
        startFirestoreFallback();
      });

    return () => {
      cancelled = true;
      if (typeof unsubscribeFirestore === 'function') unsubscribeFirestore();
    };
  }, [currentUser, userData?.instituteId]);

  if (loading) return <LoadingState />;

  return (
    <StudentScreenScaffold accentVariant="bronze" scroll={false} style={styles.scaffoldContent}>
      <ScreenIntro
        accentColor="#F87171"
        eyebrow="Exam archive"
        subtitle="Download verified previous-year question papers uploaded by your institute."
        title="PYQ Vault"
        trailing={<Ionicons name="library" size={27} color="#F87171" />}
      />
      <EnterprisePanel style={styles.summaryPanel}>
        <Ionicons name="documents-outline" size={20} color="#F87171" />
        <Text style={[styles.summaryText, { color: colors.text }]}>
          {visiblePapers.length} paper{visiblePapers.length === 1 ? '' : 's'} available
        </Text>
      </EnterprisePanel>
      <FlatList
        data={visiblePapers}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <PaperCard item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </StudentScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 12,
    overflow: 'hidden',
    padding: 15,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  desc: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  downloadButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginLeft: 8,
    width: 44,
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
  fileIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  listContent: {
    paddingBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
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
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  uploadedBy: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
});

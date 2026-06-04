import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { listSupabaseAssignments } from '../../services/supabaseTenantDataService';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDueDate = (dueDate) => {
  if (!dueDate) return 'No due date';
  if (typeof dueDate.toDate === 'function') return dueDate.toDate().toLocaleDateString();
  if (dueDate.seconds) return new Date(dueDate.seconds * 1000).toLocaleDateString();
  return String(dueDate);
};

const mergeTaskLists = (...lists) => {
  const byId = new Map();
  lists.flat().forEach((task) => {
    if (!task) return;
    const key = String(task.supabaseId || task.id || `${task.title}-${task.createdAt}`);
    byId.set(key, task);
  });
  return Array.from(byId.values()).sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
};

function SectionHeader({ count }) {
  const { colors, typography } = useRootLayout();

  return (
    <View style={styles.headerBlock}>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>Student workspace</Text>
      <Text style={[styles.screenTitle, { color: colors.text, fontFamily: typography.title }]}>Tasks</Text>
      <Text style={[styles.screenSubtitle, { color: colors.textSoft }]}>
        Assignments, due work, and campus learning prompts in one clean stream.
      </Text>
      <View style={[styles.summaryPill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
        <Ionicons name="book-outline" size={16} color={colors.amber} />
        <Text style={[styles.summaryText, { color: colors.text }]}>{count} active task{count === 1 ? '' : 's'}</Text>
      </View>
    </View>
  );
}

function TaskCard({ item }) {
  const { colors, radii } = useRootLayout();
  const dueDate = formatDueDate(item.dueDate);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.card,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconOrb, { backgroundColor: colors.amberSoft, borderColor: colors.hairline }]}>
          <Ionicons name="book" size={22} color={colors.amber} />
        </View>
        <View style={styles.cardTitleBlock}>
          <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.text }]}>
            {item.title || 'Untitled assignment'}
          </Text>
          <Text numberOfLines={1} style={[styles.cardMeta, { color: colors.muted }]}>
            By {item.teacherName || 'Faculty'}
          </Text>
        </View>
      </View>

      <Text numberOfLines={4} style={[styles.description, { color: colors.textSoft }]}>
        {item.description || 'No assignment description was provided.'}
      </Text>

      <View style={styles.cardFooter}>
        <View style={[styles.duePill, { backgroundColor: colors.amberSoft, borderColor: colors.hairline }]}>
          <Ionicons name="time-outline" size={14} color={colors.amber} />
          <Text numberOfLines={1} style={[styles.dueText, { color: colors.text }]}>
            {dueDate}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState() {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
        <Ionicons name="checkmark-done-circle-outline" size={34} color={colors.emerald} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No pending tasks</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>Everything is clear for now.</Text>
    </View>
  );
}

export default function Assignments() {
  const { currentUser, userData } = useAuth();
  const { colors, insets, isDesktop, maxContentWidth, spacing } = useRootLayout();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId) {
      setTasks([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let didCancel = false;
    let supabaseTasks = [];
    let firestoreTasks = [];
    const publish = () => {
      if (didCancel) return;
      setTasks(mergeTaskLists(supabaseTasks, firestoreTasks));
      setLoading(false);
    };

    if (currentUser) {
      listSupabaseAssignments(currentUser)
        .then((result) => {
          supabaseTasks = Array.isArray(result?.assignments) ? result.assignments : [];
          publish();
        })
        .catch((error) => {
          console.warn('Supabase assignments unavailable, using Firestore fallback:', error);
          publish();
        });
    }

    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(assignmentsQuery, (snapshot) => {
      firestoreTasks = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      publish();
    }, (error) => {
      console.warn('Assignments Firestore fallback failed:', error);
      firestoreTasks = [];
      publish();
    });

    return () => {
      didCancel = true;
      unsubscribe();
    };
  }, [currentUser, userData?.instituteId]);

  const listStyle = useMemo(() => ({
    alignSelf: 'center',
    maxWidth: isDesktop ? maxContentWidth : undefined,
    paddingBottom: Math.max(insets.bottom, 10) + 104,
    paddingHorizontal: spacing.pageX,
    paddingTop: Math.max(insets.top, 12) + 26,
    width: '100%',
  }), [insets.bottom, insets.top, isDesktop, maxContentWidth, spacing.pageX]);

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      {loading ? (
        <View style={styles.loadingState}>
          <SmoothSpinner size={42} color={colors.amber} trackColor={colors.hairline} />
          <Text style={[styles.loadingText, { color: colors.textSoft }]}>Loading tasks...</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<EmptyState />}
          ListHeaderComponent={<SectionHeader count={tasks.length} />}
          contentContainerStyle={listStyle}
          renderItem={({ item }) => <TaskCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 18,
  },
  cardFooter: {
    alignItems: 'flex-start',
    marginTop: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  container: {
    flex: 1,
  },
  description: {
    backgroundColor: '#111827',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    padding: 14,
  },
  duePill: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dueText: {
    fontSize: 12,
    fontWeight: '900',
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
    minHeight: 260,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerBlock: {
    marginBottom: 22,
  },
  iconOrb: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  screenSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 620,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
  },
  summaryPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '900',
  },
});

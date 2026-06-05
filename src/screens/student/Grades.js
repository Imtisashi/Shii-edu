import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { listSupabaseGrades } from '../../services/supabaseTenantDataService';

const timestampToMillis = (timestamp) => {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDate = (timestamp) => {
  const millis = timestampToMillis(timestamp);
  return millis ? new Date(millis).toLocaleDateString() : 'Date pending';
};

const toPercentage = (item) => {
  const explicit = Number(item?.percentage);
  if (Number.isFinite(explicit)) return explicit;
  const marks = Number(item?.marks || 0);
  const totalMarks = Number(item?.totalMarks || 0);
  return totalMarks > 0 ? (marks / totalMarks) * 100 : 0;
};

const mergeGradeLists = (...lists) => {
  const byId = new Map();
  lists.flat().forEach((grade) => {
    if (!grade) return;
    const key = String(grade.supabaseId || grade.id || `${grade.subject}-${grade.examType}-${grade.timestamp}`);
    byId.set(key, grade);
  });
  return Array.from(byId.values())
    .sort((a, b) => timestampToMillis(b.timestamp || b.createdAt) - timestampToMillis(a.timestamp || a.createdAt));
};

function LoadingState() {
  return <RosterSkeleton rowCount={5} showFilters={false} />;
}

function StatsHero({ average, totalExams }) {
  const { colors } = useRootLayout();

  return (
    <EnterprisePanel style={styles.statsHero}>
      <View style={styles.statBox}>
        <Text style={[styles.statLabel, { color: colors.muted }]}>Average score</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{average}%</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      <View style={styles.statBox}>
        <Text style={[styles.statLabel, { color: colors.muted }]}>Exams recorded</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{totalExams}</Text>
      </View>
    </EnterprisePanel>
  );
}

function GradeCard({ item }) {
  const { colors, radii } = useRootLayout();
  const percentage = toPercentage(item);
  const passed = percentage >= 40;
  const statusColor = passed ? colors.emerald : '#F87171';
  const statusSoft = passed ? colors.emeraldSoft : '#450A0A';

  return (
    <View
      style={[
        styles.gradeCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.card,
        },
      ]}
    >
      <View style={styles.gradeLeft}>
        <View style={[styles.subjectIcon, { backgroundColor: colors.amberSoft, borderColor: colors.hairline }]}>
          <Ionicons name="school" size={20} color={colors.amber} />
        </View>
        <View style={styles.gradeText}>
          <Text numberOfLines={1} style={[styles.subjectText, { color: colors.text }]}>
            {item.subject || 'Untitled subject'}
          </Text>
          <Text numberOfLines={1} style={[styles.examText, { color: colors.textSoft }]}>
            {item.examType || 'Assessment'}
          </Text>
          <Text numberOfLines={1} style={[styles.metaText, { color: colors.muted }]}>
            {formatDate(item.timestamp || item.createdAt)} - {item.teacherName || 'Faculty'}
          </Text>
        </View>
      </View>

      <View style={styles.gradeRight}>
        <Text style={[styles.scoreText, { color: colors.text }]}>
          {Number(item.marks || 0)}/{Number(item.totalMarks || 0)}
        </Text>
        <View style={[styles.percentBadge, { backgroundColor: statusSoft, borderColor: colors.hairline }]}>
          <Text style={[styles.percentText, { color: statusColor }]}>{percentage.toFixed(0)}%</Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState() {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.amberSoft, borderColor: colors.hairline }]}>
        <Ionicons name="school-outline" size={34} color={colors.amber} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No grades yet</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>Published results will appear here.</Text>
    </View>
  );
}

export default function Grades() {
  const { currentUser, userData } = useAuth();
  const { colors } = useRootLayout();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.uid || !userData?.instituteId) {
      setGrades([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let didCancel = false;
    let supabaseGrades = [];
    let firestoreGrades = [];
    const publish = () => {
      if (didCancel) return;
      setGrades(mergeGradeLists(supabaseGrades, firestoreGrades));
      setLoading(false);
    };

    if (currentUser) {
      listSupabaseGrades(currentUser)
        .then((result) => {
          supabaseGrades = Array.isArray(result?.grades) ? result.grades : [];
          publish();
        })
        .catch((error) => {
          console.warn('Supabase grades unavailable, using Firestore fallback:', error);
          publish();
        });
    }

    const gradesQuery = query(
      collection(db, 'grades'),
      where('studentId', '==', userData.uid),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(gradesQuery, (snapshot) => {
      firestoreGrades = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      publish();
    }, (error) => {
      console.warn('Grades Firestore fallback failed:', error);
      firestoreGrades = [];
      publish();
    });

    return () => {
      didCancel = true;
      unsubscribe();
    };
  }, [currentUser, userData?.instituteId, userData?.uid]);

  const stats = useMemo(() => {
    if (!grades.length) return { average: '0.0', totalExams: 0 };
    const sum = grades.reduce((acc, item) => acc + toPercentage(item), 0);
    return {
      average: (sum / grades.length).toFixed(1),
      totalExams: grades.length,
    };
  }, [grades]);

  if (loading) {
    return (
      <StudentScreenScaffold scroll={false} style={styles.scaffoldContent} title="Grades">
        <LoadingState />
      </StudentScreenScaffold>
    );
  }

  return (
    <StudentScreenScaffold accentVariant="amber" scroll={false} style={styles.scaffoldContent} title="Grades">
      <ScreenIntro
        accentColor={colors.amber}
        eyebrow="Academic record"
        subtitle="Marks, percentages, and exam history published by your institute."
        title="Grades"
        trailing={<Ionicons name="school" size={27} color={colors.amber} />}
      />
      <StatsHero average={stats.average} totalExams={stats.totalExams} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Academic history</Text>
      <FlatList
        data={grades}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <GradeCard item={item} />}
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
  divider: {
    height: 58,
    width: 1,
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
    minHeight: 240,
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
  examText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  gradeCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    overflow: 'hidden',
    padding: 16,
  },
  gradeLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 13,
    minWidth: 0,
  },
  gradeRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  gradeText: {
    flex: 1,
    minWidth: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  percentBadge: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '900',
  },
  scaffoldContent: {
    flex: 1,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
    marginTop: 22,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 29,
    fontWeight: '900',
    marginTop: 6,
  },
  statsHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    padding: 20,
  },
  subjectIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
});

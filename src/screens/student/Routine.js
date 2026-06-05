import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { listSupabaseRoutines } from '../../services/supabaseTenantDataService';
import { RosterSkeleton } from '../../components/ui/LoadingState';

const sortByTime = (a, b) => String(a.time || '').localeCompare(String(b.time || ''), undefined, {
  numeric: true,
  sensitivity: 'base',
});

const resolveInstitutionMode = (userData) => String(
  userData?.instituteData?.institutionType ||
  userData?.instituteData?.type ||
  userData?.institutionType ||
  'school'
).toLowerCase();

const mergeRoutineLists = (...lists) => {
  const byId = new Map();
  lists.flat().forEach((routine) => {
    if (!routine) return;
    byId.set(String(routine.supabaseId || routine.id || `${routine.day}-${routine.time}-${routine.subject}`), routine);
  });
  return Array.from(byId.values()).sort(sortByTime);
};

function LoadingState() {
  return <RosterSkeleton rowCount={5} showFilters={false} />;
}

function RoutineCard({ item }) {
  const { colors, radii } = useRootLayout();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardStrong,
          borderColor: colors.hairline,
          borderRadius: radii.card,
        },
      ]}
    >
      <View style={[styles.timeBox, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
        <Ionicons name="time-outline" size={17} color={colors.violet} />
        <Text numberOfLines={1} style={[styles.time, { color: colors.text }]}>{item.time || 'TBA'}</Text>
      </View>
      <View style={styles.detailsBox}>
        <Text numberOfLines={1} style={[styles.subject, { color: colors.text }]}>
          {item.subject || 'Untitled class'}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaTag, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text numberOfLines={1} style={[styles.room, { color: colors.textSoft }]}>Room {item.room || 'TBA'}</Text>
          </View>
          {item.teacherName ? (
            <View style={[styles.metaTag, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Ionicons name="person-outline" size={13} color={colors.muted} />
              <Text numberOfLines={1} style={[styles.room, { color: colors.textSoft }]}>{item.teacherName}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.subjectMarker, { backgroundColor: colors.violet }]} />
    </View>
  );
}

function EmptyState({ isSchool, profileLabel }) {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.violetSoft, borderColor: colors.hairline }]}>
        <Ionicons name="calendar-outline" size={34} color={colors.violet} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No routine matches your profile</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>
        Ensure your admin uploaded data for {isSchool ? `Class ${profileLabel}` : profileLabel}.
      </Text>
    </View>
  );
}

export default function Routine() {
  const { currentUser, userData } = useAuth();
  const { colors } = useRootLayout();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  const profile = useMemo(() => {
    const institutionMode = resolveInstitutionMode(userData);
    const isSchool = institutionMode.includes('school');
    const userClass = String(userData?.class || userData?.standard || 'Not Set');
    const userSection = String(userData?.section || 'Not Set');
    const userDept = String(userData?.dept || userData?.department || 'Not Set');
    const userSem = String(userData?.sem || userData?.semester || 'Not Set');

    return {
      isSchool,
      primary: isSchool ? userClass : userDept,
      profileLabel: isSchool ? `${userClass} - ${userSection}` : `${userDept} - Sem ${userSem}`,
      secondary: isSchool ? userSection : userSem,
    };
  }, [userData]);

  useEffect(() => {
    if (!userData?.instituteId) {
      setSchedule([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let didCancel = false;
    let supabaseRoutines = [];
    let firestoreRoutines = [];
    const filterRoutine = (item) => {
      if (profile.isSchool) {
        return String(item.class || item.targetPrimary || '') === profile.primary &&
          String(item.section || item.targetSecondary || '') === profile.secondary;
      }

      return String(item.dept || item.department || item.targetPrimary || '') === profile.primary &&
        String(item.sem || item.semester || item.targetSecondary || '') === profile.secondary;
    };
    const publish = () => {
      if (didCancel) return;
      setSchedule(mergeRoutineLists(supabaseRoutines, firestoreRoutines).filter(filterRoutine));
      setLoading(false);
    };

    if (currentUser) {
      listSupabaseRoutines(currentUser)
        .then((result) => {
          supabaseRoutines = Array.isArray(result?.routines) ? result.routines : [];
          publish();
        })
        .catch((error) => {
          console.warn('Supabase routine unavailable, using Firestore fallback:', error);
          publish();
        });
    }

    const routineQuery = query(
      collection(db, 'routines'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(routineQuery, (snapshot) => {
      firestoreRoutines = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      publish();
    }, (error) => {
      console.warn('Routine Firestore fallback failed:', error);
      firestoreRoutines = [];
      publish();
    });

    return () => {
      didCancel = true;
      unsubscribe();
    };
  }, [currentUser, profile.isSchool, profile.primary, profile.secondary, userData?.instituteId]);

  if (loading) {
    return (
      <StudentScreenScaffold scroll={false} style={styles.scaffoldContent} title="Routine">
        <LoadingState />
      </StudentScreenScaffold>
    );
  }

  return (
    <StudentScreenScaffold accentVariant="blue" scroll={false} style={styles.scaffoldContent} title="Routine">
      <ScreenIntro
        accentColor={colors.violet}
        eyebrow="Daily schedule"
        subtitle={`Showing the routine for ${profile.profileLabel}.`}
        title="Routine"
        trailing={<Ionicons name="calendar" size={27} color={colors.violet} />}
      />
      <EnterprisePanel style={styles.summaryPanel}>
        <Ionicons name="calendar-number-outline" size={20} color={colors.violet} />
        <Text style={[styles.summaryText, { color: colors.text }]}>
          {schedule.length} scheduled class{schedule.length === 1 ? '' : 'es'}
        </Text>
      </EnterprisePanel>
      <FlatList
        data={schedule}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState isSchool={profile.isSchool} profileLabel={profile.profileLabel} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <RoutineCard item={item} />}
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
    gap: 12,
    marginBottom: 10,
    padding: 12,
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  detailsBox: {
    flex: 1,
    minWidth: 0,
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
  listContent: {
    paddingBottom: 8,
  },
  loadingBlock: {
    borderRadius: 6,
  },
  loadingLine: {
    height: 12,
    marginTop: 12,
    width: '78%',
  },
  loadingLineShort: {
    height: 12,
    marginTop: 10,
    width: '54%',
  },
  loadingPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    width: '100%',
  },
  loadingTitle: {
    height: 26,
    width: '46%',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaTag: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  room: {
    fontSize: 12,
    fontWeight: '600',
  },
  scaffoldContent: {
    flex: 1,
  },
  subject: {
    fontSize: 15,
    fontWeight: '800',
  },
  subjectMarker: {
    borderRadius: 8,
    height: 9,
    width: 9,
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
    fontWeight: '800',
  },
  time: {
    fontSize: 13,
    fontWeight: '800',
  },
  timeBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 10,
    width: 82,
  },
});

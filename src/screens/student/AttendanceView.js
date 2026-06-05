import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import AttendanceSkeleton from '../../components/attendance/AttendanceSkeleton';
import ScreenErrorBoundary from '../../components/errors/ScreenErrorBoundary';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';
import { listSupabaseAttendance } from '../../services/supabaseTenantDataService';

const timestampToMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRecordDate = (record) => {
  if (record.date) return record.date;
  const millis = timestampToMillis(record.timestamp || record.createdAt);
  return millis ? new Date(millis).toLocaleDateString() : 'Unscheduled';
};

const getRecordStatus = (record) => {
  if (record.status === 'present' || record.isPresent === true) return 'Present';
  if (record.status === 'absent' || record.isPresent === false) return 'Absent';
  return 'Not marked';
};

const toDisplayText = (value, fallback = '') => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
};

function AttendanceHero({ attendanceLabel, presentPercentage, scopeSummary, stats, totalClasses }) {
  const { colors } = useRootLayout();

  return (
    <>
      <EnterprisePanel style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={[styles.heroLabel, { color: colors.emerald }]}>{attendanceLabel}</Text>
          <Text style={[styles.heroValue, { color: colors.text }]}>{presentPercentage}%</Text>
          <Text style={[styles.heroHint, { color: colors.textSoft }]}>{scopeSummary}</Text>
        </View>
        <View style={[styles.heroBadge, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
          <Text style={[styles.heroBadgeValue, { color: colors.text }]}>{totalClasses}</Text>
          <Text style={[styles.heroBadgeLabel, { color: colors.muted }]}>Classes</Text>
        </View>
      </EnterprisePanel>

      <View style={styles.summaryGrid}>
        <SummaryCard color={colors.emerald} label="Present" value={stats.present} />
        <SummaryCard color="#F87171" label="Absent" value={stats.absent} />
        <SummaryCard color={colors.amber} label="Not marked" value={stats.notMarked} />
      </View>
    </>
  );
}

function SummaryCard({ color, label, value }) {
  const { colors, radii } = useRootLayout();

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.control,
        },
      ]}
    >
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function AttendanceHeader({ attendanceLabel, errorMessage, presentPercentage, recordsCount, scopeSummary, stats, totalClasses }) {
  const { colors } = useRootLayout();

  return (
    <View>
      <ScreenIntro
        accentColor={colors.emerald}
        eyebrow="Daily presence"
        subtitle="Track marked sessions, attendance percentage, and recent class history."
        title={attendanceLabel}
        trailing={<Ionicons name="bar-chart" size={27} color={colors.emerald} />}
      />

      <AttendanceHero
        attendanceLabel={attendanceLabel}
        presentPercentage={presentPercentage}
        scopeSummary={scopeSummary}
        stats={stats}
        totalClasses={totalClasses}
      />

      {errorMessage ? (
        <EnterprisePanel style={styles.warningCard}>
          <Ionicons name="warning-outline" size={20} color={colors.amber} />
          <Text style={[styles.warningText, { color: colors.textSoft }]}>{errorMessage}</Text>
        </EnterprisePanel>
      ) : null}

      <View style={styles.historyHeader}>
        <Text style={[styles.historyTitle, { color: colors.text }]}>Recent attendance</Text>
        <Text style={[styles.historyCount, { color: colors.muted }]}>{recordsCount} record{recordsCount === 1 ? '' : 's'}</Text>
      </View>
    </View>
  );
}

function AttendanceRow({ attendanceLabel, item }) {
  const { colors, radii } = useRootLayout();
  const statusLabel = getRecordStatus(item);
  const isPresent = statusLabel === 'Present';
  const isAbsent = statusLabel === 'Absent';
  const statusColor = isPresent ? colors.emerald : isAbsent ? '#F87171' : colors.amber;
  const statusSoft = isPresent ? colors.emeraldSoft : isAbsent ? '#450A0A' : colors.amberSoft;

  return (
    <View
      style={[
        styles.historyRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.control,
        },
      ]}
    >
      <View style={[styles.statusMark, { backgroundColor: statusColor }]} />
      <View style={styles.historyTextBlock}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
          {toDisplayText(item?.subject || item?.targetPrimary, attendanceLabel)}
        </Text>
        <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.muted }]}>
          {formatRecordDate(item || {})} {item?.teacherName ? `- ${toDisplayText(item.teacherName)}` : ''}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: statusSoft, borderColor: colors.hairline }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

function EmptyState() {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
        <Ionicons name="calendar-outline" size={34} color={colors.emerald} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No attendance marked yet</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>Records will appear as soon as faculty submits attendance.</Text>
    </View>
  );
}

function AttendanceViewContent() {
  const { currentUser, userData } = useAuth();
  const institution = useInstitution();
  const { colors } = useRootLayout();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({
    absent: 0,
    notMarked: 0,
    present: 0,
  });
  const attendanceLabel = toDisplayText(institution?.labels?.attendance, 'Attendance');
  const scopeSummary = toDisplayText(institution?.profile?.scopeSummary, 'Your academic activity');
  const safeAttendanceRecords = Array.isArray(attendanceRecords) ? attendanceRecords : [];

  useEffect(() => {
    const studentIdentifiers = Array.from(new Set([
      currentUser?.uid,
      userData?.uid,
      userData?.loginId,
      userData?.uniqueId,
    ].filter(Boolean).map(String)));

    if (!studentIdentifiers.length || !userData?.instituteId) {
      setAttendanceRecords([]);
      setAttendanceStats({ absent: 0, notMarked: 0, present: 0 });
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    let didCancel = false;
    const listenerBuckets = new Map();
    const failedBuckets = new Set();
    let supabaseRecords = [];
    const computeStats = () => {
      if (didCancel) return;

      const recordsById = new Map();
      listenerBuckets.forEach((records) => {
        (Array.isArray(records) ? records : []).forEach((record) => {
          recordsById.set(record.id, record);
        });
      });
      supabaseRecords.forEach((record) => {
        if (!record) return;
        recordsById.set(String(record.id || record.supabaseId), record);
      });

      const nextStats = { absent: 0, notMarked: 0, present: 0 };
      const nextRecords = [];

      recordsById.forEach((record) => {
        const data = record?.data && typeof record.data === 'object' ? record.data : (record || {});
        if (data.instituteId && data.instituteId !== userData.instituteId) return;

        nextRecords.push({ id: record.id, ...data });

        if (data.status === 'present' || data.isPresent === true) {
          nextStats.present += 1;
        } else if (data.status === 'absent' || data.isPresent === false) {
          nextStats.absent += 1;
        } else {
          nextStats.notMarked += 1;
        }
      });

      nextRecords.sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCompare !== 0) return dateCompare;
        return timestampToMillis(b.timestamp || b.createdAt) - timestampToMillis(a.timestamp || a.createdAt);
      });

      setAttendanceRecords(nextRecords);
      setAttendanceStats(nextStats);
      setErrorMessage(
        failedBuckets.size
          ? 'Some attendance history could not be loaded. Showing every accessible record for your account.'
          : ''
      );
      setLoading(false);
    };

    if (currentUser) {
      listSupabaseAttendance(currentUser)
        .then((result) => {
          supabaseRecords = Array.isArray(result?.attendance) ? result.attendance : [];
          computeStats();
        })
        .catch((error) => {
          console.warn('Supabase attendance unavailable, using Firestore fallback:', error);
          computeStats();
        });
    }

    const listenerSpecs = [
      ...studentIdentifiers.map((identifier) => ({ field: 'studentId', value: identifier })),
      currentUser?.uid ? { field: 'studentUid', value: currentUser.uid } : null,
    ].filter(Boolean);

    const unsubscribes = listenerSpecs.map((spec, index) => {
      const bucketKey = `${spec.field}:${spec.value}:${index}`;
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where(spec.field, '==', spec.value),
        where('instituteId', '==', userData.instituteId)
      );

      return onSnapshot(attendanceQuery, (querySnapshot) => {
        failedBuckets.delete(bucketKey);
        listenerBuckets.set(bucketKey, (querySnapshot?.docs || []).map((attendanceDoc) => ({
          data: attendanceDoc.data(),
          id: attendanceDoc.id,
        })));
        computeStats();
      }, (error) => {
        console.warn(`Attendance listener failed for ${spec.field}:`, error);
        failedBuckets.add(bucketKey);
        listenerBuckets.set(bucketKey, []);
        computeStats();
      });
    });

    return () => {
      didCancel = true;
      unsubscribes.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, [currentUser, currentUser?.uid, userData?.instituteId, userData?.loginId, userData?.uid, userData?.uniqueId]);

  const totalClasses = attendanceStats.present + attendanceStats.absent + attendanceStats.notMarked;
  const presentPercentage = totalClasses ? Math.round((attendanceStats.present / totalClasses) * 100) : 0;

  const renderItem = useCallback(({ item }) => (
    <AttendanceRow attendanceLabel={attendanceLabel} item={item} />
  ), [attendanceLabel]);

  const renderHeader = useCallback(() => (
    <AttendanceHeader
      attendanceLabel={attendanceLabel}
      errorMessage={errorMessage}
      presentPercentage={presentPercentage}
      recordsCount={safeAttendanceRecords.length}
      scopeSummary={scopeSummary}
      stats={attendanceStats}
      totalClasses={totalClasses}
    />
  ), [attendanceLabel, attendanceStats, errorMessage, presentPercentage, safeAttendanceRecords.length, scopeSummary, totalClasses]);

  const refreshAttendance = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
  }, []);
  const { isPending: refreshing, run: handleRefresh } = useSingleFlightAction(refreshAttendance, {
    cooldownMs: 900,
    haptic: 'none',
  });

  if (loading) {
    return (
      <StudentScreenScaffold scroll={false} style={styles.scaffoldContent} title="Attendance">
        <AttendanceSkeleton
          accent="emerald"
          rowCount={4}
        />
      </StudentScreenScaffold>
    );
  }

  return (
    <StudentScreenScaffold accentVariant="emerald" scroll={false} style={styles.scaffoldContent} title="Attendance">
      <FlatList
        data={safeAttendanceRecords}
        keyExtractor={(item, index) => String(item?.id || index)}
        ListEmptyComponent={<EmptyState />}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.emerald}
            onRefresh={handleRefresh}
          />
        )}
        removeClippedSubviews={Platform.OS !== 'web'}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
    </StudentScreenScaffold>
  );
}

export default function AttendanceView() {
  return (
    <ScreenErrorBoundary
      message="Attendance data hit a rendering problem, but the app is still alive. Retry after the records refresh."
      screenName="StudentAttendance"
      title="Attendance is recovering"
    >
      <AttendanceViewContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
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
    minHeight: 230,
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
  heroBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  heroBadgeValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  heroCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    marginBottom: 14,
    padding: 20,
  },
  heroHint: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 4,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
  },
  heroValue: {
    fontSize: 45,
    fontWeight: '900',
    lineHeight: 52,
    marginTop: 4,
  },
  historyCount: {
    fontSize: 12,
    fontWeight: '900',
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 22,
  },
  historyRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
    padding: 14,
  },
  historyTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  listContent: {
    paddingBottom: 8,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  scaffoldContent: {
    flex: 1,
    minHeight: 0,
  },
  statusMark: {
    borderRadius: 8,
    height: 40,
    marginRight: 12,
    width: 9,
  },
  statusPill: {
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  summaryCard: {
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    padding: 14,
  },
  summaryDot: {
    borderRadius: 8,
    height: 9,
    marginBottom: 7,
    width: 9,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  warningCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    padding: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
});

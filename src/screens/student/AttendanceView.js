import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { PieChart } from 'react-native-chart-kit';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { db } from '../../../firebaseConfig';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useInstitution } from '../../contexts/InstitutionContext';

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

export default function AttendanceView() {
  const { currentUser, userData } = useAuth();
  const layout = useResponsiveLayout();
  const institution = useInstitution();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    notMarked: 0,
  });

  useEffect(() => {
    const studentIdentifiers = Array.from(new Set([
      currentUser?.uid,
      userData?.uid,
      userData?.uniqueId,
      userData?.email,
    ].filter(Boolean).map(String)));

    if (!studentIdentifiers.length || !userData?.instituteId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const listenerBuckets = new Map();
    const computeStats = () => {
      const recordsById = new Map();
      listenerBuckets.forEach((records) => {
        records.forEach((record) => {
          recordsById.set(record.id, record);
        });
      });

      const nextStats = { present: 0, absent: 0, notMarked: 0 };
      const nextRecords = [];

      recordsById.forEach((record) => {
        const data = record.data;
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
      setErrorMessage('');
      setLoading(false);
    };

    const listenerSpecs = [
      ...studentIdentifiers.map((identifier) => ({ field: 'studentId', value: identifier })),
      currentUser?.uid ? { field: 'studentUid', value: currentUser.uid } : null,
    ].filter(Boolean);

    const unsubscribes = listenerSpecs.map((spec, index) => {
      const bucketKey = `${spec.field}:${spec.value}:${index}`;
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where(spec.field, '==', spec.value)
      );

      return onSnapshot(attendanceQuery, (querySnapshot) => {
        listenerBuckets.set(bucketKey, querySnapshot.docs.map((attendanceDoc) => ({
          id: attendanceDoc.id,
          data: attendanceDoc.data(),
        })));
        computeStats();
      }, (error) => {
        console.warn(`Attendance listener failed for ${spec.field}:`, error);
        listenerBuckets.set(bucketKey, []);
        setErrorMessage('Some attendance history could not be loaded. Showing every accessible record for your account.');
        computeStats();
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [currentUser?.uid, userData?.uid, userData?.uniqueId, userData?.email, userData?.instituteId]);

  const totalClasses = attendanceStats.present + attendanceStats.absent + attendanceStats.notMarked;
  const presentPercentage = totalClasses ? Math.round((attendanceStats.present / totalClasses) * 100) : 0;
  const latestRecords = attendanceRecords.slice(0, 8);

  const chartData = useMemo(() => {
    const data = [
      {
        name: 'Present',
        population: attendanceStats.present,
        color: '#10B981',
        legendFontColor: '#334155',
        legendFontSize: 13,
      },
      {
        name: 'Absent',
        population: attendanceStats.absent,
        color: '#EF4444',
        legendFontColor: '#334155',
        legendFontSize: 13,
      },
      {
        name: 'Not Marked',
        population: attendanceStats.notMarked,
        color: '#F59E0B',
        legendFontColor: '#334155',
        legendFontSize: 13,
      },
    ];

    return data.some((item) => item.population > 0)
      ? data
      : [
          {
            name: 'No Records',
            population: 1,
            color: '#CBD5E1',
            legendFontColor: '#64748B',
            legendFontSize: 13,
          },
        ];
  }, [attendanceStats]);

  return (
    <View style={styles.container}>
      <DynamicHeader title="My Attendance" showBack />

      {loading ? (
        <View style={styles.loadingContainer}>
          <SmoothSpinner size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading attendance...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: layout.horizontalPadding },
            layout.isDesktop && styles.contentDesktop,
            layout.isDesktop && { maxWidth: layout.maxContentWidth },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroCard, layout.isCompact && styles.heroCardCompact]}>
            <View>
              <Text style={styles.heroLabel}>{institution.labels.attendance}</Text>
              <Text style={styles.heroValue}>{presentPercentage}%</Text>
              <Text style={styles.heroHint}>{institution.profile.scopeSummary}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeValue}>{totalClasses}</Text>
              <Text style={styles.heroBadgeLabel}>Classes</Text>
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={[styles.detailGrid, layout.isDesktop && styles.detailGridDesktop]}>
            <View style={[styles.chartCard, layout.isDesktop && styles.chartCardDesktop]}>
              <Text style={styles.cardTitle}>Overall Attendance</Text>
              <PieChart
                data={chartData}
                width={layout.chartWidth(layout.isDesktop ? 540 : 520)}
                height={220}
                chartConfig={{ color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})` }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="12"
                center={[8, 0]}
                absolute
              />
            </View>

            <View style={[styles.summaryCard, layout.isDesktop && styles.summaryCardDesktop]}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.summaryLabel}>Present</Text>
                <Text style={styles.summaryValue}>{attendanceStats.present}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.summaryLabel}>Absent</Text>
                <Text style={styles.summaryValue}>{attendanceStats.absent}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.summaryLabel}>Not Marked</Text>
                <Text style={styles.summaryValue}>{attendanceStats.notMarked}</Text>
              </View>
            </View>
          </View>

          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.summaryTitle}>Recent Attendance</Text>
              <Text style={styles.historyCount}>{attendanceRecords.length} record{attendanceRecords.length === 1 ? '' : 's'}</Text>
            </View>
            {latestRecords.length ? (
              latestRecords.map((record) => {
                const statusLabel = getRecordStatus(record);
                const isPresent = statusLabel === 'Present';
                const isAbsent = statusLabel === 'Absent';

                return (
                  <View key={record.id} style={styles.historyRow}>
                    <View style={[
                      styles.statusMark,
                      isPresent && styles.statusPresent,
                      isAbsent && styles.statusAbsent,
                    ]} />
                    <View style={styles.historyTextBlock}>
                      <Text style={styles.historyTitle}>
                        {record.subject || record.targetPrimary || institution.labels.attendance}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {formatRecordDate(record)} {record.teacherName ? `- ${record.teacherName}` : ''}
                      </Text>
                    </View>
                    <Text style={[
                      styles.historyStatus,
                      isPresent && styles.historyStatusPresent,
                      isAbsent && styles.historyStatusAbsent,
                    ]}>
                      {statusLabel}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.noHistory}>
                <Text style={styles.noHistoryTitle}>No attendance marked yet</Text>
                <Text style={styles.noHistoryText}>Your records will appear here as soon as faculty submits attendance.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontWeight: '700', marginTop: 12 },
  content: { paddingTop: 16, paddingBottom: 96 },
  contentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCardCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 16 },
  heroLabel: { color: '#93C5FD', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', marginTop: 4 },
  heroHint: { color: '#CBD5E1', fontSize: 13, fontWeight: '700', marginTop: 4 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' },
  heroBadgeValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroBadgeLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '700', marginTop: 2 },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  detailGrid: {},
  detailGridDesktop: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  chartCardDesktop: { flex: 1.55, marginBottom: 0 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12, alignSelf: 'flex-start' },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  warningText: { color: '#92400E', fontSize: 13, fontWeight: '800', lineHeight: 19 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCardDesktop: { flex: 1, alignSelf: 'stretch' },
  summaryTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  summaryLabel: { flex: 1, fontSize: 15, color: '#64748B', fontWeight: '700' },
  summaryValue: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  historyCount: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusMark: { width: 10, height: 34, borderRadius: 999, backgroundColor: '#F59E0B', marginRight: 12 },
  statusPresent: { backgroundColor: '#10B981' },
  statusAbsent: { backgroundColor: '#EF4444' },
  historyTextBlock: { flex: 1, minWidth: 0 },
  historyTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  historyMeta: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  historyStatus: { color: '#92400E', fontSize: 13, fontWeight: '900', marginLeft: 10 },
  historyStatusPresent: { color: '#059669' },
  historyStatusAbsent: { color: '#DC2626' },
  noHistory: { paddingVertical: 20, alignItems: 'center' },
  noHistoryTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  noHistoryText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 5, lineHeight: 19 },
});

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { PieChart } from 'react-native-chart-kit';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { db } from '../../../firebaseConfig';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

export default function AttendanceView() {
  const { currentUser, userData } = useAuth();
  const layout = useResponsiveLayout();
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    notMarked: 0,
  });

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!currentUser?.uid || !userData?.instituteId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('instituteId', '==', userData.instituteId),
          where('studentId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(attendanceQuery);
        const nextStats = { present: 0, absent: 0, notMarked: 0 };

        querySnapshot.docs.forEach((attendanceDoc) => {
          const data = attendanceDoc.data();
          if (data.status === 'present' || data.isPresent === true) {
            nextStats.present += 1;
          } else if (data.status === 'absent' || data.isPresent === false) {
            nextStats.absent += 1;
          } else {
            nextStats.notMarked += 1;
          }
        });

        setAttendanceStats(nextStats);
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [currentUser?.uid, userData]);

  const totalClasses = attendanceStats.present + attendanceStats.absent + attendanceStats.notMarked;
  const presentPercentage = totalClasses ? Math.round((attendanceStats.present / totalClasses) * 100) : 0;

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
              <Text style={styles.heroLabel}>Attendance Rate</Text>
              <Text style={styles.heroValue}>{presentPercentage}%</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeValue}>{totalClasses}</Text>
              <Text style={styles.heroBadgeLabel}>Classes</Text>
            </View>
          </View>

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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontWeight: '700', marginTop: 12 },
  content: { paddingVertical: 16, paddingBottom: 34 },
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
});

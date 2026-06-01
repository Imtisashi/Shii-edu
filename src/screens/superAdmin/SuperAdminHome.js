import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PieChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { deleteInstituteAsSuperAdmin, getInstituteStats } from '../../services/firebaseAdminService';
import { db } from '../../../firebaseConfig';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import AddInstituteModal from '../../components/superAdmin/AddInstituteModal';
import LoadingState, { SmoothSpinner } from '../../components/ui/LoadingState';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function SuperAdminHome() {
  const navigation = useNavigation();
  const { currentUser, userData, logout } = useAuth();
  const layout = useResponsiveLayout();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showAddInstituteModal, setShowAddInstituteModal] = useState(false);
  const [deletingInstituteId, setDeletingInstituteId] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const fetchInstitutes = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const institutesRef = collection(db, 'institutes');
      const snapshot = await getDocs(institutesRef);
      const institutesList = snapshot.docs.map((instituteDoc) => {
        const data = instituteDoc.data();

        return {
          id: instituteDoc.id,
          ...data,
          instituteId: data.instituteId || instituteDoc.id,
          totalUsers: Number(data.totalUsers) || 0,
          teachers: Number(data.teachers) || 0,
          students: Number(data.students) || 0,
          statsReady: false,
        };
      });

      institutesList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInstitutes(institutesList);
      setLoading(false);
      setRefreshing(false);

      setStatsLoading(true);
      Promise.all(
        institutesList.map(async (institute) => {
          const stats = await getInstituteStats(institute.instituteId);
          return {
            id: institute.id,
            totalUsers: stats.totalUsers || 0,
            teachers: stats.teachers || 0,
            students: stats.students || 0,
            statsReady: true,
          };
        })
      ).then((statsList) => {
        const statsById = statsList.reduce((acc, stats) => {
          acc[stats.id] = stats;
          return acc;
        }, {});

        setInstitutes((currentInstitutes) => currentInstitutes.map((institute) => ({
          ...institute,
          ...(statsById[institute.id] || {}),
        })));
      }).catch((statsError) => {
        console.warn('Institute stats refresh failed:', statsError);
      }).finally(() => {
        setStatsLoading(false);
      });
    } catch (error) {
      console.error('Error fetching institutes:', error);
      Alert.alert('Error', 'Failed to load institutes.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const dashboardStats = useMemo(() => {
    const teachers = institutes.reduce((total, institute) => total + (Number(institute.teachers) || 0), 0);
    const students = institutes.reduce((total, institute) => total + (Number(institute.students) || 0), 0);
    const totalUsers = institutes.reduce((total, institute) => total + (Number(institute.totalUsers) || 0), 0);
    const admins = Math.max(totalUsers - teachers - students, 0);

    return {
      institutes: institutes.length,
      teachers,
      students,
      admins,
      totalUsers,
    };
  }, [institutes]);

  const pieWidth = Math.max(
    260,
    Math.min(layout.availableWidth - (layout.isMobile ? 32 : 0), layout.isDesktop ? 560 : 520)
  );

  const userMixData = useMemo(() => {
    const data = [
      {
        name: 'Students',
        population: dashboardStats.students,
        color: '#2563EB',
        legendFontColor: '#334155',
        legendFontSize: 12,
      },
      {
        name: 'Teachers',
        population: dashboardStats.teachers,
        color: '#10B981',
        legendFontColor: '#334155',
        legendFontSize: 12,
      },
      {
        name: 'Admins',
        population: dashboardStats.admins,
        color: '#8B5CF6',
        legendFontColor: '#334155',
        legendFontSize: 12,
      },
    ];

    return data.some((item) => item.population > 0)
      ? data
      : [
          {
            name: 'No users',
            population: 1,
            color: '#CBD5E1',
            legendFontColor: '#64748B',
            legendFontSize: 12,
          },
        ];
  }, [dashboardStats]);

  const performDeleteInstitute = async (institute) => {
    const instituteId = institute.instituteId || institute.id;
    setDeletingInstituteId(institute.id);
    try {
      const result = await deleteInstituteAsSuperAdmin(instituteId);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to delete institute.');
        return;
      }

      const userCount = result.deleted?.users || 0;
      Alert.alert('Success', `Institute deleted successfully. ${userCount} linked user profile${userCount === 1 ? '' : 's'} removed.`);
      fetchInstitutes({ showLoader: false });
    } catch (error) {
      console.error('Error deleting institute:', error);
      Alert.alert('Error', 'Failed to delete institute.');
    } finally {
      setDeletingInstituteId('');
    }
  };

  const handleDeleteInstitute = (institute) => {
    Haptics.selectionAsync();
    const message = `Delete ${institute.name || 'this institute'} and all linked users, attendance, payments, notices, routines, assignments, grades, gallery items, and papers? This cannot be undone.`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        performDeleteInstitute(institute);
      }
      return;
    }

    Alert.alert(
      'Delete Institute',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDeleteInstitute(institute),
        },
      ]
    );
  };

  const refreshList = () => {
    setRefreshing(true);
    fetchInstitutes({ showLoader: false });
  };

  const renderInstituteCard = ({ item, index }) => (
    <Animated.View
      style={[
        styles.instituteCard,
        layout.isMobile && styles.instituteCardMobile,
        layout.listColumns > 1 && styles.instituteCardDesktop,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 24],
                outputRange: [0, 24 + index * 6],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.instituteIcon, layout.isMobile && styles.instituteIconMobile]}>
        <Ionicons name="school" size={22} color="#2563EB" />
      </View>

      <View style={styles.instituteInfo}>
        <Text style={styles.instituteName} numberOfLines={1}>
          {item.name || 'Unnamed Institute'}
        </Text>
        <Text style={styles.instituteId} numberOfLines={1}>ID: {item.instituteId}</Text>

        <View style={styles.instituteStats}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{item.students || 0}</Text>
            <Text style={styles.miniStatLabel}>Students</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{item.teachers || 0}</Text>
            <Text style={styles.miniStatLabel}>Teachers</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{item.totalUsers || 0}</Text>
            <Text style={styles.miniStatLabel}>Users</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, layout.isMobile && styles.deleteButtonMobile, deletingInstituteId === item.id && styles.disabledButton]}
        onPress={() => handleDeleteInstitute(item)}
        accessibilityLabel={`Delete ${item.name || 'institute'}`}
        disabled={deletingInstituteId === item.id}
      >
        {deletingInstituteId === item.id ? (
          <SmoothSpinner size={18} stroke={3} color="#EF4444" trackColor="#FEE2E2" />
        ) : (
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return <LoadingState label="Loading superadmin dashboard..." color="#2563EB" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        key={String(layout.listColumns)}
        data={institutes}
        numColumns={layout.listColumns}
        columnWrapperStyle={layout.listColumns > 1 ? styles.instituteColumnWrapper : undefined}
        keyExtractor={(item) => item.id}
        renderItem={renderInstituteCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: layout.horizontalPadding },
          layout.isDesktop && styles.listContentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshList} tintColor="#2563EB" />}
        ListHeaderComponent={
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={[styles.hero, layout.isMobile && styles.heroMobile, layout.isDesktop && styles.heroDesktop]}>
              <View>
                <Text style={styles.eyebrow}>Super Admin</Text>
                <Text style={[styles.heroTitle, layout.isMobile && styles.heroTitleMobile]}>Platform Command Center</Text>
                <Text style={[styles.heroSubtitle, layout.isMobile && styles.heroSubtitleMobile]}>
                  Welcome, {userData?.name || 'Admin'}. Monitor institutes, admins, and active campus users from one clean view.
                </Text>
              </View>

              <TouchableOpacity style={styles.logoutButton} onPress={() => { Haptics.selectionAsync(); logout(); }}>
                <Ionicons name="log-out-outline" size={18} color="#F8FAFC" />
                <Text style={styles.logoutText}>Sign out</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.statsGrid, layout.isDesktop && styles.statsGridDesktop]}>
              <View style={[styles.statCard, styles.statCardWide]}>
                <Text style={styles.statsLabel}>Institutes</Text>
                <Text style={styles.statsValue}>{dashboardStats.institutes}</Text>
                <Text style={styles.statsHint}>Total campuses onboarded</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statsLabel}>Users</Text>
                <Text style={styles.statsValue}>{statsLoading ? '...' : dashboardStats.totalUsers}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statsLabel}>Admins</Text>
                <Text style={styles.statsValue}>{statsLoading ? '...' : dashboardStats.admins}</Text>
              </View>
            </View>

            <View style={[styles.insightRow, layout.isDesktop && styles.insightRowDesktop]}>
              <View style={[styles.chartCard, layout.isDesktop && styles.chartCardDesktop]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Platform Mix</Text>
                    <Text style={styles.sectionSubtitle}>Students, teachers, and admins across institutes</Text>
                  </View>
                  <Ionicons name="pie-chart" size={24} color="#2563EB" />
                </View>

                <PieChart
                  data={userMixData}
                  width={pieWidth}
                  height={layout.isMobile ? 176 : 190}
                  chartConfig={{ color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})` }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft={layout.isMobile ? "0" : "8"}
                  absolute
                />
              </View>

              <View style={[styles.actionGrid, layout.isDesktop && styles.actionPanelDesktop]}>
                <TouchableOpacity style={[styles.primaryAction, layout.isMobile && styles.actionButtonMobile]} onPress={() => { Haptics.selectionAsync(); setShowAddInstituteModal(true); }}>
                  <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Add Institute</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryAction, layout.isMobile && styles.actionButtonMobile]} onPress={() => { Haptics.selectionAsync(); navigation.navigate('ManageInstitutes'); }}>
                  <Ionicons name="business-outline" size={22} color="#2563EB" />
                  <Text style={styles.secondaryActionText}>Manage Institutes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryAction, layout.isMobile && styles.actionButtonMobile]} onPress={() => { Haptics.selectionAsync(); navigation.navigate('ManageAdminUsers'); }}>
                  <Ionicons name="people-outline" size={22} color="#2563EB" />
                  <Text style={styles.secondaryActionText}>Manage Admins</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Institutes</Text>
                <Text style={styles.sectionSubtitle}>Pull down to refresh live stats</Text>
              </View>
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="school-outline" size={44} color="#2563EB" />
            </View>
            <Text style={styles.emptyTitle}>No institutes yet</Text>
            <Text style={styles.emptyText}>Create the first institute and its administrator to begin onboarding campuses.</Text>
            <TouchableOpacity style={styles.primaryAction} onPress={() => setShowAddInstituteModal(true)}>
              <Ionicons name="add-circle" size={22} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Add First Institute</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <AddInstituteModal
        visible={showAddInstituteModal}
        currentUser={currentUser}
        onClose={() => setShowAddInstituteModal(false)}
        onCreated={() => fetchInstitutes({ showLoader: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  listContent: { paddingVertical: 16, paddingBottom: 110 },
  listContentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  hero: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroDesktop: {
    minHeight: 220,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 30,
  },
  heroMobile: { padding: 18, borderRadius: 20 },
  eyebrow: { color: '#93C5FD', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 8, lineHeight: 34 },
  heroTitleMobile: { fontSize: 24, lineHeight: 29 },
  heroSubtitle: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 560 },
  heroSubtitleMobile: { fontSize: 13, lineHeight: 19 },
  logoutButton: {
    alignSelf: 'flex-start',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  logoutText: { color: '#F8FAFC', fontWeight: '800', marginLeft: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statsGridDesktop: { gap: 14 },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  statCardWide: { minWidth: 180 },
  statsLabel: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  statsValue: { color: '#0F172A', fontSize: 30, fontWeight: '900', marginTop: 6 },
  statsHint: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  insightRow: { marginBottom: 4 },
  insightRowDesktop: { flexDirection: 'row', alignItems: 'stretch', gap: 14, marginBottom: 20 },
  chartCardDesktop: { flex: 1.6, marginBottom: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeaderText: { flex: 1, minWidth: 0, paddingRight: 12 },
  sectionTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 13, marginTop: 3 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  actionPanelDesktop: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignContent: 'stretch',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 160,
    flexGrow: 1,
  },
  actionButtonMobile: { minWidth: 145, paddingHorizontal: 12, paddingVertical: 13 },
  primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginLeft: 8 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    minWidth: 160,
    flexGrow: 1,
  },
  secondaryActionText: { color: '#1D4ED8', fontSize: 15, fontWeight: '900', marginLeft: 8 },
  instituteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  instituteCardMobile: { padding: 13, borderRadius: 16, alignItems: 'flex-start' },
  instituteColumnWrapper: { gap: 12 },
  instituteCardDesktop: { flex: 1 },
  instituteIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  instituteIconMobile: { width: 40, height: 40, borderRadius: 12, marginRight: 10 },
  instituteInfo: { flex: 1, minWidth: 0 },
  instituteName: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  instituteId: { fontSize: 12, color: '#64748B', marginTop: 3, fontWeight: '600' },
  instituteStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  miniStat: { marginRight: 18, marginTop: 4 },
  miniStatValue: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  miniStatLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 1 },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  deleteButtonMobile: { width: 38, height: 38, borderRadius: 12, marginLeft: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#FFFFFF', borderRadius: 20 },
  emptyIcon: { width: 78, height: 78, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 16 },
  emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 18 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(15,23,42,0.62)' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 430, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22 },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: 5, textAlign: 'center' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: 12,
  },
  icon: { paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 15, paddingRight: 14, fontSize: 15, color: '#0F172A', outlineStyle: 'none' },
  creatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  creatingText: { marginLeft: 8, color: '#64748B', fontWeight: '700' },
  modalButton: { backgroundColor: '#2563EB', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  disabledButton: { opacity: 0.6 },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  modalCancelButton: { alignItems: 'center', paddingVertical: 13 },
  modalCancelText: { color: '#64748B', fontSize: 15, fontWeight: '800' },
});

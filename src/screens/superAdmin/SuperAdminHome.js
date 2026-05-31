import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { createInstituteAndAdmin, getInstituteStats } from '../../services/firebaseAdminService';
import { db } from '../../../firebaseConfig';

const screenWidth = Dimensions.get('window').width;

export default function SuperAdminHome() {
  const navigation = useNavigation();
  const { userData, logout } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddInstituteModal, setShowAddInstituteModal] = useState(false);
  const [instituteName, setInstituteName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [creatingInstitute, setCreatingInstitute] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const fetchInstitutes = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const institutesRef = collection(db, 'institutes');
      const snapshot = await getDocs(institutesRef);
      const institutesList = await Promise.all(
        snapshot.docs.map(async (instituteDoc) => {
          const data = instituteDoc.data();
          const stats = await getInstituteStats(data.instituteId || instituteDoc.id);

          return {
            id: instituteDoc.id,
            ...data,
            instituteId: data.instituteId || instituteDoc.id,
            totalUsers: stats.totalUsers || 0,
            teachers: stats.teachers || 0,
            students: stats.students || 0,
          };
        })
      );

      institutesList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInstitutes(institutesList);
    } catch (error) {
      console.error('Error fetching institutes:', error);
      Alert.alert('Error', 'Failed to load institutes.');
    } finally {
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

  const resetInstituteForm = () => {
    setInstituteName('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminName('');
  };

  const handleAddInstitute = async () => {
    const cleanedEmail = adminEmail.trim().toLowerCase();

    if (!instituteName.trim() || !cleanedEmail || !adminPassword || !adminName.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanedEmail)) {
      Alert.alert('Error', 'Please enter a valid admin email address.');
      return;
    }

    if (adminPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    setCreatingInstitute(true);
    try {
      const result = await createInstituteAndAdmin({
        instituteName: instituteName.trim(),
        adminEmail: cleanedEmail,
        adminPassword,
        adminName: adminName.trim(),
      });

      if (result.success) {
        Alert.alert('Success', 'Institute and admin created successfully.');
        setShowAddInstituteModal(false);
        resetInstituteForm();
        fetchInstitutes({ showLoader: false });
      } else {
        Alert.alert('Error', result.error || 'Failed to create institute.');
      }
    } catch (error) {
      console.error('Error creating institute:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setCreatingInstitute(false);
    }
  };

  const handleDeleteInstitute = async (instituteId) => {
    Alert.alert(
      'Delete Institute',
      'Are you sure you want to delete this institute? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'institutes', instituteId));
              Alert.alert('Success', 'Institute deleted successfully.');
              fetchInstitutes();
            } catch (error) {
              console.error('Error deleting institute:', error);
              Alert.alert('Error', 'Failed to delete institute.');
            }
          },
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
      <View style={styles.instituteIcon}>
        <Ionicons name="school" size={22} color="#2563EB" />
      </View>

      <View style={styles.instituteInfo}>
        <Text style={styles.instituteName} numberOfLines={1}>
          {item.name || 'Unnamed Institute'}
        </Text>
        <Text style={styles.instituteId}>ID: {item.instituteId}</Text>

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
        style={styles.deleteButton}
        onPress={() => handleDeleteInstitute(item.id)}
        accessibilityLabel={`Delete ${item.name || 'institute'}`}
      >
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading superadmin dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={institutes}
        keyExtractor={(item) => item.id}
        renderItem={renderInstituteCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshList} tintColor="#2563EB" />}
        ListHeaderComponent={
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.hero}>
              <View>
                <Text style={styles.eyebrow}>Super Admin</Text>
                <Text style={styles.heroTitle}>Platform Command Center</Text>
                <Text style={styles.heroSubtitle}>
                  Welcome, {userData?.name || 'Admin'}. Monitor institutes, admins, and active campus users from one clean view.
                </Text>
              </View>

              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Ionicons name="log-out-outline" size={18} color="#F8FAFC" />
                <Text style={styles.logoutText}>Sign out</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statCardWide]}>
                <Text style={styles.statsLabel}>Institutes</Text>
                <Text style={styles.statsValue}>{dashboardStats.institutes}</Text>
                <Text style={styles.statsHint}>Total campuses onboarded</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statsLabel}>Users</Text>
                <Text style={styles.statsValue}>{dashboardStats.totalUsers}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statsLabel}>Admins</Text>
                <Text style={styles.statsValue}>{dashboardStats.admins}</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Platform Mix</Text>
                  <Text style={styles.sectionSubtitle}>Students, teachers, and admins across institutes</Text>
                </View>
                <Ionicons name="pie-chart" size={24} color="#2563EB" />
              </View>

              <PieChart
                data={userMixData}
                width={Math.min(screenWidth - 32, 520)}
                height={190}
                chartConfig={{ color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})` }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="8"
                absolute
              />
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.primaryAction} onPress={() => setShowAddInstituteModal(true)}>
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Add Institute</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('ManageInstitutes')}>
                <Ionicons name="business-outline" size={22} color="#2563EB" />
                <Text style={styles.secondaryActionText}>Manage Institutes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('ManageAdminUsers')}>
                <Ionicons name="people-outline" size={22} color="#2563EB" />
                <Text style={styles.secondaryActionText}>Manage Admins</Text>
              </TouchableOpacity>
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

      <Modal
        animationType="fade"
        transparent
        visible={showAddInstituteModal}
        onRequestClose={() => setShowAddInstituteModal(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="school" size={28} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>Add New Institute</Text>
                <Text style={styles.modalSubtitle}>Create a campus and its first administrator account.</Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Institute Name"
                  placeholderTextColor="#94A3B8"
                  value={instituteName}
                  onChangeText={setInstituteName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Admin Full Name"
                  placeholderTextColor="#94A3B8"
                  value={adminName}
                  onChangeText={setAdminName}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Admin Email"
                  placeholderTextColor="#94A3B8"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Admin Password (min 8 characters)"
                  placeholderTextColor="#94A3B8"
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleAddInstitute}
                />
              </View>

              {creatingInstitute ? (
                <View style={styles.creatingRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.creatingText}>Creating institute...</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.modalButton, creatingInstitute && styles.disabledButton]}
                onPress={handleAddInstitute}
                disabled={creatingInstitute}
              >
                <Text style={styles.modalButtonText}>Create Institute</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddInstituteModal(false);
                  resetInstituteForm();
                }}
                disabled={creatingInstitute}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
  },
  eyebrow: { color: '#93C5FD', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 8, lineHeight: 34 },
  heroSubtitle: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 560 },
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 13, marginTop: 3 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
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
  instituteIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
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

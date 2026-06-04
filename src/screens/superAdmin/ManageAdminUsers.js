import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import LoadingState, { SmoothSpinner } from '../../components/ui/LoadingState';

export default function ManageAdminUsers() {
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAdminId, setEditAdminId] = useState('');
  const [editName, setEditName] = useState('');
  const [editLoginId, setEditLoginId] = useState('');
  const [saving, setSaving] = useState(false);

  const sortedAdmins = useMemo(
    () => [...admins].sort((a, b) => (a.instituteName || '').localeCompare(b.instituteName || '') || (a.name || '').localeCompare(b.name || '')),
    [admins]
  );

  const fetchAdmins = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const [adminsSnapshot, institutesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))),
        getDocs(collection(db, 'institutes')),
      ]);

      const institutesById = {};
      institutesSnapshot.docs.forEach((instituteDoc) => {
        const data = instituteDoc.data();
        institutesById[data.instituteId || instituteDoc.id] = data.name || 'Unnamed Institute';
      });

      const adminsList = adminsSnapshot.docs.map((adminDoc) => {
        const data = adminDoc.data();
        return {
          id: adminDoc.id,
          instituteName: institutesById[data.instituteId] || 'Not Assigned',
          ...data,
        };
      });

      setAdmins(adminsList);
    } catch (error) {
      console.error('Error fetching admins:', error);
      Alert.alert('Error', 'Failed to load administrators.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleEditAdmin = (admin) => {
    setEditAdminId(admin.id);
    setEditName(admin.name || '');
    setEditLoginId(admin.loginId || admin.uniqueId || '');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditAdminId('');
    setEditName('');
    setEditLoginId('');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', editAdminId), {
        name: editName.trim(),
        updatedAt: new Date(),
      });
      Alert.alert('Success', 'Administrator updated successfully.');
      closeEditModal();
      fetchAdmins({ showLoader: false });
    } catch (error) {
      console.error('Error updating admin:', error);
      Alert.alert('Error', 'Failed to update administrator.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAdminProfile = async (adminId) => {
    try {
      await deleteDoc(doc(db, 'users', adminId));
      Alert.alert('Success', 'Administrator profile deleted successfully.');
      fetchAdmins({ showLoader: false });
    } catch (error) {
      console.error('Error deleting admin:', error);
      Alert.alert('Error', 'Failed to delete administrator.');
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    const message = 'Are you sure you want to delete this administrator profile? The Firebase Auth account may still need to be removed separately.';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(message)) {
        deleteAdminProfile(adminId);
      }
      return;
    }

    Alert.alert('Delete Administrator', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAdminProfile(adminId),
      },
    ]);
  };

  const refreshAdmins = () => {
    setRefreshing(true);
    fetchAdmins({ showLoader: false });
  };

  const renderAdmin = ({ item }) => (
    <View style={[styles.adminCard, layout.isMobile && styles.adminCardMobile, layout.listColumns > 1 && styles.adminCardDesktop]}>
      <View style={[styles.avatar, layout.isMobile && styles.avatarMobile]}>
        <Text style={styles.avatarText}>{(item.name || item.loginId || item.uniqueId || 'A').charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.adminInfo}>
        <Text style={styles.adminName} numberOfLines={1}>
          {item.name || 'Unnamed Admin'}
        </Text>
        <Text style={styles.adminLoginId} numberOfLines={1}>
          User ID: {item.loginId || item.uniqueId || 'Not assigned'}
        </Text>
        <View style={styles.institutePill}>
          <Ionicons name="business-outline" size={13} color="#2563EB" />
          <Text style={styles.adminInstitute} numberOfLines={1}>
            {item.instituteName}
          </Text>
        </View>
      </View>

      <View style={[styles.actionButtons, layout.isMobile && styles.actionButtonsMobile]}>
        <TouchableOpacity style={[styles.editButton, layout.isMobile && styles.smallActionButtonMobile]} onPress={() => handleEditAdmin(item)}>
          <Ionicons name="create-outline" size={20} color="#2563EB" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.deleteButton, layout.isMobile && styles.smallActionButtonMobile]} onPress={() => handleDeleteAdmin(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <LoadingState label="Loading administrators..." color="#2563EB" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={String(layout.listColumns)}
        data={sortedAdmins}
        numColumns={layout.listColumns}
        columnWrapperStyle={layout.listColumns > 1 ? styles.columnWrapper : undefined}
        keyExtractor={(item) => item.id}
        renderItem={renderAdmin}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAdmins} tintColor="#67E8F9" />}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: layout.horizontalPadding },
          layout.isDesktop && styles.listContentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[styles.header, layout.isMobile && styles.headerMobile, layout.isDesktop && styles.headerDesktop]}>
              <Text style={styles.eyebrow}>Administrators</Text>
              <Text style={[styles.title, layout.isMobile && styles.titleMobile]}>Institute Admins</Text>
              <Text style={[styles.subtitle, layout.isMobile && styles.subtitleMobile]}>Review ownership, verify login IDs, and maintain administrator profiles.</Text>
            </View>

            <TouchableOpacity style={[styles.addButton, layout.isMobile && styles.addButtonMobile]} onPress={() => { navigation.navigate('SuperAdminHome'); }}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.buttonText} numberOfLines={1}>Create Admin With New Institute</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={48} color="#2563EB" />
            <Text style={styles.emptyTitle}>No administrators found</Text>
            <Text style={styles.emptyText}>Create an institute from the dashboard to provision its first administrator.</Text>
          </View>
        }
      />

      <Modal animationType="fade" transparent visible={showEditModal} onRequestClose={closeEditModal}>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="person" size={26} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>Edit Administrator</Text>
                <Text style={styles.modalSubtitle}>This updates the Firestore profile shown throughout Edu Shii.</Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#94A3B8"
                  value={editName}
                  onChangeText={setEditName}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.readOnlyId}>
                <Ionicons name="id-card-outline" size={20} color="#67E8F9" />
                <View style={styles.readOnlyIdCopy}>
                  <Text style={styles.readOnlyIdLabel}>Administrator User ID</Text>
                  <Text selectable style={styles.readOnlyIdValue}>{editLoginId || 'Not assigned'}</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.modalBtn, saving && styles.disabledBtn]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <SmoothSpinner size={18} stroke={3} color="#FFFFFF" trackColor="#CBD5E1" /> : <Text style={styles.modalBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEditModal} disabled={saving}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  listContent: { paddingVertical: 16, paddingBottom: 32 },
  listContentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  header: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#075985',
  },
  headerMobile: { padding: 18, borderRadius: 8 },
  headerDesktop: { padding: 30 },
  eyebrow: { color: '#67E8F9', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', marginTop: 8 },
  titleMobile: { fontSize: 24, lineHeight: 29 },
  subtitle: { fontSize: 14, color: '#B9C6DD', marginTop: 8, lineHeight: 21 },
  subtitleMobile: { fontSize: 13, lineHeight: 19 },
  addButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addButtonMobile: { paddingHorizontal: 12, paddingVertical: 13, borderRadius: 8 },
  buttonText: { flexShrink: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 15, marginLeft: 8 },
  adminCard: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  adminCardMobile: { padding: 13, borderRadius: 8, alignItems: 'flex-start' },
  columnWrapper: { gap: 12 },
  adminCardDesktop: { flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarMobile: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  avatarText: { color: '#67E8F9', fontSize: 18, fontWeight: '900' },
  adminInfo: { flex: 1, minWidth: 0 },
  adminName: { fontSize: 17, fontWeight: '900', color: '#F8FAFC' },
  adminLoginId: { fontSize: 13, color: '#8EA4C8', marginTop: 3 },
  institutePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    maxWidth: '100%',
  },
  adminInstitute: { fontSize: 12, color: '#93C5FD', fontWeight: '800', marginLeft: 5 },
  actionButtons: { flexDirection: 'row', marginLeft: 10 },
  actionButtonsMobile: { marginLeft: 8 },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionButtonMobile: { width: 38, height: 38, borderRadius: 8 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 34,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: { fontSize: 20, color: '#F8FAFC', fontWeight: '900', marginTop: 14 },
  emptyText: { fontSize: 14, color: '#8EA4C8', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  modalContainer: { flex: 1, backgroundColor: '#020617' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#F8FAFC' },
  modalSubtitle: { color: '#8EA4C8', fontSize: 13, marginTop: 5, textAlign: 'center' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    marginBottom: 12,
  },
  icon: { paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: '#F8FAFC', outlineStyle: 'none' },
  readOnlyId: {
    alignItems: 'center',
    backgroundColor: '#082F49',
    borderColor: '#075985',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 13,
  },
  readOnlyIdCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
  readOnlyIdLabel: { color: '#7DD3FC', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  readOnlyIdValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '900', marginTop: 3 },
  modalBtn: { backgroundColor: '#2563EB', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  disabledBtn: { opacity: 0.6 },
  modalBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 13 },
  modalCancelBtnText: { fontSize: 15, color: '#8EA4C8', fontWeight: '800' },
});

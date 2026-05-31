import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation } from '@react-navigation/native';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

export default function ManageAdminUsers() {
  const navigation = useNavigation();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAdminId, setEditAdminId] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
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
    setEditEmail(admin.email || '');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditAdminId('');
    setEditName('');
    setEditEmail('');
  };

  const handleSaveEdit = async () => {
    const cleanedEmail = editEmail.trim().toLowerCase();

    if (!editName.trim() || !cleanedEmail) {
      Alert.alert('Error', 'Name and email are required.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', editAdminId), {
        name: editName.trim(),
        email: cleanedEmail,
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

  const handleDeleteAdmin = async (adminId) => {
    Alert.alert(
      'Delete Administrator',
      'Are you sure you want to delete this administrator profile? The Firebase Auth account may still need to be removed separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', adminId));
              Alert.alert('Success', 'Administrator profile deleted successfully.');
              fetchAdmins({ showLoader: false });
            } catch (error) {
              console.error('Error deleting admin:', error);
              Alert.alert('Error', 'Failed to delete administrator.');
            }
          },
        },
      ]
    );
  };

  const refreshAdmins = () => {
    setRefreshing(true);
    fetchAdmins({ showLoader: false });
  };

  const renderAdmin = ({ item }) => (
    <View style={styles.adminCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || item.email || 'A').charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.adminInfo}>
        <Text style={styles.adminName} numberOfLines={1}>
          {item.name || 'Unnamed Admin'}
        </Text>
        <Text style={styles.adminEmail} numberOfLines={1}>
          {item.email || 'No email'}
        </Text>
        <View style={styles.institutePill}>
          <Ionicons name="business-outline" size={13} color="#2563EB" />
          <Text style={styles.adminInstitute} numberOfLines={1}>
            {item.instituteName}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.editButton} onPress={() => handleEditAdmin(item)}>
          <Ionicons name="create-outline" size={20} color="#2563EB" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteAdmin(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading administrators...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedAdmins}
        keyExtractor={(item) => item.id}
        renderItem={renderAdmin}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAdmins} tintColor="#2563EB" />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Administrators</Text>
              <Text style={styles.title}>Institute Admins</Text>
              <Text style={styles.subtitle}>Review ownership, update contact details, and clean up admin profiles.</Text>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('SuperAdminHome')}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.buttonText}>Create Admin With New Institute</Text>
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
                <Text style={styles.modalSubtitle}>This updates the Firestore profile shown throughout Edu-Hub.</Text>
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

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#94A3B8"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveEdit}
                />
              </View>

              <TouchableOpacity style={[styles.modalBtn, saving && styles.disabledBtn]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save Changes</Text>}
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  header: { backgroundColor: '#0F172A', borderRadius: 22, padding: 22, marginBottom: 14 },
  eyebrow: { color: '#93C5FD', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#CBD5E1', marginTop: 8, lineHeight: 21 },
  addButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15, marginLeft: 8 },
  adminCard: {
    backgroundColor: '#fff',
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
  avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { color: '#2563EB', fontSize: 18, fontWeight: '900' },
  adminInfo: { flex: 1, minWidth: 0 },
  adminName: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  adminEmail: { fontSize: 13, color: '#64748B', marginTop: 3 },
  institutePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    maxWidth: '100%',
  },
  adminInstitute: { fontSize: 12, color: '#2563EB', fontWeight: '800', marginLeft: 5 },
  actionButtons: { flexDirection: 'row', marginLeft: 10 },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 34, backgroundColor: '#fff', borderRadius: 20 },
  emptyTitle: { fontSize: 20, color: '#0F172A', fontWeight: '900', marginTop: 14 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(15,23,42,0.62)' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 22, padding: 22 },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  modalSubtitle: { color: '#64748B', fontSize: 13, marginTop: 5, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, marginBottom: 12 },
  icon: { paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: '#0F172A', outlineStyle: 'none' },
  modalBtn: { backgroundColor: '#2563EB', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  disabledBtn: { opacity: 0.6 },
  modalBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 13 },
  modalCancelBtnText: { fontSize: 15, color: '#64748B', fontWeight: '800' },
});

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
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db } from '../../../firebaseConfig';

export default function ManageInstitutes() {
  const navigation = useNavigation();
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInstituteId, setEditInstituteId] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const sortedInstitutes = useMemo(
    () => [...institutes].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [institutes]
  );

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
        };
      });

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

  const handleEditInstitute = (institute) => {
    setEditInstituteId(institute.id);
    setEditName(institute.name || '');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditInstituteId('');
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Institute name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'institutes', editInstituteId), {
        name: editName.trim(),
        updatedAt: new Date(),
      });
      Alert.alert('Success', 'Institute name updated successfully.');
      closeEditModal();
      fetchInstitutes({ showLoader: false });
    } catch (error) {
      console.error('Error updating institute:', error);
      Alert.alert('Error', 'Failed to update institute name.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstitute = async (instituteId) => {
    Alert.alert(
      'Delete Institute',
      'Are you sure you want to delete this institute? This action cannot be undone. All associated data can become orphaned.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'institutes', instituteId));
              Alert.alert('Success', 'Institute deleted successfully.');
              fetchInstitutes({ showLoader: false });
            } catch (error) {
              console.error('Error deleting institute:', error);
              Alert.alert('Error', 'Failed to delete institute.');
            }
          },
        },
      ]
    );
  };

  const refreshInstitutes = () => {
    setRefreshing(true);
    fetchInstitutes({ showLoader: false });
  };

  const renderInstitute = ({ item }) => (
    <View style={styles.instituteCard}>
      <View style={styles.iconBox}>
        <Ionicons name="business" size={22} color="#2563EB" />
      </View>

      <View style={styles.instituteInfo}>
        <Text style={styles.instituteName} numberOfLines={1}>
          {item.name || 'Unnamed Institute'}
        </Text>
        <Text style={styles.instituteId}>ID: {item.instituteId}</Text>
        <Text style={styles.instituteMeta}>
          Created {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'recently'}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.editButton} onPress={() => handleEditInstitute(item)}>
          <Ionicons name="create-outline" size={20} color="#2563EB" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteInstitute(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading institutes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedInstitutes}
        keyExtractor={(item) => item.id}
        renderItem={renderInstitute}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshInstitutes} tintColor="#2563EB" />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Institutes</Text>
              <Text style={styles.title}>Manage Campuses</Text>
              <Text style={styles.subtitle}>Rename institutes, audit identifiers, and remove duplicate or test campuses.</Text>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('SuperAdminHome')}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.buttonText}>Add Institute From Dashboard</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={48} color="#2563EB" />
            <Text style={styles.emptyTitle}>No institutes found</Text>
            <Text style={styles.emptyText}>Use the dashboard to add the first campus and administrator.</Text>
          </View>
        }
      />

      <Modal animationType="fade" transparent visible={showEditModal} onRequestClose={closeEditModal}>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="create" size={26} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>Edit Institute</Text>
                <Text style={styles.modalSubtitle}>Update the display name used throughout the platform.</Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="school-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Institute Name"
                  placeholderTextColor="#94A3B8"
                  value={editName}
                  onChangeText={setEditName}
                  autoCapitalize="words"
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
  instituteCard: {
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
  iconBox: {
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
  instituteId: { fontSize: 12, color: '#64748B', marginTop: 3, fontWeight: '700' },
  instituteMeta: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
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

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';

const showAlert = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
};

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function ManageHolidays() {
  const { userData } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State for adding a new holiday
  const [modalVisible, setModalVisible] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const holidaysQuery = query(
      collection(db, 'holidays'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(holidaysQuery, (snapshot) => {
      const holidayList = snapshot.docs
        .map((holidayDoc) => ({ id: holidayDoc.id, ...holidayDoc.data() }))
        .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
      setHolidays(holidayList);
      setLoading(false);
    }, (error) => {
      console.error('Holiday fetch failed:', error);
      setLoading(false);
      showAlert('Calendar Unavailable', 'Could not load holidays right now.');
    });

    return () => unsubscribe();
  }, [userData?.instituteId]);

  const handleAddHoliday = async () => {
    if (!holidayName || !holidayDate) {
      showAlert('Incomplete', 'Please provide both the name and the date of the holiday.');
      return;
    }

    if (!userData?.instituteId) {
      showAlert('Missing Institute', 'Your admin profile is not linked to an institute.');
      return;
    }

    setAdding(true);
    try {
      await addDoc(collection(db, 'holidays'), {
        title: holidayName.trim(),
        date: holidayDate.trim(),
        type: 'Declared Holiday',
        instituteId: userData.instituteId,
        createdBy: userData.uid || null,
        createdByName: userData.name || userData.email || 'Admin',
        createdAt: serverTimestamp(),
      });
      setModalVisible(false);
      setHolidayName('');
      setHolidayDate('');
      showAlert('Success', 'Holiday added to the academic calendar.');
    } catch (error) {
      console.error('Holiday save failed:', error);
      showAlert('Error', 'Failed to add this holiday.');
    } finally {
      setAdding(false);
    }
  };

  const deleteHoliday = (id) => {
    const removeHoliday = async () => {
      try {
        await deleteDoc(doc(db, 'holidays', id));
      } catch (error) {
        console.error('Holiday delete failed:', error);
        showAlert('Error', 'Failed to remove this holiday.');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to remove this holiday?')) {
        removeHoliday();
      }
      return;
    }

    Alert.alert('Remove Holiday', 'Are you sure you want to remove this holiday?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: removeHoliday
      }
    ]);
  };

  const renderHolidayCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons name="calendar" size={24} color="#C2185B" />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>{item.date}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.type}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => deleteHoliday(item.id)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={20} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <DynamicHeader title="Manage Holidays" showBack={true} />
      
      {loading ? (
        <View style={styles.centerContainer}>
          <SmoothSpinner size="large" color="#2D3748" />
        </View>
      ) : (
        <FlatList
          data={holidays}
          keyExtractor={(item) => item.id}
          renderItem={renderHolidayCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-clear-outline" size={60} color="#CBD5E0" />
              <Text style={styles.emptyText}>No holidays declared yet.</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Holiday Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Declare New Holiday</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Holiday Name</Text>
            <TextInput 
              style={styles.input}
              placeholder="e.g. Winter Break"
              value={holidayName}
              onChangeText={setHolidayName}
            />

            <Text style={styles.label}>Date(s)</Text>
            <TextInput 
              style={styles.input}
              placeholder="e.g. Dec 24 - Jan 2"
              value={holidayDate}
              onChangeText={setHolidayDate}
            />

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleAddHoliday}
              disabled={adding}
            >
              {adding ? <SmoothSpinner color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Add Holiday</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  listContent: { padding: 16, paddingBottom: 130 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FCE4EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', marginBottom: 4 },
  date: { fontSize: 14, color: '#718096', marginBottom: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#EDF2F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, color: '#4A5568', fontWeight: '600' },
  deleteBtn: { padding: 8 },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#718096' },

  fab: {
    position: 'absolute',
    bottom: 88,
    right: 24,
    backgroundColor: '#C2185B',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C2185B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 350,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#4A5568', marginBottom: 8 },
  input: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 16, color: '#2D3748', marginBottom: 20 },
  submitBtn: { backgroundColor: '#2D3748', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

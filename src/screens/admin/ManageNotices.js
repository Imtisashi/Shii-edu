import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Keyboard, FlatList } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; 
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { createUnifiedNotification } from '../../services/unifiedNotificationService';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isCampusBroadcast = (notice) => {
  const originalType = notice?.data?.originalType;
  return (
    notice?.type === 'announcement' ||
    notice?.relatedType === 'notice' ||
    notice?.relatedType === 'broadcast' ||
    originalType === 'admin_notice' ||
    originalType === 'campus_broadcast'
  );
};

export default function ManageNotices() {
  const { userData } = useAuth();
  
  const [viewMode, setViewMode] = useState('list');
  const [notices, setNotices] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 1. FETCH ACTIVE NOTICES ---
  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "notifications"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const noticeList = snapshot.docs
        .map(document => ({ id: document.id, ...document.data() }))
        .filter(isCampusBroadcast)
        .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
      setNotices(noticeList);
      setLoadingList(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // --- 2. BROADCAST NOTICE ---
  const handleBroadcast = async () => {
    Keyboard.dismiss();

    if (!title.trim() || !message.trim()) {
      if (Platform.OS === 'web') {
        window.alert("Both title and message are required.");
      } else {
        Alert.alert("Required", "Both title and message are required.");
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createUnifiedNotification({
        title: title.trim(),
        message: message.trim(),
        type: 'announcement',
        targetRoles: ['student', 'teacher', 'admin'],
        instituteId: userData.instituteId,
        author: {
          uid: userData.uid,
          name: userData.name || 'Admin',
          role: userData.role || 'admin',
        },
        relatedId: 'campus-broadcast',
        relatedType: 'broadcast',
        data: {
          originalType: 'campus_broadcast'
        }
      });

      setTitle(''); 
      setMessage('');
      setViewMode('list');
    } catch (error) {
      console.error("Broadcast Error:", error);
      if (Platform.OS === 'web') {
        window.alert("Failed to send notice.");
      } else {
        Alert.alert("Error", "Failed to send notice.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 3. DELETE NOTICE ---
  const handleDelete = (noticeId) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Delete this broadcast permanently?")) {
        deleteDoc(doc(db, "notifications", noticeId));
      }
    } else {
      Alert.alert("Confirm Delete", "Delete this broadcast permanently?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteDoc(doc(db, "notifications", noticeId)) }
      ]);
    }
  };

  // --- RENDER: LIST VIEW ---
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Campus Broadcasts</Text>
            <Text style={styles.headerSub}>Manage official announcements</Text>
          </View>
          <TouchableOpacity style={styles.addBtnSmall} onPress={() => setViewMode('add')}>
            <Ionicons name="megaphone" size={20} color="#fff" />
            <Text style={styles.addBtnSmallText}>New Notice</Text>
          </TouchableOpacity>
        </View>

        {loadingList ? (
          <SmoothSpinner size="large" color="#4A90E2" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={notices}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.noticeCard}>
                <View style={styles.noticeInfo}>
                  <Text style={styles.noticeTitle}>{item.title}</Text>
                  <Text style={styles.noticeMessage}>{item.message}</Text>
                  <Text style={styles.noticeMeta}>Posted by {typeof item.author === 'string' ? item.author : item.author?.name || 'Admin'}</Text>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#E53E3E" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={50} color="#CBD5E0" />
                <Text style={styles.emptyText}>No active announcements.</Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  // --- RENDER: ADD FORM VIEW ---
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        
        <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
          <Ionicons name="arrow-back" size={24} color="#4A5568" />
          <Text style={styles.backBtnText}>Back to Board</Text>
        </TouchableOpacity>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Draft New Broadcast</Text>

          <Text style={styles.label}>Headline</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Campus Closed Tomorrow" 
            value={title} 
            onChangeText={setTitle} 
            returnKeyType="next"
          />

          <Text style={styles.label}>Full Message</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            placeholder="Type the full announcement details here..." 
            value={message} 
            onChangeText={setMessage} 
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleBroadcast} disabled={isSubmitting}>
            {isSubmitting ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Send to All</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  headerSub: { fontSize: 14, color: '#64748B' },
  addBtnSmall: { backgroundColor: '#4A90E2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnSmallText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  noticeCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#4A90E2' },
  noticeInfo: { flex: 1, paddingRight: 10 },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
  noticeMessage: { fontSize: 14, color: '#4A5568', marginTop: 5, lineHeight: 20 },
  noticeMeta: { fontSize: 11, color: '#A0AEC0', marginTop: 10, fontStyle: 'italic' },
  deleteBtn: { padding: 10, backgroundColor: '#FFF5F5', borderRadius: 8 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: '#A0AEC0', fontSize: 16, fontWeight: '500' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtnText: { color: '#4A5568', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 3 },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#2D3748', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#F7FAFC', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15 },
  textArea: { height: 120 },
  submitBtn: { backgroundColor: '#4A90E2', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 25 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

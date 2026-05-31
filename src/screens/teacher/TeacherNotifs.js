import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';

export default function TeacherNotifs() {
  const { userData } = useAuth();
  
  const [activeTab, setActiveTab] = useState('read');
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload Notifs State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetLevel, setTargetLevel] = useState('Overall'); 
  const [sending, setSending] = useState(false);

  // --- 1. FETCH LIVE NOTICES ---
  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "notices"),
      where("instituteId", "==", userData.instituteId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // --- 2. SEND NOTICE TO DATABASE ---
  const handleSendNotice = async () => {
    if (!title || !message) {
      return Alert.alert('Incomplete', 'Please provide a title and message.');
    }

    setSending(true);
    try {
      await addDoc(collection(db, "notices"), {
        title: title.trim(),
        message: message.trim(),
        content: message.trim(), // Saving as both to prevent mismatch with Student UI
        author: userData.name,
        role: 'teacher',
        targetLevel: targetLevel,
        instituteId: userData.instituteId,
        createdAt: serverTimestamp(),
      });

      const successMsg = `Notification sent to ${targetLevel} successfully!`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      setTitle('');
      setMessage('');
      setTargetLevel('Overall');
      setActiveTab('read');
    } catch (_error) {
      const errMsg = "Failed to send notice.";
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setSending(false);
    }
  };

  const renderNotice = ({ item }) => (
    <View style={styles.notifCard}>
      <View style={styles.notifHeader}>
        <Text style={styles.notifTitle}>{item.title}</Text>
        <Text style={styles.notifDate}>
          {item.createdAt ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}
        </Text>
      </View>
      <Text style={styles.notifMessage}>{item.message || item.content}</Text>
      
      <View style={styles.notifFooter}>
        <Text style={styles.notifSender}>From: {item.author}</Text>
        {item.targetLevel && (
          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>{item.targetLevel}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <DynamicHeader title="Broadcasts" />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'read' && styles.activeTab]} onPress={() => setActiveTab('read')}>
          <Text style={[styles.tabText, activeTab === 'read' && styles.activeTabText]}>Inbox</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'upload' && styles.activeTab]} onPress={() => setActiveTab('upload')}>
          <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>Send Notice</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'read' && (
        loading ? (
          <View style={styles.centerContainer}><SmoothSpinner size="large" color="#8E24AA" /></View>
        ) : (
          <FlatList
            data={notices}
            keyExtractor={(item) => item.id}
            renderItem={renderNotice}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={{textAlign:'center', color:'#94A3B8', marginTop: 20}}>No broadcasts found.</Text>}
          />
        )
      )}

      {activeTab === 'upload' && (
        <ScrollView contentContainerStyle={styles.uploadContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Notice Title</Text>
            <TextInput style={styles.input} placeholder="e.g., Extra Class Tomorrow" value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Message</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Write the full notice here..." value={message} onChangeText={setMessage} multiline numberOfLines={4} textAlignVertical="top" />

            <Text style={styles.label}>Target Audience</Text>
            <View style={styles.chipContainer}>
              {['Overall', 'Specific Dept', 'Specific Semester'].map((lvl) => (
                <TouchableOpacity key={lvl} style={[styles.chip, targetLevel === lvl && styles.activeChip]} onPress={() => setTargetLevel(lvl)}>
                  <Text style={[styles.chipText, targetLevel === lvl && styles.activeChipText]}>{lvl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSendNotice} disabled={sending}>
            {sending ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitBtnText}>Broadcast Notification</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 8, marginHorizontal: 16, marginTop: 16, borderRadius: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#8E24AA' },
  tabText: { fontSize: 16, fontWeight: '600', color: '#718096' },
  activeTabText: { color: '#FFFFFF' },
  listContent: { padding: 16, paddingBottom: 80 },
  notifCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#8E24AA' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', flex: 1 },
  notifDate: { fontSize: 12, color: '#A0AEC0' },
  notifMessage: { fontSize: 15, color: '#4A5568', lineHeight: 22, marginBottom: 16 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 12 },
  notifSender: { fontSize: 12, fontWeight: '600', color: '#718096' },
  targetBadge: { backgroundColor: '#F3E5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  targetBadgeText: { color: '#8E24AA', fontSize: 10, fontWeight: 'bold' },
  uploadContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#4A5568', marginBottom: 8 },
  input: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 },
  textArea: { minHeight: 100 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  activeChip: { backgroundColor: '#8E24AA', borderColor: '#8E24AA' },
  chipText: { color: '#4A5568', fontSize: 14 },
  activeChipText: { color: '#FFFFFF', fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#8E24AA', borderRadius: 12, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  submitBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});

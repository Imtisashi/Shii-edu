import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { createUnifiedNotification, useUnifiedNotifications } from '../../services/unifiedNotificationService';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';

export default function TeacherNotifs() {
  const { currentUser, userData } = useAuth();
  const { notifications, loading, error, markAsRead, markAllAsRead } = useUnifiedNotifications({ limit: 100 });

  const [activeTab, setActiveTab] = useState('read');
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetLevel, setTargetLevel] = useState('Overall');
  const [sending, setSending] = useState(false);

  const formatDate = (createdAt) => {
    if (!createdAt) return 'Just now';
    if (createdAt.toDate) return createdAt.toDate().toLocaleDateString();
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString();
    return new Date(createdAt).toLocaleDateString();
  };

  const getAuthorName = (author) => {
    if (!author) return 'School';
    if (typeof author === 'string') return author;
    return author.name || author.email || 'School';
  };

  const isRead = (item) => item.readBy?.includes(currentUser?.uid) || item.isRead === true;

  const handleSendNotice = async () => {
    if (!title.trim() || !message.trim()) {
      return Alert.alert('Incomplete', 'Please provide a title and message.');
    }

    setSending(true);
    try {
      await createUnifiedNotification({
        title,
        message,
        type: 'announcement',
        targetRoles: ['student', 'teacher', 'admin'],
        instituteId: userData.instituteId,
        author: {
          uid: currentUser?.uid,
          name: userData.name || 'Teacher',
          role: userData.role,
        },
        data: {
          targetLevel,
          originalType: 'teacher_notice',
        },
      });

      const successMsg = `Notification sent to ${targetLevel} successfully!`;
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Success', successMsg);

      setTitle('');
      setMessage('');
      setTargetLevel('Overall');
      setActiveTab('read');
    } catch (sendError) {
      console.error('Failed to send teacher notification:', sendError);
      const errMsg = 'Failed to send notice.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Error', errMsg);
    } finally {
      setSending(false);
    }
  };

  const renderNotice = ({ item }) => (
    <View style={[styles.notifCard, !isRead(item) && styles.unreadCard]}>
      <View style={styles.notifHeader}>
        <Text style={[styles.notifTitle, !isRead(item) && styles.unreadTitle]}>{item.title}</Text>
        <Text style={styles.notifDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.notifMessage}>{item.message || item.content}</Text>

      <View style={styles.notifFooter}>
        <Text style={styles.notifSender}>From: {getAuthorName(item.author)}</Text>
        {(item.data?.targetLevel || item.targetLevel) && (
          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>{item.data?.targetLevel || item.targetLevel}</Text>
          </View>
        )}
        {!isRead(item) && (
          <TouchableOpacity
            style={styles.markAsReadBtn}
            onPress={(event) => {
              event.stopPropagation();
              Haptics.selectionAsync();
              markAsRead(item.id);
            }}
          >
            <Ionicons name="radio-button-off" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

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
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotice}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              notifications.length > 0 ? (
                <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
                  <Ionicons name="checkmark-done" size={18} color="#8E24AA" />
                  <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={<Text style={styles.emptyText}>{error ? 'Unable to load broadcasts.' : 'No broadcasts found.'}</Text>}
          />
        )
      )}

      {activeTab === 'upload' && (
        <ScrollView contentContainerStyle={styles.uploadContent} keyboardShouldPersistTaps="handled">
          {Platform.OS === 'web' && (
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButtonWeb}>
              <Ionicons name="refresh" size={20} color={refreshing ? Colors.primary : '#718096'} />
              {refreshing && <Text style={styles.refreshTextWeb}>Updating...</Text>}
            </TouchableOpacity>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Notice Title</Text>
            <TextInput style={styles.input} placeholder="e.g., Extra Class Tomorrow" value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Message</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Write the full notice here..." value={message} onChangeText={setMessage} multiline numberOfLines={4} textAlignVertical="top" />

            <Text style={styles.label}>Target Audience</Text>
            <View style={styles.chipContainer}>
              {['Overall', 'Specific Dept', 'Specific Semester'].map((level) => (
                <TouchableOpacity key={level} style={[styles.chip, targetLevel === level && styles.activeChip]} onPress={() => setTargetLevel(level)}>
                  <Text style={[styles.chipText, targetLevel === level && styles.activeChipText]}>{level}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSendNotice} disabled={sending}>
              {sending ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitBtnText}>Broadcast Notification</Text>}
            </TouchableOpacity>
          </View>
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
  unreadCard: { borderLeftColor: '#3B82F6' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', flex: 1 },
  unreadTitle: { fontWeight: '900' },
  notifDate: { fontSize: 12, color: '#A0AEC0' },
  notifMessage: { fontSize: 15, color: '#4A5568', lineHeight: 22, marginBottom: 16 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 12 },
  notifSender: { fontSize: 12, fontWeight: '600', color: '#718096' },
  targetBadge: { backgroundColor: '#F3E5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  targetBadgeText: { color: '#8E24AA', fontSize: 10, fontWeight: 'bold' },
  markAsReadBtn: { padding: 6, borderRadius: 6, backgroundColor: '#F0F9FF' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12, borderRadius: 8, backgroundColor: '#F3E5F5' },
  markAllText: { marginLeft: 6, color: '#8E24AA', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20 },
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
  refreshButtonWeb: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', backgroundColor: 'rgba(74, 144, 226, 0.1)', padding: 8, borderRadius: 20, marginBottom: 12 },
  refreshTextWeb: { marginLeft: 8, fontSize: 12, color: '#4A90E2' },
});

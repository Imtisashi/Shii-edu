import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { createUnifiedNotification, useUnifiedNotifications } from '../../services/unifiedNotificationService';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { aiSmartCompose } from '../../services/aiService';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { isNoticeForBroadcasts } from '../../utils/isNoticeForBroadcasts';

const TARGET_LEVELS = ['Overall', 'Specific Dept', 'Specific Semester'];
const RESPONSE_MODES = [
  { id: 'none', label: 'Notice only' },
  { id: 'mcq', label: 'MCQ' },
  { id: 'vote', label: 'Vote' },
  { id: 'opinion', label: 'Opinion' },
];
const NoticeSchema = z.object({
  message: z.string().trim().min(8, 'Enter a complete notice message.').max(1200, 'Keep the notice under 1,200 characters.'),
  title: z.string().trim().min(3, 'Enter a clear notice title.').max(120, 'Keep the title under 120 characters.'),
});
const SmartComposeSchema = z.object({
  roughThought: z.string().trim().min(8, 'Add a little more detail before enhancing.').max(1800, 'Keep the rough thought under 1,800 characters.'),
  targetLevel: z.enum(TARGET_LEVELS),
});

const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message || title);
    return;
  }
  Alert.alert(title, message);
};

const getValidationMessage = (result, fallback) => (
  result.success ? fallback : result.error.issues?.[0]?.message || fallback
);

const parseOptions = (value) => String(value || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(0, 8);

export default function TeacherNotifs() {
  const { currentUser, userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const { notifications, loading, error, markAsRead, markAllAsRead } = useUnifiedNotifications({ limit: 100 });

  const [activeTab, setActiveTab] = useState('read');
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [roughThought, setRoughThought] = useState('');
  const [targetLevel, setTargetLevel] = useState('Overall');
  const [responseMode, setResponseMode] = useState('none');
  const [responseOptions, setResponseOptions] = useState('');
  const [responsePrompt, setResponsePrompt] = useState('');
  const safeNotifications = Array.isArray(notifications) ? notifications.filter(isNoticeForBroadcasts) : [];

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

  const enhanceNotice = async () => {
    const validation = SmartComposeSchema.safeParse({
      roughThought,
      targetLevel,
    });
    if (!validation.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showMessage('More Detail Needed', getValidationMessage(validation, 'Add a rough thought before enhancing.'));
      return false;
    }

    if (!userData?.instituteId) {
      showMessage('Missing Institute', 'Your profile is not linked to an institute.');
      return false;
    }

    try {
      const response = await aiSmartCompose({
        instituteId: userData.instituteId,
        roughThought: validation.data.roughThought,
        targetLevel: validation.data.targetLevel,
      });
      setTitle(response.draft.title);
      setMessage(response.draft.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (composeError) {
      console.error('Smart Compose failed:', composeError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showMessage('Smart Compose Unavailable', composeError?.message || 'The notice could not be enhanced right now.');
      return false;
    }
  };
  const {
    isPending: enhancing,
    run: handleEnhanceNotice,
  } = useSingleFlightAction(enhanceNotice, {
    cooldownMs: 900,
    haptic: 'medium',
  });

  const sendNotice = async () => {
    const validation = NoticeSchema.safeParse({ title, message });
    if (!validation.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showMessage('Incomplete Notice', getValidationMessage(validation, 'Please provide a title and message.'));
      return false;
    }

    if (!userData?.instituteId) {
      showMessage('Missing Institute', 'Your profile is not linked to an institute.');
      return false;
    }

    const responseRequest = responseMode === 'none' ? null : {
      kind: responseMode,
      options: responseMode === 'mcq' || responseMode === 'vote' ? parseOptions(responseOptions) : [],
      prompt: responsePrompt.trim() || validation.data.title,
    };

    if (responseRequest && (responseRequest.kind === 'mcq' || responseRequest.kind === 'vote') && responseRequest.options.length < 2) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showMessage('Add Response Options', 'Add at least two short options, one per line.');
      return false;
    }

    try {
      await createUnifiedNotification({
        title: validation.data.title,
        message: validation.data.message,
        type: 'announcement',
        targetRoles: ['student'],
        instituteId: userData.instituteId,
        author: {
          uid: currentUser?.uid,
          name: userData.name || 'Teacher',
          role: userData.role,
        },
        data: {
          targetLevel,
          originalType: 'teacher_notice',
          responseRequest,
        },
      });

      const successMsg = `Notification sent to ${targetLevel} successfully!`;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showMessage('Success', successMsg);

      setTitle('');
      setMessage('');
      setRoughThought('');
      setTargetLevel('Overall');
      setResponseMode('none');
      setResponseOptions('');
      setResponsePrompt('');
      setActiveTab('read');
      return true;
    } catch (sendError) {
      console.error('Failed to send teacher notification:', sendError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showMessage('Send Failed', sendError?.message || 'Failed to send notice.');
      return false;
    }
  };
  const {
    isPending: sending,
    run: handleSendNotice,
  } = useSingleFlightAction(sendNotice, {
    cooldownMs: 1000,
    haptic: 'medium',
  });

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
              markAsRead(item.id);
            }}
          >
            <Ionicons name="radio-button-off" size={16} color={colors.textSoft} />
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
          <RosterSkeleton rowCount={5} showFilters={false} />
        ) : (
          <FlatList
            data={safeNotifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotice}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              safeNotifications.length > 0 ? (
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.uploadContent} keyboardShouldPersistTaps="handled">
            {Platform.OS === 'web' && (
              <TouchableOpacity accessibilityLabel="Refresh broadcasts" accessibilityRole="button" onPress={handleRefresh} style={styles.refreshButtonWeb}>
                <Ionicons name="refresh" size={20} color={refreshing ? colors.text : colors.muted} />
                {refreshing && <Text style={styles.refreshTextWeb}>Updating...</Text>}
              </TouchableOpacity>
            )}

            <View style={styles.card}>
              <View style={styles.smartComposePanel}>
                <View style={styles.smartComposeHeader}>
                  <View style={styles.smartComposeIcon}>
                    <Ionicons name="sparkles" size={20} color="#C4B5FD" />
                  </View>
                  <View style={styles.smartComposeCopy}>
                    <Text style={styles.smartComposeTitle}>Smart Compose</Text>
                    <Text style={styles.smartComposeText}>Turn a rough thought into a polished student notice, then review it before sending.</Text>
                  </View>
                </View>
                <TextInput
                  accessibilityLabel="Rough notice thought"
                  editable={!enhancing}
                  maxLength={1800}
                  multiline
                  numberOfLines={4}
                  onChangeText={setRoughThought}
                  placeholder="e.g., tell class 10 that tomorrow's science practical starts at 9 AM in lab 2 and they should bring their record books"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.roughThoughtInput]}
                  textAlignVertical="top"
                  value={roughThought}
                />
                <TouchableOpacity
                  accessibilityLabel="Enhance notice with Smart Compose"
                  accessibilityRole="button"
                  disabled={enhancing}
                  onPress={handleEnhanceNotice}
                  style={[styles.enhanceButton, enhancing && styles.disabledButton]}
                >
                  {enhancing ? (
                    <SmoothSpinner color="#FFFFFF" size={22} />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.enhanceButtonText}>Enhance Draft</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Notice Title</Text>
              <TextInput
                accessibilityLabel="Notice title"
                maxLength={120}
                onChangeText={setTitle}
                placeholder="e.g., Extra Class Tomorrow"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={title}
              />

              <Text style={styles.label}>Message</Text>
              <TextInput
                accessibilityLabel="Notice message"
                maxLength={1200}
                multiline
                numberOfLines={5}
                onChangeText={setMessage}
                placeholder="Write the full notice here..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={message}
              />

              <Text style={styles.label}>Target Audience</Text>
              <View style={styles.chipContainer}>
                {TARGET_LEVELS.map((level) => (
                  <TouchableOpacity
                    accessibilityLabel={`Target ${level}`}
                    accessibilityRole="button"
                    key={level}
                    onPress={() => {
                      setTargetLevel(level);
                    }}
                    style={[styles.chip, targetLevel === level && styles.activeChip]}
                  >
                    <Text style={[styles.chipText, targetLevel === level && styles.activeChipText]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.responsePanel}>
                <Text style={styles.label}>Collect Student Input</Text>
                <View style={styles.responseModeRow}>
                  {RESPONSE_MODES.map((mode) => {
                    const active = responseMode === mode.id;
                    return (
                      <TouchableOpacity
                        accessibilityLabel={`Response mode ${mode.label}`}
                        accessibilityRole="button"
                        key={mode.id}
                        onPress={() => setResponseMode(mode.id)}
                        style={[styles.responseModeChip, active && styles.responseModeChipActive]}
                      >
                        <Text style={[styles.responseModeText, active && styles.responseModeTextActive]}>{mode.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {responseMode !== 'none' ? (
                  <>
                    <Text style={styles.label}>Question or Prompt</Text>
                    <TextInput
                      accessibilityLabel="Student response prompt"
                      maxLength={180}
                      onChangeText={setResponsePrompt}
                      placeholder="e.g., Which lab slot works best for you?"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={responsePrompt}
                    />

                    {(responseMode === 'mcq' || responseMode === 'vote') ? (
                      <>
                        <Text style={styles.label}>Options</Text>
                        <TextInput
                          accessibilityLabel="Student response options"
                          maxLength={360}
                          multiline
                          numberOfLines={4}
                          onChangeText={setResponseOptions}
                          placeholder={'One option per line\nMorning\nAfternoon'}
                          placeholderTextColor={colors.muted}
                          style={[styles.input, styles.optionArea]}
                          textAlignVertical="top"
                          value={responseOptions}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>

              <TouchableOpacity
                accessibilityLabel="Broadcast notification to students"
                accessibilityRole="button"
                disabled={sending}
                onPress={handleSendNotice}
                style={[styles.submitBtn, sending && styles.disabledButton]}
              >
                {sending ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitBtnText}>Broadcast Notification</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 8, marginHorizontal: 16, marginTop: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#8E24AA' },
  tabText: { fontSize: 16, fontWeight: '800', color: '#8EA4C8' },
  activeTabText: { color: '#FFFFFF' },
  listContent: { padding: 16, paddingBottom: 80 },
  notifCard: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 16, marginBottom: 16 },
  unreadCard: { borderColor: '#3B82F6' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', flex: 1 },
  unreadTitle: { fontWeight: '900' },
  notifDate: { fontSize: 12, color: '#8EA4C8', fontWeight: '800' },
  notifMessage: { fontSize: 15, color: '#B9C6DD', lineHeight: 22, marginBottom: 16 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12 },
  notifSender: { fontSize: 12, fontWeight: '800', color: '#8EA4C8' },
  targetBadge: { backgroundColor: '#3B0764', borderColor: '#6D28D9', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  targetBadgeText: { color: '#DDD6FE', fontSize: 10, fontWeight: 'bold' },
  markAsReadBtn: { padding: 6, borderRadius: 8, backgroundColor: '#082F49', borderColor: '#075985', borderWidth: 1 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12, borderRadius: 8, backgroundColor: '#3B0764', borderColor: '#6D28D9', borderWidth: 1 },
  markAllText: { marginLeft: 6, color: '#8E24AA', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#B9C6DD', marginTop: 20, fontWeight: '800' },
  uploadContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 16, marginBottom: 20 },
  disabledButton: { opacity: 0.7 },
  enhanceButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#7C3AED', borderColor: '#334155', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 46, paddingHorizontal: 16 },
  enhanceButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginLeft: 7 },
  label: { fontSize: 14, fontWeight: '800', color: '#B9C6DD', marginBottom: 8 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, fontSize: 16, color: '#F8FAFC', marginBottom: 16, outlineStyle: 'none' },
  roughThoughtInput: { marginBottom: 12, minHeight: 98 },
  smartComposeCopy: { flex: 1, minWidth: 0 },
  smartComposeHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  smartComposeIcon: { alignItems: 'center', backgroundColor: '#1E1B4B', borderColor: '#6D28D9', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', marginRight: 12, width: 44 },
  smartComposePanel: { backgroundColor: '#1E1B4B', borderColor: '#6D28D9', borderRadius: 8, borderWidth: 1, marginBottom: 18, padding: 14 },
  smartComposeText: { color: '#B9C6DD', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 3 },
  smartComposeTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  textArea: { minHeight: 100 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, marginBottom: 8, backgroundColor: '#111827' },
  activeChip: { backgroundColor: '#8E24AA', borderColor: '#8E24AA' },
  chipText: { color: '#B9C6DD', fontSize: 14, fontWeight: '800' },
  activeChipText: { color: '#FFFFFF', fontWeight: 'bold' },
  optionArea: { minHeight: 94 },
  responseModeChip: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginBottom: 8, marginRight: 8, paddingHorizontal: 12, paddingVertical: 8 },
  responseModeChipActive: { backgroundColor: '#3B0764', borderColor: '#8E24AA' },
  responseModeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  responseModeText: { color: '#B9C6DD', fontSize: 13, fontWeight: '900' },
  responseModeTextActive: { color: '#F5D0FE' },
  responsePanel: { backgroundColor: '#020617', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginBottom: 18, padding: 13 },
  submitBtn: { backgroundColor: '#8E24AA', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingVertical: 16, alignItems: 'center'},
  submitBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  refreshButtonWeb: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', backgroundColor: '#082F49', padding: 8, borderRadius: 8, marginBottom: 12 },
  refreshTextWeb: { marginLeft: 8, fontSize: 12, color: '#4A90E2' },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Keyboard, FlatList } from 'react-native';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { aiSmartCompose } from '../../services/aiService';
import { createUnifiedNotification } from '../../services/unifiedNotificationService';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import DynamicHeader from '../../components/DynamicHeader';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';
import { isNoticeForBroadcasts } from '../../utils/isNoticeForBroadcasts';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const RESPONSE_MODES = [
  { id: 'none', label: 'Notice only' },
  { id: 'mcq', label: 'MCQ' },
  { id: 'vote', label: 'Voting' },
  { id: 'opinion', label: 'Opinion' },
];

const AI_TARGET_LEVELS = ['Overall', 'Specific Dept', 'Specific Semester'];

const parseOptions = (value) => String(value || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(0, 8);

export default function ManageNotices() {
  const { userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  
  const [viewMode, setViewMode] = useState('list');
  const [notices, setNotices] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [responseMode, setResponseMode] = useState('none');
  const [responseOptions, setResponseOptions] = useState('');
  const [responsePrompt, setResponsePrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiIdea, setAiIdea] = useState('');
  const [aiTargetLevel, setAiTargetLevel] = useState('Overall');
  const [aiBusy, setAiBusy] = useState(false);

  // --- 1. FETCH ACTIVE NOTICES ---
  useEffect(() => {
    if (!userData?.instituteId) {
      setLoadingList(false);
      return undefined;
    }

    const q = query(
      collection(db, "notifications"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const noticeList = snapshot.docs
        .map(document => ({ id: document.id, ...document.data() }))
        .filter(isNoticeForBroadcasts)
        .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
      setNotices(noticeList);
      setLoadingList(false);
    }, (error) => {
      console.error('Campus broadcasts query failed:', error);
      setNotices([]);
      setLoadingList(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // --- 2. BROADCAST NOTICE ---
  const handleBroadcast = async () => {
    Keyboard.dismiss();

    if (!title.trim() || !message.trim()) {
      showNativeMessage('Required', 'Both title and message are required.');
      return;
    }

    const responseRequest = responseMode === 'none' ? null : {
      kind: responseMode,
      options: responseMode === 'mcq' || responseMode === 'vote' ? parseOptions(responseOptions) : [],
      prompt: responsePrompt.trim() || title.trim(),
    };

    if (responseRequest && (responseRequest.kind === 'mcq' || responseRequest.kind === 'vote') && responseRequest.options.length < 2) {
      showNativeMessage('Add Options', 'Add at least two options, one per line.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createUnifiedNotification({
        title: title.trim(),
        message: message.trim(),
        type: 'announcement',
        targetRoles: ['student', 'teacher', 'admin', 'parent', 'driver'],
        recipientUids: [],
        instituteId: userData.instituteId,
        author: {
          uid: userData.uid,
          name: userData.name || 'Admin',
          role: userData.role || 'admin',
        },
        relatedId: 'campus-broadcast',
        relatedType: 'broadcast',
        data: {
          originalType: 'campus_broadcast',
          responseRequest,
        }
      });

      setTitle(''); 
      setMessage('');
      setResponseMode('none');
      setResponseOptions('');
      setResponsePrompt('');
      setAiIdea('');
      setViewMode('list');
      showNativeMessage('Broadcast Sent', 'The announcement has been sent to all institute roles.');
    } catch (error) {
      console.error("Broadcast Error:", error);
      showNativeError('Broadcast Failed', error, 'The announcement could not be sent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAIDraft = async () => {
    Keyboard.dismiss();
    const roughThought = [
      aiIdea.trim(),
      title.trim() ? `Existing headline: ${title.trim()}` : '',
      message.trim() ? `Existing message: ${message.trim()}` : '',
      responseMode !== 'none' ? `Student response mode: ${responseMode}` : '',
    ].filter(Boolean).join('\n');

    if (roughThought.length < 8) {
      showNativeMessage('Add a brief', 'Write a short instruction for the announcement draft.');
      return;
    }

    setAiBusy(true);
    try {
      const response = await aiSmartCompose({
        roughThought,
        targetLevel: aiTargetLevel,
        instituteId: userData?.instituteId,
      });
      setTitle(response.draft.title);
      setMessage(response.draft.message);
      showNativeMessage('Draft Ready', 'Review the AI draft before sending it.');
    } catch (error) {
      showNativeError('AI Draft Failed', error, 'The announcement draft could not be generated.');
    } finally {
      setAiBusy(false);
    }
  };

  // --- 3. DELETE NOTICE ---
  const handleDelete = (noticeId) => {
    Alert.alert("Confirm Delete", "Delete this broadcast permanently?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteDoc(doc(db, "notifications", noticeId)) }
    ]);
  };

  // --- RENDER: LIST VIEW ---
  if (viewMode === 'list') {
    return (
      <View style={styles.screen}>
        <DynamicHeader title="Broadcasts" />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Campus Broadcasts</Text>
              <Text style={styles.headerSub}>Manage official announcements</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Create new broadcast" accessibilityRole="button" style={styles.addBtnSmall} onPress={() => setViewMode('add')}>
              <Ionicons name="megaphone" size={20} color="#fff" />
              <Text style={styles.addBtnSmallText}>New Notice</Text>
            </TouchableOpacity>
          </View>

          {loadingList ? (
            <RosterSkeleton rowCount={5} showFilters={false} />
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
                  <TouchableOpacity accessibilityLabel={`Delete broadcast ${item.title || ''}`.trim()} accessibilityRole="button" style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#E53E3E" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={50} color={colors.muted} />
                  <Text style={styles.emptyText}>No active announcements.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    );
  }

  // --- RENDER: ADD FORM VIEW ---
  return (
    <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DynamicHeader title="New Broadcast" />
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        
        <TouchableOpacity accessibilityLabel="Back to broadcast board" accessibilityRole="button" style={styles.backBtn} onPress={() => setViewMode('list')}>
          <Ionicons name="arrow-back" size={24} color={colors.textSoft} />
          <Text style={styles.backBtnText}>Back to Board</Text>
        </TouchableOpacity>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Draft New Broadcast</Text>

          <View style={styles.aiPanel}>
            <View style={styles.aiPanelHeader}>
              <View style={styles.aiIcon}>
                <Ionicons name="sparkles-outline" size={18} color="#BFDBFE" />
              </View>
              <View style={styles.aiPanelCopy}>
                <Text style={styles.aiTitle}>AI announcement draft</Text>
                <Text style={styles.aiSub}>Turn rough admin notes into a clean notice. Review before sending.</Text>
              </View>
            </View>

            <Text style={styles.label}>Brief for AI</Text>
            <TextInput
              style={[styles.input, styles.aiArea]}
              placeholder="e.g. Tell parents that tomorrow's second bus route starts 20 minutes earlier because of roadwork."
              placeholderTextColor={colors.muted}
              value={aiIdea}
              onChangeText={setAiIdea}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.aiTargetRow}>
              {AI_TARGET_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  accessibilityLabel={`Set AI audience to ${level}`}
                  accessibilityRole="button"
                  onPress={() => setAiTargetLevel(level)}
                  style={[styles.aiTargetChip, aiTargetLevel === level && styles.aiTargetChipActive]}
                >
                  <Text style={[styles.aiTargetText, aiTargetLevel === level && styles.aiTargetTextActive]}>{level}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              accessibilityLabel="Generate AI announcement draft"
              accessibilityRole="button"
              style={[styles.aiButton, aiBusy && styles.disabled]}
              onPress={handleAIDraft}
              disabled={aiBusy}
            >
              {aiBusy ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons name="sparkles" size={17} color="#FFFFFF" />}
              <Text style={styles.aiButtonText}>{aiBusy ? 'Drafting' : 'Generate Draft'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Headline</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Campus Closed Tomorrow" 
            placeholderTextColor={colors.muted}
            value={title} 
            onChangeText={setTitle} 
            returnKeyType="next"
          />

          <Text style={styles.label}>Full Message</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            placeholder="Type the full announcement details here..." 
            placeholderTextColor={colors.muted}
            value={message} 
            onChangeText={setMessage} 
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Collect Student Input</Text>
          <View style={styles.responseModeRow}>
            {RESPONSE_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                accessibilityLabel={`Set response mode to ${mode.label}`}
                accessibilityRole="button"
                onPress={() => setResponseMode(mode.id)}
                style={[styles.responseModeChip, responseMode === mode.id && styles.responseModeChipActive]}
              >
                <Text style={[styles.responseModeText, responseMode === mode.id && styles.responseModeTextActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {responseMode !== 'none' && (
            <View style={styles.responsePanel}>
              <Text style={styles.label}>Question or Prompt</Text>
              <TextInput
                style={styles.input}
                placeholder="What should students answer?"
                placeholderTextColor={colors.muted}
                value={responsePrompt}
                onChangeText={setResponsePrompt}
              />

              {(responseMode === 'mcq' || responseMode === 'vote') && (
                <>
                  <Text style={styles.label}>Options</Text>
                  <TextInput
                    style={[styles.input, styles.optionArea]}
                    placeholder={'One option per line\ne.g. Yes\nNo\nMaybe'}
                    placeholderTextColor={colors.muted}
                    value={responseOptions}
                    onChangeText={setResponseOptions}
                    multiline
                    textAlignVertical="top"
                  />
                </>
              )}
            </View>
          )}

          <TouchableOpacity accessibilityLabel="Send broadcast to all roles" accessibilityRole="button" style={styles.submitBtn} onPress={handleBroadcast} disabled={isSubmitting}>
            {isSubmitting ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Send to All</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  keyboardRoot: { flex: 1, backgroundColor: '#02030A' },
  screen: { flex: 1, backgroundColor: '#02030A' },
  content: { flex: 1, padding: 20 },
  formScroll: { flex: 1, backgroundColor: '#02030A' },
  formContent: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#F8FAFC' },
  headerSub: { fontSize: 14, color: '#B9C6DD', fontWeight: '700', marginTop: 4 },
  addBtnSmall: { backgroundColor: '#4A90E2', borderColor: '#334155', borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  addBtnSmallText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  noticeCard: { backgroundColor: '#0F172A', borderColor: '#4A90E2', borderRadius: 8, borderWidth: 1, padding: 20, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  noticeInfo: { flex: 1, paddingRight: 10 },
  noticeTitle: { fontSize: 16, fontWeight: '900', color: '#F8FAFC' },
  noticeMessage: { fontSize: 14, color: '#B9C6DD', marginTop: 5, lineHeight: 20 },
  noticeMeta: { fontSize: 11, color: '#8EA4C8', marginTop: 10, fontWeight: '800' },
  deleteBtn: { padding: 10, backgroundColor: '#450A0A', borderColor: '#7F1D1D', borderRadius: 8, borderWidth: 1 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: '#B9C6DD', fontSize: 16, fontWeight: '800' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtnText: { color: '#B9C6DD', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  formCard: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 20 },
  formTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#B9C6DD', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#020617', color: '#F8FAFC', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#334155', fontSize: 15, outlineStyle: 'none' },
  optionArea: { minHeight: 104 },
  responseModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  responseModeChip: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, minHeight: 38, paddingHorizontal: 11, paddingVertical: 9 },
  responseModeChipActive: { backgroundColor: '#082F49', borderColor: '#4A90E2' },
  responseModeText: { color: '#B9C6DD', fontSize: 12, fontWeight: '900' },
  responseModeTextActive: { color: '#BFDBFE' },
  responsePanel: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginTop: 4, padding: 12 },
  aiArea: { minHeight: 96 },
  aiButton: { alignItems: 'center', backgroundColor: '#1E3A8A', borderColor: '#31558F', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 44, marginTop: 12 },
  aiButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 7 },
  aiIcon: { alignItems: 'center', backgroundColor: '#0B255F', borderColor: '#31558F', borderRadius: 8, borderWidth: 1, height: 38, justifyContent: 'center', marginRight: 10, width: 38 },
  aiPanel: { backgroundColor: '#0B1220', borderColor: '#31558F', borderRadius: 8, borderWidth: 1, marginBottom: 16, padding: 14 },
  aiPanelCopy: { flex: 1, minWidth: 0 },
  aiPanelHeader: { alignItems: 'center', flexDirection: 'row' },
  aiSub: { color: '#93A4BE', fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 2 },
  aiTargetChip: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, minHeight: 34, paddingHorizontal: 10, paddingVertical: 8 },
  aiTargetChipActive: { backgroundColor: '#082F49', borderColor: '#60A5FA' },
  aiTargetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  aiTargetText: { color: '#B9C6DD', fontSize: 11, fontWeight: '900' },
  aiTargetTextActive: { color: '#BFDBFE' },
  aiTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.68 },
  textArea: { height: 120 },
  submitBtn: { backgroundColor: '#4A90E2', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 18, alignItems: 'center', marginTop: 25},
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

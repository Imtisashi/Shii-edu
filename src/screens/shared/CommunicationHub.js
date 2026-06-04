import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { authenticatedFetch } from '../../services/apiClient';

const OFFICE_DAYS = [
  { id: 'mon', label: 'M' },
  { id: 'tue', label: 'T' },
  { id: 'wed', label: 'W' },
  { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' },
  { id: 'sat', label: 'S' },
  { id: 'sun', label: 'S' },
];
const DEFAULT_OFFICE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

const timestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return new Date(value).getTime() || 0;
};

export default function CommunicationHub() {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showOfficeHours, setShowOfficeHours] = useState(false);
  const [officeDays, setOfficeDays] = useState(DEFAULT_OFFICE_DAYS);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [savingHours, setSavingHours] = useState(false);
  const isFaculty = ['admin', 'teacher', 'professor'].includes(userData?.role);

  useEffect(() => {
    if (!currentUser?.uid || !userData?.instituteId) {
      setConversations([]);
      setLoading(false);
      return undefined;
    }
    const conversationQuery = query(
      collection(db, 'conversations'),
      where('instituteId', '==', userData.instituteId),
      where('participants', 'array-contains', currentUser.uid)
    );
    return onSnapshot(conversationQuery, (snapshot) => {
      const next = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((left, right) => timestampMillis(right.lastMessageAt) - timestampMillis(left.lastMessageAt));
      setConversations(next);
      setLoading(false);
      if (!selectedConversationId && next.length > 0) setSelectedConversationId(next[0].id);
    }, (error) => {
      console.error('Conversation list failed:', error);
      setConversations([]);
      setLoading(false);
    });
  }, [currentUser?.uid, selectedConversationId, userData?.instituteId]);

  useEffect(() => {
    if (!selectedConversationId || !userData?.instituteId) {
      setMessages([]);
      return undefined;
    }
    const messageQuery = query(
      collection(db, 'messages'),
      where('instituteId', '==', userData.instituteId),
      where('conversationId', '==', selectedConversationId)
    );
    return onSnapshot(messageQuery, (snapshot) => {
      setMessages(snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((left, right) => timestampMillis(left.createdAt) - timestampMillis(right.createdAt)));
    }, (error) => {
      console.error('Conversation messages failed:', error);
      setMessages([]);
    });
  }, [selectedConversationId, userData?.instituteId]);

  useEffect(() => {
    if (!isFaculty || !currentUser?.uid) return undefined;
    return onSnapshot(doc(db, 'officeHourPolicies', currentUser.uid), (snapshot) => {
      if (!snapshot.exists()) return;
      const policy = snapshot.data();
      setOfficeDays(Array.isArray(policy.days) ? policy.days : DEFAULT_OFFICE_DAYS);
      setStartTime(policy.startTime || '09:00');
      setEndTime(policy.endTime || '17:00');
    });
  }, [currentUser?.uid, isFaculty]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const conversationTitle = (conversation) => {
    const profiles = Array.isArray(conversation?.participantProfiles) ? conversation.participantProfiles : [];
    const other = profiles.find((profile) => profile.uid !== currentUser?.uid);
    return other?.name || other?.loginId || 'Conversation';
  };

  const startConversation = async () => {
    if (!recipientUserId.trim()) {
      showMessage('Recipient Required', 'Enter the recipient User ID.');
      return;
    }
    setStarting(true);
    try {
      const result = await authenticatedFetch('/api/messages', currentUser, {
        method: 'POST',
        body: {
          action: 'startConversation',
          recipientUserId: recipientUserId.trim(),
        },
      });
      setSelectedConversationId(result.conversationId);
      setRecipientUserId('');
    } catch (error) {
      showMessage('Conversation Unavailable', error.message || 'The conversation could not be started.');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversationId || !draft.trim()) return;
    setSending(true);
    try {
      await authenticatedFetch('/api/messages', currentUser, {
        method: 'POST',
        body: {
          action: 'sendMessage',
          conversationId: selectedConversationId,
          message: draft.trim(),
        },
      });
      setDraft('');
    } catch (error) {
      showMessage('Message Not Sent', error.message || 'The message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const saveOfficeHours = async () => {
    setSavingHours(true);
    try {
      await authenticatedFetch('/api/messages', currentUser, {
        method: 'POST',
        body: {
          action: 'setOfficeHours',
          days: officeDays,
          startTime,
          endTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        },
      });
      setShowOfficeHours(false);
      showMessage('Office Hours Saved', 'Learner messages will now be accepted only inside this window.');
    } catch (error) {
      showMessage('Office Hours Not Saved', error.message || 'The office hours could not be saved.');
    } finally {
      setSavingHours(false);
    }
  };

  const toggleDay = (day) => {
    setOfficeDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day]);
  };

  const renderConversation = ({ item }) => {
    const selected = item.id === selectedConversationId;
    return (
      <TouchableOpacity
        onPress={() => setSelectedConversationId(item.id)}
        style={[
          styles.conversationRow,
          {
            backgroundColor: selected ? colors.deepBlueSoft : colors.card,
            borderColor: selected ? colors.accent : colors.hairline,
            borderRadius: radii.control,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.hairline }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>{conversationTitle(item).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.conversationCopy}>
          <Text numberOfLines={1} style={[styles.conversationName, { color: colors.text }]}>{conversationTitle(item)}</Text>
          <Text numberOfLines={1} style={[styles.conversationPreview, { color: colors.textSoft }]}>{item.lastMessage || 'New regulated conversation'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }) => {
    const mine = item.senderUid === currentUser?.uid;
    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: mine ? colors.deepBlue : colors.card,
              borderColor: mine ? colors.accentSoft : colors.hairline,
            },
          ]}
        >
          {!mine ? <Text style={[styles.senderName, { color: colors.accent }]}>{item.senderName || 'User'}</Text> : null}
          <Text style={[styles.messageText, { color: mine ? '#FFFFFF' : colors.text }]}>{item.message}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.page }]}
    >
      <DynamicHeader title="Communication Hub" showBack />

      <View style={[styles.content, { maxWidth: maxContentWidth, paddingHorizontal: spacing.pageX }]}>
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Regulated messaging</Text>
            <Text style={[styles.title, { color: colors.text }]}>Protected teacher-parent communication</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>Broadcasts remain one-way. Direct conversations respect faculty office hours.</Text>
          </View>
          {isFaculty ? (
            <TouchableOpacity
              onPress={() => setShowOfficeHours((current) => !current)}
              style={[styles.officeButton, { backgroundColor: colors.deepBlueSoft, borderColor: colors.hairline }]}
            >
              <Ionicons name="time-outline" size={18} color={colors.accent} />
              <Text style={[styles.officeButtonText, { color: colors.accent }]}>Office Hours</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {showOfficeHours && isFaculty ? (
          <View style={[styles.officeCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Text style={[styles.formLabel, { color: colors.textSoft }]}>Days accepting learner messages</Text>
            <View style={styles.dayRow}>
              {OFFICE_DAYS.map((day) => {
                const selected = officeDays.includes(day.id);
                return (
                  <TouchableOpacity
                    key={day.id}
                    onPress={() => toggleDay(day.id)}
                    style={[styles.dayChip, { backgroundColor: selected ? colors.deepBlue : colors.overlay, borderColor: colors.hairline }]}
                  >
                    <Text style={[styles.dayChipText, { color: selected ? '#FFFFFF' : colors.textSoft }]}>{day.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.timeRow}>
              <TextInput
                onChangeText={setStartTime}
                placeholder="09:00"
                placeholderTextColor={colors.muted}
                style={[styles.timeInput, { backgroundColor: colors.overlay, borderColor: colors.hairline, color: colors.text }]}
                value={startTime}
              />
              <Text style={[styles.timeDivider, { color: colors.textSoft }]}>to</Text>
              <TextInput
                onChangeText={setEndTime}
                placeholder="17:00"
                placeholderTextColor={colors.muted}
                style={[styles.timeInput, { backgroundColor: colors.overlay, borderColor: colors.hairline, color: colors.text }]}
                value={endTime}
              />
            </View>
            <TouchableOpacity
              disabled={savingHours || officeDays.length === 0}
              onPress={saveOfficeHours}
              style={[styles.saveHoursButton, { backgroundColor: colors.deepBlue }, (savingHours || officeDays.length === 0) && styles.disabled]}
            >
              {savingHours ? <SmoothSpinner color="#FFFFFF" size={20} /> : <Text style={styles.saveHoursText}>Save Office Hours</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.startRow, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
          <Ionicons name="id-card-outline" size={19} color={colors.muted} />
          <TextInput
            onChangeText={setRecipientUserId}
            placeholder="Recipient User ID"
            placeholderTextColor={colors.muted}
            style={[styles.recipientInput, { color: colors.text }]}
            value={recipientUserId}
          />
          <TouchableOpacity
            disabled={starting}
            onPress={startConversation}
            style={[styles.startButton, { backgroundColor: colors.deepBlue }, starting && styles.disabled]}
          >
            {starting ? <SmoothSpinner color="#FFFFFF" size={18} /> : <Ionicons name="add" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>

        <View style={styles.workspace}>
          <View style={styles.conversationPane}>
            {loading ? (
              <View style={styles.centerState}><SmoothSpinner color={colors.accent} /></View>
            ) : (
              <FlashList
                data={conversations}
                estimatedItemSize={72}
                keyExtractor={(item) => item.id}
                renderItem={renderConversation}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSoft }]}>No conversations yet.</Text>}
              />
            )}
          </View>

          <View style={[styles.messagePane, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
            {selectedConversation ? (
              <>
                <Text style={[styles.threadTitle, { color: colors.text }]}>{conversationTitle(selectedConversation)}</Text>
                <View style={styles.messagesList}>
                  <FlashList
                    data={messages}
                    estimatedItemSize={64}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSoft }]}>Start the conversation with a clear message.</Text>}
                  />
                </View>
                <View style={[styles.composer, { backgroundColor: colors.overlay, borderColor: colors.hairline }]}>
                  <TextInput
                    multiline
                    onChangeText={setDraft}
                    placeholder="Write a regulated message..."
                    placeholderTextColor={colors.muted}
                    style={[styles.composerInput, { color: colors.text }]}
                    value={draft}
                  />
                  <TouchableOpacity
                    disabled={sending || !draft.trim()}
                    onPress={sendMessage}
                    style={[styles.sendButton, { backgroundColor: colors.deepBlue }, (sending || !draft.trim()) && styles.disabled]}
                  >
                    {sending ? <SmoothSpinner color="#FFFFFF" size={18} /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.centerState}>
                <Ionicons name="chatbubbles-outline" size={38} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.textSoft }]}>Select or start a conversation.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', marginRight: 10, width: 42 },
  avatarText: { fontSize: 16, fontWeight: '900' },
  centerState: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  composer: { alignItems: 'flex-end', borderRadius: 8, borderWidth: 1, flexDirection: 'row', padding: 8 },
  composerInput: { flex: 1, fontSize: 14, maxHeight: 100, minHeight: 38, paddingHorizontal: 8, paddingVertical: 8 },
  content: { alignSelf: 'center', flex: 1, paddingBottom: 18, paddingTop: 14, width: '100%' },
  conversationCopy: { flex: 1, minWidth: 0 },
  conversationName: { fontSize: 14, fontWeight: '900' },
  conversationPane: { flex: 0.38, minHeight: 150 },
  conversationPreview: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  conversationRow: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', marginBottom: 8, minHeight: 64, padding: 10 },
  dayChip: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  dayChipText: { fontSize: 12, fontWeight: '900' },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  disabled: { opacity: 0.5 },
  emptyText: { fontSize: 13, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  formLabel: { fontSize: 12, fontWeight: '900', marginBottom: 9 },
  hero: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', marginBottom: 12, padding: 16 },
  heroCopy: { flex: 1, minWidth: 0 },
  messageBubble: { borderRadius: 8, borderWidth: 1, maxWidth: '86%', paddingHorizontal: 13, paddingVertical: 10 },
  messagePane: { borderWidth: 1, flex: 0.62, marginLeft: 10, minHeight: 260, padding: 12 },
  messageRow: { flexDirection: 'row', marginBottom: 8 },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messagesList: { flex: 1, marginBottom: 10, marginTop: 8 },
  messageText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  officeButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginLeft: 12, minHeight: 42, paddingHorizontal: 11 },
  officeButtonText: { fontSize: 12, fontWeight: '900', marginLeft: 6 },
  officeCard: { borderWidth: 1, marginBottom: 12, padding: 14 },
  recipientInput: { flex: 1, fontSize: 14, minHeight: 46, paddingHorizontal: 9 },
  saveHoursButton: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 46 },
  saveHoursText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  screen: { flex: 1, overflow: 'hidden' },
  sendButton: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  senderName: { fontSize: 10, fontWeight: '900', marginBottom: 3, textTransform: 'uppercase' },
  startButton: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  startRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 11, paddingHorizontal: 7 },
  subtitle: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  threadTitle: { fontSize: 16, fontWeight: '900' },
  timeDivider: { fontSize: 12, fontWeight: '900', marginHorizontal: 8 },
  timeInput: { borderRadius: 8, borderWidth: 1, flex: 1, fontSize: 15, minHeight: 46, paddingHorizontal: 12 },
  timeRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '900', marginTop: 3 },
  workspace: { flex: 1, flexDirection: 'row', minHeight: 0 },
});

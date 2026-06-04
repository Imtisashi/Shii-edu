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
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { aiSyllabusTutor } from '../../services/aiService';
import { authenticatedFetch } from '../../services/apiClient';
import { uploadInstitutionAsset } from '../../services/cloudinaryService';
import { pickSingleDocument } from '../../services/nativePickerService';
import { showNativeError } from '../../utils/userFeedback';

const FALLBACK = 'This is not in your syllabus.';
const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function SyllabusTutor() {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [syllabi, setSyllabi] = useState([]);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canUpload = ['admin', 'teacher', 'professor'].includes(userData?.role);

  useEffect(() => {
    if (!userData?.instituteId) {
      setSyllabi([]);
      return undefined;
    }
    const syllabusQuery = query(collection(db, 'syllabi'), where('instituteId', '==', userData.instituteId));
    return onSnapshot(syllabusQuery, (snapshot) => {
      const next = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((item) => item.status === 'ready')
        .sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')));
      setSyllabi(next);
      if (!selectedSyllabusId && next.length > 0) setSelectedSyllabusId(next[0].id);
    }, (error) => {
      console.error('Syllabus list failed:', error);
      setSyllabi([]);
    });
  }, [selectedSyllabusId, userData?.instituteId]);

  const selectedSyllabus = useMemo(
    () => syllabi.find((item) => item.id === selectedSyllabusId) || null,
    [selectedSyllabusId, syllabi]
  );

  const uploadSyllabus = async () => {
    setUploading(true);
    try {
      const asset = await pickSingleDocument({
        mimeTypes: 'application/pdf',
      });
      if (!asset) return;
      if (asset.mimeType && asset.mimeType !== 'application/pdf') throw new Error('Only PDF syllabus files are accepted.');
      const fileTitle = String(asset.name || 'Syllabus').replace(/\.pdf$/i, '').trim();
      const upload = await uploadInstitutionAsset({
        currentUser,
        asset,
        folder: 'syllabi',
        resourceType: 'raw',
        deliveryType: 'upload',
        context: { purpose: 'syllabus-rag' },
      });
      const response = await authenticatedFetch('/api/ai/syllabus-ingest', currentUser, {
        method: 'POST',
        retryCount: 0,
        timeoutMs: 120000,
        body: {
          title: fileTitle,
          subject: fileTitle,
          courseId: '',
          fileUrl: upload.secureUrl,
          publicId: upload.publicId,
        },
      });
      if (response.background) {
        showMessage('Processing in Background', 'The syllabus is being indexed safely. It will appear here as soon as the verified sections are ready.');
        return;
      }
      setSelectedSyllabusId(response.syllabusId);
      showMessage('Syllabus Ready', `${response.chunkCount} verified syllabus sections are now searchable.`);
    } catch (error) {
      showNativeError('Syllabus Upload Failed', error, 'The syllabus could not be prepared.');
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !selectedSyllabusId) {
      showMessage('Syllabus and Question Required', 'Choose a syllabus and enter a question.');
      return;
    }
    setQuestion('');
    setMessages((current) => [...current, { id: `q-${Date.now()}`, role: 'user', text: trimmedQuestion }]);
    setAsking(true);
    try {
      const response = await aiSyllabusTutor({
        question: trimmedQuestion,
        syllabusId: selectedSyllabusId,
      });
      const answer = response.data || response.parsed || {};
      setMessages((current) => [...current, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: answer.answer || FALLBACK,
        citations: answer.citations || [],
        grounded: answer.grounded === true,
      }]);
    } catch (error) {
      setMessages((current) => [...current, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: error.message || FALLBACK,
        citations: [],
        grounded: false,
      }]);
    } finally {
      setAsking(false);
    }
  };

  const renderMessage = ({ item }) => {
    const mine = item.role === 'user';
    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: mine ? colors.deepBlue : colors.card,
            borderColor: mine ? colors.accentSoft : colors.hairline,
            borderRadius: radii.control,
          },
        ]}>
          <Text style={[styles.messageText, { color: mine ? '#FFFFFF' : colors.text }]}>{item.text}</Text>
          {!mine ? (
            <Text style={[styles.citationText, { color: item.grounded ? colors.emerald : colors.warning }]}>
              {item.grounded ? `${item.citations.length} syllabus citation(s)` : 'Boundary response'}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader showBack title="Syllabus Tutor" />

      <View style={[styles.content, { maxWidth: maxContentWidth, paddingHorizontal: spacing.pageX }]}>
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.violet }]}>Strict syllabus RAG</Text>
            <Text style={[styles.title, { color: colors.text }]}>Ask only what your syllabus can prove</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>Unsupported questions receive the exact boundary response instead of a guess.</Text>
          </View>
          {canUpload ? (
            <TouchableOpacity disabled={uploading} onPress={uploadSyllabus} style={[styles.uploadButton, { backgroundColor: colors.violetSoft, borderColor: colors.hairline }]}>
              {uploading ? <SmoothSpinner color={colors.violet} size={18} /> : <Ionicons color={colors.violet} name="cloud-upload-outline" size={18} />}
              <Text style={[styles.uploadText, { color: colors.violet }]}>{uploading ? 'Uploading Document...' : 'Upload PDF'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.syllabusRow}>
          <FlashList
            data={syllabi}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const selected = item.id === selectedSyllabusId;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedSyllabusId(item.id)}
                  style={[styles.syllabusChip, { backgroundColor: selected ? colors.deepBlueSoft : colors.card, borderColor: selected ? colors.accent : colors.hairline }]}
                >
                  <Text numberOfLines={1} style={[styles.syllabusChipText, { color: selected ? colors.accent : colors.textSoft }]}>{item.title}</Text>
                </TouchableOpacity>
              );
            }}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSoft }]}>No syllabus PDFs are ready yet.</Text>}
          />
        </View>

        <View style={[styles.chatPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.threadTitle, { color: colors.text }]}>{selectedSyllabus?.title || 'Select a syllabus'}</Text>
          <View style={styles.messageList}>
            <FlashList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSoft }]}>Ask a focused question from the selected syllabus.</Text>}
            />
          </View>
          <View style={[styles.composer, { backgroundColor: colors.overlay, borderColor: colors.hairline }]}>
            <TextInput
              multiline
              onChangeText={setQuestion}
              placeholder="Ask from this syllabus..."
              placeholderTextColor={colors.muted}
              style={[styles.composerInput, { color: colors.text }]}
              value={question}
            />
            <TouchableOpacity disabled={asking || !question.trim() || !selectedSyllabusId} onPress={askQuestion} style={[styles.sendButton, { backgroundColor: colors.deepBlue }, (asking || !question.trim() || !selectedSyllabusId) && styles.disabled]}>
              {asking ? <SmoothSpinner color="#FFFFFF" size={18} /> : <Ionicons color="#FFFFFF" name="send" size={18} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatPanel: { borderWidth: 1, flex: 1, minHeight: 300, padding: 12 },
  citationText: { fontSize: 10, fontWeight: '900', marginTop: 7, textTransform: 'uppercase' },
  composer: { alignItems: 'flex-end', borderRadius: 8, borderWidth: 1, flexDirection: 'row', padding: 8 },
  composerInput: { flex: 1, fontSize: 14, maxHeight: 100, minHeight: 38, outlineStyle: 'none', paddingHorizontal: 8, paddingVertical: 8 },
  content: { alignSelf: 'center', flex: 1, paddingBottom: 18, paddingTop: 14, width: '100%' },
  disabled: { opacity: 0.5 },
  emptyText: { fontSize: 13, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  hero: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', marginBottom: 10, padding: 16 },
  heroCopy: { flex: 1, minWidth: 0 },
  messageBubble: { borderWidth: 1, maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10 },
  messageList: { flex: 1, marginBottom: 10, marginTop: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 8 },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  screen: { flex: 1, overflow: 'hidden' },
  sendButton: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  subtitle: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 5 },
  syllabusChip: { borderRadius: 8, borderWidth: 1, marginRight: 8, maxWidth: 180, minHeight: 38, paddingHorizontal: 13, paddingVertical: 10 },
  syllabusChipText: { fontSize: 12, fontWeight: '900' },
  syllabusRow: { height: 48, marginBottom: 10 },
  threadTitle: { fontSize: 15, fontWeight: '900' },
  title: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  uploadButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginLeft: 10, minHeight: 42, paddingHorizontal: 11 },
  uploadText: { fontSize: 12, fontWeight: '900', marginLeft: 6 },
});

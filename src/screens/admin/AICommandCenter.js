import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { authenticatedFetch } from '../../services/apiClient';

const today = () => new Date().toISOString().slice(0, 10);
const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function AICommandCenter() {
  const { currentUser } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [teacherUserId, setTeacherUserId] = useState('');
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('Teacher unavailable');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const scheduleSubstitutes = async () => {
    if (!teacherUserId.trim()) {
      showMessage('Teacher ID Required', 'Enter the absent teacher User ID.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await authenticatedFetch('/api/ai/substitute-schedule', currentUser, {
        method: 'POST',
        retryCount: 0,
        timeoutMs: 60000,
        body: {
          absentTeacherUserId: teacherUserId.trim(),
          date: date.trim(),
          reason: reason.trim() || 'Teacher unavailable',
        },
      });
      setResult(response);
      showMessage('Substitutes Assigned', `${response.assignments.length} conflict-free assignment(s) were created.`);
    } catch (error) {
      showMessage('Scheduling Failed', error.message || 'Substitutes could not be assigned.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader showBack title="AI Command Center" />
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: maxContentWidth, paddingHorizontal: spacing.pageX }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.violetSoft, borderColor: colors.hairline }]}>
            <Ionicons color={colors.violet} name="sparkles" size={28} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.violet }]}>Ghost Admin</Text>
            <Text style={[styles.title, { color: colors.text }]}>Conflict-free substitute scheduling</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>Candidates are selected only from verified, available faculty in this institute.</Text>
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.label, { color: colors.textSoft }]}>Absent teacher User ID</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setTeacherUserId}
            placeholder="e.g. TCH-001"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.overlay, borderColor: colors.hairline, color: colors.text }]}
            value={teacherUserId}
          />
          <Text style={[styles.label, { color: colors.textSoft }]}>Schedule date</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.overlay, borderColor: colors.hairline, color: colors.text }]}
            value={date}
          />
          <Text style={[styles.label, { color: colors.textSoft }]}>Reason</Text>
          <TextInput
            onChangeText={setReason}
            placeholder="Teacher unavailable"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.overlay, borderColor: colors.hairline, color: colors.text }]}
            value={reason}
          />
          <TouchableOpacity disabled={loading} onPress={scheduleSubstitutes} style={[styles.button, { backgroundColor: colors.deepBlue }, loading && styles.disabled]}>
            {loading ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name="sparkles" size={19} />}
            <Text style={styles.buttonText}>{loading ? 'Resolving schedule...' : 'Resolve Schedule'}</Text>
          </TouchableOpacity>
        </View>

        {result ? (
          <View style={[styles.resultCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>{result.summary}</Text>
            {(result.assignments || []).map((assignment) => (
              <View key={assignment.routineId} style={[styles.assignmentRow, { borderTopColor: colors.hairline }]}>
                <View style={[styles.assignmentIcon, { backgroundColor: colors.emeraldSoft }]}>
                  <Ionicons color={colors.emerald} name="checkmark" size={18} />
                </View>
                <View style={styles.assignmentCopy}>
                  <Text style={[styles.assignmentTitle, { color: colors.text }]}>{assignment.subject || 'Class'} - {assignment.time || 'Scheduled time'}</Text>
                  <Text style={[styles.assignmentMeta, { color: colors.textSoft }]}>{assignment.substituteTeacherName}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  assignmentCopy: { flex: 1, minWidth: 0 },
  assignmentIcon: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', marginRight: 10, width: 36 },
  assignmentMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  assignmentRow: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', paddingVertical: 11 },
  assignmentTitle: { fontSize: 13, fontWeight: '900' },
  button: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', minHeight: 52 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginLeft: 8 },
  content: { alignSelf: 'center', paddingBottom: 60, paddingTop: 16, width: '100%' },
  disabled: { opacity: 0.6 },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  formCard: { borderWidth: 1, marginTop: 12, padding: 16 },
  hero: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', padding: 16 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 58, justifyContent: 'center', marginRight: 13, width: 58 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 15, marginBottom: 14, minHeight: 48, outlineStyle: 'none', paddingHorizontal: 13 },
  label: { fontSize: 12, fontWeight: '900', marginBottom: 7 },
  resultCard: { borderWidth: 1, marginTop: 12, padding: 16 },
  resultTitle: { fontSize: 15, fontWeight: '900', marginBottom: 8 },
  screen: { flex: 1, overflow: 'hidden' },
  subtitle: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 5 },
  title: { fontSize: 18, fontWeight: '900', marginTop: 3 },
});

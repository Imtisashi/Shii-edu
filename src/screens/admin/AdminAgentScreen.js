import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { SkeletonBlock } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { authenticatedFetch } from '../../services/apiClient';
import { showNativeMessage } from '../../utils/userFeedback';

const EXAMPLES = [
  'Fetch students with attendance less than 75%',
  'Show pending fee dues',
  'Export attendance below 60%',
];

const formatHeader = (value) => String(value || '')
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (letter) => letter.toUpperCase())
  .trim();

const decodeBase64 = (base64) => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  throw new Error('Direct file download is available from the web app.');
};

const downloadFile = async (file) => {
  if (!file?.contentBase64) return;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const bytes = decodeBase64(file.contentBase64);
    const blob = new Blob([bytes], { type: file.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.fileName || 'shii-edu-agent-export';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  await Clipboard.setStringAsync(file.contentBase64);
  showNativeMessage('Export Copied', 'The export data was copied. Open Shii-Edu on web for direct file download.');
};

function AgentSkeleton() {
  return (
    <View style={styles.skeletonStack}>
      <SkeletonBlock height={18} radius={6} width="52%" />
      <SkeletonBlock height={86} radius={10} width="100%" />
      <SkeletonBlock height={48} radius={8} width="100%" />
      <SkeletonBlock height={48} radius={8} width="100%" />
    </View>
  );
}

function FileButton({ file, icon, label }) {
  const { colors } = useRootLayout();
  if (!file) return null;
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={() => downloadFile(file)}
      style={[styles.fileButton, { backgroundColor: colors.text }]}
    >
      <Ionicons name={icon} size={18} color={colors.page} />
      <Text style={[styles.fileButtonText, { color: colors.page }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultTable({ rows }) {
  const { colors, radii } = useRootLayout();
  const visibleRows = Array.isArray(rows) ? rows.slice(0, 36) : [];
  const headers = useMemo(() => {
    const first = visibleRows[0] || {};
    return Object.keys(first).slice(0, 6);
  }, [visibleRows]);

  if (visibleRows.length === 0) {
    return (
      <View style={[styles.emptyPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.control }]}>
        <Ionicons name="checkmark-done-outline" size={30} color={colors.emerald} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No table rows returned</Text>
        <Text style={[styles.emptyText, { color: colors.textSoft }]}>The report may have found no matching records.</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={[styles.table, { borderColor: colors.hairline, borderRadius: radii.control }]}>
        <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.card }]}>
          {headers.map((header) => (
            <Text key={header} style={[styles.headerCell, { color: colors.text }]}>{formatHeader(header)}</Text>
          ))}
        </View>
        {visibleRows.map((row, rowIndex) => (
          <View key={`${row.studentId || row.studentName || 'row'}-${rowIndex}`} style={[styles.tableRow, { borderTopColor: colors.hairline }]}>
            {headers.map((header) => (
              <Text key={header} numberOfLines={2} style={[styles.bodyCell, { color: colors.textSoft }]}>{String(row[header] ?? '')}</Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function AdminAgentScreen() {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const runAgent = async () => {
    const cleanedPrompt = prompt.trim();
    if (cleanedPrompt.length < 3) {
      Alert.alert('Add a request', 'Type what report you need before running the agent.');
      return;
    }

    setRunning(true);
    try {
      const response = await authenticatedFetch('/api/admin/agent', currentUser, {
        method: 'POST',
        retryCount: 0,
        timeoutMs: 60000,
        body: {
          exportFormat: 'both',
          instituteId: userData?.instituteId,
          prompt: cleanedPrompt,
        },
      });
      setResult(response.agent || null);
      showNativeMessage('Agent Finished', response.agent?.summary || 'The report is ready.');
    } catch (error) {
      Alert.alert('Agent Not Available', error.message || 'The admin agent could not finish this request.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader showBack title="Max AI Agent" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingBottom: spacing.xxl,
            paddingHorizontal: spacing.pageX,
            paddingTop: spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>Max subscription</Text>
          <Text style={[styles.title, { color: colors.text }]}>Admin Agent</Text>
          <Text style={[styles.subtitle, { color: colors.textSoft }]}>
            Ask for approved reports. The agent uses bounded database reads, institute feature gates, rate limits, and audit logs.
          </Text>
        </View>

        <View style={[styles.promptPanel, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>What do you need?</Text>
          <TextInput
            multiline
            onChangeText={setPrompt}
            placeholder="Example: Fetch students with attendance less than 75%"
            placeholderTextColor={colors.muted}
            style={[styles.promptInput, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, color: colors.text }]}
            value={prompt}
          />
          <View style={styles.exampleRow}>
            {EXAMPLES.map((example) => (
              <TouchableOpacity
                key={example}
                onPress={() => setPrompt(example)}
                style={[styles.exampleButton, { borderColor: colors.hairline }]}
              >
                <Text style={[styles.exampleText, { color: colors.textSoft }]}>{example}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            activeOpacity={0.84}
            disabled={running}
            onPress={runAgent}
            style={[styles.runButton, { backgroundColor: running ? colors.muted : colors.text }]}
          >
            <Ionicons name="sparkles-outline" size={19} color={colors.page} />
            <Text style={[styles.runText, { color: colors.page }]}>{running ? 'Running report...' : 'Run agent'}</Text>
          </TouchableOpacity>
        </View>

        {running ? <AgentSkeleton /> : null}

        {result && !running ? (
          <View style={[styles.resultPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Text style={[styles.resultKicker, { color: colors.accent }]}>{result.tool || 'agent'}</Text>
            <Text style={[styles.resultTitle, { color: colors.text }]}>{result.summary}</Text>
            <Text style={[styles.resultMeta, { color: colors.textSoft }]}>
              Cost mode: {result.costMode}. Showing up to 36 rows here; exports include up to {result.exportLimit || 350}.
            </Text>
            <View style={styles.fileRow}>
              <FileButton file={result.files?.excel} icon="grid-outline" label="Download CSV" />
              <FileButton file={result.files?.pdf} icon="document-text-outline" label="Download PDF" />
            </View>
            <ResultTable rows={result.rows || []} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bodyCell: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingVertical: 9,
    width: 150,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
  },
  emptyPanel: {
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 13,
    padding: 22,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 9,
  },
  exampleButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 11,
  },
  exampleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  fileButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 13,
  },
  fileButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
  fileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: 150,
  },
  hero: {
    borderWidth: 1,
    padding: 17,
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  promptInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    minHeight: 112,
    outlineStyle: 'none',
    padding: 13,
    textAlignVertical: 'top',
  },
  promptPanel: {
    borderWidth: 1,
    marginTop: 13,
    padding: 14,
  },
  resultKicker: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  resultMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 7,
  },
  resultPanel: {
    borderWidth: 1,
    marginTop: 14,
    padding: 15,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
    marginTop: 4,
  },
  runButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 13,
    minHeight: 48,
  },
  runText: {
    fontSize: 14,
    fontWeight: '900',
  },
  screen: {
    flex: 1,
  },
  skeletonStack: {
    gap: 10,
    marginTop: 14,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 7,
  },
  table: {
    borderWidth: 1,
    marginTop: 14,
    overflow: 'hidden',
  },
  tableHeader: {
    borderTopWidth: 0,
  },
  tableRow: {
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  tableScroll: {
    marginTop: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
    marginTop: 4,
  },
});

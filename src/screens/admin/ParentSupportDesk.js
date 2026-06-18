import React, { useEffect, useMemo, useState } from 'react';
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
import { collection, doc, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import DynamicHeader from '../../components/DynamicHeader';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { showNativeMessage } from '../../utils/userFeedback';

const MAX_VISIBLE_PARENTS = 90;
const MAX_DIRECTORY_LOAD = 700;

const normalize = (value) => String(value || '').trim();
const normalizeLower = (value) => normalize(value).toLowerCase();

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const getUserIdentifier = (user) => (
  user?.loginId ||
  user?.uniqueId ||
  user?.studentId ||
  user?.id ||
  'No ID'
);

const getContact = (user) => (
  user?.phone ||
  user?.phoneNumber ||
  user?.parentPhone ||
  user?.guardianPhone ||
  user?.email ||
  'Not shared'
);

const readinessLabel = (parent) => {
  const stored = normalizeLower(parent?.parentSupport?.readiness || parent?.supportReadiness);
  if (stored === 'ready') return 'App ready';
  if (stored === 'assisted') return 'Office assisted';
  if (stored === 'paper') return 'Paper fallback';
  if (parent?.lastLoginAt || parent?.lastActiveAt) return 'App ready';
  return 'Needs help';
};

const resolveLinkedStudent = (parent, studentsById) => {
  const childUids = Array.isArray(parent.childUids) ? parent.childUids : [];
  const directKeys = [
    parent.linkedStudentUid,
    parent.studentUid,
    ...childUids,
  ].filter(Boolean);

  for (const key of directKeys) {
    if (studentsById.uid.get(key)) return studentsById.uid.get(key);
  }

  const studentId = normalizeLower(parent.linkedStudentUserId || parent.studentId);
  if (!studentId) return null;
  return studentsById.identifier.get(studentId) || null;
};

const downloadCsv = async ({ content, fileName }) => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  await Clipboard.setStringAsync(content);
  showNativeMessage('CSV Copied', 'The support export was copied. Paste it into a sheet on this device.');
};

const showPlainAlert = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

function StatCard({ color, icon, label, value }) {
  const { colors, radii } = useRootLayout();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.control }]}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSoft }]}>{label}</Text>
    </View>
  );
}

function ParentRow({ item, onCopy, onStatus }) {
  const { colors, radii } = useRootLayout();
  const needsAttention = !item.student || item.readiness === 'Needs help';
  return (
    <View style={[styles.parentRow, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.control }]}>
      <View style={[styles.parentAvatar, { backgroundColor: needsAttention ? colors.warningSoft : colors.deepBlueSoft, borderColor: colors.hairline }]}>
        <Ionicons name={needsAttention ? 'alert-circle-outline' : 'people-outline'} size={22} color={needsAttention ? colors.warning : colors.accent} />
      </View>
      <View style={styles.parentCopy}>
        <Text numberOfLines={1} style={[styles.parentName, { color: colors.text }]}>{item.parent.name || 'Unnamed parent'}</Text>
        <Text numberOfLines={1} style={[styles.parentMeta, { color: colors.textSoft }]}>
          Parent ID {getUserIdentifier(item.parent)} - {getContact(item.parent)}
        </Text>
        <Text numberOfLines={1} style={[styles.parentMeta, { color: item.student ? colors.emerald : colors.warning }]}>
          {item.student ? `Linked to ${item.student.name || getUserIdentifier(item.student)}` : 'Linked student not found'}
        </Text>
      </View>
      <View style={styles.parentActions}>
        <Text style={[styles.readinessText, { color: needsAttention ? colors.warning : colors.emerald }]}>{item.readiness}</Text>
        <View style={styles.rowButtonGroup}>
          <TouchableOpacity onPress={() => onCopy(item)} style={[styles.rowButton, { borderColor: colors.hairline }]}>
            <Ionicons name="copy-outline" size={17} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onStatus(item)} style={[styles.rowButton, { borderColor: colors.hairline }]}>
            <Ionicons name="checkmark-circle-outline" size={17} color={colors.emerald} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ParentSupportDesk() {
  const { userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!userData?.instituteId) {
      setUsers([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const usersQuery = query(
      collection(db, 'users'),
      where('instituteId', '==', userData.instituteId),
      limit(MAX_DIRECTORY_LOAD)
    );

    return onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Parent support directory query failed:', error);
      setUsers([]);
      setLoading(false);
      showPlainAlert('Directory Not Loaded', 'The parent support desk could not load the institute directory. Try again in a moment.');
    });
  }, [userData?.instituteId]);

  const supportRows = useMemo(() => {
    const students = users.filter((user) => normalizeLower(user.role) === 'student');
    const parents = users.filter((user) => normalizeLower(user.role) === 'parent');
    const studentsById = {
      identifier: new Map(),
      uid: new Map(),
    };

    students.forEach((student) => {
      studentsById.uid.set(student.id, student);
      [student.loginId, student.uniqueId, student.studentId, student.id]
        .filter(Boolean)
        .forEach((identifier) => studentsById.identifier.set(normalizeLower(identifier), student));
    });

    return parents.map((parent) => {
      const student = resolveLinkedStudent(parent, studentsById);
      return {
        parent,
        readiness: readinessLabel(parent),
        student,
      };
    });
  }, [users]);

  const filteredRows = useMemo(() => {
    const needle = normalizeLower(searchQuery);
    return supportRows.filter((row) => {
      if (filter === 'unlinked' && row.student) return false;
      if (filter === 'needs-help' && row.readiness !== 'Needs help') return false;
      if (!needle) return true;
      return [
        row.parent.name,
        getUserIdentifier(row.parent),
        getContact(row.parent),
        row.parent.linkedStudentUserId,
        row.student?.name,
        getUserIdentifier(row.student || {}),
      ].some((value) => normalizeLower(value).includes(needle));
    });
  }, [filter, searchQuery, supportRows]);

  const stats = useMemo(() => {
    const linked = supportRows.filter((row) => row.student).length;
    const needsHelp = supportRows.filter((row) => row.readiness === 'Needs help' || !row.student).length;
    return {
      linked,
      needsHelp,
      parents: supportRows.length,
    };
  }, [supportRows]);

  const copySupportMessage = async (row) => {
    const message = [
      `Hello ${row.parent.name || 'Parent'},`,
      `Your Shii-Edu Parent ID is ${getUserIdentifier(row.parent)}.`,
      `Institute ID: ${userData?.instituteId || 'Not available'}.`,
      row.student ? `Linked student: ${row.student.name || getUserIdentifier(row.student)}.` : 'Please visit the school office so we can link your child correctly.',
      'Do not share your password with anyone.',
    ].join('\n');
    await Clipboard.setStringAsync(message);
    showNativeMessage('Support Message Copied', 'A safe parent help message is ready to paste.');
  };

  const markOfficeAssisted = async (row) => {
    try {
      await updateDoc(doc(db, 'users', row.parent.id), {
        parentSupport: {
          readiness: 'assisted',
          updatedAt: serverTimestamp(),
          updatedBy: userData?.uid || userData?.id || null,
        },
      });
      showNativeMessage('Marked Assisted', `${row.parent.name || 'Parent'} is marked as office assisted.`);
    } catch (error) {
      console.error('Parent support status update failed:', error);
      showPlainAlert('Status Not Updated', 'The parent status could not be saved. Check your connection and try again.');
    }
  };

  const exportCsv = async () => {
    const rows = [
      ['parentName', 'parentId', 'contact', 'readiness', 'linkedStudentName', 'linkedStudentId', 'linkStatus'],
      ...supportRows.map((row) => [
        row.parent.name || '',
        getUserIdentifier(row.parent),
        getContact(row.parent),
        row.readiness,
        row.student?.name || '',
        row.student ? getUserIdentifier(row.student) : '',
        row.student ? 'linked' : 'student_not_found',
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    await downloadCsv({
      content: csv,
      fileName: `shii-edu-parent-support-${userData?.instituteId || 'institute'}.csv`,
    });
  };

  if (loading) {
    return <RosterSkeleton rowCount={7} showFilters />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader showBack title="Parent Support" />
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
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>School rollout</Text>
            <Text style={[styles.title, { color: colors.text }]}>Parent Support Desk</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>
              Check parent links, find families who need office help, and export a safe support list without exposing passwords.
            </Text>
          </View>
          <TouchableOpacity onPress={exportCsv} style={[styles.exportButton, { backgroundColor: colors.text }]}>
            <Ionicons name="download-outline" size={18} color={colors.page} />
            <Text style={[styles.exportText, { color: colors.page }]}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <StatCard color="#2563EB" icon="people-outline" label="Parents loaded" value={stats.parents} />
          <StatCard color="#047857" icon="link-outline" label="Linked parents" value={stats.linked} />
          <StatCard color="#B45309" icon="help-buoy-outline" label="Needs office help" value={stats.needsHelp} />
        </View>

        <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.control }]}>
            <Ionicons name="search-outline" size={19} color={colors.muted} />
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="Search parent, student, phone, or ID"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
            />
          </View>
          <View style={styles.filterButtons}>
            {[
              ['all', 'All'],
              ['needs-help', 'Needs help'],
              ['unlinked', 'Student not found'],
            ].map(([key, label]) => {
              const selected = filter === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setFilter(key)}
                  style={[styles.filterButton, { borderColor: colors.hairline }, selected && { backgroundColor: colors.text }]}
                >
                  <Text style={[styles.filterText, { color: selected ? colors.page : colors.textSoft }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[styles.resultLabel, { color: colors.textSoft }]}>
          Showing {Math.min(filteredRows.length, MAX_VISIBLE_PARENTS)} of {filteredRows.length} matching parents
        </Text>

        {filteredRows.slice(0, MAX_VISIBLE_PARENTS).map((row) => (
          <ParentRow
            item={row}
            key={row.parent.id}
            onCopy={copySupportMessage}
            onStatus={markOfficeAssisted}
          />
        ))}

        {filteredRows.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Ionicons name="checkmark-done-outline" size={34} color={colors.emerald} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No parent matches this view</Text>
            <Text style={[styles.emptyText, { color: colors.textSoft }]}>Try another filter or search term.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
    padding: 22,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  exportButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 13,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '900',
  },
  filterButton: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 11,
  },
  filterPanel: {
    borderWidth: 1,
    marginBottom: 10,
    marginTop: 13,
    padding: 12,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '900',
  },
  hero: {
    alignItems: 'flex-start',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 16,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  parentActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  parentAvatar: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  parentCopy: {
    flex: 1,
    minWidth: 0,
  },
  parentMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  parentName: {
    fontSize: 15,
    fontWeight: '900',
  },
  parentRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 9,
    minHeight: 86,
    padding: 12,
  },
  readinessText: {
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 3,
  },
  rowButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rowButtonGroup: {
    flexDirection: 'row',
    gap: 7,
  },
  screen: {
    flex: 1,
  },
  searchBox: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    outlineStyle: 'none',
  },
  statCard: {
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    padding: 13,
  },
  statGrid: {
    gap: 10,
  },
  statIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 7,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
    marginTop: 4,
  },
});

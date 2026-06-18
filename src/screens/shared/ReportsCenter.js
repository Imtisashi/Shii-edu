import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import {
  buildClassRosterHtml,
  buildStudentReportCardHtml,
  shareHtmlAsPdf,
} from '../../services/reportService';

const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

const studentId = (student) => String(student?.loginId || student?.uniqueId || student?.id || '');
const normalize = (value) => String(value || '').trim().toLowerCase();

export default function ReportsCenter() {
  const { userData } = useAuth();
  const { institutionType } = useInstitution();
  const { brand, colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('report-card');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scope, setScope] = useState('');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const isSchool = institutionType !== 'COLLEGE';

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const studentQuery = query(
      collection(db, 'users'),
      where('instituteId', '==', userData.instituteId),
      where('role', '==', 'student')
    );
    return onSnapshot(studentQuery, (snapshot) => {
      const nextStudents = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
      setStudents(nextStudents);
      setLoading(false);
    }, (error) => {
      console.error('Reports student roster failed:', error);
      setStudents([]);
      setLoading(false);
    });
  }, [userData?.instituteId]);

  const visibleStudents = useMemo(() => {
    const searchKey = normalize(search);
    if (!searchKey) return students;
    return students.filter((student) => (
      normalize(student.name).includes(searchKey) ||
      normalize(studentId(student)).includes(searchKey)
    ));
  }, [search, students]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students]
  );

  const rosterStudents = useMemo(() => {
    const scopeKey = normalize(scope);
    if (!scopeKey || scopeKey === 'all') return students;
    return students.filter((student) => (
      isSchool
        ? normalize(student.class) === scopeKey || normalize(student.section) === scopeKey
        : normalize(student.dept) === scopeKey || normalize(student.sem) === scopeKey
    ));
  }, [isSchool, scope, students]);

  const reportBrand = useMemo(() => ({
    accentColor: brand.accentColor,
    logoUrl: brand.logoUrl,
    name: brand.name,
    primaryColor: brand.primaryColor,
  }), [brand]);

  const generateReportCard = async () => {
    if (!selectedStudent) {
      showMessage('Select a Student', 'Choose a student before generating a report card.');
      return;
    }

    setGenerating(true);
    try {
      const [gradeSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'grades'), where('instituteId', '==', userData.instituteId))),
        getDocs(query(collection(db, 'attendance'), where('instituteId', '==', userData.instituteId))),
      ]);
      const identifiers = new Set([
        selectedStudent.id,
        selectedStudent.uid,
        selectedStudent.loginId,
        selectedStudent.uniqueId,
      ].filter(Boolean).map(String));
      const belongsToStudent = (record) => [
        record.studentId,
        record.studentUid,
        record.studentUniqueId,
      ].filter(Boolean).some((value) => identifiers.has(String(value)));
      const grades = gradeSnapshot.docs.map((document) => document.data()).filter(belongsToStudent);
      const attendance = attendanceSnapshot.docs.map((document) => document.data()).filter(belongsToStudent);
      const html = buildStudentReportCardHtml({
        attendance,
        brand: reportBrand,
        grades,
        institutionType: isSchool ? 'SCHOOL' : 'COLLEGE',
        student: selectedStudent,
      });
      await shareHtmlAsPdf({
        fileName: `${studentId(selectedStudent) || 'student'}-report-card.pdf`,
        html,
      });
      showMessage('Report Ready', 'The white-labeled report card is ready to print or share.');
    } catch (error) {
      console.error('Report card generation failed:', error);
      showMessage('Report Failed', error.message || 'The report card could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const generateRoster = async () => {
    if (rosterStudents.length === 0) {
      showMessage('No Matching Students', 'No students match this roster scope.');
      return;
    }

    setGenerating(true);
    try {
      const scopeLabel = !scope.trim() || normalize(scope) === 'all'
        ? 'Entire institute'
        : `${isSchool ? 'Class / section' : 'Department / semester'}: ${scope.trim()}`;
      const html = buildClassRosterHtml({
        brand: reportBrand,
        institutionType: isSchool ? 'SCHOOL' : 'COLLEGE',
        scopeLabel,
        students: rosterStudents,
      });
      await shareHtmlAsPdf({
        fileName: `${brand.name.replace(/\s+/g, '-').toLowerCase()}-roster.pdf`,
        html,
      });
      showMessage('Roster Ready', 'The white-labeled roster is ready to print or share.');
    } catch (error) {
      console.error('Roster generation failed:', error);
      showMessage('Roster Failed', error.message || 'The roster could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const renderStudent = ({ item }) => {
    const selected = item.id === selectedStudentId;
    const placement = isSchool
      ? `Class ${item.class || 'Unassigned'} - ${item.section || 'Unassigned'}`
      : `${item.dept || 'Department unassigned'} - Sem ${item.sem || 'Unassigned'}`;

    return (
      <Pressable
        accessibilityLabel={`Select ${item.name || 'student'} for report`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => setSelectedStudentId(item.id)}
        style={[
          styles.studentRow,
          {
            backgroundColor: selected ? colors.deepBlueSoft : colors.card,
            borderColor: selected ? colors.accent : colors.hairline,
            borderRadius: radii.control,
          },
        ]}
      >
        <View style={[styles.studentInitial, { backgroundColor: colors.accentSoft, borderColor: colors.hairline }]}>
          <Text style={[styles.studentInitialText, { color: colors.accent }]}>
            {String(item.name || 'S').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.studentCopy}>
          <Text numberOfLines={1} style={[styles.studentName, { color: colors.text }]}>{item.name || 'Student'}</Text>
          <Text numberOfLines={1} style={[styles.studentMeta, { color: colors.textSoft }]}>
            {studentId(item) || 'ID pending'} - {placement}
          </Text>
        </View>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? colors.accent : colors.muted}
        />
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.page }]}
    >
      <DynamicHeader title="Reports Center" showBack />

      <View
        style={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingHorizontal: spacing.pageX,
          },
        ]}
      >
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
            <Ionicons name="print-outline" size={25} color={colors.accent} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Enterprise reporting</Text>
            <Text style={[styles.title, { color: colors.text }]}>Print polished academic documents</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>
              Every report carries the {brand.name} logo, palette, and verified institute data.
            </Text>
          </View>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
          <TouchableOpacity
            onPress={() => setReportType('report-card')}
            style={[styles.tab, reportType === 'report-card' && { backgroundColor: colors.deepBlueSoft }]}
          >
            <Text style={[styles.tabText, { color: reportType === 'report-card' ? colors.accent : colors.textSoft }]}>Report Card</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setReportType('roster')}
            style={[styles.tab, reportType === 'roster' && { backgroundColor: colors.deepBlueSoft }]}
          >
            <Text style={[styles.tabText, { color: reportType === 'roster' ? colors.accent : colors.textSoft }]}>Class Roster</Text>
          </TouchableOpacity>
        </View>

        {reportType === 'report-card' ? (
          <>
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
              <Ionicons name="search" size={19} color={colors.muted} />
              <TextInput
                onChangeText={setSearch}
                placeholder="Search student name or User ID"
                placeholderTextColor={colors.muted}
                style={[styles.searchInput, { color: colors.text }]}
                value={search}
              />
            </View>
            <View style={styles.listShell}>
              {loading ? (
                <RosterSkeleton rowCount={5} showFilters={false} style={styles.reportSkeleton} />
              ) : (
                <FlashList
                  data={visibleStudents}
                  estimatedItemSize={76}
                  keyExtractor={(item) => item.id}
                  renderItem={renderStudent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.textSoft }]}>No students match this search.</Text>
                  }
                />
              )}
            </View>
            <TouchableOpacity
              disabled={generating || !selectedStudent}
              onPress={generateReportCard}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.deepBlue, borderColor: colors.accentSoft },
                (generating || !selectedStudent) && styles.disabled,
              ]}
            >
              {generating ? <SmoothSpinner color="#FFFFFF" size={22} /> : <Ionicons name="document-text-outline" size={19} color="#FFFFFF" />}
              <Text style={styles.primaryButtonText}>{generating ? 'Generating...' : 'Generate Report Card'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.rosterCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Text style={[styles.formLabel, { color: colors.textSoft }]}>
              {isSchool ? 'Class or section filter' : 'Department or semester filter'}
            </Text>
            <TextInput
              onChangeText={setScope}
              placeholder={isSchool ? 'All, 10, or A' : 'All, CSE, or 3'}
              placeholderTextColor={colors.muted}
              style={[styles.scopeInput, { backgroundColor: colors.overlay, borderColor: colors.hairline, color: colors.text }]}
              value={scope}
            />
            <View style={[styles.rosterSummary, { backgroundColor: colors.deepBlueSoft, borderColor: colors.hairline }]}>
              <Ionicons name="people-outline" size={21} color={colors.accent} />
              <Text style={[styles.rosterSummaryText, { color: colors.textSoft }]}>
                {rosterStudents.length} student{rosterStudents.length === 1 ? '' : 's'} will appear in this roster.
              </Text>
            </View>
            <TouchableOpacity
              disabled={generating || rosterStudents.length === 0}
              onPress={generateRoster}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.deepBlue, borderColor: colors.accentSoft },
                (generating || rosterStudents.length === 0) && styles.disabled,
              ]}
            >
              {generating ? <SmoothSpinner color="#FFFFFF" size={22} /> : <Ionicons name="print-outline" size={19} color="#FFFFFF" />}
              <Text style={styles.primaryButtonText}>{generating ? 'Generating...' : 'Generate Class Roster'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    paddingBottom: 20,
    paddingTop: 16,
    width: '100%',
  },
  disabled: {
    opacity: 0.48,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 40,
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  hero: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    padding: 17,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    marginRight: 13,
    width: 56,
  },
  listShell: {
    flex: 1,
    minHeight: 180,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
  rosterCard: {
    borderWidth: 1,
    padding: 18,
  },
  reportSkeleton: {
    minHeight: 320,
  },
  rosterSummary: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 14,
  },
  rosterSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 9,
  },
  scopeInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 13,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  screen: {
    flex: 1,
  },
  searchBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 9,
  },
  studentCopy: {
    flex: 1,
    minWidth: 0,
  },
  studentInitial: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: 11,
    width: 44,
  },
  studentInitialText: {
    fontSize: 17,
    fontWeight: '900',
  },
  studentMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '900',
  },
  studentRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 9,
    minHeight: 68,
    padding: 11,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  tabs: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 13,
    padding: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
  },
});

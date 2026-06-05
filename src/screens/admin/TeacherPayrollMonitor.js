import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
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
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';

const PAYROLL_STATUSES = [
  { color: '#B45309', id: 'pending', label: 'Pending' },
  { color: '#0369A1', id: 'processing', label: 'Processing' },
  { color: '#047857', id: 'paid', label: 'Paid' },
  { color: '#BE123C', id: 'hold', label: 'On hold' },
];

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const normalizePayrollStatus = (status) => {
  const normalized = String(status || 'pending').toLowerCase();
  return PAYROLL_STATUSES.some((entry) => entry.id === normalized) ? normalized : 'pending';
};
const getPayrollStatus = (teacher) => normalizePayrollStatus(teacher?.payrollStatus || teacher?.payroll?.status);
const getSalary = (teacher) => Number(teacher?.payrollMonthlySalary || teacher?.payroll?.monthlySalary || 0);
const getTeacherId = (teacher) => teacher?.loginId || teacher?.uniqueId || teacher?.teacherCode || teacher?.id || 'ID pending';

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString()}`;

export default function TeacherPayrollMonitor() {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [payrollStatus, setPayrollStatus] = useState('pending');
  const [payrollNote, setPayrollNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userData?.instituteId) {
      setTeachers([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const usersQuery = query(
      collection(db, 'users'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const faculty = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => ['teacher', 'professor'].includes(normalizeRole(entry.role)))
          .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
        setTeachers(faculty);
        setLoading(false);
      },
      (error) => {
        console.error('Payroll teacher query failed:', error);
        setTeachers([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userData?.instituteId]);

  const summary = useMemo(() => {
    const totalPayroll = teachers.reduce((total, teacher) => total + getSalary(teacher), 0);
    const paid = teachers.filter((teacher) => getPayrollStatus(teacher) === 'paid').length;
    const onHold = teachers.filter((teacher) => getPayrollStatus(teacher) === 'hold').length;

    return {
      onHold,
      paid,
      pending: Math.max(teachers.length - paid - onHold, 0),
      totalPayroll,
    };
  }, [teachers]);

  const selectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setSalaryAmount(getSalary(teacher) ? String(getSalary(teacher)) : '');
    setPayrollStatus(getPayrollStatus(teacher));
    setPayrollNote(String(teacher?.payrollNotes || teacher?.payroll?.note || ''));
  };

  const handleSavePayroll = async () => {
    Keyboard.dismiss();
    if (!selectedTeacher) {
      showNativeMessage('Select Teacher', 'Choose a teacher before updating payroll.');
      return;
    }

    const monthlySalary = Number(salaryAmount || 0);
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      showNativeMessage('Invalid Salary', 'Enter a valid monthly salary amount.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', selectedTeacher.id), {
        payroll: {
          currency: 'INR',
          lastReviewedAt: serverTimestamp(),
          monthlySalary,
          note: payrollNote.trim(),
          reviewedBy: currentUser?.uid || userData?.uid || null,
          status: payrollStatus,
        },
        payrollMonthlySalary: monthlySalary,
        payrollNotes: payrollNote.trim(),
        payrollStatus,
        payrollUpdatedAt: serverTimestamp(),
        payrollUpdatedBy: currentUser?.uid || userData?.uid || null,
      });
      showNativeMessage('Payroll Updated', `${selectedTeacher.name || 'Teacher'} payroll has been updated.`);
      setSelectedTeacher(null);
      setSalaryAmount('');
      setPayrollNote('');
      setPayrollStatus('pending');
    } catch (error) {
      showNativeError('Payroll Update Failed', error, 'The payroll record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.page }]}
    >
      <DynamicHeader showBack title="Teacher Payroll" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingHorizontal: spacing.pageX,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>Payroll monitor</Text>
              <Text style={[styles.title, { color: colors.text }]}>{teachers.length} faculty accounts</Text>
              <Text style={[styles.subtitle, { color: colors.textSoft }]}>Track monthly salary status without leaving the admin workspace.</Text>
            </View>
            <View style={[styles.summaryIcon, { backgroundColor: colors.violetSoft, borderColor: colors.hairline }]}>
              <Ionicons color={colors.violet} name="cash-outline" size={24} />
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Monthly liability</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(summary.totalPayroll)}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Paid</Text>
              <Text style={[styles.metricValue, { color: colors.emerald }]}>{summary.paid}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Pending</Text>
              <Text style={[styles.metricValue, { color: colors.warning }]}>{summary.pending}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Update payroll status</Text>
          <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Teacher</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teacherStrip}>
            {teachers.map((teacher) => {
              const selected = selectedTeacher?.id === teacher.id;
              return (
                <TouchableOpacity
                  key={teacher.id}
                  onPress={() => selectTeacher(teacher)}
                  style={[
                    styles.teacherChip,
                    {
                      backgroundColor: selected ? colors.deepBlueSoft : colors.card,
                      borderColor: selected ? colors.accentSoft : colors.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.teacherChipText, { color: selected ? colors.accent : colors.textSoft }]}>
                    {teacher.name || getTeacherId(teacher)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Monthly salary</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={setSalaryAmount}
                placeholder="e.g. 42000"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={salaryAmount}
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Internal note</Text>
              <TextInput
                onChangeText={setPayrollNote}
                placeholder="Optional payroll note"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={payrollNote}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Status</Text>
          <View style={styles.statusRow}>
            {PAYROLL_STATUSES.map((status) => {
              const selected = payrollStatus === status.id;
              return (
                <TouchableOpacity
                  key={status.id}
                  onPress={() => setPayrollStatus(status.id)}
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: selected ? status.color : colors.card,
                      borderColor: selected ? status.color : colors.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.statusButtonText, { color: selected ? '#FFFFFF' : colors.textSoft }]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            disabled={saving}
            onPress={handleSavePayroll}
            style={[styles.saveButton, { backgroundColor: colors.deepBlue }, saving && styles.disabled]}
          >
            {saving ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name="save-outline" size={19} />}
            <Text style={styles.saveButtonText}>Save Payroll Control</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <RosterSkeleton rowCount={5} showFilters={false} />
        ) : (
          <View style={styles.list}>
            {teachers.length === 0 ? (
              <View style={[styles.emptyPanel, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No faculty found</Text>
                <Text style={[styles.emptyText, { color: colors.textSoft }]}>Create teacher accounts before monitoring payroll.</Text>
              </View>
            ) : teachers.map((teacher) => {
              const status = PAYROLL_STATUSES.find((entry) => entry.id === getPayrollStatus(teacher)) || PAYROLL_STATUSES[0];
              return (
                <TouchableOpacity
                  key={teacher.id}
                  onPress={() => selectTeacher(teacher)}
                  style={[styles.rowCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                      {String(teacher.name || 'T').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{teacher.name || 'Unnamed teacher'}</Text>
                    <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.textSoft }]}>
                      {getTeacherId(teacher)} • {formatCurrency(getSalary(teacher))}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', marginRight: 12, width: 44 },
  avatarText: { fontSize: 17, fontWeight: '900' },
  content: { alignSelf: 'center', paddingBottom: 90, paddingTop: 16, width: '100%' },
  disabled: { opacity: 0.68 },
  emptyPanel: { alignItems: 'center', borderRadius: 8, borderWidth: 1, padding: 22 },
  emptyText: { fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  fieldColumn: { flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' },
  fieldRow: { flexDirection: 'row', gap: 10 },
  formCard: { borderWidth: 1, marginBottom: 14, padding: 16 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 15, marginBottom: 14, minHeight: 48, outlineStyle: 'none', paddingHorizontal: 13 },
  list: { gap: 9 },
  metricCell: { borderRadius: 8, borderWidth: 1, flex: 1, minWidth: 120, padding: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metricLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { fontSize: 17, fontWeight: '900', marginTop: 4 },
  rowCard: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', minHeight: 72, padding: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  saveButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', minHeight: 52, marginTop: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginLeft: 8 },
  screen: { flex: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 14 },
  statusButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexGrow: 1, paddingHorizontal: 10, paddingVertical: 10 },
  statusButtonText: { fontSize: 12, fontWeight: '900' },
  statusDot: { borderRadius: 4, height: 7, marginRight: 6, width: 7 },
  statusPill: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginLeft: 10, paddingHorizontal: 9, paddingVertical: 6 },
  statusPillText: { fontSize: 10, fontWeight: '900' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  subtitle: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 48, justifyContent: 'center', marginLeft: 12, width: 48 },
  summaryPanel: { borderWidth: 1, marginBottom: 14, padding: 16 },
  teacherChip: { borderRadius: 8, borderWidth: 1, marginRight: 8, paddingHorizontal: 12, paddingVertical: 9 },
  teacherChipText: { fontSize: 12, fontWeight: '900' },
  teacherStrip: { marginBottom: 14 },
  title: { fontSize: 21, fontWeight: '900', marginTop: 3 },
});

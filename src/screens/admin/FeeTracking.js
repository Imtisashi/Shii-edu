import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert, KeyboardAvoidingView, Keyboard } from 'react-native';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { authenticatedFetch } from '../../services/apiClient';
import { createIdempotencyKey } from '../../utils/idempotencyKey';
import { showNativeMessage } from '../../utils/userFeedback';
import DynamicHeader from '../../components/DynamicHeader';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function FeeManagement() {
  const { currentUser, userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'allocate'
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalIncome: 0, totalPending: 0 });

  // Allocation Form State
  const [feeTitle, setFeeTitle] = useState('');
  const [feeType, setFeeType] = useState(''); // e.g., Monthly, Exam, Lab
  const [feeAmount, setFeeAmount] = useState('');
  const [feeDescription, setFeeDescription] = useState('');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [targetScope, setTargetScope] = useState('all');
  const [targetGroup, setTargetGroup] = useState('');
  const [targetGroupSecondary, setTargetGroupSecondary] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);
  const allocationIdempotencyKeyRef = React.useRef(null);

  // Payment Modal State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [offlineTargetScope, setOfflineTargetScope] = useState('all');
  const [offlineTargetGroup, setOfflineTargetGroup] = useState('');
  const [offlineTargetGroupSecondary, setOfflineTargetGroupSecondary] = useState('');
  const [offlineNote, setOfflineNote] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const instType = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = instType.includes('school');
  const targetScopes = isSchool
    ? [
      { id: 'all', label: 'Entire Institute' },
      { id: 'class', label: 'Class' },
      { id: 'section', label: 'Section' },
      { id: 'classSection', label: 'Class + Section' },
    ]
    : [
      { id: 'all', label: 'Entire Institute' },
      { id: 'department', label: 'Department' },
      { id: 'semester', label: 'Semester' },
      { id: 'departmentSemester', label: 'Department + Semester' },
    ];

  const isCompoundScope = (scope) => scope === 'classSection' || scope === 'departmentSemester';
  const buildTargetValue = (scope, primary, secondary) => {
    if (scope === 'all') return '';
    const first = primary.trim();
    const second = secondary.trim();
    return isCompoundScope(scope) ? `${first}|${second}` : first;
  };
  const formatTargetHint = (scope) => {
    if (scope === 'class') return 'Enter the class label used on student profiles.';
    if (scope === 'section') return 'Enter the section label used on student profiles.';
    if (scope === 'classSection') return 'Enter both class and section for a precise cohort.';
    if (scope === 'department') return 'Enter the department label used on student profiles.';
    if (scope === 'semester') return 'Enter the semester label used on student profiles.';
    if (scope === 'departmentSemester') return 'Enter both department and semester for a precise cohort.';
    return '';
  };
  const getOutstandingAmount = (student) => Math.max(0, Number(student?.totalFee || 0) - Number(student?.feePaid || 0));

  // --- 1. FETCH STUDENTS & CALCULATE REVENUE ---
  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, "users"),
      where("instituteId", "==", userData.instituteId),
      where("role", "==", "student")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let income = 0;
      let pending = 0;

      const studentList = snapshot.docs.map(document => {
        const data = document.data();
        const feePaid = data.feePaid || 0;
        const totalFee = data.totalFee || 0; 
        
        income += feePaid;
        pending += Math.max(0, totalFee - feePaid);

        return { id: document.id, ...data, feePaid, totalFee };
      });

      setStudents(studentList);
      setStats({ totalIncome: income, totalPending: pending });
      setLoading(false);
    }, (error) => {
      console.error('Fee ledger query failed:', error);
      setStudents([]);
      setStats({ totalIncome: 0, totalPending: 0 });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // --- 2. RECORD MANUAL PAYMENT ---
  const handleRecordPayment = async () => {
    Keyboard.dismiss();
    const amount = parseInt(paymentAmount);

    if (!amount || amount <= 0) return showAlert("Invalid Amount", "Please enter a valid amount.");

    setIsProcessing(true);
    try {
      const result = await authenticatedFetch('/api/admin/fees/record-payment', currentUser, {
        method: 'POST',
        retryCount: 0,
        body: {
          studentUid: selectedStudent.id,
          amount,
          currency: 'INR',
        },
      });
      showAlert("Payment Recorded", `Allocated Rs. ${Number(result.amount).toLocaleString()} across ${result.allocatedInvoices} invoice(s).`);
      setSelectedStudent(null);
      setPaymentAmount('');
    } catch (error) {
      showAlert("Payment Not Recorded", error.message || "Could not record this offline payment. Check the amount and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordFullOutstanding = async () => {
    Keyboard.dismiss();
    if (!selectedStudent) return;

    setIsProcessing(true);
    try {
      const result = await authenticatedFetch('/api/admin/fees/record-payment', currentUser, {
        method: 'POST',
        retryCount: 0,
        body: {
          currency: 'INR',
          markFullOutstanding: true,
          note: 'Marked paid offline by admin.',
          studentUid: selectedStudent.id,
        },
      });
      showAlert("Payment Recorded", `Cleared Rs. ${Number(result.amount).toLocaleString()} across ${result.allocatedInvoices} invoice(s).`);
      setSelectedStudent(null);
      setPaymentAmount('');
    } catch (error) {
      showAlert("Payment Not Recorded", error.message || "Could not clear this student's offline balance.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. BULK ALLOCATE FEES ---
  const handleAllocateFees = async () => {
    Keyboard.dismiss();
    const targetValue = buildTargetValue(targetScope, targetGroup, targetGroupSecondary);
    if (!feeTitle || !feeType || !feeAmount || (targetScope !== 'all' && !targetGroup.trim()) || (isCompoundScope(targetScope) && !targetGroupSecondary.trim())) {
      return showAlert("Incomplete", "Please fill in all fee details.");
    }

    setIsAllocating(true);
    if (!allocationIdempotencyKeyRef.current) {
      allocationIdempotencyKeyRef.current = createIdempotencyKey('fee-assignment');
    }
    try {
      const result = await authenticatedFetch('/api/admin/fees/assign', currentUser, {
        method: 'POST',
        timeoutMs: 60000,
        retryCount: 0,
        body: {
          instituteId: userData.instituteId,
          title: feeTitle.trim(),
          feeType: feeType.trim(),
          amount: Number(feeAmount),
          currency: 'INR',
          description: feeDescription.trim(),
          dueDate: feeDueDate.trim(),
          idempotencyKey: allocationIdempotencyKeyRef.current,
          targetScope,
          targetValue,
        },
      });

      if (result.background) {
        showNativeMessage('Processing in Background', 'Fee invoices are being generated safely. Students and parents will be notified when the job completes.');
        setFeeTitle(''); setFeeType(''); setFeeAmount(''); setFeeDescription(''); setFeeDueDate(''); setTargetGroup(''); setTargetGroupSecondary(''); setTargetScope('all');
        setActiveTab('ledger');
        return;
      }

      showAlert("Success", `Allocated Rs. ${Number(result.amount).toLocaleString()} to ${result.assignedStudents} students.`);
      setFeeTitle(''); setFeeType(''); setFeeAmount(''); setFeeDescription(''); setFeeDueDate(''); setTargetGroup(''); setTargetGroupSecondary(''); setTargetScope('all');
      setActiveTab('ledger');

    } catch (error) {
      showAlert("Fee Not Allocated", error.message || "The fee could not be assigned. Check the selected group and try again.");
      console.error(error);
    } finally {
      allocationIdempotencyKeyRef.current = null;
      setIsAllocating(false);
    }
  };

  const handleBulkOfflinePayment = async () => {
    Keyboard.dismiss();
    const targetValue = buildTargetValue(offlineTargetScope, offlineTargetGroup, offlineTargetGroupSecondary);
    if ((offlineTargetScope !== 'all' && !offlineTargetGroup.trim()) || (isCompoundScope(offlineTargetScope) && !offlineTargetGroupSecondary.trim())) {
      showAlert("Choose a Group", "Select a group and fill in the required class, section, department, or semester.");
      return;
    }

    setIsBulkProcessing(true);
    try {
      const result = await authenticatedFetch('/api/admin/fees/record-payment', currentUser, {
        method: 'POST',
        timeoutMs: 60000,
        retryCount: 0,
        body: {
          currency: 'INR',
          markFullOutstanding: true,
          note: offlineNote.trim() || 'Bulk offline fee reconciliation by admin.',
          targetScope: offlineTargetScope,
          targetValue,
        },
      });
      showAlert(
        "Offline Payments Recorded",
        `Cleared Rs. ${Number(result.amount).toLocaleString()} for ${result.studentsUpdated} student${result.studentsUpdated === 1 ? '' : 's'} across ${result.allocatedInvoices} invoice(s).`
      );
      setOfflineTargetScope('all');
      setOfflineTargetGroup('');
      setOfflineTargetGroupSecondary('');
      setOfflineNote('');
      setActiveTab('ledger');
    } catch (error) {
      showAlert("Offline Payments Not Recorded", error.message || "Could not clear this group. Check the selected students and try again.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // --- RENDER ---
  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Financial Ledger" />

      <View style={styles.heroSection}>
        <Text style={styles.headerTitle}>Financial Ledger</Text>
        <Text style={styles.headerSub}>Manage & allocate campus fees</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Collected</Text>
            <Text style={styles.statNumberIncome}>Rs. {stats.totalIncome.toLocaleString()}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statNumberPending}>Rs. {stats.totalPending.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'ledger' && styles.activeTab]} onPress={() => setActiveTab('ledger')}>
            <Text style={[styles.tabText, activeTab === 'ledger' && styles.activeTabText]}>Student Ledger</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'allocate' && styles.activeTab]} onPress={() => setActiveTab('allocate')}>
            <Text style={[styles.tabText, activeTab === 'allocate' && styles.activeTabText]}>Allocate Fees</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'offline' && styles.activeTab]} onPress={() => setActiveTab('offline')}>
            <Text style={[styles.tabText, activeTab === 'offline' && styles.activeTabText]}>Offline Payments</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TAB: LEDGER */}
      {activeTab === 'ledger' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? <RosterSkeleton rowCount={6} showFilters={false} style={styles.embeddedSkeleton} /> : students.length === 0 ? <Text style={styles.emptyText}>No students enrolled.</Text> : (
            students.map(student => {
              const isFullyPaid = student.totalFee > 0 && student.feePaid >= student.totalFee;
              const hasNoFees = student.totalFee === 0;
              const progressPercent = hasNoFees ? 0 : Math.min(((student.feePaid || 0) / student.totalFee) * 100, 100);

              return (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentHeader}>
                    <View>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentDetails}>{isSchool ? `Class ${student.class} - Sec ${student.section}` : `${student.dept} - Sem ${student.sem}`}</Text>
                    </View>
                    {hasNoFees ? (
                      <View style={styles.neutralBadge}><Text style={styles.neutralText}>NO DUES</Text></View>
                    ) : isFullyPaid ? (
                      <View style={styles.paidBadge}><Text style={styles.paidText}>CLEARED</Text></View>
                    ) : (
                      <View style={styles.dueBadge}><Text style={styles.dueText}>DUE</Text></View>
                    )}
                  </View>

                  <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: isFullyPaid ? '#10B981' : '#8B5CF6' }]} />
                  </View>
                  
                  <View style={styles.feeDetailsRow}>
                    <Text style={styles.feeText}>Paid: <Text style={styles.boldText}>Rs. {(student.feePaid || 0).toLocaleString()}</Text></Text>
                    <Text style={styles.feeText}>Total: Rs. {(student.totalFee || 0).toLocaleString()}</Text>
                  </View>

                  {!isFullyPaid && !hasNoFees && (
                    <TouchableOpacity style={styles.payBtn} onPress={() => setSelectedStudent(student)}>
                      <Ionicons name="add-circle-outline" size={20} color="#8B5CF6" />
                      <Text style={styles.payBtnText}>Record Payment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* TAB: ALLOCATE */}
      {activeTab === 'allocate' && (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="layers" size={24} color="#8B5CF6" />
              <Text style={styles.formTitle}>New Fee Structure</Text>
            </View>

            <Text style={styles.label}>Fee Title</Text>
            <TextInput style={styles.input} placeholder="e.g. April Tuition Fee" placeholderTextColor={colors.muted} value={feeTitle} onChangeText={setFeeTitle} />

            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 10}}>
                <Text style={styles.label}>Fee Type</Text>
                <TextInput style={styles.input} placeholder="Monthly, Exam, etc." placeholderTextColor={colors.muted} value={feeType} onChangeText={setFeeType} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Amount (Rs.)</Text>
                <TextInput style={styles.input} placeholder="e.g. 5000" placeholderTextColor={colors.muted} keyboardType="numeric" value={feeAmount} onChangeText={setFeeAmount} />
              </View>
            </View>

            <Text style={styles.label}>Due Date (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-07-15"
              placeholderTextColor={colors.muted}
              value={feeDueDate}
              onChangeText={setFeeDueDate}
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a short note students and parents can understand."
              placeholderTextColor={colors.muted}
              value={feeDescription}
              onChangeText={setFeeDescription}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Target Group</Text>
            <View style={styles.scopeRow}>
              {targetScopes.map((scopeOption) => (
                <TouchableOpacity
                  key={scopeOption.id}
                  onPress={() => {
                    setTargetScope(scopeOption.id);
                    setTargetGroup('');
                    setTargetGroupSecondary('');
                  }}
                  style={[styles.scopeChip, targetScope === scopeOption.id && styles.scopeChipActive]}
                >
                  <Text style={[styles.scopeChipText, targetScope === scopeOption.id && styles.scopeChipTextActive]}>{scopeOption.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {targetScope !== 'all' && (
              <>
                <Text style={styles.hint}>
                  {formatTargetHint(targetScope)}
                </Text>
                <View style={[styles.row, isCompoundScope(targetScope) ? null : styles.singleInputRow]}>
                  <View style={[styles.fieldPane, isCompoundScope(targetScope) && styles.fieldPaneSpacing]}>
                    <TextInput
                      style={styles.input}
                      placeholder={isSchool ? (targetScope === 'section' ? 'e.g. A' : 'e.g. 10') : (targetScope === 'semester' ? 'e.g. 3' : 'e.g. CSE')}
                      placeholderTextColor={colors.muted}
                      value={targetGroup}
                      onChangeText={setTargetGroup}
                    />
                  </View>
                  {isCompoundScope(targetScope) && (
                    <View style={styles.fieldPane}>
                      <TextInput
                        style={styles.input}
                        placeholder={isSchool ? 'Section, e.g. A' : 'Semester, e.g. 3'}
                        placeholderTextColor={colors.muted}
                        value={targetGroupSecondary}
                        onChangeText={setTargetGroupSecondary}
                      />
                    </View>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.allocateBtn} onPress={handleAllocateFees} disabled={isAllocating}>
              {isAllocating ? <SmoothSpinner color="#fff" /> : <Text style={styles.allocateText}>Bulk Allocate Fees</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* TAB: OFFLINE PAYMENT RECONCILIATION */}
      {activeTab === 'offline' && (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="receipt" size={24} color="#10B981" />
              <View>
                <Text style={styles.formTitle}>Offline Payment Reconciliation</Text>
                <Text style={styles.formSubtitle}>Clear unpaid invoices after cash, bank transfer, or counter payment is verified.</Text>
              </View>
            </View>

            <Text style={styles.label}>Student Group</Text>
            <View style={styles.scopeRow}>
              {targetScopes.map((scopeOption) => (
                <TouchableOpacity
                  key={scopeOption.id}
                  onPress={() => {
                    setOfflineTargetScope(scopeOption.id);
                    setOfflineTargetGroup('');
                    setOfflineTargetGroupSecondary('');
                  }}
                  style={[styles.scopeChip, offlineTargetScope === scopeOption.id && styles.scopeChipSuccess]}
                >
                  <Text style={[styles.scopeChipText, offlineTargetScope === scopeOption.id && styles.scopeChipSuccessText]}>{scopeOption.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {offlineTargetScope !== 'all' && (
              <>
                <Text style={styles.hint}>{formatTargetHint(offlineTargetScope)}</Text>
                <View style={[styles.row, isCompoundScope(offlineTargetScope) ? null : styles.singleInputRow]}>
                  <View style={[styles.fieldPane, isCompoundScope(offlineTargetScope) && styles.fieldPaneSpacing]}>
                    <TextInput
                      style={styles.input}
                      placeholder={isSchool ? (offlineTargetScope === 'section' ? 'e.g. A' : 'e.g. 10') : (offlineTargetScope === 'semester' ? 'e.g. 3' : 'e.g. CSE')}
                      placeholderTextColor={colors.muted}
                      value={offlineTargetGroup}
                      onChangeText={setOfflineTargetGroup}
                    />
                  </View>
                  {isCompoundScope(offlineTargetScope) && (
                    <View style={styles.fieldPane}>
                      <TextInput
                        style={styles.input}
                        placeholder={isSchool ? 'Section, e.g. A' : 'Semester, e.g. 3'}
                        placeholderTextColor={colors.muted}
                        value={offlineTargetGroupSecondary}
                        onChangeText={setOfflineTargetGroupSecondary}
                      />
                    </View>
                  )}
                </View>
              </>
            )}

            <Text style={styles.label}>Internal Note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Bank deposit verified by accounts office."
              placeholderTextColor={colors.muted}
              value={offlineNote}
              onChangeText={setOfflineNote}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.reconcileBox}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#A7F3D0" />
              <Text style={styles.reconcileText}>
                This action marks only existing unpaid invoice balances as paid. It does not create a new fee.
              </Text>
            </View>

            <TouchableOpacity style={styles.reconcileBtn} onPress={handleBulkOfflinePayment} disabled={isBulkProcessing}>
              {isBulkProcessing ? <SmoothSpinner color="#fff" /> : <Text style={styles.allocateText}>Mark Outstanding Paid Offline</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* PAYMENT MODAL OVERLAY */}
      {selectedStudent && (
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}><Ionicons name="close-circle" size={28} color={colors.muted} /></TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Receiving from <Text style={styles.modalStudentName}>{selectedStudent.name}</Text></Text>
            <View style={styles.modalBalanceRow}>
              <Text style={styles.modalBalanceLabel}>Outstanding balance</Text>
              <Text style={styles.modalBalanceValue}>Rs. {getOutstandingAmount(selectedStudent).toLocaleString()}</Text>
            </View>
            
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>Rs.</Text>
              <TextInput style={styles.modalInput} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numeric" value={paymentAmount} onChangeText={setPaymentAmount} autoFocus />
            </View>

            <TouchableOpacity style={styles.fullOutstandingBtn} onPress={handleRecordFullOutstanding} disabled={isProcessing}>
              <Ionicons name="checkmark-done-outline" size={18} color="#A7F3D0" />
              <Text style={styles.fullOutstandingText}>Clear Full Outstanding Offline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRecordPayment} disabled={isProcessing}>
              {isProcessing ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Confirm Payment</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}

    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  heroSection: { backgroundColor: '#0F172A', borderBottomColor: '#334155', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderBottomWidth: 1, paddingTop: 20, paddingBottom: 20, paddingHorizontal: 25, zIndex: 10 },
  headerTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '900' },
  headerSub: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', backgroundColor: '#020617', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginTop: 20, padding: 20, justifyContent: 'space-between' },
  statBox: { flex: 1 },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  statNumberIncome: { color: '#10B981', fontSize: 22, fontWeight: '900', marginTop: 5 },
  statNumberPending: { color: '#F43F5E', fontSize: 22, fontWeight: '900', marginTop: 5 },
  statDivider: { width: 1, backgroundColor: '#334155', marginHorizontal: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#020617', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginTop: 20, padding: 5 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#8B5CF6' },
  tabText: { color: '#94A3B8', fontWeight: 'bold' },
  activeTabText: { color: '#fff' },

  scrollContent: { padding: 20, paddingBottom: 100 },
  embeddedSkeleton: { minHeight: 520 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontStyle: 'italic' },
  
  studentCard: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 20, marginBottom: 15 },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentName: { fontSize: 16, fontWeight: '900', color: '#F8FAFC' },
  studentDetails: { fontSize: 12, color: '#B9C6DD', marginTop: 2 },
  paidBadge: { backgroundColor: '#052E2B', borderColor: '#047857', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  paidText: { color: '#059669', fontSize: 10, fontWeight: '900' },
  dueBadge: { backgroundColor: '#450A0A', borderColor: '#7F1D1D', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  dueText: { color: '#E11D48', fontSize: 10, fontWeight: '900' },
  neutralBadge: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  neutralText: { color: '#B9C6DD', fontSize: 10, fontWeight: '900' },
  progressContainer: { height: 6, backgroundColor: '#334155', borderRadius: 3, marginTop: 15, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  feeDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  feeText: { fontSize: 13, color: '#B9C6DD' },
  boldText: { fontWeight: 'bold', color: '#F8FAFC' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E1B4B', borderColor: '#6D28D9', borderRadius: 8, borderWidth: 1, paddingVertical: 12, marginTop: 15 },
  payBtnText: { color: '#8B5CF6', fontWeight: 'bold', marginLeft: 8 },

  formCard: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 20 },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 15 },
  formTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', marginLeft: 10 },
  formSubtitle: { color: '#B9C6DD', fontSize: 12, fontWeight: '700', lineHeight: 18, marginLeft: 10, marginTop: 3 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#B9C6DD', marginBottom: 8 },
  hint: { fontSize: 11, color: '#8EA4C8', marginBottom: 8, fontWeight: '800' },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, color: '#F8FAFC', padding: 15, fontSize: 16, marginBottom: 20, outlineStyle: 'none' },
  textArea: { minHeight: 92, paddingTop: 14 },
  row: { flexDirection: 'row' },
  singleInputRow: { maxWidth: 420 },
  fieldPane: { flex: 1, minWidth: 0 },
  fieldPaneSpacing: { marginRight: 10 },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  scopeChip: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, marginBottom: 8, marginRight: 8, paddingHorizontal: 12, paddingVertical: 8 },
  scopeChipActive: { backgroundColor: '#1E1B4B', borderColor: '#6D28D9' },
  scopeChipText: { color: '#B9C6DD', fontSize: 12, fontWeight: '900' },
  scopeChipTextActive: { color: '#DDD6FE' },
  scopeChipSuccess: { backgroundColor: '#064E3B', borderColor: '#047857' },
  scopeChipSuccessText: { color: '#A7F3D0' },
  allocateBtn: { backgroundColor: '#8B5CF6', paddingVertical: 18, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  allocateText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  reconcileBox: { alignItems: 'flex-start', backgroundColor: '#064E3B', borderColor: '#047857', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 16, padding: 13 },
  reconcileText: { color: '#D1FAE5', flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18, marginLeft: 9 },
  reconcileBtn: { backgroundColor: '#047857', paddingVertical: 18, borderRadius: 8, alignItems: 'center', marginTop: 4 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: 20 },
  modalCard: { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1, width: '100%', maxWidth: 400, borderRadius: 8, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC' },
  modalSub: { fontSize: 14, color: '#B9C6DD', marginTop: 10, marginBottom: 20 },
  modalStudentName: { fontWeight: 'bold', color: '#F8FAFC' },
  modalBalanceRow: { alignItems: 'center', backgroundColor: '#020617', borderColor: '#334155', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 12, paddingVertical: 10 },
  modalBalanceLabel: { color: '#8EA4C8', fontSize: 12, fontWeight: '900' },
  modalBalanceValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '900' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 15 },
  currencySymbol: { fontSize: 24, fontWeight: 'bold', color: '#94A3B8', marginRight: 10 },
  modalInput: { flex: 1, fontSize: 28, fontWeight: 'bold', color: '#F8FAFC', paddingVertical: 15, outlineStyle: 'none' },
  fullOutstandingBtn: { alignItems: 'center', backgroundColor: '#064E3B', borderColor: '#047857', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', marginTop: 14, minHeight: 46 },
  fullOutstandingText: { color: '#A7F3D0', fontSize: 13, fontWeight: '900', marginLeft: 7 },
  submitBtn: { backgroundColor: '#8B5CF6', paddingVertical: 18, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

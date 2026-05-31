import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, 
  ActivityIndicator, Platform, Alert, KeyboardAvoidingView, Keyboard
} from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function FeeManagement() {
  const { userData } = useAuth();
  
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'allocate'
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalIncome: 0, totalPending: 0 });

  // Allocation Form State
  const [feeTitle, setFeeTitle] = useState('');
  const [feeType, setFeeType] = useState(''); // e.g., Monthly, Exam, Lab
  const [feeAmount, setFeeAmount] = useState('');
  const [targetGroup, setTargetGroup] = useState('All'); // 'All', '11', 'Computer Science', etc.
  const [isAllocating, setIsAllocating] = useState(false);

  // Payment Modal State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const instType = userData?.instituteData?.type || 'school';

  // --- 1. FETCH STUDENTS & CALCULATE REVENUE ---
  useEffect(() => {
    if (!userData?.instituteId) return;

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
      await updateDoc(doc(db, "users", selectedStudent.id), {
        feePaid: increment(amount)
      });
      setSelectedStudent(null);
      setPaymentAmount('');
    } catch (_error) {
      showAlert("Error", "Could not process payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. BULK ALLOCATE FEES ---
  const handleAllocateFees = async () => {
    Keyboard.dismiss();
    if (!feeTitle || !feeType || !feeAmount) {
      return showAlert("Incomplete", "Please fill in all fee details.");
    }

    setIsAllocating(true);
    try {
      // Find target students
      let targetStudents = students;
      if (targetGroup.toLowerCase() !== 'all') {
        const target = targetGroup.toLowerCase();
        targetStudents = students.filter(s => {
          if (instType === 'school') return (s.class && s.class.toLowerCase() === target) || (s.section && s.section.toLowerCase() === target);
          else return (s.dept && s.dept.toLowerCase() === target) || (s.sem && s.sem.toLowerCase() === target);
        });
      }

      if (targetStudents.length === 0) {
        setIsAllocating(false);
        return showAlert("No Match", "No students found matching that target group.");
      }

      // Batch Update
      const batch = writeBatch(db);
      const amountNum = parseInt(feeAmount);
      
      const feeItem = {
        title: feeTitle.trim(),
        type: feeType.trim(),
        amount: amountNum,
        dateAdded: new Date().toISOString()
      };

      targetStudents.forEach(student => {
        const studentRef = doc(db, "users", student.id);
        const currentBreakdown = student.feeBreakdown || [];
        batch.update(studentRef, {
          totalFee: increment(amountNum),
          feeBreakdown: [...currentBreakdown, feeItem]
        });
      });

      await batch.commit();

      showAlert("Success", `Allocated Rs. ${amountNum} to ${targetStudents.length} students.`);
      setFeeTitle(''); setFeeType(''); setFeeAmount(''); setTargetGroup('All');
      setActiveTab('ledger');

    } catch (error) {
      showAlert("Error", "Failed to allocate fees.");
      console.error(error);
    } finally {
      setIsAllocating(false);
    }
  };

  // --- RENDER ---
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F1F5F9' }]}>
      
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
        </View>
      </View>

      {/* TAB: LEDGER */}
      {activeTab === 'ledger' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} /> : students.length === 0 ? <Text style={styles.emptyText}>No students enrolled.</Text> : (
            students.map(student => {
              const isFullyPaid = student.totalFee > 0 && student.feePaid >= student.totalFee;
              const hasNoFees = student.totalFee === 0;
              const progressPercent = hasNoFees ? 0 : Math.min(((student.feePaid || 0) / student.totalFee) * 100, 100);

              return (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentHeader}>
                    <View>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentDetails}>{instType === 'school' ? `Class ${student.class} - Sec ${student.section}` : `${student.dept} - Sem ${student.sem}`}</Text>
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
            <TextInput style={styles.input} placeholder="e.g. April Tuition Fee" value={feeTitle} onChangeText={setFeeTitle} />

            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 10}}>
                <Text style={styles.label}>Fee Type</Text>
                <TextInput style={styles.input} placeholder="Monthly, Exam, etc." value={feeType} onChangeText={setFeeType} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Amount (Rs.)</Text>
                <TextInput style={styles.input} placeholder="e.g. 5000" keyboardType="numeric" value={feeAmount} onChangeText={setFeeAmount} />
              </View>
            </View>

            <Text style={styles.label}>Target Group</Text>
            <Text style={styles.hint}>Type ALL for everyone, or a specific Class/Dept (e.g. 11 or Computer Science)</Text>
            <TextInput style={styles.input} placeholder="All" value={targetGroup} onChangeText={setTargetGroup} />

            <TouchableOpacity style={styles.allocateBtn} onPress={handleAllocateFees} disabled={isAllocating}>
              {isAllocating ? <ActivityIndicator color="#fff" /> : <Text style={styles.allocateText}>Bulk Allocate Fees</Text>}
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
              <TouchableOpacity onPress={() => setSelectedStudent(null)}><Ionicons name="close-circle" size={28} color="#CBD5E0" /></TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Receiving from <Text style={{fontWeight: 'bold', color: '#1E293B'}}>{selectedStudent.name}</Text></Text>
            
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>Rs.</Text>
              <TextInput style={styles.modalInput} placeholder="0" keyboardType="numeric" value={paymentAmount} onChangeText={setPaymentAmount} autoFocus />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRecordPayment} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Confirm Payment</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  heroSection: { backgroundColor: '#0F172A', paddingTop: 40, paddingBottom: 20, paddingHorizontal: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 5, zIndex: 10 },
  headerTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '900' },
  headerSub: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', backgroundColor: '#1E293B', marginTop: 20, borderRadius: 16, padding: 20, justifyContent: 'space-between' },
  statBox: { flex: 1 },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  statNumberIncome: { color: '#10B981', fontSize: 22, fontWeight: '900', marginTop: 5 },
  statNumberPending: { color: '#F43F5E', fontSize: 22, fontWeight: '900', marginTop: 5 },
  statDivider: { width: 1, backgroundColor: '#334155', marginHorizontal: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#1E293B', marginTop: 20, borderRadius: 12, padding: 5 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#8B5CF6' },
  tabText: { color: '#94A3B8', fontWeight: 'bold' },
  activeTabText: { color: '#fff' },

  scrollContent: { padding: 20, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontStyle: 'italic' },
  
  studentCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2 },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  studentDetails: { fontSize: 12, color: '#64748B', marginTop: 2 },
  paidBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  paidText: { color: '#059669', fontSize: 10, fontWeight: '900' },
  dueBadge: { backgroundColor: '#FFE4E6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dueText: { color: '#E11D48', fontSize: 10, fontWeight: '900' },
  neutralBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  neutralText: { color: '#64748B', fontSize: 10, fontWeight: '900' },
  progressContainer: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, marginTop: 15, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  feeDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  feeText: { fontSize: 13, color: '#64748B' },
  boldText: { fontWeight: 'bold', color: '#1E293B' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF', paddingVertical: 12, borderRadius: 10, marginTop: 15 },
  payBtnText: { color: '#8B5CF6', fontWeight: 'bold', marginLeft: 8 },

  formCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3 },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 15 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginLeft: 10 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
  hint: { fontSize: 11, color: '#94A3B8', marginBottom: 8, fontStyle: 'italic' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  row: { flexDirection: 'row' },
  allocateBtn: { backgroundColor: '#8B5CF6', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  allocateText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: 20 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 400, borderRadius: 24, padding: 25, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  modalSub: { fontSize: 14, color: '#64748B', marginTop: 10, marginBottom: 20 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 15 },
  currencySymbol: { fontSize: 24, fontWeight: 'bold', color: '#94A3B8', marginRight: 10 },
  modalInput: { flex: 1, fontSize: 28, fontWeight: 'bold', color: '#1E293B', paddingVertical: 15, outlineStyle: 'none' },
  submitBtn: { backgroundColor: '#8B5CF6', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 25 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

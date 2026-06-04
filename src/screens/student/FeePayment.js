import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import StripePaymentButton from '../../components/payments/StripePaymentButton';

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

function LoadingState() {
  return <RosterSkeleton rowCount={4} showFilters={false} />;
}

function LedgerHero({ paid, pending, progress, total }) {
  const { colors } = useRootLayout();

  return (
    <EnterprisePanel style={styles.ledgerHero}>
      <View style={styles.statRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.label, { color: colors.muted }]}>Total dues</Text>
          <Text style={[styles.valueTotal, { color: colors.text }]}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.statBlockRight}>
          <Text style={[styles.label, { color: colors.muted }]}>Paid to date</Text>
          <Text style={[styles.valuePaid, { color: colors.emerald }]}>{formatCurrency(paid)}</Text>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: '#111827' }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.bronze, width: `${progress}%` }]} />
      </View>

      <View style={[styles.infoBox, { backgroundColor: pending > 0 ? colors.deepBlueSoft : colors.emeraldSoft, borderColor: colors.hairline }]}>
        <Ionicons name={pending > 0 ? 'shield-checkmark' : 'checkmark-circle'} size={24} color={pending > 0 ? colors.deepBlue : colors.emerald} />
        <Text style={[styles.infoText, { color: colors.textSoft }]}>
          {total === 0
            ? 'No fees have been assigned to you yet.'
            : pending > 0
              ? `You have ${formatCurrency(pending)} remaining in unpaid dues. Secured by Stripe.`
              : 'All assigned dues are cleared.'}
        </Text>
      </View>
    </EnterprisePanel>
  );
}

function FeeRow({ fee }) {
  const { colors, radii } = useRootLayout();
  const isExam = String(fee.type || '').toLowerCase().includes('exam');

  return (
    <View
      style={[
        styles.breakdownCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.control,
        },
      ]}
    >
      <View style={[styles.iconCage, { backgroundColor: colors.bronzeSoft, borderColor: colors.hairline }]}>
        <Ionicons name={isExam ? 'document-text' : 'cash'} size={22} color={colors.bronze} />
      </View>
      <View style={styles.feeTextBlock}>
        <Text numberOfLines={1} style={[styles.feeTitle, { color: colors.text }]}>
          {fee.title || 'Campus fee'}
        </Text>
        <Text numberOfLines={1} style={[styles.feeType, { color: colors.muted }]}>
          {fee.type || 'General'}
        </Text>
      </View>
      <Text style={[styles.feeAmount, { color: colors.text }]}>{formatCurrency(fee.amount)}</Text>
    </View>
  );
}

export default function FeePayment() {
  const { userData } = useAuth();
  const { colors } = useRootLayout();
  const [feeData, setFeeData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const ledgerUserUid = userData?.role === 'parent' ? userData?.linkedStudentUid : userData?.uid;

  useEffect(() => {
    if (!ledgerUserUid) {
      setFeeData({});
      return undefined;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', ledgerUserUid), (document) => {
      setFeeData(document.data() || {});
    }, (error) => {
      console.error('Fee ledger listener failed:', error);
      setFeeData({});
    });

    return () => unsubscribe();
  }, [ledgerUserUid]);

  useEffect(() => {
    if (!ledgerUserUid || !userData?.instituteId) {
      setInvoices([]);
      return undefined;
    }

    const invoicesQuery = query(
      collection(db, 'feeInvoices'),
      where('instituteId', '==', userData.instituteId),
      where('studentUid', '==', ledgerUserUid)
    );
    return onSnapshot(invoicesQuery, (snapshot) => {
      const nextInvoices = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((left, right) => String(left.dueDate || '').localeCompare(String(right.dueDate || '')));
      setInvoices(nextInvoices);
    }, (error) => {
      console.error('Fee invoice listener failed:', error);
      setInvoices([]);
    });
  }, [ledgerUserUid, userData?.instituteId]);

  const ledger = useMemo(() => {
    if (invoices.length > 0) {
      const total = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
      const paid = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
      const pending = Math.max(0, total - paid);
      const progress = total === 0 ? 100 : Math.min((paid / total) * 100, 100);
      return { breakdown: invoices, paid, pending, progress, total };
    }

    const paid = Number(feeData?.feePaid || 0);
    const total = Number(feeData?.totalFee || 0);
    const pending = Math.max(0, total - paid);
    const progress = total === 0 ? 100 : Math.min((paid / total) * 100, 100);
    const breakdown = Array.isArray(feeData?.feeBreakdown) ? feeData.feeBreakdown : [];

    return { breakdown, paid, pending, progress, total };
  }, [feeData, invoices]);

  const nextUnpaidInvoice = useMemo(
    () => invoices.find((invoice) => invoice.status !== 'paid' && Number(invoice.balanceAmountMinor || 0) > 0) || null,
    [invoices]
  );

  if (!feeData) return <LoadingState />;

  return (
    <StudentScreenScaffold accentVariant="bronze">
      <ScreenIntro
        accentColor={colors.bronze}
        eyebrow="Finance ledger"
        subtitle="Track assigned dues, payments, receipts, and Stripe clearance status."
        title="Fees"
        trailing={<Ionicons name="wallet" size={27} color={colors.bronze} />}
      />

      <LedgerHero
        paid={ledger.paid}
        pending={ledger.pending}
        progress={ledger.progress}
        total={ledger.total}
      />

      {ledger.total > 0 && (
        <View style={styles.paymentButtonWrap}>
          {nextUnpaidInvoice ? (
            <StripePaymentButton
              invoiceId={nextUnpaidInvoice.id}
              label={`Pay ${formatCurrency(nextUnpaidInvoice.balanceAmount || nextUnpaidInvoice.amount)}`}
            />
          ) : (
            <View style={[styles.clearedButton, { backgroundColor: colors.emerald }]}>
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.clearedButtonText}>All Dues Cleared</Text>
            </View>
          )}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Itemized dues</Text>
      {ledger.breakdown.length === 0 ? (
        <EnterprisePanel style={styles.emptyPanel}>
          <Ionicons name="receipt-outline" size={32} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No specific fees logged by the admin.</Text>
        </EnterprisePanel>
      ) : (
        ledger.breakdown.map((fee, index) => (
          <FeeRow fee={fee} key={`${fee.title || fee.type || 'fee'}-${index}`} />
        ))
      )}
    </StudentScreenScaffold>
  );
}

const styles = StyleSheet.create({
  breakdownCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 12,
    overflow: 'hidden',
    padding: 15,
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyPanel: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 150,
    padding: 18,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  feeAmount: {
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 10,
  },
  feeTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  feeTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  feeType: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  iconCage: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  infoBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  ledgerHero: {
    marginBottom: 18,
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  paymentButtonWrap: {
    marginBottom: 24,
  },
  clearedButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 24,
    padding: 18,
  },
  clearedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  progressFill: {
    borderRadius: 8,
    height: '100%',
  },
  progressTrack: {
    borderRadius: 8,
    height: 12,
    marginTop: 24,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
  },
  statBlock: {
    flex: 1,
    minWidth: 0,
  },
  statBlockRight: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  statRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  valuePaid: {
    fontSize: 25,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  valueTotal: {
    fontSize: 25,
    fontWeight: '900',
    marginTop: 6,
  },
});

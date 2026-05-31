import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { authenticatedFetch } from '../../services/apiClient';

// Dynamically injects Razorpay SDK for Web Browsers
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function FeePayment() {
  const { currentUser, userData } = useAuth();
  const [feeData, setFeeData] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(doc(db, "users", userData.uid), (document) => {
      setFeeData(document.data());
    });
    return () => unsub();
  }, [userData]);

  const handleRazorpayCheckout = async () => {
    setIsPaying(true);

    try {
      // 1. Load the Script (Web only)
      const isSdkLoaded = await loadRazorpayScript();
      if (!isSdkLoaded) {
        setIsPaying(false);
        if (Platform.OS === 'web') {
          window.alert("Failed to load Razorpay SDK");
        } else {
          Alert.alert("Error", "Check your internet connection.");
        }
        return;
      }

      const order = await authenticatedFetch('/api/payments/create-order', currentUser, {
        method: 'POST',
      });

      if (!order.id) throw new Error("Server did not return an Order ID.");

      // 3. Open the Real Razorpay Checkout Window
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: userData?.instituteData?.name || "Campus Pay",
        description: `Fee Clearance for ${userData.name}`,
        order_id: order.id,
        prefill: {
          name: userData.name,
          email: userData.email,
        },
        theme: { color: "#8B5CF6" },
        handler: async function (paymentResponse) {
          try {
            await authenticatedFetch('/api/payments/verify', currentUser, {
              method: 'POST',
              body: {
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
              },
            });

            if (Platform.OS === 'web') {
              window.alert("Payment Successful! Ledger updated.");
            } else {
              Alert.alert("Success", "Payment Successful!");
            }
          } catch (err) {
            console.error("Payment Verification Error:", err);
            if (Platform.OS === 'web') {
              window.alert("Payment was received but verification failed. Please contact your campus office.");
            } else {
              Alert.alert("Verification Pending", "Payment was received but verification failed. Please contact your campus office.");
            }
          }
        },
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response) {
        if (Platform.OS === 'web') {
          window.alert(`Payment Failed: ${response.error.description}`);
        } else {
          Alert.alert("Failed", response.error.description);
        }
      });

      rzp.open();

    } catch (e) {
      console.error(e);
      if (Platform.OS === 'web') {
        window.alert("Could not connect to payment server. Is your backend running?");
      } else {
        Alert.alert("Server Error", "Could not connect to payment server.");
      }
    } finally {
      setIsPaying(false);
    }
  };

  if (!feeData) return <SmoothSpinner style={{ flex: 1, marginTop: 100 }} color="#8B5CF6" size="large" />;

  const paid = feeData.feePaid || 0;
  const total = feeData.totalFee || 0;
  const pending = Math.max(0, total - paid);
  const progress = total === 0 ? 100 : Math.min((paid / total) * 100, 100);
  const breakdown = feeData.feeBreakdown || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      
      {/* FINANCIAL OVERVIEW CARD */}
      <View style={styles.card}>
        <Text style={styles.title}>Financial Dashboard</Text>
        
        <View style={styles.statRow}>
          <View>
            <Text style={styles.label}>Total Dues</Text>
            <Text style={styles.valueTotal}>Rs. {total.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Paid to date</Text>
            <Text style={styles.valuePaid}>Rs. {paid.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        {total === 0 ? (
          <View style={[styles.infoBox, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
            <Text style={[styles.infoText, { color: '#16A34A' }]}>No fees have been assigned to you yet.</Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
            <Text style={styles.infoText}>
              You have <Text style={{fontWeight:'900'}}>Rs. {pending.toLocaleString()}</Text> remaining in unpaid dues. Secured by Razorpay.
            </Text>
          </View>
        )}

        {total > 0 && (
          <TouchableOpacity 
            style={[styles.payBtn, paid >= total && styles.disabledBtn]} 
            onPress={handleRazorpayCheckout} 
            disabled={isPaying || paid >= total}
          >
            {isPaying ? <SmoothSpinner color="#fff" /> : (
              <>
                <Ionicons name={paid >= total ? "checkmark-done" : "card"} size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.payText}>{paid >= total ? "All Dues Cleared" : "Pay with Razorpay"}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ITEMIZED BILL */}
      <Text style={styles.sectionTitle}>Itemized Dues</Text>
      {breakdown.length === 0 ? (
        <Text style={styles.emptyText}>No specific fees logged by the Admin.</Text>
      ) : (
        breakdown.map((fee, index) => (
          <View key={index} style={styles.breakdownCard}>
            <View style={styles.iconCage}>
              <Ionicons name={fee.type?.toLowerCase().includes('exam') ? 'document-text' : 'cash'} size={24} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeTitle}>{fee.title}</Text>
              <Text style={styles.feeType}>{fee.type}</Text>
            </View>
            <Text style={styles.feeAmount}>Rs. {fee.amount.toLocaleString()}</Text>
          </View>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 25, elevation: 4, marginTop: 10, marginBottom: 30 },
  title: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 25 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { color: '#64748B', fontWeight: '600', fontSize: 13, textTransform: 'uppercase' },
  valueTotal: { color: '#1E293B', fontSize: 24, fontWeight: '900', marginTop: 4 },
  valuePaid: { color: '#10B981', fontSize: 24, fontWeight: '900', marginTop: 4 },
  progressBg: { height: 12, backgroundColor: '#F1F5F9', borderRadius: 6, marginVertical: 25, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#8B5CF6' },
  infoBox: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: 18, borderRadius: 16, marginBottom: 25, alignItems: 'center' },
  infoText: { color: '#1E40AF', fontSize: 14, marginLeft: 12, flex: 1, lineHeight: 20 },
  payBtn: { backgroundColor: '#8B5CF6', flexDirection: 'row', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  disabledBtn: { backgroundColor: '#10B981', elevation: 0 },
  payText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 15, marginLeft: 5 },
  emptyText: { color: '#94A3B8', fontStyle: 'italic', marginLeft: 5 },
  breakdownCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 12, elevation: 1 },
  iconCage: { backgroundColor: '#F5F3FF', padding: 12, borderRadius: 12, marginRight: 15 },
  feeTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  feeType: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  feeAmount: { fontSize: 16, fontWeight: 'bold', color: '#8B5CF6' }
});

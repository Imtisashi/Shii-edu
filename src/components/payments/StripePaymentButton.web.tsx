import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { authenticatedFetch } from '../../services/apiClient';
import { SmoothSpinner } from '../ui/LoadingState';
import { createIdempotencyKey } from '../../utils/idempotencyKey';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';

type StripePaymentButtonProps = {
  disabled?: boolean;
  invoiceId: string;
  label?: string;
  onCompleted?: () => void;
};

type CheckoutSession = {
  checkoutUrl: string;
};

export default function StripePaymentButton({
  disabled = false,
  invoiceId,
  label = 'Pay securely with Stripe',
}: StripePaymentButtonProps) {
  const { currentUser } = useAuth();
  const { colors } = useRootLayout();

  const openCheckout = async () => {
    try {
      const session = await authenticatedFetch('/api/payments/create-intent', currentUser, {
        method: 'POST',
        retryCount: 0,
        body: {
          idempotencyKey: createIdempotencyKey('stripe-checkout'),
          invoiceId,
          platform: 'web',
          returnUrl: window.location.href,
        },
      }) as CheckoutSession;

      if (!session.checkoutUrl) {
        throw new Error('Stripe did not return a secure checkout URL.');
      }
      window.location.assign(session.checkoutUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'The payment could not be started.');
    }
  };
  const { isPending: loading, run: pay } = useSingleFlightAction(openCheckout, {
    cooldownMs: 1200,
    disabled,
    haptic: 'medium',
  });

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => { void pay(); }}
      style={[
        styles.button,
        {
          backgroundColor: colors.violet,
          opacity: disabled || loading ? 0.55 : 1,
        },
      ]}
    >
      {loading ? (
        <SmoothSpinner color="#FFFFFF" size={24} style={undefined} trackColor="#CBD5E1" />
      ) : (
        <Ionicons name="card-outline" size={20} color="#FFFFFF" />
      )}
      <Text style={styles.label}>{loading ? 'Opening secure checkout...' : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
});

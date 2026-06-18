'use client';

import { createContext, useContext, useEffect, useState } from 'react';
// We'll call the API route instead of importing firebaseAdmin directly

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSubscription = async () => {
      try {
        const res = await fetch('/api/subscription');
        if (!res.ok) {
          throw new Error('Failed to fetch subscription');
        }
        const data = await res.json();
        if (isMounted) {
          setSubscription(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    };

    fetchSubscription();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSubscription = async (planId) => {
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      if (!res.ok) {
        throw new Error('Failed to update subscription');
      }
      const data = await res.json();
      setSubscription(data);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const value = {
    subscription,
    isLoading,
    error,
    updateSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
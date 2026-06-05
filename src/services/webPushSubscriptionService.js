import { Platform } from 'react-native';
import { authenticatedFetch, getApiBaseUrl } from './apiClient';
import {
  ensurePwaServiceWorker,
  getPwaNotificationPermission,
  requestPwaNotificationPermission,
} from './pwaNotificationService';

const WEB_PUSH_PATH = '/api/notifications/web-push-subscriptions';

const isWebPushSupported = () => (
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window
);

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

const fetchWebPushConfig = async () => {
  const response = await fetch(`${getApiBaseUrl()}${WEB_PUSH_PATH}`, {
    headers: { Accept: 'application/json' },
    method: 'GET',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'Web push configuration could not be loaded.');
  }

  return {
    configured: Boolean(data.configured && data.publicKey),
    publicKey: typeof data.publicKey === 'string' ? data.publicKey : '',
  };
};

export const getExistingWebPushSubscription = async () => {
  if (!isWebPushSupported() || getPwaNotificationPermission() !== 'granted') return null;

  const registration = await ensurePwaServiceWorker();
  if (!registration?.pushManager) return null;

  const subscription = await registration.pushManager.getSubscription();
  return subscription ? subscription.toJSON() : null;
};

export const ensureWebPushSubscription = async ({ promptForPermission = false } = {}) => {
  if (!isWebPushSupported()) {
    return { reason: 'unsupported', subscription: null };
  }

  const permission = promptForPermission
    ? await requestPwaNotificationPermission()
    : getPwaNotificationPermission();

  if (permission !== 'granted') {
    return { reason: permission, subscription: null };
  }

  const config = await fetchWebPushConfig().catch(() => ({ configured: false, publicKey: '' }));
  if (!config.configured) {
    return { reason: 'not_configured', subscription: null };
  }

  const registration = await ensurePwaServiceWorker();
  if (!registration?.pushManager) {
    return { reason: 'unsupported', subscription: null };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        userVisibleOnly: true,
      });
    } catch (_error) {
      return { reason: 'subscription_failed', subscription: null };
    }
  }

  return { reason: 'registered', subscription: subscription.toJSON() };
};

export const registerCurrentUserWebPush = async ({ currentUser, profile }) => {
  if (!currentUser?.uid || !profile?.instituteId) return { registered: false, reason: 'missing_user' };

  const { reason, subscription } = await ensureWebPushSubscription({ promptForPermission: false });
  if (!subscription) return { registered: false, reason };

  await authenticatedFetch(WEB_PUSH_PATH, currentUser, {
    body: {
      action: 'register',
      subscription,
    },
    method: 'POST',
    retryCount: 0,
    timeoutMs: 15000,
  });

  return { registered: true, reason: 'registered' };
};

export const requestAndPrepareWebPush = async () => ensureWebPushSubscription({ promptForPermission: true });

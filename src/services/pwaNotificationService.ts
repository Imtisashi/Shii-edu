import { Platform } from 'react-native';

export type PwaNotificationPermission = NotificationPermission | 'unsupported';

export type PwaNotificationPayload = {
  body?: string;
  data?: Record<string, unknown>;
  icon?: string;
  tag?: string;
  title: string;
  url?: string;
};

const DEFAULT_ICON = '/icon.png';

const isWebNotificationSupported = () => (
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator
);

export const getPwaNotificationPermission = (): PwaNotificationPermission => {
  if (!isWebNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const ensurePwaServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isWebNotificationSupported()) return null;

  const existingRegistration = await navigator.serviceWorker.getRegistration('/');
  if (existingRegistration) return existingRegistration;

  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
};

export const requestPwaNotificationPermission = async (): Promise<PwaNotificationPermission> => {
  if (!isWebNotificationSupported()) return 'unsupported';

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission === 'granted') {
    await ensurePwaServiceWorker().catch(() => null);
  }

  return permission;
};

export const showPwaNotification = async ({
  body = '',
  data = {},
  icon = DEFAULT_ICON,
  tag = 'shii-edu-notification',
  title,
  url,
}: PwaNotificationPayload): Promise<boolean> => {
  if (!isWebNotificationSupported() || Notification.permission !== 'granted') return false;

  const registration = await ensurePwaServiceWorker();
  if (!registration) return false;

  await registration.showNotification(title, {
    body,
    data: {
      url: url || window.location.pathname,
      ...data,
    },
    icon,
    tag,
  });
  return true;
};

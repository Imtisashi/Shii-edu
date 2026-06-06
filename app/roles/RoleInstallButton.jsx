'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Download, Info } from 'lucide-react';

function installInstructions() {
  const agent = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) return 'Open Share, then choose Add to Home Screen.';
  if (/android/.test(agent)) return 'Open the browser menu, then choose Install app or Add to Home screen.';
  return 'Use Chrome or Edge browser controls to install this role app.';
}

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

const prepareRemotePushSubscription = async (registration) => {
  if (!registration?.pushManager) return null;
  const configResponse = await fetch('/api/notifications/web-push-subscriptions', {
    headers: { Accept: 'application/json' },
  });
  const config = await configResponse.json().catch(() => ({}));
  if (!configResponse.ok || !config.configured || !config.publicKey) return null;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    userVisibleOnly: true,
  });
};

const normalizedPath = (url) => {
  const parsed = new URL(url, window.location.origin);
  return parsed.pathname.replace(/\/$/, '') || '/';
};

export default function RoleInstallButton({ accent, label, manifestHref, startUrl }) {
  const [notificationPermission, setNotificationPermission] = useState('unsupported');
  const [prompt, setPrompt] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setNotificationPermission(
      'Notification' in window && 'serviceWorker' in navigator
        ? window.Notification.permission
        : 'unsupported'
    );

    const handlePrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const handleInstalled = () => {
      setNotice(`${label} app is installed on this device.`);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [label]);

  const handleInstall = async () => {
    setNotice('');
    const link = document.querySelector('link[rel="manifest"]') || document.createElement('link');
    link.setAttribute('rel', 'manifest');
    link.setAttribute('href', manifestHref);
    document.head.appendChild(link);

    if (startUrl && normalizedPath(window.location.href) !== normalizedPath(startUrl)) {
      setNotice(`Opening the dedicated ${label} install screen.`);
      window.location.assign(startUrl);
      return;
    }

    if (!prompt) {
      setNotice(installInstructions());
      return;
    }

    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    setPrompt(null);
  };

  const handleNotifications = async () => {
    setNotice('');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotice('Install the PWA in a browser that supports OS notifications.');
      setNotificationPermission('unsupported');
      return;
    }

    const permission = window.Notification.permission === 'default'
      ? await window.Notification.requestPermission()
      : window.Notification.permission;
    setNotificationPermission(permission);

    if (permission !== 'granted') {
      setNotice('Browser settings are blocking OS alerts for this role app.');
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
    const readyRegistration = registration || await navigator.serviceWorker.ready.catch(() => null);
    const remoteSubscription = await prepareRemotePushSubscription(readyRegistration).catch(() => null);
    await readyRegistration?.showNotification('Shii-Edu alerts are ready', {
      body: `${label} can show password reset, route, and institute alerts on this device.`,
      data: { url: startUrl || (manifestHref.includes('driver') ? '/app/driver' : manifestHref.includes('parents') ? '/app/parents' : '/app/institute') },
      icon: '/icon.png',
      tag: `role-alerts-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    }).catch(() => null);
    setNotice(
      remoteSubscription
        ? `${label} OS alerts and remote push are enabled on this device.`
        : `${label} OS alerts are enabled on this device. Remote approval alerts will activate after the latest Shii-Edu update reaches this device.`
    );
  };

  const notificationIcon = notificationPermission === 'granted'
    ? CheckCircle2
    : notificationPermission === 'denied'
      ? BellOff
      : Bell;
  const NotificationIcon = notificationIcon;

  return (
    <div className="role-choice-install-wrap">
      <button
        className="role-choice-install"
        onClick={handleInstall}
        style={{ '--role-accent': accent }}
        type="button"
      >
        <Download size={16} aria-hidden="true" />
        Open install screen
      </button>
      <button
        className="role-choice-install role-choice-alert"
        onClick={handleNotifications}
        style={{ '--role-accent': accent }}
        type="button"
      >
        <NotificationIcon size={16} aria-hidden="true" />
        {notificationPermission === 'granted' ? 'OS alerts on' : 'Enable OS alerts'}
      </button>
      {notice ? (
        <div className="role-choice-install-notice">
          <Info size={15} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}
    </div>
  );
}

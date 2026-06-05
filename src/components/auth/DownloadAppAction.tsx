import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type DownloadAppActionProps = {
  accentColor?: string;
  appName?: string;
  borderColor?: string;
  manifestHref?: string;
  softColor?: string;
  startUrl?: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
};

const getInstallInstruction = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return 'You are already using the installed Shii-Edu app.';
  }
  const agent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(agent);
  const isAndroid = /android/.test(agent);
  return isIOS
    ? 'Open the Share menu, then choose Add to Home Screen.'
    : isAndroid
      ? 'Open the browser menu, then choose Install app or Add to Home screen.'
      : 'Use your browser menu to install Shii-Edu as an app. Chrome and Edge usually show Install app when the site is ready.';
};

const setManifestHref = (href?: string) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !href) return;
  const existing = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  const link = existing || document.createElement('link');
  link.rel = 'manifest';
  link.href = href;
  if (!existing) document.head.appendChild(link);
};

export default function DownloadAppAction({
  accentColor = '#635BFF',
  appName = 'Shii-Edu',
  borderColor = '#D9D7FF',
  manifestHref = '/manifest.webmanifest',
  softColor = '#F7F6FF',
  startUrl,
  style,
  textColor = '#010110',
}: DownloadAppActionProps) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const updateInstalledState = () => {
      const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
      const navigatorStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setInstalled(Boolean(standaloneMedia || navigatorStandalone));
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    updateInstalledState();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handlePress = async () => {
    setManifestHref(manifestHref);
    setNotice('');

    if (installed) {
      setNotice(`${appName} is already installed on this device.`);
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
      return;
    }

    setNotice(getInstallInstruction());
  };

  return (
    <View style={style}>
      <Pressable
        accessibilityLabel={`Download the App: ${appName}`}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: softColor,
            borderColor,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.iconCell, { backgroundColor: '#FFFFFF', borderColor }]}>
          <Ionicons color={accentColor} name={installed ? 'checkmark-circle-outline' : 'download-outline'} size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: textColor }]}>Download the App</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: accentColor }]}>
            {installed ? 'Installed on this device' : `Install ${appName} for faster access`}
          </Text>
          {startUrl ? <Text numberOfLines={1} style={styles.startUrl}>Starts at {startUrl}</Text> : null}
        </View>
        <Ionicons color={accentColor} name="chevron-forward" size={17} />
      </Pressable>
      {notice ? (
        <View style={[styles.notice, { borderColor }]}>
          <Ionicons color={accentColor} name="information-circle-outline" size={17} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  copy: {
    flex: 1,
    marginHorizontal: 10,
    minWidth: 0,
  },
  iconCell: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noticeText: {
    color: '#343548',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  startUrl: {
    color: '#737383',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
  },
});

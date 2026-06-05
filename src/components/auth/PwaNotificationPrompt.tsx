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
import {
  getPwaNotificationPermission,
  requestPwaNotificationPermission,
  showPwaNotification,
  type PwaNotificationPermission,
} from '../../services/pwaNotificationService';
import { showNativeMessage } from '../../utils/userFeedback';

type PwaNotificationPromptProps = {
  accentColor?: string;
  borderColor?: string;
  roleLabel?: string;
  softColor?: string;
  style?: StyleProp<ViewStyle>;
};

const getCopy = (permission: PwaNotificationPermission, roleLabel: string) => {
  if (permission === 'granted') {
    return {
      icon: 'notifications',
      subtitle: `OS alerts are enabled for ${roleLabel}.`,
      title: 'OS alerts enabled',
    } as const;
  }
  if (permission === 'denied') {
    return {
      icon: 'notifications-off-outline',
      subtitle: 'Browser settings are blocking alerts for this app.',
      title: 'OS alerts blocked',
    } as const;
  }
  if (permission === 'unsupported') {
    return {
      icon: 'phone-portrait-outline',
      subtitle: 'Install the PWA in Chrome, Edge, or Safari to use OS alerts.',
      title: 'OS alerts unavailable',
    } as const;
  }

  return {
    icon: 'notifications-outline',
    subtitle: `Get reset approvals, route updates, and institute alerts for ${roleLabel}.`,
    title: 'Enable OS alerts',
  } as const;
};

export default function PwaNotificationPrompt({
  accentColor = '#635BFF',
  borderColor = '#D9D7FF',
  roleLabel = 'this workspace',
  softColor = '#F7F6FF',
  style,
}: PwaNotificationPromptProps) {
  const [permission, setPermission] = useState<PwaNotificationPermission>('unsupported');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setPermission(getPwaNotificationPermission());
  }, []);

  if (Platform.OS !== 'web') return null;

  const copy = getCopy(permission, roleLabel);
  const disabled = busy || permission === 'granted' || permission === 'denied' || permission === 'unsupported';

  const handlePress = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const nextPermission = await requestPwaNotificationPermission();
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        showNativeMessage('OS Alerts Enabled', `Shii-Edu can now send ${roleLabel} alerts on this device.`);
        await showPwaNotification({
          body: 'Password reset approvals and role alerts can appear here when the PWA is active.',
          tag: 'shii-edu-os-alerts-enabled',
          title: 'Shii-Edu alerts are ready',
        }).catch(() => false);
      } else if (nextPermission === 'denied') {
        showNativeMessage('OS Alerts Blocked', 'Open browser site settings to enable notifications for Shii-Edu.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={style}>
      <Pressable
        accessibilityLabel={copy.title}
        accessibilityRole="button"
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.prompt,
          {
            backgroundColor: permission === 'granted' ? '#FFFFFF' : softColor,
            borderColor,
            opacity: pressed ? 0.84 : 1,
          },
        ]}
      >
        <View style={[styles.iconCell, { borderColor, backgroundColor: '#FFFFFF' }]}>
          <Ionicons color={permission === 'denied' ? '#DC2626' : accentColor} name={copy.icon} size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{busy ? 'Opening permission request' : copy.title}</Text>
          <Text numberOfLines={2} style={[styles.subtitle, { color: permission === 'denied' ? '#991B1B' : '#3F4054' }]}>
            {copy.subtitle}
          </Text>
        </View>
        {!disabled ? <Ionicons color={accentColor} name="chevron-forward" size={17} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  prompt: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 2,
  },
  title: {
    color: '#010110',
    fontSize: 13,
    fontWeight: '900',
  },
});

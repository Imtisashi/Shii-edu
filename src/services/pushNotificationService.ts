import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../../firebaseConfig';

type PushProfile = {
  instituteId?: string | null;
  role?: string | null;
};

const resolveProjectId = (): string | undefined => (
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID
);

export const registerDevicePushToken = async ({
  currentUser,
  profile,
}: {
  currentUser: User | null | undefined;
  profile: PushProfile | null | undefined;
}): Promise<string | null> => {
  if (Platform.OS === 'web' || !Device.isDevice || !currentUser?.uid || !profile?.instituteId) {
    return null;
  }

  const Notifications = await import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('edu-hub-default', {
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Shii-Edu notifications',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  const permission = existingPermission.status === 'granted'
    ? existingPermission
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn('Push notifications are disabled because EXPO_PUBLIC_EAS_PROJECT_ID is missing.');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await setDoc(doc(db, 'pushTokens', currentUser.uid), {
    uid: currentUser.uid,
    instituteId: profile.instituteId,
    role: profile.role || null,
    token,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return token;
};

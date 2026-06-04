import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';

const STORAGE_ID = 'edu-shii.institute-identity.v1';
const IDENTITY_KEY = 'instituteIdentity';
const SECURE_IDENTITY_FALLBACK_KEY = 'eduShii.instituteIdentity.v1';
const SECURE_MMKV_KEY = 'eduShii.mmkvEncryptionKey.v1';

export type CachedInstituteIdentity = {
  biometricEnabled: boolean;
  instituteId: string;
  instituteName: string;
  logoUrl: string | null;
  uid: string;
  updatedAt: string;
  userId: string;
};

type StoredInstituteIdentity = CachedInstituteIdentity & {
  version: 1;
};

let nativeStoragePromise: Promise<MMKV | null> | null = null;
const webStorage = Platform.OS === 'web' ? createMMKV({ id: STORAGE_ID }) : null;

const createEncryptionKey = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = Crypto.getRandomBytes(32);
  return Array.from(bytes, (byte) => alphabet[byte & 63]).join('');
};

const getOrCreateEncryptionKey = async (): Promise<string> => {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();
  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is unavailable.');
  }

  const existingKey = await SecureStore.getItemAsync(SECURE_MMKV_KEY);
  if (existingKey) return existingKey;

  const encryptionKey = createEncryptionKey();
  await SecureStore.setItemAsync(SECURE_MMKV_KEY, encryptionKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return encryptionKey;
};

const getNativeStorage = async (): Promise<MMKV | null> => {
  if (Platform.OS === 'web') return null;
  if (nativeStoragePromise) return nativeStoragePromise;

  nativeStoragePromise = (async () => {
    try {
      const encryptionKey = await getOrCreateEncryptionKey();
      return createMMKV({
        encryptionKey,
        encryptionType: 'AES-256',
        id: STORAGE_ID,
      });
    } catch (error) {
      console.warn('Encrypted MMKV is unavailable; using SecureStore fallback.', error);
      return null;
    }
  })();

  return nativeStoragePromise;
};

const readRawIdentity = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return webStorage?.getString(IDENTITY_KEY) || null;
  }

  const storage = await getNativeStorage();
  if (storage) return storage.getString(IDENTITY_KEY) || null;
  return SecureStore.getItemAsync(SECURE_IDENTITY_FALLBACK_KEY);
};

const writeRawIdentity = async (value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    webStorage?.set(IDENTITY_KEY, value);
    return;
  }

  const storage = await getNativeStorage();
  if (storage) {
    storage.set(IDENTITY_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(SECURE_IDENTITY_FALLBACK_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

const clearRawIdentity = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    webStorage?.remove(IDENTITY_KEY);
    return;
  }

  const storage = await getNativeStorage();
  storage?.remove(IDENTITY_KEY);
  await SecureStore.deleteItemAsync(SECURE_IDENTITY_FALLBACK_KEY);
};

const isStoredInstituteIdentity = (value: unknown): value is StoredInstituteIdentity => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  return record.version === 1 &&
    typeof record.uid === 'string' &&
    typeof record.instituteId === 'string' &&
    typeof record.userId === 'string' &&
    typeof record.instituteName === 'string' &&
    (record.logoUrl === null || typeof record.logoUrl === 'string') &&
    typeof record.biometricEnabled === 'boolean' &&
    typeof record.updatedAt === 'string';
};

export const readCachedInstituteIdentity = async (): Promise<CachedInstituteIdentity | null> => {
  try {
    const rawIdentity = await readRawIdentity();
    if (!rawIdentity) return null;

    const parsedIdentity: unknown = JSON.parse(rawIdentity);
    if (!isStoredInstituteIdentity(parsedIdentity)) {
      await clearRawIdentity();
      return null;
    }

    const {
      version: _version,
      ...identity
    } = parsedIdentity;
    return identity;
  } catch (error) {
    console.warn('Failed to read the cached institute identity.', error);
    return null;
  }
};

export const writeCachedInstituteIdentity = async (
  identity: CachedInstituteIdentity
): Promise<CachedInstituteIdentity> => {
  const normalizedIdentity: CachedInstituteIdentity = {
    biometricEnabled: Boolean(identity.biometricEnabled),
    instituteId: identity.instituteId.trim(),
    instituteName: identity.instituteName.trim() || 'Shii-Edu',
    logoUrl: identity.logoUrl?.trim() || null,
    uid: identity.uid.trim(),
    updatedAt: new Date().toISOString(),
    userId: identity.userId.trim(),
  };

  const storedIdentity: StoredInstituteIdentity = {
    ...normalizedIdentity,
    version: 1,
  };

  await writeRawIdentity(JSON.stringify(storedIdentity));
  return normalizedIdentity;
};

export const clearCachedInstituteIdentity = async (): Promise<void> => {
  try {
    await clearRawIdentity();
  } catch (error) {
    console.warn('Failed to clear the cached institute identity.', error);
  }
};

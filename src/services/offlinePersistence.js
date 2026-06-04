import { Platform } from 'react-native';

let persistencePromise = null;

export const installFirestoreOfflinePersistence = () => {
  if (Platform.OS !== 'web') return Promise.resolve(false);
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (persistencePromise) return persistencePromise;

  persistencePromise = Promise.resolve(true);

  return persistencePromise;
};

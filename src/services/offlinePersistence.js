import { Platform } from 'react-native';
import { enableIndexedDbPersistence } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

let persistencePromise = null;

export const installFirestoreOfflinePersistence = () => {
  if (Platform.OS !== 'web') return Promise.resolve(false);
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (persistencePromise) return persistencePromise;

  persistencePromise = enableIndexedDbPersistence(db)
    .then(() => true)
    .catch((error) => {
      if (error.code === 'failed-precondition' || error.code === 'unimplemented') {
        console.warn('Firestore offline persistence unavailable:', error.code);
        return false;
      }
      console.error('Firestore offline persistence failed:', error);
      return false;
    });

  return persistencePromise;
};

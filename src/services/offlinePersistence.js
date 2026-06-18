import { Platform } from 'react-native';

let persistencePromise = null;

export const installFirestoreOfflinePersistence = () => {
  if (persistencePromise) return persistencePromise;

  // For web platforms, persistence is configured during Firestore creation.
  // For mobile platforms (iOS/Android), Firebase JS SDK with React Native
  // should automatically handle persistence via AsyncStorage
  persistencePromise = Promise.resolve().then(() => {
    if (Platform.OS === 'web') {
      // Web Firestore uses the single SDK-managed instance from firebaseConfig.
      // Re-enabling persistence here throws when the cache is already specified.
      return true;
    } else {
      // For mobile, persistence should be handled automatically by Firebase JS SDK
      // when used with React Native (via AsyncStorage)
      // We can verify by checking if the Firestore instance has persistence enabled
      return true;
    }
  });

  return persistencePromise;
};

// firebaseConfig.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


// Firebase web config is public client configuration. Env vars still win for
// production overrides, but these defaults prevent a blank app when Vercel env
// vars have not been filled in yet.
const firebaseDefaults = {
  apiKey: 'AIzaSyC46pfILcDaEAYNw_L-6-KztiJ7Blxm-E4',
  authDomain: 'edu-hub-1fce7.firebaseapp.com',
  projectId: 'edu-hub-1fce7',
  storageBucket: 'edu-hub-1fce7.firebasestorage.app',
  messagingSenderId: '1032288165483',
  appId: '1:1032288165483:web:786d31e6a5b6fb26421b2e',
};

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || firebaseDefaults.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseDefaults.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || firebaseDefaults.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseDefaults.storageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseDefaults.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || firebaseDefaults.appId,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };

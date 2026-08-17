import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}),
  experimentalForceLongPolling: true
}, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430');
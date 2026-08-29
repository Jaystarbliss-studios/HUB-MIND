import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Initialize Auth with durable browser persistence BEFORE any login call.
// This is important for Google OAuth on mobile browsers: the auth state must
// survive the provider popup/redirect lifecycle instead of being initialized
// with the default persistence after the login has already started.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const FIRESTORE_DATABASE_ID = 'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430';

// Initialize Firestore targeting the dedicated HubMind database with offline persistence
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  },
  FIRESTORE_DATABASE_ID
);

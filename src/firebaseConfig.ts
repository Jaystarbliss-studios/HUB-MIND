import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth, getAuth, browserLocalPersistence, browserSessionPersistence,
  indexedDBLocalPersistence, browserPopupRedirectResolver, Auth
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, Firestore
} from 'firebase/firestore';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
    return (import.meta as any).env[key] || '';
  }
  if (typeof process !== 'undefined' && process?.env?.[key]) {
    return process.env[key] || '';
  }
  return '';
};

const isBrowser = typeof window !== 'undefined';

// Node-based unit/security tests import this module without a browser env. Keep
// those imports side-effect safe while requiring complete configuration in the browser.
const projectId = getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID') || (!isBrowser ? 'test-project' : '');
const apiKey = getEnv('VITE_FIREBASE_WEB_API_KEY') || getEnv('FIREBASE_WEB_API_KEY') || (!isBrowser ? 'test-api-key' : '');
const appId = getEnv('VITE_FIREBASE_APP_ID') || getEnv('FIREBASE_APP_ID') || (!isBrowser ? 'test-app-id' : '');
const authDomain =
  getEnv('VITE_FIREBASE_AUTH_DOMAIN') ||
  getEnv('FIREBASE_AUTH_DOMAIN') ||
  (projectId ? `${projectId}.firebaseapp.com` : '');
const storageBucket =
  getEnv('VITE_FIREBASE_STORAGE_BUCKET') ||
  getEnv('FIREBASE_STORAGE_BUCKET') ||
  (projectId ? `${projectId}.firebasestorage.app` : '');
const messagingSenderId =
  getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') ||
  getEnv('FIREBASE_MESSAGING_SENDER_ID') ||
  (!isBrowser ? 'test-sender-id' : '');

export const FIRESTORE_DATABASE_ID =
  getEnv('VITE_FIRESTORE_DATABASE_ID') ||
  getEnv('FIRESTORE_DATABASE_ID') ||
  '(default)';

const firebaseConfig = {
  apiKey,
  projectId,
  appId,
  authDomain,
  storageBucket,
  messagingSenderId,
};

const missing = Object.entries({
  VITE_FIREBASE_WEB_API_KEY: apiKey,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_APP_ID: appId,
  VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
}).filter(([, value]) => !value).map(([key]) => key);

if (isBrowser && missing.length) {
  throw new Error(`Firebase configuration is incomplete. Missing: ${missing.join(', ')}`);
}

export const FIREBASE_PROJECT_ID = projectId;

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth: Auth = authInstance;

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
    FIRESTORE_DATABASE_ID === '(default)' ? undefined : FIRESTORE_DATABASE_ID
  );
} catch {
  try {
    dbInstance = FIRESTORE_DATABASE_ID === '(default)'
      ? getFirestore(app)
      : getFirestore(app, FIRESTORE_DATABASE_ID);
  } catch {
    dbInstance = initializeFirestore(
      app, {}, FIRESTORE_DATABASE_ID === '(default)' ? undefined : FIRESTORE_DATABASE_ID
    );
  }
}
export const db: Firestore = dbInstance;

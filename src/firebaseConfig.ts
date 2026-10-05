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
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process?.env?.[key]) {
    return process.env[key] || '';
  }
  return '';
};

const projectId = getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID') || 'gen-lang-client-0197530608';
const apiKey = getEnv('VITE_FIREBASE_WEB_API_KEY') || getEnv('FIREBASE_WEB_API_KEY') || (typeof window === 'undefined' ? 'test-api-key' : '');

const firebaseConfig = {
  apiKey,
  projectId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || getEnv('FIREBASE_APP_ID') || '1:691762959980:web:0979e7745677270cc92a49',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('FIREBASE_AUTH_DOMAIN') || (projectId + '.firebaseapp.com'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('FIREBASE_STORAGE_BUCKET') || (projectId + '.firebasestorage.app'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('FIREBASE_MESSAGING_SENDER_ID') || '691762959980',
};

if (!firebaseConfig.apiKey && typeof window !== 'undefined') {
  throw new Error('Firebase Web API key is not configured.');
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

export const FIRESTORE_DATABASE_ID =
  getEnv('VITE_FIRESTORE_DATABASE_ID') || getEnv('FIRESTORE_DATABASE_ID') || 'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430';

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

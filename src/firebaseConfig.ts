import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth, getAuth, browserLocalPersistence, browserSessionPersistence,
  indexedDBLocalPersistence, browserPopupRedirectResolver, Auth
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, Firestore
} from 'firebase/firestore';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0197530608';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_WEB_API_KEY || '',
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:691762959980:web:0979e7745677270cc92a49',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (projectId + '.firebaseapp.com'),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (projectId + '.firebasestorage.app'),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '691762959980',
};

if (!firebaseConfig.apiKey) throw new Error('VITE_FIREBASE_WEB_API_KEY is not configured.');

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
  import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)';

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

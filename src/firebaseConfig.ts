import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  indexedDBLocalPersistence, 
  browserPopupRedirectResolver,
  Auth
} from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with durable browser persistence and safe fallback
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

export const FIRESTORE_DATABASE_ID = (firebaseConfig as any).firestoreDatabaseId || '(default)';

// Initialize Firestore targeting the configured database with offline persistence and resilient fallback
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    },
    FIRESTORE_DATABASE_ID === '(default)' ? undefined : FIRESTORE_DATABASE_ID
  );
} catch {
  try {
    dbInstance = FIRESTORE_DATABASE_ID === '(default)' ? getFirestore(app) : getFirestore(app, FIRESTORE_DATABASE_ID);
  } catch {
    dbInstance = initializeFirestore(app, {}, FIRESTORE_DATABASE_ID === '(default)' ? undefined : FIRESTORE_DATABASE_ID);
  }
}
export const db: Firestore = dbInstance;


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

export const FIRESTORE_DATABASE_ID = '(default)';

// Initialize Firestore targeting the default database with offline persistence and resilient fallback
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  try {
    dbInstance = getFirestore(app);
  } catch {
    dbInstance = initializeFirestore(app, {});
  }
}
export const db: Firestore = dbInstance;


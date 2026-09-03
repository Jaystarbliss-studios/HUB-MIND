import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  indexedDBLocalPersistence, 
  browserPopupRedirectResolver 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with durable browser persistence and safe fallback
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

export const FIRESTORE_DATABASE_ID = '(default)';

// Initialize Firestore targeting the default database with offline persistence and resilient fallback
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  dbInstance = getFirestore(app);
}
export const db = dbInstance;


import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth, getAuth, browserLocalPersistence, browserSessionPersistence,
  indexedDBLocalPersistence, browserPopupRedirectResolver, Auth
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, Firestore
} from 'firebase/firestore';

type RuntimeConfig = {
  firebase: {
    apiKey: string;
    projectId: string;
    appId: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    firestoreDatabaseId?: string;
  };
  googleClientId?: string;
};

const isBrowser = typeof window !== 'undefined';

const loadRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (!isBrowser) {
    return {
      firebase: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        appId: 'test-app-id',
        authDomain: 'test-project.firebaseapp.com',
        storageBucket: 'test-project.firebasestorage.app',
        messagingSenderId: 'test-sender-id',
        firestoreDatabaseId: '(default)',
      },
      googleClientId: '',
    };
  }

  const response = await fetch('/api/config', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Hub-Mind could not load its secure runtime configuration. Please refresh and try again.');
  }

  const data = await response.json();
  const firebase = data?.firebase;

  const missing = ['apiKey', 'projectId', 'appId', 'messagingSenderId']
    .filter((key) => !firebase?.[key]);

  if (missing.length) {
    throw new Error(`Hub-Mind runtime configuration is incomplete: ${missing.join(', ')}`);
  }

  return data as RuntimeConfig;
};

// Firebase browser configuration is intentionally loaded at runtime.
// It is never injected by Vite into the static JavaScript bundle.
const runtimeConfig = await loadRuntimeConfig();
const firebaseConfig = runtimeConfig.firebase;

export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const GOOGLE_CLIENT_ID = runtimeConfig.googleClientId || '';

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

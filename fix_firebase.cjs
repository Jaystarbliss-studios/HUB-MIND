const fs = require('fs');
let code = fs.readFileSync('src/firebaseConfig.ts', 'utf8');

const replacement = `
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
}, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430');
`;

// It might be better to just replace the whole file since it's short
fs.writeFileSync('src/firebaseConfig.ts', replacement.trim());
